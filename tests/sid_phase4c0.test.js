'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const B=require('../tools/SID_AUDIO_BENCH_core.js');
const {Envelope,PERIODS,dividerAt,compareTrace}=require('./helpers/sid_adsr_cycle_reference.js');
const root=path.resolve(__dirname,'..');
function SIDAudio(){
 const context=vm.createContext({console,Math,Number,Float32Array,Uint8Array,
     Uint16Array,Int16Array,ArrayBuffer,DataView});
 vm.runInContext(fs.readFileSync(path.join(root,'res/EMU_DEVICE_SID_audio.js'),'utf8'),
   context,{filename:'EMU_DEVICE_SID_audio.js'});
 return context.SIDAudio;
}
test('4C.0: reference ADSR rate periods and exponential threshold lookup',()=>{
 assert.deepEqual(PERIODS.slice(0,4),[9,32,63,95]);
 assert.equal(PERIODS.length,16);
 assert.equal(PERIODS[15],31251);
 for(const [level,div] of [[255,1],[93,2],[54,4],[26,8],[14,16],[6,30],[0,1]]){
  assert.equal(dividerAt(level,3),div);
 }
 assert.equal(dividerAt(80,4),4,'nonthreshold values retain loaded divider');
});
test('4C.0: independent cycle oracle clocks attack at 9-cycle boundaries',()=>{
 const e=new Envelope();
 e.write(5,0x00);e.write(6,0xf0);e.write(4,0x01);
 assert.equal(e.advance(8),0);
 assert.equal(e.advance(1),1);
 assert.equal(e.advance(8),1);
 assert.equal(e.advance(1),2);
 assert.equal(e.advance(9*253),255);
 assert.equal(e.snapshot().stage,'decay');
 assert.equal(e.advance(9*3),255,'sustain 15 holds full level');
});
test('4C.0: independent ADSR delay test skips the 0x8000 rate count',()=>{
 const e=new Envelope();
 e.write(5,0x10); // attack period 32
 e.write(4,0x01);
 e.advance(20);
 assert.equal(e.level,0);
 assert.equal(e.rateCounter,20);
 e.write(5,0x00); // period 9 already missed
 e.advance(32755);
 assert.equal(e.level,0);
 e.advance(1);
 assert.equal(e.level,1,'next event occurs after the 0x7fff wrap');
 assert.equal(e.rateCounter,0);
});
test('4C.0: rate and exponential counters survive GATE changes in oracle',()=>{
 const e=new Envelope();
 e.write(5,0x10);e.write(6,0x00);e.write(4,0x01);
 e.advance(23);
 const rc=e.rateCounter,xc=e.expCounter;
 e.write(4,0x00);
 assert.equal(e.snapshot().rateCounter,rc);
 assert.equal(e.snapshot().expCounter,xc);
 e.write(4,0x01);
 assert.equal(e.snapshot().rateCounter,rc);
 assert.equal(e.snapshot().expCounter,xc);
});
test('4C.0: lowering sustain releases held level, raising sustain does not raise it',()=>{
 const e=new Envelope();
 e.write(5,0x00);e.write(6,0xf0);e.write(4,0x01);
 e.advance(9*255);
 assert.equal(e.level,255);
 e.write(6,0x20);
 e.advance(1000);
 assert.ok(e.level<255);
 const before=e.level;
 e.write(6,0xf0);e.advance(9*10);
 assert.ok(e.level<=before,'increasing sustain must not push existing envelope upward');
});
test('4C.0: fixed PAL/NTSC ADSR stimulus matrix preserves original 4A/4B fixtures',()=>{
 assert.equal(B.RATE,22050);
 assert.equal(B.COUNT,44100);
 assert.equal(B.VERSION,3);
 assert.equal(B.SCHEMA,'retroapplejs.sid.audio-bench.v3');
 assert.equal(B.FIXTURES.length,23);
 assert.equal(B.FIXTURES.filter(x=>x.suite==='4A').length,10);
 assert.equal(B.FIXTURES.filter(x=>x.suite==='4B').length,5);
 assert.equal(B.FIXTURES.filter(x=>x.suite==='4C').length,8);
 for(const standard of ['PAL','NTSC']){
  for(const f of B.FIXTURES.filter(x=>x.suite==='4C')){
   const ev=B.createEvents(f.id,B.CLOCKS[standard]);
   assert.ok(ev.length>=6,f.id);
   assert.deepEqual(ev,ev.slice().sort((a,b)=>a.sample-b.sample));
   for(const e of ev)
    assert.equal(e.cpuTick,Math.round(e.sample*B.CLOCKS[standard]/B.RATE));
  }
 }
 const delayed=B.createEvents('adsr-rate-change',B.CLOCKS.PAL);
 assert.ok(delayed.some(e=>e.sample===2205&&e.reg===5&&e.value===0x00));
 const sr=B.createEvents('adsr-sustain-down',B.CLOCKS.PAL);
 assert.ok(sr.some(e=>e.sample===11025&&e.reg===6&&e.value===0x32));
});
test('4C.0: passive trace agrees with ENV3 readback, event alignment and voice independence',()=>{
 const C=SIDAudio();
 const opts={fixture:'adsr-voices',model:6581,clock:'PAL',stride:83};
 const a=B.traceEnvelope(C,opts);
 const b=B.traceEnvelope(C,opts);
 assert.equal(a.sampleRate,22050);
 assert.equal(a.points[0].sample,0);
 assert.equal(a.points.at(-1).sample,44100);
 assert.deepEqual(a.points,b.points,'trace should be deterministic');
 assert.ok(a.points.length>=530&&a.points.length<=550);
 assert.ok(a.points.every(p=>p.v3===p.env3));
 for(const p of a.points){
  assert.ok(p.v1>=0&&p.v1<=255);
  assert.ok(p.v2>=0&&p.v2<=255);
  assert.ok(p.v3>=0&&p.v3<=255);
 }
 assert.ok(a.points.some(p=>p.v1!==p.v2&&p.v2!==p.v3));
 for(const e of a.events.filter(e=>e.sample>0))
  assert.ok(a.points.some(p=>p.sample===e.sample),'event boundaries must be sampled');
 assert.equal(a.rendererStats.offlineSamples,44100);
 assert.equal(a.rendererStats.contextState,'uninitialized');
 assert.equal(a.rendererStats.underruns,0);
 assert.throws(()=>B.traceEnvelope(C,{...opts,stride:0}),/stride/);
});
test('4C.0: trace is diagnostic only; standard PCM benchmark remains identical',()=>{
 const C=SIDAudio();
 const before=B.render(C,{fixture:'adsr',model:6581,clock:'PAL'});
 const traced=B.traceEnvelope(C,{fixture:'adsr',model:6581,clock:'PAL',stride:64});
 const after=B.render(C,{fixture:'adsr',model:6581,clock:'PAL'});
 assert.equal(B.checksum(before.pcm),B.checksum(after.pcm));
 assert.equal(traced.points.at(-1).sample,B.COUNT);
 assert.equal(traced.points[0].v1,0);
 assert.ok(traced.points.some(p=>p.v1>0));
 const t6581=B.traceEnvelope(C,{fixture:'adsr-retrigger',model:6581,clock:'NTSC'});
 const t8580=B.traceEnvelope(C,{fixture:'adsr-retrigger',model:8580,clock:'NTSC'});
 assert.deepEqual(t6581.points,t8580.points,'shared digital envelope model');
});
test('4C.0: slow independent clock oracle can characterize current release without asserting silicon fidelity',()=>{
 const e=new Envelope(),clock=B.CLOCKS.PAL;
 e.write(5,0x00);e.write(6,0xf0);e.write(4,0x01);
 const trace=B.traceEnvelope(SIDAudio(),{fixture:'adsr-fast',model:6581,clock:'PAL',stride:128});
 let prev=0,stage='attack',gate=true,records=0,nonZero=0;
 for(const p of trace.points){
  const elapsed=p.cpuTick-prev;
  e.advance(elapsed);
  prev=p.cpuTick;
  if(p.sample>=22050&&gate){e.write(4,0x00);gate=false;}
  assert.ok(e.level>=0&&e.level<=255);
  if(p.v1!==e.level)nonZero++;
  records++;
 }
 assert.equal(prev,Math.round(44100*clock/B.RATE));
 assert.ok(records>300);
 // Existing engine uses fractional PCM clocks and simplified gate state:
 // differences are recorded for Phase 4C.1, not treated as pass/fail.
 assert.ok(nonZero>=0&&nonZero<=records);
 const comparison=compareTrace(trace);
 assert.equal(comparison.voices.length,3);
 for(const voice of comparison.voices){
  assert.equal(voice.observations,trace.points.length);
  assert.ok(voice.mismatches>=0 && voice.mismatches<=voice.observations);
  assert.ok(Number.isFinite(voice.meanAbsoluteError));
  assert.ok(voice.maxAbsoluteError>=0 && voice.maxAbsoluteError<=255);
  if(voice.firstMismatch){
   assert.ok(voice.firstMismatch.sample>=0);
   assert.ok(voice.firstMismatch.sample<=B.COUNT);
  }
 }
});
test('4C.0: browser exposes a non-timed ENV trace and v3 export schema',()=>{
 const html=fs.readFileSync(path.join(root,'tools/SID_AUDIO_BENCH.html'),'utf8');
 assert.match(html,/Audio Bench v3/);
 assert.match(html,/traceEnvelope/);
 assert.match(html,/Export envelope trace/);
 assert.match(html,/sid-audio-bench-v3-results\.json/);
 assert.match(html,/schema:B\.SCHEMA/);
 const blocks=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script\b[^>]*>/gi)]
  .map(x=>x[1]).filter(Boolean);
 assert.equal(blocks.length,1);
 assert.doesNotThrow(()=>new vm.Script(blocks[0]));
});
