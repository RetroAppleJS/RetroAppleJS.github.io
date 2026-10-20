'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const F=require('../tools/SID_FILTER_BENCH_core.js');
const root=path.resolve(__dirname,'..');
const BASELINE=require('./fixtures/sid_phase4d0_baseline.json');
function SIDAudio(){
 const c=vm.createContext({console,Math,Number,Uint8Array,Float32Array,
   Int16Array,Uint16Array,ArrayBuffer,DataView});
 vm.runInContext(fs.readFileSync(path.join(root,'res/EMU_DEVICE_SID_audio.js'),'utf8'),c,
   {filename:'EMU_DEVICE_SID_audio.js'});
 return c.SIDAudio;
}
test('4D.0: filter measurements use correct register, clock and PCM ranges',()=>{
 assert.equal(F.SCHEMA,'retroapplejs.sid.filter-lab.v1');
 assert.equal(F.RATE,22050);assert.equal(F.LENGTH,11025);
 assert.equal(F.SETTLE,2205);
 assert.equal(F.CUTOFFS[0],0);assert.equal(F.CUTOFFS.at(-1),2047);
 assert.ok(F.CUTOFFS.every((x,i)=>x>=0&&x<=2047&&(!i||x>F.CUTOFFS[i-1])));
 assert.deepEqual(F.RESONANCES,[0,4,8,12,15]);
 assert.equal(F.CLOCKS.PAL,985248);assert.equal(F.CLOCKS.NTSC,1022727);
 assert.equal(Object.keys(F.MODES).length,8);
});
test('4D.0: pre-4D filter fingerprints remain immutable historical evidence',()=>{
 assert.equal(BASELINE.clock,'PAL');
 assert.deepEqual(BASELINE.cases.map(x=>x.hash),[
   'cd098be6','dba99996','097b82ca','148c8352','35758215'
 ]);
 assert.deepEqual(BASELINE.cases.map(x=>x.clippedSamples),[0,0,0,2112,0]);
 assert.equal(BASELINE.knownBaselineDefects.resonanceInert,true);
 assert.equal(BASELINE.knownBaselineDefects.filteredVoice3MutedWhenVoice3Off,true);
 const C=SIDAudio();
 assert.ok(BASELINE.cases.some(f=>F.capture(C,f.options).hash!==f.hash),
    'corrected 4D.1 filter must not reproduce all pre-4D filter PCM');
});
test('4D.0: reference routing matrix exposes BOTH known filter deficiencies',()=>{
 const C=SIDAudio();
 for(const model of [6581,8580]){
  const d=F.diagnostics(C,{model,clock:'PAL',toneHz:880});
  const e=d.observations;
  assert.ok(d.direct.analysis.acRms>0.01);
  assert.ok(d.filtered.analysis.acRms>0.01);
  assert.ok(d.filteredVoice3.analysis.acRms>0.01);
  assert.equal(e.filterPathDisabledWhenNoMode,true);
  assert.equal(e.voice3OffMutesDirect,true);
  assert.equal(e.voice3OffCurrentlyMutesFiltered,false,
    'filtered Voice 3 survives V3OFF');
  assert.equal(e.resonanceCurrentlyInert,false,
    'resonance must change filtered PCM');
  assert.equal(d.filteredVoice3.hash,d.filteredVoice3Off.hash,
    'V3OFF has no effect on filtered Voice 3');
  assert.notEqual(d.direct.hash,d.filtered.hash);
 }
});
test('4D.0: reproducible PAL/NTSC and 6581/8580 filter responses',()=>{
 const C=SIDAudio();
 const common={mode:'lp',cutoff:512,resonance:8,toneHz:880};
 const a=F.capture(C,{...common,model:6581,clock:'PAL'});
 const b=F.capture(C,{...common,model:6581,clock:'PAL'});
 const c=F.capture(C,{...common,model:8580,clock:'PAL'});
 const d=F.capture(C,{...common,model:6581,clock:'NTSC'});
 assert.equal(a.hash,b.hash);
 assert.notEqual(a.hash,c.hash,'baseline filter models have different cutoff curves');
 assert.notEqual(a.hash,d.hash,'clock-frequency dependent oscillator stimulus');
 for(const x of [a,b,c,d]){
  assert.ok(x.analysis.acRms>0);
  assert.equal(x.analysis.clippedSamples,0);
  assert.ok(x.analysis.peak<=1);
 }
});
test('4D.0: sweep measures 5 resonance curves x 12 cutoff points for BOTH models',()=>{
 const C=SIDAudio();
 const s=F.survey(C,{clock:'PAL',mode:'bp',toneHz:880});
 assert.equal(s.schema,F.SCHEMA);
 assert.equal(s.models.length,2);
 assert.equal(s.points.length,120);
 for(const model of [6581,8580]){
  const pts=s.points.filter(p=>p.model===model);
  assert.equal(pts.length,60);
  const baseline=s.models.find(m=>m.model===model);
  assert.ok(baseline.bypass>0);
  for(const r of F.RESONANCES){
   const curve=pts.filter(p=>p.resonance===r);
   assert.equal(curve.length,12);
   assert.deepEqual(curve.map(p=>p.cutoff),F.CUTOFFS);
   assert.ok(curve.every(p=>Number.isFinite(p.acRms)&&Number.isFinite(p.gainDb)));
   assert.ok(curve.every(p=>Number.isInteger(p.clippedSamples)&&
    p.clippedSamples>=0&&p.clippedSamples<=F.LENGTH-F.SETTLE));
  }
 }
 const comparable=s.points.filter(p=>p.model===6581&&p.cutoff===512);
 assert.equal(new Set(comparable.map(p=>p.hash)).size,F.RESONANCES.length,
    'corrected 4D.1 resonance must produce different outputs');
 assert.equal(s.points.filter(p=>p.clippedSamples>0).length,0,
    'single-voice steady-state band-pass must not reproduce old saturation');
});
test('4D.0: combined filter modes are measurable and stable',()=>{
 const C=SIDAudio();
 for(const mode of Object.keys(F.MODES)){
  const x=F.capture(C,{model:8580,mode,route:mode!=='off',
   cutoff:1024,resonance:7});
  assert.ok(Number.isFinite(x.analysis.acRms));
  assert.ok(Number.isInteger(x.analysis.clippedSamples));
  assert.ok(x.analysis.clippedSamples>=0&&
    x.analysis.clippedSamples<=F.LENGTH-F.SETTLE);
 }
});
test('4D.0: invalid test parameters rejected before any rendering',()=>{
 const C=SIDAudio();
 for(const options of [
   {model:6582},{clock:'bad'},{toneHz:6000},{toneHz:0.5},
   {cutoff:-1},{cutoff:2048},{resonance:16},{mode:'not-a-mode'},
   {voice:1}
 ]){
  assert.throws(()=>F.capture(C,options));
 }
 assert.throws(()=>F.survey(C,{mode:'off'}),/active filter/);
});
test('4D.0: browser laboratory is standalone, dependency-free, and syntax-valid',()=>{
 const html=fs.readFileSync(path.join(root,'tools/SID_FILTER_BENCH.html'),'utf8');
 assert.match(html,/<script src="\.\.\/res\/EMU_DEVICE_SID_audio\.js"><\/script>/);
 assert.match(html,/<script src="SID_FILTER_BENCH_core\.js"><\/script>/);
 assert.match(html,/Run filter survey/);
 assert.match(html,/Export filter JSON/);
 assert.match(html,/Voice 3/);
 assert.doesNotMatch(html,/https?:\/\/[^"' ]+\.js/);
 const blocks=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script\b[^>]*>/gi)]
  .map(x=>x[1]).filter(x=>x.trim());
 assert.equal(blocks.length,1);
 assert.doesNotThrow(()=>new vm.Script(blocks[0]));
});
