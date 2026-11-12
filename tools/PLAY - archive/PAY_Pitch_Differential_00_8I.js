/* PLAY-00.8I source-derived SID pitch table comparison.
 * This is a diagnostic of the pure, callable token->frequency word operation.
 * It does NOT prove note onset, scheduling, envelopes, gate, or audio equivalence.
 * No GPT, no recorded SID stream, no new application.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PAYPitchDifferential08I=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function need(x,msg){if(!x)throw Error(msg)}
const hex=(n,w=4)=>'$'+Number(n).toString(16).toUpperCase().padStart(w,'0');
function run(arg){
 const {originalBytes,generatedBytes,contract,parseSID,CPU,observationFactory,symbols}=arg;
 const pitch=typeof PAYPitch08I!=='undefined'?PAYPitch08I:require('./PAY_Pitch_00_8I.js');
 pitch.validateExtension(contract,contract?.pitchExtension);
 need(typeof CPU==='function'&&typeof parseSID==='function'&&typeof observationFactory==='function','Missing CPU / PSID parser');
 const origin=parseSID(originalBytes.buffer.slice(originalBytes.byteOffset,originalBytes.byteOffset+originalBytes.byteLength));
 const ref=parseSID(generatedBytes.buffer.slice(generatedBytes.byteOffset,generatedBytes.byteOffset+generatedBytes.byteLength));
 for(const key of ['SID_REF_PITCH_FROM_TOKEN','SR_TEST_TOKEN','SR_TEST_PITCH_INDEX','SR_TEST_PITCH_VALID','SR_TEST_FREQ_LO','SR_TEST_FREQ_HI','SR_TEST_FREQ_VALID'])need(Number.isInteger(symbols[key]),'Missing pitch diagnostic symbol '+key);
 const o=new CPU(origin,observationFactory(origin,1,1));
 const r=new CPU(ref,observationFactory(ref,1,1));
 const checks=[];
 function check(token,expectValid,index=null){
  r.mem[symbols.SR_TEST_TOKEN]=token;
  r.run(symbols.SID_REF_PITCH_FROM_TOKEN,0,2000,-1);
  const valid=r.mem[symbols.SR_TEST_PITCH_VALID]===1&&r.mem[symbols.SR_TEST_FREQ_VALID]===1;
  const actualIndex=r.mem[symbols.SR_TEST_PITCH_INDEX];
  const actualWord=r.mem[symbols.SR_TEST_FREQ_LO]|(r.mem[symbols.SR_TEST_FREQ_HI]<<8);
  const expectedWord=index===null?null:o.mem[0x1515+index]|(o.mem[0x1575+index]<<8);
  const good=expectValid===valid && (index===null||(index===actualIndex&&expectedWord===actualWord));
  checks.push({token:hex(token,2),pitchIndex:index,kind:'callable_source_pitch_word',expected:expectValid?expectedWord:null,actual:valid?actualWord:null,valid,expectedValid:expectValid,sourceLow: index===null?null:hex(0x1515+index),sourceHigh:index===null?null:hex(0x1575+index),targetIndexSymbol:'SR_TEST_PITCH_INDEX',targetLowSymbol:'SR_TEST_FREQ_LO',targetHighSymbol:'SR_TEST_FREQ_HI',evidenceIds:['static:$1318','code:$1318','static:$131E','code:$131E','static:$1228','code:$1228'],pass:good});
 }
 for(let i=0;i<93;i++)check(0x60+i,true,i);
 check(0x5F,false);check(0xBD,false);
 need(r.o.sidEvents.length===0,'Pitch diagnostic unexpectedly wrote SID register(s)');
 const first=checks.find(x=>!x.pass)||null,failed=checks.filter(x=>!x.pass).length;
 const report={format:'PLAY_Pitch_Differential_v0.8I',sourceSHA256:contract.source.sha256PSID,scope:'callable_source_pitch_word_only',sourceLookupPCs:['$1318','$131E'],testedInputs:95,validPitchTokens:93,invalidBoundaryTokens:2,doesNotWriteSIDRegisters:true,noNoteScheduleTested:true,status:first?'FIRST_DIVERGENCE':'PASS_DIAGNOSTIC_ONLY',summary:{passed:checks.length-failed,failed,total:checks.length},firstDivergence:first,checks};
 report.counterexample=first?{format:'PLAY_Pitch_Counterexample_v0.8I',kind:'callable_source_pitch_lookup',token:first.token,pitchIndex:first.pitchIndex,expected:first.expected,actual:first.actual,sourceLow:first.sourceLow,sourceHigh:first.sourceHigh,evidenceIds:first.evidenceIds,interpretation:'Diagnostic lookup mismatch; no inference about note or sound timing',task:'Check source table bytes, token subtract semantics, compiler table index, and native CPU implementation; propose a minimal evidence-supported correction. Do not replay SID events.'}:null;
 return report;
}
return {run};
});
