// CPU-free video MUX integration tests for HGR Script Studio phases 1 and 2.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const bridge=fs.readFileSync(path.join(__dirname,'../tools/HGR_SCRIPT_STUDIO_video_bridge.js'),'utf8');
const studio=fs.readFileSync(path.join(__dirname,'../tools/HGR_SCRIPT_STUDIO.html'),'utf8');
const muxSource=fs.readFileSync(path.join(__dirname,'../res/EMU_DEVICE_video_MUX.js'),'utf8');
const modes=['gpu','wave','threejs','canvas','webgpu'];

function setup() {
  const created=[];
  class VideoMUX {
    constructor(canvas){
      this.canvas=canvas;this.baseCanvas=canvas;
      this.canvases={};this.calls=[];this.listeners=[];this.mode='gpu';
      this.waveDirtyCount=0;created.push(this);
    }
    getRenderModeIndexByName(name){return modes.indexOf(name);}
    getRenderModes(){return modes.map(name=>({name}));}
    getRenderModeSpec(name){return modes.includes(name)?{name}:null;}
    getRendererInstance(name){
      return modes.includes(name)?{id:{DCODE:'DEV_'+name,mode:name}}:null;
    }
    subscribeDeviceSelection(fn){this.listeners.push(fn);return ()=>{};}
    setModeByDCODE(code){
      const name=code.replace(/^DEV_/,'');
      if(!modes.includes(name))return false;
      this.mode=name;
      this.canvas=name==='canvas'?this.baseCanvas:{id:'applescreen',backend:name};
      this.calls.push(['select',name]);
      for(const fn of this.listeners)fn({mode:name});
      return true;
    }
    reset(){this.mode=modes[this.modeIndex];this.calls.push(['reset',this.vidram,this.hw,this.canvases.canvas]);}
    setMix(value){this.calls.push(['mix',value]);}
    setGfx(value){this.calls.push(['gfx',value]);}
    setHires(value){this.calls.push(['hires',value]);}
    setPage2(value){this.calls.push(['page2',value]);}
    setMonitor(value){this.calls.push(['monitor',value]);}
    redraw(){this.calls.push(['redraw']);}
    getRenderMode(){return this.mode;}
    getActiveRenderer(){
      return this.mode==='wave'?{markDirty:()=>{this.waveDirtyCount++;}}:{};
    }
  }
  const ctx={Apple2VideoMUX:VideoMUX,Apple2VideoCanvas:class {},Apple2CharROM_get:()=>new Uint8Array(2048)};
  vm.createContext(ctx);
  vm.runInContext(bridge,ctx);
  const canvas={id:'applescreen'};
  const instance=new ctx.HGRStudioVideoBridge(canvas);
  return {ctx,canvas,instance,mux:created[0]};
}

test('defaults to Canvas and retains a dedicated display canvas and 24K video RAM',()=>{
  const {canvas,instance,mux}=setup();
  assert.equal(mux.mode,'canvas');
  assert.equal(mux.canvas,canvas);
  assert.equal(mux.canvases.canvas,canvas);
  assert.equal(mux.hw.safe_videodump(),instance.memory);
  assert.equal(mux.hw.safe_flashdump(),instance.memory);
  assert.equal(instance.memory.length,0x6000);
  assert.equal(mux.vidram,instance.memory);
  assert.equal(mux.calls[0][0],'reset');
  assert.deepEqual(mux.calls.filter(([name])=>['mix','gfx','hires'].includes(name)).map(([name,arg])=>[name,arg]),
    [['mix',false],['gfx',true],['hires',true]]);
  assert.deepEqual(Array.from(instance.getModes()),modes);
});

test('page 1 data lands at $2000 and byte-for-byte survives Canvas redraw',()=>{
  const {instance,mux}=setup(),data=new Uint8Array(8192);
  for(let n=0;n<data.length;n++)data[n]=(n*23+0x85)&255;
  instance.render(data,0x2000,'color');
  assert.deepEqual(Array.from(instance.memory.subarray(0x2000,0x4000)),Array.from(data));
  assert.equal(instance.memory[0x4000],0);
  assert.deepEqual(mux.calls.filter(([name])=>name==='page2'),[]);
  assert.equal(mux.calls.at(-1)[0],'redraw');
  assert.equal(instance.getRendererName(),'canvas');
});

