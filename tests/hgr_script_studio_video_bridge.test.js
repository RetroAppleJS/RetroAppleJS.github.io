// CPU-free video MUX integration tests for HGR Script Studio Phase 1.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const bridge = fs.readFileSync(path.join(__dirname,'../tools/HGR_SCRIPT_STUDIO_video_bridge.js'),'utf8');
const studio = fs.readFileSync(path.join(__dirname,'../tools/HGR_SCRIPT_STUDIO.html'),'utf8');
const muxSource = fs.readFileSync(path.join(__dirname,'../res/EMU_DEVICE_video_MUX.js'),'utf8');

function setup() {
  const created = [];
  class VideoMUX {
    constructor(canvas) {
      this.canvas=canvas;this.canvases={};this.calls=[];created.push(this);
    }
    reset(){this.calls.push(['reset',this.vidram,this.hw,this.canvases.canvas]);}
    setMix(value){this.calls.push(['mix',value]);}
    setGfx(value){this.calls.push(['gfx',value]);}
    setHires(value){this.calls.push(['hires',value]);}
    setPage2(value){this.calls.push(['page2',value]);}
    setMonitor(value){this.calls.push(['monitor',value]);}
    redraw(){this.calls.push(['redraw']);}
    getRenderMode(){return 'canvas';}
  }
  const ctx={Apple2VideoMUX:VideoMUX,Apple2VideoCanvas:class {},Apple2CharROM_get:()=>new Uint8Array(2048)};
  vm.createContext(ctx);
  vm.runInContext(bridge,ctx);
  const canvas={id:'hgrCanvas'};
  const instance=new ctx.HGRStudioVideoBridge(canvas);
  return {ctx,canvas,instance,mux:created[0]};
}

test('uses the original editor canvas and shared memory without CPU hardware',()=>{
  const {canvas,instance,mux}=setup();
  assert.equal(mux.canvas,canvas);
  assert.equal(mux.canvases.canvas,canvas);
  assert.equal(mux.hw.safe_videodump(),instance.memory);
  assert.equal(instance.memory.length,0x6000);
  assert.equal(mux.vidram,instance.memory);
  assert.equal(mux.calls[0][0],'reset');
  assert.deepEqual(mux.calls.filter(([name])=>['mix','gfx','hires'].includes(name)).map(([name,arg])=>[name,arg]),
    [['mix',false],['gfx',true],['hires',true]]);
});

test('page 1 data lands at $2000 and byte-for-byte survives redraw',()=>{
  const {instance,mux}=setup();
  const data=new Uint8Array(8192);
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
  const priorModes=mux.calls.filter(([name])=>name==='monitor').length;
  instance.render(first,0x2000,'bits');
  assert.equal(mux.calls.filter(([name])=>name==='monitor').length,priorModes,'unchanged view must not change monitor mode');
});

test('invalid buffers or pages never mutate the shared memory',()=>{
  const {instance}=setup();
  const first=instance.memory.slice();
  assert.throws(()=>instance.render(new Uint8Array(100),0x2000,'color'),/8192 bytes/);
  assert.throws(()=>instance.render(new Uint8Array(8192),0x1800,'color'),/page \$2000/);
  assert.deepEqual(Array.from(instance.memory),Array.from(first));
});

test('studio shares renderer backend and refreshes on both page selectors',()=>{
  assert.match(studio,/src="HGR_SCRIPT_STUDIO_video_bridge\.js"/);
  assert.match(studio,/src="\.\.\/res\/EMU_DEVICE_video_MUX\.js"/);
  assert.match(studio,/nativeVideoBridge\.render\(state\.bytes,state\.base,state\.view\)/);
  assert.match(studio,/renderHGRLegacy\(\)/);
  assert.match(studio,/setPage\(address\)[^\n]*requestRender\(\)/);
  assert.match(studio,/el\('pageSelect'\)\.onchange[^\n]*requestRender\(\)/);
  assert.match(studio,/id="overlay"/);
  assert.match(muxSource,/if\(typeof Apple2VideoCanvas === "function"\)/);
});
