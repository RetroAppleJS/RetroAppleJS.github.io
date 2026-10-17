//
// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/AppleII-IDE/main/LICENSE.md
//
// EMU_DEVICE_SID_audio.js
// SID sound-chip emulation AND browser audio output. No WebAudio code lives
// in EMU_CARD_SID.js. First-pass digital model, not analog 6581/8580 fidelity.
//

function SIDAudio()
{
    var device=this, owner=null, io=null;
    const SAMPLE_RATE=22050, FIFO_LENGTH=8192, MAX_BLOCK=2048;
    const ATTACK=[.002,.008,.016,.024,.038,.056,.068,.080,.100,.250,.500,.800,1,3,5,8];
    const DECAY=[.006,.024,.048,.072,.114,.168,.204,.240,.300,.750,1.5,2.4,3,9,15,24];
    const PHASE=16777216;
    var registers=new Uint8Array(32);
    var voices=[], sidModel=6581, sidClock=985248, hostClock=1021800;
    var lastTick=0, fraction=0;
    var queue=new Float32Array(FIFO_LENGTH),readIndex=0,writeIndex=0,queued=0;
    var audio=null,gain=null,sources=[],nextStart=0,playing=false,paused=false,volume=100;
    var audioEpoch=0,produced=0,dropped=0,scheduled=0;
    var filterLow=0,filterBand=0;
    this.id={DCODE:"SIDAUDIO",coID:"SIDAudio",hostPCODE:"SID",icon:"fa fa-volume-up"};
    this.audioDevice=true;
    this.audio=undefined;

    function newVoice()
    {
        return {phase:0,noise:0x7ffff8,envelope:0,stage:"release",
                releaseSlope:0,wrap:false};
    }
    function clearVoices(){ voices=[newVoice(),newVoice(),newVoice()]; }
    clearVoices();

    function clearQueue()
    {
        readIndex=writeIndex=queued=0;
        audioEpoch++;
    }
    function stopSources()
    {
        for(var i=0;i<sources.length;i++){
            try{sources[i].stop();}catch(e){}
            try{sources[i].disconnect();}catch(e){}
        }
        sources=[];
        nextStart=0;
    }
    function context()
    {
        if(audio)return audio;
        var Ctor=typeof AudioContext!=="undefined" ? AudioContext :
                 (typeof webkitAudioContext!=="undefined" ? webkitAudioContext : null);
        if(!Ctor)return null;
        audio=new Ctor({latencyHint:"interactive"});
        device.audio=audio;
        gain=audio.createGain();
        gain.gain.value=.25*volume/100;
        gain.connect(audio.destination);
        return audio;
    }
    function envelopeStep(v,base)
    {
        var ad=registers[base+5],sr=registers[base+6],ctrl=registers[base+4];
        var sustain=((sr>>4)&15)/15,dt=1/SAMPLE_RATE;
        if(!(ctrl&1) && v.stage!=="release") {
            v.stage="release";
            v.releaseSlope=v.envelope/Math.max(dt,DECAY[sr&15]);
        }
        if(v.stage==="attack"){
            v.envelope+=dt/ATTACK[(ad>>4)&15];
            if(v.envelope>=1){v.envelope=1;v.stage="decay";}
        }else if(v.stage==="decay"){
            v.envelope-=dt*(1-sustain)/DECAY[ad&15];
            if(v.envelope<=sustain){v.envelope=sustain;v.stage="sustain";}
        }else if(v.stage==="sustain"){
            // Sustain-level register writes take effect without a new GATE.
            v.envelope=sustain;
        }else{
            v.envelope=Math.max(0,v.envelope-dt*v.releaseSlope);
        }
        return v.envelope;
    }
    function voiceOutput(index)
    {
        var base=index*7,v=voices[index],ctrl=registers[base+4];
        var env=envelopeStep(v,base);
        if(ctrl&8){v.phase=0;v.noise=0x7ffff8;v.wrap=false;return 0;}
        var freq=registers[base] | registers[base+1]<<8;
        var step=freq*sidClock/SAMPLE_RATE,previous=v.phase;
        v.phase=(previous+step)%PHASE;
        v.wrap=v.phase<previous;
        // SID noise LFSR is clocked by phase bit 19 (approximation).
        if(Math.floor(previous/0x80000)!==Math.floor(v.phase/0x80000)){
            var feedback=((v.noise>>22)^(v.noise>>17))&1;
            v.noise=((v.noise<<1)|feedback)&0x7fffff;
        }
        var p=v.phase/PHASE,waves=0,sum=0;
        if(ctrl&0x10){sum+=1-4*Math.abs(p-.5);waves++;}
        if(ctrl&0x20){sum+=2*p-1;waves++;}
        if(ctrl&0x40){
            var width=((registers[base+3]&15)<<8)|registers[base+2];
            sum+=p<width/4096?1:-1;waves++;
        }
        if(ctrl&0x80){sum+=((v.noise>>14)&1)?1:-1;waves++;}
        if((ctrl&4) && (ctrl&0x10)){
            var mod=voices[(index+2)%3].phase>=PHASE/2?-1:1;
            sum*=mod;
        }
        if(!waves)return 0;
        return (sum/waves)*env;
    }
    function sample()
    {
        var raw=[voiceOutput(0),voiceOutput(1),voiceOutput(2)];
        // SID sync: when the preceding oscillator wraps, zero its target.
        for(var i=0;i<3;i++)
            if((registers[i*7+4]&2) && voices[(i+2)%3].wrap)
                voices[i].phase=0;
        var route=registers[0x17]&7;
        var direct=0,filtered=0;
        for(i=0;i<3;i++){
            var out=(i===2 && (registers[0x18]&0x80))?0:raw[i];
            if(route&(1<<i))filtered+=out;else direct+=out;
        }
        // Simple stable filter placeholder, NOT an accurate analog SID filter.
        var fc=((registers[0x16]<<3)|(registers[0x15]&7))/2047;
        // An intentionally approximate model-dependent filter curve:
        // the original 6581 varies widely between individual chips; the 8580
        // is cleaner and more linear. Replace with an accurate analog core later.
        var hz=sidModel===6581 ? 40+7200*Math.pow(fc,1.65) : 30+9500*fc;
        var alpha=1-Math.exp(-2*Math.PI*hz/SAMPLE_RATE);
        var oldLow=filterLow;
        filterLow+=alpha*(filtered-filterLow);
        filterBand=filterBand*.96+(filterLow-oldLow)*4;
        var mode=registers[0x18]&0x70,wet=0;
        if(mode&0x10)wet+=filterLow;
        if(mode&0x20)wet+=filterBand;
        if(mode&0x40)wet+=filtered-filterLow;
        if(!mode)wet=0;
        var out=(direct+wet)/3*(registers[0x18]&15)/15;
        return Math.max(-1,Math.min(1,out));
    }
    function makeSamples(count,toQueue)
    {
        var result=toQueue?null:new Float32Array(count);
        for(var i=0;i<count;i++){
            var value=sample();
            if(toQueue){
                if(playing&&!paused && audio && audio.state==="running"){
                    if(queued<FIFO_LENGTH){
                        queue[writeIndex]=value;writeIndex=(writeIndex+1)%FIFO_LENGTH;queued++;
                    }else dropped++;
                }
            }else result[i]=value;
            produced++;
        }
        return result;
    }
    this.advanceTo=function(tick)
    {
        tick=Math.floor(Number(tick));
        if(!Number.isFinite(tick)||tick<0)return;
        if(tick<lastTick){lastTick=tick;fraction=0;clearQueue();return;}
        var delta=tick-lastTick;
        if(!delta)return;
        lastTick=tick;
        // Integer phase accumulator: 1 CPU tick advances SAMPLE_RATE units.
        fraction+=delta*SAMPLE_RATE;
        var frames=Math.floor(fraction/hostClock);
        fraction-=frames*hostClock;
        while(frames>0){var n=Math.min(frames,MAX_BLOCK);makeSamples(n,true);frames-=n;}
    };
    this.writeRegister=function(reg,value,tick)
    {
        reg=Number(reg)|0;
        if(reg<0||reg>31)return false;
        if(tick!==undefined)this.advanceTo(tick);
        value=Number(value)&255;
        var old=registers[reg];registers[reg]=value;
        if(reg<21 && reg%7===4){
            var v=voices[(reg/7)|0],gate=value&1,oldGate=old&1;
            if(gate&&!oldGate){v.stage="attack";}
            if(!gate&&oldGate){
                v.stage="release";
                v.releaseSlope=v.envelope/DECAY[registers[(reg/7|0)*7+6]&15];
            }
            if(value&8){v.phase=0;v.noise=0x7ffff8;}
        }
        return true;
    };
    this.readRegister=function(reg,tick)
    {
        if(tick!==undefined)this.advanceTo(tick);
        reg=Number(reg)&31;
        if(reg===0x19||reg===0x1A)return 0xFF; // unconnected POT lines
        if(reg===0x1B)return (voices[2].phase>>>16)&255;
        if(reg===0x1C)return Math.round(voices[2].envelope*255)&255;
        return 0xFF; // write-only registers do not expose shadow as readback
    };
    this.getRegisters=function(){return new Uint8Array(registers);};
    this.setModel=function(model)
    {
        model=Number(model);
        if(model!==6581&&model!==8580)throw new RangeError("SID model must be 6581 or 8580");
        sidModel=model;return sidModel;
    };
    this.getModel=function(){return sidModel;};
    this.setClock=function(hz)
    {
        hz=Math.round(Number(hz));
        if(hz<900000||hz>1100000)throw new RangeError("SID clock must be 900k–1100k Hz");
        sidClock=hz;return sidClock;
    };
    this.getClock=function(){return sidClock;};
    this.setVolume=function(pct)
    {
        pct=Number(pct);
        if(!Number.isInteger(pct)||pct<0||pct>100)throw new RangeError("SID volume must be 0–100%");
        volume=pct;
        if(gain)gain.gain.value=.25*volume/100;
        return volume;
    };
    this.getVolume=function(){return volume;};
    this.getAudioStats=function(){
        return {produced:produced,queued:queued,dropped:dropped,scheduled:scheduled,
            sidModel:sidModel,sidClock:sidClock,hostClock:hostClock,
            contextState:audio?audio.state:"uninitialized",playbackEnabled:playing};
    };
    this.renderOffline=function(count)
    {
        count=Math.max(0,Math.floor(Number(count)||0));
        if(count>44100)throw new RangeError("Offline limit is 44100 samples");
        return makeSamples(count,false);
    };
    this.bindHost=function(host)
    {
        if(!host||!host.id||host.id.PCODE!=="SID")return false;
        owner=host;
        if(typeof host.getModel==="function")this.setModel(host.getModel());
        if(typeof host.getClock==="function")this.setClock(host.getClock());
        return true;
    };
    this.bindIO=function(value){io=value||null;return !!io;};
    this.unbindHost=function(host){
        if(owner!==host)return false;
        this.onUnmount();
        owner=null;io=null;
        return true;
    };
    this.setPresentationPaused=function(v){paused=!!v;if(paused){stopSources();clearQueue();}};
    this.isCycleActive=function(){return !!(playing&&!paused);};
    this.isTickActive=function(){return false;};
    this.cycle=function()
    {
        if(!playing||paused||!audio||audio.state!=="running")return;
        if(io&&typeof io.getClockTicks==="function")this.advanceTo(io.getClockTicks());
        if(!queued)return;
        var now=audio.currentTime;
        if(nextStart<now)nextStart=now+.025;
        if(nextStart-now>.09)return;
        var count=Math.min(queued,MAX_BLOCK);
        var buffer=audio.createBuffer(1,count,SAMPLE_RATE);
        var channel=buffer.getChannelData(0);
        for(var i=0;i<count;i++){channel[i]=queue[readIndex];readIndex=(readIndex+1)%FIFO_LENGTH;}
        queued-=count;
        var source=audio.createBufferSource();
        source.buffer=buffer;source.connect(gain);
        source.start(nextStart);
        nextStart+=buffer.duration;scheduled+=count;
        sources.push(source);
        source.onended=function(){
            try{source.disconnect();}catch(e){}
            var pos=sources.indexOf(source);if(pos>=0)sources.splice(pos,1);
        };
    };
    this.init=async function(action)
    {
        if(action==="audio_ctx"||action==="audio_on"){
            var ctx=context();
            if(ctx && ctx.state==="suspended"&&typeof ctx.resume==="function")await ctx.resume();
            if(action==="audio_on"){
                playing=!!ctx;
                stopSources();clearQueue();
                if(io&&typeof io.refreshDeviceHooks==="function")io.refreshDeviceHooks();
            }
        }else if(action==="audio_off"){
            playing=false;stopSources();clearQueue();
            if(audio&&typeof audio.suspend==="function")await audio.suspend();
            if(io&&typeof io.refreshDeviceHooks==="function")io.refreshDeviceHooks();
        }
    };
    this.reset=function()
    {
        registers.fill(0);clearVoices();filterLow=filterBand=0;
        fraction=0;lastTick=(io&&typeof io.getClockTicks==="function")?io.getClockTicks():0;
        stopSources();clearQueue();
    };
    this.restart=this.reset;
    this.onUnmount=function()
    {
        playing=false;stopSources();clearQueue();
        if(audio){try{audio.close();}catch(e){}audio=null;this.audio=undefined;gain=null;}
        if(io&&typeof io.refreshDeviceHooks==="function")io.refreshDeviceHooks();
    };
}
