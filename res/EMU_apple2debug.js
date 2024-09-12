//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/AppleII-IDE/main/LICENSE.md
//
// apple2debug.js

if(oEMU===undefined) var oEMU = {"component":{"CPU":{"Apple2Debug":new Apple2Debug()}}}
else oEMU.component.CPU.Apple2Debug = new Apple2Debug();

function Apple2Debug()
{
    var prev_adr = -1000;

    /*
    this.cycle = function(obj)
    {
        //var el = document.getElementById( oEMU.component.CPU.Apple2Debug.disp_id );
        var watch = obj.cpu.watch();
        var jmp_adr = watch.pc - prev_adr;
        el.innerHTML = this.listing(watch);
        prev_adr = watch.pc;
    }
    */

    this.cycle = function(obj)
    {
        //var el = document.getElementById( oEMU.component.CPU.Apple2Debug.disp_id );
        var watch = obj.cpu.watch();
        var jmp_adr = watch.pc - prev_adr;
        if(prev_adr==-1000) jmp_adr = watch.pc; // TODO: can we do better than just -1000 to indicate start position?

        //document.getElementById("debug").value = oCOM.getHexWord(watch.pc);

        oTextScroll1.move(jmp_adr);
        prev_adr = watch.pc;
    }

    

    this.play = function(bPlay)
    {
        if(bPlay)
        {
            _o._EMU_Updates_s = _o.EMU_Updates_s;               // push previous value
            _o._EMU_IntervalTime_ms = _o.EMU_IntervalTime_ms;   // push previous value

            _o.EMU_Updates_s = 1;
            _o.EMU_IntervalTime_ms = 500;
            oEMUI.cpuSpd(1 / _o.CPU_ClocksTicks_s);
        }
        else
        {
            _o.EMU_Updates_s = _o._EMU_Updates_s;               // pop previous value
            _o.EMU_IntervalTime_ms = _o._EMU_IntervalTime_ms;   // pop previous value

            delete _o._EMU_Updates_s;
            delete _o._EMU_IntervalTime_ms;
            oEMUI.cpuSpd(0);
        }
    }

    this.listing = function(watch)
    {
        var lines = 20;
        var s = Array(lines);
        
        for(var line=0;line<lines;line++)
        {
            var ln = oCOM.getHexWord(watch.pc-(lines>>1)+line) + " "
            if(line == (lines>>1)) ln = "<font color=#800000>"+ln+"</font>"
            s[line] = ln;
        }
        return s.join("<br>");
    }

        // CPU REAL-TIME DEBUGGER
    this.scrollFeed = function(curPos,linLen,cfg)  // callback function to feed data based on cursor position and line count
    {
        var arr=new Array(linLen);
        for(var i=linLen-1;i>=0;i--)        //  inverse loop for performance 
        {
            var ci = curPos+i;
            if(ci < cfg.min)  ci += cfg.max - cfg.min + 1;   // fix underflow
            if(ci > cfg.max)  ci += cfg.min - cfg.max - 1;   // fix overflow
            arr[i] = oCOM.getHexWord(ci);
        }
        return arr;
    }

}