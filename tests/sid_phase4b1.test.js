'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const B=require('../tools/SID_AUDIO_BENCH_core.js');
const root=path.resolve(__dirname,'..');
function sid(){
 const context=vm.createContext({Math,Number,Float32Array,Uint8Array,
   Uint16Array,Int16Array,ArrayBuffer,DataView,console});
 vm.runInContext(fs.readFileSync(
   path.join(root,'res/EMU_DEVICE_SID_audio.js'),'utf8'),context);
 const device=new context.SIDAudio();
 device.setClock(985248);
 return device;
}
function frequency(device,base,value){
 device.writeRegister(base,value&255);
 device.writeRegister(base+1,value>>>8);
}
function shiftNoise(n,steps){
 while(steps-->0){
  const feedback=((n>>>22)^(n>>>17))&1;
  n=((n<<1)|feedback)&0x7fffff;
 }
 return n;
}
test('4B.1: frozen digital oscillator states survive intentional ADSR fixes',()=>{
 // Captured from the accepted Phase 4B.1 engine; unlike whole-PCM
 // checksums, these tests do not include the envelope multiplier.
 const originals={
  triangle:[[3807054,31,17],[16280192,1959799,17]],
  saw:[[3807054,31,33],[16280192,1959799,33]],
  pulse:[[3807054,31,65],[16280192,1959799,65]],
  noise:[[7619603,7864383,129],[976448,3213810,129]],
  ring:[[3807054,31,21],[16280192,1959799,21]],
  sync:[[9398714,31,35],[11998438,3045953,35]],
  'tri-saw':[[3807054,31,49],[16280192,1959799,49]],
  'noise-saw':[[3807054,31,161],[16280192,1959799,161]]
 };
 const modulator={
  ring:[[15440950,8126464,33],[612480,4953011,33]],
  sync:[[15440950,8126464,33],[612480,4953011,33]]
 };
 function snapshot(d,voice){
  const v=d.getOscillatorState()[voice];
  return [v.phase,v.noise,v.control];
 }
 for(const [fixture,expected]of Object.entries(originals)){
  const d=sid();
  for(const e of B.createEvents(fixture,B.CLOCKS.PAL))
   if(e.sample===0)d.writeRegister(e.reg,e.value);
  d.renderOffline(123);
  assert.deepEqual(snapshot(d,0),expected[0],fixture+' early oscillator');
  if(modulator[fixture])
   assert.deepEqual(snapshot(d,2),modulator[fixture][0],fixture+' early modulator');
  d.renderOffline(44100-123);
  assert.deepEqual(snapshot(d,0),expected[1],fixture+' final oscillator');
  if(modulator[fixture])
   assert.deepEqual(snapshot(d,2),modulator[fixture][1],fixture+' final modulator');
  assert.equal(d.getAudioStats().dropped,0);
  assert.equal(d.getAudioStats().clockRewinds,0);
 }
});
test('4B.1: idle voices do not change phase or noise, but active invisible noise keeps clocking',()=>{
 const d=sid();
 frequency(d,0,0x3456);
 // No waveform selected, but the oscillator must still advance the
 // internal noise state for a later switch into NOISE.
 const n=1499;
 d.renderOffline(n);
 const ticks=Math.floor(n*985248/22050);
 const increment=0x3456*ticks;
 const edges=Math.floor((increment+0x80000)/0x100000);
 const v=d.getOscillatorState();
 assert.equal(v[0].phase,increment&0xffffff);
 assert.equal(v[0].noise,shiftNoise(0x7ffff8,edges));
 for(const i of [1,2]){
  assert.equal(v[i].phase,0);
  assert.equal(v[i].noise,0x7ffff8);
 }
});
test('4B.1: maximal-frequency noise crosses several bit19 edges per output sample',()=>{
 const d=sid();
 frequency(d,14,0xffff);d.writeRegister(18,0x80);
 d.renderOffline(123);
 const ticks=Math.floor(123*985248/22050);
 const total=ticks*0xffff,edges=Math.floor((total+0x80000)/0x100000);
 assert.ok(edges>123/3);
 assert.equal(d.getOscillatorState()[2].noise,shiftNoise(0x7ffff8,edges));
 assert.equal(d.getOscillatorState()[2].phase,total&0xffffff);
});
test('4B.1: TEST disables advancement in fast path and preserves reset state',()=>{
 const d=sid();
 frequency(d,0,0xffff);
 d.writeRegister(4,0x28);
 d.renderOffline(100);
 assert.equal(d.getOscillatorState()[0].phase,0);
 assert.equal(d.getOscillatorState()[0].noise,0x7ffff8);
 d.writeRegister(4,0x20);
 d.renderOffline(100);
 assert.notEqual(d.getOscillatorState()[0].phase,0);
 assert.notEqual(d.getOscillatorState()[0].noise,0x7ffff8);
});
