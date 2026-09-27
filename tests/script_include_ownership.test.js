'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
const comMainSource = fs.readFileSync(path.join(repoRoot, 'res', 'COM_MAIN.js'), 'utf8');
const emuMainSource = fs.readFileSync(path.join(repoRoot, 'res', 'EMU_apple2main.js'), 'utf8');
const layoutConfigSource = fs.readFileSync(path.join(repoRoot, 'res', 'COM_LAYOUT_CONFIG.js'), 'utf8');

function scriptPosition(src) {
  const pattern = new RegExp('<script[^>]+src=["\\\']' + src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\\\']', 'i');
  const match = indexSource.match(pattern);
  return match ? match.index : -1;
}

test('index.html owns core script include order without COM_MAIN bootstrap indirection', () => {
  const comMain = scriptPosition('res/COM_MAIN.js');
  const layout = scriptPosition('res/COM_A2P_LAYOUT.js');
  const layoutConfig = scriptPosition('res/COM_LAYOUT_CONFIG.js');
  const emuMain = scriptPosition('res/EMU_apple2main.js');

  assert.notEqual(comMain, -1, 'index.html must include res/COM_MAIN.js directly');
  assert.notEqual(layout, -1, 'index.html must include res/COM_A2P_LAYOUT.js directly');
  assert.notEqual(layoutConfig, -1, 'index.html must include res/COM_LAYOUT_CONFIG.js directly');
  assert.notEqual(emuMain, -1, 'index.html must include res/EMU_apple2main.js directly');

  assert.ok(comMain < layout, 'COM_MAIN.js must load before COM_A2P_LAYOUT.js so oCOM exists');
  assert.ok(layout < layoutConfig, 'COM_A2P_LAYOUT.js must load before layout data; install still waits for window load');
  assert.ok(layoutConfig < emuMain, 'layout data must load before EMU_apple2main.js');

  assert.doesNotMatch(indexSource, /res\/COM_MAIN_core\.js/);
});

test('COM_MAIN.js is the core implementation, not a script bootstrapper', () => {
  assert.match(comMainSource, /function\s+COM\s*\(/);
  assert.doesNotMatch(comMainSource, /document\.write\s*\(/);
  assert.doesNotMatch(comMainSource, /COM_MAIN_core\.js/);
  assert.doesNotMatch(comMainSource, /COM_A2P_LAYOUT\.js/);
});

test('layout data lives in COM_LAYOUT_CONFIG.js instead of EMU_apple2main.js', () => {
  assert.match(layoutConfigSource, /\bvar\s+composer\s*=/);
  assert.match(layoutConfigSource, /A2P_FULL_DISKII_LED\.png/);
  assert.doesNotMatch(emuMainSource, /\bvar\s+composer\s*=/);
  assert.doesNotMatch(emuMainSource, /A2P_FULL_DISKII_LED\.png/);
});
