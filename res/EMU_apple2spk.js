//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_apple2spk.js  (Apple II Speaker)
                                      

if(oEMU===undefined) var oEMU = {"component":{"IO":{"AppleSpeaker":new AppleSpeaker()}}}  // AppleDisk = IO card, AppleDisk2 = drive #1
else oEMU.component.IO.AppleSpeaker = new AppleSpeaker();

function AppleSpeaker()
{
    // every bit in this array represents speaker status 0 or 1 for one emulator cycle
    //this.buffer = new Uint8Array(_o.CPU_ClocksTicks_s / _o.EMU_Updates_s / 8);
    this.state      = 0;             
    this.AWblockL   = 128;        // Length of 1 AudioWorklet data block.  Currently, audio data blocks are always 128 frames long = 128 32-bit floating-point samples for each channel
    this.AWblockN   = 34;         // Number of AudioWorklet data blocks in buffer
    this.samplerate = 43520;    // Speaker Emulation Sample rate (must be an integer factor of block length)
    this.data = new Array(this.AWblockL * this.AWblockN);

    this.tickCycle = Math.round(_o.CPU_ClocksTicks_s / this.samplerate); // Ticks per emulator cycle
    // 20*128 samp / 25600 samp/sec  = 0.1 sec = length of one EMULATOR cycle

    //alert(Math.round(this.tickCycle))

    this.audio = null;
    this.player = null;
    this.data = new Array(this.AWblockL * this.AWblockN - 4).fill(0);
    this.cnt = 0;

    this.init = async function(bEnable)
    {
        
        if(bEnable)
        {
            this.audio = new AudioContext({ latencyHint: 'interactive', sampleRate: this.samplerate });
            await this.audio.audioWorklet.addModule('res/AudioWorklet.js');  // Load an audio worklet
            this.player = new AudioWorkletNode(this.audio,'emulator-worklet');    // Create a player
            this.player.connect(this.audio.destination);                        // Connect the player to the audio context     
        }
        else
        {
            this.player.disconnect();
            this.audio.suspend();
        }
    }

    this.cycle = function(n)
    {
        this.n = n;
        var m = n % this.tickCycle;
        if(m==0)
        {
            this.cnt++;
            this.pos--;

            this.data[this.pos] = this.state-0.5;

        }
        //this.data[]

        // 4348

        /*
        // store sound data in ringbuffer
        var byte_idx = n >> 3;
        var bit_idx = n % 8;
        var bit_msk = this.state << bit_idx;
        var val = bit_idx==7 ? bit_msk : this.buffer[byte_idx] | bit_msk;
        this.buffer[byte_idx] = val;
        */
    }

    this.toggle = function()
    {
        this.state ^= 1;
    }

    this.play = function()
    {
        // 4348 (-4)  - calculated =  4352
        //console.log("cnt"+this.cnt);
        this.cnt=0;
        this.pos = this.data.length;

        this.player.port.postMessage({ type:'append', audio: this.data });

        /*
        var audio_data = calc_wave( _o.EMU_AWblockN * _o.EMU_AWblockL, 4 );
        player.port.postMessage({ type:'append', audio: audio_data });    // append data to audio buffer
        if(audio.state!="running") { oLap.chrono(true); audio.resume() };

        player.port.onmessage = (e) => 
        {
            if(e.data.message=="empty")
            {
            var lap = oLap.chrono(false);
            if(bDebug) document.getElementById("dump").innerHTML += "<br>"+lap+"ms";
            audio.suspend();
            }
        }
        */
    }
}
