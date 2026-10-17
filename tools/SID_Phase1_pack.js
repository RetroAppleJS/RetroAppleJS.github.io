#!/usr/bin/env node
'use strict';
// Assemble the same 6502 INIT/PLAY routines used by the Apple II diagnostic
// into a normal PSID v2 file. No C64 emulation or pre-rendered SID registers.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const SOURCE=path.join(ROOT,'asm/AUDIO/SID_PHASE1_MINIPLAYER.S');
const ASM_CORE=path.join(ROOT,'res/ASM_core.js');
const DEFAULT_OUT=path.join(ROOT,'tools/music');
const LOAD=0x6000,INIT=0x6003,PLAY=0x6006;

function assemble(){
    const context=vm.createContext({console});
    vm.runInContext(fs.readFileSync(ASM_CORE,'utf8'),context,{filename:ASM_CORE});
    const asm=new context.ASM({dialect:'raJS'});
    const result=asm.assemble(fs.readFileSync(SOURCE,'utf8'));
    if(result.errors.length)
        throw new Error('ASM_core: '+result.errors.map(e=>e.sourceLine+': '+e.err).join('; '));
    if(!result.bytes.length || result.bytes[0].pc!==LOAD)
        throw new Error('Expected code at $6000');
    const bytes=new Uint8Array(result.bytes.length);
    for(let i=0;i<bytes.length;i++){
        if(result.bytes[i].pc!==LOAD+i)
            throw new Error('Non-contiguous code at byte '+i);
        bytes[i]=result.bytes[i].val;
    }
    if(bytes[0]!==0x4C || bytes[3]!==0x4C ||
       bytes[6]!==0x4C || bytes[9]!==0x4C)
        throw new Error('Expected four JMP entry stubs');
    return {bytes,listing:result.listingText,entry:{run:LOAD,init:INIT,play:PLAY,stop:0x6009}};
}
function packPSID(bytes){
    if(!(bytes instanceof Uint8Array))throw new TypeError('Expected assembled bytes');
    const offset=0x7C,out=new Uint8Array(offset+bytes.length);
    out.set([0x50,0x53,0x49,0x44],0); // PSID
    function be16(at,v){out[at]=(v>>>8)&255;out[at+1]=v&255;}
    be16(4,2);                  // PSID v2
    be16(6,offset);             // data offset
    be16(8,LOAD);               // explicit load address (no leading PRG address)
    be16(10,INIT);be16(12,PLAY);
    be16(14,1);be16(16,1);     // one song, default song 1
    // speed dword 0: call play once per video frame
    function title(at,s){for(let i=0;i<32&&i<s.length;i++)out[at+i]=s.charCodeAt(i)&127;}
    title(0x16,'RetroAppleJS SID Phase 1');
    title(0x36,'RetroAppleJS');
    title(0x56,'2026 Phase 1');
    be16(0x76,0x0014);          // PAL clock + MOS 6581 model preference
    out.set(bytes,offset);
    return out;
}
function main(){
    const dest=process.argv[2]?path.resolve(process.argv[2]):DEFAULT_OUT;
    const program=assemble(),sid=packPSID(program.bytes);
    fs.mkdirSync(dest,{recursive:true});
    fs.writeFileSync(path.join(dest,'SID_Phase1_Test.sid'),sid);
    fs.writeFileSync(path.join(dest,'SID_Phase1_Test.bin'),program.bytes);
    console.log('Assembled '+program.bytes.length+' bytes at $6000; PSID '+sid.length+' bytes');
    console.log('INIT=$6003 PLAY=$6006, 50 Hz (video-frame scheduling)');
    console.log('Wrote to '+dest);
}
if(require.main===module)main();
module.exports={assemble,packPSID,LOAD,INIT,PLAY};
