const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname,'..');
const layoutSource = fs.readFileSync(path.join(repoRoot,'res','COM_A2P_LAYOUT.js'),'utf8');

test('device picker enforces generic maxInstances before attach', () => {
  assert.match(layoutSource,/deviceMaxInstances\s*=\s*function/,
    'Apple2IO should expose a generic maxInstances helper');
  assert.match(layoutSource,/deviceCanAttach\s*=\s*function/,
    'Apple2IO should expose a generic can-attach helper');
  assert.match(layoutSource,/if\(info\s*&&\s*!canAttach\(owner,info\)\)[\s\S]*return false;/,
    'devicePicker_select must block over-limit device attaches before io.attach() runs');
});

test('device picker disables over-limit entries in the UI', () => {
  assert.match(layoutSource,/\.device-picker-entry/,
    'the policy should post-process device picker rows');
  assert.match(layoutSource,/button\.disabled\s*=\s*true/,
    'over-limit entries should be disabled');
  assert.match(layoutSource,/aria-disabled["'],["']true/,
    'over-limit entries should expose disabled state to assistive UI');
  assert.match(layoutSource,/Attached:\s*"\s*\+\s*count\s*\+\s*"\/"\s*\+\s*max/,
    'over-limit entries should show count/max state');
});

test('Disk II declares D1 and D2 as singleton layout-controlled devices', () => {
  assert.match(layoutSource,/info\.maxInstances\s*=\s*1/,
    'Disk II drive declarations should be patched as singleton device slots');
  assert.match(layoutSource,/A2P_FULL_DISKII_left\.png/,
    'D1 should control the left Disk II body image');
  assert.match(layoutSource,/A2P_FULL_DISKII_right\.png/,
    'D2 should control the right Disk II body image');
});

test('device attach and detach resynchronise generic layout visibility', () => {
  assert.match(layoutSource,/io\.syncDeviceLayout\s*=\s*function/,
    'Apple2IO should expose a generic device layout sync hook');
  assert.match(layoutSource,/var\s+nativeAttach\s*=\s*io\.attach[\s\S]*syncDeviceLayout\(this,owner\)/,
    'successful attach should sync layout visibility');
  assert.match(layoutSource,/var\s+nativeDetach\s*=\s*io\.detach[\s\S]*syncDeviceLayout\(this,owner\)/,
    'successful detach should sync layout visibility');
});
