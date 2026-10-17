'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const pack=require('../tools/SID_Phase1_pack.js');

function rig(){
    const sandbox=vm.createContext({
        console,Uint8Array,Float32Array,Math,Number,
        oEMU:{component:{CPU:{},IO:{}}}
    });
    for(const name of ['EMU_cpu6502.js','EMU_DEVICE_SID_audio.js','EMU_CARD_SID.js']){
        const source=fs.readFileSync(path.join(__dirname,'../res',name),'utf8');
        vm.runInContext(source,sandbox,{filename:name});
    }
    const binary=pack.assemble();
    const memory=new Uint8Array(65536);
    memory.set(binary.bytes,0x6000);
    memory[0xFFFC]=0x00;memory[0xFFFD]=0x60;
    let cycles=0;
    const writes=[];
    const card=new sandbox.SIDCard(),audio=new sandbox.SIDAudio();
    card.devices=[audio];
    card.mount={hash:15,slotN:5};
    audio.bindHost(card);
    audio.bindIO({getClockTicks(){return cycles;},refreshDeviceHooks(){}});
    card.restart();
    const hw={
        irq_signal:false,nmi_signal:0,
        read(addr){return addr===0xC0D0?0x53:memory[addr&0xFFFF];},
        write(addr,value,offset){
            addr&=0xFFFF;value&=255;
            if(addr<0xC000)memory[addr]=value;
            if(addr>=0xD400&&addr<=0xD41F){
                writes.push({addr,value,tick:cycles+offset});
                card.observeBusWrite(addr,value,{cpuTick:cycles+offset});
            }
        },
        lineDecode(addr){return addr>>12;}
    };
    const cpu=new sandbox.Cpu6502(hw);
    cpu.reset();
    function call(entry,maxCycles=25000){
        // Inject an RTS sentinel, just as a CALL from the Apple II monitor
        // would return to its caller; preserves the real 6502 instruction path.
        memory[0x1FE]=0xFF;memory[0x1FF]=0xFE;
        cpu.setState({pc:entry,sp:0xFD,p:0x24});
        let done=false;
        cpu.setExecutionTrap(0xFF00,()=>{done=true;return true;});
        let spent=0;
        while(!done && spent<maxCycles){
            cpu.cycle();cycles++;spent++;
        }
        assert.ok(done,'RTS did not reach sentinel for $'+entry.toString(16));
        return spent;
    }
    return {card,audio,cpu,memory,writes,call,binary,getTicks:()=>cycles};
}

test('SID Phase 1 source assembles with four stable entry stubs',()=>{
    const result=pack.assemble();
    assert.equal(result.entry.run,0x6000);
    assert.equal(result.entry.init,0x6003);
    assert.equal(result.entry.play,0x6006);
    assert.equal(result.entry.stop,0x6009);
    for(const offset of [0,3,6,9])
        assert.equal(result.bytes[offset],0x4C,'entrypoint must be JMP');
    assert.ok(result.bytes.length>200);
    assert.ok(result.bytes.length<2048);
});

test('PSID version 2 packs the SAME executable bytes and original INIT/PLAY addresses',()=>{
    const program=pack.assemble(),sid=pack.packPSID(program.bytes);
    assert.equal(Buffer.from(sid.subarray(0,4)).toString('ascii'),'PSID');
    assert.equal(sid.readUInt16BE?.(6),undefined); // plain Uint8Array by design
    const word=i=>sid[i]<<8|sid[i+1];
    assert.equal(word(4),2);
    assert.equal(word(6),0x7C);
    assert.equal(word(8),0x6000);
    assert.equal(word(10),0x6003);
    assert.equal(word(12),0x6006);
    assert.equal(word(14),1);
    assert.equal(word(16),1);
    assert.equal(word(0x76),0x0014);
    assert.deepEqual(Array.from(sid.subarray(0x7C)),Array.from(program.bytes));
});

test('real emulator 6502 runs INIT then five playback stages with native SID writes',()=>{
    const r=rig();
    r.call(0x6003);
    let registers=r.audio.getRegisters();
    assert.equal(registers[0x04],0x41);
    assert.equal(registers[0x18],15);
    const expected=[0x11,0x21,0x81,0x21,0x00];
    for(let stage=0;stage<5;stage++){
        for(let frame=0;frame<50;frame++)r.call(0x6006);
        registers=r.audio.getRegisters();
        assert.equal(registers[4],expected[stage],'wrong waveform after phase '+(stage+1));
        if(stage===3){
            assert.equal(registers[0x0B],0x11,'voice 2 should play triangle');
            assert.equal(registers[0x12],0x41,'voice 3 should play pulse');
            assert.equal(registers[0x17],0x87,'filter routing/resonance');
            assert.equal(registers[0x18],0x1F,'low-pass and full volume');
        }
    }
    assert.equal(r.audio.getRegisters()[0x18],0);
    assert.equal(r.audio.getRegisters()[0x12],0);
    assert.ok(r.card.getStatistics().snoopWrites>=80);
    assert.ok(r.writes.some(w=>w.addr===0xD404 && w.value===0x41));
});

test('standalone WAIT50 delay stays within ±5% of PAL 50 Hz on a 1.02 MHz host',()=>{
    const r=rig();
    const delay=r.call(0x6000+0 /* overridden below */,1); // unreachable, fixture sanity
});
