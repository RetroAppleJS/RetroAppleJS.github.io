'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(){
  const html=fs.readFileSync(path.join(__dirname,'..','tools','MockingboardJS.html'),'utf8');
  const script=html.match(/<script defer type="text\/javascript">([\s\S]*?)var d_fym =/)[1];
  const elements={
    seekbar:{disabled:true,max:'0',value:'0'},
    seektime:{textContent:''},
    output:{textContent:''}
  };
  class AudioContext {
    constructor(){ this.sampleRate=44100; this.destination={}; }
    async resume(){}
    createScriptProcessor(){ return {onaudioprocess:null,connect(){},disconnect(){}}; }
  }
  const ctx={console,Uint8Array,Float32Array,Float64Array,DataView,ArrayBuffer,WebAssembly,Array,Number,Math,Object,JSON,
    atob:s=>Buffer.from(s,'base64').toString('binary'),
    document:{getElementById:id=>elements[id]||null},window:{AudioContext}};
  vm.createContext(ctx);
  require('./helpers/ay_core').loadInto(ctx);
  vm.runInContext(script,ctx);
  ctx.__elements=elements;
  return ctx;
}

function track(frameCount, frameRate, shapeAt){
  const offset=32;
  const dump=new Uint8Array(offset+14*frameCount);
  for(let r=0;r<13;r++) for(let f=0;f<frameCount;f++) dump[offset+r*frameCount+f]=(r+f)&0xff;
  for(let f=0;f<frameCount;f++) dump[offset+13*frameCount+f]=255;
  for(const [f,v] of shapeAt) dump[offset+13*frameCount+f]=v;
  return {dump,offset,frameCount,loopFrame:0,clockRate:1021800,frameRate,
    regs:new Uint8Array(14),frame:0,frameCounter:0,renderer:null};
}

test('shared transport duration uses the shorter loaded FYM',()=>{
  const {MockingboardPlayer:p}=load();
  p.chips=[track(120,60,[[0,3]]),track(75,50,[[0,4]])];
  assert.equal(p.getDurationSeconds(),1.5);
});

test('seek moves both chips to the same time and restores latest envelope shape',async()=>{
  const {MockingboardPlayer:p,__elements}=load();
  const a=track(120,60,[[0,2],[30,7]]);
  const b=track(100,50,[[0,4],[25,9]]);
  p.chips=[a,b];
  assert.equal(await p.start(),true);
  assert.equal(p.seekToSeconds(1),1);
  assert.equal(p.positionSeconds,1);
  assert.equal(a.frame,61);
  assert.equal(b.frame,51);
  const regs=new Uint8Array(14);
  p.core.getRegisters(0,regs);assert.equal(regs[13],7);
  p.core.getRegisters(1,regs);assert.equal(regs[13],9);
  assert.equal(__elements.seekbar.disabled,false);
  assert.equal(Number(__elements.seekbar.max),2);
  assert.equal(Number(__elements.seekbar.value),1);
});

test('Start resumes from the selected transport position instead of frame zero',async()=>{
  const ctx=load();
  const p=ctx.MockingboardPlayer;
  const a=track(120,60,[[0,2],[30,7]]);
  p.chips=[a,null];
  p.positionSeconds=1;
  class AudioContext {
    constructor(){ this.sampleRate=44100; this.destination={}; }
    async resume(){}
    createScriptProcessor(){ return {onaudioprocess:null,connect(){},disconnect(){}}; }
  }
  ctx.window.AudioContext=AudioContext;
  assert.equal(await p.start(),true);
  assert.equal(a.frame,61);
  p.stop();
});

test('tool markup exposes a shared song-position slider',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','tools','MockingboardJS.html'),'utf8');
  assert.match(html,/id="seekbar"/);
  assert.match(html,/MockingboardPlayer\.seekToSeconds\(this\.value\)/);
  assert.match(html,/id="seektime"/);
});

