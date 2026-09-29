'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const ROOT = path.resolve(__dirname,'..');

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

test('production v2 layout models HD20 images as TOP/BOTTOM positions, not SmartPort units',()=>{
    const layout = loadProductionLayout();
    const hd20 = layout.layers.filter(layer=>layer.labels && layer.labels.PCODE==='LIRON' && layer.labels.DCODE==='HD20');
    assert.deepEqual(
        hd20.map(layer=>({id:layer.id,slotN:layer.slotN,labels:layer.labels})),
        [
            {id:'LIRON.HD20.TOP.BODY',slotN:6,labels:{PCODE:'LIRON',DCODE:'HD20',POSITION:'TOP',ROLE:'BODY'}},
            {id:'LIRON.HD20.BOTTOM.BODY',slotN:6,labels:{PCODE:'LIRON',DCODE:'HD20',POSITION:'BOTTOM',ROLE:'BODY'}}
        ]
    );
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
    assertBodyState(calls,5,'LIRON.HD20.TOP.BODY',false);
    assertBodyState(calls,5,'LIRON.HD20.BOTTOM.BODY',false);
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

    assertBodyState(calls,3,'LIRON.HD20.TOP.BODY',true);
    assertBodyState(calls,3,'LIRON.HD20.BOTTOM.BODY',false);
    assertBodyState(calls,3,'LIRON.UNIDISK.1.BODY',false);
    assertBodyState(calls,3,'LIRON.UNIDISK.2.BODY',false);
});

test('HD20 moves to the lower position when at least one UniDisk is attached',()=>{
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

        assertBodyState(calls,6,'LIRON.HD20.TOP.BODY',false);
        assertBodyState(calls,6,'LIRON.HD20.BOTTOM.BODY',true);
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
    assertBodyState(calls,6,'LIRON.HD20.TOP.BODY',true);
    assertBodyState(calls,6,'LIRON.HD20.BOTTOM.BODY',false);
});
