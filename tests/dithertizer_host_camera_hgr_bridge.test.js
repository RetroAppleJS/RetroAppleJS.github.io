'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname,'..');

function makeBrowserHarness()
{
    const rgba=new Uint8ClampedArray(280*192*4);
    for(let y=0;y<192;y++)
    {
        for(let x=0;x<280;x++)
        {
            const i=(y*280+x)*4;
            const bright=x<7 && (x%2===0);
            const v=bright ? 255 : 0;
            rgba[i]=v;
            rgba[i+1]=v;
            rgba[i+2]=v;
            rgba[i+3]=255;
        }
    }

    let drawCount=0;
    let stopped=0;
    let nextTimer=1;
    const timers=new Map();
    const stream={getTracks(){return [{stop(){stopped++;}}];}};
    const video={
        videoWidth:280,
        videoHeight:192,
        muted:false,
        playsInline:false,
        autoplay:false,
        srcObject:null,
        async play(){return undefined;},
        pause(){}
    };
    const context={
        drawImage(){drawCount++;},
        getImageData(){return {data:rgba};}
    };
    const canvas={
        width:0,
        height:0,
        getContext(kind){assert.equal(kind,'2d');return context;}
    };
    const document={
        getElementById(){return null;},
        createElement(kind)
        {
            if(kind==='video') return video;
            if(kind==='canvas') return canvas;
            throw new Error('unexpected element '+kind);
        }
    };
    const navigator={mediaDevices:{async getUserMedia(constraints){
        assert.equal(constraints.video,true);
        assert.equal(constraints.audio,false);
        return stream;
    }}};
    function setTimeoutFake(fn,ms)
    {
        const id=nextTimer++;
        timers.set(id,{fn,ms});
        return id;
    }
    function clearTimeoutFake(id){timers.delete(id);}

    return {
        rgba,stream,video,canvas,document,navigator,setTimeoutFake,clearTimeoutFake,timers,
        get drawCount(){return drawCount;},
        get stopped(){return stopped;}
    };
}

function loadCard(h)
{
    const source=fs.readFileSync(path.join(ROOT,'res','EMU_CARD_dithertizer.js'),'utf8');
    const sandbox={
        console,Uint8Array,Uint8ClampedArray,ArrayBuffer,Array,Number,String,Object,Math,RegExp,Promise,
        document:h.document,
        navigator:h.navigator,
        setTimeout:h.setTimeoutFake,
        clearTimeout:h.clearTimeoutFake
    };
    vm.createContext(sandbox);
    vm.runInContext(source+'\n;this.__ctor=DithertizerII;',sandbox,{filename:'EMU_CARD_dithertizer.js'});
    return sandbox.__ctor;
}

function captureFirstByte(card)
{
    const writes=new Map();
    card.writeSlotIO(0x00,0x80,{});
    card.readSlotIO(0x08,{
        bRO:false,
        vid:{state:{page2:false}},
        hw:{write(addr,d8){writes.set(addr&0xFFFF,d8&0xFF);}}
    });
    return {first:writes.get(0x2000),count:writes.size};
}

test('host camera frame is exposed synchronously to DSCAN and captured into HGR',async()=>{
    const h=makeBrowserHarness();
    const DithertizerII=loadCard(h);
    const card=new DithertizerII();

    assert.equal(card.getCameraSource(),null,'explicit synthetic source starts unset');
    assert.equal(await card.deviceToolCameraToggle('dither_ctrl_S7'),true);
    assert.equal(h.video.srcObject,h.stream);
    assert.equal(h.canvas.width,280);
    assert.equal(h.canvas.height,192);
    assert.equal(h.drawCount,1,'first host frame is sampled immediately after video starts');
    assert.equal(card.getCameraSource(),null,'host bridge must not overwrite explicit setCameraSource() state');

    const live=captureFirstByte(card);
    assert.equal(live.count,192*40);
    assert.equal(live.first,0b01010101,'alternating bright camera pixels cross the DSCAN threshold');

    assert.equal(await card.deviceToolCameraToggle('dither_ctrl_S7'),false);
    assert.equal(h.stopped,1);

    const afterOff=captureFirstByte(card);
    assert.equal(afterOff.first,0x00,'camera OFF clears the host signal to black');
});

test('explicit setCameraSource still takes priority over a live host camera bridge',async()=>{
    const h=makeBrowserHarness();
    const DithertizerII=loadCard(h);
    const card=new DithertizerII();

    await card.deviceToolCameraToggle('dither_ctrl_S7');
    card.setCameraSource({getLumaFrame(){
        const frame=new Uint8Array(280*192);
        frame.fill(0);
        for(let x=0;x<7;x++) if(x%2===1) frame[x]=255;
        return frame;
    }});

    const captured=captureFirstByte(card);
    assert.equal(captured.first,0b00101010,'explicit source remains the highest-priority source');
});

test('reset cancels host-camera sampling and clears the host frame',async()=>{
    const h=makeBrowserHarness();
    const DithertizerII=loadCard(h);
    const card=new DithertizerII();

    await card.deviceToolCameraToggle('dither_ctrl_S7');
    assert.ok(h.timers.size>0,'live bridge schedules another sample');
    card.reset();

    assert.equal(h.timers.size,0,'reset cancels pending camera sampling');
    assert.equal(h.stopped,1,'reset releases camera tracks');
    assert.equal(captureFirstByte(card).first,0x00,'reset leaves the host source black');
});
