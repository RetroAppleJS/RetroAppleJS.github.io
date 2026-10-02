'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function makeCard(extras={})
{
    const sandbox={console,Uint8Array,ArrayBuffer,...extras};
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../res/EMU_CARD_dithertizer.js'),'utf8'),sandbox);
    return new sandbox.DithertizerII();
}

function capture(card,threshold,page2=false)
{
    const ram=new Uint8Array(65536).fill(0xA5);
    card.writeSlotIO(0,threshold,{});
    card.readSlotIO(8,{vid:{state:{page2}},hw:{write(a,d){ram[a]=d;}}});
    return ram;
}

test('brightness, contrast and gamma adjust luminance before the programmable comparator',()=>{
    const card=makeCard();
    card.setCameraSource({getLumaFrame(){return new Uint8Array(280*192).fill(64);}});
    assert.equal(capture(card,100)[0x2000],0);
    assert.equal(card.deviceToolSetting('','brightness',25),true);
    assert.equal(capture(card,100)[0x2000],0x7F,'+25% brightness moves 64 to 128');
    card.deviceToolSetting('','brightness',0);
    card.deviceToolSetting('','gamma',200);
    assert.equal(capture(card,100)[0x2000],0x7F,'gamma 2 brightens 64 to 128');
    card.deviceToolSetting('','gamma',100);
    card.deviceToolSetting('','contrast',0);
    assert.equal(capture(card,128)[0x2000],0x7F,'zero contrast gives middle grey');
    assert.equal(capture(card,129)[0x2000],0);
    card.deviceToolSetting('','contrast',200);
    assert.equal(capture(card,2)[0x2000],0,'double contrast moves 64 to rounded luminance 1');
});

test('no camera supplies black luminance rather than a synthetic HGR checker',()=>{
    const card=makeCard();
    const ram=capture(card,128);
    assert.equal(ram[0x2001],0);
    assert.equal(ram[0x2400],0);
    assert.equal(capture(card,0)[0x2000],0x7F,'zero luminance passes a zero threshold');
});

test('obsolete conversion settings are rejected and adjustment values are bounded',()=>{
    const card=makeCard();
    for(const setting of ['mode','preset','error','offset','luma','shift','filter','rate'])
        assert.equal(card.deviceToolSetting('',setting,100),false,setting);
    for(const setting of ['brightness','contrast','gamma'])
        assert.equal(card.deviceToolSetting('',setting,NaN),false,setting);
    assert.equal(card.deviceToolSetting('','gamma',0),true);
    const html=card.deviceToolSlotHTML({slotID:'S7',slotN:8});
    assert.match(html,/id="dither_ctrl_S7_gamma"[^>]*value="10"/);
});
