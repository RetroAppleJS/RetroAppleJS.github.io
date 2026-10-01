//
// EMU_DITHERTIZER_converthgr_worker.js
//
// Shared bundled ConvertHGR worker source. The body between the markers
// is extracted byte-for-byte from tools/ConvertHGR.html. It is kept in
// a function-source carrier so loading this file on the main thread does
// not execute worker code.
//

function ConvertHGRWorkerSourceCarrier()
{
/* CONVERTHGR_WORKER_SOURCE_BEGIN


const WIDTH = 280;
const HEIGHT = 192;
const BYTES_PER_ROW = 40;
const PAGE_BYTES = 8192;

// Embedded optional WASM quantizer/packer backend. Preprocessing remains in JavaScript.
const WASM_HGR_BASE64 = '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';
let wasmBackend = null;
let wasmBackendPromise = null;

function base64Bytes(text){
  const raw=atob(text),out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}
async function ensureWasmBackend(){
  if(wasmBackend)return wasmBackend;
  if(!wasmBackendPromise)wasmBackendPromise=(async()=>{
    const bytes=base64Bytes(WASM_HGR_BASE64);
    const instantiated=await WebAssembly.instantiate(bytes,{});
    const e=instantiated.instance.exports;
    const required=['memory','hgr_get_source_ptr','hgr_get_settings_ptr','hgr_get_palette_ptr','hgr_get_linear_ptr','hgr_get_page_ptr','hgr_convert'];
    for(const name of required)if(!e[name])throw new Error(`WASM backend missing export ${name}`);
    wasmBackend={exports:e,memory:e.memory,sourcePtr:e.hgr_get_source_ptr()>>>0,settingsPtr:e.hgr_get_settings_ptr()>>>0,palettePtr:e.hgr_get_palette_ptr()>>>0,linearPtr:e.hgr_get_linear_ptr()>>>0,pagePtr:e.hgr_get_page_ptr()>>>0};
    return wasmBackend;
  })().catch(error=>{wasmBackendPromise=null;throw error;});
  return wasmBackendPromise;
}
function writeWasmSettings(memory,ptr,settings){
  const v=new Float64Array(memory.buffer,ptr,15),e=settings.dither.error;
  v[0]=settings.matching.perceptual?1:0;v[1]=settings.matching.lumaEmphasis;v[2]=settings.matching.perceptualR;v[3]=settings.matching.perceptualG;v[4]=settings.matching.perceptualB;
  v[5]=settings.dither.orderedMode;v[6]=settings.dither.mapSize;v[7]=settings.dither.orderedOffset;v[8]=settings.dither.accumulateErrors?1:0;
  v[9]=e.A;v[10]=e.B;v[11]=e.C;v[12]=e.D;v[13]=e.E;v[14]=e.F;
}
function quantize280Wasm(rgb,settings,seed){
  if(!wasmBackend)throw new Error('WASM backend has not been initialized');
  const w=wasmBackend,m=w.memory;
  new Uint8Array(m.buffer,w.sourcePtr,WIDTH*HEIGHT*3).set(rgb);
  writeWasmSettings(m,w.settingsPtr,settings);
  const rc=w.exports.hgr_convert(seed>>>0);
  if(rc!==0)throw new Error(`WASM conversion returned status ${rc}`);
  return {paletteImage:new Uint8Array(new Uint8Array(m.buffer,w.palettePtr,WIDTH*HEIGHT)),linearHgr:new Uint8Array(new Uint8Array(m.buffer,w.linearPtr,BYTES_PER_ROW*HEIGHT)),hgrPage:new Uint8Array(new Uint8Array(m.buffer,w.pagePtr,PAGE_BYTES))};
}
async function quantizeWithBackend(rgb,settings,seed,backendRequested='auto'){
  const requested=(backendRequested==='javascript'||backendRequested==='wasm')?backendRequested:'auto';
  if(requested!=='javascript'){
    try{await ensureWasmBackend();return {output:quantize280Wasm(rgb,settings,seed),backendRequested:requested,backendUsed:'wasm',fallbackReason:''};}
    catch(error){const fallbackReason=String(error&&error.message||error);return {output:quantize280(rgb,settings,seed),backendRequested:requested,backendUsed:'javascript',fallbackReason};}
  }
  return {output:quantize280(rgb,settings,seed),backendRequested:requested,backendUsed:'javascript',fallbackReason:''};
}

const PALETTE = [
  [0,0,0], [20,245,60], [255,68,253], [255,255,255],
  [0,0,0], [255,106,60], [20,207,253], [255,255,255]
];

const ORDER2 = [[0/4,2/4],[3/4,1/4]];
const ORDER4 = [
  [0/16,8/16,2/16,10/16],
  [12/16,4/16,14/16,6/16],
  [3/16,11/16,1/16,9/16],
  [15/16,7/16,13/16,5/16]
];

function defaultSettings(){
  return {
    image:{greyscale:false,stretchHistogram:false,gamma:1.30,maxColorShift:1},
    scaling:{filter:'bilinear',fillMode:'default',horizontalNudge:0,verticalNudge:0,applePixelAspect:256/280},
    matching:{perceptual:false,lumaEmphasis:0.80,perceptualR:0.30,perceptualG:0.52,perceptualB:0.18},
    dither:{orderedMode:0,mapSize:2,orderedOffset:0,accumulateErrors:true,error:{A:1,B:2,C:2,D:2,E:1,F:1}}
  };
}

class MsvcRand {
  constructor(seed){ this.state = seed >>> 0; }
  next(){
    this.state = (Math.imul(this.state,214013)+2531011)>>>0;
    return (this.state>>>16)&0x7fff;
  }
}

function makeYuv(r,g,b){
  return [
    0.299*r + 0.587*g + 0.114*b,
    0.500*r - 0.419*g - 0.081*b,
   -0.169*r - 0.331*g + 0.500*b
  ];
}

const PALETTE_YUV = PALETTE.map(c => makeYuv(c[0],c[1],c[2]));

function colorDistance(r,g,b,index,settings){
  const p = PALETTE[index];
  const m = settings.matching;
  const dr=r-p[0], dg=g-p[1], db=b-p[2];
  if(m.perceptual){
    return dr*dr*m.perceptualR + dg*dg*m.perceptualG + db*db*m.perceptualB;
  }
  const q = makeYuv(r,g,b), py = PALETTE_YUV[index];
  const dy=(q[0]-py[0])*m.lumaEmphasis, dcr=q[1]-py[1], dcb=q[2]-py[2];
  return dy*dy+dcr*dcr+dcb*dcb;
}

function hgrOffset(y,byteColumn){
  return ((y&7)<<10) + (((y>>3)&7)<<7) + (Math.floor(y/64)*40) + byteColumn;
}

function packPaletteToHgr(paletteImage){
  if(paletteImage.length !== WIDTH*HEIGHT) throw new Error('paletteImage must be 280x192');
  const out = new Uint8Array(BYTES_PER_ROW*HEIGHT);
  let op=0;
  for(let row=0;row<HEIGHT;row++){
    const rowBase=row*WIDTH;
    for(let col=0;col<WIDTH;col+=7){
      const first=paletteImage[rowBase+col];
      const setBit=first&0x04;
      for(let i=1;i<7;i++) if((paletteImage[rowBase+col+i]&0x04)!==setBit) throw new Error(`palette group mismatch at ${col},${row}`);
      let byte=(setBit<<5)&0x80;
      let col1, col2;
      if(((col/7)&1)!==0){ col1=0x55; col2=0xaa; }
      else { col1=0xaa; col2=0x55; }
      let mask=0x40, maskOut=0x01;
      for(let i=0;i<7;i++,mask>>=1,maskOut<<=1){
        let w=paletteImage[rowBase+col+i]&0x03;
        let on;
        if(w===3) on=1;
        else if(w===1) on=(col1&mask)?1:0;
        else if(w===2) on=(col2&mask)?1:0;
        else on=0;
        if(on) byte|=maskOut;
      }
      out[op++]=byte;
    }
  }
  return out;
}

function interleaveHgrPage(linear){
  if(linear.length !== BYTES_PER_ROW*HEIGHT) throw new Error('linear HGR must be 7680 bytes');
  const page=new Uint8Array(PAGE_BYTES);
  for(let y=0;y<HEIGHT;y++) for(let xb=0;xb<BYTES_PER_ROW;xb++) page[hgrOffset(y,xb)] = linear[y*BYTES_PER_ROW+xb];
  return page;
}

function patternColor(pattern, bit, byteColumn, previousOn){
  let base, odd, even;
  if(byteColumn&1){
    base=(pattern&0x80)?0:4; odd=2; even=1;
  } else {
    base=(pattern&0x80)?4:0; odd=1; even=2;
  }
  const mask=0x40>>bit;
  let c=base;
  if(pattern&mask){
    c |= (bit&1)?odd:even;
    if(bit===0 && previousOn) c|=3;
    if(bit>0 && (pattern&(mask<<1))) c|=3;
    if(pattern&(mask>>1)) c|=3;
  } else {
    if(bit>0 && (pattern&(mask<<1))) c |= (bit&1)?even:odd;
    if(bit===0 && previousOn) c |= (bit&1)?even:odd;
  }
  return c;
}

function previousOnFromPalette(paletteImage,row,col){
  if(col<=0) return 0;
  let last=paletteImage[row*WIDTH+col-1];
  if(((col/7)&1)!==0) return (last&2)?1:0;
  return (last&1)?1:0;
}

function quantize280(rgb,settings=defaultSettings(),seed=0x12345678,progressCallback=null){
  if(rgb.length!==WIDTH*HEIGHT*3) throw new Error('quantize280 expects 280x192 RGB');
  const paletteImage=new Uint8Array(WIDTH*HEIGHT);
  const errBuf=new Float64Array(283*194*3);
  const desired=new Float64Array(7*3);
  const e=settings.dither.error;
  const fA=e.A/16, fB=e.B/16, fC=e.C/16, fD=e.D/16, fE=e.E/16, fF=e.F/16;
  const rng=new MsvcRand(seed);
  const orderedMode=settings.dither.orderedMode|0;
  const mapSize=settings.dither.mapSize===4?4:2;
  const thresholdBase=mapSize===4?ORDER4:ORDER2;
  const threshold=thresholdBase.map(row => row.map(v => v - settings.dither.orderedOffset/16));
  const mapMask=mapSize-1;

  for(let row=0;row<HEIGHT;row++){
    if(progressCallback && (row&7)===0) progressCallback(row,HEIGHT);
    const errDiv=(row===0 || settings.dither.accumulateErrors)?1:3;
    for(let col=0;col<WIDTH;col+=7){
      // desired pixels and incoming error
      for(let c=0;c<7;c++){
        const si=(row*WIDTH+col+c)*3;
        let r=rgb[si],g=rgb[si+1],b=rgb[si+2];
        const pureBlack=r===0&&g===0&&b===0;
        const pureWhite=r===255&&g===255&&b===255;
        if(!pureBlack && !pureWhite){
          if(orderedMode){
            const t=threshold[c&mapMask][row&mapMask];
            r+=r*t; g+=g*t; b+=b*t;
          }
          const ei=(row*282 + (col+c+1))*3;
          r+=errBuf[ei]/errDiv; g+=errBuf[ei+1]/errDiv; b+=errBuf[ei+2]/errDiv;
        }
        const di=c*3; desired[di]=r;desired[di+1]=g;desired[di+2]=b;
      }

      const previousOn=previousOnFromPalette(paletteImage,row,col);
      let bestDistance=256**6;
      let bestPattern=0;
      let bestCarry=[0,0,0,0,0,0];
      let pattern=rng.next()%256;

      for(let count=0;count<256;count++,pattern=(pattern+1)&0xff){
        let dist=0;
        let tmpR=0,tmpG=0,tmpB=0,farR=0,farG=0,farB=0;
        for(let bit=0;bit<7;bit++){
          const di=bit*3;
          let r=desired[di]+tmpR/errDiv;
          let g=desired[di+1]+tmpG/errDiv;
          let b=desired[di+2]+tmpB/errDiv;
          const ci=patternColor(pattern,bit,col/7,previousOn);
          const p=PALETTE[ci];
          const dr=r-p[0],dg=g-p[1],db=b-p[2];
          dist+=colorDistance(r,g,b,ci,settings);
          if(dist>=bestDistance) break;
          tmpR=dr*fD+farR; tmpG=dg*fD+farG; tmpB=db*fD+farB;
          farR=dr*fE; farG=dg*fE; farB=db*fE;
        }
        if(dist<bestDistance){
          bestDistance=dist; bestPattern=pattern;
          bestCarry=[tmpR,tmpG,tmpB,farR,farG,farB];
        }
      }

      // after input-prep loop, C++ pointer is at logical x=col+7; add D/E there
      let right=(row*282 + (col+7+1))*3;
      errBuf[right]+=bestCarry[0];errBuf[right+1]+=bestCarry[1];errBuf[right+2]+=bestCarry[2];
      errBuf[right+3]+=bestCarry[3];errBuf[right+4]+=bestCarry[4];errBuf[right+5]+=bestCarry[5];

      // rebase pointer to next row at logical x=col
      const nextBase=((row+1)*282 + (col+1))*3;
      for(let bit=0;bit<7;bit++){
        let ci=patternColor(bestPattern,bit,col/7,previousOn);
        if(bit===0 && previousOn && (bestPattern&0x40)) paletteImage[row*WIDTH+col-1] |= 0x03;
        paletteImage[row*WIDTH+col+bit]=ci;
        const di=bit*3;
        const p=PALETTE[ci];
        const dr=desired[di]-p[0], dg=desired[di+1]-p[1], db=desired[di+2]-p[2];
        const base=nextBase+bit*3;
        errBuf[base-3]+=dr*fA; errBuf[base-2]+=dg*fA; errBuf[base-1]+=db*fA;
        errBuf[base]+=dr*fB; errBuf[base+1]+=dg*fB; errBuf[base+2]+=db*fB;
        errBuf[base+3]+=dr*fC; errBuf[base+4]+=dg*fC; errBuf[base+5]+=db*fC;
        const foff=base+258*3;
        errBuf[foff]+=dr*fF; errBuf[foff+1]+=dg*fF; errBuf[foff+2]+=db*fF;
      }
    }
  }
  const linearHgr=packPaletteToHgr(paletteImage);
  const hgrPage=interleaveHgrPage(linearHgr);
  return {paletteImage,linearHgr,hgrPage};
}


function filterInfo(name){
  switch(name){
    case 'box': return {width:0.5, fn:x=>Math.abs(x)<=0.5?1:0};
    case 'gaussian': return {width:3, fn:x=>Math.abs(x)>3?0:Math.exp(-(x*x)/2)/Math.sqrt(2*Math.PI)};
    case 'hamming': return {width:0.5, fn:x=>{ if(Math.abs(x)>0.5)return 0; const win=0.54+0.46*Math.cos(2*Math.PI*x); const sinc=x===0?1:Math.sin(Math.PI*x)/(Math.PI*x); return win*sinc; }};
    case 'blackman': return {width:0.5, fn:x=>{ if(Math.abs(x)>0.5)return 0; const n=2*0.5+1; return 0.42+0.5*Math.cos(2*Math.PI*x/(n-1))+0.08*Math.cos(4*Math.PI*x/(n-1)); }};
    default: return {width:1, fn:x=>{ x=Math.abs(x); return x<1?1-x:0; }};
  }
}

function contributions(dstSize,srcSize,filterName){
  const f=filterInfo(filterName), scale=dstSize/srcSize;
  let width=f.width, fscale=1;
  if(scale<1){ width=f.width/(scale===0?1:scale); fscale=scale===0?1:scale; }
  const windowSize=2*Math.ceil(width)+1;
  const out=new Array(dstSize);
  for(let u=0;u<dstSize;u++){
    const center=u/scale;
    let left=Math.max(0,Math.floor(center-width));
    let right=Math.min(Math.ceil(center+width),srcSize-1);
    if(right-left+1>windowSize){
      // Preserve original expression semantics: int(uSrcSize) - 1/2 means srcSize - 0.5.
      if(left < srcSize - 0.5) left++; else right--;
    }
    const weights=[];
    let total=0;
    for(let i=left;i<=right;i++){
      const w=fscale*f.fn(fscale*(center-i));
      weights.push(w); total+=w;
    }
    if(total>0) for(let i=0;i<weights.length;i++) weights[i]/=total;
    out[u]={left,right,weights};
  }
  return out;
}

function byteFromFloat(v){ return (Math.trunc(Math.fround(v)+0.5)&0xff); }

function resampleRGB(src,srcW,srcH,dstW,dstH,filterName='bilinear'){
  if(srcW===dstW && srcH===dstH) return new Uint8Array(src);
  let horiz;
  if(srcW===dstW){ horiz=new Uint8Array(src); }
  else {
    const contrib=contributions(dstW,srcW,filterName);
    horiz=new Uint8Array(dstW*srcH*3);
    for(let y=0;y<srcH;y++){
      for(let x=0;x<dstW;x++){
        const c=contrib[x]; let r=0,g=0,b=0;
        for(let i=c.left;i<=c.right;i++){
          const w=c.weights[i-c.left], si=(y*srcW+i)*3;
          r=Math.fround(r+Math.fround(w*src[si]));
          g=Math.fround(g+Math.fround(w*src[si+1]));
          b=Math.fround(b+Math.fround(w*src[si+2]));
        }
        const di=(y*dstW+x)*3; horiz[di]=byteFromFloat(r);horiz[di+1]=byteFromFloat(g);horiz[di+2]=byteFromFloat(b);
      }
    }
  }
  if(srcH===dstH) return horiz;
  const contrib=contributions(dstH,srcH,filterName), out=new Uint8Array(dstW*dstH*3);
  for(let x=0;x<dstW;x++){
    for(let y=0;y<dstH;y++){
      const c=contrib[y]; let r=0,g=0,b=0;
      for(let i=c.left;i<=c.right;i++){
        const w=c.weights[i-c.left], si=(i*dstW+x)*3;
        r=Math.fround(r+Math.fround(w*horiz[si]));
        g=Math.fround(g+Math.fround(w*horiz[si+1]));
        b=Math.fround(b+Math.fround(w*horiz[si+2]));
      }
      const di=(y*dstW+x)*3; out[di]=byteFromFloat(r);out[di+1]=byteFromFloat(g);out[di+2]=byteFromFloat(b);
    }
  }
  return out;
}

function applyGreyscale(src,settings){
  const out=new Uint8Array(src), m=settings.matching;
  for(let i=0;i<out.length;i+=3){
    const r=out[i],g=out[i+1],b=out[i+2];
    let y;
    if(m.perceptual) y=Math.trunc(r*m.perceptualR+g*m.perceptualG+b*m.perceptualB+0.5);
    else y=Math.trunc(0.299*r+0.587*g+0.114*b);
    if(y<0)y=0;if(y>255)y=255;
    out[i]=out[i+1]=out[i+2]=y;
  }
  return out;
}

function applyGamma(src,settings){
  const gamma=settings.image.gamma;
  if(gamma===0 || gamma===1) return new Uint8Array(src);
  const out=new Uint8Array(src), correct=1/gamma;
  for(let i=0;i<out.length;i++) out[i]=Math.trunc(Math.pow(out[i]/255,correct)*255)&0xff;
  return out;
}

function applyMaxColorShift(src,settings){
  const pct=settings.image.maxColorShift;
  if(!(pct>0)) return new Uint8Array(src);
  const out=new Uint8Array(src);
  const maxBase=3*255*255, maxRange=maxBase*Math.pow(pct/100,2);
  for(let i=0;i<out.length;i+=3){
    let r=out[i],g=out[i+1],b=out[i+2],mind=maxBase,best=0;
    for(let c=0;c<8;c++){
      const p=PALETTE[c],dr=r-p[0],dg=g-p[1],db=b-p[2],d=dr*dr+dg*dg+db*db;
      if(d<mind){mind=d;best=c;}
    }
    const p=PALETTE[best];
    if(mind<=maxRange){r=p[0];g=p[1];b=p[2];}
    else if(mind>0){
      const scale=Math.sqrt(maxRange/mind);
      const move=(v,t)=>{const d=(t-v)*scale; return v+Math.trunc(d<0?d-0.5:d+0.5);};
      r=move(r,p[0]);g=move(g,p[1]);b=move(b,p[2]);
    }
    out[i]=r&255;out[i+1]=g&255;out[i+2]=b&255;
  }
  return out;
}

function applyHistogramApprox(src){
  // Compatibility gap: ImgSource's exact histogram equalizer is external to ConvertHGR.
  // This approximation stretches luminance percentiles 32..224 while retaining chroma ratios.
  const out=new Uint8Array(src), hist=new Uint32Array(256);
  for(let i=0;i<src.length;i+=3){const y=Math.max(0,Math.min(255,Math.round(0.299*src[i]+0.587*src[i+1]+0.114*src[i+2])));hist[y]++;}
  const total=src.length/3, loTarget=total*(32/256), hiTarget=total*(224/256);
  let cum=0,lo=0,hi=255;
  for(let v=0;v<256;v++){cum+=hist[v];if(cum>=loTarget){lo=v;break;}}
  cum=0;for(let v=0;v<256;v++){cum+=hist[v];if(cum>=hiTarget){hi=v;break;}}
  if(hi<=lo) return out;
  const scale=255/(hi-lo);
  for(let i=0;i<out.length;i++) out[i]=Math.max(0,Math.min(255,Math.round((out[i]-lo)*scale)));
  return out;
}

function scaleAndFrame(src,srcW,srcH,settings){
  const mode=settings.scaling.fillMode, aspect=256/280;
  const xScale=WIDTH/srcW, yScale=HEIGHT/srcH;
  let axis='y';
  if(srcH*(xScale*aspect)>HEIGHT) axis='y';
  if(srcW*(yScale/aspect)>WIDTH) axis='x';
  if(mode!=='default') axis=axis==='y'?'x':'y';
  let finalW,finalH;
  if(axis==='y') {finalW=Math.trunc(srcW*(yScale/aspect)+0.5);finalH=Math.trunc(srcH*yScale+0.5);}
  else {finalW=Math.trunc(srcW*xScale+0.5);finalH=Math.trunc(srcH*(xScale*aspect)+0.5);}
  finalW=Math.max(1,finalW);finalH=Math.max(1,finalH);
  let scaled=resampleRGB(src,srcW,srcH,finalW,finalH,settings.scaling.filter);
  let cropX=0,cropY=0,cropW=Math.min(finalW,WIDTH),cropH=Math.min(finalH,HEIGHT);
  if(finalH>HEIGHT){
    if(mode==='middle') cropY=Math.trunc((finalH-HEIGHT)/2);
    else if(mode==='bottom-right') cropY=finalH-HEIGHT;
    cropY+=settings.scaling.verticalNudge|0;
    cropY=Math.max(0,Math.min(finalH-HEIGHT,cropY));cropH=HEIGHT;
  }
  if(finalW>WIDTH){
    if(mode==='middle') cropX=Math.trunc((finalW-WIDTH)/2);
    else if(mode==='bottom-right') cropX=finalW-WIDTH;
    cropX=Math.max(0,Math.min(finalW-WIDTH,cropX));cropW=WIDTH;
  }
  const out=new Uint8Array(WIDTH*HEIGHT*3);
  const copyW=Math.min(cropW,WIDTH),copyH=Math.min(cropH,HEIGHT);
  const dstX=Math.trunc((WIDTH-copyW)/2), dstY=Math.trunc((HEIGHT-copyH)/2);
  for(let y=0;y<copyH;y++){
    const s=((cropY+y)*finalW+cropX)*3,d=((dstY+y)*WIDTH+dstX)*3;
    out.set(scaled.subarray(s,s+copyW*3),d);
  }
  const off=settings.scaling.horizontalNudge|0;
  if(off>0){out.copyWithin(0,off*3,out.length);}
  else if(off<0){const b=(-off)*3;out.copyWithin(b,0,out.length-b);}
  return out;
}

function prepareSourceRGB(src,srcW,srcH,settings){
  let work=settings.image.greyscale?applyGreyscale(src,settings):new Uint8Array(src);
  work=scaleAndFrame(work,srcW,srcH,settings);
  if(settings.image.stretchHistogram) work=applyHistogramApprox(work);
  work=applyGamma(work,settings);
  work=applyMaxColorShift(work,settings);
  return work;
}

function convertHgrCore({sourceRGB,sourceWidth,sourceHeight,settings=defaultSettings(),randomSeed=0x12345678}){
  const processedRGB=prepareSourceRGB(sourceRGB,sourceWidth,sourceHeight,settings);
  const q=quantize280(processedRGB,settings,randomSeed);
  return {processedRGB,...q};
}


function cloneSettings(v){ return JSON.parse(JSON.stringify(v)); }

function nowMs(){ return (typeof performance!=="undefined"&&performance.now)?performance.now():Date.now(); }

function makeFixtureRGB(name,args={}){
  const out=new Uint8Array(WIDTH*HEIGHT*3);
  if(name==='solidRGB'){
    for(let i=0;i<out.length;i+=3){out[i]=args.r||0;out[i+1]=args.g||0;out[i+2]=args.b||0;}
    return out;
  }
  if(name==='horizontalGradient'){
    for(let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++){
      const v=Math.round(x*255/(WIDTH-1)),i=(y*WIDTH+x)*3;out[i]=out[i+1]=out[i+2]=v;
    }
    return out;
  }
  if(name==='byteBoundaryPattern'){
    const marks=new Set([5,6,7,8,12,13,14,15,20,21,22]);
    for(let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++){
      const i=(y*WIDTH+x)*3,v=marks.has(x)?255:0;out[i]=v;out[i+1]=(y&1)?v:0;out[i+2]=(y&1)?0:v;
    }
    return out;
  }
  if(name==='phasePattern'){
    const cols=[[255,68,253],[20,245,60],[20,207,253],[255,106,60],[255,255,255],[0,0,0]];
    for(let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++){
      const c=cols[Math.floor(x/14)%cols.length],i=(y*WIDTH+x)*3;out[i]=c[0];out[i+1]=c[1];out[i+2]=c[2];
    }
    return out;
  }
  let s=(args.seed||0x31415926)>>>0;
  for(let i=0;i<out.length;i++){s=(Math.imul(s,1664525)+1013904223)>>>0;out[i]=s>>>24;}
  return out;
}

function sha256Bytes(bytes){
  function rr(v,n){return (v>>>n)|(v<<(32-n));}
  const K=[
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const len=bytes.length, bitLen=len*8;
  const padLen=((len+9+63)>>6)<<6, data=new Uint8Array(padLen);data.set(bytes);data[len]=0x80;
  const dv=new DataView(data.buffer);dv.setUint32(padLen-4,bitLen>>>0,false);dv.setUint32(padLen-8,Math.floor(bitLen/0x100000000),false);
  const w=new Uint32Array(64);
  for(let o=0;o<padLen;o+=64){
    for(let i=0;i<16;i++)w[i]=dv.getUint32(o+i*4,false);
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2],s0=rr(a,7)^rr(a,18)^(a>>>3),s1=rr(b,17)^rr(b,19)^(b>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
    let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for(let i=0;i<64;i++){const S1=rr(e,6)^rr(e,11)^rr(e,25),ch=(e&f)^((~e)&g),t1=(h+S1+ch+K[i]+w[i])>>>0,S0=rr(a,2)^rr(a,13)^rr(a,22),maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;
  }
  return Array.from(H,x=>x.toString(16).padStart(8,'0')).join('');
}

function firstMismatch(actual,expected){
  if(!expected)return null; const n=Math.min(actual.length,expected.length);let count=0,first=-1;
  for(let i=0;i<n;i++)if(actual[i]!==expected[i]){count++;if(first<0)first=i;}
  count+=Math.abs(actual.length-expected.length);return {first,count};
}

const FIXTURES=[
  {id:'Q00_BLACK',group:'quantizer',kind:'procedural',generator:'solidRGB',args:{r:0,g:0,b:0},seed:0x12345678},
  {id:'Q01_WHITE',group:'quantizer',kind:'procedural',generator:'solidRGB',args:{r:255,g:255,b:255},seed:0x12345678},
  {id:'Q03_7PX_BOUNDARIES',group:'quantizer',kind:'procedural',generator:'byteBoundaryPattern',args:{},seed:0x12345678},
  {id:'Q05_PHASE',group:'quantizer',kind:'procedural',generator:'phasePattern',args:{},seed:0x12345678},
  {id:'Q06_LUMA_GRADIENT',group:'quantizer',kind:'procedural',generator:'horizontalGradient',args:{},seed:0x12345678},
  {id:'Q08_RANDOM_RGB',group:'quantizer',kind:'procedural',generator:'randomRGB',args:{seed:0x31415926},seed:0x12345678},
  {id:'H01_INTERLEAVE',group:'core',kind:'structural'},
  {id:'DET_REPEAT',group:'core',kind:'determinism'}
];

function runFixture(f){
  const t0=nowMs();
  if(f.kind==='structural'){
    const linear=new Uint8Array(7680);for(let y=0;y<192;y++)for(let b=0;b<40;b++)linear[y*40+b]=(y+b)&255;
    const page=interleaveHgrPage(linear);let ok=true;
    for(let y=0;y<192;y++)for(let b=0;b<40;b++)if(page[hgrOffset(y,b)]!==linear[y*40+b])ok=false;
    return {fixtureId:f.id,status:ok?'pass':'fail',durationMs:nowMs()-t0,stages:{hgrPage:ok?'pass':'fail'},hashes:{hgrPage:sha256Bytes(page)}};
  }
  const rgb=makeFixtureRGB(f.generator,f.args),settings=defaultSettings();settings.image.gamma=1;settings.image.maxColorShift=0;
  if(f.id==='Q00_BLACK'||f.id==='Q01_WHITE')settings.dither.error={A:0,B:0,C:0,D:0,E:0,F:0};
  const one=quantize280(rgb,settings,f.seed);
  if(f.kind==='determinism'){
    const two=quantize280(rgb,settings,f.seed);const ok=sha256Bytes(one.hgrPage)===sha256Bytes(two.hgrPage);
    return {fixtureId:f.id,status:ok?'pass':'fail',durationMs:nowMs()-t0,stages:{determinism:ok?'pass':'fail'},hashes:{hgrPage:sha256Bytes(one.hgrPage)}};
  }
  const legal=one.paletteImage.every(v=>v<=7)&&one.linearHgr.length===7680&&one.hgrPage.length===8192;
  return {fixtureId:f.id,status:legal?'reference-pending':'fail',durationMs:nowMs()-t0,stages:{paletteImage:legal?'structural-pass':'fail',linearHgr:legal?'structural-pass':'fail',hgrPage:legal?'structural-pass':'fail'},hashes:{paletteImage:sha256Bytes(one.paletteImage),linearHgr:sha256Bytes(one.linearHgr),hgrPage:sha256Bytes(one.hgrPage)},note:'Desktop ConvertHGR golden hash not embedded yet.'};
}

async function runWasmParityFixture(){
  const t0=nowMs(),settings=defaultSettings(),rgb=makeFixtureRGB('randomRGB',{seed:0x91e10da5}),seed=0x2468ace0;
  try{
    const js=quantize280(rgb,settings,seed);
    await ensureWasmBackend();
    const wa=quantize280Wasm(rgb,settings,seed);
    let first=-1,count=0;
    const pairs=[[js.paletteImage,wa.paletteImage],[js.linearHgr,wa.linearHgr],[js.hgrPage,wa.hgrPage]];
    for(const [a,b] of pairs)for(let i=0;i<a.length;i++)if(a[i]!==b[i]){count++;if(first<0)first=i;}
    const ok=count===0;
    return {fixtureId:'WASM_JS_PARITY',status:ok?'pass':'fail',durationMs:nowMs()-t0,stages:{wasm:ok?'pass':'fail'},hashes:{hgrPage:sha256Bytes(wa.hgrPage)},note:ok?'WASM quantizer matches JavaScript byte-for-byte.':`WASM differs from JavaScript (${count} byte mismatches; first index ${first}).`};
  }catch(error){
    return {fixtureId:'WASM_JS_PARITY',status:'reference-pending',durationMs:nowMs()-t0,stages:{wasm:'unavailable'},hashes:{},note:`WASM unavailable; JavaScript fallback remains active: ${String(error&&error.message||error)}`};
  }
}

function traceByte(rgb,settings,seed,row,byteColumn){
  // Lightweight diagnostics: return the actual winning byte and source/processed pixel values.
  const q=quantize280(rgb,settings,seed),x=byteColumn*7,values=[];
  for(let i=0;i<7;i++){const o=(row*WIDTH+x+i)*3;values.push([rgb[o],rgb[o+1],rgb[o+2]]);}
  const v=q.linearHgr[row*40+byteColumn];
  return {row,byteColumn,x0:x,sourcePixels:values,winner:{pattern:v,phase:(v>>7)&1,dataBits:Array.from({length:7},(_,i)=>(v>>i)&1)},pageOffset:hgrOffset(row,byteColumn)};
}

self.onmessage=async function(event){
  const msg=event.data||{};
  try{
    if(msg.type==='convert'){
      const t0=nowMs(),settings=msg.settings||defaultSettings(),sourceRGB=new Uint8Array(msg.source.rgbBuffer);
      self.postMessage({type:'progress',requestId:msg.requestId,stage:'preprocessing',current:0,total:1});
      const p0=nowMs(),processedRGB=prepareSourceRGB(sourceRGB,msg.source.width,msg.source.height,settings),p1=nowMs();
      self.postMessage({type:'progress',requestId:msg.requestId,stage:'quantize',current:0,total:192});
      const q0=nowMs(),backend=await quantizeWithBackend(processedRGB,settings,msg.randomSeed>>>0,msg.backend||'auto'),q=backend.output,q1=nowMs();
      self.postMessage({type:'progress',requestId:msg.requestId,stage:'quantize',current:192,total:192});
      self.postMessage({type:'conversionResult',requestId:msg.requestId,metadata:{randomSeed:msg.randomSeed>>>0,outputWidth:280,outputHeight:192,histogramParity:settings.image.stretchHistogram?'approximation':'not-used',backendRequested:backend.backendRequested,backendUsed:backend.backendUsed,backendFallbackReason:backend.fallbackReason},timing:{preprocessingMs:p1-p0,quantizationMs:q1-q0,totalMs:nowMs()-t0},buffers:{processedRGB:processedRGB.buffer,paletteImage:q.paletteImage.buffer,linearHgr:q.linearHgr.buffer,hgrPage:q.hgrPage.buffer}},[processedRGB.buffer,q.paletteImage.buffer,q.linearHgr.buffer,q.hgrPage.buffer]);
    } else if(msg.type==='runTests'){
      const wanted=new Set(msg.groups||['core','quantizer']);let pass=0,fail=0,pending=0;
      for(const f of FIXTURES){if(!wanted.has(f.group))continue;const r=runFixture(f);if(r.status==='pass')pass++;else if(r.status==='reference-pending')pending++;else fail++;self.postMessage({type:'testResult',requestId:msg.requestId,...r});}
      if(wanted.has('core')){const r=await runWasmParityFixture();if(r.status==='pass')pass++;else if(r.status==='reference-pending')pending++;else fail++;self.postMessage({type:'testResult',requestId:msg.requestId,...r});}
      self.postMessage({type:'testSuiteComplete',requestId:msg.requestId,passed:pass,failed:fail,referencePending:pending});
    } else if(msg.type==='traceByte'){
      const rgb=new Uint8Array(msg.rgbBuffer);const result=traceByte(rgb,msg.settings,msg.randomSeed>>>0,msg.row|0,msg.byteColumn|0);
      self.postMessage({type:'traceByteResult',requestId:msg.requestId,...result});
    }
  }catch(error){self.postMessage({type:'error',requestId:msg.requestId||0,stage:msg.type||'worker',code:error.name||'Error',message:String(error.message||error),stack:String(error.stack||'')});}
};


CONVERTHGR_WORKER_SOURCE_END */
}

var CONVERTHGR_WORKER_SOURCE=(function()
{
    var source=ConvertHGRWorkerSourceCarrier.toString();
    var begin="/* CONVERTHGR_WORKER_SOURCE_BEGIN\n";
    var end="\nCONVERTHGR_WORKER_SOURCE_END */";
    var i=source.indexOf(begin);
    var j=source.lastIndexOf(end);
    if(i<0 || j<0 || j<=i)
        throw new Error("ConvertHGR bundled worker source markers not found");
    return source.slice(i+begin.length,j);
})();
