/* PAY-00.8G. From verified semantic contract -> independent first-PLAY SID reference code.
 * Frontend/Node, deterministic, no GPT, no SID or AY register stream input.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PAYSID08G=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function requireModules(){
 const old=typeof PAYSIDReference08F3!=='undefined'?PAYSIDReference08F3:require('./PAY_SID_Reference_Backend_00_8F3.js');
 const first=typeof PAYFirstPlay08G!=='undefined'?PAYFirstPlay08G:require('./PAY_First_Play_00_8G.js');
 return {old,first};
}
function need(x,msg){if(!x)throw Error(msg)}
function emitSource(ir,extension){
 const {old}=requireModules();const op=extension.operation;
 need(op?.kind==='first_play_voice_state_setup','Unsupported semantic extension');
 need(op.zeroRegion?.sourceBase===0x14AC&&op.zeroRegion?.length===42&&op.zeroRegion.value===0,'Only proven 42-byte source clear supported');
 need(op.voices?.sourceBase===0x14D6&&op.voices?.offsets?.join(',')==='0,7,14','Unrecognised source voice layout');
 need(op.voices.ordinal?.stride===3,'Unrecognised subtune stride');
 need(op.voices.defaults?.map(v=>v.indexOffset+':'+v.value).join(',')==='2:5,3:1,5:1','Unrecognised voice defaults');
 need(op.sidInit?.length===1&&op.sidInit[0].address===0xD415&&op.sidInit[0].value===0,'Unverified SID initialisation');
 need(op.optionalDiagnostic?.kind==='pitch_token_index_v1'&&op.optionalDiagnostic.tokenMin===0x60&&op.optionalDiagnostic.tokenMax===0xBC&&op.optionalDiagnostic.subtract===0x60,'Unverified pitch token interpretation');
 const base=old.generateSource(ir);
 need(base.includes('  JMP SR_TICK_ADVANCE') && base.includes('SR_STATE:'),'Unexpected old backend revision');
 const initialize=['','; Source $112C-$115E: first-PLAY state only (not sound engine).','; 42-byte source clear $14AC..$14D5 mapped to SR_CLEAR_AREA.','SR_FIRST_PLAY_SETUP:',
  '  LDA #$00','  LDX #$29','SR_CLEAR_42:','  STA SR_CLEAR_AREA,X','  DEX','  BPL SR_CLEAR_42',
  '  STA SR_DYNAMIC_11B0','  STA SR_DYNAMIC_1162',
  '  STA $D415',
  '  LDX #$14','SR_ZERO_VOICE_REC:','  STA SR_VOICE_RECORDS,X','  DEX','  BPL SR_ZERO_VOICE_REC',
  '; First-play Y initially = 3*subtune, and INY once per channel.',
  '  LDA SR_SETUP_INDEX','  STA SR_V0_ORD','  CLC','  ADC #$01','  STA SR_V1_ORD','  ADC #$01','  STA SR_V2_ORD',
  '  LDA #$05','  STA SR_V0_2','  STA SR_V1_2','  STA SR_V2_2',
  '  LDA #$01','  STA SR_V0_3','  STA SR_V1_3','  STA SR_V2_3',
  '  STA SR_V0_5','  STA SR_V1_5','  STA SR_V2_5',
  '  RTS','',
  '; Test-only semantic command: source $13CB -> $1222/$1227/$1228/$122A.',
  '; Converts a SOURCE PITCH CODE to a 0..92 index. Does NOT play a note.',
  'SID_REF_PITCH_INDEX:',
  '  PHA','  LDA SR_TEST_TOKEN','  CMP #$60','  BCC SR_PITCH_INVALID',
  '  CMP #$BD','  BCS SR_PITCH_INVALID',
  '  SEC','  SBC #$60','  STA SR_TEST_PITCH_INDEX',
  '  LDA #$01','  STA SR_TEST_PITCH_VALID','  JMP SR_PITCH_DONE',
  'SR_PITCH_INVALID:','  LDA #$00','  STA SR_TEST_PITCH_VALID',
  'SR_PITCH_DONE:','  PLA','  RTS',''];
 const state=['; Source $14AC..$14D5 clearing, absolute target RAM state.','SR_CLEAR_AREA:',
  '  DB '+Array.from({length:42},()=>'$00').join(','),
  '; PAY version of source operand state at $11B0 and $1162.','SR_DYNAMIC_11B0:','  DB $00','SR_DYNAMIC_1162:','  DB $00',
  '; Source pitch-code conversion test inputs/outputs.','SR_TEST_TOKEN:','  DB $00',
  'SR_TEST_PITCH_INDEX:','  DB $00','SR_TEST_PITCH_VALID:','  DB $00',
  '; Original $14D6+[0,7,14] voice records; translated as 3 * 7 bytes.','SR_VOICE_RECORDS:'];
 for(let v=0;v<3;v++)for(let i=0;i<7;i++)state.push(`SR_V${v}_${i===0?'ORD':i}:`,`  DB $00`);
 let source=base.replace('  JMP SR_TICK_ADVANCE','  JSR SR_FIRST_PLAY_SETUP\n  JMP SR_TICK_ADVANCE');
 source=source.replace('SR_STATE:',initialize.join('\n')+'\nSR_STATE:');
 source=source.replace('; END — no original SID driver code or register-event data embedded.',state.join('\n')+'\n\n; END — first-PLAY state only; no source player transplanted or register-event score.');
 source=source.replace(/PAY-00\.8F3 \/ SID REFERENCE BACKEND/, 'PAY-00.8G / SID REFERENCE BACKEND');
 source=source.replace(/This is NOT a musical conversion\. No SID writes, notes, gates, effects, tables or song loops\./,
   'FIRST PLAY STATE + one $D415=0 global-init write. No notes, gates, effects, song loops or SID voice writer.');
 return source;
}
function compileContract(c){
 const {old,first}=requireModules();
 const ir=old.validate(c);
 const ext=first.validateExtension(c,c.semanticExtension);
 return {semanticIR:ir,extension:ext,assembly:emitSource(ir,ext),diagnostics:{status:'PARTIAL_SOURCE_EQUIVALENT',
  covered:['INIT subtune index','first/steady dispatch','first PLAY clear 42 bytes','three 7-byte voice defaults','global SID $D415=0','test-only pitch-token -> pitch-index'],
  blocked:['source SID voice writer','musical instruments','notes/duration','effect dispatch','song loop'],audio:false}};
}
return {compileContract,emitSource};
});
