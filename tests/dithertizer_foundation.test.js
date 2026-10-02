'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname,'..');

function loadCard()
{
    const source=fs.readFileSync(path.join(ROOT,'res','EMU_CARD_dithertizer.js'),'utf8');
    const sandbox={console,Uint8Array,ArrayBuffer,Array,Number,String,Object,Math,RegExp};
    vm.createContext(sandbox);
    vm.runInContext(source+'\n;this.__ctor=DithertizerII;this.__discovery=oEMU.component.IO.DithertizerII;',sandbox,{filename:'EMU_CARD_dithertizer.js'});
    return {DithertizerII:sandbox.__ctor,discovery:sandbox.__discovery};
}

function makeFrame(fn)
{
    const out=new Uint8Array(280*192);
    for(let y=0;y<192;y++)
        for(let x=0;x<280;x++)
            out[y*280+x]=fn(x,y)&0xFF;
    return out;
}

test('Dithertizer II registers as PCODE DITHER and exposes SlotIO only',()=>{
    const {DithertizerII,discovery}=loadCard();
    const card=new DithertizerII();
    assert.equal(card.id.PCODE,'DITHER');
    assert.equal(discovery.id.PCODE,'DITHER');
    assert.equal(typeof card.action.SlotIO.RD.callback,'function');
    assert.equal(typeof card.action.SlotIO.WR.callback,'function');
    assert.equal(card.action.SlotROM,undefined);
    assert.equal(card.action.HostROM,undefined);
});

test('$C0F0 write latches threshold and disables capture',()=>{
    const {DithertizerII}=loadCard();
    const card=new DithertizerII();
    card.state.captureEnabled=true;
    card.writeSlotIO(0x00,0x93,{});
    assert.equal(card.state.threshold,0x93);
    assert.equal(card.state.captureEnabled,false);
});

test('$C0F8 read captures a thresholded frame into currently selected HGR page through hw.write',()=>{
    const {DithertizerII}=loadCard();
    const card=new DithertizerII();
    const frame=makeFrame((x)=>x<7 ? (x%2 ? 0x20 : 0xE0) : 0x00);
    card.setCameraSource({getLumaFrame(w,h){assert.equal(w,280);assert.equal(h,192);return frame;}});
    card.writeSlotIO(0x00,0x80,{});

    const writes=new Map();
    const ctx={
        bRO:false,
        vid:{state:{page2:false}},
        hw:{write(addr,d8){writes.set(addr&0xFFFF,d8&0xFF);}}
    };
    card.readSlotIO(0x08,ctx);

    assert.equal(card.state.captureEnabled,true);
    assert.equal(card.state.page2,false);
    assert.equal(writes.size,192*40);
    assert.equal(writes.get(0x2000),0b01010101);
    assert.equal(writes.get(0x2400),0b01010101,'HGR scanline 1 uses the native Apple interleave');
    assert.equal(writes.get(0x2028),0b01010101,'HGR scanline 64 advances by $28 inside the 64-line group');
    assert.equal(writes.has(0x4000),false);

    writes.clear();
    ctx.vid.state.page2=true;
    card.readSlotIO(0x08,ctx);
    assert.equal(card.state.page2,true);
    assert.equal(writes.get(0x4000),0b01010101);
    assert.equal(writes.get(0x4400),0b01010101);
    assert.equal(writes.get(0x4028),0b01010101);
});

test('$C0F8 read without camera source captures black luminance',()=>{
    const {DithertizerII}=loadCard();
    const card=new DithertizerII();
    card.writeSlotIO(0x00,0x80,{});

    const writes=new Map();
    const ctx={
        bRO:false,
        vid:{state:{page2:false}},
        hw:{write(addr,d8){writes.set(addr&0xFFFF,d8&0xFF);}}
    };

    card.readSlotIO(0x08,ctx);
    assert.equal(writes.size,192*40);
    assert.equal(writes.get(0x2000),0x00);
    assert.equal(writes.get(0x2001),0x00);
    assert.equal(writes.get(0x2400),0x00,'every row captures the same black source');
    assert.equal(writes.get(0x2401),0x00);
    assert.equal(writes.get(0x2028),0x00,'scanline 64 captures black');
    assert.equal(writes.has(0x4000),false);

    writes.clear();
    ctx.vid.state.page2=true;
    card.readSlotIO(0x08,ctx);
    assert.equal(writes.get(0x4000),0x00);
    assert.equal(writes.get(0x4001),0x00);
    assert.equal(writes.get(0x4400),0x00);
    assert.equal(writes.get(0x4401),0x00);
});

test('$C0F0 read exposes sync in D7 and ordinary reads stop capture while safe reads do not',()=>{
    const {DithertizerII}=loadCard();
    const card=new DithertizerII();
    let ticks=0;
    const ctx={io:{getClockTicks(){return ticks;}},bRO:false};

    card.state.captureEnabled=true;
    ticks=0;
    assert.equal(card.readSlotIO(0x00,ctx)&0x80,0x00,'frame starts with a long active-low sync interval');
    assert.equal(card.state.captureEnabled,false);

    card.state.captureEnabled=true;
    ticks=80;
    assert.equal(card.readSlotIO(0x00,{...ctx,bRO:true})&0x80,0x80,'sync returns high after the long low interval');
    assert.equal(card.state.captureEnabled,true,'safe debugger read must not stop capture');

    ticks=98;
    assert.equal(card.readSlotIO(0x00,{...ctx,bRO:true})&0x80,0x00,'a short low pulse follows the high interval');
    ticks=104;
    assert.equal(card.readSlotIO(0x00,{...ctx,bRO:true})&0x80,0x80,'short pulse returns high quickly enough for DSCAN');
});

test('capture resolves RAM writer through video.hw when ctx.hw is absent',()=>{
    const {DithertizerII}=loadCard();
    const card=new DithertizerII();
    card.setCameraSource({getLumaFrame(){return new Uint8Array(280*192).fill(255);}});
    card.writeSlotIO(0x00,0x80,{});
    let count=0;
    const ctx={vid:{state:{page2:false},hw:{write(){count++;}}}};
    card.readSlotIO(0x08,ctx);
    assert.equal(count,192*40);
});
