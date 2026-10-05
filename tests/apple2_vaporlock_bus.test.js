'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Real CPU, bus, I/O dispatcher, motherboard and game device. Only the host
// drawing/audio/DOM boundary is absent. This is not a STEP TRACE scenario.
function machine()
{
    const video = {
        state:{gfx:false,mix:false,page2:false,hires:false},
        write(){}, reset(){}, cycle(){},
        setGfx(v){this.state.gfx=v;}, setMix(v){this.state.mix=v;},
        setPage2(v){this.state.page2=v;}, setHires(v){this.state.hires=v;}
    };
    const ctx = {
        console:{log(){},warn(){},error(){},assert:assert.ok,group(){},groupEnd(){},table(){}}, performance, TextEncoder,
        oEMU:{system:{},component:{IO:{ACTION_MAP:{RD:[],WR:[]}},CPU:{}}},
        oEMUI:{}, _CFG_IOADDR:{}, _CFG_IORANGES:{},
        _o:{CPU_ClocksTicks_s:1021800,CPU_TargetTicks_s:1021800,EMU_Updates_s:10},
        oCOM:{crc16(){return 1;},trim(s){return s.trim();},getHexWord(v){return v.toString(16);},
            default(o){return o;},bRefreshEvent:false},
        apple2Rom:new Uint8Array(0x3000),
        Apple2VideoMUX:function(){return video;}
    };
    vm.createContext(ctx);
    for(const file of ['EMU_apple2io.js','EMU_apple2hw.js','EMU_cpu6502.js',
                      'EMU_CARD_hostio.js','EMU_DEVICE_gameport.js','EMU_DEVICE_keyboard.js',
                      'EMU_DEVICE_speaker.js','EMU_apple2plus.js'])
        vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res',file),'utf8'),ctx,{filename:file});
    const system = new ctx.Apple2Plus({});
    ctx.apple2plus = system;
    const hw = system.hwObj();
    hw.mount();
    const board = new ctx.AppleBoard();
    hw.io.provisionPeripheral(board,'A2P');
    const game = board.devices.find(d=>d.id.DCODE==='A2GAM');
    return {ctx,system,hw,video,game,board,cpu:system.cpuObj(),map:ctx.oEMU.component.IO.ACTION_MAP};
}

function put(hw,addr,bytes)
{
    bytes.forEach((value,i)=>hw.WR[hw.lineDecode(addr+i)](addr+i,value));
}

test('NTSC scanner repeats the H-preset address and covers both blanking intervals', () => {
    const {hw} = machine();
    assert.equal(typeof hw.getScannerAddress,'function');
    // Literal fixtures: row 0, column 0 is $0400; blanking fetches have A12
    // set on II/II+, with $1468 repeated at the horizontal preset.
    for(const [tick,line,h,address] of [
        [0,0,0,0x1468],[1,0,1,0x1468],[24,0,24,0x147F],
        [25,0,25,0x0400],[64,0,64,0x0427],[65,1,0,0x1468],
        [191*65+64,191,64,0x07F7],[192*65+25,192,25,0x0478],
        [256*65+25,256,25,0x07F8],[261*65+64,261,64,0x079F],
        [17030,0,0,0x1468]
    ])
    {
        const p=hw.getVideoPosition(tick);
        assert.equal(p.line,line); assert.equal(p.hcycle,h);
        assert.equal(hw.getScannerAddress(tick),address,`tick ${tick}`);
        assert.equal(p.hblank,h<25); assert.equal(p.vblank,line>=192);
    }
    assert.equal(hw.getVideoPosition(25).x,0);
    assert.equal(hw.getVideoPosition(64).x,273);
    assert.equal(hw.getVideoPosition(-1).frameCycle,17029);
    assert.equal(hw.getScannerState(256*65).vState,0xFA);
    assert.equal(hw.getScannerState(0).hState,hw.getScannerState(1).hState);
});

