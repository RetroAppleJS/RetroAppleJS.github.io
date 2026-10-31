'use strict';
// Verify the human-readable ASM_core.js input emits identical machine code
// to the pinned, independently assembled Vince Weaver ca65 version.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const input=path.join(root,'asm/AUDIO/PT3_02A_ASM_CORE.S');
const reference=path.join(root,'build/pt3_02a/PT3_02A_PLAYER.bin');
const context=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(root,'res/ASM_core.js'),'utf8'),context);
const source=fs.readFileSync(input,'utf8');
const asm=new context.ASM({dialect:'raJS',maxLayoutPasses:48});
const assembled=asm.assemble(source);
if(assembled.errors.length){
  const messages=assembled.errors.slice(0,30).map(e=>JSON.stringify(e));
  throw Error('ASM_core errors ('+assembled.errors.length+'):\n'+messages.join('\n'));
}
assert.ok(assembled.bytes?.length,'ASM_core yielded no code');
assert.equal(assembled.bytes[0].pc,0x6000,'Unexpected ORG/start address');
for(let i=0;i<assembled.bytes.length;i++)
  assert.equal(assembled.bytes[i].pc,0x6000+i,'Gap/overlap in assembler image byte '+i);
const actual=Buffer.from(assembled.bytes.map(x=>x.val));
assert.ok(actual.length<=4096,'ASM_core binary exceeds $6000-$6FFF');
const expected=fs.readFileSync(reference);
if(!actual.equals(expected)){
  const n=Math.min(actual.length,expected.length);
  let off=0;while(off<n&&actual[off]===expected[off])off++;
  throw Error('ASM_core versus ca65 mismatch: ASM_core='+actual.length+
    ' bytes; ca65='+expected.length+' bytes; first difference at byte '+
    off+' ($'+(0x6000+off).toString(16)+'), ASM_core='+actual[off]+
    ', ca65='+expected[off]);
}
// Three entry points must remain JMP vectors at $6000/$6003/$6006.
for(const offset of [0,3,6])
  assert.equal(actual[offset],0x4c,'Expected JMP at entry offset '+offset);
console.log('PASS: ASM_core.js matches ca65 byte for byte;',actual.length,
 'bytes at $6000; source lines',source.split('\n').length);
