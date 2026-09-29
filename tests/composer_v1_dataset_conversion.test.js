'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const sourcePath=path.join(root,'res','COM_LAYOUT_CONFIG.js');
const convertedPath=path.join(root,'tools','GUI_DEV','COM_LAYOUT_CONFIG.v2.js');

function loadComposer(file)
{
    const source=fs.readFileSync(file,'utf8');
    const context={};
    vm.runInNewContext(source+'\n;this.__composer=composer;',context,{filename:file});
    return context.__composer;
}

function byFileAndPosition(layout,file,x,y)
{
    return layout.layers.find(layer=>layer.file===file && layer.x===x && layer.y===y);
}

test('repository v1 Composer dataset has a complete v2 companion conversion',()=>{
    assert.equal(fs.existsSync(convertedPath),true,'tools/GUI_DEV/COM_LAYOUT_CONFIG.v2.js must be generated from the current v1 dataset');

    const v1=loadComposer(sourcePath);
    const v2=loadComposer(convertedPath);

    assert.equal(v1.version,1);
    assert.equal(v2.version,2);
    assert.equal(v2.canvas.width,v1.canvas.width);
    assert.equal(v2.canvas.height,v1.canvas.height);
    assert.equal(v2.layers.length,v1.layers.length);
    assert.deepEqual(Object.keys(v2.assets).sort(),Object.keys(v1.assets).sort(),'all embedded assets must be preserved');

    for(const layer of v2.layers)
    {
        assert.equal(typeof layer.id,'string');
        assert.ok(layer.id.length>0);
        assert.ok(Number.isInteger(layer.slotN));
        assert.ok(layer.slotN>=0 && layer.slotN<=8);
        assert.equal(typeof layer.labels,'object');
        assert.equal(Object.hasOwn(layer,'idMode'),false,'authoring-only idMode must not enter converted data');
    }

    const monitor=byFileAndPosition(v2,'A2P_Monitor.png',80,0);
    assert.deepEqual({id:monitor.id,slotN:monitor.slotN,labels:monitor.labels},{id:'SYSTEM.MONITOR',slotN:0,labels:{ROLE:'MONITOR'}});

    const d2Led=byFileAndPosition(v2,'A2P_DISKII_LED.png',545,684);
    assert.deepEqual({id:d2Led.id,slotN:d2Led.slotN,labels:d2Led.labels},{id:'DISKII.D2.LED',slotN:7,labels:{PCODE:'DISKII',DCODE:'D2',ROLE:'LED'}});

    const d1Body=byFileAndPosition(v2,'A2P_DISKII_left.png',81,463);
    assert.deepEqual({id:d1Body.id,slotN:d1Body.slotN,labels:d1Body.labels},{id:'DISKII.D1.BODY',slotN:7,labels:{PCODE:'DISKII',DCODE:'D1',ROLE:'BODY'}});

    const unidisk1=byFileAndPosition(v2,'A2P_UNIDISK_left.png',170,460);
    const unidisk2=byFileAndPosition(v2,'A2P_UNIDISK_right.png',463,460);
    assert.deepEqual({id:unidisk1.id,slotN:unidisk1.slotN,labels:unidisk1.labels},{id:'LIRON.UNIDISK.1.BODY',slotN:6,labels:{PCODE:'LIRON',DCODE:'UNIDISK',UNIT:'1',ROLE:'BODY'}});
    assert.deepEqual({id:unidisk2.id,slotN:unidisk2.slotN,labels:unidisk2.labels},{id:'LIRON.UNIDISK.2.BODY',slotN:6,labels:{PCODE:'LIRON',DCODE:'UNIDISK',UNIT:'2',ROLE:'BODY'}});

    const addresses=v2.layers.map(layer=>`A2P.${layer.slotN}.${layer.id}`);
    assert.equal(new Set(addresses).size,addresses.length,'every converted v2 layer must have a unique qualified runtime address');
});
