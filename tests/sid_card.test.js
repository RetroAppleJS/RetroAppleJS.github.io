'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function rig(){
  const sandbox=vm.createContext({
    console,Float32Array,Uint8Array,Int16Array,Math,Number,
    oEMU:{component:{IO:{}}}
  });
  for(const filename of ['EMU_DEVICE_SID_audio.js','EMU_CARD_SID.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res',filename),'utf8'),
                    sandbox,{filename});
  const card=new sandbox.SIDCard(),device=new sandbox.SIDAudio();
  let now=0;
  const io={getClockTicks(){return now;},refreshDeviceHooks(){}};
  card.devices=[device];card.mount={hash:12,slotN:5};
  device.bindHost(card);device.bindIO(io);
  card.restart();
  return {card,device,io,advance(t){now=t;}};
}
function energy(samples){
  let x=0;
  for(const n of samples)x+=n*n;
  return x/samples.length;
}
function configureVoice(card,clock=0x30){
  const t={cpuTick:100};
  for(const [r,v] of [
    [0x18,0x0F],[0x00,0x00],[0x01,clock],
    [0x02,0],[0x03,8],[0x05,0],[0x06,0xF0],[0x04,0x41]
  ])card.observeBusWrite(0xD400+r,v,t);
}

test('SID card is discoverable, has SlotIO and automatically attaches an audio device',()=>{
  const {card,device}=rig();
  assert.equal(card.id.PCODE,'SID');
  assert.equal(card.deviceConfig[0].DCODE,'SIDAUDIO');
  assert.equal(card.deviceConfig[0].autoAttach,true);
  assert.equal(card.action.SlotIO.RD.callback(0xC0D0),0x53);
  assert.equal(device.audioDevice,true);
});
test('SID card and standalone audio device initialize with NTSC selected',()=>{
  const {card,device}=rig();
  assert.equal(card.getClock(),1022727);
  assert.equal(device.getClock(),1022727);
  assert.equal(card.getConfiguration().clockHz,1022727);
  assert.equal(card.readSlotIO(5),1);
  const html=card.deviceToolSlotHTML({toolboxID:'sid_test'});
  assert.match(html,/<option value='1022727' selected>NTSC 1022727 Hz<\/option>/);
  assert.doesNotMatch(html,/<option value='985248' selected>/);
});
test('PAL remains selectable and persists across soft reset',()=>{
  const {card,device}=rig();
  card.setClock(985248);
  assert.equal(device.getClock(),985248);
  assert.equal(card.readSlotIO(5),0);
  assert.match(card.deviceToolSlotHTML({toolboxID:'sid_test'}),/<option value='985248' selected>PAL 985248 Hz<\/option>/);
  card.reset();
  assert.equal(card.getClock(),985248);
  assert.equal(device.getClock(),985248);
  card.writeSlotIO(5,1);
  assert.equal(card.getClock(),1022727);
  assert.equal(device.getClock(),1022727);
});

