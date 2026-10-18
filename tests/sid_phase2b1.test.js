'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const build=require('../tools/SID_Phase2B1_build.js');
const ROOT=path.resolve(__dirname,'..');
function psid({version=2,load=0x2000,body=Uint8Array.from([0x8D,0x00,0xD4,0x60]),init=load,
               play=load, songs=2,first=1,clock='PAL',speed=0,embedded=false}={}){
  const off=version===1?0x76:0x7C;
  const b=Buffer.alloc(off+(embedded?2:0)+body.length);
  b.write('PSID',0,'ascii');b.writeUInt16BE(version,4);
  b.writeUInt16BE(off,6);b.writeUInt16BE(embedded?0:load,8);
  b.writeUInt16BE(init,10);b.writeUInt16BE(play,12);
  b.writeUInt16BE(songs,14);b.writeUInt16BE(first,16);
  b.writeUInt32BE(speed>>>0,18);b.write('Phase2B.1',22,'ascii');
  if(version===2)b.writeUInt16BE(clock==='PAL'?4:clock==='NTSC'?8:0,0x76);
  if(embedded){b[off]=load&255;b[off+1]=load>>>8;}
  b.set(body,off+(embedded?2:0));
  return b;
}
function cpuRig({load=0x2000,subtune=2,period='PAL',slot=4,stagedAt=0xA000}={}){
  // INIT stores selected song A at $0200 and exits.
  // PLAY increments $0201 and writes its value to $D400.
  const payload=Uint8Array.from([
    0x8D,0x00,0x02,0x60,
    0xEE,0x01,0x02,0xAD,0x01,0x02,0x8D,0x00,0xD4,0x60
  ]);
  const original=psid({load,body:payload,init:load,play:load+4,clock:period,songs:3,first:2});
  const mem=new Uint8Array(65536);
  mem.set(original,stagedAt);
  const prepared=build.installStaged(mem,stagedAt,original.length,{subtune});
  const before=Uint8Array.from({length:256},(_,i)=>(i*19+7)&255);
  mem.set(before,0);
  mem[0x1FE]=255;mem[0x1FF]=254;
  const ctx=vm.createContext({console,Uint8Array,Float32Array,oEMU:{component:{CPU:{}}}});
  vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_cpu6502.js'),'utf8'),ctx);
  let ticks=0,latched=0,reg=0,reads=0,done=false;
  const entry=[],sidWrites=[];
  const slotBase=0xC080+16*slot;
  const cpu=new ctx.Cpu6502({
    irq_signal:0,nmi_signal:0,
    read(a){
      if(a>=0xC090&&a<=0xC0F0&&(a&15)===0)return a===slotBase?0x53:0xFF;
      if(a===slotBase+3){if(reg===0x1E){latched=ticks&0xFFFF;return latched&255;}
        if(reg===0x1F)return (latched>>8)&255;return 0xFF;}
      if(a===0xC000)return ++reads>10?0x80:0;
      if(a===0xC010)return 0;
      if(a>=0xD000)return 0xEA;
      return mem[a&65535];
    },
    write(a,v){if(a===slotBase+2)reg=v&31;
      else if(a>=0xD400&&a<=0xD41F)sidWrites.push([a,v&255]);
      else if(a<0xC000)mem[a]=v&255;},
    lineDecode:a=>a>>12
  });
  cpu.reset();cpu.setState({pc:build.BASE,sp:0xFD,p:0x20});
  cpu.setExecutionTrap(0xFF00,()=>{done=true;return true});
  let wasPlay=false;
  while(!done&&ticks<500000){
    let play=cpu.watch().pc===load+4;
    if(play&&!wasPlay)entry.push(ticks);
    wasPlay=play;
    cpu.cycle();ticks++;
  }
  return {done,ticks,entry,sidWrites,prepared,before,mem};
}
test('PSID v1/v2 headers, fixed and embedded load addresses, 50/60Hz, and any RAM staging',()=>{
  for(const ver of [1,2])for(const start of [0x0000,0x1400,0xA000,0xF000]){
    const file=psid({version:ver,embedded:true,load:0x2100});
    const ram=new Uint8Array(65536);
    ram.set(file,start);
    const p=build.installStaged(ram,start,file.length);
    assert.equal(p.entry,0x1C00);
    assert.equal(p.music.address,0x2100);
    assert.equal(p.music.bytes.length,4);
    assert.deepEqual(Array.from(ram.subarray(0x2100,0x2104)),[0x8D,0x00,0xD4,0x60]);
    assert.equal(p.meta.period,20436);
  }
  const ntsc=build.plan(psid({clock:'NTSC',load:0x8F00}),{subtune:2});
  assert.equal(ntsc.meta.period,17030);
  assert.equal(ntsc.meta.subtune,2);
  assert.equal(ntsc.driver.bytes[ntsc.driver.bytes.length-7],0x86); // checked below
});
test('reserve $1C00-$1FFF for player and allow full 28 KiB $2000-$8FFF payload',()=>{
  const body=new Uint8Array(0x7000);body.set([0x60,0x60],0);
  const r=build.plan(psid({load:0x2000,body,init:0x2000,play:0x2001}));
  assert.equal(r.music.bytes.length,28672);
  assert.equal(r.music.address+r.music.bytes.length,0x9000);
  assert.ok(r.driver.bytes.length<=0x400);
  const ram=new Uint8Array(65536);
  build.install(ram,psid({load:0x2000,body,init:0x2000,play:0x2001}));
  assert.equal(ram[0x8FFF],0);
  assert.equal(ram[0x2000],0x60);
});
test('strictly reject ROM, ZP, unsafe music windows and unsupported C64 dependencies',()=>{
  for(const a of [0x0000,0x0CA0,0x1C00,0x8FFF,0xA000,0xD000]){
    assert.throws(()=>build.plan(psid({load:a,init:a,play:a})),/outside \$2000-\$8FFF/);
  }
  assert.throws(()=>build.plan(psid({load:0x8800,body:new Uint8Array(4096)})),/outside/);
  assert.throws(()=>build.plan(psid({speed:1})),/CIA-timed/);
  const rsid=psid();rsid.write('RSID',0);assert.throws(()=>build.plan(rsid),/RSID/);
  assert.throws(()=>build.plan(psid({play:0})),/PLAY=0/);
  assert.throws(()=>build.plan(psid({init:0x1000})),/INIT/);
  assert.throws(()=>build.plan(psid(),{subtune:3}),/outside song range/);
});
test('real 6502 runs original loaded code at different locations and restores original zero page',()=>{
  for(const [load,clock,slot] of [[0x2000,'PAL',4],[0x4600,'PAL',1],[0x8E00,'NTSC',7]]){
    const r=cpuRig({load,period:clock,slot});
    assert.ok(r.done,'CPU loop should exit on keypress');
    assert.equal(r.mem[0x200],1,'zero-based selected subtune 2 passed in A');
    assert.equal(r.sidWrites.length,r.entry.length+4,'PLAY writes plus four final mute writes');
    assert.deepEqual(Array.from(r.mem.subarray(0,256)),Array.from(r.before));
    const intervals=r.entry.slice(1).map((t,i)=>t-r.entry[i]);
    const desired=clock==='PAL'?20436:17030;
    assert.ok(Math.abs(intervals.reduce((a,b)=>a+b,0)/intervals.length-desired)<20,
      'PLAY must use requested 50/60 Hz clock');
  }
});
