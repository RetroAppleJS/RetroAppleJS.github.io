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

test('production v3 layout retains two distinct HD20 BODY visual positions',()=>{
    const layout = loadProductionLayout();
    const hd20 = layout.layers.filter(layer=>layer.labels && layer.labels.PCODE==='LIRON' && layer.labels.DCODE==='HD20' && layer.labels.ROLE==='BODY');
    assert.equal(hd20.length,2);
    assert.equal(hd20[0].id,HD20_TOP);
    assert.equal(hd20[1].id,HD20_BOTTOM);
    assert.ok(hd20[0].y < hd20[1].y,'HD20 visual #1 is the upper position and visual #2 is the lower position');
});

test('a single UniDisk occupies the first visual position regardless of SmartPort unit',()=>{
    for(const unit of [1,2,3])
    {
        const calls=[];
        const api=loadTopology(calls);
        const disk=device('UNIDISK',unit);
        const owner=api.decorateLironTopology(makeOwner(5,[disk]));
        calls.length=0;

        owner.onDeviceTopologyChanged({type:'attach',device:disk});

        assertBodyState(calls,5,'LIRON.UNIDISK.1.BODY',true);
        assertBodyState(calls,5,'LIRON.UNIDISK.2.BODY',false);
        assertBodyState(calls,5,HD20_TOP,false);
        assertBodyState(calls,5,HD20_BOTTOM,false);
        assert.equal(calls.some(call=>/\.LED$/.test(call.id)),false,'legacy layout fixture without LED metadata must not receive LED writes');
    }
});

test('two attached UniDisks occupy both side-by-side BODY layers regardless of SmartPort units',()=>{
    const calls=[];
    const api=loadTopology(calls);
    const d2=device('UNIDISK',2);
    const d3=device('UNIDISK',3);
    const owner=api.decorateLironTopology(makeOwner(6,[d2,d3]));
    calls.length=0;

    owner.onDeviceTopologyChanged({type:'attach',device:d3});

    assertBodyState(calls,6,'LIRON.UNIDISK.1.BODY',true);
    assertBodyState(calls,6,'LIRON.UNIDISK.2.BODY',true);
    assertBodyState(calls,6,HD20_TOP,false);
    assertBodyState(calls,6,HD20_BOTTOM,false);
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

test('HD20 Unit 1 plus UniDisk Unit 2 uses first UniDisk visual and lower HD20 position',()=>{
    const calls=[];
    const api=loadTopology(calls);
    const hd=device('HD20',1);
    const d2=device('UNIDISK',2);
    const owner=api.decorateLironTopology(makeOwner(6,[hd,d2]));
    calls.length=0;

    owner.onDeviceTopologyChanged({type:'attach',device:d2});

    assertBodyState(calls,6,'LIRON.UNIDISK.1.BODY',true);
    assertBodyState(calls,6,'LIRON.UNIDISK.2.BODY',false);
    assertBodyState(calls,6,HD20_TOP,false);
    assertBodyState(calls,6,HD20_BOTTOM,true);
});

test('HD20 Unit 1 plus UniDisk Units 2 and 3 shows both UniDisks and lower HD20',()=>{
    const calls=[];
    const api=loadTopology(calls);
    const hd=device('HD20',1);
    const d2=device('UNIDISK',2);
    const d3=device('UNIDISK',3);
    const owner=api.decorateLironTopology(makeOwner(6,[hd,d2,d3]));
    calls.length=0;

    owner.onDeviceTopologyChanged({type:'attach',device:d3});

    assertBodyState(calls,6,'LIRON.UNIDISK.1.BODY',true);
    assertBodyState(calls,6,'LIRON.UNIDISK.2.BODY',true);
    assertBodyState(calls,6,HD20_TOP,false);
    assertBodyState(calls,6,HD20_BOTTOM,true);
});

test('detach recomputes all LIRON BODY visibility from the remaining topology',()=>{
    const calls=[];
    const api=loadTopology(calls);
    const d2=device('UNIDISK',2);
    const hd=device('HD20',1);
    const owner=api.decorateLironTopology(makeOwner(6,[hd,d2]));

    owner.devices=[hd];
    calls.length=0;
    owner.onDeviceTopologyChanged({type:'detach',device:d2});

    assertBodyState(calls,6,'LIRON.UNIDISK.1.BODY',false);
    assertBodyState(calls,6,'LIRON.UNIDISK.2.BODY',false);
    assertBodyState(calls,6,HD20_TOP,true);
    assertBodyState(calls,6,HD20_BOTTOM,false);
});

test('delayed LIRON initialization synchronizes once mount and default topology become available',()=>{
    const calls=[];
    const api=loadTopology(calls);
    const owner={id:{PCODE:'LIRON'},devices:[]};

    api.decorateLironTopology(owner);
    assert.equal(calls.length,0,'no slot-qualified repaint is possible before mount initialization');

    owner.mount={slotN:6};
    owner.devices=[device('HD20',1)];
    api.decorateLironTopology(owner);

    assertBodyState(calls,6,'LIRON.UNIDISK.1.BODY',false);
    assertBodyState(calls,6,'LIRON.UNIDISK.2.BODY',false);
    assertBodyState(calls,6,HD20_TOP,true);
    assertBodyState(calls,6,HD20_BOTTOM,false);

    calls.length=0;
    api.decorateLironTopology(owner);
    assert.equal(calls.length,0,'after deferred synchronization succeeds, discovery polling must not repaint unchanged topology');
});

test('redecorating an already synchronized LIRON card does not repeat layout repaint calls',()=>{
    const calls=[];
    const api=loadTopology(calls);
    const owner=api.decorateLironTopology(makeOwner(6,[device('UNIDISK',2)]));
    assert.ok(calls.length>0,'first decoration synchronizes the current topology');
    calls.length=0;

    api.decorateLironTopology(owner);

    assert.equal(calls.length,0,'discovery polling must not repeatedly reapply the same visual state');
});
