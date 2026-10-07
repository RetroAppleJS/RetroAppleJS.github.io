"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = vm.createContext({
    oCOM: {getHexByte: value => (value & 255).toString(16).padStart(2, "0").toUpperCase()}
});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../res/ASM_core.js"), "utf8"), context);
const ASM = context.ASM;
const printColumns = "{adr:0,code:6,lin:15,num:{col:25,dig:6},lbl:32,ins:40,opr:45,asm:61,com:70}";
function assemble(source, options) {
    const asm = new ASM(options);
    return {asm, result: asm.assemble(source)};
}
function values(result) { return Array.from(result.bytes, byte => byte.val); }
function clean(result) { assert.equal(result.errors.length, 0, JSON.stringify(result.errors)); }

test("default multi mode assembles a mixture of existing dialects and ACME", () => {
    const {result} = assemble('ORG $0800\nDFB $11\n.HS 22\n.BYTE $33\n!byte $44');
    clean(result);
    assert.deepEqual(values(result), [0x11, 0x22, 0x33, 0x44]);
    assert.equal(result.dialect, "multi");
});
test("explicit modes accept their known directives and reject foreign ones", () => {
    for (const [dialect, source, byte] of [
        ["raJS", "DB $11", 0x11], ["ca65", ".BYTE $22", 0x22],
        ["Merlin", "DFB $33", 0x33], ["S-C", ".HS 44", 0x44], ["ACME", "!byte $55", 0x55]
    ]) {
        const {result} = assemble(source, {dialect});
        clean(result);
        assert.deepEqual(values(result), [byte]);
        assert.equal(result.dialect, dialect);
    }
    const {result} = assemble("DFB $11\n!byte $22", {dialect: "ca65"});
    assert.equal(result.errors.length, 2);
    assert.deepEqual(values(result), []);
});
test("unknown dialect selection fails rather than silently enabling mixed mode", () => {
    assert.throws(() => new ASM({dialect:"typo"}), /dialect/i);
    const asm = new ASM({dialect:"acme"});
    assert.equal(asm.dialect, "ACME");
    asm.setDialect("multi");
    clean(asm.assemble("DFB $11"));
});
test("ACME origin and constants accept compact and spaced assignments", () => {
    for (const source of ['*=$0800\nVALUE=$2a\n!byte VALUE', '* = $0800\nVALUE = $2a\n!byte VALUE']) {
        const {result} = assemble(source);
        clean(result);
        assert.deepEqual(values(result), [42]);
        assert.equal(result.bytes[0].pc, 0x800);
        assert.equal(result.symtab.VALUE, 42);
    }
});
test("ACME-compatible assignments preserve signed and wide scalar values", () => {
    for (const dialect of ["multi", "ACME"]) {
        const {result} = assemble('*=$0800\nN=-1\n!byte N', {dialect});
        clean(result);
        assert.deepEqual(values(result), [255]);
        assert.equal(result.symtab.N, -1);
        assert.ok(assemble('N=65536\n!word N', {dialect}).result.errors.length);
    }
});
test("named ACME mode treats instruction '*' as current PC instead of forced zero page", () => {
    const {result} = assemble('*=$0800\nlda *+3\nbne *', {dialect:"ACME"});
    clean(result);
    assert.deepEqual(values(result), [0xad,3,8,0xd0,0xfe]);
});
test("ACME byte aliases emit exactly one byte, including negative and forward values", () => {
    const {result} = assemble('*=$0800\n!byte -128,255\n!by <target\n!8 1\n!08 2\ntarget rts');
    clean(result);
    assert.deepEqual(values(result), [128,255,5,1,2,0x60]);
    assert.equal(result.symtab.target, 0x805);
});
test("ACME words use the declared byte order and resolve forward labels", () => {
    const {result} = assemble('*=$0800\n!word target\n!wo $1234\n!16 -1\n!le16 $5678\n!be16 $9abc\ntarget rts');
    clean(result);
    assert.deepEqual(values(result), [10,8,0x34,0x12,255,255,0x78,0x56,0x9a,0xbc,0x60]);
});
test("ACME raw text does not inherit Apple II legacy high bits in mixed mode", () => {
    const {result} = assemble('ASC "A"\n!text "Hi;!",0,"B"\n!tx "C"\n!raw "D"\n!byte "E"');
    clean(result);
    assert.deepEqual(values(result), [0xc1,72,105,59,33,0,66,67,68,69]);
});
test("ACME hexadecimal escapes work in strings and character literals", () => {
    const {result} = assemble('!text "\\x41",0\n!byte \'\\x42\'');
    clean(result);
    assert.deepEqual(values(result), [65,0,66]);
});
test("explicit ACME character operands use raw bytes while default operands retain legacy behavior", () => {
    let {result} = assemble('lda #"A"', {dialect:"ACME", dQuoteLegacy:true});
    clean(result);
    assert.deepEqual(values(result), [0xa9,65]);
    ({result} = assemble('lda #"A"'));
    clean(result);
    assert.deepEqual(values(result), [0xa9,0xc1]);
});
test("ACME hex and fill honor zero/default fill and keep subsequent addresses correct", () => {
    const {result} = assemble('*=$0800\n!hex 1234 abcd\n!fill 2\n!fi 2,$ee\n!fill 0\nend rts');
    clean(result);
    assert.deepEqual(values(result), [0x12,0x34,0xab,0xcd,0,0,0xee,0xee,0x60]);
    assert.equal(result.symtab.end, 0x808);
});
test("ACME alignment uses mask/equality, default NOP fill and explicit fill", () => {
    const {result} = assemble('*=$0801\n!align 3,0\n!byte $11\n!align 3,2,$00\nend rts');
    clean(result);
    assert.deepEqual(values(result), [0xea,0xea,0xea,0x11,0,0x60]);
    assert.equal(result.symtab.end, 0x806);
});
test("ACME expressions involving current PC are evaluated at their statement address", () => {
    const {result} = assemble('*=$0800\n!word *\n!byte <*\n!fill 1,<*');
    clean(result);
    assert.deepEqual(values(result), [0,8,2,3]);
});
test("ACME current-PC values stay fixed throughout a single data statement", () => {
    const {result} = assemble('*=$0800\n!word *,*\n!byte <*,<*');
    clean(result);
    assert.deepEqual(values(result), [0,8,0,8,4,4]);
});
test("bad ACME data produces errors instead of silently emitting truncated or zero values", () => {
    for (const source of ["!byte missing", "!byte 256", "!word 65536", '!byte "AB"',
        "!hex 123", "!hex GG", "!hex 1 234", "!fill -1", "!fill missing", "!align 3,4",
        "!byte 1,", "!byte ,1", "!byte 1,,2",
        '!text "unterminated', "!byte 2^3"]) {
        const {result} = assemble(source);
        assert.ok(result.errors.length > 0, source);
        assert.deepEqual(values(result), [], source);
    }
});
test("CPU selection accepts 6502 and rejects unavailable CPUs", () => {
    const {result} = assemble("!cpu 6502\nlda #1");
    clean(result);
    assert.deepEqual(values(result), [0xa9,1]);
    assert.ok(assemble("!cpu 65816").result.errors.length);
});
test("unimplemented ACME directives and macro calls never become ordinary labels", () => {
    for (const source of ["!macro", "!zone", "+routine"]) {
        const {result} = assemble(source);
        assert.ok(result.errors.length, source);
    }
});
test("print compatibility labels describe syntax even when explicit mode rejects it", () => {
    const {asm, result} = assemble('*=$0800\nN = 1\n!byte N ; ACME data\n.HS 22 ; S-C data',
        {dialect:"ACME", listingColumns:printColumns});
    assert.equal(result.errors.length, 1);
    const acmeRow = result.rows[2];
    const scRow = result.rows[3];
    assert.deepEqual(Array.from(acmeRow.asm), ["ACME"]);
    assert.deepEqual(Array.from(scRow.asm), ["S-C"]);
    assert.ok(Array.from(result.rows[1].asm).includes("Merlin"));
    assert.ok(Array.from(result.rows[1].asm).includes("ACME"));
    const parts = asm.getListingParts(scRow, scRow.bytes, asm.listingColumns);
    assert.equal(parts.asm, "S-C");
    assert.equal(acmeRow.listing.slice(61,65), "ACME");
    assert.equal(acmeRow.listing.slice(70), "; ACME data");
    assert.equal(asm.listingColumns.com, 70);
});
test("S-C numeric locals retain their existing scope rules in multi and S-C mode", () => {
    const source = "START LDA #1\nBNE .1\n.1 RTS";
    for (const dialect of ["multi", "S-C"]) {
        const {result} = assemble(source, {dialect});
        clean(result);
        assert.deepEqual(values(result), [0xa9,1,0xd0,0,0x60]);
    }
});

