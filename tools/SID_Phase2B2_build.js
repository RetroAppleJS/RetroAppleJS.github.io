#!/usr/bin/env node
'use strict';
// Build-time only: the Apple II 6502 assembly is the ONLY PSID interpreter.
// End users do not run Node; CI compiles and verifies this authoritative source.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const SOURCE=path.join(ROOT,'asm/AUDIO/SID_PHASE2B2_NATIVE_PLAYER.S');
const ASM_CORE=path.join(ROOT,'res/ASM_core.js');
const STUB=0x1C00,RUNTIME=0x9000,UPPER=0x9D00,TRANSFER=0x9E00,BACKUP=0x9F00;
function assemble(){
    const ctx=vm.createContext({console});
    vm.runInContext(fs.readFileSync(ASM_CORE,'utf8'),ctx,{filename:ASM_CORE});
    const assembled=new ctx.ASM({dialect:'raJS'}).assemble(fs.readFileSync(SOURCE,'utf8'));
    if(assembled.errors.length)
        throw new Error(assembled.errors.map(x=>x.err||JSON.stringify(x)).join('\n'));
    const low=new Map(),high=new Map();
    for(const item of assembled.bytes){
        if(item.pc>=STUB&&item.pc<STUB+12)low.set(item.pc,item.val);
        else if(item.pc>=RUNTIME&&item.pc<UPPER)high.set(item.pc,item.val);
        else throw new Error('Unexpected player byte at $'+item.pc.toString(16));
    }
    function consecutive(map,start,end){
        const data=Buffer.alloc(end-start);
        for(let i=start;i<end;i++){
            if(!map.has(i))throw new Error('Assembly gap at $'+i.toString(16));
            data[i-start]=map.get(i);
        }
        return data;
    }
    const final=Math.max(...high.keys())+1;
    if(low.size!==12||!high.size||final>UPPER)
        throw new Error('Native assembly overlaps reserved high RAM');
    const bootstrap=consecutive(low,STUB,STUB+12);
    const runtime=consecutive(high,RUNTIME,final);
    if(bootstrap[0]!==0x4C||runtime[0]!==0x4C)
        throw new Error('Invalid jump entry');
    return {bootstrap,runtime,highEnd:final,symbols:assembled.symtab};
}
function listing(bytes,origin){
    let out=['CALL-151','; Assembled from SID_PHASE2B2_NATIVE_PLAYER.S'];
    for(let i=0;i<bytes.length;i+=16){
        out.push((origin+i).toString(16).toUpperCase().padStart(4,'0')+': '+
            [...bytes.subarray(i,i+16)].map(v=>v.toString(16).toUpperCase().padStart(2,'0')).join(' '));
    }
    return out.join('\n')+'\n';
}
function main(args=process.argv.slice(2)){
    const destination=path.resolve(args[0]||path.join(ROOT,'tools/music'));
    const player=assemble();
    fs.mkdirSync(destination,{recursive:true});
    for(const [part,origin] of [['bootstrap',STUB],['runtime',RUNTIME]]){
        fs.writeFileSync(path.join(destination,'SID_Phase2B2_'+part+'.bin'),player[part]);
        fs.writeFileSync(path.join(destination,'SID_Phase2B2_'+part+'_monitor.txt'),
            listing(player[part],origin));
    }
    const manifest={source:path.relative(ROOT,SOURCE),entry:'$1C00',
        runtime:'$9000–$'+(player.highEnd-1).toString(16).toUpperCase(),
        transferRecord:'$9E00',zeroPageBackup:'$9F00',runtimeBytes:player.runtime.length};
    fs.writeFileSync(path.join(destination,'SID_Phase2B2_manifest.json'),
        JSON.stringify(manifest,null,2)+'\n');
    console.log(manifest);
}
if(require.main===module)main();
module.exports={assemble,listing,main,SOURCE,STUB,RUNTIME,UPPER,TRANSFER,BACKUP};
