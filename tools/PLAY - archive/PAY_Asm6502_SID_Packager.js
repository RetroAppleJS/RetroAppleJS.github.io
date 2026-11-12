/* PAY-00.8G source-first minimal assembler + PSIDv2 packager.
 * Independent implementation, suited to emitted 6502 subset. No hidden binary player.
 * Fails closed on unsupported syntax, branches out of range or overlap.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PAYPSIDPackager08G=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
// Encodes NMOS 6502 instructions used by the semantic reference backend.
const OPCODE={
'JMP.abs':0x4C,'JSR.abs':0x20,'RTS.imp':0x60,
'PHA.imp':0x48,'PLA.imp':0x68,'TXA.imp':0x8A,'TAX.imp':0xAA,'TYA.imp':0x98,'TAY.imp':0xA8,
'CLC.imp':0x18,'SEC.imp':0x38,'INX.imp':0xE8,'DEX.imp':0xCA,
'ADC.imm':0x69,'ADC.abs':0x6D,'CMP.imm':0xC9,'SBC.imm':0xE9,
'LDA.imm':0xA9,'LDA.abs':0xAD,'LDA.abx':0xBD,'LDX.imm':0xA2,'LDY.imm':0xA0,
'STA.abs':0x8D,'STA.abx':0x9D,'STX.abs':0x8E,
'INC.abs':0xEE,'BEQ.rel':0xF0,'BNE.rel':0xD0,'BMI.rel':0x30,'BPL.rel':0x10,'BCC.rel':0x90,'BCS.rel':0xB0
};
function num(s,symbols,missing=false){
 s=s.trim();if(/^\$[0-9A-F]+$/i.test(s))return parseInt(s.slice(1),16);
 if(/^\d+$/.test(s))return Number(s);
 if(Object.hasOwn(symbols,s))return symbols[s];
 if(missing)return 0;throw Error('Unresolved expression '+s);
}
function assemble(source){
 const rows=source.split(/\r?\n/).map((s,i)=>({text:s.split(';')[0].trim(),line:i+1})).filter(x=>x.text);
 let symbols={},memory=new Uint8Array(65536),occupied=new Uint8Array(65536),start=65536,end=0;
 for(let pass=0;pass<2;pass++){
  let pc=0,orgSeen=false;
  for(const {text,line} of rows){let s=text;
   const label=s.match(/^([A-Z_][A-Z0-9_]*):\s*(.*)$/i);
   if(label){if(pass===0){if(Object.hasOwn(symbols,label[1]))throw Error('Duplicate label '+label[1]);symbols[label[1]]=pc;}s=label[2];if(!s)continue;}
   const mt=s.match(/^([A-Z]+)(?:\s+(.*))?$/i);if(!mt)throw Error('Invalid assembler source line '+line+': '+s);
   const op=mt[1].toUpperCase(),arg=(mt[2]||'').trim();
   if(op==='ORG') {pc=num(arg,symbols,pass===0);if(pc<0||pc>=65536)throw Error('ORG out of range at '+line);orgSeen=true;start=Math.min(start,pc);continue;}
   if(!orgSeen)throw Error('Expected ORG before code line '+line);
   let mode,vals=[];
   if(op==='DB'){mode='db';vals=arg.split(',').map(x=>x.trim());if(vals.some(x=>!x))throw Error('Empty DB literal on line '+line);}
   else if(!arg){mode='imp';}
   else if(Object.hasOwn(OPCODE,op+'.rel')){mode='rel';}
   else if(arg.startsWith('#')){mode='imm';}
   else if(/,X$/i.test(arg)){mode='abx';}
   else {mode='abs';}
   if(mode!=='db'&&!Object.hasOwn(OPCODE,op+'.'+mode))throw Error('Unsupported instruction '+op+' '+arg+' at '+line);
   const len=mode==='db'?vals.length:(mode==='imp'?1:(mode==='abs'||mode==='abx'?3:2));
   if(pc+len>65536)throw Error('Memory overflow at line '+line);
   if(pass===1){
    for(let i=0;i<len;i++){if(occupied[pc+i])throw Error('Address overlap at $'+(pc+i).toString(16));occupied[pc+i]=1;}
    if(mode==='db')vals.forEach((v,i)=>{const n=num(v,symbols);if(n<0||n>255)throw Error('DB out of range line '+line);memory[pc+i]=n;});
    else {memory[pc]=OPCODE[op+'.'+mode];if(len>1){let n=num(arg.replace(/^#/,'').replace(/,X$/i,''),symbols);
      if(mode==='rel'){n-=(pc+2);if(n<-128||n>127)throw Error('Branch too far at '+line+': '+arg+' = '+n);memory[pc+1]=n&255;}
      else {if(n<0||n>65535)throw Error('Operand out of range at '+line);memory[pc+1]=n&255;if(len===3)memory[pc+2]=(n>>>8)&255;}
    }}
   }
   pc+=len;end=Math.max(end,pc);
  }
 }
 if(start>=end)throw Error('No emitted code');
 return {load:start,end,bytes:memory.slice(start,end),symbols};
}
function psidBytes(asm,settings={}){
 if(asm.load!==0x1000)throw Error('This SID-reference packager expects ORG $1000');
 if(asm.symbols.SID_REF_INIT!==0x1000||asm.symbols.SID_REF_PLAY!==0x1003)throw Error('SID entry addresses differ');
 const output=new Uint8Array(0x7C+asm.bytes.length),dv=new DataView(output.buffer);
 ['P','S','I','D'].forEach((x,i)=>output[i]=x.charCodeAt(0));
 dv.setUint16(4,2,false);dv.setUint16(6,0x7C,false);
 dv.setUint16(8,0x1000,false);dv.setUint16(10,0x1000,false);dv.setUint16(12,0x1003,false);
 dv.setUint16(14,3,false);dv.setUint16(16,1,false);dv.setUint32(18,0,false);
 const str=(off,value)=>{const t=String(value).slice(0,31);for(let i=0;i<t.length;i++)output[off+i]=t.charCodeAt(i)&127;};
 str(0x16,settings.title||'PAY 08G first PLAY reference');str(0x36,settings.author||'PAY deterministic compiler');str(0x56,settings.release||'2026 research, silent fixture');
 dv.setUint16(0x76,0x04,false); // PAL clock. Timing supplied by test harness, not verified C64 IRQ.
 output.set(asm.bytes,0x7C);return output;
}
return {assemble,psidBytes};
});
