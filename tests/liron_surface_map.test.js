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

function syntheticProDOSImage()
{
    const image=new Uint8Array(819200);
    const block=(n)=>n*512;
    const put16=(offset,value)=>{
        image[offset]=value&0xFF;
        image[offset+1]=(value>>8)&0xFF;
    };
    const markUsed=(n)=>{
        const offset=block(6)+(n>>3);
        image[offset] &= ~(0x80>>(n&7));
    };

    // Volume directory header in block 2.
    image[block(2)+4]=0xF4;
    image.set(Buffer.from('TEST','ascii'),block(2)+5);
    image[block(2)+0x23]=0x27;
    image[block(2)+0x24]=0x0D;
    put16(block(2)+0x25,1);
    put16(block(2)+0x27,6);
    put16(block(2)+0x29,1600);

    // Bitmap starts as entirely free.
    image.fill(0xFF,block(6),block(7));
    for(const used of [0,1,2,6,10,11]) markUsed(used);

    // One sapling file: index block 10 -> data block 11.
    const entry=block(2)+4+0x27;
    image[entry]=0x24;
    image.set(Buffer.from('FILE','ascii'),entry+1);
    image[entry+0x10]=0x06;
    put16(entry+0x11,10);
    put16(entry+0x13,2);
    put16(entry+0x25,2);
    image[block(10)]=11;
    image[block(10)+256]=0;
    image[block(11)]=0xA5;

    return image;
}

