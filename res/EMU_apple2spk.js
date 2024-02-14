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
    this.bDebug     = false;
    this.state      = 0;             
    this.AWblockL   = 128;        // Length of 1 AudioWorklet data block.  Currently, audio data blocks are always 128 frames long = 128 32-bit floating-point samples for each channel
    //this.AWblockN   = 34;         // Number of AudioWorklet data blocks in buffer
    //this.samplerate = 44100;      // Speaker Emulation Sample rate (must be an integer factor of block length)
    this.AWblockN   = 17;         // Number of AudioWorklet data blocks in buffer
    this.samplerate = 21050;      // Speaker Emulation Sample rate (must be an integer factor of block length)

    this.data = new Array(this.AWblockL * this.AWblockN);

    this.tickCycle = Math.round(_o.CPU_ClocksTicks_s / this.samplerate); // Ticks per emulator cycle
    // 20*128 samp / 25600 samp/sec  = 0.1 sec = length of one EMULATOR cycle

    //alert(Math.round(this.tickCycle))
    this.audio = null;
    this.player = null;
    this.data = new Array(this.AWblockL * this.AWblockN - 4).fill(0);
    this.cnt = 0;
    this.data_i = {};
    var ccnt = 0;
    var floatval = 0;

    this.init = async function(bEnable)
    {
        if(bEnable)
        {
            this.audio = new AudioContext({ latencyHint: 'interactive', sampleRate: this.samplerate });
            await this.audio.audioWorklet.addModule('res/AudioWorklet.js');       // Load an audio worklet
            this.player = new AudioWorkletNode(this.audio,'emulator-worklet');    // Create a player
            this.player.connect(this.audio.destination);                          // Connect the player to the audio context     
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
            this.pos--;
            this.pval = this.val;
            this.val = this.state-0.5;

            this.data[this.pos] = this.filter(this.val)

            if(this.cnt==1)
                this.data_i[ this.val ] = this.data_i[ this.val ]===undefined?1:(this.data_i[ this.val ]+1);
        }
    }

    this.filter = function(inp)
    {
        if(inp==this.pval)
        { 
            ccnt++;
            if(ccnt > 100) floatval *= 0.99
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
        this.state ^= 1;
    }

    this.play = function()
    {
        if(!this.player) return;

        // 4348 (-4)  - calculated =  4352
        //console.log("cnt"+this.cnt);

        if(this.bDebug && this.cnt==1)
        {
            //console.log("pos="+this.pos); //document.getElementById("debug").innerHTML += "pos="+this.pos+"<br>"
            var s = "";
            for(var i in this.data_i)
                s += i+" x"+this.data_i[i]+"  ";
            console.log(s);
            this.data_i = {}
        }

        this.cnt = (this.cnt%10) + 1;
        this.pos = this.data.length;

        this.player.port.postMessage({ type:'load', audio: this.data });

        this.player.port.onmessage = (e) => 
        {
            //document.getElementById("debug").style.display = "inline"
            document.getElementById("debug").value = e.data.message;
        }
    }
}
