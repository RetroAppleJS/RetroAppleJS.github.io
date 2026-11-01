#!/usr/bin/env node
'use strict';
// PAY-00.7: deterministic source manifest + executing the generated native 6502 + VIA1 IRQ regression.
const {test,before}=require('node:test'),vm=require('node:vm'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'../..'),compiler=require(path.join(root,'tools/PAY_Compiler_v07_core.js'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'tests/PAY/expected/PAY_Compiler_Regression_Manifest.json')));
const compiledReports={};
const interpreterHtml=fs.readFileSync(path.join(root,'tools/PAY_Interpreter.html'),'utf8');
const interpreterJS=interpreterHtml.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/)?.[1];
const doc=interpreterHtml.match(/<script type="text\/plain" id="fallback-doc">([\s\S]*?)<\/script>/)?.[1];
if(!interpreterJS||!doc)throw Error('PAY Interpreter .html not found / not compatible');
const els={};function element(id){return els[id]||(els[id]={value:id==='model'?'gpt-5':id==='subtune'?'1':'',textContent:id==='fallback-doc'?doc:'',disabled:false,checked:true,style:{},dataset:{},addEventListener(){},files:null});}
const context={console,window:{},document:{getElementById:element},fetch:async()=>({ok:false,status:404}),setTimeout,clearTimeout,Blob,URL,AbortController,DOMException};
vm.createContext(context);vm.runInContext(interpreterJS,context,{timeout:25000});
before(async()=>{for(const name of ['selfmod_gate','pitched','indirect_read','pay07_melody']){
 const raw=fs.readFileSync(path.join(root,'tests/PAY/fixtures',name+'.sid')),ab=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
 const h=context.window.PAYTest.parseSID(ab),stat=context.window.PAYTest.disassemble(h),t=await context.window.PAYTest.executePAYTrace(h,stat,{frames:300});const ir=context.window.PAYTest.buildPAYMusicalIR(h,t);
 if(t.summary.errors.length)throw Error(name+': '+t.summary.errors.join(', '));
 compiledReports[name]={format:'PAY_Complete_Report_v0.5.1',source:{title:h.title,magic:h.magic,sidBases:[0xd400,...h.sidBases],originalSID:{base64:raw.toString('base64')}},completeness:{runtimeAvailable:true,musicalIRAvailable:true,droppedRecords:{sidWrites:t.obs.droppedEvents||0,dataReads:t.obs.droppedDataReads||0,flowEdges:t.obs.droppedFlowEdges||0}},runtimeTrace:context.window.PAYTest.toPAYTraceJSON(h,t),musicalIR:ir};
 }});
