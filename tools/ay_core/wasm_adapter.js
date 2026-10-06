// Source template appended to the generated embedded module asset.
var AYCoreWASM = {
    modulePromise: null,
    exports: null,
    initialize: function() {
        if (!this.modulePromise)
        {
            try
            {
                this.initializeSync();
            }
            catch (error)
            {
                return Promise.reject(error);
            }
        }
        return this.modulePromise;
    },
    initializeSync: function() {
        if (this.exports)
            return this.exports;
        if (typeof WebAssembly !== 'object')
            throw AYCore.error('E_MEMORY', 'WebAssembly unavailable');
        var binary = atob(AYCoreWASMAsset.base64), bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);
        var exports = new WebAssembly.Instance(new WebAssembly.Module(bytes), {}).exports;
        if (exports.ay_abi_version() !== 1 || exports.memory.buffer.byteLength !== 2097152)
            throw AYCore.error('E_STATE', 'Unsupported AY WASM ABI/memory');
        this.exports = exports;
        this.modulePromise = Promise.resolve(exports);
        return exports;
    },
    create: async function(config) {
        await this.initialize();
        return this.createReady(config);
    },
    createReady: function(config) {
        var e = this.exports;
        if (!e) throw AYCore.error('E_MEMORY', 'WASM not initialized');
        var memory = e.memory.buffer, v = new DataView(memory), ptr = e.ay_config_buffer();
        function check(code)
        {
            if (code < 0) throw AYCore.error(AYCore.ERROR_NAMES[-code] || 'E_STATE');
            return code;
        }
        var fields = [
            40, 1, config.chipCount, config.timebaseHz, config.sampleRate, config.maxFrames,
            config.maxEvents, 0
        ];
        for (var i = 0; i < 8; i++) v.setUint32(ptr + i * 4, fields[i], true);
        v.setFloat64(ptr + 32, config.originTick, true);
        var h = check(e.ay_create(ptr)), eventPtr = e.ay_event_buffer(h),
            leftPtr = e.ay_left_buffer(h), rightPtr = e.ay_right_buffer(h),
            controlPtr = e.ay_control_buffer(h), statePtr = e.ay_state_buffer(h);
        var eventBytes = new Uint8Array(memory, eventPtr, config.maxEvents * 16),
            left = new Float32Array(memory, leftPtr, config.maxFrames),
            right = new Float32Array(memory, rightPtr, config.maxFrames),
            controlBytes = new Uint8Array(memory, controlPtr, 64),
            snapshotBytes = new Uint8Array(memory, statePtr, check(e.ay_state_size(h)));
        return {
            config: config,
            advanced: false,
            configure: function(i, model, clock) {
                check(e.ay_configure_chip(h, i, model === 'YM' ? 1 : 0, clock));
            },
            mix: function(i, w) {
                for (var j = 0; j < 6; j++) v.setFloat64(controlPtr + j * 8, w[j], true);
                check(e.ay_set_mix(h, i, controlPtr));
            },
            write: function(i, r, value) {
                check(e.ay_write_now(h, i, r, value));
            },
            resetChip: function(i) {
                check(e.ay_reset_chip_now(h, i));
            },
            reset: function(origin) {
                check(e.ay_reset_transport(h, origin));
                this.advanced = false;
            },
            render: function(end, data, count, destLeft, destRight) {
                for (var i = 0; i < count * 16; i++) eventBytes[i] = data[i];
                var oldTick = v.getFloat64(controlPtr, true);
                var n = check(e.ay_render_until(
                    h, end, eventPtr, count, leftPtr, rightPtr, config.maxFrames));
                if (end > oldTick) this.advanced = true;
                for (var i = 0; i < n; i++)
                {
                    destLeft[i] = left[i];
                    destRight[i] = right[i];
                }
                return n;
            },
            position: function(dest) {
                check(e.ay_get_position(h, controlPtr));
                dest.tick = v.getFloat64(controlPtr, true);
                dest.samplePhase = v.getUint32(controlPtr + 8, true);
                dest.renderedFrames = v.getFloat64(controlPtr + 16, true);
            },
            regs: function(i, dest) {
                check(e.ay_get_registers(h, i, controlPtr));
                for (var j = 0; j < 14; j++) dest[j] = controlBytes[j];
            },
            save: function() {
                check(e.ay_save_state(h, statePtr, snapshotBytes.length));
                return snapshotBytes.slice();
            },
            load: function(bytes) {
                if (bytes.length !== snapshotBytes.length) throw AYCore.error('E_STATE');
                AYCore.checkSnapshot(bytes, 2);
                snapshotBytes.set(bytes);
                check(e.ay_load_state(h, statePtr, bytes.length));
                this.advanced = false;
            },
            dispose: function() {
                check(e.ay_destroy(h));
            }
        };
    }
};
