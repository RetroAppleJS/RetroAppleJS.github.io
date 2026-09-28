'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname,'..');
const uiSource = fs.readFileSync(path.join(repoRoot,'res','EMU_CARD_appledisk2_ui_state.js'),'utf8');
const loaderSource = fs.readFileSync(path.join(repoRoot,'res','DBG_testbench.js'),'utf8');
const ui = require('../res/EMU_CARD_appledisk2_ui_state.js');

let mediaRows = [];
globalThis.EMU_deviceMediaRowHTML = function(spec) {
  mediaRows.push(spec);
  const display = spec.fileDisplayName === undefined ? '' : String(spec.fileDisplayName);
  return `<row data-file="${spec.fileName}" data-display="${display}" title="${spec.buttonTitle || ''}">${spec.label}:${display}</row>`;
};

function resetMediaRows() {
  mediaRows = [];
}

function fakeCard(devices) {
  const state = {
    drive_enable: 0,
    drv: 0,
    diskData: [null,null],
    diskName: [null,null],
    hw: [
      {motor:0,q6:0,q7:0,offset:0,data_latch:0,stats:{read:0,write:0,motorOffTimer:null}},
      {motor:0,q6:0,q7:0,offset:0,data_latch:0,stats:{read:0,write:0,motorOffTimer:null}}
    ]
  };

  const calls = {topology: [], surfaceRender: []};
  const card = {
    id: {PCODE: 'DISKII'},
    devices: devices.map((DCODE) => ({id: {DCODE}})),
    getState() { return state; },
    driveElementID(prefix,deviceID) { return `${prefix}_${deviceID}`; },
    onDeviceTopologyChanged(change) { calls.topology.push(change); },
    surfaceMap_grid_html(deviceN) {
      const driveID = `D${deviceN+1}`;
      const name = state.diskName[deviceN] || 'no disk';
      return `<grid data-drive="${driveID}" data-name="${name}">${driveID}:${name}</grid>`;
    },
    surfaceMap_html() {
      return `<surface>${this.surfaceMap_grid_html(0)}${this.surfaceMap_grid_html(1)}</surface>`;
    },
    surfaceMap_render(id) { calls.surfaceRender.push(id); return true; }
  };

  return {card,state,calls};
}

test('Disk II UI-state patch is loaded by the browser bootstrap', () => {
  assert.match(loaderSource,/EMU_CARD_appledisk2_ui_state\.js/,
    'the UI-state policy should load after the Disk II topology policy');
});

test('Disk II surface map renders only attached drive panels', () => {
  const onlyD1 = fakeCard(['D1']);
  ui.decorateDiskIIUIState(onlyD1.card);
  const htmlD1 = onlyD1.card.surfaceMap_html('surfaceMap_popup');
  assert.match(htmlD1,/data-drive="D1"/);
  assert.doesNotMatch(htmlD1,/data-drive="D2"/);

  const onlyD2 = fakeCard(['D2']);
  ui.decorateDiskIIUIState(onlyD2.card);
  const htmlD2 = onlyD2.card.surfaceMap_html('surfaceMap_popup');
  assert.doesNotMatch(htmlD2,/data-drive="D1"/);
  assert.match(htmlD2,/data-drive="D2"/);

  const both = fakeCard(['D1','D2']);
  ui.decorateDiskIIUIState(both.card);
  const htmlBoth = both.card.surfaceMap_html('surfaceMap_popup');
  assert.match(htmlBoth,/data-drive="D1"/);
  assert.match(htmlBoth,/data-drive="D2"/);
});

