'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const context=vm.createContext({
    WebAssembly,Uint8Array,Uint8ClampedArray,Uint32Array,Float32Array,
    Math,Number,Error,Promise,performance,setTimeout,clearTimeout,AbortController
});
const base=path.join(__dirname,'../tools/ScreenGPU_benchmark.js');
const webgpu=path.join(__dirname,'../tools/ScreenWEBGPU_benchmark.js');
vm.runInContext(fs.readFileSync(base,'utf8'),context);
if(fs.existsSync(webgpu)) vm.runInContext(fs.readFileSync(webgpu,'utf8'),context);
const benchmark=context.ScreenWEBGPUBenchmark;

test('WebGPU benchmark reuses the completion-aware drivers and statistics',async()=>
{
    assert.ok(benchmark,'WebGPU benchmark implementation exists');
    assert.equal(benchmark.measurePoint,context.ScreenGPUBenchmark.measurePoint);
    const seen=[];
    const driver=await benchmark.createDriver('wasm',index=>seen.push(index));
    driver.run(3);
    assert.deepEqual(seen,[0,1,2]);
});

test('mode parameters match the production WebGPU shader layout',()=>
{
    assert.ok(benchmark);
    assert.deepEqual(Array.from(benchmark.parameters(
        {mode:'mixed-hires',page2:true,chrome:3},false,true)),[0,1,1,1,1,3,1,0]);
    assert.deepEqual(Array.from(benchmark.parameters(
        {mode:'text',page2:false,chrome:0},true,false)),[1,0,0,0,0,0,0,0]);
});

test('deterministic pools preserve RAM and packed beam-capture inputs',()=>
{
    assert.ok(benchmark);
    const pools=benchmark.createInputPools({mode:'mixed-hires',page2:true});
    assert.equal(pools.ram.length,32);
    assert.equal(pools.ram[0].length,0x6000);
    assert.equal(pools.capture[0].length,15360);
    assert.deepEqual(Array.from(pools.capture[0].subarray(0,7680)),
        Array.from(context.ScreenGPUBenchmark.capture(pools.ram[0],
            {gfx:true,mix:true,hires:true,page2:true},false).bytes));
    assert.notDeepEqual(Array.from(pools.ram[0].subarray(0,16)),Array.from(pools.ram[1].subarray(0,16)));
});

test('palette conversion follows the production 64-color float layout',()=>
{
    assert.ok(benchmark);
    const bytes=Uint8Array.from({length:256},(_,index)=>index);
    const palette=benchmark.createPalette(bytes);
    assert.equal(palette.length,256);
    assert.equal(palette[0],0);
    assert.equal(palette[1],1/256);
    assert.equal(palette[2],2/256);
    assert.equal(palette[3],1);
    assert.equal(palette[255],1);
});

test('timestamp ticks become milliseconds and invalid samples remain unavailable',()=>
{
    assert.ok(benchmark);
    assert.equal(benchmark.timestampMilliseconds(1000n,2251000n),2.25);
    assert.equal(benchmark.timestampMilliseconds(2000n,1000n),null);
    assert.equal(benchmark.timestampMilliseconds(null,1000n),null);
});

test('queue completion rejects both reported loss and a rejected work callback',async()=>
{
    assert.ok(benchmark);
    await assert.rejects(benchmark.awaitCompletion(Promise.resolve(),
        Promise.resolve('already lost')),/already lost/);
    await assert.rejects(benchmark.awaitCompletion(
        Promise.reject(new Error('queue reported device loss')),new Promise(()=>{})),
        /queue reported device loss/);
});

test('renderer initialization releases WebGPU resources when pipeline creation fails',async()=>
{
    let deviceDestroyed=false,bufferDestroyed=0,unconfigured=false;
    const device={
        lost:new Promise(()=>{}),addEventListener() {},destroy(){deviceDestroyed=true;},
        createBuffer(){return {destroy(){bufferDestroyed++;}};},
        createShaderModule(){return {getCompilationInfo:async()=>({messages:[]})};},
        createRenderPipelineAsync:async()=>{throw new Error('pipeline failed');},
        queue:{writeBuffer() {}}
    };
    context.navigator={gpu:{requestAdapter:async()=>({features:new Set(),requestDevice:async()=>device}),
        getPreferredCanvasFormat:()=> 'rgba8unorm'}};
    context.GPUTextureUsage={RENDER_ATTACHMENT:1,COPY_SRC:2};
    context.GPUBufferUsage={STORAGE:4,COPY_DST:8,UNIFORM:16};
    context.Apple2CharROM_get=()=>new Uint8Array(512);
    context.Apple2VideoWebGPU={SHADER:'shader',PALETTE:new Uint8Array(256)};
    const canvas={getContext:()=>({configure() {},unconfigure(){unconfigured=true;}})};
    await assert.rejects(benchmark.createRenderer(canvas,
        {mode:'text',input:'ram',rom:'A2_US',chrome:0,page2:false,snapshot:false}),/pipeline failed/);
    assert.equal(deviceDestroyed,true);
    assert.equal(bufferDestroyed,4);
    assert.equal(unconfigured,true);
});
