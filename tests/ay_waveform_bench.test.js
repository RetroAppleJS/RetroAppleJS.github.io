'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const B=require('../tools/AY_WAVEFORM_BENCH_core.js');

test('metadata and fixed 22,050 Hz economy baseline',()=>{
 assert.equal(B.SCHEMA,'retroapplejs.ay.waveform-bench.v1.3');
 assert.equal(B.RATE,22050);assert.equal(B.FIXTURES.length,12);
});
test('12-bit tone periods are correctly rounded and clamped',()=>{
 const p=B.nearestPeriod(1021800,440,16,4095);
 assert.equal(p.period,145);assert.ok(Math.abs(p.errorCents)<3);
 assert.equal(B.nearestPeriod(1021800,10000,16,4095).period,6);
});
test('audio-rate AY envelopes follow corrected period dividers',()=>{
 const s=B.generate({fixture:'saw-down',hz:440});
 assert.equal(s.pitch.period,9);assert.equal(s.pitch.clamped,false);
 assert.ok(Math.abs(s.pitch.actualHz-443.4895833333333)<.001);
 const t=B.generate({fixture:'triangle',hz:440});
 assert.equal(t.pitch.period,5);assert.ok(Math.abs(t.pitch.actualHz-399.140625)<.00001);
 assert.ok(t.events.some(e=>e.reg===13&&e.value===0x0a));
});
test('mixer settings and envelope retriggers encode correct register writes',()=>{
 const cases=[['square',0x3e],['saw-up',0x3f],['triangle',0x3f],['buzzer',0x3e],['noise',0x37],['tone-noise',0x36],['detune',0x3c]];
 for(const [fixture,mixer] of cases){
   const s=B.generate({fixture});
   const writes=s.events.filter(e=>e.chip===0&&e.reg===7);
   assert.equal(writes.at(-1).value,mixer,fixture);
 }
 const saw=B.generate({fixture:'saw-up'});
 assert.ok(saw.events.some(e=>e.chip===0&&e.reg===13&&e.value===0x0c));
 assert.ok(B.generate({fixture:'buzzer'}).events.some(e=>e.chip===0&&e.reg===13&&e.value===0x08));
});
test('two-chip layering uses separate envelope on AY1, all timestamps sorted',()=>{
 const s=B.generate({fixture:'two-chip',hz:110});
 assert.ok(s.events.some(e=>e.chip===0&&e.reg===8&&e.value===13));
 assert.ok(s.events.some(e=>e.chip===1&&e.reg===8&&e.value===0x10));
 assert.ok(s.events.some(e=>e.chip===1&&e.reg===13&&e.value===8));
 for(let i=1;i<s.events.length;i++)assert.ok(s.events[i].tick>=s.events[i-1].tick);
});
test('WAV output is valid 16-bit PCM mono',()=>{
 const out=B.wav(new Float32Array([0,1,-1,0.5]),22050),d=new DataView(out);
 assert.equal(out.byteLength,52);assert.equal(d.getUint32(24,true),22050);
 assert.equal(d.getInt16(44+2,true),32767);assert.equal(d.getInt16(44+4,true),-32768);
});
test('FFT finds 440Hz and rejects silence',()=>{
 const x=Float32Array.from({length:22050},(_,i)=>.5*Math.sin(2*Math.PI*440*i/22050));
 assert.ok(Math.abs(B.spectrum(x,22050).dominantHz-440)<3);
 assert.equal(B.spectrum(new Float32Array(22050),22050).dominantHz,0);
});
test('renderUntil honors timebase/block-size, ordered events, and destroys core',async()=>{
 const calls=[];let destroyed=false;
 const api={create:async(opts)=>{
   assert.equal(opts.sampleRate,22050);assert.equal(opts.renderProfile,'economy');
   let tick=0,frames=0;
   return {backend:'js',configureChip:(c,opts)=>calls.push(['config',c]),setMix:(c,w)=>calls.push(['mix',c,w]),
     renderUntil:(end,batch,out)=>{
       for(let i=0;i<batch.count;i++){let k=B!==null?i*16:0;assert.ok(batch.data[k+8]<=1);}
       let expected=Math.floor(end*22050/1e9)-frames;
       assert.ok(expected>=0&&expected<=2048);out.left.fill(.1,0,expected);out.right.fill(.1,0,expected);
       calls.push(['render',end,batch.count]);tick=end;frames+=expected;return expected;
     },destroy:()=>{destroyed=true;}};
 },packEvent:(view,i,tick,chip,op,reg,val)=>{
   const p=i*16;view.setUint32(p,tick>>>0,true);view.setUint32(p+4,Math.floor(tick/4294967296),true);
   view.setUint8(p+8,chip);view.setUint8(p+9,op);view.setUint8(p+10,reg);view.setUint8(p+11,val);
 }};
 const r=await B.render(api,{fixture:'two-chip',duration:1});
 assert.equal(r.pcm.length,22050);assert.equal(r.metrics.sampleCount,22050);
 assert.ok(calls.filter(c=>c[0]==='render').length>=11);assert.equal(destroyed,true);
});

