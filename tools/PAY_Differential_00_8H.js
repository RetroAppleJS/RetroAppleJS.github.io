/* PAY-00.8H deterministic differential comparison of source-derived first-PLAY semantics.
 * No GPT calls, no frame recording as compiler input, no invented music equality.
 * Uses the SAME bounded NMOS 6502 model for original and generated programs.
 * CPU execution is not cycle-accurate C64/SID emulation.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PAYDifferential08H=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const FORMAT='PAY_Differential_Report_v0.8H';
const NEVER_TESTED=['complete source SID write sequence','note and pitch playback','instruments, ADSR and filters','effects and song/pattern loops','cycles, CIA/VIC interrupts and analogue SID output','Apple II Mockingboard AY output'];
function need(x,msg){if(!x)throw Error(msg)}
const hex=(n,w=4)=>'$'+Number(n).toString(16).toUpperCase().padStart(w,'0');
function bytesMatch(a,b){if(!a||!b||a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
function plainValue(v){return v===undefined?null:v;}
function firstDiff(x,y){const n=Math.min(x.length,y.length);for(let i=0;i<n;i++)if(x[i]!==y[i])return i;return x.length===y.length?-1:n;}
function verify({originalBytes,generatedBytes,expectedGeneratedBytes,contract,sourceHash,parseSID,symbols,frames,subtunes}){
 need(contract?.format==='PAY_Semantic_Contract_v0.8F2','Expected canonical PAY semantic contract');
 need(contract?.candidate?.mechanismId==='player_entry'&&contract.semanticExtension?.format==='PAY_First_Play_Executable_Extension_v0.8G','Only source-proven 00.8G player_entry scope is supported');
 need(contract.validation?.structure==='passed'&&contract.validation?.compilerApproval===false,'Research fixture must retain unapproved status');
 need(sourceHash===contract.source?.sha256PSID,'Original SID SHA-256 differs from semantic contract');
 need(bytesMatch(generatedBytes,expectedGeneratedBytes), 'Generated SID bytes differ from the deterministic 00.8G Compiler output (byte '+firstDiff(generatedBytes,expectedGeneratedBytes)+'). Recompile or inspect before comparing.');
 const original=parseSID(originalBytes.buffer.slice(originalBytes.byteOffset,originalBytes.byteOffset+originalBytes.byteLength));
 const generated=parseSID(generatedBytes.buffer.slice(generatedBytes.byteOffset,generatedBytes.byteOffset+generatedBytes.byteLength));
 need(original.magic==='PSID'&&generated.magic==='PSID','PSID (not RSID) required');
 need(original.load===0x1000&&original.init===0x1000&&original.play===0x1003,'Original entry points differ from the verified source');
 need(generated.load===0x1000&&generated.init===0x1000&&generated.play===0x1003,'Reference entry points differ');
 need(original.songs>=3&&generated.songs>=3,'Expected all three subtunes');
 need(Number.isInteger(frames)&&frames>=1&&frames<=64,'Frames must be between 1 and 64 (bounded source interpreter)');
 need(Array.isArray(subtunes)&&subtunes.length>0&&subtunes.every(x=>Number.isInteger(x)&&x>=0&&x<=2)&&new Set(subtunes).size===subtunes.length,'Subtunes must be distinct zero-based indices 0..2');
 for(const s of ['SR_SETUP_INDEX','SR_FIRST_PENDING','SR_PATH','SR_FIRST_COUNT','SR_REGULAR_LO','SR_REGULAR_HI','SR_CLEAR_AREA','SR_V0_ORD','SR_V1_ORD','SR_V2_ORD','SR_DYNAMIC_11B0','SR_DYNAMIC_1162'])need(Number.isInteger(symbols[s]),'Required generated symbol missing: '+s);
 return {original,generated};
}
function run(arg){
 const {originalBytes,generatedBytes,expectedGeneratedBytes,contract,sourceHash,parseSID,CPU,observationFactory,symbols}=arg;
 const frames=arg.frames??3,subtunes=arg.subtunes??[0,1,2],stepLimit=arg.stepLimit??180000;
 need(typeof CPU==='function'&&typeof observationFactory==='function'&&typeof parseSID==='function','Interpreter CPU, observation factory and PSID parser required');
 const {original,generated}=verify({originalBytes,generatedBytes,expectedGeneratedBytes,contract,sourceHash,parseSID,symbols,frames,subtunes});
 const evidence=contract.evidence?.evidence||{};
 const proof=(ids)=>ids.filter(id=>Object.hasOwn(evidence,id));
 const all=[],perSubtune=[],sourcePCs={init:0x10F7,first:0x112A,clear:0x112D,voice:0x114E,patch:0x113B,filter:0x1135,restore:0x113E};
 const mapping={
   'setupIndex':['static:$10F4','code:$10F5','operand_write:$1129<-$10F7'],
   'firstPlayGate':['flow:$112A->$112C','flow:$112A->$1161','operand_write:$1129<-$113E'],
   'firstPlayCounter':['flow:$112A->$112C','flow:$112A->$1161'],
   'branchPath':['flow:$112A->$112C','flow:$112A->$1161'],
   'clearRegion':['static:$112D','code:$112D','code:$1132','code:$1133'],
   'voiceDefault':['static:$114E','code:$114E','code:$114C','code:$1158'],
   'dynamicState':['operand_write:$1162<-$113B','code:$113B','static:$1138'],
   'sidInit':['static:$1135','code:$1135']
 };
 function check(sub,checkpoint,frame,kind,field,expected,actual,sourceAddress,targetSymbol,details={}){
  const good=expected===actual;
  const meta={subtune:sub+1,subtuneA:sub,checkpoint,frame,kind,observable:field,expected:plainValue(expected),actual:plainValue(actual),sourceAddress:sourceAddress==null?null:hex(sourceAddress),targetSymbol:targetSymbol||null,targetAddress:targetSymbol&&Number.isInteger(symbols[targetSymbol])?hex(symbols[targetSymbol]):null,evidenceIds:proof(mapping[kind]||[]),...details,pass:good};
  all.push(meta);
 }
 function cpu(h,n,a){return new CPU(h,observationFactory(h,n,a+1));}
 const read=(r,s)=>r.mem[symbols[s]];
 const edgeCount=(c,src,dst)=>c.o.flowEdges.get(src+':'+dst)?.count||0;
 for(const sub of subtunes){
  const o=cpu(original,frames,sub),r=cpu(generated,frames,sub);const begin=all.length;let sourceInitSIDCompared=0;
  o.run(original.init,sub,stepLimit,-1);r.run(generated.init,sub,stepLimit,-1);
  if(arg.testHook)arg.testHook({stage:'after_init',subtune:sub,source:o,reference:r,symbols});
  check(sub,'INIT',-1,'setupIndex','selectedVoiceBankBase',o.mem[0x1129],read(r,'SR_SETUP_INDEX'),0x1129,'SR_SETUP_INDEX');
  check(sub,'INIT',-1,'firstPlayGate','firstPLAY_pending',o.mem[0x1129]<0x80?1:0,read(r,'SR_FIRST_PENDING'),0x1129,'SR_FIRST_PENDING');
  for(let frame=0;frame<frames;frame++){
   const beforeFirst=edgeCount(o,0x112A,0x112C),beforeSteady=edgeCount(o,0x112A,0x1161);
   const sidOriginalStart=o.o.sidEvents.length,sidRefStart=r.o.sidEvents.length;
   o.run(original.play,0,stepLimit,frame);r.run(generated.play,0,stepLimit,frame);
   if(arg.testHook)arg.testHook({stage:'after_play',subtune:sub,frame,source:o,reference:r,symbols});
   const c=frame===0?'FIRST_PLAY':'STEADY_PLAY';
   const firstDelta=edgeCount(o,0x112A,0x112C)-beforeFirst,steadyDelta=edgeCount(o,0x112A,0x1161)-beforeSteady;
   const path=firstDelta===1&&steadyDelta===0?1:(firstDelta===0&&steadyDelta===1?2:-1);
   check(sub,c,frame,'branchPath','dispatchPath',path,read(r,'SR_PATH'),0x112A,'SR_PATH',{sourcePC:hex(0x112A),sourceEdge:path===1?'$112A->$112C':path===2?'$112A->$1161':'unexpected edge count'});
   check(sub,c,frame,'firstPlayGate','firstPLAY_consumed',o.mem[0x1129]===0xFF?0:1,read(r,'SR_FIRST_PENDING'),0x1129,'SR_FIRST_PENDING');
   check(sub,c,frame,'firstPlayCounter','firstPLAY_count',edgeCount(o,0x112A,0x112C),read(r,'SR_FIRST_COUNT'),0x112A,'SR_FIRST_COUNT');
   check(sub,c,frame,'firstPlayCounter','steadyPLAY_count',edgeCount(o,0x112A,0x1161),(read(r,'SR_REGULAR_HI')<<8)|read(r,'SR_REGULAR_LO'),0x112A,'SR_REGULAR_LO');
   if(frame===0){
    // Only compare the initialised state at the first complete PLAY, never later,
    // because the original *continues its uncompiled music engine* on later ticks.
    const zero=contract.semanticExtension.operation.zeroRegion;
    need(zero.sourceBase===0x14AC&&zero.length===42,'Unrecognised clear-state mapping');
    for(let k=0;k<42;k++)check(sub,c,frame,'clearRegion','clearArea['+k+']',o.mem[0x14AC+k],r.mem[symbols.SR_CLEAR_AREA+k],0x14AC+k,'SR_CLEAR_AREA',{byteOffset:k});
    for(let v=0;v<3;v++)for(const offset of [0,2,3,5]){
     const sym='SR_V'+v+'_'+(offset===0?'ORD':offset);
     need(Number.isInteger(symbols[sym]),'Missing voice symbol '+sym);
     const src=0x14D6+7*v+offset;
     check(sub,c,frame,'voiceDefault','voice['+v+'].field['+offset+']',o.mem[src],read(r,sym),src,sym,{voice:v,fieldOffset:offset});
    }
    for(const [src,sym] of [[0x11B0,'SR_DYNAMIC_11B0'],[0x1162,'SR_DYNAMIC_1162']])check(sub,c,frame,'dynamicState','patchedState('+hex(src)+')',o.mem[src],read(r,sym),src,sym);
    const srcInit=o.o.sidEvents.slice(sidOriginalStart).filter(x=>x.address===0xD415);
    const genInit=r.o.sidEvents.slice(sidRefStart).filter(x=>x.address===0xD415);
    sourceInitSIDCompared=srcInit.length?1:0;
    // Compare supported initialization event only. Other writes are intentionally uncompiled.
    check(sub,c,frame,'sidInit','SID $D415 initial value',srcInit[0]?.value??null,genInit[0]?.value??null,0xD415,null,{sourcePC:srcInit[0]?hex(srcInit[0].pc):null,sourceEventCount:srcInit.length,generatedEventCount:genInit.length});
    check(sub,c,frame,'sidInit','SID $D415 emitted exactly once',1,genInit.length,0xD415,null);
   }
  }
  perSubtune.push({subtune:sub+1,passed:all.slice(begin).every(x=>x.pass),checkCount:all.length-begin,sourceSIDWrites:o.o.sidEvents.length,generatedSIDWrites:r.o.sidEvents.length,sourceSIDWritesNotCompared:o.o.sidEvents.length-sourceInitSIDCompared,generatedNoSMC:[...r.o.payloadWriteGroups.values()].filter(x=>x.addr<symbols.SR_STATE).length===0});
 }
 const failed=all.filter(x=>!x.pass),first=failed[0]||null;
 const report={format:FORMAT,mechanismId:'player_entry',source:{fileName:contract.source.fileName||null,sha256:sourceHash,entryInit:hex(original.init),entryPlay:hex(original.play)},reference:{backend:'PAY 00.8G SID',load:hex(generated.load),init:hex(generated.init),play:hex(generated.play),deterministicallyRegenerated:true},execution:{subtunes:subtunes.map(x=>x+1),framesPerSubtune:frames,playCallsAreExternal:true,cpuTiming:'bounded non-cycle-accurate NMOS 6502'},scope:{compared:['subtune setup index','first/steady branch path and dispatch counters','one-time first PLAY 42-byte cleared region','four verified fields per each of three voices','two first-play patched-state defaults','SID $D415=0 initialization only'],notCompared:NEVER_TESTED},summary:{status:first?'FIRST_DIVERGENCE':'PASS_PARTIAL_SCOPE',passed:all.length-failed.length,failed:failed.length,total:all.length,subtunesTested:subtunes.length,allSourceSIDWritesMatched:false,musicalEquivalenceClaimed:false},perSubtune,firstDivergence:first,checks:all};
 report.counterexample=first?counterexample(report,contract):null;
 return report;
}
function counterexample(report,contract){
 need(report?.format===FORMAT&&report.firstDivergence,'Counterexample requires a failed differential check');
 const d=report.firstDivergence;
 const evidence=Object.fromEntries(d.evidenceIds.map(id=>[id,contract.evidence?.evidence?.[id]||null]));
 return {format:'PAY_Differential_Counterexample_v0.8H',kind:'source_vs_semantic_reference',status:'candidate_for_adversarial_review',subtune:d.subtune,frame:d.frame,checkpoint:d.checkpoint,observable:d.observable,kindOfState:d.kind,expectedSourceValue:d.expected,actualCompiledValue:d.actual,sourceAddress:d.sourceAddress,targetSymbol:d.targetSymbol,targetAddress:d.targetAddress,sourcePC:d.sourcePC||null,sourceEdge:d.sourceEdge||null,sourceSIDHash:report.source.sha256,compilerBackend:'PAY 00.8G SID',evidence,reproduce:{steps:['Load original PSID matching sourceSIDHash','Import canonical PAY semantic contract','Deterministically regenerate SID reference from that contract','Run INIT with A='+d.subtuneA+'; call PLAY '+Math.max(0,d.frame+1)+' time(s)','Observe '+d.observable+' at '+d.checkpoint],framesPerSubtune:report.execution.framesPerSubtune},limits:['Discrepancy does not establish whether interpretation, compiler, proof extraction or CPU model is responsible','Only implemented first-PLAY mechanisms are compared','No full-song SID or audio comparison is implied'],adversarialPrompt:'Investigate the FIRST observable divergence only. Compare its cited original 6502 source evidence with the typed semantic operation and generated source. Identify the earliest source-state transition that could explain the mismatch. Propose a minimal, falsifiable corrected semantic contract operation or additional source trace. Do not insert SID register recordings, infer missing musical logic or claim a source song loop.'};
}
return {run,counterexample,verify,bytesMatch,format:FORMAT};
});
