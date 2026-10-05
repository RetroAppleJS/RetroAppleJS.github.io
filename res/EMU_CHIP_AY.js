// Shared synchronous AY sound API. Browser transport and VIA pins stay outside.
function AYCoreError(code, message)
{
    this.name = 'AYCoreError';
    this.code = code;
    this.message = message || code;
    if (Error.captureStackTrace) Error.captureStackTrace(this, AYCoreError);
}
AYCoreError.prototype = Object.create(Error.prototype);
var AYCore = {
    ABI_VERSION: 1,
    EVENT_STRIDE: 16,
    MASKS: new Uint8Array([255, 15, 255, 15, 255, 15, 31, 255, 31, 31, 31, 255, 255, 15]),
    ERROR_NAMES: [
        null, 'E_ARGUMENT', 'E_HANDLE', 'E_TIME', 'E_ORDER', 'E_CAPACITY', 'E_MEMORY', 'E_STATE',
        'E_PHASE'
    ],
    error: function(code, message) {
        return new AYCoreError(code, message);
    },
    validTick: function(n) {
        return Number.isSafeInteger(n) && n >= 0;
    },
    integer: function(n, min, max) {
        return Number.isInteger(n) && n >= min && n <= max;
    },
    eventTick: function(data, p) {
        return (data[p] + data[p + 1] * 256 + data[p + 2] * 65536 + data[p + 3] * 16777216) +
            (data[p + 4] + data[p + 5] * 256 + data[p + 6] * 65536 + data[p + 7] * 16777216) *
            4294967296;
    },
    packEvent: function(view, index, tick, chip, op, reg, value) {
        if (!(view instanceof DataView) || !this.validTick(tick) ||
            !this.integer(index, 0, Math.floor(view.byteLength / 16) - 1) ||
            !this.integer(chip, 0, 1) || !this.integer(op, 0, 1) || !this.integer(reg, 0, 13) ||
            !this.integer(value, 0, 255) || op === 1 && (reg !== 0 || value !== 0))
            throw this.error('E_ARGUMENT');
        var p = index * 16;
        view.setUint32(p, tick % 4294967296, true);
        view.setUint32(p + 4, Math.floor(tick / 4294967296), true);
        view.setUint8(p + 8, chip);
        view.setUint8(p + 9, op);
        view.setUint8(p + 10, reg);
        view.setUint8(p + 11, value);
        view.setUint32(p + 12, 0, true);
    },
    configuration: function(options) {
        options = options || {};
        var c = {
            chipCount: options.chipCount === undefined ? 2 : options.chipCount,
            sampleRate: options.sampleRate === undefined ? 44100 : options.sampleRate,
            timebaseHz: options.timebaseHz === undefined ? 1000000000 : options.timebaseHz,
            originTick: options.originTick === undefined ? 0 : options.originTick,
            maxFrames: options.maxFrames === undefined ? 4096 : options.maxFrames,
            maxEvents: options.maxEvents === undefined ? 4096 : options.maxEvents
        };
        if (!this.integer(c.chipCount, 1, 2) || !this.integer(c.sampleRate, 8000, 192000) ||
            !this.integer(c.timebaseHz, 1, 4294967295) || !this.integer(c.maxFrames, 1, 16384) ||
            !this.integer(c.maxEvents, 1, 16384) || !this.validTick(c.originTick))
            throw this.error('E_ARGUMENT');
        return c;
    },
    createJS: function(options) {
        return this.facade(AYCoreJS.create(this.configuration(options)), 'js', '');
    },
    create: async function(options) {
        options = options || {};
        var requested = options.backend || 'auto', c = this.configuration(options);
        if (!['auto', 'js', 'wasm'].includes(requested)) throw this.error('E_ARGUMENT');
        if (requested === 'wasm')
        {
            if (typeof AYCoreWASM === 'undefined')
                throw this.error('E_MEMORY', 'WASM asset unavailable');
            return this.facade(await AYCoreWASM.create(c), 'wasm', '');
        }
        return this.facade(
            AYCoreJS.create(c), 'js',
            requested === 'auto' ? 'Browser performance acceptance pending' : '');
    },
    overlaps: function(a, b) {
        return a.buffer === b.buffer && a.byteOffset < b.byteOffset + b.byteLength &&
            b.byteOffset < a.byteOffset + a.byteLength;
    },
    facade: function(state, backend, reason) {
        var c = state.config, dead = false, position = {tick: 0, samplePhase: 0, renderedFrames: 0};
        function alive()
        {
            if (dead) throw AYCore.error('E_HANDLE');
        }
        function chip(i)
        {
            alive();
            if (!AYCore.integer(i, 0, c.chipCount - 1)) throw AYCore.error('E_ARGUMENT');
        }
        return {
            backend: backend,
            status: {backend: backend, fallbackReason: reason},
            config: Object.freeze({...c}),
            configureChip: function(i, options) {
                chip(i);
                if (!options || !['AY', 'YM'].includes(options.model) ||
                    !AYCore.integer(options.clockHz, 1, 64 * c.sampleRate))
                    throw AYCore.error('E_ARGUMENT');
                if (state.advanced) throw AYCore.error('E_PHASE');
                state.configure(i, options.model, options.clockHz);
            },
            setMix: function(i, w) {
                chip(i);
                if (!w || w.length !== 6) throw AYCore.error('E_ARGUMENT');
                for (var j = 0; j < 6; j++)
                    if (!Number.isFinite(w[j]) || w[j] < 0 || w[j] > 1)
                        throw AYCore.error('E_ARGUMENT');
                state.mix(i, w);
            },
            writeNow: function(i, r, v) {
                chip(i);
                if (!AYCore.integer(r, 0, 13) || !AYCore.integer(v, 0, 255))
                    throw AYCore.error('E_ARGUMENT');
                state.write(i, r, v);
            },
            resetChipNow: function(i) {
                chip(i);
                state.resetChip(i);
            },
            resetTransport: function(t) {
                alive();
                if (!AYCore.validTick(t)) throw AYCore.error('E_TIME');
                state.reset(t);
            },
            getRegisters: function(i, d) {
                chip(i);
                if (!(d instanceof Uint8Array) || d.length < 14) throw AYCore.error('E_ARGUMENT');
                state.regs(i, d);
            },
            getPosition: function(d) {
                alive();
                if (!d || typeof d !== 'object') throw AYCore.error('E_ARGUMENT');
                state.position(d);
            },
            renderUntil: function(end, batch, output) {
                alive();
                state.position(position);
                if (!AYCore.validTick(end) || end < position.tick ||
                    end - position.tick > 4294967295)
                    throw AYCore.error('E_TIME');
                var count = 0, data = null;
                if (batch !== null && batch !== undefined)
                {
                    data = batch.data;
                    count = batch.count;
                    if (!(data instanceof Uint8Array) || !Number.isInteger(count) || count < 0)
                        throw AYCore.error('E_ARGUMENT');
                    if (count > c.maxEvents || count * 16 > data.length)
                        throw AYCore.error('E_CAPACITY');
                }
                var prior = position.tick;
                for (var i = 0; i < count; i++)
                {
                    var p = i * 16, t = AYCore.eventTick(data, p);
                    if (!AYCore.validTick(t) || t < prior || t > end) throw AYCore.error('E_ORDER');
                    prior = t;
                    if (data[p + 8] >= c.chipCount || data[p + 9] > 1 || data[p + 12] ||
                        data[p + 13] || data[p + 14] || data[p + 15] ||
                        (data[p + 9] === 0 ? data[p + 10] > 13 :
                                             data[p + 10] !== 0 || data[p + 11] !== 0))
                        throw AYCore.error('E_ARGUMENT');
                }
                var frames = Math.floor(
                    (position.samplePhase + (end - position.tick) * c.sampleRate) / c.timebaseHz);
                if (!Number.isSafeInteger(position.renderedFrames + frames))
                    throw AYCore.error('E_TIME');
                if (!output || !(output.left instanceof Float32Array) ||
                    !(output.right instanceof Float32Array) ||
                    AYCore.overlaps(output.left, output.right) ||
                    (data &&
                     (AYCore.overlaps(data, output.left) || AYCore.overlaps(data, output.right))))
                    throw AYCore.error('E_ARGUMENT');
                if (frames > c.maxFrames || output.left.length < frames ||
                    output.right.length < frames)
                    throw AYCore.error('E_CAPACITY');
                try
                {
                    return state.render(end, data, count, output.left, output.right);
                }
                catch (error)
                {
                    if (error instanceof WebAssembly.RuntimeError)
                    {
                        dead = true;
                        state.dispose();
                    }
                    throw error;
                }
            },
            saveState: function() {
                alive();
                return state.save();
            },
            loadState: function(bytes) {
                alive();
                if (!(bytes instanceof Uint8Array)) throw AYCore.error('E_STATE');
                state.load(bytes);
            },
            destroy: function() {
                alive();
                state.dispose();
                dead = true;
            }
        };
    },
    checksum: function(bytes, start) {
        var hash = 2166136261;
        for (var i = start; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619);
        return hash >>> 0;
    },
    checkSnapshot: function(bytes, backend) {
        if (bytes.length < 28 || bytes[0] !== 65 || bytes[1] !== 89 || bytes[2] !== 83 ||
            bytes[3] !== 84)
            throw this.error('E_STATE');
        var v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (v.getUint32(4, true) !== 1 || v.getUint32(8, true) !== 1 ||
            v.getUint32(12, true) !== backend || v.getUint32(16, true) !== 1 ||
            v.getUint32(20, true) !== bytes.length ||
            v.getUint32(24, true) !== this.checksum(bytes, 28))
            throw this.error('E_STATE');
    }
};
