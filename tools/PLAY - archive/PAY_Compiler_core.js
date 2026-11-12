/* PAY-00.6 deterministic frame-evidence compiler (UMD; browser + Node, no dependencies).
 * Translates bounded PSID frame snapshots to absolute-RAM native 6502 + AY0 VIA0 bus writes.
 * This is an evidence-bounded register-state compiler, NOT a recovered SID pattern grammar.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PAYCompiler=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const OPC={JMP:0x4c,JSR:0x20,RTS:0x60,PHA:0x48,PLA:0x68,TXA:0x8a,TAX:0xaa,TYA:0x98,TAY:0xa8,LDX_IMM:0xa2,LDA_IMM:0xa9,LDA_ABSX:0xbd,LDA_ABS:0xad,STA_ABS:0x8d,STX_ABS:0x8e,CPX_IMM:0xe0,CMP_IMM:0xc9,CMP_ABS:0xcd,INC_ABS:0xee,DEC_ABS:0xce,DEX:0xca,BEQ:0xf0,BNE:0xd0,BCS:0xb0};
const hex=(n,nib=4)=>'$'+(n>>>0).toString(16).toUpperCase().padStart(nib,'0');
class Emitter{
 constructor(base){this.base=base;this.b=[];this.labels={};this.fix=[];this.lines=[];}
 label(n){if(this.labels[n]!==undefined)throw Error('Duplicate label '+n);this.labels[n]=this.base+this.b.length;this.lines.push(n+':');}
 emit(m,...vals){const off=this.b.length;this.b.push(OPC[m],...(m.endsWith('_ABS')||m.endsWith('_ABSX')?[vals[0]&255,(vals[0]>>8)&255]:vals.map(v=>typeof v==='number'?v&255:0)));this.lines.push('  '+m.replace(/_(ABSX|IMM|ABS)$/,'')+' '+(m.endsWith('IMM')?'#':'')+vals.map((x,i)=>typeof x==='string'?x:hex(x,2)).join(','));return off;}
 abs(m,l){const off=this.b.length;this.b.push(OPC[m],0,0);this.fix.push({at:off+1,name:l,kind:'word'});this.lines.push('  '+m.replace('_ABS','')+' '+l);}
 absx(m,l){const off=this.b.length;this.b.push(OPC[m],0,0);this.fix.push({at:off+1,name:l,kind:'word'});this.lines.push('  '+m.replace('_ABSX','')+' '+l+',X');}
 branch(m,l){const off=this.b.length;this.b.push(OPC[m],0);this.fix.push({at:off+1,name:l,kind:'rel'});this.lines.push('  '+m+' '+l);}
 word(l,minus=0){const at=this.b.length;this.b.push(0,0);this.fix.push({at,name:l,kind:'word',minus});}
 byte(v){this.b.push(v&255);}
 bytes(label,a){this.label(label);if(!a.length){this.lines.push('  ; empty');return;}for(let i=0;i<a.length;i+=16){const row=a.slice(i,i+16);this.lines.push('  DB '+row.map(n=>hex(n,2)).join(','));this.b.push(...row);}}
 finish(){for(const f of this.fix){const a=this.labels[f.name];if(a===undefined)throw Error('Undefined label: '+f.name);if(f.kind==='word'){const w=(a-(f.minus||0))&65535;this.b[f.at]=w&255;this.b[f.at+1]=w>>8;}else {const d=a-(this.base+f.at+1);if(d< -128||d>127)throw Error('Branch out of range to '+f.name+': '+d);this.b[f.at]=d&255;}}
 return {bytes:Uint8Array.from(this.b),labels:this.labels,assembly:'ORG '+hex(this.base)+'\n\n'+this.lines.join('\n')+'\n'};}
}
function validateReport(report){if(!report||report.format!=='PAY_Complete_Report_v0.5.1')throw Error('Expected PAY_Complete_Report_v0.5.1');const c=report.completeness||{},t=report.runtimeTrace,ir=report.musicalIR;if(!t||!ir||!c.runtimeAvailable||!c.musicalIRAvailable)throw Error('Complete report has no runtime trace / musical IR');const s=t.summary||{},frames=t.frameSnapshots||[];
 if(!Number.isInteger(s.framesCompleted)||s.framesCompleted<1||s.framesCompleted!==s.framesRequested||frames.length!==s.framesCompleted)throw Error('Runtime frames are missing or incomplete');
 if(s.errors?.length||t.musicalEvents?.some(e=>e?.type==='ERROR'))throw Error('Runtime execution reported errors');
 const drops=c.droppedRecords||{};if(Object.values(drops).some(n=>Number(n)>0)||s.dropSidEvents>0)throw Error('Runtime evidence was truncated; cannot compile as complete');
 if(report.source?.magic!=='PSID')throw Error('Only bounded PSID traces supported');
 if(t.source?.title!==report.source.title||ir.source?.title!==report.source.title)throw Error('Source, runtime trace and musical IR titles disagree');
 if(!Array.isArray(report.source.sidBases)||report.source.sidBases.length!==1||report.source.sidBases[0]!==0xD400)throw Error('PAY-00.6 supports only SID1 three voices (multi-SID requires allocation)');
 for(let i=0;i<frames.length;i++){if(frames[i].frame!==i||frames[i].sounds?.length!==3||!Array.isArray(frames[i].globals)||!frames[i].globals.length)throw Error('Invalid frame snapshot '+i);}
 return frames;
}
function frameRegs(frame,mode,level){let regs=new Array(14).fill(0);let mixer=0x3f;
 const vol=frame.globals[0].modeVolume&15;for(let v=0;v<3;v++){
  const s=frame.sounds[v],c=s.ctrl||0,gate=(c&1)!==0,test=(c&8)!==0,frequency=s.freqWord||0,wave=(c&0xf0);
  const pitched=gate&&!test&&frequency>0&&!!wave;
  // Initial profile: tone when pitched, or noise-only for SID NOISE-only voice.
  // Analog SID filter, oscillator mix, combined waveform, ADSR and PWM are NOT reproduced.
  let enabled=pitched;const diagnostic=mode==='diagnostic';
  if(!diagnostic&&(vol===0||((c&0x40)!==0&&s.pw===0)))enabled=false;
  const amp=enabled?(diagnostic?level:Math.min(15,vol)):0;
  const period=enabled?Math.max(1,Math.min(4095,Math.floor(s.ayPeriod||0))):0;
  regs[v*2]=period&255;regs[v*2+1]=(period>>8)&15;regs[8+v]=amp;
  if(enabled){if(c&0x80){mixer&=~(1<<(v+3));if(!(c&0x70))mixer|=1<<v;else mixer&=~(1<<v);}else mixer&=~(1<<v);}
 }
 regs[7]=mixer;return regs;
}
function makeActions(frames,mode,level){const actions=[],previous=new Array(14).fill(0);previous[7]=0x3f;
 for(let f=0;f<frames.length;f++){const regs=frameRegs(frames[f],mode,level);const updates=[];
  // Period first; mixer last (avoid transient old period with newly unmuted voice).
  for(const r of [0,1,2,3,4,5,6,8,9,10,7])if(regs[r]!==previous[r])updates.push({reg:r,value:regs[r]});
  if(updates.length)actions.push({frame:f,updates});previous.splice(0,previous.length,...regs);
 }
 return actions;
}
function compile(report,options={}){
 const frames=validateReport(report),base=options.base===undefined?0x6000:Number(options.base),slot=options.slot===undefined?4:Number(options.slot),mode=options.mode||'faithful',level=options.diagnosticVolume===undefined?10:Number(options.diagnosticVolume);
 if(!Number.isInteger(base)||base<0x1000||base>0xb000||!Number.isInteger(slot)||slot<1||slot>7||!['faithful','diagnostic'].includes(mode)||!Number.isInteger(level)||level<1||level>15)throw Error('Invalid base (RAM $1000-$B000), physical slot (1-7), mode or diagnostic volume (1-15)');
 if(frames.length>65534)throw Error('Frame limit exceeds 16-bit counter');
 const actions=makeActions(frames,mode,level);if(actions.length>255)throw Error('PAY-00.6 capacity: 255 distinct AY action frames; this report needs '+actions.length+'. Further pattern/RLE compilation required.');
 const VIA=0xc000+(slot<<8),e=new Emitter(base),w=(name,n)=>{e.emit('LDA_IMM',n);e.emit('STA_ABS',VIA+name);};
 // First 9 bytes are stable entrypoint JMP vectors at $6000/6003/6006.
 e.label('PAY_INIT');e.abs('JMP','PAY_INIT_IMPL');e.label('PAY_TICK');e.abs('JMP','PAY_TICK_IMPL');e.label('PAY_STOP');e.abs('JMP','PAY_STOP_IMPL');
 function enter(){e.emit('PHA');e.emit('TXA');e.emit('PHA');e.emit('TYA');e.emit('PHA');}
 function leave(){e.emit('PLA');e.emit('TAY');e.emit('PLA');e.emit('TAX');e.emit('PLA');e.emit('RTS');}
 e.label('PAY_INIT_IMPL');enter();e.emit('LDA_IMM',0);for(const state of ['FRAME_LO','FRAME_HI','ACTION_IDX','PAY_DONE'])e.abs('STA_ABS',state);
 w(3,0xff);w(2,0x07);w(0,0x04);e.abs('JSR','PAY_MUTE');leave();
 e.label('PAY_TICK_IMPL');enter();e.abs('LDA_ABS','PAY_DONE');e.branch('BNE','PAY_TICK_RETURN');
 // When a trace ends, silence instead of silently implying a loop / indefinite sustain.
 e.abs('LDA_ABS','FRAME_HI');e.emit('CMP_IMM',frames.length>>8);e.branch('BNE','PAY_TICK_ACTION');
 e.abs('LDA_ABS','FRAME_LO');e.emit('CMP_IMM',frames.length&255);e.branch('BNE','PAY_TICK_ACTION');
 e.emit('LDA_IMM',1);e.abs('STA_ABS','PAY_DONE');e.abs('JSR','PAY_MUTE');e.abs('JMP','PAY_TICK_RETURN');
 e.label('PAY_TICK_ACTION');e.abs('LDX_IMM','ACTION_IDX'); // replaced below: LDX abs (custom op)
 // Fix LDX ABS opcode / listing at emitted placeholder location above.
 {const pos=e.b.length-3;e.b[pos]=0xae;e.lines[e.lines.length-1]='  LDX ACTION_IDX';}
 e.emit('CPX_IMM',actions.length);e.branch('BCS','PAY_TICK_ADVANCE');
 e.absx('LDA_ABSX','PAY_FRAME_HI_TABLE');e.abs('CMP_ABS','FRAME_HI');e.branch('BNE','PAY_TICK_ADVANCE');
 e.absx('LDA_ABSX','PAY_FRAME_LO_TABLE');e.abs('CMP_ABS','FRAME_LO');e.branch('BNE','PAY_TICK_ADVANCE');
 e.abs('INC_ABS','ACTION_IDX');e.abs('JSR','PAY_DISPATCH');
 e.label('PAY_TICK_ADVANCE');e.abs('INC_ABS','FRAME_LO');e.branch('BNE','PAY_TICK_RETURN');e.abs('INC_ABS','FRAME_HI');
 e.label('PAY_TICK_RETURN');leave();
 e.label('PAY_STOP_IMPL');enter();e.emit('LDA_IMM',1);e.abs('STA_ABS','PAY_DONE');e.abs('JSR','PAY_MUTE');leave();
 e.label('PAY_MUTE');e.emit('LDX_IMM',7);e.emit('LDA_IMM',0x3f);e.abs('JSR','PAY_AY_WRITE');for(let v=8;v<=10;v++){e.emit('LDX_IMM',v);e.emit('LDA_IMM',0);e.abs('JSR','PAY_AY_WRITE');}e.emit('RTS');
 // AX write API. Clobbers A and flags; leaves X, Y unchanged. Writes through VIA0 only.
 e.label('PAY_AY_WRITE');e.abs('STA_ABS','PAY_TMP');e.emit('STX_ABS',VIA+1);w(0,7);w(0,4);e.abs('LDA_ABS','PAY_TMP');e.emit('STA_ABS',VIA+1);w(0,6);w(0,4);e.emit('RTS');
 // Dispatch trick: push (event handler - 1) return address, RTS into it, then RTS back to TICK.
 e.label('PAY_DISPATCH');e.abs('LDX_IMM','ACTION_IDX');{let pos=e.b.length-3;e.b[pos]=0xae;e.lines[e.lines.length-1]='  LDX ACTION_IDX';}e.emit('DEX');e.absx('LDA_ABSX','PAY_ADDR_HI_TABLE');e.emit('PHA');e.absx('LDA_ABSX','PAY_ADDR_LO_TABLE');e.emit('PHA');e.emit('RTS');
 actions.forEach((a,i)=>{e.label('PAY_EVENT_'+i);for(const u of a.updates){e.emit('LDX_IMM',u.reg);e.emit('LDA_IMM',u.value);e.abs('JSR','PAY_AY_WRITE');}e.emit('RTS');});
 e.bytes('PAY_FRAME_LO_TABLE',actions.map(x=>x.frame&255));e.bytes('PAY_FRAME_HI_TABLE',actions.map(x=>x.frame>>8));
 e.label('PAY_ADDR_LO_TABLE');actions.forEach((_,i)=>e.word('PAY_EVENT_'+i,1));
 e.label('PAY_ADDR_HI_TABLE'); // these tables need high byte only, not words; fix dedicated single byte symbolic patches
 // remove previously emitted word table and replace with bytes after relocation, at finish step
 const tblLoStart=e.labels.PAY_ADDR_LO_TABLE-base;
 e.b.splice(tblLoStart,actions.length*2);e.fix=e.fix.filter(f=>f.at<tblLoStart);e.b.length=tblLoStart;e.labels.PAY_ADDR_HI_TABLE=base+tblLoStart+actions.length;
 e.fix.push(...actions.map((_,i)=>({at:tblLoStart+i,name:'PAY_EVENT_'+i,kind:'lowminus1'})));
 for(let i=0;i<actions.length;i++)e.b.push(0);
 e.fix.push(...actions.map((_,i)=>({at:e.b.length+i,name:'PAY_EVENT_'+i,kind:'highminus1'})));
 for(let i=0;i<actions.length;i++)e.b.push(0);
 e.lines.push('  ; table values are event handler addresses minus one for RTS dispatch');
 e.bytes('PAY_STATE',new Array(5).fill(0)); // LABEL aliases below; all writable dedicated RAM
 const stateStart=e.labels.PAY_STATE;['FRAME_LO','FRAME_HI','ACTION_IDX','PAY_DONE','PAY_TMP'].forEach((k,i)=>{e.labels[k]=stateStart+i;});
 // fix lowminus1/highminus1 before generic finish
 for(const f of e.fix.filter(f=>f.kind==='lowminus1'||f.kind==='highminus1')){const a=(e.labels[f.name]-1)&65535;e.b[f.at]=f.kind==='lowminus1'?a&255:a>>8;}
 e.fix=e.fix.filter(f=>f.kind!=='lowminus1'&&f.kind!=='highminus1');
 const obj=e.finish();if(base+obj.bytes.length>0xc000)throw Error('Generated code crosses Apple II IO/ROM boundary');
 // render clean parseable DB data, trace evidence summary. Raw binary is authoritative.
 const header=[`; PAY-00.6 deterministic generated PAY-Light native 6502`,`; SOURCE ${JSON.stringify(report.source.title||'')}  frames=${frames.length}`,`; PROFILE ${mode}  VIA0=${hex(VIA)}  code=${hex(base)}..${hex(base+obj.bytes.length-1)}`,`; TEST-ONLY bounded source playback. Does not infer a full-song loop.`,`; INIT ${hex(base)} TICK ${hex(base+3)} STOP ${hex(base+6)}.`,`; Zero PAY-owned zero-page bytes. PAY_STATE is dedicated absolute RAM.`,`; AY0 VIA0/PORTA and PORTB; physical slot ${slot}. No IRQ ownership. Caller schedules PAY_TICK.`,`; Program terminates and mutes on first tick after ${frames.length} observed frames.`,`; Source analog SID envelope/filter/PWM are not reproduced.`,``];
 // Symbolic assembler source plus byte-exact binary. Reconstruct event pointer tables.
 const symbolic=[];for(const line of e.lines){symbolic.push(line);if(line==='PAY_ADDR_LO_TABLE:'||line==='PAY_ADDR_HI_TABLE:'){
  const label=line.slice(0,-1),start=obj.labels[label]-base;
  const data=Array.from(obj.bytes.slice(start,start+actions.length));
  for(let j=0;j<data.length;j+=16)symbolic.push('  DB '+data.slice(j,j+16).map(v=>hex(v,2)).join(','));
 }}
 const aliases=['FRAME_LO','FRAME_HI','ACTION_IDX','PAY_DONE','PAY_TMP'].map((n,i)=>n+' = PAY_STATE'+(i?'+'+i:'')).join('\n');
 const symbolicSource=header.join('\n')+`ORG ${hex(base)}\n\n`+aliases+'\n\n'+symbolic.join('\n')+'\n';
 const db=[`ORG ${hex(base)}`,`PAY_INIT:`,...Array.from({length:Math.ceil(obj.bytes.length/16)},(_,i)=>'  DB '+Array.from(obj.bytes.slice(i*16,i*16+16)).map(n=>hex(n,2)).join(','))].join('\n');
 const result={format:'PAY_Light_Compiler_Output_v0.6',source:{title:report.source.title,sha256:null,traceFrames:frames.length,sourceModeVolumeValues:[...new Set(frames.map(f=>f.globals[0].modeVolume&15))]},configuration:{base,slot,mode,diagnosticVolume:mode==='diagnostic'?level:null,noOwnedZeroPage:true,playbackPolicy:'finite-observation-stop-and-mute',driver:'AY0 VIA0 register-select/write'},entry:{init:base,tick:base+3,stop:base+6},memory:{start:base,end:base+obj.bytes.length-1,byteLength:obj.bytes.length,stateStart,states:Object.fromEntries(['FRAME_LO','FRAME_HI','ACTION_IDX','PAY_DONE','PAY_TMP'].map(k=>[k,obj.labels[k]]))},actions,metrics:{distinctActionFrames:actions.length,registerWrites:actions.reduce((s,a)=>s+a.updates.length,0),rawSIDWrites:report.runtimeTrace.summary.sidWrites,sourceFrameCount:frames.length},asm:symbolicSource,binaryAssembly:header.join('\n')+db+'\n',binary:obj.bytes,disclaimer:'Deterministic frame-snapshot AY adaptation, not decoded pattern grammar. Source volume 0 remains muted in faithful mode; diagnostic mode is an explicit nonfaithful override.'};
 return result;
}
return {compile,validateReport,frameRegs,makeActions,hex};
});
