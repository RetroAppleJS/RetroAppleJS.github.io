'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const cardSource=fs.readFileSync(path.join(__dirname,'../res/EMU_CARD_dithertizer.js'),'utf8');
const cameraSource=fs.readFileSync(path.join(__dirname,'../res/EMU_DEVICE_camera.js'),'utf8');

function makeCard(browser={})
{
    const sandbox={console:browser.console||console,Uint8Array,ArrayBuffer,WebAssembly,atob,Blob:browser.Blob,URL:browser.URL,
        Worker:browser.Worker,document:browser.document,navigator:browser.navigator};
    vm.createContext(sandbox);
    vm.runInContext(cameraSource,sandbox,{filename:'EMU_DEVICE_camera.js'});
    vm.runInContext(cardSource,sandbox,{filename:'EMU_CARD_dithertizer.js'});
    const card=new sandbox.DithertizerII();
    new sandbox.DithertizerCameraDevice().bindHost(card);
    return card;
}

function capture(card,threshold=128)
{
    const page=new Uint8Array(8192).fill(0xA5);
    card.writeSlotIO(0,threshold,{});
    card.readSlotIO(8,{vid:{state:{page2:false}},hw:{write(addr,value){page[addr-0x2000]=value;}}});
    return page;
}

function raster(page)
{
    const bytes=new Uint8Array(7680);
    for(let y=0;y<192;y++)
    {
        const offset=((y&7)<<10)+((y&0x38)<<4)+((y&0xC0)>>1)+((y&0xC0)>>3);
        bytes.set(page.subarray(offset,offset+40),y*40);
    }
    return bytes;
}

test('camera-off comparator reconstructs the captured Computer Station HGR raster',()=>{
    const card=makeCard();
    const image=capture(card);
    assert.equal(crypto.createHash('sha256').update(raster(image)).digest('hex'),
        '0da9501930e2d38484a4d4a20359246bada8dd879d1d076c155452aeb55833f2');
    assert.equal(image[0x78],0xA5,'HGR screen holes must remain untouched');
    card.reset();
    assert.equal(crypto.createHash('sha256').update(raster(capture(card))).digest('hex'),
        '0da9501930e2d38484a4d4a20359246bada8dd879d1d076c155452aeb55833f2');
});

test('WASM pictogram starts ON below the camera and changes state without adding a fourth slider',()=>{
    const card=makeCard();
    let html=card.deviceToolSlotHTML({slotID:'S7',slotN:8});
    assert.equal((html.match(/type="range"/g)||[]).length,3);
    assert.match(html,/id="dither_ctrl_S7_wasm"[^>]*aria-pressed="true"/);
    assert.ok(html.indexOf('id="dither_ctrl_S7_wasm"')>html.indexOf('id="dither_ctrl_S7_camera"'));
    assert.equal(card.deviceToolWasmToggle('dither_ctrl_S7'),false);
    html=card.deviceToolSlotHTML({slotID:'S7',slotN:8});
    assert.match(html,/id="dither_ctrl_S7_wasm"[^>]*aria-pressed="false"/);
});

test('unavailable WASM displays an error and the camera can switch to raw luminance',async()=>{
    const video={videoWidth:280,videoHeight:192,async play(){},pause(){}};
    const rgba=new Uint8ClampedArray(280*192*4).fill(255);
    const card=makeCard({console:{warn(){}},
        document:{getElementById(){return null;},createElement(kind){
            return kind==='video' ? video : {getContext(){return {drawImage(){},getImageData(){return {data:rgba};}};}};
        }},
        navigator:{mediaDevices:{async getUserMedia(){return {getTracks(){return [{stop(){}}];}};}}}
    });
    assert.equal(await card.deviceToolCameraToggle('dither_ctrl_S7'),true);
    assert.match(card.deviceToolSlotHTML({slotID:'S7',slotN:8}),/id="dither_ctrl_S7_wasm_status"[^>]*>ERR</);
    assert.equal(card.deviceToolWasmToggle('dither_ctrl_S7'),false);
    assert.equal(capture(card,128)[0],0x7F);
});

test('embedded WASM and JavaScript supply identical luminance to the DSCAN Bayer comparator',async()=>{
    const rgba=new Uint8ClampedArray(280*192*4);
    for(let i=0;i<rgba.length;i+=4){rgba[i]=255;rgba[i+3]=255;}
    const video={videoWidth:280,videoHeight:192,async play(){},pause(){}};
    const context={drawImage(){},getImageData(){return {data:rgba};}};
    const stream={getTracks(){return [{stop(){}}];}};
    const document={getElementById(){return null;},createElement(kind){
        if(kind==='video') return video;
        if(kind==='canvas') return {getContext(){return context;}};
        throw new Error(kind);
    }};
    let workerSource='';
    let firstResultResolve;
    const firstResult=new Promise(resolve=>{firstResultResolve=resolve;});
    let nextResultResolve=null;
    let wasmResult;
    class TestBlob {constructor(parts){workerSource=parts.join('');}}
    const URL={createObjectURL(){return 'blob:test-worker';},revokeObjectURL(){}};
    class TestWorker
    {
        constructor(url)
        {
            assert.equal(url,'blob:test-worker');
            const self={postMessage:data=>{
                wasmResult=data;
                this.onmessage({data});
                firstResultResolve();
                if(nextResultResolve) {const resolve=nextResultResolve;nextResultResolve=null;resolve();}
            }};
            const sandbox={self,Uint8Array,ArrayBuffer,Float64Array,WebAssembly,atob,console};
            vm.createContext(sandbox);
            vm.runInContext(workerSource,sandbox);
            this.worker=self;
        }
        postMessage(data){this.worker.onmessage({data});}
        terminate(){}
    }
    const card=makeCard({document,navigator:{mediaDevices:{async getUserMedia(){return stream;}}},
        Blob:TestBlob,URL,Worker:TestWorker});
    assert.equal(await card.deviceToolCameraToggle('dither_ctrl_S7'),true);
    await firstResult;
    assert.equal(wasmResult.error,undefined);
    assert.equal(capture(card,100)[0],0,'red luminance is 76, below the threshold in WASM');
    assert.equal(capture(card,70)[0],0x7F,'all seven red pixels pass the lower threshold in WASM');
    for(let p=0,s=0;p<280*192;p++,s+=4)
    {
        rgba[s]=(p*37)&255;
        rgba[s+1]=(p*17+73)&255;
        rgba[s+2]=(p*101+11)&255;
    }
    const gradientResult=new Promise(resolve=>{nextResultResolve=resolve;});
    card.cycle();
    await gradientResult;
    const wasmRaster=raster(capture(card,128));
    const staleResult=new Promise(resolve=>{nextResultResolve=resolve;});
    card.cycle();
    assert.equal(card.deviceToolWasmToggle('dither_ctrl_S7'),false);
    await staleResult;
    assert.deepEqual(raster(capture(card,128)),wasmRaster,'all 7680 HGR pixel bytes match after switching backends');
    assert.equal(await card.deviceToolCameraToggle('dither_ctrl_S7'),false);
    assert.equal(crypto.createHash('sha256').update(raster(capture(card))).digest('hex'),
        '0da9501930e2d38484a4d4a20359246bada8dd879d1d076c155452aeb55833f2');
});
