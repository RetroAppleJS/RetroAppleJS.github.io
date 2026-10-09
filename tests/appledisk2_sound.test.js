'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadDisk()
{
    const warnings = [];
    // Model the Web Audio graph: disconnect(destination) throws if no edge exists.
    class AudioNode
    {
        constructor() { this.connections = new Set(); }
        connect(destination) { this.connections.add(destination); return destination; }
        disconnect(destination)
        {
            if (!this.connections.delete(destination))
                throw new DOMException('The given destination is not connected', 'InvalidAccessError');
        }
    }
    class BufferSource extends AudioNode
    {
        constructor() { super(); this.detune = {value:0}; this.loop = false; this.stopped = false; }
        start() { this.started = true; }
        stop() { this.stopped = true; }
    }
    class AudioContext
    {
        constructor() { this.state = 'running'; this.destination = new AudioNode(); this.currentTime = 0; }
        createGain() { return Object.assign(new AudioNode(), {gain:{value:1}}); }
        createBufferSource() { return new BufferSource(); }
        async decodeAudioData() { return {}; }
        async suspend() { this.state = 'suspended'; }
        async resume() { this.state = 'running'; }
    }
    const context = vm.createContext({
        AudioContext,
        console:{log(){}, warn(...args){ warnings.push(args); }},
        fetch:async()=>({arrayBuffer:async()=>new ArrayBuffer(0)}),
        setTimeout, clearTimeout
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../res/EMU_CARD_appledisk2.js'), 'utf8'), context);
    return {disk:context.oEMU.component.IO.AppleDisk2, warnings};
}

async function startMotor(disk)
{
    await disk.init('audio_ctx');
    await disk.init('audio_buffer');
    disk.dN_update('MOTOR_ON');
    return disk.AUD_buffer.DiskII_spin;
}

test('repeated mute stops the spin loop without disconnect warnings', async()=>{
    const {disk, warnings} = loadDisk();
    const spin = await startMotor(disk);
    assert.equal(spin.loop, true);
    await disk.init('audio_off');
    await disk.init('audio_off');
    assert.deepEqual(warnings, []);
    assert.equal(spin.stopped, true);
    assert.equal(spin.loop, false);
    assert.equal(disk.dNd.enable, false);
    assert.equal(disk.audio.state, 'suspended');
});

test('disk activity after unmuting starts a fresh audible spin loop', async()=>{
    const {disk, warnings} = loadDisk();
    const original = await startMotor(disk);
    await disk.init('audio_off');
    await disk.init('audio_ctx');
    disk.dN_update('MOTOR_ON');
    const resumed = disk.AUD_buffer.DiskII_spin;
    assert.notEqual(resumed, original);
    assert.equal(original.stopped, true);
    assert.equal(resumed.started, true);
    assert.equal(resumed.stopped, false);
    assert.equal(resumed.loop, true);
    assert.ok(resumed.connections.has(disk.gain));
    assert.ok(disk.gain.connections.has(disk.audio.destination));
    assert.equal(disk.audio.state, 'running');
    await disk.init('audio_off');
    assert.deepEqual(warnings, []);
});

test('a motor switched off while muted does not resume its old spin sound', async()=>{
    const {disk} = loadDisk();
    const spin = await startMotor(disk);
    await disk.init('audio_off');
    disk.dN_update('MOTOR_OFF');
    await disk.init('audio_ctx');
    assert.equal(spin.stopped, true);
    assert.equal(disk.dNd.motor, 'OFF');
});

test('muting before audio initialization is safe', async()=>{
    const {disk, warnings} = loadDisk();
    await disk.init('audio_off');
    await disk.init('audio_off');
    assert.equal(disk.audio, undefined);
    assert.equal(disk.dNd.enable, false);
    assert.deepEqual(warnings, []);
});
