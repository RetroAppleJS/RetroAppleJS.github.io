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

test('HD20 exposes one 40 by 64 grid with 16 contiguous blocks per surface cell',()=>{
    const context=loadContext();
    const {disk}=mountedHD20(context);
    const g=disk.getSurfaceMapGeometry();

    assert.deepEqual(JSON.parse(JSON.stringify(g)),{
        kind:'logical-block-surface',
        panels:1,
        columnsPerPanel:40,
        rowsPerPanel:64,
        cellsPerPanel:2560,
        blocksPerCell:16,
        bytesPerCell:8192,
        blocksPerPanel:40960,
        blocksPerPage:40960,
        pageCount:1,
        bytesPerBlock:512,
        totalBlocks:40960,
        totalBytes:20971520
    });

    assert.deepEqual(JSON.parse(JSON.stringify(disk.surfaceCellToBlockRange(0,0,0,0))),
        {startBlock:0,endBlock:15,offset:0,bytes:8192});
    assert.deepEqual(JSON.parse(JSON.stringify(disk.surfaceCellToBlockRange(0,0,31,39))),
        {startBlock:20464,endBlock:20479,offset:10477568,bytes:8192});
    assert.deepEqual(JSON.parse(JSON.stringify(disk.surfaceCellToBlockRange(0,0,32,0))),
        {startBlock:20480,endBlock:20495,offset:10485760,bytes:8192});
    assert.deepEqual(JSON.parse(JSON.stringify(disk.surfaceCellToBlockRange(0,0,63,39))),
        {startBlock:40944,endBlock:40959,offset:20963328,bytes:8192});
});

test('HD20 surface map renders the entire disk as one Disk II styled 40 by 64 grid',()=>{
    const context=loadContext();
    const {card}=mountedHD20(context);
    const html=card.deviceToolSurfaceMapHTML(1,0xC07E);

    assert.match(html,/Instance #C07E · 20 MiB · 40960 × 512-byte blocks · 2560 × 8 KiB cells/);
    assert.match(html,/0–20 MiB/);
    assert.doesNotMatch(html,/0–10 MiB|10–20 MiB/);
    assert.equal((html.match(/data-surface-cell="1"/g)||[]).length,2560);
    assert.equal((html.match(/data-active="1"/g)||[]).length,2560);
    assert.equal((html.match(/class="liron-surface-side liron-surface-hd20-panel"/g)||[]).length,1);
    assert.match(html,/grid-template-columns:36px repeat\(40,10px\)/);
    assert.match(html,/grid-template-rows:repeat\(64,10px\)/);
    assert.match(html,/display:block;width:10px;height:10px;box-sizing:border-box;border:1px solid #333;background:/);
    assert.doesNotMatch(html,/border-top-width:2px/);
    assert.doesNotMatch(html,/<style>\.liron-surface-hd20 \.liron-surface-cell/);
    assert.doesNotMatch(html,/Previous MiB|Next MiB/);
    assert.match(html,/data-start-block="0"[^>]*data-end-block="15"/);
    assert.match(html,/data-start-block="20464"[^>]*data-end-block="20479"/);
    assert.match(html,/data-start-block="20480"[^>]*data-end-block="20495"/);
    assert.match(html,/data-start-block="40944"[^>]*data-end-block="40959"/);
});

test('HD20 surface cell density aggregates all 8192 bytes in its sixteen blocks',()=>{
    const context=loadContext();
    const {card,disk}=mountedHD20(context);
    const image=new Uint8Array(20971520);
    image.fill(0xFF,0,512);
    image.fill(0x80,15*512,16*512);
    disk.loadImage(image,{filename:'DENSITY.po'});

    const html=card.deviceToolSurfaceMapHTML(1,0xC07E);
    const first=html.match(/<span[^>]*data-start-block="0"[^>]*>/);
    assert.ok(first,'first 8 KiB surface cell must exist');
    assert.match(first[0],/data-density="13"/);
    assert.match(first[0],/title="Blocks 0–15 · 8 KiB · offset 0–8191 · nonzero=1024\/8192/);
});

test('HD20 read/write activity highlights the 8 KiB cell containing the exact block',()=>{
    const context=loadContext();
    const {card,disk}=mountedHD20(context);

    assert.equal(disk.readBlock(2500).error,0);
    assert.deepEqual(JSON.parse(JSON.stringify(disk.getHeadSurfacePosition())),
        {page:0,panel:0,row:3,column:36,block:2500,offset:1280000,bytes:512});

    let html=card.deviceToolSurfaceMapHTML(1,0xC07E);
    assert.match(html,/data-start-block="2496"[^>]*data-end-block="2511"[^>]*data-head="1"/);
    assert.match(html,/Head block 2500/);

    const data=new Uint8Array(512); data.fill(0xA5);
    assert.equal(disk.writeBlock(40959,data).error,0);
    assert.deepEqual(JSON.parse(JSON.stringify(disk.getHeadSurfacePosition())),
        {page:0,panel:0,row:63,column:39,block:40959,offset:20971008,bytes:512});

    html=card.deviceToolSurfaceMapHTML(1,0xC07E);
    assert.match(html,/data-start-block="40944"[^>]*data-end-block="40959"[^>]*data-head="1"/);
});

test('HD20 surface map remains a single full-disk view',()=>{
    const context=loadContext();
    const {card}=mountedHD20(context);

    assert.equal(card.deviceToolSurfaceMapSetPage(19,1,0xC07E),0);
    assert.equal(card.deviceToolSurfaceMapSetPage(-1,1,0xC07E),0);
    const html=card.deviceToolSurfaceMapHTML(1,0xC07E);
    assert.match(html,/0–20 MiB/);
    assert.match(html,/data-end-block="40959"/);
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
