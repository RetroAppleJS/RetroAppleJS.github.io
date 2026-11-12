/* RetroAppleJS MB-06A.5: 6502 scheduling readiness, offline only.
 * Does not claim instruction-exact CPU timing or native assembly execution.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.MB06A5Native=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const DEFAULTS={heartbeat:1024,fixedIRQCycles:120,cyclesPerEvent:350,toleranceCycles:128,scoreCapacityBytes:8192,cpuHz:1021800,ayHz:1021800};
function check(ok,msg){if(!ok)throw Error(msg);}
function uleb(n){
 check(Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff,'ULEB delta outside u32 range');
 const bytes=[];do{let b=n%128;n=Math.floor(n/128);if(n)b|=128;bytes.push(b);}while(n);
 return bytes;
}
function decodeULEB(data,offset){
 let value=0,shift=0,i=offset;
 for(let j=0;j<5;j++){
  check(i<data.length,'Truncated E1 ULEB');
  const b=data[i++];value+=(b&127)*Math.pow(2,shift);
  check(value<=0xffffffff,'E1 time delta exceeds 32 bits');
  if(!(b&128)){check(j===0||b!==0,'Noncanonical E1 ULEB');return {value,offset:i};}
  shift+=7;
 }
 throw Error('Overlong E1 ULEB');
}
function encodeE1(events){
 let prev=0;const payload=[];
 for(const e of events){
  check(Number.isSafeInteger(e.cycle)&&e.cycle>=prev,'E1 events must have monotonic safe-integer cycle timestamps');
  check(e.chip===0&&Number.isInteger(e.reg)&&e.reg>=0&&e.reg<=13,'MB-06A.5 exports AY0 sound registers R0-R13');
  check(Number.isInteger(e.value)&&e.value>=0&&e.value<=255,'Invalid AY value');
  payload.push(...uleb(e.cycle-prev),e.reg,e.value);
  prev=e.cycle;
 }
 return Uint8Array.from(payload);
}
function decodeE1(data,count){
 let at=0,cycle=0;const events=[];
 for(let i=0;i<count;i++){
  const d=decodeULEB(data,at);at=d.offset;cycle+=d.value;
  check(cycle<=Number.MAX_SAFE_INTEGER,'E1 absolute cycle overflows JS safe integer');
  check(at+2<=data.length,'Truncated E1 ID/value');
  const reg=data[at++],value=data[at++];
  check(reg<=13,'Unsupported AY0 ID');events.push({cycle,chip:0,reg,value});
 }
 check(at===data.length,'E1 trailing bytes');return events;
}
function fnv1a32(payload){let h=0x811c9dc5;for(const b of payload){h^=b;h=Math.imul(h,0x01000193)>>>0;}return h>>>0;}
function aysbV1(events,endCycle,{cpuHz=DEFAULTS.cpuHz,ayHz=DEFAULTS.ayHz}={}){
 check(Number.isSafeInteger(endCycle)&&endCycle>=0&&endCycle<=0xffffffff,'Unsupported AYSB duration');
 const data=encodeE1(events),out=new Uint8Array(36+data.length),v=new DataView(out.buffer);
 out.set([65,89,83,66],0);out[4]=1;out[5]=1; // AYSB v1 / E1 codec
 v.setUint32(8,cpuHz,true);v.setUint32(12,ayHz,true);
 v.setUint32(16,endCycle,true);v.setUint32(20,events.length,true);
 v.setUint32(24,0,true);v.setUint32(28,data.length,true);
 v.setUint32(32,fnv1a32(data),true);out.set(data,36);
 return out;
}
function analyze(spec,options={}){
 const p={...DEFAULTS,...options};
 for(const field of ['heartbeat','fixedIRQCycles','cyclesPerEvent','scoreCapacityBytes','toleranceCycles'])
  check(Number.isInteger(p[field])&&p[field]>0,'Invalid analysis input '+field);
 check(p.heartbeat<=8192 && p.fixedIRQCycles<=4096 && p.cyclesPerEvent<=1000,'Timing assumption outside supported limits');
 check(spec&&Array.isArray(spec.events)&&Number.isSafeInteger(spec.endCycle)&&spec.endCycle>0,'Missing instrument event schedule');
 const groups=new Map(),events=[];
 const eventSlots=Math.floor((p.heartbeat-p.fixedIRQCycles)/p.cyclesPerEvent);
 let prev=-1,minGap=null,spacingViolations=0,lastTick=0,used=0;
 for(const e of spec.events){
  check(Number.isSafeInteger(e.cycle)&&e.cycle>=prev&&e.cycle<spec.endCycle,'Unsorted/out-of-range source event');
  if(prev>=0 && e.cycle>prev){const gap=e.cycle-prev;minGap=minGap===null?gap:Math.min(gap,minGap);if(gap<p.cyclesPerEvent)spacingViolations++;}
  prev=e.cycle;
  // Earliest timer service is the next boundary, then pack no more than the
  // modeled number of serialized AY writes into each IRQ. This produces a
  // *new, audibly unverified* score rather than implying simultaneous writes.
  const earliest=Math.max(p.heartbeat,Math.ceil(e.cycle/p.heartbeat)*p.heartbeat);
  let due=Math.max(earliest,lastTick);
  if(eventSlots>0 && due===lastTick && used>=eventSlots)due+=p.heartbeat;
  if(eventSlots===0)due=Math.max(earliest,lastTick); // impossible budget, for report only
  used=due===lastTick?used+1:1;
  lastTick=due;
  const item={...e,cycle:due};
  const arr=groups.get(due)||[];arr.push(item);groups.set(due,arr);
  events.push(item);
 }
 const encoded=encodeE1(events),adaptedEndCycles=Math.max(spec.endCycle,lastTick+p.heartbeat),
       totalTicks=Math.ceil(adaptedEndCycles/p.heartbeat);
 let maxGroup=0,maxServiceCycles=0,overrunGroups=0,maxQuantizationCycles=0,maxModeledDelayCycles=0;
 let missTolerance=0,totalQuant=0;
 for(const arr of groups.values()){
  maxGroup=Math.max(maxGroup,arr.length);
  const service=p.fixedIRQCycles+arr.length*p.cyclesPerEvent;
  maxServiceCycles=Math.max(maxServiceCycles,service);
  if(service>p.heartbeat)overrunGroups++;
 }
 // All writes on the same tick remain FIFO. Estimated write completions are
 // serialized and all deviations are relative to the ORIGINAL, unmodified
 // AYCore instrument-event schedule.
 const groupCount=new Map();
 for(let i=0;i<events.length;i++){
  const e=events[i],source=spec.events[i];
  const index=groupCount.get(e.cycle)||0;groupCount.set(e.cycle,index+1);
  const quant=e.cycle-source.cycle;
  const delay=quant+p.fixedIRQCycles+(index+1)*p.cyclesPerEvent;
  maxQuantizationCycles=Math.max(maxQuantizationCycles,quant);
  maxModeledDelayCycles=Math.max(maxModeledDelayCycles,delay);
  totalQuant+=quant;if(delay>p.toleranceCycles)missTolerance++;
 }
 const original=encodeE1(spec.events),scoreOverBudget=encoded.length>p.scoreCapacityBytes;
 const modeledCycles=totalTicks*p.fixedIRQCycles+spec.events.length*p.cyclesPerEvent;
 const modeledShare=100*modeledCycles/adaptedEndCycles;
 const maxMissFromEventSpacing=spacingViolations;
 const violations=[];
 if(scoreOverBudget)violations.push('score RAM capacity exceeded');
 if(eventSlots<1)violations.push('even one register event cannot fit the assumed IRQ budget');
 if(overrunGroups)violations.push('per-tick work exceeds heartbeat');
 if(adaptedEndCycles>spec.endCycle+8*p.heartbeat)violations.push('adaptation would extend the song by more than eight timer ticks');
 if(maxMissFromEventSpacing)violations.push('some source updates closer than marginal per-event cost');
 if(missTolerance)violations.push('original event timestamps cannot be maintained within tolerance');
 const family=spec.candidate?.family||'unknown';
 const nativeCandidate=family==='tone'&&spec.candidate?.group==='low'&&!scoreOverBudget&&!overrunGroups&&eventSlots>=1&&adaptedEndCycles<=spec.endCycle+8*p.heartbeat;
 return {
  schema:'retroapplejs.mb06a5.native-feasibility.v1',id:spec.id,label:spec.label,
  status:nativeCandidate?'TIMING_ADAPTED_CANDIDATE':'OFFLINE_ONLY',
  originalWrites:spec.events.length,originalE1Bytes:original.length,
  adaptedE1Bytes:encoded.length,scoreCapacityBytes:p.scoreCapacityBytes,
  originalEndCycles:spec.endCycle,adaptedEndCycles,modeledIRQCount:totalTicks,
  modeledEventSlotsPerTick:eventSlots,
  meanWriteRate:spec.events.length*p.cpuHz/spec.endCycle,
  minimumPositiveEventGapCycles:minGap,sourceSpacingConflicts:spacingViolations,
  tickGroups:groups.size,maximumEventsPerTick:maxGroup,
  maximumGroupServiceCycles:maxServiceCycles,serviceOverrunGroups:overrunGroups,
  maximumQuantizationDelayCycles:maxQuantizationCycles,
  meanQuantizationDelayCycles:spec.events.length?totalQuant/spec.events.length:0,
  maximumModeledEventDelayCycles:maxModeledDelayCycles,
  eventsOutsideOriginalTolerance:missTolerance,
  modeledCpuSharePercent:modeledShare,
  assumptions:p,
  canExportAYSB:nativeCandidate,
  limitations:[
   'Original event timestamps are rounded up to the chosen Timer 1 grid and spread across additional ticks to fit the modeled serialized AY register-write budget.',
   'The score has not been executed by a 6502; modeled cost excludes instruction-dependent IRQ/decode/port-write variance and bank/ROM contention.',
   'An AYSB v1 file is not directly loaded by the existing MB-06A.3 binary; a dedicated loader/fixture is required.',
   'An audible pitch match in AYCore does not establish physical AY waveform fidelity.'
  ],violations
 };
}
function adapted(spec,options={}){
 const p={...DEFAULTS,...options};check(Number.isInteger(p.heartbeat)&&p.heartbeat>0,'Invalid heartbeat');
 const result=analyze(spec,options);
 const slots=result.modeledEventSlotsPerTick;
 let last=0,used=0;
 const events=spec.events.map(e=>{
  const earliest=Math.max(p.heartbeat,Math.ceil(e.cycle/p.heartbeat)*p.heartbeat);
  let due=Math.max(earliest,last);
  if(due===last&&used>=slots)due+=p.heartbeat;
  used=due===last?used+1:1;last=due;
  return {...e,cycle:due};
 });
 check(result.canExportAYSB,'Not safe for native 1024-cycle E1 candidate export: '+result.violations.join('; '));
 const binary=aysbV1(events,result.adaptedEndCycles,{cpuHz:p.cpuHz,ayHz:p.ayHz});
 return {events,binary,report:result};
}
return {DEFAULTS,uleb,decodeULEB,encodeE1,decodeE1,fnv1a32,aysbV1,analyze,adapted};
});
