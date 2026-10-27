/* MB-06A.2 history verifier: external JSON + generated canonical E1 reference.
   Compatible with Node.js and local browser. No unsafe HTML insertion. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports=api;
  root.MB06A2Verifier=api;
})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 function ensure(test, message){if(!test)throw Error(message);}
 function stats(a){if(!a.length)return {min:null,max:null,mean:null};return {min:Math.min(...a),max:Math.max(...a),mean:a.reduce((x,y)=>x+y,0)/a.length};}
 function decode(hist){
   ensure(hist&&hist.format==='RetroAppleJS.MockingboardHistory','Not a RetroAppleJS MockingboardHistory');
   ensure(Array.isArray(hist.events),'Missing history events');
   let tick=Number(hist.baseTick)||0;
   return hist.events.map((e,i)=>{
     ensure(Array.isArray(e)&&e.length>=4 && e.slice(0,4).every(Number.isFinite),'Malformed event '+i);
     ensure(e[0]>=0&&Number.isInteger(e[0]),'Invalid cycle delta '+i);
     tick+=e[0];return {tick,chip:e[1],reg:e[2],value:e[3]};
   });
 }
 function checkMode(rows,mode,reference,limit){
   const expectedEvents = mode===5 ? reference.eventsRegs : mode===4 ? reference.eventsLong : reference.eventsShort;
   const scoreWrites = mode===1 ? [] : expectedEvents;
   const expected=[{chip:0,reg:7,value:63},{chip:0,reg:8,value:0}]
     .concat(mode===5?[{chip:0,reg:10,value:0}]:[],
             scoreWrites.map(e=>({chip:e.chip,reg:e.register,value:e.value})),
             [{chip:0,reg:8,value:0},{chip:0,reg:9,value:0}],
             mode===5?[{chip:0,reg:10,value:0}]:[]);
   const errors=[];
   if(rows.length!==expected.length)errors.push(`Expected ${expected.length} AY writes, observed ${rows.length}`);
   for(let i=0;i<Math.min(expected.length,rows.length);i++){
     const a=rows[i],e=expected[i];
     if(a.chip!==e.chip||a.reg!==e.reg||a.value!==e.value){errors.push(`Write ${i}: expected AY${e.chip} R${e.reg}=${e.value}, actual AY${a.chip} R${a.reg}=${a.value}`);break;}
   }
   const groups=[];const widths=[];const jitter=[];
   if(mode!==1&&rows.length===expected.length&&errors.length===0){
     const scoreOffset=mode===5?3:2;
     const scoreStart=rows[scoreOffset].tick;
     let lastDeadline=null, group=null;
     expectedEvents.forEach((event,i)=>{
       const a=rows[i+scoreOffset],due=event.cycle;
       if(due!==lastDeadline){group={due,first:a.tick,last:a.tick,count:1};groups.push(group);lastDeadline=due;}
       else {group.last=a.tick;group.count++;}
     });
     const first=groups[0];
     for(const g of groups){
       g.relativeError=(g.first-first.first)-(g.due-first.due);
       g.burstWidth=g.last-g.first;
       jitter.push(g.relativeError);
       if(g.count>1)widths.push(g.burstWidth);
     }
     const peak=Math.max(...jitter.map(Math.abs));
     if(peak>limit)errors.push(`Maximum relative event-group deviation ${peak} cycles exceeds ${limit}`);
     const maxBurst=Math.max(0,...widths);
     if(maxBurst>512)errors.push(`Excessive same-deadline burst separation ${maxBurst} cycles`);
   }
   const coverage=mode===5 ? Array.from(new Set(scoreWrites.map(e=>e.register))).sort((a,b)=>a-b):[];
   const envelopeRetriggers=mode===5 ? scoreWrites.filter(e=>e.register===13).length : 0;
   if(mode===5&&coverage.join(',')!=='0,1,2,3,4,5,6,7,8,9,10,11,12,13')errors.push('Mode 5 does not exercise every AY0 sound register');
   if(mode===5&&envelopeRetriggers!==reference.R13Retriggers)errors.push('R13 retrigger count mismatch');
   return {mode,name:['','E1 dry/HGR','E1 AY/HGR','E1 AY/NOP','E1 AY/HGR long-wrap','AY0 R0-R13 register coverage'][mode],
     expectedWrites:expected.length,observedWrites:rows.length,
     registerCoverage:coverage,expectedR13Retriggers:envelopeRetriggers,
     expectedScoreEvents:scoreWrites.length,scoreGroups:groups.length,
     maxAbsRelativeGroupDeviation:jitter.length?Math.max(...jitter.map(Math.abs)):null,
     groupDeviationCycles:stats(jitter),sameDeadlineBurstCycles:stats(widths),
     success:errors.length===0,errors};
 }
 function analyze(hist,reference,opts){
   ensure(reference&&reference.format==='retroapplejs.mb06a2.reference.v1','Invalid MB06A2 reference');
   const rows=decode(hist);const markers=[];
   rows.forEach((r,i)=>{if(r.chip===0&&r.reg===7&&r.value===63)markers.push(i);});
   const errors=[];const limit=opts&&Number.isFinite(opts.maxGroupDeviation)?opts.maxGroupDeviation:128;
   if(hist.wrapped)errors.push('History buffer wrapped; capture is incomplete');
   if(hist.slot!==5)errors.push(`Expected internal SlotN=5 (physical PR#4), observed ${hist.slot}`);
   if(markers.length!==5)errors.push(`Expected five mode markers (AY0 R7=$3F); observed ${markers.length}`);
   const beforeFirst=markers.length?rows.slice(0,markers[0]):rows;
   if(beforeFirst.some(x=>x.reg!==-1))errors.push('Unexpected AY register writes before first marker');
   const results=[];
   for(let i=0;i<Math.min(markers.length,5);i++){
      const windowRows=rows.slice(markers[i],i+1<markers.length?markers[i+1]:rows.length);
      if(windowRows.some(x=>x.reg===-1)) errors.push(`Unexpected AY reset inside mode ${i+1}`);
      const modeRows=windowRows.filter(x=>x.reg!==-1);
      results.push(checkMode(modeRows,i+1,reference,limit));
   }
   for(const result of results)errors.push(...result.errors.map(e=>`Mode ${result.mode}: ${e}`));
   const observedWrites=rows.filter(x=>x.reg>=0).length;
   const expectedTotal=reference.expectedWrites.reduce((a,b)=>a+b,0);
   if(observedWrites!==expectedTotal)errors.push(`Expected ${expectedTotal} AY writes, observed ${observedWrites}`);
   return {schema:'retroapplejs.mb06a2.history.validation.v1',status:errors.length?'REVIEW':'PASS',
      source:{slot:hist.slot,physicalSlot:hist.slot===5?4:null,clockHz:hist.clockHz,wrapped:!!hist.wrapped,
              observedEvents:rows.length,observedAYWrites:observedWrites},
      expected:{modeCount:5,ayWrites:expectedTotal,scoreEvents:reference.expectedEvents,scoreBytes:[232,232,232,465,reference.scoreLength.regs]},
      modes:results,errors,
      notes:['Timing is measured relative to the first score write, not absolute T1 underflow.',
             'Mode 5 records all explicit R13 writes, including repeated shapes; it excludes R14/R15 I/O.',
             'No missing IRQs or clock epoch count can be proven from AY history alone: verify the BASIC record.']};
 }
 return {analyze};
});
