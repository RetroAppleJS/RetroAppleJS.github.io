'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function load(){ const ctx={console,Ayumi:function(){},oEMU:{component:{IO:{}}}}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res','EMU_CARD_mockingboard.js'),'utf8'),ctx); return ctx; }
function renderer(){ const calls=[]; return {calls,setTone(...a){calls.push(['tone',...a]);},setNoise(...a){calls.push(['noise',...a]);},setMixer(...a){calls.push(['mixer',...a]);},setVolume(...a){calls.push(['volume',...a]);},setEnvelope(...a){calls.push(['envelope',...a]);},setEnvelopeShape(...a){calls.push(['shape',...a]);}}; }

test('AY bus decodes $4/$5/$6/$7 and accepts commands only from inactive',()=>{
  const ctx=load(), r=renderer(), bus=new ctx.MockingboardAYBus(r,{});
  bus.observeViaPins(8,0x04,1); bus.observeViaPins(8,0x07,2); assert.equal(bus.getState().selectedRegister,8); assert.equal(bus.getState().addressValid,true);
  bus.observeViaPins(0x0F,0x06,3); // LATCH -> WRITE is invalid active-to-active transition
  assert.equal(bus.readRegister(8),0);
  bus.observeViaPins(0,0x04,4); bus.observeViaPins(0x0F,0x06,5); assert.equal(bus.readRegister(8),0x0F);
  bus.observeViaPins(0,0x04,6); bus.observeViaPins(0,0x05,7); assert.equal(bus.isDrivingBus(),true); assert.equal(bus.getBusDrive(),0x0F);
});

test('PB2 low reset dominates control and invalidates address',()=>{
  const ctx=load(), resets=[], bus=new ctx.MockingboardAYBus(renderer(),{onReset:(cycle)=>resets.push(cycle)});
  bus.observeViaPins(2,0x04,1); bus.observeViaPins(2,0x07,2); assert.equal(bus.getState().addressValid,true);
  bus.observeViaPins(0xAA,0x03,3); assert.equal(bus.getState().resetAsserted,true); assert.equal(bus.getState().addressValid,false); assert.equal(bus.getBusDrive(),null);
  assert.ok(Array.from(bus.getRegisters()).every(v=>v===0));
  bus.observeViaPins(0xAA,0x03,4); // held reset must not emit a second event
  assert.deepEqual(resets,[3]);
});

test('address latch rejects values above $0F instead of aliasing',()=>{
  const ctx=load(), bus=new ctx.MockingboardAYBus(renderer(),{});
  bus.observeViaPins(0xF8,0x04,1); bus.observeViaPins(0xF8,0x07,2);
  assert.equal(bus.getState().addressValid,false);
  bus.observeViaPins(0,0x04,3); bus.observeViaPins(0x1F,0x06,4); assert.equal(bus.readRegister(8),0);
});

test('register masks and READ drive persist until inactive',()=>{
  const ctx=load(), bus=new ctx.MockingboardAYBus(renderer(),{});
  bus.observeViaPins(1,0x04,1); bus.observeViaPins(1,0x07,2); bus.observeViaPins(0,0x04,3); bus.observeViaPins(0xFF,0x06,4);
  assert.equal(bus.readRegister(1),0x0F);
  bus.observeViaPins(0,0x04,5); bus.observeViaPins(0,0x05,6); assert.equal(bus.getBusDrive(),0x0F);
  bus.observeViaPins(0,0x05,7); assert.equal(bus.getBusDrive(),0x0F);
  bus.observeViaPins(0,0x04,8); assert.equal(bus.getBusDrive(),null); assert.equal(bus.isDrivingBus(),false);
});

test('READ without a valid latched address leaves bus high impedance',()=>{
  const ctx=load(), bus=new ctx.MockingboardAYBus(renderer(),{});
  bus.observeViaPins(0,0x04,1); bus.observeViaPins(0,0x05,2); assert.equal(bus.getBusDrive(),null); assert.equal(bus.isDrivingBus(),false);
});

test('renderer mapping follows AY registers and repeated R13 retriggers',()=>{
  const ctx=load(), r=renderer(), bus=new ctx.MockingboardAYBus(r,{}); r.calls.length=0;
  bus.writeRegister(0,0x34,1); bus.writeRegister(1,0x02,2); assert.deepEqual(r.calls.slice(-1)[0],['tone',0,0x234]);
  bus.writeRegister(6,0x1A,3); assert.deepEqual(r.calls.slice(-1)[0],['noise',0x1A]);
  bus.writeRegister(7,0b00101001,4); bus.writeRegister(8,0x1C,5);
  assert.ok(r.calls.some(c=>c[0]==='mixer'&&c[1]===0&&c[2]===1&&c[3]===1&&c[4]===1));
  assert.ok(r.calls.some(c=>c[0]==='volume'&&c[1]===0&&c[2]===0x0C));
  bus.writeRegister(11,0x78,6); bus.writeRegister(12,0x56,7); assert.deepEqual(r.calls.slice(-1)[0],['envelope',0x5678]);
  const before=r.calls.filter(c=>c[0]==='shape').length; bus.writeRegister(13,0x0A,8); bus.writeRegister(13,0x0A,9);
  assert.equal(r.calls.filter(c=>c[0]==='shape').length,before+2);
});

test('AY sound-register updates use the semantic callback without console spam',()=>{
  const ctx=load(), messages=[], writes=[];
  ctx.console={log:function(){ messages.push(Array.from(arguments).join(' ')); }};
  const bus=new ctx.MockingboardAYBus(renderer(),{name:'AY0',onRegisterWrite:(reg,value,cycle)=>writes.push([reg,value,cycle])});

  bus.writeRegister(1,0xFF,123);
  bus.writeRegister(13,0x1A,456);
  bus.writeRegister(13,0x1A,457);
  assert.deepEqual(writes,[
    [1,0x0F,123],
    [13,0x0A,456],
    [13,0x0A,457]
  ]);
  assert.deepEqual(messages,[]);
});
