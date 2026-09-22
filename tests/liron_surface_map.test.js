'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const deviceSource=fs.readFileSync('res/EMU_DEVICE_UNIDISK35.js','utf8');
const cardSource=fs.readFileSync('res/EMU_CARD_LIRON.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

function loadCard(extra={})
{
    const context=vm.createContext(Object.assign({
        console,
        Uint8Array,Array,Number,String,Object,Math,RangeError,Error,Reflect,
        EMU_deviceMediaRowHTML(){return '';}
    },extra));
    context.oEMU={component:{IO:{ACTION_MAP:{Hslot:null,RD:new Array(0x1000),WR:new Array(0x1000)}}}};
    vm.runInContext(deviceSource,context,{filename:'EMU_DEVICE_UNIDISK35.js'});
    vm.runInContext(cardSource,context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

function mountedDisk(context,hash=0x9B05)
{
    const card=new context.AppleLiron();
    card.mount={slotN:6};
    const disk=new context.UniDisk35Device(card.deviceConfig[0]);
    disk.attach={hash};
    assert.equal(disk.bindHost(card),true);
    card.devices=[disk];
    return {card,disk};
}

test('index owns an independent scoped Liron surface-map popup',()=>{
    assert.match(indexSource,/id=["']lironSurfaceMap_popup["']/);
    assert.match(indexSource,/id=["']lironSurfaceMap_popup_text["']/);
    assert.match(indexSource,/addScope\(["']lironSurfaceMap_popup["'],["']tab1\.2["']\)/);
    assert.match(indexSource,/\.liron-surface-grid/);
});

test('UniDisk surface map renders two 80 by 12 sides with exactly 1600 active 512-byte sectors',()=>{
    const context=loadCard();
    const {card,disk}=mountedDisk(context);
    disk.loadImage(new Uint8Array(819200),{filename:'TOOLS.po'});
    const html=card.deviceToolSurfaceMapHTML(1,0x9B05);

    assert.match(html,/Disk Surface Map — UNIDISK Unit1/);
    assert.match(html,/Instance #9B05 · 800 KB · 1600 × 512-byte sectors/);
    assert.ok(html.indexOf('data-side="0"') < html.indexOf('data-side="1"'));
    assert.equal((html.match(/data-surface-cell="1"/g)||[]).length,1920);
    assert.equal((html.match(/data-active="1"/g)||[]).length,1600);
    assert.equal((html.match(/data-active="0"/g)||[]).length,320);
    assert.equal((html.match(/data-zone-end="1"/g)||[]).length,96);

    const blocks=[...html.matchAll(/data-block="(\d+)"/g)].map(m=>Number(m[1]));
    assert.equal(blocks.length,1600);
    assert.equal(new Set(blocks).size,1600);
    assert.deepEqual(blocks.slice().sort((a,b)=>a-b),Array.from({length:1600},(_,i)=>i));
    assert.match(html,/data-offset="0"/);
    assert.match(html,/data-offset="818688"/);
    assert.match(html,/title="Side 1 · Track 27 · Sector 8 · 512 bytes"/);
});

test('UniDisk surface map keeps exact instance identity and handles stale or empty media explicitly',()=>{
    const context=loadCard();
    const {card,disk}=mountedDisk(context);
    let html=card.deviceToolSurfaceMapHTML(1,0x9B05);
    assert.match(html,/No media loaded/);
    assert.doesNotMatch(html,/data-surface-cell=/);

    disk.attach.hash=0xBEEF;
    html=card.deviceToolSurfaceMapHTML(1,0x9B05);
    assert.match(html,/Device instance is no longer attached/);
    assert.doesNotMatch(html,/data-surface-cell=/);
});

test('open UniDisk popup refreshes the same instance to no-media after eject',()=>{
    const popup={hidden:true};
    const text={innerHTML:''};
    const context=loadCard({
        document:{getElementById(id){return id==='lironSurfaceMap_popup'?popup:(id==='lironSurfaceMap_popup_text'?text:null);}},
        oCOM:{POPUP:{on(id){assert.equal(id,'lironSurfaceMap_popup');popup.hidden=false;return popup;}}}
    });
    const {card,disk}=mountedDisk(context);
    disk.loadImage(new Uint8Array(819200),{filename:'TOOLS.po'});

    assert.equal(card.deviceToolSurfaceMap(1,0x9B05),true);
    assert.equal(popup.hidden,false);
    assert.match(text.innerHTML,/data-surface-cell=/);
    disk.ejectImage();
    assert.equal(card.deviceToolSurfaceMapRefresh(),true);
    assert.match(text.innerHTML,/No media loaded/);
});
