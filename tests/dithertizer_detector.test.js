'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname,'..');
const READ_CYCLES = 8;
const MAX_WAIT_READS = 4096;
const LONG_LOW_CONFIRM_READS = 3;
const MAX_SHORT_LOW_EXTRA_READS = 2;
const MAX_SIGNATURE_RESTARTS = 16;
const REQUIRED_SIGNATURES = 2;

function loadDithertizer()
{
    const source=fs.readFileSync(path.join(ROOT,'res','EMU_CARD_dithertizer.js'),'utf8');
    const sandbox={console,Uint8Array,ArrayBuffer,Array,Number,String,Object,Math,RegExp};
    vm.createContext(sandbox);
    vm.runInContext(source+'\n;this.__ctor=DithertizerII;',sandbox,{filename:'EMU_CARD_dithertizer.js'});
    return sandbox.__ctor;
}

class SevenSlotBus
{
    constructor()
    {
        this.slots=new Array(8).fill(null);
        this.ticks=0;
        this.readLog=[];
    }

    mount(slot,device)
    {
        assert.ok(Number.isInteger(slot) && slot>=1 && slot<=7,'slot must be 1..7');
        this.slots[slot]=device;
        return device;
    }

    read(slot,offset)
    {
        assert.ok(Number.isInteger(slot) && slot>=1 && slot<=7,'slot must be 1..7');
        offset=Number(offset)&0x0F;

        const ticks=this.ticks;
        const address=0xC080+(slot<<4)+offset;
        const device=this.slots[slot];

        let value=0x00; // RetroAppleJS empty SlotIO filler returns zero.
        if(device && typeof device.readSlotIO==='function')
        {
            value=device.readSlotIO(offset,{
                bRO:true,
                io:{getClockTicks(){return ticks;}}
            });
        }

        value=(Number(value)||0)&0xFF;
        this.readLog.push({slot,offset,address,ticks,value});
        this.ticks+=READ_CYCLES;
        return value;
    }
}

function d7(bus,slot)
{
    return (bus.read(slot,0x00)&0x80)!==0;
}

function waitForLevel(bus,slot,high,maxReads=MAX_WAIT_READS)
{
    for(let i=0;i<maxReads;i++)
        if(d7(bus,slot)===high)
            return true;
    return false;
}

function probeOneSignature(bus,slot)
{
    for(let restart=0;restart<MAX_SIGNATURE_RESTARTS;restart++)
    {
        // Find a LOW interval.
        if(!waitForLevel(bus,slot,false))
            return false;

        // DSCAN requires the LOW state to persist for three further reads.
        let longLow=true;
        for(let i=0;i<LONG_LOW_CONFIRM_READS;i++)
        {
            if(d7(bus,slot))
            {
                longLow=false;
                break;
            }
        }
        if(!longLow)
            continue;

        // Find the following HIGH state and then the next LOW transition.
        if(!waitForLevel(bus,slot,true))
            return false;
        if(!waitForLevel(bus,slot,false))
            return false;

        /*
         * The second LOW interval must be short.  After the first LOW sample
         * has already been consumed above, DSCAN tolerates at most one more
         * LOW read; a second additional LOW read causes a restart.
         */
        for(let i=0;i<MAX_SHORT_LOW_EXTRA_READS;i++)
        {
            if(d7(bus,slot))
                return true;
        }
    }

    return false;
}

function matchesDithertizer(bus,slot)
{
    for(let i=0;i<REQUIRED_SIGNATURES;i++)
        if(!probeOneSignature(bus,slot))
            return false;
    return true;
}

function detectDithertizer(bus)
{
    for(let slot=1;slot<=7;slot++)
        if(matchesDithertizer(bus,slot))
            return slot;
    return 0;
}

function waveformDevice(fn)
{
    return {
        readSlotIO(offset,ctx)
        {
            assert.equal(offset&0x0F,0,'passive detector must only read offset $0');
            return fn(Number(ctx.io.getClockTicks())||0) ? 0x80 : 0x00;
        }
    };
}

function deterministicNoiseDevice()
{
    const bits=[0,1,0,0,1,1,0,1,0,1,1,0,0,1,0,1];
    let readN=0;
    return {
        readSlotIO(offset)
        {
            assert.equal(offset&0x0F,0);
            return bits[(readN++)%bits.length] ? 0x80 : 0x00;
        }
    };
}

function oneShotSignatureDevice()
{
    return waveformDevice(ticks => {
        if(ticks<64) return false;
        if(ticks<96) return true;
        if(ticks<102) return false;
        return true;
    });
}