test("character conversion is independent of dialect and does not alter explicit numbers", () => {
    for (const dialect of ["multi", "ACME"]) {
        const {result} = assemble('lda #"a"\n!text "Az"\n!byte $41,$c1',
            {dialect, characterEncoding:"apple2plus"});
        clean(result);
        assert.deepEqual(values(result), [0xa9,0xc1,0xc1,0xda,0x41,0xc1]);
    }
    const {result} = assemble('ASC "a"\n.AS "z"\nlda #"A"', {characterEncoding:"ascii"});
    clean(result);
    assert.deepEqual(values(result), [97,122,0xa9,65]);
});
test("a custom character table applies equally to literals and strings", () => {
    const characterMap = Array.from({length:256}, (_, i) => i);
    characterMap[65] = 0x91;
    const {result} = assemble('lda #\'A\'\nASC "A"\n!text "A"\n!byte 65', {characterMap});
    clean(result);
    assert.deepEqual(values(result), [0xa9,0x91,0x91,0x91,65]);
    assert.throws(() => new ASM({characterMap:[1,2]}), /character/i);
    assert.throws(() => new ASM({characterMap:new Array(256)}), /character/i);
});
test("unrepresentable implicit characters report errors while explicit byte codes remain available", () => {
    const {result} = assemble('!text "é"\n!byte $e9', {characterEncoding:"apple2plus"});
    assert.equal(result.errors.length, 1);
    assert.deepEqual(values(result), [0xe9]);
});

