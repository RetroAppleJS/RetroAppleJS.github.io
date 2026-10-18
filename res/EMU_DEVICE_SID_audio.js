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
    // At 10 FPS each processing cycle supplies 100 ms of PCM. A 25 ms cold
    // start lead left too little protection against browser timer stalls.
    // Startup buffering is intentionally larger; an actual underrun uses a
    // shorter restart lead to avoid *adding* another audible gap.
    const TARGET_AUDIO_LEAD=0.25, MAX_BLOCKS_PER_CYCLE=8;
    const START_LEAD=0.125, RECOVERY_LEAD=0.008;
    // Bus write timestamps may include an instruction-local cycle offset.
    const MINOR_CLOCK_SKEW_TICKS=32, AUDIO_EVENT_LIMIT=32;
    // SID ADSR rate-counter periods, measured in SID clock cycles.
    // Levels are eight-bit, with stepped exponential decay/release.
    const RATE_PERIODS=[9,32,63,95,149,220,267,313,392,977,1954,3126,3907,11720,19532,31251];
    const RATE_WRAP=0x8000;
    const PHASE=16777216;
    var registers=new Uint8Array(32);
    var voices=[], sidModel=6581, sidClock=985248, hostClock=1021800;
    var lastTick=0, fraction=0;
    var queue=new Float32Array(FIFO_LENGTH),readIndex=0,writeIndex=0,queued=0;
    var audio=null,gain=null,sources=[],nextStart=0,playing=false,paused=false,volume=100;
    var audioEpoch=0,produced=0,dropped=0,scheduled=0;
    var underruns=0,lateSeconds=0,blocksScheduled=0,maxQueueDepth=0;
    // Pure presentation counters; resetting these must never flush the PCM
    // FIFO, stop sources, or change oscillator/envelope phase.
    var lastLateMs=0,worstLateMs=0,minLeadMs=null,maxLeadMs=0;
    var preScheduleLeadMs=null,minPreScheduleLeadMs=null;
    var smallClockBacksteps=0,maxClockBackstepTicks=0,clockRewinds=0;
    var queueClears=0,clearedSamples=0,skippedSamples=0,offlineSamples=0;
    var eventHistory=[];
    var filterLow=0,filterBand=0;
    this.id={DCODE:"SIDAUDIO",coID:"SIDAudio",hostPCODE:"SID",icon:"fa fa-volume-up"};
    this.audioDevice=true;
    this.audio=undefined;

    function newVoice()
    {
        return {phase:0,noise:0x7ffff8,level:0,stage:"release",
                rateCounter:0,expCounter:0,wrap:false};
    }
    function clearVoices(){ voices=[newVoice(),newVoice(),newVoice()]; }
    clearVoices();

    function noteEvent(type,detail)
    {
        var event={type:type,cpuTick:lastTick,
            audioTime:audio?audio.currentTime:null};
        if(detail)for(var k in detail)event[k]=detail[k];
        eventHistory.push(event);
        if(eventHistory.length>AUDIO_EVENT_LIMIT)eventHistory.shift();
    }
    function clearQueue(reason)
    {
        if(queued){
            clearedSamples+=queued;
            queueClears++;
            noteEvent("queue_flush",{reason:reason||"other",samples:queued});
        }
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
    function expDivider(level)
    {
        // Exponential threshold stages from the established SID/reSID model.
        if(level>=0x5d)return 1;
        if(level>=0x36)return 2;
        if(level>=0x1a)return 4;
        if(level>=0x0e)return 8;
        if(level>=0x06)return 16;
        return 30;
    }
    function clockEnvelope(v,sustain)
    {
        if(v.stage==="attack"){
            if(v.level<255)v.level++;
            if(v.level===255){v.stage="decay";v.expCounter=0;}
        }else if(v.stage==="decay" || v.stage==="release"){
            if(v.stage==="decay" && v.level<=sustain){
                v.stage="sustain";
                return;
            }
            if(!v.level)return;
            if(++v.expCounter>=expDivider(v.level)){
                v.expCounter=0;
                v.level--;
                if(v.stage==="decay" && v.level<=sustain)
                    v.stage="sustain";
            }
        }
    }
    function envelopeStep(v,base)
    {
        var ad=registers[base+5],sr=registers[base+6];
        var sustain=((sr>>4)&15)*17;
        if(v.stage==="sustain" && v.level>sustain)v.stage="decay";

        // Each PCM sample spans ~45 SID clock cycles at PAL / 22.05 kHz.
        // Clock the 15-bit rate counter and process multiple envelope steps
        // where necessary, including the nine-cycle fastest attack.
        // Changing a period does not reset the counter: if the new period
        // is already passed, wait for 0x8000 wrap (SID ADSR delay behavior).
        var remaining=sidClock/SAMPLE_RATE;
        var guard=0;
        while(remaining>0 && guard++<16){
            var period=RATE_PERIODS[v.stage==="attack" ? (ad>>4)&15 :
                         (v.stage==="decay"||v.stage==="sustain") ? ad&15 : sr&15];
            var until=period>v.rateCounter ? period-v.rateCounter :
                      RATE_WRAP-v.rateCounter+period;
            if(remaining<until){
                v.rateCounter=(v.rateCounter+remaining)%RATE_WRAP;
                break;
            }
            remaining-=until;
            v.rateCounter=0;
            clockEnvelope(v,sustain);
        }
        return v.level/255;
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
                        if(queued>maxQueueDepth)maxQueueDepth=queued;
                    }else dropped++;
                }
                else skippedSamples++;
            }else {result[i]=value;offlineSamples++;}
            produced++;
        }
        return result;
    }
    this.advanceTo=function(tick)
    {
        tick=Math.floor(Number(tick));
        if(!Number.isFinite(tick)||tick<0)return;
        if(tick<lastTick){
            var backstep=lastTick-tick;
            if(backstep<=MINOR_CLOCK_SKEW_TICKS){
                // A per-instruction timestamp can legitimately be slightly
                // ahead of the boundary clock. Never delete 100 ms of PCM
                // just because an observation arrived a few cycles early.
                smallClockBacksteps++;
                maxClockBackstepTicks=Math.max(maxClockBackstepTicks,backstep);
                return;
            }
            // A genuine CPU clock epoch rewind invalidates future audio.
            clockRewinds++;
            noteEvent("clock_rewind",{backstepTicks:backstep,samples:queued});
            stopSources();
            clearQueue("clock_rewind");
            lastTick=tick;fraction=0;
            return;
        }
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
            if(gate&&!oldGate){v.stage="attack";v.expCounter=0;}
            if(!gate&&oldGate){
                v.stage="release";
                v.expCounter=0;
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
        if(reg===0x1C)return voices[2].level&255;
        return 0xFF; // write-only registers do not expose shadow as readback
    };
    this.getRegisters=function(){return new Uint8Array(registers);};
    // Useful for per-voice ADSR regressions; these are raw ENV levels, 0..255.
    this.getEnvelopeLevels=function(){return new Uint8Array(voices.map(v=>v.level));};
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
        var now=audio?audio.currentTime:0;
        return {produced:produced,queued:queued,dropped:dropped,scheduled:scheduled,
            blocksScheduled:blocksScheduled,underruns:underruns,
            lateSeconds:lateSeconds,maxQueueDepth:maxQueueDepth,
            queuedMs:queued*1000/SAMPLE_RATE,
            scheduledLeadMs:audio?Math.max(0,(nextStart-now)*1000):0,
            minLeadMs:minLeadMs,maxLeadMs:maxLeadMs,
            lastLateMs:lastLateMs,worstLateMs:worstLateMs,
            sampleRate:SAMPLE_RATE,outputSampleRate:audio?audio.sampleRate:null,
            capacityFrames:FIFO_LENGTH,activeSources:sources.length,
            preScheduleLeadMs:preScheduleLeadMs,
            minPreScheduleLeadMs:minPreScheduleLeadMs,
            smallClockBacksteps:smallClockBacksteps,
            maxClockBackstepTicks:maxClockBackstepTicks,
            clockRewinds:clockRewinds,
            queueClears:queueClears,clearedSamples:clearedSamples,
            skippedSamples:skippedSamples,offlineSamples:offlineSamples,
            recentAudioEvents:eventHistory.length,
            cpuTick:lastTick,
            sidModel:sidModel,sidClock:sidClock,hostClock:hostClock,
            contextState:audio?audio.state:"uninitialized",playbackEnabled:playing};
    };
    this.resetAudioTelemetry=function()
    {
        // No audio data/oscillator changes: this resets statistics ONLY.
        produced=dropped=scheduled=blocksScheduled=underruns=0;
        lateSeconds=lastLateMs=worstLateMs=maxLeadMs=0;
        smallClockBacksteps=maxClockBackstepTicks=clockRewinds=0;
        queueClears=clearedSamples=skippedSamples=offlineSamples=0;
        maxQueueDepth=queued;minLeadMs=null;
        preScheduleLeadMs=minPreScheduleLeadMs=null;
        eventHistory=[];
        return this.getAudioStats();
    };
    this.getAudioEvents=function(){return eventHistory.map(e=>Object.assign({},e));};
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
        if(nextStart===0){
            // A newly created AudioContext may report currentTime === 0.
            // Always establish the cold-start headroom before first source.
            nextStart=now+START_LEAD;
            preScheduleLeadMs=null;
        }else{
            preScheduleLeadMs=1000*(nextStart-now);
            minPreScheduleLeadMs=minPreScheduleLeadMs===null ?
                preScheduleLeadMs : Math.min(minPreScheduleLeadMs,preScheduleLeadMs);
            if(nextStart<now){
                underruns++;
                var lateMs=1000*(now-nextStart);
                lastLateMs=lateMs;
                worstLateMs=Math.max(worstLateMs,lateMs);
                lateSeconds+=now-nextStart;
                noteEvent("underrun",{
                    lateMs:lateMs,queuedFrames:queued,
                    preLeadMs:preScheduleLeadMs});
                // Playback already went silent. Restart promptly instead of
                // adding a full cold-start buffer delay to that silence.
                nextStart=now+RECOVERY_LEAD;
            }
        }
        // One block represents 92.9 ms of audio at 22.05 kHz.
        // At 10 display FPS the CPU can generate ~100 ms between calls.
        // Schedule *all* available samples (subject to a bounded horizon)
        // rather than just one block per display frame.
        var blocks=0;
        while(queued>0 && blocks<MAX_BLOCKS_PER_CYCLE &&
              nextStart-now<TARGET_AUDIO_LEAD){
            var count=Math.min(queued,MAX_BLOCK);
            var buffer=audio.createBuffer(1,count,SAMPLE_RATE);
            var channel=buffer.getChannelData(0);
            for(var i=0;i<count;i++){
                channel[i]=queue[readIndex];
                readIndex=(readIndex+1)%FIFO_LENGTH;
            }
            queued-=count;
            var source=audio.createBufferSource();
            source.buffer=buffer;
            source.connect(gain);
            source.start(nextStart);
            nextStart+=buffer.duration;
            var lead=Math.max(0,1000*(nextStart-now));
            minLeadMs=minLeadMs===null?lead:Math.min(minLeadMs,lead);
            maxLeadMs=Math.max(maxLeadMs,lead);
            scheduled+=count;
            blocksScheduled++;
            blocks++;
            sources.push(source);
            source.onended=function(){
                try{this.disconnect();}catch(e){}
                var pos=sources.indexOf(this);
                if(pos>=0)sources.splice(pos,1);
            };
        }
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
