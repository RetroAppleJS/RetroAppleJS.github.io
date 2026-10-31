// RetroAppleJS SID register snapshots -> Standard MIDI File (SMF type 1).
// Pure converter: no playback, browser globals or third-party packages.
// Frequency = SID register value * PAL CPU clock / 2^24.
// This is a 50 Hz musical approximation, not SID waveform emulation.
'use strict';

const TICKS_PER_QUARTER = 480;
const TEMPO_US = 500000;
const FRAME_HZ = 50;
const PAL_SID_CLOCK = 985248;
const FRAME_TICKS = TICKS_PER_QUARTER * 1000000 / TEMPO_US / FRAME_HZ;

function frequencyToMidi(value, clock = PAL_SID_CLOCK) {
    if (!Number.isFinite(value) || value <= 0) return null;
    const hz = value * clock / 16777216;
    return 69 + 12 * Math.log2(hz / 440);
}

function vlq(value) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0x0fffffff)
        throw new RangeError('MIDI delta time out of range: ' + value);
    const out = [value & 0x7f];
    for (value >>= 7; value; value >>= 7) out.unshift((value & 0x7f) | 0x80);
    return out;
}

function uint16(value) { return [(value >>> 8) & 255, value & 255]; }
function uint32(value) { return [(value >>> 24) & 255, (value >>> 16) & 255,
    (value >>> 8) & 255, value & 255]; }
function chunk(name, bytes) {
    return Buffer.from([...Buffer.from(name, 'ascii'), ...uint32(bytes.length), ...bytes]);
}
function metaText(type, value) {
    const b = Buffer.from(String(value || ''), 'utf8');
    return [0xff, type, ...vlq(b.length), ...b];
}

function encodeTrack(events, label) {
    const all = [{tick: 0, priority: -1, bytes: metaText(0x03, label)}, ...events];
    all.sort((a, b) => a.tick - b.tick || a.priority - b.priority);
    let previous = 0;
    const bytes = [];
    for (const event of all) {
        if (event.tick < previous) throw new Error('Unsorted MIDI events');
        bytes.push(...vlq(event.tick - previous), ...event.bytes);
        previous = event.tick;
    }
    bytes.push(0, 0xff, 0x2f, 0);
    return chunk('MTrk', bytes);
}

function convertFramesToMidi(frames, options = {}) {
    const clock = options.clock || PAL_SID_CLOCK;
    if (!(clock > 0)) throw new Error('Invalid SID clock');
    if (!Array.isArray(frames) || !frames.length || frames.length > 12000)
        throw new Error('Expected 1–12000 SID register frames');
    const voices = Array.from({length: 3}, () => ({
        active: null, events: [], notes: 0, pitchChanges: 0, waveformChanges: 0,
        noiseFrames: 0, unsupportedModulationFrames: 0
    }));
    const drums = [];
    const warnings = new Set();
    const tick = frame => Math.round(frame * FRAME_TICKS);
    const off = (voice, at) => {
        const a = voice.active;
        if (!a) return;
        const to = a.drum ? drums : voice.events;
        to.push({tick: tick(at), priority: 0,
            bytes: [0x80 | a.channel, a.note, 0]});
        voice.active = null;
    };
    for (let frame = 0; frame < frames.length; frame++) {
        const registers = frames[frame];
        if (!registers || registers.length < 25)
            throw new Error('SID frame ' + frame + ' needs 25 registers');
        const master = registers[24] & 0x0f;
        if (master === 0) warnings.add('sid-master-volume-zero');
        for (let v = 0; v < 3; v++) {
            const base = 7 * v, state = voices[v];
            const freq = registers[base] | (registers[base + 1] << 8);
            const ctrl = registers[base + 4], waveform = ctrl & 0xf0;
            if ((ctrl & 0x06) !== 0) state.unsupportedModulationFrames++;
            const hasNoise = (waveform & 0x80) !== 0;
            if (hasNoise) state.noiseFrames++;
            const active = !!(ctrl & 0x01) && !(ctrl & 0x08) &&
                waveform !== 0 && freq !== 0;
            if (!active) { off(state, frame); continue; }
            // Mixed waveforms and unsupported SID effects cannot be preserved in MIDI.
            if ((waveform & (waveform - 1)) !== 0) warnings.add('combined-waveforms');
            if (ctrl & 0x06) warnings.add('ring-modulation-or-sync');
            const drum = hasNoise && waveform === 0x80;
            const midi = frequencyToMidi(freq, clock);
            const note = drum ?
                // Register frequency roughly distinguishes bass/snare/hat.
                (freq < 1800 ? 36 : freq < 8000 ? 38 : 42) :
                Math.max(0, Math.min(127, Math.round(midi)));
            const chan = drum ? 9 : v;
            const sustain = (registers[base + 6] >>> 4) & 15;
            const velocity = Math.max(1, Math.min(127,
                Math.round(36 + 80 * (0.3 + 0.7 * sustain / 15) * Math.max(1, master) / 15)));
            const prev = state.active;
            if (prev && prev.waveform !== waveform) state.waveformChanges++;
            // Approximate large/real semitone changes as new notes;
            // tiny frequency modulation and vibrato should not create MIDI notes.
            const changed = !prev || prev.channel !== chan ||
                (drum ? prev.note !== note :
                    Math.abs(midi - prev.precisePitch) >= 0.75 &&
                    note !== prev.note);
            if (changed) {
                off(state, frame);
                const target = drum ? drums : state.events;
                target.push({tick: tick(frame), priority: 1,
                    bytes: [0x90 | chan, note, velocity]});
                if (prev) state.pitchChanges++;
                state.notes++;
                state.active = {note, channel: chan, drum, waveform,
                    precisePitch: midi};
            } else {
                prev.waveform = waveform;
            }
        }
    }
    for (const voice of voices) off(voice, frames.length);
    const tempo = chunk('MTrk', [
        0, ...metaText(0x03, options.name || 'SID conversion'),
        0, 0xff, 0x51, 3, 7, 0xa1, 0x20,  // 120 bpm
        0, 0xff, 0x2f, 0
    ]);
    const chunks = [
        tempo,
        ...voices.map((voice, i) => encodeTrack(voice.events, 'SID voice ' + (i + 1))),
        encodeTrack(drums, 'SID noise percussion')
    ];
    const header = chunk('MThd', [
        0, 1,                       // format 1
        ...uint16(chunks.length),   // 5 tracks
        ...uint16(TICKS_PER_QUARTER)
    ]);
    const output = Buffer.concat([header, ...chunks]);
    return {
        midi: output,
        stats: {
            frames: frames.length, durationSeconds: frames.length / FRAME_HZ,
            noteOns: voices.reduce((n, v) => n + v.notes, 0),
            voices: voices.map(v => ({notes: v.notes, pitchChanges: v.pitchChanges,
                waveformChanges: v.waveformChanges, noiseFrames: v.noiseFrames,
                unsupportedModulationFrames: v.unsupportedModulationFrames})),
            warnings: [...warnings,
                ...(frames.some(f => (f[23] & 0xf0) !== 0 || (f[23] & 0x0f) !== 0) ? ['sid-filter-not-preserved'] : []),
                ...(frames.some(f => (f[24] & 0xf0) !== 0) ? ['sid-filter-mode-not-preserved'] : [])]
        }
    };
}

module.exports = { convertFramesToMidi, frequencyToMidi, vlq,
    PAL_SID_CLOCK, FRAME_HZ, FRAME_TICKS };
