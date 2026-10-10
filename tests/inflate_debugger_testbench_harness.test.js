const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const scriptPath = path.join(__dirname, '..', 'asm', 'MATH', 'INFLATE', 'INFLATE_ASM_CORE_debugger_testbench.js');

function source() {
  return fs.readFileSync(scriptPath, 'utf8');
}

test('debugger testbench INFLATE harness exists and targets TB instead of STB', () => {
  const s = source();
  assert.match(s, /Debugger TEST BENCH/);
  assert.match(s, /window\.TB|root\.TB/);
  assert.match(s, /TB\.call\(["']inflate["']/);
  assert.match(s, /TB\.ram\.write16\(["']inputPointer["']/);
  assert.match(s, /TB\.ram\.write16\(["']outputPointer["']/);
  assert.doesNotMatch(s, /onBreakpoint\s*\(/);
  assert.doesNotMatch(s, /haltAtBreakpoint\s*\(/);
  assert.doesNotMatch(s, /window\.STB|\bSTB\./);
});

test('debugger testbench INFLATE harness keeps all vector groups and assertions', () => {
  const s = source();
  const vectorCount = (s.match(/name:\s*["']/g) || []).length;
  assert.equal(vectorCount, 15);
  for (const text of [
    'STORED',
    'FIXED',
    'POINTER BOUNDARIES',
    'DYNAMIC',
    'BLOCK CONTROL',
    'input consumed',
    'output pointer',
    'exact output',
    'output guard before',
    'output guard after',
    'input guard before',
    'input guard after',
    'scratch guard after',
    'stack restored',
    'PASS 15/15'
  ]) {
    assert.ok(s.includes(text), text);
  }
});
