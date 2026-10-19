'use strict';
// 2C.2 executes the real RetroAppleJS 6502 and genuine Monitor IRQ entry.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const builder=require('../tools/SID_Phase2C2_build.js');
const psid=fs.readFileSync(path.join(ROOT,'asm/AUDIO/SID2MB_prototype/Mr_Heli_original.sid'));
function contexts(){
 const memory=new Uint8Array(65536),hardware={irq_signal:0,nmi_signal:0,sources:{}};
 let ticks=0,callbacks=[];
 hardware.setIRQSource=(name,on)=>{
  if(on)hardware.sources[name]=1;
  else delete hardware.sources[name];
  hardware.irq_signal=Object.keys(hardware.sources).length?1:0;
 };
 const io={getClockTicks:()=>ticks,
  registerPeripheralTick(owner,callback){
   callbacks=callbacks.filter(x=>x.owner!==owner);
   callbacks.push({owner,callback});return true;
  },
  unregisterPeripheralTick(owner){
   callbacks=callbacks.filter(x=>x.owner!==owner);return true;
  },
  tick(){ticks++;for(const c of callbacks)c.callback(ticks);}
 };
 hardware.io=io;
 const cardCtx=vm.createContext({console,Uint8Array,Float32Array,Math,Number,
  apple2plus:{hwObj:()=>hardware},oEMU:{component:{IO:{}}}});
 vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_CARD_SID.js'),'utf8'),cardCtx);
 const card=new cardCtx.SIDCard();
 card.mount={hash:420,slotN:5};card.restart();
 const cpuCtx=vm.createContext({console,Uint8Array,Math,Number,oEMU:{component:{CPU:{}}}});
 vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_cpu6502.js'),'utf8'),cpuCtx);
 const romCtx=vm.createContext({console,Uint8Array,oEMU:{component:{ROM:{}}}});
 vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_apple2roms.js'),'utf8'),romCtx);
 const rom=vm.runInContext('apple2Rom',romCtx);
 return {memory,hardware,io,card,rom,Cpu:cpuCtx.Cpu6502,ticks:()=>ticks};
}
function v1(){
 const b=Buffer.concat([psid.subarray(0,0x76),psid.subarray(0x7C)]);
 b.writeUInt16BE(1,4);b.writeUInt16BE(0x76,6);return b;
}
function run(tune,{rate=50,subtune='3',stage=0x6000,foregroundTicks=170000}={}){
 if(rate===60){
  tune=Buffer.from(tune);
  // PSID v2 clock bits 2..3 of flags ($76-$77): NTSC is binary 10.
  assert.equal(tune.readUInt16BE(4),2,'NTSC test needs PSID v2 flags');
  tune[0x77]=(tune[0x77]&~0x0c)|0x08;
 }
 const ctx=contexts(),asm=builder.assemble(),mem=ctx.memory;
 mem.set(asm.player,0x8000);mem.set(tune,stage);
 mem.set([0x53,0x49,0x44,0x46,stage&255,stage>>>8,
         tune.length&255,tune.length>>>8],0x9430);
 const originalZP=Uint8Array.from({length:256},(_,i)=>(i*17+7)&255);
 mem.set(originalZP,0);
 mem[0x03FE]=0x00;mem[0x03FF]=0x58;
 mem.set([0xA5,0x45,0x40],0x5800);
 mem.set([0xEE,0x10,0x50,0x4C,0x00,0x50],0x5000);
 mem[0x1FE]=0xFF;mem[0x1FF]=0xFE;
 const inputs=['',subtune],sidWrites=[],playStarts=[];
 let queries=0,foregroundSteps=0,irqEntries=0,monitorIRQs=0,lastPC=-1;
 const base=0xC0C0;
 const cpu=new ctx.Cpu({
  get irq_signal(){return ctx.hardware.irq_signal;},
  set irq_signal(v){ctx.hardware.irq_signal=v;},
  nmi_signal:0,lineDecode:a=>a>>12,
  read(addr){
   if(addr===0xFD6A){
    const line=inputs[queries++];
    if(line===undefined)throw Error('Unexpected native prompt '+queries);
    for(let i=0;i<line.length;i++)mem[0x200+i]=line.charCodeAt(i)|128;
    mem[0x200+line.length]=0x8D;return 0x60;
   }
   if(addr===0xFDED||addr===0xFD8E)return 0x60;
   if(addr>=0xD000)return ctx.rom[addr-0xD000];
   if(addr>=base&&addr<base+16)return ctx.card.readSlotIO(addr&15,{cpuTick:ctx.ticks()});
   if(addr>=0xC000)return 0;
   return mem[addr&65535];
  },
  write(addr,value){
   if(addr>=0xD400&&addr<=0xD41F){sidWrites.push([addr,value&255]);return;}
   if(addr>=base&&addr<base+16){ctx.card.writeSlotIO(addr&15,value,{cpuTick:ctx.ticks()});return;}
   if(addr<0xC000)mem[addr]=value&255;
  }
 });
 cpu.reset();
 cpu.setState({pc:asm.symbols.NATIVE_ENTRY,sp:0xFD,p:0x24,a:0,x:0,y:0});
 let returned=false;
 for(let i=0;i<1600000;i++){
  if(cpu.watch().pc===0xFF00){returned=true;break;}
  cpu.cycle();ctx.io.tick();
 }
 assert.equal(returned,true,'native parser/INIT did not return to BASIC');
 assert.equal(queries,2);
 assert.equal(mem[asm.symbols.BG_ACTIVE],1);
 assert.equal(ctx.card.getTimerState().enabled,true);
 assert.equal(mem[asm.symbols.BG_OLD_I],4,'installer must preserve the original IRQ mask');
 assert.equal(cpu.watch().p&4,0,'interrupt mask must be cleared by installer');
 assert.equal(mem[0x03FE],0);assert.equal(mem[0x03FF],0x93);
 assert.deepEqual(Array.from(mem.subarray(0,0x45)),Array.from(originalZP.subarray(0,0x45)));
 const installedZP=mem.slice(0,256),musicZP=mem.slice(0x9400,0x9500);
 cpu.setState({pc:0x5000,sp:0xFF,p:cpu.watch().p,a:0,x:0,y:0});
 for(let i=0;i<foregroundTicks;i++){
  let pc=cpu.watch().pc;
  if(pc===0x5000&&pc!==lastPC)foregroundSteps++;
  if(pc===0xFA40&&pc!==lastPC)monitorIRQs++;
  if(pc===0x9300&&pc!==lastPC)irqEntries++;
  if(pc===asm.symbols.IRQ_PLAY_CALL&&pc!==lastPC)playStarts.push(ctx.ticks());
  cpu.cycle();ctx.io.tick();lastPC=pc;
 }
 return {ctx,asm,cpu,mem,foregroundSteps,monitorIRQs,irqEntries,playStarts,
  musicZP,installedZP,originalZP,sidWrites};
}
test('2C.2 assembly preserves DOS and provides native PSID/IRQ entrypoints',()=>{
 const a=builder.assemble();
 assert.equal(a.start,0x8000);
 assert.ok(a.end<=0x9400);
 assert.equal(a.symbols.NATIVE_ENTRY,0x8000);
 assert.ok(a.symbols.BG_STOP>=0x9000&&a.symbols.BG_STOP<0x9400);
 assert.ok(a.symbols.BG_NEXT_SUBTUNE>=0x8800&&a.symbols.BG_NEXT_SUBTUNE<0x9000);
 assert.equal(a.player.subarray(0xFF0,0xFF4).toString(),'S2C2');
 assert.equal(a.symbols.IRQ_HANDLER,0x9300);
 assert.ok(a.symbols.BG_OLD_IRQ>=0x93E0);
});
test('v2 Mr Heli plays via native IRQ while a foreground Apple II program continues',()=>{
 const r=run(psid,{foregroundTicks:135000});
 assert.ok(r.foregroundSteps>1000,'foreground instructions should progress');
 assert.ok(r.monitorIRQs>=4&&r.irqEntries>=4,'hardware IRQ service did not run');
 assert.ok(r.playStarts.length>=4,'original PLAY did not run in timer handler');
 const completed=r.mem[r.asm.symbols.BG_IRQ_LO]+256*r.mem[r.asm.symbols.BG_IRQ_HI];
 assert.ok(completed===r.playStarts.length||completed===r.playStarts.length-1,
  'last PLAY entry may still be executing when the test window ends');
 assert.ok(r.sidWrites.length>50);
 assert.deepEqual(Array.from(r.mem.subarray(0,0x45)),Array.from(r.installedZP.subarray(0,0x45)));
 assert.equal(r.ctx.card.getTimerState().missed,0);
});
test('v1/v2 identical music has matching native IRQ SID write sequence',()=>{
 const a=run(v1(),{foregroundTicks:90000}),b=run(psid,{foregroundTicks:90000});
 assert.ok(a.playStarts.length>=3);
 assert.equal(a.playStarts.length,b.playStarts.length);
 assert.deepEqual(a.sidWrites,b.sidWrites,'PSID header version cannot change original SID writes');
});
test('native STOP disables timer, restores previous IRQ vector and silences SID',()=>{
 const r=run(psid,{foregroundTicks:70000});
 assert.ok(r.playStarts.length>=2);
 r.mem[0x1FE]=0xFF;r.mem[0x1FF]=0xFE;
 r.cpu.setState({pc:r.asm.symbols.BG_STOP,sp:0xFD,p:0x20,a:0,x:0,y:0});
 let returned=false;
 for(let i=0;i<9000;i++){
  if(r.cpu.watch().pc===0xFF00){returned=true;break;}
  r.cpu.cycle();r.ctx.io.tick();
 }
 assert.ok(returned);
 assert.equal(r.ctx.card.getTimerState().enabled,false);
 assert.equal(r.ctx.hardware.irq_signal,0);
 assert.equal(r.mem[0x03FE],0);assert.equal(r.mem[0x03FF],0x58);
 assert.equal(r.mem[r.asm.symbols.BG_ACTIVE],0);
 assert.equal(r.cpu.watch().p&4,4,'STOP must restore the IRQ mask saved at installation');
 assert.equal(r.sidWrites.at(-1)[0],0xD418);
 assert.equal(r.sidWrites.at(-1)[1],0);
});

