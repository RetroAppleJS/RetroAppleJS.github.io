'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {convertFramesToMidi, frequencyToMidi, vlq, PAL_SID_CLOCK} =
    require('../tools/SID_Register_To_MIDI.cjs');
const {parseHeader, captureFrames} = require('../tools/SID_PSID_TO_MIDI.cjs');

function makeFrame(freq = 0, ctrl = 0, sustain = 15, master = 15) {
    const r = new Uint8Array(25);
    r[0] = freq & 255;
    r[1] = freq >> 8;
    r[4] = ctrl;
    r[6] = sustain << 4;
    r[24] = master;
    return r;
}
function noteEvents(buffer) {
    let notes = 0;
    for (let i = 0; i < buffer.length - 2; i++) {
        if ((buffer[i] & 0xf0) === 0x90 && buffer[i + 2] > 0) notes++;
    }
    return notes;
}
function makePSIDHeader(opts = {}) {
    const bytes = Buffer.alloc(0x7c + 8);
    bytes.write('PSID', 0, 'ascii');
    bytes.writeUInt16BE(2, 4);
    bytes.writeUInt16BE(0x7c, 6);
    bytes.writeUInt16BE(1, 0x0e);
    bytes.writeUInt16BE(1, 0x10);
    bytes.writeUInt32BE(opts.speed || 0, 0x12);
    bytes.write('Test Fixture', 0x16);
    bytes.writeUInt16BE(opts.flags || 0, 0x76);
    return bytes;
}

test('PAL SID register pitch is C64-clock-correct', () => {
    const frequency = Math.round(440 * 16777216 / PAL_SID_CLOCK);
    assert.ok(Math.abs(frequencyToMidi(frequency) - 69) < 0.01);
});
test('variable length MIDI delta-time encoding', () => {
    assert.deepEqual(vlq(0), [0]);
    assert.deepEqual(vlq(127), [127]);
    assert.deepEqual(vlq(128), [0x81, 0]);
    assert.deepEqual(vlq(16383), [0xff, 0x7f]);
});
test('register snapshots yield standard multitrack MIDI with note boundaries', () => {
    const a4 = Math.round(440 * 16777216 / PAL_SID_CLOCK);
    const a5 = Math.round(880 * 16777216 / PAL_SID_CLOCK);
    const frames = [
        makeFrame(a4, 0x41),
        makeFrame(a4 + 4, 0x41), // vibrato: should not retrigger
        makeFrame(a5, 0x41),     // pitch change
        makeFrame(a5, 0x40),    // gate off
    ];
    const result = convertFramesToMidi(frames, {name:'Original validation'});
    assert.equal(result.midi.toString('ascii', 0, 4), 'MThd');
    assert.equal(result.midi.readUInt16BE(8), 1);
    assert.equal(result.midi.readUInt16BE(10), 5);
    assert.equal(result.midi.readUInt16BE(12), 480);
    assert.equal(result.stats.noteOns, 2);
    assert.equal(result.stats.voices[0].pitchChanges, 1);
    assert.ok(result.midi.includes(Buffer.from('MTrk')));
    assert.ok(noteEvents(result.midi) >= 2);
});
test('noise-only waveform is routed to GM drum channel', () => {
    const frames = [makeFrame(9000, 0x81), makeFrame(9000, 0x80)];
    const result = convertFramesToMidi(frames);
    assert.equal(result.stats.noteOns, 1);
    assert.equal(result.stats.voices[0].noiseFrames, 2);
    assert.ok(result.midi.includes(Buffer.from([0x99,42])));
});
test('invalid register frames and unsupported headers fail safely', () => {
    assert.throws(() => convertFramesToMidi([new Uint8Array(2)]), /25 registers/);
    assert.throws(() => parseHeader(Buffer.from('RSID')), /Expected PSID/);
    assert.throws(() => parseHeader(makePSIDHeader({speed:1})), /CIA-timed/);
    assert.throws(() => parseHeader(makePSIDHeader({flags:2 << 2})), /NTSC/);
    assert.equal(parseHeader(makePSIDHeader()).subtune, 1);
});
test('native headless jsSID captures original PSID without Sidtool', () => {
    const name = path.join(__dirname, '../build/psid_pt3/fixtures/01_saw_scale.sid');
    if (!fs.existsSync(name)) return;
    const data = fs.readFileSync(name);
    assert.equal(parseHeader(data).songs, 1);
    const frames = captureFrames(data, 1, 50);
    assert.equal(frames.length, 50);
    assert.ok(frames.some(f => (f[4] & 0x01) !== 0));
    const result = convertFramesToMidi(frames);
    assert.ok(result.stats.noteOns > 0);
});
