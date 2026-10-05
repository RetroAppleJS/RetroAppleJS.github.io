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
  function Ayumi(){
    this.left=0; this.right=0; this.shapeCalls=[];
    this.configure=function(){}; this.setPan=function(){};
    this.setTone=function(){}; this.setNoise=function(){}; this.setMixer=function(){};
    this.setVolume=function(){}; this.setEnvelope=function(){};
    this.setEnvelopeShape=function(v){ this.shapeCalls.push(v); };
    this.process=function(){}; this.removeDC=function(){};
  }
  const ctx={console,Uint8Array,DataView,Array,Number,Math,Object,JSON,Ayumi,
    document:{getElementById:id=>elements[id]||null},window:{}};
  vm.createContext(ctx);
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

test('seek moves both chips to the same time and restores latest envelope shape',()=>{
  const {MockingboardPlayer:p,__elements}=load();
  const a=track(120,60,[[0,2],[30,7]]);
  const b=track(100,50,[[0,4],[25,9]]);
  p.chips=[a,b];
  p.isPlaying=true;
  assert.equal(p.seekToSeconds(1),1);
  assert.equal(p.positionSeconds,1);
  assert.equal(a.frame,61);
  assert.equal(b.frame,51);
  assert.equal(a.renderer.shapeCalls.at(-1),7);
  assert.equal(b.renderer.shapeCalls.at(-1),9);
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
