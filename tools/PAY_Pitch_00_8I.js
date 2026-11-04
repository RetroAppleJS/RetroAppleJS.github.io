/* PLAY-00.8I: source-verified SID pitch word lookup, callable diagnostic only.
 * Literal frequency table bytes below were extracted from the ORIGINAL Bomberland PSID,
 * not from frame captures or AY conversions. Future songs require their own verified table operations.
 * Browser/Node UMD. No GPT requests.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PAYPitch08I=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const SOURCE_SHA='65c3874b9f529c9adac45852f6e216eef2307a325051471d8b58290c38f71a68';
const LOW=[23,39,57,75,95,116,138,161,186,212,240,14,45,78,113,150,190,232,20,67,116,169,225,28,90,156,226,45,124,207,40,133,232,82,193,55,180,57,197,90,247,158,79,10,209,163,130,110,104,113,138,179,238,60,158,21,162,70,4,220,208,226,20,103,221,121,60,41,68,141,8,184,161,197,40,205,186,241,120,83,135,26,16,113,66,137,79,155,116,226,240,166,14];
const HIGH=[1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,3,3,3,3,3,4,4,4,4,5,5,5,6,6,6,7,7,8,8,9,9,10,10,11,12,13,13,14,15,16,17,18,19,20,21,23,24,26,27,29,31,32,34,36,39,41,43,46,49,52,55,58,62,65,69,73,78,82,87,92,98,104,110,117,124,131,139,147,156,165,175,185,196,208,221];
const SOURCE_OPS={
 '$1228':[0xE9,0x60], '$122A':[0x9D,0xDA,0x14], '$13CB':[0x9D,0xC3,0x14],
 '$130F':[0x9D,0x06,0x15], '$1312':[0xA8],
 '$1318':[0xB9,0x15,0x15], '$131B':[0x9D,0xEE,0x14],
 '$131E':[0xB9,0x75,0x15], '$1321':[0x9D,0xEF,0x14]
};
const COUNT=93;
function need(b,m){if(!b)throw Error(m);}
function verifySourceProof(contract){
 need(contract?.source?.sha256PSID===SOURCE_SHA,'Unexpected source PSID SHA');
 need(contract?.validation?.structure==='passed'&&contract?.semanticExtension,'Missing verified 00.8G foundation');
 const e=contract?.evidence?.evidence;need(e,'Missing source evidence index');
 for(const [pc,bytes] of Object.entries(SOURCE_OPS)){
  const x=e['static:'+pc]?.bytes;
  need(Array.isArray(x)&&x.length===bytes.length&&x.every((b,i)=>b===bytes[i]),'Pitch source instruction mismatch at '+pc);
  need(e['code:'+pc],'Pitch source execution proof missing '+pc);
 }
 // This operation claims only source table lookup. Timing/instrument and SID writes not implied.
 return Object.keys(SOURCE_OPS).flatMap(pc=>['static:'+pc,'code:'+pc]);
}
function tablesFromSID(sourceBytes){
 const s=sourceBytes instanceof Uint8Array?sourceBytes:new Uint8Array(sourceBytes);
 need(s.length>0x7c&&String.fromCharCode(...s.slice(0,4))==='PSID','Expected original PSID bytes');
 const offset=(s[6]<<8)|s[7];need(offset>=0x7c&&offset<s.length,'Invalid PSID data offset');
 let load=(s[8]<<8)|s[9],index=offset;
 if(!load){load=s[index]|(s[index+1]<<8);index+=2;}
 need(load===0x1000,'Only the original Bomberland load address supported');
 const get=(addr)=>{const n=index+addr-load;need(n>=index&&n+COUNT<=s.length,'Missing source pitch table');return Array.from(s.slice(n,n+COUNT));};
 const low=get(0x1515),high=get(0x1575);
 need(low.every((v,i)=>v===LOW[i])&&high.every((v,i)=>v===HIGH[i]),'PSID source table differs from the verified Bomberland reference');
 return {low,high};
}
function buildExtension(contract,sourceSID){
 const ids=verifySourceProof(contract),tables=tablesFromSID(sourceSID);
 return {format:'PAY_SID_Pitch_Word_v0.8I',sourceSHA256:SOURCE_SHA,
  operation:{kind:'source_pitch_table_lookup_v1',scope:'callable_diagnostic_only',pitchTokenMin:0x60,pitchTokenMax:0xBC,indexSubtract:0x60,
    noteCount:COUNT,lowTableSourceAddress:0x1515,highTableSourceAddress:0x1575,
    sourceLowOutputAddress:0x14EE,sourceHighOutputAddress:0x14EF,
    tables,doesNotEmitSIDWrites:true,doesNotScheduleNotes:true},
  proof:{kind:'static_plus_executed_source_and_psid_data',evidenceIds:ids},
  limitations:['No determination of note onset or duration','The source pitch can be transposed or modulated before lookup','No gate, ADSR, waveform or SID-register musical update','Diagnostic lookup is not called from PLAY','Tables are verified only for this exact original Bomberland PSID']};
}
function validateExtension(contract,ext){
 const proof=verifySourceProof(contract);
 need(ext?.format==='PAY_SID_Pitch_Word_v0.8I'&&ext.sourceSHA256===SOURCE_SHA,'Unrecognised pitch extension identity');
 const op=ext.operation;
 need(op?.kind==='source_pitch_table_lookup_v1'&&op.scope==='callable_diagnostic_only'&&op.pitchTokenMin===0x60&&op.pitchTokenMax===0xBC&&op.indexSubtract===0x60&&op.noteCount===COUNT,'Unsupported pitch operation');
 need(op.lowTableSourceAddress===0x1515&&op.highTableSourceAddress===0x1575&&op.sourceLowOutputAddress===0x14EE&&op.sourceHighOutputAddress===0x14EF,'Unverified source pitch table locations');
 need(op.doesNotEmitSIDWrites===true&&op.doesNotScheduleNotes===true,'Pitch operation cannot imply sound or scheduling');
 need(Array.isArray(op.tables?.low)&&op.tables.low.length===COUNT&&op.tables.low.every((v,i)=>v===LOW[i]),'Low table source bytes altered');
 need(Array.isArray(op.tables?.high)&&op.tables.high.length===COUNT&&op.tables.high.every((v,i)=>v===HIGH[i]),'High table source bytes altered');
 need(Array.isArray(ext.proof?.evidenceIds)&&proof.every(id=>ext.proof.evidenceIds.includes(id)),'Pitch proof references incomplete');
 return {sourceSHA256:SOURCE_SHA,operation:op,proof:ext.proof};
}
return {buildExtension,validateExtension,verifySourceProof,tablesFromSID,sourceTableBytes:{low:LOW.slice(),high:HIGH.slice()},sourceSHA256:SOURCE_SHA};
});
