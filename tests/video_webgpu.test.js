'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {environment,deferred}=require('./video_webgpu_helpers.cjs');

function construct(env)
{
    const video=env.video();
    assert.ok(video,'WebGPU device must be available after explicit script loading');
    video.vidram=new Uint8Array(0x6000);
    video.hw={safe_videodump:()=>video.vidram.slice()};
    return video;
}

test('WebGPU registration and reset do not request an adapter',()=>{
    let requests=0;
    const env=environment({requestAdapter:async()=>{requests++; return null;}});
    const video=construct(env);
    video.reset(); video.ctrl_dlg();
    assert.equal(requests,0);
    assert.equal(video.id.DCODE,'A2WGPU');
    assert.equal(video.getStatus().state,'idle');
});

test('unsupported WebGPU returns an unavailable device without throwing',async()=>{
    const env=environment({unsupported:true}), video=construct(env);
    assert.equal(await video.activate(),false);
    assert.equal(video.getStatus().state,'unavailable');
    assert.equal(env.submitted.length,0);
});

test('timer submissions snapshot RAM after the hardware commits a notified write',async()=>{
    const env=environment(), video=construct(env);
    video.reset(); await video.activate(); env.raf();
    env.completions.forEach(d=>d.resolve()); await env.flush();
    video.write(0x400,0xC1); video.vidram[0x400]=0xC1;
    video.cycle(25000); env.raf();
    const ram=env.uploads.filter(u=>u.bytes.length===0x6000).at(-1);
    assert.equal(ram.bytes[0x400],0xC1);
    assert.equal(env.pendingFrames,0);
    const count=env.submitted.length;
    env.completions.forEach(d=>d.resolve()); await env.flush();
    video.cycle(25000); env.raf();
    assert.equal(env.submitted.length,count,'unchanged text is not resubmitted');
});

test('captured inputs preserve byte, per-fetch mode and flash despite changed live RAM',async()=>{
    const env=environment(), video=construct(env);
    video.frameTiming='vblank'; await video.activate();
    const frame={bytes:new Uint8Array(7680),modes:new Uint8Array(7680),flash:true};
    frame.bytes[0]=0xAB; frame.modes[0]=1;
    video.vidram.fill(0xFF); video.setHires(true);
    video.presentRasterFrame(frame,{chrome:3});
    const input=env.uploads.find(u=>u.bytes.length===15360);
    assert.equal(input.bytes[0],0xAB);
    assert.equal(input.bytes[7680],1);
    const params=new Uint32Array(env.uploads.filter(u=>u.bytes.length===32).at(-1).bytes.buffer);
    assert.equal(params[0],1); assert.equal(params[5],3); assert.equal(params[6],1);
});

test('bounded GPU queue retains only the latest captured picture',async()=>{
    const env=environment(), video=construct(env);
    video.frameTiming='vblank'; await video.activate();
    const frame=n=>({bytes:new Uint8Array(7680).fill(n),modes:new Uint8Array(7680),flash:false});
    for(let i=1;i<=8;i++) video.presentRasterFrame(frame(i),{chrome:0});
    assert.equal(env.submitted.length,2);
    env.completions[0].resolve(); await env.flush();
    assert.equal(env.submitted.length,3);
    assert.equal(env.uploads.filter(u=>u.bytes.length===15360).at(-1).bytes[0],8);
});

test('deactivation invalidates queued pictures, including initialization races',async()=>{
    const gate=deferred(), env=environment({requestAdapter:()=>gate.promise}), video=construct(env);
    const activation=video.activate(); video.deactivate();
    gate.resolve({requestDevice:async()=>env.device}); await activation; env.raf();
    assert.equal(env.submitted.length,0);
    assert.equal(env.pendingFrames,0);
});

test('reset retains a healthy GPU device and clears pending captured input',async()=>{
    const env=environment(), video=construct(env);
    video.frameTiming='vblank'; await video.activate();
    const frame={bytes:new Uint8Array(7680),modes:new Uint8Array(7680),flash:true};
    video.presentRasterFrame(frame,{chrome:0}); video.presentRasterFrame(frame,{chrome:0});
    video.presentRasterFrame(frame,{chrome:0}); video.reset();
    env.completions.forEach(d=>d.resolve()); await env.flush();
    assert.equal(env.submitted.length,2); assert.equal(video.isReady(),true);
});

test('ROM and palette edits update uploads and public color lookup tables',async()=>{
    const env=environment(), video=construct(env);
    await video.activate(); env.raf(); env.completions.forEach(d=>d.resolve()); await env.flush();
    const rom=new Uint8Array(512).fill(0x55);
    video.setCharRom(rom,'CUSTOM'); video.setCol(3,0,'#123456'); video.redraw(); env.raf();
    assert.equal(env.uploads.filter(u=>u.bytes.length===512).at(-1).bytes[0],0x55);
    assert.equal(video.gethiresCols()[1][0],'#123456');
    const palette=new Float32Array(env.uploads.filter(u=>u.bytes.length===1024).at(-1).bytes.buffer);
    assert.equal(palette[3*16],0x12/256);
});

test('device loss rejects readiness and deactivation prevents further submissions',async()=>{
    const env=environment(), video=construct(env);
    await video.activate(); env.raf(); env.lose(); await env.flush();
    assert.equal(video.getStatus().state,'lost'); assert.equal(video.isAvailable(),false);
    const count=env.submitted.length; video.redraw(); env.raf();
    assert.equal(env.submitted.length,count);
});

test('a timing switch can present dirty timer output as old submissions complete',async()=>{
    const env=environment(), video=construct(env);
    video.setFrameTiming('vblank'); await video.activate();
    const frame={bytes:new Uint8Array(7680),modes:new Uint8Array(7680),flash:true};
    video.presentRasterFrame(frame,{chrome:0}); video.presentRasterFrame(frame,{chrome:0});
    video.setFrameTiming('timer'); video.redraw();
    env.completions.forEach(d=>d.resolve()); await env.flush(); env.raf();
    assert.equal(env.submitted.length,3,'paused CPU still receives the requested picture');
});

test('frame-rate feedback remains a numeric submitted cadence',async()=>{
    const env=environment(), output={textContent:''}, video=construct(env);
    env.sandbox.document.getElementById=id=>id==='webgpuFrameRateMeasured'?output:null;
    await video.activate(); env.raf(); env.completions.forEach(d=>d.resolve()); await env.flush();
    env.raf(1000); video.redraw(); env.raf();
    assert.match(output.textContent,/^\d+\.\d fps$/);
});

test('selecting a larger character ROM safely grows the GPU ROM buffer',async()=>{
    const env=environment(), video=construct(env);
    await video.activate(); env.raf(); env.completions.forEach(d=>d.resolve()); await env.flush();
    video.setCharRom(new Uint8Array(2048).fill(0x5A),'A2E'); video.redraw(); env.raf();
    assert.equal(video.isReady(),true);
    const rom=env.uploads.find(u=>u.bytes.length===2048);
    assert.ok(rom); assert.equal(rom.buffer.data.length,2048);
});
