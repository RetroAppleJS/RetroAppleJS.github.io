"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({oCOM:{getHexByte:v=>(v&255).toString(16).padStart(2,"0").toUpperCase()}});
vm.runInContext(fs.readFileSync(path.join(__dirname,"../res/ASM_core.js"),"utf8"),context);
function assemble(source, dialect="ACME") { return new context.ASM({dialect}).assemble(source); }
function values(result) { return Array.from(result.bytes,b=>b.val); }
function clean(result) { assert.equal(result.errors.length,0,JSON.stringify(result.errors)); }

// Catch missing complement, boolean negation, precedence mistakes and confusion with !=.
test("ACME unary ! complements bits in instructions and expressions",()=>{
    for(const dialect of ["ACME","multi"]){
        const result=assemble('*=$2000\nand #!($20)\n!byte !0&255, !!$20, !(1+2)&255, 1!=2, !1+2&255',dialect);
        clean(result);
        assert.deepEqual(values(result),[0x29,0xdf,255,32,252,1,0]);
    }
});
test("complement does not rewrite quoted text or change foreign explicit modes",()=>{
    clean(assemble('!text "! @ + -"'));
    assert.deepEqual(values(assemble('!text "! @ + -"')),[33,32,64,32,43,32,45]);
    for(const dialect of ["raJS","ca65","Merlin","S-C"])
        assert.ok(assemble('lda #!$20',dialect).errors.length);
});
test("complement preserves signed scalar values for later expressions",()=>{
    const result=assemble('MASK=!$20\n!word MASK&65535\n!byte MASK&255');
    clean(result);
    assert.equal(result.symtab.MASK,-33);
    assert.deepEqual(values(result),[223,255,223]);
});

