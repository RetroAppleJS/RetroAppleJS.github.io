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

// appledisk2.js

function AppleDisk2() {

    var MOTOR_OFF =     0x08,
        MOTOR_ON =      0x09,
        DRV0EN =        0x0a,
        DRV1EN =        0x0b,
        Q6L =           0x0c,
        Q6H =           0x0d,
        Q7L =           0x0e,
        Q7H =           0x0f;
    var TRACK_SIZE =    6656;

    var track = 20, phase = 0, data_latch = 0;
    var motor = 0, drv1 = 0, q6 = 0, q7 = 0;
    var offset = 0;

    this.diskBytes = null;
    this.bHidden = false;

    this.reset = function() {
        phase = 0;
        motor = 0;
        drv1 = 0;
        offset = 0;
        q6 = 0;
        q7 = 0;
    }

    this.hide = function()
    {
        //this.bHidden = true;
        document.getElementById("dskLED1").style.visibility = "hidden"; 
    }

    //this.show = function()
    //{
    //    this.bHidden = false;
        //this.update();
    //}

    this.update = function()
    {
        if(_o.EMU_keyb_active) return;
        

        // FVD - we have only drive 0 here, TODO mount drive 1 and action the LED
        //if(_o.EMU_keyb_timer) 
        //{ 
        //    document.getElementById("dskLED1").style.visibility = "hidden"; 
        //    return
        //}

        if(motor==1) { document.getElementById("dskLED1").style.visibility = "visible"; }
        else document.getElementById("dskLED1").style.visibility = "hidden";
    }

    this.read = function(addr) {
        // console.log("AppleDisk2: read %s", addr.toString(16));

        if (addr < 0x08) {
            // Stepper motor on.
            if ((addr & 1) != 0) {
                var p = ((addr >> 1) & 3); // phase we're turning on.

                if (((phase + 1) & 3) == p) {
                    // Ascending order, track arm moves inward.
                    phase = p;
                    if ((phase & 1) == 0) {
                        if (++track >= 35)
                            track = 35;
                    }
                }
                else if (((phase - 1) & 3) == p) {
                    // Descending order, track arm moves outward.
                    phase = p;
                    if ((phase & 1) == 0) {
                        if (--track < 0)
                            track = 0; // CLICK! CLICK! CLICK!
                    }
                }
            }
        }
        else {
            switch (addr) {
            case MOTOR_OFF:
                motor = 0;
                this.update()
                break;
            case MOTOR_ON:
                motor = 1;
                this.update()
                break;
            case DRV0EN:
                drv1 = 0;
                break;
            case DRV1EN:
                drv1 = 1;
                break;
            case Q6L:
                q6 = 0;
                // Strobe Data Latch for I/O
                if (!this.diskBytes || !motor || drv1)
                    return 0xff;
                else {
                    if (++offset == TRACK_SIZE)
                        offset = 0;
                    if (q7) {
                        // Write to disk.  Sortof works!
                        this.diskBytes[track * TRACK_SIZE + offset] =
                            data_latch;
                        return data_latch; // ???
                    }
                    else
                        // Read from disk.
                        return this.diskBytes[track * TRACK_SIZE + offset];
                }
                // NOTREACHED
            case Q6H:
                // Load data latch.  Also sense write-protect but defaults
                // to zero below anyway.
                q6 = 1;
                break;
            case Q7L:
                // Prepare latch for input.
                q7 = 0;
                break;
            case Q7H:
                // Prepare latch for output.
                q7 = 1;
                break;
            }
        }

        return 0x00;
    } // read

    this.write = function(addr, d8) {
        // console.log("AppleDisk2: write %s %s", addr.toString(16),
        //            d8.toString(16));
        if (addr == Q6H)
            data_latch = d8;
    }
}
