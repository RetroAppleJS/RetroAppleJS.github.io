'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {load, batch, out} = require('./helpers/ay_core');
function config(extra = {})
{
    return {
        backend: 'js',
        chipCount: 2,
        sampleRate: 44100,
        timebaseHz: 44100,
        originTick: 0,
        maxFrames: 4096,
        maxEvents: 4096,
        ...extra
    };
}
async function core(ctx, backend = 'js', extra = {})
{
    assert.ok(ctx.AYCore, 'Shared AY core API must exist');
    return ctx.AYCore.create(config({...extra, backend}));
}
function tone(c, chip = 0)
{
    c.configureChip(chip, {model: 'AY', clockHz: 1000000});
    c.setMix(chip, chip ? [0, 0.5, 0, 0.5, 0, 0.5] : [0.5, 0, 0.5, 0, 0.5, 0]);
    c.writeNow(chip, 0, 100);
    c.writeNow(chip, 7, 0x38);
    c.writeNow(chip, 8, 15);
}
for (const backend of ['js', 'wasm'])
{
    test(backend + ': boundary writes, masks, independent chips and safe ticks', async () => {
        const ctx = load(), c = await core(ctx, backend, {originTick: 2 ** 32});
        tone(c);
        tone(c, 1);
        const o = out(1024);
        assert.equal(c.renderUntil(2 ** 32 + 1024, null, o), 1024);
        assert.ok(o.left.some(v => Math.abs(v) > .01));
        assert.deepEqual(o.left, o.right);
        c.renderUntil(
            2 ** 32 + 1024,
            batch([[2 ** 32 + 1024, 0, 0, 1, 255], [2 ** 32 + 1024, 0, 0, 13, 255]]), out(0));
        const regs = new Uint8Array(14);
        c.getRegisters(0, regs);
        assert.equal(regs[1], 15);
        assert.equal(regs[13], 15);
        const p = {};
        c.getPosition(p);
        assert.equal(p.tick, 2 ** 32 + 1024);
        assert.equal(p.renderedFrames, 1024);
        c.destroy();
        assert.throws(() => c.writeNow(0, 0, 1), e => e.code === 'E_HANDLE');
    });
    test(backend + ': preflight is atomic for order/capacity and output aliases', async () => {
        const ctx = load(), c = await core(ctx, backend);
        tone(c);
        const state = c.saveState(), o = out(5);
        o.left.fill(19);
        assert.throws(
            () => c.renderUntil(10, batch([[8, 0, 0, 0, 7], [3, 0, 0, 0, 9]]), o),
            e => e.code === 'E_ORDER');
        assert.deepEqual(c.saveState(), state);
        assert.ok(o.left.every(v => v === 19));
        assert.throws(() => c.renderUntil(10, null, o), e => e.code === 'E_CAPACITY');
        const same = new Float32Array(20);
        assert.throws(
            () => c.renderUntil(10, null, {left: same, right: same}), e => e.code === 'E_ARGUMENT');
        assert.deepEqual(c.saveState(), state);
    });
    test(
        backend + ': arbitrary splits and same-backend snapshot restore reproduce PCM',
        async () => {
            const ctx = load(), a = await core(ctx, backend, {timebaseHz: 1000000}),
                  b = await core(ctx, backend, {timebaseHz: 1000000});
            tone(a);
            tone(b);
            const events = [
                [23001, 0, 0, 13, 10], [23001, 0, 0, 8, 16], [24000, 0, 0, 13, 10],
                [46000, 0, 1, 0, 0], [46000, 0, 0, 8, 15]
            ];
            const whole = out(), n = a.renderUntil(80000, batch(events), whole);
            const parts = [];
            let last = 0;
            for (const end of [1, 23001, 23001, 40000, 80000])
            {
                const o = out(), e = events.filter(e => e[0] > last && e[0] <= end);
                parts.push(...o.left.subarray(0, b.renderUntil(end, batch(e), o)));
                last = end;
            }
            assert.deepEqual(Float32Array.from(parts), whole.left.subarray(0, n));
            const s = a.saveState(), next = out(100);
            a.renderUntil(81000, null, next);
            a.loadState(s);
            const again = out(100);
            a.renderUntil(81000, null, again);
            assert.deepEqual(next, again);
            const bad = s.slice();
            bad[bad.length - 1] ^= 1;
            const before = a.saveState();
            assert.throws(() => a.loadState(bad), e => e.code === 'E_STATE');
            assert.deepEqual(a.saveState(), before);
        });
    test(backend + ': phase and reset contracts', async () => {
        const ctx = load(), c = await core(ctx, backend);
        tone(c);
        c.renderUntil(600, null, out());
        assert.throws(
            () => c.configureChip(0, {model: 'YM', clockHz: 1000000}), e => e.code === 'E_PHASE');
        c.resetChipNow(0);
        const tail = out(100);
        c.renderUntil(700, null, tail);
        assert.ok(tail.left.some(v => v !== 0), 'warm reset retains filter tail');
        c.resetTransport(5);
        c.configureChip(0, {model: 'YM', clockHz: 1000000});
        const silence = out(100);
        c.renderUntil(105, null, silence);
        assert.ok(silence.left.every(v => v === 0));
    });
}
test('JS samples equal the unmodified Ayumi reference', async () => {
    const ctx = load(), c = await core(ctx);
    tone(c);
    const ref = new ctx.Ayumi();
    ref.configure(false, 1000000, 44100);
    for (let i = 0; i < 3; i++)
    {
        ref.channels[i].panLeft = .5;
        ref.channels[i].panRight = 0;
    }
    ref.setTone(0, 100);
    ref.setNoise(0);
    ref.setEnvelopeShape(0);
    for (let i = 0; i < 3; i++)
    {
        ref.setMixer(i, 0, 1, 0);
        ref.setVolume(i, i === 0 ? 15 : 0);
    }
    const o = out(2000);
    c.renderUntil(2000, null, o);
    for (let i = 0; i < 2000; i++)
    {
        ref.process();
        ref.removeDC();
        assert.equal(o.left[i], Math.fround(ref.left));
    }
});
test('JS/WASM parity across all envelope shapes, AY/YM, noise and dense writes', async () => {
    const ctx = load(), a = await core(ctx), b = await core(ctx, 'wasm');
    for (const c of [a, b])
    {
        tone(c);
        tone(c, 1);
        c.configureChip(1, {model: 'YM', clockHz: 1500000});
    }
    let tick = 0;
    for (let shape = 0; shape < 16; shape++)
    {
        const events = [];
        for (let chip = 0; chip < 2; chip++)
        {
            events.push(
                [tick, chip, 0, 6, shape], [tick, chip, 0, 7, shape], [tick, chip, 0, 8, 16],
                [tick, chip, 0, 9, 31], [tick, chip, 0, 10, 12], [tick, chip, 0, 11, 7],
                [tick, chip, 0, 13, shape], [tick, chip, 0, 13, shape]);
        }
        const x = out(1000), y = out(1000);
        a.renderUntil(tick + 1000, batch(events), x);
        b.renderUntil(tick + 1000, batch(events), y);
        for (let i = 0; i < 1000; i++)
            for (const k of ['left', 'right'])
                assert.ok(Math.abs(x[k][i] - y[k][i]) <= 1e-6, `${shape}/${i}/${k}`);
        tick += 1000;
    }
});

test('JS snapshot rejects invalid generator state even with a matching checksum', async () => {
    const ctx = load(), c = await core(ctx);
    tone(c);
    const before = c.saveState();
    const payload = JSON.parse(Buffer.from(before.subarray(28)).toString());
    payload.chips[0].channels[0].volume = 100;
    const text = Buffer.from(JSON.stringify(payload)), bad = new Uint8Array(28 + text.length);
    bad.set(before.subarray(0, 28));
    bad.set(text, 28);
    const v = new DataView(bad.buffer);
    v.setUint32(20, bad.length, true);
    v.setUint32(24, ctx.AYCore.checksum(bad, 28), true);
    assert.throws(() => c.loadState(bad), e => e.code === 'E_STATE');
    assert.deepEqual(c.saveState(), before);
});

test('packed-event writer rejects values that would otherwise truncate', () => {
    const ctx = load(), v = new DataView(new ArrayBuffer(16));
    assert.throws(() => ctx.AYCore.packEvent(v, 0, 0, 256, 0, 0, 1), e => e.code === 'E_ARGUMENT');
    assert.throws(() => ctx.AYCore.packEvent(v, 0, 0, 0, 1, 0, 1), e => e.code === 'E_ARGUMENT');
});
