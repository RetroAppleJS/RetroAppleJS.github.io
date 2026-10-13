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
        EMU_deviceMediaRowHTML:spec=>'<div data-media-row="'+spec.label+'"></div>',
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

test('disk noise volume is per-instance, defaults to 75%, and cycles 100-0-25-75', async()=>{
    const {disk:first}=loadDisk();
    const {disk:second}=loadDisk();

    assert.equal(first.dN_volume_get(),75);
    assert.equal(second.dN_volume_get(),75);
    assert.equal(first.dN_volume_icon(),'fa-volume-down');

    await first.init('audio_ctx');
    assert.equal(first.gain.gain.value,0.075);

    assert.equal(first.dN_volume_cycle(null),100);
    assert.equal(first.gain.gain.value,0.1);
    assert.equal(first.dN_volume_cycle(null),0);
    assert.equal(first.gain.gain.value,0);
    assert.equal(first.dN_volume_cycle(null),25);
    assert.equal(first.gain.gain.value,0.025);
    assert.equal(first.dN_volume_cycle(null),75);
    assert.equal(first.gain.gain.value,0.075);

    assert.equal(second.dN_volume_get(),75,'another Disk II instance keeps its own volume');
});

test('Disk II toolbox renders the per-instance noise volume control beside Software Catalog', ()=>{
    const {disk}=loadDisk();
    const html=disk.deviceToolSlotHTML({
        slotN:6,
        slotID:5,
        toolboxID:'device_tool_5',
        devices:disk.devices
    });

    assert.match(html,/id="diskNoiseVolume_6"/);
    assert.match(html,/data-volume="75"/);
    assert.match(html,/title="Disk noise volume: 75%"/);
    assert.match(html,/fa fa-volume-down/);
    assert.match(html,/SLOT2obj\(6\)\.dN_volume_cycle\(this\)/);

    const catalog=html.indexOf('Software Catalog');
    const volume=html.indexOf('diskNoiseVolume_6');
    const surface=html.indexOf('Disk Surface Map');

    assert.ok(catalog>=0 && volume>catalog,'volume control follows Software Catalog');
    assert.ok(surface>volume,'Disk Surface Map remains on the following row');
});

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

test('partial sample preload retries missing samples without decoding healthy samples', async()=>{
    const {disk}=loadDisk();
    await disk.init('audio_ctx');
    let calls=0;
    const original=disk.s_getFile;
    disk.s_getFile=async function(url) {
        calls++;
        if(calls===1) throw new Error('transient decode failure');
        return original.call(this,url);
    };
    await disk.init('audio_buffer');
    const first=calls;
    assert.ok(first>1);
    await disk.init('audio_buffer');
    assert.equal(calls,first+1, 'only the failed sample should be retried');
    await disk.init('audio_buffer');
    assert.equal(calls,first+1,'fully loaded buffers should remain cached');
});
