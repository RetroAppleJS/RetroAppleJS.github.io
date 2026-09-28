'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname,'..');
const topologySource = fs.readFileSync(path.join(repoRoot,'res','EMU_CARD_appledisk2_topology.js'),'utf8');
const loaderSource = fs.readFileSync(path.join(repoRoot,'res','DBG_testbench.js'),'utf8');
const topology = require('../res/EMU_CARD_appledisk2_topology.js');

globalThis.EMU_deviceMediaRowHTML = function(cfg) {
  return `<button data-file="${cfg.fileName}">${cfg.label}</button>`;
};

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

  const calls = {led: [], lid: [], cancel: [], schedule: [], trace: [], audio: [], spin: []};
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
    dN_update(eventName) {
      calls.audio.push(eventName);
      if(eventName === 'MOTOR_ON') calls.spin.push('DiskII_spin');
    },
    cancelTrackStatsFlush(deviceN) { calls.cancel.push(deviceN); },
    scheduleTrackStatsFlush(deviceN,reason,delay) { calls.schedule.push([deviceN,reason,delay]); },
    traceChange(type,deviceN,field,oldValue,newValue,meta) { calls.trace.push({type,deviceN,field,oldValue,newValue,meta}); },
    driveElementID(prefix,deviceID) { return `${prefix}_${deviceID}`; }
  };

  return {card,state,calls};
}

function simulateCatalogMotorOn(card,state,deviceN,label) {
  state.drv = deviceN;
  state.drive_enable = 1;
  card.applyDriveEnable(label);
  card.dN_update('MOTOR_ON');
}

test('Disk II topology patch is loaded by the browser bootstrap', () => {
  assert.match(loaderSource,/EMU_CARD_appledisk2_topology\.js/,
    'the topology patch should load before AppleDisk2 instances are mounted');
});

test('D2 detach clears runtime state and suppresses D2 LED/lid', () => {
  const {card,state,calls} = fakeCard(['D1']);
  topology.decorateDiskIITopology(card);

  state.drv = 1;
  state.drive_enable = 1;
  state.diskData[1] = [1,2,3];
  state.diskName[1] = 'stale.dsk';
  state.hw[1].motor = 1;
  state.hw[1].q6 = 1;
  state.hw[1].q7 = 1;
  state.hw[1].offset = 99;
  state.hw[1].data_latch = 0xaa;
  calls.led.length = 0;
  calls.lid.length = 0;

  card.onDeviceTopologyChanged({type:'detach', DCODE:'D2'});

  assert.equal(state.diskData[1], null);
  assert.equal(state.diskName[1], null);
  assert.equal(state.hw[1].motor, 0);
  assert.equal(state.hw[1].q6, 0);
  assert.equal(state.hw[1].q7, 0);
  assert.equal(state.hw[1].offset, 0);
  assert.equal(state.hw[1].data_latch, 0);
  assert.equal(state.drive_enable, 0);
  assert.deepEqual(calls.cancel.includes(1), true);
  assert.deepEqual(calls.led.some(([deviceN,on]) => deviceN === 1 && on === false), true);
  assert.deepEqual(calls.lid.some(([deviceN,closed]) => deviceN === 1 && closed === false), true);
});

test('CATALOG,D2 soft-switch activity does not spin or light a detached D2', () => {
  const {card,state,calls} = fakeCard(['D1']);
  topology.decorateDiskIITopology(card);

  state.drv = 1;
  state.drive_enable = 1;
  calls.led.length = 0;

  card.applyDriveEnable('CATALOG,D2');

  assert.equal(state.hw[1].motor, 0);
  assert.equal(state.hw[0].motor, 0);
  assert.deepEqual(calls.led, [[0,false],[1,false]]);
});

test('detached D1 and D2 do not trigger MOTOR_ON disk audio during catalog access', () => {
  for (const scenario of [
    {label:'CATALOG,D1', detachedDrive:0, attachedDevices:['D2']},
    {label:'CATALOG,D2', detachedDrive:1, attachedDevices:['D1']}
  ]) {
    const {card,state,calls} = fakeCard(scenario.attachedDevices);
    topology.decorateDiskIITopology(card);

    calls.audio.length = 0;
    calls.spin.length = 0;

    simulateCatalogMotorOn(card,state,scenario.detachedDrive,scenario.label);

    assert.equal(state.hw[scenario.detachedDrive].motor, 0,
      `${scenario.label} must not set the detached drive motor`);
    assert.deepEqual(calls.audio, [],
      `${scenario.label} must not call dN_update("MOTOR_ON") for a detached drive`);
    assert.deepEqual(calls.spin, [],
      `${scenario.label} must not start DiskII_spin audio for a detached drive`);
  }
});

test('attached D1 can still spin while detached D2 remains suppressed', () => {
  const {card,state,calls} = fakeCard(['D1']);
  topology.decorateDiskIITopology(card);

  state.drv = 0;
  state.drive_enable = 1;
  calls.led.length = 0;

  card.applyDriveEnable('CATALOG,D1');

  assert.equal(state.hw[0].motor, 1);
  assert.equal(state.hw[1].motor, 0);
  assert.deepEqual(calls.led, [[0,true],[1,false]]);
});

test('peripheral controls render only attached Disk II drives', () => {
  const onlyD1 = fakeCard(['D1']);
  topology.decorateDiskIITopology(onlyD1.card);
  const htmlD1 = onlyD1.card.deviceToolSlotHTML({slotN:6, slotID:'PR#6'});
  assert.match(htmlD1,/Drive1/);
  assert.doesNotMatch(htmlD1,/Drive2/);

  const both = fakeCard(['D1','D2']);
  topology.decorateDiskIITopology(both.card);
  const htmlBoth = both.card.deviceToolSlotHTML({slotN:6, slotID:'PR#6'});
  assert.match(htmlBoth,/Drive1/);
  assert.match(htmlBoth,/Drive2/);
});

test('source policy explicitly gates motor state by attachment', () => {
  assert.match(topologySource,/function\s+clearDetachedDriveState\s*\(/,
    'detached-drive cleanup should be a named policy operation');
  assert.match(topologySource,/card\.applyDriveEnable\s*=\s*function/,
    'Disk II motor state should be topology-aware');
  assert.match(topologySource,/newMotor\s*=\s*\(enabled\s*&&\s*i\s*==\s*deviceN\s*&&\s*this\.isDriveAttached\(i\)\)\s*\?\s*1\s*:\s*0/,
    'CATALOG,D2 should not light or spin a detached drive');
  assert.match(topologySource,/card\.deviceToolSlotHTML\s*=\s*function/,
    'the peripheral toolbox should be generated from attached devices');
});
