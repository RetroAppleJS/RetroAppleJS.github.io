'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load(){ const ctx={console,Ayumi:function(){},oEMU:{component:{IO:{}}}}; vm.createContext(ctx);require('./helpers/ay_core').loadInto(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res','EMU_CARD_mockingboard.js'),'utf8'),ctx); return ctx; }
test('reset ports and IER semantics match regular 6522',()=>{ const ctx=load(); const via=new ctx.MockingboardR6522({}); assert.equal(via.peekRegister(0x02),0x00); assert.equal(via.peekRegister(0x03),0x00); assert.equal(via.paPins,0xFF); assert.equal(via.pbPins,0xFF); via.writeRegister(0x0E,0xC0); assert.equal(via.peekRegister(0x0E),0xC0); via.writeRegister(0x0E,0x40); assert.equal(via.peekRegister(0x0E),0x80); });
test('DDRs preserve all data-line patterns and VIAs are independent',()=>{ const ctx=load(); const a=new ctx.MockingboardR6522({}); const b=new ctx.MockingboardR6522({}); for(const [x,y] of [[0x55,0xAA],[0x69,0x96],[0xAA,0x55],[0x96,0x69]]){ a.writeRegister(0x02,x); a.writeRegister(0x03,y); assert.equal(a.peekRegister(0x02),x); assert.equal(a.peekRegister(0x03),y);} a.writeRegister(0x02,0x55); b.writeRegister(0x02,0x69); assert.equal(a.peekRegister(0x02),0x55); assert.equal(b.peekRegister(0x02),0x69); });

test('peek is observational while destructive reads clear the documented flags',()=>{
    const ctx=load(); const via=new ctx.MockingboardR6522({}); const F=ctx.MockingboardR6522.IFR;
    via.ifr=F.T1|F.T2; via.writeRegister(0x0E,0xE0);
    assert.equal(via.irqLevel,true);
    via.peekRegister(0x04); assert.equal(via.ifr & F.T1,F.T1); assert.equal(via.irqLevel,true);
    via.readRegister(0x04); assert.equal(via.ifr & F.T1,0); assert.equal(via.irqLevel,true);
    via.peekRegister(0x08); assert.equal(via.ifr & F.T2,F.T2);
    via.readRegister(0x08); assert.equal(via.ifr & F.T2,0); assert.equal(via.irqLevel,false);
});

test('ORA no-handshake read preserves CA flags while normal ORA read clears them',()=>{
    const ctx=load(); const via=new ctx.MockingboardR6522({}); const F=ctx.MockingboardR6522.IFR;
    via.ifr=F.CA1|F.CA2; via.writeRegister(0x0E,0x83);
    via.readRegister(0x0F); assert.equal(via.ifr & (F.CA1|F.CA2),F.CA1|F.CA2);
    via.readRegister(0x01); assert.equal(via.ifr & (F.CA1|F.CA2),0);
});

test('shift-register write stores byte and clears SR interrupt',()=>{
    const ctx=load(); const via=new ctx.MockingboardR6522({}); const F=ctx.MockingboardR6522.IFR;
    via.ifr=F.SR; via.writeRegister(0x0E,0x84); via.writeRegister(0x0A,0x5A);
    assert.equal(via.peekRegister(0x0A),0x5A); assert.equal(via.ifr & F.SR,0); assert.equal(via.irqLevel,false);
});

function loadT1(via,n){ via.writeRegister(0x04,n&0xFF); via.writeRegister(0x05,(n>>8)&0xFF); }
function loadT2(via,n){ via.writeRegister(0x08,n&0xFF); via.writeRegister(0x09,(n>>8)&0xFF); }

test('T1 one-shot asserts after latch N plus 2 cycles',()=>{
    const ctx=load(); const via=new ctx.MockingboardR6522({}); const F=ctx.MockingboardR6522.IFR;
    loadT1(via,0x0004); via.tick(5); assert.equal(via.peekRegister(0x0D)&F.T1,0); assert.equal(via.peekRegister(0x04),0xFF);
    via.tick(1); assert.equal(via.peekRegister(0x0D)&F.T1,F.T1);
});