test('native IRQ background player uses 60 Hz timer for NTSC PSID v2 without blocking foreground',()=>{
 const r=run(psid,{rate:60,foregroundTicks:125000});
 assert.equal(r.ctx.card.getTimerState().period,17030);
 assert.ok(r.foregroundSteps>600);
 assert.ok(r.playStarts.length>=5);
 assert.ok(r.sidWrites.length>40);
 assert.equal(r.ctx.card.getTimerState().missed,0);
});

test('direct resident REPLAY after STOP preserves permanent $8000 parser',()=>{
 const r=run(psid,{foregroundTicks:83000});
 const {cpu,mem,asm,ctx}=r;
 assert.ok(r.playStarts.length>=3);
 const codeBefore=Array.from(mem.subarray(0x8000,0x8020));
 // Music ZP replaces SIDF/descriptor, but permanent parser stays intact.
 assert.notDeepEqual(Array.from(mem.subarray(0x9430,0x9434)),
                     [0x53,0x49,0x44,0x46],
  'the original SIDF transfer record was deliberately overwritten');
 function callAt(address,expectedText){
  mem[0x1FE]=0xFF;mem[0x1FF]=0xFE;
  cpu.setState({pc:address,sp:0xFD,p:0x24,a:0,x:0,y:0});
  let reached=false,initSeen=false;
  for(let i=0;i<400000;i++){
   const pc=cpu.watch().pc;
   if(pc===0x1EF3)initSeen=true;
   if(pc===0xFF00){reached=true;break;}
   cpu.cycle();ctx.io.tick();
  }
  assert.ok(reached,expectedText+' did not return to BASIC');
  return {initSeen};
 }
 callAt(asm.symbols.BG_STOP,'STOP');
 assert.deepEqual(Array.from(mem.subarray(0x8000,0x8020)),codeBefore,
  'STOP does not modify permanent parser');
 assert.equal(ctx.card.getTimerState().enabled,false);
 assert.equal(mem[asm.symbols.BG_ACTIVE],0);
 assert.equal(mem[asm.symbols.BG_REPLAY_READY],1);
 assert.equal(mem[asm.symbols.BG_SELECTED],2,'original subtune 3 saved as zero-based 2');
 const before=r.sidWrites.length;
 const restarted=callAt(asm.symbols.BG_REPLAY,'native replay');
 assert.equal(restarted.initSeen,true,'resident replay must execute original INIT again');
 assert.deepEqual(Array.from(mem.subarray(0x8000,0x8020)),codeBefore,
  'replay never modifies permanent parser code');
 assert.equal(mem[asm.symbols.BG_ACTIVE],1);
 assert.equal(ctx.card.getTimerState().enabled,true);
 assert.equal(cpu.watch().p&4,0);
 cpu.setState({pc:0x5000,sp:0xFF,p:cpu.watch().p,a:0,x:0,y:0});
 const count=mem[asm.symbols.BG_IRQ_LO]+256*mem[asm.symbols.BG_IRQ_HI];
 for(let i=0;i<65000;i++){cpu.cycle();ctx.io.tick();}
 const now=mem[asm.symbols.BG_IRQ_LO]+256*mem[asm.symbols.BG_IRQ_HI];
 assert.ok(now>count,'IRQ playback resumes after native resident reinitialization');
 assert.ok(r.sidWrites.length>before,'PLAY writes continue after restart');
});

