'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {environment}=require('./video_webgpu_helpers.cjs');

function load(env,file)
{
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../res',file),'utf8'),env.vmContext);
}

test('MUX works for legacy consumers without the optional WebGPU include',()=>{
    const env=environment({skipDevice:true});
    for(const name of ['Apple2VideoGPU','Apple2VideoWave','Apple2VideoTHREE','Apple2VideoCanvas']) env.sandbox[name]=function() {};
    load(env,'EMU_DEVICE_video_MUX.js');
    assert.doesNotThrow(()=>new env.sandbox.Apple2VideoMUX(env.canvas));
    assert.equal(new env.sandbox.Apple2VideoMUX(env.canvas).getRenderModes().length,4);
});

test('real GPU.js device drops queued draws when MUX makes it inactive',()=>{
    const env=environment(); load(env,'EMU_DEVICE_video_GPU.js');
    const video=new env.sandbox.Apple2Video(env.canvas);
    let draws=0;
    video.hw={safe_videodump:()=>new Uint8Array(0x6000)};
    video.kernel=()=>draws++;
    video.redraw();
    assert.equal(typeof(video.setActive),'function','legacy GPU must implement selection lifecycle');
    video.setActive(false); env.raf();
    assert.equal(draws,0); assert.equal(env.pendingFrames,0);
    video.redraw(); assert.equal(env.pendingFrames,0);
    video.setActive(true); video.redraw(); env.raf();
    assert.equal(draws,1);
});

test('real Three.js render loop stops and resumes with selection lifecycle',()=>{
    const env=environment();
    env.sandbox.document.createElement=()=>({style:{},getContext:()=>({})});
    load(env,'EMU_DEVICE_video_THREE.js');
    const video=new env.sandbox.Apple2VideoTHREE(env.canvas);
    let draws=0;
    video.renderer={};
    video.renderTHREEScene=()=>draws++;
    video.startRenderLoop(); env.raf(100); assert.equal(draws,1);
    assert.equal(typeof(video.setActive),'function','Three.js must implement selection lifecycle');
    video.setActive(false); env.raf(100);
    assert.equal(draws,1); assert.equal(env.pendingFrames,0);
    video.setActive(true); env.raf(100);
    assert.equal(draws,2); assert.equal(env.pendingFrames,1);
});