test('scanner chooses physical RAM by video mode, page, mixed gate and vertical preset', () => {
    const {hw} = machine();
    hw.RD[0xC](0xC055);
    assert.equal(typeof hw.getScannerAddress,'function');
    assert.equal(hw.getScannerAddress(25),0x0800);
    assert.equal(hw.getScannerAddress(0),0x1868);
    hw.RD[0xC](0xC054); hw.RD[0xC](0xC050); hw.RD[0xC](0xC057);
    assert.equal(hw.getScannerAddress(25),0x2000);
    assert.equal(hw.getScannerAddress(65+25),0x2400);
    assert.equal(hw.getScannerAddress(191*65+64),0x3FF7);
    assert.equal(hw.getScannerAddress(256*65+25),0x2BF8);
    assert.equal(hw.getScannerAddress(0),0x2068);
    hw.RD[0xC](0xC055);
    assert.equal(hw.getScannerAddress(25),0x4000);
    hw.RD[0xC](0xC053);
    assert.equal(hw.getScannerAddress(160*65+25),0x0A50);
    // MIXED is a counter-bit gate, not a clamp to the displayed 160..191 rows.
    assert.equal(hw.getScannerAddress(256*65+25),0x0BF8);
});

test('unmapped reads float, explicit zero and slot ROM remain driven', () => {
    const {hw,map} = machine();
    put(hw,0x1468,[0xA5]);
    assert.equal(hw.RD[0xC](0xC020),0xA5);
    assert.equal(hw.RD[0xC](0xC090),0xA5);
    assert.equal(hw.RD[0xC](0xC800),0xA5);
    map.RD[0x200]=()=>0;
    map.RD[0x300]=()=>0x42;
    assert.equal(hw.RD[0xC](0xC200),0);
    assert.equal(hw.RD[0xC](0xC300),0x42);
    map.RD[0x400]=()=>hw.FLOATING_BUS;
    assert.equal(hw.RD[0xC](0xC400),0xA5);
    map.RD[0x500]=()=>({value:0x80,mask:0x80});
    assert.equal(hw.RD[0xC](0xC500),0xA5);
    // CPU mapping overrides must also be resolved without bypassing the map.
    hw.RD[0xD]=()=>hw.FLOATING_BUS;
    assert.equal(hw.read(0xD000),0xA5);
});

test('game inputs drive only D7, mirror at $C068 and sample timers at the effective read cycle', () => {
    const {hw,game} = machine();
    put(hw,0x1468,[0x35]);
    game.state.switches[0]=true;
    assert.equal(hw.RD[0xC](0xC061),0xB5);
    assert.equal(hw.RD[0xC](0xC069),0xB5);
    game.state.switches[0]=false;
    assert.equal(hw.RD[0xC](0xC061),0x35);
    game.state.paddles[0]=1;
    hw.write(0xC070,0,3);
    // Trigger at CPU clock 3, expires at clock 14 (one 11-cycle paddle step).
    assert.equal(hw.read(0xC064,13),0x80 | hw.peekFloatingBus(13));
    assert.equal(hw.read(0xC06C,14),hw.peekFloatingBus(14)&0x7F);
});

test('soft-switch reads float from the preceding video fetch and safe observation has no side effects', () => {
    const {hw,video} = machine();
    put(hw,0x1468,[0x25]); put(hw,0x1868,[0x72]);
    assert.equal(hw.RD[0xC](0xC055),0x25);
    assert.equal(video.state.page2,true);
    assert.equal(hw.RD[0xC](0xC020),0x72);
    hw.setBusMonitoring(true);
    hw.read(0xC020,3);
    const last=hw.getLastBusAccess();
    assert.equal(last.address,0xC020); assert.equal(last.cycleOffset,3);
    assert.equal(last.cpuTick,0); assert.equal(last.effectiveCpuTick,3);
    assert.equal(last.driven,false); assert.equal(last.mask,0);
    assert.equal(hw.safe_read(0xC054),0x72);
    hw.safe_dump(0xC050,0xC05F);
    hw.getVideoPosition(); hw.getScannerState(); hw.peekFloatingBus();
    assert.equal(video.state.page2,true);
    assert.deepEqual(hw.getLastBusAccess(),last);
    last.address=0;
    assert.equal(hw.getLastBusAccess().address,0xC020);
    assert.equal(hw.getCpuTicks(),0); assert.equal(hw.getVideoTicks(),0);
});