test('native D400 writes and slot register writes reach the attached synthesizer',()=>{
  const {card,device}=rig();
  assert.equal(card.observeBusWrite(0xD404,0x41,{cpuTick:0}),true);
  assert.equal(card.observeBusWrite(0xD420,0xBB,{cpuTick:0}),false);
  assert.equal(device.getRegisters()[4],0x41);
  card.action.SlotIO.WR.callback(0xC0D2,4);
  card.action.SlotIO.WR.callback(0xC0D3,0x40,{cpuTick:10});
  assert.equal(device.getRegisters()[4],0x40);
  assert.equal(card.getStatistics().slotWrites,1);
  assert.equal(card.getStatistics().snoopWrites,1);
});
test('snooping can be disabled without blocking slot writes',()=>{
  const {card,device}=rig();
  card.setSnoopEnabled(false);
  assert.equal(card.observeBusWrite(0xD400,0x11,{cpuTick:0}),false);
  assert.equal(device.getRegisters()[0],0);
  card.writeSlotIO(2,0);
  card.writeSlotIO(3,0x33);
  assert.equal(device.getRegisters()[0],0x33);
});
test('6581/8580 and PAL/NTSC selections reach the audio synthesizer',()=>{
  const {card,device}=rig();
  assert.equal(card.getModel(),6581);
  card.setModel(8580);card.setClock(1022727);
  assert.equal(device.getModel(),8580);
  assert.equal(device.getClock(),1022727);
  assert.equal(card.readSlotIO(4),1);
  assert.equal(card.readSlotIO(5),1);
  card.writeSlotIO(4,0);card.writeSlotIO(5,0);
  assert.equal(card.getModel(),6581);
  assert.equal(device.getModel(),6581);
  assert.equal(card.getClock(),985248);
  assert.match(card.deviceToolSlotHTML({toolboxID:'sid_test'}),/8580/);
  assert.match(card.deviceToolSlotHTML({toolboxID:'sid_test'}),/Native \$D400 writes/);
});
test('SID audio device produces samples; GATE/square/volume work without a PSID player',()=>{
  const {card,device}=rig();
  const muted=device.renderOffline(256);
  assert.equal(energy(muted),0);
  configureVoice(card);
  const tone=device.renderOffline(1000);
  assert.ok(energy(tone)>0.001);
  card.observeBusWrite(0xD418,0,{cpuTick:100});
  const silent=device.renderOffline(512);
  assert.equal(energy(silent),0);
});
test('readback registers come from device, not write-only shadow',()=>{
  const {card,device}=rig();
  card.observeBusWrite(0xD400,0x12,{cpuTick:0});
  card.writeSlotIO(2,0);
  assert.equal(card.readSlotIO(3),0xFF);
  assert.equal(card.readSlotIO(8),0xFF); // unconnected POTX
  assert.equal(card.readSlotIO(9),0xFF); // unconnected POTY
  assert.equal(typeof card.readSlotIO(10),'number');
  assert.equal(typeof card.readSlotIO(11),'number');
});
test('card soft reset preserves SID model and clock while resetting registers',()=>{
  const {card,device}=rig();
  card.setModel(8580);card.setClock(1022727);
  card.observeBusWrite(0xD418,15,{cpuTick:20});
  card.reset();
  assert.equal(device.getRegisters()[0x18],0);
  assert.equal(card.getModel(),8580);
  assert.equal(card.getClock(),1022727);
});

test('SIDAUDIO owns WebAudio output and schedules nonzero PCM through its own context',async()=>{
  const scheduled=[];
  class FakeAudioContext {
    constructor(){this.currentTime=1;this.state='running';this.destination={};this.sampleRate=48000;}
    createGain(){return {gain:{value:1},connect(){}};}
    createBuffer(channels,length,rate){
      const buffers=Array.from({length:channels},()=>new Float32Array(length));
      return {duration:length/rate,getChannelData:index=>buffers[index]};
    }
    createBufferSource(){
      return {buffer:null,connect(){},disconnect(){},stop(){},
        start(tick){scheduled.push({time:tick,buffer:this.buffer});}};
    }
    resume(){return Promise.resolve();}
    suspend(){this.state='suspended';return Promise.resolve();}
    close(){this.state='closed';return Promise.resolve();}
  }
  const context=vm.createContext({
    console,Float32Array,Uint8Array,AudioContext:FakeAudioContext,
    oEMU:{component:{IO:{}}}
  });
  for(const filename of ['EMU_DEVICE_SID_audio.js','EMU_CARD_SID.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res',filename),'utf8'),
                    context,{filename});
  const card=new context.SIDCard(),device=new context.SIDAudio();
  let tick=0;
  card.devices=[device];
  device.bindHost(card);
  device.bindIO({getClockTicks(){return tick},refreshDeviceHooks(){}});
  card.reset();
  await device.init('audio_on');
  configureVoice(card);
  tick=40000;
  device.cycle();
  assert.equal(scheduled.length,1);
  assert.ok(energy(scheduled[0].buffer.getChannelData(0))>0.001);
  assert.ok(device.getAudioStats().scheduled>0);
  await device.init('audio_off');
  assert.equal(device.getAudioStats().playbackEnabled,false);
});


