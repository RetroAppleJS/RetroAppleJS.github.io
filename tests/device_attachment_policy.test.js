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

 test('generic device layout sync supports file-backed visibility targets', () => {
   assert.match(layoutSource,/visibleByFile\s*=\s*function/);
   assert.match(layoutSource,/if\(target\.file && layout && typeof layout\.visibleByFile == "function"\)/);
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

test('generic layout policy supports owner-level attachment rules', () => {
  assert.match(layoutSource,/function\s+hasAttached\s*\(/);
  assert.match(layoutSource,/function\s+ruleMatches\s*\(/);
  assert.match(layoutSource,/function\s+applyOwnerLayoutRules\s*\(/);
  assert.match(layoutSource,/syncDeviceLayout[\s\S]*applyOwnerLayoutRules\(owner\)/);
});