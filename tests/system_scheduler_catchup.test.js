'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

// Exercise the actual scheduler functions, isolated from the unrelated browser UI.
function rig(fps=60) {
  const source=fs.readFileSync(path.join(__dirname,'../res/EMU_apple2main.js'),'utf8');
  const from=source.indexOf('var appleIntervalHandle,apple2plus,KeyboardFocus,keys;');
  const to=source.indexOf('\nfunction EMU_slotPeripheral',from);
  assert.ok(from>=0 && to>from);
  let time=0, timer=null;
  const ticks=[];
  const ctx={
    performance:{now:()=>time},
    _o:{EMU_IntervalTime_ms:1000/fps,CPU_ClockTicks:Math.round(1021800/fps)},
    apple2plus:{cycle:n=>ticks.push(n)},
    window:{setInterval:(fn,ms)=>{timer={fn,ms};return 123;}},
    console
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(from,to),ctx);
  return {
    ctx,ticks,
    start:()=>ctx.EMU_systemSchedulerStart(),
    wake:t=>{time=t;timer.fn();},
    timer:()=>timer
  };
}
test('60 fps: late 27ms browser wakes produce 60 fixed frames per wall second',()=>{
  const r=rig();
  r.start();
  for(let t=0;t<=1000;t+=27)r.wake(t);
  assert.ok(r.ticks.length>=58 && r.ticks.length<=62, 'frames='+r.ticks.length);
  assert.ok(r.ticks.every(n=>n===17030));
  assert.ok(r.timer().ms<=16);
});
test('catch up at most four frames after late wake and reset long stalls',()=>{
  const r=rig();
  r.start();r.wake(0);r.wake(100);
  assert.equal(r.ticks.length,5); // first + four-frame catch-up ceiling
  r.wake(5000);
  assert.equal(r.ticks.length,6); // long suspension resets instead of replaying
});
test('changing scheduler cadence resets stale elapsed time',()=>{
  const r=rig();
  r.start();r.wake(0);
  r.ctx._o.EMU_IntervalTime_ms=100;
  r.ctx._o.CPU_ClockTicks=102180;
  r.start();r.wake(2000);
  assert.equal(r.ticks.at(-1),102180);
  assert.equal(r.ticks.length,2);
});
