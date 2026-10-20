//
// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/AppleII-IDE/main/LICENSE.md
//
// EMU_DEVICE_SID_audio.js
// SID sound-chip emulation AND browser audio output. No WebAudio code lives
// in EMU_CARD_SID.js. Phase 4B digital oscillators; analog filter remains an
// approximation. SID clock events are batched, not per-cycle PCM oversampled.
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
    // Service every ~10 ms of wall time at the chosen CPU speed. All queue
    // and CPU-budget limits must use the same playback-time units.
    const SERVICE_QUANTUM_TICKS=10218, CPU_AUDIO_HIGH_WATER_SEC=0.50;
    // Bus write timestamps may include an instruction-local cycle offset.
    const MINOR_CLOCK_SKEW_TICKS=32, AUDIO_EVENT_LIMIT=32;
    // SID ADSR rate-counter periods, measured in SID clock cycles.
    // Levels are eight-bit, with stepped exponential decay/release.
    const RATE_PERIODS=[9,32,63,95,149,220,267,313,392,977,1954,3126,3907,11720,19532,31251];
    const RATE_MAX=0x7fff;
    const PHASE=16777216, HALF_PHASE=8388608, PHASE_MASK=0xffffff;
    const NOISE_CLOCK=0x100000, NOISE_RISE_OFFSET=0x80000;
    var registers=new Uint8Array(32);
    var voices=[], sidModel=6581, sidClock=1022727, hostClock=1021800;
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
    var overflowIncidents=0,overflowActive=false,overflowStartDropped=0;
    var overflowLastCpuTick=null,overflowLastAudioTime=null;
    var realtimeServices=0,cpuBudgetChecks=0,cpuBudgetBlocked=0;
    var filterLow=0,filterBand=0,oscClockFraction=0;
    // Reused typed registers: no per-sample array allocations in audio path.
    var oscFreq=new Uint16Array(3),oscCtrl=new Uint8Array(3);
    // Digital AND composition is closer to the SID's shared waveform DAC
    // than averaging independent waveforms. These small model-dependent
    // adjacent-bit coupling factors are *provisional approximations*, not
    // measured 6581/8580 DAC curves or copied waveform tables.
    function combinedDacTable(model){
        var key=model===6581?"sidCombined6581":"sidCombined8580";
        if(SIDAudio[key])return SIDAudio[key];
        var out=new Float32Array(4096),loss=model===6581?0.24:0.10;
        for(var bits=0;bits<4096;bits++){
            var value=0;
            for(var bit=0;bit<12;bit++){
                if(!(bits&(1<<bit)))continue;
                var n=(bit>0 && !(bits&(1<<(bit-1)))?1:0)+
                    (bit<11 && !(bits&(1<<(bit+1)))?1:0);
                value+=(1<<bit)*(1-loss*n);
            }
            out[bits]=value;
        }
        SIDAudio[key]=out;return out;
    }
    var combined6581=combinedDacTable(6581),
        combined8580=combinedDacTable(8580);
    this.id={DCODE:"SIDAUDIO",coID:"SIDAudio",hostPCODE:"SID",icon:"fa fa-volume-up"};
    this.audioDevice=true;
    this.audio=undefined;

    function newVoice()
    {
        return {phase:0,noise:0x7ffff8,level:0,stage:"release",
                rateCounter:0,expCounter:0,expPeriod:1,
                holdZero:true,wrap:false};
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
    function closeOverflow()
    {
        if(!overflowActive)return;
        noteEvent("fifo_overflow_end",{
            discarded:dropped-overflowStartDropped,queuedFrames:queued
        });
        overflowActive=false;
    }
    function clearQueue(reason)
    {
        closeOverflow();
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
    // The SID loads its exponential divider only at these exact ENV
    // transitions. Between transitions, preserve the previous divider.
    function updateExpPeriod(v)
    {
        switch(v.level){
            case 255:v.expPeriod=1;break;
            case 93:v.expPeriod=2;break;
            case 54:v.expPeriod=4;break;
            case 26:v.expPeriod=8;break;
            case 14:v.expPeriod=16;break;
            case 6:v.expPeriod=30;break;
            case 0:v.expPeriod=1;v.holdZero=true;break;
        }
    }
    function clockEnvelope(v,sustain)
    {
        if(v.stage==="attack"){
            // The first ATTACK step resets the exponential counter; GATE
            // itself does not. This also reproduces $ff -> $00 hold-zero.
            v.expCounter=0;
            if(v.holdZero)return;
            v.level=(v.level+1)&255;
            if(v.level===255)v.stage="decay";
        }else{
            // Continue advancing the exponential divider even at sustain
            // or during hold-zero: retrigger timing depends on its history.
            if(++v.expCounter!==v.expPeriod)return;
            v.expCounter=0;
            if(v.holdZero)return;
            // Sustain is a comparator within DECAY_SUSTAIN, not a state
            // which freezes the counter after its current value is reached.
            if(v.stage==="release" || v.level!==sustain)
                v.level=(v.level-1)&255;
            else return;
        }
        updateExpPeriod(v);
    }
    function envelopeStep(v,base,cycles)
    {
        var ad=registers[base+5],sr=registers[base+6];
        var sustain=(sr>>>4)*17;
        var remaining=cycles;
        // Skip entire runs of SID clocks until the next rate-counter
        // comparison. The 15-bit counter skips the 0x8000 position.
        while(remaining>0){
            var period=RATE_PERIODS[v.stage==="attack"?(ad>>>4):
                          v.stage==="decay"?(ad&15):(sr&15)];
            var until=period-v.rateCounter;
            if(until<=0)until+=RATE_MAX;
            if(remaining<until){
                var counter=v.rateCounter+remaining;
                if(counter>RATE_MAX)counter-=RATE_MAX;
                v.rateCounter=counter;
                break;
            }
            remaining-=until;
            v.rateCounter=0;
            clockEnvelope(v,sustain);
        }
        return v.level/255;
    }
    // 23-bit SID noise shift register. Clock on 0->1 transitions of
    // accumulator bit 19, not on every output sample or every bit toggle.
    function noiseAdvance(v,oldPhase,totalPhase)
    {
        // Both values are below 2^25 in the bounded PCM tick window:
        // an unsigned shift is exact here and avoids two Math.floor calls.
        var edges=((totalPhase+NOISE_RISE_OFFSET)>>>20)-
                  ((oldPhase+NOISE_RISE_OFFSET)>>>20);
        while(edges-->0){
            var feedback=((v.noise>>>22)^(v.noise>>>17))&1;
            v.noise=((v.noise<<1)|feedback)&0x7fffff;
        }
    }
    // Phase 4B.1: common case, with no enabled hard-sync targets.
    // One batched advance per oscillator and PCM frame; no event-search
    // loop, no temporary oscillator tables, and no work for zero frequency.
    // Noise state still advances when its waveform is not currently active:
    // a subsequent NOISE enable must observe the correct LFSR history.
    function clockFreeOscillator(v,freq,ctrl,cycles)
    {
        if(ctrl&8){
            v.phase=0;v.noise=0x7ffff8;v.wrap=false;
            return;
        }
        if(!freq||!cycles){v.wrap=false;return;}
        var before=v.phase,total=before+freq*cycles;
        if(((total+NOISE_RISE_OFFSET)>>>20)!==
           ((before+NOISE_RISE_OFFSET)>>>20)){
            noiseAdvance(v,before,total);
        }
        v.phase=total&PHASE_MASK;
        v.wrap=total>=PHASE;
    }
    // Exact (integer) SID clock count per PCM frame, with fractional cycles
    // carried across frames. No chip-clock-by-chip-clock sample synthesis.
    // When sync is active, jump directly to the next source-MSB rising edge
    // and process all oscillators at that event before continuing.
    function clockOscillators()
    {
        var frameCycles=sidClock/SAMPLE_RATE+oscClockFraction;
        var remain=Math.floor(frameCycles),elapsedCycles=remain;
        oscClockFraction=frameCycles-remain;
        var ctrl0=registers[4],ctrl1=registers[11],ctrl2=registers[18];
        var freq0=registers[0]|registers[1]<<8,
            freq1=registers[7]|registers[8]<<8,
            freq2=registers[14]|registers[15]<<8;
        if(!((ctrl0|ctrl1|ctrl2)&2)){
            clockFreeOscillator(voices[0],freq0,ctrl0,remain);
            clockFreeOscillator(voices[1],freq1,ctrl1,remain);
            clockFreeOscillator(voices[2],freq2,ctrl2,remain);
            return elapsedCycles;
        }
        // Only synchronization requires event boundaries and extra scans.
        oscFreq[0]=freq0;oscFreq[1]=freq1;oscFreq[2]=freq2;
        oscCtrl[0]=ctrl0;oscCtrl[1]=ctrl1;oscCtrl[2]=ctrl2;
        var f0=oscFreq,controls=oscCtrl;
        var syncActive=true;
        while(remain>0){
            var chunk=remain,i,v,source,phase,target;
            if(syncActive){
                for(i=0;i<3;i++){
                    if(!(controls[i]&2)||(controls[i]&8))continue;
                    source=(i+2)%3;
                    if((controls[source]&8)||!f0[source])continue;
                    phase=voices[source].phase;
                    target=phase<HALF_PHASE?HALF_PHASE:PHASE+HALF_PHASE;
                    var until=Math.ceil((target-phase)/f0[source]);
                    if(until<chunk)chunk=until;
                }
            }
            // Snapshot source MSB-rise events BEFORE targets are reset.
            var rise0=false,rise1=false,rise2=false;
            for(i=0;i<3;i++){
                v=voices[i];
                if(controls[i]&8){
                    v.phase=0;v.noise=0x7ffff8;v.wrap=false;continue;
                }
                var before=v.phase,total=before+f0[i]*chunk;
                if(syncActive){
                    target=before<HALF_PHASE?HALF_PHASE:PHASE+HALF_PHASE;
                    var rise=f0[i]>0 && total>=target;
                    if(i===0)rise0=rise;
                    else if(i===1)rise1=rise;
                    else rise2=rise;
                }
                noiseAdvance(v,before,total);
                v.phase=total&PHASE_MASK;
                v.wrap=total>=PHASE;
            }
            if(syncActive){
                if((controls[0]&2) && !(controls[0]&8) && rise2)
                    voices[0].phase=0;
                if((controls[1]&2) && !(controls[1]&8) && rise0)
                    voices[1].phase=0;
                if((controls[2]&2) && !(controls[2]&8) && rise1)
                    voices[2].phase=0;
            }
            remain-=chunk;
        }
        return elapsedCycles;
    }
    function noiseBits(v)
    {
        var n=v.noise;
        // SID noise DAC tap mapping from 23-bit register to eight bits.
        return (((n>>>20)&1)<<7)|(((n>>>18)&1)<<6)|
               (((n>>>14)&1)<<5)|(((n>>>11)&1)<<4)|
               (((n>>>9)&1)<<3)|(((n>>>5)&1)<<2)|
               (((n>>>2)&1)<<1)|(n&1);
    }
    function voiceOutput(index,elapsedSidCycles)
    {
        var base=index*7,v=voices[index],ctrl=registers[base+4];
        var env=envelopeStep(v,base,elapsedSidCycles);
        if((ctrl&8)||!(ctrl&0xf0))return 0;
        var phase=v.phase,selected=0xfff,waves=0;
        if(ctrl&0x10){
            // Triangle uses accumulator bits 22..11. Ring modulation
            // XORs the triangle fold bit with the preceding voice MSB.
            var fold=(phase&HALF_PHASE)?1:0;
            if(ctrl&4)fold^=(voices[(index+2)%3].phase&HALF_PHASE)?1:0;
            var triangle=(phase>>>11)&0xfff;
            if(fold)triangle^=0xfff;
            selected&=triangle;waves++;
        }
        if(ctrl&0x20){selected&=(phase>>>12)&0xfff;waves++;}
        if(ctrl&0x40){
            var width=((registers[base+3]&15)<<8)|registers[base+2];
            selected&=((phase>>>12)>=width)?0xfff:0;waves++;
        }
        if(ctrl&0x80){selected&=noiseBits(v)*0x11;waves++;}
        if(waves>1){
            // Model-dependent coupled 12-bit DAC, NOT mean-of-waves.
            selected=(sidModel===6581?combined6581:combined8580)[selected];
        }
        return ((selected/4095)*2-1)*env;
    }
    function sample()
    {
        var elapsedSidCycles=clockOscillators();
        var raw=[voiceOutput(0,elapsedSidCycles),
                 voiceOutput(1,elapsedSidCycles),
                 voiceOutput(2,elapsedSidCycles)];
        var i;
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
                    }else{
                        // Record the onset once per continuous overflow,
                        // before losing the first PCM frame. This is different
                        // from a browser underrun: the source FIFO was full.
                        if(!overflowActive){
                            overflowActive=true;overflowIncidents++;
                            overflowStartDropped=dropped;
                            overflowLastCpuTick=lastTick;
                            overflowLastAudioTime=audio.currentTime;
                            noteEvent("fifo_overflow",{
                                queuedFrames:queued,capacityFrames:FIFO_LENGTH,
                                producedFrames:produced,scheduledFrames:scheduled,
                                audioLeadMs:Math.max(0,1000*(nextStart-audio.currentTime))
                            });
                        }
                        dropped++;
                    }
                }
                else skippedSamples++;
            }else {result[i]=value;offlineSamples++;}
            produced++;
        }
        if(overflowActive && queued<FIFO_LENGTH)closeOverflow();
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
            if(gate&&!oldGate){v.stage="attack";v.holdZero=false;}
            if(!gate&&oldGate)v.stage="release";
            // GATE edges never clear either internal timing counter.
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
    // Passive Phase 4C diagnostic: neither advances time nor changes audio.
    this.getEnvelopeState=function(){
        return voices.map(function(v){return {
            level:v.level,stage:v.stage,rateCounter:v.rateCounter,
            expCounter:v.expCounter,expPeriod:v.expPeriod,
            holdZero:v.holdZero
        };});
    };
    // Passive digital-state readout for Phase 4B regression/telemetry.
    // It never advances SID time and returns detached numeric values.
    this.getOscillatorState=function(){
        return voices.map(function(v,i){return {
            phase:v.phase,noise:v.noise,wrap:v.wrap,
            control:registers[i*7+4]
        };});
    };
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
            overflowIncidents:overflowIncidents,
            overflowLastCpuTick:overflowLastCpuTick,
            overflowLastAudioTime:overflowLastAudioTime,
            realtimeServices:realtimeServices,
            cpuBudgetChecks:cpuBudgetChecks,cpuBudgetBlocked:cpuBudgetBlocked,
            recentAudioEvents:eventHistory.length,
            cpuTick:lastTick,
            sidModel:sidModel,sidClock:sidClock,hostClock:hostClock,
            cpuPlaybackRate:cpuPlaybackRate(),
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
        overflowIncidents=0;overflowLastCpuTick=overflowLastAudioTime=null;
        overflowActive=false;overflowStartDropped=0;
        realtimeServices=cpuBudgetChecks=cpuBudgetBlocked=0;
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
    // PCM is produced in emulated CPU time. Each sample must play faster
    // (or slower) as the user changes the Apple II CPU-speed multiplier.
    // Otherwise turbo outruns real-time Web Audio and flow control halts CPU.
    function cpuPlaybackRate()
    {
        if(typeof _o==="undefined" || !_o)return 1;
        var base=Number(_o.CPU_ClocksTicks_s);
        var target=Number(_o.CPU_TargetTicks_s);
        var rate=target/base;
        return Number.isFinite(rate) && rate>0 ? rate : 1;
    }
    this.getRealtimeAudioQuantumTicks=function(){
        return playing&&!paused&&audio&&audio.state==="running"?
            Math.max(1,Math.round(SERVICE_QUANTUM_TICKS*cpuPlaybackRate())):0;
    };
    this.serviceRealtimeAudio=function(){
        realtimeServices++;
        this.cycle(); // same exact scheduler, only invoked earlier
    };
    this.getCpuSliceBudget=function(requested){
        if(!playing||paused||!audio||audio.state!=="running"||
           !io||typeof io.getClockTicks!=="function")return requested;
        cpuBudgetChecks++;
        // Force accounting of any CPU time since the previous SID write.
        // The high-water bound includes *both* scheduled and unscheduled PCM.
        this.advanceTo(io.getClockTicks());
        var rate=cpuPlaybackRate();
        var lead=Math.max(0,nextStart-audio.currentTime);
        var pending=queued/(SAMPLE_RATE*rate);
        var room=Math.max(0,CPU_AUDIO_HIGH_WATER_SEC-lead-pending);
        var budget=Math.min(requested,
            Math.max(1,Math.round(SERVICE_QUANTUM_TICKS*rate)),
            Math.floor(room*hostClock*rate));
        if(budget<=0){cpuBudgetBlocked++;return 0;}
        return Math.max(1,budget);
    };
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
        var rate=cpuPlaybackRate();
        // At turbo speed, a fixed 2048-sample block is only a few wall-time
        // milliseconds. Batch samples to avoid excessive Web Audio sources.
        var blockLimit=Math.min(FIFO_LENGTH,
            Math.max(MAX_BLOCK,Math.round(MAX_BLOCK*rate)));
        while(queued>0 && blocks<MAX_BLOCKS_PER_CYCLE &&
              nextStart-now<TARGET_AUDIO_LEAD){
            var count=Math.min(queued,blockLimit);
            var buffer=audio.createBuffer(1,count,SAMPLE_RATE);
            var channel=buffer.getChannelData(0);
            for(var i=0;i<count;i++){
                channel[i]=queue[readIndex];
                readIndex=(readIndex+1)%FIFO_LENGTH;
            }
            queued-=count;
            var source=audio.createBufferSource();
            source.buffer=buffer;
            // Preserve sample order and pitch/tempo scaling together.
            if(source.playbackRate)source.playbackRate.value=rate;
            source.connect(gain);
            source.start(nextStart);
            nextStart+=buffer.duration/rate;
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
        oscClockFraction=0;
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
