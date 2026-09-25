'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','res','DBG_steptrace_scenario.js'),'utf8');
const manual=fs.readFileSync(path.join(__dirname,'..','docs','STEP_TRACE_MANUAL.md'),'utf8');

function makeHarness(){
  const mem=new Uint8Array(0x10000),state={pc:0x0d10,a:1,x:2,y:3,sp:0xff,p:0x20,cycle_delay:0,ic:0};
  let handler=null,lastError=null;
  const symbolRecords=[{name:'inflate_test_loop',value:0x0d10,type:'label'},{name:'inputPointer',value:0x00f0,type:'equ'}];
  const dbg={
    setBreakpointActionHandler(fn){handler=fn;lastError=null;return !!handler;},
    breakpointActionState(){return{active:!!handler,dispatching:false,lastError};},
    resolveSymbol(name){const k=String(name).toUpperCase();const r=symbolRecords.find(x=>x.name.toUpperCase()===k);return r?r.value:null;},
    symbol(name){const k=String(name).toUpperCase();const r=symbolRecords.find(x=>x.name.toUpperCase()===k);return r?{...r}:null;},
    symbols(){return symbolRecords.map(x=>({...x}));}
  };
  const hw={lineDecode(a){return(a>>>12)&15},safe_read(a){return mem[a&0xffff]},WR:new Array(16)};
  for(let i=0;i<16;i++)hw.WR[i]=(a,v)=>{mem[a&0xffff]=v&255};
  const cpu={watch(){return{...state}}};
  const window={apple2plus:{cpuObj(){return cpu},hwObj(){return hw}},oEMU:{component:{CPU:{Apple2Debug:dbg}}},console,addEventListener(){},setTimeout(fn){fn();return 1},clearTimeout(){}};
  window.window=window;window.document={getElementById(){return null},createElement(){return{style:{},setAttribute(){},appendChild(){}}},body:{appendChild(){}}};
  const ctx={window,document:window.document,console,Uint8Array,Array,Object,Number,String,Boolean,Math,Date,Error,TypeError,JSON,isFinite,parseInt};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  return{STB:window.STB,window,mem,state,dbg,get handler(){return handler}};
}

test('scenario script registers one persistent breakpoint callback without controlling CPU execution',()=>{
  const h=makeHarness();
  assert.equal(h.window.TB,undefined);assert.equal(h.window.EMU_ASM_BUILD,undefined);
  assert.equal(h.STB.arm("let n=0; onBreakpoint(function(bp){ n++; ram.write('$3000',n); });"),true);
  assert.equal(h.STB.mode(),'run');
  assert.equal(h.handler({PC:0x0d10,A:0,X:0,Y:0,SP:0xff,P:0x20,INS:1,condition:'PC==$0D10',hit:1}),undefined);
  assert.equal(h.handler({PC:0x0d10,A:0,X:0,Y:0,SP:0xff,P:0x20,INS:2,condition:'PC==$0D10',hit:2}),undefined);
  assert.equal(h.mem[0x3000],2);
});

test('haltAtBreakpoint switches scenario back to HALT at the current match',()=>{
  const h=makeHarness();
  h.STB.arm("onBreakpoint(function(bp){ haltAtBreakpoint(); });");
  const fn=h.handler;assert.deepEqual(JSON.parse(JSON.stringify(fn({PC:0x0d10,hit:1}))),{halt:true});
  assert.equal(h.STB.mode(),'halt');assert.equal(h.handler,null);
});

test('callback exceptions disarm RUN mode and are rethrown for debugger fail-safe handling',()=>{
  const h=makeHarness();
  h.STB.arm("onBreakpoint(function(){ throw new Error('boom'); });");
  const fn=h.handler;assert.throws(()=>fn({PC:0x0d10,hit:1}),/boom/);assert.equal(h.STB.mode(),'halt');assert.equal(h.handler,null);
});

test('scenario symbol helpers proxy only STEP TRACE loaded symbols',()=>{
  const h=makeHarness();
  assert.equal(h.STB.sym('INFLATE_TEST_LOOP'),0x0d10);assert.equal(h.STB.sym('missing',0x1234),0x1234);
  assert.throws(()=>h.STB.sym('missing'),e=>e&&e.code==='STB_UNKNOWN_SYMBOL');
  assert.deepEqual(JSON.parse(JSON.stringify(h.STB.symbol('inputPointer'))),{name:'inputPointer',value:0xf0,type:'equ'});
});

test('assert requires JavaScript booleans and never drives execution',()=>{
  const h=makeHarness();assert.equal(h.STB.assert(true,'ok'),true);assert.equal(h.STB.assert(false,'bad'),false);assert.throws(()=>h.STB.assert('A==$01'),/boolean/);
});

test('old CPU-driving scenario APIs and live-build dependencies are removed',()=>{
  const h=makeHarness();
  for(const name of ['scenario','reset','breakIf','syncBuild','buildInfo'])assert.equal(h.STB[name],undefined,name);
  assert.equal(h.STB.cpu.start,undefined);
  assert.doesNotMatch(source,/EMU_ASM_BUILD|DBG_RAM|DBG_TESTBENCH|function\s+compile\s*\(|stepLiveInstruction/);
});

test('arming requires exactly one onBreakpoint registration',()=>{
  const h=makeHarness();assert.throws(()=>h.STB.arm("print('none')"),/exactly one/);assert.equal(h.STB.mode(),'halt');
  assert.throws(()=>h.STB.arm("onBreakpoint(function(){}); onBreakpoint(function(){});"),/exactly one/);assert.equal(h.STB.mode(),'halt');
});

test('scenario mode UI uses HALT pause and RUN sign-in pictograms',()=>{
  assert.match(source,/fa fa-pause/);assert.match(source,/HALT at breakpoint/);assert.match(source,/fa fa-sign-in-alt/);assert.match(source,/RUN script at breakpoint/);
});

test('scenario popup initializes its terminal output surface after cloning the TEST BENCH UI',()=>{
  assert.match(source,/function initTerminal\(\)/);
  assert.match(source,/p\.appendChild\(q\);\s*initTerminal\(\);/);
  assert.match(source,/if\(term&&term\.clear\)term\.clear\(\)/);
});

test('manual documents breakpoint-driven scenarios and removes the LOAD LIVE workflow',()=>{
  for(const text of ['HALT at breakpoint','RUN script at breakpoint','onBreakpoint','haltAtBreakpoint','PC==inflate_test_loop || PC==inflate_test_done'])
    assert.ok(manual.includes(text),text);
  assert.doesNotMatch(manual,/LOAD LIVE/);
});
