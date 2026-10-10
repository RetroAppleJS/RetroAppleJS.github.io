'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {environment,deferred}=require('./video_webgpu_helpers.cjs');

function setup(options={})
{
    const env=environment(options), context=env.sandbox;
    let visible;
    function canvas()
    {
        return {style:{},cloneNode:canvas,getContext:()=>env.context,parentNode:{replaceChild(next) {visible=next;}}};
    }
    visible=canvas();
    context.document={getElementById:id=>id==='applescreen'?visible:null,createElement:canvas};
    const codes=['A2GPU','A2WAVE','A2THREE','A2CAN'];
    ['Apple2VideoGPU','Apple2VideoWave','Apple2VideoTHREE','Apple2VideoCanvas'].forEach((name,index)=>{
        context[name]=function() {
            this.id={DCODE:codes[index],coID:'Apple2Video',hostPCODE:'A2BO',deviceIdx:index,deviceEnable:true};
            this.reset=()=>{}; this.redraw=()=>{};
            this.setActive=active=>{this.selected=active;};
            this.setGfx=flag=>{this.gfx=flag;}; this.setMix=()=>{}; this.setPage2=()=>{}; this.setHires=()=>{};
            this.setMonitor=()=>{}; this.setCharRom=()=>{}; this.presentRasterFrame=()=>{};
        };
    });
    context._o.EMU_vid_mode='canvas';
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../res/EMU_DEVICE_video_MUX.js'),'utf8'),env.vmContext);
    const mux=new context.Apple2VideoMUX(visible);
    mux.vidram=new Uint8Array(0x6000);
    mux.hw={setVideoRasterCapture() {}};
    mux.reset();
    return {env,mux,get visible() {return visible;}};
}

test('MUX appends WebGPU without changing legacy indices or initializing GPU resources',()=>{
    let requests=0;
    const {mux}=setup({requestAdapter:async()=>{requests++;return null;}});
    assert.deepEqual(Array.from(mux.getRenderModes(),s=>s.name),['gpu','wave','threejs','canvas','webgpu']);
    assert.ok(mux.getRegisteredDevice('A2WGPU'));
    assert.equal(requests,0);
    assert.equal(mux.getRegisteredDevice('A2GPU').selected,false);
    assert.equal(mux.getRegisteredDevice('A2CAN').selected,true);
    mux.setModeByDCODE('A2GPU');
    assert.equal(mux.getRegisteredDevice('A2GPU').selected,true);
    assert.equal(mux.getRegisteredDevice('A2CAN').selected,false);
});

test('MUX retains the visible canvas until selected WebGPU becomes ready',async()=>{
    const gate=deferred(), s=setup({requestAdapter:()=>gate.promise});
    const previous=s.visible;
    s.mux.setModeByDCODE('A2WGPU');
    assert.equal(s.mux.activeName,'webgpu'); assert.equal(s.visible,previous);
    gate.resolve({requestDevice:async()=>s.env.device}); await s.env.flush();
    assert.equal(s.visible,s.mux.canvases.webgpu);
    assert.equal(s.mux.active.isReady(),true);
});

test('initialization failure selects Canvas through normal MUX radio semantics',async()=>{
    const s=setup({unsupported:true}), events=[];
    s.mux.subscribeDeviceSelection(event=>events.push(event.DCODE));
    s.mux.setGfx(true); s.mux.setPage2(true);
    s.mux.setModeByDCODE('A2WGPU'); await s.env.flush();
    assert.equal(s.mux.activeName,'canvas'); assert.equal(s.mux.active.gfx,true);
    assert.equal(s.mux.state.page2,true);
    assert.equal(s.mux.devices.filter(d=>d.id.deviceEnable).length,1);
    assert.deepEqual(events,['A2WGPU','A2CAN']);
});

test('late WebGPU readiness cannot steal a canvas after another selection',async()=>{
    const gate=deferred(), s=setup({requestAdapter:()=>gate.promise});
    s.mux.setModeByDCODE('A2WGPU'); s.mux.setModeByDCODE('A2CAN');
    assert.ok(s.mux.getRegisteredDevice('A2WGPU'));
    const visible=s.visible;
    gate.resolve({requestDevice:async()=>s.env.device}); await s.env.flush(); s.env.raf();
    assert.equal(s.mux.activeName,'canvas'); assert.equal(s.visible,visible);
    assert.equal(s.env.submitted.length,0);
});

test('active device loss falls back, inactive loss does not select a different device',async()=>{
    for(const inactive of [false,true])
    {
        const s=setup(); s.mux.setModeByDCODE('A2WGPU'); await s.env.flush();
        assert.equal(s.mux.activeName,'webgpu');
        if(inactive) s.mux.setModeByDCODE('A2GPU');
        s.env.lose(); await s.env.flush();
        assert.equal(s.mux.activeName,inactive?'gpu':'canvas');
    }
});

test('automatic cycling skips unavailable WebGPU but explicit selection retries',async()=>{
    let requests=0;
    const s=setup({requestAdapter:async()=>{requests++;return null;}});
    s.mux.setModeByDCODE('A2WGPU'); await s.env.flush();
    assert.equal(s.mux.activeName,'canvas');
    s.mux.nextMode(); assert.equal(s.mux.activeName,'gpu');
    s.mux.setModeByDCODE('A2WGPU'); await s.env.flush();
    assert.equal(requests,2);
});

test('MUX timing changes invalidate pending captured input before returning to timer mode',async()=>{
    const s=setup(); s.mux.setModeByDCODE('A2WGPU'); await s.env.flush();
    s.mux.setFrameTiming('vblank');
    const frame={bytes:new Uint8Array(7680),modes:new Uint8Array(7680),flash:true};
    for(let i=0;i<3;i++) s.mux.active.presentRasterFrame(frame,s.mux.state);
    assert.equal(s.env.submitted.length,2);
    s.mux.setFrameTiming('timer');
    s.env.completions.forEach(d=>d.resolve()); await s.env.flush(); s.env.raf();
    const inputs=s.env.uploads.filter(u=>u.bytes.length===15360);
    assert.equal(inputs.length,2);
});
