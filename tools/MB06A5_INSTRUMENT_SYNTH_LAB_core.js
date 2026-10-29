/* MB-06A.5 · Offline AY instrument synthesis candidates.
   Uses RetroAppleJS AYCore: register events -> production JS/WASM economy PCM.
   This does not run 6502 machine code or promise physical AY sound fidelity. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.MB06A5Lab=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const CLOCK=1021800,RATE=22050,TIMEBASE=1000000000,BLOCK=256;
const CANDIDATES=[
 {id:'square',label:'Native square — pitch reference',family:'tone',group:'low',usage:'Direct AY tone; most accurate control'},
 {id:'pluck',label:'Plucked square — hardware decay envelope',family:'tone',group:'low',usage:'Tone sets pitch; R13 shapes amplitude attack/decay'},
 {id:'adsr',label:'Expressive square — low-rate software volume',family:'tone',group:'low',usage:'Tone pitch, 5–8 volume writes per note'},
 {id:'tone-noise',label:'Reed — square mixed with noise',family:'tone',group:'low',usage:'Tone fundamental plus noisy timbre'},
 {id:'detune',label:'Chorus — two gently detuned squares',family:'tone',group:'low',usage:'Uses two of three AY channels'},
 {id:'buzzer',label:'Buzzer — tone × audio-rate envelope',family:'tone',group:'explore',usage:'Modulated sound; sidebands/beat pitch may be ambiguous'},
 {id:'saw8',label:'Software sawtooth — 8 DAC steps',family:'dac',group:'high',steps:8,usage:'R8 volume writes at 8× note rate'},
 {id:'saw16',label:'Software sawtooth — 16 DAC steps',family:'dac',group:'high',steps:16,usage:'R8 volume writes at 16× note rate'},
 {id:'triangle8',label:'Software triangle — 8 DAC steps',family:'dac',group:'high',steps:8,usage:'R8 volume writes at 8× note rate'},
 {id:'triangle16',label:'Software triangle — 16 DAC steps',family:'dac',group:'high',steps:16,usage:'R8 volume writes at 16× note rate'}
];
function check(c,m){if(!c)throw Error(m);}
function nearestTone(frequency){check(Number.isFinite(frequency)&&frequency>0,'Bad note frequency');
 const p=Math.max(1,Math.min(4095,Math.round(CLOCK/(16*frequency))));
 const hz=CLOCK/(16*p);return {period:p,realizedHz:hz,cents:1200*Math.log2(hz/frequency)};}
function clamp(x,a,b){return Math.min(b,Math.max(a,x));}
function nominalCurve(){return Array.from({length:16},(_,v)=>v===0?0:Math.pow(2,(v-15)/2));}
function volumeLevel(level,curve){
 const a=curve||nominalCurve();check(a.length===16,'AY volume curve must have 16 entries');
 const goal=clamp(level,0,1)*a[15];let best=0,err=Infinity;
 for(let v=0;v<16;v++){const dif=Math.abs(a[v]-goal);if(dif<err){best=v;err=dif;}}
 return best;
}
function buildProbeNotes(){return [{note:'C4',startCycles:51200,durationCycles:870400,
 expectedHz:261.6255653005986}];}
function makeSpec(id,notes,{probe=false,curve=null,skipDuplicates=true,cyclesPerWrite=50}={}){
 const candidate=CANDIDATES.find(x=>x.id===id);check(candidate,'Unknown candidate '+id);
 check(Array.isArray(notes)&&notes.length>0,'Missing notes');
 check(Number.isFinite(cyclesPerWrite)&&cyclesPerWrite>0&&cyclesPerWrite<=500,'Invalid cycle cost');
 const list=[],pitches=[],add=(cycle,reg,value)=>{
  check(Number.isSafeInteger(cycle)&&cycle>=0&&reg>=0&&reg<=13&&value>=0&&value<=255,'Bad event');
  list.push({cycle,chip:0,reg,value});
 };
 // AY0 is silent until the first note. No AY1 access at any time.
 add(0,7,0x3f);add(0,8,0);add(0,9,0);add(0,10,0);
 const isDac=candidate.family==='dac';
 let potentialDacWrites=0,skippedDuplicates=0;
 for(const n of notes){
  check(Number.isInteger(n.startCycles)&&Number.isInteger(n.durationCycles)&&n.durationCycles>0,'Invalid note timeline');
  const target=n.expectedHz,p=nearestTone(target),t=n.startCycles;
  const release=t+n.durationCycles-Math.min(8192,Math.floor(n.durationCycles/16));
  pitches.push({note:n.note,targetHz:target,period:p.period,programmedHz:p.realizedHz,cents:p.cents,startCycles:t});
  add(t,8,0);
  if(isDac){
   add(t+128,7,0x3f); // disable tone/noise on A: software R8 DAC output
   const s=candidate.steps,isTriangle=id.startsWith('triangle');
   const start=t+1024,finish=release;
   const cyclesPerWave=CLOCK/p.realizedHz;
   let previous=0;
   for(let k=0;;k++){
    const cycle=Math.round(start+k*cyclesPerWave/s);
    if(cycle>=finish)break;
    const phase=(k%s)/s;
    const level01=isTriangle?1-Math.abs(2*phase-1):phase;
    const v=volumeLevel(level01,curve);
    potentialDacWrites++;
    if(skipDuplicates&&v===previous){skippedDuplicates++;continue;}
    add(cycle,8,v);previous=v;
   }
  }else{
   add(t+128,0,p.period&255);add(t+256,1,(p.period>>8)&15);
   if(id==='detune'){
    const detuned=nearestTone(target*Math.pow(2,9/1200));
    add(t+384,2,detuned.period&255);add(t+512,3,(detuned.period>>8)&15);
    add(t+640,7,0x3c);add(t+768,8,9);add(t+896,9,9);
   }else if(id==='pluck'){
    // One-shot ~240 ms falling envelope, NOT an audio-rate triangle or saw.
    const envPeriod=Math.round(CLOCK/(256*4));
    add(t+384,11,envPeriod&255);add(t+512,12,(envPeriod>>8)&255);
    add(t+640,7,0x3e);add(t+768,13,0x09);add(t+896,8,0x10);
   }else if(id==='adsr'){
    add(t+384,7,0x3e);
    add(t+512,8,8);add(t+1024,8,13);add(t+2048,8,12);
    add(t+Math.round(n.durationCycles*.65),8,10);
    add(t+Math.round(n.durationCycles*.8),8,7);
    add(t+Math.round(n.durationCycles*.92),8,4);
   }else if(id==='tone-noise'){
    add(t+384,6,8);add(t+512,7,0x36);add(t+640,8,12);
   }else if(id==='buzzer'){
    const envPeriod=Math.max(1,Math.round(CLOCK/(256*p.realizedHz)));
    add(t+384,11,envPeriod&255);add(t+512,12,(envPeriod>>8)&255);
    add(t+640,7,0x3e);add(t+768,13,0x08);add(t+896,8,0x10);
   }else{
    add(t+384,7,0x3e);add(t+512,8,12);
   }
  }
  add(release,8,0);if(id==='detune')add(release+64,9,0);
 }
 // End with channels muted, no dependence on prior AY state.
 const endCycle=probe?1021800:3738624;
 add(endCycle-128,8,0);add(endCycle-96,9,0);add(endCycle-64,10,0);
 list.sort((a,b)=>a.cycle-b.cycle);
 check(list[list.length-1].cycle<endCycle,'Events exceed score end');
 let maxSameCycle=0,cur=0,last=-1;for(const e of list){if(e.cycle===last)cur++;else cur=1;last=e.cycle;maxSameCycle=Math.max(maxSameCycle,cur);}
 const duration=endCycle/CLOCK,writeRate=list.length/duration,softwareRate=potentialDacWrites/duration;
 const cpuShare=100*list.length*cyclesPerWrite/endCycle;
 return {id,label:candidate.label,candidate,events:list,notes:pitches,endCycle,duration,
    writes:list.length,writeRate,softwareRate,potentialDacWrites,skippedDuplicates,
    maxSameCycle,cyclesPerWrite,cpuShare,
    // Cost model is illustrative: excludes IRQ and multi-event serialization.
    cpuCostNote:'Planning assumption: '+cyclesPerWrite+' cycles/AY write; excludes E1 decoding, IRQ entry/exit, register select and timer maintenance.',
    limitNote:isDac?'Software volume updates are NOT executable at this rate by the existing 1024-cycle MB-06A.3 IRQ scheduler.':'Native 6502 viability not measured yet.'};
}
function toTick(cycle){return Math.round(cycle*TIMEBASE/CLOCK);}
function pcmStats(pcm){let rms=0,peak=0,dc=0;for(const x of pcm){peak=Math.max(peak,Math.abs(x));rms+=x*x;dc+=x;}return {rms:Math.sqrt(rms/pcm.length),peak,dc:dc/pcm.length};}
async function render(AYCore,spec,{backend='js'}={}){
 check(AYCore&&typeof AYCore.create==='function'&&typeof AYCore.packEvent==='function','RetroAppleJS AYCore is unavailable');
 check(spec&&Array.isArray(spec.events),'Missing score');
 const engine=await AYCore.create({backend,chipCount:2,sampleRate:RATE,renderProfile:'economy',timebaseHz:TIMEBASE,maxFrames:BLOCK,maxEvents:4096});
 const count=Math.round(spec.duration*RATE),samples=new Float32Array(count),temp={left:new Float32Array(BLOCK),right:new Float32Array(BLOCK)};
 const bytes=new Uint8Array(4096*16),view=new DataView(bytes.buffer);
 let n=0,i=0;
 try{
  for(let c=0;c<2;c++){
   engine.configureChip(c,{model:'AY',clockHz:CLOCK});
   engine.setMix(c,c===0?[.5,0,.5,0,.5,0]:[0,.5,0,.5,0,.5]);
  }
  while(n<count){
   const size=Math.min(BLOCK,count-n),endTick=Math.ceil((n+size)*TIMEBASE/RATE);
   let added=0;
   while(i<spec.events.length&&toTick(spec.events[i].cycle)<=endTick){
    check(added<4096,'Too many register writes in one PCM batch');
    const e=spec.events[i++];AYCore.packEvent(view,added++,toTick(e.cycle),e.chip,0,e.reg,e.value);
   }
   const got=engine.renderUntil(endTick,{data:bytes,count:added},temp);
   check(got===size,'AYCore returned '+got+' frames, expected '+size);
   for(let q=0;q<got;q++)samples[n+q]=(temp.left[q]+temp.right[q])*0.5;
   n+=got;
  }
  check(i===spec.events.length,'Unrendered AY events');
 }finally{engine.destroy();}
 return {samples,rate:RATE,backend,stats:pcmStats(samples),spec};
}
function wav(samples,{rate=RATE,bits=16}={}){
 check(bits===8||bits===16,'Supported WAV bit depth: 8 or 16');
 const b=bits/8,n=samples.length,buf=new ArrayBuffer(44+b*n),dv=new DataView(buf),u=new Uint8Array(buf);
 const four=(off,s)=>{for(let k=0;k<4;k++)u[off+k]=s.charCodeAt(k);};
 four(0,'RIFF');dv.setUint32(4,36+b*n,true);four(8,'WAVE');four(12,'fmt ');
 dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);
 dv.setUint32(24,rate,true);dv.setUint32(28,rate*b,true);dv.setUint16(32,b,true);dv.setUint16(34,bits,true);
 four(36,'data');dv.setUint32(40,b*n,true);
 for(let i=0;i<n;i++){
  const x=clamp(samples[i],-1,1);
  if(bits===8)u[44+i]=clamp(Math.round((x+1)*127.5),0,255);
  else dv.setInt16(44+2*i,Math.round(x<0?32768*x:32767*x),true);
 }
 return buf;
}
const crcTable=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let b=0;b<8;b++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[i]=c>>>0;}return t;})();
function crc32(data){let c=0xffffffff;for(const v of data)c=crcTable[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zipFiles(files){
 const te=new TextEncoder(),ls=[],cs=[];let offset=0;
 for(const f of files){const name=te.encode(f.name),data=f.bytes instanceof Uint8Array?f.bytes:new Uint8Array(f.bytes);check(name.length<65536,'ZIP filename too long');const crc=crc32(data);
  const h=new Uint8Array(30+name.length),dv=new DataView(h.buffer);
  dv.setUint32(0,0x04034b50,true);dv.setUint16(4,20,true);dv.setUint16(6,0x0800,true);dv.setUint32(14,crc,true);dv.setUint32(18,data.length,true);dv.setUint32(22,data.length,true);dv.setUint16(26,name.length,true);h.set(name,30);ls.push(h,data);
  const c=new Uint8Array(46+name.length),cd=new DataView(c.buffer);
  cd.setUint32(0,0x02014b50,true);cd.setUint16(4,20,true);cd.setUint16(6,20,true);cd.setUint16(8,0x0800,true);cd.setUint32(16,crc,true);cd.setUint32(20,data.length,true);cd.setUint32(24,data.length,true);cd.setUint16(28,name.length,true);cd.setUint32(42,offset,true);c.set(name,46);cs.push(c);offset+=h.length+data.length;
 }
 const csSize=cs.reduce((p,x)=>p+x.length,0),foot=new Uint8Array(22),fd=new DataView(foot.buffer);
 fd.setUint32(0,0x06054b50,true);fd.setUint16(8,files.length,true);fd.setUint16(10,files.length,true);fd.setUint32(12,csSize,true);fd.setUint32(16,offset,true);
 const all=new Uint8Array(offset+csSize+22);let k=0;for(const item of [...ls,...cs,foot]){all.set(item,k);k+=item.length;}return all;
}
return {CLOCK,RATE,CANDIDATES,nearestTone,nominalCurve,volumeLevel,buildProbeNotes,makeSpec,render,pcmStats,wav,zipFiles};
});
