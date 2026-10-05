'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {load} = require('./helpers/ay_core');
test(
    'native ABI rejects foreign pointers atomically, enforces fixed memory and invalidates stale handles',
    async () => {
        const ctx = load(), e = await ctx.AYCoreWASM.initialize();
        const c = await ctx.AYCore.create({backend: 'wasm'});  // establishes a valid setup record
        const h = e.ay_create(e.ay_config_buffer());
        assert.ok(h > 0);
        const ep = e.ay_event_buffer(h), lp = e.ay_left_buffer(h), rp = e.ay_right_buffer(h),
              sp = e.ay_state_buffer(h), size = e.ay_state_size(h);
        e.ay_save_state(h, sp, size);
        const before = new Uint8Array(e.memory.buffer, sp, size).slice();
        const left = new Float32Array(e.memory.buffer, lp, 4096);
        left.fill(77);
        assert.equal(e.ay_render_until(h, 1000000, ep, 0, lp + 4, rp, 4096), -1);
        assert.ok(left.every(v => v === 77));
        e.ay_save_state(h, sp, size);
        assert.deepEqual(new Uint8Array(e.memory.buffer, sp, size), before);
        assert.equal(e.ay_render_until(h, 4294967296, ep, 0, lp, rp, 4096), -3);
        assert.equal(e.ay_destroy(h), 0);
        assert.equal(e.ay_event_buffer(h), 0);
        const next = e.ay_create(e.ay_config_buffer());
        assert.notEqual(next, h);
        assert.equal(e.ay_write_now(h, 0, 0, 1), -2);
        assert.throws(() => e.memory.grow(1), RangeError);
        assert.equal(e.memory.buffer.byteLength, 2097152);
        e.ay_destroy(next);
        c.destroy();
        const bytes = Uint8Array.from(Buffer.from(ctx.AYCoreWASMAsset.base64, 'base64'));
        assert.deepEqual(WebAssembly.Module.imports(await WebAssembly.compile(bytes)), []);
    });
test('fixed arena reports exhaustion and destroyed instances return space', async () => {
    const ctx = load(), cores = [];
    let failed = false;
    for (let i = 0; i < 20; i++)
    {
        try
        {
            cores.push(
                await ctx.AYCore.create({backend: 'wasm', maxFrames: 16384, maxEvents: 16384}));
        }
        catch (e)
        {
            assert.equal(e.code, 'E_MEMORY');
            failed = true;
            break;
        }
    }
    assert.ok(failed);
    const pos = {};
    cores[0].getPosition(pos);
    assert.equal(pos.tick, 0);
    cores[0].destroy();
    const replacement =
        await ctx.AYCore.create({backend: 'wasm', maxFrames: 16384, maxEvents: 16384});
    replacement.destroy();
    for (const c of cores.slice(1)) c.destroy();
});
