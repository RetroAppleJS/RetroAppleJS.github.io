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

// apple2video.js

function Apple2Video(ctx) {
    var LORES1_ADDR =   0x0400,
        LORES2_ADDR =   0x0800,
        LPAGE_SIZE =    0x0400,
        HIRES1_ADDR =   0x2000,
        HIRES2_ADDR =   0x4000,
        HPAGE_SIZE =    0x2000;

    var gfx_mode;
    var mix_mode;
    var page2_mode;
    var hires_mode;
    var chrome_mode;

    var flash_on = true; // boolean toggled 6 hz or so.
    var flash_count = 0;
    if(ctx)
    {
        var context = ctx;
        var charData = ctx.createImageData(14, 16);
    }  
    var charFlow = {"prev":{}};

    this.vidram = null; // apple2hw.js sets this to give me refernce to ram

    this.reset = function() {
        gfx_mode = false;
        mix_mode = false;
        page2_mode = false;
        hires_mode = false;
        chrome_mode = 0;
        flash_on = true;
        flash_count = 0;
    }

    this.cycle = function() {
        if (++flash_count > 250000) {
            flash_on = ! flash_on;
            flash_count = 0;
            this.reflash();
        }
        if(flash_count % (250000/4+1) == 0)
            this.rept();
    }

    this.setGfx = function(flag) {
        if (gfx_mode != flag) {
            gfx_mode = flag;
            this.redraw();
        }
    }

    this.setMix = function(flag) {
        if (mix_mode != flag) {
            mix_mode = flag;
            this.redraw();
        }
    }

    this.setPage2 = function(flag) {
        if (page2_mode != flag) {
            page2_mode = flag;
            this.redraw();
        }
    }

    this.setHires = function(flag) {
        if (hires_mode != flag) {
            hires_mode = flag;
            this.redraw();
        }
    }

    this.setMonitor = function(mode) {
        chrome_mode = mode & 3;
        this.redraw();
        return {"color": monoChromes[chrome_mode]?monoChromes[chrome_mode]:"#000000" , "name": monoChrome_names[chrome_mode] };
    }

    this.getloresCols = function() {
        return loresCols;
    }

    this.gethiresCols = function() {
        return hiresCols;
    }

    this.setCol = function(idx,column,val) {
        return loresCols[idx][column] = val;
    }

    this.getPixelColor = getPixelColor;

    // Draw a text character from character ROM.
    // col is [0..39], row is [0..23], d8 is video memory contents
    function drawChar(col, row, d8) {

        // Black out entire character
        ctx.fillStyle = "#000000";
        ctx.fillRect(col * 14, row * 16, 14, 16);

        // Color for white pixels.
        ctx.fillStyle = monoChromes[chrome_mode]?monoChromes[chrome_mode]:"#ffffff";

        var offs = 8 * ((d8 & 0x3f) ^ 0x20);
        for (var y = 0; y < 8; y++) {
            var bits = apple2CharRom[offs + y];
            

            // Inverse or flashing?
            if ((d8 & 0xc0) == 0x00 ||
                ((d8 & 0xc0) == 0x40 && flash_on))
                bits ^= 0xff;

            for (var x = 0; x < 7; x++) {
                if ((bits & 0x01) != 0)
                    ctx.fillRect(col * 14 + x * 2, row * 16 + y * 2, 2, 2);
                bits >>= 1;
            }
        }
    }

// Monochrome colors (index 0 = full color)
var monoChromes      = ["","#FFFFFF","#A0FFF0","#FCE7A1"];
var monoChrome_names = ["FULL-COLOR","B&W","GREEN","AMBER"];

// Lores color to RGB table. (* Hires)
var loresCols = [
 ["#000000","#000000","#000000","#000000","Black"]  // *
,["#901740","#4D4D4D","#304D48","#4C4631","Magenta"] 
,["#402CA5","#5B5B5B","#395B56","#5A5239","Dark Blue"] 
,["#D043E5","#A8A8A8","#69A89E","#A6986A","Purple"]  // *
,["#006940","#383838","#233835","#383324","Dark Green"] 
,["#808080","#808080","#508078","#7E7451","Grey 1"] 
,["#2F95E5","#8E8E8E","#598E85","#8C8059","Medium Blue"]  // *
,["#BFABFF","#CECECE","#81CEC2","#CBBA82","Light Blue"] 
,["#405400","#313131","#1F312E","#312D1F","Brown"] 
,["#D06A1A","#717171","#47716B","#706748","Orange"]  // *
,["#808080","#808080","#508078","#7E7451","Grey 2"] 
,["#FF96BF","#C7C7C7","#7DC7BB","#C4B47D","Pink"] 
,["#2FBC1A","#575757","#375752","#564F37","Light Green"]  // *
,["#BFD35A","#A4A4A4","#67A49A","#A29568","Yellow"] 
,["#6FE8BF","#B2B2B2","#70B2A8","#B0A170","Aquamarine"] 
,["#FFFFFF","#FFFFFF","#A0FFF0","#FCE7A1","White"]  // *
];

var hiresCols = [
 ["#000000","#000000","#000000","#000000","Black"]
,["#D043E5","#A8A8A8","#69A89E","#A6986A","Purple"]
,["#2F95E5","#8E8E8E","#598E85","#8C8059","Medium Blue"]
,["#D06A1A","#717171","#47716B","#706748","Orange"]
,["#2FBC1A","#575757","#375752","#564F37","Light Green"]
,["#FFFFFF","#FFFFFF","#A0FFF0","#FCE7A1","White"]
];

    // Redraw a lores two pixel block.
    // col is [0..39], row is [0..23], d8 is video memory contents
    function drawLores(col, row, d8) {
        var m = chrome_mode?chrome_mode:0;
        ctx.fillStyle = loresCols[d8 & 0x0f][m]
        ctx.fillRect(col * 14, row * 16, 14, 8);

        ctx.fillStyle = loresCols[d8 >> 4][m]
        ctx.fillRect(col * 14, row * 16 + 8, 14, 8);
    }

    // Convoluted way of plotting hires colors.
    //
    // coordinates: x is [0..279], y is [0..191]
    //
    // The rest are integers treated as booleans:
    // left != 0, pixel to the left is set
    // me != 0, this pixel is set
    // right != 0, pixel to the right is set
    // b7 != 0, the relevant byte in hires memory has bit 7 set
    //
    function getPixelColor(x, y, left, me, right, b7) {
        var a0 = x & 0x01;
        // If pixel is set and either adjacent pixels are set, it's white.
        if (me != 0 && (left != 0 || right != 0))
            return loresCols[15][0];  // White
        // If pixel is set but no adjacent pixels are set, pick a color
        // based on column and b7.
        else if (me != 0) {
            if (b7 != 0) {
                if (a0 != 0)
                    return loresCols[9][0]; // Orange
                else
                    return loresCols[6][0]; // Medium Blue
            } else {
                if (a0 != 0)
                    return loresCols[12][0]; // Green
                else
                    return loresCols[3][0]; // Purple
            }
        }
        // If pixel is not set and both adjacent pixels are set, pick a
        // color based on column (of adjacent pixel) and b7 (of this byte).
        else if (left != 0 && right != 0) {
            if (b7 != 0) {
                if (a0 != 0)
                    return loresCols[6][0]; // Medium Blue
                else
                    return loresCols[9][0]; // Orange
            } else {
                if (a0 != 0)
                    return loresCols[3][0]; // Purple
                else
                    return loresCols[12][0]; // Green
            }
        }
        // Else it's black.
        else
           return loresCols[0][0];    // Black
    }

    function drawPixel(x, y, left, me, right, b7) {
        
        ctx.fillStyle = getPixelColor(x, y, left, me, right, b7)
        ctx.fillRect(x * 2, y * 2, 2, 2);    // Draw the pixel.
    }

    // Draw a hires memory location, ends up redrawing pixels
    // to the left and right of the byte.
    //
    // col is [0..39], y is [0..191].
    //
    // Needs byte left and right of the location to handle
    // weird color algorithm (see drawPixel()).  If column is
    // leftmost or rightmost, use zero for non-existant adjacent bytes.
    //
    function drawHires(col, y, d8_l, d8, d8_r) {
        // Concatenate 11 bits of pixels.  LSB is the leftmost pixel.
        //
        // { d8_r[0:1], d8[0:6], d8_l[5:6] }
        var b = ((d8_r & 0x03) << 9) | ((d8 & 0x7f) << 2) | ((d8_l & 0x60) >> 5);

        // Draw pixels including one pixel to the left and to the right
        // of hires byte.
        //
        for (var x = col * 7 - 1; x < col * 7 + 8; x++) {
            if (x >= 0 && x < 280 && y < (mix_mode?160:192))
                drawPixel(x, y, b & 0x01, b & 0x02, b & 0x04, d8 & 0x80);
            b >>= 1;
        }
    }

    // Called if a write lands in any possible video RAM area.
    this.write = function(addr, d8) {

        if (gfx_mode && hires_mode &&
            addr >= (page2_mode ? HIRES2_ADDR : HIRES1_ADDR) &&
            addr < (page2_mode ? HIRES2_ADDR : HIRES1_ADDR) + HPAGE_SIZE) {

            // HIRES graphics.
            // Calculate column [0..39] and y [0..191] from address.
            var col = (addr & 0x07f) % 40;
            var y = ((addr & 0x380) >> 4) | ((addr & 0x1c00) >> 10);
            var d8_l = 0, d8_r = 0;

            // Hidden by text in mix-mode?
            if (y >= 160 && mix_mode)
                return;

            if ((addr & 0x07f) < 40)
                ;
            else if ((addr & 0x07f) < 80)
                y |= 0x40;
            else if ((addr & 0x07f) < 120)
                y |= 0x80;
            else
                return; // off-screen bytes

            // Get bytes to the left and right of this byte (if they exist).
            if (col > 0)
                d8_l = this.vidram[addr - 1];
            if (col < 39)
                d8_r = this.vidram[addr + 1];

            drawHires(col, y, d8_l, d8, d8_r);
        }
        else if (addr >= (page2_mode ? LORES2_ADDR : LORES1_ADDR) &&
                addr < (page2_mode ? LORES2_ADDR : LORES1_ADDR) + LPAGE_SIZE) {

            // LORES or TEXT.
            // Calculate column [0..39] and row [0..23] from address.
            var col = (addr & 0x07f) % 40;
            var row = ((addr & 0x380) >> 7);
            if ((addr & 0x07f) < 40)
                ;
            else if ((addr & 0x07f) < 80)
                row |= 0x08;
            else if ((addr & 0x07f) < 120)
                row |= 0x10;
            else
                return; // off-screen

            if (gfx_mode && (!mix_mode || row < 20)) {
                // LO-RES Graphics.
                if (!hires_mode)
                    drawLores(col, row, d8);
            }
            else {
                // Text mode
                // console.log("Apple2Video().write(%s %s): text md write.",
                //            addr.toString(16), d8.toString(16));

                /*
                if(d8!=96)
                {
                    var h = (d8-128).toString(16);

                    board.logText.value += 
                    (h=="20"?"":"\n")
                    +"["+col+","+row+"]"
                    +h
                    +" '"+String.fromCharCode(d8-128)+"' "

                    if(col==charFlow.prev.col && row==charFlow.prev.col)
                    {
                        board.logText.value += '"'+ board.captureText.value  +'"> '

                        board.captureText.value 
                        = board.captureText.value.substring(0,board.captureText.value.length-3)
                        + board.captureText.value.slice(-1)
                        + String.fromCharCode(d8-128);
                        

                        board.logText.value += '"'+ board.captureText.value  +'"'
                    }
                }
                */
                drawChar(col, row, d8);
                charFlow.prev = {"col":col,"row":row,"d8":d8}

            }
        }
    } // write()

    // Redraw flashing characters only (including cursor).  Called every time flash_on toggles.
    this.reflash = function() {
        if (!gfx_mode || mix_mode) {            
            for (var col = 0; col < 40; col++)
                for (var row = (gfx_mode && mix_mode) ? 20 : 0;
                     row < 24; row++) {
                    var addr = (((row & 0x07) << 7) |
                        (row & 0x18) | ((row & 0x18) << 2) |
                        (page2_mode ? LORES2_ADDR : LORES1_ADDR)) + col;
                    var d8 = this.vidram[addr];

                    // Redraw flashing characters.
                    if ((d8 & 0xc0) == 0x40)
                        drawChar(col, row, d8);
                    
                }
        }
    }

    // Redraw everything.  Called whenever the graphics modes change.
    this.redraw = function() {
        for (var row = 0; row < 24; row++)
            for (var col = 0; col < 40; col++) {

                var addr = (((row & 0x07) << 7) |
                            (row & 0x18) |
                            ((row & 0x18) << 2)) + col;

                if (gfx_mode && (!mix_mode || row < 20)) {
                    if (hires_mode) {
                        var y;
                        addr += page2_mode ? HIRES2_ADDR : HIRES1_ADDR;
                        for (y = 0; y < 8; y++) {
                            // HIRES graphics
                            var d8_l = 0, d8, d8_r = 0;
                            addr = (addr & 0xe3ff) | (y << 10);

                            d8 = this.vidram[addr];
                            if (col > 0)
                                d8_l = this.vidram[addr - 1];
                            if (col < 39)
                                d8_r = this.vidram[addr + 1];

                            drawHires(col, row * 8 + y, d8_l, d8, d8_r);
                        }
                    } else {
                        // LORES graphics
                        addr += page2_mode ? LORES2_ADDR : LORES1_ADDR;
                        drawLores(col, row, this.vidram[addr]);
                    }
                } else {
                    // Text
                    addr += page2_mode ? LORES2_ADDR : LORES1_ADDR;
                    drawChar(col, row, this.vidram[addr]);
                }
            }
    }

    this.rept = function() {
    // cursor repeat pace (TODO)
    }

}
