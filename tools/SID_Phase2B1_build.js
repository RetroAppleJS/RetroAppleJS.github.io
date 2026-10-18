#!/usr/bin/env node
'use strict';
// Phase 2B.1: prepare a compatible PSID v1/v2 for the Apple II's native 6502.
// Source PSID bytes remain intact. All C64 absolute instruction operands remain
// intact; "load" in the header is the native EXECUTION address, not the address
// where the complete PSID file is staged in Apple II RAM.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const DRIVER=path.join(ROOT,'asm/AUDIO/SID_PHASE2B1_PLAYER.S');
const ASM_CORE=path.join(ROOT,'res/ASM_core.js');
const REFERENCE=path.join(ROOT,'asm/AUDIO/SID2MB_prototype/Mr_Heli_original.sid');
const STAGE_MIN=0x2000,STAGE_END=0x9000,MAX_FILE=STAGE_END-STAGE_MIN;
const TRAMP=0x1C00,RUNTIME=0x9000,DESCRIPTOR=0x9400,ZP_BACKUP=0x9500;
const RUNTIME_END=0x9600; // runtime, descriptor and 256-byte ZP backup
const DESC_SIZE=16;
function hex(x,digits=4){return '$'+x.toString(16).toUpperCase().padStart(digits,'0')}
function fail(code,explanation){const e=new Error(explanation);e.code=code;throw e}
function numeric(value,name){
    if(typeof value==='number'&&Number.isInteger(value))return value;
    if(typeof value!=='string')fail('BAD_ARGUMENT',name+' must be an integer');
    const s=value.trim(),n=s.startsWith('$')?parseInt(s.slice(1),16):
        s.startsWith('0x')?parseInt(s.slice(2),16):Number(s);
    if(!Number.isInteger(n))fail('BAD_ARGUMENT','Invalid '+name+': '+s);
    return n;
}
function parsePSID(input,opts={}){
    const data=Buffer.from(input);
    if(data.length<0x76)fail('TRUNCATED_HEADER','PSID header is shorter than v1 minimum');
    const sig=data.toString('ascii',0,4);
    if(sig==='RSID')fail('RSID_UNSUPPORTED','RSID requires a C64 environment; native PSID only');
    if(sig!=='PSID')fail('NOT_PSID','Missing PSID file signature');
    const be16=x=>data.readUInt16BE(x);
    const version=be16(4),offset=be16(6);
    if(version!==1&&version!==2)
        fail('PSID_VERSION','Only PSID v1/v2 are supported (got '+version+')');
    if(offset<(version===1?0x76:0x7C)||offset>=data.length)
        fail('DATA_OFFSET','PSID data offset is outside the file or header');
    const songs=be16(14),startSong=be16(16),speed=data.readUInt32BE(18);
    if(songs<1||songs>256||startSong<1||startSong>songs)
        fail('BAD_SONGS','Invalid PSID songs/default subtune information');
    const song=opts.subtune===undefined?startSong:numeric(opts.subtune,'subtune');
    if(song<1||song>songs)fail('SUBTUNE_RANGE','Subtune must be 1–'+songs);
    const speedBit=(speed>>>(Math.min(song-1,31)))&1;
    if(speedBit)fail('CIA_TIMING','CIA-timed subtune requires a timer not supported in Phase 2B.1');
    const flags=version===2?be16(0x76):0;
    if(flags&1)fail('MUS_UNSUPPORTED','MUS player format requires a C64 driver');
    if(flags&2)fail('BASIC_UNSUPPORTED','PSID BASIC initialization requires C64 ROM');
    if(version===2&&(data[0x7A]||data[0x7B]))
        fail('MULTISID','Second or third SID chips are not supported');
    const clockBits=(flags>>2)&3; // 0 unspecified, 1 PAL, 2 NTSC, 3 both
    let hz=opts.videoHz===undefined?(clockBits===2?60:50):numeric(opts.videoHz,'videoHz');
    if(hz!==50&&hz!==60)fail('FRAME_RATE','Supported VBI music timing is 50 or 60 Hz');
    if(clockBits===1&&hz!==50||clockBits===2&&hz!==60)
        fail('CLOCK_MISMATCH','Selected music frame rate conflicts with PSID PAL/NTSC flags');
    let loadAddress=be16(8),payloadOffset=offset;
    if(!loadAddress){
        if(offset+2>data.length)fail('TRUNCATED_PRG','Embedded PRG load address is absent');
        loadAddress=data[offset]|data[offset+1]<<8;
        payloadOffset+=2;
    }
    const length=data.length-payloadOffset;
    if(length<1)fail('EMPTY_PAYLOAD','No executable PSID payload');
    const end=loadAddress+length;
    if(loadAddress<0x0C00||end>0xC000)
        fail('EXECUTION_RANGE','C64 payload must fit in Apple II RAM $0C00–$BFFF');
    if(loadAddress<RUNTIME_END&&end>RUNTIME)
        fail('PLAYER_COLLISION','Original C64 load range overlaps protected SID runtime '+hex(RUNTIME)+'–'+hex(RUNTIME_END-1));
    let init=be16(10)||loadAddress,play=be16(12);
    if(!play)fail('IRQ_PLAY_UNSUPPORTED','PSID PLAY=$0000 relies on a C64 IRQ vector');
    if(init<loadAddress||init>=end||play<loadAddress||play>=end)
        fail('ENTRYPOINT_RANGE','INIT and PLAY must reside inside the executable payload');
    const clean=s=>s.replace(/\0.*$/s,'').trim();
    return {
        format:'PSID',version,headerSize:offset,fileLength:data.length,
        payloadOffset,payloadLength:length,loadAddress,executableEnd:end,
        initAddress:init,playAddress:play,songs,defaultSong:startSong,
        selectedSong:song,rateHz:hz,flags,speed,clockBits,
        title:clean(data.toString('latin1',0x16,0x36)),
        author:clean(data.toString('latin1',0x36,0x56)),
        released:clean(data.toString('latin1',0x56,0x76)),
        warnings:[
            'PSID headers cannot prove NMOS 6502 opcode compatibility, safe self-modification or independence from C64 ROM/CIA/VIC.',
            'C64 ZP and RAM contents outside the payload are only approximated: start with a disposable Apple II snapshot.'
        ]
    };
}
function prepare(input,{stage=0x6000,subtune,videoHz}={}){
    const bytes=Buffer.from(input);
    stage=numeric(stage,'stage');
    if(bytes.length>MAX_FILE||stage<STAGE_MIN||stage>=STAGE_END||
       stage+bytes.length>STAGE_END)
        fail('STAGING_RANGE','Complete PSID must fit in '+hex(STAGE_MIN)+'–'+hex(STAGE_END-1)+
            ' (max 28 KiB including PSID header)');
    const info=parsePSID(bytes,{subtune,videoHz});
    const payloadAddress=stage+info.payloadOffset;
    const desc=Buffer.alloc(DESC_SIZE,0);
    desc.write('S2B1',0,'ascii');
    desc.writeUInt16LE(payloadAddress,4);
    desc.writeUInt16LE(info.loadAddress,6);
    desc.writeUInt16LE(info.payloadLength,8);
    desc.writeUInt16LE(info.initAddress,10);
    desc.writeUInt16LE(info.playAddress,12);
    desc[14]=info.selectedSong-1;
    desc[15]=info.rateHz===60?1:0;
    return {...info,stage,payloadAddress,descriptor:desc,bytes};
}
function assemblePlayer(){
    const ctx=vm.createContext({console});
    vm.runInContext(fs.readFileSync(ASM_CORE,'utf8'),ctx,{filename:ASM_CORE});
    const program=new ctx.ASM({dialect:'raJS'}).assemble(fs.readFileSync(DRIVER,'utf8'));
    if(program.errors.length)
        fail('ASSEMBLER',program.errors.map(x=>x.err||JSON.stringify(x)).join('\n'));
    const sections=[{address:TRAMP,bytes:[]},{address:RUNTIME,bytes:[]}];
    for(const {pc,val} of program.bytes){
        if(pc>=TRAMP&&pc<TRAMP+12)sections[0].bytes.push(val);
        else if(pc>=RUNTIME&&pc<DESCRIPTOR)sections[1].bytes.push(val);
        else fail('PLAYER_LAYOUT','Assembly emitted an unexpected byte at '+hex(pc));
    }
    if(sections[0].bytes.length!==12)
        fail('PLAYER_LAYOUT','Expected 12-byte $1C00 public jump table');
    const runtime=Buffer.from(sections[1].bytes);
    if(!runtime.length||runtime.length>=DESCRIPTOR-RUNTIME)
        fail('PLAYER_LAYOUT','Native runtime exceeds protected $9000–$93FF');
    for(let i=0;i<4;i++)
        if(sections[0].bytes[3*i]!==0x4C)
            fail('PLAYER_LAYOUT','Public entry '+i+' must be JMP');
    for(let i=0;i<4;i++)
        if(runtime[3*i]!==0x4C)
            fail('PLAYER_LAYOUT','Resident entry '+i+' must be JMP');
    return {bootstrap:Buffer.from(sections[0].bytes),runtime,
        symbols:program.symtab};
}
function monitorHex(bytes,address){
    const lines=['CALL-151','; Enter these hex bytes using the Apple II monitor'];
    for(let i=0;i<bytes.length;i+=16)
        lines.push((address+i).toString(16).toUpperCase().padStart(4,'0')+': '+
            [...bytes.subarray(i,i+16)].map(x=>x.toString(16).toUpperCase().padStart(2,'0')).join(' '));
    return lines.join('\n')+'\n';
}
function main(args=process.argv.slice(2)){
    if(args.includes('--help')||args.includes('-h')){
        console.log('Usage: node tools/SID_Phase2B1_build.js [file.sid] [stage=$6000] [subtune=default] [out-dir]');
        return;
    }
    const filename=args[0]?path.resolve(args[0]):REFERENCE;
    const stage=args[1]===undefined?0x6000:numeric(args[1],'stage');
    const subtune=args[2]===undefined?undefined:numeric(args[2],'subtune');
    const dest=args[3]?path.resolve(args[3]):path.join(ROOT,'tools/music');
    const meta=prepare(fs.readFileSync(filename),{stage,subtune}),driver=assemblePlayer();
    fs.mkdirSync(dest,{recursive:true});
    const out=(name,data)=>fs.writeFileSync(path.join(dest,'SID_Phase2B1_'+name),data);
    out('bootstrap.bin',driver.bootstrap);
    out('runtime.bin',driver.runtime);
    out('descriptor.bin',meta.descriptor);
    out('bootstrap_monitor.txt',monitorHex(driver.bootstrap,TRAMP));
    out('runtime_monitor.txt',monitorHex(driver.runtime,RUNTIME));
    out('descriptor_monitor.txt',monitorHex(meta.descriptor,DESCRIPTOR));
    out('staged_psid_monitor.txt',monitorHex(meta.bytes,meta.stage));
    const summary={input:filename,title:meta.title,author:meta.author,
        stage:hex(meta.stage),fileBytes:meta.fileLength,
        originalLoad:hex(meta.loadAddress),end:hex(meta.executableEnd-1),
        executableBytes:meta.payloadLength,init:hex(meta.initAddress),
        play:hex(meta.playAddress),song:meta.selectedSong,songs:meta.songs,
        rateHz:meta.rateHz,playerStub:hex(TRAMP),runtime:hex(RUNTIME),
        descriptor:hex(DESCRIPTOR),warnings:meta.warnings};
    out('manifest.json',JSON.stringify(summary,null,2)+'\n');
    console.log(JSON.stringify(summary,null,2));
    console.log('Load 4 memory images then CALL 7168; any key stops. No code relocation.');
}
if(require.main===module)main();
module.exports={parsePSID,prepare,assemblePlayer,monitorHex,main,
    STAGE_MIN,STAGE_END,MAX_FILE,TRAMP,RUNTIME,DESCRIPTOR,ZP_BACKUP,REFERENCE};
