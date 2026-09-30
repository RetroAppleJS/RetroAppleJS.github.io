'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname,'..');

function loadCard(extras={})
{
    const source=fs.readFileSync(path.join(ROOT,'res','EMU_CARD_dithertizer.js'),'utf8');
    const sandbox={console,Uint8Array,ArrayBuffer,Array,Number,String,Object,Math,RegExp,Promise,...extras};
    vm.createContext(sandbox);
    vm.runInContext(source+'\n;this.__ctor=DithertizerII;',sandbox,{filename:'EMU_CARD_dithertizer.js'});
    return sandbox.__ctor;
}

function render(card)
{
    return card.deviceToolSlotHTML({toolboxID:'device_tool_S7',slotID:'S7',slotN:8});
}

test('IMG row contains one compact camera pictogram toggle',()=>{
    const DithertizerII=loadCard();
    const html=render(new DithertizerII());

    assert.match(html,/data-dither-row="IMG"[\s\S]*id="dither_ctrl_S7_camera"/);
    assert.match(html,/id="dither_ctrl_S7_camera"[^>]*class="appbut skinny"/);
    assert.match(html,/id="dither_ctrl_S7_camera"[^>]*aria-pressed="false"/);
    assert.match(html,/id="dither_ctrl_S7_camera"[\s\S]*fa-camera/);
    assert.match(html,/deviceToolCameraToggle\('dither_ctrl_S7'\)/);
});

test('camera toggle starts and stops getUserMedia video stream without touching cameraSource',async()=>{
    const calls=[];
    let stopped=0;
    const stream={getTracks(){return [{stop(){stopped++;}},{stop(){stopped++;}}];}};
    const navigator={mediaDevices:{async getUserMedia(constraints){calls.push(constraints);return stream;}}};
    const DithertizerII=loadCard({navigator});
    const card=new DithertizerII();

    assert.equal(card.getCameraSource(),null);
    assert.equal(await card.deviceToolCameraToggle('dither_ctrl_S7'),true);
    assert.deepEqual(calls,[{video:true,audio:false}]);
    assert.equal(card.getCameraSource(),null,'host camera lifecycle stays separate from frame processing');
    assert.match(render(card),/id="dither_ctrl_S7_camera"[^>]*aria-pressed="true"/);

    assert.equal(await card.deviceToolCameraToggle('dither_ctrl_S7'),false);
    assert.equal(stopped,2);
    assert.equal(card.getCameraSource(),null);
    assert.match(render(card),/id="dither_ctrl_S7_camera"[^>]*aria-pressed="false"/);
});

test('camera toggle fails closed when getUserMedia is unavailable or rejected',async()=>{
    {
        const DithertizerII=loadCard({navigator:{}});
        const card=new DithertizerII();
        assert.equal(await card.deviceToolCameraToggle('dither_ctrl_S7'),false);
        assert.match(render(card),/id="dither_ctrl_S7_camera"[^>]*aria-pressed="false"/);
    }

    {
        const navigator={mediaDevices:{async getUserMedia(){throw new Error('denied');}}};
        const DithertizerII=loadCard({navigator});
        const card=new DithertizerII();
        assert.equal(await card.deviceToolCameraToggle('dither_ctrl_S7'),false);
        assert.match(render(card),/id="dither_ctrl_S7_camera"[^>]*aria-pressed="false"/);
    }
});

test('reset and restart stop all host-camera tracks',async()=>{
    let stopped=0;
    const makeStream=()=>({getTracks(){return [{stop(){stopped++;}},{stop(){stopped++;}}];}});
    let current=makeStream();
    const navigator={mediaDevices:{async getUserMedia(){return current;}}};
    const DithertizerII=loadCard({navigator});
    const card=new DithertizerII();

    await card.deviceToolCameraToggle('dither_ctrl_S7');
    card.reset();
    assert.equal(stopped,2);
    assert.match(render(card),/id="dither_ctrl_S7_camera"[^>]*aria-pressed="false"/);

    current=makeStream();
    await card.deviceToolCameraToggle('dither_ctrl_S7');
    card.restart();
    assert.equal(stopped,4);
    assert.match(render(card),/id="dither_ctrl_S7_camera"[^>]*aria-pressed="false"/);
});
