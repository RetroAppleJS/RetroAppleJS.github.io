'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname,'..');
const diskIISource = fs.readFileSync(path.join(repoRoot,'res','EMU_CARD_appledisk2.js'),'utf8');
const apple2MainSource = fs.readFileSync(path.join(repoRoot,'res','EMU_apple2main.js'),'utf8');
const indexSource = fs.readFileSync(path.join(repoRoot,'index.html'),'utf8');
const layoutSource = fs.readFileSync(path.join(repoRoot,'res','COM_A2P_LAYOUT.js'),'utf8');
const mainCssSource = fs.readFileSync(path.join(repoRoot,'res','COM_MAIN.css'),'utf8');

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
  assert.match(diskIISource,/setDriveLidClosed\(deviceN,true\)/);
  assert.match(diskIISource,/this\.setDriveLidClosed\(drv,false\)/);
  assert.match(diskIISource,/this\.setDriveLED\(i,newMotor\)/);
  assert.match(diskIISource,/this\.syncDriveVisuals\(\)/);
});

test('Apple II main UI does not initialize legacy Disk II DOM image handles', () => {
  assert.doesNotMatch(apple2MainSource,/DSK_led|DSK_lid|dskLED_D[12]|dskLID_D[12]/);
  assert.match(apple2MainSource,/syncDriveVisuals/);
});

test('legacy Disk II DOM visuals are fully removed', () => {
  assert.doesNotMatch(indexSource,/dskLED_D[12]|dskLID_D[12]|appdskLED|appdskLID/);
  assert.doesNotMatch(layoutSource,/LEGACY_DRIVE_VISUAL_IDS|disableLegacyDriveVisuals|dskLED_D[12]|dskLID_D[12]/);
  assert.doesNotMatch(mainCssSource,/\.appdsk(?:LED|LID)\b/);
});