test('SID scheduler keeps 10 FPS audio continuous by draining more than one block',async()=>{
  const scheduled=[];
  class FakeAudioContext{
    constructor(){this.currentTime=1;this.state='running';this.destination={};}
    createGain(){return {gain:{value:1},connect(){}};}
    createBuffer(channels,length,rate){
      const samples=new Float32Array(length);
      return {duration:length/rate,getChannelData(){return samples;}};
    }
    createBufferSource(){
      return {buffer:null,connect(){},disconnect(){},stop(){},
        start(t){scheduled.push({start:t,end:t+this.buffer.duration,
          length:this.buffer.getChannelData(0).length});}};
    }
    resume(){return Promise.resolve();}
    suspend(){this.state='suspended';return Promise.resolve();}
    close(){return Promise.resolve();}
  }
  const context=vm.createContext({
    console,Float32Array,Uint8Array,AudioContext:FakeAudioContext,
    oEMU:{component:{IO:{}}}
  });
  for(const filename of ['EMU_DEVICE_SID_audio.js','EMU_CARD_SID.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res',filename),'utf8'),
      context,{filename});
  const card=new context.SIDCard(),device=new context.SIDAudio();
  card.devices=[device];
  let cpuTicks=0;
  device.bindHost(card);
  device.bindIO({getClockTicks(){return cpuTicks;},refreshDeviceHooks(){}});
  card.reset();
  await device.init('audio_on');
  configureVoice(card);
  const audio=device.audio;
  for(let frame=1;frame<=20;frame++){
    cpuTicks=Math.round(frame*1021800/10);
    audio.currentTime=1+(frame-1)/10;
    device.cycle();
  }
  const stats=device.getAudioStats();
  assert.ok(scheduled.length>20,'requires multiple WebAudio buffers at 10 FPS');
  assert.ok(stats.blocksScheduled>20);
  assert.equal(stats.dropped,0,'FIFO should not overrun at 10 FPS');
  assert.equal(stats.underruns,0,'continuous 10 FPS playback should not underrun');
  for(let i=1;i<scheduled.length;i++){
    assert.ok(Math.abs(scheduled[i].start-scheduled[i-1].end)<1e-7,
      'buffer gap between '+(i-1)+' and '+i);
  }
  assert.ok(stats.scheduledLeadMs>=0);
  assert.ok(stats.maxQueueDepth>2048);
  await device.init('audio_off');
  assert.equal(device.getAudioStats().queued,0,'audio-off flushes queued buffers');
});


test('SID 6581 release 9 drops early with exponential envelope, rather than lingering linearly',()=>{
  const {device}=rig();
  device.writeRegister(0x05,0x00); // fastest attack / fastest decay
  device.writeRegister(0x06,0xF9); // sustain=15, release=9 (~750 ms)
  device.writeRegister(0x04,0x11); // triangle + GATE
  device.renderOffline(2205); // 100 ms: envelope must have reached 255
  assert.equal(device.getEnvelopeLevels()[0],255);
  device.writeRegister(0x04,0x10); // gate OFF, keep triangle oscillator enabled

  device.renderOffline(2205); // +100 ms
  const after100=device.getEnvelopeLevels()[0];
  assert.ok(after100>=125&&after100<=180,
    'exponential release should fall to ~155/255 by 100 ms, got '+after100);

  device.renderOffline(4410); // +200 ms = 300 ms total
  const after300=device.getEnvelopeLevels()[0];
  assert.ok(after300>=15&&after300<=55,
    'release should be quiet after 300 ms, got '+after300);
  device.renderOffline(11025); // +500 ms
  assert.equal(device.getEnvelopeLevels()[0],0,'release must reach zero by ~800 ms');
});

test('SID GATE retriggers attack from current envelope without abrupt silence',()=>{
  const {device}=rig();
  device.writeRegister(0x05,0x80); // 100 ms attack
  device.writeRegister(0x06,0xF9); // sustain max, release 9
  device.writeRegister(0x04,0x11);
  device.renderOffline(3000); // ~136 ms: reached 255
  assert.equal(device.getEnvelopeLevels()[0],255);
  device.writeRegister(0x04,0x10);
  device.renderOffline(2205);
  const current=device.getEnvelopeLevels()[0];
  assert.ok(current>100&&current<200);
  device.writeRegister(0x04,0x11);
  assert.equal(device.getEnvelopeLevels()[0],current,
    'a note-on does not reset the SID envelope to zero');
  device.renderOffline(441); // 20 ms; a SID rate-counter change may delay attack
  assert.ok(device.getEnvelopeLevels()[0]>=current,
    'retrigger must never clear the current envelope level');
  device.renderOffline(1102); // another 50 ms, long enough for counter wrap
  assert.ok(device.getEnvelopeLevels()[0]>current,
    'attack resumes after the SID rate-counter transition');
});

test('SID sustain changes and oscillator TEST do not instantly overwrite the ADSR envelope',()=>{
  const {device}=rig();
  device.writeRegister(0x05,0x00);
  device.writeRegister(0x06,0xF9);
  device.writeRegister(0x04,0x11);
  device.renderOffline(2205);
  assert.equal(device.getEnvelopeLevels()[0],255);
  device.writeRegister(0x04,0x19); // TEST set, GATE still held
  assert.equal(device.getEnvelopeLevels()[0],255);
  device.renderOffline(1000);
  assert.equal(device.getEnvelopeLevels()[0],255);
  device.writeRegister(0x06,0x89); // reduce sustain from F to 8
  assert.equal(device.getEnvelopeLevels()[0],255,
    'sustain register change should not instantly jump envelope');
  device.renderOffline(1000);
  assert.ok(device.getEnvelopeLevels()[0]<255,
    'lower sustain should start a decay, rather than hard stepping');
  device.reset();
  assert.deepEqual(Array.from(device.getEnvelopeLevels()),[0,0,0]);
});


