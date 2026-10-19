'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const build=require('../tools/SID_Phase2C1_build.js');
function harness(){
 const hw={irq_signal:0,nmi_signal:0,irq_sources:Object.create(null)};
 let now=0,callbacks=[];
 hw.setIRQSource=(name,enabled)=>{
  if(enabled)hw.irq_sources[name]=true;else delete hw.irq_sources[name];
  hw.irq_signal=Object.keys(hw.irq_sources).length?1:0;
 };
 const io={
  getClockTicks(){return now;},
  registerPeripheralTick(owner,callback){
   callbacks=callbacks.filter(x=>x.owner!==owner);
   callbacks.push({owner,callback});return true;
  },
  unregisterPeripheralTick(owner){
   callbacks=callbacks.filter(x=>x.owner!==owner);return true;
  },
  tick(){
   now++;
   for(const item of callbacks)item.callback(now);
  }
 };
 hw.io=io;
 const ctx=vm.createContext({console,Uint8Array,Float32Array,Math,Number,
   apple2plus:{hwObj(){return hw;}},oEMU:{component:{IO:{}}}});
 vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_CARD_SID.js'),'utf8'),ctx);
 const card=new ctx.SIDCard();
 card.mount={hash:4,slotN:5};card.restart();
 function writePort(offset,value){return card.writeSlotIO(offset,value,{cpuTick:now});}
 function readIndex(reg){card.writeSlotIO(2,reg);return card.readSlotIO(3,{cpuTick:now});}
 return {card,hw,io,writePort,readIndex,now:()=>now,callbackCount:()=>callbacks.length};
}
test('SID 2C.1 IRQ asserts at exact CPU tick, ACK releases only its source',()=>{
 const h=harness();
 assert.equal(h.callbackCount(),1);
 h.writePort(8,0xD4);h.writePort(9,0x4F);h.writePort(10,1);
 for(let i=0;i<20435;i++)h.io.tick();
 assert.equal(h.hw.irq_signal,0);
 h.io.tick();
 assert.equal(h.hw.irq_signal,1);
 assert.equal(h.readIndex(0x1D),3);
 assert.equal(h.card.getTimerState().fired,1);
 h.writePort(11,1);
 assert.equal(h.hw.irq_signal,0);
 for(let i=0;i<20436;i++)h.io.tick();
 assert.equal(h.hw.irq_signal,1);
 assert.equal(h.card.getTimerState().fired,2);
 assert.equal(h.card.getTimerState().missed,0);
 h.writePort(10,0);
 assert.equal(h.hw.irq_signal,0);
 assert.equal(h.card.getTimerState().enabled,false);
});
test('late IRQs coalesce; other sources survive ACK; reset and unmount release ownership',()=>{
 const h=harness();
 h.writePort(8,10);h.writePort(9,0);h.writePort(10,1);
 for(let i=0;i<35;i++)h.io.tick();
 assert.equal(h.card.getTimerState().fired,1);
 assert.equal(h.card.getTimerState().missed,2);
 assert.equal(h.hw.irq_signal,1);
 h.hw.setIRQSource('OTHER',true);
 h.writePort(11,1);
 assert.equal(h.hw.irq_signal,1,'SID ACK must leave foreign IRQ asserted');
 h.hw.setIRQSource('OTHER',false);
 assert.equal(h.hw.irq_signal,0);
 for(let i=0;i<5;i++)h.io.tick();
 assert.equal(h.hw.irq_signal,1);
 h.card.reset();
 assert.equal(h.hw.irq_signal,0);
 assert.equal(h.card.getTimerState().enabled,false);
 h.writePort(8,7);h.writePort(9,0);h.writePort(10,1);
 h.card.onUnmount();
 assert.equal(h.hw.irq_signal,0);
 assert.equal(h.callbackCount(),0);
});
test('timer writes preserve SID POT/OSC/ENV reads, indexed SID writes and original tick latch ABI',()=>{
 const h=harness();
 h.writePort(8,0x86);h.writePort(9,0x42);
 assert.equal(h.card.getTimerState().period,17030);
 for(let i=0;i<34567;i++)h.io.tick();
 h.card.writeSlotIO(2,0x1E);
 const low=h.card.readSlotIO(3,{cpuTick:h.now()});
 h.card.writeSlotIO(2,0x1F);
 const high=h.card.readSlotIO(3,{cpuTick:h.now()+432});
 assert.equal(low|(high<<8),h.now()&0xFFFF);
 assert.equal(h.card.readSlotIO(8),0xFF,'unchanged audio-unattached read');
 assert.equal(h.card.readSlotIO(9),0xFF,'unchanged audio-unattached read');
 assert.equal(h.card.readSlotIO(10),0xFF,'unchanged audio-unattached read');
 assert.equal(h.card.readSlotIO(11),0xFF,'unchanged audio-unattached read');
 h.card.writeSlotIO(2,0x1B);
 assert.equal(h.card.readSlotIO(3),0xFF,'indexed OSC3 still supplied by SID device');
 h.card.writeSlotIO(2,0x04);h.card.writeSlotIO(3,0x41);
 assert.equal(h.card.getTimerState().period,17030);
});
function actualROM(){
 const ctx=vm.createContext({console,Uint8Array,oEMU:{component:{ROM:{}}}});
 vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_apple2roms.js'),'utf8'),ctx);
 return vm.runInContext('apple2Rom',ctx);
}
function cpuCtor(){
 const ctx=vm.createContext({console,Uint8Array,Number,Math,oEMU:{component:{CPU:{}}}});
 vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_cpu6502.js'),'utf8'),ctx);
 return ctx.Cpu6502;
}
function nativeScenario({mode=50,quantum=1,runTicks=125000}={}){
 const h=harness(),rom=actualROM(),p=build.assemble();
 const mem=new Uint8Array(65536);
 mem.set(p.installer,0x1800);mem.set(p.resident,0x9300);
 // In RAM, the Apple II Monitor IRQ dispatch uses the soft vector at $03FE.
 // Prior owner's handler receives other IRQs; never clobber it.
 mem[0x03FE]=0x00;mem[0x03FF]=0x83;
 mem.set([0xA5,0x45,0x40],0x8300);  // LDA $45; RTI (previous owner)
 // Foreground program repeatedly increments a RAM counter.
 mem.set([0xEE,0x10,0x82,0x4C,0x00,0x82],0x8200);
 mem[0x8210]=0;mem[0x45]=0x32;
 // CALL 6144/6147 synthetic return address $FF00.
 mem[0x01FE]=0xFF;mem[0x01FF]=0xFE;
 let trackIRQ=0,monitorIRQs=0,foregroundSteps=0,maxIRQDelay=0;
 const Cpu=cpuCtor();
 const cpu=new Cpu({
  // IRQ must come from the SAME shared hardware line as the timer card,
  // not a detached CPU-test object with a permanently inactive level.
  get irq_signal(){return h.hw.irq_signal;},
  set irq_signal(v){h.hw.irq_signal=v;},
  nmi_signal:0,lineDecode:a=>a>>12,
  read(addr){
   if(addr>=0xD000)return rom[addr-0xD000];
   if(addr>=0xC0C0&&addr<=0xC0CF)return h.card.readSlotIO(addr&15,{cpuTick:h.now()});
   if(addr>=0xC000)return 0;
   return mem[addr&65535];
  },
  write(addr,value){
   if(addr>=0xC0C0&&addr<=0xC0CF){
     h.card.writeSlotIO(addr&15,value,{cpuTick:h.now()});
   } else if(addr<0xC000)mem[addr]=value&255;
  }
 });
 cpu.reset();
 cpu.setState({pc:mode===50?0x1800:0x1803,sp:0xFD,p:0x20,a:0,x:0,y:0});
 // The test drives precisely the same per-CPU-cycle clock as the live emulator.
 for(let i=0;i<8000;i++){
   if(cpu.watch().pc===0xFF00)break;
   cpu.cycle();h.io.tick();
 }
 assert.equal(cpu.watch().pc,0xFF00,'installer must return to foreground');
 assert.equal(mem[0x03FE],0x00);
 assert.equal(mem[0x03FF],0x93);
 assert.equal(h.card.getTimerState().enabled,true);
 assert.equal(h.card.getTimerState().period,mode===50?20436:17030);
 cpu.setState({pc:0x8200,sp:0xFF,p:0x20,a:0,x:0,y:0});
 for(let i=0;i<runTicks;i++){
   const pc=cpu.watch().pc;
   if(pc===0xFA40)monitorIRQs++;
   if(pc===0x9300)trackIRQ++;
   if(pc===0x8200)foregroundSteps++;
   cpu.cycle();h.io.tick();
 }
 const result={h,cpu,mem,p,trackIRQ,monitorIRQs,foregroundSteps};
 return result;
}
test('Phase 2C.1 assembly compiles in DOS-safe segments with call entrypoints',()=>{
 const p=build.assemble();
 assert.ok(p.installer.length>50&&p.installerEnd<=0x1C00);
 assert.ok(p.resident.length>100&&p.residentEnd<=0x9400);
 assert.equal(p.symbols.PUBLIC,0x1800);
 assert.equal(p.symbols.PUB_NTSC,0x1803);
 assert.equal(p.symbols.PUB_STOP,0x1806);
 assert.equal(p.symbols.IRQ_HANDLER,0x9300);
});
test('real 6502 and Apple II ROM continue foreground while PAL IRQ counter increments',()=>{
 const r=nativeScenario({mode:50,quantum:1,runTicks:135000});
 assert.ok(r.foregroundSteps>1000,'foreground stopped');
 assert.ok(r.monitorIRQs>=5,'ROM did not receive SID interrupts');
 assert.ok(r.trackIRQ>=5,'native handler was never entered');
 assert.equal(r.mem[0x93F4]*256+r.mem[0x93F3],r.trackIRQ,'one increment per IRQ');
 assert.equal(r.h.card.getTimerState().missed,0);
 assert.equal(r.mem[0x03FE],0);
 assert.equal(r.mem[0x03FF],0x93);
});
test('real 6502 and ROM handle 60 Hz with unchanged foreground execution',()=>{
 const r=nativeScenario({mode:60,runTicks:130000});
 assert.ok(r.foregroundSteps>1000);
 assert.ok(r.trackIRQ>=7);
 assert.equal(r.mem[0x93F4]*256+r.mem[0x93F3],r.trackIRQ);
 assert.equal(r.h.card.getTimerState().missed,0);
});
