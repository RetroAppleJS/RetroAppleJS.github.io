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

    // Memspace interface for cpu6502.  If I wanted to bother, I'd have
    // a parent class called Memspace which only had read() and write()
    // methods.
    //

    /*
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
    

    this.hextab = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
    this.getHexByte    = function(v) { return this.hextab[v>>4]+this.hextab[v&0xf] }
    this.getHexWord = function(v)
    {
        return '' + this.hextab[Math.floor(v / 0x1000)]
                            + this.hextab[Math.floor((v & 0x0f00) / 256)]
                            + this.hextab[Math.floor((v & 0xf0) / 16)]
                            + this.hextab[v & 0x000f];
    }


    this.memscan = function()
    {
        console.log(" ")
        var last  = "";

        //for(var addr=0xBFFF;addr<0xC102;addr+=1)
        for(var addr=0x0000;addr<0xFFFF;addr+=1)
        {
            var sel = this.mem_map[addr>>mem_gran];
            if(this.mem_map[addr>>mem_gran] != last)
            {
                switch(sel.charAt(0))
                {
                    case "I":
                    case "S":
                        console.log("addr="+this.getHexWord(addr)+" ("+(addr>>mem_gran)+") "+this.mem_map[addr>>mem_gran]+" !!")
                    break;
                    default:
                        d8 = 0x55;
                }
                if (addr >= IO_ADDR && addr < IO_ADDR + IO_SIZE)
                    console.log("addr="+this.getHexWord(addr)+" ("+(addr>>mem_gran)+") "+this.mem_map[addr>>mem_gran])
            }
            last = this.mem_map[addr>>mem_gran]
        }
    }

 
    this.mem_map = new Array(512);

    const mem_gran = 7;  // granularity in bits
    this.build_mem_map = function()
    {
        for(var i=0;i<512;i++) this.mem_map[0] = ""
        for(var i in this.mem_layout)
        {
            var a = i.split("-"); var b = [parseInt(a[0],16),parseInt(a[1],16)];
            for(var addr=b[0];addr<b[1];addr+=1<<mem_gran)
            {
                this.mem_map[addr>>mem_gran] = this.mem_layout[i][2];
                //console.log("this.mem_map["+(addr>>mem_gran)+"]="+this.mem_layout[i][2])
            }
        }

    }
    */

    this.read = function(addr)
    {
        var d8;
        //var bOld = true;
        addr = addr & 0xFFFF;
        //if(bOld)
        //{
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
     
        //}
        /*
        else
        {
            try
            {
                if (addr < RAM_SIZE) return ram[addr];

                var sel = this.mem_map[addr>>mem_gran];
                switch(sel.charAt(0))
                {
                    case "I":
                    case "S":
                        d8 = this.io.read(addr - IO_ADDR); break;
                    case "R":
                        if(this.io.ramcard && this.io.ramcard.active) d8 = this.io.read(addr);
                        else d8 = apple2Rom[addr - ROM_ADDR];
                    break;
                    default:
                        d8 = 0x55;
                }
            }
            catch(e)
            {
                //console.log("addr="+addr)
            }
        }
        */
       

        return d8;
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