test('Phase 1.1: calibrated envelope tuning and harmonic metrics',()=>{
 const saw=B.describe('saw-down',110,1021800,1);
 assert.equal(saw.period,36);assert.ok(Math.abs(saw.actualHz-110.8724)<.01);
 const tri=B.describe('triangle',110,1021800,1);
 assert.equal(tri.period,18);assert.ok(Math.abs(tri.actualHz-110.8724)<.01);
 const x=Float32Array.from({length:22050},(_,i)=>.4*Math.sin(2*Math.PI*440*i/22050)+.2*Math.sin(2*Math.PI*880*i/22050));
 const m=B.pcmMetrics(x,440);
 assert.ok(Math.abs(m.fundamentalHz-440)<.001);
 assert.ok(m.thdPercent>40&&m.thdPercent<60);
 assert.ok(m.harmonicDb.length>=3);
 assert.notEqual(m.fundamentalDb,null);
});


test('Phase 1.2: ideal harmonic families and analytic waveforms',()=>{
 assert.equal(B.idealHarmonic('square',2),0);
 assert.equal(B.idealHarmonic('square',3),1/3);
 assert.equal(B.idealHarmonic('saw',2),.5);
 assert.equal(B.idealHarmonic('triangle',3),1/9);
 assert.equal(B.idealHarmonic('triangle',4),0);
 assert.equal(B.idealWaveform('square',.25),1);
 assert.equal(B.idealWaveform('square',.75),-1);
 assert.equal(B.idealWaveform('saw',0),1);
 assert.equal(B.idealWaveform('triangle',.5),1);
});

function harmonicSynth(type,hz=110,rate=22050,seconds=.5){
 const pcm=new Float32Array(Math.round(rate*seconds));
 for(let i=0;i<pcm.length;i++){
   for(let h=1;h<=32 && h*hz<rate/2;h++){
     const mag=B.idealHarmonic(type,h);
     if(mag)pcm[i]+=.15*mag*Math.sin(2*Math.PI*h*hz*i/rate);
   }
 }
 return pcm;
}

test('Phase 1.2: pitch-matched square, saw and triangle each match their own reference',()=>{
 for(const [ideal,fixture] of [['square','square'],['saw','saw-down'],['triangle','triangle']]){
   const pcm=harmonicSynth(ideal);
   const m=B.pcmMetrics(pcm,110,{fixture,reference:'auto'});
   assert.ok(m.comparison.eligible);
   assert.equal(m.comparison.reference,ideal);
   assert.equal(m.comparison.bestReference,ideal);
   assert.ok(m.comparison.shapeScore>98);
   assert.ok(m.comparison.shapeErrorDb<1);
   assert.ok(m.comparison.cosineSimilarity>99);
   assert.equal(m.comparison.harmonics.length,32);
   assert.ok(m.comparison.analysisWindowSamples>4000);
 }
});

test('Phase 1.2: unlike reference is penalized without changing actual pitch',()=>{
 const pcm=harmonicSynth('saw');
 const auto=B.pcmMetrics(pcm,110,{fixture:'saw-down',reference:'auto'});
 const wrong=B.pcmMetrics(pcm,110,{fixture:'saw-down',reference:'triangle'});
 assert.equal(wrong.comparison.reference,'triangle');
 assert.equal(wrong.comparison.bestReference,'saw');
 assert.ok(auto.comparison.shapeScore>98);
 assert.ok(wrong.comparison.shapeScore<30);
 assert.equal(auto.fundamentalHz,wrong.fundamentalHz);
 assert.equal(auto.dominantHz,wrong.dominantHz);
});

test('Phase 1.2: composite/noise fixtures explicitly omit single-oscillator harmonic metrics',()=>{
 for(const fixture of ['buzzer','noise','tone-noise','detune','two-chip']){
   const m=B.pcmMetrics(harmonicSynth('square'),110,{fixture,reference:'square'});
   assert.equal(m.comparison.eligible,false,fixture);
   assert.equal(m.comparison.status,'not-applicable',fixture);
   assert.ok(m.comparison.reason.length>10,fixture);
   assert.equal(m.thdPercent,null,fixture);
   assert.equal(m.fundamentalHz,null,fixture);
   assert.deepEqual(m.harmonicDb,[],fixture);
   assert.ok(Number.isFinite(m.centroidHz),fixture);
   assert.ok(Number.isFinite(m.dominantHz),fixture);
 }
});

