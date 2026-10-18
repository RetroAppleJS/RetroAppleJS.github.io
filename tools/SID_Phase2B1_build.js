#!/usr/bin/env node
'use strict';
// Phase 2B.1: conservative, unmodified native PSID execution on Apple II.
// The staged PSID *file* may be read from any RAM address; the executable
// has its own PSID-declared absolute load address and is never relocated.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),BASE=0x1C00,MIN=0x2000,END=0x9000;
const DRIVER=path.join(ROOT,'asm/AUDIO/SID_PHASE2B1_PLAYER.S');
const ASM=path.join(ROOT,'res/ASM_core.js');
function fail(message){throw new Error('PSID incompatible: '+message);}
function u16(a,i){return (a[i]<<8)|a[i+1];}
function info(bytes,{subtune,clock}={}){
  bytes=Uint8Array.from(bytes);
  if(bytes.length<0x76)fail('truncated header');
  const sig=String.fromCharCode(...bytes.subarray(0,4));
  if(sig!=='PSID')fail(sig==='RSID'?'RSID requires a C64 environment':'not a PSID file');
  const version=u16(bytes,4),off=u16(bytes,6);
  if(version!==1&&version!==2)fail('PSID v'+version+' is not supported by Phase 2B.1');
  if(off<(version===1?0x76:0x7C)||off>=bytes.length)fail('invalid data offset');
  const songs=u16(bytes,14),first=u16(bytes,16);
  if(songs<1||first<1||first>songs||songs>256)fail('invalid subtune count');
  const selected=subtune===undefined?first:subtune;
  if(!Number.isInteger(selected)||selected<1||selected>songs)fail('subtune outside song range');
  const speed=((bytes[18]*0x1000000)+(bytes[19]<<16)+(bytes[20]<<8)+bytes[21])>>>0;
  if(((speed>>>Math.min(selected-1,31))&1)!==0)
    fail('CIA-timed subtune requires emulated CIA timer support');
  let load=u16(bytes,8),dataAt=off;
  if(load===0){
    if(bytes.length-off<3)fail('missing embedded PRG load address');
    load=bytes[off]|(bytes[off+1]<<8);dataAt+=2;
  }
  const payload=bytes.subarray(dataAt),end=load+payload.length;
  if(!payload.length)fail('empty music program');
  if(load<MIN||end>END)fail('original load range $'+load.toString(16)+'-$'+(end-1).toString(16)+' is outside $2000-$8FFF; code cannot safely be relocated');
  const init=u16(bytes,10)||load,play=u16(bytes,12);
  if(init<load||init>=end)fail('INIT is not inside executable payload');
  if(play<load||play>=end)fail('PLAY=0 or PLAY outside payload requires unsupported C64 interrupt environment');
  let suggested='PAL';
  if(version>=2){
    const flags=u16(bytes,0x76);
    const chipClock=(flags>>2)&3;
    if(chipClock===2)suggested='NTSC';
  }
  const selectedClock=clock||suggested;
  if(selectedClock!=='PAL'&&selectedClock!=='NTSC')fail('clock must be PAL or NTSC');
  // The Apple II nominal host clock is 1,021,800 Hz; NTSC 60 Hz=17030 ticks.
  const period=selectedClock==='PAL'?20436:17030;
  const title=Array.from(bytes.subarray(0x16,0x36)).map(c=>c>=32&&c<127?String.fromCharCode(c):'').join('').replace(/\0/g,'').trim();
  return {version,title,songs,subtune:selected,clock:selectedClock,period,
    load,end,init,play,data:payload,dataOffset:dataAt,sourceLength:bytes.length};
}
function assembler(){
  const c=vm.createContext({console});
  vm.runInContext(fs.readFileSync(ASM,'utf8'),c);
  const p=new c.ASM({dialect:'raJS'}).assemble(fs.readFileSync(DRIVER,'utf8'));
  if(p.errors.length)throw Error(p.errors.map(e=>e.err||JSON.stringify(e)).join('\n'));
  const out=Uint8Array.from(p.bytes.map(b=>b.val));
  if(p.bytes.some((b,i)=>b.pc!==BASE+i))throw Error('noncontiguous player image');
  if(BASE+out.length>MIN)throw Error('player exceeds reserved $1C00-$1FFF area');
  return {bytes:out,symbols:p.symtab};
}
function plan(file,options={}){
  const parsed=info(file,options),a=assembler(),program=Uint8Array.from(a.bytes);
  const put=(sym,offset,value)=>{const index=a.symbols[sym]-BASE+offset;
    if(index<0||index>=program.length)throw Error('player symbol not present: '+sym);
    program[index]=value&255;};
  put('SONG_SELECT',1,parsed.subtune-1);
  for(const [sym,addr] of [['INIT_CALL',parsed.init],['PLAY_CALL',parsed.play]]){
    put(sym,1,addr&255);put(sym,2,addr>>8);
  }
  put('PERIODLO',0,parsed.period&255);
  put('PERIODHI',0,parsed.period>>8);
  return {meta:parsed,entry:BASE,driver:{address:BASE,bytes:program},
    music:{address:parsed.load,bytes:Uint8Array.from(parsed.data)},
    statusAddress:a.symbols.ERRORCD};
}
function install(ram,file,options={}){
  if(!(ram instanceof Uint8Array)||ram.length!==65536)
    throw new TypeError('install needs a 65536-byte physical RAM Uint8Array');
  // Parse, validate and fully copy both images BEFORE modifying RAM:
  // the staged PSID can overlap its destination or the player.
  const prepared=plan(file,options);
  ram.set(prepared.music.bytes,prepared.music.address);
  ram.set(prepared.driver.bytes,prepared.driver.address);
  return prepared;
}
function installStaged(ram,stagedAt,length,options={}){
  if(!(ram instanceof Uint8Array)||ram.length!==65536)throw new TypeError('64K RAM required');
  if(!Number.isInteger(stagedAt)||!Number.isInteger(length)||length<=0||
     stagedAt<0||stagedAt+length>ram.length)throw new RangeError('staged PSID must fit in RAM');
  return install(ram,ram.slice(stagedAt,stagedAt+length),options);
}
function monitorHex(bytes,load){
  const lines=['CALL-151'];
  for(let i=0;i<bytes.length;i+=16)lines.push((load+i).toString(16).toUpperCase().padStart(4,'0')+
    ': '+Array.from(bytes.subarray(i,i+16),b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' '));
  return lines.join('\n')+'\n';
}
if(require.main===module){
  const file=process.argv[2],out=process.argv[3]||process.cwd();
  if(!file)throw Error('Usage: node tools/SID_Phase2B1_build.js tune.sid [output-dir]');
  const built=plan(fs.readFileSync(file));
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'SID_Phase2B1_player.bin'),built.driver.bytes);
  fs.writeFileSync(path.join(out,'SID_Phase2B1_music.bin'),built.music.bytes);
  fs.writeFileSync(path.join(out,'SID_Phase2B1_player_monitor.txt'),monitorHex(built.driver.bytes,BASE));
  fs.writeFileSync(path.join(out,'SID_Phase2B1_music_monitor.txt'),monitorHex(built.music.bytes,built.music.address));
  console.log(built.meta.title+' ('+built.meta.clock+'): player $1C00, music $'+built.meta.load.toString(16)+', CALL 7168');
}
module.exports={info,assembler,plan,install,installStaged,monitorHex,BASE,MIN,END};
