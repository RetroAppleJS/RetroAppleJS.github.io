'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function machine()
{
    const ram = new Uint8Array(65536).fill(0xEA), elements = {}, prompts = [];
    function element()
    {
        return {style:{}, textContent:'', appendChild(node){node.parentNode=this;}, setAttribute(){}};
    }
    elements.trace = element();
    elements.cpuDbg_symbolStatus = element();
    const ctx = {console, oEMU:{component:{CPU:{}}},
        oCOM:{getHexByte:n=>(n&255).toString(16).toUpperCase().padStart(2,'0'),
            getHexWord:n=>(n&65535).toString(16).toUpperCase().padStart(4,'0')},
        document:{getElementById:id=>elements[id]||null, createElement:element},
        prompt:message=>{prompts.push(message);return ctx.answer;}};
    vm.createContext(ctx);
    for(const name of ['ASM_core.js','EMU_cpu6502.js','EMU_apple2debug.js'])
        vm.runInContext(fs.readFileSync(path.join(__dirname,'../res',name),'utf8'),ctx,{filename:name});
    const cpu = new ctx.Cpu6502({read:a=>ram[a],write:(a,v)=>ram[a]=v});
    const dbg = ctx.oEMU.component.CPU.Apple2Debug;
    ctx.apple2plus = {cpuObj:()=>cpu,hwObj:()=>({safe_read:a=>ram[a]})};
    dbg.body_id = 'trace';
    dbg.setListingColumns('{adr:0,code:6,lbl:17,ins:35,opr:40,com:80}');
    function row(pc,bytes=[0x8D,0x00,0xC4])
    {
        ram.set(bytes,pc); cpu.setState({pc}); dbg.cycle({cpu,force:true});
        const text = elements.trace._cpuDbgRowPool.find(n=>n._cpuDbgAddr===pc).textContent;
        return {operand:text.slice(40,80).trim(),comment:text.slice(80).trim(),label:text.slice(17,35).trim()};
    }
    function load(raw,policy){return dbg.loadSymbolsText(JSON.stringify(raw),'symbols.json',policy);}
    return {ctx,dbg,row,load,elements,prompts};
}
const equ = (name,value)=>({name,type:'equ',value});
const comment = (value,text,targetType='instruction',opcode)=>({type:'comment',targetType,value,comment:text,opcode});
const hardware = (symbols=[equ('MB1_ORB',0xC400),comment(0xC400,'AY control bus','equ')])=>({
    format:'RetroAppleJS-ASM-symbols',version:2,source:'MOCKINGBOARD SLOT 4',
    scopeMode:'operand-address',scope:[[0xC400,0xC40F],[0xC480,0xC48F]],symbols});

