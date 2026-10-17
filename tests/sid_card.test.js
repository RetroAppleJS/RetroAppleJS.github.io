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
