//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
// 1. Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY AUTHOR AND CONTRIBUTORS ``AS IS'' AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED.  IN NO EVENT SHALL AUTHOR OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
// OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
// HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
// LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
// OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
// SUCH DAMAGE.
//

// apple2plus.js

function Apple2Plus(context) {
    var video = new Apple2Video(context);
    var hw = new Apple2Hw(video);
    var keys = new Apple2Keys();
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
        while (n-- > 0) {
            hw.cycle();
            video.cycle();
            cpu.cycle();
        }
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

    this.loadDisk = function(bytes) {
        hw.io.disk2.diskBytes = bytes;
    }

    this.monitor = function(type) {
        video.setMonitor(type);
    }

    this.restart();
}
