'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const build=require('../tools/SID_Phase2A_build.js');
const ROOT=path.resolve(__dirname,'..');

function setup({slot=4,frameLimit=12,corruptHeader=false,corruptPayload=false,withSID=true}={}){
    const driver=build.assemble(),sid=fs.readFileSync(build.PSID);
    build.validatePSID(sid);
    const mem=new Uint8Array(65536);
    mem.set(sid,0x6000);
    mem.set(driver.bytes,0x2000);
    if(corruptHeader)mem[0x6000]=0;
    if(corruptPayload)mem[0x6500]^=0x20; // valid header, corrupted body
    // Applesoft's zero page must be restored on normal exit.
    const originalZP=new Uint8Array(256);
    for(let i=0;i<256;i++)originalZP[i]=(i*73+11)&0xFF;
    mem.set(originalZP,0);
    mem[0x1FE]=0xFF;mem[0x1FF]=0xFE; // RTS sentinel -> $FF00
    let cpuTicks=0,frame=0,printed='',done=false;
    const frameTicks=[],sidWrites=[],unexpectedWrites=[];
    const context=vm.createContext({console,Uint8Array,Float32Array,Math,Number,
        oEMU:{component:{CPU:{},IO:{}}}});
    for(const name of ['EMU_cpu6502.js','EMU_DEVICE_SID_audio.js','EMU_CARD_SID.js']){
        vm.runInContext(fs.readFileSync(path.join(ROOT,'res',name),'utf8'),
            context,{filename:name});
    }
    const card=new context.SIDCard(),audio=new context.SIDAudio();
    card.devices=[audio];
    audio.bindHost(card);
    audio.bindIO({getClockTicks(){return cpuTicks},refreshDeviceHooks(){}});
    card.reset();
    const sidIOBase=0xC080+slot*16;
    const hw={
        irq_signal:0,nmi_signal:0,
        read(addr){
            if(addr>=0xC090&&addr<=0xC0F0&&(addr&15)===0)
                return withSID&&slot>=1&&slot<=7&&addr===sidIOBase?0x53:0xFF;
            if(withSID&&addr===sidIOBase+3)
                return card.readSlotIO(addr,{cpuTick:cpuTicks});
            if(addr===0xC000){
                frameTicks.push(cpuTicks);frame++;
                return frame>=frameLimit?0x80:0;
            }
            if(addr===0xC010)return 0;
            if(addr===0xFDED)return 0x60; // ROM COUT: RTS
            if(addr>=0xD000)return 0xEA; // motherboard ROM read (not SID shadow)
            return mem[addr&0xFFFF];
        },
        write(addr,value,cycleOffset){
            addr&=0xFFFF;value&=0xFF;
            if(addr<0xC000)mem[addr]=value;
            else if(withSID&&addr===sidIOBase+2)
                card.writeSlotIO(addr,value,{cpuTick:cpuTicks});
            else if(addr>=0xD400&&addr<=0xD41F){
                sidWrites.push({addr,value,frame,cpuTick:cpuTicks+(cycleOffset||0)});
                card.observeBusWrite(addr,value,{cpuTick:cpuTicks+(cycleOffset||0)});
            }else unexpectedWrites.push(addr);
        },
        lineDecode(addr){return addr>>12}
    };
    const cpu=new context.Cpu6502(hw);
    cpu.reset();
    cpu.setState({pc:0x2000,sp:0xFD,p:0x20,a:0,x:0,y:0});
    cpu.setExecutionTrap(0xFF00,()=>{done=true;return true});
    cpu.setExecutionCondition(s=>{printed+=String.fromCharCode(s.a&0x7F);return false},0xFDED);
    function run(limit=2000000){
        while(!done&&cpuTicks<limit){cpu.cycle();cpuTicks++;}
        assert.ok(done,'driver exceeded CPU tick limit (PC=$'+cpu.watch().pc.toString(16)+')');
        return {driver,sid,mem,cpu,card,audio,sidWrites,
                frameTicks,printed,frame,unexpectedWrites,cpuTicks,
                originalZP};
    }
    return {run,mem,driver};
}
function directSIDSequence(frameCount){
    const file=build.validatePSID(fs.readFileSync(build.PSID));
    const memory=new Uint8Array(65536);
    memory.set(file.data,file.load);
    memory[0x1FE]=0xFF;memory[0x1FF]=0xFE;
    let done=false;
    const writes=[];
    const ctx=vm.createContext({console,Uint8Array,oEMU:{component:{CPU:{}}}});
    vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_cpu6502.js'),'utf8'),
        ctx,{filename:'EMU_cpu6502.js'});
    const cpu=new ctx.Cpu6502({
        irq_signal:0,nmi_signal:0,
        read(addr){return addr>=0xD000?0xEA:memory[addr&0xFFFF];},
        write(addr,value){
            if(addr>=0xD400&&addr<=0xD41F)writes.push([addr,value&255]);
            else if(addr<0xC000)memory[addr]=value&255;
        },
        lineDecode:addr=>addr>>12
    });
    cpu.reset();
    function invoke(pc,a=0){
        memory[0x1FE]=0xFF;memory[0x1FF]=0xFE;
        cpu.setState({pc,sp:0xFD,p:0x24,a,x:0,y:0});
        done=false;
        cpu.setExecutionTrap(0xFF00,()=>{done=true;return true});
        let n=0;
        while(!done&&n<20000){cpu.cycle();n++;}
        assert.ok(done,'native PSID call failed at '+pc.toString(16));
    }
    invoke(file.init,4);
    for(let i=0;i<frameCount;i++)invoke(file.play);
    return writes;
}

