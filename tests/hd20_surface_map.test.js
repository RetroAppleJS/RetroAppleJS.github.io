'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const hd20Source=fs.readFileSync('res/EMU_DEVICE_HD20.js','utf8');
const cardSource=fs.readFileSync('res/EMU_CARD_LIRON.js','utf8');

function loadCard(extra={})
{
    const context=vm.createContext(Object.assign({
        console,
        Uint8Array,Array,Number,String,Object,Math,RangeError,Error,Reflect,
        EMU_deviceMediaRowHTML(){return '';}
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

test('HD20 exposes the canonical 10px paged logical-block surface geometry',()=>{
    const context=loadCard();
    const {disk}=mountedHD20(context);
    assert.equal(typeof disk.getSurfaceMapGeometry,'function');
    assert.deepEqual(JSON.parse(JSON.stringify(disk.getSurfaceMapGeometry())),{
        kind:'logical-blocks',
        cellWidth:10,
        cellHeight:10,
        bytesPerBlock:512,
        totalBlocks:40960,
        columnsPerPanel:16,
        rowsPerPanel:64,
        blocksPerPanel:1024,
        panelsPerPage:2,
        blocksPerPage:2048,
        bytesPerPage:1048576,
        pageCount:20
    });
});

test('HD20 maps every last-accessed block to page panel row and column exactly',()=>{
    const context=loadCard();
    const {disk}=mountedHD20(context);
    const block=new Uint8Array(512);

    assert.equal(disk.readBlock(0).error,0);
    assert.deepEqual(JSON.parse(JSON.stringify(disk.getSurfaceMapPosition())),{block:0,page:0,panel:0,row:0,column:0});

    assert.equal(disk.writeBlock(2047,block).error,0);
    assert.deepEqual(JSON.parse(JSON.stringify(disk.getSurfaceMapPosition())),{block:2047,page:0,panel:1,row:63,column:15});

    assert.equal(disk.readBlock(2048).error,0);
    assert.deepEqual(JSON.parse(JSON.stringify(disk.getSurfaceMapPosition())),{block:2048,page:1,panel:0,row:0,column:0});

    assert.equal(disk.readBlock(40959).error,0);
    assert.deepEqual(JSON.parse(JSON.stringify(disk.getSurfaceMapPosition())),{block:40959,page:19,panel:1,row:63,column:15});
});

test('HD20 page zero renders two 16 by 64 panels with one canonical 10px cell per 512-byte block',()=>{
    const context=loadCard();
    const {card}=mountedHD20(context);
    const html=card.deviceToolSurfaceMapHTML(1,0xC07E);

    assert.match(html,/>Disk surface map<\/b>/);
    assert.match(html,/Instance #C07E · 20 MiB · 40960 × 512-byte blocks/);
    assert.match(html,/MiB 0 \/ 19/);
    assert.match(html,/0–512 KiB/);
    assert.match(html,/512 KiB–1 MiB/);
    assert.equal((html.match(/data-hd20-panel=/g)||[]).length,2);
    assert.equal((html.match(/data-surface-cell="1"/g)||[]).length,2048);
    assert.equal((html.match(/data-active="1"/g)||[]).length,2048);

    const blocks=[...html.matchAll(/data-block="(\d+)"/g)].map(m=>Number(m[1]));
    assert.equal(blocks.length,2048);
    assert.equal(new Set(blocks).size,2048);
    assert.equal(Math.min(...blocks),0);
    assert.equal(Math.max(...blocks),2047);
    assert.match(html,/grid-template-columns:36px repeat\(16,10px\)/);
    assert.match(html,/grid-template-rows:repeat\(64,10px\)/);
    assert.match(html,/width:10px;height:10px;box-sizing:border-box;border:1px solid #333/);
    assert.match(html,/data-row="63" data-column="15" data-block="1023"/);
    assert.match(html,/data-row="63" data-column="15" data-block="2047"/);
});

test('HD20 surface map pages cover the complete 20 MiB image without aggregation',()=>{
    const context=loadCard();
    const {card}=mountedHD20(context);

    assert.equal(card.deviceToolSurfaceMapSetPage(19),19);
    const html=card.deviceToolSurfaceMapHTML(1,0xC07E);
    assert.match(html,/MiB 19 \/ 19/);
    assert.match(html,/19–19\.5 MiB/);
    assert.match(html,/19\.5–20 MiB/);

    const blocks=[...html.matchAll(/data-block="(\d+)"/g)].map(m=>Number(m[1]));
    assert.equal(blocks.length,2048);
    assert.equal(Math.min(...blocks),38912);
    assert.equal(Math.max(...blocks),40959);

    assert.equal(card.deviceToolSurfaceMapSetPage(20),19,'page must clamp to the final MiB');
    assert.equal(card.deviceToolSurfaceMapSetPage(-1),0,'page must clamp to the first MiB');
});

test('HD20 toolbox row exposes an always-enabled Surface Map capability',()=>{
    const rows=[];
    const context=loadCard({EMU_deviceMediaRowHTML(spec){rows.push(spec);return '<row></row>';}});
    const {card,disk}=mountedHD20(context);
    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:[disk]});

    assert.equal(rows.length,1);
    assert.equal(rows[0].label,'HD20 Unit1');
    assert.equal(rows[0].capabilityActions.length,1);
    assert.equal(rows[0].capabilityActions[0].id,'liron_unit_5_1_surface');
    assert.equal(rows[0].capabilityActions[0].title,'Disk Surface Map');
    assert.equal(rows[0].capabilityActions[0].disabled,false);
    assert.match(rows[0].capabilityActions[0].onClick,/deviceToolSurfaceMapToggle\(1,49278\)/);
});
