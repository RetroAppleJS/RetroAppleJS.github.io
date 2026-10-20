'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const B=require('../tools/SID_AUDIO_BENCH_core.js');
const {compareTrace}=require('./helpers/sid_adsr_cycle_reference.js');
const ROOT=path.resolve(__dirname,'..');
function ctor(){
 const c=vm.createContext({console,Math,Number,Uint8Array,Float32Array,
    Int16Array,Uint16Array,ArrayBuffer,DataView});
 vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_DEVICE_SID_audio.js'),'utf8'),c);
 return c.SIDAudio;
}
function sid(){
 const d=new (ctor())();
 d.setClock(985248);d.setModel(6581);
 return d;
}
function env(d){return d.getEnvelopeLevels()[0];}
test('4C.1/4C.2: rate-counter and exponential history survive GATE writes',()=>{
 const d=sid();
 d.writeRegister(5,0x10);d.writeRegister(6,0x02);
 d.writeRegister(4,0x11);d.renderOffline(1);
 const before=d.getEnvelopeState()[0];
 assert.ok(before.rateCounter>0);
 d.writeRegister(4,0x10);
 const off=d.getEnvelopeState()[0];
 assert.equal(off.rateCounter,before.rateCounter);
 assert.equal(off.expCounter,before.expCounter);
 d.writeRegister(4,0x11);
 const on=d.getEnvelopeState()[0];
 assert.equal(on.rateCounter,before.rateCounter);
 assert.equal(on.expCounter,before.expCounter);
 assert.equal(on.stage,'attack');
 assert.equal(on.holdZero,false);
});
test('4C.1/4C.2: raising sustain above a held level resumes downward decay to zero',()=>{
 const d=sid();
 d.writeRegister(5,0x00);d.writeRegister(6,0x20);
 d.writeRegister(4,0x11);d.renderOffline(11025); // 500ms, sustain $22
 assert.equal(env(d),0x22);
 d.writeRegister(6,0xe0);
 d.renderOffline(4410);
 assert.equal(env(d),0,'raising sustain above current level must not freeze note');
 assert.equal(d.getEnvelopeState()[0].holdZero,true);
});
test('4C.1/4C.2: lowering sustain causes decay; no immediate envelope jump',()=>{
 const d=sid();
 d.writeRegister(5,0x00);d.writeRegister(6,0xf0);
 d.writeRegister(4,0x11);d.renderOffline(2205);
 assert.equal(env(d),255);
 d.writeRegister(6,0x30);assert.equal(env(d),255);
 d.renderOffline(4410);assert.equal(env(d),0x33);
});
test('4C.1/4C.2: release reaches zero, holds, GATE rising unlocks zero',()=>{
 const d=sid();
 d.writeRegister(5,0x00);d.writeRegister(6,0x00);
 d.writeRegister(4,0x11);d.renderOffline(2205);
 d.writeRegister(4,0x10);d.renderOffline(4410);
 assert.equal(env(d),0);
 assert.equal(d.getEnvelopeState()[0].holdZero,true);
 d.renderOffline(2205);assert.equal(env(d),0);
 d.writeRegister(4,0x11);
 assert.equal(d.getEnvelopeState()[0].holdZero,false);
 d.renderOffline(10);assert.ok(env(d)>0);
});
test('4C.2: direct GATE off/on at full $FF envelope wraps to zero and holds',()=>{
 const d=sid();
 d.writeRegister(5,0x00);d.writeRegister(6,0xf0);
 d.writeRegister(4,0x11);d.renderOffline(2205);
 assert.equal(env(d),255);
 d.writeRegister(4,0x10);d.writeRegister(4,0x11);
 d.renderOffline(10);
 assert.equal(env(d),0,'attack at $ff wraps to $00');
 assert.equal(d.getEnvelopeState()[0].holdZero,true);
 d.renderOffline(2205);assert.equal(env(d),0);
 d.writeRegister(4,0x10);d.writeRegister(4,0x11);
 d.renderOffline(10);assert.ok(env(d)>0);
});
test('4C.2: shortening attack period after comparison point waits for wrap',()=>{
 const d=sid();
 d.writeRegister(5,0x10); // A=1, 32 cycles
 d.writeRegister(6,0xf0);d.writeRegister(4,0x11);
 d.renderOffline(1); // PAL about 44 SID cycles; one attack step
 const pre=d.getEnvelopeState()[0];
 assert.equal(env(d),1);
 assert.ok(pre.rateCounter>9);
 d.writeRegister(5,0x00); // period 9 already missed
 const start=env(d),cyclesLeft=0x7fff-pre.rateCounter+9;
 const framesBefore=Math.floor((cyclesLeft-100)/(985248/22050));
 d.renderOffline(framesBefore);
 assert.equal(env(d),start,'ADSR delay must not produce an early step');
 d.renderOffline(5);
 assert.ok(env(d)>start,'next step after counter wrap must resume attack');
 assert.ok(Number.isInteger(d.getEnvelopeState()[0].rateCounter));
});
test('4C.1: shared oscillator/envelope clock stays integer on PAL/NTSC',()=>{
 for(const clock of [985248,1022727]){
  const d=new (ctor())();d.setClock(clock);
  d.writeRegister(5,0x10);d.writeRegister(4,0x11);
  for(let n=1;n<100;n++){
   d.renderOffline(1);
   const state=d.getEnvelopeState();
   assert.ok(state.every(v=>Number.isInteger(v.rateCounter) &&
       v.rateCounter>=0 && v.rateCounter<=0x7fff));
   assert.equal(d.getAudioStats().sidClock,clock);
  }
 }
});
test('4C.1/4C.2: independent reference and production ADSR traces agree within PCM-grid quantization',()=>{
 for(const fixture of ['adsr-rate-change','adsr-retrigger','adsr-sustain-up','adsr-zero','adsr-voices']){
  const trace=B.traceEnvelope(ctor(),{fixture,clock:'PAL',model:6581,stride:64});
  const diff=compareTrace(trace);
  for(const v of diff.voices){
   assert.ok(v.maxAbsoluteError<=2,
     fixture+' differs from cycle oracle by '+v.maxAbsoluteError+' levels');
  }
 }
});
