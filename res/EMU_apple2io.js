//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Adapted in 2022 by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// apple2io.js

if(oEMU===undefined) var oEMU = {"component":{"IO":new Apple2IO()}}
//else oEMU.component.IO = new Apple2IO();

function Apple2IO(vid)
{

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
    const SLOT_PROM =  [0,   // SLOT0_PROM does not exist
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
    var MEM_RAMCARD_IO =  SLOT_IO[0], MEM_RAMCARD_IO_SIZE =  SLT_IO_SIZE;

    // MAP 80 COLUMN CARD I/O TO SLOT#3 MEMORY
    var MEM_COL80CARD_IO =  SLOT_IO[3], MEM_COL80CARD_IO_SIZE =  SLT_IO_SIZE;
    
    var video = vid;
    var key = 0x00;
    
    if(typeof(oEMU.component.IO)!="undefined")
    {
        var snd = oCOM.default(oEMU.component.IO.AppleSpeaker,{toggle:function(){}},"AppleSpeaker");
        this.ramcard = oCOM.default(oEMU.component.IO.RamCard,{active:false},"RamCard");
        this.col80card = oCOM.default(oEMU.component.IO.col80card,{active:false},"col80card");
        this.disk2 = oCOM.default(oEMU.component.IO.AppleDisk,{reset:function(){},diskBytes:[]},"AppleDisk");
    }

    this.reset = function()
    {
        key = 0x00;
        this.disk2.reset();
    }

    function line_decode(adr)
    {
        return adr<256 ? adr & 0xF0 : (adr & 0xFF00); // line decoder on IO & PROM addressing
    }

    this.read = function(addr)
    {
        var line = line_decode(addr);
        
        switch(line)
        {
            case 0xA545:  // DISKII

            case 0xE0: return this.disk2.read(addr - DISK_IO);
            case 0x600:
                if(this.disk2.diskBytes[this.disk2.drv])
                    return this.disk2.ROM[addr - DISK_PROM];
            break;

            default:

                if (addr >= KEY_DATA && addr < KEY_DATA + 0x10)
                    return key;
                else if (addr >= KEY_STROBE && addr < KEY_STROBE + 0x10)
                    key &= 0x7f;
                /*
                else if (addr >= DISK_IO && addr < DISK_IO + DISK_IO_SIZE)
                {
                    console.log(oCOM.getHexWord(line))
                    var o = this.disk2.read(addr - DISK_IO);
                    return o;
                }
                else if (this.disk2.diskBytes[this.disk2.drv] && addr >= DISK_PROM &&
                        addr < DISK_PROM + DISK_PROM_SIZE)
                {
                    //59 & 5A
                    console.log(oCOM.getHexWord(line))
                    return this.disk2.ROM[addr - DISK_PROM];
                }
                */
                else if(this.ramcard.active  // RAMCARD SOFT SWITCHES
                    && addr >= MEM_RAMCARD_IO && addr < MEM_RAMCARD_IO + MEM_RAMCARD_IO_SIZE)
                    return this.ramcard.soft_switch(addr - MEM_RAMCARD_IO);
                else if(this.ramcard.active &&
                    addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)
                    return this.ramcard.read(addr - ROM_ADDR);
                else if(this.col80card.active &&
                    addr >= MEM_COL80CARD_IO && addr < MEM_COL80CARD_IO + ROM_SIZE)
                    {
                        // TODO: read ROM from 80-column card !!
                        //alert("80_COL $"+oCOM.getHexWord(addr));
                    }
                else
                    switch(addr)
                    {
                    case SPKR_TOGGLE:
                        snd.toggle();
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

    this.cycle = function() {}

    this.keypress = function(code)
    {
        key = code;
        //alert(key)
    }

    this.loadDisk = function(bytes,drv)
    {
        //this.disk2.loadDisk(bytes,drv);
        alert("AppleDisk2() does not have a method called loadDisk")
    }

    this.mount = function(name,slot_num,device_obj,active)
    {   
        SLOT_NAME[slot_num] = name.substring(0,4);
        const idx = slot_num<<3; 
        const noROM = device_obj===undefined ? true : device_obj.ROM===undefined;

        //var keys = Object.keys(_CFG_PCODE);
        //var key_idx =  keys.indexOf(name);

        SLOT_MAP[idx]   = active ? 0x2 : 0x1;                               // STATUS 0x2=active  0x1=inactive 0x0=unmounted   
        SLOT_MAP[idx+1] = oCOM.crc16(new TextEncoder("utf-8").encode(name)) // DETERMINE DEVICE ID (CRC16 hash) 

        SLOT_MAP[idx+2] = SLOT_IO[slot_num];                                // SLOT I/O range origin
        SLOT_MAP[idx+3] = SLOT_IO[slot_num] + SLT_IO_SIZE;                  //          range end
        SLOT_MAP[idx+4] = noROM?0:SLOT_PROM[slot_num];                      // SLOT ROM range origin
        SLOT_MAP[idx+5] = noROM?0:SLOT_PROM[slot_num] + SLT_PROM_SIZE;      //          range end



        //console.log("SLOT_MAP["+slot_num+"] = "+SLOT_MAP[idx]+" "+SLOT_MAP[idx+1]+" "+SLOT_MAP[idx+2]+" "+SLOT_MAP[idx+3]+" "+SLOT_MAP[idx+4])
    }

    this.unmount = function(name,slot_num)
    {
        SLOT_NAME[slot_num] = null;
        const idx = slot_num<<3;
        SLOT_MAP[idx]   = 0;
        SLOT_MAP[idx+1] = 0;
        SLOT_MAP[idx+2] = 0;
        SLOT_MAP[idx+3] = 0;
        SLOT_MAP[idx+4] = 0;
    }

    // SLOT MAPPING
    var SLOT_MAP = new Uint16Array(8<<3);   // SLOT ADDRESS MAPPING
    var SLOT_NAME = new Array(8<<2);       // 4 CHARACTERS PER SLOT NAME

    // SLOT MAPPING
    this.mount("DISKII",6,this.disk2,true);
}
