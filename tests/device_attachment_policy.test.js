const fs = require('node:fs');
 const path = require('node:path');
 const test = require('node:test');
 const assert = require('node:assert/strict');

 const repoRoot = path.join(__dirname,'..');
 const layoutSource = fs.readFileSync(path.join(repoRoot,'res','COM_A2P_LAYOUT.js'),'utf8');

 test('device picker enforces generic maxInstances before attach', () => {
   assert.match(layoutSource,/deviceMaxInstances\s*=\s*function/);
   assert.match(layoutSource,/deviceCanAttach\s*=\s*function/);
   assert.match(layoutSource,/deviceAttachmentLimitMessage\s*=\s*function/);
   assert.match(layoutSource,/if\(info && !canAttach\(owner,info\)\)/);
 });

 test('DISKII is patched as singleton visual devices', () => {
   assert.match(layoutSource,/info\.maxInstances\s*=\s*1/);
   assert.match(layoutSource,/A2P_FULL_DISKII_left\.png/);
   assert.match(layoutSource,/A2P_FULL_DISKII_right\.png/);
 });

test('Disk II declares D1 and D2 as singleton layout-controlled devices', () => {
  assert.match(layoutSource,/info\.maxInstances\s*=\s*1/,
    'Disk II drive declarations should be patched as singleton device slots');
  assert.match(layoutSource,/A2P\.DISKII\.D1\.BODY/,
    'D1 should control the left Disk II body layer by stable layer id');
  assert.match(layoutSource,/A2P\.DISKII\.D2\.BODY/,
    'D2 should control the right Disk II body layer by stable layer id');
});

 test('attach and detach both resync device layouts', () => {
   assert.match(layoutSource,/io\.attach\s*=\s*function/);
   assert.match(layoutSource,/if\(device\) syncDeviceLayout\(this,owner\)/);
   assert.match(layoutSource,/io\.detach\s*=\s*function/);
   assert.match(layoutSource,/if\(removed\) syncDeviceLayout\(this,owner\)/);
 });

test('DISKII declares an owner-level gap-shadow rule that requires both drives', () => {
  assert.match(layoutSource,/A2P_FULL_DISKII_gap\.png/);
  assert.match(layoutSource,/allAttached:\s*\[\s*"D1"\s*,\s*"D2"\s*\]/);
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
