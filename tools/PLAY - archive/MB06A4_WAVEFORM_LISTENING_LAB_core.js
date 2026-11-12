/* RetroAppleJS MB-06A.4 — single-voice AY waveform listening comparison.
   Offline register-driven AYCore experiment. DOES NOT execute 6502 or promise
   physical AY fidelity. The baseline song events come from MB06A3 reference. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MB06A4Lab=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const CLOCK=1021800,RATE=22050,TIMEBASE=1000000000,FRAME_BLOCK=256;
const VARIANTS=[
 {id:'original',name:'Original MB-06A.3 · melody + bass + harmony + percussion',family:'original'},
 {id:'square',name:'Square · AY tone A',family:'square'},
 {id:'sawdown',name:'Falling saw · AY R13=$08',family:'saw',shape:0x08},
 {id:'sawup',name:'Rising saw · AY R13=$0C',family:'saw',shape:0x0c},
 {id:'triangle',name:'Triangle · AY R13=$0A',family:'triangle',shape:0x0a}
];
function assert(c,m){if(!c)throw new Error(m);}
function periodFor(id,hz,clock=CLOCK){
 assert(Number.isFinite(hz)&&hz>0,'Invalid note pitch');
 const divider=id==='square'?16:id==='triangle'?512:256;
 const period=Math.max(1,Math.min(id==='square'?4095:65535,Math.round(clock/(divider*hz))));
 const actualHz=clock/(divider*period);
 return {period,actualHz,cents:1200*Math.log2(actualHz/hz),divider};
}
function validate(reference){
 assert(reference&&reference.format==='retroapplejs.mb06a3.reference.v1','Incorrect MB06A3 reference format');
 assert(reference.clockHz===CLOCK,'Unexpected song clock');
 assert(Array.isArray(reference.melodyNotes)&&reference.melodyNotes.length===14,'Expected fourteen notes');
 assert(Array.isArray(reference.eventsMusic)&&reference.eventsMusic.length===150,'Expected 150 original E1 events');
 assert(reference.scoreLength.music===643,'Expected 643-byte score');
 let prev=-1;
 for(const e of reference.eventsMusic){
  assert(Number.isInteger(e.cycle)&&e.cycle>=prev,'Non-monotonic source event cycle');
  assert(e.chip===0&&e.register>=0&&e.register<=13&&e.value>=0&&e.value<=255,'Invalid source event');
  prev=e.cycle;
 }
 return reference;
}
function eventsFor(reference,id,{probe=false}={}){
 validate(reference);
 assert(VARIANTS.some(x=>x.id===id),'Unknown variant');
 if(id==='original'&&!probe) return {events:reference.eventsMusic.map(e=>({cycle:e.cycle,chip:0,reg:e.register,value:e.value})),
   notes:reference.melodyNotes.map(n=>({note:n.note,startCycles:n.startCycles,period:n.ayPeriod,actualHz:n.realizedHz,cents:1200*Math.log2(n.realizedHz/n.expectedHz)})),
   endCycle:3738624,description:'Exact 150-event canonical E1 register score, rendered by AYCore; excludes live 6502 bus latency.'};
 // For the single-note probe, compare all timbres at C4 and equivalent envelope periods.
 const notes=probe?[{note:'C4',startCycles:51200,durationCycles:561000,expectedHz:261.6255653005986}]:reference.melodyNotes;
 const events=[], pitches=[];
 const add=(cycle,reg,value)=>events.push({cycle,chip:0,reg,value});
 add(0,7,0x3f);add(0,8,0);add(0,9,0);add(0,10,0);
 for(const n of notes){
  const f=n.expectedHz, p=periodFor(id==='original'?'square':id,f),t=n.startCycles;
  // Begin muted so the exact note-on ordering is reproducible. Repeated R13
  // writes must retrigger the AY's single shared envelope generator.
  add(t,8,0);
  if(id==='square'||id==='original'){
   add(t,7,0x3e);add(t,0,p.period&255);add(t,1,(p.period>>8)&0x0f);add(t,8,13);
  }else{
   const shape=VARIANTS.find(v=>v.id===id).shape;
   add(t,7,0x3f);add(t,11,p.period&255);add(t,12,(p.period>>8)&255);add(t,13,shape);add(t,8,0x10);
  }
  const release=Math.max(t+1024,t+n.durationCycles-(probe?6500:12288));
  add(release,8,0);
  pitches.push({note:n.note,startCycles:t,requestedHz:f,period:p.period,actualHz:p.actualHz,cents:p.cents});
 }
 // Same-cycle ordering is deliberate, and events must never get reordered by register.
 events.sort((a,b)=>a.cycle-b.cycle);
 const endCycle=probe?660000:3738624;
 assert(events[events.length-1].cycle<=endCycle,'Score events exceed end cycle');
 return {events,notes:pitches,endCycle,description:'Offline AYCore single-voice timbre experiment; NOT a newly compiled 6502 E1 score.'};
}
function toTick(cycle){return Math.round(cycle*TIMEBASE/CLOCK);}
async function render(coreAPI,reference,id,{probe=false}={}){
 assert(coreAPI&&typeof coreAPI.create==='function'&&typeof coreAPI.packEvent==='function','RetroAppleJS AYCore unavailable');
 const track=eventsFor(reference,id,{probe}), events=track.events;
 const engine=await coreAPI.create({backend:'js',chipCount:2,sampleRate:RATE,renderProfile:'economy',timebaseHz:TIMEBASE,maxFrames:FRAME_BLOCK,maxEvents:4096});
 const nSamples=Math.round(track.endCycle*RATE/CLOCK),pcm=new Float32Array(nSamples),
 temp={left:new Float32Array(FRAME_BLOCK),right:new Float32Array(FRAME_BLOCK)},
 packed=new Uint8Array(4096*16),view=new DataView(packed.buffer);
 let idx=0,count=0;
 try{
  for(let c=0;c<2;c++){
   engine.configureChip(c,{model:'AY',clockHz:CLOCK});
   engine.setMix(c,c===0?[.5,0,.5,0,.5,0]:[0,.5,0,.5,0,.5]);
  }
  while(count<nSamples){
   const frames=Math.min(FRAME_BLOCK,nSamples-count),endTick=Math.ceil((count+frames)*TIMEBASE/RATE);
   let total=0;
   while(idx<events.length&&toTick(events[idx].cycle)<=endTick){
    const e=events[idx++];
    assert(total<4096,'Event packet overflow');
    coreAPI.packEvent(view,total++,toTick(e.cycle),e.chip,0,e.reg,e.value);
   }
   const produced=engine.renderUntil(endTick,{data:packed,count:total},temp);
   assert(produced===frames,'Unexpected AYCore PCM sample count: '+produced+' vs '+frames);
   for(let i=0;i<produced;i++)pcm[count+i]=(temp.left[i]+temp.right[i])*.5;
   count+=produced;
  }
  assert(idx===events.length,'Not all score writes were rendered');
 }finally{engine.destroy();}
 const metrics=pcmMetrics(pcm);
 return {id,probe,pcm,rate:RATE,...track,metrics,renderer:'RetroAppleJS AYCore JS / economy / AY / 22050 Hz'};
}
function pcmMetrics(pcm){let peak=0,sum=0,energy=0;
 for(const v of pcm){peak=Math.max(peak,Math.abs(v));sum+=v;energy+=v*v;}
 return {samples:pcm.length,peak,rms:Math.sqrt(energy/pcm.length),dc:sum/pcm.length,clipped:Array.from(pcm).filter(v=>Math.abs(v)>1).length};
}
function wav(pcm,rate=RATE){
 const n=pcm.length,a=new ArrayBuffer(44+n*2),d=new DataView(a);
 for(const [off,str] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])for(let i=0;i<4;i++)d.setUint8(off+i,str.charCodeAt(i));
 d.setUint32(4,36+n*2,true);d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);
 d.setUint32(24,rate,true);d.setUint32(28,rate*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);d.setUint32(40,n*2,true);
 for(let i=0;i<n;i++){
  let x=Math.max(-1,Math.min(1,pcm[i]));d.setInt16(44+i*2,Math.round(x<0?x*32768:x*32767),true);
 }
 return a;
}
const CRCTABLE=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):(c>>>1);t[i]=c>>>0;}return t;})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=CRCTABLE[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function zipFiles(files){
 // Small, deterministic ZIP store writer. No external library, no compression.
 const enc=new TextEncoder(),locals=[],centrals=[];let off=0;
 for(const f of files){let name=enc.encode(f.name),bytes=f.bytes instanceof Uint8Array?f.bytes:new Uint8Array(f.bytes),crc=crc32(bytes);
  assert(name.length<65536,'ZIP filename too long');
  let h=new Uint8Array(30+name.length),v=new DataView(h.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(8,0,true);
  v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);h.set(name,30);
  locals.push(h,bytes);
  let ch=new Uint8Array(46+name.length),cv=new DataView(ch.buffer);
  cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);
  cv.setUint32(16,crc,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);
  cv.setUint16(28,name.length,true);cv.setUint32(42,off,true);ch.set(name,46);
  centrals.push(ch);off+=h.length+bytes.length;
 }
 const centralBytes=centrals.reduce((s,a)=>s+a.length,0),footer=new Uint8Array(22),fv=new DataView(footer.buffer);
 fv.setUint32(0,0x06054b50,true);fv.setUint16(8,files.length,true);fv.setUint16(10,files.length,true);
 fv.setUint32(12,centralBytes,true);fv.setUint32(16,off,true);
 const out=new Uint8Array(off+centralBytes+22);let k=0;
 for(const a of [...locals,...centrals,footer]){out.set(a,k);k+=a.length;}assert(k===out.length,'ZIP size mismatch');return out;
}
return {CLOCK,RATE,VARIANTS,periodFor,validate,eventsFor,render,pcmMetrics,wav,zipFiles,crc32};
});
