/* MB-06A.3 E1 musical history verifier. Embedded-reference-friendly UMD;
   browser and Node.js, zero dependencies, no HTML insertion or network calls. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.MB06A3Verifier=api;
})(typeof window!=='undefined'?window:this,function(){
'use strict';
function ensure(ok,msg){if(!ok)throw Error(msg);}
function summarize(xs){return xs.length?{min:Math.min(...xs),max:Math.max(...xs),mean:xs.reduce((a,b)=>a+b,0)/xs.length}:null;}
function decode(h){
  ensure(h && h.format==='RetroAppleJS.MockingboardHistory','Expected RetroAppleJS.MockingboardHistory JSON');
  ensure(Array.isArray(h.events),'Missing events');
  let t=Number(h.baseTick)||0;
  return h.events.map((e,i)=>{
    ensure(Array.isArray(e)&&e.length>=4&&e.slice(0,4).every(Number.isFinite),'Invalid history event '+i);
    ensure(Number.isInteger(e[0])&&e[0]>=0,'Invalid event delta '+i);
    t+=e[0];
    return {tick:t,chip:e[1],reg:e[2],value:e[3]};
  });
}
function startsAt(rows,i){
  // The score *also* explicitly writes R7=$3F on final shutdown;
  // distinguish the mode boundary from that score write with full setup triad.
  return i+2<rows.length && rows[i].chip===0 && rows[i].reg===7 && rows[i].value===63 &&
         rows[i+1].chip===0 && rows[i+1].reg===8 && rows[i+1].value===0 &&
         rows[i+2].chip===0 && rows[i+2].reg===10 && rows[i+2].value===0;
}
function modeCheck(rows,mode,reference,limit){
  const score=reference.eventsMusic;
  const setup=[{chip:0,reg:7,value:63},{chip:0,reg:8,value:0},{chip:0,reg:10,value:0}];
  const cleanup=[{chip:0,reg:8,value:0},{chip:0,reg:9,value:0},{chip:0,reg:10,value:0}];
  const expected=setup.concat(score.map(e=>({chip:e.chip,reg:e.register,value:e.value})),cleanup);
  const errors=[];
  if(rows.length!==expected.length)errors.push(`Expected ${expected.length} AY writes, saw ${rows.length}`);
  for(let i=0;i<Math.min(rows.length,expected.length);i++){
    const a=rows[i],b=expected[i];
    if(a.chip!==b.chip||a.reg!==b.reg||a.value!==b.value){
      errors.push(`Write ${i}: AY${a.chip} R${a.reg}=${a.value} instead of AY${b.chip} R${b.reg}=${b.value}`);break;
    }
  }
  let jitter=[],groups=0;
  if(errors.length===0){
    const anchor=rows[3].tick,first=score[0].cycle;
    for(let i=0;i<score.length;i++){
      const e=score[i],timestamp=rows[3+i].tick;
      if(i>0 && e.cycle===score[i-1].cycle)errors.push('Music fixture unexpectedly has coincident writes');
      const deviation=(timestamp-anchor)-(e.cycle-first);
      jitter.push(deviation);groups++;
    }
    if(Math.max(...jitter.map(Math.abs))>limit)errors.push(`Relative music timing deviation exceeds ${limit} cycles`);
  }
  const actualRegs=score.map(e=>e.register);
  const coverage=Array.from(new Set(actualRegs)).sort((a,b)=>a-b);
  if(coverage.join(',')!=='0,1,2,3,4,5,6,7,8,9,10,11,12,13') errors.push('Music fixture register coverage incomplete');
  const retriggers=actualRegs.filter(r=>r===13).length;
  if(retriggers!==reference.musicR13Retriggers)errors.push('Incorrect R13 shape/retrigger count');
  const noteRows=[];
  if(errors.length===0){
    // Correlate the note metadata with captured period low/high and amp onsets.
    for(const note of reference.melodyNotes){
      const t=note.startCycles;
      const e0=score.findIndex(e=>e.cycle===t+1024&&e.register===0);
      ensure(e0>=0,'Missing expected note fine period at '+note.note);
      const fine=rows[3+e0], coarse=rows[3+e0+1], onset=rows[3+e0+2];
      const p=fine.value+(coarse.value<<8);
      const hz=reference.clockHz/(16*p);
      const cents=1200*Math.log2(hz/note.expectedHz);
      if(p!==note.ayPeriod||coarse.reg!==1||onset.reg!==8)errors.push('Note programming mismatch '+note.note);
      if(Math.abs(cents)>15)errors.push('Pitch outside 15-cent tolerance for '+note.note);
      noteRows.push({note:note.note,startCycles:t,period:p,realizedHz:hz,detuningCents:cents,
                     volumeOnsetCycle:onset.tick-rows[3].tick});
    }
  }
  return {mode,name:mode===5?'Frère Jacques + HGR':'Frère Jacques + NOP',
    expectedWrites:expected.length,observedWrites:rows.length,
    scoreEvents:score.length,scoreDeadlineGroups:groups,
    maxAbsRelativeGroupDeviation:jitter.length?Math.max(...jitter.map(Math.abs)):null,
    timingDeviationCycles:summarize(jitter),registerCoverage:coverage,
    explicitR13Writes:retriggers,notes:noteRows,
    success:errors.length===0,errors};
}
function analyze(history,reference,opts){
  ensure(reference && reference.format==='retroapplejs.mb06a3.reference.v1','Expected MB06A3 reference');
  ensure(Array.isArray(reference.eventsMusic)&&Array.isArray(reference.melodyNotes),'Incomplete reference');
  const rows=decode(history),startIndices=[];
  for(let i=0;i<rows.length;i++)if(startsAt(rows,i))startIndices.push(i);
  const errors=[];const limit=Number.isFinite(opts?.maxGroupDeviation)?opts.maxGroupDeviation:128;
  if(history.slot!==5)errors.push(`Wrong slot: ${history.slot} (expected internal SlotN=5)`);
  if(history.wrapped)errors.push('Mockingboard history buffer wrapped');
  if(Number(history.clockHz)!==Number(reference.clockHz))errors.push('Wrong CPU clock frequency');
  if(startIndices.length!==2)errors.push(`Expected two musical mode setup triads, saw ${startIndices.length}`);
  if(startIndices.length&&rows.slice(0,startIndices[0]).some(r=>r.reg!==-1)) errors.push('Unexpected AY writes before first mode');
  const results=[];
  for(let i=0;i<Math.min(startIndices.length,2);i++){
    const window=rows.slice(startIndices[i],i===0?startIndices[1]??rows.length:rows.length);
    if(window.some(e=>e.reg===-1)) errors.push('Unexpected AY reset during mode '+(i+5));
    const m=modeCheck(window.filter(e=>e.reg!==-1),5+i,reference,limit);
    results.push(m);errors.push(...m.errors.map(e=>`Mode ${m.mode}: ${e}`));
  }
  const writes=rows.filter(r=>r.reg>=0).length;
  if(writes!==reference.expectedWrites.reduce((a,b)=>a+b,0))errors.push('Total AY register write count mismatch');
  return {schema:'retroapplejs.mb06a3.history.validation.v1',status:errors.length?'REVIEW':'PASS',
    source:{slot:history.slot,physicalSlot:history.slot===5?4:null,clockHz:history.clockHz,wrapped:!!history.wrapped,
      resetBeforeMode:startIndices.length?rows.slice(0,startIndices[0]).filter(r=>r.reg===-1).length:null,
      totalAYWrites:writes},
    expected:{modes:[5,6],eventsPerMode:reference.eventsMusic.length,writeCount:reference.expectedWrites,
      scoreBytes:reference.scoreLength.music,irqCountPerMode:reference.expectedIrqs[0],
      melodyNotes:reference.melodyNotes.length},modes:results,errors,
    limitations:[
      'Relative event timing is anchored to the first actual AY score event, not to VIA Timer1 underflow.',
      'A register-history PASS verifies programming and musical pitch metadata, not waveform fidelity or perceptual recognition.',
      'Timer2 wrap epochs and IRQ counts must be checked against Applesoft output; they are not in AY history.',
      'The included WAV is an approximate listening guide, not a synthesized AY PCM golden master.'
    ]};
}
return {analyze,decode};
});
