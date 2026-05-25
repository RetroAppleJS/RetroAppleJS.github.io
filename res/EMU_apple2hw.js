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
// 2) I/O (--> relative address starting from $C000)
// 3) ROM (--> relative address starting from $D000)

function Apple2Hw(vid,keys)
{
    var hw = this;

    var bDebug_mon = false;      // debug RAM Write monitor
    
    this.lineDecode = function(addr) {return addr >> 12; };
    this.RD = [];
    this.WR = [];
    this.default_map = null;
    

    var video = vid;                        
    this.io = new Apple2IO(video);      // HARDWARE OBJECT OWNS IO (always call 'io' methods via hardware)
    this.children   = {}

    var RAM_SIZE =  0xc000,
    LORES_ADDR =    0x0400,
    LORES_SIZE =    0x0800, // both pages
    HIRES_ADDR =    0x2000,
    HIRES_SIZE =    0x4000, // both pages
    IO_ADDR =       0xc000,
    IO_SIZE =       0x0800,
    ROM_ADDR =      0xd000,
    ROM_SIZE =      0x4000;

    /////////////////////////////////////////////////////////////////
    var ram = new Uint8Array(RAM_SIZE);      // HARDWARE RAM SPACE //
    /////////////////////////////////////////////////////////////////

    this.irq_signal = 0;        // can be used in the future (currently unused)
    this.nmi_signal = 0;

    this.mem_mon = {};
    this.mem_mon_trigger = {};
    this.bMEM_monitoring = false;
    

    this.reset = function()
    {
        hw.io.reset();
    }

    this.restart = function()
    {
        for (var i = 0; i < RAM_SIZE; i++)
            ram[i] = Math.floor(Math.random() * 256.0);
        this.mount();
        hw.io.restart();
    };

    this.build_mount = function()
    {
        return {
            "RD":
            [
                function(addr) { return ram[addr]; },                  // $0000 - $0FFF
                function(addr) { return hw.read(addr); },              // $1000 - $1FFF
                function(addr) { return hw.read(addr); },              // $2000 - $2FFF
                function(addr) { return hw.read(addr); },              // $3000 - $3FFF
                function(addr) { return hw.read(addr); },              // $4000 - $4FFF
                function(addr) { return hw.read(addr); },              // $5000 - $5FFF
                function(addr) { return ram[addr]; },                  // $6000 - $6FFF
                function(addr) { return ram[addr]; },                  // $7000 - $7FFF
                function(addr) { return ram[addr]; },                  // $8000 - $8FFF
                function(addr) { return ram[addr]; },                  // $9000 - $9FFF
                function(addr) { return ram[addr]; },                  // $A000 - $AFFF
                function(addr) { return ram[addr]; },                  // $B000 - $BFFF
                function(addr) { return hw.io.read(addr - IO_ADDR); }, // $C000 - $CFFF

                // Default ROM, not RAMCARD.
                function(addr) { return apple2Rom[addr - ROM_ADDR]; }, // $D000 - $DFFF
                function(addr) { return apple2Rom[addr - ROM_ADDR]; }, // $E000 - $EFFF
                function(addr) { return apple2Rom[addr - ROM_ADDR]; }  // $F000 - $FFFF
            ],

            "WR":
            [
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);},   // $0000 - $0FFF
                function(addr,d8) { hw.write(addr,d8); },              // $1000 - $1FFF
                function(addr,d8) { hw.write(addr,d8); },              // $2000 - $2FFF
                function(addr,d8) { hw.write(addr,d8); },              // $3000 - $3FFF
                function(addr,d8) { hw.write(addr,d8); },              // $4000 - $4FFF
                function(addr,d8) { hw.write(addr,d8); },              // $5000 - $5FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);},   // $6000 - $6FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);},   // $7000 - $7FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);},   // $8000 - $8FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);},   // $9000 - $9FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);},   // $A000 - $AFFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);},   // $B000 - $BFFF
                function(addr,d8) { hw.io.write(addr - IO_ADDR,d8); }, // $C000 - $CFFF

                // Default ROM write: no-op.
                function(addr,d8) {},                                 // $D000 - $DFFF
                function(addr,d8) {},                                 // $E000 - $EFFF
                function(addr,d8) {}                                  // $F000 - $FFFF
            ]
        };
    };

    this.mount = function()
    {
        this.default_map = this.build_mount();

        // Working copies. Do not assign the same array object.
        this.RD = this.default_map.RD.slice(0);
        this.WR = this.default_map.WR.slice(0);
    };

    this.cycle = function()
    {
        hw.io.cycle();
        //this.bMEM_monitoring = oCOM.RefreshEvent_arr.MEM_monitoring.active;
    }

    this.read = function(addr)
    {
        var d8;
        addr = addr & 0xFFFF;

        if(oEMU.component.IO.RamCard && oEMU.component.IO.RamCard.state.active == true && addr >= ROM_ADDR)
            d8 = hw.io.read(addr);
        else if (addr < RAM_SIZE) // RAM_SIZE
            d8 = ram[addr];
        else if (addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)
            d8 = apple2Rom[addr - ROM_ADDR];
        else if (addr & 0xF000 ^ 0xC000 == 0) //(addr >= IO_ADDR && addr < IO_ADDR + IO_SIZE)
            d8 = hw.io.read(addr - IO_ADDR);
        else
            d8 = 0x55;
     
        return d8;
    }

    this.safe_read = function(addr)
    {
        var d8;
        addr = addr & 0xFFFF;

        if(oEMU.component.IO.RamCard && oEMU.component.IO.RamCard.state.active == true && addr >= ROM_ADDR)
            d8 = hw.io.read(addr);
        else if (addr < RAM_SIZE)
            d8 = ram[addr];
        else if (addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)
            d8 = apple2Rom[addr - ROM_ADDR];
        //else if (addr >= IO_ADDR && addr < IO_ADDR + IO_SIZE)
        //    d8 = hw.io.read(addr - IO_ADDR);
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

        if(oEMU.component.IO.RamCard &&  oEMU.component.IO.RamCard.state.active == true && addr >= ROM_ADDR)
            d8 = hw.io.write(addr,d8);
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
            hw.io.write(addr - IO_ADDR, d8);

        
        if(this.bMEM_monitoring) this.mark_MEM_monitoring(addr);
    }

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

    this.mark_MEM_monitoring = function(addr)
    {
        this.mem_mon[ addr>>oMEMGRID.mem_gran ] = true;     // update memory monitoring grid 
    }

    this.reset_MEM_monitoring = function()
    {
        this.mem_mon = {};
        //this.mem_mon_trigger = {"RESET":true};
        this.mem_mon_trigger = {};
        oMEMGRID.paint_grid(this.mem_layout);
    }

    this.enable_MEM_monitoring = function(b)
    {
        this.bMEM_monitoring = b;
        if(b) this.reset_MEM_monitoring();
        // EMU_ramcard.js has its own lazy method to detect if hw.bMEM_monitoring has changed
    }

    this.MEM_monitoring = function()
    {
        if(Object.keys(hw.mem_mon).length>0)    // is there anything to display?
        {
            if(bDebug_mon) console.log("MEM_monitoring -> mem_layout:"+JSON.stringify(hw.mem_mon));
            oMEMGRID.paint_grid(hw.mem_layout);
            oMEMGRID.update_grid(hw.mem_mon);
            //hw.mem_mon = {};
        }

        // TODO call ramcard?
        // TODO: DEBUG check if RamCard.MEM_monitoring() is called!!!!
        //oEMU.component.IO.RamCard.MEM_monitoring();

        hw.mem_mon_trigger = {};    // reset monitoring triggers
    }

    // Link memory to Video
    video.vidram = ram;
}