test('shared loop starts at the latest FYM loop point so neither intro is replayed',()=>{
  const {MockingboardPlayer:p}=load();
  const a=track(120,60,[[0,2]]), b=track(100,50,[[0,4]]);
  a.loopFrame=30;   // 0.5 s
  b.loopFrame=50;   // 1.0 s
  p.chips=[a,b];
  assert.equal(p.getLoopSeconds(),1);
});

test('fractional seek and shared looping produce matching real JS and WASM PCM',async()=>{
  const players=[];
  for(const backend of ['js','wasm']){
    const {MockingboardPlayer:p}=load();
    p.backend=backend;
    const a=track(120,60,[[0,2],[30,7]]),b=track(100,50,[[0,4],[25,9]]);
    a.loopFrame=30;b.loopFrame=50;
    p.chips=[a,b];
    assert.equal(await p.start(),true);
    p.seekToSeconds(1.505);
    players.push(p);
  }
  for(let block=0;block<8;block++){
    const outputs=players.map(p=>{
      const channels=[new Float32Array(4096),new Float32Array(4096)];
      p.fillBuffer({outputBuffer:{getChannelData:i=>channels[i]}});
      assert.equal(p.isPlaying,true);
      return channels;
    });
    for(let channel=0;channel<2;channel++)for(let i=0;i<4096;i++){
      assert.ok(Number.isFinite(outputs[0][channel][i]));
      assert.ok(Math.abs(outputs[0][channel][i]-outputs[1][channel][i])<=1e-6);
    }
    assert.equal(players[0].positionSeconds,players[1].positionSeconds);
  }
  assert.ok(players[0].positionSeconds>=1 && players[0].positionSeconds<2);
});

test('seeking to the song end loops both chips without invalid frame reads',async()=>{
  const {MockingboardPlayer:p}=load();
  const a=track(120,60,[[0,2]]),b=track(100,50,[[0,4]]);
  a.loopFrame=30;b.loopFrame=50;p.chips=[a,b];
  assert.equal(await p.start(),true);
  p.seekToSeconds(2);
  const channels=[new Float32Array(512),new Float32Array(512)];
  p.fillBuffer({outputBuffer:{getChannelData:i=>channels[i]}});
  assert.equal(p.isPlaying,true);
  assert.ok(p.positionSeconds>1 && p.positionSeconds<2);
});

test('a shared loop shorter than one quantized output sample stops instead of spinning',async()=>{
  const {MockingboardPlayer:p,__elements}=load();
  const a=track(1,980,[[0,2]]),b=track(2,981,[[0,4]]);
  b.loopFrame=1;p.chips=[a,b];
  assert.equal(await p.start(),true);
  const render=p.core.renderUntil;
  let calls=0;
  p.core.renderUntil=function(...args){
    if(++calls>16)throw new Error('Non-progressing render loop');
    return render(...args);
  };
  const channels=[new Float32Array(128),new Float32Array(128)];
  p.fillBuffer({outputBuffer:{getChannelData:i=>channels[i]}});
  assert.equal(p.isPlaying,false);
  assert.ok(calls<8);
  assert.match(__elements.output.textContent,/shorter than one output sample/);
});

test('a seek while browser resume is pending becomes the selected Start position',async()=>{
  const {MockingboardPlayer:p}=load();
  p.chips=[track(120,60,[[0,2],[30,7]]),null];
  let release,entered;
  const resumed=new Promise(resolve=>{entered=resolve;});
  p.audioContext={sampleRate:44100,destination:{},
    resume(){entered();return new Promise(resolve=>{release=resolve;});},
    createScriptProcessor(){return {connect(){},disconnect(){}};}};
  const starting=p.start();
  await resumed;
  p.seekToSeconds(1);
  release();
  assert.equal(await starting,true);
  assert.equal(p.chips[0].frame,61);
  const channels=[new Float32Array(1),new Float32Array(1)];
  p.fillBuffer({outputBuffer:{getChannelData:i=>channels[i]}});
  assert.ok(p.positionSeconds>=1 && p.positionSeconds<1.001);
});
