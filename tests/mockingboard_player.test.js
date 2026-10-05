'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');

const root = path.join(__dirname, '..');

// Only Web Audio and the DOM are substituted; FYM inflation and AY synthesis are real.
function load()
{
    const elements = {};
    class AudioContext
    {
        constructor()
        {
            this.sampleRate = 48000;
            this.state = 'suspended';
            this.destination = {};
            this.nodes = [];
        }
        async resume()
        {
            this.state = 'running';
        }
        createScriptProcessor(size, inputs, outputs)
        {
            assert.equal(inputs, 0);
            assert.equal(outputs, 2);
            const node = {
                onaudioprocess: null,
                connected: false,
                connect() {
                    this.connected = true;
                },
                disconnect() {
                    this.connected = false;
                }
            };
            this.nodes.push(node);
            return node;
        }
    }
    const context = {
        console,
        Uint8Array,
        Float32Array,
        AudioContext,
        atob: value => Buffer.from(value, 'base64').toString('binary'),
        document: {
            getElementById(id) {
                return elements[id] ||= {textContent: '', value: '100'};
            }
        }
    };
    context.window = context;
    vm.createContext(context);
    for (const name
             of ['ayumi.js', 'EMU_CHIP_AY_JS.js', 'EMU_CHIP_AY_WASM.js', 'EMU_CHIP_AY.js',
                 'pako.min.js'])
        vm.runInContext(fs.readFileSync(path.join(root, 'res', name), 'utf8'), context);
    const html = fs.readFileSync(path.join(root, 'tools', 'MockingboardJS.html'), 'utf8');
    for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))
        if (script[1].trim()) vm.runInContext(script[1], context);
    assert.ok(
        context.MockingboardPlayer,
        'The player must support independent FYM slots for two AY chips');
    return {context, player: context.MockingboardPlayer, elements};
}

function fym(periods, frameRate = 50, loopFrame = 0, clockRate = 1000000)
{
    const metadata = Buffer.from('Test track\0Test author\0');
    const offset = 20 + metadata.length;
    const data = Buffer.alloc(offset + periods.length * 14);
    [offset, periods.length, loopFrame, clockRate, frameRate].forEach(
        (v, i) => data.writeUInt32LE(v, i * 4));
    metadata.copy(data, 20);
    periods.forEach((period, frame) => {
        data[offset + frame] = period & 255;
        data[offset + periods.length + frame] = period >> 8;
        data[offset + 2 * periods.length + frame] = (period + 50) & 255;
        data[offset + 3 * periods.length + frame] = (period + 50) >> 8;
        data[offset + 4 * periods.length + frame] = (period + 100) & 255;
        data[offset + 5 * periods.length + frame] = (period + 100) >> 8;
        data[offset + 7 * periods.length + frame] = 0x38;
        for (let r = 8; r <= 10; r++) data[offset + r * periods.length + frame] = 15;
        data[offset + 13 * periods.length + frame] = 255;
    });
    return zlib.deflateSync(data).toString('base64');
}

function period(player, index)
{
    const r = new Uint8Array(14);
    player.core.getRegisters(index, r);
    return (r[1] << 8) | r[0];
}

function render(player, length)
{
    const left = new Float32Array(length), right = new Float32Array(length);
    player.fillBuffer({
        outputBuffer: {
            getChannelData(index) {
                return index ? right : left;
            }
        }
    });
    return {left, right};
}

async function playing(first, second)
{
    const result = load();
    if (first) result.player.loadBase64(first, 0);
    if (second) result.player.loadBase64(second, 1);
    assert.equal(await result.player.start(), true);
    return result;
}

