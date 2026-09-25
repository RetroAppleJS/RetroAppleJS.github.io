'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','res','DBG_testbench.js'),'utf8');

test('DBG_testbench loader preserves legacy bench and loads live STEP TRACE scenario modules in order',()=>{
  const legacy=source.indexOf('DBG_testbench_legacy.js');
  const scenario=source.indexOf('DBG_steptrace_scenario.js');
  const layout=source.indexOf('DBG_steptrace_scenario_layout.js');
  assert.ok(legacy>=0,'legacy test bench must be loaded');
  assert.ok(scenario>legacy,'scenario module must load after legacy TB exists');
  assert.ok(layout>scenario,'scenario layout must load after scenario engine exists');
});
