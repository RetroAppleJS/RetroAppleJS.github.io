//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/AppleII-IDE/main/LICENSE.md
//
// apple2debug.js

if(oEMU===undefined) var oEMU = {"component":{"CPU":{"Apple2Debug":new Apple2Debug()}}}
else oEMU.component.CPU.Apple2Debug = new Apple2Debug();

// TODO: move somewhere more appropriate


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

        oDASM_debug = new DASM();
        oDASM_debug.getHexByte = oCOM.getHexByte;
        oDASM_debug.sym_search = function(op,adm)
        {            
            // TODO SEARCH THROUGH watchparam
            var opd = parseInt(op.substring(1,op.length),16)
            switch(adm)
            {
                case "zpg":
                case "abs":
                case "rel":
                case "iny":
                case "inx":
                    var adr = asm.symlink[opd];  // watch parameter translation
                    if(typeof(adr)!="undefined") return adr+" <small>"+op+"h</small>"
                    var adr = asm.symlink[opd-1];  // watch parameter translation of address - 1
                    if(typeof(adr)!="undefined") return adr+"+1 <small>"+op+"h</small>"
                break;
            }
            return op;
            
        }
    }

    this.html = function(body_id,wrapper_id)
    {
        this.body_id = body_id;
        oCOM.POPUP.set_state(wrapper_id,true); // initialise POPUP state (prevent testing for undefined)
        return "<div class=appbox style='text-align:left;height:250px;width:300px;padding:0px 0px 0px 1px;margin:0px 0px 0px 0px'>"
                    +"<div class=marginless style='border:0px solid #E0E0E0'>"
                        +"STEP TRACE "
                        +"<i id=cpuDbg_play class='fa fa-play' title='continue CPU execution' onclick=this.arr={'fa-pause':false,'fa-play':true};oCOM.POPUP.toggle_class(this,'fa-pause','fa-play');oEMU.component.CPU.Apple2Debug.play(!this.arr[oCOM.POPUP.states[this.id]])></i>&nbsp;"
                        +"<i class='fa fa-sign-in-alt' title='step in'></i>&nbsp;"
                        +"<i class='fa fa-paw' title='step over'></i>&nbsp;"
                        +"<i class='fa fa-sign-out-alt' title='step out'></i>"
                        +"<div class=\"appbut\" onclick=\"oCOM.POPUP.toggle('"+wrapper_id+"');\" style=\"text-align:center;float:right;\">x</div>"
                        +"<div id='"+body_id+"' class=marginless style='width:299px;height:180px;border:0px solid #FFFFFF;font-family:Arcade;font-size:7px;color:#000000;white-space:normal;word-break:break-all;overflow-wrap:anywhere;overflow-y:scroll;'></div>"
                    +"</div>"
                +"</div>"

    }

    this.cycle = function(obj)
    {
        //var el = document.getElementById( oEMU.component.CPU.Apple2Debug.disp_id );
        var watch = obj.cpu.watch();
        var jmp_adr = watch.pc - prev_adr;

        // TODO check jump adr !  DO NOT MOVE SCROLL WHEN watch.pc is not pointing to an instruction !

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
        var adr = curPos;

        for(var i=0;i<linLen;i++)           //  inverse loop for performance 
        {
            var b8 = hw.safe_read(adr);
            var ret = oDASM_debug.disassemble({"code_arr":[b8,hw.safe_read(adr+1),hw.safe_read(adr+2)],"pc":adr,"opctab":cpu_config.opctab});
            adr += cpu_config.instrlen[b8];                  // advance to the next instruction
            if(adr < cfg.min)  adr += cfg.max - cfg.min + 1;   // fix underflow
            if(adr > cfg.max)  adr += cfg.min - cfg.max - 1;   // fix overflow

            arr[i] = oCOM.padding([ret.adr_lst,ret.opcode_lst,ret.mnemonic],[5,max_byte_lst]);
        }

        return arr;
    }

}