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

// apple2io.js
//
// The hard part: modelling apple 2 hardware.

function Apple2IO(vid) {
    const SLOT0_IO =      0x80,
        SLOT1_IO =      0x90,
        SLOT2_IO =      0xA0,
        SLOT3_IO =      0xB0,
        SLOT4_IO =      0xC0,
        SLOT5_IO =      0xD0, 
        SLOT6_IO =      0xE0,
        SLOT7_IO =      0xF0;
        SLOT_IO_SIZE =  0x10;     

    const KEY_DATA =    0x00,
        KEY_STROBE =    0x10,
        CASS_TOGGLE =   0x20,
        SPKR_TOGGLE =   0x30,
        UTIL_STROBE =   0x40,
        GFX_ON =        0x50,
        GFX_OFF =       0x51,
        GFX_MIX_OFF =   0x52,
        GFX_MIX_ON =    0x53,
        GFX_PAGE1 =     0x54,
        GFX_PAGE2 =     0x55,
        GFX_LORES =     0x56,
        GFX_HIRES =     0x57,
        CASS_IN =       0x60,
        FLAG_IN0 =      0x61,
        FLAG_IN1 =      0x62,
        FLAG_IN2 =      0x63,
        ANALOG_IN0 =    0x64,
        ANALOG_IN1 =    0x65,
        ANALOG_IN2 =    0x66,
        ANALOG_IN3 =    0x67,
        ANALOG_CLR =    0x70:

    // ASSIGN DISK TO SLOT#6
    var DISK_IO =       SLOT6_IO,
        DISK_IO_SIZE =  SLOT_IO_SIZE,
        DISK_PROM =     0x600,
        DISK_PROM_SIZE = 0x100;
 
    var video = vid;
    var key = 0x00;

    if(typeof(AppleDisk2)!="undefined")
        this.disk2 = new AppleDisk2();
 
    this.reset = function() {
        key = 0x00;
        this.disk2.reset();
    }
    
    this.read = function(addr) {
        if (addr >= KEY_DATA && addr < KEY_DATA + 0x10)
            return key;
        else if (addr >= KEY_STROBE && addr < KEY_STROBE + 0x10)
            key &= 0x7f;
        else if (addr >= DISK_IO && addr < DISK_IO + DISK_IO_SIZE)
            return this.disk2.read(addr - DISK_IO);
        else if (this.disk2.diskBytes && addr >= DISK_PROM &&
                 addr < DISK_PROM + DISK_PROM_SIZE)
            return disk2Rom[addr - DISK_PROM];
        else
            switch(addr) {
            case SPKR_TOGGLE:
                //_o.EMU_snd_toggle.pause();
                //_o.EMU_snd_toggle.play();
                toggle();
                break;
            case GFX_ON:
                video.setGfx(true);
                break;
            case GFX_OFF:
                video.setGfx(false);
                break;
            case GFX_MIX_OFF:
                video.setMix(false);
                break;
            case GFX_MIX_ON:
                video.setMix(true);
                break;
            case GFX_PAGE1:
                video.setPage2(false);
                break;
            case GFX_PAGE2:
                video.setPage2(true);
                break;
            case GFX_LORES:
                video.setHires(false);
                break;
            case GFX_HIRES:
                video.setHires(true);
                break;
            }

        return 0x00;
    }

    this.write = function(addr, d8) {
        if (addr >= DISK_IO && addr < DISK_IO + DISK_IO_SIZE)
            this.disk2.write(addr - DISK_IO, d8);

        // Implement same side-effects as read.
        this.read(addr);
    }

    this.cycle = function() {
    }

    this.keypress = function(code) {
        key = code;
    }

    this.loadDisk = function(bytes) {
        this.disk2.loadDisk(bytes);
    }
}
