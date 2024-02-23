//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_apple2spk.js  (Apple II Speaker)
                                      

if(oEMU===undefined) var oEMU = {"component":{"IO":{"AppleSpeaker":new AppleSpeaker()}}}
else oEMU.component.IO.AppleSpeaker = new AppleSpeaker();

function AppleSpeaker()
{
    // every bit in this array represents speaker status 0 or 1 for one emulator cycle
    //this.buffer = new Uint8Array(_o.CPU_ClocksTicks_s / _o.EMU_Updates_s / 8);
    var bDebug     = false;
    var state      = 0;             
    var AWblockL   = 128;        // Length of 1 AudioWorklet data block.  Currently, audio data blocks are always 128 frames long = 128 32-bit floating-point samples for each channel
    //AWblockN   = 34;         // Number of AudioWorklet data blocks in buffer
    //samplerate = 44100;      // Speaker Emulation Sample rate (must be an integer factor of block length)
    var AWblockN   = 17;         // Number of AudioWorklet data blocks in buffer
    var samplerate = 21760;      // Speaker Emulation Sample rate (must be an integer factor of block length)

    //this.data = new Array(AWblockL * AWblockN);

    this.tickCycle = Math.round(_o.CPU_ClocksTicks_s / samplerate); // Ticks per emulator cycle
    // 17*128 samp / 21760 samp/sec  = 0.1 sec = length of one EMULATOR cycle
    // 1MHz / 0.02176 = 45.955 samples --> 46 clock cycles / sample

    //alert(Math.round(this.tickCycle))
    //this.audio = null;
    //this.player = null;
    var data = new Array(AWblockL * AWblockN - 4).fill(0);
    var cnt = 0;
    var data_i = {};
    var ccnt = 0;
    var floatval = 0;
    
    var js = "data:text/javascript;base64,"
    +"Y2xhc3MgRW11bGF0b3JXb3JrbGV0IGV4dGVuZHMgQXVkaW9Xb3JrbGV0UHJvY2Vzc29yCnsKICAg"
    +"IGNvbnN0cnVjdG9yKCkKICAgIHsKICAgICAgICBzdXBlcigpOwogICAgICAgIHRoaXMucG9ydC5v"
    +"bm1lc3NhZ2UgPSB0aGlzLm9ubWVzc2FnZS5iaW5kKHRoaXMpOwogICAgICAgIHRoaXMuc2FtcGxl"
    +"RGF0YSAgPSBbXTsKICAgICAgICB0aGlzLnNhbXBsZUluZGV4ID0gMDsKICAgICAgICB0aGlzLmRi"
    +"ZyAgICAgICAgID0gW107CiAgICB9CgogICAgb25tZXNzYWdlKGUpCiAgICB7CiAgICAgICAgc3dp"
    +"dGNoKGUuZGF0YS50eXBlKQogICAgICAgIHsKICAgICAgICAgICAgY2FzZSAibG9hZCI6CiAgICAg"
    +"ICAgICAgICAgICB0aGlzLmRlYnVnKDApOwogICAgICAgICAgICAgICAgdGhpcy5zYW1wbGVEYXRh"
    +"ICA9IGUuZGF0YS5hdWRpbzsKICAgICAgICAgICAgICAgIHRoaXMuc2FtcGxlSW5kZXggPSB0aGlz"
    +"LnNhbXBsZURhdGEubGVuZ3RoIC0gMTsKICAgICAgICAgICAgYnJlYWs7CiAgICAgICAgfQogICAg"
    +"fQoKICAgIG5leHRPdXRwdXQoKQogICAgewogICAgICAgIHRoaXMuZGVidWcoMSk7CiAgICAgICAg"
    +"cmV0dXJuIHRoaXMuc2FtcGxlRGF0YVsgdGhpcy5zYW1wbGVJbmRleD09MD8wOnRoaXMuc2FtcGxl"
    +"SW5kZXgtLSBdCiAgICB9CgogICAgcHJvY2VzcyhpbnB1dHMsIG91dHB1dHMpCiAgICB7CiAgICAg"
    +"ICAgY29uc3Qgb3V0cHV0ID0gb3V0cHV0c1swXTsKICAgICAgICBjb25zdCBjaGFubmVsID0gb3V0"
    +"cHV0WzBdOwogICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbm5lbC5sZW5ndGg7ICsraSkK"
    +"ICAgICAgICAgICAgY2hhbm5lbFtpXSA9IHRoaXMubmV4dE91dHB1dCgpOwogICAgICAgIHJldHVy"
    +"biB0cnVlOwogICAgfQoKICAgIGRlYnVnKGlkeCkKICAgIHsKICAgICAgICBzd2l0Y2goaWR4KQog"
    +"ICAgICAgIHsKICAgICAgICAgICAgY2FzZSAwOgogICAgICAgICAgICAgICAgdGhpcy5kYmdbMV0g"
    +"PSB0aGlzLmRiZ1sxXT09PXVuZGVmaW5lZCA_IDAgOiAoKHRoaXMuZGJnWzFdICsgMSkgJSAzKTsK"
    +"ICAgICAgICAgICAgICAgIGlmKHRoaXMuZGJnWzFdPT0wKQogICAgICAgICAgICAgICAgICAgIHRo"
    +"aXMucG9ydC5wb3N0TWVzc2FnZSh7IG1lc3NhZ2U6ICdidWZmZXIgJysodGhpcy5zYW1wbGVJbmRl"
    +"eCAtIHRoaXMuZGJnWzBdKSB9KTsKICAgICAgICAgICAgICAgIHRoaXMuZGJnWzBdID0gMDsKICAg"
    +"ICAgICAgICAgYnJlYWs7CiAgICAgICAgICAgIGNhc2UgMToKICAgICAgICAgICAgICAgIHRoaXMu"
    +"ZGJnWzBdICs9IHRoaXMuc2FtcGxlSW5kZXg9PTA_MTowOwogICAgICAgICAgICBicmVhazsKICAg"
    +"ICAgICB9CiAgICB9Cn0KCnJlZ2lzdGVyUHJvY2Vzc29yKCdlbXVsYXRvci13b3JrbGV0JywgRW11"
    +"bGF0b3JXb3JrbGV0KTs"
    //var js = "res/AudioWorklet.js"
    
    this.init = async function(action)
    {
        switch(action)
        {
            case "audio_ctx":
              if(this.audio===undefined)
              {
                  this.audio = new AudioContext({ latencyHint: 'interactive', sampleRate: samplerate },"apple_speaker");
                  await this.audio.audioWorklet.addModule(js);                        // Load an audio worklet
              } else this.audio.resume();
            break;
            case "audio_on":
                this.player = new AudioWorkletNode(this.audio,'emulator-worklet');    // Create a player
                this.player.connect(this.audio.destination);                          // Connect the player to the audio context                  
            break;
            case "audio_off":
                this.player.disconnect();
                this.audio.suspend();
            break; 
        }
    } 

    /*
    this.init = async function(action,callback)
    {
        if(action==true)
        {
            this.audio = new AudioContext({ latencyHint: 'interactive', sampleRate: samplerate },"apple_speaker") 
            try 
            { 
                //this.player = new AudioWorkletNode(this.audio,'emulator-worklet');    // Create a player
            }
            catch
            {
                
                //await this.audio.audioWorklet.addModule({
                //    url: js,
                //    crossOrigin: null
                //    });       // Load an audio worklet
                
                await this.audio.audioWorklet.addModule(js);       // Load an audio worklet  
                //await this.audio.
            }

        }
        else
        {
            this.player.disconnect();
            this.audio.suspend();
        }
        if(callback) callback();
    }

    this.post_init = function()
    {
        this.player = new AudioWorkletNode(this.audio,'emulator-worklet');    // Create a player
        this.player.connect(this.audio.destination);                          // Connect the player to the audio context   
    }
    */

    this.cycle = function(n)
    {
        this.n = n;
        var m = n % this.tickCycle;
        
        if(m==0)
        {
            this.pos--;
            this.pval = this.val;
            this.val = state-0.5;

            data[this.pos] = this.filter(this.val)

            if(cnt==1)
                data_i[ this.val ] = data_i[ this.val ]===undefined?1:(data_i[ this.val ]+1);
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
        state ^= 1;
    }

    this.play = function()
    {
        if(!this.player) return;

        // 4348 (-4)  - calculated =  4352
        //console.log("cnt"+cnt);

        if(bDebug && cnt==1)
        {
            //console.log("pos="+this.pos); //document.getElementById("debug").innerHTML += "pos="+this.pos+"<br>"
            var s = "";
            for(var i in data_i)
                s += i+" x"+data_i[i]+"  ";
            console.log(s);
            data_i = {}
        }

        cnt = (cnt%10) + 1;
        this.pos = data.length;

        this.player.port.postMessage({ type:'load', audio: data });

        this.player.port.onmessage = (e) => 
        {
            //document.getElementById("debug").style.display = "inline"
            document.getElementById("debug").value = e.data.message;
        }
    }
}
