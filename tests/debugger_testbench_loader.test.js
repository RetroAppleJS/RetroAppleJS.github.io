'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'res','DBG_testbench.js'),'utf8');

test('DBG_testbench loader keeps TEST BENCH and STEP TRACE but no live-build services',()=>{
  const legacy=source.indexOf('DBG_testbench_legacy.js');
  const scenario=source.indexOf('DBG_steptrace_scenario.js');
  const layout=source.indexOf('DBG_steptrace_scenario_layout.js');
  assert.ok(legacy>=0);
  assert.ok(scenario>legacy);
  assert.ok(layout>scenario);
  assert.doesNotMatch(source,/ASM_build_handoff|EMU_asm_build/);
  assert.equal(fs.existsSync(path.join(root,'res','ASM_build_handoff.js')),false);
  assert.equal(fs.existsSync(path.join(root,'res','EMU_asm_build.js')),false);
});
