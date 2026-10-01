'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');

function makeHarness(){
  const rgba=new Uint8ClampedArray(280*192*4).fill(255);
  let stopped=0,drawCount=0,nextTimer=1;
  const timers=new Map();
  const stream={getTracks(){return [{stop(){stopped++;}}];}};
  const video={videoWidth:280,videoHeight:192,srcObject:null,async play(){},pause(){}};
  const context={drawImage(){drawCount++;},getImageData(){return {data:rgba};}};
  const canvas={width:0,height:0,getContext(){return context;}};
  const document={getElementById(){return null;},createElement(kind){if(kind==='video')return video;if(kind==='canvas')return canvas;throw new Error(kind);}};
  const navigator={mediaDevices:{async getUserMedia(){return stream;}}};
  function setTimeoutFake(fn,ms){const id=nextTimer++;timers.set(id,{fn,ms});return id;}
  function clearTimeoutFake(id){timers.delete(id);}
  return {rgba,stream,video,canvas,document,navigator,setTimeoutFake,clearTimeoutFake,timers,get stopped(){return stopped;},get drawCount(){return drawCount;}};
}

function makeFakeAdapter(log){
  return class {
    async init(){log.init++;}
    configure(settings){log.settings=settings;}
    async convert(rgb,w,h,seed){
      log.convert++;log.width=w;log.height=h;log.seed=seed;log.firstRGB=Array.from(rgb.slice(0,3));
      const palette=new Uint8Array(280*192);
      for(let x=0;x<7;x++) palette[x]=(x%2===0)?3:0;
      return {paletteIndex:palette,backendUsed:'wasm'};
    }
    close(){log.close++;}
  };
}

function loadCard(h,Adapter){
  const source=fs.readFileSync(path.join(ROOT,'res','EMU_CARD_dithertizer.js'),'utf8');
  const sandbox={console,Uint8Array,Uint8ClampedArray,ArrayBuffer,Array,Number,String,Object,Math,RegExp,Promise,
    document:h.document,navigator:h.navigator,setTimeout:h.setTimeoutFake,clearTimeout:h.clearTimeoutFake,
    DithertizerConvertHGRAdapter:Adapter};
  vm.createContext(sandbox);
  vm.runInContext(source+'\nthis.Ctor=DithertizerII;',sandbox,{filename:'EMU_CARD_dithertizer.js'});
  return sandbox.Ctor;
}

function captureFirstByte(card){
 const writes=new Map();
 card.writeSlotIO(0,0x80,{});
 card.readSlotIO(8,{bRO:false,vid:{state:{page2:false}},hw:{write(a,d){writes.set(a&0xffff,d&0xff);}}});
 return {first:writes.get(0x2000),count:writes.size};
}

test('live camera is converted through ConvertHGR WASM palette before DSCAN capture',async()=>{
 const h=makeHarness(),log={init:0,convert:0,close:0};
 const Ctor=loadCard(h,makeFakeAdapter(log));
 const card=new Ctor();
 assert.equal(await card.deviceToolCameraToggle('dither_ctrl_S7'),true);
 assert.equal(log.init,1);assert.equal(log.convert,1);
 assert.deepEqual(log.firstRGB,[255,255,255],'canvas RGBA is transported as RGB24 to ConvertHGR');
 assert.equal(log.settings.image.gamma,1.3);
 assert.equal(log.settings.matching.lumaEmphasis,0.8);
 assert.equal(log.settings.scaling.filter,'bilinear');
 const captured=captureFirstByte(card);
 assert.equal(captured.count,192*40);
 assert.equal(captured.first,0b01010101,'DSCAN samples processed palette luma, not raw all-white canvas');
 assert.equal(await card.deviceToolCameraToggle('dither_ctrl_S7'),false);
 assert.equal(log.close,1);assert.equal(h.stopped,1);
 assert.equal(captureFirstByte(card).first,0,'camera OFF clears processed signal');
});

test('RATE control drives the next one-in-flight conversion interval',async()=>{
 const h=makeHarness(),log={init:0,convert:0,close:0};
 const Ctor=loadCard(h,makeFakeAdapter(log));
 const card=new Ctor();
 card.deviceToolSetting('dither_ctrl_S7','rate',500);
 await card.deviceToolCameraToggle('dither_ctrl_S7');
 assert.equal(h.timers.size,1);
 assert.equal([...h.timers.values()][0].ms,500);
});
