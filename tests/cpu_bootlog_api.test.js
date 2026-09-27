const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname,'..');
const cpuSource = fs.readFileSync(path.join(repoRoot,'res','EMU_cpu6502.js'),'utf8');
const debuggerSource = fs.readFileSync(path.join(repoRoot,'res','EMU_apple2debug.js'),'utf8');

test('bootlog exposes only the current 10-byte Base64 export API', () => {
  assert.match(cpuSource,/this\.getBootLogBase64\s*=\s*function\s*\(\)/);
  assert.doesNotMatch(cpuSource,/getBootLogBase64_legacy|Backward-compatible export for the old 5-byte disassembler input/);
  assert.match(debuggerSource,/cpu\.getBootLogBase64\(\)/);
  assert.doesNotMatch(debuggerSource,/getBootLogBase64_legacy/);
});
