#!/usr/bin/env node
// Exercise real RetroAppleJS 6502 + 6522 VIA + Mockingboard AY bus at cycle granularity.
// Standalone Apple II+/IIe Monitor IRQ bridge; not a complete ROM/browser boot.
'use strict';
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),out=path.join(root,'build/pt3_light');
const player=fs.readFileSync(path.join(out,'PT3_PLAYER_LIGHT.bin'));
const tune=fs.readFileSync(path.join(out,'PT3_PLAYER_LIGHT_TEST.pt3'));
assert.ok(player.length<=4096 && tune.length<=4096);
const context=vm.createContext({console,oEMU:{component:{CPU:{},IO:{}}}});
vm.runInContext(fs.readFileSync(path.join(root,'res/EMU_cpu6502.js'),'utf8'),context);
const cardSrc=fs.readFileSync(path.join(root,'res/EMU_CARD_mockingboard.js'),'utf8');
const start=cardSrc.indexOf('function MockingboardR6522('),end=cardSrc.indexOf('function MockingboardHistory(',start);
assert.ok(start>=0 && end>start);
vm.runInContext(cardSrc.slice(start,end),context);
vm.runInContext(fs.readFileSync(path.join(root,'res/ASM_core.js'),'utf8'),context);
const ram=new Uint8Array(65536),events=[];
const cardAddress=addr=>{
  const off=addr&255;
  if(addr<0xc400||addr>0xc4ff)return null;
  if(off<=15)return {via:0,reg:off};
  if(off>=128&&off<=143)return {via:1,reg:off&15};
  return null;
};
let cycleCount=0,irqCount=0,activeIRQ=false;
const syncBusy=[false,false],vias=[],buses=[];
const hw={irq_signal:0,nmi_signal:0,read,write};
function sync(i){
  if(syncBusy[i])return;
  syncBusy[i]=true;
  const driven=buses[i].observeViaPins(vias[i].paPins,vias[i].pbPins,cycleCount);
  vias[i].setPortAInput(driven===null?255:driven,255);
  syncBusy[i]=false;
}
function irqUpdate(){
  const next=!!(vias[0]?.irqLevel||vias[1]?.irqLevel);
  if(next&&!activeIRQ)irqCount++;
  activeIRQ=next;hw.irq_signal=next?1:0;
}
for(let i=0;i<2;i++){
  buses.push(new context.MockingboardAYBus(null,{
    name:'AY'+i,
    onRegisterWrite:(reg,value,tick)=>events.push({reg,value,ay:i,tick}),
    onReset:tick=>events.push({reg:-1,value:0,ay:i,tick})
  }));
  vias.push(new context.MockingboardR6522({
    name:'VIA'+i,
    onPortAChange:()=>sync(i),
    onPortBChange:()=>sync(i),
    onIrqChange:irqUpdate
  }));
}
function read(addr){
  addr&=65535;
  const d=cardAddress(addr);
  return d?vias[d.via].readRegister(d.reg):ram[addr];
}
function write(addr,value){
  addr&=65535;
  const d=cardAddress(addr);
  if(d)vias[d.via].writeRegister(d.reg,value);
  else if(addr<0xc000)ram[addr]=value&255;
}
ram.set(player,0x6000);ram.set(tune,0x8000);
// Executable host program: JSR APIs and a tiny independent loop counter only. No HGR setup or drawing.
const host=`ORG $5000
    jsr $6000
    sta $7103
HOST_LOOP:
    inc $7100
    lda $7102
    beq HOST_LOOP
    cmp #$01
    beq DO_PAUSE
    cmp #$02
    beq DO_RESUME
    cmp #$03
    beq DO_STOP
    cmp #$04
    beq DO_START
    cmp #$05
    beq DO_STATUS
    jmp RESET_CMD
DO_PAUSE:
    jsr $6006
    sta $7103
    jmp RESET_CMD
DO_RESUME:
    jsr $6009
    sta $7103
    jmp RESET_CMD
DO_STOP:
    jsr $6003
    sta $7103
    jmp RESET_CMD
DO_START:
    jsr $6000
    sta $7103
    jmp RESET_CMD
DO_STATUS:
    jsr $600c
    sta $7103
RESET_CMD:
    lda #$00
    sta $7102
    jmp HOST_LOOP`;
const assembled=new context.ASM({dialect:'raJS'}).assemble(host);
assert.equal(assembled.errors.length,0,JSON.stringify(assembled.errors));
assert.equal(assembled.bytes[0].pc,0x5000);
ram.set(Buffer.from(assembled.bytes.map(b=>b.val)),0x5000);
ram[0xfffe]=0x00;ram[0xffff]=0xff;
ram.set([0x85,0x45,0x6c,0xfe,0x03],0xff00); // Monitor: STA $45 ; JMP ($03FE)
ram[0x03fe]=0x40;ram[0x03ff]=0xff;
ram[0xff40]=0x40; // old handler RTI
ram[0xfffc]=0x00;ram[0xfffd]=0x50;
const cpu=new context.Cpu6502(hw);
cpu.reset();
function tick(){cpu.cycle();cycleCount++;vias[0].tick(1);vias[1].tick(1);}
function advance(n){for(let i=0;i<n;i++)tick();}
function command(n,expect){
  assert.equal(ram[0x7102],0,'Previous host command not consumed');
  ram[0x7103]=0xee;
  ram[0x7102]=n;
  // HOST_LOOP may be momentarily interrupted; allow enough cycles to return.
  let count=0;
  while(ram[0x7102]!==0 && count++<150000)tick();
  assert.equal(ram[0x7102],0,'Host did not process command '+n+
    ' CPU='+JSON.stringify(cpu.watch())+' tick='+cycleCount+
    ' irq='+irqCount+' IER='+vias[0].ier.toString(16)+
    ' IFR='+vias[0].ifr.toString(16)+
    ' state='+ram[0x600f].toString(16));
  assert.equal(ram[0x7103],expect,'Unexpected API return for command '+n);
}
advance(120000);
assert.equal(ram[0x7103],0,'START did not return A=0');
assert.equal(cpu.watch().p&4,0,
    'START did not clear I for VIA Timer1 playback from a masked caller');
