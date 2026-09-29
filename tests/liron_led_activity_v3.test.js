'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname,'..');

function loadComposer()
{
    const source=fs.readFileSync(path.join(ROOT,'res','COM_LAYOUT_CONFIG.js'),'utf8');
    const sandbox={};
    vm.createContext(sandbox);
    vm.runInContext(source+'\n;this.__composer=composer;',sandbox,{filename:'COM_LAYOUT_CONFIG.js'});
    return JSON.parse(JSON.stringify(sandbox.__composer));
}

function loadConstructor(file,name)
{
    const source=fs.readFileSync(path.join(ROOT,'res',file),'utf8');
    const sandbox={console,Uint8Array,Array,Number,String,Object,Math,RegExp};
    vm.createContext(sandbox);
    vm.runInContext(source+'\n;this.__ctor='+name+';',sandbox,{filename:file});
    return sandbox.__ctor;
}

function loadTopology(fakeWindow)
{
    const source=fs.readFileSync(path.join(ROOT,'res','EMU_CARD_smartport_topology.js'),'utf8');
    const sandbox={window:fakeWindow,module:{exports:{}},exports:{},console};
    vm.runInNewContext(source,sandbox,{filename:'EMU_CARD_smartport_topology.js'});
    return sandbox.module.exports;
}

function noLayoutWindow()
{
    return {setInterval(){return null;},clearInterval(){},addEventListener(){}};
}

test('production Composer v3 contains the four LIRON LED overlays with HD20 layout metadata',()=>{
    const composer=loadComposer();
    const byId=new Map(composer.layers.map(layer=>[layer.id,layer]));

    for(const id of ['LIRON.UNIDISK.1.LED','LIRON.UNIDISK.2.LED','LIRON.HD20.1.LED','LIRON.HD20.2.LED'])
    {
        assert.ok(byId.has(id),'missing '+id);
        assert.equal(byId.get(id).labels.PCODE,'LIRON');
        assert.equal(byId.get(id).labels.ROLE,'LED');
    }
    assert.equal(byId.get('LIRON.HD20.1.LED').labels.LAYOUT,'STANDALONE');
    assert.equal(byId.get('LIRON.HD20.2.LED').labels.LAYOUT,'STACKED');
});

test('decorated UniDisk records successful block activity per device and ignores failed I/O',()=>{
    const UniDisk35Device=loadConstructor('EMU_DEVICE_UNIDISK35.js','UniDisk35Device');
    const disk=new UniDisk35Device();
    disk.loadImage(new Uint8Array(819200),{filename:'disk.po'});
    const api=loadTopology(noLayoutWindow());
    api.decorateLironTopology({id:{PCODE:'LIRON'},mount:{slotN:6},devices:[disk]});

    assert.equal(api.deviceActivityGeneration(disk),0);
    assert.equal(disk.readBlock(0).error,0);
    assert.equal(api.deviceActivityGeneration(disk),1);
    assert.equal(disk.readBlock(1).error,0);
    assert.equal(api.deviceActivityGeneration(disk),2);

    disk.setOnline(false);
    assert.notEqual(disk.readBlock(2).error,0);
    assert.equal(api.deviceActivityGeneration(disk),2,'failed I/O must not create LED activity');
});

test('decorated HD20 records successful read, write and format activity',()=>{
    const HD20Device=loadConstructor('EMU_DEVICE_HD20.js','HD20Device');
    const disk=new HD20Device();
    const api=loadTopology(noLayoutWindow());
    api.decorateLironTopology({id:{PCODE:'LIRON'},mount:{slotN:6},devices:[disk]});

    assert.equal(api.deviceActivityGeneration(disk),0);
    assert.equal(disk.readBlock(0).error,0);
    assert.equal(api.deviceActivityGeneration(disk),1);
    assert.equal(disk.writeBlock(1,new Uint8Array(512)).error,0);
    assert.equal(api.deviceActivityGeneration(disk),2);
    assert.equal(disk.format().error,0);
    assert.equal(api.deviceActivityGeneration(disk),3);
});

