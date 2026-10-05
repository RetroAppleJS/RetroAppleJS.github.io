'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'),
      vm = require('node:vm');
const {load, root} = require('./helpers/ay_core');
function card(speed = 1)
{
    const ctx = load();
    ctx._o = {CPU_ClocksTicks_s: 1000000, CPU_TargetTicks_s: 1000000 * speed};
    ctx.oEMU = {component: {IO: {}}};
    let tick = 0;
    const io = {getClockTicks: () => tick};
    ctx.apple2plus = {hwObj: () => ({io, setIRQSource() {}})};
    vm.runInContext(fs.readFileSync(root + '/res/EMU_CARD_mockingboard.js', 'utf8'), ctx);
    const card = new ctx.mockingboard();
    card.restart();
    return {
        ctx,
        card,
        setTick(v) {
            tick = v;
        }
    };
}
function write(c, reg, value, tick = 0)
{
    const ctx = {cpuTick: tick};
    c.writeSlotROM(2, 7, ctx);
    c.writeSlotROM(3, 255, ctx);
    c.writeSlotROM(0, 4, ctx);
    c.writeSlotROM(1, reg, ctx);
    c.writeSlotROM(0, 7, ctx);
    c.writeSlotROM(0, 4, ctx);
    c.writeSlotROM(1, value, ctx);
    c.writeSlotROM(0, 6, ctx);
    c.writeSlotROM(0, 4, ctx);
}
function setup(c)
{
    write(c, 0, 100);
    write(c, 7, 56);
    write(c, 8, 15);
    c.setAudioConsumerActive(true);
}
test('real Mockingboard source shortens notes at 2x without changing tone PCM', () => {
    const nominal = card(), fast = card(2), slow = card(.5);
    for (const h of [nominal, fast, slow]) setup(h.card);
    nominal.card.advanceTo(40000);
    fast.card.advanceTo(80000);
    slow.card.advanceTo(20000);
    const data = [nominal, fast, slow].map(h => h.card.drainAudioFrames(100000));
    assert.equal(data[0].frames, 1764);
    assert.deepEqual(data[0].left, data[1].left);
    assert.deepEqual(data[0].left, data[2].left);
    for (const h of [nominal, fast, slow])
        assert.ok(h.card.getAYDiagnostics, 'Core diagnostics must be available');
});
test('live backend selection restarts explicitly and retains JS/WASM PCM parity', async () => {
    const js = card(), wasm = card();
    assert.ok(wasm.card.setAYBackend, 'Peripheral exposes explicit AY backend selection');
    await wasm.card.setAYBackend('wasm');
    setup(js.card);
    setup(wasm.card);
    js.card.advanceTo(40000);
    wasm.card.advanceTo(40000);
    const a = js.card.drainAudioFrames(100000), b = wasm.card.drainAudioFrames(100000);
    assert.equal(wasm.card.getAYDiagnostics().backend, 'wasm');
    for (let i = 0; i < a.frames; i++) assert.ok(Math.abs(a.left[i] - b.left[i]) < 1e-6);
});
test(
    'speed transition preserves phase and raw bus timestamps while splitting mapped deadlines',
    () => {
        const h = card(), base = card();
        setup(h.card);
        setup(base.card);
        h.card.advanceTo(20000);
        h.ctx._o.CPU_TargetTicks_s = 2000000;
        h.card.advanceTo(60000);
        base.card.advanceTo(40000);
        assert.deepEqual(
            h.card.drainAudioFrames(100000).left, base.card.drainAudioFrames(100000).left);
        assert.equal(h.card.getAYDiagnostics().targetHz, 2000000);
    });

test('hardware restart retains selected backend and cancels older initialization', async () => {
    const h = card();
    await h.card.setAYBackend('wasm');
    h.card.restart();
    assert.equal(h.card.getAYDiagnostics().backend, 'wasm');
    const pending = h.card.setAYBackend('wasm');
    h.card.onUnmount();
    assert.equal(await pending, false);
});
test('a full peripheral FIFO retains all accepted events until PCM is drained', () => {
    const h = card();
    setup(h.card);
    h.card.advanceTo(1000000);
    assert.equal(h.card.getAudioStats().queuedFrames, 11025);
    assert.equal(h.card.getAudioStats().droppedFrames, 0);
    write(h.card, 13, 10, 1000000);
    assert.ok(h.card.getAYDiagnostics().pendingEvents > 0);
    let total = 0;
    while (h.card.getAudioBufferedSeconds() > 1 / 44100)
    {
        const data = h.card.drainAudioFrames(11025);
        total += data.frames;
        if (!data.frames) break;
    }
    assert.equal(total, 44100);
    assert.equal(h.card.getAYDiagnostics().pendingEvents, 0);
});

test('sample-rate transition keeps synchronous AY readback and uses actual device frames', () => {
    const h = card();
    setup(h.card);
    assert.ok(h.card.setAudioSampleRate);
    h.card.setAudioSampleRate(48000);
    assert.equal(h.card.getRegisters(0)[0], 100);
    h.card.advanceTo(40000);
    const data = h.card.drainAudioFrames(100000);
    assert.equal(data.frames, 1920);
    assert.equal(h.card.getAudioFormat().sampleRate, 48000);
});
test('zero-speed stepping advances core state without presenting PCM', () => {
    const h = card();
    setup(h.card);
    h.card.advanceTo(10000);
    h.ctx._o.CPU_TargetTicks_s = 0;
    h.card.advanceTo(10001);
    assert.equal(h.card.getAudioFramesAvailable(), 0);
    assert.ok(h.card.getAYDiagnostics().renderedFrames >= 441);
    assert.equal(h.card.getAYDiagnostics().targetHz, 0);
});

test('sample-rate change invalidates a backend candidate built for the previous rate', async () => {
    const h = card();
    const pending = h.card.setAYBackend('wasm');
    h.card.setAudioSampleRate(48000);
    assert.equal(await pending, false);
    setup(h.card);
    h.card.advanceTo(10000);
    assert.equal(h.card.drainAudioFrames(100000).frames, 480);
});

test('consumer detach consumes committed synthesis without replaying it on reattach', () => {
    const h = card();
    setup(h.card);
    h.card.advanceTo(10000);
    h.card.setAudioConsumerActive(false);
    h.card.clearAudioQueue();
    h.card.setAudioConsumerActive(true);
    assert.equal(h.card.getAudioFramesAvailable(), 0);
    assert.equal(h.card.getAYDiagnostics().renderedFrames, 441);
});
