'use strict';
// Assemble only; the Apple II program and timer protocol live in authoritative .S.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const SOURCE=path.join(ROOT,'asm/AUDIO/SID_PHASE2C1_IRQ_TIMER.S');
function assemble(){
 const ctx=vm.createContext({console});
 vm.runInContext(fs.readFileSync(path.join(ROOT,'res/ASM_core.js'),'utf8'),ctx);
 const a=new ctx.ASM({dialect:'raJS'}).assemble(fs.readFileSync(SOURCE,'utf8'));
 if(a.errors.length)throw Error(a.errors.map(x=>x.err||JSON.stringify(x)).join('\n'));
 const chunks=[[0x1800,0x1C00],[0x9300,0x9400]],bytes=a.bytes;
 const result={source:SOURCE,symbols:a.symtab};
 for(let n=0;n<chunks.length;n++){
   const [start,limit]=chunks[n],part=bytes.filter(x=>x.pc>=start&&x.pc<limit);
   if(!part.length)throw Error('Missing segment at '+start.toString(16));
   const end=Math.max(...part.map(x=>x.pc))+1;
   const buffer=Buffer.alloc(end-start);
   const seen=new Set();
   for(const x of part){
     if(seen.has(x.pc))throw Error('Duplicate emitted byte '+x.pc.toString(16));
     seen.add(x.pc);buffer[x.pc-start]=x.val;
   }
   if(seen.size!==buffer.length)throw Error('Gap in assembled segment at $'+start.toString(16));
   result[n===0?'installer':'resident']=buffer;
   result[n===0?'installerEnd':'residentEnd']=end;
 }
 if(bytes.length!==result.installer.length+result.resident.length)
     throw Error('Assembly emitted bytes outside allowed $1800/$9300 segments');
 if(result.installerEnd>0x1C00||result.residentEnd>0x9400)
     throw Error('Phase 2C.1 crossed protected RAM boundary');
 return result;
}
function format(bytes,base){
 let out=['CALL-151'];
 for(let i=0;i<bytes.length;i+=8)
  out.push((base+i).toString(16).toUpperCase().padStart(4,'0')+': '+
   Array.from(bytes.subarray(i,i+8),x=>x.toString(16).toUpperCase().padStart(2,'0')).join(' '));
 return out.join('\n')+'\n';
}
function main(outDir=path.join(ROOT,'tools/music')){
 let p=assemble();
 fs.mkdirSync(outDir,{recursive:true});
 for(const [part,base] of [['installer',0x1800],['resident',0x9300]]){
  fs.writeFileSync(path.join(outDir,'SID_Phase2C1_'+part+'.bin'),p[part]);
  fs.writeFileSync(path.join(outDir,'SID_Phase2C1_'+part+'_monitor.txt'),format(p[part],base));
 }
 const manifest={source:path.relative(ROOT,p.source),
  installer:'$1800–$'+(p.installerEnd-1).toString(16).toUpperCase(),
  resident:'$9300–$'+(p.residentEnd-1).toString(16).toUpperCase(),
  call50Hz:6144,call60Hz:6147,callStop:6150,
  irqCountLow:0x93F3,irqCountHigh:0x93F4,softIRQVector:0x03FE};
 fs.writeFileSync(path.join(outDir,'SID_Phase2C1_manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(manifest);
}
if(require.main===module)main(process.argv[2]);
module.exports={assemble,format,main,SOURCE};
