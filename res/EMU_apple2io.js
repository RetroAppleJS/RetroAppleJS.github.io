//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Adapted in 2022 by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// apple2io.js


function Apple2IO(vid) {

    const ROM_ADDR =      0xD000;
    const ROM_SIZE =      0x4000;


    // Slot I/O addresses
    const SLOT_IO =    [0x80,
                        0x90,
                        0xA0,
                        0xB0,
                        0xC0,
                        0xD0, 
                        0xE0,
                        0xF0];
    const SLT_IO_SIZE = 0x10;

    // Slot RAM/ROM spaces
    const SLOT_PROM =  [null,   // SLOT0_PROM does not exist
                        0x100,
                        0x200,
                        0x300,
                        0x400,
                        0x500,
                        0x600,
                        0x700];
    const SLT_PROM_SIZE = 0x100;     

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
        ANALOG_CLR =    0x70;

    // MAP DISK I/O TO SLOT#6 MEMORY
    var DISK_IO =       SLOT_IO[6],
        DISK_IO_SIZE =  SLT_IO_SIZE,
        DISK_PROM =     SLOT_PROM[6],
        DISK_PROM_SIZE = SLT_PROM_SIZE;
 
    // MAP RAMCARD I/O TO SLOT#0 MEMORY
    var MEM_RAMCARD_IO =  SLOT_IO[0],
        MEM_RAMCARD_IO_SIZE =  SLT_IO_SIZE;

    var video = vid;
    var key = 0x00;

    // disk and ramcard objects are created here
    if(typeof(AppleDisk2)!="undefined") this.disk2 = new AppleDisk2();
    if(typeof(RamCard)!="undefined") this.ramcard = new RamCard();
 
    this.reset = function() {
        key = 0x00;
        this.disk2.reset();
    }
    
    this.read = function(addr)
    {
        if (addr >= KEY_DATA && addr < KEY_DATA + 0x10)
            return key;
        else if (addr >= KEY_STROBE && addr < KEY_STROBE + 0x10)
            key &= 0x7f;
        else if (addr >= DISK_IO && addr < DISK_IO + DISK_IO_SIZE)
        {
            var o = this.disk2.read(addr - DISK_IO);
            return o;
        }
        else if (this.disk2.diskBytes && addr >= DISK_PROM &&
                 addr < DISK_PROM + DISK_PROM_SIZE)
            return disk2Rom[addr - DISK_PROM];
        else if(this.ramcard.active  // RAMCARD SOFT SWITCHES
            && addr >= MEM_RAMCARD_IO && addr < MEM_RAMCARD_IO + MEM_RAMCARD_IO_SIZE)
            return this.ramcard.soft_switch(addr - MEM_RAMCARD_IO);
        else if(this.ramcard.active &&
            addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)
            return this.ramcard.read(addr - ROM_ADDR);
        else
            switch(addr)
            {
            case SPKR_TOGGLE:
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

    this.write = function(addr, d8)
    {
        if (addr >= DISK_IO && addr < DISK_IO + DISK_IO_SIZE)
            this.disk2.write(addr - DISK_IO, d8);
        else if(this.ramcard.active &&
            addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)
            return this.ramcard.write(addr - ROM_ADDR,d8)
        
        // Implement same side-effects as read.
        this.read(addr);
    }

    this.cycle = function() {
    }

    this.keypress = function(code) {
        key = code;
    }

    this.loadDisk = function(bytes,drv) {
        //this.disk2.loadDisk(bytes,drv);
        alert("AppleDisk2() does not have a method called loadDisk")
    }
}
