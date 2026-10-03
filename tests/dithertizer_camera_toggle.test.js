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
    vm.runInContext(fs.readFileSync(path.join(ROOT,'res','EMU_DEVICE_camera.js'),'utf8'),sandbox);
    vm.runInContext(source+'\n;this.__ctor=DithertizerII;',sandbox,{filename:'EMU_CARD_dithertizer.js'});
    return function(){const card=new sandbox.__ctor();new sandbox.DithertizerCameraDevice().bindHost(card);return card;};
}

function render(card)
{
    return card.deviceToolSlotHTML({toolboxID:'device_tool_S7',slotID:'S7',slotN:8});
}

function assertCameraStatus(html,state)
{
    assert.match(html,new RegExp('id="dither_ctrl_S7_camera_status"[^>]*>'+state+'<'));
}

function makeCameraDOM()
{
    const icon={style:{color:''}};
    const button={
        attrs:{},
        title:'',
        setAttribute(name,value){this.attrs[name]=String(value);},
        querySelector(selector){return selector==='i' ? icon : null;}
    };
    const status={textContent:'OFF'};
    const nodes={
        'dither_ctrl_S7_camera':button,
        'dither_ctrl_S7_camera_status':status
    };
    return {
        document:{getElementById(id){return nodes[id] || null;}},
        button,
        icon,
        status
    };
}

test('IMG row contains one compact camera pictogram toggle with OFF status beside it',()=>{
    const DithertizerII=loadCard();
    const html=render(new DithertizerII());

    assert.match(html,/data-dither-row="IMG"[\s\S]*id="dither_ctrl_S7_camera"/);
    assert.match(html,/id="dither_ctrl_S7_camera"[^>]*class="appbut skinny"/);
    assert.match(html,/id="dither_ctrl_S7_camera"[^>]*aria-pressed="false"/);
    assert.match(html,/id="dither_ctrl_S7_camera"[\s\S]*fa-camera/);
    assert.match(html,/deviceToolCameraToggle\('dither_ctrl_S7'\)/);
    assert.match(html,/id="dither_ctrl_S7_camera"[\s\S]*id="dither_ctrl_S7_camera_status"/);
    assertCameraStatus(html,'OFF');
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
    assert.equal(calls.length,1);
    assert.equal(calls[0].video,true);
    assert.equal(calls[0].audio,false);
    assert.equal(card.getCameraSource(),null,'host camera lifecycle stays separate from frame processing');
    assert.match(render(card),/id="dither_ctrl_S7_camera"[^>]*aria-pressed="true"/);
    assertCameraStatus(render(card),'ON');

    assert.equal(await card.deviceToolCameraToggle('dither_ctrl_S7'),false);
    assert.equal(stopped,2);
    assert.equal(card.getCameraSource(),null);
    assert.match(render(card),/id="dither_ctrl_S7_camera"[^>]*aria-pressed="false"/);
    assertCameraStatus(render(card),'OFF');
});

test('camera toggle fails closed when getUserMedia is unavailable or rejected',async()=>{
    {
        const DithertizerII=loadCard({navigator:{}});
        const card=new DithertizerII();
        assert.equal(await card.deviceToolCameraToggle('dither_ctrl_S7'),false);
        assert.match(render(card),/id="dither_ctrl_S7_camera"[^>]*aria-pressed="false"/);
        assertCameraStatus(render(card),'OFF');
    }

    {
        const navigator={mediaDevices:{async getUserMedia(){throw new Error('denied');}}};
        const DithertizerII=loadCard({navigator});
        const card=new DithertizerII();
        assert.equal(await card.deviceToolCameraToggle('dither_ctrl_S7'),false);
        assert.match(render(card),/id="dither_ctrl_S7_camera"[^>]*aria-pressed="false"/);
        assertCameraStatus(render(card),'OFF');
    }
});

test('reset and restart stop all host-camera tracks and update the rendered camera status to OFF',async()=>{
    let stopped=0;
    const makeStream=()=>({getTracks(){return [{stop(){stopped++;}},{stop(){stopped++;}}];}});
    let current=makeStream();
    const navigator={mediaDevices:{async getUserMedia(){return current;}}};
    const dom=makeCameraDOM();
    const DithertizerII=loadCard({navigator,document:dom.document});
    const card=new DithertizerII();

    await card.deviceToolCameraToggle('dither_ctrl_S7');
    assert.equal(dom.button.attrs['aria-pressed'],'true');
    assert.equal(dom.status.textContent,'ON');
    card.reset();
    assert.equal(stopped,2);
    assert.equal(dom.button.attrs['aria-pressed'],'false');
    assert.equal(dom.status.textContent,'OFF');
    assert.equal(dom.icon.style.color,'');

    current=makeStream();
    await card.deviceToolCameraToggle('dither_ctrl_S7');
    assert.equal(dom.button.attrs['aria-pressed'],'true');
    assert.equal(dom.status.textContent,'ON');
    card.restart();
    assert.equal(stopped,4);
    assert.equal(dom.button.attrs['aria-pressed'],'false');
    assert.equal(dom.status.textContent,'OFF');
    assert.equal(dom.icon.style.color,'');
});

test('reset during pending camera permission discards and releases the late stream',async()=>{
    let grant,stopped=0;
    const stream={getTracks(){return [{stop(){stopped++;}}];}};
    const navigator={mediaDevices:{getUserMedia(){return new Promise(resolve=>{grant=resolve;});}}};
    const card=new (loadCard({navigator}))();
    const pending=card.deviceToolCameraToggle('dither_ctrl_S7');
    card.reset();
    grant(stream);
    assert.equal(await pending,false);
    assert.equal(stopped,1);
    assertCameraStatus(render(card),'OFF');
});

test('a second toggle cancels a pending start instead of requesting a second camera',async()=>{
    let grant,requests=0,stopped=0;
    const navigator={mediaDevices:{getUserMedia(){requests++;return new Promise(resolve=>{grant=resolve;});}}};
    const card=new (loadCard({navigator}))();
    const pending=card.deviceToolCameraToggle('dither_ctrl_S7');
    const cancelled=card.deviceToolCameraToggle('dither_ctrl_S7');
    assert.equal(requests,1);
    assert.equal(await cancelled,false);
    grant({getTracks(){return [{stop(){stopped++;}}];}});
    assert.equal(await pending,false);
    assert.equal(stopped,1);
    assertCameraStatus(render(card),'OFF');
});
