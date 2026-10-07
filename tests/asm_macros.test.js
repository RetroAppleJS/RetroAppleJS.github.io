"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({oCOM:{getHexByte:v=>(v&255).toString(16).padStart(2,"0").toUpperCase()}});
vm.runInContext(fs.readFileSync(path.join(__dirname,"../res/ASM_core.js"),"utf8"), context);
function assemble(source, options) { return new context.ASM(options).assemble(source); }
function values(result) { return Array.from(result.bytes, byte=>byte.val); }
function clean(result) { assert.equal(result.errors.length,0,JSON.stringify(result.errors)); }

test("the six mb-audit macros emit their 6502 instructions in mixed and ACME modes",()=>{
    const definitions=fs.readFileSync(path.join(__dirname,"fixtures/mb_audit_macros.a"),"utf8");
    const calls="*=$0800\n+ENA_INTERNAL_ROM\n+ENA_LC2_RAM_READONLY\n+ENA_LC1_RAM_READONLY\n+ENA_LC2_RAM_READWRITE\n+ISR_ENTRY\n+ISR_EXIT";
    for(const dialect of ["multi","ACME"]){
        const result=assemble(definitions+"\n"+calls,{dialect});
        clean(result);
        assert.deepEqual(values(result),[0x2c,0x82,0xc0,0x2c,0x80,0xc0,0x2c,0x88,0xc0,
            0x2c,0x83,0xc0,0x2c,0x83,0xc0,0x8a,0x48,0x98,0x48,0x68,0xa8,0x68,0xaa,0xa5,0x45,0x40]);
    }
});
test("value parameters capture expressions at the call PC and do not substitute inside strings",()=>{
    const result=assemble('*=$0800\n!macro emit .n {\n!word .n\n!word .n+1\n!text ".n"\n}\n+emit *+2');
    clean(result);
    assert.deepEqual(values(result),[2,8,3,8,46,110]);
});
test("macro arguments resolve forward labels through the ordinary layout passes",()=>{
    const result=assemble('*=$0800\n!macro load .address {\nlda .address\n}\n+load target\ntarget rts');
    clean(result);
    assert.deepEqual(values(result),[0xad,3,8,0x60]);
});
test("nested calls preserve caller parameter values and each invocation's dot-local labels",()=>{
    const result=assemble('!macro inner .v {\n.loop lda #.v\nbne .loop\n}\n!macro outer .v {\n+inner .v+1\n!byte .v\n}\n+outer 2\n+outer 4');
    clean(result);
    assert.deepEqual(values(result),[0xa9,3,0xd0,0xfc,2,0xa9,5,0xd0,0xfc,4]);
});
test("local references supplied as arguments remain in their caller scope",()=>{
    const result=assemble('*=$0800\n!macro address .v {\n!word .v\n}\n!macro outer {\n.here nop\n+address .here\n}\n+outer\n+outer');
    clean(result);
    assert.deepEqual(values(result),[0xea,0,8,0xea,3,8]);
});
test("macro names may overload by value-argument count",()=>{
    const result=assemble('!macro m { !byte 1 }\n!macro m .n { !byte .n }\n+m\n+m 2');
    clean(result);
    assert.deepEqual(values(result),[1,2]);
});
test("brace scanning respects escaped quotes, character literals and comments",()=>{
    const result=assemble('!macro m { ; } is a comment\n!text "{;\\\"}",\'}\' ; {\n}\n+m');
    clean(result);
    assert.deepEqual(values(result),[123,59,34,125,125]);
});
test("a location label on a macro call refers to its first emitted instruction",()=>{
    const result=assemble('*=$0800\n!macro m { rts }\nentry +m\n!word entry');
    clean(result);
    assert.deepEqual(values(result),[0x60,0,8]);
    assert.equal(result.symtab.entry,0x800);
});
test("macro definitions must precede calls, including nested calls",()=>{
    const result=assemble('+m\n!macro m { nop }');
    assert.ok(result.errors.some(error=>/defined|signature/i.test(error.err)));
    assert.deepEqual(values(result),[]);
    const nested=assemble('!macro outer { +inner }\n+outer\n!macro inner { nop }');
    assert.ok(nested.errors.length);
    assert.deepEqual(values(nested),[]);
    const valid=assemble('!macro outer { +inner }\n!macro inner { nop }\n+outer');
    clean(valid);
    assert.deepEqual(values(valid),[0xea]);
});
test("macro expansion retains definition lines, call stack and ACME listing tags",()=>{
    const result=assemble('!macro bad {\nlda #missing\n}\n+bad',{sourceName:"macro-test.a"});
    assert.equal(result.errors.length,1);
    const diagnostic=result.errors[0];
    assert.equal(diagnostic.sourceName,"macro-test.a");
    assert.equal(diagnostic.sourceLine,2);
    assert.equal(diagnostic.macroTrace[0].name,"bad");
    assert.equal(diagnostic.macroTrace[0].call.sourceLine,4);
    const call=result.rows.find(row=>row.statement==="+bad");
    assert.deepEqual(Array.from(call.asm),["ACME"]);
    const definition=result.rows.find(row=>row.statement.startsWith("!macro"));
    assert.deepEqual(Array.from(definition.asm),["ACME"]);
});
test("explicit non-ACME modes reject macros without assembling their bodies",()=>{
    for(const dialect of ["raJS","ca65","Merlin","S-C"]){
        const result=assemble('!macro m {\nlda #1\n}\n+m',{dialect});
        assert.ok(result.errors.length,dialect);
        assert.deepEqual(values(result),[],dialect);
    }
});
test("bad definitions, calls and unsupported advanced macro forms report errors",()=>{
    for(const source of [
        '!macro m { nop',
        '!macro m .n,.n { nop }\n+m 1,2',
        '!macro m { nop }\n!macro m { rts }\n+m',
        '!macro m .n { nop }\n+m',
        '!macro m .a,.b { nop }\n+m 1,',
        '+missing',
        '!macro m ~.n { nop }\n+m ~n',
        '!macro m {\n!macro nested { nop }\n}\n+m',
        '!macro m {\n.same nop\n.same rts\n}\n+m'
    ]){
        const result=assemble(source);
        assert.ok(result.errors.length,source);
    }
});
test("recursive calls stop with a diagnostic and a call stack",()=>{
    const result=assemble('!macro loop {\n+loop\n}\n+loop',{maxMacroDepth:4});
    assert.ok(result.errors.some(error=>/depth|recursive/i.test(error.err)));
    assert.ok(result.errors.some(error=>error.macroTrace.length>=4));
});
test("expansion count bounds a branching macro even below the depth limit",()=>{
    const result=assemble('!macro leaf { nop }\n!macro branch {\n+leaf\n+leaf\n+leaf\n}\n+branch',{maxMacroExpansions:2});
    assert.ok(result.errors.some(error=>/expansion.*limit/i.test(error.err)));
});
test("macro state is reset between assemblies",()=>{
    const asm=new context.ASM();
    clean(asm.assemble('!macro m { nop }\n+m'));
    const result=asm.assemble('+m');
    assert.ok(result.errors.length);
    assert.deepEqual(values(result),[]);
});
test("macro scopes leave surrounding S-C numeric local references intact",()=>{
    const result=assemble('ROOT nop\n.1 nop\n!macro m {\n.loop nop\nbne .loop\n}\n+m\nbne .1');
    clean(result);
    assert.deepEqual(values(result),[0xea,0xea,0xea,0xd0,0xfd,0xd0,0xfa]);
});
test("macro literals use ACME conversion and expanded listings retain local source names",()=>{
    const result=assemble('!macro m .c {\n.loop lda #.c\n!text "a"\n!byte $61\n}\n+m \'a\'',{characterEncoding:"apple2plus"});
    clean(result);
    assert.deepEqual(values(result),[0xa9,0xc1,0xc1,0x61]);
    const expanded=result.rows.find(row=>row.bytes.length===2);
    assert.equal(expanded.source,".loop lda #.c");
    assert.ok(expanded.listing.includes(".loop"));
    assert.ok(!expanded.listing.includes("__ACME"));
});
test("unsupported local label forms are diagnosed even when unreferenced",()=>{
    for(const label of ["@cheap", "@1", "@", ".1", "+", "+:", "-:"]){
        const result=assemble('!macro m {\n'+label+' nop\n}\n+m');
        assert.ok(result.errors.length,label);
        assert.deepEqual(values(result),[],label);
    }
});
test("a large macro body cannot bypass the expansion line budget",()=>{
    const result=assemble('!macro m {\nnop\nnop\nnop\n}\n+m\n+m',{maxMacroExpandedLines:4});
    assert.ok(result.errors.some(error=>/line.*limit/i.test(error.err)));
    assert.ok(values(result).length<=4);
});
test("dot locals named like foreign directives remain private to each invocation",()=>{
    for(const dialect of ["multi","ACME"]){
        const result=assemble('*=$0800\n!macro m {\n.word nop\nbne .word\n}\n+m\n+m',{dialect});
        clean(result);
        assert.deepEqual(values(result),[0xea,0xd0,0xfd,0xea,0xd0,0xfd]);
    }
});
test("value arguments inherit the S-C numeric local scope at the call site",()=>{
    for(const [source,expected] of [
        ['START nop\n.1 rts\n+word .1',[0xea,0x60,1,0]],
        ['START nop\n+word .1\n.1 rts',[0xea,3,0,0x60]]
    ]){
        const result=assemble('!macro word .v { !word .v }\n'+source);
        clean(result);
        assert.deepEqual(values(result),expected);
    }
});
test("mixed directives are preserved at their token position beside similar local names",()=>{
    for(const [body,expected] of [
        ['.wordlabel .word 1\n!word .wordlabel',[1,0,0,0]],
        ['.BYTE .BYTE',[1]]
    ]){
        const result=assemble('!macro m .BYTE {\n'+body+'\n}\n+m 1');
        clean(result);
        assert.deepEqual(values(result),expected);
    }
});
test("standalone and constant locals can use names shared with foreign directives",()=>{
    const result=assemble('!macro m {\n.word\n.byte = 17\nnop\nbne .word\n!byte .byte\n}\n+m\n+m');
    clean(result);
    assert.deepEqual(values(result),[0xea,0xd0,0xfd,17,0xea,0xd0,0xfd,17]);
});
test("duplicate standalone and constant locals are diagnosed after namespace rewriting",()=>{
    for(const body of ['.word\n.word\nnop','.byte = 1\n.byte = 2\nnop']){
        const result=assemble('!macro m {\n'+body+'\n}\n+m');
        assert.ok(result.errors.some(error=>/duplicate.*local/i.test(error.err)));
        assert.deepEqual(values(result),[]);
    }
});
