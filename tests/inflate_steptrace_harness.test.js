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

test('INFLATE harness copies assembled debugger code into live RAM before running',()=>{
  assert.match(source,/STB\.ram\.write\(start, TB\.ram\.read\(start, length\)\)/);
});

test('large distance-range vector moves compressed input out of ROM into writable live RAM',()=>{
  assert.match(source,/fixed_all_distance_ranges[\s\S]*?input: 0xB000, output: 0x1000/);
  assert.doesNotMatch(source,/fixed_all_distance_ranges[\s\S]*?input: 0xD000, output: 0x1000/);
});
