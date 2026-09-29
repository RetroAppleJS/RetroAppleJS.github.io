'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const productionPath=path.join(root,'res','COM_LAYOUT_CONFIG.js');

function loadComposer(file)
{
    const source=fs.readFileSync(file,'utf8');
    const context={};
    vm.runInNewContext(source+'\n;this.__composer=composer;',context,{filename:file});
    return JSON.parse(JSON.stringify(context.__composer));
}

function byFileAndPosition(layout,file,x,y)
{
    return layout.layers.find(layer=>layer.file===file && layer.x===x && layer.y===y);
}

test('production Composer dataset preserves the v2 conversion metadata contract',()=>{
    const production=loadComposer(productionPath);

    assert.equal(production.version,2);
    assert.deepEqual(production.canvas,{width:1144,height:1144});
    assert.ok(Array.isArray(production.layers));
    assert.ok(production.layers.length>0);
    assert.equal(typeof production.assets,'object');

    for(const layer of production.layers)
    {
        assert.equal(typeof layer.id,'string');
        assert.ok(layer.id.length>0);
        assert.ok(Number.isInteger(layer.slotN));
        assert.ok(layer.slotN>=0 && layer.slotN<=8);
        assert.equal(typeof layer.labels,'object');
        assert.equal(Object.hasOwn(layer,'idMode'),false,'authoring-only idMode must not enter production data');
    }

    const monitor=byFileAndPosition(production,'A2P_Monitor.png',80,0);
    assert.deepEqual({id:monitor.id,slotN:monitor.slotN,labels:monitor.labels},{id:'SYSTEM.MONITOR',slotN:0,labels:{ROLE:'MONITOR'}});

    const d2Led=byFileAndPosition(production,'A2P_DISKII_LED.png',545,684);
    assert.deepEqual({id:d2Led.id,slotN:d2Led.slotN,labels:d2Led.labels},{id:'DISKII.D2.LED',slotN:7,labels:{PCODE:'DISKII',DCODE:'D2',ROLE:'LED'}});

    const d1Body=byFileAndPosition(production,'A2P_DISKII_left.png',81,463);
    assert.deepEqual({id:d1Body.id,slotN:d1Body.slotN,labels:d1Body.labels},{id:'DISKII.D1.BODY',slotN:7,labels:{PCODE:'DISKII',DCODE:'D1',ROLE:'BODY'}});

    const unidisk1=byFileAndPosition(production,'A2P_UNIDISK_left.png',170,460);
    const unidisk2=byFileAndPosition(production,'A2P_UNIDISK_right.png',463,460);
    assert.deepEqual({id:unidisk1.id,slotN:unidisk1.slotN,labels:unidisk1.labels},{id:'LIRON.UNIDISK.1.BODY',slotN:6,labels:{PCODE:'LIRON',DCODE:'UNIDISK',UNIT:'1',ROLE:'BODY'}});
    assert.deepEqual({id:unidisk2.id,slotN:unidisk2.slotN,labels:unidisk2.labels},{id:'LIRON.UNIDISK.2.BODY',slotN:6,labels:{PCODE:'LIRON',DCODE:'UNIDISK',UNIT:'2',ROLE:'BODY'}});

    const addresses=production.layers.map(layer=>`A2P.${layer.slotN}.${layer.id}`);
    assert.equal(new Set(addresses).size,addresses.length,'every production v2 layer must have a unique qualified runtime address');
});