function slotVisitOrder(readLog)
{
    const order=[];
    let previous=null;

    for(const entry of readLog)
    {
        if(entry.slot!==previous)
        {
            order.push(entry.slot);
            previous=entry.slot;
        }
    }

    return order;
}

test('real DithertizerII is detected in each Apple II slot 1 through 7',()=>{
    const DithertizerII=loadDithertizer();

    for(let expectedSlot=1;expectedSlot<=7;expectedSlot++)
    {
        const bus=new SevenSlotBus();
        const card=bus.mount(expectedSlot,new DithertizerII());

        assert.equal(detectDithertizer(bus),expectedSlot,'failed to identify real DITHER in slot '+expectedSlot);
        assert.equal(card.id.PCODE,'DITHER');
        assert.equal(card.state.captureEnabled,false,'passive detection must not start capture');
    }
});

test('seven empty slots do not identify as a Dithertizer II',()=>{
    const bus=new SevenSlotBus();
    assert.equal(detectDithertizer(bus),0);
});

test('slot scan order is ascending and stops at the first detected Dithertizer',()=>{
    const DithertizerII=loadDithertizer();

    const emptyBus=new SevenSlotBus();
    assert.equal(detectDithertizer(emptyBus),0);
    assert.deepEqual(slotVisitOrder(emptyBus.readLog),[1,2,3,4,5,6,7],
        'a complete passive scan must visit slots strictly from 1 through 7');

    const earlyHitBus=new SevenSlotBus();
    earlyHitBus.mount(3,new DithertizerII());
    earlyHitBus.mount(6,new DithertizerII());

    assert.equal(detectDithertizer(earlyHitBus),3,'the lowest-numbered matching slot must win');
    assert.deepEqual(slotVisitOrder(earlyHitBus.readLog),[1,2,3],
        'scan must stop immediately after the first matching slot');
    assert.equal(earlyHitBus.readLog.some(entry=>entry.slot>3),false,
        'slots above the first detected Dithertizer must never be probed');
});

test('static and lookalike D7 waveforms are rejected',()=>{
    const fixtures=[
        ['always high',waveformDevice(()=>true)],
        ['always low',waveformDevice(()=>false)],
        ['64-cycle square wave',waveformDevice(ticks => (ticks%128)>=64)],
        ['long low then high without short pulse',waveformDevice(ticks => ticks>=64)],
        ['second low pulse is too long',waveformDevice(ticks => {
            const phase=ticks%256;
            if(phase<64) return false;
            if(phase<96) return true;
            if(phase<136) return false;
            return true;
        })],
        ['deterministic pseudo-noise',deterministicNoiseDevice()]
    ];

    for(const [name,device] of fixtures)
    {
        const bus=new SevenSlotBus();
        bus.mount(3,device);
        assert.equal(detectDithertizer(bus),0,name+' must not false-positive');
    }
});

test('one correct pulse signature is insufficient because detection requires two',()=>{
    const bus=new SevenSlotBus();
    bus.mount(1,oneShotSignatureDevice());
    assert.equal(detectDithertizer(bus),0);
});

test('scanner rejects a one-shot decoy and still finds a real Dithertizer later',()=>{
    const DithertizerII=loadDithertizer();
    const bus=new SevenSlotBus();
    bus.mount(2,oneShotSignatureDevice());
    bus.mount(5,new DithertizerII());

    assert.equal(detectDithertizer(bus),5);
});

test('passive seven-slot scan reads only $C0n0 and never offset $8',()=>{
    const DithertizerII=loadDithertizer();
    const bus=new SevenSlotBus();
    bus.mount(7,new DithertizerII());

    assert.equal(detectDithertizer(bus),7);
    assert.ok(bus.readLog.length>0);
    assert.ok(bus.readLog.every(entry=>entry.offset===0x00),'detector touched a non-zero slot register');
    assert.ok(bus.readLog.every(entry=>(entry.address&0x0F)===0x00),'detector touched a non-$C0n0 address');
    assert.equal(bus.readLog.some(entry=>entry.offset===0x08),false,'capture-enable offset $8 must never be read');

    const touched=[...new Set(bus.readLog.map(entry=>entry.address))].sort((a,b)=>a-b);
    assert.deepEqual(touched,[0xC090,0xC0A0,0xC0B0,0xC0C0,0xC0D0,0xC0E0,0xC0F0]);
});
