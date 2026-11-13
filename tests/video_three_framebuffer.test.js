// Regression for Safari/WebGL framebuffer exhaustion when the Three.js
// emulator mode is initialized while its canvas is detached.
// Run from the repository root: node --test tests/video_three_framebuffer.test.js
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.join(__dirname,"../res/EMU_DEVICE_video_THREE.js"),"utf8"
);

let drawCalls = 0;
const document = {
    createElement(tag) {
        assert.equal(tag,"canvas");
        return {
            width:0,height:0,style:{},
            getContext(kind) {
                assert.equal(kind,"2d");
                return {drawImage(){drawCalls++;}};
            }
        };
    }
};

const window = {devicePixelRatio:2,Apple2VideoTHREE_CONFIG:{}};
const context = vm.createContext({window,document,console});
vm.runInContext(source,context,{filename:"EMU_DEVICE_video_THREE.js"});

const canvas = {
    width:560,height:384,clientWidth:0,clientHeight:0,style:{},
    addEventListener(){}
};
const video = new context.Apple2VideoTHREE(canvas);
const gl = {lost:false,isContextLost(){return this.lost;}};
let renderCalls = 0;
const renderer = {
    pixelRatio:1,
    setPixelRatio(ratio){this.pixelRatio=ratio;},
    setSize(w,h){
        this.logicalWidth=w;
        this.logicalHeight=h;
        canvas.width=Math.round(w*this.pixelRatio);
        canvas.height=Math.round(h*this.pixelRatio);
    },
    getContext(){return gl;},
    setRenderTarget(){},
    render(){renderCalls++;}
};
video.renderer=renderer;

// Canvas is not yet connected to the page. Repeated setSize() must not
// treat its DPI-scaled backing buffer as the next CSS width and height.
for(let i=0;i<8;i++){
    video.resizeRenderer();
    assert.equal(renderer.logicalWidth,560);
    assert.equal(renderer.logicalHeight,384);
    assert.equal(canvas.width,840);
    assert.equal(canvas.height,576);
}
assert.equal(renderer.pixelRatio,1.5);

// Once attached, use CSS dimensions instead of the 560x384 fallback.
canvas.clientWidth=1200;
canvas.clientHeight=800;
video.resizeRenderer();
assert.equal(canvas.width,1800);
assert.equal(canvas.height,1200);

// Even an excessively large CSS viewport must have bounded GPU dimensions.
canvas.clientWidth=4000;
canvas.clientHeight=1000;
video.resizeRenderer();
assert.equal(canvas.width,2048);
assert.equal(canvas.height,512);

// Simulate detaching the canvas again: never derive logical dimensions from
// the previous 2048x512 backing buffer.
canvas.clientWidth=0;
canvas.clientHeight=0;
video.resizeRenderer();
assert.equal(canvas.width,840);
assert.equal(canvas.height,576);

// Data-URL textures currently supplied by THREEJS_scene_v0.js are 4096px.
// Verify upload dimensions are reduced before the texture is used by WebGL.
const originalImage = {width:4096,height:4096};
const texture = {image:originalImage};
assert.equal(video.downsampleDefaultTexture(texture),true);
assert.equal(texture.image.width,1024);
assert.equal(texture.image.height,1024);
assert.equal(drawCalls,1);
assert.equal(video.downsampleDefaultTexture(texture),false);

// A lost WebGL context must never reach the shader/render path.
video.scene={};
video.camera={};
gl.lost=true;
video.renderTHREEScene();
assert.equal(renderCalls,0);
gl.lost=false;
video.renderTHREEScene();
assert.equal(renderCalls,1);

console.log("Three.js framebuffer/texture/context-loss regression tests passed.");
