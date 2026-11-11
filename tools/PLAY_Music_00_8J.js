/* PLAY-00.8J: deterministic experimental first-audible token decoder.
 * Source-backed stream bytes are verified against the known PSID SHA-256.
 * Instrument/gate synthesis is an explicitly INEXACT test policy, not
 * an inferred original SID writer or a captured SID register score.
 * No GPT call, zero-page allocation, or self-modifying instructions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PLAYMusic08J=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const SOURCE_SHA='65c3874b9f529c9adac45852f6e216eef2307a325051471d8b58290c38f71a68';
const STREAMS=[[4,73,3,117,80,117,76,255,190,64,129,189,117,92,79,64,121,189,76,48,190,92,255,64,124,189,126,92,111,64,127,189,76,48,190,64,127,126,92,255,2,64,127,189,129,4,124,92,255,64,121,2,117,92,16,92,64,82,5,0],[11,79,4,129,80,129,190,141,189,129,189,133,189,190,189,136,189,138,189,139,189,190,139,138,189,139,189,141,136,189,133,129,189,82,5,189,0],[5,79,137,120,64,120,12,120,9,89,10,0,80,81,5,82,5,7,64,158,189,81,5,82,5,81,5,82,5,81,5,82,5,64,158,189,160,189,158,189,156,189,156,155,153,189,155,189,153,189,81,5,82,5,81,5,82,5,64,151,189,81,5,82,5,81,5,82,5,81,5,82,5,81,5,82,5,8,64,158,158,168,158,167,189,165,167,158,189,168,189,167,253,0]];
const SOURCE_RANGES=[[6527,6587],[6587,6624],[6624,6718]];
const POLICY={kind:'SID_AUDIBLE_DIAGNOSTIC_V1',tickPeriodFrames:5,firstReadFrame:5,voices:3,sidWaveformGate:0x41,attackDecay:0x00,sustainRelease:0xF8,pulseWidth:0x0800,volume:0x0f,releaseAtSourceBoundary:true,originalInstrumentSemanticsProven:false};
function need(x,m){if(!x)throw Error('PLAY-00.8J: '+m)}
function bytesFromSource(src){
 const source=src instanceof Uint8Array?src:new Uint8Array(src);
 need(source.length>=0x7c+0x1a3e-0x1000,'Source PSID too short');
 need(String.fromCharCode(...source.subarray(0,4))==='PSID','Source must be PSID');
 const headerLoad=source[0x08]*256+source[0x09];
 const load=headerLoad || (source[0x7c] | (source[0x7d]<<8));
 const dataStart=headerLoad ? 0x7c : 0x7e;
 need(load===0x1000,'Unexpected source PSID load address');
 return SOURCE_RANGES.map(x=>Array.from(source.slice(dataStart+x[0]-load,dataStart+x[1]-load)));
}
function buildExtension(contract,source){
 need(contract?.source?.sha256PSID===SOURCE_SHA,'Source identity mismatch');
 need(contract.pitchExtension?.format==='PAY_SID_Pitch_Word_v0.8I','Pitch extension missing');
 const buffers=bytesFromSource(source);
 buffers.forEach((x,i)=>need(JSON.stringify(x)===JSON.stringify(STREAMS[i]),'Original musical stream mismatch at '+SOURCE_RANGES[i][0].toString(16)));
 return {format:'PLAY_First_Audible_v0.8J',sourceSHA256:SOURCE_SHA,semanticStatus:'experimental_approximation_not_equivalent',subtuneIndex:0,streamDefinition:'source_bytes_not_sid_writes',streams:buffers.map((data,i)=>({voice:i,sourceStart:SOURCE_RANGES[i][0],sourceEndExclusive:SOURCE_RANGES[i][1],bytes:data})),tokenGrammar:{instrument:[0,0x3f],effect:[0x40,0x5f],note:[0x60,0xbc],hold:0xbd,specialMask:0xbe,repeat:[0xc0,0xff]},synthesisPolicy:{...POLICY},limitations:['Only subtune 1; no verified pattern switching at stream boundaries','5-frame source cadence observed, but detailed duration/cycle scheduling is incomplete','No source-faithful instrument or effect implementation','Gate, envelope, pulse and source-boundary release are deliberately audible approximations','SID register event equivalence not claimed']};
}
function validateExtension(c){
 need(c?.source?.sha256PSID===SOURCE_SHA,'Unexpected PSID identity');
 const x=c.musicExtension;
 need(x?.format==='PLAY_First_Audible_v0.8J'&&x.sourceSHA256===SOURCE_SHA,'Missing 00.8J typed music extension');
 need(x.semanticStatus==='experimental_approximation_not_equivalent'&&x.subtuneIndex===0,'Unapproved fidelity/scope claim');
 need(x.streamDefinition==='source_bytes_not_sid_writes','Unrecognised stream representation');
 need(JSON.stringify(x.tokenGrammar)===JSON.stringify({instrument:[0,0x3f],effect:[0x40,0x5f],note:[0x60,0xbc],hold:0xbd,specialMask:0xbe,repeat:[0xc0,0xff]}),'Unsupported source token grammar');
 need(x.streams?.length===3,'Expected three source streams');
 x.streams.forEach((s,i)=>need(s.voice===i&&s.sourceStart===SOURCE_RANGES[i][0]&&s.sourceEndExclusive===SOURCE_RANGES[i][1]&&JSON.stringify(s.bytes)===JSON.stringify(STREAMS[i]),'Tampered or unknown source stream '+i));
 need(JSON.stringify(x.synthesisPolicy)===JSON.stringify(POLICY),'Unreviewed SID approximations');
 return x;
}
function asmStream(name,bytes){const out=[name+':'];for(let i=0;i<bytes.length;i+=16)out.push('  DB '+bytes.slice(i,i+16).map(x=>'$'+x.toString(16).toUpperCase().padStart(2,'0')).join(','));return out.join('\n');}
function emitSource(base,x){
 need(base.includes('SR_TICK_ADVANCE:')&&base.includes('SR_STATE:')&&base.includes('SR_PITCH_TABLE_LO:'),'Unexpected 00.8I assembly layout');
 need(base.includes('  STA SR_V2_5\n  RTS'),'First-play setup layout changed');
 let source=base.replace('SR_TICK_ADVANCE:\n','SR_TICK_ADVANCE:\n  JSR SJ_MUSIC_TICK\n');
 source=source.replace('  STA SR_V2_5\n  RTS','  STA SR_V2_5\n  JSR SJ_INIT_ENGINE\n  RTS');
 const core=`
; PLAY-00.8J: SOURCE TOKEN DECODER, experimental SID synthesis. No recorded SID writes.
; This pass understands original token classes but does not emulate source effects,
; original instrument envelopes, full song-level loops, or multi-subtune patterns.
SJ_INIT_ENGINE:
  LDA #$00
  STA SJ_POS0
  STA SJ_POS1
  STA SJ_POS2
  STA SJ_REPEATS
  STA SJ_REP1
  STA SJ_REP2
  STA SJ_EOF
  STA SJ_INST
  STA SJ_INST1
  STA SJ_INST2
  STA SJ_NOTES_LO
  STA SJ_NOTES_HI
  LDA #$06
  STA SJ_WAIT
  LDA #$0F
  STA $D418
  RTS

; One original source decoder transaction every five PLAY calls (subtune 1 only).
SJ_MUSIC_TICK:
  LDA SR_SUBTUNE_A
  BEQ SJ_TICK_OK
  RTS
SJ_TICK_OK:
  DEC SJ_WAIT
  BEQ SJ_PROCESS
  RTS
SJ_PROCESS:
  LDA #$05
  STA SJ_WAIT
  LDA #$00
  STA SJ_VOICE
  JSR SJ_STEP
  LDA #$01
  STA SJ_VOICE
  JSR SJ_STEP
  LDA #$02
  STA SJ_VOICE
  JSR SJ_STEP
  RTS

; A parser operation corresponds to one executed $1385..$13F4 transaction.
; Score bytes below are original PSID pattern bytes, NOT SID-register updates.
SJ_STEP:
  LDA #$08
  STA SJ_GUARD
SJ_SCAN:
  DEC SJ_GUARD
  BEQ SJ_STEP_DONE
  JSR SJ_READ
  STA SJ_TOKEN
SJ_CLASSIFY:
  CMP #$40
  BCC SJ_INSTRUMENT
  CMP #$60
  BCC SJ_EFFECT
  CMP #$BD
  BCC SJ_NOTE
  CMP #$BD
  BEQ SJ_STEP_DONE
  CMP #$BE
  BNE SJ_NOT_SPECIAL
  JMP SJ_SPECIAL
SJ_NOT_SPECIAL:
  CMP #$C0
  BCC SJ_STEP_DONE
  JMP SJ_REPEAT
SJ_STEP_DONE:
  RTS

SJ_INSTRUMENT:
  LDX SJ_VOICE
  LDA SJ_TOKEN
  STA SJ_INST,X
  JSR SJ_READ
  STA SJ_TOKEN
  JMP SJ_CLASSIFY

; $40..$4F: optional parameter then one inline follow-on command.
; $50..$5F: optional parameter then end this source transaction.
SJ_EFFECT:
  LDA SJ_TOKEN
  CMP #$50
  BCS SJ_EFFECT_5X
  AND #$0F
  BEQ SJ_EFFECT_INLINE
  JSR SJ_READ
SJ_EFFECT_INLINE:
  JSR SJ_READ
  STA SJ_TOKEN
  JMP SJ_CLASSIFY
SJ_EFFECT_5X:
  AND #$0F
  BEQ SJ_STEP_DONE
  JSR SJ_READ
  RTS

SJ_NOTE:
  LDA SJ_TOKEN
  SEC
  SBC #$60
  TAX
  LDA SR_PITCH_TABLE_LO,X
  STA SJ_FREQ_LO
  LDA SR_PITCH_TABLE_HI,X
  STA SJ_FREQ_HI
  INC SJ_NOTES_LO
  BNE SJ_WRITE_NOTE
  INC SJ_NOTES_HI
SJ_WRITE_NOTE:
  LDA SJ_VOICE
  BEQ SJ_VOICE0
  CMP #$01
  BEQ SJ_VOICE1
  JMP SJ_VOICE2
SJ_VOICE0:
  LDA #$40
  STA $D404
  LDA SJ_FREQ_LO
  STA $D400
  LDA SJ_FREQ_HI
  STA $D401
  LDA #$00
  STA $D402
  LDA #$08
  STA $D403
  LDA #$00
  STA $D405
  LDA #$F8
  STA $D406
  LDA #$41
  STA $D404
  RTS
SJ_VOICE1:
  LDA #$40
  STA $D40B
  LDA SJ_FREQ_LO
  STA $D407
  LDA SJ_FREQ_HI
  STA $D408
  LDA #$00
  STA $D409
  LDA #$08
  STA $D40A
  LDA #$00
  STA $D40C
  LDA #$F8
  STA $D40D
  LDA #$41
  STA $D40B
  RTS
SJ_VOICE2:
  LDA #$40
  STA $D412
  LDA SJ_FREQ_LO
  STA $D40E
  LDA SJ_FREQ_HI
  STA $D40F
  LDA #$00
  STA $D410
  LDA #$08
  STA $D411
  LDA #$00
  STA $D413
  LDA #$F8
  STA $D414
  LDA #$41
  STA $D412
  RTS

; Source $BD is a hold/continuation; $BE sets an original mask.
; Diagnostic policy approximates $BE as gate-off (not source-equivalent).
SJ_SPECIAL:
  LDA SJ_VOICE
  BEQ SJ_MUTE0
  CMP #$01
  BEQ SJ_MUTE1
  LDA #$40
  STA $D412
  RTS
SJ_MUTE0:
  LDA #$40
  STA $D404
  RTS
SJ_MUTE1:
  LDA #$40
  STA $D40B
  RTS

; Source local repetition: c = ((c || token) + 1) & 255.
; Keep token position while counter is nonzero.
SJ_REPEAT:
  LDX SJ_VOICE
  LDA SJ_REPEATS,X
  BNE SJ_REPEAT_ADV
  LDA SJ_TOKEN
SJ_REPEAT_ADV:
  CLC
  ADC #$01
  STA SJ_REPEATS,X
  BNE SJ_REPEAT_ACTIVE
  RTS
SJ_REPEAT_ACTIVE:
  LDA SJ_VOICE
  BEQ SJ_REWIND0
  CMP #$01
  BEQ SJ_REWIND1
  DEC SJ_POS2
  RTS
SJ_REWIND0:
  DEC SJ_POS0
  RTS
SJ_REWIND1:
  DEC SJ_POS1
  RTS

; Original three source stream regions: $197F, $19BB, $19E0.
; Read limits are intentionally finite: unknown follow-on pattern pointers do
; not get silently invented or replaced with an observed SID-register trace.
SJ_READ:
  LDA SJ_VOICE
  BEQ SJ_READ0
  CMP #$01
  BEQ SJ_READ1
  JMP SJ_READ2
SJ_READ0:
  LDX SJ_POS0
  CPX #$3C
  BCC SJ_READ0_GO
  LDA #$01
  STA SJ_EOF
  LDA #$40
  STA $D404
  LDA #$BD
  RTS
SJ_READ0_GO:
  LDA SJ_STREAM0,X
  INC SJ_POS0
  RTS
SJ_READ1:
  LDX SJ_POS1
  CPX #$25
  BCC SJ_READ1_GO
  LDA #$01
  STA SJ_EOF
  LDA #$40
  STA $D40B
  LDA #$BD
  RTS
SJ_READ1_GO:
  LDA SJ_STREAM1,X
  INC SJ_POS1
  RTS
SJ_READ2:
  LDX SJ_POS2
  CPX #$5E
  BCC SJ_READ2_GO
  LDA #$01
  STA SJ_EOF
  LDA #$40
  STA $D412
  LDA #$BD
  RTS
SJ_READ2_GO:
  LDA SJ_STREAM2,X
  INC SJ_POS2
  RTS

SJ_WAIT: DB $00
SJ_VOICE: DB $00
SJ_GUARD: DB $00
SJ_TOKEN: DB $00
SJ_FREQ_LO: DB $00
SJ_FREQ_HI: DB $00
SJ_EOF: DB $00
SJ_POS0: DB $00
SJ_POS1: DB $00
SJ_POS2: DB $00
SJ_INST:\nSJ_INST0: DB $00\nSJ_INST1: DB $00\nSJ_INST2: DB $00
SJ_REPEATS:\nSJ_REP0: DB $00\nSJ_REP1: DB $00\nSJ_REP2: DB $00
SJ_NOTES_LO: DB $00
SJ_NOTES_HI: DB $00
`;
 const streams=x.streams.map((s,i)=>asmStream('SJ_STREAM'+i,s.bytes)).join('\n');
 source=source.replace('SR_STATE:',core+'\n'+streams+'\nSR_STATE:');
 source=source.replace('; PLAY-00.8I / SID REFERENCE BACKEND — SEMANTIC CONTROL FIXTURE ONLY','; PLAY-00.8J / First audible source-token reconstruction: EXPERIMENTAL')
 .replace('; FIRST PLAY STATE + one $D415=0 global-init write. No notes, gates, effects, song loops or SID voice writer.','; Source stream parser + source pitch tables + provisional SID instrument policy; NOT sound-equivalent.');
 return source;
}
function compileContract(contract){
 // Existing 00.8I is the authoritative deterministic foundation.
 need(typeof PAYSID08I!=='undefined'&&typeof PAYSID08I.compileContract==='function','00.8I compiler not loaded');
 const f=PAYSID08I.compileContract(contract);const x=validateExtension(contract);
 return {assembly:emitSource(f.assembly,x),semanticIR:f.semanticIR,music:x,diagnostics:{status:'AUDIBLE_EXPERIMENTAL_PARTIAL',audible:true,musicalEquivalence:false,sourceTokenDecoder:true,covered:['source instrument/configuration selection tokens','source inline effect-argument grammar','source 93-word pitch table','three source stream segments','5-frame observed decoder cadence','source local token repeats'],notYetImplemented:['source-faithful effect execution','original SID waveform/gate control','ADSR and pitch slides','source pattern advancement and all subtunes','cycle-accurate SID comparison']}};
}
return {SOURCE_SHA,SOURCE_RANGES,STREAMS,POLICY,bytesFromSource,buildExtension,validateExtension,emitSource,compileContract};
});
