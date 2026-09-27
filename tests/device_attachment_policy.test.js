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
  assert.match(layoutSource,/A2P\.DISKII\.D1\.BODY/,
    'D1 should control the left Disk II body layer by stable layer id');
  assert.match(layoutSource,/A2P\.DISKII\.D2\.BODY/,
    'D2 should control the right Disk II body layer by stable layer id');
});

test('device attach and detach resynchronise generic layout visibility', () => {
  assert.match(layoutSource,/io\.syncDeviceLayout\s*=\s*function/,
    'Apple2IO should expose a generic device layout sync hook');
  assert.match(layoutSource,/var\s+nativeAttach\s*=\s*io\.attach[\s\S]*syncDeviceLayout\(this,owner\)/,
    'successful attach should sync layout visibility');
  assert.match(layoutSource,/var\s+nativeDetach\s*=\s*io\.detach[\s\S]*syncDeviceLayout\(this,owner\)/,
    'successful detach should sync layout visibility');
});

test('Disk II body and gap images receive stable runtime layer ids', () => {
  assert.match(layoutSource,/function\s+runtimeLayerIdForFile\s*\(/,
    'runtime fallback ids should exist for legacy composer layers without explicit ids');
  assert.match(layoutSource,/case\s+"A2P_FULL_DISKII_left\.png"\s*:[\s\S]*return\s+"A2P\.DISKII\.D1\.BODY"/,
    'left Disk II body should map to a stable body id');
  assert.match(layoutSource,/case\s+"A2P_FULL_DISKII_right\.png"\s*:[\s\S]*return\s+"A2P\.DISKII\.D2\.BODY"/,
    'right Disk II body should map to a stable body id');
  assert.match(layoutSource,/case\s+"A2P_FULL_DISKII_gap\.png"\s*:[\s\S]*return\s+"A2P\.DISKII\.GAP"/,
    'gap shadow should map to a stable gap id');
  assert.match(layoutSource,/var\s+runtimeId\s*=\s*layer\.id\s*\|\|\s*runtimeLayerIdForFile\(layer\.file\)/,
    'DOM layer registration should use explicit ids or runtime fallback ids');
});

test('Disk II gap shadow uses an owner-level allAttached layout rule', () => {
  assert.match(layoutSource,/id:\s*"DISKII\.GAP\.BOTH_DRIVES"/,
    'the Disk II gap rule should be a named owner-level rule');
  assert.match(layoutSource,/when:\s*\{allAttached:\s*\["D1","D2"\]\}/,
    'the gap shadow should require both Disk II drives to be attached');
  assert.match(layoutSource,/\{id:\s*"A2P\.DISKII\.GAP",\s*visible:\s*true\}/,
    'the gap layer should be visible when the rule is active');
  assert.match(layoutSource,/\{id:\s*"A2P\.DISKII\.GAP",\s*visible:\s*false\}/,
    'the gap layer should be hidden when the rule is inactive');
});

test('owner-level layout rules are evaluated during sync without external helper scope', () => {
  assert.match(layoutSource,/var\s+rules\s*=\s*Array\.isArray\(owner\.layoutRules\)\s*\?\s*owner\.layoutRules\s*:\s*\[\]/,
    'syncDeviceLayout should evaluate owner-level layoutRules inline');
  assert.match(layoutSource,/when\.allAttached[\s\S]*attachedCount\(owner,when\.allAttached\[a\]\)\s*<=\s*0/,
    'allAttached should be evaluated from current owner device state');
  assert.match(layoutSource,/var\s+ruleTargets\s*=\s*layoutTargets\(rule,active\s*\?\s*"attached"\s*:\s*"detached"\)/,
    'owner rules should choose attached or detached layout targets');
});
