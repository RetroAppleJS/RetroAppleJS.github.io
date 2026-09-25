'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const asmPath = path.join(__dirname,'..','res','ASM_build_handoff.js');
const emuPath = path.join(__dirname,'..','res','EMU_asm_build.js');

function loadBuildAndEmu(options={})
{
  assert.equal(fs.existsSync(asmPath),true);
  assert.equal(fs.existsSync(emuPath),true,'EMU assembler build loader must exist');
  const listeners = Object.create(null);
  const mem = new Uint8Array(0xC000);
  for(let i=0;i<mem.length;i++) mem[i]=(i*13+7)&0xFF;
  let loadCalls = 0;
  const hw = {
    safe_flashdump(){ return new Uint8Array(mem); },
    load_ram64k(bytes){
      loadCalls++;
      if(options.loadHook) return options.loadHook({bytes,mem,loadCalls});
      mem.set(bytes.subarray(0,0xC000));
      return {loadedBytes:0xC000};
    }
  };
  const window = {
    console,
    document:null,
    apple2plus:{hwObj(){ return hw; }},
    setTimeout(fn){ fn(); return 1; }, clearTimeout(){},
    addEventListener(type,fn){ (listeners[type]||(listeners[type]=[])).push(fn); },
    dispatchEvent(ev){ (listeners[ev.type]||[]).slice().forEach(fn=>fn(ev)); return true; },
    CustomEvent:function(type,opt){ this.type=type; this.detail=opt&&opt.detail; }
  };
  window.window=window;
  const ctx={window,console,Uint8Array,Array,Object,Number,String,Boolean,Math,Date,Error,TypeError,RangeError,JSON,isFinite,parseInt,CustomEvent:window.CustomEvent};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(asmPath,'utf8'),ctx,{filename:'ASM_build_handoff.js'});
  vm.runInContext(fs.readFileSync(emuPath,'utf8'),ctx,{filename:'EMU_asm_build.js'});
  return {window,mem,hw,get loadCalls(){return loadCalls;}};
}

function publishBuild(w,segments,sourceName='test.S')
{
  return w.ASM_BUILD.publish({
    sourceName,
    entry:segments[0].address,
    inputRevision:1,
    segments:segments.map(s=>({address:s.address,bytes:Uint8Array.from(s.bytes)})),
    symbols:[{key:'ENTRY',name:'entry',value:segments[0].address,kind:'label'}]
  });
}

test('direct live load applies overlapping segments to real main RAM and publishes live provenance', () => {
  const h=loadBuildAndEmu();
  const before=h.mem[0x0800];
  const build=publishBuild(h.window,[
    {address:0x0800,bytes:[0x11,0x22,0x33]},
    {address:0x0801,bytes:[0xAA,0xBB]}
  ]);
  const live=h.window.EMU_ASM_BUILD.load(build);
  assert.notEqual(before,h.mem[0x0800]);
  assert.deepEqual(Array.from(h.mem.slice(0x0800,0x0803)),[0x11,0xAA,0xBB]);
  assert.equal(live.buildId,build.id);
  assert.equal(h.window.EMU_ASM_BUILD.current().buildId,build.id);
  assert.equal(h.window.EMU_ASM_BUILD.status().state,'loaded');
});

test('direct live load rejects I/O and upper-memory segments before modifying main RAM', () => {
  for(const address of [0xC000,0xD000]){
    const h=loadBuildAndEmu();
    const original=new Uint8Array(h.mem);
    const build=publishBuild(h.window,[{address,bytes:[0x60]}]);
    const expected=address<0xD000?'EMU_BUILD_IO_RANGE':'EMU_BUILD_UNWRITABLE';
    assert.throws(()=>h.window.EMU_ASM_BUILD.load(build),e=>e&&e.code===expected&&e.memoryState==='unchanged');
    assert.deepEqual(Array.from(h.mem),Array.from(original));
    assert.equal(h.loadCalls,0);
  }
});

test('verification failure rolls live RAM back exactly and preserves previous live build', () => {
  let corruptNext=false;
  const h=loadBuildAndEmu({loadHook({bytes,mem}){
    mem.set(bytes.subarray(0,0xC000));
    if(corruptNext){ mem[0x0900]^=0xFF; corruptNext=false; }
  }});
  const a=publishBuild(h.window,[{address:0x0800,bytes:[0x60]}],'a.S');
  h.window.EMU_ASM_BUILD.load(a);
  const pre=new Uint8Array(h.mem);
  const b=publishBuild(h.window,[{address:0x0900,bytes:[0xA9,0x01]}],'b.S');
  corruptNext=true;
  assert.throws(()=>h.window.EMU_ASM_BUILD.load(b),e=>
    e&&e.code==='EMU_BUILD_VERIFY_FAILED'&&e.memoryState==='restored'&&e.rollback&&e.rollback.succeeded===true
  );
  assert.deepEqual(Array.from(h.mem),Array.from(pre));
  assert.equal(h.window.EMU_ASM_BUILD.current().buildId,a.id);
});

test('failed rollback invalidates live provenance and reports partial write', () => {
  let failMode=false;
  const h=loadBuildAndEmu({loadHook({bytes,mem}){
    mem.set(bytes.subarray(0,0xC000));
    if(failMode) mem[0x0900]^=0xFF;
  }});
  const a=publishBuild(h.window,[{address:0x0800,bytes:[0x60]}],'a.S');
  h.window.EMU_ASM_BUILD.load(a);
  const b=publishBuild(h.window,[{address:0x0900,bytes:[0xA9]}],'b.S');
  failMode=true;
  assert.throws(()=>h.window.EMU_ASM_BUILD.load(b),e=>
    e&&e.code==='EMU_BUILD_PARTIAL_WRITE'&&e.memoryState==='indeterminate'&&e.liveBuildState==='cleared'
  );
  assert.equal(h.window.EMU_ASM_BUILD.current(),null);
  assert.equal(h.window.EMU_ASM_BUILD.status().state,'invalid');
});
