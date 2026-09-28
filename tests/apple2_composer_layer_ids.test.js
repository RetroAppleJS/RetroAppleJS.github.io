'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const layout = require('../res/COM_A2P_LAYOUT.js');

const repoRoot = path.join(__dirname,'..');
const compositorSource = fs.readFileSync(path.join(repoRoot,'res','COM_A2P_LAYOUT.js'),'utf8');
const composerSource = fs.readFileSync(path.join(repoRoot,'tools','GUI_DEV','apple2-system-composer.html'),'utf8');
const layoutConfigSource = fs.readFileSync(path.join(repoRoot,'res','COM_LAYOUT_CONFIG.js'),'utf8');

const DISK_IDS = [
  'A2P.DISKII.D1.LED',
  'A2P.DISKII.D2.LED',
  'A2P.DISKII.D1.LID',
  'A2P.DISKII.D2.LID'
].sort();

function diskIds(config) {
  return config.layers
    .filter(layer => layer.file === 'A2P_DISKII_LED.png' || layer.file === 'A2P_DISKII_LID.png')
    .map(layer => layer.id)
    .sort();
}

function loadJsConfig(source) {
  const context = {};
  vm.runInNewContext(source,context);
  return context.composer;
}

function loadComposerModel() {
  const match = composerSource.match(/<script\b[^>]*>\s*([\s\S]*?)<\/script\b[^>]*>/i);
  assert.ok(match,'Composer inline script must exist');
  const script = match[1];
  const start = script.indexOf("'use strict';");
  const end = script.indexOf('function resolveLayersForAsset');
  assert.ok(start >= 0 && end > start,'Composer model prefix must be extractable');

  const element = {getContext(){return {};}};
  const context = {document:{getElementById(){return element;}}};
  vm.runInNewContext(
    script.slice(start,end) + '\n' +
    'globalThis.__composerModel={validateLayout,layerFromLayout,serializeLayout,state};',
    context
  );
  return context.__composerModel;
}

test('active emulator and Composer layouts carry all four persistent Disk II semantic IDs', () => {
  const config = loadJsConfig(layoutConfigSource);
  assert.deepEqual(Array.from(diskIds(config)),DISK_IDS);

  for(const relative of [
    path.join('tools','GUI_DEV','assets','apple2-layout.json'),
    path.join('tools','GUI_DEV','assets','apple2-layout-embedded.json')
  ]) {
    const parsed = JSON.parse(fs.readFileSync(path.join(repoRoot,relative),'utf8'));
    assert.deepEqual(Array.from(diskIds(parsed)),DISK_IDS,relative);
  }
});

test('runtime compositor never infers Disk II semantic identity from artwork or geometry', () => {
  assert.doesNotMatch(compositorSource,/legacyDiskIILayerId/);
  assert.doesNotMatch(compositorSource,/A2P_DISKII_(?:LED|LID)\.png/);

  const unlabeled = layout.validateLayout({
    version:1,
    canvas:{width:1144,height:1144},
    assets:{},
    layers:[{
      file:'A2P_DISKII_LED.png',
      x:154,
      y:684,
      visible:true,
      shadow:{enabled:false,offsetX:0,offsetY:15,blur:12,opacity:.75}
    }]
  });
  assert.equal(unlabeled.layers[0].id,null);

  const moved = layout.validateLayout({
    version:1,
    canvas:{width:1144,height:1144},
    assets:{},
    layers:[{
      id:'A2P.DISKII.D1.LED',
      file:'A2P_DISKII_LED.png',
      x:700,
      y:684,
      visible:true,
      shadow:{enabled:false,offsetX:0,offsetY:15,blur:12,opacity:.75}
    }]
  });
  assert.equal(moved.layers[0].id,'A2P.DISKII.D1.LED');
});

test('Composer import and export round-trip emulator semantic IDs independently of editor identity', () => {
  const model = loadComposerModel();
  const valid = model.validateLayout({
    version:1,
    canvas:{width:1144,height:1144},
    layers:[{
      id:'A2P.DISKII.D1.LED',
      file:'led.png',
      x:700,
      y:10,
      visible:true,
      shadow:{enabled:false,offsetX:0,offsetY:15,blur:12,opacity:.75}
    }]
  });

  model.state.layers = valid.layers.map(model.layerFromLayout);
  const internal = model.state.layers[0];
  assert.equal(internal.id,'A2P.DISKII.D1.LED');
  assert.equal(typeof internal.uid,'string');
  assert.notEqual(internal.uid,internal.id);

  const exported = model.serializeLayout();
  assert.equal(exported.layers[0].id,'A2P.DISKII.D1.LED');
  assert.equal(Object.hasOwn(exported.layers[0],'uid'),false);
});

test('Composer validation rejects duplicate semantic IDs and exposes an optional Runtime ID editor', () => {
  const model = loadComposerModel();
  const layer = id => ({
    id,
    file:'part.png',
    x:0,
    y:0,
    visible:true,
    shadow:{enabled:false,offsetX:0,offsetY:15,blur:12,opacity:.75}
  });

  assert.throws(() => model.validateLayout({
    version:1,
    canvas:{width:1144,height:1144},
    layers:[layer('A2P.DISKII.D1.LED'),layer('A2P.DISKII.D1.LED')]
  }),/Duplicate .*layer id/i);

  assert.match(composerSource,/id="runtimeIdInput"/);
  assert.doesNotMatch(composerSource,/const\s+l=\{id:makeRuntimeId\(\)/);
  assert.match(composerSource,/uid:makeRuntimeId\(\)/);
});
