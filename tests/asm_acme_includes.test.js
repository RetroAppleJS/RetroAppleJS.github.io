"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const context=vm.createContext({oCOM:{getHexByte:v=>(v&255).toString(16).padStart(2,"0").toUpperCase()}});
vm.runInContext(fs.readFileSync(path.join(__dirname,"../res/ASM_core.js"),"utf8"),context);
function assemble(source,options={}){return new context.ASM({dialect:"ACME",...options}).assemble(source);}
function values(result){return Array.from(result.bytes,b=>b.val);}
function clean(result){assert.equal(result.errors.length,0,JSON.stringify(result.errors));}

test("ACME source includes contribute constants and code at the insertion PC",()=>{
    for(const dialect of ["ACME","multi"]){
        const result=assemble('*=$2000\n!source "defs.a"\nlda VALUE\n!source "code.a"\n!word entry',{
            dialect,sourceName:"main.a",includes:{"defs.a":"VALUE=$3c","code.a":"entry rts"}});
        clean(result);
        assert.deepEqual(values(result),[0xa5,0x3c,0x60,2,32]);
        assert.equal(result.symtab.entry,0x2002);
    }
});
test("nested relative includes resolve from the assembly root, as in ACME",()=>{
    const result=assemble('*=$2000\n!source "sub/one.a"',{sourceName:"project/main.a",includes:{
        "project/sub/one.a":'!source "defs.a"\n!byte VALUE',
        "project/defs.a":"VALUE=7"}});
    clean(result);
    assert.deepEqual(values(result),[7]);
});
test("nested includes do not silently prefer a child-local file over the assembly root",()=>{
    const result=assemble('!source "sub/one.a"',{sourceName:"project/main.a",includes:{
        "project/sub/one.a":'!source "defs.a"\n!byte VALUE',
        "project/defs.a":"VALUE=7", "project/sub/defs.a":"VALUE=9"}});
    clean(result);
    assert.deepEqual(values(result),[7]);
});
test("include resolver receives the original name and requesting source once",()=>{
    const requests=[];
    const result=assemble('!source "defs.a"\n!byte VALUE',{sourceName:"main.a",includeResolver:(name,from)=>{
        requests.push([name,from]);return {source:"VALUE=17",sourceName:"defs.a"};}});
    clean(result);
    assert.deepEqual(values(result),[17]);
    assert.deepEqual(requests,[["defs.a","main.a"]]);
});
test("include filenames retain spaces and semicolons without character conversion",()=>{
    const result=assemble('!source "a ; b.a" ; caller comment',{characterEncoding:"apple2plus",includes:{"a ; b.a":"!byte 17"}});
    clean(result);
    assert.deepEqual(values(result),[17]);
});
test("include errors retain child source coordinates",()=>{
    const result=assemble('!source "bad.a"',{sourceName:"main.a",includes:{"bad.a":{source:'; comment\nlda missing',sourceName:"lib/bad.a"}}});
    assert.ok(result.errors.some(e=>e.sourceName==="lib/bad.a"&&e.sourceLine===2&&e.statement==='lda missing'));
});
test("include rows retain listing syntax compatibility without emitting bytes",()=>{
    const result=assemble('*=$2000\n!source "code.a"',{includes:{"code.a":"rts"},listingColumns:{adr:0,code:6,ins:20,opr:30,asm:50,com:60}});
    clean(result);
    const row=result.rows.find(r=>r.statement==='!source "code.a"');
    assert.deepEqual(Array.from(row.asm),["ACME"]);
    assert.equal(row.bytes.length,0);
    assert.ok(result.listingText.includes('!SOURCE'));
});
test("zone and cheap-label scopes continue across include boundaries",()=>{
    const result=assemble('*=$2000\n!zone code\nentry bne @done\n!source "body.a"\nbne .loop',{
        includes:{"body.a":".loop nop\n@done rts"}});
    clean(result);
    assert.deepEqual(values(result),[0xd0,1,0xea,0x60,0xd0,0xfc]);
});
test("macros defined in an include are available afterwards with child trace metadata",()=>{
    const result=assemble('*=$2000\n!source "macros.a"\n+emit 17',{sourceName:"main.a",includes:{"macros.a":"!macro emit .n { !byte .n }"}});
    clean(result);
    assert.deepEqual(values(result),[17]);
    assert.ok(result.rows.some(r=>r.macroTrace&&r.macroTrace[0].definition.sourceName==='macros.a'));
});
test("repeated includes are expanded each time",()=>{
    const result=assemble('!source "bytes.a"\n!source "bytes.a"',{includes:{"bytes.a":"!byte 1"}});
    clean(result);
    assert.deepEqual(values(result),[1,1]);
});
test("exact ACME include names differing only by case identify separate files",()=>{
    const result=assemble('!source "A.a"',{includes:{"A.a":'!source "a.a"\n!byte 1',"a.a":"!byte 2"}});
    clean(result);
    assert.deepEqual(values(result),[2,1]);
    const cycle=assemble('.IN /A.a/',{dialect:"S-C",includes:{"A.a":'.IN /a.a/'}});
    assert.ok(cycle.errors.some(e=>/cycle/.test(e.err)));
});
test("inline and multiline macro includes expand at every call with private local labels",()=>{
    for(const definition of ['!macro m { !source "code.a" }','!macro m { !source "code.a"\n}','!macro m {\n!source "code.a"\n}']){
        const result=assemble('*=$2000\n'+definition+'\n+m\n+m',{includes:{"code.a":'.loop !byte 17\nbne .loop'}});
        clean(result);
        assert.deepEqual(values(result),[17,0xd0,0xfd,17,0xd0,0xfd]);
        assert.ok(result.rows.some(r=>r.sourceName==='code.a'&&r.sourceLine===2&&r.macroTrace));
    }
});
test("quoted ACME include escapes decode without applying the output character encoding",()=>{
    const result=assemble('!source "a\\x20b.a"\n!source "a\\tb.a"',{characterEncoding:"apple2plus",includes:{"a b.a":"!byte 17","a\tb.a":"!byte 18"}});
    clean(result);
    assert.deepEqual(values(result),[17,18]);
    for(const filename of ['"bad\\xG0.a"','"bad\\q.a"'])
        assert.ok(assemble('!source '+filename).errors.some(e=>/escape/.test(e.err)));
});
test("missing files, cycles and maximum nesting produce include diagnostics",()=>{
    assert.ok(assemble('!source "missing.a"').errors.some(e=>/include not found/.test(e.err)));
    const cycle=assemble('!source "a.a"',{includes:{"a.a":'!source "./a.a"'}});
    assert.ok(cycle.errors.some(e=>/cycle/.test(e.err)));
    const nested=assemble('!source "a.a"',{maxIncludeDepth:1,includes:{"a.a":'!source "b.a"',"b.a":"rts"}});
    assert.ok(nested.errors.some(e=>/depth/.test(e.err)));
});
test("malformed and unsupported library filenames produce diagnostics",()=>{
    for(const name of ['','""','"unfinished','defs.a','<defs.a>','"defs.a",1'])
        assert.ok(assemble('!source '+name).errors.some(e=>/filename|include name|library/.test(e.err)));
});
test("explicit foreign modes reject source includes without assembling their content",()=>{
    for(const dialect of ["raJS","ca65","Merlin","S-C"]){
        const result=assemble('!source "code.a"',{dialect,includes:{"code.a":"rts"}});
        assert.ok(result.errors.length);
        assert.deepEqual(values(result),[]);
    }
});
test("S-C includes retain their behavior alongside ACME includes in multi mode",()=>{
    const result=assemble('ORG $2000\n.IN /one.inc/\n!source "two.a"',{dialect:"multi",includes:{"one.inc":"DFB $11","two.a":"!byte $22"}});
    clean(result);
    assert.deepEqual(values(result),[17,34]);
});
test("C-style hexadecimal literals work in data, character-independent text and instructions",()=>{
    for(const dialect of ["multi","ACME"]){
        const result=assemble('*=0x2000\nN=0x2a\nlda #N\n!text "A",0xd\n!word 0x1234\n!byte !0x20&0xff',{dialect});
        clean(result);
        assert.deepEqual(values(result),[0xa9,42,65,13,0x34,0x12,0xdf]);
    }
});
test("C-style direct hex addresses obey the existing digit-width policy",()=>{
    const result=assemble('lda 0xF\nlda 0x0F\nlda 0x00F\nlda 0x000F\nlda 0x00F,X');
    clean(result);
    assert.deepEqual(values(result),[0xa5,15,0xa5,15,0xad,15,0,0xad,15,0,0xbd,15,0]);
});
test("malformed C-style numbers and over-wide direct addresses never emit truncated code",()=>{
    for(const source of ['lda 0x','lda 0xGG','lda 0x1G','lda 0x00001','!byte 0x100']){
        const result=assemble(source);
        assert.ok(result.errors.length,source);
        assert.deepEqual(values(result),[],source);
    }
});
test("ACME requires lowercase x while shared mixed-mode expressions also accept 0X",()=>{
    assert.ok(assemble('lda #0X2a').errors.length);
    const result=assemble('lda #0X2a',{dialect:"multi"});
    clean(result);
    assert.deepEqual(values(result),[0xa9,42]);
});
