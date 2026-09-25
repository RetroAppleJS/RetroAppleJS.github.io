'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','asm','_TODO','INFLATE_ASM_CORE_testbench.js'),'utf8');

test('INFLATE harness executes vectors through live STEP TRACE scenarios',()=>{
  assert.match(source,/STB\.scenario\(v\.name/);
  assert.match(source,/STB\.cpu\.start\(call\.trampoline/);
  assert.match(source,/STB\.breakIf\("PC==" \+ STB\.hex\(call\.returnPC,4\)/);
  assert.match(source,/STB\.assert\(diff === -1, "exact output"\)/);
  assert.doesNotMatch(source,/TB\.call\(/);
});

test('INFLATE harness requires an already loaded live assembler build instead of copying debugger RAM',()=>{
  assert.match(source,/STB\.buildInfo\(\)/);
  assert.match(source,/No assembler build is loaded in live RAM/);
  assert.doesNotMatch(source,/TB\.ram/);
  assert.doesNotMatch(source,/DBG_RAM/);
  assert.doesNotMatch(source,/DBG_TESTBENCH/);
  assert.doesNotMatch(source,/installLiveProgram/);
});

test('large distance-range vector keeps compressed input in writable main RAM',()=>{
  assert.match(source,/fixed_all_distance_ranges[\s\S]*?input: 0xB000, output: 0x1000/);
  assert.doesNotMatch(source,/fixed_all_distance_ranges[\s\S]*?input: 0xD000, output: 0x1000/);
});
