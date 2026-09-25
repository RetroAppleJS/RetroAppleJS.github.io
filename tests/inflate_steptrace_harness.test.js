'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');

const harness=fs.readFileSync(path.join(__dirname,'..','asm','_TODO','INFLATE_ASM_CORE_testbench.js'),'utf8');
const assembly=fs.readFileSync(path.join(__dirname,'..','asm','_TODO','INFLATE_ASM_CORE.S'),'utf8');

function vectorsFromSource(){
  const out=[];
  const re=/\{\s*name:\s*"([^"]+)",\s*group:\s*"([^"]+)",\s*hex:\s*"([0-9A-Fa-f]+)",\s*expectedBytes:\s*(\d+)/g;
  let m;
  while((m=re.exec(harness)))out.push({name:m[1],group:m[2],hex:m[3],expectedBytes:Number(m[4])});
  return out;
}

test('INFLATE assembly owns the repeated test-call loop',()=>{
  assert.match(assembly,/ORG\s+\$0D10[\s\S]*?inflate_test_loop[\s\S]*?JSR\s+inflate[\s\S]*?inflate_test_done[\s\S]*?JMP\s+inflate_test_loop/i);
});

test('INFLATE harness prepares and verifies through one persistent STEP TRACE breakpoint callback',()=>{
  assert.match(harness,/onBreakpoint\s*\(\s*function\s*\(bp\)/);
  assert.match(harness,/sym\(["']inflate_test_loop["']\)/);
  assert.match(harness,/sym\(["']inflate_test_done["']\)/);
  assert.match(harness,/bp\.PC\s*===\s*LOOP/);
  assert.match(harness,/bp\.PC\s*===\s*DONE/);
  assert.match(harness,/haltAtBreakpoint\s*\(\s*\)/);
  assert.match(harness,/check\(diff\s*===\s*-1,\s*["']exact output["']\)/);
});

test('INFLATE harness no longer owns CPU execution or assembler live loading',()=>{
  for(const forbidden of [
    /STB\.scenario/,
    /STB\.cpu\.start/,
    /STB\.breakIf/,
    /installTrampoline/,
    /trampoline\s*:/,
    /STB\.buildInfo/,
    /LOAD LIVE/,
    /EMU_ASM_BUILD/,
    /\bTB\.ram/,
    /DBG_RAM/,
    /DBG_TESTBENCH/
  ]) assert.doesNotMatch(harness,forbidden);
});

test('all 15 DEFLATE vector manifests independently decode to their declared size',()=>{
  const vectors=vectorsFromSource();
  assert.equal(vectors.length,15);
  for(const v of vectors){
    const actual=zlib.inflateRawSync(Buffer.from(v.hex,'hex'));
    assert.equal(actual.length,v.expectedBytes,v.name);
  }
});

test('corrected distance-range vector remains 33426 bytes in writable main RAM',()=>{
  assert.match(harness,/fixed_all_distance_ranges[\s\S]*?expectedBytes:\s*33426,\s*input:\s*0xB000,\s*output:\s*0x1000/);
  assert.doesNotMatch(harness,/fixed_all_distance_ranges[\s\S]*?input:\s*0xD000/);
});

test('stored_255 fixture retains the validated compressed-stream prefix',()=>{
  assert.match(harness,/stored_255[\s\S]*?hex:\s*"01FF0000FF135CA5EE3780C9125BA4ED367FC8115AA3EC357EC71059/);
});
