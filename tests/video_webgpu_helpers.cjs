'use strict';

const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function deferred()
{
    let resolve, reject;
    const promise = new Promise((a,b)=>{ resolve=a; reject=b; });
    return {promise, resolve, reject};
}

function environment(options={})
{
    const frames = new Map(), uploads = [], submitted = [], completions = [];
    let now = 1000, nextId = 0, lost = deferred();
    const context = {configure() {}, unconfigure() {}, getCurrentTexture() {return {createView() {return {};}};}};
    const device = {
        lost:lost.promise, addEventListener() {}, destroy() {},
        createBuffer({size}) {return {data:new Uint8Array(size), destroy() {}};},
        createShaderModule() {return {getCompilationInfo:async()=>({messages:[]})};},
        createRenderPipelineAsync:async()=>({getBindGroupLayout() {return {};}}),
        createBindGroup(desc) {return desc;},
        createCommandEncoder() {
            return {beginRenderPass() {return {setPipeline() {}, setBindGroup() {}, draw() {}, end() {}};}, finish() {return {};}};
        },
        queue:{
            writeBuffer(buffer,offset,data) {
                const bytes = new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
                buffer.data.set(bytes,offset);
                uploads.push({buffer,offset,bytes:bytes.slice()});
            },
            submit(commands) {submitted.push(commands);},
            onSubmittedWorkDone() {const d=deferred(); completions.push(d); return d.promise;}
        }
    };
    const gpu = {
        requestAdapter: options.requestAdapter || (async()=>({requestDevice:async()=>device})),
        getPreferredCanvasFormat:()=> 'rgba8unorm'
    };
    const sandbox = {
        Uint8Array, Uint32Array, Float32Array, ArrayBuffer, DataView,
        console, Number, Promise, Math, performance:{now:()=>now},
        _o:{CPU_ClocksTicks_s:1000000},
        _CFG_CHROMA:[{COL_name:'Color'},{COL_name:'B&W',COL_num:'#FFFFFF'},{COL_name:'Green',COL_num:'#A0FFF0'},{COL_name:'Amber',COL_num:'#FCE7A1'}],
        Apple2CharROM_get:()=>new Uint8Array(512),
        GPUBufferUsage:{COPY_DST:8,STORAGE:128,UNIFORM:64},
        document:{getElementById:()=>null},
        navigator:options.unsupported?{}:{gpu},
        window:{requestAnimationFrame(fn) {frames.set(++nextId,fn); return nextId;}, cancelAnimationFrame(id) {frames.delete(id);}}
    };
    sandbox.window.Apple2VideoWebGPU_CONFIG=options.config;
    const vmContext=vm.createContext(sandbox);
    const file=path.join(__dirname,'../res/EMU_DEVICE_video_WebGPU.js');
    if(!options.skipDevice && fs.existsSync(file)) vm.runInContext(fs.readFileSync(file,'utf8'),vmContext);
    const canvas={width:560,height:384,getContext:()=>context};
    return {
        sandbox, vmContext, canvas, device, context, uploads, submitted, completions,
        lose() {lost.resolve({reason:'unknown',message:'test loss'});},
        async flush() {await new Promise(resolve=>setImmediate(resolve));},
        raf(ms=20) {now+=ms; const callbacks=[...frames.values()]; frames.clear(); callbacks.forEach(fn=>fn(now));},
        get pendingFrames() {return frames.size;},
        video() {return sandbox.Apple2VideoWebGPU ? new sandbox.Apple2VideoWebGPU(canvas) : null;}
    };
}

module.exports={environment,deferred};
