'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scenarioSource = fs.readFileSync(path.join(__dirname,'..','res','DBG_steptrace_scenario.js'),'utf8');

function makeHarness(options={})
{
  const mem = new Uint8Array(0x10000);
  const state = {pc:0x2222,a:9,x:8,y:7,sp:0x80,p:0xff,cycle_delay:0,ic:99};
  const writes = [];
  let now = 0;
  let steps = 0;
  const listeners = Object.create(null);

  const hw = {
    lineDecode(addr){ return (addr >>> 12) & 0x0f; },
    safe_read(addr){ return mem[addr & 0xffff]; },
    WR:new Array(16)
  };
  for(let page=0;page<16;page++)
    hw.WR[page] = (addr,value) => { mem[addr & 0xffff] = value & 0xff; writes.push([addr & 0xffff,value & 0xff]); };

  const cpu = {
    watch(){ return Object.assign({},state); },
    setState(next){ Object.assign(state,next || {}); return this.watch(); }
  };

  const machine = {
    cpuObj(){ return cpu; },
    hwObj(){ return hw; },
    stepLiveInstruction(){
      const startPC = state.pc & 0xffff;
      steps++;
      if(startPC === 0x1000)
      {
        state.a = mem[0x3000];
        mem[0x4000] = state.a;
        state.pc = 0x1001;
      }
      else if(startPC === 0x1001)
        state.pc = 0x1002;
      else
        state.pc = (startPC + 1) & 0xffff;
      state.ic++;
      now += 0.25;
      return {ticks:2,startPC,endPC:state.pc,state:cpu.watch()};
    }
  };

  const symbols = {entry:0x1000,done:0x1002,source:0x3000,target:0x4000,word:0x4010};
  let liveBuild = options.noBuild ? null : {
    schema:'RetroAppleJS.LiveAssemblerBuild',version:1,buildId:'asm-build-test',generation:1,inputRevision:1,
    sourceName:'scenario-test.S',entry:0x1000,loadedAt:1,byteCount:3,ranges:[{start:0x1000,end:0x1002,length:3}],
    symbols:Object.keys(symbols).map(name=>({key:name.toUpperCase(),name,value:symbols[name],kind:'unknown'}))
  };
  const EMU_ASM_BUILD = {current(){ return liveBuild; }};

  const dbg = {
    play(){},
    clearConditionalBreakpoint(){ return true; },
    cycle(){ return true; }
  };

  const window = {
    EMU_ASM_BUILD,
    apple2plus:machine,
    oEMU:{component:{CPU:{Apple2Debug:dbg}}},
    performance:{now(){ return now; }},
    addEventListener(type,fn){ (listeners[type]||(listeners[type]=[])).push(fn); },
    dispatchEvent(ev){ (listeners[ev.type]||[]).slice().forEach(fn=>fn(ev)); return true; },
    setTimeout(fn){ fn(); return 1; }, clearTimeout(){},
    requestAnimationFrame(fn){ fn(); }, console
  };
  window.window = window;
  const document = {
    getElementById(){ return null; },
    createElement(){ return {style:{},appendChild(){},addEventListener(){},classList:{add(){}}}; },
    body:{appendChild(){}}
  };
  window.document = document;

  const ctx = {window,document,console,Uint8Array,Array,Object,Number,String,Boolean,Math,Date,Error,TypeError,RangeError,JSON,isFinite,parseInt,performance:window.performance};
  vm.createContext(ctx);
  vm.runInContext(scenarioSource,ctx,{filename:'DBG_steptrace_scenario.js'});
  return {STB:window.STB,window,mem,state,writes,get steps(){return steps;},setLiveBuild(v){liveBuild=v;}};
}