test('attaching D2 preserves the mounted D1 filename in the peripheral controls', () => {
  const {card,state} = fakeCard(['D1']);
  ui.decorateDiskIIUIState(card);

  state.diskData[0] = [1,2,3];
  state.diskName[0] = 'BLANK_DOS.DSK';

  resetMediaRows();
  let html = card.deviceToolSlotHTML({slotN:6, slotID:'S6'});
  assert.match(html,/BLANK_DOS\.DSK/);
  assert.equal(mediaRows.find((row) => row.fileName === 'D1').fileDisplayName, 'BLANK_DOS.DSK');

  card.devices = [{id:{DCODE:'D1'}},{id:{DCODE:'D2'}}];
  state.diskData[1] = [4,5,6];
  state.diskName[1] = 'BLANK_PRONTODOS.dsk';
  card.onDeviceTopologyChanged({type:'attach', DCODE:'D2'});

  resetMediaRows();
  html = card.deviceToolSlotHTML({slotN:6, slotID:'S6'});
  assert.match(html,/BLANK_DOS\.DSK/);
  assert.match(html,/BLANK_PRONTODOS\.dsk/);
  assert.equal(mediaRows.find((row) => row.fileName === 'D1').fileDisplayName, 'BLANK_DOS.DSK');
  assert.equal(mediaRows.find((row) => row.fileName === 'D2').fileDisplayName, 'BLANK_PRONTODOS.dsk');
});

test('detaching one Disk II drive does not blank the remaining attached drive filename', () => {
  const left = fakeCard(['D1','D2']);
  ui.decorateDiskIIUIState(left.card);

  left.state.diskData[0] = [1,2,3];
  left.state.diskName[0] = 'LEFT_STILL_MOUNTED.dsk';
  left.state.diskData[1] = [4,5,6];
  left.state.diskName[1] = 'RIGHT_REMOVED.dsk';

  left.card.devices = [{id:{DCODE:'D1'}}];
  left.card.onDeviceTopologyChanged({type:'detach', DCODE:'D2'});

  resetMediaRows();
  let html = left.card.deviceToolSlotHTML({slotN:6, slotID:'S6'});
  assert.match(html,/LEFT_STILL_MOUNTED\.dsk/);
  assert.doesNotMatch(html,/RIGHT_REMOVED\.dsk/);
  assert.equal(mediaRows.length, 1);
  assert.equal(mediaRows[0].fileName, 'D1');
  assert.equal(mediaRows[0].fileDisplayName, 'LEFT_STILL_MOUNTED.dsk');

  const right = fakeCard(['D1','D2']);
  ui.decorateDiskIIUIState(right.card);

  right.state.diskData[0] = [1,2,3];
  right.state.diskName[0] = 'LEFT_REMOVED.dsk';
  right.state.diskData[1] = [4,5,6];
  right.state.diskName[1] = 'RIGHT_STILL_MOUNTED.dsk';

  right.card.devices = [{id:{DCODE:'D2'}}];
  right.card.onDeviceTopologyChanged({type:'detach', DCODE:'D1'});

  resetMediaRows();
  html = right.card.deviceToolSlotHTML({slotN:6, slotID:'S6'});
  assert.doesNotMatch(html,/LEFT_REMOVED\.dsk/);
  assert.match(html,/RIGHT_STILL_MOUNTED\.dsk/);
  assert.equal(mediaRows.length, 1);
  assert.equal(mediaRows[0].fileName, 'D2');
  assert.equal(mediaRows[0].fileDisplayName, 'RIGHT_STILL_MOUNTED.dsk');
});

test('Disk II topology changes refresh an open surface-map popup', () => {
  const {card,calls} = fakeCard(['D1','D2']);
  ui.decorateDiskIIUIState(card);

  global.document = {
    getElementById(id) {
      return id === 'surfaceMap_popup' ? {hidden:false} : null;
    }
  };

  try {
    card.devices = [{id:{DCODE:'D1'}}];
    card.onDeviceTopologyChanged({type:'detach', DCODE:'D2'});
    assert.deepEqual(calls.surfaceRender, ['surfaceMap_popup']);
  }
  finally {
    delete global.document;
  }
});

test('source policy rehydrates filenames and replaces fixed D1/D2 surface maps', () => {
  assert.match(uiSource,/function\s+driveFileDisplayName\s*\(/,
    'media rows should read diskData/diskName before rendering controls');
  assert.match(uiSource,/fileDisplayName\s*=\s*displayName/,
    'mounted filenames should be passed through the shared media-row renderer');
  assert.match(uiSource,/function\s+renderAttachedDiskIISurfaceMap\s*\(/,
    'the fixed D1+D2 surface map should be replaced by attached-drive panels');
});
