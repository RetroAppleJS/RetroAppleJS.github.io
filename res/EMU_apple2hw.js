//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_apple2hw.js   (Apple II Hardware)

// HARDWARE IS ACCESSING:
// 1) RAM & VIDEO RAM
// 2) I/O (--> relative address starting from $C000)
// 3) ROM (--> relative address starting from $D000)

function Apple2Hw(vid,keys)
{
    var hw = this;

    const bDebug_mon = false;      // debug RAM Write monitor
    this.bClear_mon  = true;        // clear the grid after each display cycle
    
    this.lineDecode = function(addr) {return addr >> 12; };

    this.RD = [];
    this.WR = [];
    this.bRO = false;                   // Read-Only flag across the entire hardware (allowing safe read operations)
    this.default_map = null;

    var video = vid;                        
    this.io = new Apple2IO(video);      // HARDWARE OBJECT OWNS IO (always call 'io' methods via hardware)
    this.children   = {}                // TODO: deprecate ?

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

    function abs2IO(addr) { return addr - 0xC000 };
    this.IO2abs = function(io_addr) { return addr + 0xC000 };

    this.build_mount = function()
    {
        return {
            "RD":
            [
                function(addr) { return ram[addr]; },                   // $0000 - $0FFF
                function(addr) { return ram[addr]; },                   // $1000 - $1FFF
                function(addr) { return ram[addr]; },                   // $2000 - $2FFF
                function(addr) { return ram[addr]; },                   // $3000 - $3FFF
                function(addr) { return ram[addr]; },                   // $4000 - $4FFF
                function(addr) { return ram[addr]; },                   // $5000 - $5FFF
                function(addr) { return ram[addr]; },                   // $6000 - $6FFF
                function(addr) { return ram[addr]; },                   // $7000 - $7FFF
                function(addr) { return ram[addr]; },                   // $8000 - $8FFF
                function(addr) { return ram[addr]; },                   // $9000 - $9FFF
                function(addr) { return ram[addr]; },                   // $A000 - $AFFF
                function(addr) { return ram[addr]; },                   // $B000 - $BFFF
                function(addr) { return hw.io.read(abs2IO(addr)); },    // $C000 - $CFFF

                // Default ROM, not RAMCARD.
                function(addr) { return apple2Rom[addr - ROM_ADDR]; },  // $D000 - $DFFF
                function(addr) { return apple2Rom[addr - ROM_ADDR]; },  // $E000 - $EFFF
                function(addr) { return apple2Rom[addr - ROM_ADDR]; }   // $F000 - $FFFF
            ],

            "WR":
            [
                function(addr,d8) { video.write(addr, d8); ram[addr] = d8; hw.mark_MEM_monitoring(addr);}, // $0000 - $0FFF
                function(addr,d8) { video.write(addr, d8); ram[addr] = d8; hw.mark_MEM_monitoring(addr);},  // $1000 - $1FFF
                function(addr,d8) { video.write(addr, d8); ram[addr] = d8; hw.mark_MEM_monitoring(addr);},  // $2000 - $2FFF
                function(addr,d8) { video.write(addr, d8); ram[addr] = d8; hw.mark_MEM_monitoring(addr);},  // $3000 - $3FFF
                function(addr,d8) { video.write(addr, d8); ram[addr] = d8; hw.mark_MEM_monitoring(addr);},  // $4000 - $4FFF
                function(addr,d8) { video.write(addr, d8); ram[addr] = d8; hw.mark_MEM_monitoring(addr);},  // $5000 - $5FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);}, // $6000 - $6FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);}, // $7000 - $7FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);}, // $8000 - $8FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);}, // $9000 - $9FFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);}, // $A000 - $AFFF
                function(addr,d8) { ram[addr] = d8; hw.mark_MEM_monitoring(addr);}, // $B000 - $BFFF
                function(addr,d8) { hw.io.write(abs2IO(addr),d8); },                // $C000 - $CFFF

                // Default ROM write: no-op.
                function(addr,d8) {},                                               // $D000 - $DFFF
                function(addr,d8) {},                                               // $E000 - $EFFF
                function(addr,d8) {}                                                // $F000 - $FFFF
            ]
        };
    };


    this.safe_read = function(addr)
    {
        const adr = addr & 0xffff;
        const line = hw.lineDecode(adr);

        this.bRO = true;
        const d8 = hw.RD[line](adr) & 0xff;
        this.bRO = false;

        return d8;
    }

    this.safe_flashdump = function()
    { 
        var temp = new Uint8Array(0xFFFF+1);
        temp.set(ram);
        temp.set(apple2Rom, ROM_ADDR);
        return temp;
    }
    this.safe_videodump = function() { return ram.slice(0,0x6000); } // 0xC100

    this.mount = function()
    {
        this.default_map = this.build_mount();  // initialise the default memory mapping
        this.RD = this.default_map.RD.slice(0); // slice(0) creates working copies
        this.WR = this.default_map.WR.slice(0); // Do not assign the same array object!
    };

    this.cycle = function()
    {
        //hw.io.cycle();
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
        this.mem_mon_trigger = {};
        oMEMGRID.paint_grid(this.mem_layout);
    }

    this.enable_MEM_monitoring = function(b)
    {
        this.bMEM_monitoring = b;
        if(b) this.reset_MEM_monitoring();
    }

    this.MEM_monitoring = function()
    {
        if(Object.keys(hw.mem_mon).length>0)    // is there anything to display?
        {
            if(bDebug_mon) console.log("MEM_monitoring -> mem_layout:"+JSON.stringify(hw.mem_mon));
            oMEMGRID.paint_grid(hw.mem_layout);
            oMEMGRID.update_grid(hw.mem_mon);
            if(hw.bClear_mon) hw.mem_mon = {};    // CLEAR THE GRID AFTER EACH DISPLAY
        }
        hw.mem_mon_trigger = {};    // reset monitoring triggers
    }

    // Link memory to Video
    video.vidram = ram.slice(0,0x6000);
}