const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const mainSource = fs.readFileSync('res/EMU_apple2main.js','utf8');

test('successful UniDisk mount logs router-vs-Liron unit identity and media state', () => {
  assert.match(mainSource,/UniDisk 3\.5 identity trace/);
  assert.match(mainSource,/sameObject/);
  assert.match(mainSource,/routerDevice/);
  assert.match(mainSource,/lironUnitDevice/);
  assert.match(mainSource,/mediaLoaded/);
  assert.match(mainSource,/mediaFilename/);
});
