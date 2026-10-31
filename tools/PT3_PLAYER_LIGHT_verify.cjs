#!/usr/bin/env node
// Assemble resident LIGHT with the actual RetroAppleJS ASM_core.js implementation.
// No PT3 decoder rewrites or opaque machine code.
'use strict';
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(root,'res/ASM_core.js'),'utf8'),context);
const file=path.join(root,'asm/AUDIO/PT3_PLAYER_LIGHT_ASM_CORE.S');
const source=fs.readFileSync(file,'utf8');
const asm=new context.ASM({dialect:'raJS',maxLayoutPasses:48});
const result=asm.assemble(source);
if(result.errors.length){
  console.error(result.errors.slice(0,25));
  throw new Error('Assembler errors ('+result.errors.length+')');
}
assert.ok(result.bytes.length>2700 && result.bytes.length<=4096,'Resident binary out of $6000–$6FFF bounds');
for(let i=0;i<result.bytes.length;i++){
  assert.equal(result.bytes[i].pc,0x6000+i,'Noncontiguous assembly at '+i);
}
assert.doesNotMatch(source,/pt3_02a_(?:hgr|foreground|marker)|pt3_02a_move_marker|pt3_02a_clear_page/i,
 'Resident player must not contain legacy HGR demo or foreground routines');
assert.doesNotMatch(source,/\\b(?:bit|sta|stx|sty|lda)\\s+\\$c05[0-7]\\b/i,
 'Resident player must not switch graphics modes');
const bytes=Buffer.from(result.bytes.map(x=>x.val));
for(const off of [0,3,6,9,12])assert.equal(bytes[off],0x4c,'Missing public JMP entry at $'+(0x6000+off).toString(16));
assert.equal(bytes.indexOf(Buffer.from('ProTracker','ascii')),-1,'Unexpected embedded PT3 song');
const out=path.join(root,'build/pt3_light');
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'PT3_PLAYER_LIGHT.bin'),bytes);
fs.writeFileSync(path.join(out,'PT3_PLAYER_LIGHT_build.json'),JSON.stringify({
  schema:'retroapplejs.pt3.light.build.v1',
  assembler:'ASM_core.js raJS',origin:0x6000,bytes:bytes.length,
  songAddress:0x8000,entrypoints:{start:0x6000,stop:0x6003,pause:0x6006,resume:0x6009,status:0x600c}
},null,2)+'\n');
console.log('PASS PT3 LIGHT ASM_core resident:',bytes.length,'bytes, START/STOP/PAUSE/RESUME/STATUS vectors');
