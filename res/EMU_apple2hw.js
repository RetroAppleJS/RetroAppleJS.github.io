//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Adapted in 2022 by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// apple2hw.js   (Apple II Hardware)

function Apple2Hw(vid,keys) {
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

    this.reset = function() {
        this.io.reset();
    }

    this.restart = function() {
        // Randomize memory.  Don't do on reset!
        for (var i = 0; i < RAM_SIZE; i++)
            ram[i] = Math.floor(Math.random() * 256.0);
        
        // build memory map
        //this.build_mem_map();
        //this.memscan();
    }

    this.cycle = function() {
        this.io.cycle();
        //this.bMEM_monitoring = oCOM.RefreshEvent_arr.MEM_monitoring.active;
    }

    this.mem_mon = {};
    this.bMEM_monitoring = false;

    this.read = function(addr)
    {
        var d8;
        addr = addr & 0xFFFF;

            if(this.io.ramcard && this.io.ramcard.active == true && addr >= ROM_ADDR)
                d8 = this.io.read(addr);
            else if (addr < RAM_SIZE)
                d8 = ram[addr];
            else if (addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)
                d8 = apple2Rom[addr - ROM_ADDR];
            else if (addr >= IO_ADDR && addr < IO_ADDR + IO_SIZE)
                d8 = this.io.read(addr - IO_ADDR);
            else
                d8 = 0x55;
     
        return d8;
    }

    this.safe_read = function(addr)
    {
        var d8;
        addr = addr & 0xFFFF;

            if(this.io.ramcard && this.io.ramcard.active == true && addr >= ROM_ADDR)
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
            console.err("apple2hw.write(%s %s) d8 too big!",
                        addr.toString(16), d8.toString(16));

        if(this.io.ramcard &&  this.io.ramcard.active == true && addr >= ROM_ADDR)
            d8 = this.io.write(addr,d8);
        else if (addr < RAM_SIZE) {
            ram[addr] = d8;

            // If it falls within the video regions, let the
            // video object know.
            if ((addr >= LORES_ADDR && addr < LORES_ADDR + LORES_SIZE) ||
                (addr >= HIRES_ADDR && addr < HIRES_ADDR + HIRES_SIZE))
                video.write(addr, d8);
        }
        else if (addr >= IO_ADDR && addr < IO_ADDR + IO_SIZE)
            this.io.write(addr - IO_ADDR, d8);

        if( this.bMEM_monitoring )
            this.mem_mon[ addr>>oMEMGRID.mem_gran ] = true;     // update memory monitoring grid  
    }

    // Give Video a reference to memory.
    video.vidram = ram;

    //this.restart();  // FVD not sure if I may remove this, but could trigger double restart unintentionally
}
