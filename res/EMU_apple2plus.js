//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Adapted in 2022 by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// apple2plus.js

if(oEMU===undefined) var oEMU = {"system":{"A2P":{}}};
oEMU.system["A2P"] = {/*  config overrides */};

function Apple2Plus(context)
{
    if(context===undefined)
    { console.log("running Apple2Plus without video or hardware context") }
    else
    {
        var video = new Apple2Video(context);
        var hw   = new Apple2Hw(video);
        var snd  = oEMU.component.IO.AppleSpeaker;
        var keys = oEMU.component.Keyboard;

            // override keys object
    keys.keystroke = function(data)
    {
        if(this.isActive()==false) return; 
        if(data.type!="click")          // real keyboard or pasteboard ?
        {
            var code = this.KeyCodeHandler(data);         
            if(data.keyCode == 32 && typeof(data.preventDefault)=="function")
                data.preventDefault(); // prevent space-bar from triggering page-down
        }
        else                            // virtual keyboard ?
            var code = this.KbdCodeHandler(data);

        if(typeof(code)=="number")       // ASCII keys ?
            hw.io.keypress(code);
        else if (typeof(code)=="string") // HARD-WIRED keys ?
        {
            switch(code)
            {
                case "RESET":
                    //beep();
                    resetButton();
                break;
                case "POWER":
                    //beep();
                    restartButton();
                break;
                case "REPT":
                    alert("Instead of REPT, keep key down >0.5s");
                    //o["key_rept"].style.top = y+"px";
                    //o["key_rept"].style.left = (x-36)+"px";
                    //o["key_rept"].style.visibility = "visible";
                break;
                default:
                    alert("no function defined on key '"+code+"'");
            }
        }
        else
            alert("no key");
    }
    }

    if(typeof(COM_PopupHTML)=="undefined") var COM_PopupHTML = function() { console.log("COM_PopupHTML unavailable") }

    
    /*
    var keys = typeof(A2Pkeys)=="undefined" ? {
        keystroke:function(){alert("missing A2Pkeys -> keystroke()")}
       ,KbdHover:function(){COM_PopupHTML("missing A2Pkeys -> KbdHover()",3)}
       ,KbdHTML:function(){COM_PopupHTML("missing A2Pkeys -> KbdHTML()",3)}
          } : new A2Pkeys(hw);
    */

    if(typeof(Cpu6502)=="undefined")
          { console.log("running Apple2Plus without CPU") }
    else var cpu  = new Cpu6502(hw);

    /*
    keys.KbdHTML({id:"kbd",path:"res/"
                ,kbd_events:"onmousemove=apple2plus.keysObj().KbdHover(event);apple2plus.DiskObj().hide('D1');apple2plus.DiskObj().hide('D2') onmouseout=apple2plus.keysObj().KbdHover(event)"
                ,key_events:"onclick=apple2plus.keysObj().keystroke(event)"});
    */

    this.reset = function()
    {
        hw.reset();
        cpu.reset();
        video.reset();
        system_tab_update();
    }

    this.restart = function()
    {
        hw.restart();
        this.reset();
        system_tab_update();
    }

    this.CPU_monitoring = function()
    {
        document.getElementById("cpu_pct").value = Math.round(oEMU.component.CPU.dutycycle_time / oEMU.stats.EMU_DashboardRefresh_cy / _o.EMU_IntervalTime_ms *100) + "%"
    }

    this.MEM_monitoring = function()
    {
        oMEMGRID.paint_grid();                      // clear memory map
        //var s = "";
        for(var i=0;i<(1<<oMEMGRID.mem_gran);i++)   // draw memory map
        {
            if(hw.mem_mon[i]) 
            {
                var id = oCOM.getHexByte(i);
                el = document.getElementById( oMEMGRID.conf_grid.id_prefix + id + "00" );
                el.style.backgroundColor = "#FFFFFF";
                //s+= id+"00<br>"
            }
        }
        //COM_PopupHTML(s);
        //document.getElementById('COM_popup_text').innerHTML = s;

        hw.mem_mon = {}
    }

    this.enable_MEM_monitoring = function(b)
    {
        hw.bMEM_monitoring = b;
    }

    this.DSK_monitoring = function()
    {
        var o = oEMU.component.IO.AppleDisk.getDataObj();
        oEMU.component.IO.AppleDisk.update(o);

        //var d2 = hw.io.disk2;
        // TODO activate some leds
    }

    this.SND_monitoring = function()
    {
        // show sound bars

        /*
        var d2 = hw.io.disk2;
        if(d2.o[0].motor==1)
        {
            // BROWSERS DO NOT MANAGE TO LOOP SOUNDS !!
        }
        */
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

    this.cycle = function(n) {
        var args = {"cpu_chrono":performance.now()};
        while (n-- > 0) {
            hw.cycle();
            video.cycle();
            cpu.cycle();
            snd.cycle(n);
        }
        snd.play();

        keys.cycle(this);

        // display dashboard parameters
        if(oCOM.bRefreshEvent)
            dashboard_refresh(args);
    }

    /*
    this.attachKeyboard = function(bEnable)
    {
        if(bEnable) window.onkeypress  = this.keystroke;
        else window.onkeypress  = null;
    }
    */

    this.DiskObj = function() {
        return hw.io.disk2;
    }

    this.keysObj = function() {
        return keys;
    }

    this.hwObj = function() {
        return hw;
    }

    this.loadDisk = function(bytes,drive) {
        var drv = Number(drive.slice(1))-1;
        hw.io.disk2.diskBytes[ drv ] = bytes;
    }  

    this.dumpDisk = function(drive) {
        var drv = Number(drive.slice(1))-1;
        hw.io.disk2.dump(drv);
    }

    this.monitor = function(type) {
        return video.setMonitor(type);
    }

    if(typeof(hw)!="undefined")
        this.restart(); // restart the AppleII+

    this.mem_layout = {
        "0000-00FF":["#D0D0D0","ZERO-PAGE","ZP"]
       ,"0100-01FF":["#D0D0D0","STACK","ST"]
       ,"0200-02FF":["#00D000","GETLN buffer","BU"]
       ,"0300-03FF":["#00D000","VECTORS","VC"]
       ,"0400-07FF":["#D000D0","TXT1/LORES1","T1"]
       ,"0800-0BFF":["#D000D0","TXT2/LORES2","T2"]
       ,"0C00-1FFF":["#00D000","APPLESOFT PRG","AP"]
       ,"2000-3FFF":["#0000D0","HIRES1","H1"]
       ,"4000-5FFF":["#0000D0","HIRES2","H2"]
       ,"6000-BFFF":["rgba(0,0,0,0.1)","FREE","F"]
       ,"C000-C07F":["#D0D000","I/O","IB"]
       ,"C080-C0FF":["#D0D000","SLOT I/O","IO"]
       ,"C100-C1FF":["#D0D000","SLOT 1 ROM","S1"]
       ,"C200-C2FF":["#D0D000","SLOT 2 ROM","S2"]
       ,"C300-C3FF":["#D0D000","SLOT 3 ROM","S3"]
       ,"C400-C4FF":["#D0D000","SLOT 4 ROM","S4"]
       ,"C500-C5FF":["#D0D000","SLOT 5 ROM","S5"]
       ,"C600-C6FF":["#D0D000","SLOT 6 ROM","S6"]
       ,"C700-C7FF":["#D0D000","SLOT 7 ROM","S7"]
       ,"C800-CFFF":["#D0D000","SLOT ROM ext","SR"]
       ,"D000-FFFF":["#D00000","MONITOR ROM","AR"]       
    }

    // type 0=ref  1=jump 2=sub 3=soft/sw
    this.mem_sym = {
        0xC000:[0,"IOADR"],
        0x00:[0,"LOC0"],
        0x01:[0,"LOC1"],
        0x20:[0,"WNDLFT"],
        0x21:[0,"WNDWDTH"],
        0x22:[0,"WNDTOP"],
        0x23:[0,"WNDBTM"],
        0x24:[0,"CH"],
        0x25:[0,"CV"],
        0x26:[0,"GBASL"],
        0x27:[0,"GBASH"],
        0x28:[0,"BASL"],
        0x29:[0,"BASH"],
        0x2A:[0,"BAS2L"],
        0x2B:[0,"BAS2H"],
        0x30:[0,"COLOR"],
        0x31:[0,"MODE"],
        0x32:[0,"INVFLG"],
        0x33:[0,"PROMPT"],
        0x34:[0,"YSAV"],
        0x35:[0,"YSAV1"],
        0x36:[0,"CSWL"],
        0x38:[0,"KSWL"],
        0x3A:[0,"PCL"],
        0x3B:[0,"PCH"],
        0x3C:[0,"A1L"],
        0x3D:[0,"A1H"],
        0x3E:[0,"A2L"],
        0x3F:[0,"A2H"],
        0x40:[0,"A3L"],
        0x41:[0,"A3H"],
        0x42:[0,"A4L"],
        0x43:[0,"A4H"],
        0x44:[0,"A5L"],
        0x45:[0,"A5H"],
        0x45:[0,"ACC"],
        0x46:[0,"XREG"],
        0x47:[0,"YREG"],
        0x48:[0,"STATUS"],
        0x49:[0,"SPNT"],
        0x4E:[0,"RNDL"],
        0x4F:[0,"RNDH"],
        0x200:[0,"IN"],
        0x3F0:[0,"BRKV","nEw vECtor For BRK"],
        0x3F2:[0,"SOFTEV","vECtor For wArm stArt"],
        0x3F4:[0,"PWREDUP","this must = EOR #A5 oF SOFTEV+1"],
        0x3F8:[0,"USRADR"]
    }
/*



//0200  {ADDr/256}
//03F0  {ADDr/2} ;nEw vECtor For BRK
//03F2  {ADDr/2} ;vECtor For wArm stArt
//03F4           ;this must = EOR #A5 oF SOFTEV+1
03F8  {ADDr/3}
03FB  {ADDr/3}
03FE  {ADDr/2}
0400  {ADDr/40}
07F8
C000           ;R lAst kEy prEssED + 128
C010           ;RW kEyBoArD stroBE
C020           ;RW togglE CAsEEttE tApE output
C030           ;RW togglE spEAkEr
C050           ;RW DisplAy grAphiCs
C051           ;RW DisplAy tExt
C053           ;RW DisplAy split sCrEEn
C054           ;RW DisplAy pAgE 1
C056           ;RW DisplAy lo-rEs grAphiCs
C058           ;RW AnnunCiAtor 0 oFF
C05A           ;RW AnnunCiAtor 1 oFF
C05D           ;RW AnnunCiAtor 2 on
C05F           ;RW AnnunCiAtor 3 on
C060
C064           ;R AnAlog input 0
C070           ;RW AnAlog input rEsEt
CFFF           ;DisABlE slot C8 ROM
E000
E003
*/

}