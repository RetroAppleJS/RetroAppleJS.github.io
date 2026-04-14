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
    var bDebug     = false;
    var state      = 0;
    var AWblockL   = 128;
    var AWblockN   = 17;
    var samplerate = 21760;

    this.tickCycle = Math.round(_o.CPU_ClocksTicks_s / samplerate);

    var data = new Array(AWblockL * AWblockN - 4).fill(0);
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
                    }, "apple_speaker");

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

                // reset queue when turning audio on
                if(this.audio)
                    this.nextStartTime = this.audio.currentTime;
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
    }

    this.cycle = function(n)
    {
        this.n = n;
        var m = n % this.tickCycle;

        if(m == 0)
        {
            this.pos--;
            this.pval = this.val;
            this.val = state - 0.5;

            data[this.pos] = this.filter(this.val);

            if(cnt == 1)
                data_i[this.val] = data_i[this.val] === undefined ? 1 : (data_i[this.val] + 1);
        }
    }

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
    }

    this.toggle = function()
    {
        state ^= 1;
    }

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
        this.pos = data.length;

        // Build an AudioBuffer from the generated samples.
        // The old worklet read the array backwards, so copy it in reverse here.
        var buffer = this.audio.createBuffer(1, data.length, samplerate);
        var ch0 = buffer.getChannelData(0);

        for(var i = 0, j = data.length - 1; i < data.length; i++, j--)
            ch0[i] = data[j];

        var src = this.audio.createBufferSource();
        src.buffer = buffer;
        src.connect(this.gain);

        // Schedule slightly ahead to reduce clicks/gaps.
        var now = this.audio.currentTime;
        if(!this.nextStartTime || this.nextStartTime < now)
            this.nextStartTime = now;

        src.start(this.nextStartTime);
        this.nextStartTime += buffer.duration;

        this.activeSources.push(src);

        src.onended = () =>
        {
            try { src.disconnect(); } catch(e) {}
            this.activeSources = this.activeSources.filter(function(x) { return x !== src; });
        };
    }
}

