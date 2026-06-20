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
    
    //var keys = oEMU.component.Keyboard;
    var keys = oCOM.default(oEMU.component.Keyboard,{cycle:function(){}},"A2Pkeys");
    var snd = oCOM.default(oEMU.component.IO.AppleSpeaker,{cycle:function(){},play:function(){}},"AppleSpeaker");
    var disk2;

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

    this.CPU_monitoring = function() {}  // overridable by GUI update function


    // TODO: move to DISK2
    this.DSK_monitoring = function()
    {
        var disk2 = apple2plus.hwObj().io.PCODE2obj("DISKII")[0];
        var o = disk2.getState().hw;
        disk2.GUI_update(o);
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

    this.cycle = function(n)
    {
        var args = {"cpu_chrono":performance.now()};
        while (n-- > 0) {
            //hw.cycle();
            video.cycle();
            cpu.cycle();
            snd.cycle(n);
        }
        // TODO optimise speed!!!!!!!
        if(!oCOM.POPUP.states["cpuDbg_popup"]) // only cycles if POPUP ≠ hidden
            oEMU.component.CPU.Apple2Debug.cycle({"cpu":cpu});
        snd.play();
        keys.cycle(this);

        // display dashboard parameters
        if(oCOM.bRefreshEvent)
            dashboard_refresh(args);
    }

    this.DiskObj = function() // TODO: deprecated -> phase out
    {
        return this.hw.io.PCODE2obj("DISKII")[0];
    }

    this.keysObj = function() {
        return keys;
    }

    this.hwObj = function() {
        return this.hw;
    }

    this.vidObj = function() {
        return video;
    }

    // TODO: move this to EMU_appledisk2.js
    this.loadDisk = function(bytes,drive) 
    {
        var drv = Number(drive.slice(1))-1;
        var disk2 = this.hwObj().io.PCODE2obj("DISKII")[0];
        disk2.getState().diskData[ drv ] = bytes;
    }  

    // TODO: move this to EMU_appledisk2.js
    this.dumpDisk = function(drive) {
        var drv = Number(drive.slice(1))-1;
        var disk2 = this.PCODE2obj("DISKII")[0];
        disk2.dump(drv);
    }

    this.monitor = function(type) {
        return video.setMonitor(type);
    }

}