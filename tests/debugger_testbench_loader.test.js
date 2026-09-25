'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','res','DBG_testbench.js'),'utf8');

test('DBG_testbench loader initializes neutral build services before live STEP TRACE scenario',()=>{
  const asmBuild=source.indexOf('ASM_build_handoff.js');
  const emuBuild=source.indexOf('EMU_asm_build.js');
  const legacy=source.indexOf('DBG_testbench_legacy.js');
  const scenario=source.indexOf('DBG_steptrace_scenario.js');
  const layout=source.indexOf('DBG_steptrace_scenario_layout.js');
  assert.ok(asmBuild>=0,'neutral ASM_BUILD service must be loaded');
  assert.ok(emuBuild>asmBuild,'EMU_ASM_BUILD must load after ASM_BUILD');
  assert.ok(legacy>emuBuild,'legacy isolated TEST BENCH remains available but is not a dependency of live-build services');
  assert.ok(scenario>legacy,'STEP TRACE scenario loads after the compatibility bench UI exists');
  assert.ok(layout>scenario,'scenario layout loads after scenario engine exists');
});