test('Phase 1.2: survey export retains matches, basis frequency and null policy',()=>{
 const spec=B.generate({fixture:'triangle',hz:110,reference:'square'});
 assert.equal(spec.referencePreference,'square');
 const m=B.pcmMetrics(harmonicSynth('triangle'),spec.pitch.actualHz,
  {fixture:'triangle',reference:spec.referencePreference});
 const rpt=B.report({rate:B.RATE,backend:'js',renderMs:2,spec:spec,metrics:m});
 assert.equal(rpt.schema,B.SCHEMA);
 assert.equal(rpt.spec.referencePreference,'square');
 assert.equal(rpt.metrics.comparison.reference,'square');
 assert.equal(rpt.metrics.comparison.matches.length,3);
 assert.equal(rpt.metrics.comparison.frequencyBasisHz,spec.pitch.actualHz);
 assert.ok(rpt.metrics.comparison.harmonics[0].idealDb===0);
 const mixed=B.pcmMetrics(harmonicSynth('square'),110,{fixture:'two-chip'});
 const mrpt=B.report({rate:B.RATE,backend:'js',renderMs:1,spec:B.generate({fixture:'two-chip',hz:110}),metrics:mixed});
 assert.equal(mrpt.metrics.comparison.status,'not-applicable');
 assert.equal(mrpt.metrics.thdPercent,null);
});

test('Phase 1.2: empty audio does not fabricate a valid comparison',()=>{
 const m=B.pcmMetrics(new Float32Array(11025),110,{fixture:'square'});
 assert.equal(m.comparison.eligible,false);
 assert.equal(m.comparison.status,'unmeasurable');
 assert.equal(m.thdPercent,null);
 assert.equal(m.dominantHz,0);
});


test('Phase 1.3: both AY envelope triangle polarities keep correct period but distinct shape',()=>{
  const base=B.generate({fixture:'triangle',hz:220});
  const inv=B.generate({fixture:'triangle-invert',hz:220});
  assert.equal(base.pitch.period,9);assert.equal(inv.pitch.period,9);
  assert.equal(base.events.find(e=>e.reg===13).value,10);
  assert.equal(inv.events.find(e=>e.reg===13).value,14);
  assert.equal(B.referenceFor('triangle-invert'),'triangle');
});

test('Phase 1.3: software triangles schedule exactly 32 volume writes per cycle',()=>{
  const a=B.generate({fixture:'triangle-dac-raw',hz:100,duration:.5,volume:15});
  const writes=a.events.filter(e=>e.chip===0&&e.reg===8);
  assert.equal(writes.length,1601); // initial mute + 32*50 samples
  assert.equal(a.pitch.actualHz,100);
  assert.equal(a.pitch.period,null);
  assert.equal(a.softwareVolumeWritesPerSecond,3200);
  assert.equal(writes[1].value,0);
  assert.equal(writes[9].value,8);
  assert.equal(writes[17].value,15);
  assert.equal(writes.at(-1).value,1);
  assert.equal(writes[2].tick,312500);
  assert.ok(a.events.every((e,i)=>i===0||e.tick>=a.events[i-1].tick));
});

test('Phase 1.3: inverted volume curve compensates exponential AY output',()=>{
  const curve=Array.from({length:16},(_,v)=>v===0?0:Math.pow(v/15,2));
  const raw=B.generate({fixture:'triangle-dac-raw',hz:55,duration:.5,volume:15});
  const fixed=B.generate({fixture:'triangle-dac',hz:55,duration:.5,volume:15,volumeCurve:curve});
  const r=raw.events.filter(e=>e.chip===0&&e.reg===8).slice(1,33).map(e=>e.value);
  const f=fixed.events.filter(e=>e.chip===0&&e.reg===8).slice(1,33).map(e=>e.value);
  assert.equal(r[0],0);assert.equal(f[0],0);
  assert.equal(r[16],15);assert.equal(f[16],15);
  assert.ok(f[8]>r[8]); // square-law DAC: midpoint needs a larger register value
  assert.equal(f[8],11);
  assert.equal(f[24],f[8]);
  assert.equal(fixed.calibrationSource,'measured AYCore tone RMS');
  assert.equal(B.referenceFor('triangle-dac'),'triangle');
  assert.throws(()=>B.generate({fixture:'triangle-dac',volumeCurve:[0,1]}),/calibration/);
});

test('Phase 1.3: high-rate software volume writes are bounded',()=>{
 assert.throws(()=>B.generate({fixture:'triangle-dac',hz:1000,duration:2}),/48,000/);
 const spec=B.generate({fixture:'triangle-dac-raw',hz:440,duration:.5});
 assert.equal(spec.softwareVolumeWritesPerSecond,14080);
 assert.equal(spec.events.filter(e=>e.chip===0&&e.reg===8).length,7041);
});

