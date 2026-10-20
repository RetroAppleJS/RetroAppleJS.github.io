'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const B=require('../tools/SID_AUDIO_BENCH_core.js');
const ROOT=path.resolve(__dirname,'..');
function ctor(){
 const c=vm.createContext({console,Math,Number,Uint8Array,Float32Array,
    Int16Array,ArrayBuffer,DataView});
 vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_DEVICE_SID_audio.js'),'utf8'),c,
                 {filename:'EMU_DEVICE_SID_audio.js'});
 return c.SIDAudio;
}
test('4A: suite defines original SID stimuli and fixed 22.05 kHz/2 s budget',()=>{
 assert.equal(B.RATE,22050);
 assert.equal(B.COUNT,44100);
 assert.ok(B.FIXTURES.length>=9);
 const ids=B.FIXTURES.map(x=>x.id);
 for(const item of ['triangle','saw','pulse','noise','pwm','adsr','ring','sync','filter','volume'])
  assert.ok(ids.includes(item));
});
test('4A: deterministic register events preserve order, range and quantized CPU ticks',()=>{
 for(const clock of ['PAL','NTSC']){
  for(const fixture of B.FIXTURES){
   const ev=B.createEvents(fixture.id,B.CLOCKS[clock]);
   assert.ok(ev.length>3,fixture.id);
   assert.deepEqual(ev.slice().sort((a,b)=>a.sample-b.sample),ev);
   for(const e of ev){
    assert.ok(e.sample>=0&&e.sample<B.COUNT);
    assert.ok(e.reg>=0&&e.reg<=31);
    assert.ok(e.value>=0&&e.value<=255);
    assert.equal(e.cpuTick,Math.round(e.sample*B.CLOCKS[clock]/B.RATE));
   }
  }
 }
 const adsr=B.createEvents('adsr',B.CLOCKS.PAL);
 assert.ok(adsr.some(e=>e.sample===22050&&e.reg===4&&e.value===0x20));
 const pwm=B.createEvents('pwm',B.CLOCKS.PAL);
 assert.equal(pwm.filter(e=>e.reg===3).length,8);
 const fsweep=B.createEvents('filter',B.CLOCKS.PAL);
 assert.equal(fsweep.filter(e=>e.reg===0x16).length,8);
});
test('4A: original device renders deterministic 6581 and 8580 audio without audio contexts',()=>{
 const SIDAudio=ctor();
 const x=B.render(SIDAudio,{fixture:'saw',model:6581,clock:'PAL'});
 const y=B.render(SIDAudio,{fixture:'saw',model:6581,clock:'PAL'});
 assert.equal(x.pcm.length,44100);
 assert.equal(x.stats.sampleRate,22050);
 assert.equal(x.stats.produced,44100);
 assert.equal(x.stats.offlineSamples,44100);
 assert.equal(x.stats.dropped,0);
 assert.equal(x.stats.underruns,0);
 assert.equal(x.stats.contextState,'uninitialized');
 assert.equal(B.checksum(x.pcm),B.checksum(y.pcm));
 const a=B.analyze(x.pcm);
 assert.ok(a.rms>0&&a.rms<1);
 assert.ok(a.peak>0&&a.peak<=1);
 assert.ok(a.dominantHz>0);
 assert.equal(a.spectrum.length,1023);
});
test('4A: filter fixture creates distinct 6581 vs 8580 spectral baselines',()=>{
 const SIDAudio=ctor();
 const a=B.render(SIDAudio,{fixture:'filter',model:6581});
 const b=B.render(SIDAudio,{fixture:'filter',model:8580});
 assert.notEqual(B.checksum(a.pcm),B.checksum(b.pcm));
 const fa=B.analyze(a.pcm),fb=B.analyze(b.pcm);
 assert.ok(fa.rms>0&&fb.rms>0);
 assert.ok(Math.abs(fa.rms-fb.rms)>1e-7||
   Math.abs(fa.spectralCentroidHz-fb.spectralCentroidHz)>0,
   'model-specific filter must cause measurable changes');
});
test('4A: median performance excludes FFT and repeated renders match exactly',()=>{
 const result=B.bench(ctor(),{fixture:'triangle',model:8580,clock:'NTSC',repetitions:3});
 assert.equal(result.performance.elapsedMs.length,3);
 assert.equal(result.analysis.sampleRate,22050);
 assert.ok(result.performance.medianMs>=0);
 assert.ok(result.performance.synthesisSamplesPerSecond>0);
 assert.equal(result.rendererStats.produced,44100);
 assert.equal(result.rendererStats.offlineSamples,44100);
 const report=B.report(result);
 assert.ok(!Object.hasOwn(report,'pcm'));
 assert.ok(!Object.hasOwn(report.analysis,'spectrum'));
 assert.equal(report.analysis.fnvFloat32,result.analysis.fnvFloat32);
 assert.deepEqual(report.eventSequence,result.eventSequence);
});
test('4A: FFT baseline locates known 440 Hz synthetic tone',()=>{
 const pcm=new Float32Array(44100);
 for(let i=0;i<pcm.length;i++)pcm[i]=.5*Math.sin(2*Math.PI*440*i/22050);
 const a=B.analyze(pcm);
 assert.ok(Math.abs(a.dominantHz-440)<11, String(a.dominantHz));
 assert.ok(Math.abs(a.rms-(.5/Math.sqrt(2)))<.005);
 assert.ok(Math.abs(a.dc)<.001);
 assert.ok(a.energyAbove5kHzRatio<0.001);
 assert.equal(a.clippedSamples,0);
});
test('4A: generated WAV round-trips 22050 PCM and rejects mismatched reference rate',()=>{
 const original=new Float32Array(3000);
 for(let i=0;i<original.length;i++)original[i]=.6*Math.sin(2*Math.PI*i/64);
 const wav=B.wav(original);
 const decoded=B.readWav(wav);
 assert.equal(decoded.pcm.length,3000);
 assert.equal(decoded.channels,1);
 assert.equal(decoded.sampleRate,22050);
 for(let i=0;i<original.length;i++)
  assert.ok(Math.abs(decoded.pcm[i]-original[i])<.00006);
 const invalid=wav.slice(0);
 new DataView(invalid).setUint32(24,44100,true);
 assert.throws(()=>B.readWav(invalid),/22050/);
 assert.throws(()=>B.readWav(new Uint8Array(12).buffer),/WAV/);
});
test('4A: HTML loads the production synthesizer and shared core, without external CDNs',()=>{
 const html=fs.readFileSync(path.join(ROOT,'tools/SID_AUDIO_BENCH.html'),'utf8');
 assert.match(html,/<script src="\.\.\/res\/EMU_DEVICE_SID_audio\.js"><\/script>/);
 assert.match(html,/<script src="SID_AUDIO_BENCH_core\.js"><\/script>/);
 assert.doesNotMatch(html,/https?:\/\/[^"' ]+\.js/);
 assert.match(html,/Run entire suite/);
 assert.match(html,/Export results JSON/);
 assert.match(html,/SID Audio Reference &amp; Performance Bench v3/);
 assert.match(html,/Audio Bench v3/);
 assert.match(html,/schema:B\.SCHEMA/);
 assert.match(html,/benchmarkVersion:B\.VERSION/);
 assert.match(html,/sid-audio-bench-v3-results\.json/);
 assert.doesNotMatch(html,/retroapplejs\.sid\.phase4a\.v1/);
 assert.doesNotMatch(html,/sid-phase4a-results\.json/);
 const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(x=>x[1]).filter(s=>s.trim());
 assert.equal(inline.length,1);
 assert.doesNotThrow(()=>new vm.Script(inline[0]));
});

test('SID Audio Bench v3: phase-neutral export identifies original 4A and newer 4B suites',()=>{
 assert.equal(B.VERSION,3);
 assert.equal(B.SCHEMA,'retroapplejs.sid.audio-bench.v3');
 assert.equal(B.FIXTURES.length,23);
 for(const fixture of B.FIXTURES.slice(0,10))
  assert.equal(B.fixtureSuite(fixture.id),'4A');
 for(const fixture of B.FIXTURES.slice(10,15))
  assert.equal(B.fixtureSuite(fixture.id),'4B');
 for(const fixture of B.FIXTURES.slice(15))
  assert.equal(B.fixtureSuite(fixture.id),'4C');
 assert.throws(()=>B.fixtureSuite('unknown'),/Unknown fixture/);
 // Historical v1/v2 files are still comparable: each old run's
 // fields are unchanged; only the extra fixtureSuite metadata is added.
 const fake={fixture:'tri-saw',model:6581,clock:'PAL',
  sidClock:985248,events:1,eventSequence:[],analysis:{spectrum:[],rms:.1},
  performance:{medianMs:1},rendererStats:{}};
 const report=B.report(fake);
 assert.equal(report.fixtureSuite,'4B');
 assert.equal(report.fixture,'tri-saw');
 assert.equal(report.analysis.rms,.1);
 assert.ok(!Object.hasOwn(report.analysis,'spectrum'));
 assert.equal(B.report({...fake,fixture:'saw'}).fixtureSuite,'4A');
});
