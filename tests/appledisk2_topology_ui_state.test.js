'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const topology = require('../res/EMU_CARD_appledisk2_topology.js');

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

  const calls = {led: [], lid: [], audio: []};
  const card = {
    id: {PCODE: 'DISKII'},
    devices: devices.map((DCODE) => ({id: {DCODE}})),
    getState() { return state; },
    setDriveLED(deviceN,on) { calls.led.push([deviceN,!!on]); },
    setDriveLidClosed(deviceN,closed) { calls.lid.push([deviceN,!!closed]); },
    syncDriveVisuals() {
      this.setDriveLED(0,state.hw[0].motor);
      this.setDriveLED(1,state.hw[1].motor);
      this.setDriveLidClosed(0,state.diskData[0] != null);
      this.setDriveLidClosed(1,state.diskData[1] != null);
    },
    dN_update(eventName) { calls.audio.push(eventName); },
    cancelTrackStatsFlush(deviceN) {
      const stats = state.hw[deviceN] && state.hw[deviceN].stats;
      if(stats) stats.motorOffTimer = null;
    },
    scheduleTrackStatsFlush() {},
    traceChange() {},
    driveElementID(prefix,deviceID) { return `${prefix}_${deviceID}`; },
    surfaceMap_grid_html(deviceN) { return `<grid data-drive="D${deviceN+1}">D${deviceN+1}</grid>`; },
    surfaceMap_html() { return `<surface>${this.surfaceMap_grid_html(0)}${this.surfaceMap_grid_html(1)}</surface>`; }
  };

  return {card,state,calls};
}

test('Disk II surface map renders only attached drive panels', () => {
  const onlyD1 = fakeCard(['D1']);
  topology.decorateDiskIITopology(onlyD1.card);
  const htmlD1 = onlyD1.card.surfaceMap_html('surfaceMap_popup');
  assert.match(htmlD1,/data-drive="D1"/);
  assert.doesNotMatch(htmlD1,/data-drive="D2"/);

  const onlyD2 = fakeCard(['D2']);
  topology.decorateDiskIITopology(onlyD2.card);
  const htmlD2 = onlyD2.card.surfaceMap_html('surfaceMap_popup');
  assert.doesNotMatch(htmlD2,/data-drive="D1"/);
  assert.match(htmlD2,/data-drive="D2"/);

  const both = fakeCard(['D1','D2']);
  topology.decorateDiskIITopology(both.card);
  const htmlBoth = both.card.surfaceMap_html('surfaceMap_popup');
  assert.match(htmlBoth,/data-drive="D1"/);
  assert.match(htmlBoth,/data-drive="D2"/);
});

test('Disk II topology rebuild preserves mounted filenames for still-attached drives', () => {
  const {card,state} = fakeCard(['D1']);
  topology.decorateDiskIITopology(card);

  state.diskData[0] = [1,2,3];
  state.diskName[0] = 'BLANK_DOS.DSK';

  resetMediaRows();
  let html = card.deviceToolSlotHTML({slotN:6, slotID:'S6'});
  assert.match(html,/BLANK_DOS\.DSK/);
  assert.equal(mediaRows.find((row) => row.fileName === 'D1').fileDisplayName, 'BLANK_DOS.DSK');

  card.devices = [{id:{DCODE:'D1'}},{id:{DCODE:'D2'}}];
  state.diskData[1] = [4,5,6];
  state.diskName[1] = 'BLANK_PRONTODOS.dsk';

  resetMediaRows();
  html = card.deviceToolSlotHTML({slotN:6, slotID:'S6'});
  assert.match(html,/BLANK_DOS\.DSK/);
  assert.match(html,/BLANK_PRONTODOS\.dsk/);
  assert.equal(mediaRows.find((row) => row.fileName === 'D1').fileDisplayName, 'BLANK_DOS.DSK');
  assert.equal(mediaRows.find((row) => row.fileName === 'D2').fileDisplayName, 'BLANK_PRONTODOS.dsk');
});

test('detaching one Disk II drive does not blank the remaining attached drive filename', () => {
  const {card,state} = fakeCard(['D1','D2']);
  topology.decorateDiskIITopology(card);

  state.diskData[0] = [1,2,3];
  state.diskName[0] = 'LEFT_STILL_MOUNTED.dsk';
  state.diskData[1] = [4,5,6];
  state.diskName[1] = 'RIGHT_REMOVED.dsk';

  card.devices = [{id:{DCODE:'D1'}}];
  card.onDeviceTopologyChanged({type:'detach', DCODE:'D2'});

  resetMediaRows();
  const html = card.deviceToolSlotHTML({slotN:6, slotID:'S6'});
  assert.match(html,/LEFT_STILL_MOUNTED\.dsk/);
  assert.doesNotMatch(html,/RIGHT_REMOVED\.dsk/);
  assert.equal(mediaRows.length, 1);
  assert.equal(mediaRows[0].fileName, 'D1');
  assert.equal(mediaRows[0].fileDisplayName, 'LEFT_STILL_MOUNTED.dsk');
});
