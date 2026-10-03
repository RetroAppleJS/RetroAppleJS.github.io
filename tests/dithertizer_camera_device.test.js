'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../res/EMU_DEVICE_camera.js'),'utf8');

function setup(permission)
{
    const stops=[];
    const rgba=new Uint8ClampedArray(280*192*4);
    rgba.set([20,100,180,255]);
    const context={drawImage(){},getImageData(){return {data:rgba};}};
    const video={videoWidth:280,videoHeight:192,async play(){},pause(){}};
    const sandbox={console,Uint8Array,ArrayBuffer,Promise,
        document:{createElement(kind){return kind==='video'?video:{width:0,height:0,getContext(){return context;}};}},
        navigator:{mediaDevices:{getUserMedia:permission||(()=>Promise.resolve({getTracks(){return [{stop(){stops.push(1);}}];}}))}}
    };
    vm.createContext(sandbox);
    vm.runInContext(source,sandbox);
    return {Device:sandbox.DithertizerCameraDevice,stops};
}

test('the same RGB24 camera port attaches to either DITHER card and releases on detach',async()=>{
    const {Device,stops}=setup();
    for(const code of ['DITHER','DITHER2'])
    {
        const owner={id:{PCODE:code}};
        const device=new Device();
        assert.equal(device.bindHost(owner),true);
        assert.equal(owner.cameraDevice,device);
        assert.equal(device.ports.video.mimeType,'video/x-raw;format=RGB24');
        assert.equal(await device.start(),true);
        const frame=device.ports.video.read({width:280,height:192,crop:'4:3'});
        assert.equal(frame.width,280);
        assert.equal(frame.height,192);
        assert.equal(frame.rgb.length,280*192*3);
        assert.deepEqual(Array.from(frame.rgb.subarray(0,3)),[20,100,180]);
        assert.equal(device.unbindHost(owner),true);
        assert.equal(owner.cameraDevice,null);
        assert.equal(device.isActive(),false);
    }
    assert.equal(stops.length,2);
});

test('detach while camera permission is pending stops the late stream',async()=>{
    let grant,stopped=0;
    const {Device}=setup(()=>new Promise(resolve=>{grant=resolve;}));
    const device=new Device(),owner={id:{PCODE:'DITHER'}};
    device.bindHost(owner);
    const pending=device.start();
    device.unbindHost(owner);
    grant({getTracks(){return [{stop(){stopped++;}}];}});
    assert.equal(await pending,false);
    assert.equal(stopped,1);
    assert.equal(device.isActive(),false);
});
