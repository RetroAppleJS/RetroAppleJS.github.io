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
test('4B.1: outputs of selected PAL Phase 4B fixtures retain original PCM checksums',()=>{
 // PCM hashes from the accepted Phase 4B Safari benchmark before 4B.1.
 // These are regression guards: 4B.1 must only reduce computational cost.
 const hashes={
  triangle:'785238a0',saw:'434f6450',pulse:'277e1dd7',
  noise:'40362680',ring:'91c67ba0',sync:'2dfefaed',
  'tri-saw':'68b2858d','noise-saw':'4ec4ebda'
 };
 const SIDAudio=sid().constructor;
 for(const fixture of Object.keys(hashes)){
  const out=B.render(SIDAudio,{fixture,model:6581,clock:'PAL'});
  assert.equal(B.checksum(out.pcm),hashes[fixture],
    fixture+' must retain byte-exact Phase 4B PCM');
  assert.equal(out.sampleRate,22050);
  assert.equal(out.stats.dropped,0);
  assert.equal(out.stats.clockRewinds,0);
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
