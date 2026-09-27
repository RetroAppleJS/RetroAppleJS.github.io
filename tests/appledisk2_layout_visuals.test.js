'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname,'..');
const diskIISource = fs.readFileSync(path.join(repoRoot,'res','EMU_CARD_appledisk2.js'),'utf8');

test('Disk II drive visuals delegate to the Apple II layout API', () => {
  assert.doesNotMatch(diskIISource,/DSK_led|DSK_lid/);
  assert.match(diskIISource,/function\s+diskLayout\s*\(/);
  assert.match(diskIISource,/this\.setDriveLED\s*=\s*function\s*\(\s*deviceN\s*,\s*on\s*\)/);
  assert.match(diskIISource,/this\.setDriveLidClosed\s*=\s*function\s*\(\s*deviceN\s*,\s*closed\s*\)/);
  assert.match(diskIISource,/oCOM\.LAYOUT\.A2P\.DISKII/);
  assert.match(diskIISource,/drive\.LED\(\s*!!on\s*\)/);
  assert.match(diskIISource,/drive\.LID\(\s*!!closed\s*\)/);
});

test('Disk II media and motor paths update layout lids and LEDs', () => {
  assert.match(diskIISource,/this\.setDriveLidClosed\(deviceN,true\)/);
  assert.match(diskIISource,/this\.setDriveLidClosed\(drv,false\)/);
  assert.match(diskIISource,/this\.setDriveLED\(i,newMotor\)/);
  assert.match(diskIISource,/this\.syncDriveVisuals\(\)/);
});
