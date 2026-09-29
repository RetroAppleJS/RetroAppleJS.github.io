'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const runtimePath = path.join(__dirname,'..','res','COM_A2P_LAYOUT.js');
delete require.cache[require.resolve(runtimePath)];
const runtime = require(runtimePath);

function shadow()
{
    return {enabled:false,offsetX:0,offsetY:15,blur:12,opacity:0.75};
}

function v2Layer(overrides={})
{
    return Object.assign({
        id:'DISKII.D2.LED',
        slotN:7,
        labels:{PCODE:'DISKII',DCODE:'D2',ROLE:'LED'},
        file:'led.png',
        x:10,
        y:20,
        visible:false,
        shadow:shadow()
    },overrides);
}

function v2Layout(layers)
{
    return {version:2,canvas:{width:1144,height:1144},layers,assets:{}};
}

function v1Layer(overrides={})
{
    return Object.assign({
        file:'legacy.png',
        x:10,
        y:20,
        visible:true,
        shadow:shadow()
    },overrides);
}

function v1Layout(layers)
{
    return {version:1,canvas:{width:1144,height:1144},layers,assets:{}};
}

test('v2 layers normalize to canonical slot-qualified runtime addresses',()=>{
    assert.equal(typeof runtime.normalizeLayout,'function');
    const result = runtime.normalizeLayout(v2Layout([v2Layer()]));
    assert.equal(result.version,2);
    assert.equal(result.layers[0].id,'DISKII.D2.LED');
    assert.equal(result.layers[0].slotN,7);
    assert.equal(result.layers[0].address,'A2P.7.DISKII.D2.LED');
    assert.deepEqual(result.layers[0].labels,{PCODE:'DISKII',DCODE:'D2',ROLE:'LED'});
});

test('slot 0 and slot 8 are valid v2 namespaces while slot 9 rejects',()=>{
    const system = runtime.normalizeLayout(v2Layout([
        v2Layer({id:'SYSTEM.MONITOR',slotN:0,labels:{ROLE:'MONITOR'},file:'monitor.png'}),
        v2Layer({slotN:8,file:'slot8.png'})
    ]));
    assert.equal(system.layers[0].address,'A2P.0.SYSTEM.MONITOR');
    assert.equal(system.layers[1].address,'A2P.8.DISKII.D2.LED');

    assert.throws(
        ()=>runtime.normalizeLayout(v2Layout([v2Layer({slotN:9})])),
        /slot/i
    );
});

test('duplicate qualified addresses reject but the same semantic id may exist in different slots',()=>{
    assert.throws(
        ()=>runtime.normalizeLayout(v2Layout([
            v2Layer({file:'one.png'}),
            v2Layer({file:'two.png'})
        ])),
        /duplicate.*A2P\.7\.DISKII\.D2\.LED/i
    );

    const result = runtime.normalizeLayout(v2Layout([
        v2Layer({slotN:6,file:'slot6.png'}),
        v2Layer({slotN:7,file:'slot7.png'})
    ]));
    assert.deepEqual(result.layers.map(layer=>layer.address),[
        'A2P.6.DISKII.D2.LED',
        'A2P.7.DISKII.D2.LED'
    ]);
});

test('v2 semantic identity is independent of the asset filename',()=>{
    const first = runtime.normalizeLayout(v2Layout([v2Layer({file:'old-name.png'})]));
    const second = runtime.normalizeLayout(v2Layout([v2Layer({file:'replacement-art.png'})]));
    assert.equal(first.layers[0].address,'A2P.7.DISKII.D2.LED');
    assert.equal(second.layers[0].address,'A2P.7.DISKII.D2.LED');
});

test('known v1 Disk II ids and filenames normalize deterministically with compatibility aliases',()=>{
    const result = runtime.normalizeLayout(v1Layout([
        v1Layer({id:'A2P.DISKII.D2.LED',file:'A2P_DISKII_LED.png'}),
        v1Layer({file:'A2P_DISKII_left.png'}),
        v1Layer({file:'A2P_DISKII_gap.png'})
    ]));

    assert.equal(result.version,2);
    assert.deepEqual(
        result.layers.map(layer=>({id:layer.id,slotN:layer.slotN,address:layer.address})),
        [
            {id:'DISKII.D2.LED',slotN:7,address:'A2P.7.DISKII.D2.LED'},
            {id:'DISKII.D1.BODY',slotN:7,address:'A2P.7.DISKII.D1.BODY'},
            {id:'DISKII.GAP',slotN:7,address:'A2P.7.DISKII.GAP'}
        ]
    );
    assert.ok(result.layers[0].aliases.includes('A2P.DISKII.D2.LED'));
    assert.ok(result.layers[1].aliases.includes('A2P.DISKII.D1.BODY'));
});

test('unmapped v1 layers receive compatibility-only system identities instead of failing',()=>{
    const result = runtime.normalizeLayout(v1Layout([
        v1Layer({file:'third-party-decoration.png',x:99,y:101})
    ]));
    const layer = result.layers[0];
    assert.equal(layer.slotN,0);
    assert.match(layer.id,/^COMPAT\./);
    assert.equal(layer.address,'A2P.0.'+layer.id);
    assert.deepEqual(layer.labels,{});
});

test('validateLayout remains the public normalization entry point for v1 and v2',()=>{
    const v2 = runtime.validateLayout(v2Layout([v2Layer()]));
    const v1 = runtime.validateLayout(v1Layout([v1Layer({file:'A2P_DISKII_right.png'})]));
    assert.equal(v2.layers[0].address,'A2P.7.DISKII.D2.LED');
    assert.equal(v1.layers[0].address,'A2P.7.DISKII.D2.BODY');
});