test('T1 free-running period is N plus 2 including N zero',()=>{
    const ctx=load(); const F=ctx.MockingboardR6522.IFR;
    const via=new ctx.MockingboardR6522({}); via.writeRegister(0x0B,0x40); loadT1(via,2);
    via.tick(3); assert.equal(via.peekRegister(0x0D)&F.T1,0);
    via.tick(1); assert.equal(via.peekRegister(0x0D)&F.T1,F.T1);
    via.writeRegister(0x0D,F.T1); via.tick(4); assert.equal(via.peekRegister(0x0D)&F.T1,F.T1);
    const zero=new ctx.MockingboardR6522({}); zero.writeRegister(0x0B,0x40); loadT1(zero,0);
    zero.tick(1); assert.equal(zero.peekRegister(0x0D)&F.T1,0);
    zero.tick(1); assert.equal(zero.peekRegister(0x0D)&F.T1,F.T1);
});

test('T2 PHI2 interval underflows after N plus 2 cycles',()=>{
    const ctx=load(); const via=new ctx.MockingboardR6522({}); const F=ctx.MockingboardR6522.IFR;
    loadT2(via,3); via.tick(4); assert.equal(via.peekRegister(0x0D)&F.T2,0);
    via.tick(1); assert.equal(via.peekRegister(0x0D)&F.T2,F.T2);
});

test('inactive timers never create IFR flags',()=>{
    const ctx=load(); const via=new ctx.MockingboardR6522({}); const F=ctx.MockingboardR6522.IFR;
    via.tick(500000); assert.equal(via.peekRegister(0x0D)&(F.T1|F.T2),0);
});

test('pending timer IFR asserts IRQ immediately when matching IER is later enabled',()=>{
    const ctx=load(); const via=new ctx.MockingboardR6522({}); const F=ctx.MockingboardR6522.IFR;
    loadT1(via,2); via.tick(4); assert.equal(via.peekRegister(0x0D)&F.T1,F.T1); assert.equal(via.irqLevel,false);
    via.writeRegister(0x0E,0xC0); assert.equal(via.irqLevel,true); assert.equal(via.peekRegister(0x0D)&0x80,0x80);
});

test('large free-running catch-up preserves phase without per-period stepping',()=>{
    const ctx=load(); const via=new ctx.MockingboardR6522({}); const F=ctx.MockingboardR6522.IFR;
    via.writeRegister(0x0B,0x40); loadT1(via,1); via.tick(100000);
    assert.equal(via.peekRegister(0x0D)&F.T1,F.T1);
    assert.equal(via.peekRegister(0x04),0);
});

test('T2 pulse-count mode is not decremented by CPU ticks',()=>{
    const ctx=load(); const via=new ctx.MockingboardR6522({}); const F=ctx.MockingboardR6522.IFR;
    via.writeRegister(0x0B,0x20); loadT2(via,0x1234); via.tick(10000);
    assert.equal(via.peekRegister(0x08),0x34); assert.equal(via.peekRegister(0x09),0x12); assert.equal(via.peekRegister(0x0D)&F.T2,0);
});

test('realtime predicate tracks only IRQ-enabled timers that can still assert',()=>{
    const ctx=load(); const via=new ctx.MockingboardR6522({});
    loadT1(via,2); assert.equal(via.needsRealtimeTick(),false);
    via.writeRegister(0x0E,0xC0); assert.equal(via.needsRealtimeTick(),true);
    via.tick(4); assert.equal(via.needsRealtimeTick(),false);
});

test('two VIA timers progress independently',()=>{
    const ctx=load(); const F=ctx.MockingboardR6522.IFR; const a=new ctx.MockingboardR6522({}); const b=new ctx.MockingboardR6522({});
    loadT1(a,2); loadT2(b,6); a.tick(4); b.tick(4);
    assert.equal(a.peekRegister(0x0D)&F.T1,F.T1); assert.equal(b.peekRegister(0x0D)&F.T2,0);
    b.tick(4); assert.equal(b.peekRegister(0x0D)&F.T2,F.T2);
});