test('CPU absolute reads sample their final cycle, not the opcode fetch cycle', () => {
    for(const op of [0xAD,0xCD,0x2C,0x4D])
    {
        const {hw,cpu,system} = machine();
        put(hw,0x1468,[0x11,0x22,0x33]);
        put(hw,0x0200,[op,0x20,0xC0]);
        cpu.setState({pc:0x0200,a:0x33,p:0x20}); hw.setBusMonitoring(true);
        const result=system.runLiveCpuTicks(4);
        assert.equal(result.completedTicks,4);
        const last=hw.getLastBusAccess();
        assert.equal(last.cycleOffset,3); assert.equal(last.scannerAddress,0x146A);
        assert.equal(last.result,0x33); assert.equal(hw.getVideoTicks(),4);
        if(op===0xAD) assert.equal(cpu.watch().a,0x33);
        if(op===0xCD) assert.equal(cpu.watch().p&2,2);
    }
});

test('indirect,Y reads and page-cross dummy reads receive their actual offsets', () => {
    for(const opcode of [0xB1,0xD1,0x51,0xF1])
    for(const [ptr,y,ticks,offset] of [[0xC020,0,5,4],[0xBFFF,0x21,6,5]])
    {
        const {hw,cpu,system,map}=machine();
        put(hw,0x0200,[opcode,0x42]); put(hw,0x42,[ptr&255,ptr>>8]);
        const reads=[];
        map.RD[0x20]=(_r,ctx)=>{reads.push([ctx.abs_addr,ctx.cycleOffset]);return hw.FLOATING_BUS;};
        cpu.setState({pc:0x0200,y}); hw.setBusMonitoring(true);
        system.runLiveCpuTicks(ticks);
        assert.deepEqual(reads,[[0xC020,offset]]);
        assert.equal(hw.getLastBusAccess().effectiveCpuTick,offset);
        assert.equal(cpu.watch().cycle_delay,0);
    }
    // A crossed read from C0FF,X first reads C000 (keyboard), then C100.
    const {hw,cpu,system,map}=machine();
    put(hw,0x0200,[0xBD,0xFF,0xC0]); const reads=[];
    map.RD[0]=(_r,ctx)=>{reads.push([ctx.abs_addr,ctx.cycleOffset]);return 0;};
    map.RD[0x100]=(_r,ctx)=>{reads.push([ctx.abs_addr,ctx.cycleOffset]);return 0x42;};
    cpu.setState({pc:0x0200,x:1}); system.runLiveCpuTicks(5);
    assert.deepEqual(reads,[[0xC000,3],[0xC100,4]]);
    assert.equal(cpu.watch().a,0x42);
});

test('stores and read-modify-write perform indexed dummy accesses at their bus cycles', () => {
    const {hw,cpu,system,map}=machine(); const accesses=[];
    map.RD[0x20]=(_r,ctx)=>{accesses.push(['R',ctx.cycleOffset]);return 0x12;};
    map.WR[0x20]=(_r,d,ctx)=>accesses.push(['W',ctx.cycleOffset,d]);
    put(hw,0x0200,[0x8D,0x20,0xC0]); cpu.setState({pc:0x0200,a:0x34});
    system.runLiveCpuTicks(4);
    assert.deepEqual(accesses,[['W',3,0x34]]);
    accesses.length=0;
    put(hw,0x0200,[0xEE,0x20,0xC0]); cpu.setState({pc:0x0200});
    system.runLiveCpuTicks(6);
    assert.deepEqual(accesses,[['R',3],['W',4,0x12],['W',5,0x13]]);
    accesses.length=0;
    put(hw,0x0200,[0x9D,0x1F,0xC0]); cpu.setState({pc:0x0200,x:1,a:0x34});
    system.runLiveCpuTicks(5);
    assert.deepEqual(accesses,[['R',3],['W',4,0x34]]);
    for(const [opcode,value] of [[0x1E,0x24],[0x3E,0x24],[0x5E,0x09],
                                [0x7E,0x09],[0xDE,0x11],[0xFE,0x13]])
    {
        accesses.length=0;
        put(hw,0x0200,[opcode,0x1F,0xC0]); cpu.setState({pc:0x0200,x:1,p:0x20});
        system.runLiveCpuTicks(7);
        assert.deepEqual(accesses,[['R',3],['R',4],['W',5,0x12],['W',6,value]]);
        assert.equal(cpu.watch().cycle_delay,0);
    }
});

