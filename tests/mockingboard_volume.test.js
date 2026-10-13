'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function rig(){
  const context=vm.createContext({console,Float32Array,Uint8Array,TextEncoder,TextDecoder,atob,btoa,setTimeout,clearTimeout,
    oEMU:{component:{IO:{}}},_o:{CPU_ClocksTicks_s:1021800,CPU_TargetTicks_s:1021800}});
  for(const file of ['ayumi.js','EMU_CHIP_AY.js','EMU_CHIP_AY_JS.js','EMU_CHIP_AY_WASM.js','EMU_AUDIO_AY_STREAM.js',
    'EMU_DEVICE_ay.js','EMU_DEVICE_mockingboard_voice.js','EMU_DEVICE_mockingboard_audio.js','EMU_CARD_mockingboard.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../res',file),'utf8'),context,{filename:file});
  const card=context.oEMU.component.IO.mockingboard;card.mount={hash:42,slotN:4};
  return {context,card,voice:card.getVoiceDevice()};
}
function stats(a){let energy=0,peak=0;for(const v of a){energy+=v*v;peak=Math.max(peak,Math.abs(v));}return {rms:Math.sqrt(energy/a.length),peak};}
function makeAY(context,channels=1,amplitude=12){
  const core=context.AYCore.createJS({chipCount:2,sampleRate:22050,renderProfile:'economy',timebaseHz:1e9,maxFrames:4096,maxEvents:4096});
  for(let chip=0;chip<2;chip++){
    core.configureChip(chip,{model:'AY',clockHz:1021800});
    core.setMix(chip,chip===0?[.5,0,.5,0,.5,0]:[0,.5,0,.5,0,.5]);
    core.writeNow(chip,7,channels===1?0x3e:0x38);
    for(let channel=0;channel<channels;channel++){core.writeNow(chip,channel*2,255);core.writeNow(chip,channel*2+1,0);core.writeNow(chip,channel+8,amplitude);}
  }
  const out={left:new Float32Array(4096),right:new Float32Array(4096)};
  const frames=core.renderUntil(1e8,null,out);
  return {out,frames};
}
function voiceOutput(context,name,filter=211,amplitude=12,pcm=null){
  const voice=new context.MockingboardVoice({mapCpuTick:t=>t*1e9/1021800});
  voice.reset(1021800,0);const code=context.SSI263.PHONEMES.find(p=>p.name===name).code;
  for(const [reg,value] of [[0,0xc0|code],[1,0x20],[2,0x48],[4,filter],[3,0x40|amplitude],[0,code]])voice.writeRegister(reg,value,0);
  const out=pcm||{left:new Float32Array(2205),right:new Float32Array(2205)};
  voice.mixFrames(0,0,2205,out,1e8);return out;
}
test('calibrated representative voice levels are balanced against an AY channel',()=>{
  const r=rig(),ay=stats(makeAY(r.context).out.left.subarray(300,2205));
  for(const filter of [211,233]){
    const levels=['E','I','EH','AE','AH','O','OU','U','ER','L'].map(name=>stats(voiceOutput(r.context,name,filter).left).rms);
    const mean=levels.reduce((a,b)=>a+b,0)/levels.length,ratio=mean/ay.rms;
    console.log(JSON.stringify({filter,ayRms:ay.rms,voiceMeanRms:mean,ratio}));
    assert.ok(ratio>0.75 && ratio<1.35,'Voice/AY RMS ratio '+ratio);
  }
});
test('voice and music retain pre-gain headroom instead of clipping before the shared sink',()=>{
  const r=rig(),music=makeAY(r.context,3,15);
  const voiceOnly=voiceOutput(r.context,'E',233,15);
  const mixed=voiceOutput(r.context,'E',233,15,{left:music.out.left.slice(0,2205),right:music.out.right.slice(0,2205)});
  let aboveUnity=0;
  for(let i=0;i<2205;i++){
    assert.ok(Math.abs(mixed.left[i]-(music.out.left[i]+voiceOnly.left[i]))<1e-6);
    if(Math.abs(mixed.left[i])>1)aboveUnity++;
    assert.ok(Math.abs(mixed.left[i]*.25)<1);
  }
  assert.ok(aboveUnity>0,'Fixture must exercise pre-gain values above unity');
});
test('card master volume cycles and persists through reset and AY backend change',async()=>{
  const {card}=rig();
  assert.equal(card.volume_get(),100);
  assert.deepEqual([card.volume_cycle(),card.volume_cycle(),card.volume_cycle(),card.volume_cycle()],[0,25,75,100]);
  card.volume_set(25);card.reset();assert.equal(card.volume_get(),25);
  await card.setAYBackend('js');assert.equal(card.volume_get(),25);
  assert.throws(()=>card.volume_set(NaN));assert.equal(card.volume_get(),25);
});
test('one volume button and telemetry are on the second toolbox row',()=>{
  const {card}=rig();const html=card.deviceToolSlotHTML({toolboxID:'device_tool_4'});
  const first=html.indexOf("data-mockingboard-row='1'"),second=html.indexOf("data-mockingboard-row='2'");
  assert.ok(first>=0 && second>first);
  assert.ok(html.indexOf('toggleHistoryCapture')>first && html.indexOf('toggleHistoryCapture')<second);
  assert.ok(html.indexOf('volume_cycle')>second && html.indexOf('openAudioTelemetry')>second);
  assert.equal((html.match(/volume_cycle/g)||[]).length,1);
});
test('volume button reflects its current value and updates its accessible label',()=>{
  const {card}=rig(),icon={className:''},attrs={};
  const button={setAttribute(k,v){attrs[k]=v;},getElementsByTagName(){return [icon];}};
  card.volume_cycle(button);
  assert.equal(icon.className,'fa fa-volume-mute');assert.equal(attrs['data-volume'],'0');
  assert.match(attrs['aria-label'],/0%/);assert.equal(button.title,attrs['aria-label']);
  card.volume_cycle(button);assert.equal(icon.className,'fa fa-volume-off');
  assert.equal(attrs['data-volume'],'25');
  const html=card.deviceToolSlotHTML({toolboxID:'device_tool_4'});
  assert.match(html,/data-volume='25'/);assert.match(html,/Mockingboard volume: 25%/);
});
