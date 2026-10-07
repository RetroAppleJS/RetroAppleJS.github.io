"use strict";
const assert=require("node:assert/strict"),{test}=require("node:test");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const context=vm.createContext({oCOM:{getHexByte:v=>(v&255).toString(16).padStart(2,"0").toUpperCase()}});
vm.runInContext(fs.readFileSync(path.join(__dirname,"../res/ASM_core.js"),"utf8"),context);
function assemble(source,options={}){return new context.ASM({dialect:"ACME",...options}).assemble(source);}
function values(r){return Array.from(r.bytes,b=>b.val);}
function clean(r){assert.equal(r.errors.length,0,JSON.stringify(r.errors));assert.equal(r.layoutConverged,true);}

test("inline and multiline ACME if/else select exactly one branch in both modes",()=>{
    for(const dialect of ["ACME","multi"]){
        const r=assemble('*=$2000\n!if 0 { !byte 1 } else { !byte 2 }\n!if 1 {\n!byte 3\n}\n!if 0{\n!byte 4\n}\nrts',{dialect});
        clean(r);assert.deepEqual(values(r),[2,3,0x60]);
    }
});
test("nested branch constants determine following data sizes",()=>{
    const r=assemble('FLAG=1\n!if FLAG {\n!if 0 { N=1 } else { N=7 }\n} else { N=2 }\n!fill N,$11');
    clean(r);assert.deepEqual(values(r),Array(7).fill(17));assert.equal(r.symtab.N,7);
});
test("conditional braces and inactive global labels do not interrupt cheap-label scopes",()=>{
    const r=assemble('*=$2000\nentry bne @done\n!if 0 {\ndead nop\n@done nop\n}\n!if 1 { nop }\n@done rts');
    clean(r);assert.deepEqual(values(r),[0xd0,1,0xea,0x60]);assert.equal(r.symtab.dead,undefined);
});
test("location labels on conditional headers open scopes and bind to the insertion PC",()=>{
    const r=assemble('*=$2000\nentry !if entry=$2000 { nop }\nbne @done\n@done rts\n!word entry');
    clean(r);assert.deepEqual(values(r),[0xea,0xd0,0,0x60,0,32]);assert.equal(r.symtab.entry,0x2000);
});
test("inactive zones and local/anonymous definitions do not change active label scopes",()=>{
    const r=assemble('*=$2000\n!zone code\n.loop nop\nbne +\n!if 0 {\n!zone dead\n.loop nop\n+ nop\n}\n+ bne .loop');
    clean(r);assert.deepEqual(values(r),[0xea,0xd0,0,0xd0,0xfb]);
});
test("conditions evaluate prior local locations and the current PC during layout",()=>{
    const r=assemble('*=$20fe\n.start nop\n!if >.start != >* { !serious "too soon" }\nnop\n!if >.start != >* { !byte 17 }');
    clean(r);assert.deepEqual(values(r),[0xea,0xea,17]);
});
test("ACME byte selectors stop before comparisons and bitwise operators, retaining arithmetic binding",()=>{
    const r=assemble('!word >$1200+256, <$01ff+1, >$20fe != >$2100\n!byte <$100|1, (1=1)&1');
    clean(r);assert.deepEqual(values(r),[19,0,0,0,1,0,1,1]);
    const legacy=assemble('!word 1',{dialect:"multi"});clean(legacy);
    const asm=new context.ASM({dialect:"S-C"});assert.equal(asm.getExpression('/$1200+256').val,19);
});
test("ACME recognizes adjacent >< as its alternate inequality spelling",()=>{
    const r=assemble('!byte >$1200><$01ff');clean(r);assert.deepEqual(values(r),[1]);
});
test("unselected bodies do not emit code, define symbols or produce source diagnostics",()=>{
    const r=assemble('!if 0 {\n!cpu 65816\nlda missing\n!text "a\\n"\n!source "missing.a"\n!serious "bad"\n!warn "bad"\n}\n!byte 17',{characterEncoding:"apple2plus"});
    clean(r);assert.deepEqual(values(r),[17]);assert.equal(r.warnings.length,0);
});
test("conditional includes are skipped without resolving files, and fail explicitly if selected",()=>{
    for(const child of ['!if 1 {','}','!macro later { !byte 1 }']){
        let requested=0;
        const r=assemble('!if 0 { !source "bad.a" }\nrts',{includeResolver:()=>{requested++;return child;}});
        clean(r);assert.deepEqual(values(r),[0x60]);assert.equal(requested,0);
    }
    assert.ok(assemble('!if 1 { !source "code.a" }',{includes:{"code.a":"rts"}}).errors.some(e=>/source.*conditional/.test(e.err)));
});
test("legacy ELSE leaves following slash-delimited ASCII text intact in multi mode",()=>{
    const r=assemble('ORG $2000\nDO 0\nELSE\nASC /{x}/\nFIN\nRTS',{dialect:"multi"});
    clean(r);assert.deepEqual(values(r),[0x7b,0x78,0x7d,0x60]);
});
test("nested conditions in inactive bodies are not evaluated",()=>{
    const r=assemble('!if 0 { !if missing { !byte 1 } } else { !byte 2 }');
    clean(r);assert.deepEqual(values(r),[2]);
});
test("inactive unknown blocks retain balanced braces without leaking labels or errors",()=>{
    const r=assemble('entry\n!if 0 {\n!zone unused {\ndead nop\n}\n}\n@done rts');
    clean(r);assert.deepEqual(values(r),[0x60]);assert.equal(r.symtab.dead,undefined);
});
test("conditions reject string values and report character-conversion failures as diagnostics",()=>{
    assert.ok(assemble('!if "abc" { !byte 1 }').errors.length);
    assert.ok(assemble("!if '\\n' { !byte 1 }",{characterEncoding:"apple2plus"}).errors.length);
});
test("forward conditions, including forward-dependent constants, remain unsupported as in ACME",()=>{
    for(const source of ['!if LATER { !byte 1 }\nLATER=1','N=end-start\nstart\n!if N { !byte 1 }\nend']){
        assert.ok(assemble(source).errors.some(e=>/condition.*not defined/.test(e.err)),source);
    }
});
test("malformed conditional blocks are diagnosed without defining brace labels",()=>{
    for(const source of ['!if 1\n!byte 1','!if { !byte 1 }','!if 1 {\n!byte 1','!if 0 {} else {} else {}','}']){
        const r=assemble(source);assert.ok(r.errors.length,source);assert.equal(r.symtab['}'],undefined);
    }
});
test("explicit foreign modes reject ACME blocks without emitting either branch",()=>{
    for(const dialect of ["raJS","ca65","Merlin","S-C"]){
        const r=assemble('!if 1 { lda #1 } else { lda #2 }',{dialect});assert.ok(r.errors.length);assert.deepEqual(values(r),[]);
    }
});
test("conditional rows preserve ACME compatibility, source coordinates and inactive markers",()=>{
    const r=assemble('!if 0 {\nlda #1\n} else {\nrts\n}',{sourceName:"main.a"});clean(r);
    const row=r.rows.find(row=>row.sourceLine===2);assert.equal(row.acmeInactive,true);assert.deepEqual(Array.from(row.bytes),[]);
    assert.deepEqual(Array.from(r.rows.find(row=>row.sourceLine===1).asm),["ACME"]);
});
test("S-C numeric labels retain stable identities during conditional layout passes",()=>{
    const r=assemble('ORG $2000\nentry BNE .1\n!if 0 { unused NOP }\n.1 RTS',{dialect:"multi"});
    clean(r);assert.deepEqual(values(r),[0xd0,0,0x60]);
});
test("conditional macro definitions and calls fail explicitly when active, never silently expand",()=>{
    for(const source of ['!if 1 { !macro m { !byte 1 } }\n+m','!macro m { !byte 1 }\n!if 1 { +m }'])
        assert.ok(assemble(source).errors.some(e=>/conditional.*macro|macro.*conditional/.test(e.err)));
    const r=assemble('!macro m { +m }\n!if 0 { +m }\n!byte 17',{maxMacroExpansions:1});clean(r);assert.deepEqual(values(r),[17]);
});
test("ACME warnings and serious messages use raw text and resolve final numeric arguments once",()=>{
    const r=assemble('*=$2000\nstart nop\n!warn "padding = ", *-start\n!if 0 { !serious "bad" }\n!byte 17',{characterEncoding:"apple2plus"});
    clean(r);assert.deepEqual(values(r),[0xea,17]);assert.equal(r.warnings.length,1);assert.match(r.warnings[0].warn,/!warn: padding = 1 \(0x1\)/);
    assert.ok(assemble('!serious "bad ",3').errors.some(e=>/!serious: bad 3 \(0x3\)/.test(e.err)));
});
test("message arguments validate empty fields, bad escapes and missing values",()=>{
    for(const source of ['!warn','!warn "x",','!warn missing','!serious "bad\\q"'])assert.ok(assemble(source).errors.length,source);
});
test("character arguments in assembly messages use source codes independently of byte conversion",()=>{
    const r=assemble("!warn 'a'",{characterEncoding:"apple2plus"});clean(r);assert.match(r.warnings[0].warn,/97 \(0x61\)/);
});
test("plain output and symbol-list directives retain metadata without emitting bytes",()=>{
    const r=assemble('!to "mb-audit", plain\n!sl "mb-audit.labels"\n!byte 17');clean(r);
    assert.deepEqual(values(r),[17]);assert.equal(r.outputMetadata.output.fileName,"mb-audit");assert.equal(r.outputMetadata.output.format,"plain");assert.equal(r.outputMetadata.symbolListFile,"mb-audit.labels");
});
test("inactive output metadata is ignored and metadata resets between assemblies",()=>{
    const asm=new context.ASM({dialect:"ACME"});
    const r=asm.assemble('!if 0 { !to "unused", plain }\n!to "used", plain\n!byte 17');clean(r);assert.equal(r.outputMetadata.output.fileName,"used");
    assert.equal(asm.assemble('rts').outputMetadata.output,undefined);
});
test("repeated symbol-list metadata warns and retains the first filename",()=>{
    const r=assemble('!sl "first.labels"\n!sl "second.labels"');clean(r);
    assert.equal(r.outputMetadata.symbolListFile,"first.labels");assert.equal(r.warnings.length,1);
});
test("unsupported output formats and malformed output names produce clear diagnostics",()=>{
    for(const source of ['!to "out", cbm','!to out,plain','!to "",plain','!sl out'])assert.ok(assemble(source).errors.length,source);
});