test('original Mr Heli PSID metadata is validated and executable remains unmodified',()=>{
    const original=fs.readFileSync(build.PSID),info=build.validatePSID(original);
    assert.equal(original.length,4841);
    assert.equal(info.load,0x0CA0);
    assert.equal(info.init,0x1EF3);
    assert.equal(info.play,0x0E34);
    assert.equal(info.defaultSong,5);
    assert.equal(info.data.length,4715);
    assert.throws(()=>build.validatePSID(original.subarray(0,-1)),/Mr. Heli/);
    const modified=Buffer.from(original);
    modified[0x500]^=0x20;
    assert.throws(()=>build.validatePSID(modified),/checksum mismatch/);
    const program=build.assemble();
    assert.ok(program.bytes.length>300&&program.bytes.length<0x1000);
    assert.deepEqual([...program.bytes.subarray(0,12).filter((_,i)=>i%3===0)],
        [0x4C,0x4C,0x4C,0x4C]);
    assert.equal(program.symbols.START,0x2000);
    assert.equal(program.symbols.STOP,0x2003);
    assert.equal(program.symbols.RESTART,0x2006);
    assert.equal(program.symbols.STATUS,0x2009);
    const monitor=fs.readFileSync(path.join(ROOT,'asm/AUDIO/SID2MB_prototype/SID_PHASE2A_MR_HELI_monitor.txt'),'utf8');
    assert.equal(monitor,build.monitorText(program.bytes,0x2000),
        'checked-in monitor image must match latest assembled source');
});

test('Phase 2A runs original subtune 5 on actual RetroAppleJS CPU, then restores host ZP',()=>{
    const result=setup({slot:4,frameLimit:18}).run();
    const {mem,driver,originalZP,sidWrites,card,audio,cpu,unexpectedWrites}=result;
    assert.equal(mem[driver.symbols.ERRORCD],0);
    assert.equal(mem[driver.symbols.ACTIVE],0,'foreground loop should stop');
    assert.deepEqual(Array.from(mem.subarray(0,256)),Array.from(originalZP));
    assert.deepEqual(Array.from(mem.subarray(0x0CA0,0x1F0B)).length,4715);
    assert.equal(mem[0x0CA0],0);
    assert.equal(mem[0x0CA1],0xA9);
    assert.ok(sidWrites.length>300,'expected original SID writes');
    assert.equal(card.getStatistics().snoopWrites,sidWrites.length);
    assert.equal(audio.getRegisters()[0x18],0,'master volume muted on exit');
    assert.equal(cpu.watch().p&0x04,0,'original CPU interrupt mask restored');
    assert.deepEqual(unexpectedWrites,[]);
    const observed=sidWrites.slice(0,-4).map(w=>[w.addr,w.value]);
    assert.deepEqual(observed,directSIDSequence(18),'no remapping or SID write translation');
    assert.ok(audio.getAudioStats().produced>0,'SID audio render timeline advanced');
});

test('native Phase 2A music uses absolute 50 Hz CPU-clock deadlines in all slots',()=>{
    for(const slot of [1,4,7]){
        const r=setup({slot,frameLimit:101}).run(3500000);
        assert.equal(r.frame,101);
        const deltas=r.frameTicks.slice(1).map((t,i)=>t-r.frameTicks[i]);
        const total=r.frameTicks.at(-1)-r.frameTicks[0];
        // Individual calls vary in execution cost. Absolute CPU deadlines
        // eliminate long-term PLAY runtime accumulation and tempo drift.
        assert.ok(Math.abs(total-100*20436)<=140,
            '100 PLAY intervals must average 50Hz (slot '+slot+', drift '+(total-100*20436)+' CPU ticks)');
        assert.ok(deltas.every(n=>n>20150&&n<20720),
            'no >~0.3ms 6502 music-frame jitter: '+Math.min(...deltas)+' / '+Math.max(...deltas));
    }
});

test('bad PSID and missing SID never copy the payload or modify Applesoft zero page',()=>{
    for(const cfg of [{withSID:false,error:2},{corruptHeader:true,error:1},{corruptPayload:true,error:1}]){
        const f=setup(cfg),before=Array.from(f.mem.subarray(0,256));
        const r=f.run(160000);
        assert.equal(r.mem[r.driver.symbols.ERRORCD],cfg.error);
        assert.deepEqual(Array.from(r.mem.subarray(0,256)),before);
        assert.equal(r.mem[0x0CA0],0);
        assert.equal(r.sidWrites.length,0);
        assert.match(r.printed,/SID 2A ERROR/);
    }
});
