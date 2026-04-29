//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_apple2spk.js  (Apple II Speaker)
                                      

//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_apple2spk.js  (Apple II Speaker)

if(oEMU===undefined) var oEMU = {"component":{"IO":{"AppleSpeaker":new AppleSpeaker()}}}
else oEMU.component.IO.AppleSpeaker = new AppleSpeaker();

function AppleSpeaker()
{
    var bDebug = false;
    var state  = 0;

    /*
        Original target was 21760 Hz, but with CPU_ClocksTicks_s = 1021800:
            tickCycle = round(1021800 / 21760) = 47
            samples per 100 ms = floor(102180 / 47) = 2174

        So we keep the tick granularity, then derive the real buffer duration
        from the actual samples produced per emulator interval.
    */
    var targetSamplerate = 21760;
    var cpuTicksPerBlock = Math.round(_o.CPU_ClocksTicks_s / _o.EMU_Updates_s);

    this.tickCycle = Math.round(_o.CPU_ClocksTicks_s / targetSamplerate);

    var blockSamples = Math.floor(cpuTicksPerBlock / this.tickCycle);
    var samplerate   = blockSamples * _o.EMU_Updates_s;   // normally 21740 Hz

    var data = new Array(blockSamples).fill(0);

    /*
        Runtime tuning knobs.

        queueLead_ms:
            Initial audio queue headroom. 20–40 ms is a good test range.
            Larger = safer, but more audio latency.

        playbackRate_ppm:
            Fine-tunes playback duration without changing the emulator clock.
            Negative values lengthen the buffer.
            Positive values shorten the buffer.
            Example: -1000 = 0.1% slower playback.

        overlap_ms:
            Starts the next buffer slightly before the previous one ends.
            Use tiny values only, e.g. 0.05–0.30 ms, because this can smear clicks.

        underruns:
            Counts how often the audio queue was already empty when play() ran.
    */
    this.timing = {
        queueLead_ms: 25,
        playbackRate_ppm: 0,
        overlap_ms: 0,
        underruns: 0,
        minLead_ms: 999999,
        logUnderruns: false
    };

    this.tune = function(arg)
    {
        if(arg === undefined) return this.timing;

        if(arg.queueLead_ms !== undefined)
            this.timing.queueLead_ms = Number(arg.queueLead_ms);

        if(arg.playbackRate_ppm !== undefined)
            this.timing.playbackRate_ppm = Number(arg.playbackRate_ppm);

        if(arg.overlap_ms !== undefined)
            this.timing.overlap_ms = Number(arg.overlap_ms);

        if(arg.logUnderruns !== undefined)
            this.timing.logUnderruns = !!arg.logUnderruns;

        return this.timing;
    };

    var cnt = 0;
    var data_i = {};
    var ccnt = 0;
    var floatval = 0;

    this.audio = undefined;
    this.gain = undefined;
    this.enabled = false;
    this.nextStartTime = 0;
    this.activeSources = [];

    this.init = async function(action)
    {
        switch(action)
        {
            case "audio_ctx":
                if(this.audio === undefined)
                {
                    this.audio = new AudioContext({
                        latencyHint: "interactive",
                        sampleRate: samplerate
                    });

                    this.gain = this.audio.createGain();
                    this.gain.gain.value = 0.25;
                    this.gain.connect(this.audio.destination);
                }
                else
                {
                    await this.audio.resume();
                }
            break;

            case "audio_on":
                this.enabled = true;

                if(this.audio && this.audio.state === "suspended")
                    await this.audio.resume();

                // Start with an intentional queue lead instead of immediate playback.
                if(this.audio)
                    this.nextStartTime = this.audio.currentTime + this.timing.queueLead_ms / 1000;

                this.timing.underruns = 0;
                this.timing.minLead_ms = 999999;
            break;

            case "audio_off":
                this.enabled = false;

                for(var i = 0; i < this.activeSources.length; i++)
                {
                    try { this.activeSources[i].stop(); } catch(e) {}
                    try { this.activeSources[i].disconnect(); } catch(e) {}
                }

                this.activeSources = [];

                if(this.audio)
                    await this.audio.suspend();
            break;
        }
    };

    this.cycle = function(n)
    {
        var m = n % this.tickCycle;

        if(m == 0)
        {
            // Guard against accidental overflow if CPU speed/tick settings change.
            if(this.pos <= 0) return;

            this.pos--;
            this.pval = this.val;
            this.val = state - 0.5;

            data[this.pos] = this.filter(this.val);

            if(cnt == 1)
                data_i[this.val] = data_i[this.val] === undefined ? 1 : (data_i[this.val] + 1);
        }
    };

    this.filter = function(inp)
    {
        if(inp == this.pval)
        {
            ccnt++;
            if(ccnt > 100) floatval *= 0.99;
        }
        else
        {
            floatval = inp;
            ccnt = 0;
        }

        return floatval;
    };

    this.toggle = function()
    {
        state ^= 1;
    };

    this.play = function()
    {
        if(!this.enabled || !this.audio || !this.gain) return;

        if(bDebug && cnt == 1)
        {
            var s = "";
            for(var i in data_i)
                s += i + " x" + data_i[i] + "  ";
            console.log(s);
            data_i = {};
        }

        cnt = (cnt % 10) + 1;

        /*
            If fewer samples were generated than expected, fill the tail of the
            audio block with the last stable speaker level instead of leaving
            stale data from the previous block.
        */
        if(this.pos > 0)
        {
            for(var k = this.pos - 1; k >= 0; k--)
                data[k] = floatval;
        }

        this.pos = data.length;

        var buffer = this.audio.createBuffer(1, data.length, samplerate);
        var ch0 = buffer.getChannelData(0);

        // The old worklet read the array backwards, so copy it in reverse here.
        for(var i = 0, j = data.length - 1; i < data.length; i++, j--)
            ch0[i] = data[j];

        var src = this.audio.createBufferSource();
        src.buffer = buffer;

        var rate = 1 + (this.timing.playbackRate_ppm / 1000000);
        if(rate < 0.90) rate = 0.90;
        if(rate > 1.10) rate = 1.10;

        src.playbackRate.value = rate;
        src.connect(this.gain);

        var now = this.audio.currentTime;
        var lead = this.timing.queueLead_ms / 1000;

        if(!this.nextStartTime)
            this.nextStartTime = now + lead;

        if(this.nextStartTime < now)
        {
            this.timing.underruns++;

            if(this.timing.logUnderruns)
                console.warn(
                    "AppleSpeaker underrun " +
                    Math.round((now - this.nextStartTime) * 1000) + " ms"
                );

            this.nextStartTime = now + lead;
        }

        var startTime = this.nextStartTime;
        src.start(startTime);

        var effectiveDuration = buffer.duration / rate;
        this.nextStartTime = startTime
                           + effectiveDuration
                           - (this.timing.overlap_ms / 1000);

        var queuedLead_ms = (this.nextStartTime - now) * 1000;
        if(queuedLead_ms < this.timing.minLead_ms)
            this.timing.minLead_ms = queuedLead_ms;

        this.activeSources.push(src);

        src.onended = () =>
        {
            try { src.disconnect(); } catch(e) {}
            this.activeSources = this.activeSources.filter(function(x) { return x !== src; });
        };
    };
}

