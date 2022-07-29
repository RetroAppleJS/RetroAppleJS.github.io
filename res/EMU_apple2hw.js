//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Adapted in 2022 by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// apple2hw.js


// APPLE II+ Memory Map

// FFFF ┌────────────────────────────────────┐                      ▲ 
//      │  Autostart ROM                     │  2K                  │
//      │  mask 1111100000000000             │                      │
// F800 ├────────────────────────────────────┤                      │  12K
//      │ 1111011111111111  ^                │                      │  ROM 
//      │  Applesoft ROM                     │  10K                 │
//      │             mask 11010000 00000000?│                      │
//      │diff with $1800 = 00011000 00000000 │                      ▼
//      │ 1101000000000000  v                │                      │    
// D000 ├────────────────────────────────────┤                        
//      │  I/O ROM/RAM                       │  2K                  ▲
//      │                                    │                      │
// C800 ├────────────────────────────────────┤                      │  4K
//      │  I/O Ports                         │  2K                  │  I/O
//      │                                    │                      ▼
// C000 ├────────────────────────────────────┤                      
//      │                                    │                      ▲     
//      │                                    │                      │
//      │                                    │                      │     
//      │  Free                              │  24K                 │
//      │                                    │                      │
//      │                                    │                      │
//      │                                    │                      │
// 6000 ├────────────────────────────────────┤                      │
//      │                                    │                      │     
//      │  Hi-Res 2                          │  8K                  │
//      │                                    │                      │
//      │                                    │                      │
// 4000 ├────────────────────────────────────┤                      │  48K
//      │                                    │                      │  RAM   
//      │  Hi-Res 1                          │  8K                  │
//      │                                    │                      │          
//      │                                    │                      │
// 2000 ├────────────────────────────────────┤                      │
//      │                                    │                      │     
//      │  Free                              │  5K                  │
//      │                                    │                      │
// 0C00 ├────────────────────────────────────┤                      │
//      │  Text & Lo-res graphics 2          │  1K                  │
// 0800 ├────────────────────────────────────┤                      │
//      │  Text & Lo-res graphics 1          │  1K                  │
// 0400 ├────────────────────────────────────┤                      │
//      │  System RAM  (zero page, stack..)  │  1K                  │
// 0000 └────────────────────────────────────┘                      ▼

function Apple2Hw(vid) {
    var RAM_SIZE =      0xc000,
        LORES_ADDR =    0x0400,
        LORES_SIZE =    0x0800, // both pages
        HIRES_ADDR =    0x2000,
        HIRES_SIZE =    0x4000, // both pages
        IO_ADDR =       0xc000,
        IO_SIZE =       0x0800,
        ROM_ADDR =      0xd000,
        ROM_SIZE =      0x4000;

    var ram = new Array(RAM_SIZE);
    var video = vid;
    this.io = new Apple2IO(video);

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
        this.build_mem_map();
    }

    this.cycle = function() {
        this.io.cycle();
    }

    // Memspace interface for cpu6502.  If I wanted to bother, I'd have
    // a parent class called Memspace which only had read() and write()
    // methods.
    //

    this.mem_layout = {
        "0000-00FF":["#FFFFFF","ZERO-PAGE","ZP"]
       ,"0100-01FF":["#E0E0E0","STACK","ST"]
       ,"0200-02FF":["#00D000","GETLN buffer","BU"]
       ,"0300-03FF":["#00D000","VECTORS","VC"]
       ,"0400-07FF":["#DF48FF","TXT1/LORES1","T1"]
       ,"0800-0BFF":["#D040E0","TXT2/LORES2","T2"]
       ,"0C00-1FFF":["#00D000","APPLESOFT PRG","AP"]
       ,"2000-3FFF":["#0000FF","HIRES1","H1"]
       ,"4000-5FFF":["#0000E0","HIRES2","H2"]
       ,"6000-BFFF":["rgba(0,0,0,0.1)","FREE","F"]
       ,"C000-C0FF":["#B0B000","SLOT I/O","IO"]
       ,"C100-C1FF":["#D0D000","SLOT 1 ROM","S1"]
       ,"C200-C2FF":["#D0D000","SLOT 2 ROM","S2"]
       ,"C300-C3FF":["#D0D000","SLOT 3 ROM","S3"]
       ,"C400-C4FF":["#D0D000","SLOT 4 ROM","S4"]
       ,"C500-C5FF":["#D0D000","SLOT 5 ROM","S5"]
       ,"C600-C6FF":["#D0D000","SLOT 6 ROM","S6"]
       ,"C700-C7FF":["#D0D000","SLOT 7 ROM","S7"]
       ,"C800-CFFF":["#F0F000","SLOT ROM ext","SR"]         
       ,"D000-F7FF":["#B00000","APPLESOFT ROM","AR"]
       ,"F800-FFFF":["#D00000","MONITOR ROM","MR"]
       //,"0300":["","GETLN","GL"]
    }

    this.mem_map = new Array(256);

    this.build_mem_map = function()
    {
        for(var i in this.mem_layout)
        {
            var a = i.split("-"); var b = [parseInt(a[0],16),parseInt(a[1],16)];
            for(var addr=b[0];addr<b[1];addr+=parseInt("0100",16))
            { 
                this.mem_map[addr>>8] = this.mem_layout[i][2];

                console.log("("+("0000"+addr.toString(16)).slice(-4).toUpperCase()+") "
                +(addr>>8)+" "+this.mem_layout[i][2]);
            }
        }
    }

    this.read = function(addr) {
        var d8;

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
                /* 
        else
        {    
            

            switch(this.mem_map[addr>>8])
            {
                case "IO": d8 = this.io.read(addr - IO_ADDR); break;
                default:
                    d8 = 0x55;
            }
        }*/

        return d8;
    }

    this.write = function(addr, d8) {
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
    }

    // Give Video a reference to memory.
    video.vidram = ram;

    this.restart();
}