function sidSchedulerHarness(){
  const scheduled=[];
  class FakeAudioContext{
    constructor(){this.currentTime=0;this.state='running';this.destination={};}
    createGain(){return {gain:{value:1},connect(){}};}
    createBuffer(channels,length,rate){
      return {duration:length/rate,getChannelData(){return new Float32Array(length);}};
    }
    createBufferSource(){
      return {buffer:null,connect(){},disconnect(){},stop(){},
        start(t){scheduled.push({start:t,end:t+this.buffer.duration});}};
    }
    resume(){return Promise.resolve();}
    suspend(){this.state='suspended';return Promise.resolve();}
    close(){return Promise.resolve();}
  }
  const context=vm.createContext({
    console,Float32Array,Uint8Array,AudioContext:FakeAudioContext,
    oEMU:{component:{IO:{}}}
  });
  for(const name of ['EMU_DEVICE_SID_audio.js','EMU_CARD_SID.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res',name),'utf8'),
      context,{filename:name});
  const card=new context.SIDCard(),device=new context.SIDAudio();
  let cpuTicks=0;
  card.devices=[device];
  device.bindHost(card);
  device.bindIO({getClockTicks(){return cpuTicks;},refreshDeviceHooks(){}});
  card.reset();
  return {card,device,scheduled,
    tick(t){cpuTicks=t;},
    frame(n,wallSeconds){cpuTicks=Math.round(n*102180);
      device.audio.currentTime=wallSeconds;device.cycle();}};
}
test('SID startup reserves 125 ms and tolerates a late 10 FPS frame without silence',async()=>{
  const h=sidSchedulerHarness();
  await h.device.init('audio_on');
  for(const [frame,seconds] of [[1,0],[2,.1],[3,.2],[4,.37],[5,.4]])
    h.frame(frame,seconds);
  const stats=h.device.getAudioStats();
  assert.equal(stats.underruns,0);
  assert.equal(stats.dropped,0);
  assert.equal(stats.clearedSamples,0);
  assert.ok(Math.abs(h.scheduled[0].start-.125)<1e-6,
    'even AudioContext time zero must use the initial buffer lead');
  for(let i=1;i<h.scheduled.length;i++)
    assert.ok(Math.abs(h.scheduled[i].start-h.scheduled[i-1].end)<1e-6,
      '50–70 ms late processing wake must not create inter-buffer silence');
  assert.ok(stats.minPreScheduleLeadMs>0);
  await h.device.init('audio_off');
});
test('SID ignores tiny CPU instruction clock reversals but counts genuine queue invalidation',async()=>{
  const h=sidSchedulerHarness();
  await h.device.init('audio_on');
  h.device.advanceTo(102180);
  const queued=h.device.getAudioStats().queued;
  assert.ok(queued>2000);
  h.device.advanceTo(102175); // 5 CPU ticks (~5 µs) behind SID bus timestamp
  let stats=h.device.getAudioStats();
  assert.equal(stats.queued,queued,'micro-rollback cannot destroy pending audio');
  assert.equal(stats.clearedSamples,0);
  assert.equal(stats.smallClockBacksteps,1);
  assert.equal(stats.maxClockBackstepTicks,5);
  assert.equal(stats.clockRewinds,0);

  h.device.advanceTo(500); // real epoch rewind
  stats=h.device.getAudioStats();
  assert.equal(stats.queued,0);
  assert.equal(stats.clockRewinds,1);
  assert.equal(stats.clearedSamples,queued);
  assert.equal(stats.queueClears,1);
  const types=h.device.getAudioEvents().map(x=>x.type);
  assert.ok(types.includes('clock_rewind'));
  assert.ok(types.includes('queue_flush'));
  await h.device.init('audio_off');
});
test('SID underrun recovery starts promptly and records precise deadline evidence',async()=>{
  const h=sidSchedulerHarness();
  await h.device.init('audio_on');
  for(const [frame,seconds] of [[1,0],[2,.1],[3,.2],[4,.55]])
    h.frame(frame,seconds);
  const stats=h.device.getAudioStats(),events=h.device.getAudioEvents();
  assert.equal(stats.underruns,1,'unavoidable long stall must be counted');
  assert.ok(stats.lastLateMs>120&&stats.lastLateMs<130);
  assert.equal(events.filter(e=>e.type==='underrun').length,1);
  assert.equal(events.at(-1).cpuTick,Math.round(4*102180));
  const prev=h.scheduled[h.scheduled.length-3];
  const next=h.scheduled[h.scheduled.length-2];
  assert.ok(stats.preScheduleLeadMs<-120);
  assert.ok(Math.abs(next.start-.558)<1e-6,
    'recovery uses short 8 ms lead, not a second 125 ms silence');
  const before=h.device.getAudioStats().queued;
  h.device.resetAudioTelemetry();
  assert.equal(h.device.getAudioStats().queued,before,
    'clearing telemetry must not flush audio');
  assert.equal(h.device.getAudioEvents().length,0);
  await h.device.init('audio_off');
});