test('page 2 switching, returning to page 1, and B&W mode',()=>{
  const {instance,mux}=setup();
  const first=new Uint8Array(8192).fill(0xA5);
  const second=new Uint8Array(8192).fill(0x5A);
  instance.render(first,0x2000,'color');
  instance.render(second,0x4000,'mono');
  assert.equal(instance.memory[0x2000],0xA5);
  assert.equal(instance.memory[0x4000],0x5A);
  assert.ok(mux.calls.some(([name,value])=>name==='page2'&&value===true));
  assert.ok(mux.calls.some(([name,value])=>name==='monitor'&&value===1));
  instance.render(first,0x2000,'bits');
  assert.ok(mux.calls.some(([name,value])=>name==='page2'&&value===false));
  const count=mux.calls.filter(([name])=>name==='monitor').length;
  instance.render(first,0x2000,'bits');
  assert.equal(mux.calls.filter(([name])=>name==='monitor').length,count);
});

test('switching renderer does not change sprite/image bytes and updates active canvas',()=>{
  const {instance,mux,canvas}=setup();
  const image=new Uint8Array(8192).map((_,i)=>(i*17+3)&255);
  instance.render(image,0x2000,'color');
  const before=instance.memory.slice();
  const notifications=[];
  instance.onModeChange=mode=>notifications.push(mode);
  assert.equal(instance.setMode('gpu'),'gpu');
  assert.equal(instance.getDisplayCanvas().backend,'gpu');
  assert.equal(instance.setMode('wave'),'wave');
  instance.render(image,0x2000,'color');
  assert.ok(mux.waveDirtyCount>0,'Wave HGR linearization must be invalidated');
  assert.equal(instance.setMode('webgpu'),'webgpu');
  assert.equal(instance.setMode('threejs'),'threejs');
  assert.equal(instance.setMode('canvas'),'canvas');
  assert.equal(instance.getDisplayCanvas(),canvas);
  assert.deepEqual(Array.from(instance.memory),Array.from(before));
  assert.deepEqual(notifications,['gpu','wave','webgpu','threejs','canvas']);
});

test('invalid modes, buffers and pages never mutate shared memory',()=>{
  const {instance}=setup();
  const before=instance.memory.slice();
  assert.throws(()=>instance.setMode('teletext'),/Unknown video renderer/);
  assert.throws(()=>instance.render(new Uint8Array(100),0x2000,'color'),/8192 bytes/);
  assert.throws(()=>instance.render(new Uint8Array(8192),0x1800,'color'),/page \$2000/);
  assert.deepEqual(Array.from(instance.memory),Array.from(before));
});

test('studio has stable pointer canvas, selection overlay and working renderer picker',()=>{
  assert.match(studio,/id="applescreen"[^>]*><\/canvas><canvas id="hgrCanvas"/);
  assert.match(studio,/id="overlay"/);
  assert.match(studio,/#hgrCanvas\{position:absolute;inset:0;z-index:1;background:transparent\}/);
  assert.match(studio,/id="rendererSelect"/);
  for(const mode of modes)assert.ok(studio.includes('option value="'+mode+'"'));
  assert.match(studio,/nativeVideoBridge\.render\(state\.bytes,state\.base,state\.view\)/);
  assert.match(studio,/new HGRStudioVideoBridge\(el\('applescreen'\)\)/);
  assert.match(studio,/nativeVideoBridge\.getDisplayCanvas\(\):canvas/);
  assert.match(studio,/renderHGRLegacy\(\)/);
  assert.match(studio,/setPage\(address\)[^\n]*requestRender\(\)/);
  assert.match(studio,/el\('pageSelect'\)\.onchange[^\n]*requestRender\(\)/);
  assert.match(muxSource,/if\(typeof Apple2VideoCanvas === "function"\)/);
});
