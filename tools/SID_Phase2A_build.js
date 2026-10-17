#!/usr/bin/env node
'use strict';
// Phase 2A build helper. Reassembles the Apple II resident foreground player,
// validates but does NOT modify original Mr. Heli PSID data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const DRIVER=path.join(ROOT,'asm/AUDIO/SID_PHASE2A_MR_HELI.S');
const ASM_CORE=path.join(ROOT,'res/ASM_core.js');
const PSID=path.join(ROOT,'asm/AUDIO/SID2MB_native_MrHeli_prototype/Mr_Heli_original.sid');
const LOAD=0x2000;
const ORIGINAL_LOAD=0x0CA0,ORIGINAL_INIT=0x1EF3,ORIGINAL_PLAY=0x0E34;
const STAGING=0x6000,ORIGINAL_LENGTH=4841;

function validatePSID(bytes)
{
    if(!Buffer.isBuffer(bytes))bytes=Buffer.from(bytes);
    const be16=at=>bytes.readUInt16BE(at);
    if(bytes.length!==ORIGINAL_LENGTH ||
       bytes.toString('ascii',0,4)!=='PSID' ||
       be16(4)!==2 || be16(6)!==0x7C ||
       be16(8)!==0 || be16(10)!==ORIGINAL_INIT ||
       be16(12)!==ORIGINAL_PLAY ||
       be16(14)!==5 || be16(16)!==5 ||
       bytes.readUInt16LE(0x7C)!==ORIGINAL_LOAD ||
       bytes[0x7E]!==0 || bytes[0x7F]!==0xA9 ||
       bytes.toString('ascii',0x16,0x1E)!=='Mr. Heli')
        throw Error('Expected untouched 4841-byte Mr. Heli PSID v2');
    if(ORIGINAL_LOAD+bytes.length-0x7E-1!==0x1F0A)
        throw Error('Unexpected payload destination range');
    return {load:ORIGINAL_LOAD,init:ORIGINAL_INIT,play:ORIGINAL_PLAY,
            songs:be16(14),defaultSong:be16(16),
            data:bytes.subarray(0x7E),staging:STAGING};
}
function assemble()
{
    const context=vm.createContext({console});
    vm.runInContext(fs.readFileSync(ASM_CORE,'utf8'),context,{filename:ASM_CORE});
    const program=new context.ASM({dialect:'raJS'}).assemble(fs.readFileSync(DRIVER,'utf8'));
    if(program.errors.length)
        throw Error(program.errors.map(e=>e.err||JSON.stringify(e)).join('\n'));
    const bytes=Buffer.alloc(program.bytes.length);
    for(let i=0;i<program.bytes.length;i++){
        if(program.bytes[i].pc!==LOAD+i)
            throw Error('Noncontiguous driver byte at index '+i);
        bytes[i]=program.bytes[i].val;
    }
    if(bytes.length>0x1000)throw Error('Loader overlaps $3000');
    for(const at of [0,3,6,9])
        if(bytes[at]!==0x4C)throw Error('Missing JMP entrypoint at $'+(LOAD+at).toString(16));
    return {bytes,load:LOAD,symbols:program.symtab};
}
function monitorText(bytes,load)
{
    let lines=['CALL-151','; Enter monitor hex bytes below; stop before the next command.'];
    for(let i=0;i<bytes.length;i+=16){
        let segment=Buffer.from(bytes.subarray(i,i+16));
        lines.push((load+i).toString(16).toUpperCase().padStart(4,'0')+': '+
                   [...segment].map(v=>v.toString(16).toUpperCase().padStart(2,'0')).join(' '));
    }
    return lines.join('\n')+'\n';
}
function main()
{
    const dest=process.argv[2]?path.resolve(process.argv[2]):
        path.join(ROOT,'tools/music');
    const tune=fs.readFileSync(PSID);
    const meta=validatePSID(tune),driver=assemble();
    fs.mkdirSync(dest,{recursive:true});
    fs.writeFileSync(path.join(dest,'SID_Phase2A_MrHeli_loader.bin'),driver.bytes);
    fs.writeFileSync(path.join(dest,'SID_Phase2A_MrHeli_loader_monitor.txt'),
                     monitorText(driver.bytes,LOAD));
    console.log('Original Mr. Heli PSID: '+tune.length+' bytes at $6000 staging');
    console.log('Native payload: $'+meta.load.toString(16)+
        ', INIT=$'+meta.init.toString(16)+', PLAY=$'+meta.play.toString(16));
    console.log('Unpatched foreground driver: '+driver.bytes.length+' bytes at $2000');
    console.log('Use CALL 8192; press any key to stop. Output: '+dest);
}
if(require.main===module)main();
module.exports={validatePSID,assemble,monitorText,LOAD,STAGING,
                ORIGINAL_LOAD,ORIGINAL_INIT,ORIGINAL_PLAY,PSID};