test('SID card offers a latched 16-bit CPU clock through the two unused slot data indexes',()=>{
  const {card,device}=rig();
  const before=Array.from(device.getRegisters());
  card.writeSlotIO(0xC0D2,0x1E);
  assert.equal(card.readSlotIO(0xC0D3,{cpuTick:0x12AB}),0xAB);
  card.writeSlotIO(0xC0D2,0x1F);
  assert.equal(card.readSlotIO(0xC0D3,{cpuTick:0xBEEE}),0x12,
    'high byte must belong to the same latched sample, not a later CPU tick');
  card.writeSlotIO(0xC0D2,0x1E);
  assert.equal(card.readSlotIO(0xC0D3,{cpuTick:0xAB00,bRO:true}),0x00);
  card.writeSlotIO(0xC0D2,0x1F);
  assert.equal(card.readSlotIO(0xC0D3,{cpuTick:0xAB00}),0x12,
    'debugger safe-read must not update the clock latch');
  assert.deepEqual(Array.from(device.getRegisters()),before);
});

test('SID realtime audio services each 10ms of CPU ticks without display-frame batching',async()=>{
  for(const fps of [10,60]){
    const h=sidSchedulerHarness();
    await h.device.init('audio_on');
    assert.equal(h.device.getRealtimeAudioQuantumTicks(),10218);
    let serviceTick=0;
    for(let step=1;step<=200;step++){
      // Every 10ms, independent of whether display updates at 10 or 60 FPS.
      serviceTick=step*10218;
      h.tick(serviceTick);
      h.device.audio.currentTime=step*.01;
      const granted=h.device.getCpuSliceBudget(10218);
      assert.ok(granted>0&&granted<=10218);
      h.device.serviceRealtimeAudio();
      if(step%(fps===10?10:2)===0)h.device.cycle();
    }
    const t=h.device.getAudioStats();
    assert.equal(t.underruns,0);
    assert.equal(t.dropped,0);
    assert.ok(t.realtimeServices>=200);
    assert.ok(t.maxQueueDepth<=250,
      '10ms service should not accumulate entire 100ms frame bursts; peak='+t.maxQueueDepth);
    assert.ok(t.cpuBudgetChecks>=200);
    assert.ok(t.scheduledLeadMs>80 && t.scheduledLeadMs<175);
    await h.device.init('audio_off');
  }
});

test('SID FIFO overflow logs an onset event with CPU tick and audio state',async()=>{
  const h=sidSchedulerHarness();
  await h.device.init('audio_on');
  // Drive the producer without output service, simulating an old long CPU batch
  // or a very high turbo setting; this intentionally bypasses pacing.
  h.tick(1021800);
  h.device.advanceTo(1021800);
  const t=h.device.getAudioStats();
  assert.ok(t.dropped>10000);
  assert.equal(t.overflowIncidents,1);
  assert.equal(t.overflowLastCpuTick,1021800);
  assert.ok(h.device.getAudioEvents().some(e=>
    e.type==='fifo_overflow' && e.cpuTick===1021800 &&
    e.queuedFrames===8192 && e.capacityFrames===8192));
  // Force queued + already scheduled audio above the 500ms producer bound.
  h.device.serviceRealtimeAudio();
  h.tick(2043600);
  h.device.advanceTo(2043600);
  assert.equal(h.device.getCpuSliceBudget(10218),0,
    'CPU producer should stop when scheduled plus pending PCM is excessive');
  h.device.serviceRealtimeAudio();
  h.device.audio.currentTime+=.40;
  assert.ok(h.device.getCpuSliceBudget(10218)>0,
    'CPU can resume when browser audio clock catches up');
  await h.device.init('audio_off');
});
