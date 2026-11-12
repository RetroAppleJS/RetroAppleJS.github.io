/* Phase 1.5A.2 AY register-history verifier v0.1.1.
   Standalone, browser compatible, no emulator mutation.
   Expected timeline derives from 548-byte AY_SCORE_TIMING_BENCH.S v0.1.
   Expected source is instruction-level MODEL DATA, not captured telemetry.
*/
(function(root){
'use strict';
const EXPECTED = {"schema":"retroapplejs.ay-score-timing-history.expected.v1","provenance":"6502 instruction-model transaction sequence; NOT captured Mockingboard history","assembly":"AY_SCORE_TIMING_BENCH.S v0.1, $6000, 548 bytes","expected":[{"mode":1,"label":"MB-01","measuredWrites":64,"expectedCapturedEvents":67,"events":[{"cycle":0,"ay":0,"register":7,"value":63},{"cycle":48,"ay":0,"register":8,"value":0},{"cycle":228,"ay":0,"register":8,"value":15},{"cycle":275,"ay":0,"register":8,"value":0},{"cycle":322,"ay":0,"register":8,"value":15},{"cycle":369,"ay":0,"register":8,"value":0},{"cycle":416,"ay":0,"register":8,"value":15},{"cycle":463,"ay":0,"register":8,"value":0},{"cycle":510,"ay":0,"register":8,"value":15},{"cycle":557,"ay":0,"register":8,"value":0},{"cycle":604,"ay":0,"register":8,"value":15},{"cycle":651,"ay":0,"register":8,"value":0},{"cycle":698,"ay":0,"register":8,"value":15},{"cycle":745,"ay":0,"register":8,"value":0},{"cycle":792,"ay":0,"register":8,"value":15},{"cycle":839,"ay":0,"register":8,"value":0},{"cycle":886,"ay":0,"register":8,"value":15},{"cycle":933,"ay":0,"register":8,"value":0},{"cycle":980,"ay":0,"register":8,"value":15},{"cycle":1027,"ay":0,"register":8,"value":0},{"cycle":1074,"ay":0,"register":8,"value":15},{"cycle":1121,"ay":0,"register":8,"value":0},{"cycle":1168,"ay":0,"register":8,"value":15},{"cycle":1215,"ay":0,"register":8,"value":0},{"cycle":1262,"ay":0,"register":8,"value":15},{"cycle":1309,"ay":0,"register":8,"value":0},{"cycle":1356,"ay":0,"register":8,"value":15},{"cycle":1403,"ay":0,"register":8,"value":0},{"cycle":1450,"ay":0,"register":8,"value":15},{"cycle":1497,"ay":0,"register":8,"value":0},{"cycle":1544,"ay":0,"register":8,"value":15},{"cycle":1591,"ay":0,"register":8,"value":0},{"cycle":1638,"ay":0,"register":8,"value":15},{"cycle":1685,"ay":0,"register":8,"value":0},{"cycle":1732,"ay":0,"register":8,"value":15},{"cycle":1779,"ay":0,"register":8,"value":0},{"cycle":1826,"ay":0,"register":8,"value":15},{"cycle":1873,"ay":0,"register":8,"value":0},{"cycle":1920,"ay":0,"register":8,"value":15},{"cycle":1967,"ay":0,"register":8,"value":0},{"cycle":2014,"ay":0,"register":8,"value":15},{"cycle":2061,"ay":0,"register":8,"value":0},{"cycle":2108,"ay":0,"register":8,"value":15},{"cycle":2155,"ay":0,"register":8,"value":0},{"cycle":2202,"ay":0,"register":8,"value":15},{"cycle":2249,"ay":0,"register":8,"value":0},{"cycle":2296,"ay":0,"register":8,"value":15},{"cycle":2343,"ay":0,"register":8,"value":0},{"cycle":2390,"ay":0,"register":8,"value":15},{"cycle":2437,"ay":0,"register":8,"value":0},{"cycle":2484,"ay":0,"register":8,"value":15},{"cycle":2531,"ay":0,"register":8,"value":0},{"cycle":2578,"ay":0,"register":8,"value":15},{"cycle":2625,"ay":0,"register":8,"value":0},{"cycle":2672,"ay":0,"register":8,"value":15},{"cycle":2719,"ay":0,"register":8,"value":0},{"cycle":2766,"ay":0,"register":8,"value":15},{"cycle":2813,"ay":0,"register":8,"value":0},{"cycle":2860,"ay":0,"register":8,"value":15},{"cycle":2907,"ay":0,"register":8,"value":0},{"cycle":2954,"ay":0,"register":8,"value":15},{"cycle":3001,"ay":0,"register":8,"value":0},{"cycle":3048,"ay":0,"register":8,"value":15},{"cycle":3095,"ay":0,"register":8,"value":0},{"cycle":3142,"ay":0,"register":8,"value":15},{"cycle":3189,"ay":0,"register":8,"value":0},{"cycle":3331,"ay":0,"register":8,"value":0}]},{"mode":2,"label":"MB-02","measuredWrites":64,"expectedCapturedEvents":67,"events":[{"cycle":0,"ay":0,"register":7,"value":63},{"cycle":48,"ay":0,"register":8,"value":0},{"cycle":240,"ay":0,"register":8,"value":15},{"cycle":269,"ay":0,"register":8,"value":0},{"cycle":298,"ay":0,"register":8,"value":15},{"cycle":327,"ay":0,"register":8,"value":0},{"cycle":356,"ay":0,"register":8,"value":15},{"cycle":385,"ay":0,"register":8,"value":0},{"cycle":414,"ay":0,"register":8,"value":15},{"cycle":443,"ay":0,"register":8,"value":0},{"cycle":472,"ay":0,"register":8,"value":15},{"cycle":501,"ay":0,"register":8,"value":0},{"cycle":530,"ay":0,"register":8,"value":15},{"cycle":559,"ay":0,"register":8,"value":0},{"cycle":588,"ay":0,"register":8,"value":15},{"cycle":617,"ay":0,"register":8,"value":0},{"cycle":646,"ay":0,"register":8,"value":15},{"cycle":675,"ay":0,"register":8,"value":0},{"cycle":704,"ay":0,"register":8,"value":15},{"cycle":733,"ay":0,"register":8,"value":0},{"cycle":762,"ay":0,"register":8,"value":15},{"cycle":791,"ay":0,"register":8,"value":0},{"cycle":820,"ay":0,"register":8,"value":15},{"cycle":849,"ay":0,"register":8,"value":0},{"cycle":878,"ay":0,"register":8,"value":15},{"cycle":907,"ay":0,"register":8,"value":0},{"cycle":936,"ay":0,"register":8,"value":15},{"cycle":965,"ay":0,"register":8,"value":0},{"cycle":994,"ay":0,"register":8,"value":15},{"cycle":1023,"ay":0,"register":8,"value":0},{"cycle":1052,"ay":0,"register":8,"value":15},{"cycle":1081,"ay":0,"register":8,"value":0},{"cycle":1110,"ay":0,"register":8,"value":15},{"cycle":1139,"ay":0,"register":8,"value":0},{"cycle":1168,"ay":0,"register":8,"value":15},{"cycle":1197,"ay":0,"register":8,"value":0},{"cycle":1226,"ay":0,"register":8,"value":15},{"cycle":1255,"ay":0,"register":8,"value":0},{"cycle":1284,"ay":0,"register":8,"value":15},{"cycle":1313,"ay":0,"register":8,"value":0},{"cycle":1342,"ay":0,"register":8,"value":15},{"cycle":1371,"ay":0,"register":8,"value":0},{"cycle":1400,"ay":0,"register":8,"value":15},{"cycle":1429,"ay":0,"register":8,"value":0},{"cycle":1458,"ay":0,"register":8,"value":15},{"cycle":1487,"ay":0,"register":8,"value":0},{"cycle":1516,"ay":0,"register":8,"value":15},{"cycle":1545,"ay":0,"register":8,"value":0},{"cycle":1574,"ay":0,"register":8,"value":15},{"cycle":1603,"ay":0,"register":8,"value":0},{"cycle":1632,"ay":0,"register":8,"value":15},{"cycle":1661,"ay":0,"register":8,"value":0},{"cycle":1690,"ay":0,"register":8,"value":15},{"cycle":1719,"ay":0,"register":8,"value":0},{"cycle":1748,"ay":0,"register":8,"value":15},{"cycle":1777,"ay":0,"register":8,"value":0},{"cycle":1806,"ay":0,"register":8,"value":15},{"cycle":1835,"ay":0,"register":8,"value":0},{"cycle":1864,"ay":0,"register":8,"value":15},{"cycle":1893,"ay":0,"register":8,"value":0},{"cycle":1922,"ay":0,"register":8,"value":15},{"cycle":1951,"ay":0,"register":8,"value":0},{"cycle":1980,"ay":0,"register":8,"value":15},{"cycle":2009,"ay":0,"register":8,"value":0},{"cycle":2038,"ay":0,"register":8,"value":15},{"cycle":2067,"ay":0,"register":8,"value":0},{"cycle":2209,"ay":0,"register":8,"value":0}]},{"mode":3,"label":"MB-03","measuredWrites":32,"expectedCapturedEvents":35,"events":[{"cycle":0,"ay":0,"register":7,"value":63},{"cycle":48,"ay":0,"register":8,"value":0},{"cycle":263,"ay":0,"register":8,"value":15},{"cycle":316,"ay":0,"register":8,"value":0},{"cycle":369,"ay":0,"register":8,"value":15},{"cycle":422,"ay":0,"register":8,"value":0},{"cycle":475,"ay":0,"register":8,"value":15},{"cycle":528,"ay":0,"register":8,"value":0},{"cycle":581,"ay":0,"register":8,"value":15},{"cycle":634,"ay":0,"register":8,"value":0},{"cycle":687,"ay":0,"register":8,"value":15},{"cycle":740,"ay":0,"register":8,"value":0},{"cycle":793,"ay":0,"register":8,"value":15},{"cycle":846,"ay":0,"register":8,"value":0},{"cycle":899,"ay":0,"register":8,"value":15},{"cycle":952,"ay":0,"register":8,"value":0},{"cycle":1005,"ay":0,"register":8,"value":15},{"cycle":1058,"ay":0,"register":8,"value":0},{"cycle":1111,"ay":0,"register":8,"value":15},{"cycle":1164,"ay":0,"register":8,"value":0},{"cycle":1217,"ay":0,"register":8,"value":15},{"cycle":1270,"ay":0,"register":8,"value":0},{"cycle":1323,"ay":0,"register":8,"value":15},{"cycle":1376,"ay":0,"register":8,"value":0},{"cycle":1429,"ay":0,"register":8,"value":15},{"cycle":1486,"ay":0,"register":8,"value":0},{"cycle":1543,"ay":0,"register":8,"value":15},{"cycle":1600,"ay":0,"register":8,"value":0},{"cycle":1657,"ay":0,"register":8,"value":15},{"cycle":1714,"ay":0,"register":8,"value":0},{"cycle":1771,"ay":0,"register":8,"value":15},{"cycle":1828,"ay":0,"register":8,"value":0},{"cycle":1885,"ay":0,"register":8,"value":15},{"cycle":1942,"ay":0,"register":8,"value":0},{"cycle":2078,"ay":0,"register":8,"value":0}]}]};
const byMode = new Map(EXPECTED.expected.map(x=>[x.mode,x]));
const VALID_MODES=[1,2,3];
function assert(ok,message){if(!ok)throw new Error(message);}
function finiteInteger(n){return typeof n==='number'&&Number.isSafeInteger(n);}
function decodeHistory(source){
  assert(source && typeof source==='object','JSON must be an object');
  assert(source.format==='RetroAppleJS.MockingboardHistory','Incorrect format: expected RetroAppleJS.MockingboardHistory');
  assert(source.version===1,'Unsupported history version');
  assert(finiteInteger(source.baseTick),'baseTick must be an integer');
  assert(Array.isArray(source.events),'events must be an array');
  let tick=source.baseTick;
  const events=source.events.map((entry,i)=>{
    assert(Array.isArray(entry)&&entry.length===4,`Malformed history event #${i+1}`);
    const [delta,ay,register,value]=entry;
    assert([delta,ay,register,value].every(finiteInteger),`Non-integer data at event #${i+1}`);
    assert(delta>=0&&delta<=Number.MAX_SAFE_INTEGER-tick,`Invalid cycle delta at event #${i+1}`);
    assert(ay===0||ay===1,`Invalid AY number at event #${i+1}`);
    assert(register===-1||(register>=0&&register<=13),`Invalid register at event #${i+1}`);
    assert(value>=0&&value<=255,`Invalid value at event #${i+1}`);
    tick+=delta;
    return {tick,delta,ay,register,value,recordIndex:i};
  });
  return {events,wrapped:!!source.wrapped,capturing:!!source.capturing,slot:source.slot,clockHz:source.clockHz,baseTick:source.baseTick,sourceMeta:source};
}
function splitRuns(decoded){
  const groups=[];let current=null;const preamble=[];
  for(const ev of decoded.events){
    if(ev.ay===0&&ev.register===7&&ev.value===63){
      current={events:[],startIndex:ev.recordIndex};groups.push(current);
    }
    if(current)current.events.push(ev);else preamble.push(ev);
  }
  return {groups,preamble};
}
function compareGroup(group, ref, tolerance){
  const actual=group.events, expected=ref.events;
  const sequenceErrors=[];const timingErrors=[];
  const count=Math.min(actual.length,expected.length);
  const origin=actual.length?actual[0].tick:0;
  let maxTimingError=0;const deviations=[];
  for(let i=0;i<count;i++){
    const a=actual[i], e=expected[i];
    if(a.ay!==e.ay||a.register!==e.register||a.value!==e.value)
      sequenceErrors.push({index:i,expected:`AY${e.ay} R${e.register} $${e.value.toString(16).padStart(2,'0')}`,
        actual:`AY${a.ay} R${a.register} $${a.value.toString(16).padStart(2,'0')}`});
    const observed=a.tick-origin;
    const difference=observed-e.cycle;
    deviations.push(difference);
    maxTimingError=Math.max(maxTimingError,Math.abs(difference));
    if(Math.abs(difference)>tolerance)
      timingErrors.push({index:i,expectedCycles:e.cycle,observedCycles:observed,deviationCycles:difference});
  }
  const r8=actual.filter(x=>x.ay===0&&x.register===8);
  const body=actual.slice(2,Math.max(2,actual.length-1)).filter(x=>x.ay===0&&x.register===8);
  const spacings=body.slice(1).map((x,i)=>x.tick-body[i].tick);
  const counts={expectedAll:expected.length,actualAll:actual.length,
    expectedBodyWrites:ref.measuredWrites,actualBodyWrites:body.length,
    expectedTotalR8:ref.measuredWrites+2,actualTotalR8:r8.length};
  const exactSequence=(actual.length===expected.length&&sequenceErrors.length===0);
  const matchedTiming=(actual.length===expected.length&&timingErrors.length===0);
  const expectedSpacings=ref.events.slice(2,-1).slice(1).map((e,i)=>e.cycle-ref.events.slice(2,-1)[i].cycle);
  return {mode:ref.mode,label:ref.label,counts,exactSequence,matchedTiming,pass:exactSequence&&matchedTiming,
    firstBodyCycle:body.length?body[0].tick-origin:null,maxTimingError,
    sequenceErrors,timingErrors,deviations,spacings,expectedSpacings,
    startTick:origin,endTick:actual.length?actual[actual.length-1].tick:null};
}
function fitScore(x){
  // Prioritize counts and register-value fidelity; timing resolves MB01 vs MB02.
  return Math.abs(x.counts.expectedAll-x.counts.actualAll)*10000+
    x.sequenceErrors.length*1000+
    x.timingErrors.length*10+
    Math.min(x.maxTimingError,10000);
}
function verify(source, options={}){
  const decoded=decodeHistory(source), tol=Number(options.toleranceCycles??2);
  assert(Number.isFinite(tol)&&tol>=0&&tol<=100,'toleranceCycles must be between 0 and 100');
  const {groups,preamble}=splitRuns(decoded);
  const errors=[],warnings=[];
  if(decoded.wrapped)errors.push('Capture ring-buffer wrapped: beginning may have been lost. Repeat at 64 KB or larger.');
  if(decoded.capturing)warnings.push('History export was taken while capturing. Stop first to avoid truncation.');
  // RetroAppleJS v2026-10-24's historySlotNumber() returned the internal
  // io.slots[] index rather than its physical slot, hence a physical slot-4
  // Mockingboard was exported with metadata slot:5.  This is a metadata bug;
  // it does not change the AY bus addresses or recorded CPU ticks.
  const taggedSlot=decoded.slot==null?null:Number(decoded.slot);
  const legacyInternalSlotIndex=taggedSlot===5;
  const physicalSlot=legacyInternalSlotIndex?4:taggedSlot;
  if(legacyInternalSlotIndex)warnings.push('Legacy RetroAppleJS history metadata: slot 5 is the internal io.slots[] index for physical slot 4. Interpreted as slot 4; original metadata preserved.');
  if(physicalSlot!==null&&physicalSlot!==4)errors.push(`This benchmark targets physical Mockingboard slot 4; capture reports slot ${taggedSlot}.`);
  if(preamble.length)warnings.push(`${preamble.length} event(s) preceded first test marker and were excluded.`);
  if(!groups.length)errors.push('No MB test marker found (AY0 mixer register R7 = $3F). Start capture before CALL.');
  const preferred=options.expectedMode==null?null:Number(options.expectedMode);
  assert(preferred===null||VALID_MODES.includes(preferred),'Invalid requested benchmark mode');
  if(preferred!==null&&groups.length>1)warnings.push('Expected-mode override was requested with multiple runs: all runs compared to same mode.');
  const analyses=groups.map(g=>{
    const candidates=(preferred? [byMode.get(preferred)]:EXPECTED.expected).map(ref=>compareGroup(g,ref,tol));
    candidates.sort((a,b)=>fitScore(a)-fitScore(b));
    return candidates[0];
  });
  const seen=analyses.map(x=>x.mode);
  if(seen.length>1&&new Set(seen).size!==seen.length)warnings.push('Multiple segments identified as the same mode; verify capture order.');
  const pass=errors.length===0&&analyses.length>0&&analyses.every(x=>x.pass);
  return {schema:'retroapplejs.ay-score-timing-history.validation.v1',verifier:'AY_SCORE_HISTORY_VERIFY v0.1.1',
    provenance:'Comparison against instruction-model expected sequence, NOT independent hardware measurements',
    status:pass?'PASS':'FAIL',toleranceCycles:tol,model:'Mockingboard slot 4; 6502; AY0',
    capturedEvents:decoded.events.length,identifiedRuns:analyses.length,preCaptureEvents:preamble.length,
    source:{slot:decoded.slot,physicalSlot,slotMetadataKind:legacyInternalSlotIndex?'legacy-internal-index-plus-one':'physical-or-unspecified',clockHz:decoded.clockHz,wrapped:decoded.wrapped,baseTick:decoded.baseTick},
    errors,warnings,analyses};
}
function simulated(mode){
  const refs=mode? [byMode.get(mode)] : EXPECTED.expected;
  assert(refs.every(Boolean),'Unknown simulated mode');
  const events=[];let t=100000;
  for(const ref of refs){
    for(const item of ref.events)events.push({tick:t+item.cycle,ay:item.ay,register:item.register,value:item.value});
    t+=ref.events[ref.events.length-1].cycle+12000;
  }
  let last=90000;
  return {format:'RetroAppleJS.MockingboardHistory',version:1,
    slot:4,clockHz:1023000,bufferKB:64,baseTick:90000,stopTick:t,wrapped:false,
    events:events.map(e=>{const d=e.tick-last;last=e.tick;return [d,e.ay,e.register,e.value];}),
    TEST_FIXTURE_ONLY:'Synthetic reference - NOT exported by RetroAppleJS'};
}
function selfCheck(){
  const output=[];
  function check(name,condition){output.push({name,pass:!!condition});}
  for(const m of VALID_MODES){const r=verify(simulated(m));check(`Synthetic MB-0${m} round-trip`,r.status==='PASS'&&r.analyses[0].mode===m);}
  const combined=verify(simulated());check('All three synthetic runs split correctly',combined.status==='PASS'&&combined.identifiedRuns===3);
  const legacy=simulated();legacy.slot=5;
  const legacyReport=verify(legacy);
  check('Legacy slot-5 internal index maps to physical slot 4',legacyReport.status==='PASS'&&legacyReport.source.physicalSlot===4&&legacyReport.warnings.some(x=>x.includes('internal io.slots[]')));
  const unrelated=simulated(1);unrelated.slot=6;
  check('Non-target slot metadata is rejected',verify(unrelated).status==='FAIL');
  const wrong=simulated(1);wrong.events[10][3]=99;check('Wrong volume is rejected',verify(wrong).status==='FAIL');
  const skew=simulated(2);skew.events[18][0]+=20;check('Timestamp displacement is detected',verify(skew).status==='FAIL');
  const missing=simulated(3);missing.events.splice(12,1);check('Missing event is detected',verify(missing).status==='FAIL');
  const chip=simulated(1);chip.events[9][1]=1;check('Wrong AY chip is detected',verify(chip).status==='FAIL');
  const wrap=simulated(2);wrap.wrapped=true;check('Truncated ring-buffer is rejected',verify(wrap).status==='FAIL');
  const reset=simulated(3);reset.events[11][2]=-1;check('Unexpected AY reset is rejected',verify(reset).status==='FAIL');
  return {passed:output.filter(x=>x.pass).length,total:output.length,checks:output};
}
root.AYScoreHistoryVerify={EXPECTED,decodeHistory,splitRuns,compareGroup,verify,simulated,selfCheck};
})(typeof window!=='undefined'?window:globalThis);
