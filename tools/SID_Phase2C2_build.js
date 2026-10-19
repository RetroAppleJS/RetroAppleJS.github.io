'use strict';
// Single-load native SID player. The .S file remains the only source of truth.
// The output is one contiguous $8000-origin Apple II+ image, despite ORG gaps.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const SOURCE=path.join(ROOT,'asm/AUDIO/SID_PHASE2C2_BACKGROUND_PLAYER.S');
const ASM_CORE=path.join(ROOT,'res/ASM_core.js');
const START=0x8000,LIMIT=0x9400,MAGIC_AT=0x8FF0;
function assemble(){
 const ctx=vm.createContext({console});
 vm.runInContext(fs.readFileSync(ASM_CORE,'utf8'),ctx,{filename:ASM_CORE});
 const a=new ctx.ASM({dialect:'raJS'}).assemble(fs.readFileSync(SOURCE,'utf8'));
 if(a.errors.length)throw Error(a.errors.map(x=>x.err||JSON.stringify(x)).join('\n'));
 if(!a.bytes.length)throw Error('Assembly produced no bytes');
 const addresses=new Set();
 let end=START;
 for(const x of a.bytes){
  if(x.pc<START||x.pc>=LIMIT)
   throw Error('Player emits byte outside $8000-$93FF: $'+x.pc.toString(16));
  if(addresses.has(x.pc))throw Error('Duplicate code byte at $'+x.pc.toString(16));
  addresses.add(x.pc);end=Math.max(end,x.pc+1);
 }
 const player=Buffer.alloc(end-START,0);
 for(const x of a.bytes)player[x.pc-START]=x.val;
 if(!player.subarray(MAGIC_AT-START,MAGIC_AT-START+4).equals(Buffer.from('S2C2')))
  throw Error('Missing $8FF0 installed-player marker');
 if(a.symtab.NATIVE_ENTRY!==START)throw Error('First-load entry is not $8000');
 for(const [name,min,max] of [['BG_REPLAY',0x9000,0x9300],
                              ['BG_STOP',0x9000,0x93E0],
                              ['BG_NEXT_SUBTUNE',0x9000,0x9300],
                              ['IRQ_HANDLER',0x9300,0x93E0],
                              ['BG_OLD_IRQ',0x93E0,0x9400]]){
   const addr=a.symtab[name];
   if(!Number.isInteger(addr)||addr<min||addr>=max)
    throw Error('Unsafe resident symbol '+name+' at $'+addr?.toString(16));
 }
 if(a.bytes.some(x=>x.pc>=0x1C00&&x.pc<0x1C0C))
  throw Error('Unexpected $1C00 bootstrap');
 return {player,start:START,end,symbols:a.symtab,source:SOURCE,
         assembledBytes:a.bytes.length,paddingBytes:player.length-a.bytes.length};
}
function monitorListing(img,start=START){
 const lines=['CALL-151'];
 for(let i=0;i<img.length;i+=8)
  lines.push((start+i).toString(16).toUpperCase().padStart(4,'0')+': '+
   Array.from(img.subarray(i,i+8),x=>x.toString(16).toUpperCase().padStart(2,'0')).join(' '));
 return lines.join('\n')+'\n';
}
function makeDOSBinary(img,start=START){
 // DOS 3.3 Binary file CONTENTS start with little-endian load address and
 // byte count. The disk catalog entry must have file type B; a disk import
 // tool may add this header itself (avoid duplicating it).
 if(img.length>0xFFFF)throw Error('Binary file exceeds DOS word length');
 const header=Buffer.alloc(4);
 header.writeUInt16LE(start,0);header.writeUInt16LE(img.length,2);
 return Buffer.concat([header,img]);
}
function main(dir=path.join(ROOT,'tools/music')){
 const p=assemble(),out=path.resolve(dir);fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'SID_Phase2C2_player.bin'),p.player);
 fs.writeFileSync(path.join(out,'SID_Phase2C2_DOS33_file_content.bin'),
                  makeDOSBinary(p.player,p.start));
 fs.writeFileSync(path.join(out,'SID_Phase2C2_player_monitor.txt'),
                  monitorListing(p.player,p.start));
 const manifest={
  source:path.relative(ROOT,SOURCE),
  loadAddress:'$8000',endAddress:'$'+(p.end-1).toString(16).toUpperCase(),
  imageBytes:p.player.length,assemblyBytes:p.assembledBytes,paddingBytes:p.paddingBytes,
  stagingWindow:'$6000-$7FFF (8 KiB including PSID header)',
  playerMarker:'S2C2 at $8FF0',prontoDOSProtectedFrom:'$9600',
  firstLoadCall:p.symbols.NATIVE_ENTRY,
  replayCall:p.symbols.BG_REPLAY,
  stopCall:p.symbols.BG_STOP,
  nextSubtuneCall:p.symbols.BG_NEXT_SUBTUNE,
  musicZeroPage:'$9400-$94FF',foregroundZeroPage:'$9500-$95FF'
 };
 fs.writeFileSync(path.join(out,'SID_Phase2C2_manifest.json'),
   JSON.stringify(manifest,null,2)+'\n');
 console.log(manifest);
}
if(require.main===module)main(process.argv[2]);
module.exports={assemble,monitorListing,makeDOSBinary,main,SOURCE,START,LIMIT,MAGIC_AT};
