//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Adapted in 2022 by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// apple2plus.js

if(oEMU===undefined) var oEMU = {"system":{"A2P":{"active":true}}};
oEMU.system["A2P"] = {/*  config overrides */  "active":true};

function Apple2Plus(context)
{
    if(context===undefined)
    {
        console.warn("running Apple2Plus without video or hardware context");
    }

    if(typeof(Apple2VideoMUX) == "function")
    {
        if(typeof(oApple2Video) == "undefined" || oApple2Video == null)
            oApple2Video = new Apple2VideoMUX(context);
        else
            oApple2Video.setCanvas(context);

        var video = oApple2Video;
    }
    else if(new Apple2Video().initGPU === undefined)
    {
        var vidContext = context.getContext("2d");
        var video = new Apple2Video(vidContext);
    }
    else
    {
        var vidContext = context;
        var video = new Apple2Video(vidContext);
    }

    this.hw = oCOM.default(new Apple2Hw(video),{},"Apple2Hw");       // Apple2plus owns Apple2Hw object instance
    video.hw = this.hw;
    const hw = this.hw

    function slotPeripheral(slotN,PCODE)
    {
        var peripheral = hw.io.SLOT2obj(slotN);
        return peripheral && peripheral.id?.PCODE == PCODE
            ? peripheral
            : null;
    }

    //var keys = oEMU.component.Keyboard;
    //var keys = oCOM.default(oEMU.component.Keyboard,{cycle:function(){}},"A2Pkeys");
    //var snd = oCOM.default(oEMU.component.IO.AppleSpeaker,{cycle:function(){},play:function(){}},"AppleSpeaker");
    //var disk2;

    if(typeof(COM_PopupHTML)=="undefined") var COM_PopupHTML = function() { console.log("COM_PopupHTML unavailable") }
    
    if(typeof(Cpu6502)=="undefined")
          { console.log("running Apple2Plus without CPU") }
    else var cpu  = new Cpu6502(this.hw);

    this.cpuObj = function()
    {
        return cpu;
    }

    this.reset = function()
    {
        this.hw.reset();
        cpu.reset();
        video.reset();
        system_tab_update();
    }

    this.restart = function()
    {
        this.onrestart();
        this.hw.restart();  // will restart I/O as well, which will mount all default peripherals
        this.reset();
        system_tab_update();
    }

    this.onrestart = function() {} // overridable

    this.CPU_monitoring = function() {}       // overridable by GUI update function
    this.CPU_pace_monitoring = function() {}  // overridable by GUI pace indicator

    var cpuPace = {};

    function cpuPaceTarget()
    {
        return typeof(_o)!="undefined" && Number.isFinite(_o.CPU_TargetTicks_s)
            ? Math.max(0,_o.CPU_TargetTicks_s)
            : 0;
    }

    function cpuPaceReset()
    {
        cpuPace.window_start_ms = performance.now();
        cpuPace.requested_ticks = 0;
        cpuPace.completed_ticks = 0;
        cpuPace.ratio = 1;
        cpuPace.wall_ratio = 1;
        cpuPace.actual_ticks_s = 0;
        cpuPace.target_ticks_s = cpuPaceTarget();
        cpuPace.achievable = true;
        cpuPace.fail_windows = 0;
        cpuPace.pass_windows = 0;
    }

    this.CPU_pace_reset = cpuPaceReset;

    function cpuPaceAccumulate(requestedTicks,completedTicks)
    {
        // Browser timer throttling in a background tab is not evidence that
        // the host CPU cannot sustain the selected foreground pace.
        if(typeof(document)!="undefined" && document.hidden)
        {
            cpuPaceReset();
            return;
        }

        cpuPace.requested_ticks += requestedTicks;
        cpuPace.completed_ticks += completedTicks;
    }

    this.CPU_pace_sample = function()
    {
        var now = performance.now();
        var elapsedMs = now-cpuPace.window_start_ms;
        var nominalWindowMs = typeof(_o)!="undefined"
            && Number.isFinite(_o.EMU_DashboardRefresh_s)
            && _o.EMU_DashboardRefresh_s>0
                ? 1000/_o.EMU_DashboardRefresh_s
                : 500;

        if(typeof(document)!="undefined" && document.hidden)
        {
            cpuPaceReset();
            return null;
        }

        // A long gap normally means that the tab or emulator was suspended.
        // Discard it rather than reporting a false host-capacity failure.
        if(!Number.isFinite(elapsedMs) || elapsedMs<=0
            || elapsedMs>nominalWindowMs*5)
        {
            cpuPaceReset();
            return null;
        }

        var targetTicks_s = cpuPaceTarget();
        var targetWallTicks = targetTicks_s*elapsedMs/1000;
        var completionRatio = cpuPace.requested_ticks>0
            ? cpuPace.completed_ticks/cpuPace.requested_ticks
            : 1;
        var wallRatio = targetWallTicks>0
            ? cpuPace.completed_ticks/targetWallTicks
            : 1;
        /*
         * Attainability is a processing-capacity question: did the emulator
         * finish the CPU ticks that were actually requested by the callbacks?
         *
         * wallRatio also includes browser timer delivery, rendering contention
         * and setInterval jitter. Using it for the red state makes every speed
         * fail by the same percentage whenever callbacks arrive slightly late,
         * even when the CPU loop completes every requested tick.
         *
         * Keep wallRatio as diagnostic information, but base the warning and
         * hysteresis on completionRatio.
         */
        var capacityRatio = Math.max(0,Math.min(1,completionRatio));
        wallRatio = Math.max(0,Math.min(1,wallRatio));

        if(!Number.isFinite(capacityRatio)) capacityRatio = 1;
        if(!Number.isFinite(wallRatio)) wallRatio = 1;

        cpuPace.ratio = capacityRatio;
        cpuPace.wall_ratio = wallRatio;
        cpuPace.actual_ticks_s = cpuPace.completed_ticks*1000/elapsedMs;
        cpuPace.target_ticks_s = targetTicks_s;

        // Hysteresis: two consecutive failing windows turn the indicator red;
        // two strong passing windows restore its normal appearance.
        if(targetTicks_s<=0)
        {
            cpuPace.achievable = true;
            cpuPace.fail_windows = 0;
            cpuPace.pass_windows = 0;
        }
        else if(cpuPace.achievable)
        {
            cpuPace.fail_windows = capacityRatio<0.95
                ? cpuPace.fail_windows+1
                : 0;

            if(cpuPace.fail_windows>=2)
            {
                cpuPace.achievable = false;
                cpuPace.pass_windows = 0;
            }
        }
        else
        {
            cpuPace.pass_windows = capacityRatio>=0.98
                ? cpuPace.pass_windows+1
                : 0;

            if(cpuPace.pass_windows>=2)
            {
                cpuPace.achievable = true;
                cpuPace.fail_windows = 0;
            }
        }

        var sample = {
             "ratio":cpuPace.ratio
            ,"wall_ratio":cpuPace.wall_ratio
            ,"actual_ticks_s":cpuPace.actual_ticks_s
            ,"target_ticks_s":cpuPace.target_ticks_s
            ,"achievable":cpuPace.achievable
        };

        cpuPace.window_start_ms = now;
        cpuPace.requested_ticks = 0;
        cpuPace.completed_ticks = 0;

        return sample;
    }

    this.CPU_pace_reset();
    cpuPaceReset();
    // TODO: move to DISK2
    this.DSK_monitoring = function(slotN)
    {
        var disk2 = this.DiskObj(slotN);
        if(!disk2) return false;

        var o = disk2.getState().hw;
        disk2.GUI_update(o);
        return true;
    }


    this.SND_monitoring = function()
    {
        // TODO show sound bars
    }

    var dashboard_refresh = function(args)
    {
        oEMU.component.CPU.dutycycle_time += Math.round(performance.now()-args.cpu_chrono);
        oEMU.component.CPU.dutycycle_idx++;
        if(oCOM.bRefreshEvent && oEMU.component.CPU.dutycycle_idx > oEMU.stats.EMU_DashboardRefresh_cy)
        {
            for(var _o in oCOM.RefreshEvent_arr)
                if(oCOM.RefreshEvent_arr[_o].active) oCOM.RefreshEvent_arr[_o].func();
            oEMU.component.CPU.dutycycle_time = oEMU.component.CPU.dutycycle_idx = 0;
        }
    }

    /*
     * Shared live CPU execution primitive.
     *
     * The normal SYSTEM scheduler and STEP TRACE instruction stepping both pass
     * through this exact loop.  Every completed 6502 tick is paired with one
     * Apple2IO tick, so mounted peripherals, timers, IRQ sources and the shared
     * I/O clock remain live while debugging.
     */
    function runCpuTicks(requestedTicks,deadline)
    {
        requestedTicks = Math.floor(Number(requestedTicks));
        if(!Number.isFinite(requestedTicks) || requestedTicks<0)
            requestedTicks = 0;

        var remainingTicks = requestedTicks;
        var completedTicks = 0;
        var trapped = false;
        var timeCheck = 4096;

        while(remainingTicks>0)
        {
            remainingTicks--;

            // A CPU execution trap stops at a clean instruction boundary before
            // opcode fetch and therefore consumes no emulated CPU tick.
            if(cpu.cycle()===true)
            {
                remainingTicks++;
                trapped = true;
                break;
            }

            /*
             * Use Apple2IO's monotonic clock as the tick callback phase when it
             * is available.  This makes device timing independent of how CPU
             * ticks are grouped into SYSTEM slices or debugger instructions.
             * Existing devices that ignore the argument are unaffected.
             */
            var tickPhase = hw.io && typeof(hw.io.getClockTicks)=="function"
                ? hw.io.getClockTicks()
                : remainingTicks;
            hw.io.tick(tickPhase);
            completedTicks++;

            if(deadline!==undefined && --timeCheck==0)
            {
                if(performance.now()>=deadline) break;
                timeCheck = 4096;
            }
        }

        return {
             "requestedTicks":requestedTicks
            ,"remainingTicks":remainingTicks
            ,"completedTicks":completedTicks
            ,"trapped":trapped
        };
    }

    function advanceVideo(completedTicks,scale)
    {
        if(completedTicks<=0 || !video || typeof(video.cycle)!="function") return;
        scale = Number(scale);
        if(!Number.isFinite(scale) || scale<=0) scale = 1;
        var videoTicks = completedTicks*scale;
        if(Number.isFinite(videoTicks) && videoTicks>0)
            video.cycle(videoTicks);
    }

    /*
     * Execute one complete live instruction-boundary event without finalising
     * video/device-cycle processing.  The caller can batch several instructions
     * and finalise once, which is important for 100/1000 IPS STEP TRACE modes.
     */
    function executeLiveInstruction()
    {
        var ticks = 0;
        var guard = 0;
        var result;

        // The SYSTEM timer may have been paused in the middle of an instruction
        // after the opcode/semantic tick but before cycle_delay reached zero.
        while(cpu.watch().cycle_delay>0 && guard++<64)
        {
            result = runCpuTicks(1);
            ticks += result.completedTicks;
            if(result.completedTicks===0) break;
        }

        var before = cpu.watch();
        var startPC = before.pc & 0xffff;

        guard = 0;
        result = runCpuTicks(1);
        ticks += result.completedTicks;

        if(result.completedTicks>0)
        {
            while(cpu.watch().cycle_delay>0 && guard++<64)
            {
                result = runCpuTicks(1);
                ticks += result.completedTicks;
                if(result.completedTicks===0) break;
            }
        }

        var after = cpu.watch();
        return {
             "startPC":startPC
            ,"endPC":after.pc & 0xffff
            ,"ticks":ticks
            ,"state":after
            ,"stalled":ticks===0
        };
    }

    // Public low-level live execution helper for debugger/tools.
    this.runLiveCpuTicks = function(n,options)
    {
        options = options || {};
        var result = runCpuTicks(n,options.deadline);
        advanceVideo(result.completedTicks,options.videoScale===undefined ? 1 : options.videoScale);
        if(options.deviceCycle!==false && hw.io && typeof(hw.io.cycle)=="function")
            hw.io.cycle();
        return result;
    }

    // Execute exactly one live instruction-boundary event.
    this.stepLiveInstruction = function()
    {
        var result = executeLiveInstruction();
        advanceVideo(result.ticks,1);
        if(hw.io && typeof(hw.io.cycle)=="function") hw.io.cycle();
        return result;
    }

    // Batch instruction stepping while preserving every executed PC edge for
    // the live debugger's boundary map. Video/device-cycle work is finalised
    // only once per batch. A caller may optionally request an early return when
    // execution crosses into or out of one address region; this lets a realtime
    // debugger expose short ROM excursions without reducing its normal batch size.
    this.runLiveInstructionBatch = function(count,options)
    {
        options = options || {};
        count = Math.max(1,Number(count)|0);
        var edges = [];
        var totalTicks = 0;
        var last = null;
        var stoppedForRegion = false;
        var stoppedForBoundaryCallback = false;
        var boundaryCallback = typeof(options.onInstructionBoundary)==="function"
            ? options.onInstructionBoundary
            : null;

        var stopRange = Array.isArray(options.stopOnRegionChange)
            ? options.stopOnRegionChange
            : null;
        var regionFrom = stopRange && stopRange.length>=2
            ? (Number(stopRange[0]) & 0xffff)
            : null;
        var regionTo = stopRange && stopRange.length>=2
            ? (Number(stopRange[1]) & 0xffff)
            : null;
        var regionEnabled = regionFrom!==null && regionTo!==null && regionFrom<=regionTo;
        var startedInsideRegion = regionEnabled
            ? ((cpu.watch().pc & 0xffff)>=regionFrom && (cpu.watch().pc & 0xffff)<=regionTo)
            : false;

        for(var i=0;i<count;i++)
        {
            var one = executeLiveInstruction();
            last = one;
            if(one.ticks<=0) break;
            totalTicks += one.ticks;
            edges.push([one.startPC,one.endPC]);

            // Optional debugger/tool observer. Returning true stops this batch
            // *after* the current complete instruction boundary. The instruction
            // itself is never skipped and all normal CPU/I/O/video work remains
            // part of this live execution path.
            if(boundaryCallback && boundaryCallback(one,edges.length)===true)
            {
                stoppedForBoundaryCallback = true;
                break;
            }

            if(regionEnabled)
            {
                var endedInsideRegion = one.endPC>=regionFrom && one.endPC<=regionTo;
                if(endedInsideRegion!==startedInsideRegion)
                {
                    stoppedForRegion = true;
                    break;
                }
            }
        }

        advanceVideo(totalTicks,1);
        if(hw.io && typeof(hw.io.cycle)=="function") hw.io.cycle();

        return {
             "instructions":edges.length
            ,"ticks":totalTicks
            ,"edges":edges
            ,"state":last ? last.state : cpu.watch()
            ,"stalled":edges.length===0
            ,"stoppedForRegion":stoppedForRegion
            ,"stoppedForBoundaryCallback":stoppedForBoundaryCallback
        };
    }

    this.cycle = function(n)
    {
        var args = {"cpu_chrono":performance.now()};
        var requestedTicks = Math.floor(Number(n));
        if(!Number.isFinite(requestedTicks) || requestedTicks<0)
            requestedTicks = 0;

        // Turbo targets can exceed the host's capacity by many orders of
        // magnitude. Keep each interval cooperative and discard the part of
        // the requested burst that cannot fit into its wall-clock budget.
        var maxSliceMs = typeof(_o)!="undefined"
            && Number.isFinite(_o.EMU_IntervalTime_ms)
            ? Math.max(1,_o.EMU_IntervalTime_ms*0.8)
            : Infinity;
        var deadline = args.cpu_chrono+maxSliceMs;

        var run = runCpuTicks(requestedTicks,deadline);
        var completedTicks = run.completedTicks;

        /*
         * Video timing is advanced once per processing slice, not once per CPU
         * clock. The value passed to video.cycle() is expressed in base-speed
         * equivalent ticks:
         *
         *     completed CPU ticks * base clock / selected target clock
         */
        if(completedTicks>0)
        {
            var baseTicks_s = Number(_o.CPU_ClocksTicks_s);
            var targetTicks_s = Number(_o.CPU_TargetTicks_s);
            var videoScale = baseTicks_s>0 && targetTicks_s>0
                ? baseTicks_s/targetTicks_s
                : 1;
            advanceVideo(completedTicks,videoScale);
        }

        var debug = oEMU.component.CPU.Apple2Debug;
        var debugPopup = typeof(document)!="undefined"
            ? document.getElementById("cpuDbg_popup")
            : null;

        if(debugPopup && debugPopup.hidden===false
            && debug && typeof(debug.cycle)=="function")
            debug.cycle({"cpu":cpu});

        // Processing-cycle hooks remain once per SYSTEM slice, exactly as before.
        hw.io.cycle();
        cpuPaceAccumulate(requestedTicks,completedTicks);

        // display dashboard parameters
        if(oCOM.bRefreshEvent)
            dashboard_refresh(args);
    }

    this.DiskObj = function(slotN)
    {
        return slotPeripheral(slotN,"DISKII");
    }

    this.keysObj = function() {
        return this.hw.io.DCODE2obj("A2KBD","A2BO")[0];
    }

    this.hwObj = function() {
        return this.hw;
    }

    this.vidObj = function() {
        return video;
    }

    // TODO: move this to EMU_CARD_appledisk2.js
    this.loadDisk = function(bytes,drive,slotN) 
    {
        var disk2 = this.DiskObj(slotN);
        if(!disk2) return false;

        var device = this.hw.io.deviceID2obj(drive,slotN);
        if(!device || device.periID!="DISKII") return false;

        disk2.getState().diskData[device.deviceN] = bytes;
        return true;
    }  

    // TODO: move this to EMU_CARD_appledisk2.js
    this.dumpDisk = function(drive,slotN)
    {
        var disk2 = this.DiskObj(slotN);
        if(!disk2) return false;

        var device = this.hw.io.deviceID2obj(drive,slotN);
        if(!device || device.periID!="DISKII") return false;

        disk2.dump(device.deviceN);

        return true;
    }

    this.monitor = function(type) {
        return video.setMonitor(type);
    }

}