// Catch locals leaking between zones or incorrectly resetting at global labels.
test("dot labels belong to each zone instance, including repeated zone names",()=>{
    for(const dialect of ["ACME","multi"]){
        const result=assemble('*=$2000\n!zone code\n.loop nop\nfirst bne .loop\nsecond bne .loop\n!zn code\n.loop rts\nbne .loop',dialect);
        clean(result);
        assert.deepEqual(values(result),[0xea,0xd0,0xfd,0xd0,0xfb,0x60,0xd0,0xfd]);
    }
});
test("zone-local assignments support compact syntax and forward references",()=>{
    const result=assemble('*=$2000\n!zone one\n!word .end\n.value=7\n!byte .value\n.end rts\n!zone two\n.value=9\n!byte .value');
    clean(result);
    assert.deepEqual(values(result),[3,32,7,0x60,9]);
});
test("cheap locals reset on global location labels, but not constants or zones",()=>{
    for(const dialect of ["ACME","multi"]){
        const result=assemble('*=$2000\nfirst bne @done\nconstant=1\n!zone code\n@done nop\nsecond bne @done\n@done rts',dialect);
        clean(result);
        assert.deepEqual(values(result),[0xd0,0,0xea,0xd0,0,0x60]);
    }
});
test("cheap-local assignments and initial scope do not require a global label",()=>{
    const result=assemble('*=$2000\n@value=$20\nlda @value\n@loop nop\nbne @loop\nentry rts\n@value=$21\nlda @value');
    clean(result);
    assert.deepEqual(values(result),[0xa5,32,0xea,0xd0,0xfd,0x60,0xa5,33]);
});
test("anonymous references resolve the exact sign spelling and nearest direction",()=>{
    for(const dialect of ["ACME","multi"]){
        const result=assemble('*=$2000\n-- nop\n- nop\nbne --\nbne -\nbne ++\n+ nop\nbne +\n++ nop\n+ rts',dialect);
        clean(result);
        assert.deepEqual(values(result),[0xea,0xea,0xd0,0xfc,0xd0,0xfb,0xd0,3,0xea,0xd0,1,0xea,0x60]);
    }
});
test("anonymous labels repeat and can be used in expressions and data",()=>{
    const result=assemble('*=$2000\n- nop\n!word -\n- nop\n!word -\n!word +\n+ nop\n!word +\n+ rts\n!byte -1, --1, 3-1');
    clean(result);
    assert.deepEqual(values(result),[0xea,0,32,0xea,3,32,8,32,0xea,11,32,0x60,255,1,2]);
});
test("anonymous references cannot cross zone boundaries",()=>{
    for(const source of ['*=$2000\n!zone a\nbne +\n!zone b\n+ rts','*=$2000\n!zone a\n- nop\n!zone b\nbne -']){
        const result=assemble(source);
        assert.ok(result.errors.some(e=>/anonymous|unresolved/i.test(e.err)));
    }
});
test("duplicate named locals are errors within one scope",()=>{
    for(const source of ['!zone a\n.loop nop\n.loop rts','first nop\n@loop nop\n@loop rts','!zone a\n.value=1\n.value=2'])
        assert.ok(assemble(source).errors.some(e=>/duplicate/i.test(e.err)));
});
test("label rewrites preserve source listings, comments, strings and diagnostics",()=>{
    const result=assemble('*=$2000\n!zone code\n@loop nop ; @loop + .data\nbne @loop\n.data !text "@loop + .data"');
    clean(result);
    assert.ok(result.listingText.includes('BNE  @loop'));
    assert.ok(result.listingText.includes('@loop + .data'));
    assert.ok(!result.listingText.includes('__ACME_LABEL_'));
    assert.deepEqual(values(result).slice(3),Array.from(Buffer.from('@loop + .data')));
    const bad=assemble('*=$2000\n!zone a\nbne @missing');
    assert.ok(bad.errors.some(e=>e.statement==='bne @missing' && e.err.includes('@missing')));
});
test("mixed mode retains S-C numeric locals beside ACME cheap locals",()=>{
    const result=assemble('ORG $2000\nSTART LDA #0\n.1 NOP\n@again NOP\nBNE .1\nBNE @again\nDFB $22',"multi");
    clean(result);
    assert.deepEqual(values(result),[0xa9,0,0xea,0xea,0xd0,0xfc,0xd0,0xfb,0x22]);
});
test("macro dot locals and caller zones remain independent",()=>{
    const result=assemble('*=$2000\n!zone code\n.loop nop\n!macro m {\n.loop nop\nbne .loop\n}\n+m\n+m\nbne .loop');
    clean(result);
    assert.deepEqual(values(result),[0xea,0xea,0xd0,0xfd,0xea,0xd0,0xfd,0xd0,0xf7]);
});
test("foreign explicit dialects reject ACME zone and cheap-label syntax",()=>{
    for(const dialect of ["raJS","ca65","Merlin","S-C"]){
        assert.ok(assemble('!zone code\n.loop nop',dialect).errors.length);
        assert.ok(assemble('@loop nop\nbne @loop',dialect).errors.length);
    }
});
test("unsupported block zones report a diagnostic instead of changing scope",()=>{
    assert.ok(assemble('!zone code {\n.loop nop\n}').errors.some(e=>/block|zone/i.test(e.err)));
});
test("zone locals named like foreign pragmas remain labels and constants",()=>{
    for(const dialect of ["ACME","multi"]){
        const result=assemble('*=$2000\n!zone a\n.byte\n.word=17\nnop\nbne .byte\n!byte .word',dialect);
        clean(result);
        assert.deepEqual(values(result),[0xea,0xd0,0xfd,17]);
    }
});
test("explicit ACME mode diagnoses S-C numeric local definitions",()=>{
    assert.ok(assemble('*=$2000\n.1 nop\nbne .1').errors.length);
});
test("unary minus before another unary operator stays arithmetic",()=>{
    const result=assemble('*=$2000\n- nop\n!word - -1, -!0, - - -1');
    clean(result);
    assert.deepEqual(values(result),[0xea,1,0,1,0,255,255]);
});
test("legacy raw and delimited ASCII data are not label expressions",()=>{
    for(const directive of ['ASC /@name/','.AS /@name/','ASC -@name-','ASC @name']){
        const result=assemble('ORG $2000\n'+directive+'\nRTS',"multi");
        clean(result);
        assert.deepEqual(values(result),[64,110,97,109,101,0x60]);
    }
});
