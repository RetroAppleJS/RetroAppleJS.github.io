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

test('AppleLiron keeps UniDisk as its if-empty default without privately constructing it', () => {
    const context=loadLiron();
    const card=new context.AppleLiron();
    const info=card.deviceConfig.find(entry=>entry.DCODE==='UNIDISK');

    assert.ok(info);
    assert.deepEqual(
        {
            DCODE:info.DCODE,
            hostPCODE:info.hostPCODE,
            coID:info.coID,
            deviceN:info.deviceN,
            autoAttach:info.autoAttach
        },
        {DCODE:'UNIDISK',hostPCODE:'LIRON',coID:'UniDisk35Device',deviceN:1,autoAttach:'if-empty'}
    );
    assert.equal(card.getUniDisk(),null);
    assert.deepEqual(Array.from(card.getBus().getUnits()),[]);
});

test('bindHost attaches the exact Apple2IO-created child as unit 1 idempotently', () => {
    const context=loadLiron();
    const card=new context.AppleLiron();
    const info=card.deviceConfig.find(entry=>entry.DCODE==='UNIDISK');
    const disk=new context.UniDisk35Device(info);

    assert.equal(disk.bindHost(card),true);
    assert.equal(card.getUniDisk(),disk);
    assert.equal(card.getUniDisk(1),disk);
    assert.equal(card.getBus().getDevice(1),disk);
    assert.equal(disk.getUnit(),1);

    assert.equal(disk.bindHost(card),true);
    assert.deepEqual(Array.from(card.getBus().getUnits()),[1]);
    assert.equal(card.getBus().getState().deviceCount,1);
});

test('AppleLiron accepts multiple UniDisk instances and assigns free SmartPort units', () => {
    const context=loadLiron();
    const card=new context.AppleLiron();
    const info=card.deviceConfig.find(entry=>entry.DCODE==='UNIDISK');
    const first=new context.UniDisk35Device(info);
    const second=new context.UniDisk35Device(info);

    assert.equal(first.bindHost(card),true);
    assert.equal(second.bindHost(card),true);
    assert.deepEqual(Array.from(card.getBus().getUnits()),[1,2]);
    assert.equal(first.getUnit(),1);
    assert.equal(second.getUnit(),2);
    assert.equal(card.getUniDisk(),first,
        'legacy no-argument accessor should still resolve the first SmartPort UniDisk');
    assert.equal(card.getUniDisk(1),first);
    assert.equal(card.getUniDisk(2),second);

    assert.equal(first.unbindHost(card),true);
    assert.equal(card.getBus().getDevice(1),null);
    assert.equal(card.getBus().getDevice(2),second,
        'detaching one instance must leave the other resident');
    assert.equal(card.getUniDisk(2),second);
});
