'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const F=require('../tools/SID_FILTER_BENCH_core.js');
const ROOT=path.resolve(__dirname,'..');
function ctor(){
 const c=vm.createContext({console,Math,Number,Uint8Array,Float32Array,
  Int16Array,Uint16Array,ArrayBuffer,DataView});
 vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_DEVICE_SID_audio.js'),'utf8'),c);
 return c.SIDAudio;
}
function device(model=6581,clock=985248){
 const d=new (ctor())();d.setClock(clock);d.setModel(model);return d;
}
test('4D.1: filter coefficients recompute only on cutoff, resonance and model changes',()=>{
 const d=device();
 const initial=d.getFilterState();
 const n=initial.coefficientUpdates;
 d.renderOffline(10000);
 assert.equal(d.getFilterState().coefficientUpdates,n,'no per-sample trig');
 d.writeRegister(0x18,0x7f);
 d.writeRegister(0x17,0x03);
 d.writeRegister(0x10,0xaa);
 assert.equal(d.getFilterState().coefficientUpdates,n,'route, mode and voice controls are coefficient-neutral');
 d.writeRegister(0x15,0x03);
 const newCount=d.getFilterState().coefficientUpdates;
 assert.equal(newCount,n+1);
 d.writeRegister(0x15,0x03);
 assert.equal(d.getFilterState().coefficientUpdates,newCount,'unchanged cutoff does not recalculate');
 d.writeRegister(0x16,0x60);
 assert.equal(d.getFilterState().coefficientUpdates,newCount+1);
 d.writeRegister(0x17,0xf3);
 assert.equal(d.getFilterState().coefficientUpdates,newCount+2);
 assert.equal(d.getFilterState().resonance,15);
 d.setModel(8580);
 assert.equal(d.getFilterState().coefficientUpdates,newCount+3);
 d.setModel(8580);
 assert.equal(d.getFilterState().coefficientUpdates,newCount+3);
 d.renderOffline(10000);
 assert.equal(d.getFilterState().coefficientUpdates,newCount+3);
});
test('4D.1: every resonance register code affects the digital response',()=>{
 const C=ctor();
 for(const model of [6581,8580]){
  const cutoff=model===6581?512:192;
  const trials=Array.from({length:16},(_,resonance)=>
     F.capture(C,{model,clock:'PAL',mode:'bp',cutoff,resonance,toneHz:880}));
  assert.equal(new Set(trials.map(x=>x.hash)).size,16,
    model+': every resonance code must have a distinct response');
  assert.ok(trials.at(-1).analysis.acRms>trials[0].analysis.acRms,
    model+': increasing resonance should increase in-band response');
  assert.ok(trials.every(x=>x.analysis.clippedSamples===0),
    model+': resonant single-voice 880 Hz test must not clip');
 }
});
test('4D.1: V3OFF acts ONLY on direct Voice 3 output',()=>{
 const C=ctor();
 for(const model of [6581,8580]){
  const args={model,clock:'PAL',toneHz:880,cutoff:512,mode:'lp'};
  const dry=F.capture(C,{...args,voice:2,route:false});
  const dryOff=F.capture(C,{...args,voice:2,route:false,voice3Off:true});
  const wet=F.capture(C,{...args,voice:2,route:true});
  const wetOff=F.capture(C,{...args,voice:2,route:true,voice3Off:true});
  assert.ok(dry.analysis.acRms>0.01);
  assert.equal(dryOff.analysis.acRms,0);
  assert.ok(wet.analysis.acRms>0.01);
  assert.equal(wet.hash,wetOff.hash);
 }
});
test('4D.1: unfiltered waveform and complete PCM remain unchanged',()=>{
 const C=ctor();
 for(const model of [6581,8580]){
  const x=F.capture(C,{model,clock:'PAL',mode:'off',route:false,
     cutoff:1024,resonance:0,toneHz:880});
  assert.equal(x.hash,'7ca964a2','direct path PCM must match Phase 4D.0');
  assert.equal(x.analysis.clippedSamples,0);
 }
});
test('4D.1: LP, BP, HP produce finite unclipped single-voice output on PAL/NTSC',()=>{
 const C=ctor();
 for(const clock of ['PAL','NTSC']){
  for(const mode of ['lp','bp','hp','lp+bp','bp+hp','lp+hp','all']){
   for(const model of [6581,8580]){
    for(const cutoff of [0,64,256,768,1536,2047]){
     const x=F.capture(C,{clock,mode,model,cutoff,
       resonance:15,toneHz:880});
     assert.ok(x.analysis.acRms>=0&&Number.isFinite(x.analysis.acRms));
     assert.ok(x.analysis.peak<=1);
     assert.equal(x.analysis.clippedSamples,0,
       clock+'/'+mode+'/'+model+'/'+cutoff+' unexpectedly clips');
    }
   }
  }
 }
});
test('4D.1: bounded integrator state survives rapid cutoff/resonance writes',()=>{
 for(const model of [6581,8580]){
  const d=device(model);
  d.writeRegister(0,0x70);d.writeRegister(1,0x20);
  d.writeRegister(5,0);d.writeRegister(6,0xf0);
  d.writeRegister(4,0x21);d.writeRegister(0x17,0xf1);
  d.writeRegister(0x18,0x7f);
  let count=0;
  for(let i=0;i<320;i++){
   const fc=(i*997)%2048;
   d.writeRegister(0x15,fc&7);
   d.writeRegister(0x16,fc>>3);
   d.writeRegister(0x17,((i%16)<<4)|1);
   d.writeRegister(0x18,(([0x10,0x20,0x40,0x30,0x50,0x60,0x70][i%7]))|0xf);
   const pcm=d.renderOffline(32);
   for(const x of pcm){assert.ok(Number.isFinite(x));assert.ok(Math.abs(x)<1);}
   const state=d.getFilterState();
   assert.ok(Number.isFinite(state.lowMemory)&&Number.isFinite(state.bandMemory));
   assert.ok(Math.abs(state.lowMemory)<10&&Math.abs(state.bandMemory)<10);
   assert.ok(state.cutoffHz>0&&state.cutoffHz<11025);
   count+=pcm.length;
  }
  assert.equal(count,10240);
  assert.equal(d.getAudioStats().clockRewinds,0);
  assert.equal(d.getAudioStats().underruns,0);
  d.reset();
  const cleared=d.getFilterState();
  assert.equal(cleared.lowMemory,0);
  assert.equal(cleared.bandMemory,0);
  assert.equal(cleared.cutoff,0);
  assert.equal(cleared.resonance,0);
 }
});
test('4D.1: zero routed input does not bypass state advancement',()=>{
 const d=device();
 d.writeRegister(0,0x40);d.writeRegister(1,0x20);
 d.writeRegister(5,0);d.writeRegister(6,0xf0);d.writeRegister(4,0x21);
 d.writeRegister(0x15,0);d.writeRegister(0x16,32);
 d.writeRegister(0x17,0xf1);d.writeRegister(0x18,0x1f);
 d.renderOffline(2000);
 const before=d.getFilterState();
 assert.notEqual(before.lowMemory,0);
 d.writeRegister(0x17,0xf0); // remove voice 1 from filter
 d.renderOffline(2000);
 const after=d.getFilterState();
 assert.ok(Math.abs(after.lowMemory)<Math.abs(before.lowMemory)+1e-8);
});
