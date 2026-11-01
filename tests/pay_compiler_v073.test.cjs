'use strict';
const fs=require('fs'),assert=require('node:assert/strict');
const path=require('node:path');const root=path.resolve(__dirname,'../..');
const compiler=require(path.join(root,'tools/PAY_Compiler_v073_core.js'));
const report=require(path.join(root,'examples/PAY/Bomberland_preview_60SEC_frames.pay-frame-report.json'));
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
 function run(start,kind='call',maxSteps=100000,owned=true){pc=start;A=0x29;X=0x41;Y=0x83;SP=255;Z=0;C=0;
  if(kind==='irq'){irqFlag=owned;mem[0x45]=0x29;push(0xfd);push(0x00);push(P);P|=4;}
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
    case 0xad:A=rd(u16(pc));pc+=2;setZ(A);break;case 0xbd:A=rd((u16(pc)+X)&65535);pc+=2;setZ(A);break;case 0xae:X=rd(u16(pc));pc+=2;setZ(X);break;
    case 0x8d:wr(u16(pc),A);pc+=2;break;case 0x8e:wr(u16(pc),X);pc+=2;break;
    case 0x18:C=0;break;case 0x6d:v=rd(u16(pc));pc+=2;d=A+v+C;C=d>255?1:0;A=d&255;setZ(A);break;case 0x0d:A|=rd(u16(pc));pc+=2;setZ(A);break;case 0x29:A&=rd(pc++);setZ(A);break;case 0x09:A|=rd(pc++);setZ(A);break;
    case 0xc9:v=rd(pc++);C=A>=v?1:0;setZ(A-v);break;
    case 0xcd:v=rd(u16(pc));pc+=2;C=A>=v?1:0;setZ(A-v);break;
    case 0xce:a=u16(pc);pc+=2;v=(rd(a)-1)&255;wr(a,v);setZ(v);break;case 0xee:a=u16(pc);pc+=2;v=(rd(a)+1)&255;wr(a,v);setZ(v);break;
    case 0xf0:case 0xd0:case 0xb0:d=rd(pc++);if(d>127)d-=256;if(op===0xf0?Z:op===0xd0?!Z:C)pc=(pc+d)&65535;break;
    default:throw Error(`Unsupported 6502 opcode $${op.toString(16)} at $${at.toString(16)} (${kind})`);
   }
  }throw Error('6502 step limit exceeded '+kind+' @'+pc.toString(16));
 }
 return {run,mem,writes,states,sourceImage:out.binary,irq:(owned=true)=>run(mem[0x3fe]|mem[0x3ff]<<8,'irq',100000,owned),state:n=>mem[states[n]],counter:()=>mem[states.FRAME_LO]+(mem[states.FRAME_HI]<<8),ay:r=>{let v=0;for(const w of writes)if(w.reg===r)v=w.val;return v;},get owner(){return mem[0x3fe]|mem[0x3ff]<<8},get irqEnabled(){return ier},get acknowledgements(){return irqAck},get irqCount(){return irqCount},get stackMax(){return stackMax},get interruptDisabled(){return !!(P&4)},hardwareTimerIRQ(){if(P&4)return false;run(mem[0x3fe]|mem[0x3ff]<<8,'irq',100000,true);return true;}};
}

for (const policy of ['stop','repeat-observed']) {
 const out=compiler.compile(report,{endPolicy:policy});const cpu=machine(out);
 cpu.run(out.entry.init);const initWrites=cpu.writes.length;console.log('native start',policy,'origin $6000','image',out.memory.byteLength,'score events',out.actions.length,'regWrites',out.metrics.registerWrites);
 let observed=0,expected=0,checkpoint=0;
 const sum=[];
 const actionByFrame=new Map(out.actions.map(a=>[a.frame,a.updates]));
 for(let t=0;t<3000;t++){
  cpu.run(out.entry.tick);
  const desired=actionByFrame.get(t)||[];
  const gained=cpu.writes.length-initWrites-observed;
  assert.equal(gained,desired.length,`frame ${t} wrote wrong count`);
  const recent=cpu.writes.slice(initWrites+observed);
  assert.deepEqual(recent,desired.map(u=>({reg:u.reg,val:u.value})),`frame ${t} mismatch`);
  observed+=desired.length;
  assert.equal(cpu.counter(),t+1,`frame count at ${t}`);
  if([0,299,300,599,1199,1499,1799,2399,2999].includes(t))sum.push([t,cpu.counter(),observed]);
 }
 assert.equal(observed,out.metrics.registerWrites);
 assert.equal(cpu.counter(),3000);
 const before=cpu.writes.length;
 cpu.run(out.entry.tick);
 assert.equal(cpu.counter(),policy==='stop'?3000:1);
 assert.equal(cpu.state('PAY_DONE'),policy==='stop'?1:0);
 assert.equal(cpu.writes.length-before,policy==='stop'?4:(4+(actionByFrame.get(0)||[]).length));
 cpu.run(out.entry.stop);
 console.log('PASS',policy,'checkpoints',sum,'extra muted or repeated',cpu.writes.length-before);
}
const out=compiler.compile(report,{endPolicy:'repeat-observed'}),cpu=machine(out);
cpu.run(out.entry.init);cpu.run(out.entry.irqInstall);assert.equal(cpu.interruptDisabled,false);assert.equal(cpu.irqEnabled,true);
for(let i=0;i<500;i++)assert.equal(cpu.hardwareTimerIRQ(),true);
assert.equal(cpu.counter(),500);assert.equal(cpu.state('IRQ_COUNT_LO'),500&255);assert.equal(cpu.state('IRQ_COUNT_HI'),500>>8);
cpu.run(out.entry.irqRemove);assert.equal(cpu.state('IRQ_ACTIVE'),0);console.log('PASS resident timer 500 IRQ');
const sixSecWrites=compiler.compile(report,{endPolicy:'stop'}).actions.filter(e=>e.frame<300).reduce((n,e)=>n+e.updates.length,0);
assert.equal(sixSecWrites,660);console.log('PASS original six-second AY prefix: 660 writes');
const silent=structuredClone(report);silent.runtimeTrace.frameSnapshots.forEach(f=>{f.globals[0].modeVolume=0;f.sounds.forEach(s=>s.ctrl=0)});const so=compiler.compile(silent,{endPolicy:'stop'});assert.equal(so.actions.length,0);const sc=machine(so);sc.run(so.entry.init);sc.run(so.entry.tick);assert.equal(sc.counter(),1);console.log('PASS entirely muted trace: zero events, executable player');
