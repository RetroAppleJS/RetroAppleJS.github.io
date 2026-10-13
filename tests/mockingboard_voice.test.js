'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const voicePath=path.join(__dirname,'../res/EMU_DEVICE_mockingboard_voice.js');
function rig(){
  const context=vm.createContext({console,TextEncoder,TextDecoder,atob,btoa,setTimeout,clearTimeout,
    oEMU:{component:{IO:{}}},_o:{CPU_ClocksTicks_s:1021800,CPU_TargetTicks_s:1021800}});
  for(const file of ['ayumi.js','EMU_CHIP_AY.js','EMU_CHIP_AY_JS.js','EMU_CHIP_AY_WASM.js','EMU_AUDIO_AY_STREAM.js','EMU_DEVICE_ay.js','EMU_DEVICE_mockingboard_voice.js','EMU_CARD_mockingboard.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../res',file),'utf8'),context,{filename:file});
  const card=context.oEMU.component.IO.mockingboard;card.mount={hash:42,slotN:4};
  return {context,card,voice:card.getVoiceDevice(),write:(a,v,t=0)=>card.writeSlotROM(a,v,{cpuTick:t})};
}
function arm(r){
  r.write(0x8e,0x82); // VIA1 CA1 enabled (falling edge).
  for(const [reg,value] of [[0,0xc1],[1,192],[2,0x40],[4,211],[3,0x4f],[0,1]])
    r.write(0x40+reg,value);
}
function ioRig(){
  const r=rig();let crc=1;
  r.context.oCOM={crc16:()=>crc++};
  r.context.oEMU.component.IO.ACTION_MAP={RD:{},WR:{}};
  for(const file of ['EMU_DEVICE_mockingboard_audio.js','EMU_apple2io.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../res',file),'utf8'),r.context,{filename:file});
  const io=new r.context.Apple2IO();io.slots[4]={peripheral:r.card};
  r.context.apple2plus={hwObj:()=>({io})};r.card.restart();io.provisionPeripheral(r.card);
  return {...r,io,write:(a,v)=>r.card.writeSlotROM(a,v,{cpuTick:io.getClockTicks()})};
}
test('SSI-263 is packaged as a reusable Mockingboard voice device',()=>assert.ok(fs.existsSync(voicePath)));
if(fs.existsSync(voicePath)){
  test('card provisions exactly audio and voice while keeping AY register interfaces',()=>{
    const r=rig();
    assert.deepEqual(Array.from(r.card.deviceConfig,d=>d.coID),['MockingboardAudio','MockingboardVoice']);
    assert.equal(r.voice.id.DCODE,'MOCKVOICE');assert.equal(r.card.getAYDevice(0).getRegisters().length,16);
    assert.equal(r.card.createDeviceInstance({coID:'MockingboardVoice'}),r.voice);
    assert.equal(r.voice.getState().poweredDown,true);assert.equal(r.card.needsRealtimeTick(),false);
  });
  test('primary SSI select aliases and read-only debugger access preserve hardware state',()=>{
    const r=rig();
    for(const address of [0x44,0x47,0x64,0xc4,0xf7]){r.write(address,211);assert.equal(r.voice.getState().registers[4],211);}
    assert.equal(r.card.writeSlotROM(0x40,0xc1,{bRO:true,cpuTick:99}),false);
    assert.equal(r.voice.getState().registers[0],0);
    assert.equal(r.card.readSlotROM(0x41,{bRO:true,io:{FLOATING_BUS:0x55}}),0x55);
    assert.equal(r.card.writeSlotROM(0x20,1,{}),false);
  });
  test('speech completion raises VIA1 CA1 at CPU duration independently of PCM drain',()=>{
    const r=rig();arm(r);assert.equal(r.card.needsRealtimeTick(),true);
    const cycles=Math.ceil(r.voice.getState().phonemeDurationSec*1021800);
    r.card.advanceTo(cycles-1);assert.equal(r.voice.getState().requesting,false);assert.equal(r.card.state.irq,false);
    r.card.advanceTo(cycles);assert.equal(r.voice.getState().requesting,true);
    assert.ok(r.card.getViaState(1).ifr&2);assert.equal(r.card.state.irq,true);
    assert.equal(r.card.getViaState(0).ifr&2,0);
    r.write(0x40,2,cycles);assert.equal(r.voice.getState().requesting,false);
    r.card.readSlotROM(0x81,{cpuTick:cycles});assert.equal(r.card.state.irq,false);
  });
  test('delayed PCM remains audible after the logical phoneme has already completed',()=>{
    const r=rig();arm(r);r.card.setAudioConsumerActive(true);
    r.card.advanceTo(Math.ceil(0.2*1021800));
    const data=r.card.drainAudioFrames(10000);
    assert.ok(data.frames>1000);
    assert.ok(Array.from(data.left).some(x=>Math.abs(x)>0.0001));
    assert.ok(Array.from(data.left).every(Number.isFinite));
    assert.deepEqual(Array.from(data.left),Array.from(data.right));
  });
  test('render chunk size and selected voice PCM rate never alter request time or produce invalid PCM',()=>{
    for(const rate of [22050,44100,48000]){
      const a=rig(),b=rig();a.voice.setSampleRate(rate,0);b.voice.setSampleRate(rate,0);
      arm(a);arm(b);a.card.setAudioConsumerActive(true);b.card.setAudioConsumerActive(true);
      const end=160000;a.card.advanceTo(end);
      for(let t=1000;t<=end;t+=1000)b.card.advanceTo(t);
      const x=a.card.drainAudioFrames(5000).left,y=b.card.drainAudioFrames(5000).left;
      assert.deepEqual(Array.from(x),Array.from(y));
      assert.equal(a.voice.getState().requesting,b.voice.getState().requesting);
      assert.equal(a.card.getAudioFormat().sampleRate,22050);
    }
  });
  test('reset powers down speech and unmount deasserts its IRQ',()=>{
    const r=rig();arm(r);
    r.card.advanceTo(Math.ceil(r.voice.getState().phonemeDurationSec*1021800));
    assert.equal(r.card.state.irq,true);
    r.card.reset();assert.equal(r.voice.getState().poweredDown,true);assert.equal(r.card.state.irq,false);
    arm(r);r.card.onUnmount();assert.equal(r.card.state.irq,false);
    assert.equal(r.voice.getState().poweredDown,true);
  });
  test('toolbox is one appbox and the popup has both columns and all screenshot controls',()=>{
    const r=rig();const html=r.card.deviceToolSlotHTML({toolboxID:'device_tool_4'});
    assert.equal((html.match(/class=appbox/g)||[]).length,1);
    assert.match(html,/flex-wrap:nowrap/);assert.match(html,/toggleHistoryCapture/);
    const popup=r.voice.controlsHTML('card',id=>'voice_'+id);
    for(const field of ['duration','rate','inflection','articulation','amplitude','filter','xck','sampleRate'])assert.ok(popup.includes('voice_'+field));
  });
  test('idle speech takes no DSP work and default controls preserve power down',()=>{
    const r=rig();r.card.advanceTo(1021800*2);
    assert.equal(r.voice.getState().generatedSamples,0);
    r.card.deviceToolVoiceDefaults();
    const s=r.voice.getState();assert.equal(s.poweredDown,true);
    assert.equal(s.inflection,1536);assert.equal(s.amplitude,15);assert.equal(s.sampleRate,44100);
  });
  test('speech transport rebases across AY backend changes and survives mute, CPU speed changes and removal',async()=>{
    const r=rig();arm(r);
    const completionTick=Math.ceil(r.voice.getState().phonemeDurationSec*1021800);
    r.card.advanceTo(40000);
    await r.card.setAYBackend('js');
    r.context._o.CPU_TargetTicks_s=2043600;
    r.card.advanceTo(80000);r.card.setAudioConsumerActive(true);
    r.card.advanceTo(110000);assert.ok(r.card.drainAudioFrames(5000).left.some(v=>v!==0));
    r.card.setAudioConsumerActive(false);r.card.clearAudioQueue();r.card.advanceTo(completionTick);
    assert.equal(r.voice.getState().requesting,true);
    assert.equal(r.voice.bindHost(r.card),true);
    assert.equal(r.voice.unbindHost(r.card),true);
    assert.equal(r.voice.getState().poweredDown,true);assert.equal(r.voice.getState().requesting,false);
    assert.equal(r.card.writeSlotROM(0x40,1,{cpuTick:completionTick}),false);
  });
  test('same-tick speech writes can be consumed without needing an AY event or PCM sample',()=>{
    const r=rig();
    for(let i=0;i<4100;i++)r.write(0x44,211,0);
    r.card.flushAudio();
    assert.equal(r.voice.getState().pendingEvents,0);
  });
  test('audition reports a failed audio resume without rejecting the UI promise',async()=>{
    const r=rig();r.card.devices=[{id:{DCODE:'MOCKAUDIO'},init:async()=>{throw new Error('resume failed');}}];
    assert.equal(await r.card.deviceToolVoicePlay(),false);
    assert.equal(r.voice.getState().poweredDown,true);
  });
  test('an audition waiting for audio cannot restart speech after card unmount',async()=>{
    const r=rig();let finish;
    r.card.devices=[{id:{DCODE:'MOCKAUDIO'},init:()=>new Promise(resolve=>{finish=resolve;})}];
    const pending=r.card.deviceToolVoicePlay();r.card.onUnmount();finish();
    assert.equal(await pending,false);assert.equal(r.voice.getState().poweredDown,true);
  });
  test('real IO refreshes speech IRQ ticks when CA1 is enabled after audio removal',()=>{
    const r=ioRig();assert.equal(r.io.detach(r.card,'MOCKAUDIO'),true);
    for(const [reg,v] of [[0,0xc1],[1,192],[2,0x40],[4,211],[3,0x4f],[0,1]])r.write(0x40+reg,v);
    r.write(0x8e,0x82);
    const cycles=Math.ceil(r.voice.getState().phonemeDurationSec*1021800);
    for(let i=0;i<cycles;i++)r.io.tick();
    assert.equal(r.voice.getState().requesting,true);assert.equal(r.card.state.irq,true);
  });
  test('generic IO reset preserves a nonzero voice timestamp and immediate voice detach',()=>{
    const r=ioRig();for(let i=0;i<1000;i++)r.io.tick();r.io.cycle();r.io.reset();
    assert.equal(r.io.getClockTicks(),1000);
    assert.equal(r.io.detach(r.card,'MOCKVOICE'),true);
    assert.equal(r.card.devices.some(d=>d.id.DCODE==='MOCKVOICE'),false);
  });
  test('pending audition cannot restart speech after its audio output is removed',async()=>{
    const r=rig();let finish;
    const sink={id:{DCODE:'MOCKAUDIO'},init:()=>new Promise(resolve=>{finish=resolve;})};
    r.card.devices=[sink];
    const pending=r.card.deviceToolVoicePlay();r.card.devices=[];finish();
    assert.equal(await pending,false);assert.equal(r.voice.getState().poweredDown,true);
  });
  test('picker attachment reuses declared singleton audio/voice instances without duplicates',()=>{
    const r=ioRig();
    assert.equal(r.io.detach(r.card,'MOCKVOICE'),true);
    assert.equal(r.io.attach(r.card,r.card.deviceConfig[1],{newInstance:true}),r.voice);
    assert.equal(r.io.attach(r.card,r.card.deviceConfig[1],{newInstance:true}),r.voice);
    assert.equal(r.card.devices.filter(d=>d.id.DCODE==='MOCKVOICE').length,1);
    const audio=r.card.devices.find(d=>d.id.DCODE==='MOCKAUDIO');
    assert.equal(r.io.attach(r.card,r.card.deviceConfig[0],{newInstance:true}),audio);
    assert.equal(r.card.devices.length,2);
  });
  test('master mute preserves speech IRQ and history, and reattached output inherits volume',()=>{
    const r=ioRig();r.card.toggleHistoryCapture();arm(r);
    const cycles=Math.ceil(r.voice.getState().phonemeDurationSec*1021800);
    r.card.volume_set(0);
    const audio=r.card.devices.find(d=>d.id.DCODE==='MOCKAUDIO');
    assert.equal(audio.getStats().masterVolumePct,0);assert.equal(audio.audio,undefined);
    for(let i=0;i<cycles;i++)r.io.tick();
    assert.equal(r.voice.getState().requesting,true);assert.equal(r.card.state.irq,true);
    assert.equal(r.card.getHistoryState().capturing,true);
    const before=r.card.getHistoryJSON();r.card.volume_set(25);
    assert.deepEqual(r.card.getHistoryJSON(),before);
    assert.equal(r.io.detach(r.card,'MOCKAUDIO'),true);
    r.card.volume_set(75);
    const attached=r.io.attach(r.card,r.card.deviceConfig[0],{newInstance:true});
    assert.equal(attached.getStats().masterVolumePct,75);
    assert.equal(attached.audio,undefined);assert.equal(r.card.volume_get(),75);
  });
  test('powered-up mode-zero idle is represented separately from active speech',()=>{
    const r=rig();r.write(0x43,15); // DR=0 at CTL falling edge disables requests and starts idle.
    assert.equal(r.voice.getState().poweredDown,false);
    assert.equal(r.voice.getState().sounding,false);
  });
  test('card unmount cannot reassert IRQ through the speech power-down CA1 edge',()=>{
    const r=rig();arm(r);r.card.advanceTo(160000);
    r.write(0x8c,1,160000);r.write(0x8d,2,160000);assert.equal(r.card.state.irq,false);
    r.card.onUnmount();assert.equal(r.card.state.irq,false);
  });
}