function source(name){return structuredClone(compiledReports[name]);}
function machine(out){
 const mem=new Uint8Array(65536);mem.set(out.binary,out.entry.init);const base=out.entry.init,states=out.memory.states,via=0xc000+out.configuration.slot*256,timer=via+0x80, writes=[];
 let A=0x29,X=0x41,Y=0x83,SP=255,Z=0,C=0,P=0x24,pc=0,ora=0,orb=4,latch=0,irqFlag=false,ier=false,acr=0,irqAck=0,stackMax=0,irqCount=0;
 mem[0x3fe]=0x00;mem[0x3ff]=0xF1;mem[0xF100]=0x40; // foreign IRQ stub is RTI.
 const stateSet=new Set(Object.values(states));
 const push=v=>{mem[0x100+SP]=v&255;SP=(SP-1)&255;stackMax=Math.max(stackMax,255-SP);};
 const pop=()=>mem[0x100+(SP=(SP+1)&255)], u16=a=>mem[a]|mem[(a+1)&0xffff]<<8;
 const rd=a=>{a&=65535;if(a===timer+0xd)return irqFlag?0xc0:0;if(a===timer+4){irqFlag=false;irqAck++;return 0;}if(a===timer+0xb)return acr;return mem[a];};
 function wr(a,v){a&=65535;v&=255;if(a<256)throw Error(`PAY-owned zero page write at $${a.toString(16)}`);if(a>=base&&a<base+out.binary.length&&!stateSet.has(a))throw Error(`Executable code was modified at $${a.toString(16)}`);
  mem[a]=v;
  if(a===via+1)ora=v;else if(a===via){orb=v;if(v===7)latch=ora&15;else if(v===6)writes.push({reg:latch,val:ora});}
  if(a===timer+0xe){if(v===0xc0)ier=true;else if(v===0x40)ier=false;}if(a===timer+0xb)acr=v;
 }
 function setZ(n){Z=(n&255)===0?1:0;}
 function run(start,kind='call',maxSteps=100000,owned=true){pc=start;A=0x29;X=0x41;Y=0x83;SP=255;P=0x24;Z=0;C=0;
  if(kind==='irq'){irqFlag=owned;mem[0x45]=0x29;push(0xfd);push(0x00);push(0x24);}
  let count=0;
  for(;count<maxSteps;count++){
   const at=pc,op=rd(pc++);let a,v,d;
   switch(op){
    case 0x4c:pc=u16(pc);break;
    case 0x6c:a=u16(pc);pc=u16(a);break;
    case 0x20:a=u16(pc);pc+=2;push((pc-1)>>8);push(pc-1);pc=a;break;
    case 0x60:if(SP===255&&kind==='call'){assert.equal(A,0x29);assert.equal(X,0x41);assert.equal(Y,0x83);return count+1;}v=pop()|(pop()<<8);pc=(v+1)&65535;break;
    case 0x40:P=pop();v=pop()|(pop()<<8);pc=v;if(kind==='irq'&&pc===0xfd00){assert.equal(X,0x41);assert.equal(Y,0x83);assert.equal(A,0x29);irqCount++;return count+1;}break;
    case 0x08:push(P);break;case 0x28:P=pop();break;case 0x78:P|=4;break;case 0x58:P&=~4;break;
    case 0x48:push(A);break;case 0x68:A=pop();setZ(A);break;
    case 0x8a:A=X;setZ(A);break;case 0xaa:X=A;setZ(X);break;
    case 0x98:A=Y;setZ(A);break;case 0xa8:Y=A;setZ(Y);break;
    case 0xa9:A=rd(pc++);setZ(A);break;case 0xa2:X=rd(pc++);setZ(X);break;
    case 0xad:A=rd(u16(pc));pc+=2;setZ(A);break;case 0xae:X=rd(u16(pc));pc+=2;setZ(X);break;
    case 0x8d:wr(u16(pc),A);pc+=2;break;case 0x8e:wr(u16(pc),X);pc+=2;break;
    case 0x29:A&=rd(pc++);setZ(A);break;case 0x09:A|=rd(pc++);setZ(A);break;
    case 0xc9:v=rd(pc++);C=A>=v?1:0;setZ(A-v);break;
    case 0xcd:v=rd(u16(pc));pc+=2;C=A>=v?1:0;setZ(A-v);break;
    case 0xee:a=u16(pc);pc+=2;v=(rd(a)+1)&255;wr(a,v);setZ(v);break;
    case 0xf0:case 0xd0:case 0xb0:d=rd(pc++);if(d>127)d-=256;if(op===0xf0?Z:op===0xd0?!Z:C)pc=(pc+d)&65535;break;
    default:throw Error(`Unsupported 6502 opcode $${op.toString(16)} at $${at.toString(16)} (${kind})`);
   }
  }throw Error('6502 step limit exceeded '+kind+' @'+pc.toString(16));
 }
 return {run,mem,writes,states,sourceImage:out.binary,irq:(owned=true)=>run(mem[0x3fe]|mem[0x3ff]<<8,'irq',100000,owned),state:n=>mem[states[n]],counter:()=>mem[states.FRAME_LO]+(mem[states.FRAME_HI]<<8),ay:r=>{let v=0;for(const w of writes)if(w.reg===r)v=w.val;return v;},get owner(){return mem[0x3fe]|mem[0x3ff]<<8},get irqEnabled(){return ier},get acknowledgements(){return irqAck},get irqCount(){return irqCount},get stackMax(){return stackMax}};
}
const cases={selfmod_gate:300,pitched:300,indirect_read:300};
for(const [name,frames] of Object.entries(cases))for(const mode of ['faithful','diagnostic']){
 test(`${name} ${mode}: manifest agreement, 300 native ticks and no ZP/self-modification`,()=>{
  const r=source(name),record=manifest.sourceReports[name],raw=Buffer.from(r.source.originalSID.base64,'base64');assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),record.sourceSID_SHA256);
  assert.equal(r.runtimeTrace.summary.sidWrites,record.sidWrites);assert.equal(r.runtimeTrace.summary.selfModifyingWrites,record.codePatchWrites);assert.equal(r.runtimeTrace.summary.framesCompleted,frames);
  const out=compiler.compile(r,{mode});const cpu=machine(out);cpu.run(out.entry.init);
  const initWrites=cpu.writes.length;for(let t=0;t<frames;t++)cpu.run(out.entry.tick);
  assert.equal(cpu.counter(),300);assert.equal(cpu.writes.length-initWrites,out.metrics.registerWrites);assert.equal(out.memory.zeroPageOwnership,0);assert.deepEqual(Array.from(cpu.mem.slice(out.memory.start,out.memory.stateStart)),Array.from(out.binary.slice(0,out.memory.stateStart-out.entry.init)));
  if(mode==='faithful')assert.equal(cpu.ay(8),0);else if(name==='pitched'||name==='indirect_read'){assert.equal(cpu.ay(0)+(cpu.ay(1)<<8),name==='pitched'?133:132);assert.equal(cpu.ay(8),10);}else assert.equal(cpu.ay(8),0);
  cpu.run(out.entry.tick);assert.equal(cpu.state('PAY_DONE'),1);assert.equal(cpu.ay(8),0);
  cpu.run(out.entry.stop);assert.equal(cpu.ay(7),0x3f);
 });
}
test('resident VIA1 T1 IRQ install, 300 IRQs, foreign chaining, remove, no unauthorized ZP',()=>{
 const out=compiler.compile(source('pitched'),{mode:'diagnostic',irqHz:50,cpuHz:1023000});const cpu=machine(out);cpu.run(out.entry.init);const old=cpu.owner;cpu.run(out.entry.irqInstall);
 assert.equal(cpu.owner,out.entry.irqHandler);assert.equal(cpu.irqEnabled,true);assert.equal(cpu.state('IRQ_ACTIVE'),1);
 cpu.irq(false);assert.equal(cpu.counter(),0,'foreign interrupt must not tick PAY');assert.equal(cpu.owner,out.entry.irqHandler);for(let t=0;t<300;t++)cpu.irq();assert.equal(cpu.counter(),300);assert.equal(cpu.state('IRQ_COUNT_LO'),44);assert.equal(cpu.state('IRQ_COUNT_HI'),1);
 assert.equal(cpu.ay(0)+(cpu.ay(1)<<8),133);assert.equal(cpu.ay(8),10);assert.equal(cpu.irqCount,301);
 cpu.run(out.entry.irqRemove);assert.equal(cpu.owner,old);assert.equal(cpu.irqEnabled,false);assert.equal(cpu.state('IRQ_ACTIVE'),0);
 cpu.run(out.entry.stop);assert.equal(cpu.ay(8),0);
});
test('resident IRQ is idempotent, and removal leaves another vector owner unchanged',()=>{
 const out=compiler.compile(source('pitched'),{mode:'diagnostic'}),cpu=machine(out);cpu.run(out.entry.init);cpu.run(out.entry.irqInstall);const ptr=cpu.owner;cpu.run(out.entry.irqInstall);assert.equal(cpu.owner,ptr);
 cpu.mem[0x3fe]=0x01;cpu.mem[0x3ff]=0x70;cpu.run(out.entry.irqRemove);assert.equal(cpu.owner,0x7001);assert.equal(cpu.state('IRQ_ACTIVE'),0);
});
test('more than 255 distinct frame events and page boundary execution',()=>{
 const r=structuredClone(source('pitched'));for(const f of r.runtimeTrace.frameSnapshots){f.globals[0].modeVolume=15;f.sounds[0].pw=0x800;f.sounds[0].ctrl=f.frame%2?0:0x41;}
 const out=compiler.compile(r,{mode:'faithful'});assert.equal(out.actions.length,300);assert.ok(out.metrics.distinctActionFrames>255);const cpu=machine(out);cpu.run(out.entry.init);const initWrites=cpu.writes.length;
 for(let i=0;i<300;i++){try{cpu.run(out.entry.tick)}catch(e){throw Error('At frame '+i+': '+e.message)}assert.equal(cpu.ay(8),i%2?0:15);}
 assert.equal(cpu.writes.length-initWrites,out.metrics.registerWrites);assert.equal(cpu.counter(),300);cpu.run(out.entry.tick);assert.equal(cpu.state('PAY_DONE'),1);
 assert.ok(out.metrics.distinctUpdatePrograms<out.actions.length);
});
test('explicit repeat-observed audibly repeats only the bounded window; default finite stop',()=>{
 const out=compiler.compile(source('pitched'),{mode:'diagnostic',endPolicy:'repeat-observed'}),cpu=machine(out);cpu.run(out.entry.init);for(let i=0;i<301;i++)cpu.run(out.entry.tick);
 assert.equal(cpu.counter(),1);assert.equal(cpu.state('PAY_DONE'),0);assert.equal(cpu.ay(8),10);assert.equal(out.configuration.endPolicy,'repeat-observed');
});
test('unsupported source evidence and invalid options are rejected',()=>{
 const r=source('pitched');assert.throws(()=>compiler.compile(r,{endPolicy:'infinite-song-loop'}),/Invalid/);
 const broken=structuredClone(r);broken.completeness.droppedRecords.sidWrites=1;assert.throws(()=>compiler.compile(broken),/truncated/);
});