test('Phase 1.3: buzzer phase sweep correctly shifts retrigger (not tone)',()=>{
 const a=B.generate({fixture:'buzzer',hz:110,duration:1,phaseOffset:.25});
 const b=B.generate({fixture:'buzzer',hz:110,duration:1,phaseOffset:0});
 assert.equal(a.events.find(e=>e.chip===0&&e.reg===0).tick,0);
 assert.equal(b.events.find(e=>e.chip===0&&e.reg===13).tick,0);
 assert.equal(a.events.find(e=>e.chip===0&&e.reg===13).tick,Math.round(.25/a.pitch.actualHz*1e9));
 assert.equal(a.events.filter(e=>e.chip===0&&e.reg===8).at(-1).tick,a.events.find(e=>e.chip===0&&e.reg===13).tick);
 assert.throws(()=>B.generate({fixture:'buzzer',phaseOffset:1}),/phase offset/);
});

test('Phase 1.3: phase sweep prepares 8 phases for each of 4 tones',()=>{
 const jobs=B.phaseSweepJobs({clock:1021800,backend:'wasm'});
 assert.equal(jobs.length,32);
 assert.deepEqual([...new Set(jobs.map(j=>j.hz))],[55,110,220,440]);
 assert.deepEqual(jobs.slice(0,8).map(j=>j.phaseOffset),[0,.125,.25,.375,.5,.625,.75,.875]);
 assert.equal(jobs.at(-1).duration,1);
 assert.ok(jobs.every(j=>j.backend==='wasm'&&j.fixture==='buzzer'));
});

test('Phase 1.3: spectral fingerprint separates a sine and deterministic noisy texture',()=>{
 const rate=22050;
 const sine=Float32Array.from({length:rate},(_,i)=>.5*Math.sin(2*Math.PI*440*i/rate));
 let seed=1234;const noise=Float32Array.from({length:rate},()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return (seed/4294967296-.5)*.7;});
 const sa=B.pcmMetrics(sine,440,{fixture:'square'}).fingerprint;
 const nb=B.pcmMetrics(noise,null,{fixture:'noise'}).fingerprint;
 assert.ok(sa.spectralFlatness<.01);
 assert.ok(nb.spectralFlatness>.1);
 assert.ok(sa.highBandEnergyPercent<1);
 assert.ok(nb.highBandEnergyPercent>30);
 assert.ok(nb.rolloff85Hz>5000);
 assert.ok(sa.strongestPeaks.length>=1);
});

test('Phase 1.3: mock AYCore render includes phase drift and fingerprint in export',async()=>{
 let frames=0;
 const api={create:async()=>{
   frames=0;return {backend:'js',configureChip:()=>{},setMix:()=>{},
     renderUntil:(end,batch,out)=>{
       const expected=Math.floor(end*B.RATE/1e9)-frames;
       out.left.fill(.07,0,expected);out.right.fill(.07,0,expected);frames+=expected;return expected;
     },destroy:()=>{}};
   },packEvent:()=>{}};
 const r=await B.render(api,{fixture:'buzzer',hz:55,duration:.5,phaseOffset:.125});
 assert.equal(r.spec.phaseOffset,.125);
 assert.ok(r.interaction.relativeFrequencyHz<0);
 assert.ok(r.interaction.relativePhaseDriftCycles<0);
 assert.ok(Number.isFinite(r.metrics.fingerprint.rolloff85Hz));
 const rep=B.report(r);
 assert.equal(rep.interaction.phaseOffsetCycles,.125);
 assert.ok(rep.metrics.fingerprint.spectralFlatness<.001); // DC-only mock spectrum is nearly flatness-free
});

test('Phase 1.3: calibrated curve is cached per backend + clock',async()=>{
 let created=0;
 const api={create:async()=>{
   created++;let frames=0;return {backend:'js',configureChip:()=>{},setMix:()=>{},
     renderUntil:(end,batch,out)=>{
       const expected=Math.floor(end*B.RATE/1e9)-frames;
       for(let i=0;i<expected;i++){out.left[i]=.05*Math.sin(2*Math.PI*220*(frames+i)/B.RATE);out.right[i]=out.left[i];}
       frames+=expected;return expected;
     },destroy:()=>{}};
   },packEvent:()=>{}};
 const o={backend:'js',clock:1030000};
 const curve=await B.calibrateVolumeCurve(api,o);
 assert.equal(curve.length,16);
 assert.equal(curve[0],0);
 assert.equal(curve[15],1);
 assert.equal(created,15);
 const curve2=await B.calibrateVolumeCurve(api,o);
 assert.deepEqual(curve2,curve);
 assert.equal(created,15);
 const r=await B.render(api,{fixture:'triangle-dac',hz:110,duration:.2,...o});
 assert.equal(r.interaction.softwareVolumeWritesPerSecond,3520);
 assert.equal(created,16);
 assert.equal(r.spec.calibrationSource,'measured AYCore tone RMS');
});
