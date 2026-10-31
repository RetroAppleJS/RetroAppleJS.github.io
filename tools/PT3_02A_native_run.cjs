#!/usr/bin/env node
// PT3-02A: execute original 6502 PT3 player through RetroAppleJS's real
// Cpu6502, MockingboardR6522 and MockingboardAYBus implementations.
// No host-side PT3 decoding or direct AY writes.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const out = process.argv[2] || path.join(root, 'build/pt3_02a');
const player = fs.readFileSync(path.join(out, 'PT3_02A_PLAYER.bin'));
const tune = fs.readFileSync(path.join(out, 'PT3_02A_ORIGINAL.pt3'));
const CYCLES_PER_SECOND = 1021800;
const DURATION_CYCLES = CYCLES_PER_SECOND * 3;
const T1_LATCH = 0x4fe7;
const T1_PERIOD = T1_LATCH + 2;
const ram = new Uint8Array(65536);
const events = [];
const raised = [];
let cpuTick = 0;
let interrupts = 0;

const ctx = vm.createContext({console, oEMU:{component:{CPU:{},IO:{}}}});
const cpuSource = fs.readFileSync(path.join(root, 'res/EMU_cpu6502.js'),'utf8');
vm.runInContext(cpuSource, ctx, {filename:'res/EMU_cpu6502.js'});
const cardSource = fs.readFileSync(path.join(root,'res/EMU_CARD_mockingboard.js'),'utf8');
const begin = cardSource.indexOf('function MockingboardR6522(');
const end = cardSource.indexOf('function MockingboardHistory(', begin);
assert.ok(begin !== -1 && end > begin, 'Real 6522 and AY bus core functions not found');
vm.runInContext(cardSource.slice(begin, end),ctx,{filename:'res/EMU_CARD_mockingboard.js VIA/AY core'});
const Cpu6502 = ctx.Cpu6502;
const VIA = ctx.MockingboardR6522;
const AYBus = ctx.MockingboardAYBus;
const buses = [0,1].map(ay=>new AYBus(null,{
    name:'AY'+ay,
    onRegisterWrite:(reg,value,tick)=>events.push({tick,ay,reg,value}),
    onReset:tick=>events.push({tick,ay,reg:-1,value:0})
}));
const vias = [];
const syncing = [false,false];
const hw = {irq_signal:0,nmi_signal:0,read,write};
function syncBus(i) {
    if (syncing[i]) return;
    syncing[i] = true;
    const via = vias[i], bus = buses[i];
    const driven = bus.observeViaPins(via.paPins, via.pbPins, cpuTick);
    via.setPortAInput(driven === null ? 0xff : driven, 0xff);
    syncing[i] = false;
}
function irqUpdate() {
    const next = !!(vias[0]?.irqLevel || vias[1]?.irqLevel);
    if (next && !hw.irq_signal) {raised.push(cpuTick); interrupts++;}
    hw.irq_signal = next ? 1 : 0;
}
for (let i=0; i<2; i++) vias[i] = new VIA({
    name:'VIA'+i,
    onPortAChange:()=>syncBus(i),
    onPortBChange:()=>syncBus(i),
    onIrqChange:()=>irqUpdate()
});
function viaDecode(addr) {
    if (addr < 0xc400 || addr > 0xc4ff) return null;
    const off=addr&255;
    if (off<=15) return {index:0,reg:off};
    if (off>=0x80 && off<=0x8f) return {index:1,reg:off&15};
    return null;
}
function read(addr) {
    addr&=0xffff;
    const d=viaDecode(addr);
    return d ? vias[d.index].readRegister(d.reg) : ram[addr];
}
function write(addr,value) {
    addr&=0xffff;
    const d=viaDecode(addr);
    if (d) vias[d.index].writeRegister(d.reg,value);
    else if (addr<0xc000) ram[addr]=value&255;
}
assert.ok(player.length<=4096 && tune.length<=4096,'Memory region overflow');
ram.set(player,0x6000);ram.set(tune,0x8000);
// Minimal Apple II+/IIe Monitor IRQ bridge: ROM saves interrupted A at $45
// and dispatches via the genuine software IRQ vector $03FE. The upstream
// interrupt_handler.s supplies register save/restore and RTI.
// The full Monitor ROM is NOT modeled; only the IRQ dispatch contract is.
ram[0xfffe]=0x00;ram[0xffff]=0xff;
ram.set([0x85,0x45,0x6c,0xfe,0x03],0xff00); // STA $45 ; JMP ($03FE)
ram[0x03fe]=0x40;ram[0x03ff]=0xff;
ram[0xff40]=0x40; // unused prior vector: RTI
ram[0xfffc]=0x00;ram[0xfffd]=0x60;
const cpu=new Cpu6502(hw);
cpu.reset();
function cycle() {
    cpu.cycle();
    cpuTick++;
    vias[0].tick(1);
    vias[1].tick(1);
}
function advanceTo(target) { while(cpuTick<target) cycle(); }
advanceTo(DURATION_CYCLES);
const fgProgress=ram[0x7000];
const hgrProgress=ram[0x2000];
assert.ok(interrupts>100 && interrupts<170,
    'Expected about 150 native T1 IRQs in three seconds, got '+interrupts);
