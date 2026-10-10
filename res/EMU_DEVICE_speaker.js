//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_DEVICE_speaker.js  (Apple II Speaker)
                                      

//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_DEVICE_speaker.js  (Apple II Speaker)

function AppleSpeaker()
{
    var speaker = this;
    this.id = {
         "DCODE":"A2SPK"
        ,"hostPCODE":"A2BO"
        ,"icon":"fa fa-volume-up"
        ,"description":"Apple II speaker"
        ,"deviceEnable":true
    };

    var bDebug = false;
    var state  = 0;

    /*
        Original target was 21760 Hz, but with CPU_ClocksTicks_s = 1021800:
            tickCycle = round(1021800 / 21760) = 47
            samples at 10 fps = floor((1021800 / 10) / 47) = 2174

        Keep the tick granularity, but recalculate the buffer geometry whenever
        the processing frame rate changes.  samplerate = samples * fps keeps
        every audio buffer exactly one processing frame long.
    */
    var targetSamplerate = 21760;

    this.tickCycle = Math.round(_o.CPU_ClocksTicks_s / targetSamplerate);

    var blockSamples = 0;
    var samplerate   = targetSamplerate;
    var data         = [];
    var frameRate    = _o.EMU_Updates_s;
    var frameExcessSamples = 0;
    var monitorEventName = "A2SPK_monitoring";

    function emptyDiagnostics()
    {
        return {
             frameCount:0
            ,lastFrameWall_ms:null
            ,frameIntervalLast_ms:null
            ,frameIntervalSum_ms:0
            ,frameIntervalCount:0
            ,frameIntervalMin_ms:null
            ,frameIntervalMax_ms:null
            ,measuredFrameRate:0
            ,monitorLastWall_ms:null
            ,monitorLastFrameCount:0
            ,monitorLastCpuTicks:null
            ,cpuPacePercent:0
            ,lastMissingSamples:0
            ,lastExcessSamples:0
            ,lastSampleDelta:0
            ,minSampleDelta:null
            ,maxSampleDelta:null
            ,cumulativeMissingSamples:0
            ,cumulativeExcessSamples:0
            ,sampleOverrunFrames:0
            ,queueLead_ms:null
            ,queueLeadMin_ms:null
            ,queueLeadMax_ms:null
            ,lastLate_ms:0
            ,worstLate_ms:0
        };
    }

    var diagnostics = emptyDiagnostics();

    function finiteOrNull(value)
    {
        return Number.isFinite(value) ? value : null;
    }

    function recordFrameWallTime()
    {
        if(typeof(performance)=="undefined" || typeof(performance.now)!="function")
            return;

        var now = performance.now();
        if(diagnostics.lastFrameWall_ms!==null)
        {
            var interval = now - diagnostics.lastFrameWall_ms;
            if(Number.isFinite(interval) && interval>=0)
            {
                diagnostics.frameIntervalLast_ms = interval;
                diagnostics.frameIntervalSum_ms += interval;
                diagnostics.frameIntervalCount++;
                diagnostics.frameIntervalMin_ms =
                    diagnostics.frameIntervalMin_ms===null
                        ? interval
                        : Math.min(diagnostics.frameIntervalMin_ms,interval);
                diagnostics.frameIntervalMax_ms =
                    diagnostics.frameIntervalMax_ms===null
                        ? interval
                        : Math.max(diagnostics.frameIntervalMax_ms,interval);
            }
        }
        diagnostics.lastFrameWall_ms = now;
        diagnostics.frameCount++;
    }

    function recordSampleBalance(missing,excess)
    {
        missing = Math.max(0,Math.round(Number(missing)||0));
        excess = Math.max(0,Math.round(Number(excess)||0));

        var delta = excess - missing;
        diagnostics.lastMissingSamples = missing;
        diagnostics.lastExcessSamples = excess;
        diagnostics.lastSampleDelta = delta;
        diagnostics.cumulativeMissingSamples += missing;
        diagnostics.cumulativeExcessSamples += excess;
        if(excess>0) diagnostics.sampleOverrunFrames++;
        diagnostics.minSampleDelta =
            diagnostics.minSampleDelta===null
                ? delta
                : Math.min(diagnostics.minSampleDelta,delta);
        diagnostics.maxSampleDelta =
            diagnostics.maxSampleDelta===null
                ? delta
                : Math.max(diagnostics.maxSampleDelta,delta);
    }

    function recordQueueLead(value)
    {
        if(!Number.isFinite(value)) return;
        diagnostics.queueLeadMin_ms =
            diagnostics.queueLeadMin_ms===null
                ? value
                : Math.min(diagnostics.queueLeadMin_ms,value);
        diagnostics.queueLeadMax_ms =
            diagnostics.queueLeadMax_ms===null
                ? value
                : Math.max(diagnostics.queueLeadMax_ms,value);
    }

    function monitorElement(id,value)
    {
        if(typeof(document)=="undefined" || !document.getElementById) return;
        var el=document.getElementById(id);
        if(el) el.textContent=value;
    }

    function formatNumber(value,digits,suffix)
    {
        return Number.isFinite(value)
            ? Number(value).toFixed(digits)+(suffix||"")
            : "—";
    }

    function cpuClockTicks()
    {
        try
        {
            var io=typeof(apple2plus)=="object" && apple2plus
                && typeof(apple2plus.hwObj)=="function"
                ? apple2plus.hwObj().io
                : null;
            return io && typeof(io.getClockTicks)=="function"
                ? Number(io.getClockTicks())
                : null;
        }
        catch(e) { return null; }
    }

    function ensureMonitorRefreshEvent()
    {
        if(typeof(oCOM)=="undefined" || !oCOM
        || typeof(oCOM.addRefreshEvent)!="function")
            return false;

        if(!oCOM.RefreshEvent_arr || !oCOM.RefreshEvent_arr[monitorEventName])
            oCOM.addRefreshEvent(function(){ speaker.monitoring(); },monitorEventName,false);

        return !!(oCOM.RefreshEvent_arr && oCOM.RefreshEvent_arr[monitorEventName]);
    }

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

    this.setFrameRate = function(fps)
    {
        fps = Math.round(Number(fps));
        if(!Number.isFinite(fps) || fps < 1) return;

        var cpuTicksPerBlock = _o.CPU_ClocksTicks_s / fps;

        frameRate = fps;
        blockSamples = Math.max(1, Math.floor(cpuTicksPerBlock / this.tickCycle));
        samplerate   = blockSamples * fps;
        data         = new Array(blockSamples).fill(floatval);
        this.pos     = data.length;
    };

    this.setFrameRate(_o.EMU_Updates_s);

    this.audio = undefined;
    this.gain = undefined;
    this.enabled = false;
    this.nextStartTime = 0;
    this.activeSources = [];

    this.isTickActive = function()
    {
        return this.enabled===true;
    }

    this.isCycleActive = this.isTickActive;

    function refreshIOHooks()
    {
        if(typeof(speaker._ioRefreshHooks)=="function")
            speaker._ioRefreshHooks();
    }

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
                refreshIOHooks();

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
                refreshIOHooks();

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

    this.tick = function(n)
    {
        // Defensive guard for stand-alone use; Apple2IO normally removes this
        // callback from its precomputed tick list while audio is muted.
        if(!this.enabled) return;
        var m = n % this.tickCycle;

        if(m == 0)
        {
            // Count attempts beyond this processing frame instead of silently
            // discarding the evidence. Playback remains bounded to the block.
            if(this.pos <= 0)
            {
                frameExcessSamples++;
                return;
            }

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

    this.cycle = function()
    {
        if(!this.enabled || !this.audio || !this.gain) return;
        
        if(bDebug && cnt == 1)
        {
            var s = "";
            for(var i in data_i)
                s += i + " x" + data_i[i] + "  ";
            //console.log(s);
            data_i = {};
        }

        cnt = (cnt % 10) + 1;

        recordFrameWallTime();
        recordSampleBalance(this.pos,frameExcessSamples);
        frameExcessSamples = 0;

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

        var queueBefore_ms = (this.nextStartTime - now) * 1000;
        recordQueueLead(queueBefore_ms);

        if(this.nextStartTime < now)
        {
            var late_ms = (now - this.nextStartTime) * 1000;
            diagnostics.lastLate_ms = late_ms;
            diagnostics.worstLate_ms = Math.max(diagnostics.worstLate_ms,late_ms);
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
        diagnostics.queueLead_ms = queuedLead_ms;
        recordQueueLead(queuedLead_ms);
        if(queuedLead_ms < this.timing.minLead_ms)
            this.timing.minLead_ms = queuedLead_ms;

        this.activeSources.push(src);

        src.onended = () =>
        {
            try { src.disconnect(); } catch(e) {}
            this.activeSources = this.activeSources.filter(function(x) { return x !== src; });
        };
    };

    this.getDiagnostics = function()
    {
        var avgInterval = diagnostics.frameIntervalCount>0
            ? diagnostics.frameIntervalSum_ms/diagnostics.frameIntervalCount
            : null;
        var mode = typeof(oApple2Video)!="undefined" && oApple2Video
            ? String(oApple2Video.frameTiming || "timer")
            : "timer";
        var frame_ms = frameRate>0 ? 1000/frameRate : null;

        return {
             mode:mode
            ,targetFrameRate:frameRate
            ,measuredFrameRate:diagnostics.measuredFrameRate
            ,frameCount:diagnostics.frameCount
            ,frameIntervalLast_ms:finiteOrNull(diagnostics.frameIntervalLast_ms)
            ,frameIntervalAverage_ms:finiteOrNull(avgInterval)
            ,frameIntervalMin_ms:finiteOrNull(diagnostics.frameIntervalMin_ms)
            ,frameIntervalMax_ms:finiteOrNull(diagnostics.frameIntervalMax_ms)
            ,internalSampleRate:samplerate
            ,audioContextSampleRate:this.audio ? Number(this.audio.sampleRate) : null
            ,expectedSamples:data.length
            ,generatedSamples:data.length-diagnostics.lastMissingSamples+diagnostics.lastExcessSamples
            ,lastMissingSamples:diagnostics.lastMissingSamples
            ,lastExcessSamples:diagnostics.lastExcessSamples
            ,lastSampleDelta:diagnostics.lastSampleDelta
            ,minSampleDelta:diagnostics.minSampleDelta
            ,maxSampleDelta:diagnostics.maxSampleDelta
            ,cumulativeMissingSamples:diagnostics.cumulativeMissingSamples
            ,cumulativeExcessSamples:diagnostics.cumulativeExcessSamples
            ,sampleOverrunFrames:diagnostics.sampleOverrunFrames
            ,queueLead_ms:finiteOrNull(diagnostics.queueLead_ms)
            ,queueLeadMin_ms:finiteOrNull(diagnostics.queueLeadMin_ms)
            ,queueLeadMax_ms:finiteOrNull(diagnostics.queueLeadMax_ms)
            ,queueLeadFrames:
                Number.isFinite(diagnostics.queueLead_ms) && frame_ms>0
                    ? diagnostics.queueLead_ms/frame_ms
                    : null
            ,underruns:this.timing.underruns
            ,lastLate_ms:diagnostics.lastLate_ms
            ,worstLate_ms:diagnostics.worstLate_ms
            ,queueLeadConfigured_ms:this.timing.queueLead_ms
            ,playbackRate_ppm:this.timing.playbackRate_ppm
            ,overlap_ms:this.timing.overlap_ms
            ,contextState:this.audio ? String(this.audio.state) : "unavailable"
            ,activeSources:this.activeSources.length
            ,cpuPacePercent:diagnostics.cpuPacePercent
        };
    };

    this.resetDiagnostics = function()
    {
        diagnostics = emptyDiagnostics();
        frameExcessSamples = 0;
        this.timing.underruns = 0;
        this.timing.minLead_ms = 999999;
        return this.getDiagnostics();
    };

    this.monitoring = function()
    {
        var now = typeof(performance)!="undefined" && typeof(performance.now)=="function"
            ? performance.now()
            : null;
        var ticks = cpuClockTicks();

        if(Number.isFinite(now))
        {
            if(diagnostics.monitorLastWall_ms!==null && now>diagnostics.monitorLastWall_ms)
            {
                var elapsed_ms = now-diagnostics.monitorLastWall_ms;
                var frames = diagnostics.frameCount-diagnostics.monitorLastFrameCount;
                diagnostics.measuredFrameRate = frames*1000/elapsed_ms;

                if(Number.isFinite(ticks)
                && Number.isFinite(diagnostics.monitorLastCpuTicks)
                && Number(_o.CPU_TargetTicks_s)>0)
                {
                    diagnostics.cpuPacePercent =
                        100*(ticks-diagnostics.monitorLastCpuTicks)*1000
                        /(elapsed_ms*Number(_o.CPU_TargetTicks_s));
                }
            }

            diagnostics.monitorLastWall_ms = now;
            diagnostics.monitorLastFrameCount = diagnostics.frameCount;
            diagnostics.monitorLastCpuTicks = Number.isFinite(ticks) ? ticks : null;
        }

        var d=this.getDiagnostics();
        monitorElement("speaker_mode",String(d.mode).toUpperCase());
        monitorElement("speaker_frame_fps",formatNumber(d.measuredFrameRate,1," fps"));
        monitorElement("speaker_frame_target",formatNumber(d.targetFrameRate,1," fps"));
        monitorElement("speaker_frame_interval",
            formatNumber(d.frameIntervalAverage_ms,1,"")+" / "+
            formatNumber(d.frameIntervalMax_ms,1," ms"));
        monitorElement("speaker_sample_rate",Math.round(d.internalSampleRate)+" Hz");
        monitorElement("speaker_context_rate",
            Number.isFinite(d.audioContextSampleRate)
                ? Math.round(d.audioContextSampleRate)+" Hz"
                : "—");
        monitorElement("speaker_samples_frame",
            d.generatedSamples+" / "+d.expectedSamples);
        monitorElement("speaker_sample_delta",
            (d.lastSampleDelta>0 ? "+" : "")+d.lastSampleDelta+
            "  ["+(d.minSampleDelta===null ? "—" : d.minSampleDelta)+
            " / "+(d.maxSampleDelta===null ? "—" : (d.maxSampleDelta>0 ? "+" : "")+d.maxSampleDelta)+"]");
        monitorElement("speaker_sample_totals",
            "-"+d.cumulativeMissingSamples+" / +"+d.cumulativeExcessSamples);
        monitorElement("speaker_queue_lead",formatNumber(d.queueLead_ms,1," ms"));
        monitorElement("speaker_queue_range",
            formatNumber(d.queueLeadMin_ms,1,"")+" / "+
            formatNumber(d.queueLeadMax_ms,1," ms"));
        monitorElement("speaker_queued_frames",formatNumber(d.queueLeadFrames,2,""));
        monitorElement("speaker_underruns",String(d.underruns));
        monitorElement("speaker_late",
            formatNumber(d.lastLate_ms,1,"")+" / "+
            formatNumber(d.worstLate_ms,1," ms"));
        monitorElement("speaker_overruns",String(d.sampleOverrunFrames));
        monitorElement("speaker_cpu_pace",formatNumber(d.cpuPacePercent,1," %"));
        monitorElement("speaker_context_state",d.contextState);
        monitorElement("speaker_sources",String(d.activeSources));
        return d;
    };

    this.toggleMonitoring = function(force)
    {
        if(!ensureMonitorRefreshEvent()) return false;

        var active;
        if(force===undefined && typeof(oCOM.toggleRefreshEvent)=="function")
            active=!!oCOM.toggleRefreshEvent(monitorEventName);
        else if(typeof(oCOM.enableRefreshEvent)=="function")
            active=!!oCOM.enableRefreshEvent(monitorEventName,!!force);
        else
        {
            oCOM.RefreshEvent_arr[monitorEventName].active=!!force;
            active=!!force;
        }

        if(typeof(document)!="undefined" && document.getElementById)
        {
            var icon=document.getElementById(monitorEventName);
            if(icon && icon.classList)
            {
                if(active)
                {
                    icon.classList.remove("fa-sync-alt");
                    icon.classList.add("fa-stop-circle");
                }
                else
                {
                    icon.classList.remove("fa-stop-circle");
                    icon.classList.add("fa-sync-alt");
                }
            }
        }

        if(active) this.monitoring();
        return active;
    };

    this.ctrl_dlg = function()
    {
        ensureMonitorRefreshEvent();
        var active=!!(typeof(oCOM)!="undefined" && oCOM.RefreshEvent_arr
            && oCOM.RefreshEvent_arr[monitorEventName]
            && oCOM.RefreshEvent_arr[monitorEventName].active);
        var syncClass=active ? "fa-stop-circle" : "fa-sync-alt";

        return ""
            +"<div style=\"font-family:Arial;font-size:11px;\">"
            +"<div style=\"display:flex;align-items:center;gap:6px;margin-bottom:8px;\">"
            +"<button class=\"appbut\" type=\"button\" title=\"Speaker diagnostics sync\" "
            +"onclick=\"oEMU.component.IO.AppleSpeaker.toggleMonitoring();event.stopPropagation();\">"
            +"<i class=\"fa "+syncClass+"\" id=\"A2SPK_monitoring\"></i></button>"
            +"<button class=\"appbut\" type=\"button\" title=\"Reset speaker diagnostic counters\" "
            +"onclick=\"oEMU.component.IO.AppleSpeaker.resetDiagnostics();oEMU.component.IO.AppleSpeaker.monitoring();event.stopPropagation();\">"
            +"<i class=\"fa fa-undo\"></i>&nbsp;Reset</button>"
            +"</div>"
            +"<table style=\"width:100%;border-collapse:collapse;font:11px monospace;\">"
            +"<tr><td>MODE</td><td id=\"speaker_mode\">—</td></tr>"
            +"<tr><td>FRAME measured</td><td id=\"speaker_frame_fps\">—</td></tr>"
            +"<tr><td>FRAME target</td><td id=\"speaker_frame_target\">—</td></tr>"
            +"<tr><td>INTERVAL avg / max</td><td id=\"speaker_frame_interval\">—</td></tr>"
            +"<tr><td>SAMPLE RATE</td><td id=\"speaker_sample_rate\">—</td></tr>"
            +"<tr><td>AUDIO CONTEXT</td><td id=\"speaker_context_rate\">—</td></tr>"
            +"<tr><td>SAMPLES frame</td><td id=\"speaker_samples_frame\">—</td></tr>"
            +"<tr><td>SAMPLE Δ [min/max]</td><td id=\"speaker_sample_delta\">—</td></tr>"
            +"<tr><td>MISSING / EXCESS total</td><td id=\"speaker_sample_totals\">—</td></tr>"
            +"<tr><td>QUEUE LEAD</td><td id=\"speaker_queue_lead\">—</td></tr>"
            +"<tr><td>QUEUE min / max</td><td id=\"speaker_queue_range\">—</td></tr>"
            +"<tr><td>QUEUED FRAMES</td><td id=\"speaker_queued_frames\">—</td></tr>"
            +"<tr><td>UNDERRUNS</td><td id=\"speaker_underruns\">—</td></tr>"
            +"<tr><td>LATE last / worst</td><td id=\"speaker_late\">—</td></tr>"
            +"<tr><td>OVERRUN FRAMES</td><td id=\"speaker_overruns\">—</td></tr>"
            +"<tr><td>CPU PACE</td><td id=\"speaker_cpu_pace\">—</td></tr>"
            +"<tr><td>CONTEXT</td><td id=\"speaker_context_state\">—</td></tr>"
            +"<tr><td>SOURCES</td><td id=\"speaker_sources\">—</td></tr>"
            +"</table>"
            +"<div style=\"margin-top:8px;line-height:1.35;\">"
            +"Sample Δ is excess minus missing samples at each emulator sound frame. "
            +"Negative queue minimum plus rising underruns identifies scheduler starvation."
            +"</div>"
            +"</div>";
    };

    // Backward-compatible alias for the stand-alone speaker tester.
    this.play = this.cycle;

}