test('live and SYSTEM timing share one clock, scaled JS ticks retain fraction and traps consume none', () => {
    const {hw,cpu,system,ctx}=machine();
    assert.equal(typeof hw.getVideoTicks,'function');
    put(hw,0x0200,[0xEA,0xEA,0xEA]); cpu.setState({pc:0x0200});
    system.runLiveCpuTicks(3,{videoScale:0.5});
    assert.equal(hw.getVideoTicks(),1.5); assert.equal(hw.getCpuTicks(),3);
    system.runLiveCpuTicks(1,{videoScale:0.5});
    assert.equal(hw.getVideoTicks(),2);
    cpu.setExecutionTrap(0x0202,()=>true);
    assert.equal(system.runLiveCpuTicks(1).completedTicks,0);
    assert.equal(hw.getVideoTicks(),2); assert.equal(hw.getCpuTicks(),4);
    ctx._o.CPU_TargetTicks_s=ctx._o.CPU_ClocksTicks_s*2;
    system.cycle(2);
    assert.equal(hw.getVideoTicks(),3); assert.equal(hw.getCpuTicks(),6);
    assert.equal(hw.io.getClockTicks(),6);
});

test('hardware restart realigns Apple2IO and CPU absolute clocks', () => {
    const {hw,system,ctx}=machine();

    system.runLiveCpuTicks(12345);
    assert.equal(hw.getCpuTicks(),12345);
    assert.equal(hw.io.getClockTicks(),12345);

    // Apple2Hw.restart() resets the hardware CPU epoch before io.restart().
    // Minimal restart configuration is sufficient for this timing invariant.
    ctx.slot_count=7;
    ctx.slotR={slotMap:{},slotFit:{}};
    ctx._CFG_PSLOT={};
    ctx.EMU_system_get=()=> 'A2P';

    hw.restart();
    assert.equal(hw.getCpuTicks(),0);
    assert.equal(hw.io.getClockTicks(),0);

    system.runLiveCpuTicks(7);
    assert.equal(hw.getCpuTicks(),7);
    assert.equal(hw.io.getClockTicks(),7);
});

test('hardware mode latches work with a renderer that exposes no state object', () => {
    const {hw,video}=machine();
    delete video.state;
    video.setGfx=video.setHires=video.setMix=video.setPage2=()=>{};
    hw.RD[0xC](0xC050); hw.RD[0xC](0xC057); hw.RD[0xC](0xC055);
    assert.equal(hw.getScannerAddress(25),0x4000);
});

test('safe CPU map reads resolve a floating result while suppressing diagnostics', () => {
    const {hw}=machine();
    put(hw,0x1468,[0x2A]); hw.RD[0xD]=()=>hw.FLOATING_BUS;
    hw.setBusMonitoring(true);
    assert.equal(hw.safe_read(0xD000),0x2A);
    assert.equal(hw.safe_dump(0xD000,0xD000)[0],0x2A);
    assert.equal(hw.getLastBusAccess(),null);
});

test('keyboard remains driven while strobe, speaker and paddle-trigger reads float', () => {
    const {hw,board}=machine();
    const keyboard=board.devices.find(d=>d.id.DCODE==='A2KBD');
    put(hw,0x1468,[0x25]);
    keyboard.lastkey=0xC1;
    assert.equal(hw.RD[0xC](0xC000),0xC1);
    assert.equal(hw.safe_read(0xC010),0x25);
    assert.equal(keyboard.lastkey,0xC1);
    assert.equal(hw.RD[0xC](0xC010),0x25);
    assert.equal(keyboard.lastkey,0x41);
    assert.equal(hw.RD[0xC](0xC030),0x25);
    assert.equal(hw.RD[0xC](0xC070),0x25);
});