test("direct hex literal width selects zero page or absolute in every supported dialect", () => {
    for (const dialect of ["multi", "raJS", "ca65", "Merlin", "S-C", "ACME"]) {
        const {result} = assemble('lda $F\nlda $0F\nlda $00F\nlda $000F', {dialect});
        clean(result);
        assert.deepEqual(values(result), [0xa5,15,0xa5,15,0xad,15,0,0xad,15,0]);
    }
});
test("literal width applies to X and Y indexed direct operands", () => {
    const {result} = assemble('lda $FF,X\nlda $00FF,X\nldx $F,Y\nldx $00F,Y');
    clean(result);
    assert.deepEqual(values(result), [0xb5,255,0xbd,255,0,0xb6,15,0xbe,15,0]);
});
test("wide direct literals report unavailable absolute indexed modes", () => {
    const {result} = assemble('stx $00FF,Y\nsty $00FF,X');
    assert.equal(result.errors.length, 2);
    assert.deepEqual(values(result), []);
});
test("fixed instruction modes retain their required size", () => {
    const {result} = assemble('jmp $F\njsr $FF\njmp ($00FF)\nlda ($00FF),Y');
    clean(result);
    assert.deepEqual(values(result), [0x4c,15,0,0x20,255,0,0x6c,255,0,0xb1,255]);
});
test("immediate and branch operands do not use the direct hex-width rule", () => {
    const {result} = assemble('lda #$000F\nbne $0000');
    clean(result);
    assert.deepEqual(values(result), [0xa9,15,0xd0,0xfc]);
});
test("symbolic addresses and compound expressions still converge to the smallest valid mode", () => {
    const {result} = assemble('N = $000F\nlda N\nlda $000F+0\nlda target\ntarget rts');
    clean(result);
    assert.deepEqual(values(result), [0xa5,15,0xa5,15,0xa5,6,0x60]);
    assert.equal(result.symtab.target, 6);
});
test("current-PC instruction operands work in mixed mode without a zero-page prefix ambiguity", () => {
    const {result} = assemble('ORG $0800\nlda *+3\nbne *');
    clean(result);
    assert.deepEqual(values(result), [0xad,3,8,0xd0,0xfe]);
});
test("legacy star-dollar operands produce a diagnostic instead of being mistaken for current-PC math", () => {
    const {result} = assemble('lda *$10');
    assert.ok(result.errors.length);
    assert.deepEqual(values(result), []);
});

test("decimal and octal direct addresses select size by numeric value", () => {
    const {result} = assemble('lda 0\nlda 255\nlda 256\nlda 65535\nlda &377\nlda &400\nlda &177777');
    clean(result);
    assert.deepEqual(values(result), [0xa5,0,0xa5,255,0xad,0,1,0xad,255,255,
        0xa5,255,0xad,0,1,0xad,255,255]);
});
test("octal leading zeros do not force an absolute address", () => {
    const {result} = assemble('lda &000001\nlda &000377,X');
    clean(result);
    assert.deepEqual(values(result), [0xa5,1,0xb5,255]);
});
test("binary literal width selects zero page or absolute even for the same value", () => {
    const {result} = assemble('lda %1\nlda %00000001\nlda %000000001\nlda %0000000000000001\nlda %000000001,X');
    clean(result);
    assert.deepEqual(values(result), [0xa5,1,0xa5,1,0xad,1,0,0xad,1,0,0xbd,1,0]);
});
test("octal prefix does not replace infix bitwise AND", () => {
    const {result} = assemble('!byte &377 & 15\nlda #&17');
    clean(result);
    assert.deepEqual(values(result), [15,0xa9,15]);
});
test("out-of-range decimal, octal and over-wide direct binary addresses are rejected", () => {
    for (const source of ['lda -1','lda 65536','lda &200000','lda %00000000000000001']) {
        const {result} = assemble(source);
        assert.ok(result.errors.length, source);
        assert.deepEqual(values(result), [], source);
    }
});
test("binary width does not affect data bytes or immediate operands", () => {
    const {result} = assemble('!byte %000000001\nlda #%000000001');
    clean(result);
    assert.deepEqual(values(result), [1,0xa9,1]);
});
test("current PC completes a value before compact AND and modulo operators", () => {
    for (const dialect of ["multi", "ACME"]) {
        for (const separator of ["", " ", "  "]) {
            const {result} = assemble('* = $0801\nlda *' + separator + '&255\n!byte *' + separator + '&255,*' + separator + '%10,3*4', {dialect});
            clean(result);
            assert.deepEqual(values(result), [0xa5,1,3,1,12]);
        }
    }
});
