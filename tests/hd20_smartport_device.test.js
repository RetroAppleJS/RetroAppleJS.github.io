'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const hd20Path=path.join(__dirname,'..','res','EMU_DEVICE_HD20.js');
const uniPath=path.join(__dirname,'..','res','EMU_DEVICE_UNIDISK35.js');
const lironPath=path.join(__dirname,'..','res','EMU_CARD_LIRON.js');
const ioPath=path.join(__dirname,'..','res','EMU_apple2io.js');
const indexPath=path.join(__dirname,'..','index.html');

function loadContext()
{
    assert.equal(fs.existsSync(hd20Path),true,'HD20 device module must exist');
    const actionMap={Hslot:null,RD:new Array(0x1000),WR:new Array(0x1000)};
    const context={
        console:{log(){},warn(){},error(){}},
        Uint8Array,ArrayBuffer,Number,String,RangeError,
        oEMU:{component:{IO:{ACTION_MAP:actionMap}}}
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(uniPath,'utf8'),context,{filename:'EMU_DEVICE_UNIDISK35.js'});
    vm.runInContext(fs.readFileSync(hd20Path,'utf8'),context,{filename:'EMU_DEVICE_HD20.js'});
    vm.runInContext(fs.readFileSync(lironPath,'utf8'),context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

test('HD20 module defines the browser-global constructor required by the device picker',()=>{
    const context={
        console:{log(){},warn(){},error(){}},
        Uint8Array,ArrayBuffer,Number,String,RangeError,
        oEMU:{component:{IO:{ACTION_MAP:{Hslot:null,RD:new Array(0x1000),WR:new Array(0x1000)}}}}
    };
    vm.createContext(context);
    assert.doesNotThrow(
        ()=>vm.runInContext(fs.readFileSync(hd20Path,'utf8'),context,{filename:'EMU_DEVICE_HD20.js'}),
        'HD20 module must parse and execute so globalThis.HD20Device is available to Add Device'
    );
    assert.equal(typeof context.HD20Device,'function');
});

test('HD20 publishes Apple Hard Disk 20 identity and SmartPort hard-disk metadata',()=>{
    const context=loadContext();
    const disk=new context.HD20Device();

    assert.equal(disk.id.DCODE,'HD20');
    assert.equal(disk.id.hostPCODE,'LIRON');
    assert.equal(disk.id.description,'Apple Hard Disk 20');
    assert.deepEqual(JSON.parse(JSON.stringify(disk.ports)),{
        smartport:{
            label:'SmartPort',
            kind:'bus',
            direction:'bidirectional',
            protocol:'SmartPort',
            unit:null,
            visibility:'public'
        }
    });
    assert.equal(disk.getBlockSize(),512);
    assert.equal(disk.getBlockCount(),40960);
    assert.equal(disk.getDeviceType(),0x02);
    assert.equal(disk.getDeviceSubtype(),0x20);

    disk.setUnit(2);
    assert.equal(disk.ports.smartport.unit,2);
    disk.setUnit(0);
    assert.equal(disk.ports.smartport.unit,null);
});

test('Liron advertises HD20 as optional and attaches mixed SmartPort devices to distinct units',()=>{
    const context=loadContext();
    const card=new context.AppleLiron();

    const uniInfo=card.deviceConfig.find(info=>info.DCODE==='UNIDISK');
    const hdInfo=card.deviceConfig.find(info=>info.DCODE==='HD20');
    assert.ok(uniInfo,'Liron must continue to advertise UNIDISK35');
    assert.ok(hdInfo,'Liron must advertise HD20 in the device picker');
    assert.equal(hdInfo.hostPCODE,'LIRON');
    assert.equal(hdInfo.coID,'HD20Device');
    assert.equal(hdInfo.description,'Apple Hard Disk 20');
    assert.equal(hdInfo.autoAttach,false,'HD20 must be available to attach without being provisioned by default');

    const uni=new context.UniDisk35Device(uniInfo);
    const hd1=new context.HD20Device(hdInfo);
    const hd2=new context.HD20Device(hdInfo);

    assert.equal(uni.bindHost(card),true);
    assert.equal(hd1.bindHost(card),true);
    assert.equal(hd2.bindHost(card),true);
    assert.deepEqual(Array.from(card.getBus().getUnits()),[1,2,3]);
    assert.equal(uni.getUnit(),1);
    assert.equal(hd1.getUnit(),2);
    assert.equal(hd2.getUnit(),3);
    assert.equal(card.getUniDisk(),uni);
    assert.equal(card.getHD20(),hd1);
    assert.equal(card.getHD20(3),hd2);

    assert.equal(hd1.unbindHost(card),true);
    assert.equal(card.getBus().getDevice(2),null);
    assert.equal(card.getBus().getDevice(3),hd2);
});

test('Apple2IO provisioning recognizes optional and if-empty attachment policies',()=>{
    const ioSource=fs.readFileSync(ioPath,'utf8');
    assert.match(ioSource,/autoAttach\s*===\s*false/,
        'provisionPeripheral must leave optional picker devices unattached by default');
    assert.match(ioSource,/autoAttach\s*===\s*["']if-empty["']/,
        'provisionPeripheral must recognize defaults that attach only to an empty host');
});

test('browser loads HD20 device module before the Liron card',()=>{
    const html=fs.readFileSync(indexPath,'utf8');
    const hd=html.indexOf('res/EMU_DEVICE_HD20.js');
    const liron=html.indexOf('res/EMU_CARD_LIRON.js');
    assert.notEqual(hd,-1,'index.html must load the HD20 device module');
    assert.ok(hd<liron,'HD20 constructor must be loaded before AppleLiron is instantiated');
});