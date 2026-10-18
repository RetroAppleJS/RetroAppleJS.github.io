'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const build=require('../tools/SID_Phase2B1_build.js');
const ROOT=path.join(__dirname,'..');
const original=fs.readFileSync(build.REFERENCE);

function fixture({version=2,payloadLength=300,load=0x4000,rate=50,embedded=false,
                  songs=2,speed=0,play=0x4006}={}){
    const offset=version===1?0x76:0x7C;
    const bytes=Buffer.alloc(offset+(embedded?2:0)+payloadLength,0);
    bytes.write('PSID',0);
    bytes.writeUInt16BE(version,4);bytes.writeUInt16BE(offset,6);
    bytes.writeUInt16BE(embedded?0:load,8);
    bytes.writeUInt16BE(load,10);bytes.writeUInt16BE(play,12);
    bytes.writeUInt16BE(songs,14);bytes.writeUInt16BE(1,16);
    bytes.writeUInt32BE(speed,18);
    bytes.write('RetroAppleJS Test',0x16,'ascii');
    if(version===2)bytes.writeUInt16BE(rate===60?8:4,0x76);
    let start=offset;
    if(embedded){bytes.writeUInt16LE(load,start);start+=2;}
    Buffer.from([0xA9,0x0F,0x8D,0x18,0xD4,0x60,
                 0xA9,0x41,0x8D,0x04,0xD4,0x60]).copy(bytes,start);
    bytes.fill(0xEA,start+12);
    return bytes;
}
function simulate(file,{stage=0x6000,slot=4,frames=14,subtune,corruptTransfer=false}={}){
    const image=build.prepare(file,{stage,subtune}),player=build.assemblePlayer();
    const mem=new Uint8Array(65536);
    mem.set(image.bytes,image.stage);
    mem.set(player.bootstrap,build.TRAMP);
    mem.set(player.runtime,build.RUNTIME);
    mem.set(image.descriptor,build.DESCRIPTOR);
    if(corruptTransfer)mem[image.payloadAddress+20]^=0x11;
    const zp=Uint8Array.from({length:256},(_,i)=>(i*73+11)&255);
    mem.set(zp,0);mem[0x1FE]=0xFF;mem[0x1FF]=0xFE;
    const ioBase=0xC080+slot*16;
    const context=vm.createContext({console,Uint8Array,Float32Array,Math,Number,
        oEMU:{component:{CPU:{}}}});
    vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_cpu6502.js'),'utf8'),context);
    let tick=0,slotIndex=0,latched=0,stopped=false,kbdChecks=0;
    let validatedCopy=false,hasCopyCheck=false,returned=false;
    const writes=[],playEntries=[];
    const cpu=new context.Cpu6502({
        irq_signal:0,nmi_signal:0,
        read(address){
            if(address>=0xC090&&address<=0xC0F0&&(address&15)===0)
                return address===ioBase?0x53:0xFF;
            if(address===ioBase+3){
                if(slotIndex===0x1E){latched=tick&65535;return latched&255;}
                if(slotIndex===0x1F)return latched>>>8;
                return 0xFF;
            }
            if(address===0xC000)return (++kbdChecks)>=frames?0x80:0;
            if(address===0xC010)return 0;
            if(address===0xFDED)return 0x60;
            if(address>=0xD000)return 0xEA;
            return mem[address&65535];
        },
        write(address,value){
            if(address===ioBase+2){slotIndex=value&31;return;}
            if(address>=0xD400&&address<=0xD41F){
                writes.push([address,value&255]);
            }else if(address<0xC000)mem[address]=value&255;
        },
        lineDecode:a=>a>>12
    });
    cpu.reset();
    cpu.setState({pc:build.TRAMP,sp:0xFD,p:0x20,a:0,x:0,y:0});
    cpu.setExecutionTrap(0xFF00,()=>{returned=true;return true;});
    let previousPlay=false;
    while(!returned&&tick<4000000){
        const pc=cpu.watch().pc;
        if(!hasCopyCheck&&pc===image.initAddress){
            hasCopyCheck=true;
            const expected=image.bytes.subarray(image.payloadOffset);
            const actual=mem.subarray(image.loadAddress,image.executableEnd);
            validatedCopy=Buffer.from(actual).equals(expected);
        }
        const isPlay=pc===image.playAddress;
        if(isPlay&&!previousPlay)playEntries.push(tick);
        previousPlay=isPlay;
        cpu.cycle();tick++;
    }
    assert.ok(returned,'native player did not return; PC=$'+cpu.watch().pc.toString(16));
    return {image,player,mem,zp,writes,playEntries,tick,returned,
        hasCopyCheck,validatedCopy,kbdChecks,slotIndex};
}

