//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Adapted in 2022 by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// apple2hw.js   (Apple II Hardware)

//if(oEMU===undefined) var oEMU = {"component":{"Hardware":new Apple2Hw()}}
//else oEMU.component.Hardware = new Apple2Hw();

// HARDWARE IS ACCESSING:
// 1) RAM & VIDEO RAM
<<<<<<< HEAD
// 2) I/O (--> relative address starting from $C000)
=======
// 2) I/O (--> relative address starting from $D000)
>>>>>>> 4b780537ea44c2bfb36a93cde6dc8a3625552b77
// 3) ROM (--> relative address starting from $D000)

function Apple2Hw(vid,keys)
{
    var hw = this;
    this.lineDecode = function(addr) {return addr >> 12; };
    this.lineEncode = function(idx) {return (idx & 0xF) << 12; };
    this.RD = [];
    this.WR = [];

    var video = vid;                        
    this.io = new Apple2IO(video);
<<<<<<< HEAD
    this.children   = {}


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

=======
>>>>>>> 4b780537ea44c2bfb36a93cde6dc8a3625552b77

    this.irq_signal = 0;        // unused
    this.nmi_signal = 0;

    this.reset = function()
    {
        this.io.reset();
    }

    this.restart = function()
    {
        // Randomize memory.  Don't do on reset!
        for (var i = 0; i < RAM_SIZE; i++) ram[i] = Math.floor(Math.random() * 256.0);
        this.RD = this.mount().RD;
        this.WR = this.mount().WR;

        // build memory map
        //this.build_mem_map();
        //this.memscan();
    }

    this.mount = function()
    {
        return {
        "RD":
        [
            function(addr) { return ram[addr]; },                  // $0000 - $0FFF
            function(addr) { return hw._read(addr); },              // $1000 - $1FFF
            function(addr) { return hw._read(addr); },              // $2000 - $2FFF
            function(addr) { return hw._read(addr); },              // $3000 - $3FFF
            function(addr) { return hw._read(addr); },              // $4000 - $4FFF
            function(addr) { return hw._read(addr); },              // $5000 - $5FFF
            function(addr) { return ram[addr]; },                  // $6000 - $6FFF
            function(addr) { return ram[addr]; },                  // $7000 - $7FFF
            function(addr) { return ram[addr]; },                  // $8000 - $8FFF
            function(addr) { return ram[addr]; },                  // $9000 - $9FFF
            function(addr) { return ram[addr]; },                  // $A000 - $AFFF
            function(addr) { return ram[addr]; },                  // $B000 - $BFFF
            function(addr) { return hw.io.read(addr - IO_ADDR); }, // $C000 - $CFFF
            function(addr) { return hw._read(addr); },              // $D000 - $DFFF
            function(addr) { return hw._read(addr); },              // $E000 - $EFFF
            function(addr) { return hw._read(addr); }               // $F000 - $FFFF
        ]
        ,"WR":
        [
            function(addr,d8) { ram[addr] = d8; hw.mon(addr); },              // $0000 - $0FFF
            function(addr,d8) { hw.write(addr,d8); },           // $1000 - $1FFF
            function(addr,d8) { hw.write(addr,d8); },           // $2000 - $2FFF
            function(addr,d8) { hw.write(addr,d8); },           // $3000 - $3FFF
            function(addr,d8) { hw.write(addr,d8); },           // $4000 - $4FFF
            function(addr,d8) { hw.write(addr,d8); },           // $5000 - $5FFF
            function(addr,d8) { ram[addr] = d8; },              // $6000 - $6FFF
            function(addr,d8) { ram[addr] = d8; },              // $7000 - $7FFF
            function(addr,d8) { ram[addr] = d8; },              // $8000 - $8FFF
            function(addr,d8) { ram[addr] = d8; },              // $9000 - $9FFF
            function(addr,d8) { ram[addr] = d8; },              // $A000 - $AFFF
            function(addr,d8) { ram[addr] = d8; },              // $B000 - $BFFF
            function(addr,d8) { hw.io.write(addr - IO_ADDR); }, // $C000 - $CFFF
            function(addr,d8) { hw.write(addr,d8); },           // $D000 - $DFFF
            function(addr,d8) { hw.write(addr,d8); },           // $E000 - $EFFF
            function(addr,d8) { hw.write(addr,d8); }            // $F000 - $FFFF
        ]};
    }

    this.cycle = function()
    {
        this.io.cycle();
        //this.bMEM_monitoring = oCOM.RefreshEvent_arr.MEM_monitoring.active;
    }

    this.mem_mon = {};
    this.bMEM_monitoring = false;

    this.read = function(addr)
    {
        var d8;
        addr = addr & 0xFFFF;

        if(this.io.ramcard && this.io.ramcard.state.active == true && addr >= ROM_ADDR)
            d8 = this.io.read(addr);
        else if (addr < RAM_SIZE) // RAM_SIZE
            d8 = ram[addr];
        else if (addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)
            d8 = apple2Rom[addr - ROM_ADDR];
        else if (addr & 0xF000 ^ 0xC000 == 0) //(addr >= IO_ADDR && addr < IO_ADDR + IO_SIZE)
            d8 = this.io.read(addr - IO_ADDR);
        else
            d8 = 0x55;
     
        return d8;
    }

    this._read = function(addr)
    {
        var d8;
        addr = addr & 0xFFFF;

        if(this.io.ramcard && this.io.ramcard.state.active == true && addr >= ROM_ADDR)
            d8 = this.io.read(addr);
        else if (addr < RAM_SIZE) // RAM_SIZE
            d8 = ram[addr];
        else if (addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)
            d8 = apple2Rom[addr - ROM_ADDR];
        else if (addr & 0xF000 ^ 0xC000 == 0) //(addr >= IO_ADDR && addr < IO_ADDR + IO_SIZE)
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
        if (d8 < 0 || d8 > 0xff) console.error("apple2hw.write(%s %s) d8 too big!",addr.toString(16), d8.toString(16));

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

    this.mon = function(addr)
    {
        if( this.bMEM_monitoring && addr < RAM_SIZE )
            this.mem_mon[ addr>>oMEMGRID.mem_gran ] = true;     // update memory monitoring grid 
    }

    function write(addr, d8)
    {
        ram[addr] = d8;
        video.write(addr, d8);
    }

















    // Link memory to Video
    video.vidram = ram;
}
