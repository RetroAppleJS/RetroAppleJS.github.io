'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const asmPath = path.join(__dirname,'..','res','ASM_build_handoff.js');

function loadAsmBuild(overrides={})
{
  assert.equal(fs.existsSync(asmPath),true,'ASM build handoff service must exist');
  const listeners = Object.create(null);
  const window = Object.assign({
    console,
    document:null,
    setTimeout(fn){ fn(); return 1; },
    clearTimeout(){},
    addEventListener(type,fn){ (listeners[type]||(listeners[type]=[])).push(fn); },
    dispatchEvent(ev){ (listeners[ev.type]||[]).slice().forEach(fn=>fn(ev)); return true; },
    CustomEvent:function(type,opt){ this.type=type; this.detail=opt&&opt.detail; }
  },overrides);
  window.window = window;
  const ctx = {window,console,Uint8Array,Array,Object,Number,String,Boolean,Math,Date,Error,TypeError,RangeError,JSON,isFinite,parseInt,CustomEvent:window.CustomEvent};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(asmPath,'utf8'),ctx,{filename:'ASM_build_handoff.js'});
  return window;
}

function sampleCompiled()
{
  return {
    bytes:[
      {pc:0x0800,val:0xA9},
      {pc:0x0801,val:0x01},
      {pc:0x2000,val:0x60},
      {pc:0x0801,val:0xEA}
    ],
    symtab:{inflate:0x0800,inputPointer:0x00F0,'.SCLOCAL_1_L2_X':0x0801},
    errors:[],
    warnings:[]
  };
}

test('extract groups explicit PCs into emission-order ORG segments and exports public symbols', () => {
  const w = loadAsmBuild();
  const spec = w.ASM_BUILD.extract({compiled:sampleCompiled(),sourceName:'INFLATE_ASM_CORE.S',inputRevision:7});
  assert.equal(spec.sourceName,'INFLATE_ASM_CORE.S');
  assert.equal(spec.entry,0x0800);
  assert.equal(spec.inputRevision,7);
  assert.deepEqual(Array.from(spec.segments[0].bytes),[0xA9,0x01]);
  assert.equal(spec.segments[0].address,0x0800);
  assert.deepEqual(Array.from(spec.segments[1].bytes),[0x60]);
  assert.equal(spec.segments[1].address,0x2000);
  assert.deepEqual(Array.from(spec.segments[2].bytes),[0xEA]);
  assert.equal(spec.segments[2].address,0x0801);
  assert.deepEqual(spec.symbols.map(s=>[s.key,s.name,s.value]),[
    ['INFLATE','inflate',0x0800],
    ['INPUTPOINTER','inputPointer',0x00F0]
  ]);
});

test('extract falls back to oASM code_pc/read_code and preserves explicit ORG boundaries', () => {
  const w = loadAsmBuild();
  const asm = {
    sourceName:'legacy.S',
    code_pc:[0x1000,undefined,0x2000],
    symtab:{start:0x1000},
    get_code_len(){ return 3; },
    read_code(i){ return [0xEA,0x60,0x00][i]; }
  };
  const spec = w.ASM_BUILD.extract({asm,inputRevision:3});
  assert.equal(spec.entry,0x1000);
  assert.deepEqual(spec.segments.map(s=>[s.address,Array.from(s.bytes)]),[
    [0x1000,[0xEA,0x60]],
    [0x2000,[0x00]]
  ]);
});

test('publish owns defensive byte and symbol copies', () => {
  const w = loadAsmBuild();
  const spec = w.ASM_BUILD.extract({compiled:sampleCompiled(),sourceName:'a.S',inputRevision:1});
  const first = w.ASM_BUILD.publish(spec);
  spec.segments[0].bytes[0] = 0xFF;
  spec.symbols[0].value = 0x1234;
  first.segments[0].bytes[0] = 0xCC;
  first.symbols[0].value = 0x5678;
  const second = w.ASM_BUILD.current();
  assert.equal(second.segments[0].bytes[0],0xA9);
  assert.equal(second.symbols[0].value,0x0800);
  assert.notEqual(first.segments[0].bytes,second.segments[0].bytes);
});

test('canonical symbol collisions are rejected instead of resolved arbitrarily', () => {
  const w = loadAsmBuild();
  assert.throws(() => w.ASM_BUILD.extract({
    compiled:{bytes:[{pc:0x800,val:0x60}],symtab:{foo:1,FOO:2},errors:[]},
    inputRevision:1
  }), /canonical symbol/i);
});

test('input revision marks a published build stale after source text changes', () => {
  const source = {value:'LDA #1'};
  const document = {getElementById(id){ return id==='ASM_sourcePane' ? source : null; }};
  const w = loadAsmBuild({document,asmCompileResult:{bytes:[{pc:0x800,val:0x60}],symtab:{start:0x800},errors:[]},oASM:{sourceName:'a.S'}});
  w.ASM_INPUT.refresh('initial');
  const spec = w.ASM_BUILD.extractCurrent();
  w.ASM_BUILD.publish(spec);
  assert.equal(w.ASM_BUILD.isFresh(),true);
  source.value = 'LDA #2';
  w.ASM_INPUT.refresh('source-edited');
  assert.equal(w.ASM_BUILD.isFresh(),false);
});
