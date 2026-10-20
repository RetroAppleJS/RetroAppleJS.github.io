'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const CAL=require('../tools/SID_FILTER_CALIBRATION_core.js');
const root=path.resolve(__dirname,'..');
function SIDAudio(){
 const context=vm.createContext({console,Math,Number,Uint8Array,Float32Array,
   Int16Array,Uint16Array,ArrayBuffer,DataView});
 vm.runInContext(fs.readFileSync(path.join(root,'res/EMU_DEVICE_SID_audio.js'),'utf8'),
  context,{filename:'EMU_DEVICE_SID_audio.js'});
 return context.SIDAudio;
}
test('4D.2a: calibration survey is distinct from old broadband RMS lab',()=>{
 assert.equal(CAL.SCHEMA,'retroapplejs.sid.filter-calibration.v1');
 assert.equal(CAL.SAMPLE_RATE,22050);
 assert.equal(CAL.SETTLE,2205);
 assert.deepEqual(CAL.FREQUENCIES,[110,220,440,880,1760,3520]);
 assert.deepEqual(CAL.RESONANCES,[0,8,15]);
 assert.deepEqual(CAL.CUTOFFS,[0,64,128,256,384,512,768,1024,1536,2047]);
 assert.equal(CAL.jobs({clock:'PAL',mode:'lp'}).length,360);
 assert.equal(CAL.jobs({clock:'NTSC',mode:'hp'}).length,360);
 assert.throws(()=>CAL.jobs({clock:'invalid',mode:'lp'}),/clock/);
 assert.throws(()=>CAL.jobs({clock:'PAL',mode:'all'}),/LP, BP or HP/);
});
test('4D.2a: Hann lock-in correctly measures amplitude/phase of a known sinusoid',()=>{
 const f=440,pcm=new Float32Array(CAL.SAMPLES);
 for(let n=0;n<pcm.length;n++)pcm[n]=.25*Math.sin(2*Math.PI*f*n/CAL.SAMPLE_RATE+.31);
 const value=CAL.project(pcm,f);
 assert.ok(Math.abs(value.fundamental-.25)<.0001);
 assert.ok(Math.abs(value.dc)<.003);
 assert.equal(value.clippedSamples,0);
 assert.ok(Math.abs(value.peak-.25)<.0001);
});
test('4D.2a: matched bypass uses actual PAL/NTSC SID oscillator registers',()=>{
 const C=SIDAudio();
 const base={model:6581,mode:'lp',hz:880,cutoff:512,resonance:8};
 const pal=CAL.render(C,{...base,clock:'PAL'},true);
 const ntsc=CAL.render(C,{...base,clock:'NTSC'},true);
 assert.equal(pal.register,CAL.hzToRegister(880,CAL.CLOCKS.PAL));
 assert.equal(ntsc.register,CAL.hzToRegister(880,CAL.CLOCKS.NTSC));
 assert.ok(Math.abs(pal.actualHz-880)<.05);
 assert.ok(Math.abs(ntsc.actualHz-880)<.05);
 assert.notEqual(pal.register,ntsc.register);
 assert.equal(pal.pcm.length,CAL.SAMPLES);
 assert.ok(CAL.project(pal.pcm,pal.actualHz).fundamental>.01);
});
test('4D.2a: transfer magnitude and phase deterministic; LP/HP/BP respond distinctly',()=>{
 const C=SIDAudio();
 const cache=Object.create(null);
 for(const model of [6581,8580]){
  const args={model,clock:'PAL',hz:880,resonance:8};
  function x(mode,cutoff){return CAL.measure(C,{...args,mode,cutoff},cache);}
  const lowLp=x('lp',64),highLp=x('lp',2047);
  const lowHp=x('hp',64),highHp=x('hp',2047);
  const middleBp=x('bp',model===6581?512:128),farBp=x('bp',2047);
  assert.ok(highLp.gainDb>lowLp.gainDb+10,model+' LP cutoff trend');
  assert.ok(lowHp.gainDb>highHp.gainDb+10,model+' HP cutoff trend');
  assert.ok(middleBp.gainDb>farBp.gainDb+10,model+' BP resonance');
  for(const point of [lowLp,highLp,lowHp,highHp,middleBp,farBp]){
   assert.ok(Number.isFinite(point.phaseDeg)&&Number.isFinite(point.gainDb));
   assert.ok(point.phaseDeg>=-180&&point.phaseDeg<=180);
   assert.equal(point.clippedSamples,0);
   assert.ok(point.bypassFundamental>.01);
  }
  const dup=x('lp',64);
  assert.equal(dup.gainDb,lowLp.gainDb);
  assert.equal(dup.phaseDeg,lowLp.phaseDeg);
 }
});
test('4D.2a: production filter and bypass remain independent of the calibration laboratory',()=>{
 const C=SIDAudio(),d=new C();d.setModel(6581);d.setClock(CAL.CLOCKS.PAL);
 const before=d.getFilterState();
 CAL.measure(C,{model:6581,clock:'PAL',mode:'lp',hz:880,cutoff:512,resonance:15});
 const after=d.getFilterState();
 assert.deepEqual({...before},{...after},'lab uses new SIDAudio devices');
 const snapshot=fs.readFileSync(path.join(root,'res/EMU_DEVICE_SID_audio.js'),'utf8');
 assert.match(snapshot,/Phase 4D\.1 uses a stable two-integrator TPT/);
});
test('4D.2a: invalid physical measurement claims are not silently accepted',()=>{
 const C=SIDAudio();
 assert.throws(()=>CAL.render(C,{model:6581,clock:'PAL',mode:'lp',
    hz:35000,cutoff:512,resonance:8},false),/Invalid tone/);
 const out=CAL.result({clock:'PAL',mode:'bp'},[]);
 assert.equal(out.referenceStatus,'emulator measurement only; no external physical SID samples loaded');
 assert.match(out.limitations,/not a perfectly pure sine/);
 assert.equal(out.phase,'4D.2a');
 assert.ok(out.referenceSources.every(x=>x.role.includes('not ')));
});
test('4D.2a: reject old or incomplete SID filter engines before collecting data',()=>{
 const C=SIDAudio();
 const proof=CAL.checkEngine(C);
 assert.match(proof.engine,/4D\.1\+ TPT/);
 assert.ok(proof.cutoffHz>0);
 assert.ok(proof.damping>0);
 assert.throws(()=>CAL.checkEngine(function ObsoleteFilter(){}),
   /Incompatible SID audio engine/);
 function FakeTPT(){
  this.getFilterState=()=>({coefficientUpdates:1,damping:1,cutoffHz:40,resonance:0});
  this.writeRegister=()=>{};
 }
 assert.throws(()=>CAL.checkEngine(FakeTPT),/Incompatible SID audio engine/);
 assert.throws(()=>CAL.render(function ObsoleteFilter(){},
     {model:6581,clock:'PAL',mode:'bp',hz:880,cutoff:512,resonance:8},false),
   /Incompatible SID audio engine/);
});
test('4D.2a: standalone UI provides a real survey/export and clear provenance',()=>{
 const html=fs.readFileSync(path.join(root,'tools/SID_FILTER_CALIBRATION.html'),'utf8');
 assert.match(html,/Run frequency survey/);
 assert.match(html,/Export calibration JSON/);
 assert.match(html,/SID_FILTER_CALIBRATION_core.js/);
 assert.match(html,/EMU_DEVICE_SID_audio\.js\?sid-filter=4d2a-tpt-guard1/);
 assert.match(html,/C\.checkEngine\(window\.SIDAudio\)/);
 assert.match(html,/latest\.engineCheck=engineCheck/);
 assert.match(html,/SID_FILTER_BENCH.html/);
 assert.match(html,/does not claim physical SID calibration/i);
 const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
   .map(x=>x[1]).filter(x=>x.trim());
 assert.equal(inline.length,1);
 assert.doesNotThrow(()=>new vm.Script(inline[0]));
});
