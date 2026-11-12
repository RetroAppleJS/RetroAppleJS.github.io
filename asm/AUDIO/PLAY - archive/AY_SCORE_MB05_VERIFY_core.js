/* AY_SCORE_MB05_VERIFY_core.js — standalone/browser + optional Node developer tests.
   The E1 reference is passed in from the generated manifest, never fetched remotely. */
(function(root,factory){
  var API=factory();
  if (typeof module==='object' && module.exports) module.exports=API;
  root.MB05Verifier=API;
})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 function requireTrue(condition,message){if(!condition)throw Error(message);}
 function median(a){if(!a.length)return null;const x=a.slice().sort((a,b)=>a-b);return x.length%2?x[(x.length-1)/2]:(x[x.length/2-1]+x[x.length/2])/2;}
 function numbers(xs){return {min:xs.length?Math.min(...xs):null,max:xs.length?Math.max(...xs):null,mean:xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null,median:median(xs)};}
 function snapshot(hist){
  requireTrue(hist&&hist.format==='RetroAppleJS.MockingboardHistory','Expected RetroAppleJS.MockingboardHistory JSON');
  requireTrue(Array.isArray(hist.events),'Missing events array');
  var t=Number(hist.baseTick)||0;
  var rows=[];
  hist.events.forEach(function(e,i){
   requireTrue(Array.isArray(e)&&e.length>=4&&e.every(Number.isFinite),'Invalid history event '+i);
   requireTrue(e[0]>=0,'Negative cycle delta at event '+i);
   t+=e[0];
   rows.push({tick:t,chip:e[1],reg:e[2],value:e[3],sourceIndex:i});
  });
  return rows;
 }
 function splitRuns(rows){
   const markers=[];
   for(let i=0;i<rows.length;i++)if(rows[i].chip===0&&rows[i].reg===7&&rows[i].value===63)markers.push(i);
   return {markers,groups:markers.map((start,i)=>rows.slice(start,markers[i+1]===undefined?rows.length:markers[i+1])),pre:markers.length?rows.slice(0,markers[0]):rows};
 }
 function analyze(history,reference,opts){
  opts=opts||{};
  const tolerance=Number.isFinite(opts.maxGroupDeviationCycles)?opts.maxGroupDeviationCycles:128;
  requireTrue(reference&&Array.isArray(reference.events)&&reference.events.length===64,'Expected 64 reference E1 events');
  const rows=snapshot(history),split=splitRuns(rows),issues=[],warnings=[];
  const isSynthetic=/synthetic|simulat|model/i.test(String(history.provenance||''));
  if(history.wrapped) issues.push('History ring buffer wrapped');
  if(split.markers.length!==3)issues.push('Expected exactly 3 mode markers R7=63; found '+split.markers.length);
  const physicalSlot=history.physicalSlot!==undefined?Number(history.physicalSlot):Number(history.slot)-1;
  if(physicalSlot!==4)issues.push('Expected Mockingboard at physical PR#4; history indicates '+physicalSlot);
  if(split.pre.length)warnings.push(split.pre.length+' pre-mode events ignored (e.g. reset)');
  if(isSynthetic)warnings.push('Synthetic history: useful for verifier self-tests, not emulator acceptance');
  const perMode=[];
  for(let mode=1;mode<=3;mode++){
    const actual=split.groups[mode-1]||[];
    const score=mode===1?[]:reference.events;
    const expect=[{register:7,value:63},{register:8,value:0},...score,{register:8,value:0},{register:9,value:0}];
    const errors=[];
    if(actual.length!==expect.length)errors.push('Expected '+expect.length+' writes; captured '+actual.length);
    const mismatches=[];
    for(let i=0;i<Math.min(actual.length,expect.length);i++){
      if(actual[i].chip!==0||actual[i].reg!==expect[i].register||actual[i].value!==expect[i].value){
        mismatches.push({index:i,expected:[0,expect[i].register,expect[i].value],actual:[actual[i].chip,actual[i].reg,actual[i].value]});
      }
    }
    if(mismatches.length)errors.push(mismatches.length+' register/value mismatches');
    const body=mode===1?[]:actual.slice(2,2+64);
    let groupDeviations=[],bursts=[],firstByCycle=[],bodyPass=body.length===64;
    if(body.length===64&&score.length===64){
      let firstIndex=null;
      for(let i=0;i<score.length;i++){
        if(i===0||score[i].cycle!==score[i-1].cycle){
          firstByCycle.push(i);
          if(firstIndex===null)firstIndex=i;
          groupDeviations.push((body[i].tick-body[firstIndex].tick)-(score[i].cycle-score[firstIndex].cycle));
        }else{
          bursts.push(body[i].tick-body[i-1].tick);
        }
      }
      if(Math.max(...groupDeviations.map(Math.abs))>tolerance)errors.push('Score group timing deviates by more than '+tolerance+' cycles');
      if(bursts.some(x=>x<0||x>=reference.tickCycles))errors.push('Same-deadline burst spans a full timer tick');
    }
    const allPass=!errors.length;
    perMode.push({mode,name:['','E1 dry + HGR','E1 AY + HGR','E1 AY + NOP'][mode],expectedWrites:expect.length,actualWrites:actual.length,scoreEvents:body.length,sequencePass:!mismatches.length&&actual.length===expect.length,pass:allPass,errors,mismatches:mismatches.slice(0,15),scoreGroupCount:firstByCycle.length,groupTimingError:numbers(groupDeviations),maxAbsGroupDeviation:groupDeviations.length?Math.max(...groupDeviations.map(Math.abs)):null,burstWidthCycles:numbers(bursts),scoreFirstWriteTick:body[0]?body[0].tick:null,groupDeviations});
  }
  const allWrites=rows.filter(e=>e.reg>=0&&e.reg<14).length;
  if(allWrites!==140)issues.push('Expected 140 AY register writes, found '+allWrites);
  const testsPassed=perMode.filter(x=>x.pass).length;
  const pass=testsPassed===3&&issues.length===0;
  return {schema:'retroapplejs.ay-score-mb05.validation.v1',verifier:'MB05 v0.1',provenance:isSynthetic?'SYNTHETIC instruction/VIA model':'Imported RetroAppleJS history',status:pass?'PASS':'FAIL',acceptance:isSynthetic?'NOT ACTUAL EMULATOR ACCEPTANCE':pass?'HISTORY ACCEPTANCE':'REVIEW REQUIRED',source:{physicalSlot,legacySlot:history.slot,clockHz:history.clockHz,wrapped:history.wrapped||false,totalRecords:rows.length,ayWrites:allWrites,preEvents:split.pre.length},expected:{tickCycles:reference.tickCycles,scoreEvents:64,expectedModeWrites:[4,68,68],totalWrites:140},issues,warnings,modeResults:perMode};
 }
 return {analyze,snapshot,splitRuns};
});
