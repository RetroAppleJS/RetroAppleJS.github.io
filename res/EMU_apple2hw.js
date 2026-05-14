//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Adapted in 2022 by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// apple2hw.js   (Apple II Hardware)

/*
Hardware layer specs:
- is directly called by EMU_cpu6502.js (read/write)
- ingests the full address bus, and defines the address space for RAM, I/O and ROM
- can only access RAM, I/O object and ROM
- has to be aware of the Apple model (making EMU-apple2plus.js obsolete)
*/


//if(oEMU===undefined) var oEMU = {"component":{"Hardware":new Apple2Hw()}}
//else oEMU.component.Hardware = new Apple2Hw();

function Apple2Hw(vid,keys)
{
    this.action = 
    { 
         "RD":{"encode":function(idx) { return (idx & 0xF) << 12},"callback": function(addr)    { return ram[addr]} }
        ,"WR":{"decode":function(addr){ return addr >> 12 },      "callback": function(addr,d8) { ram[addr] = d8 & 0xFF} }
    }

    // mask + array
    //this.action.RD.encode = [this.io.read(addr)]
    //this.action.RD.decode = function(addr){ return addr >> 12; }

    var RAM_SIZE =      0xc000,
        LORES_ADDR =    0x0400,
        LORES_SIZE =    0x0800, // both pages
        HIRES_ADDR =    0x2000,
        HIRES_SIZE =    0x4000, // both pages
        IO_ADDR =       0xc000,
        IO_SIZE =       0x0800,
        ROM_ADDR =      0xd000,
        ROM_SIZE =      0x4000;

    var ram = new Uint8Array(RAM_SIZE);      // DECLARE RAM SPACE
    var video = vid;                        
    this.io = new Apple2IO(video);
    this.keys = keys;

    this.irq_signal = 0;        // unused
    this.nmi_signal = 0;

    this.reset = function()
    {
        this.io.reset();

    }

    this.restart = function()
    {
        // Randomize memory.  Don't do on reset!
        for (var i = 0; i < RAM_SIZE; i++)
            ram[i] = Math.floor(Math.random() * 256.0);
        
        // build memory map
        //this.build_mem_map();
        //this.memscan();
        
        
                // 4096 offsets of 16 bytes
                // 16 granularities 

                // GENERAL
                // 000C 

                // I/O     C00 4 = Offset $C00<<8=$C000 and 1<<8=256 bytes granularity (8 entries)
                    // Hostio  C00 0 = Offset $C00<<8=$C000 and (0) 1<<0=1   byte  granularity (128 entries) 1<<7(3bits)
                    // SlotIO  C08 4 = Offset $C08<<8=$C080 and (4) 1<<4=16  bytes granularity (8 entries)   1<<3
                    // SlotROM C10 8 = Offset $C08<<8=$C080 and (8) 1<<8=256 bytes granularity (7 entries)

                // HostROM C10 8 = Offset $C08<<8=$C800 and (8) 1<<8=256 bytes granularity (8 entries)
                // RAMCARD D00 C = Offset $D00<<8=$D000 and (C) 1<<12=4K bytes granularity (4 entries)



    }

    this.cycle = function()
    {
        this.io.cycle();  // perform I/O operations outside I/O range (like ramcard memory mapping)
        //this.bMEM_monitoring = oCOM.RefreshEvent_arr.MEM_monitoring.active;
    }

    this.mem_mon = {};
    this.bMEM_monitoring = false;

    this.read = function(addr)
    {
        var d8;
        addr = addr & 0xFFFF;

        if(this.io.ramcard && this.io.ramcard.state.active == true && addr >= ROM_ADDR)        // range $D000-$FFFF
            d8 = this.io.read(addr);
        else if (addr < RAM_SIZE) // range $0000-$BFFF
            d8 = ram[addr];
        else if (addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)    // range $D000-$FFFF
            d8 = apple2Rom[addr - ROM_ADDR];
        else if (addr & 0xF000 ^ 0xC000 == 0) // range $C000-$CFFF
            d8 = this.io.read(addr - IO_ADDR);
        else
            d8 = 0x55;
     
        return d8;
    }

    this.safe_read = function(addr)
    {
        var d8;
        addr = addr & 0xFFFF;

        if(this.io.ramcard && this.io.ramcard.state.active == true && addr >= ROM_ADDR)
            d8 = this.io.read(addr);
        else if (addr < RAM_SIZE)
            d8 = ram[addr];
        else if (addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)
            d8 = apple2Rom[addr - ROM_ADDR];
        //else if (addr >= IO_ADDR && addr < IO_ADDR + IO_SIZE)
        //    d8 = this.io.read(addr - IO_ADDR);
        else
            d8 = 0xFF;
     
        return d8;
    }

    this.safe_flashdump = function()
    {
        return new Uint8Array(ram);
    }

    this.write = function(addr, d8)
    {
        if (d8 < 0 || d8 > 0xff)
            console.error("apple2hw.write(%s %s) d8 too big!",
                        addr.toString(16), d8.toString(16));

        if(this.io.ramcard &&  this.io.ramcard.state.active == true && addr >= ROM_ADDR)
            d8 = this.io.write(addr,d8);
        else if (addr < RAM_SIZE)
        {
            ram[addr] = d8;

            // If it falls within the video regions, let the
            // video object know.
            if ((addr >= LORES_ADDR && addr < LORES_ADDR + LORES_SIZE) ||
                (addr >= HIRES_ADDR && addr < HIRES_ADDR + HIRES_SIZE))
                video.write(addr, d8);
        }
        else if (addr & 0xF000 ^ 0xC000 == 0)  //(addr >= IO_ADDR && addr < IO_ADDR + IO_SIZE)
            this.io.write(addr - IO_ADDR, d8);

        if( this.bMEM_monitoring && addr < RAM_SIZE )
            this.mem_mon[ addr>>oMEMGRID.mem_gran ] = true;     // update memory monitoring grid  
    }

    // Link memory to Video
    video.vidram = ram;
}