assert.ok(fgProgress !== 0 && hgrProgress !== 0,
    'Foreground loop not progressing during music');
const ay0=events.filter(e=>e.ay===0&&e.reg>=0);
const ay1=events.filter(e=>e.ay===1&&e.reg>=0);
assert.ok(ay0.length>100,'Native 6502 did not program AY0 (observed '+ay0.length+')');
assert.equal(ay0.length,ay1.length,'Mirrored AY registers have different counts');
for(let i=0;i<ay0.length;i++) {
    assert.equal(ay0[i].reg,ay1[i].reg,'AY mirror register mismatch '+i);
    assert.equal(ay0[i].value,ay1[i].value,'AY mirror value mismatch '+i);
}
assert.ok(new Set(ay0.filter(e=>e.reg===0).map(e=>e.value)).size>2,
    'No changing tone periods from PT3 decode');
const nonZeroAmpWrites=ay0.filter(e=>e.reg>=8&&e.reg<=10&&(e.value&15)>0).length;
const toneEnableWrites=ay0.filter(e=>e.reg===7&&(e.value&7)!==7).length;
assert.ok(nonZeroAmpWrites>30,
    'Decoded PT3 is silent: no nonzero AY amplitude programming');
assert.ok(toneEnableWrites>30,
    'Decoded PT3 has no enabled tone channels');
const intervals=raised.slice(1).map((t,i)=>t-raised[i]);
assert.ok(intervals.every(n=>n===T1_PERIOD),
    'Unstable VIA Timer1 period: '+[...new Set(intervals)]);
const writesDuringMusic=events.length;
// Redirect execution to explicit cleanup entry, preserving CPU state.
cpu.setState({...cpu.watch(),pc:0x6003,cycle_delay:0});
for(let i=0;i<6000;i++) cycle();
assert.equal(ram[0x7006],0xa5,'Native PT3 stop did not complete');
assert.equal(ram[0x03fe],0x40,'Soft IRQ low vector not restored');
assert.equal(ram[0x03ff],0xff,'Soft IRQ high vector not restored');
assert.equal(hw.irq_signal,0,'VIA IRQ line remains asserted after stop');
const finalWrites=events.length;
for(let i=0;i<100000;i++) cycle();
assert.equal(events.length,finalWrites,'AY register writes continue after shutdown');
assert.equal(hw.irq_signal,0,'VIA IRQ reasserted after shutdown');

const report={
    format:'retroapplejs.pt3-02a.native.6502.v1',
    status:'PASS',
    core:'RetroAppleJS Cpu6502 + MockingboardR6522 + MockingboardAYBus',
    peripheralIntegration:'Actual VIA and AY bus cores; standalone deterministic CPU bus harness',
    cpuClockHz:CYCLES_PER_SECOND,
    playerLoad:0x6000,playerBytes:player.length,
    songLoad:0x8000,songBytes:tune.length,
    measuredCycles:DURATION_CYCLES,timerLatch:T1_LATCH,timerPeriodCycles:T1_PERIOD,
    irqCount:interrupts,
    firstIRQCycle:raised[0],
    lastIRQCycle:raised.at(-1),
    foregroundCounter:fgProgress,
    hgrByte: hgrProgress,
    ayWrites:[ay0.length,ay1.length],
    nonZeroAmpWrites,toneEnableWrites,
    totalWritesDuringPlayback:writesDuringMusic,
    stopSuccess:true,
    notes:'No browser AudioContext, full Apple II Monitor ROM, or native HGR rasterization; those remain integration checks.'
};
fs.writeFileSync(path.join(out,'PT3_02A_native_results.json'),
    JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