test('500 ms LIRON activity sync isolates UniDisk LEDs by visual position and follows HD20 stacked/standalone layout',()=>{
    const calls=[];
    const entries=[
        {id:'U1.BODY',slotN:null,labels:{PCODE:'LIRON',DCODE:'UNIDISK',ROLE:'BODY'}},
        {id:'U2.BODY',slotN:null,labels:{PCODE:'LIRON',DCODE:'UNIDISK',ROLE:'BODY'}},
        {id:'U1.LED',slotN:null,labels:{PCODE:'LIRON',DCODE:'UNIDISK',ROLE:'LED'}},
        {id:'U2.LED',slotN:null,labels:{PCODE:'LIRON',DCODE:'UNIDISK',ROLE:'LED'}},
        {id:'HD.STANDALONE.BODY',slotN:null,labels:{PCODE:'LIRON',DCODE:'HD20',ROLE:'BODY',LAYOUT:'STANDALONE'}},
        {id:'HD.STACKED.BODY',slotN:null,labels:{PCODE:'LIRON',DCODE:'HD20',ROLE:'BODY',LAYOUT:'STACKED'}},
        {id:'HD.STANDALONE.LED',slotN:null,labels:{PCODE:'LIRON',DCODE:'HD20',ROLE:'LED',LAYOUT:'STANDALONE'}},
        {id:'HD.STACKED.LED',slotN:null,labels:{PCODE:'LIRON',DCODE:'HD20',ROLE:'LED',LAYOUT:'STACKED'}}
    ];
    const fakeWindow={
        oLAYOUT:{
            find(query){return entries.filter(entry=>Object.keys(query).every(key=>entry.labels[key]===query[key]));},
            visibleAt(slotN,id,state){calls.push([id,!!state]);return true;}
        },
        setInterval(){return null;},clearInterval(){},addEventListener(){}
    };
    const api=loadTopology(fakeWindow);

    function makeDevice(code,unit,hash)
    {
        return {
            id:{DCODE:code,deviceN:unit},attach:{hash},getUnit(){return unit;},
            readBlock(){return {error:0,data:new Uint8Array(512)};}
        };
    }
    const u1=makeDevice('UNIDISK',7,101);
    const u2=makeDevice('UNIDISK',2,102);
    const hd=makeDevice('HD20',5,103);
    const owner=api.decorateLironTopology({id:{PCODE:'LIRON'},mount:{slotN:6},devices:[u1,u2,hd]});

    assert.equal(typeof owner.syncLayoutActivity,'function','LIRON exposes a refresh-tick activity hook');
    calls.length=0;

    u1.readBlock(0);
    hd.readBlock(0);
    owner.syncLayoutActivity();
    const first=new Map(calls);
    assert.equal(first.get('U1.LED'),true,'first visual UniDisk lights from its own activity even when its SmartPort unit is 7');
    assert.equal(first.get('U2.LED'),false,'second visual UniDisk remains dark without activity');
    assert.equal(first.get('HD.STANDALONE.LED'),false,'standalone HD20 LED is hidden while UniDisks make the layout stacked');
    assert.equal(first.get('HD.STACKED.LED'),true,'stacked HD20 LED follows HD20 activity');

    calls.length=0;
    owner.syncLayoutActivity();
    const quiet=new Map(calls);
    assert.equal(quiet.get('U1.LED'),false,'one quiet 500 ms interval turns the UniDisk LED off');
    assert.equal(quiet.get('HD.STACKED.LED'),false,'one quiet 500 ms interval turns the HD20 LED off');

    owner.devices=[hd];
    hd.readBlock(1);
    calls.length=0;
    owner.syncLayoutVisuals();
    owner.syncLayoutActivity();
    const standalone=new Map(calls);
    assert.equal(standalone.get('HD.STANDALONE.LED'),true,'HD20 activity moves to the standalone LED with the standalone body');
    assert.equal(standalone.get('HD.STACKED.LED'),false);
});

test('the existing surfaceMap_refresh monitor hook samples LIRON LEDs on the same 500 ms dashboard tick',()=>{
    const mainSource=fs.readFileSync(path.join(ROOT,'res','EMU_apple2main.js'),'utf8');
    assert.match(mainSource,/surfaceMap_refresh/,'surface-map refresh event remains registered');
    assert.match(mainSource,/["']EMU_DashboardRefresh_s["']\s*:\s*2/,'dashboard event remains paced at 2 Hz / 500 ms');
    assert.match(mainSource,/deviceToolSurfaceMapMonitoring\(\)/,'the recurring surface-map event invokes the LIRON monitor hook');

    const calls=[];
    const entries=[
        {id:'U1.BODY',slotN:null,labels:{PCODE:'LIRON',DCODE:'UNIDISK',ROLE:'BODY'}},
        {id:'U1.LED',slotN:null,labels:{PCODE:'LIRON',DCODE:'UNIDISK',ROLE:'LED'}}
    ];
    const fakeWindow={
        oLAYOUT:{
            find(query){return entries.filter(entry=>Object.keys(query).every(key=>entry.labels[key]===query[key]));},
            visibleAt(slotN,id,state){if(id==='U1.LED' && state) calls.push('LED');return true;}
        },
        setInterval(){return null;},clearInterval(){},addEventListener(){}
    };
    const api=loadTopology(fakeWindow);
    const disk={
        id:{DCODE:'UNIDISK'},getUnit(){return 1;},
        readBlock(){return {error:0,data:new Uint8Array(512)};}
    };
    const owner={
        id:{PCODE:'LIRON'},mount:{slotN:6},devices:[disk],
        deviceToolSurfaceMapMonitoring(){calls.push('SURFACE');return true;}
    };
    api.decorateLironTopology(owner);
    disk.readBlock(0);
    calls.length=0;
    owner.deviceToolSurfaceMapMonitoring();

    assert.deepEqual(calls,['LED','SURFACE'],'LED sampling and surface-map refresh share the same recurring monitor call');
});
