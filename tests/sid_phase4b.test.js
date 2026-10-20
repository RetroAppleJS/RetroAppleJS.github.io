'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const B=require('../tools/SID_AUDIO_BENCH_core.js');
const SAMPLE_RATE=22050,SID_CLOCK=985248,MASK=0xffffff;
function sid(){
 const sandbox=vm.createContext({console,Float32Array,Uint8Array,Int16Array,
    Uint16Array,ArrayBuffer,DataView,Math,Number});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res/EMU_DEVICE_SID_audio.js'),'utf8'),
                 sandbox,{filename:'EMU_DEVICE_SID_audio.js'});
 const device=new sandbox.SIDAudio();
 device.setClock(SID_CLOCK);
 return device;
}
function freq(device,base,n){
 device.writeRegister(base,n&255);device.writeRegister(base+1,(n>>8)&255);
}
function noiseShift(n){
 const feedback=((n>>>22)^(n>>>17))&1;
 return ((n<<1)|feedback)&0x7fffff;
}
test('4B: 24-bit accumulator progression uses integer SID clocks and preserves fraction',()=>{
 const d=sid(),n=377,f=0x4321;
 freq(d,14,f);
 d.writeRegister(18,0x20);
 d.renderOffline(n);
 const cycles=Math.floor(n*SID_CLOCK/SAMPLE_RATE);
 assert.equal(d.getOscillatorState()[2].phase,(f*cycles)&MASK);
 assert.equal(d.readRegister(0x1B),((f*cycles)&MASK)>>>16);
 d.renderOffline(123);
 const total=Math.floor((n+123)*SID_CLOCK/SAMPLE_RATE);
 assert.equal(d.getOscillatorState()[2].phase,(f*total)&MASK);
 assert.equal(d.getAudioStats().sampleRate,22050);
});
test('4B: 23-bit noise is clocked once per rising bit19 edge including multiple edges per PCM',()=>{
 const d=sid(),cycles=Math.floor(188*SID_CLOCK/SAMPLE_RATE),f=0xffff;
 freq(d,14,f);d.writeRegister(18,0x80);
 d.renderOffline(188);
 const crossings=Math.floor((cycles*f+0x80000)/0x100000);
 let expected=0x7ffff8;
 for(let i=0;i<crossings;i++)expected=noiseShift(expected);
 assert.ok(crossings>100,'fixture should exercise multiple bit19 edges per sample');
 assert.equal(d.getOscillatorState()[2].noise,expected);
 const state=d.getOscillatorState();
 state[2].phase=0;state[2].noise=0;
 assert.notEqual(d.getOscillatorState()[2].phase,0,'diagnostics must return detached copies');
});
test('4B: oscillator TEST holds accumulator at zero and seeds noise independently of GATE',()=>{
 const d=sid();freq(d,14,0xffff);
 d.writeRegister(18,0xa8); // NOISE + TEST, gate not set
 d.renderOffline(60);
 assert.equal(d.getOscillatorState()[2].phase,0);
 assert.equal(d.getOscillatorState()[2].noise,0x7ffff8);
 d.writeRegister(18,0xa0);
 d.renderOffline(15);
 assert.ok(d.getOscillatorState()[2].phase>0);
 assert.notEqual(d.getOscillatorState()[2].noise,0x7ffff8);
});
test('4B: hardware-clock MSB rise triggers hard sync, not oscillator wrap',()=>{
 const d=sid(),fTarget=0x1345,fSource=0x6000,frames=401;
 freq(d,0,fTarget);freq(d,14,fSource);
 d.writeRegister(4,0x22);d.writeRegister(18,0x20);
 d.renderOffline(frames);
 const clocks=Math.floor(frames*SID_CLOCK/SAMPLE_RATE);
 let target=0,source=0,resetCount=0;
 for(let tick=0;tick<clocks;tick++){
  const before=source;
  source=(source+fSource)&MASK;
  target=(target+fTarget)&MASK;
  if(!(before&0x800000) && (source&0x800000)){
   target=0;resetCount++;
  }
 }
 assert.ok(resetCount>0);
 const state=d.getOscillatorState();
 assert.equal(state[2].phase,source);
 assert.equal(state[0].phase,target,'sync must account for post-reset fractional frame cycles');
});
test('4B: ring modulation XORs the source MSB without mutating modulator oscillator',()=>{
 function render(ring){
  const d=sid();
  freq(d,0,0x1000);freq(d,14,0x2300);
  d.writeRegister(0x18,0x8f);
  for(const base of [0,14]){
   d.writeRegister(base+5,0x02);d.writeRegister(base+6,0xf0);
  }
  d.writeRegister(18,0x20); // modulator oscillator runs with gate off
  d.writeRegister(4,ring?0x15:0x11);
  return {pcm:d.renderOffline(10000),state:d.getOscillatorState()};
 }
 const a=render(false),b=render(true);
 assert.equal(a.state[2].phase,b.state[2].phase);
 assert.equal(a.state[0].phase,b.state[0].phase);
 assert.notEqual(B.checksum(a.pcm),B.checksum(b.pcm));
 for(const x of b.pcm)assert.ok(Number.isFinite(x));
});
test('4B: combined triangle/saw is a model-specific coupled DAC, not average-of-waves',()=>{
 function render(model,control){
  const d=sid();d.setModel(model);freq(d,0,0x1200);
  d.writeRegister(0x18,0x0f);d.writeRegister(5,0);d.writeRegister(6,0xf0);
  d.writeRegister(4,control);
  return d.renderOffline(8000);
 }
 const tri=render(6581,0x11),saw=render(6581,0x21);
 const both6581=render(6581,0x31),both8580=render(8580,0x31);
 assert.notEqual(B.checksum(both6581),B.checksum(both8580));
 assert.notEqual(B.checksum(tri),B.checksum(both6581));
 assert.notEqual(B.checksum(saw),B.checksum(both6581));
 let meanAbsDiff=0;
 for(let i=0;i<both6581.length;i++){
  meanAbsDiff+=Math.abs(both6581[i]-(tri[i]+saw[i])/2);
  assert.ok(Math.abs(both6581[i])<=1);
 }
 assert.ok(meanAbsDiff/both6581.length>0.005,
    'combined output must differ substantially from simple arithmetic averaging');
});
test('4B: single-wave oscillator DAC stays common to 6581/8580; analog filter remains model-specific',()=>{
 const ctor=sid().constructor;
 const a=B.render(ctor,{fixture:'saw',model:6581,clock:'PAL'});
 const b=B.render(ctor,{fixture:'saw',model:8580,clock:'PAL'});
 assert.equal(B.checksum(a.pcm),B.checksum(b.pcm));
 const c=B.render(ctor,{fixture:'filter',model:6581,clock:'PAL'});
 const d=B.render(ctor,{fixture:'filter',model:8580,clock:'PAL'});
 assert.notEqual(B.checksum(c.pcm),B.checksum(d.pcm));
});
test('4B: reset returns phase, noise and source-state readout to initial values',()=>{
 const d=sid();freq(d,14,0x4567);d.writeRegister(18,0x80);
 d.renderOffline(81);
 assert.notEqual(d.getOscillatorState()[2].phase,0);
 d.reset();
 assert.equal(d.getOscillatorState()[2].phase,0);
 assert.equal(d.getOscillatorState()[2].noise,0x7ffff8);
 assert.equal(d.getAudioStats().sampleRate,22050);
});