test('real changing-pitch SID fixture with nonzero source volume yields changing AY tone periods in faithful mode',()=>{
 const src=source('pay07_melody'),out=compiler.compile(src,{mode:'faithful'});assert.ok(out.actions.length>=30);const cpu=machine(out);cpu.run(out.entry.init);
 const periods=[];for(let t=0;t<300;t++){cpu.run(out.entry.tick);if([7,15,23,31].includes(t))periods.push(cpu.ay(0)+(cpu.ay(1)<<8));}
 assert.deepEqual(periods,[118,106,88,133]);assert.equal(cpu.ay(8),15);assert.equal(cpu.ay(7),0x3e);
 assert.ok(src.runtimeTrace.summary.sidWrites>70);assert.equal(out.configuration.mode,'faithful');
});

test('1200-frame score with 16-bit frame scheduler and finite stop',()=>{
 const r=source('pitched'),orig=r.runtimeTrace.frameSnapshots;for(let i=300;i<1200;i++){const f=structuredClone(orig[i%300]);f.frame=i;r.runtimeTrace.frameSnapshots.push(f);}
 r.runtimeTrace.summary.framesRequested=1200;r.runtimeTrace.summary.framesCompleted=1200;
 const out=compiler.compile(r,{mode:'diagnostic'});assert.equal(out.metrics.sourceFrameCount,1200);
 const cpu=machine(out);cpu.run(out.entry.init);for(let i=0;i<1200;i++)cpu.run(out.entry.tick);
 assert.equal(cpu.counter(),1200);assert.equal(cpu.state('PAY_DONE'),0);assert.equal(cpu.ay(8),10);
 cpu.run(out.entry.tick);assert.equal(cpu.state('PAY_DONE'),1);assert.equal(cpu.ay(8),0);
});
