'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

class FakeAudioContext {
  constructor(opts){ this.opts=opts; this.currentTime=1; this.state='running'; this.destination={}; this.sources=[]; }
  createGain(){ return {gain:{value:1},connect(){},disconnect(){}}; }
  createBuffer(channels,length,sampleRate){ const data=Array.from({length:channels},()=>new Float32Array(length)); return {numberOfChannels:channels,length,sampleRate,duration:length/sampleRate,getChannelData(i){return data[i];},_data:data}; }
  createBufferSource(){ const ctx=this; const src={buffer:null,playbackRate:{value:1},started:null,stopped:false,disconnected:false,connect(){},disconnect(){this.disconnected=true;},start(t){this.started=t;},stop(){this.stopped=true;},onended:null}; ctx.sources.push(src); return src; }
  async resume(){ this.state='running'; }
  async suspend(){ this.state='suspended'; }
}

function load(){ const ctx={console,AudioContext:FakeAudioContext,_o:{CPU_ClocksTicks_s:1021800,CPU_TargetTicks_s:1021800}}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res','EMU_DEVICE_mockingboard_audio.js'),'utf8'),ctx); return ctx; }
function owner(){ let consumer=false, refreshCb=null; const qL=[.1,.2,.3], qR=[.4,.5,.6]; return {id:{PCODE:'MOCK'},advanced:[],clears:0,realtime:false,setTimingRefreshCallback(fn){refreshCb=fn;},fireTiming(){if(refreshCb)refreshCb();},needsRealtimeTick(){return this.realtime;},advanceTo(t){this.advanced.push(t);},getAudioFormat(){return {sampleRate:44100,channels:2,format:'float32'};},setAudioConsumerActive(v){consumer=!!v;},consumer(){return consumer;},getAudioFramesAvailable(){return qL.length;},drainAudioFrames(n){const c=Math.min(n,qL.length); return {frames:c,left:Float32Array.from(qL.splice(0,c)),right:Float32Array.from(qR.splice(0,c))};},clearAudioQueue(){this.clears++; qL.length=qR.length=0;}}; }

test('bind/lifecycle hooks keep exact-timer sync separate from host audio',async()=>{
  const ctx=load(), dev=new ctx.MockingboardAudio(), good=owner(); let ticks=12, refresh=0; const io={getClockTicks(){return ticks;}}; dev._ioRefreshHooks=()=>refresh++;
  assert.equal(dev.bindHost({id:{PCODE:'OTHER'}}),false); assert.equal(dev.bindHost(good),true); dev.bindIO(io);
  assert.equal(dev.isTickActive(),false); good.realtime=true; assert.equal(dev.isTickActive(),true); dev.tick(); assert.deepEqual(good.advanced,[12]);
  good.fireTiming(); assert.equal(refresh,1);
  await dev.init('audio_on'); assert.equal(good.consumer(),true); assert.equal(dev.isCycleActive(),true); assert.ok(refresh>=2);
  await dev.init('audio_off'); assert.equal(good.consumer(),false); assert.equal(dev.isCycleActive(),false);
});

test('cycle synchronizes to emulated tick then drains already-produced stereo frames',async()=>{
  const ctx=load(), dev=new ctx.MockingboardAudio(), good=owner(); let ticks=25; const io={getClockTicks(){return ticks;}}; dev.bindHost(good); dev.bindIO(io); await dev.init('audio_on');
  const ac=dev.audio; ac.currentTime=2; // host time must only schedule playback
  // Refill after audio_on intentionally clears stale queue.
  good.getAudioFramesAvailable=()=>3;
  good.drainAudioFrames=(n)=>({frames:3,left:Float32Array.from([.1,.2,.3]),right:Float32Array.from([.4,.5,.6])});
  dev.cycle();
  assert.equal(good.advanced.at(-1),25); assert.equal(ac.sources.length,1); assert.equal(ac.sources[0].buffer.numberOfChannels,2); assert.equal(ac.sources[0].started,2.03);
  assert.deepEqual(Array.from(ac.sources[0].buffer.getChannelData(0)),Array.from(Float32Array.from([.1,.2,.3])));
  assert.deepEqual(Array.from(ac.sources[0].buffer.getChannelData(1)),Array.from(Float32Array.from([.4,.5,.6])));
  assert.equal(dev.getStats().framesScheduled,3);
});

test('host underrun reschedules queue lead without inventing emulated samples',async()=>{
  const ctx=load(), dev=new ctx.MockingboardAudio(), good=owner(); const io={getClockTicks(){return 7;}}; dev.bindHost(good); dev.bindIO(io); await dev.init('audio_on'); const ac=dev.audio;
  good.getAudioFramesAvailable=()=>1; good.drainAudioFrames=()=>({frames:1,left:Float32Array.of(.1),right:Float32Array.of(.2)});
  ac.currentTime=5; dev.cycle();
  assert.equal(dev.getStats().underruns,1); assert.equal(ac.sources[0].started,5.03); assert.deepEqual(good.advanced,[7]);
});

test('reset and unmount stop sources, clear transport queue, and retain AudioContext',async()=>{
  const ctx=load(), dev=new ctx.MockingboardAudio(), good=owner(); const io={getClockTicks(){return 1;}}; dev.bindHost(good); dev.bindIO(io); await dev.init('audio_on'); const ac=dev.audio;
  good.getAudioFramesAvailable=()=>1; good.drainAudioFrames=()=>({frames:1,left:Float32Array.of(.1),right:Float32Array.of(.2)}); dev.cycle(); const src=ac.sources[0];
  dev.reset(); assert.equal(dev.audio,ac); assert.equal(src.stopped,true); assert.equal(src.disconnected,true); assert.ok(good.clears>=2);
  await dev.init('audio_on'); dev.onUnmount(); assert.equal(good.consumer(),false); assert.equal(dev.isCycleActive(),false); assert.equal(dev.audio,ac);
});

test('tick refreshes Apple2IO hooks when one-shot timer no longer needs exact ticking',()=>{
    const ctx=load();
    let realtime=true, refreshes=0, advances=0;
    const owner={id:{PCODE:'MOCK'},needsRealtimeTick(){return realtime;},advanceTo(){advances++; realtime=false;},setTimingRefreshCallback(){},getAudioFormat(){return {sampleRate:44100};}};
    const io={getClockTicks(){return 77;}};
    const dev=new ctx.MockingboardAudio(); dev._ioRefreshHooks=()=>{refreshes++;};
    dev.bindHost(owner); dev.bindIO(io);
    assert.equal(dev.isTickActive(),true);
    dev.tick();
    assert.equal(advances,1);
    assert.equal(dev.isTickActive(),false);
    assert.equal(refreshes,1);
});

test('cycle bounds scheduled lead and leaves excess PCM in the peripheral FIFO',async()=>{
  const ctx=load(), dev=new ctx.MockingboardAudio();
  const available=5000;
  let requested=0;
  const good={
    id:{PCODE:'MOCK'},
    setTimingRefreshCallback(){},
    needsRealtimeTick(){return false;},
    advanceTo(){},
    getAudioFormat(){return {sampleRate:44100,channels:2,format:'float32'};},
    setAudioConsumerActive(){},
    clearAudioQueue(){},
    getAudioFramesAvailable(){return available;},
    drainAudioFrames(n){
      requested=n;
      return {frames:n,left:new Float32Array(n),right:new Float32Array(n)};
    }
  };
  const io={getClockTicks(){return 100;}};
  dev.bindHost(good); dev.bindIO(io); await dev.init('audio_on');
  dev.cycle();
  assert.ok(requested>1320 && requested<=1323);
  assert.equal(dev.getStats().framesScheduled,requested);
});

test('CPU speed leaves browser playback rate and PCM duration fixed',async()=>{
  const ctx=load(), dev=new ctx.MockingboardAudio();
  const good={
    id:{PCODE:'MOCK'},
    setTimingRefreshCallback(){},
    needsRealtimeTick(){return false;},
    advanceTo(){},
    getAudioFormat(){return {sampleRate:44100,channels:2,format:'float32'};},
    setAudioConsumerActive(){},
    clearAudioQueue(){},
    getAudioFramesAvailable(){return 0;},
    drainAudioFrames(){return {frames:0,left:new Float32Array(0),right:new Float32Array(0)};}
  };
  const io={getClockTicks(){return 100;}};
  dev.bindHost(good); dev.bindIO(io); await dev.init('audio_on');
  const ac=dev.audio;

  function block(frames)
  {
    good.getAudioFramesAvailable=()=>frames;
    good.drainAudioFrames=(n)=>({
      frames:n,
      left:new Float32Array(n),
      right:new Float32Array(n)
    });
  }

  ac.currentTime=2;
  ctx._o.CPU_TargetTicks_s=ctx._o.CPU_ClocksTicks_s;
  block(441);
  dev.cycle();
  assert.equal(ac.sources[0].playbackRate.value,1);
  assert.ok(Math.abs(dev.getStats().queuedLead_ms-40)<0.001);

  ac.currentTime=2.01;
  ctx._o.CPU_TargetTicks_s=ctx._o.CPU_ClocksTicks_s*4;
  block(441);
  dev.cycle();
  assert.equal(ac.sources[1].playbackRate.value,1);
  assert.ok(Math.abs(dev.getStats().queuedLead_ms-40)<0.001);

  ac.currentTime=2.02;
  ctx._o.CPU_TargetTicks_s=ctx._o.CPU_ClocksTicks_s;
  block(441);
  dev.cycle();
  assert.equal(ac.sources[2].playbackRate.value,1);
  assert.ok(Math.abs(dev.getStats().queuedLead_ms-40)<0.001);
});

test('scheduled host audio is bounded by the high watermark and reduces CPU slice budget',async()=>{
  const ctx=load(),dev=new ctx.MockingboardAudio(),good=owner();
  dev.bindHost(good);dev.bindIO({getClockTicks(){return 0;}});await dev.init('audio_on');
  let remaining=20000,requested=0;
  good.getAudioFramesAvailable=()=>remaining;
  good.drainAudioFrames=n=>{requested=n;remaining-=n;return {frames:n,left:new Float32Array(n),right:new Float32Array(n)};};
  dev.cycle();
  assert.ok(requested<=1323,'30ms initial lead plus at most 30ms PCM');
  assert.ok(dev.getStats().queuedLead_ms<=60.001);
  assert.ok(dev.getCpuSliceBudget(1000)<24,'Only the sub-frame remainder remains');
});

test('explicit presentation pause stops nodes at positive CPU speed and suppresses step audio',async()=>{const ctx=load(),dev=new ctx.MockingboardAudio(),good=owner();dev.bindHost(good);dev.bindIO({getClockTicks(){return 77;}});await dev.init('audio_on');good.getAudioFramesAvailable=()=>100;good.drainAudioFrames=n=>({frames:n,left:new Float32Array(n),right:new Float32Array(n)});dev.cycle();const source=dev.audio.sources[0];assert.ok(dev.setPresentationPaused);dev.setPresentationPaused(true);assert.equal(source.stopped,true);assert.equal(good.consumer(),false);dev.cycle();assert.equal(dev.audio.sources.length,1);dev.setPresentationPaused(false);assert.equal(good.consumer(),true);});

test('pending browser permission keeps CPU unpaced and unmount cancels activation',async()=>{const ctx=load(),dev=new ctx.MockingboardAudio(),good=owner();dev.bindHost(good);dev.bindIO({getClockTicks(){return 0;}});await dev.init('audio_ctx');let resume;dev.audio.state='suspended';dev.audio.resume=()=>new Promise(resolve=>{resume=resolve;});const pending=dev.init('audio_on');assert.equal(dev.isCycleActive(),false);assert.equal(good.consumer(),false);assert.equal(dev.getCpuSliceBudget(100000),100000);dev.onUnmount();resume();await pending;assert.equal(dev.isCycleActive(),false);assert.equal(good.consumer(),false);});
