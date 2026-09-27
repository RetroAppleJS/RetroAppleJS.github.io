const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname,'..');
const diskJSSource = fs.readFileSync(path.join(repoRoot,'tools','DiskJS.html'),'utf8');

test('DiskJS uses only the canonical AppleDisk2 component ID', () => {
  assert.match(diskJSSource,/var\s+disk2\s*=\s*oEMU\.component\.IO\["AppleDisk2"\]\s*;/);
  assert.match(diskJSSource,/oEMU\.component\.IO\["AppleDisk2"\]\s*=\s*disk2\s*;/);
  assert.match(diskJSSource,/disk2\s*=\s*new\s+AppleDisk2\(\)\s*;/);
  assert.match(diskJSSource,/disk2\.mount\.slotN\s*===\s*undefined/);
  assert.doesNotMatch(diskJSSource,/oEMU\.component\.IO\["AppleDisk2"\]/);
  assert.doesNotMatch(diskJSSource,/Legacy alias for older DiskJS\/helper code/);
});
