'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname,'..');

function loadCard()
{
    let pc=0x0000;
    const source=fs.readFileSync(path.join(ROOT,'res','EMU_CARD_dithertizer.js'),'utf8');
    const sandbox={
        console,
        Uint8Array,ArrayBuffer,Array,Number,String,Object,Math,RegExp,
        apple2plus:{cpuObj(){return {watch(){return {pc};}};}}
    };
    vm.createContext(sandbox);
    vm.runInContext(source+'\n;this.__ctor=DithertizerII;',sandbox,{filename:'EMU_CARD_dithertizer.js'});
    return {
        DithertizerII:sandbox.__ctor,
        setPC(value){pc=Number(value)&0xFFFF;}
    };
}

function ctxAt(ticks)
{
    return {
        bRO:false,
        io:{getClockTicks(){return ticks;}}
    };
}

test('DSCAN sync trace records only D7 transitions in $1D23-$1D35 with ticks, phase and pulse width',()=>{
    const {DithertizerII,setPC}=loadCard();
    const card=new DithertizerII();

    assert.equal(typeof card.setSyncTrace,'function');
    assert.equal(typeof card.getSyncTrace,'function');
    assert.equal(typeof card.clearSyncTrace,'function');

    card.setSyncTrace(true);

    setPC(0x1D2D);
    card.readSlotIO(0x00,ctxAt(0));       // LOW: first sample
    card.readSlotIO(0x00,ctxAt(16));      // LOW: no transition
    card.readSlotIO(0x00,ctxAt(64));      // HIGH: transition, 64 cycles

    setPC(0x1D35);
    card.readSlotIO(0x00,ctxAt(96));      // LOW: transition, 32 cycles
    card.readSlotIO(0x00,ctxAt(102));     // HIGH: transition, 6 cycles

    setPC(0x2000);
    card.readSlotIO(0x00,ctxAt(17030));   // outside DSCAN range: ignored

    const trace=card.getSyncTrace();
    assert.equal(trace.length,4);
    assert.deepEqual(Array.from(trace,e=>e.d7),[0,1,0,1]);
    assert.deepEqual(Array.from(trace,e=>e.phase),[0,64,96,102]);
    assert.deepEqual(Array.from(trace,e=>e.deltaTicks),[null,64,32,6]);
    assert.deepEqual(Array.from(trace,e=>e.pc),[0x1D2D,0x1D2D,0x1D35,0x1D35]);
    assert.ok(Array.from(trace).every(e=>Number.isInteger(e.clockTicks)));

    card.clearSyncTrace();
    assert.equal(card.getSyncTrace().length,0);
});

test('DSCAN sync trace is opt-in and ordinary card behavior is unchanged when disabled',()=>{
    const {DithertizerII,setPC}=loadCard();
    const card=new DithertizerII();
    setPC(0x1D2D);

    assert.equal(card.readSlotIO(0x00,ctxAt(0))&0x80,0x00);
    assert.equal(card.readSlotIO(0x00,ctxAt(64))&0x80,0x80);
    assert.equal(typeof card.getSyncTrace,'function');
    assert.equal(card.getSyncTrace().length,0);
});