test('index owns an independent scoped Liron surface-map popup',()=>{
    assert.match(indexSource,/id=["']lironSurfaceMap_popup["']/);
    assert.match(indexSource,/id=["']lironSurfaceMap_popup_text["']/);
    assert.match(indexSource,/addScope\(["']lironSurfaceMap_popup["'],["']tab1\.2["']\)/);
    assert.match(indexSource,/\.liron-surface-grid/);
});

test('UniDisk surface map renders two clockwise-rotated 12 by 80 sides with exactly 1600 active 512-byte sectors',()=>{
    const context=loadCard();
    const {card,disk}=mountedDisk(context);
    disk.loadImage(new Uint8Array(819200),{filename:'TOOLS.po'});
    const html=card.deviceToolSurfaceMapHTML(1,0x9B05);

    assert.match(html,/>Disk surface map<\/b>/);
    assert.doesNotMatch(html,/Disk Surface Map — UNIDISK Unit1/);
    assert.match(html,/Instance #9B05 · 800 KB · 1600 × 512-byte sectors/);
    assert.match(html,/id="lironSurfaceMap_monitoring"/);
    assert.match(html,/title="Disk surface map sync"/);
    assert.ok(html.indexOf('data-side="0"') < html.indexOf('data-side="1"'));
    assert.equal((html.match(/data-surface-cell="1"/g)||[]).length,1920);
    assert.equal((html.match(/data-active="1"/g)||[]).length,1600);
    assert.equal((html.match(/data-active="0"/g)||[]).length,320);

    const blocks=[...html.matchAll(/data-block="(\d+)"/g)].map(m=>Number(m[1]));
    assert.equal(blocks.length,1600);
    assert.equal(new Set(blocks).size,1600);
    assert.deepEqual(blocks.slice().sort((a,b)=>a-b),Array.from({length:1600},(_,i)=>i));
    assert.match(html,/data-offset="0"/);
    assert.match(html,/data-offset="818688"/);
    assert.ok(html.indexOf('data-track="0" data-sector="11"') < html.indexOf('data-track="0" data-sector="10"'));
    assert.ok(html.indexOf('data-track="0" data-sector="10"') < html.indexOf('data-track="1" data-sector="11"'));
    assert.match(html,/title="Side 1 · Track 27 · Sector 8 · Block \d+ · 512 bytes · nonzero=0\/512 · avg=0"/);
    assert.match(html,/grid-template-columns:22px repeat\(12,10px\)/);
    assert.match(html,/grid-template-rows:repeat\(80,10px\)/);
    assert.match(html,/data-track-label="0"[^>]*>T0<\/span>/);
    assert.match(html,/data-track-label="79"[^>]*>T79<\/span>/);
    assert.match(html,/width:10px;height:10px;box-sizing:border-box;border:1px solid #333/);
});

test('UniDisk surface map uses the Disk II data-density palette',()=>{
    const context=loadCard();
    const {card,disk}=mountedDisk(context);
    const image=new Uint8Array(819200);
    image.fill(0xFF,0,512);
    image.fill(0x80,512,768);
    disk.loadImage(image,{filename:'DENSITY.po'});

    const html=card.deviceToolSurfaceMapHTML(1,0x9B05);
    const cell=(block)=>{
        const match=html.match(new RegExp('<span[^>]*data-block="'+block+'"[^>]*>'));
        assert.ok(match,'surface cell for block '+block+' must exist');
        return match[0];
    };

    assert.match(cell(0),/data-density="100"/);
    assert.match(cell(0),/background:#FDEA27/);
    assert.match(cell(1),/data-density="50"/);
    assert.match(cell(2),/data-density="0"/);
    assert.match(cell(2),/background:#000000/);
    assert.doesNotMatch(html,/liron-surface-legend/);
    assert.doesNotMatch(html,/data-content=/);
});

test('UniDisk surface map marks the current head position',()=>{
    const context=loadCard();
    const {card,disk}=mountedDisk(context);
    disk.loadImage(new Uint8Array(819200),{filename:'HEAD.po'});
    disk.readBlock(24);

    const html=card.deviceToolSurfaceMapHTML(1,0x9B05);
    assert.match(html,/data-side="0" data-track="1" data-sector="0"[^>]*data-head="1"/);
    assert.match(html,/outline:2px solid #FFF/);
});

test('UniDisk popup joins the rightmost visible toolbox with a five pixel gap',()=>{
    const popup={style:{}};
    const boxes=[
        {
            hidden:false,
            getBoundingClientRect(){return {left:20,right:250,top:60,width:230,height:60};}
        },
        {
            hidden:false,
            getBoundingClientRect(){return {left:260,right:620,top:58,width:360,height:64};}
        }
    ];
    const context=loadCard({
        document:{
            getElementById(id){return id==='lironSurfaceMap_popup'?popup:null;},
            querySelectorAll(selector){return selector==='.toolbox'?boxes:[];}
        },
        window:{
            innerWidth:1400,
            innerHeight:900,
            scrollX:40,
            scrollY:300,
            getComputedStyle(){return {display:'block',visibility:'visible'};}
        }
    });
    const {card}=mountedDisk(context);

    assert.equal(card.deviceToolSurfaceMapPosition(1),true);
    assert.equal(popup.style.position,'absolute');
    assert.equal(popup.style.left,'665px');
    assert.equal(popup.style.right,'auto');
    assert.equal(popup.style.top,'358px');
    assert.equal(popup.style.width,'326px');
});

test('UniDisk surface-map sync uses the shared dashboard refresh and never creates a private timer',()=>{
    let scheduled=0;
    const icon={className:'fa fa-sync-alt'};
    const context=loadCard({
        document:{getElementById(id){return id==='lironSurfaceMap_monitoring'?icon:null;}},
        setInterval(){scheduled++; return 1;},
        clearInterval(){}
    });
    const {card}=mountedDisk(context);

    assert.equal(card.deviceToolSurfaceMapToggleSync(true),true);
    assert.equal(icon.className,'fa fa-stop-circle');
    assert.equal(scheduled,0,'UniDisk sync must not create a private refresh timer');
    assert.equal(typeof card.deviceToolSurfaceMapMonitoring,'function');

    assert.equal(card.deviceToolSurfaceMapToggleSync(false),false);
    assert.equal(icon.className,'fa fa-sync-alt');
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