test('scenario resolves live-build symbols without TEST BENCH and executes live CPU', () => {
  const h = makeHarness();
  assert.equal(h.window.TB,undefined);
  assert.equal(h.STB.buildInfo().buildId,'asm-build-test');
  const result = h.STB.scenario('copy byte', function(){
    h.STB.ram.write('source',0x42);
    h.STB.cpu.start('entry',{A:0x11,X:0x22,Y:0x33});
    const run = h.STB.breakIf('PC==done',{maxInstructions:10,timeoutMs:1000});
    assert.equal(run.ok,true);
    assert.equal(run.instructions,2);
    h.STB.assert('A==$42','A loaded');
    h.STB.assert('M[target]==$42','destination written');
  });

  assert.equal(result.status,'PASS');
  assert.equal(result.assertions,2);
  assert.equal(h.state.pc,0x1002);
  assert.equal(h.mem[0x4000],0x42);
  assert.equal(h.state.x,0x22);
  assert.equal(h.state.y,0x33);
});

test('scenario reset is deterministic for CPU state but does not clear RAM', () => {
  const h = makeHarness();
  h.mem[0x1234] = 0x5a;
  h.STB.reset();
  assert.deepEqual(
    {pc:h.state.pc,a:h.state.a,x:h.state.x,y:h.state.y,sp:h.state.sp,p:h.state.p,cycle_delay:h.state.cycle_delay,ic:h.state.ic},
    {pc:0,a:0,x:0,y:0,sp:0xff,p:0x20,cycle_delay:0,ic:0}
  );
  assert.equal(h.mem[0x1234],0x5a);
});

test('assertion failures accumulate without aborting later assertions', () => {
  const h = makeHarness();
  const result = h.STB.scenario('assertions', function(){
    h.STB.cpu.start('entry');
    h.STB.assert('A==$01','first');
    h.STB.assert('X==$00','second');
  });
  assert.equal(result.status,'FAIL');
  assert.equal(result.assertions,2);
  assert.equal(result.failedAssertions,1);
});

test('failed break aborts the remaining scenario body', () => {
  const h = makeHarness();
  let reached = false;
  const result = h.STB.scenario('limit', function(){
    h.STB.cpu.start('entry');
    h.STB.breakIf('PC==$9999',{maxInstructions:2,timeoutMs:1000});
    reached = true;
  });
  assert.equal(reached,false);
  assert.equal(result.status,'FAIL');
  assert.equal(result.reason,'instruction-limit');
});

test('malformed conditions are scenario errors and abort the body', () => {
  const h = makeHarness();
  let reached = false;
  const result = h.STB.scenario('bad expression', function(){
    h.STB.cpu.start('entry');
    h.STB.breakIf('PC==');
    reached = true;
  });
  assert.equal(reached,false);
  assert.equal(result.status,'ERROR');
  assert.equal(result.reason,'expression-error');
});

test('condition language resolves live symbols, offsets, M16 and flags', () => {
  const h = makeHarness();
  h.mem[0x4010] = 0x34;
  h.mem[0x4011] = 0x12;
  const result = h.STB.scenario('expressions', function(){
    h.STB.cpu.start('entry',{P:0x21});
    h.STB.assert('PC==entry && M16[word]==$1234 && M[target+1]==0 && C==1');
  });
  assert.equal(result.status,'PASS');
});

test('live RAM writes refuse the Apple II I/O page', () => {
  const h = makeHarness();
  assert.throws(() => h.STB.ram.write(0xc000,0x01),/I\/O/);
});

test('assert accepts a boolean for host-side byte-array/guard checks', () => {
  const h = makeHarness();
  const result = h.STB.scenario('boolean assertion', function(){
    h.STB.assert(true,'host comparison');
    h.STB.assert(false,'host mismatch');
    h.STB.assert(true,'still runs');
  });
  assert.equal(result.status,'FAIL');
  assert.equal(result.assertions,3);
  assert.equal(result.failedAssertions,1);
});

test('numeric scenarios work with no live assembler build while symbolic lookup reports the missing build', () => {
  const h=makeHarness({noBuild:true});
  const result=h.STB.scenario('numeric only',function(){
    h.STB.cpu.start(0x1000);
    h.STB.breakIf('PC==$1001',{maxInstructions:2,timeoutMs:1000});
  });
  assert.equal(result.status,'PASS');
  assert.equal(h.STB.buildInfo(),null);
  assert.throws(()=>h.STB.sym('entry'),e=>e&&e.code==='STB_NO_LIVE_BUILD');
});
