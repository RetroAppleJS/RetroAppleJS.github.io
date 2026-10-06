// Shared AY JavaScript numerical backend. Original Ayumi authors:
// Peter Sovietov & Alexander Kovalenko. See tools/ay_core/NOTICE.md.
var AYCoreJS = {
    create: function(config) {
        var state = {
            config: config,
            tick: config.originTick,
            origin: config.originTick,
            phase: 0,
            frames: 0,
            advanced: false,
            chips: [],
            models: [],
            clocks: [],
            registers: []
        };
        for (var i = 0; i < config.chipCount; i++)
        {
            var chip = new Ayumi();
            chip.process = config.renderProfile === 'economy' ? AYCoreJS.processEconomy : AYCoreJS.process;
            chip.firViewsLeft = [];
            chip.firViewsRight = [];
            for (var j = 0; j < 23; j++)
            {
                chip.firViewsLeft.push(chip.firLeft.subarray(192 - j * 8));
                chip.firViewsRight.push(chip.firRight.subarray(192 - j * 8));
            }
            state.chips.push(chip);
            state.models.push('AY');
            state.clocks.push(config.sampleRate * 8);
            state.registers.push(new Uint8Array(14));
            chip.configure(false, state.clocks[i], config.sampleRate);
            chip.step = state.clocks[i] / (config.sampleRate * (config.renderProfile === 'economy' ? 16 : 64));
            AYCoreJS.resetDigital(chip, state.registers[i]);
        }
        state.configure = function(index, model, clock) {
            this.models[index] = model;
            this.clocks[index] = clock;
            this.chips[index].step = clock / (config.sampleRate * (config.renderProfile === 'economy' ? 16 : 64));
            this.chips[index].dacTable = model === 'YM' ? YM_DAC_TABLE : AY_DAC_TABLE;
        };
        state.mix = function(index, weights) {
            for (var j = 0; j < 3; j++)
            {
                this.chips[index].channels[j].panLeft = weights[j * 2];
                this.chips[index].channels[j].panRight = weights[j * 2 + 1];
            }
        };
        state.write = function(index, reg, value) {
            AYCoreJS.write(this.chips[index], this.registers[index], reg, value);
        };
        state.resetChip = function(index) {
            AYCoreJS.resetDigital(this.chips[index], this.registers[index]);
        };
        state.reset = function(origin) {
            this.tick = this.origin = origin;
            this.phase = this.frames = 0;
            this.advanced = false;
            for (var i = 0; i < this.chips.length; i++)
            {
                var p = this.chips[i];
                AYCoreJS.resetDigital(p, this.registers[i]);
                p.x = p.left = p.right = 0;
                p.firIndex = p.dcIndex = 0;
                p.firLeft.fill(0);
                p.firRight.fill(0);
                p.interpolatorLeft.c.fill(0);
                p.interpolatorLeft.y.fill(0);
                p.interpolatorRight.c.fill(0);
                p.interpolatorRight.y.fill(0);
                p.dcFilterLeft.sum = p.dcFilterRight.sum = 0;
                p.dcFilterLeft.delay.fill(0);
                p.dcFilterRight.delay.fill(0);
            }
        };
        state.render = function(end, data, count, left, right) {
            var written = 0;
            for (var event = 0; event <= count; event++)
            {
                var offset = event * 16;
                var target = event < count ? AYCore.eventTick(data, offset) : end;
                var q = this.phase + (target - this.tick) * config.sampleRate;
                var frames = Math.floor(q / config.timebaseHz);
                this.phase = q % config.timebaseHz;
                if (target > this.tick) this.advanced = true;
                this.tick = target;
                for (var frame = 0; frame < frames; frame++)
                {
                    var l = 0, r = 0;
                    for (var chip = 0; chip < this.chips.length; chip++)
                    {
                        var p = this.chips[chip];
                        p.process();
                        p.removeDC();
                        l += p.left;
                        r += p.right;
                    }
                    left[written] = l;
                    right[written++] = r;
                }
                this.frames += frames;
                if (event < count)
                {
                    var i = data[offset + 8];
                    if (data[offset + 9] === 1)
                        this.resetChip(i);
                    else
                        this.write(i, data[offset + 10], data[offset + 11]);
                }
            }
            return written;
        };
        state.position = function(dest) {
            dest.tick = this.tick;
            dest.samplePhase = this.phase;
            dest.renderedFrames = this.frames;
        };
        state.regs = function(index, dest) {
            dest.set(this.registers[index]);
        };
        state.save = function() {
            return AYCoreJS.save(this);
        };
        state.load = function(blob) {
            AYCoreJS.load(this, blob);
        };
        state.dispose = function() {};
        return state;
    },
    resetDigital: function(chip, regs) {
        regs.fill(0);
        for (var i = 0; i < 3; i++)
        {
            var c = chip.channels[i];
            c.toneCounter = c.tone = c.tOff = c.nOff = c.eOn = c.volume = 0;
            c.tonePeriod = 1;
        }
        chip.noisePeriod = chip.noiseCounter = 0;
        chip.noise = 1;
        chip.envelopePeriod = 1;
        chip.setEnvelopeShape(0);
    },
    write: function(chip, regs, reg, value) {
        regs[reg] = value & AYCore.MASKS[reg];
        if (reg < 6)
        {
            var i = reg >> 1;
            chip.setTone(i, (regs[i * 2 + 1] << 8) | regs[i * 2]);
        }
        else if (reg === 6)
            chip.setNoise(regs[6]);
        else if (reg >= 7 && reg <= 10)
        {
            for (var i = 0; i < 3; i++)
            {
                chip.setMixer(i, (regs[7] >> i) & 1, (regs[7] >> (i + 3)) & 1, regs[8 + i] >> 4);
                chip.setVolume(i, regs[8 + i] & 15);
            }
        }
        else if (reg === 11 || reg === 12)
            chip.setEnvelope((regs[12] << 8) | regs[11]);
        else if (reg === 13)
            chip.setEnvelopeShape(regs[13]);
    },
    process: function() {
        var y1;

        var cLeft = this.interpolatorLeft.c;
        var yLeft = this.interpolatorLeft.y;

        var cRight = this.interpolatorRight.c;
        var yRight = this.interpolatorRight.y;

        var firOffset = FIR_SIZE - this.firIndex * DECIMATE_FACTOR;
        var firLeft = this.firViewsLeft[this.firIndex];
        var firRight = this.firViewsRight[this.firIndex];

        this.firIndex = (this.firIndex + 1) % (FIR_SIZE / DECIMATE_FACTOR - 1);

        for (var i = DECIMATE_FACTOR - 1; i >= 0; i--)
        {
            this.x += this.step;
            if (this.x >= 1)
            {
                this.x--;
                yLeft[0] = yLeft[1];
                yLeft[1] = yLeft[2];
                yLeft[2] = yLeft[3];

                yRight[0] = yRight[1];
                yRight[1] = yRight[2];
                yRight[2] = yRight[3];

                this.updateMixer();

                yLeft[3] = this.left;
                yRight[3] = this.right;

                y1 = yLeft[2] - yLeft[0];
                cLeft[0] = 0.5 * yLeft[1] + 0.25 * (yLeft[0] + yLeft[2]);
                cLeft[1] = 0.5 * y1;
                cLeft[2] = 0.25 * (yLeft[3] - yLeft[1] - y1);

                y1 = yRight[2] - yRight[0];
                cRight[0] = 0.5 * yRight[1] + 0.25 * (yRight[0] + yRight[2]);
                cRight[1] = 0.5 * y1;
                cRight[2] = 0.25 * (yRight[3] - yRight[1] - y1);
            }
            firLeft[i] = (cLeft[2] * this.x + cLeft[1]) * this.x + cLeft[0];
            firRight[i] = (cRight[2] * this.x + cRight[1]) * this.x + cRight[0];
        }

        this.left = this.decimate(firLeft);
        this.right = this.decimate(firRight);
    }

    ,
    // Two box-integrated points per PCM frame, followed by a seven-tap
    // half-band decimator. AY generator ticks remain clock/8, even when
    // several of them occur inside one substep. No per-sample allocations.
    processEconomy: function() {
        var heldLeft = this.interpolatorLeft.y[0], heldRight = this.interpolatorRight.y[0];
        for (var point = 0; point < 2; point++)
        {
            var remaining = this.step, left = 0, right = 0;
            while (remaining > 0)
            {
                var until = 1 - this.x;
                var width = remaining < until ? remaining : until;
                left += heldLeft * width;
                right += heldRight * width;
                remaining -= width;
                this.x += width;
                if (this.x >= 1)
                {
                    this.x = 0;
                    this.updateMixer();
                    heldLeft = this.left;
                    heldRight = this.right;
                }
            }
            this.firLeft[this.firIndex] = left / this.step;
            this.firRight[this.firIndex] = right / this.step;
            this.firIndex = (this.firIndex + 1) % 7;
        }
        this.interpolatorLeft.y[0] = heldLeft;
        this.interpolatorRight.y[0] = heldRight;
        var i = this.firIndex, l = this.firLeft, r = this.firRight;
        this.left = -(l[i] + l[(i + 6) % 7]) / 32 +
            (l[(i + 2) % 7] + l[(i + 4) % 7]) * (9 / 32) + l[(i + 3) % 7] / 2;
        this.right = -(r[i] + r[(i + 6) % 7]) / 32 +
            (r[(i + 2) % 7] + r[(i + 4) % 7]) * (9 / 32) + r[(i + 3) % 7] / 2;
    },
    // Backend snapshots are deliberately outside rendering. Shape validation and
    // checksum precede restoration; object/function identities stay untouched.
    numeric: function(value) {
        if (typeof (value) === 'number' || typeof (value) === 'boolean') return value;
        if (ArrayBuffer.isView(value)) return Array.from(value);
        if (Array.isArray(value)) return value.map(AYCoreJS.numeric);
        var result = {};
        for (var key of Object.keys(value))
            if (key !== 'envelopes' && key !== 'dacTable' && key !== 'firViewsLeft' &&
                key !== 'firViewsRight' && typeof (value[key]) !== 'function')
                result[key] = AYCoreJS.numeric(value[key]);
        return result;
    },
    save: function(state) {
        var payload = JSON.stringify({
            config: state.config,
            tick: state.tick,
            origin: state.origin,
            phase: state.phase,
            frames: state.frames,
            advanced: state.advanced,
            models: state.models,
            clocks: state.clocks,
            registers: state.registers.map(function(r) {
                return Array.from(r);
            }),
            chips: state.chips.map(AYCoreJS.numeric)
        });
        var bytes = new Uint8Array(28 + payload.length), v = new DataView(bytes.buffer);
        bytes.set([65, 89, 83, 84]);
        [1, 1, 1, 1, bytes.length].forEach(function(n, i) {
            v.setUint32(4 + i * 4, n, true);
        });
        for (var i = 0; i < payload.length; i++) bytes[28 + i] = payload.charCodeAt(i);
        v.setUint32(24, AYCore.checksum(bytes, 28), true);
        return bytes;
    },
    load: function(state, bytes) {
        try
        {
            AYCore.checkSnapshot(bytes, 1);
            var text = '';
            for (var i = 28; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
            var saved = JSON.parse(text);
            // Reference snapshots from before profiles were introduced keep
            // their existing generator/filter layout and remain compatible.
            if (saved.config.renderProfile === undefined) saved.config.renderProfile = 'reference';
            var current = AYCoreJS.save(state), templateText = '';
            for (var i = 28; i < current.length; i++)
                templateText += String.fromCharCode(current[i]);
            var template = JSON.parse(templateText);
            function verify(a, b)
            {
                if (typeof a !== typeof b) throw 0;
                if (typeof a === 'number')
                {
                    if (!Number.isFinite(a)) throw 0;
                    return;
                }
                if (typeof a === 'boolean' || typeof a === 'string') return;
                if (!a || !b || Array.isArray(a) !== Array.isArray(b)) throw 0;
                var keys = Object.keys(b);
                if (Object.keys(a).length !== keys.length) throw 0;
                for (var key of keys)
                {
                    if (!Object.prototype.hasOwnProperty.call(a, key)) throw 0;
                    verify(a[key], b[key]);
                }
            }
            verify(saved, template);
            if (JSON.stringify(saved.config) !== JSON.stringify(state.config)) throw 0;
            if (!AYCore.validTick(saved.tick) || !AYCore.validTick(saved.origin) ||
                saved.origin > saved.tick || !Number.isSafeInteger(saved.frames) ||
                saved.frames < 0 || !Number.isInteger(saved.phase) || saved.phase < 0 ||
                saved.phase >= state.config.timebaseHz)
                throw 0;
            var elapsed = BigInt(saved.tick - saved.origin) * BigInt(state.config.sampleRate),
                timebase = BigInt(state.config.timebaseHz);
            if (elapsed / timebase !== BigInt(saved.frames) ||
                elapsed % timebase !== BigInt(saved.phase) ||
                saved.advanced !== (saved.tick > saved.origin))
                throw 0;
            for (var i = 0; i < saved.chips.length; i++)
            {
                var p = saved.chips[i];
                if (!['AY', 'YM'].includes(saved.models[i]) || !Number.isInteger(saved.clocks[i]) ||
                    saved.clocks[i] <= 0 || saved.clocks[i] > 64 * state.config.sampleRate)
                    throw 0;
                if (!Number.isInteger(p.firIndex) || p.firIndex < 0 ||
                    p.firIndex >= (state.config.renderProfile === 'economy' ? 7 : 23) ||
                    !Number.isInteger(p.dcIndex) || p.dcIndex < 0 || p.dcIndex >= 1024 || p.x < 0 ||
                    p.x >= 1 || !Number.isInteger(p.noise) || p.noise < 0 || p.noise > 131071 ||
                    !Number.isInteger(p.envelopeShape) || p.envelopeShape < 0 ||
                    p.envelopeShape > 15 || !Number.isInteger(p.envelopeSegment) ||
                    p.envelopeSegment < 0 || p.envelopeSegment > 1 || p.envelope < 0 ||
                    p.envelope > 31)
                    throw 0;
                if (p.step !== saved.clocks[i] / (state.config.sampleRate *
                        (state.config.renderProfile === 'economy' ? 16 : 64)) ||
                    p.mastervolume !== 1 || !AYCore.integer(p.noisePeriod, 0, 31) ||
                    !AYCore.integer(p.noiseCounter, 0, 62) ||
                    !AYCore.integer(p.envelopePeriod, 1, 65535) ||
                    !AYCore.integer(p.envelopeCounter, 0, 65535) ||
                    !AYCore.integer(p.envelope, 0, 31))
                    throw 0;
                for (var j = 0; j < 3; j++)
                {
                    var ch = p.channels[j];
                    if (!AYCore.integer(ch.tonePeriod, 1, 4095) ||
                        !AYCore.integer(ch.toneCounter, 0, 4095) ||
                        !AYCore.integer(ch.tone, 0, 1) || !AYCore.integer(ch.tOff, 0, 1) ||
                        !AYCore.integer(ch.nOff, 0, 1) || !AYCore.integer(ch.eOn, 0, 1) ||
                        !AYCore.integer(ch.volume, 0, 15) || ch.panLeft < 0 || ch.panLeft > 1 ||
                        ch.panRight < 0 || ch.panRight > 1)
                        throw 0;
                }
                for (var j = 0; j < 14; j++)
                    if (!Number.isInteger(saved.registers[i][j]) ||
                        (saved.registers[i][j] & AYCore.MASKS[j]) !== saved.registers[i][j])
                        throw 0;
            }
            function restore(dest, src)
            {
                for (var key of Object.keys(src))
                {
                    if (ArrayBuffer.isView(dest[key]))
                        dest[key].set(src[key]);
                    else if (typeof (src[key]) === 'object')
                        restore(dest[key], src[key]);
                    else
                        dest[key] = src[key];
                }
            }
            state.tick = saved.tick;
            state.origin = saved.origin;
            state.phase = saved.phase;
            state.frames = saved.frames;
            state.advanced = saved.advanced;
            for (var i = 0; i < state.chips.length; i++)
            {
                state.models[i] = saved.models[i];
                state.clocks[i] = saved.clocks[i];
                state.chips[i].dacTable = saved.models[i] === 'YM' ? YM_DAC_TABLE : AY_DAC_TABLE;
                state.registers[i].set(saved.registers[i]);
                restore(state.chips[i], saved.chips[i]);
            }
        }
        catch (error)
        {
            throw AYCore.error('E_STATE');
        }
    }
};
