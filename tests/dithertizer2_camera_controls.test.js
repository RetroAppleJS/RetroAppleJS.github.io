'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
function harness()
{
    const calls=[];
    let drawings=0,stopped=0;
    const page=new Uint8Array(8192);page[0]=0xD5;
    const elements={
        ctrl_error:{disabled:false},ctrl_offset:{disabled:false}
    };
    const video={videoWidth:280,videoHeight:192,async play(){},pause(){}};
    const context={drawImage(){drawings++;},getImageData(){return {data:new Uint8ClampedArray(280*192*4)};}};
    const document={getElementById(id){return elements[id]||null;},createElement(kind){
        return kind==='video' ? video : {getContext(){return context;}};
    }};
    class Adapter
    {
        constructor(options){this.backend=options.backend;}
        async init(){}
        setBackend(value){this.backend=value;}
        configure(settings){this.settings=settings;}
        async convert(rgb,width,height)
        {
            calls.push({backend:this.backend,settings:this.settings,width,height});
            return {hgrPage:page};
        }
        close(){}
    }
    const sandbox={console,Uint8Array,Uint8ClampedArray,ArrayBuffer,Promise,
        DithertizerConvertHGRAdapter:Adapter,document,
        navigator:{mediaDevices:{async getUserMedia(){return {getTracks(){return [{stop(){stopped++;}}];}};}}},
        setTimeout(){throw new Error('RATE timer must not exist');}
    };
    vm.createContext(sandbox);
    for(const filename of ['EMU_DEVICE_camera.js','EMU_CARD_dithertizer2.js'])
        vm.runInContext(fs.readFileSync(path.join(ROOT,'res',filename),'utf8'),sandbox,{filename});
    const card=new sandbox.DithertizerII_2();
    new sandbox.DithertizerCameraDevice().bindHost(card);
    return {card,calls,elements,get drawings(){return drawings;},get stopped(){return stopped;}};
}

test('DITHER2 exposes compact OFFSET next to MODE and enforces mode-dependent controls',()=>{
    const {card,elements}=harness();
    let html=card.deviceToolSlotHTML({slotID:'S7',slotN:8});
    assert.ok(html.indexOf('_mode"')<html.indexOf('_offset"'));
    assert.ok(html.indexOf('_offset"')<html.indexOf('_preset"'));
    assert.doesNotMatch(html,/id="dither_ctrl_S7_rate"/);
    assert.match(html,/id="dither_ctrl_S7_wasm"[^>]*aria-pressed="true"/);
    assert.match(html,/id="dither_ctrl_S7_offset"[^>]*disabled/);
    assert.equal(card.deviceToolSetting('ctrl','mode','none'),true);
    assert.equal(elements.ctrl_error.disabled,true);
    assert.equal(elements.ctrl_offset.disabled,true);
    assert.equal(card.deviceToolSetting('ctrl','error','average'),false);
    assert.equal(card.deviceToolSetting('ctrl','offset',8),false);
    html=card.deviceToolSlotHTML({slotID:'S7',slotN:8});
    assert.match(html,/id="dither_ctrl_S7_error"[^>]*disabled/);
    assert.equal(card.deviceToolSetting('ctrl','mode','order1'),true);
    assert.equal(elements.ctrl_error.disabled,false);
    assert.equal(elements.ctrl_offset.disabled,false);
    assert.equal(card.deviceToolSetting('ctrl','offset',8),true);
    assert.equal(card.deviceToolSetting('ctrl','mode','diffusion'),true);
    assert.equal(elements.ctrl_error.disabled,false);
    assert.equal(elements.ctrl_offset.disabled,true);
});

test('DITHER2 samples once per display frame and passes chosen WASM or JS backend',async()=>{
    const h=harness();
    assert.equal(await h.card.deviceToolCameraToggle('ctrl'),true);
    assert.equal(h.drawings,1);
    assert.deepEqual(h.calls.map(c=>c.backend),['wasm']);
    h.card.cycle();
    await new Promise(setImmediate);
    assert.equal(h.drawings,2);
    assert.equal(h.card.deviceToolWasmToggle('ctrl'),false);
    h.card.deviceToolSetting('ctrl','mode','none');
    h.card.cycle();
    await new Promise(setImmediate);
    assert.deepEqual(h.calls.map(c=>c.backend),['wasm','wasm','javascript']);
    assert.deepEqual(Object.values(h.calls[2].settings.dither.error),[0,0,0,0,0,0]);
    assert.equal(h.calls[2].settings.dither.accumulateErrors,false);
    const writes=new Map();
    h.card.readSlotIO(0x08,{vid:{state:{page2:true}},hw:{write(a,v){writes.set(a,v);}}});
    assert.equal(writes.get(0x4000),0xD5);
    assert.equal(await h.card.deviceToolCameraToggle('ctrl'),false);
    assert.equal(h.stopped,1);
});
