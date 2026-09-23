'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const hd20Source=fs.readFileSync('res/EMU_DEVICE_HD20.js','utf8');
const cardSource=fs.readFileSync('res/EMU_CARD_LIRON.js','utf8');

function loadContext(extra={})
{
    const context=vm.createContext(Object.assign({
        console,
        Uint8Array,Array,Number,String,Object,Math,RangeError,Error,Reflect,
        EMU_deviceMediaRowHTML(spec){return JSON.stringify(spec);}
    },extra));
    context.oEMU={component:{IO:{ACTION_MAP:{Hslot:null,RD:new Array(0x1000),WR:new Array(0x1000)}}}};
    vm.runInContext(hd20Source,context,{filename:'EMU_DEVICE_HD20.js'});
    vm.runInContext(cardSource,context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

function mountedHD20(context,hash=0xC07E)
{
    const card=new context.AppleLiron();
    card.mount={slotN:6};
    const disk=new context.HD20Device(card.deviceConfig[1]);
    disk.attach={hash};
    assert.equal(disk.bindHost(card),true);
    card.devices=[disk];
    return {card,disk};
}

test('HD20 exposes the entire 20 MiB surface as two 10 MiB block grids',()=>{
    const context=loadContext();
    const {disk}=mountedHD20(context);
    const g=disk.getSurfaceMapGeometry();

    assert.deepEqual(JSON.parse(JSON.stringify(g)),{
        kind:'logical-block-surface',
        panels:2,
        columnsPerPanel:160,
        rowsPerPanel:128,
        blocksPerPanel:20480,
        blocksPerPage:40960,
        pageCount:1,
        bytesPerBlock:512,
        totalBlocks:40960,
        totalBytes:20971520
    });

    assert.deepEqual(JSON.parse(JSON.stringify(disk.blockToSurfaceCell(0))),
        {page:0,panel:0,row:0,column:0,block:0,offset:0,bytes:512});
    assert.deepEqual(JSON.parse(JSON.stringify(disk.blockToSurfaceCell(20480))),
        {page:0,panel:1,row:0,column:0,block:20480,offset:10485760,bytes:512});
    assert.deepEqual(JSON.parse(JSON.stringify(disk.blockToSurfaceCell(40959))),
        {page:0,panel:1,row:127,column:159,block:40959,offset:20971008,bytes:512});

    assert.equal(disk.surfaceCellToBlock(0,0,0,0),0);
    assert.equal(disk.surfaceCellToBlock(0,1,0,0),20480);
    assert.equal(disk.surfaceCellToBlock(0,1,127,159),40959);
});

test('HD20 surface map renders the full disk in one view as two side-by-side 10 MiB grids',()=>{
    const context=loadContext();
    const {card}=mountedHD20(context);
    const html=card.deviceToolSurfaceMapHTML(1,0xC07E);

    assert.match(html,/Instance #C07E · 20 MiB · 40960 × 512-byte blocks · entire disk/);
    assert.match(html,/0–10 MiB/);
    assert.match(html,/10–20 MiB/);
    assert.equal((html.match(/data-surface-cell="1"/g)||[]).length,40960);
    assert.equal((html.match(/data-active="1"/g)||[]).length,40960);
    assert.match(html,/grid-template-columns:36px repeat\(160,3px\)/);
    assert.match(html,/grid-template-rows:repeat\(128,3px\)/);
    assert.match(html,/width:3px;height:3px;box-sizing:border-box/);
    assert.doesNotMatch(html,/Previous MiB|Next MiB|MiB 0 \/ 0/);
    assert.match(html,/data-block="0"/);
    assert.match(html,/data-block="20479"/);
    assert.match(html,/data-block="20480"/);
    assert.match(html,/data-block="40959"/);
    assert.doesNotMatch(html,/data-block="40960"/);
});

test('HD20 surface map no longer pages and page requests clamp to the single full-disk view',()=>{
    const context=loadContext();
    const {card}=mountedHD20(context);

    assert.equal(card.deviceToolSurfaceMapSetPage(19,1,0xC07E),0);
    assert.equal(card.deviceToolSurfaceMapSetPage(-1,1,0xC07E),0);
    const html=card.deviceToolSurfaceMapHTML(1,0xC07E);
    assert.match(html,/0–10 MiB/);
    assert.match(html,/10–20 MiB/);
    assert.match(html,/data-block="40959"/);
});

test('HD20 read/write activity tracks the exact cell in the full-disk surface view',()=>{
    const context=loadContext();
    const {card,disk}=mountedHD20(context);

    assert.equal(disk.readBlock(2500).error,0);
    assert.deepEqual(JSON.parse(JSON.stringify(disk.getHeadSurfacePosition())),
        {page:0,panel:0,row:15,column:100,block:2500,offset:1280000,bytes:512});

    const data=new Uint8Array(512); data.fill(0xA5);
    assert.equal(disk.writeBlock(40959,data).error,0);
    assert.deepEqual(JSON.parse(JSON.stringify(disk.getHeadSurfacePosition())),
        {page:0,panel:1,row:127,column:159,block:40959,offset:20971008,bytes:512});

    card.deviceToolSurfaceMapSetPage(19,1,0xC07E);
    card.deviceToolSurfaceMapToggleSync(true);
    assert.equal(card.deviceToolSurfaceMapFollowHead(),0);
});

test('HD20 toolbox exposes the same Surface Map capability icon as UniDisk',()=>{
    const rows=[];
    const context=loadContext({EMU_deviceMediaRowHTML(spec){rows.push(spec);return '<row></row>';}});
    const {card,disk}=mountedHD20(context);
    card.deviceToolSlotHTML({slotN:6,slotID:'5',devices:[disk]});

    assert.equal(rows.length,1);
    assert.equal(rows[0].label,'HD20 Unit1');
    assert.equal(rows[0].capabilityActions.length,1);
    assert.equal(rows[0].capabilityActions[0].icon,'fa fa-th');
    assert.equal(rows[0].capabilityActions[0].disabled,false);
    assert.match(rows[0].capabilityActions[0].onClick,/deviceToolSurfaceMapToggle\(1,49278\)/);
});
