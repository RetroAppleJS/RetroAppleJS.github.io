'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const ROOT = path.resolve(__dirname,'..');
const HD20_TOP='LIRON.HD20.1.BODY';
const HD20_BOTTOM='LIRON.HD20.2.BODY';

function loadProductionLayout()
{
    const source = fs.readFileSync(path.join(ROOT,'res/COM_LAYOUT_CONFIG.js'),'utf8');
    const sandbox = {};
    vm.runInNewContext(source,sandbox,{filename:'COM_LAYOUT_CONFIG.js'});
    return JSON.parse(JSON.stringify(sandbox.composer));
}

function loadTopology(layoutCalls)
{
    const source = fs.readFileSync(path.join(ROOT,'res/EMU_CARD_smartport_topology.js'),'utf8');
    const fakeWindow = {
        oLAYOUT: {
            visibleAt(slotN,id,state)
            {
                layoutCalls.push({slotN,id,state:!!state});
                return !!state;
            }
        },
        setInterval(){ return null; },
        clearInterval(){},
        addEventListener(){}
    };
    const sandbox = {
        window: fakeWindow,
        module: {exports:{}},
        exports: {},
        console
    };
    vm.runInNewContext(source,sandbox,{filename:'EMU_CARD_smartport_topology.js'});
    return sandbox.module.exports;
}

function device(code,unit)
{
    return {
        id: {DCODE:code,deviceN:unit},
        getUnit(){ return unit; },
        attach: {hash:unit}
    };
}

function makeOwner(slotN,devices)
{
    return {
        id: {PCODE:'LIRON'},
        mount: {slotN},
        devices: devices || []
    };
}

function lastState(calls,id)
{
    for(let i=calls.length-1;i>=0;i--)
        if(calls[i].id===id) return calls[i];
    return null;
}

function assertBodyState(calls,slotN,id,state)
{
    const call = lastState(calls,id);
    assert.ok(call,`expected layout update for ${id}`);
    assert.equal(call.slotN,slotN,`${id} must use the mounted LIRON slot`);
    assert.equal(call.state,state,`${id} visibility`);
}

test('production v2 layout retains two distinct HD20 visual positions',()=>{
    const layout = loadProductionLayout();
    const hd20 = layout.layers.filter(layer=>layer.labels && layer.labels.PCODE==='LIRON' && layer.labels.DCODE==='HD20');
    assert.equal(hd20.length,2);
    assert.equal(hd20[0].id,HD20_TOP);
    assert.equal(hd20[1].id,HD20_BOTTOM);
    assert.ok(hd20[0].y < hd20[1].y,'HD20 visual #1 is the upper position and visual #2 is the lower position');
});

test('UniDisk unit 1 controls only the unit-1 BODY through visibleAt()',()=>{
    const calls=[];
    const api=loadTopology(calls);
    const d1=device('UNIDISK',1);
    const owner=api.decorateLironTopology(makeOwner(5,[d1]));
    calls.length=0;

    owner.onDeviceTopologyChanged({type:'attach',device:d1});

    assertBodyState(calls,5,'LIRON.UNIDISK.1.BODY',true);
    assertBodyState(calls,5,'LIRON.UNIDISK.2.BODY',false);
    assertBodyState(calls,5,HD20_TOP,false);
    assertBodyState(calls,5,HD20_BOTTOM,false);
    assert.equal(calls.some(call=>/\.LED$/.test(call.id)),false,'UniDisk/HD20 LEDs are not part of this design yet');
});

test('UniDisk unit 2 controls only the unit-2 BODY through visibleAt()',()=>{
    const calls=[];
    const api=loadTopology(calls);
    const d2=device('UNIDISK',2);
    const owner=api.decorateLironTopology(makeOwner(4,[d2]));
    calls.length=0;

    owner.onDeviceTopologyChanged({type:'attach',device:d2});

    assertBodyState(calls,4,'LIRON.UNIDISK.1.BODY',false);
    assertBodyState(calls,4,'LIRON.UNIDISK.2.BODY',true);
});

test('two attached UniDisks make both side-by-side BODY layers visible',()=>{
    const calls=[];
    const api=loadTopology(calls);
    const d1=device('UNIDISK',1);
    const d2=device('UNIDISK',2);
    const owner=api.decorateLironTopology(makeOwner(6,[d1,d2]));
    calls.length=0;

    owner.onDeviceTopologyChanged({type:'attach',device:d2});

    assertBodyState(calls,6,'LIRON.UNIDISK.1.BODY',true);
    assertBodyState(calls,6,'LIRON.UNIDISK.2.BODY',true);
});

test('a sole HD20 uses the upper HD20 position regardless of SmartPort unit',()=>{
    const calls=[];
    const api=loadTopology(calls);
    const hd=device('HD20',3);
    const owner=api.decorateLironTopology(makeOwner(3,[hd]));
    calls.length=0;

    owner.onDeviceTopologyChanged({type:'attach',device:hd});

    assertBodyState(calls,3,HD20_TOP,true);
    assertBodyState(calls,3,HD20_BOTTOM,false);
    assertBodyState(calls,3,'LIRON.UNIDISK.1.BODY',false);
    assertBodyState(calls,3,'LIRON.UNIDISK.2.BODY',false);
});

test('HD20 uses the lower position when at least one UniDisk is attached',()=>{
    for(const unidiskCount of [1,2])
    {
        const calls=[];
        const api=loadTopology(calls);
        const disks=[device('UNIDISK',1)];
        if(unidiskCount===2) disks.push(device('UNIDISK',2));
        const hd=device('HD20',unidiskCount+1);
        disks.push(hd);
        const owner=api.decorateLironTopology(makeOwner(6,disks));
        calls.length=0;

        owner.onDeviceTopologyChanged({type:'attach',device:hd});

        assertBodyState(calls,6,HD20_TOP,false);
        assertBodyState(calls,6,HD20_BOTTOM,true);
        assertBodyState(calls,6,'LIRON.UNIDISK.1.BODY',true);
        assertBodyState(calls,6,'LIRON.UNIDISK.2.BODY',unidiskCount===2);
    }
});

test('detach recomputes all LIRON BODY visibility from the remaining topology',()=>{
    const calls=[];
    const api=loadTopology(calls);
    const d1=device('UNIDISK',1);
    const hd=device('HD20',2);
    const owner=api.decorateLironTopology(makeOwner(6,[d1,hd]));

    owner.devices=[hd];
    calls.length=0;
    owner.onDeviceTopologyChanged({type:'detach',device:d1});

    assertBodyState(calls,6,'LIRON.UNIDISK.1.BODY',false);
    assertBodyState(calls,6,'LIRON.UNIDISK.2.BODY',false);
    assertBodyState(calls,6,HD20_TOP,true);
    assertBodyState(calls,6,HD20_BOTTOM,false);
});
