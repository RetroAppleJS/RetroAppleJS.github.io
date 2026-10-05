'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function load(){
  const ctx={console,Uint8Array,Array,Number,Math,Object,Ayumi:function(){},oEMU:{component:{IO:{}}}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res','EMU_CARD_mockingboard.js'),'utf8'),ctx);
  return ctx;
}
function regs(seed){ return [Array.from({length:14},(_,i)=>(seed+i)&255),Array.from({length:14},(_,i)=>(seed+32+i)&255)]; }

test('driver exposes a packed MockingboardHistory recorder',()=>{
  const ctx=load();
  assert.equal(typeof ctx.MockingboardHistory,'function');
});

test('start clears the previous capture and snapshots both AY register sets',()=>{
  const {MockingboardHistory}=load();
  const h=new MockingboardHistory(64);
  h.start(100,regs(1));
  h.recordWrite(0,8,15,110);
  assert.equal(h.getState().records,1);
  h.stop(120);
  h.start(500,regs(7));
  const j=h.toJSON({slot:4,clockHz:1021800,stopTick:500});
  assert.equal(h.getState().records,0);
  assert.equal(j.baseTick,500);
  assert.deepEqual(Array.from(j.initialRegisters.AY0),regs(7)[0]);
  assert.deepEqual(Array.from(j.initialRegisters.AY1),regs(7)[1]);
  assert.deepEqual(Array.from(j.events),[]);
});

test('write history exports delta cycles and preserves repeated sound-register writes',()=>{
  const {MockingboardHistory}=load();
  const h=new MockingboardHistory(64);
  h.start(1000,regs(0));
  h.recordWrite(0,13,0x0a,1010);
  h.recordWrite(0,13,0x0a,1011);
  h.recordWrite(1,7,0x38,70000+1011);
  const j=h.toJSON({slot:4,clockHz:1021800,stopTick:71011});
  assert.deepEqual(Array.from(j.events, e=>Array.from(e)),[
    [10,0,13,0x0a],
    [1,0,13,0x0a],
    [70000,1,7,0x38]
  ]);
  assert.equal(h.getState().bytesUsed,16); // third event requires one packed delay-extension record
});

test('reset is a semantic history event and clears the captured AY state',()=>{
  const {MockingboardHistory}=load();
  const h=new MockingboardHistory(64);
  h.start(0,regs(0));
  h.recordWrite(1,8,0x0f,5);
  h.recordReset(1,9);
  const j=h.toJSON({slot:4,clockHz:1021800,stopTick:9});
  assert.deepEqual(Array.from(j.events, e=>Array.from(e)),[[5,1,8,15],[4,1,-1,0]]);
});

test('ring overwrite advances baseTick and rolling initial state so retained tail is independently replayable',()=>{
  const {MockingboardHistory}=load();
  const h=new MockingboardHistory(1); // 1024 bytes = 256 packed records
  h.start(100,[[0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0]]);
  for(let i=0;i<257;i++) h.recordWrite(0,8,i&15,101+i);
  const j=h.toJSON({slot:4,clockHz:1021800,stopTick:357});
  assert.equal(h.getState().records,256);
  assert.equal(h.getState().wrapped,true);
  assert.equal(j.baseTick,101);
  assert.equal(j.initialRegisters.AY0[8],0); // dropped first write had value 0
  assert.equal(j.events.length,256);
  assert.deepEqual(Array.from(j.events[0]),[1,0,8,1]);
});

test('capacity is configurable in whole Kbytes while stopped and fixed while recording',()=>{
  const {MockingboardHistory}=load();
  const h=new MockingboardHistory(64);
  assert.equal(h.setCapacityKB(32),32);
  h.start(0,regs(0));
  assert.equal(h.setCapacityKB(8),32);
  assert.equal(h.getState().capacityBytes,32768);
  h.stop(1);
  assert.equal(h.setCapacityKB(8),8);
  assert.equal(h.getState().capacityBytes,8192);
});

test('history download keeps scalar arrays on one line and one event tuple per line',()=>{
  const ctx=load(), blobs=[];
  ctx.Blob=function(parts,options){ blobs.push({parts,options}); };
  ctx.window={URL:{createObjectURL:()=>"blob:test",revokeObjectURL:()=>{}}};
  ctx.setTimeout=(fn)=>fn();
  ctx.document={
    createElement:()=>({click(){},remove(){}}),
    body:{appendChild(){}},
    getElementById:()=>null
  };

  const card=ctx.oEMU.component.IO.mockingboard;
  const zero=Array(14).fill(0);
  card.history.start(100,[zero,zero]);
  card.history.recordWrite(0,8,15,110);
  card.history.recordWrite(1,7,56,120);
  card.history.stop(120);

  assert.equal(card.downloadHistory(),true);
  const text=String(blobs[0].parts[0]);
  assert.match(text,/"AY0": \[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0\]/);
  assert.match(text,/"AY1": \[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0\]/);
  assert.match(text,/"events": \[\n    \[10, 0, 8, 15\],\n    \[10, 1, 7, 56\]\n  \]/);
  assert.doesNotMatch(text,/"AY0": \[\n/);
  assert.deepEqual(JSON.parse(text).events,[[10,0,8,15],[10,1,7,56]]);
});
