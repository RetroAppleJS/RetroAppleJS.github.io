//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Adapted in 2022 by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// apple2plus.js

//const { getParent } = require("domutils");

function Apple2Plus(context) {
    var video = new Apple2Video(context);
    var hw = new Apple2Hw(video);
    var keys = new Apple2Keys(hw);   // Apple2plus keys ?  FVD TODO >> configure class here, as it is apple2plus specific !
    var cpu = new Cpu6502(hw);

    this.reset = function() {
        hw.reset();
        cpu.reset();
        video.reset();
    }

    this.restart = function() {
        hw.restart();
        this.reset();
    }

    this.cycle = function(n) {
        //var t = new Date();
        while (n-- > 0) {
            hw.cycle();
            video.cycle();
            cpu.cycle();
        }
        //document.getElementById("debug").value = new Date()-t;
    }

    this.keystroke = function(data)
    {
        if(data.type!="click")          // real keyboard or pasteboard ?
        {
            var code = keys.KeyCodeHandler(data);         
            if(data.keyCode == 32 && typeof(data.preventDefault)=="function")
                data.preventDefault(); // prevent space-bar from triggering page-down
        }
        else                            // virtual keyboard ?
            var code = keys.KbdCodeHandler(data);

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

    this.DiskObj = function() {
        return hw.io.disk2;
    }

    this.keysObj = function() {
        return keys;
    }

    this.loadDisk = function(bytes) {
        hw.io.disk2.diskBytes = bytes;
    }

    this.monitor = function(type) {
        return video.setMonitor(type);
    }

    this.restart();
}
