/* PAY-00.7 deterministic extended-frame compiler (UMD; browser + Node, no dependencies).
 * Translates bounded PSID frame snapshots to absolute-RAM native 6502 + AY0 VIA0 bus writes.
 * This is an evidence-bounded register-state compiler, NOT a recovered SID pattern grammar.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PAYCompiler=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const OPC={PHP:0x08,PLP:0x28,SEI:0x78,CLI:0x58,RTI:0x40,JMP_IND:0x6c,AND_IMM:0x29,ORA_IMM:0x09,JMP:0x4c,JSR:0x20,RTS:0x60,PHA:0x48,PLA:0x68,TXA:0x8a,TAX:0xaa,TYA:0x98,TAY:0xa8,LDX_IMM:0xa2,LDA_IMM:0xa9,LDA_ABSX:0xbd,LDA_ABS:0xad,STA_ABS:0x8d,STX_ABS:0x8e,CPX_IMM:0xe0,CMP_IMM:0xc9,CMP_ABS:0xcd,INC_ABS:0xee,DEC_ABS:0xce,DEX:0xca,BEQ:0xf0,BNE:0xd0,BCS:0xb0};
const hex=(n,nib=4)=>'$'+(n>>>0).toString(16).toUpperCase().padStart(nib,'0');
class Emitter{
 constructor(base){this.base=base;this.b=[];this.labels={};this.fix=[];this.lines=[];}
 label(n){if(this.labels[n]!==undefined)throw Error('Duplicate label '+n);this.labels[n]=this.base+this.b.length;this.lines.push(n+':');}
 emit(m,...vals){const off=this.b.length;this.b.push(OPC[m],...(m.endsWith('_ABS')||m.endsWith('_ABSX')?[vals[0]&255,(vals[0]>>8)&255]:vals.map(v=>typeof v==='number'?v&255:0)));this.lines.push('  '+m.replace(/_(ABSX|IMM|ABS)$/,'')+' '+(m.endsWith('IMM')?'#':'')+vals.map((x,i)=>typeof x==='string'?x:hex(x,2)).join(','));return off;}
 abs(m,l){const off=this.b.length;this.b.push(OPC[m],typeof l==='number'?l&255:0,typeof l==='number'?(l>>8)&255:0);if(typeof l!=='number')this.fix.push({at:off+1,name:l,kind:'word'});this.lines.push('  '+m.replace(/_(ABS|IND)$/,'')+' '+(m==='JMP_IND'?'(':'')+(typeof l==='number'?hex(l):l)+(m==='JMP_IND'?')':''));}
 absx(m,l){const off=this.b.length;this.b.push(OPC[m],0,0);this.fix.push({at:off+1,name:l,kind:'word'});this.lines.push('  '+m.replace('_ABSX','')+' '+l+',X');}
 branch(m,l){const off=this.b.length;this.b.push(OPC[m],0);this.fix.push({at:off+1,name:l,kind:'rel'});this.lines.push('  '+m+' '+l);}
 immLabel(name,part){const at=this.b.length;this.b.push(0xa9,0);this.fix.push({at:at+1,name,kind:part});this.lines.push('  LDA #'+(part==='lo' ? '<' : '>')+name);}
 word(l,minus=0){const at=this.b.length;this.b.push(0,0);this.fix.push({at,name:l,kind:'word',minus});}
 byte(v){this.b.push(v&255);}
 bytes(label,a){this.label(label);if(!a.length){this.lines.push('  ; empty');return;}for(let i=0;i<a.length;i+=16){const row=a.slice(i,i+16);this.lines.push('  DB '+row.map(n=>hex(n,2)).join(','));this.b.push(...row);}}
 finish(){for(const f of this.fix){const a=this.labels[f.name];if(a===undefined)throw Error('Undefined label: '+f.name);if(f.kind==='lo'||f.kind==='hi'){this.b[f.at]=f.kind==='lo'?a&255:a>>8;}else if(f.kind==='word'){const w=(a-(f.minus||0))&65535;this.b[f.at]=w&255;this.b[f.at+1]=w>>8;}else {const d=a-(this.base+f.at+1);if(d< -128||d>127)throw Error('Branch out of range to '+f.name+': '+d);this.b[f.at]=d&255;}}
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
function finiteMotifs(actions){
 // Repeated concrete AY-update blocks, not asserted source-level pattern or endless music loop.
 const groups=new Map();for(const a of actions){const key=JSON.stringify(a.updates);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a.frame);}
 return [...groups.entries()].filter(([k,v])=>v.length>=2).map(([k,v])=>({updates:JSON.parse(k),occurrences:v.length,observedFrames:v.slice(0,20),evidence:'repeated captured AY updates only; not a source loop'})).sort((a,b)=>b.occurrences-a.occurrences);
}
function observedPatterns(actions){
 // Window equality requires identical AY update sequences and identical relative frame offsets.
 // This is finite captured evidence. It cannot establish the source composition's loop grammar.
 const found=[];for(const size of [2,3,4,6,8,12,16]){
  if(actions.length<size*2)continue;const buckets=new Map();
  for(let i=0;i<=actions.length-size;i++){
   const start=actions[i].frame,key=JSON.stringify(actions.slice(i,i+size).map(x=>[x.frame-start,x.updates]));
   if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);
  }
  for(const indexes of buckets.values()){
   const disjoint=[];let last=-size;for(const i of indexes){if(i>=last+size){disjoint.push(i);last=i;}}
   if(disjoint.length<2)continue;
   found.push({actionLength:size,occurrences:disjoint.length,firstFrame:actions[disjoint[0]].frame,relativeFrameSpan:actions[disjoint[0]+size-1].frame-actions[disjoint[0]].frame+1,startFrames:disjoint.slice(0,12).map(i=>actions[i].frame),evidence:'exact finite AY delta/relative timing sequence; not a proven original pattern or infinite source loop'});
  }
 }
 return found.sort((a,b)=>b.actionLength*b.occurrences-a.actionLength*a.occurrences).slice(0,24);
}
function compile(report,options={}){
 const frames=validateReport(report),base=options.base===undefined?0x6000:Number(options.base),slot=options.slot===undefined?4:Number(options.slot),mode=options.mode||'faithful',level=options.diagnosticVolume===undefined?10:Number(options.diagnosticVolume),endPolicy=options.endPolicy||'stop',irqHz=options.irqHz===undefined?50:Number(options.irqHz),cpuHz=options.cpuHz===undefined?1023000:Number(options.cpuHz);
 if(!Number.isInteger(base)||base<0x1000||base>0xb000||!Number.isInteger(slot)||slot<1||slot>7||!['faithful','diagnostic'].includes(mode)||!Number.isInteger(level)||level<1||level>15||!['stop','repeat-observed'].includes(endPolicy)||![50,60].includes(irqHz)||!Number.isInteger(cpuHz)||cpuHz<500000||cpuHz>2000000)throw Error('Invalid base, slot, volume, end policy or timer frequency');
 if(frames.length>65534)throw Error('Frame count exceeds 16-bit counter');
 const actions=makeActions(frames,mode,level),motifs=finiteMotifs(actions),patterns=observedPatterns(actions),VIA=0xc000+(slot<<8),TIMER=VIA+0x80,softIRQ=0x03fe,timerLatch=Math.round(cpuHz/irqHz)-2;
 if(timerLatch<1||timerLatch>65535)throw Error('Unsupported timer latch');
 const e=new Emitter(base),h=(n,p)=>e.immLabel(n,p),zero=n=>{e.emit('LDA_IMM',0);e.abs('STA_ABS',n);},put=(n,v)=>{e.emit('LDA_IMM',v);e.abs('STA_ABS',n);},w=(reg,val)=>{e.emit('LDA_IMM',val);e.emit('STA_ABS',VIA+reg);};
 const j=m=>e.abs('JMP',m);
 // Preserve legacy API and add opt-in IRQ install/remove: $6000/$6003/$6006/$6009/$600C.
 for(const [name,dst] of [['PAY_INIT','PAY_INIT_IMPL'],['PAY_TICK','PAY_TICK_IMPL'],['PAY_STOP','PAY_STOP_IMPL'],['PAY_IRQ_INSTALL','PAY_IRQ_INSTALL_IMPL'],['PAY_IRQ_REMOVE','PAY_IRQ_REMOVE_IMPL']]){e.label(name);j(dst);}
 function enter(){e.emit('PHA');e.emit('TXA');e.emit('PHA');e.emit('TYA');e.emit('PHA');}
 function leave(){e.emit('PLA');e.emit('TAY');e.emit('PLA');e.emit('TAX');e.emit('PLA');e.emit('RTS');}
 function setNext(i){if(i<actions.length){h('PAY_EVENT_'+i,'lo');e.abs('STA_ABS','NEXT_LO');h('PAY_EVENT_'+i,'hi');e.abs('STA_ABS','NEXT_HI');put('NEXT_FRAME_LO',actions[i].frame&255);put('NEXT_FRAME_HI',actions[i].frame>>8);}else{put('NEXT_FRAME_LO',255);put('NEXT_FRAME_HI',255);}}
 e.label('PAY_RESET_WINDOW');for(const name of ['FRAME_LO','FRAME_HI','PAY_DONE'])zero(name);setNext(0);e.emit('RTS');
 e.label('PAY_INIT_IMPL');e.emit('PHP');e.emit('SEI');enter();w(3,0xff);w(2,0x07);w(0,0x04);e.abs('JSR','PAY_MUTE');e.abs('JSR','PAY_RESET_WINDOW');e.emit('PLA');e.emit('TAY');e.emit('PLA');e.emit('TAX');e.emit('PLA');e.emit('PLP');e.emit('RTS');
 e.label('PAY_TICK_IMPL');enter();e.abs('LDA_ABS','PAY_DONE');e.branch('BEQ','PAY_CHECK_END');j('PAY_RETURN');
 e.label('PAY_CHECK_END');e.abs('LDA_ABS','FRAME_HI');e.emit('CMP_IMM',frames.length>>8);e.branch('BNE','PAY_CHECK_EVENT');e.abs('LDA_ABS','FRAME_LO');e.emit('CMP_IMM',frames.length&255);e.branch('BNE','PAY_CHECK_EVENT');j('PAY_AT_END');
 e.label('PAY_CHECK_EVENT');e.abs('LDA_ABS','FRAME_HI');e.abs('CMP_ABS','NEXT_FRAME_HI');e.branch('BNE','PAY_ADVANCE');e.abs('LDA_ABS','FRAME_LO');e.abs('CMP_ABS','NEXT_FRAME_LO');e.branch('BNE','PAY_ADVANCE');e.abs('JSR','PAY_DISPATCH');
 e.label('PAY_ADVANCE');e.abs('INC_ABS','FRAME_LO');e.branch('BNE','PAY_RETURN');e.abs('INC_ABS','FRAME_HI');
 e.label('PAY_RETURN');leave();
 e.label('PAY_AT_END');if(endPolicy==='repeat-observed'){e.abs('JSR','PAY_MUTE');e.abs('JSR','PAY_RESET_WINDOW');j('PAY_CHECK_EVENT');}else{put('PAY_DONE',1);e.abs('JSR','PAY_MUTE');j('PAY_RETURN');}
 e.label('PAY_STOP_IMPL');e.emit('PHP');e.emit('SEI');enter();e.abs('JSR','PAY_IRQ_OFF_CORE');put('PAY_DONE',1);e.abs('JSR','PAY_MUTE');e.emit('PLA');e.emit('TAY');e.emit('PLA');e.emit('TAX');e.emit('PLA');e.emit('PLP');e.emit('RTS');
 e.label('PAY_MUTE');e.emit('LDX_IMM',7);e.emit('LDA_IMM',0x3f);e.abs('JSR','PAY_AY_WRITE');for(let v=8;v<=10;v++){e.emit('LDX_IMM',v);e.emit('LDA_IMM',0);e.abs('JSR','PAY_AY_WRITE');}e.emit('RTS');
 e.label('PAY_AY_WRITE');e.abs('STA_ABS','PAY_TMP');e.emit('STX_ABS',VIA+1);w(0,7);w(0,4);e.abs('LDA_ABS','PAY_TMP');e.emit('STA_ABS',VIA+1);w(0,6);w(0,4);e.emit('RTS');
 // Absolute RAM JMP indirect is legal on NMOS 6502, zero-page-free, and not self-modifying.
 e.label('PAY_DISPATCH');e.abs('JMP_IND','NEXT_LO');
 // IRQ service is entered via Apple Monitor soft vector $03FE; ROM saved interrupted A in system $45.
 e.label('PAY_IRQ_HANDLER');e.emit('TXA');e.emit('PHA');e.emit('TYA');e.emit('PHA');e.emit('LDA_ABS',TIMER+0x0d);e.emit('AND_IMM',0x40);e.branch('BNE','PAY_IRQ_OWNED');j('PAY_IRQ_FOREIGN');
 e.label('PAY_IRQ_OWNED');e.emit('LDA_ABS',TIMER+4);e.abs('JSR','PAY_TICK');e.abs('INC_ABS','IRQ_COUNT_LO');e.branch('BNE','PAY_IRQ_EXIT');e.abs('INC_ABS','IRQ_COUNT_HI');
 e.label('PAY_IRQ_EXIT');e.emit('PLA');e.emit('TAY');e.emit('PLA');e.emit('TAX');e.emit('LDA_ABS',0x0045);e.emit('RTI');
 e.label('PAY_IRQ_FOREIGN');e.emit('PLA');e.emit('TAY');e.emit('PLA');e.emit('TAX');e.emit('LDA_ABS',0x0045);e.abs('JMP_IND','OLD_IRQ_LO');
 e.label('PAY_IRQ_INSTALL_IMPL');e.emit('PHP');e.emit('SEI');enter();e.abs('LDA_ABS','IRQ_ACTIVE');e.branch('BEQ','PAY_IRQ_START');j('PAY_IRQ_START_DONE');
 e.label('PAY_IRQ_START');e.abs('LDA_ABS',softIRQ);e.abs('STA_ABS','OLD_IRQ_LO');e.abs('LDA_ABS',softIRQ+1);e.abs('STA_ABS','OLD_IRQ_HI');e.abs('LDA_ABS',TIMER+0x0b);e.abs('STA_ABS','OLD_ACR');
 put('IRQ_ACTIVE',1);zero('IRQ_COUNT_LO');zero('IRQ_COUNT_HI');
 // Install handler before enabling timer. Hook only the Monitor soft vector.
 h('PAY_IRQ_HANDLER','lo');e.emit('STA_ABS',softIRQ);h('PAY_IRQ_HANDLER','hi');e.emit('STA_ABS',softIRQ+1);
 w(0x8e,0x40);e.emit('LDA_ABS',TIMER+4);e.abs('LDA_ABS','OLD_ACR');e.emit('ORA_IMM',0x40);e.emit('STA_ABS',TIMER+0x0b);
 w(0x84,timerLatch&255);w(0x85,timerLatch>>8);w(0x8e,0xc0);
 e.label('PAY_IRQ_START_DONE');e.emit('PLA');e.emit('TAY');e.emit('PLA');e.emit('TAX');e.emit('PLA');e.emit('PLP');e.emit('RTS');
 e.label('PAY_IRQ_REMOVE_IMPL');e.emit('PHP');e.emit('SEI');enter();e.abs('JSR','PAY_IRQ_OFF_CORE');e.emit('PLA');e.emit('TAY');e.emit('PLA');e.emit('TAX');e.emit('PLA');e.emit('PLP');e.emit('RTS');
 e.label('PAY_IRQ_OFF_CORE');e.abs('LDA_ABS','IRQ_ACTIVE');e.branch('BNE','PAY_IRQ_OFF_ACTIVE');e.emit('RTS');
 e.label('PAY_IRQ_OFF_ACTIVE');w(0x8e,0x40);e.emit('LDA_ABS',TIMER+4);e.abs('LDA_ABS','OLD_ACR');e.emit('STA_ABS',TIMER+0x0b);
 e.emit('LDA_ABS',softIRQ);e.emit('CMP_IMM',0);let k=e.b.length-1;e.fix.push({at:k,name:'PAY_IRQ_HANDLER',kind:'lo'});e.lines[e.lines.length-1]='  CMP #<PAY_IRQ_HANDLER';e.branch('BEQ','PAY_IRQ_OFF_CHECK_HI');j('PAY_IRQ_OFF_FINISH');
 e.label('PAY_IRQ_OFF_CHECK_HI');e.emit('LDA_ABS',softIRQ+1);e.emit('CMP_IMM',0);k=e.b.length-1;e.fix.push({at:k,name:'PAY_IRQ_HANDLER',kind:'hi'});e.lines[e.lines.length-1]='  CMP #>PAY_IRQ_HANDLER';e.branch('BEQ','PAY_IRQ_OFF_RESTORE');j('PAY_IRQ_OFF_FINISH');
 e.label('PAY_IRQ_OFF_RESTORE');e.abs('LDA_ABS','OLD_IRQ_LO');e.emit('STA_ABS',softIRQ);e.abs('LDA_ABS','OLD_IRQ_HI');e.emit('STA_ABS',softIRQ+1);
 e.label('PAY_IRQ_OFF_FINISH');zero('IRQ_ACTIVE');e.emit('RTS');
 // Reuse identical register-update fragments as finite code subroutines: verified data dedup, not inferred loop.
 const groupMap=new Map();for(const a of actions){const key=JSON.stringify(a.updates);if(!groupMap.has(key))groupMap.set(key,groupMap.size);}
 actions.forEach((a,i)=>{e.label('PAY_EVENT_'+i);e.abs('JSR','PAY_UPDATE_'+groupMap.get(JSON.stringify(a.updates)));setNext(i+1);e.emit('RTS');});
 for(const [key,i] of groupMap){e.label('PAY_UPDATE_'+i);for(const u of JSON.parse(key)){e.emit('LDX_IMM',u.reg);e.emit('LDA_IMM',u.value);e.abs('JSR','PAY_AY_WRITE');}e.emit('RTS');}
 // RAM state is placed after code, aligned to avoid NMOS JMP ($xxFF) high-byte wrap bug.
 let padding=[];while((base+e.b.length+padding.length)%16!==0)padding.push(0);if((base+e.b.length+padding.length)%256===0xf0)padding.push(...new Array(16).fill(0));if(padding.length)e.bytes('PAY_ALIGN_PADDING',padding);
 e.bytes('PAY_STATE',new Array(14).fill(0));const stateStart=e.labels.PAY_STATE;
 const keys=['FRAME_LO','FRAME_HI','NEXT_LO','NEXT_HI','NEXT_FRAME_LO','NEXT_FRAME_HI','PAY_DONE','PAY_TMP','IRQ_ACTIVE','OLD_IRQ_LO','OLD_IRQ_HI','OLD_ACR','IRQ_COUNT_LO','IRQ_COUNT_HI'];keys.forEach((key,i)=>e.labels[key]=stateStart+i);
 if((e.labels.NEXT_LO&255)===255||(e.labels.OLD_IRQ_LO&255)===255)throw Error('JMP indirection pointer would trigger 6502 page wrap');
 const obj=e.finish();if(base+obj.bytes.length>0xc000)throw Error('Native image crosses Apple II I/O / ROM boundary');
 // Known unsupported edge cases are flagged in metadata rather than presented as recovered source grammar.
 const asmHeader=[`; PAY-00.7 native PAY-Light; executable 6502, absolute state, no PAY-owned zero-page`,`; SOURCE ${JSON.stringify(report.source.title||'')}  ${frames.length} observed frames`,`; Physical slot=${slot} VIA0=${hex(VIA)} VIA1=${hex(TIMER)}`,`; Source fidelity=${mode}; endPolicy=${endPolicy}; ${irqHz}Hz, T1 latch=${hex(timerLatch)}`,`; INIT=${hex(base)} TICK=${hex(base+3)} STOP=${hex(base+6)} IRQ_INSTALL=${hex(base+9)} IRQ_REMOVE=${hex(base+12)}`,`; Repeated captured AY updates are deduplicated; original source looping/pattern grammar NOT inferred.`,`; IRQ owns VIA1 T1 and Apple Monitor soft vector $03FE/$03FF while installed.`,`; Environment prerequisites: Apple II+ ROM Monitor IRQ convention (A saved at system $45); no other T1 owner.`,`; Does NOT own PAY zero-page; Monitor uses $45 (not PAY-owned). No cycle-accurate SID/AY analog conversion.`,``,];
 const aliases=keys.map((n,i)=>n+' = PAY_STATE'+(i?'+'+i:'')).join('\n');
 const symbolic=asmHeader.join('\n')+'ORG '+hex(base)+'\n\n'+aliases+'\n\n'+e.lines.join('\n')+'\n';
 const db=asmHeader.join('\n')+'ORG '+hex(base)+'\nPAY_INIT:\n'+Array.from({length:Math.ceil(obj.bytes.length/16)},(_,i)=>' DB '+Array.from(obj.bytes.slice(i*16,i*16+16)).map(b=>hex(b,2)).join(',')).join('\n')+'\n';
 return {format:'PAY_Light_Compiler_Output_v0.7',source:{title:report.source.title,traceFrames:frames.length,observedRepetition:report.musicalIR?.observedRepetition||null},configuration:{base,slot,mode,diagnosticVolume:mode==='diagnostic'?level:null,endPolicy,irqHz,cpuHz,timerLatch,irqOwnership:'Apple Monitor soft vector $03FE + VIA1 Timer1 (exclusive)'},entry:{init:base,tick:base+3,stop:base+6,irqInstall:base+9,irqRemove:base+12,irqHandler:obj.labels.PAY_IRQ_HANDLER},memory:{start:base,end:base+obj.bytes.length-1,byteLength:obj.bytes.length,stateStart,states:Object.fromEntries(keys.map(k=>[k,obj.labels[k]])),zeroPageOwnership:0},actions,observedMotifs:motifs,observedPatterns:patterns,metrics:{distinctActionFrames:actions.length,distinctUpdatePrograms:groupMap.size,registerWrites:actions.reduce((n,a)=>n+a.updates.length,0),rawSIDWrites:report.runtimeTrace.summary.sidWrites,sourceFrameCount:frames.length},asm:symbolic,binaryAssembly:db,binary:obj.bytes,disclaimer:'Finite observed AY-state compilation, not recovered SID song grammar. Repeat-observed is user-requested audition, not a proven source music loop.'};
}
return {compile,validateReport,frameRegs,makeActions,finiteMotifs,observedPatterns,hex};
});
