/* PAY-00.8F3: deterministic SID-reference code generation for verified, partial
 * player_entry semantic slice. Shared source for browser Compiler and Node.
 * No AI calls, no register-stream fallback, no original executable copied.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.PAYSIDReference08F3=api;
})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const EXPECTED_SHA='65c3874b9f529c9adac45852f6e216eef2307a325051471d8b58290c38f71a68';
const REQUIRED={
  subtune_init:['code:$1000','code:$10F1','operand_write:$10F6<-$10F1','static:$10F4','code:$10F5','patch:$1129<-$10F7'],
  first_play_dispatch:['static:$1128','flow:$112A->$112C','flow:$112A->$1161','patch:$1129<-$113E','operand_read:$1129@PLAY'],
  tick_observation:['code:$1003','flow:$1003->$1126','code:$1126']
};
function need(x,msg){if(!x)throw Error(msg)}
function hex2(v){return '$'+v.toString(16).toUpperCase().padStart(2,'0')}
function validate(contract){
  need(contract?.format==='PAY_Semantic_Contract_v0.8F2','Expected PAY_Semantic_Contract_v0.8F2');
  need(contract.validation?.structure==='passed','Unvalidated candidate: contract validation.structure must be passed');
  need(contract.validation?.compilerApproval===false,'Research fixture only: production approval not implemented');
  need(contract.mechanismId==='player_entry'&&contract.candidate?.mechanismId==='player_entry','Only player_entry supported');
  need(contract.candidate?.sourceLoopProven===false,'Unproven whole-song loop is prohibited');
  need(contract.candidate?.targetPlan?.noZeroPage===true && contract.candidate?.targetPlan?.noSelfModifiedCode===true,'Expected explicit target safety constraints');
  const m=contract.compilerModule,e=contract.evidence;
  need(m?.format==='PAY_Semantic_Executable_Module_v0.8F','Missing typed executable semantic projection');
  need(e?.format==='PAY_Semantic_Evidence_v0.8','Expected indexed PAY semantic evidence');
  need(m.source?.sha256PSID===EXPECTED_SHA&&e.source?.sha256PSID===EXPECTED_SHA&&contract.source?.sha256PSID===EXPECTED_SHA,'PSID identity mismatch');
  need(m.scope==='player_entry'&&m.coverage==='partial_mechanism','Only bounded control mechanism may be compiled');
  need(m.containsAYEvents===false&&m.containsSourcePatternLoop===false,'No register-history data or unproven loops allowed');
  need(m.target?.noZeroPage===true&&m.target?.noSelfModifyingCode===true,'No zero page or self-modifying generated code');
  need(m.runtime?.firstPlayPending===true&&m.runtime?.tickClock==='external_50hz_assumption','Unrecognised control/timing semantics');
  need(m.source?.initAddress===0x1000&&m.source?.playAddress===0x1003,'Source INIT/PLAY addresses not verified');
  need(m.source?.subtunes===3&&m.source?.subtuneIndexBase===0,'Unexpected source subtune contract');
  const x=m.mechanisms;
  need(Array.isArray(x)&&x.length===3,'Expected precisely three verified semantic mechanisms');
  for(const [i,key] of Object.keys(REQUIRED).entries()){
    const it=x[i];
    need(it?.id===key,'Unexpected or out-of-order operation '+key);
    need(['observed','supported_inference'].includes(it?.proof?.confidence),'Operation not source-proven '+key);
    const ids=it?.proof?.evidenceIds||[];
    for(const r of REQUIRED[key])need(ids.includes(r) && !!e.evidence?.[r],'Missing evidence dependency '+r+' for '+key);
  }
  need(x[0].operation==='PLAYER_INIT'&&x[1].operation==='DISPATCH_STATE'&&x[2].operation==='PLAYER_TICK','Unsupported semantic operation');
  const tr=x[0].transform;
  need(tr?.kind==='op'&&tr.op==='mul'&&tr.type==='u8'&&tr.args?.[0]?.kind==='input'&&tr.args[0].id==='subtuneA'&&tr.args[1]?.kind==='const'&&tr.args[1]?.value===3,'Untyped/unproven subtune transform');
  need(e.evidence?.['static:$1000']?.bytes?.join(',')==='76,241,16','Original INIT trampoline not verified');
  need(e.evidence?.['static:$1003']?.bytes?.join(',')==='76,38,17','Original PLAY trampoline not verified');
  need(e.evidence?.['static:$10F1']?.bytes?.join(',')==='141,246,16','Original INIT patch opcode not verified');
  need(e.evidence?.['static:$1126']?.bytes?.join(',')==='162,0','Original PLAY prologue not verified');
  const candidate=contract.candidate;
  need((candidate?.targetPlan?.operations||[]).some(op=>op.op==='PLAYER_INIT') && (candidate?.targetPlan?.operations||[]).some(op=>op.op==='PLAYER_TICK'),'Candidate omits required semantic operations');
  for(const [i,claim] of (candidate.claims||[]).entries()){
    need(typeof claim.statement==='string' && Array.isArray(claim.evidenceIds),'Malformed candidate claim '+i);
    for(const id of claim.evidenceIds)need(!!e.evidence?.[id],'Candidate claims cite unknown evidence '+id);
  }
  for(const [i,op] of (candidate.targetPlan.operations||[]).entries()){
    need(Array.isArray(op.evidenceIds),'Candidate operation lacks evidence '+i);
    for(const id of op.evidenceIds)need(!!e.evidence?.[id],'Candidate operation cites unknown evidence '+id);
  }
  for(const id of ['operand_write:$10F6<-$10F1','operand_write:$1129<-$10F7','operand_write:$1129<-$113E','operand_read:$1129@$1128','flow:$112A->$112C','flow:$112A->$1161']){
    need((candidate.claims||[]).some(cl=>cl.evidenceIds.includes(id)),'Candidate omitted mandatory dependency '+id);
  }
  return {
    format:'PAY_Executable_Semantics_v0.8F3',
    sourceSHA256:EXPECTED_SHA,
    sourceAddresses:{init:0x1000,play:0x1003},
    scope:'player_entry',
    completeness:'control_slice_only',
    clock:'external_50hz_assumption',
    input:{name:'subtuneA',type:'u8',allowed:[0,1,2]},
    state:[{name:'subtuneA',type:'u8'},{name:'setupIndex',type:'u8'},{name:'firstPending',type:'bool'},{name:'firstCount',type:'u8'},{name:'regularCount',type:'u16'},{name:'tickCount',type:'u16'}],
    operations:[
      {id:'init',kind:'init_with_subtune_stride',stride:tr.args[1].value,firstPlayPending:true},
      {id:'tick',kind:'first_tick_dispatch',firstPath:1,steadyPath:2,firstFlagResets:true},
      {id:'count',kind:'tick_observation',width:16}
    ],
    unresolved:m.unresolved||[],
    evidenceIds:Object.values(REQUIRED).flat()
  };
}
function generateSource(ir){
  need(ir?.format==='PAY_Executable_Semantics_v0.8F3'&&ir.scope==='player_entry'&&ir.completeness==='control_slice_only','Unrecognised executable semantics');
  need(ir.operations?.[0]?.kind==='init_with_subtune_stride'&&ir.operations[0].stride===3,'Unsupported INIT lowering');
  need(ir.operations?.[1]?.kind==='first_tick_dispatch'&&ir.operations[1].firstFlagResets===true,'Unsupported PLAY lowering');
  need(ir.operations?.[2]?.kind==='tick_observation'&&ir.operations[2].width===16,'Unsupported counter lowering');
  const lines=[
    '; PAY-00.8F3 / SID REFERENCE BACKEND — SEMANTIC CONTROL FIXTURE ONLY',
    '; Generated deterministically from typed PAY semantic contract, never from SID writes.',
    '; Original PSID SHA256: '+ir.sourceSHA256,
    '; This is NOT a musical conversion. No SID writes, notes, gates, effects, tables or song loops.',
    '; INIT=$1000, PLAY=$1003; $1006 is an OPTIONAL test-only STOP entry.',
    '; No PAY-owned zero page, no self-modifying code. Source semantics hold in absolute RAM.',
    'ORG $1000',
    'SID_REF_INIT:','  JMP SID_REF_INIT_CORE',
    'SID_REF_PLAY:','  JMP SID_REF_PLAY_CORE',
    'SID_REF_STOP:','  JMP SID_REF_STOP_CORE',
    '',
    'SID_REF_INIT_CORE:',
    '  STA SR_INPUT_A',
    '  PHA','  TXA','  PHA','  TYA','  PHA',
    '  LDA SR_INPUT_A',
    '  CMP #$03',
    '  BCC SR_INIT_VALID',
    '  LDA #$01','  STA SR_ERROR',
    '  JMP SR_INIT_DONE',
    'SR_INIT_VALID:',
    '  LDA #$00','  STA SR_ERROR','  STA SR_FRAME_LO','  STA SR_FRAME_HI',
    '  STA SR_FIRST_COUNT','  STA SR_REGULAR_LO','  STA SR_REGULAR_HI','  STA SR_PATH',
    '  LDA #$01','  STA SR_RUNNING','  STA SR_FIRST_PENDING',
    '  LDA SR_INPUT_A','  STA SR_SUBTUNE_A',
    '  CLC','  ADC SR_INPUT_A','  ADC SR_INPUT_A',
    '  STA SR_SETUP_INDEX',
    'SR_INIT_DONE:','  PLA','  TAY','  PLA','  TAX','  PLA','  RTS',
    '',
    'SID_REF_PLAY_CORE:',
    '  PHA','  TXA','  PHA','  TYA','  PHA',
    '  LDA SR_RUNNING','  BEQ SR_TICK_DONE',
    '  LDA SR_FIRST_PENDING','  BEQ SR_TICK_STEADY',
    '  LDA #$00','  STA SR_FIRST_PENDING',
    '  INC SR_FIRST_COUNT',
    '  LDA #$01','  STA SR_PATH',
    '  JMP SR_TICK_ADVANCE',
    'SR_TICK_STEADY:',
    '  INC SR_REGULAR_LO',
    '  BNE SR_STEADY_DONE',
    '  INC SR_REGULAR_HI',
    'SR_STEADY_DONE:',
    '  LDA #$02','  STA SR_PATH',
    'SR_TICK_ADVANCE:',
    '  INC SR_FRAME_LO','  BNE SR_TICK_DONE','  INC SR_FRAME_HI',
    'SR_TICK_DONE:','  PLA','  TAY','  PLA','  TAX','  PLA','  RTS',
    '',
    'SID_REF_STOP_CORE:',
    '  PHA','  LDA #$00','  STA SR_RUNNING','  STA SR_FIRST_PENDING','  PLA','  RTS',
    '',
    'SR_STATE:',
    'SR_INPUT_A:','  DB $00',
    'SR_SUBTUNE_A:','  DB $00',
    'SR_SETUP_INDEX:','  DB $00',
    'SR_FIRST_PENDING:','  DB $00',
    'SR_RUNNING:','  DB $00',
    'SR_ERROR:','  DB $00',
    'SR_FRAME_LO:','  DB $00',
    'SR_FRAME_HI:','  DB $00',
    'SR_FIRST_COUNT:','  DB $00',
    'SR_REGULAR_LO:','  DB $00',
    'SR_REGULAR_HI:','  DB $00',
    'SR_PATH:','  DB $00',
    '', '; END — no original SID driver code or register-event data embedded.'
  ];
  return lines.join('\n')+'\n';
}
function compileContract(contract){
  const semanticIR=validate(contract);
  return {semanticIR,assembly:generateSource(semanticIR),diagnostics:{status:'PASS',scope:'partial_control',audible:false,sidWritesExpected:0,requires:['assembler','source-control oracle'],warning:'This reference SID has no musical output until downstream semantics are reconstructed.'}};
}
return {validate,generateSource,compileContract};
});
