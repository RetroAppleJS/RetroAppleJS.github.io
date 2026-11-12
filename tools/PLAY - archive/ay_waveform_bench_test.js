'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const B=require('../tools/AY_WAVEFORM_BENCH_core.js');

test('metadata and fixed 22,050 Hz economy baseline',()=>{
 assert.equal(B.SCHEMA,'retroapplejs.ay.waveform-bench.v1.1');
 assert.equal(B.RATE,22050);assert.equal(B.FIXTURES.length,9);
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
