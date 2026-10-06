'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function harness(clockRate=44100)
{
  let ticks=0; const irq={};
  const io={FLOATING_BUS:-1,getClockTicks(){return ticks;}};
  const hw={io,setIRQSource(source,active){ irq[source]=!!active; }};
  const ctx={console,_o:{CPU_ClocksTicks_s:clockRate},oEMU:{component:{IO:{}}},apple2plus:{hwObj(){return hw;}}};
  vm.createContext(ctx);require('./helpers/mockingboard_scheduler').loadInto(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res','EMU_CARD_mockingboard.js'),'utf8'),ctx);
  const card=new ctx.mockingboard(); card.mount={hash:1234,slotN:4}; card.restart();
  return {ctx,card,irq,io,hw,setTicks(v){ticks=v;}};
}

function cctx(t,bRO=false,io=null){ return {cpuTick:t,bRO,io:io||{FLOATING_BUS:-1}}; }

test('strict slot-page decode maps only $00-$0F and $80-$8F',()=>{
  const h=harness(), card=h.card;
  card.writeSlotROM(0x03,0xAA,cctx(1,false,h.io));
  card.writeSlotROM(0x83,0x55,cctx(2,false,h.io));
  assert.equal(card.readSlotROM(0x03,cctx(2,true,h.io)),0xAA);
  assert.equal(card.readSlotROM(0x83,cctx(2,true,h.io)),0x55);
  card.writeSlotROM(0x13,0x11,cctx(3,false,h.io)); card.writeSlotROM(0x93,0x22,cctx(4,false,h.io));
  assert.equal(card.readSlotROM(0x03,cctx(4,true,h.io)),0xAA);
  assert.equal(card.readSlotROM(0x83,cctx(4,true,h.io)),0x55);
  assert.equal(card.readSlotROM(0x10,cctx(4,false,h.io)),-1);
  assert.equal(card.readSlotROM(0x90,cctx(4,false,h.io)),-1);
});

test('read-only slot reads use peek semantics and do not clear timer IFR',()=>{
  const h=harness(), card=h.card, F=h.ctx.MockingboardR6522.IFR;
  card.writeSlotROM(0x04,0x02,cctx(0,false,h.io)); card.writeSlotROM(0x05,0x00,cctx(0,false,h.io));
  card.advanceTo(4); assert.equal(card.getViaState(0).ifr & F.T1,F.T1);
  card.readSlotROM(0x04,cctx(4,true,h.io)); assert.equal(card.getViaState(0).ifr & F.T1,F.T1);
  card.readSlotROM(0x04,cctx(4,false,h.io)); assert.equal(card.getViaState(0).ifr & F.T1,0);
});

test('AY register write and readback travel through VIA pins and DDRA direction',()=>{
  const h=harness(), card=h.card;
  card.writeSlotROM(0x02,0x07,cctx(1,false,h.io));
  card.writeSlotROM(0x03,0xFF,cctx(2,false,h.io));
  card.writeSlotROM(0x00,0x04,cctx(3,false,h.io));
  card.writeSlotROM(0x01,0x08,cctx(4,false,h.io));
  card.writeSlotROM(0x00,0x07,cctx(5,false,h.io));
  card.writeSlotROM(0x00,0x04,cctx(6,false,h.io));
  card.writeSlotROM(0x01,0x0F,cctx(7,false,h.io));
  card.writeSlotROM(0x00,0x06,cctx(8,false,h.io));
  card.writeSlotROM(0x00,0x04,cctx(9,false,h.io));
  assert.equal(Array.from(card.getRegisters(0))[8],0x0F);
  card.writeSlotROM(0x03,0x00,cctx(10,false,h.io));
  card.writeSlotROM(0x00,0x05,cctx(11,false,h.io));
  assert.equal(card.readSlotROM(0x01,cctx(11,false,h.io)),0x0F);
  card.writeSlotROM(0x00,0x04,cctx(12,false,h.io));
});

test('absolute timing is idempotent and card ORs both VIA IRQs',()=>{
  const h=harness(), card=h.card, F=h.ctx.MockingboardR6522.IFR;
  // VIA0 T1=2, IRQ enabled
  card.writeSlotROM(0x04,2,cctx(0,false,h.io)); card.writeSlotROM(0x05,0,cctx(0,false,h.io)); card.writeSlotROM(0x0E,0xC0,cctx(0,false,h.io));
  card.advanceTo(4); const a=card.getViaState(0); assert.equal(a.ifr&F.T1,F.T1); assert.equal(h.irq['MOCK:1234'],true);
  const counter=a.t1Counter; card.advanceTo(4); assert.equal(card.getViaState(0).t1Counter,counter);
  // VIA1 T1=2 too
  card.writeSlotROM(0x84,2,cctx(4,false,h.io)); card.writeSlotROM(0x85,0,cctx(4,false,h.io)); card.writeSlotROM(0x8E,0xC0,cctx(4,false,h.io));
  card.advanceTo(8); assert.equal(card.getViaState(1).ifr&F.T1,F.T1);
  card.writeSlotROM(0x0D,F.T1,cctx(8,false,h.io)); assert.equal(h.irq['MOCK:1234'],true);
  card.writeSlotROM(0x8D,F.T1,cctx(8,false,h.io)); assert.equal(h.irq['MOCK:1234'],false);
  card.reset(); assert.equal(h.irq['MOCK:1234'],false);
});

test('deterministic audio ring is CPU-time driven, bounded, and mute only stops capture',()=>{
  const h=harness(44100), card=h.card;
  card.setAudioConsumerActive(true); card.advanceTo(11);
  assert.equal(card.getAudioFramesAvailable(),5); assert.equal(card.getAudioStats().producedFrames,5);
  const d=card.drainAudioFrames(4); assert.equal(d.frames,4); assert.ok(ArrayBuffer.isView(d.left)); assert.ok(ArrayBuffer.isView(d.right)); assert.equal(card.getAudioFramesAvailable(),1);
  const before=card.getAudioStats().producedFrames; card.setAudioConsumerActive(false); card.advanceTo(20); const after=card.getAudioStats().producedFrames;
  assert.ok(after>before); assert.equal(card.getAudioFramesAvailable(),1);
  card.clearAudioQueue(); card.setAudioConsumerActive(true); card.advanceTo(11060);
  assert.equal(card.getAudioFramesAvailable(),5513); assert.equal(card.getAudioStats().droppedFrames,1); assert.equal(card.getAudioStats().overruns,0);
});

test('mb-audit timing: slot accesses observe counters at ctx.cpuTick timestamps',()=>{
  const {card}=harness(); const base=0xC400;
  card.writeSlotROM(base+4,0x02,{cpuTick:100});
  card.writeSlotROM(base+5,0x00,{cpuTick:100});
  assert.equal(card.readSlotROM(base+4,{cpuTick:103}),0xFF,'N+1 reaches $FFFF gap');
  const ifr=card.readSlotROM(base+13,{cpuTick:104});
  assert.equal(ifr & 0x40,0x40,'N+2 timestamp observes T1 underflow');
});

test('mb-audit Detect6522 sees timer motion through slot reads before timer is armed',()=>{
  const {card}=harness(); const base=0xC400;
  const first=card.readSlotROM(base+8,{cpuTick:10});
  const second=card.readSlotROM(base+8,{cpuTick:18});
  assert.equal((first-second)&0xFF,8);
  assert.equal(card.readSlotROM(base+13,{cpuTick:18})&0x60,0);
});