const runningVector=ram[0x03fe]+256*ram[0x03ff];
assert.ok(runningVector>=0x6000 && runningVector<0x7000,'IRQ not installed');
assert.equal(vias[0].ier&0x40,0x40,'VIA0 T1 not enabled');
assert.ok(ram[0x7100]!==0,'Host foreground did not run after START');
command(5,1);
const t0=cycleCount;
advance(700000);
assert.ok(irqCount>=33,'Missing 50Hz Timer1 interrupts');
const ay0=events.filter(e=>e.ay===0&&e.reg>=0),ay1=events.filter(e=>e.ay===1&&e.reg>=0);
assert.ok(ay0.length>350 && ay1.length>350,'Insufficient PT3 sound-register output');
assert.equal(ay0.length,ay1.length,'Mirrored AY counts differ');
for(let i=0;i<ay0.length;i++){
  assert.equal(ay0[i].reg,ay1[i].reg,'Mirrored register number '+i);
  assert.equal(ay0[i].value,ay1[i].value,'Mirrored register value '+i);
}
const firstScoreTick=events.find(e=>e.reg===0&&e.ay===0)?.tick||0;
const music=ay0.filter(e=>e.tick>firstScoreTick+20000);
assert.ok(music.some(e=>e.reg===0&&e.value!==0),'No pitched AY programming');
assert.ok(music.some(e=>e.reg===7),'No mixer activity');
assert.ok(music.filter(e=>e.reg===7).every(e=>(e.value&0x38)===0x38),'Noise not disabled');
assert.ok(music.filter(e=>e.reg>=8&&e.reg<=10).every(e=>(e.value&0xf0)===0),'Hardware envelope still enabled');
assert.ok(music.every(e=>e.reg<=10),'Unexpected envelope R11–R13 writes in score');

command(1,0);
command(5,2);
const pauseStart=cycleCount,eventsBeforePause=events.length,foregroundBeforePause=ram[0x7100];
advance(300000);
assert.equal(events.length,eventsBeforePause,'Music continued to write AY during pause');
assert.ok(irqCount>40,'Timer heartbeat stopped during pause');
assert.notEqual(ram[0x7100],foregroundBeforePause,'Host did not progress during pause');
command(2,0);
command(5,1);
const eventsBeforeResume=events.length;
advance(250000);
assert.ok(events.length>eventsBeforeResume+40,'RESUME did not restore music');
const irqsBeforeStop=irqCount;
command(3,0);
assert.equal(cpu.watch().p&4,4,
    'STOP did not restore the CPU interrupt-disable state from original START');
command(5,0);
assert.equal(vias[0].ier&0x40,0,'STOP left T1 interrupt enabled');
assert.equal(ram[0x03fe],0x40,'STOP failed to restore previous IRQ low');
assert.equal(ram[0x03ff],0xff,'STOP failed to restore previous IRQ high');
assert.equal(vias[0].ddra,0,'VIA0 DDRA not restored');
assert.equal(vias[1].ddrb,0,'VIA1 DDRB not restored');
advance(160000);
assert.equal(irqCount,irqsBeforeStop,'IRQ continued after STOP');

// Invalid song and T1 collision must fail safely without installing vectors.
ram[0x8000]=0;
command(4,2);
assert.equal(ram[0x03fe],0x40,'Bad module changed IRQ vector');
ram[0x8000]=0x50;
// Earlier T1 was stopped with its counter still running. Clear stale T1 IFR
// before enabling a deliberately foreign IER bit; otherwise this artificial
// collision would immediately interrupt the host's minimal RTI-only handler.
vias[0].writeRegister(13,0x40);
vias[0].writeRegister(14,0xc0);
command(4,3);
vias[0].writeRegister(14,0x40);
assert.equal(ram[0x03fe],0x40,'Busy timer changed IRQ vector');
command(4,0);
assert.equal(cpu.watch().p&4,0,
    'Restart START did not clear I for T1');
command(5,1);
advance(300000);
assert.ok(irqCount>irqsBeforeStop+5,'Restart after STOP failed');
command(3,0);
assert.equal(cpu.watch().p&4,4,
    'Restart STOP did not restore original I');
assert.equal(ram[0x03fe],0x40);
const report={
  status:'PASS',schema:'retroapplejs.pt3.light.native.v1',
  playerBytes:player.length,songBytes:tune.length,
  cpuCycles:cycleCount,sourceTickAfterStart:t0,IRQCount:irqCount,
  ayWrites:events.filter(e=>e.ay===0&&e.reg>=0).length,
  pausedCycles:300000,
  tested:['START enables masked caller interrupts','STOP restores caller I flag','START returns to host','50Hz Timer1','square-only','AY0/AY1 mirror','PAUSE retains decoder state',
  'RESUME returns music','STOP releases IRQ/vector/DDRs','invalid song rejected','T1 busy rejected','restart']
};
fs.writeFileSync(path.join(out,'PT3_PLAYER_LIGHT_native.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS resident PT3 LIGHT native CPU/VIA/AY lifecycle:',JSON.stringify(report));