test(
    'two FYM streams produce the averaged sum of two independently synthesized AY chips',
    async () => {
        const a = fym(Array(100).fill(100)), b = fym(Array(100).fill(230), 50, 0, 1500000);
        const both = await playing(a, b), soloA = await playing(a), soloB = await playing(null, b);
        const mixed = render(both.player, 4096), leftChip = render(soloA.player, 4096),
              rightChip = render(soloB.player, 4096);
        assert.ok(leftChip.left.some(v => Math.abs(v) > 0.01));
        assert.ok(rightChip.left.some(v => Math.abs(v) > 0.01));
        for (let i = 0; i < 4096; i++)
        {
            assert.ok(Math.abs(mixed.left[i] - (leftChip.left[i] + rightChip.left[i]) / 2) < 1e-6);
            assert.ok(
                Math.abs(mixed.right[i] - (leftChip.right[i] + rightChip.right[i]) / 2) < 1e-6);
            assert.ok(Number.isFinite(mixed.left[i]) && Math.abs(mixed.left[i]) <= 1);
        }
        assert.equal(both.player.core.backend, 'js');
    });

test(
    'both streams retain their frame rates and use the shared song loop at 48 kHz',
    async () => {
        const {player} = await playing(fym([100, 200, 300], 50, 1), fym([400, 500], 25));
        assert.equal(period(player, 0), 100);
        assert.equal(period(player, 1), 400);
        render(player, 960);
        assert.equal(period(player, 0), 200);
        assert.equal(period(player, 1), 400);
        render(player, 960);
        assert.equal(period(player, 0), 300);
        assert.equal(period(player, 1), 500);
        render(player, 960);
        assert.equal(period(player, 0), 200);
        assert.equal(period(player, 1), 400);
        render(player, 960);
        assert.equal(period(player, 1), 500);
    });

test(
    'Start at a selected origin does not stack callbacks; Stop disconnects and silences output',
    async () => {
        const {player} = await playing(fym([100, 200]), fym([230, 300]));
        const initial = render(player, 2048);
        const oldNode = player.audioNode, audio = player.audioContext;
        player.seekToSeconds(0);
        assert.equal(await player.start(), true);
        assert.equal(player.audioContext, audio);
        assert.equal(oldNode.connected, false);
        assert.equal(oldNode.onaudioprocess, null);
        assert.equal(audio.nodes.filter(n => n.connected).length, 1);
        assert.deepEqual(render(player, 2048), initial);
        player.stop();
        assert.equal(audio.nodes.filter(n => n.connected).length, 0);
        assert.ok(render(player, 256).left.every(v => v === 0));
    });

test('master volume scales all six channels and persists across Start', async () => {
    const {player} = await playing(fym([100]), fym([200]));
    const full = render(player, 1024);
    player.setVolume(50);
    player.seekToSeconds(0);
    await player.start();
    const half = render(player, 1024);
    for (let i = 0; i < 1024; i++) assert.equal(half.left[i], full.left[i] / 2);
    player.setVolume(0);
    assert.ok(render(player, 1024).left.every(v => v === 0));
});

test('a malformed FYM does not replace a loaded chip or interrupt valid playback', async () => {
    const {player} = await playing(fym([100]), fym([200]));
    const previous = player.chips[1];
    assert.throws(
        () => player.loadBase64(zlib.deflateSync(Buffer.alloc(20)).toString('base64'), 1), /FYM/);
    assert.equal(player.chips[1], previous);
    assert.equal(player.isPlaying, true);
    assert.ok(render(player, 1024).left.some(v => v !== 0));
});

test('file loading addresses each chip; clearing one retains single-chip playback', async () => {
    const {player, elements} = load();
    for (let chip = 0; chip < 2; chip++)
    {
        const bytes = Buffer.from(fym([100 + 100 * chip]), 'base64');
        await player.loadFile(
            {name: 'chip' + chip + '.fym', arrayBuffer: async () => Uint8Array.from(bytes).buffer},
            chip);
        assert.match(elements['chip' + chip + 'Status'].textContent, /Test track/);
    }
    await player.start();
    player.clearChip(0);
    assert.equal(player.chips[0], null);
    await player.start();
    assert.equal(player.chips[0], null, 'Do not add the demo when chip 2 is loaded');
    assert.ok(render(player, 1024).left.some(v => v !== 0));
});

test('Start with no files preserves the built-in FYM demonstration', async () => {
    const {player} = load();
    await player.start();
    assert.ok(render(player, 4096).left.some(v => v !== 0));
});

