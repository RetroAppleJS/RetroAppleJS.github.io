#!/usr/bin/env node
// PSID -> MIDI through RetroAppleJS's own headless jsSID execution engine.
// Run: node tools/SID_PSID_TO_MIDI.cjs song.sid --out song.mid --seconds 16
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {convertFramesToMidi, FRAME_HZ} = require('./SID_Register_To_MIDI.cjs');

function parseHeader(bytes, subtune) {
    if (bytes.length < 0x7c || bytes.toString('ascii', 0, 4) !== 'PSID')
        throw new Error('Expected PSID v2+ data; RSID is not supported');
    const version = bytes.readUInt16BE(4);
    const offset = bytes.readUInt16BE(6);
    if (version < 2 || version > 4 || offset < 0x7c ||
        offset >= bytes.length || offset > 255)
        throw new Error('Unsupported PSID header version or data offset');
    const songs = bytes.readUInt16BE(0x0e);
    const selected = subtune == null ? bytes.readUInt16BE(0x10) : subtune;
    if (!songs || selected < 1 || selected > songs || songs > 256)
        throw new Error('Invalid PSID subtune selection');
    const speed = bytes.readUInt32BE(0x12);
    const speedBit = Math.min(selected - 1, 31);
    // CIA driver timing varies: don't silently misrepresent it as 50Hz VBI.
    if ((speed & (1 << speedBit)) !== 0)
        throw new Error('CIA-timed subtune: 50 Hz register snapshot conversion is not supported');
    const flags = bytes.readUInt16BE(0x76);
    const video = (flags >> 2) & 3;
    if (video === 2)
        throw new Error('NTSC-only PSID: PAL conversion would change pitch/timing');
    const title = bytes.toString('latin1', 0x16, 0x36).split('\0')[0];
    const author = bytes.toString('latin1', 0x36, 0x56).split('\0')[0];
    return {version, songs, subtune: selected, title, author, video: video === 1 ? 'PAL' : 'unspecified / PAL assumed'};
}

function captureFrames(bytes, subtune, count) {
    const jsSIDsource = fs.readFileSync(path.join(__dirname, '../res/jsSID.js'), 'utf8');
    // A separate 6510 engine; no browser UI, audio callback or persistent state.
    const sandbox = {
        Uint8Array, Float32Array, Float64Array, Array, Math, Date, JSON,
        console: {log() {}, warn() {}, error() {}},
        window: {atob(base64) { return Buffer.from(base64, 'base64').toString('latin1'); }}
    };
    vm.createContext(sandbox);
    vm.runInContext(jsSIDsource, sandbox, {
        filename: 'res/jsSID.js', timeout: 5000
    });
    if (typeof sandbox.jsSID !== 'function')
        throw new Error('RetroAppleJS jsSID headless engine could not be loaded');
    const player = new sandbox.jsSID(4096, 0, {headless: true, videoStandard: 'PAL'});
    player.loadinit_b64(bytes.toString('base64'), subtune - 1);
    const frames = player.captureSIDFrames(count, subtune - 1, FRAME_HZ);
    if (!Array.isArray(frames) || frames.length !== count)
        throw new Error('SID register capture was incomplete');
    return frames;
}

function parseArgs(args) {
    const result = {input: null, out: null, seconds: 16, subtune: null};
    for (let i = 0; i < args.length; i++) {
        const x = args[i];
        if (x === '--out') result.out = args[++i];
        else if (x === '--seconds') result.seconds = Number(args[++i]);
        else if (x === '--subtune') result.subtune = Number(args[++i]);
        else if (!x.startsWith('-') && !result.input) result.input = x;
        else throw new Error('Unknown argument: ' + x);
    }
    if (!result.input || !result.out ||
        !Number.isInteger(result.seconds) || result.seconds < 1 || result.seconds > 240 ||
        (result.subtune !== null &&
            (!Number.isInteger(result.subtune) || result.subtune < 1)))
        throw new Error('Usage: node tools/SID_PSID_TO_MIDI.cjs <file.sid> --out <file.mid> [--seconds 1..240] [--subtune 1..N]');
    return result;
}

function main(args) {
    const opt = parseArgs(args);
    const bytes = fs.readFileSync(opt.input);
    const header = parseHeader(bytes, opt.subtune);
    const frames = captureFrames(bytes, header.subtune, opt.seconds * FRAME_HZ);
    const {midi, stats} = convertFramesToMidi(frames, {name: header.title});
    fs.writeFileSync(opt.out, midi);
    const diagnostic = {
        schema: 'retroapplejs.sid-to-midi.v1',
        input: path.basename(opt.input), output: path.basename(opt.out),
        title: header.title, subtune: header.subtune, video: header.video,
        ...stats
    };
    fs.writeFileSync(opt.out + '.json', JSON.stringify(diagnostic, null, 2) + '\n');
    process.stdout.write(JSON.stringify(diagnostic) + '\n');
    return diagnostic;
}
if (require.main === module) {
    try { main(process.argv.slice(2)); }
    catch (error) {
        process.stderr.write('SID_PSID_TO_MIDI: ' + error.message + '\n');
        process.exitCode = 1;
    }
}
module.exports = {parseHeader, captureFrames, parseArgs, main};
