'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const scriptNames=[
    'res/EMU_DEVICE_camera.js',
    'res/EMU_DITHERTIZER_converthgr_worker.js',
    'res/EMU_DITHERTIZER_converthgr.js',
    'res/EMU_CARD_dithertizer2.js'
];

test('DITHER2 starts a camera and captures the worker HGR page from the scripts loaded by index.html',async()=>{
    const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
    const scripts=[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(match=>match[1]);
    assert.deepEqual(scripts.filter(name=>scriptNames.includes(name)),scriptNames);

    let workerSource,fetchCount=0,stopped=0;
    const page=new Uint8Array(8192);page[0]=0xD5;
    class FakeWorker
    {
        postMessage(message)
        {
            if(message.type!=='convert') return;
            queueMicrotask(()=>this.onmessage({data:{
                type:'conversionResult',requestId:message.requestId,
                metadata:{backendUsed:'wasm'},
                buffers:{paletteImage:new Uint8Array(280*192).buffer,hgrPage:page.buffer}
            }}));
        }
        terminate(){}
    }
    const stream={getTracks(){return [{stop(){stopped++;}}];}};
    const video={videoWidth:280,videoHeight:192,async play(){},pause(){}};
    const canvas={getContext(){return {drawImage(){},getImageData(){return {data:new Uint8ClampedArray(280*192*4)};}};}};
    const sandbox={console,Uint8Array,Uint8ClampedArray,ArrayBuffer,Promise,queueMicrotask,
        Blob:class {constructor(parts){workerSource=parts[0];}},
        Worker:FakeWorker,
        URL:{createObjectURL(){return 'blob:worker';},revokeObjectURL(){}},
        fetch(){fetchCount++;throw new Error('worker source must be bundled');},
        setTimeout(){return 1;},clearTimeout(){},
        document:{createElement(kind){return kind==='video'?video:canvas;},getElementById(){return null;}},
        navigator:{mediaDevices:{async getUserMedia(){return stream;}}}
    };
    vm.createContext(sandbox);
    for(const name of scriptNames)
        vm.runInContext(fs.readFileSync(path.join(ROOT,name),'utf8'),sandbox,{filename:name});
    const card=new (sandbox.DithertizerII_2 || sandbox.DithertizerII)();
    new sandbox.DithertizerCameraDevice().bindHost(card);
    assert.equal(await card.deviceToolCameraToggle('camera'),true);
    try
    {
        assert.ok(workerSource.includes('WASM_HGR_BASE64'));
        assert.equal(fetchCount,0);
        const writes=new Map();
        card.readSlotIO(0x08,{vid:{state:{page2:true}},hw:{write(addr,value){writes.set(addr,value);}}});
        assert.equal(writes.get(0x4000),0xD5);
    }
    finally {card.reset();}
    assert.equal(stopped,1);
});
