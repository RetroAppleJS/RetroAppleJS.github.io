'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'res/EMU_CARD_dithertizer2.js'),'utf8');
const LOGO_HASH='2c079e6226359fa0da294ee32a244efed747e79f210d08774e31020996bba3dc';
function load(extra={})
{
    const sandbox={console,Uint8Array,Uint8ClampedArray,ArrayBuffer,Promise,setTimeout,clearTimeout,...extra};
    vm.createContext(sandbox);
    vm.runInContext(source,sandbox);
    return new sandbox.DithertizerII_2();
}
function capture(card)
{
    const bytes=new Uint8Array(8192);
    const ctx={vid:{state:{page2:true}},hw:{write(addr,d8){bytes[addr-0x4000]=d8;}}};
    card.readSlotIO(0x08,ctx);
    return bytes;
}

test('camera OFF captures the exact Apple II logo HGR page, including phase bit 7',()=>{
    const card=load();
    const bytes=capture(card);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),LOGO_HASH);
    assert.equal(bytes[0],0x80);
    assert.equal(bytes[0x78],0,'HGR memory hole remains untouched');
});

test('near-neutral camera changes retain phase, while a real hue change can update bit 7',async()=>{
    function frame(byte,r,g,b)
    {
        const hgrPage=new Uint8Array(8192);hgrPage[0]=byte;
        const processedRGB=new Uint8Array(280*192*3);
        for(let p=0;p<processedRGB.length;p+=3)
        {processedRGB[p]=r;processedRGB[p+1]=g;processedRGB[p+2]=b;}
        return {hgrPage,processedRGB};
    }
    const frames=[frame(0x15,100,100,100),frame(0xA5,101,101,101),frame(0xD5,180,100,100)];
    const stream={getTracks(){return [{stop(){}}];}};
    const video={videoWidth:280,videoHeight:192,async play(){},pause(){}};
    const canvas={getContext(){return {drawImage(){},getImageData(){return {data:new Uint8ClampedArray(280*192*4)};}};}};
    let pendingTimer;
    class Adapter
    {
        async init(){}
        configure(){}
        async convert(){return frames.shift();}
        close(){}
    }
    const card=load({
        DithertizerConvertHGRAdapter:Adapter,
        document:{createElement(kind){return kind==='video'?video:canvas;},getElementById(){return null;}},
        navigator:{mediaDevices:{async getUserMedia(){return stream;}}},
        setTimeout(fn){pendingTimer=fn;return 1;},clearTimeout(){pendingTimer=null;}
    });
    assert.equal(await card.deviceToolCameraToggle('camera'),true);
    try
    {
        assert.equal(capture(card)[0],0x15);
        pendingTimer();await new Promise(setImmediate);
        assert.equal(capture(card)[0],0x25,'one-step neutral brightness change updates pixels but keeps phase');
        pendingTimer();await new Promise(setImmediate);
        assert.equal(capture(card)[0],0xD5,'changed chroma accepts the new phase');
    }
    finally {card.reset();}
    assert.equal(crypto.createHash('sha256').update(capture(card)).digest('hex'),LOGO_HASH,
        'turning the camera off restores the embedded HGR page');
});