test('single DOS3.3 BLOAD image has one origin and correct 4-byte binary header',()=>{
 const b=builder.assemble(),content=builder.makeDOSBinary(b.player);
 assert.equal(b.start,0x8000);
 assert.equal(content.readUInt16LE(0),0x8000);
 assert.equal(content.readUInt16LE(2),b.player.length);
 assert.deepEqual(content.subarray(4),b.player);
 assert.ok(b.player.length<0x1400,'single BLOAD player must remain below $9400');
 assert.ok(!b.player.subarray(0xFF0,0xFF4).equals(Buffer.alloc(4)));
});
test('native next-subtune command uses resident metadata without loader or PSID upload',()=>{
 const r=run(psid,{foregroundTicks:80000}),{mem,cpu,asm,ctx}=r;
 const call=(pc)=>{
  mem[0x1FE]=0xFF;mem[0x1FF]=0xFE;
  cpu.setState({pc,sp:0xFD,p:0x24,a:0,x:0,y:0});
  for(let i=0;i<370000;i++){
    if(cpu.watch().pc===0xFF00)return;
    cpu.cycle();ctx.io.tick();
  }
  assert.fail('native resident operation hung at $'+cpu.watch().pc.toString(16));
 };
 const original=mem[asm.symbols.BG_SELECTED];
 assert.equal(original,2);
 call(asm.symbols.BG_NEXT_SUBTUNE);
 assert.equal(mem[asm.symbols.BG_SELECTED],3);
 assert.equal(ctx.card.getTimerState().enabled,true);
 assert.equal(mem[asm.symbols.BG_ACTIVE],1);
});
