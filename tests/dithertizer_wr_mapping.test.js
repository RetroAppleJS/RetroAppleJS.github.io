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
    vm.runInContext(source+'\n;this.__ctor=DithertizerII;',sandbox,{filename:'EMU_CARD_dithertizer.js'});
    return sandbox.__ctor;
}

test('$C0F8 capture writes through production Apple2Hw WR[] mapping when hw.write is absent',()=>{
    const DithertizerII=loadCard();
    const card=new DithertizerII();
    card.setCameraSource({getLumaFrame(){
        const frame=new Uint8Array(280*192);
        for(let y=0;y<192;y++)
            for(let x=0;x<280;x++)
                frame[y*280+x]=((Math.floor(x/7)+y)&1) ? 255 : 0;
        return frame;
    }});
    card.writeSlotIO(0,128,{});
    const writes=new Map();
    const hw={
        WR:new Array(16),
        lineDecode(addr){return (addr&0xFFFF)>>12;}
    };

    hw.WR[2]=(addr,d8)=>writes.set(addr&0xFFFF,d8&0xFF);
    hw.WR[3]=(addr,d8)=>writes.set(addr&0xFFFF,d8&0xFF);
    hw.WR[4]=(addr,d8)=>writes.set(addr&0xFFFF,d8&0xFF);
    hw.WR[5]=(addr,d8)=>writes.set(addr&0xFFFF,d8&0xFF);

    assert.equal(typeof hw.write,'undefined','production Apple2Hw exposes WR[] rather than hw.write()');

    const ctx={bRO:false,vid:{state:{page2:false}},hw};
    card.readSlotIO(0x08,ctx);

    assert.equal(card.state.captureEnabled,true);
    assert.equal(card.state.page2,false);
    assert.equal(writes.size,192*40);
    assert.equal(writes.get(0x2000),0x00);
    assert.equal(writes.get(0x2001),0x7F);
    assert.equal(writes.get(0x2400),0x7F);
    assert.equal(writes.get(0x2401),0x00);
    assert.equal(writes.get(0x2028),0x00);
    assert.equal(writes.has(0x4000),false);
});
