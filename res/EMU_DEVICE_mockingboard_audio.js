//
// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_DEVICE_mockingboard_audio.js
// Browser playback sink for the Mockingboard. Emulated audio time belongs to
// EMU_CARD_mockingboard.js; this device only drains rendered stereo frames.

function MockingboardAudio()
{
    var device=this;
    const QUEUE_LEAD_MS=30;
    const QUEUE_LOW_MS=15, QUEUE_HIGH_MS=60;
    var ownerEpoch=null;

    this.audioDevice=true;

    this.id={
         "DCODE":"MOCKAUDIO"
        ,"coID":"MockingboardAudio"
        ,"hostPCODE":"MOCK"
        ,"icon":"fa fa-volume-up"
    };

    var owner=null;
    var io=null;
    var playbackEnabled=false;
    var presentationPaused=false;
    var lifecycleRequest=0;
    var gain=null;
    var activeSources=[];
    var nextStartTime=0;
    var stats={buffersScheduled:0,framesScheduled:0,underruns:0,minLead_ms:Infinity};

    this.audio=undefined;

    function refreshHooks()
    {
        if(typeof(device._ioRefreshHooks)==="function") device._ioRefreshHooks();
    }
    function clearStats()
    {
        stats={buffersScheduled:0,framesScheduled:0,underruns:0,minLead_ms:Infinity};
    }
    function stopSources()
    {
        for(var i=0;i<activeSources.length;i++)
        {
            try { activeSources[i].stop(); } catch(e) {}
            try { activeSources[i].disconnect(); } catch(e) {}
        }
        activeSources=[];
    }
    function ensureAudio()
    {
        if(device.audio!==undefined) return device.audio;
        if(typeof(AudioContext)!="function") return null;
        var format=owner && typeof(owner.getAudioFormat)==="function"
            ? owner.getAudioFormat()
            : {sampleRate:44100};
        device.audio=new AudioContext({latencyHint:"interactive",sampleRate:format.sampleRate||44100});
        if(owner && typeof(owner.setAudioSampleRate)==="function")owner.setAudioSampleRate(device.audio.sampleRate);
        gain=device.audio.createGain();
        gain.gain.value=0.25;
        gain.connect(device.audio.destination);
        return device.audio;
    }
    function targetHz()
    {
        return typeof(_o)!=="undefined" && Number.isFinite(_o.CPU_TargetTicks_s)?_o.CPU_TargetTicks_s:1021800;
    }
    this.setPresentationPaused=function(paused)
    {
        paused=!!paused;if(paused===presentationPaused)return;
        presentationPaused=paused;stopSources();nextStartTime=0;
        if(owner)
        {
            if(typeof(owner.setAudioConsumerActive)==="function")owner.setAudioConsumerActive(playbackEnabled&&!paused);
            if(typeof(owner.clearAudioQueue)==="function")owner.clearAudioQueue();
        }
        if(!paused&&this.audio)nextStartTime=this.audio.currentTime+QUEUE_LEAD_MS/1000;
    };
    this.getCpuSliceBudget=function(requested)
    {
        if(!playbackEnabled||presentationPaused||!owner||!device.audio)return requested;
        if(targetHz()===0)return requested; // debugger stepping is numerically live, presentation silent
        if(io && typeof(io.getClockTicks)==="function")owner.advanceTo(io.getClockTicks());
        var scheduled=Math.max(0,nextStartTime-device.audio.currentTime);
        var pending=typeof(owner.getAudioBufferedSeconds)==="function"?owner.getAudioBufferedSeconds():0;
        var room=Math.max(0,QUEUE_HIGH_MS/1000-scheduled-pending);
        return Math.min(requested,4096,Math.floor(room*targetHz()));
    };

    this.bindHost=function(host)
    {
        if(!host || !host.id || host.id.PCODE!=="MOCK") return false;
        owner=host;
        if(typeof(owner.setTimingRefreshCallback)==="function")
            owner.setTimingRefreshCallback(function(){ refreshHooks(); });
        return true;
    };
    this.bindIO=function(hostIO)
    {
        io=hostIO||null;
        return !!io;
    };
    this.unbindHost=function(host)
    {
        if(owner!==host) return false;
        this.onUnmount();
        owner=null;
        io=null;
        ownerEpoch=null;
        return true;
    };
    this.isTickActive=function()
    {
        return !!(owner && typeof(owner.needsRealtimeTick)==="function" && owner.needsRealtimeTick());
    };
    this.isCycleActive=function(){ return playbackEnabled===true; };
    this.tick=function()
    {
        if(!owner || !io || typeof(io.getClockTicks)!=="function") return;
        var wasActive=this.isTickActive();
        owner.advanceTo(io.getClockTicks());
        if(wasActive && !this.isTickActive()) refreshHooks();
    };
    this.init=async function(action)
    {
        switch(action)
        {
            case "audio_ctx":
            {
                var ctx=ensureAudio();
                if(ctx && ctx.state==="suspended" && typeof(ctx.resume)==="function") await ctx.resume();
                break;
            }
            case "audio_on":
            {
                var ac=ensureAudio();
                var request=++lifecycleRequest;
                playbackEnabled=false;stopSources();clearStats();
                if(owner)
                {
                    if(typeof(owner.setAudioConsumerActive)==="function")owner.setAudioConsumerActive(false);
                    if(typeof(owner.clearAudioQueue)==="function")owner.clearAudioQueue();
                }
                if(ac && ac.state==="suspended" && typeof(ac.resume)==="function")await ac.resume();
                if(request!==lifecycleRequest)return;
                playbackEnabled=!!ac;
                if(owner && typeof(owner.setAudioConsumerActive)==="function")owner.setAudioConsumerActive(playbackEnabled&&!presentationPaused);
                if(ac)nextStartTime=ac.currentTime+QUEUE_LEAD_MS/1000;
                refreshHooks();
                break;
            }
            case "audio_off":
                lifecycleRequest++;
                playbackEnabled=false;
                if(owner)
                {
                    if(typeof(owner.setAudioConsumerActive)==="function") owner.setAudioConsumerActive(false);
                    if(typeof(owner.clearAudioQueue)==="function") owner.clearAudioQueue();
                }
                stopSources();
                nextStartTime=0;
                refreshHooks();
                if(device.audio && typeof(device.audio.suspend)==="function") await device.audio.suspend();
                break;
        }
    };
    this.cycle=function()
    {
        if(!playbackEnabled || !owner || !io) return;
        if(typeof(io.getClockTicks)==="function") owner.advanceTo(io.getClockTicks());
        var ac=ensureAudio();
        if(!ac || !gain) return;
        var available=typeof(owner.getAudioFramesAvailable)==="function" ? owner.getAudioFramesAvailable() : 0;
        var epoch=typeof(owner.getAudioEpoch)==="function"?owner.getAudioEpoch():null;
        if(epoch!==ownerEpoch){stopSources();nextStartTime=ac.currentTime+QUEUE_LEAD_MS/1000;ownerEpoch=epoch;}
        if(presentationPaused||targetHz()===0){stopSources();nextStartTime=0;if(typeof(owner.clearAudioQueue)==="function")owner.clearAudioQueue();return;}
        if(available<=0)return;
        if(!nextStartTime)nextStartTime=ac.currentTime+QUEUE_LEAD_MS/1000;
        if(nextStartTime<ac.currentTime){stats.underruns++;nextStartTime=ac.currentTime+QUEUE_LEAD_MS/1000;}
        var scheduledLead=Math.max(0,nextStartTime-ac.currentTime);
        var frameBudget=Math.max(0,Math.floor((QUEUE_HIGH_MS/1000-scheduledLead)*owner.getAudioFormat().sampleRate));
        if(frameBudget===0)return;
        var data=owner.drainAudioFrames(Math.min(available,frameBudget));
        if(!data || !data.frames) return;
        var format=owner.getAudioFormat();
        var buffer=ac.createBuffer(2,data.frames,format.sampleRate);
        buffer.getChannelData(0).set(data.left);
        buffer.getChannelData(1).set(data.right);
        var src=ac.createBufferSource();
        src.buffer=buffer;
        var playbackRate=1; // CPU orchestration was mapped before AY synthesis.
        if(src.playbackRate) src.playbackRate.value=playbackRate;
        src.connect(gain);
        var now=ac.currentTime;
        if(!nextStartTime) nextStartTime=now+QUEUE_LEAD_MS/1000;
        if(nextStartTime<now)
        {
            stats.underruns++;
            nextStartTime=now+QUEUE_LEAD_MS/1000;
        }
        var start=nextStartTime;
        src.start(start);
        nextStartTime=start+(buffer.duration/playbackRate);
        var lead=(nextStartTime-now)*1000;
        if(lead<stats.minLead_ms) stats.minLead_ms=lead;
        stats.buffersScheduled++;
        stats.framesScheduled+=data.frames;
        activeSources.push(src);
        src.onended=function()
        {
            try { src.disconnect(); } catch(e) {}
            activeSources=activeSources.filter(function(x){ return x!==src; });
        };
    };
    this.reset=function()
    {
        stopSources();
        nextStartTime=0;
        clearStats();
        if(owner && typeof(owner.clearAudioQueue)==="function") owner.clearAudioQueue();
        if(owner && typeof(owner.setAudioConsumerActive)==="function") owner.setAudioConsumerActive(playbackEnabled&&!presentationPaused);
    };
    this.restart=function()
    {
        this.reset();
        refreshHooks();
    };
    this.onUnmount=function()
    {
        lifecycleRequest++;
        playbackEnabled=false;
        if(owner)
        {
            if(typeof(owner.setAudioConsumerActive)==="function") owner.setAudioConsumerActive(false);
            if(typeof(owner.clearAudioQueue)==="function") owner.clearAudioQueue();
            if(typeof(owner.setTimingRefreshCallback)==="function") owner.setTimingRefreshCallback(null);
        }
        stopSources();
        nextStartTime=0;
        refreshHooks();
    };
    this.getStats=function()
    {
        return {
             buffersScheduled:stats.buffersScheduled
            ,framesScheduled:stats.framesScheduled
            ,underruns:stats.underruns
            ,queuedLead_ms:this.audio ? Math.max(0,(nextStartTime-this.audio.currentTime)*1000) : 0
            ,minLead_ms:Number.isFinite(stats.minLead_ms)?stats.minLead_ms:0
            ,lowWater_ms:QUEUE_LOW_MS,highWater_ms:QUEUE_HIGH_MS,playbackRate:1
        };
    };
}