test('generic PSID v1/v2 parser accepts Mr. Heli and arbitrary safe staging addresses',()=>{
    const info=build.parsePSID(original);
    assert.equal(info.version,2);assert.equal(info.title,'Mr. Heli');
    assert.equal(info.songs,5);assert.equal(info.selectedSong,5);
    assert.equal(info.loadAddress,0x0CA0);assert.equal(info.initAddress,0x1EF3);
    assert.equal(info.playAddress,0x0E34);assert.equal(info.rateHz,50);
    assert.equal(info.payloadLength,4715);
    for(const start of [0x2000,0x3000,0x6000,0x7D00]){
        const p=build.prepare(original,{stage:start});
        assert.equal(p.descriptor.length,18);
        assert.equal(p.descriptor.readUInt16LE(16),0x3B46);
        assert.equal(p.payloadAddress,start+0x7E);
        assert.equal(p.descriptor.readUInt16LE(4),start+0x7E);
        assert.equal(p.descriptor.readUInt16LE(6),0x0CA0);
        assert.equal(p.descriptor[14],4);
    }
    const v1=build.parsePSID(fixture({version:1,rate:50}));
    assert.equal(v1.headerSize,0x76);
    assert.equal(v1.loadAddress,0x4000);
    const embedded=build.parsePSID(fixture({embedded:true}));
    assert.equal(embedded.payloadOffset,0x7E);
});
test('PSID preflight rejects unsupported formats, CIA, unsafe memory and collisions',()=>{
    const corruption=Buffer.from(original);corruption.write('RSID',0);
    assert.throws(()=>build.prepare(corruption),e=>e.code==='RSID_UNSUPPORTED');
    const cia=fixture({speed:1});
    assert.throws(()=>build.prepare(cia),e=>e.code==='CIA_TIMING');
    const mult=fixture();mult[0x7A]=0x42;
    assert.throws(()=>build.prepare(mult),e=>e.code==='MULTISID');
    const playsid=fixture();playsid[0x77]|=0x02;
    assert.throws(()=>build.prepare(playsid),e=>e.code==='PLAYSID_UNSUPPORTED');
    assert.throws(()=>build.prepare(fixture({load:0x9000,play:0x9006})),
        e=>e.code==='PLAYER_COLLISION');
    assert.throws(()=>build.prepare(fixture({load:0x0400,play:0x0406})),
        e=>e.code==='EXECUTION_RANGE');
    assert.throws(()=>build.prepare(fixture({play:0})),
        e=>e.code==='IRQ_PLAY_UNSUPPORTED');
    assert.throws(()=>build.prepare(original,{stage:0x7E00}),
        e=>e.code==='STAGING_RANGE');
    assert.throws(()=>build.prepare(original,{subtune:6}),
        e=>e.code==='SUBTUNE_RANGE');
    assert.throws(()=>build.prepare(fixture({rate:60}),{videoHz:50}),
        e=>e.code==='CLOCK_MISMATCH');
});
test('player image resides at $1C00/$9000, not inside the 28 KiB staging window',()=>{
    const player=build.assemblePlayer();
    assert.equal(player.bootstrap.length,12);
    assert.ok(player.runtime.length>350&&player.runtime.length<=1024);
    assert.equal(player.symbols.PUBLIC,0x1C00);
    assert.equal(player.symbols.START,0x9000);
    assert.equal(player.symbols.STOP,0x9003);
    assert.equal(player.symbols.STATUS,0x9009);
    assert.equal(player.bootstrap[0],0x4C);
    assert.equal(player.bootstrap[3],0x4C);
});
test('native Mr. Heli plays identically when staged at $2000, $6000 and near $9000',()=>{
    const reference=[];
    for(const stage of [0x2000,0x6000,0x7D00]){
        const r=simulate(original,{stage,frames:16});
        assert.equal(r.mem[r.player.symbols.ERRORCD],0);
        assert.equal(r.hasCopyCheck,true);
        assert.equal(r.validatedCopy,true,'original code was not copied exactly');
        assert.deepEqual(Array.from(r.mem.subarray(0,256)),Array.from(r.zp));
        assert.deepEqual(Array.from(r.mem.subarray(0x1C00,0x1C0C)),
            Array.from(r.player.bootstrap),'overwritten player entry must be repaired on exit');
        assert.equal(r.playEntries.length,16);
        assert.ok(Math.abs((r.playEntries.at(-1)-r.playEntries[0])/15-20436)<10);
        assert.equal(r.writes.at(-1)[0],0xD418);
        assert.equal(r.writes.at(-1)[1],0);
        reference.push(r.writes);
    }
    assert.deepEqual(reference[0],reference[1]);
    assert.deepEqual(reference[1],reference[2]);
});
test('generic loader handles reverse/forward overlap without damaging executable bytes',()=>{
    const music=fixture();
    for(const stage of [0x3F00,0x4000]){
        const r=simulate(music,{stage,frames:12});
        assert.equal(r.validatedCopy,true,'unsafe overlapping copy at '+stage.toString(16));
        assert.equal(r.playEntries.length,12);
        assert.ok(r.writes.some(([addr,val])=>addr===0xD404&&val===0x41));
        assert.equal(r.mem[r.player.symbols.ERRORCD],0);
    }
});
test('NTSC VBI fixture invokes original PLAY at approximately 60 Hz',()=>{
    const music=fixture({rate:60});
    const r=simulate(music,{stage:0x5000,frames:14});
    const spacing=r.playEntries.slice(1).map((n,i)=>n-r.playEntries[i]);
    assert.equal(r.image.rateHz,60);
    assert.equal(r.image.descriptor[15],1);
    assert.ok(spacing.every(n=>n>16900&&n<17180),
        'expected ~17030 CPU ticks, found '+spacing.join(','));
});
test('full 28 KiB PSID can stage at $2000, but not one byte higher',()=>{
    const capacity=28*1024;
    const big=fixture({payloadLength:capacity-0x7C,load:0x1000,play:0x1006});
    assert.equal(big.length,capacity);
    const p=build.prepare(big,{stage:0x2000});
    assert.equal(p.stage+p.bytes.length,0x9000);
    assert.equal(p.payloadLength,capacity-0x7C);
    assert.throws(()=>build.prepare(big,{stage:0x2001}),
        e=>e.code==='STAGING_RANGE');
});

test('native player rejects corrupted staged RAM before installing original executable',()=>{
    const r=simulate(original,{stage:0x6000,corruptTransfer:true});
    assert.equal(r.mem[r.player.symbols.ERRORCD],3);
    assert.equal(r.hasCopyCheck,false,'bad staged bytes must never be executed');
    assert.deepEqual(Array.from(r.mem.subarray(0,256)),Array.from(r.zp),
        'ZP must be restored on checksum failure');
    assert.equal(r.writes.length,0,'corrupted file cannot write to SID registers');
});

test('PSID version-specific timing bits and SID model flags are interpreted correctly',()=>{
    const v1=fixture({version:1,songs:34,speed:1});
    assert.throws(()=>build.parsePSID(v1,{subtune:33}),e=>e.code==='CIA_TIMING');
    const v2=fixture({version:2,songs:34,speed:1});
    assert.equal(build.parsePSID(v2,{subtune:33}).selectedSong,33);
    const chip=fixture();chip.writeUInt16BE(0x14,0x76); // PAL + 6581
    assert.equal(build.parsePSID(chip).preferredSIDModel,6581);
    chip.writeUInt16BE(0x24,0x76); // PAL + 8580
    assert.equal(build.parsePSID(chip).preferredSIDModel,8580);
});
