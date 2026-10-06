'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/mockingboard_scheduler');
const options={chipCount:2,sampleRate:22050,timebaseHz:1000000000,maxFrames:8192,maxEvents:64};
async function core(ctx,backend,renderProfile='economy',extra={}) {
    const config={...options,...extra,backend};
    if(renderProfile!==null)config.renderProfile=renderProfile;
    const c=await ctx.AYCore.create(config);
    for(let i=0;i<2;i++) {
        c.configureChip(i,{model:i?'YM':'AY',clockHz:1021800});
        c.setMix(i,i?[0,.5,0,.5,0,.5]:[.5,0,.5,0,.5,0]);
        c.writeNow(i,0,100);c.writeNow(i,6,3);c.writeNow(i,7,0x30);
        c.writeNow(i,8,16);c.writeNow(i,9,8);c.writeNow(i,10,12);
        c.writeNow(i,11,11);c.writeNow(i,13,10);
    }
    return c;
}
function output(){return {left:new Float32Array(8192),right:new Float32Array(8192)};}
function render(c,t,batch=null){const o=output();const n=c.renderUntil(t,batch,o);return {left:o.left.slice(0,n),right:o.right.slice(0,n)};}
function same(a,b,tolerance=0){
    for(const channel of ['left','right']) {
        assert.equal(a[channel].length,b[channel].length);
        for(let i=0;i<a[channel].length;i++)assert.ok(Math.abs(a[channel][i]-b[channel][i])<=tolerance,channel+' sample '+i);
    }
}
function jsState(c){return JSON.parse(Buffer.from(c.saveState().slice(28)).toString());}

test('economy profile uses a distinct renderer while omitted profile retains reference PCM',async()=>{
    const ctx=load(),a=await core(ctx,'js','reference'),b=await core(ctx,'js');
    const defaultCore=await core(ctx,'js',null);
    const explicitCore=await core(ctx,'js','reference');
    try {
        assert.notDeepEqual(render(a,10000000).left,render(b,10000000).left);
        const defaultPCM=render(defaultCore,10000000);
        assert.ok(defaultPCM.left.some(x=>Math.abs(x)>.001));
        same(defaultPCM,render(explicitCore,10000000));
        assert.throws(()=>ctx.AYCore.configuration({renderProfile:'unknown'}),e=>e.code==='E_ARGUMENT');
    } finally {for(const c of [a,b,defaultCore,explicitCore])c.destroy();}
});

test('economy advances every tone, noise and envelope tick when four clocks fit each substep',async()=>{
    const ctx=load(),c=await ctx.AYCore.create({...options,chipCount:1,sampleRate:20000,backend:'js',renderProfile:'economy'});
    try {
        c.configureChip(0,{model:'AY',clockHz:1280000});
        c.writeNow(0,0,7);c.writeNow(0,6,3);c.writeNow(0,11,11);c.writeNow(0,13,10);
        render(c,10000000); // 10 ms = 1600 AY generator ticks.
        const p=jsState(c).chips[0];
        assert.equal(p.channels[0].toneCounter,4);
        assert.equal(p.channels[0].tone,0);
        assert.equal(p.noiseCounter,4);
        assert.equal(p.noise,577,'266 shifts of the seeded AY LFSR');
        assert.equal(p.envelopeCounter,5);
        assert.ok(p.x>=0&&p.x<1);
        assert.equal(c.config.renderProfile,'economy');
    } finally {c.destroy();}
});

for(const shape of Array.from({length:16},(_,i)=>i))test('economy JS/WASM parity: envelope '+shape,async()=>{
    const ctx=load(),js=await core(ctx,'js'),wasm=await core(ctx,'wasm');
    try {
        for(const c of [js,wasm]){c.writeNow(0,13,shape);c.writeNow(1,13,shape);}
        const data=new Uint8Array(5*16),view=new DataView(data.buffer);
        ctx.AYCore.packEvent(view,0,1234567,0,0,13,shape);
        ctx.AYCore.packEvent(view,1,1234567,1,0,13,shape);
        ctx.AYCore.packEvent(view,2,22222222,0,0,0,37);
        ctx.AYCore.packEvent(view,3,30000000,1,1,0,0);
        ctx.AYCore.packEvent(view,4,50000000,1,0,8,15);
        same(render(js,100000000,{data,count:5}),render(wasm,100000000,{data,count:5}),1e-7);
    } finally {js.destroy();wasm.destroy();}
});

for(const backend of ['js','wasm'])test(backend+': economy snapshots, splits and reset preserve phase',async()=>{
    const ctx=load(),whole=await core(ctx,backend),split=await core(ctx,backend),reference=await core(ctx,backend,'reference');
    try {
        const expected=render(whole,20000000),first=render(split,7777777),saved=split.saveState();
        const second=render(split,20000000);split.loadState(saved);
        same(second,render(split,20000000));
        for(const channel of ['left','right'])assert.deepEqual(Float32Array.from([...first[channel],...second[channel]]),expected[channel]);
        assert.throws(()=>reference.loadState(saved),e=>e.code==='E_STATE');
        whole.resetTransport(0);split.resetTransport(0);
        for(const c of [whole,split]){c.writeNow(0,8,15);c.writeNow(0,0,1);c.writeNow(0,7,0x3e);}
        same(render(whole,20000000),render(split,20000000));
    } finally {whole.destroy();split.destroy();reference.destroy();}
});

for(const backend of ['js','wasm'])test(backend+': economy preserves an 800 Hz tone',async()=>{
    const ctx=load(),c=await ctx.AYCore.create({...options,chipCount:1,sampleRate:20000,backend,renderProfile:'economy'});
    try {
        c.configureChip(0,{model:'AY',clockHz:1280000});
        c.writeNow(0,0,100);c.writeNow(0,7,0x3e);c.writeNow(0,8,15);
        const samples=render(c,250000000).left;
        let crossings=0;
        for(let i=1001;i<5000;i++)if(samples[i-1]<=0&&samples[i]>0)crossings++;
        assert.ok(crossings>=158&&crossings<=162,'0.2 s must contain about 160 periods, got '+crossings);
    } finally {c.destroy();}
});
