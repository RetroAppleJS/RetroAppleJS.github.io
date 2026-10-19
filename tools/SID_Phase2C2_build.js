'use strict';
// Native SID player assembler. The .S file is the only player source of truth.
// No browser JavaScript PSID interpreter or playback implementation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const SOURCE=path.join(ROOT,'asm/AUDIO/SID_PHASE2C2_BACKGROUND_PLAYER.S');
const ASM_CORE=path.join(ROOT,'res/ASM_core.js');
function assemble(){
 const ctx=vm.createContext({console});
 vm.runInContext(fs.readFileSync(ASM_CORE,'utf8'),ctx,{filename:ASM_CORE});
 const a=new ctx.ASM({dialect:'raJS'}).assemble(fs.readFileSync(SOURCE,'utf8'));
 if(a.errors.length)throw Error(a.errors.map(x=>x.err||JSON.stringify(x)).join('\n'));
 const specs=[
  {name:'frontend',start:0x1000,limit:0x1C00},
  {name:'runtime',start:0x9000,limit:0x9400}
 ];
 const images={},addrSet=new Set();
 for(const x of a.bytes){
  if(addrSet.has(x.pc))throw Error('Duplicate assembly byte at $'+x.pc.toString(16));
  addrSet.add(x.pc);
  if(!specs.some(s=>x.pc>=s.start&&x.pc<s.limit))
   throw Error('Native player byte outside approved RAM: $'+x.pc.toString(16));
 }
 for(const p of specs){
  const list=a.bytes.filter(x=>x.pc>=p.start&&x.pc<p.limit);
  if(!list.length)throw Error('Missing native player segment '+p.name);
  const end=Math.max(...list.map(x=>x.pc))+1;
  const buf=Buffer.alloc(end-p.start);
  for(const x of list)buf[x.pc-p.start]=x.val;
  images[p.name]=buf;
  images[p.name+'End']=end;
 }
 if(images.frontendEnd>0x1C00||images.runtimeEnd>0x9400)
    throw Error('Native code overlaps reserved memory');
 for(const [name,region] of [['IRQ_HANDLER',[0x9300,0x93E0]],
                            ['BG_OLD_IRQ',[0x93E0,0x93F0]]]){
  const at=a.symtab[name];
  if(!(at>=region[0]&&at<region[1]))
   throw Error(name+' outside allocated resident section');
 }
 if(a.symtab.BG_ACTIVE>=0x9400)throw Error('IRQ state reaches music shadow');
 for(const name of ['NATIVE_ENTRY','BG_REPLAY','BG_STOP','BG_NEXT_SUBTUNE']){
  const pc=a.symtab[name];
  if(!Number.isInteger(pc)||
     (name==='NATIVE_ENTRY'?(pc!==0x1000):(pc<0x9000||pc>=0x9300)))
   throw Error('Invalid callable native '+name+' entry at 
 return {...images,symbols:a.symtab,source:SOURCE};
}
function listing(bytes,start){
 const rows=['CALL-151'];
 for(let i=0;i<bytes.length;i+=8)
  rows.push((start+i).toString(16).toUpperCase().padStart(4,'0')+': '+
   Array.from(bytes.subarray(i,i+8),v=>v.toString(16).toUpperCase().padStart(2,'0')).join(' '));
 return rows.join('\n')+'\n';
}
function main(dir=path.join(ROOT,'tools/music')){
 const built=assemble();
 fs.mkdirSync(dir,{recursive:true});
 for(const [part,start] of [['frontend',0x1000],['runtime',0x9000]]){
  fs.writeFileSync(path.join(dir,'SID_Phase2C2_'+part+'.bin'),built[part]);
  fs.writeFileSync(path.join(dir,'SID_Phase2C2_'+part+'_monitor.txt'),listing(built[part],start));
 }
 const manifest={
  source:path.relative(ROOT,SOURCE),
  entry:'
  frontend:'$1000-$'+(built.frontendEnd-1).toString(16).toUpperCase(),
  runtime:'$9000-$'+(built.runtimeEnd-1).toString(16).toUpperCase(),
  musicZeroPage:'$9400-$94FF',foregroundZeroPage:'$9500-$95FF',
  prontoDOSReservedFrom:'$9600',
  startCall:built.symbols.NATIVE_ENTRY,replayCall:built.symbols.BG_REPLAY,
  stopCall:built.symbols.BG_STOP,nextSubtuneCall:built.symbols.BG_NEXT_SUBTUNE,
  irqCountLow:built.symbols.BG_IRQ_LO,irqCountHigh:built.symbols.BG_IRQ_HI
 };
 fs.writeFileSync(path.join(dir,'SID_Phase2C2_manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(manifest);
}
if(require.main===module)main(process.argv[2]);
module.exports={assemble,listing,main,SOURCE};
+built.symbols.NATIVE_ENTRY.toString(16).toUpperCase(),
  replay:'
  frontend:'$1000-$'+(built.frontendEnd-1).toString(16).toUpperCase(),
  runtime:'$9000-$'+(built.runtimeEnd-1).toString(16).toUpperCase(),
  musicZeroPage:'$9400-$94FF',foregroundZeroPage:'$9500-$95FF',
  prontoDOSReservedFrom:'$9600',startCall:7168,stopCall:36867,
  irqCountLow:built.symbols.BG_IRQ_LO,irqCountHigh:built.symbols.BG_IRQ_HI
 };
 fs.writeFileSync(path.join(dir,'SID_Phase2C2_manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(manifest);
}
if(require.main===module)main(process.argv[2]);
module.exports={assemble,listing,main,SOURCE};
+built.symbols.BG_REPLAY.toString(16).toUpperCase(),
  stop:'
  frontend:'$1000-$'+(built.frontendEnd-1).toString(16).toUpperCase(),
  runtime:'$9000-$'+(built.runtimeEnd-1).toString(16).toUpperCase(),
  musicZeroPage:'$9400-$94FF',foregroundZeroPage:'$9500-$95FF',
  prontoDOSReservedFrom:'$9600',startCall:7168,stopCall:36867,
  irqCountLow:built.symbols.BG_IRQ_LO,irqCountHigh:built.symbols.BG_IRQ_HI
 };
 fs.writeFileSync(path.join(dir,'SID_Phase2C2_manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(manifest);
}
if(require.main===module)main(process.argv[2]);
module.exports={assemble,listing,main,SOURCE};
+built.symbols.BG_STOP.toString(16).toUpperCase(),
  nextSubtune:'
  frontend:'$1000-$'+(built.frontendEnd-1).toString(16).toUpperCase(),
  runtime:'$9000-$'+(built.runtimeEnd-1).toString(16).toUpperCase(),
  musicZeroPage:'$9400-$94FF',foregroundZeroPage:'$9500-$95FF',
  prontoDOSReservedFrom:'$9600',startCall:7168,stopCall:36867,
  irqCountLow:built.symbols.BG_IRQ_LO,irqCountHigh:built.symbols.BG_IRQ_HI
 };
 fs.writeFileSync(path.join(dir,'SID_Phase2C2_manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(manifest);
}
if(require.main===module)main(process.argv[2]);
module.exports={assemble,listing,main,SOURCE};
+built.symbols.BG_NEXT_SUBTUNE.toString(16).toUpperCase(),
  frontend:'$1000-$'+(built.frontendEnd-1).toString(16).toUpperCase(),
  runtime:'$9000-$'+(built.runtimeEnd-1).toString(16).toUpperCase(),
  musicZeroPage:'$9400-$94FF',foregroundZeroPage:'$9500-$95FF',
  prontoDOSReservedFrom:'$9600',startCall:7168,stopCall:36867,
  irqCountLow:built.symbols.BG_IRQ_LO,irqCountHigh:built.symbols.BG_IRQ_HI
 };
 fs.writeFileSync(path.join(dir,'SID_Phase2C2_manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(manifest);
}
if(require.main===module)main(process.argv[2]);
module.exports={assemble,listing,main,SOURCE};
+String(pc));
 }
 if(a.bytes.some(x=>x.pc>=0x1C00&&x.pc<=0x1C0B))
  throw Error('The assembler must not put player code into original C64 $1C00');
 return {...images,symbols:a.symtab,source:SOURCE};
}
function listing(bytes,start){
 const rows=['CALL-151'];
 for(let i=0;i<bytes.length;i+=8)
  rows.push((start+i).toString(16).toUpperCase().padStart(4,'0')+': '+
   Array.from(bytes.subarray(i,i+8),v=>v.toString(16).toUpperCase().padStart(2,'0')).join(' '));
 return rows.join('\n')+'\n';
}
function main(dir=path.join(ROOT,'tools/music')){
 const built=assemble();
 fs.mkdirSync(dir,{recursive:true});
 for(const [part,start] of [['frontend',0x1000],['runtime',0x9000]]){
  fs.writeFileSync(path.join(dir,'SID_Phase2C2_'+part+'.bin'),built[part]);
  fs.writeFileSync(path.join(dir,'SID_Phase2C2_'+part+'_monitor.txt'),listing(built[part],start));
 }
 const manifest={
  source:path.relative(ROOT,SOURCE),
  entry:'
  frontend:'$1000-$'+(built.frontendEnd-1).toString(16).toUpperCase(),
  runtime:'$9000-$'+(built.runtimeEnd-1).toString(16).toUpperCase(),
  musicZeroPage:'$9400-$94FF',foregroundZeroPage:'$9500-$95FF',
  prontoDOSReservedFrom:'$9600',
  startCall:built.symbols.NATIVE_ENTRY,replayCall:built.symbols.BG_REPLAY,
  stopCall:built.symbols.BG_STOP,nextSubtuneCall:built.symbols.BG_NEXT_SUBTUNE,
  irqCountLow:built.symbols.BG_IRQ_LO,irqCountHigh:built.symbols.BG_IRQ_HI
 };
 fs.writeFileSync(path.join(dir,'SID_Phase2C2_manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(manifest);
}
if(require.main===module)main(process.argv[2]);
module.exports={assemble,listing,main,SOURCE};
+built.symbols.NATIVE_ENTRY.toString(16).toUpperCase(),
  replay:'
  frontend:'$1000-$'+(built.frontendEnd-1).toString(16).toUpperCase(),
  runtime:'$9000-$'+(built.runtimeEnd-1).toString(16).toUpperCase(),
  musicZeroPage:'$9400-$94FF',foregroundZeroPage:'$9500-$95FF',
  prontoDOSReservedFrom:'$9600',startCall:7168,stopCall:36867,
  irqCountLow:built.symbols.BG_IRQ_LO,irqCountHigh:built.symbols.BG_IRQ_HI
 };
 fs.writeFileSync(path.join(dir,'SID_Phase2C2_manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(manifest);
}
if(require.main===module)main(process.argv[2]);
module.exports={assemble,listing,main,SOURCE};
+built.symbols.BG_REPLAY.toString(16).toUpperCase(),
  stop:'
  frontend:'$1000-$'+(built.frontendEnd-1).toString(16).toUpperCase(),
  runtime:'$9000-$'+(built.runtimeEnd-1).toString(16).toUpperCase(),
  musicZeroPage:'$9400-$94FF',foregroundZeroPage:'$9500-$95FF',
  prontoDOSReservedFrom:'$9600',startCall:7168,stopCall:36867,
  irqCountLow:built.symbols.BG_IRQ_LO,irqCountHigh:built.symbols.BG_IRQ_HI
 };
 fs.writeFileSync(path.join(dir,'SID_Phase2C2_manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(manifest);
}
if(require.main===module)main(process.argv[2]);
module.exports={assemble,listing,main,SOURCE};
+built.symbols.BG_STOP.toString(16).toUpperCase(),
  nextSubtune:'
  frontend:'$1000-$'+(built.frontendEnd-1).toString(16).toUpperCase(),
  runtime:'$9000-$'+(built.runtimeEnd-1).toString(16).toUpperCase(),
  musicZeroPage:'$9400-$94FF',foregroundZeroPage:'$9500-$95FF',
  prontoDOSReservedFrom:'$9600',startCall:7168,stopCall:36867,
  irqCountLow:built.symbols.BG_IRQ_LO,irqCountHigh:built.symbols.BG_IRQ_HI
 };
 fs.writeFileSync(path.join(dir,'SID_Phase2C2_manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(manifest);
}
if(require.main===module)main(process.argv[2]);
module.exports={assemble,listing,main,SOURCE};
+built.symbols.BG_NEXT_SUBTUNE.toString(16).toUpperCase(),
  frontend:'$1000-$'+(built.frontendEnd-1).toString(16).toUpperCase(),
  runtime:'$9000-$'+(built.runtimeEnd-1).toString(16).toUpperCase(),
  musicZeroPage:'$9400-$94FF',foregroundZeroPage:'$9500-$95FF',
  prontoDOSReservedFrom:'$9600',startCall:7168,stopCall:36867,
  irqCountLow:built.symbols.BG_IRQ_LO,irqCountHigh:built.symbols.BG_IRQ_HI
 };
 fs.writeFileSync(path.join(dir,'SID_Phase2C2_manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(manifest);
}
if(require.main===module)main(process.argv[2]);
module.exports={assemble,listing,main,SOURCE};
