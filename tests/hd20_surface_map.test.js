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

test('HD20 exposes a 20-page logical surface geometry with one 512-byte block per 10px cell',()=>{
    const context=loadContext();
    const {disk}=mountedHD20(context);
    const g=disk.getSurfaceMapGeometry();

    assert.deepEqual(JSON.parse(JSON.stringify(g)),{
        kind:'logical-block-pages',
        panels:2,
        columnsPerPanel:16,
        rowsPerPanel:64,
        blocksPerPanel:1024,
        blocksPerPage:2048,
        pageCount:20,
        bytesPerBlock:512,
        totalBlocks:40960,
        totalBytes:20971520
    });

    assert.deepEqual(JSON.parse(JSON.stringify(disk.blockToSurfaceCell(0))),
        {page:0,panel:0,row:0,column:0,block:0,offset:0,bytes:512});
    assert.deepEqual(JSON.parse(JSON.stringify(disk.blockToSurfaceCell(1024))),
        {page:0,panel:1,row:0,column:0,block:1024,offset:524288,bytes:512});
    assert.deepEqual(JSON.parse(JSON.stringify(disk.blockToSurfaceCell(40959))),
        {page:19,panel:1,row:63,column:15,block:40959,offset:20971008,bytes:512});

    assert.equal(disk.surfaceCellToBlock(0,0,0,0),0);
    assert.equal(disk.surfaceCellToBlock(0,1,0,0),1024);
    assert.equal(disk.surfaceCellToBlock(19,1,63,15),40959);
});

test('HD20 surface map renders one MiB page as two 16 by 64 panels using Disk II 10px cells',()=>{
    const context=loadContext();
    const {card}=mountedHD20(context);
    const html=card.deviceToolSurfaceMapHTML(1,0xC07E);

    assert.match(html,/Instance #C07E · 20 MiB · 40960 × 512-byte blocks · MiB 0\/19/);
    assert.match(html,/0–512 KiB/);
    assert.match(html,/512 KiB–1 MiB/);
    assert.equal((html.match(/data-surface-cell="1"/g)||[]).length,2048);
    assert.equal((html.match(/data-active="1"/g)||[]).length,2048);
    assert.match(html,/grid-template-columns:30px repeat\(16,10px\)/);
    assert.match(html,/grid-template-rows:repeat\(64,10px\)/);
    assert.match(html,/width:10px;height:10px;box-sizing:border-box;border:1px solid #333/);

    const blocks=[...html.matchAll(/data-block="(\d+)"/g)].map(m=>Number(m[1]));
    assert.equal(blocks.length,2048);
    assert.deepEqual(blocks.slice().sort((a,b)=>a-b),Array.from({length:2048},(_,i)=>i));
});

test('HD20 surface map pages through all 20 MiB and page 19 ends at block 40959',()=>{
    const context=loadContext();
    const {card}=mountedHD20(context);

    assert.equal(card.deviceToolSurfaceMapSetPage(19),19);
    const html=card.deviceToolSurfaceMapHTML(1,0xC07E);
    assert.match(html,/MiB 19\/19/);
    assert.match(html,/19 MiB–19\.5 MiB/);
    assert.match(html,/19\.5 MiB–20 MiB/);
    assert.match(html,/data-block="38912"/);
    assert.match(html,/data-block="40959"/);
    assert.doesNotMatch(html,/data-block="40960"/);

    assert.equal(card.deviceToolSurfaceMapSetPage(20),19,'page clamps at the last MiB');
    assert.equal(card.deviceToolSurfaceMapSetPage(-1),0,'page clamps at zero');
});

test('HD20 read/write activity tracks the exact logical surface cell and sync page',()=>{
    const context=loadContext();
    const {card,disk}=mountedHD20(context);

    assert.equal(disk.readBlock(2500).error,0);
    assert.deepEqual(JSON.parse(JSON.stringify(disk.getHeadSurfacePosition())),
        {page:1,panel:0,row:28,column:4,block:2500,offset:1280000,bytes:512});

    const data=new Uint8Array(512); data.fill(0xA5);
    assert.equal(disk.writeBlock(40959,data).error,0);
    assert.deepEqual(JSON.parse(JSON.stringify(disk.getHeadSurfacePosition())),
        {page:19,panel:1,row:63,column:15,block:40959,offset:20971008,bytes:512});

    card.deviceToolSurfaceMapToggleSync(true);
    assert.equal(card.deviceToolSurfaceMapFollowHead(),19);
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
