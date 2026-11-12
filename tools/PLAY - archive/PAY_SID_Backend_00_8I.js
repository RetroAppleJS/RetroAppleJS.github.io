/* PLAY-00.8I: deterministic SID reference extension, source pitch-table lookup only.
 * Retains exact 00.8G INIT/PLAY and first-play differential scope.
 * Does NOT schedule notes, emit new SID writes, or claim audible music.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PAYSID08I=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function modules(){
 const base=typeof PAYSID08G!=='undefined'?PAYSID08G:require('./PAY_SID_Backend_00_8G.js');
 const pitch=typeof PAYPitch08I!=='undefined'?PAYPitch08I:require('./PAY_Pitch_00_8I.js');
 return {base,pitch};
}
function byte(v){return '$'+v.toString(16).toUpperCase().padStart(2,'0')}
function table(rows){const out=[];for(let i=0;i<rows.length;i+=16)out.push('  DB '+rows.slice(i,i+16).map(byte).join(','));return out.join('\n')}
function emitSource(baseSource,op){
 if(!baseSource.includes('SR_STATE:')||!baseSource.includes('SR_TEST_PITCH_INDEX:'))throw Error('Unsupported 00.8G SID backend revision');
 const code=[
 '; PLAY-00.8I: source $1318 / $131E table lookup after pitch-index calculation.',
 '; Callable diagnostic ONLY. Not called by SID_REF_PLAY; no SID register writes.',
 'SID_REF_PITCH_FROM_TOKEN:',
 '  JSR SID_REF_PITCH_INDEX',
 '  LDA SR_TEST_PITCH_VALID',
 '  BEQ SR_PITCH_INPUT_INVALID',
 '  JSR SID_REF_PITCH_WORD',
 '  RTS',
 'SR_PITCH_INPUT_INVALID:',
 '  LDA #$00',
 '  STA SR_TEST_FREQ_VALID',
 '  RTS',
 'SID_REF_PITCH_WORD:',
 '  PHA',
 '  TXA',
 '  PHA',
 '  LDA SR_TEST_PITCH_INDEX',
 '  CMP #$5D',
 '  BCS SR_PITCH_WORD_INVALID',
 '  TAX',
 '  LDA SR_PITCH_TABLE_LO,X',
 '  STA SR_TEST_FREQ_LO',
 '  LDA SR_PITCH_TABLE_HI,X',
 '  STA SR_TEST_FREQ_HI',
 '  LDA #$01',
 '  STA SR_TEST_FREQ_VALID',
 '  JMP SR_PITCH_WORD_DONE',
 'SR_PITCH_WORD_INVALID:',
 '  LDA #$00',
 '  STA SR_TEST_FREQ_VALID',
 'SR_PITCH_WORD_DONE:',
 '  PLA',
 '  TAX',
 '  PLA',
 '  RTS',
 '',
 ].join('\n');
 let source=baseSource.replace('\nSR_STATE:', '\n'+code+'\nSR_STATE:');
 const data=['','; Verified original SID note-frequency data: low/high bytes, index 0..92.',
 'SR_PITCH_TABLE_LO:',table(op.tables.low),'SR_PITCH_TABLE_HI:',table(op.tables.high),
 'SR_TEST_FREQ_LO:','  DB $00','SR_TEST_FREQ_HI:','  DB $00','SR_TEST_FREQ_VALID:','  DB $00',''];
 const end='; END — first-PLAY state only; no source player transplanted or register-event score.';
 if(!source.includes(end))throw Error('Expected 00.8G footer missing');
 source=source.replace(end,data.join('\n')+'\n'+end);
 return source.replace('PAY-00.8G / SID REFERENCE BACKEND','PLAY-00.8I / SID REFERENCE BACKEND');
}
function compileContract(contract){
 const {base,pitch}=modules();
 const f=base.compileContract(contract);
 const ext=pitch.validateExtension(contract,contract.pitchExtension);
 return {semanticIR:f.semanticIR,firstPlay:f.extension,pitch:ext,
  assembly:emitSource(f.assembly,ext.operation),
  diagnostics:{status:'PARTIAL_SOURCE_EQUIVALENT_PITCH_LOOKUP',
    covered:[...f.diagnostics.covered,'test-only original 93-entry SID frequency low/high lookup'],
    blocked:['source SID voice writer','note scheduling and duration','gate and ADSR','instrument effects','song/pattern repeats'],
    audio:false,notMusicalEquivalence:true}};
}
return {compileContract,emitSource};
});