test('Stop cancels a Start that is waiting for browser audio permission', async () => {
    const {player} = await playing(fym([100]), fym([200]));
    let resume;
    player.audioContext.resume = () => new Promise(resolve => {
        resume = resolve;
    });
    const pending = player.start();
    await Promise.resolve();
    player.stop();
    resume();
    assert.equal(await pending, false);
    assert.equal(player.isPlaying, false);
    assert.equal(player.audioContext.nodes.filter(n => n.connected).length, 0);
});

test(
    'a slow older file load cannot overwrite a newer choice or resurrect a cleared chip',
    async () => {
        const {player} = load();
        let finish;
        const pending = player.loadFile(
            {
                name: 'slow.fym',
                arrayBuffer: () => new Promise(resolve => {
                    finish = resolve;
                })
            },
            0);
        player.loadBase64(fym([300]), 0);
        finish(Uint8Array.from(Buffer.from(fym([100]), 'base64')).buffer);
        assert.equal(await pending, false);
        await player.start();
        assert.equal(period(player, 0), 300);
        const another = player.loadFile(
            {
                name: 'slow.fym',
                arrayBuffer: () => new Promise(resolve => {
                    finish = resolve;
                })
            },
            0);
        player.clearChip(0);
        finish(Uint8Array.from(Buffer.from(fym([100]), 'base64')).buffer);
        assert.equal(await another, false);
        assert.equal(player.chips[0], null);
    });

test('URL loading supports two FYMs and the legacy doubly compressed first stream', async () => {
    const {player, context} = load();
    context._TITLE = () => '<div>Title</div>';
    context.document.location = 'https://example.invalid/tools/MockingboardJS.html';
    context.oCOM = {
        URL: {
            parse() {},
            uri: {
                fym: zlib.deflateSync(Buffer.from(fym([100]), 'base64')).toString('base64'),
                fym2: fym([200])
            }
        }
    };
    context.init_gui();
    await player.start();
    assert.equal(period(player, 0), 100);
    assert.equal(period(player, 1), 200);
});

test(
    'compressed file errors show a useful message and keep the previously loaded chip',
    async () => {
        const {player, elements} = await playing(fym([100]), fym([200]));
        const previous = player.chips[1];
        assert.equal(
            await player.loadFile(
                {name: 'broken.fym', arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer}, 1),
            false);
        assert.match(elements.chip1Status.textContent, /Unable to load:/);
        assert.doesNotMatch(elements.chip1Status.textContent, /undefined/);
        assert.equal(player.chips[1], previous);
        assert.equal(player.isPlaying, true);
    });

test('forced WASM player matches JS and uses a merged block core', async () => {
    const js = await playing(fym([100, 200, 300], 59, 1), fym([400, 500], 61));
    const wasm = load();
    wasm.player.backend = 'wasm';
    wasm.player.loadBase64(fym([100, 200, 300], 59, 1), 0);
    wasm.player.loadBase64(fym([400, 500], 61), 1);
    assert.equal(await wasm.player.start(), true);
    assert.equal(wasm.player.core.backend, 'wasm');
    for (let n = 0; n < 4; n++)
    {
        const a = render(js.player, 4096), b = render(wasm.player, 4096);
        for (let i = 0; i < 4096; i++) assert.ok(Math.abs(a.left[i] - b.left[i]) <= 1e-6);
    }
});

test('a rejected older Start cannot stop a newer successful playback', async () => {
    const {player} = await playing(fym([100]));
    let reject;
    player.audioContext.resume = () => new Promise((resolve, no) => {
        reject = no;
    });
    const old = player.start();
    await Promise.resolve();
    player.audioContext.resume = async () => {};
    assert.equal(await player.start(), true);
    const current = player.core;
    reject(new Error('old permission error'));
    assert.equal(await old, false);
    assert.equal(player.core, current);
    assert.equal(player.isPlaying, true);
    assert.ok(render(player, 1024).left.some(v => v !== 0));
});
