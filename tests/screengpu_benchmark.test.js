'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context=vm.createContext({WebAssembly,Uint8Array,Float64Array,Math,Number,Error,Promise,performance,setTimeout,clearTimeout});
const file=path.join(__dirname,'../tools/ScreenGPU_benchmark.js');
if(fs.existsSync(file)) vm.runInContext(fs.readFileSync(file,'utf8'),context);
const benchmark=context.ScreenGPUBenchmark;

test('JavaScript and real WASM drivers dispatch identical bounded batches',async()=>{
    assert.ok(benchmark,'benchmark implementation exists');
    for(const kind of ['javascript','wasm'])
    {
        const seen=[];
        const driver=await benchmark.createDriver(kind,index=>seen.push(index));
        driver.run(0); driver.run(4); driver.run(2);
        assert.deepEqual(seen,[0,1,2,3,0,1]);
        assert.throws(()=>driver.run(-1),/batch/);
    }
});

test('completed throughput includes completion delay and drains one batch at a time',async()=>{
    assert.ok(benchmark);
    let time=0, pending=0, maximum=0;
    const adapter={now:()=>time,draw(){pending++;maximum=Math.max(maximum,pending);time+=0.25;},
        async complete(){time+=3;pending=0;},async waitUntil(deadline){time=Math.max(time,deadline);}};
    const result=await benchmark.measurePoint(adapter,'wasm',{targetFps:null,durationMs:16,batchSize:4});
    assert.equal(result.frames,16);
    assert.equal(result.completedFps,1000);
    assert.equal(result.cpuMsPerFrame,0.25);
    assert.equal(result.latencyP95Ms,4);
    assert.equal(maximum,4);
    assert.equal(pending,0);
});

test('paced results distinguish sustainable demand from missed frame budget',async()=>{
    assert.ok(benchmark);
    let time=0;
    const adapter={now:()=>time,draw(){time+=1;},async complete(){time+=4;},async waitUntil(t){time=Math.max(time,t);}};
    const fast=await benchmark.measurePoint(adapter,'javascript',{targetFps:100,durationMs:100,batchSize:2});
    assert.equal(fast.metTarget,true);
    const slow=await benchmark.measurePoint(adapter,'javascript',{targetFps:1000,durationMs:100,batchSize:2});
    assert.equal(slow.metTarget,false);
    assert.ok(slow.missedFrames>0);
    assert.ok(slow.completedFps<1000);
});

test('cancellation stops new batches after outstanding work is drained',async()=>{
    assert.ok(benchmark);
    let time=0,draws=0;
    const signal={aborted:false};
    const adapter={now:()=>time,draw(){draws++;time++;},async complete(){signal.aborted=true;},async waitUntil(){}};
    await assert.rejects(benchmark.measurePoint(adapter,'javascript',{targetFps:null,durationMs:100,batchSize:2,signal}),/cancelled/);
    assert.equal(draws,2);
});

test('capture input preserves page, mixed-mode text and deterministic data',()=>{
    assert.ok(benchmark);
    const ram=Uint8Array.from({length:0x6000},(_,i)=>(i>>8)^i);
    const frame=benchmark.capture(ram,{gfx:true,hires:true,mix:true,page2:true},true);
    assert.equal(frame.bytes.length,7680);assert.equal(frame.modes.length,7680);
    assert.equal(frame.modes[0],2); assert.equal(frame.modes[160*40],0);
    assert.equal(frame.bytes[0],ram[0x4000]);assert.equal(frame.bytes[160*40],ram[0xa50]);
    assert.equal(frame.flash,true);
});

test('rate parsing rejects invalid demand and preserves ordered unique points',()=>{
    assert.equal(typeof(benchmark.parseRates),'function');
    assert.deepEqual(Array.from(benchmark.parseRates('120, 30,60,60')), [30,60,120]);
    for(const input of ['','abc','0,60','30,-1','60000']) assert.throws(()=>benchmark.parseRates(input),/rate/i);
});

test('reported sustainable ceiling requires every repetition to meet the target',()=>{
    assert.equal(typeof(benchmark.summarize),'function');
    const rows=[{driver:'javascript',targetFps:60,metTarget:true,completedFps:60},
        {driver:'javascript',targetFps:120,metTarget:true,completedFps:120},
        {driver:'javascript',targetFps:120,metTarget:false,completedFps:90},
        {driver:'javascript',targetFps:null,metTarget:null,completedFps:150}];
    const summary=benchmark.summarize(rows,'javascript');
    assert.equal(summary.sustainableFps,60);
    assert.equal(summary.firstFailedFps,120);
    assert.equal(summary.maximumCompletedFps,150);
});


test('pacing forwards cancellation and never reports an interrupted point',async()=>{
    let time=0;
    const signal={aborted:false};
    const adapter={now:()=>time,draw(){time++;},async complete(){},
        async waitUntil(deadline,received){assert.equal(received,signal);signal.aborted=true;}};
    await assert.rejects(benchmark.measurePoint(adapter,'javascript',
        {targetFps:1,durationMs:100,batchSize:128,signal}),/cancelled/);
});

test('cancelling pacing interrupts a long timer immediately',async()=>{
    const controller=new AbortController();
    const waiting=benchmark.pause(128000,controller.signal);
    controller.abort();
    await assert.rejects(waiting,/cancelled/);
});
