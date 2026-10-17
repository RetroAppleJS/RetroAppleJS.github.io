const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const mod = require('./DualHGR75_25.js');
const W=280,H=192;
assert.equal(mod.offset(0,0),0);
assert.equal(mod.offset(1,0),1024);
assert.equal(mod.offset(8,0),128);
assert.equal(mod.offset(64,0),40);
assert.equal(mod.offset(191,39),0x1FF7);
const bytes=new Uint8Array(192*40);
for(let i=0;i<bytes.length;i++)bytes[i]=(i*73)&255;
assert.deepEqual(mod.unpack(mod.pack(bytes)),bytes);
// Three-neighbor examples: isolated black/white/purple, and white neighbors.
let row=new Uint8Array(40);
assert.equal(mod.colorAt(row,0),0);
row[0]=0x01;
assert.equal(mod.colorAt(row,0),3);
row[0]=0x03;
assert.equal(mod.colorAt(row,0),15);
row[0]=0x05;
assert.equal(mod.colorAt(row,1),3); // a bit gap between two set bits artifacts
row[0]=0x00;row[1]=0x01;row[0]=0x40;
assert.equal(mod.colorAt(row,6),15); // white across byte boundary
row=new Uint8Array(40);row[0]=0x80|0x01;
assert.equal(mod.colorAt(row,0),6);
// Match the WebGPU shader's HGR neighborhood expression at every screen x.
// Compare to an independent packed-byte/bit-window formulation.
for (let sample=0; sample<16; sample++) {
  const testRow=new Uint8Array(40);
  for (let i=0;i<40;i++) testRow[i]=(sample*59+i*197)&255;
  for(let x=0;x<W;x++) {
    const col=(x/7)|0,bit=x%7,d=testRow[col],
      left=col ? testRow[col-1] : 0,right=col<39?testRow[col+1]:0;
    const bits=((right&127)<<8)|((d&127)<<1)|((left>>6)&1);
    const b3=(bits>>bit)&7;
    const d1=(36>>b3)&1,d2=(200>>b3)&1;
    const dl=(1+((((x^b3)<<1)&2)|(((x^b3)&1)^(d>>7))))*(d1?1:0);
    const expected=(dl*3)|(d2?15:0);
    assert.equal(mod.colorAt(testRow,x),expected,`shader parity at x=${x}`);
  }
}
// Determinism, byte correctness, mixed output and quality on a challenging image.
const rgb=new Uint8Array(W*H*3);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*3;
  rgb[i]=Math.round(255*x/(W-1));
  rgb[i+1]=Math.round(255*y/(H-1));
  rgb[i+2]=Math.round((Math.sin(x/23+y/17)*.5+.5)*255);
}
const start=performance.now();
const o=mod.convert(rgb,{passes:1,jointCandidates:5});
const elapsed=Math.round(performance.now()-start);
assert.equal(o.hgrPage.length,8192);
assert.equal(o.hgr2Page.length,8192);
assert.equal(o.previewRGB.length,W*H*3);
assert.deepEqual(mod.decodeCombined(o.hgrPage,o.hgr2Page),o.previewRGB);
assert(o.rgbRMSE>0&&o.rgbRMSE<130,'reasonable numerical RMSE');
console.log({elapsedMs:elapsed,rgbRMSE:o.rgbRMSE,distinctPages:!o.hgrPage.every((v,i)=>v===o.hgr2Page[i])});

const s=mod.convert(rgb,{duty:.999,passes:1,jointCandidates:5});
assert(o.rgbRMSE<s.rgbRMSE,'dual-page optimizer should improve this test image');
console.log({singlePageApproxRMSE:s.rgbRMSE,dualPageRMSE:o.rgbRMSE,objectiveMSE:o.objectiveMSE});
