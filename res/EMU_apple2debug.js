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
    var cpu_config=null,max_instrlen,byte_scan,max_byte_lst;

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

    function init(cfg)
    {
        cpu_config = oEMU.component.CPU["6502"].getConfig();
        max_instrlen = Math.max.apply(null, cpu_config.instrlen);
        byte_scan = cfg.HScroll * max_instrlen    // because we can have only a max of 3 bytes per line
        max_byte_lst = 3 * max_instrlen;          // maximum length of byte listing = (2 digits + space) * x 
        //alert(max_instrlen);
    }

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

    /*
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
    */

    // CPU REAL-TIME DEBUGGER
    this.scrollFeed = function(curPos,linLen,cfg)  // callback function to feed data based on cursor position and line count
    {
        if(cpu_config==null) init(cfg);
        var arr=new Array(linLen);
        var hw = apple2plus.hwObj();
        const spc = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
        var adr = curPos;

        var adr_lst    = oCOM.getHexWord(adr) + " ";
        var byte_lst   = "";
        var opcode_lst = "LDA $6000";
        
        for(var i=0;i<linLen;i++)        //  inverse loop for performance 
        {
            var b8  = hw.safe_read(adr++);           // ALWAYS ASSUME address at curPos is an instruction
            var ilen  = cpu_config.instrlen[b8];
            switch(ilen)
            {
                case 1: byte_lst = oCOM.getHexByte(b8) + " ";
                        break;
                case 2: byte_lst = oCOM.getHexByte(b8) + " " + oCOM.getHexByte(hw.safe_read(adr++)) + " ";
                        break;
                case 3: byte_lst = oCOM.getHexByte(b8) + " " + oCOM.getHexByte(hw.safe_read(adr++)) + " " + oCOM.getHexByte(hw.safe_read(adr++));
                        break;
            }

            if(adr < cfg.min)  adr += cfg.max - cfg.min + 1;   // fix underflow
            if(adr > cfg.max)  adr += cfg.min - cfg.max - 1;   // fix overflow

            arr[i] = adr_lst + " " + byte_lst + spc.slice(0,(max_byte_lst-byte_lst.length)*6) + opcode_lst;
            
        }
        return arr;
    }
}