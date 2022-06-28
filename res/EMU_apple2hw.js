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

// apple2hw.js

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
    }

    this.cycle = function() {
        this.io.cycle();
    }

    // Memspace interface for cpu6502.  If I wanted to bother, I'd have
    // a parent class called Memspace which only had read() and write()
    // methods.
    //
    this.read = function(addr) {
        var d8;
        if(this.io.ramcard.active == true && addr >= ROM_ADDR)
        {
            d8 = this.io.read(addr); //  TODO let the IO read return ROM stuff !!!
            // d8 = apple2Rom[addr - ROM_ADDR];
        }
        else if (addr < RAM_SIZE)
            d8 = ram[addr];
        else if (addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)
            d8 = apple2Rom[addr - ROM_ADDR];            
        else if (addr >= IO_ADDR && addr < IO_ADDR + IO_SIZE)
            d8 = this.io.read(addr - IO_ADDR);
        else
            d8 = 0x55;

        // console.log("Apple2Hw.read(): %s %s",
        //              addr.toString(16), d8.toString(16));

        return d8;
    }

    this.write = function(addr, d8) {
        // console.log("Apple2Hw.write(): %s %s",
        //            addr.toString(16), d8.toString(16));
        if (d8 < 0 || d8 > 0xff) // XXX: Debug
            console.err("Pet2001hw.write(%s %s) d8 too big!",
                        addr.toString(16), d8.toString(16));

        if(this.io.ramcard.active == true && addr >= ROM_ADDR)
        {
            d8 = this.io.write(addr,d8); 
        }
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
