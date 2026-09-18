'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,'..','res','EMU_CARD_LIRON.js'),'utf8');

function loadLiron()
{
    const actionMap = {
         Hslot:null
        ,RD:new Array(0x1000)
        ,WR:new Array(0x1000)
    };

    const context = {
        console:{ log(){}, warn(){}, error(){} },
        oEMU:{ component:{ IO:{ ACTION_MAP:actionMap } } }
    };

    vm.createContext(context);
    vm.runInContext(source,context);

    return {context,actionMap};
}

function mount(card,physicalSlot)
{
    card.mount = {
         slotN:physicalSlot+1
        ,ranges:{ HostROM:{ from:0x800, to:0xFFF } }
    };
    return card;
}

test('AppleLiron exposes the RetroAppleJS card surface and an empty SmartPort chain', () => {
    const {context} = loadLiron();
    const card = new context.AppleLiron();

    assert.equal(card.id.PCODE,'LIRON');
    assert.equal(typeof card.action.SlotIO.RD.callback,'function');
    assert.equal(typeof card.action.SlotIO.WR.callback,'function');
    assert.equal(typeof card.action.SlotROM.RD.callback,'function');
    assert.equal(typeof card.action.HostROM.RD.callback,'function');
    assert.deepEqual(Array.from(card.deviceConfig),[]);
    assert.equal(card.getBus().hasDevices(),false);
});

test('slot I/O delegates all low-nibble accesses to the LironIWM', () => {
    const {context} = loadLiron();
    const card = new context.AppleLiron();

    card.readSlotIO(0x101); // low nibble $1: PHASE0 high
    assert.equal(card.getIWM().getState().lines,0x01);

    card.writeSlotIO(0x120,0x5A); // low nibble $0: PHASE0 low
    assert.equal(card.getIWM().getState().lines,0x00);

    card.readSlotIO(0x109); // MOTOR high
    assert.equal(card.getIWM().getState().motor,true);
});

test('the bundled Liron firmware is exactly 4 KiB and contains the SmartPort slot signature', () => {
    const {context} = loadLiron();
    const card = new context.AppleLiron();
    const rom = card.getROM();

    assert.equal(rom.length,4096);
    assert.deepEqual(
        [rom[0x501],rom[0x503],rom[0x505],rom[0x507]],
        [0x20,0x00,0x03,0x00]
    );
});

test('$Cn00-$CnFF selects the firmware page matching the physical slot', () => {
    const {context} = loadLiron();
    const card = new context.AppleLiron();
    const rom = card.getROM();

    mount(card,5);
    assert.equal(card.readROM(0x00,{bRO:true}),rom[0x500]);
    assert.equal(card.readROM(0x5A,{bRO:true}),rom[0x55A]);
    assert.equal(card.readROM(0xFF,{bRO:true}),rom[0x5FF]);

    mount(card,3);
    assert.equal(card.readROM(0x5A,{bRO:true}),rom[0x35A]);
});

test('normal slot-ROM access claims the shared $C800-$CFFF window', () => {
    const {context,actionMap} = loadLiron();
    const card = mount(new context.AppleLiron(),5);

    assert.equal(actionMap.Hslot,null);
    card.readROM(0x00,{});

    assert.equal(actionMap.Hslot,5);
    for(let addr=0x800;addr<=0xFFF;addr++)
        assert.equal(actionMap.RD[addr],card.action.HostROM.RD.callback);
});

test('read-only/debug slot-ROM inspection does not claim C8 space', () => {
    const {context,actionMap} = loadLiron();
    const card = mount(new context.AppleLiron(),5);

    card.readROM(0x00,{bRO:true});
    assert.equal(actionMap.Hslot,null);
});

test('$C800-$CFFF maps directly to ROM $0800-$0FFF only while Liron owns C8', () => {
    const {context,actionMap} = loadLiron();
    const card = mount(new context.AppleLiron(),5);
    const rom = card.getROM();

    assert.equal(card.readHostROM(0,{rel_addr:0x800}),0x00,'unowned C8 must not expose Liron ROM');

    card.readROM(0x00,{});
    assert.equal(actionMap.Hslot,5);
    assert.equal(card.readHostROM(0,{rel_addr:0x800}),rom[0x800]);
    assert.equal(card.readHostROM(0,{rel_addr:0x955}),rom[0x955]);

    // Debug reads of CFFF do not mutate ownership.
    assert.equal(card.readHostROM(0,{rel_addr:0xFFF,bRO:true}),rom[0xFFF]);
    assert.equal(actionMap.Hslot,5);

    // A normal CFFF access releases the conventional Apple II C8 latch.
    assert.equal(card.readHostROM(0,{rel_addr:0xFFF}),rom[0xFFF]);
    assert.equal(actionMap.Hslot,null);
});

test('reset and restart are delegated to the IWM/bus state', () => {
    const {context} = loadLiron();
    const card = new context.AppleLiron();

    card.readSlotIO(0x01);
    card.readSlotIO(0x09);
    assert.notEqual(card.getIWM().getState().lines,0);

    card.reset();
    assert.equal(card.getIWM().getState().lines,0);

    card.readSlotIO(0x01);
    card.restart();
    assert.equal(card.getIWM().getState().lines,0);
});
