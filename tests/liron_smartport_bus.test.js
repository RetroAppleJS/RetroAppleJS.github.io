'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const deviceSource = fs.readFileSync(path.join(__dirname,'..','res','EMU_DEVICE_UNIDISK35.js'),'utf8');
const cardSource = fs.readFileSync(path.join(__dirname,'..','res','EMU_CARD_LIRON.js'),'utf8');

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
    vm.runInContext(deviceSource,context);
    vm.runInContext(cardSource,context);
    return context;
}

test('SmartPortBus assigns unit 1, enumerates it, and resolves it by unit number', () => {
    const context = loadLiron();
    const bus = new context.SmartPortBus();
    const device = new context.UniDisk35Device();

    assert.equal(device.getUnit(),0);
    assert.equal(bus.attach(device,1),device);
    assert.equal(device.getUnit(),1);
    assert.deepEqual(Array.from(bus.getUnits()),[1]);
    assert.equal(bus.getDevice(1),device);
    assert.equal(bus.getDevice(2),null);

    const state = bus.getState();
    assert.equal(state.deviceCount,1);
    assert.deepEqual(Array.from(state.units),[1]);
});

test('SmartPortBus rejects occupied units and detach releases the unit', () => {
    const context = loadLiron();
    const bus = new context.SmartPortBus();
    const first = new context.UniDisk35Device();
    const second = new context.UniDisk35Device();

    bus.attach(first,1);
    assert.throws(() => bus.attach(second,1),/already occupied/i);

    assert.equal(bus.detach(first),first);
    assert.equal(first.getUnit(),0);
    assert.deepEqual(Array.from(bus.getUnits()),[]);
    assert.equal(bus.getDevice(1),null);
});

test('SmartPortBus reset preserves attached units', () => {
    const context = loadLiron();
    const bus = new context.SmartPortBus();
    const device = new context.UniDisk35Device();

    bus.attach(device,1);
    bus.reset();

    assert.equal(bus.getDevice(1),device);
    assert.equal(device.getUnit(),1);
    assert.deepEqual(Array.from(bus.getUnits()),[1]);
});

test('AppleLiron attaches one UniDisk 3.5 as SmartPort unit 1 when the device constructor is loaded', () => {
    const context = loadLiron();
    const card = new context.AppleLiron();
    const bus = card.getBus();
    const device = bus.getDevice(1);

    assert.ok(device,'unit 1 must be populated');
    assert.equal(device.getUnit(),1);
    assert.equal(device.id.DCODE,'UNIDISK35');
    assert.equal(device.getBlockSize(),512);
    assert.equal(device.getBlockCount(),1600);
    assert.deepEqual(Array.from(bus.getUnits()),[1]);
    assert.equal(bus.getState().deviceCount,1);
});