test('fractional JS video clocks do not lose a whole cycle at batch boundaries', () => {
    const {hw,cpu,system}=machine();
    put(hw,0x0200,[0x4C,0x00,0x02]); cpu.setState({pc:0x0200});
    for(let i=0;i<5;i++) system.runLiveCpuTicks(1,{videoScale:1/3});
    assert.equal(hw.getVideoPosition(1).frameCycle,2);
    system.runLiveCpuTicks(1,{videoScale:1/3});
    assert.equal(hw.getVideoTicks(),2);
    assert.equal(hw.getVideoPosition().frameCycle,2);
    system.runLiveCpuTicks(1,{videoScale:0.5});
    assert.equal(hw.getVideoTicks(),2.5);
});

test('JSR fetches its high operand after stack writes, at offset five', () => {
    const {hw,cpu,system}=machine(); const accesses=[];
    const rd=hw.read.bind(hw), wr=hw.write.bind(hw);
    hw.read=(addr,offset)=>{accesses.push(['R',addr,offset]);return rd(addr,offset);};
    hw.write=(addr,value,offset)=>{accesses.push(['W',addr,offset]);return wr(addr,value,offset);};
    put(hw,0x0200,[0x20,0x00,0x03]); cpu.setState({pc:0x0200,sp:0xFF});
    cpu.setBootLogTrigger(0x0200,null,true);
    system.runLiveCpuTicks(6);
    const significant=accesses.filter(a=>a[0]==='W' || a[1]===0x0202);
    assert.deepEqual(significant,[['W',0x01FF,3],['W',0x01FE,4],['R',0x0202,5]]);
    assert.equal(cpu.watch().pc,0x0300);
    assert.equal(hw.safe_read(0x01FF),0x02); assert.equal(hw.safe_read(0x01FE),0x02);
    assert.equal(cpu.getBootLog()[0].sp,0xFF);
    assert.deepEqual(Array.from(cpu.getBootLog()[0].bytes),[0x20,0x00,0x03]);
});

test('indexed addresses and zero-page pointers wrap through the real CPU bus', () => {
    const {hw,cpu,system}=machine();
    put(hw,0,[0x73]); put(hw,0x0200,[0xBD,0xFF,0xFF]);
    cpu.setState({pc:0x0200,x:1}); system.runLiveCpuTicks(5);
    assert.equal(cpu.watch().a,0x73); assert.equal(cpu.watch().cycle_delay,0);
    put(hw,0,[0xC0]); put(hw,0xFF,[0x20]); put(hw,0x0200,[0xB1,0xFF]);
    cpu.setState({pc:0x0200,y:0}); hw.setBusMonitoring(true);
    system.runLiveCpuTicks(5);
    assert.equal(hw.getLastBusAccess().address,0xC020);
    assert.equal(hw.getLastBusAccess().cycleOffset,4);
});

test('audio backpressure yields normal execution and leaves debugger stepping available',()=>{
    const {system,hw}=machine();
    assert.equal(typeof hw.io.limitCpuSliceTicks,'function','IO must combine device audio budgets');
    let budget=0;
    hw.io.attachments.audioBudget={device:{getCpuSliceBudget(n){return Math.max(0,Math.min(n,budget-(hw.io.getClockTicks()-before)));},isCycleActive(){return true;}}};
    hw.io.refreshDeviceHooks();
    const before=hw.io.getClockTicks();
    system.cycle(1000);
    assert.equal(hw.io.getClockTicks(),before);
    budget=10;
    system.cycle(1000);
    assert.equal(hw.io.getClockTicks(),before+10);
});

test('live instruction stepping explicitly pauses presentation while SYSTEM execution resumes it',()=>{const {hw,system}=machine();const changes=[];hw.io.attachments.presentationProbe={device:{setPresentationPaused(v){changes.push(v);}}};hw.io.refreshDeviceHooks();assert.ok(hw.io.setAudioPresentationPaused);system.stepLiveInstruction();assert.equal(changes.at(-1),true);system.cycle(10);assert.equal(changes.at(-1),false);});
