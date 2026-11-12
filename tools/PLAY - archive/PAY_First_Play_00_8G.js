/* PAY-00.8G: deterministic, evidence-checked first-PLAY source semantics.
   This is NOT SID music reconstruction or a register-event converter.
   Node module and browser global PAYFirstPlay08G. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PAYFirstPlay08G=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const SHA='65c3874b9f529c9adac45852f6e216eef2307a325051471d8b58290c38f71a68';
const STATIC={
 '$112C':[0x8A], '$112D':[0xA2,0x29], '$112F':[0x9D,0xAC,0x14],
 '$1132':[0xCA], '$1133':[0x10,0xFA], '$1135':[0x8D,0x15,0xD4],
 '$1138':[0x8D,0xB0,0x11], '$113B':[0x8D,0x62,0x11],
 '$113E':[0x8E,0x29,0x11], '$1141':[0xAA], '$1142':[0x20,0x4C,0x11],
 '$1145':[0xA2,0x07], '$1147':[0x20,0x4C,0x11], '$114A':[0xA2,0x0E],
 '$114C':[0x98], '$114D':[0xC8], '$114E':[0x9D,0xD6,0x14],
 '$1151':[0xA9,0x05], '$1153':[0x9D,0xD8,0x14],
 '$1156':[0xA9,0x01], '$1158':[0x9D,0xD9,0x14], '$115B':[0x9D,0xDB,0x14],
 '$115E':[0x4C,0xF9,0x13],
 '$1222':[0xBD,0xC3,0x14], '$1227':[0x38], '$1228':[0xE9,0x60],
 '$122A':[0x9D,0xDA,0x14], '$13CB':[0x9D,0xC3,0x14]
};
const FLOW=['flow:$1133->$112F','flow:$1133->$1135','flow:$1142->$114C','flow:$1147->$114C','flow:$115E->$13F9'];
function need(ok,s){if(!ok)throw Error(s)}
function n16(b){return (b[1]||0)|((b[2]||0)<<8)}
function buildExtension(contract){
 need(contract?.format==='PAY_Semantic_Contract_v0.8F2','Expected v0.8F2 source semantic contract');
 need(contract?.source?.sha256PSID===SHA,'Unrecognised original PSID');
 need(contract?.candidate?.mechanismId==='player_entry'&&contract.validation?.structure==='passed','Unvalidated player_entry');
 need(contract.candidate?.sourceLoopProven===false,'Unproven source loop');
 const e=contract.evidence?.evidence;need(e&&contract.compilerModule,'Missing evidence or foundation compiler projection');
 // Critical: this extended operation is a verified FIRST-PLAY state transition,
 // not an inferred instrument or source-score command.
 const mismatches=[];
 for(const [pc,bytes] of Object.entries(STATIC)){
  const actual=e['static:'+pc]?.bytes;
  if(!actual||actual.length!==bytes.length||actual.some((v,i)=>v!==bytes[i]))mismatches.push(pc);
  if(!e['code:'+pc])mismatches.push('executed '+pc);
 }
 for(const id of FLOW)if(!e[id])mismatches.push(id);
 need(mismatches.length===0,'First-PLAY source proof incomplete or contradictory: '+mismatches.slice(0,8).join(', '));
 // Require the candidate actually recognised a one-time initialization and three subtunes;
 // deterministic byte provenance supplies the precise table effects.
 need((contract.candidate.claims||[]).some(c=>/first.play|first.tick/i.test(c.statement)&&c.evidenceIds.includes('flow:$112A->$112C')),'Candidate does not identify first-PLAY transition');
 const zeroedBase=n16(STATIC['$112F']),zeroedCount=STATIC['$112D'][1]+1;
 const offsets=[0,STATIC['$1145'][1],STATIC['$114A'][1]], voiceBase=n16(STATIC['$114E']);
 const defaults=[
  {indexOffset:n16(STATIC['$1153'])-voiceBase,value:STATIC['$1151'][1]},
  {indexOffset:n16(STATIC['$1158'])-voiceBase,value:STATIC['$1156'][1]},
  {indexOffset:n16(STATIC['$115B'])-voiceBase,value:STATIC['$1156'][1]}
 ];
 const proofIds=[...Object.keys(STATIC).map(pc=>'static:'+pc), ...Object.keys(STATIC).map(pc=>'code:'+pc), ...FLOW];
 return {format:'PAY_First_Play_Executable_Extension_v0.8G',sourceSHA256:SHA,
  operation:{kind:'first_play_voice_state_setup',stage:'one_time_first_play_only',
   zeroRegion:{sourceBase:zeroedBase,length:zeroedCount,value:0},
   patchedStateDefaults:[{sourceAddress:n16(STATIC['$1138']),value:0},{sourceAddress:n16(STATIC['$113B']),value:0}],
   sidInit:[{address:n16(STATIC['$1135']),value:0,scope:'first_play_global_init_only'}],
   voices:{sourceBase:voiceBase,offsets,ordinal:{kind:'subtune_stride_plus_voice',stride:3},defaults},
   firstPendingResets:true,
   optionalDiagnostic:{kind:'pitch_token_index_v1',tokenMin:0x60,tokenMax:0xBC,subtract:STATIC['$1228'][1],sourceStorage:0x14C3,targetStorage:0x14DA}},
  proof:{kind:'static_plus_executed_source',evidenceIds:proofIds},
  limitations:['Only first-PLAY global clear and per-voice state writes are implemented',
   'No source $13F9-$142B SID voice commit or downstream note/timing/instrument effects are reconstructed',
   'Pitch-code conversion is a callable diagnostic only, not connected to the music scheduler',
   'Do not compare generated SID write histories against the complete original music']};
}
function validateExtension(contract, ext){
 const derived=buildExtension(contract);
 need(ext?.format===derived.format&&ext?.sourceSHA256===derived.sourceSHA256,'Invalid first-play extension identity');
 need(JSON.stringify(ext.operation)===JSON.stringify(derived.operation),'First-play typed operation differs from source evidence');
 need(Array.isArray(ext.proof?.evidenceIds),'Missing source proof');
 for(const id of derived.proof.evidenceIds)need(ext.proof.evidenceIds.includes(id)&&!!contract.evidence.evidence[id],'First-play proof missing: '+id);
 return derived;
}
function attach(contract){const newContract=JSON.parse(JSON.stringify(contract));newContract.semanticExtension=buildExtension(newContract);return newContract;}
return {buildExtension,validateExtension,attach};
});
