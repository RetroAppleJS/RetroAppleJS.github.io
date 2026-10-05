'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {load, batch, out} = require('./helpers/ay_core');
test('CPU speed scales event duration and retains fractional anchors', () => {
    const ctx = load();
    assert.ok(ctx.AYSourceClock, 'CPU-to-audio source clock must exist');
    const a = new ctx.AYSourceClock(1000000, 0, 0);
    assert.equal(a.map(1000000), 1000000000);
    a.setRate(1000000, 2000000);
    assert.equal(a.map(2000000), 1500000000);
    a.setRate(2000000, 500000);
    assert.equal(a.map(3000000), 3500000000);
    const s = a.saveState();
    a.setRate(3000000, 0);
    assert.equal(a.map(3100000), 3700000000, 'single steps use last positive rate');
    a.loadState(s);
    assert.equal(a.map(3100000), 3700000000);
    const b = new ctx.AYSourceClock(1021800, 0, 0);
    const expected = Number(1000001n * 1000000000n / 1021800n);
    for (let c = 0; c < 1000000; c += 333) b.map(c);
    assert.equal(b.map(1000001), expected);
    assert.throws(() => b.setRate(0, NaN));
});
test(
    'stream seals only completed intervals; same-tick groups survive capacity splits', async () => {
        const ctx = load();
        assert.ok(ctx.AYStream, 'Bounded stream adapter must exist');
        const c = await ctx.AYCore.create(
            {backend: 'js', timebaseHz: 44100, maxFrames: 10, maxEvents: 2});
        const s = new ctx.AYStream(c, {epoch: 3, maxEvents: 2});
        s.accept({
            epoch: 3,
            sequence: 0,
            sealedBeforeTick: 0,
            events: batch([[0, 0, 0, 8, 10], [0, 0, 0, 13, 8]])
        });
        assert.throws(() => s.renderUntil(1, out(10)), e => e.code === 'E_TIME');
        s.renderUntil(0, out(0));
        s.accept({epoch: 3, sequence: 1, sealedBeforeTick: 10, events: batch([[0, 0, 0, 13, 8]])});
        assert.equal(s.renderUntil(10, out(10)), 10);
        assert.throws(
            () => s.accept(
                {epoch: 3, sequence: 2, sealedBeforeTick: 11, events: batch([[9, 0, 0, 0, 1]])}),
            e => e.code === 'E_ORDER');
        assert.throws(
            () => s.accept({epoch: 3, sequence: 4, sealedBeforeTick: 11, events: null}),
            e => e.code === 'E_ORDER');
        assert.equal(s.accept({epoch: 2, sequence: 2, sealedBeforeTick: 100, events: null}), false);
        assert.equal(s.getStats().stalePackets, 1);
    });
test('offline and irregular sealed delivery generate identical PCM', async () => {
    const ctx = load();
    assert.ok(ctx.AYStream);
    const options = {backend: 'js', timebaseHz: 1000000000, maxFrames: 4096, maxEvents: 64};
    const a = await ctx.AYCore.create(options), b = await ctx.AYCore.create(options);
    for (const c of [a, b])
    {
        c.configureChip(0, {model: 'AY', clockHz: 1000000});
        c.setMix(0, [1, 0, 0, 0, 0, 0]);
    }
    const clock = new ctx.AYSourceClock(1000000, 0, 0);
    const events = [
        [0, 0, 0, 0, 100], [0, 0, 0, 7, 56], [0, 0, 0, 8, 15], [50000, 0, 0, 8, 0],
        [70000, 0, 0, 8, 15]
    ].map(e => [clock.map(e[0]), ...e.slice(1)]);
    const whole = out(4096), n = a.renderUntil(90000000, batch(events), whole);
    const s = new ctx.AYStream(b, {maxEvents: 64}), parts = [];
    let sequence = 0, last = -1;
    for (const t of [0, 20000000, 50000000, 51000000, 90000000])
    {
        s.accept({
            epoch: 0,
            sequence: sequence++,
            sealedBeforeTick: t,
            events: batch(events.filter(e => e[0] > last && e[0] <= t))
        });
        const o = out(4096);
        parts.push(...o.left.subarray(0, s.renderUntil(t, o)));
        last = t;
    }
    assert.deepEqual(Float32Array.from(parts), whole.left.subarray(0, n));
});

test(
    'captured emulator writes replay identically through offline and irregular online streams',
    async () => {
        const fs = require('node:fs'), {root} = require('./helpers/ay_core'),
              trace = JSON.parse(
                  fs.readFileSync(root + '/asm/AUDIO/mockingboard-slot5-history.json', 'utf8'));
        const ctx = load(), firstCpu = trace.baseTick + trace.events[0][0],
              clock = new ctx.AYSourceClock(trace.clockHz, firstCpu, 0);
        let cpu = trace.baseTick;
        const events = trace.events.slice(0, 4096).map(e => {
            cpu += e[0];
            return [clock.map(cpu), e[1], e[2] < 0 ? 1 : 0, e[2] < 0 ? 0 : e[2], e[3]];
        });
        const end = events.at(-1)[0] + 10000000;
        async function replay(backend, irregular)
        {
            const c = await ctx.AYCore.create(
                {backend, timebaseHz: 1000000000, maxEvents: 4096, maxFrames: 4096});
            for (let i = 0; i < 2; i++)
            {
                c.configureChip(i, {model: 'AY', clockHz: trace.clockHz});
                c.setMix(i, i ? [0, .5, 0, .5, 0, .5] : [.5, 0, .5, 0, .5, 0]);
            }
            const stream = new ctx.AYStream(c, {maxEvents: 4096}), pcm = [];
            let horizon = 0, index = 0, sequence = 0;
            if (!irregular)
                stream.accept(
                    {epoch: 0, sequence: sequence++, sealedBeforeTick: end, events: batch(events)});
            while (horizon < end)
            {
                horizon = Math.min(
                    end,
                    horizon +
                        (irregular ? [17000001, 33000000, 19000000][sequence % 3] : 80000000));
                if (irregular)
                {
                    const accepted = [];
                    while (index < events.length && events[index][0] <= horizon)
                        accepted.push(events[index++]);
                    stream.accept({
                        epoch: 0,
                        sequence: sequence++,
                        sealedBeforeTick: horizon,
                        events: batch(accepted)
                    });
                }
                const o = out(4096), n = stream.renderUntil(horizon, o);
                for (let i = 0; i < n; i++) pcm.push(o.left[i], o.right[i]);
            }
            c.destroy();
            return Float32Array.from(pcm);
        }
        const reference = await replay('js', false), online = await replay('js', true),
              native = await replay('wasm', true);
        assert.deepEqual(online, reference);
        assert.ok(reference.some(x => Math.abs(x) > .01));
        assert.equal(native.length, reference.length);
        for (let i = 0; i < native.length; i++)
            assert.ok(Math.abs(native[i] - reference[i]) <= 1e-6);
    });