test('PC scope defaults remain compatible and symbol-only operands omit repeated hex',()=>{
    const h=machine();h.load({scope:[[0x1000,0x11FF]],symbols:[equ('PSG_CONTROL',0xC400)]});
    assert.equal(h.row(0x1178).operand,'PSG_CONTROL');
    assert.equal(h.row(0x2000).operand,'$C400');
});
test('operand scope applies at any PC and appends EQU comments to source comments',()=>{
    const h=machine();
    h.load({scope:[[0x1100,0x11FF]],symbols:[comment(0x1178,'select sound chip','instruction',[0x8D,0,0xC4])]});
    h.load(hardware());
    assert.deepEqual(h.row(0x1178),{operand:'MB1_ORB',comment:'select sound chip | AY control bus',label:''});
    assert.equal(h.row(0xF900).operand,'MB1_ORB');
    assert.equal(h.row(0xF900).comment,'AY control bus');
    assert.equal(h.row(0x1178,[0x8E,0,0xC4]).comment,'AY control bus');
});
test('PC names win independently of load order and hardware comments survive',()=>{
    for(const reverse of [false,true]){
        const h=machine(),source={scope:[[0x1100,0x11FF]],symbols:[equ('PSG_CONTROL',0xC400)]};
        for(const table of reverse?[hardware(),source]:[source,hardware()])h.load(table);
        assert.equal(h.row(0x1178).operand,'PSG_CONTROL');
        assert.equal(h.row(0x1178).comment,'AY control bus');
        assert.equal(h.row(0x2000).operand,'MB1_ORB');
    }
});
test('identical numeric scopes in different modes coexist without an overlap prompt',()=>{
    const h=machine();
    h.load({scope:[[0xC400,0xC40F]],symbols:[equ('ROM_ENTRY',0xC481)]});h.load(hardware());
    assert.equal(h.prompts.length,0);
    assert.equal(h.dbg.resolveSymbol('ROM_ENTRY'),0xC481);
    assert.equal(h.row(0xC400,[0x8D,0x81,0xC4]).operand,'ROM_ENTRY');
    assert.equal(h.row(0x1178).operand,'MB1_ORB');
});
test('hardware names and comments exclude immediate, accumulator and implied modes',()=>{
    const h=machine();h.load({scopeMode:'operand-address',scope:[[0,255]],symbols:[equ('IO_SEVEN',7),comment(7,'IO seven','equ')]});
    assert.deepEqual(h.row(0x1000,[0xA9,7]),{operand:'#$07',comment:'',label:''});
    assert.equal(h.row(0x1000,[0xA5,7]).operand,'IO_SEVEN');
    assert.equal(h.row(0x1000,[0x0A]).comment,'');
    assert.equal(h.row(0x1000,[0xEA]).comment,'');
});
test('addressing syntax and relative target resolution survive hardware substitution',()=>{
    const h=machine();h.load({scopeMode:'operand-address',symbols:[equ('IO',0xC400),equ('ZPIO',7),equ('TARGET',0x1004)]});
    for(const [bytes,want] of [[[0x9D,0,0xC4],'IO,X'],[[0x99,0,0xC4],'IO,Y'],[[0x6C,0,0xC4],'(IO)'],
        [[0xA1,7],'(ZPIO,X)'],[[0xB1,7],'(ZPIO),Y'],[[0xD0,2],'TARGET']])
        assert.equal(h.row(0x1000,bytes).operand,want);
});
test('operand lookups respect scope and never infer hardware register names with +1',()=>{
    const h=machine();h.load(hardware([equ('MB1_ORB',0xC400),equ('OUTSIDE',0xC500),comment(0xC500,'outside','equ')]));
    assert.equal(h.row(0x1178,[0x8D,1,0xC4]).operand,'$C401');
    assert.deepEqual(h.row(0x1178,[0x8D,0,0xC5]),{operand:'$C500',comment:'',label:''});
});
test('PC +1 fallback and assembler symlinks remain available with hardware tables',()=>{
    const h=machine();h.load({symbols:[equ('BUFFER',0x3000)]});h.load(hardware());
    assert.equal(h.row(0x1000,[0xAD,1,0x30]).operand,'BUFFER+1');
    h.ctx.oASM={symlink:{12288:'LIVE_BUFFER'}};h.dbg.clearSymbols();
    assert.equal(h.row(0x1000,[0xAD,0,0x30]).operand,'LIVE_BUFFER');
});
test('merge keeps both tables while override affects only intersecting tables in its mode',()=>{
    const h=machine();h.load({scope:[[0x1100,0x11FF]],symbols:[equ('OLD',0xC400),comment(0x1178,'old')]});
    h.load(hardware());
    h.load({scope:[[0x1100,0x11FF]],symbols:[equ('NEW',0xC400),comment(0x1178,'new')]},'merge');
    assert.equal(h.row(0x1178).operand,'NEW');assert.equal(h.row(0x1178).comment,'old new | AY control bus');
    h.load({scope:[[0x1100,0x11FF]],symbols:[equ('REPLACED',0xC400)]},'override');
    assert.equal(h.dbg.resolveSymbol('OLD'),null);assert.equal(h.dbg.resolveSymbol('NEW'),null);
    assert.equal(h.row(0x1178).operand,'REPLACED');assert.equal(h.row(0x1178).comment,'AY control bus');
});
test('overlap dialog exposes mode and cancellation leaves tables intact',()=>{
    const h=machine();h.load(hardware());h.ctx.answer=null;h.load(hardware([equ('NEW',0xC400)]));
    assert.match(h.prompts[0],/operand-address/);assert.equal(h.row(0x1178).operand,'MB1_ORB');
    h.ctx.answer='override';h.load(hardware([equ('NEW',0xC400)]));assert.equal(h.row(0x1178).operand,'NEW');
});
test('invalid mode or scope rejects atomically; clear removes both namespaces',()=>{
    const h=machine();h.load(hardware());
    assert.throws(()=>h.load({...hardware(),scopeMode:'unknown'}),/scope mode/i);
    assert.throws(()=>h.load({...hardware(),scope:[[0xC40F,0xC400]]}),/scope/i);
    assert.equal(h.row(0x1178).operand,'MB1_ORB');h.dbg.clearSymbols();
    assert.deepEqual(h.row(0x1178),{operand:'$C400',comment:'',label:''});
    assert.equal(h.dbg.resolveSymbol('MB1_ORB'),null);
});
test('status exposes each loaded table mode and hardware labels never populate lbl',()=>{
    const h=machine();h.load(hardware([{type:'label',name:'IO_LABEL',value:0xC400}]));
    assert.equal(h.row(0xC400,[0x8D,0,0xC4]).label,'');
    assert.match(h.elements.cpuDbg_symbolStatus.title,/MOCKINGBOARD SLOT 4.*operand-address/);
});
test('text maps retain PC default and coexist with a hardware table',()=>{
    const h=machine();h.dbg.loadSymbolsText('BUFFER=$3000','test.sym');h.load(hardware());
    assert.equal(h.row(0x1000,[0xAD,0,0x30]).operand,'BUFFER');
    assert.equal(h.row(0x1178).operand,'MB1_ORB');
});
test('scope bounds reject overflow, negative and fractional values rather than wrapping',()=>{
    const h=machine();
    for(const scope of [[[0,65536]],[[0,'$10000']],[[-1,255]],[[1.5,255]],[]])
        assert.throws(()=>h.load({...hardware(),scope}),/scope/i);
});
test('operand comments can match without a symbol and PC EQU comments remain excluded',()=>{
    const h=machine();
    h.load({symbols:[comment(0x1178,'instruction'),comment(0x1178,'equ must stay hidden','equ')]});
    h.load(hardware([comment(0xC400,'hardware only','equ')]));
    assert.deepEqual(h.row(0x1178),{operand:'$C400',comment:'instruction | hardware only',label:''});
});
test('supplied slot-4 table resolves both VIA banks alongside the existing Monitor table',()=>{
    const h=machine();
    h.dbg.loadSymbolsText(fs.readFileSync(path.join(__dirname,'../asm/ROMS/APPLE/APPLE-2 MONITOR ROM.symbols.json'),'utf8'),'Monitor.json');
    h.dbg.loadSymbolsText(fs.readFileSync(path.join(__dirname,'../asm/ROMS/PERIPHERALS/MOCKINGBOARD_SLOT4.symbols.json'),'utf8'),'Mockingboard.json');
    assert.equal(h.prompts.length,0);
    assert.equal(h.row(0x1178).operand,'MB1_ORB');
    assert.equal(h.row(0xF900,[0x8D,0x80,0xC4]).operand,'MB2_ORB');
    assert.match(h.row(0x1178,[0x8D,0x81,0xC4]).comment,/AY2.*data bus/);
    assert.equal(h.row(0x1178,[0x8D,0x8F,0xC4]).operand,'MB2_ORA_NH');
});
