'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname,'..');
const indexSource = fs.readFileSync(path.join(root,'index.html'),'utf8');
const deviceSource = fs.readFileSync(path.join(root,'res','EMU_DEVICE_UNIDISK35.js'),'utf8');
const cardSource = fs.readFileSync(path.join(root,'res','EMU_CARD_LIRON.js'),'utf8');

function loadBrowserCard()
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
    vm.runInContext(deviceSource,context,{filename:'EMU_DEVICE_UNIDISK35.js'});
    vm.runInContext(cardSource,context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

test('index.html loads UniDisk 3.5 before exactly one Liron card script', () => {
    const deviceTag = 'src="res/EMU_DEVICE_UNIDISK35.js"';
    const lironTag = 'src="res/EMU_CARD_LIRON.js"';
    const devicePos = indexSource.indexOf(deviceTag);
    const lironPos = indexSource.indexOf(lironTag);
    const lironCount = indexSource.split(lironTag).length - 1;

    assert.notEqual(devicePos,-1,'index.html must load EMU_DEVICE_UNIDISK35.js');
    assert.notEqual(lironPos,-1,'index.html must load EMU_CARD_LIRON.js');
    assert.equal(lironCount,1,'index.html must load EMU_CARD_LIRON.js exactly once');
    assert.ok(devicePos < lironPos,'UniDisk device script must load before Liron card');
});

test('browser discovery declares UniDisk and Apple2IO-style binding populates SmartPort unit 1', () => {
    const context = loadBrowserCard();
    const card = context.oEMU.component.IO.AppleLiron;

    assert.ok(card,'AppleLiron discovery instance must exist');
    const uniConfig=card.deviceConfig.find(info=>info.DCODE==='UNIDISK');
    const hd20Config=card.deviceConfig.find(info=>info.DCODE==='HD20');
    assert.ok(uniConfig,'Liron must advertise a UniDisk SmartPort child');
    assert.ok(hd20Config,'Liron must also advertise the optional HD20 child');
    assert.deepEqual(Array.from(card.getBus().getUnits()),[]);
    assert.equal(card.getUniDisk(),null);

    const device = new context.UniDisk35Device(uniConfig);
    assert.equal(device.bindHost(card),true);

    assert.deepEqual(Array.from(card.getBus().getUnits()),[1]);
    assert.equal(card.getBus().getDevice(1),device);
    assert.equal(device,card.getUniDisk());
    assert.equal(device.getUnit(),1);
    assert.equal(device.id.DCODE,'UNIDISK');
    assert.equal(device.getBlockCount(),1600);
});
