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

    var flash_on = true; // boolean toggled 6 hz or so.
    var flash_count = 0;
    var context = ctx;
    var charData = ctx.createImageData(14, 16);

    this.vidram = null; // apple2hw.js sets this to give me refernce to ram

    this.reset = function() {
        gfx_mode = false;
        mix_mode = false;
        page2_mode = false;
        hireset_mode = false;

        flash_on = true;
        flash_count = 0;
    }

    this.cycle = function() {
        if (++flash_count > 250000) {
            flash_on = ! flash_on;
            flash_count = 0;
            this.reflash();
        }
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

    // Draw a text character from character ROM.
    // col is [0..39], row is [0..23], d8 is video memory contents
    function drawChar(col, row, d8) {
        // Black out entire character
        ctx.fillStyle = "#000000";
        ctx.fillRect(col * 14, row * 16, 14, 16);

        // Color for white pixels.
        ctx.fillStyle = "#ffffff";

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

    // Lores color to RGB table.  Not very good.  Feel free to improve.
    var loresColors = [
        "#000000",        // Black
        "#ff0000",        // Magenta
        "#0000ff",        // Dark Blue
        "#c000c0",        // Purple
        "#008000",        // Dark Green
        "#808080",        // Grey 1
        "#4040ff",        // Medium Blue
        "#8080ff",        // Light Blue

        "#8b4514",        // Brown
        "#ffa000",        // Orange
        "#808080",        // Grey 2
        "#ff69b4",        // Pink
        "#40ff40",        // Light Green
        "#ffff80",        // Yellow
        "#7fffd4",        // Aquamarine
        "#ffffff",        // White
    ];

    // Redraw a lores two pixel block.
    // col is [0..39], row is [0..23], d8 is video memory contents
    function drawLores(col, row, d8) {
        ctx.fillStyle = loresColors[d8 & 0x0f];
        ctx.fillRect(col * 14, row * 16, 14, 8);

        ctx.fillStyle = loresColors[d8 >> 4];
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
    function drawPixel(x, y, left, me, right, b7) {
        var a0 = x & 0x01;

        // If pixel is set and either adjacent pixels are set, it's white.
        if (me != 0 && (left != 0 || right != 0))
            ctx.fillStyle = "white";
        // If pixel is set but no adjacent pixels are set, pick a color
        // based on column and b7.
        else if (me != 0) {
            if (b7 != 0) {
                if (a0 != 0)
                    ctx.fillStyle = "red";
                else
                    ctx.fillStyle = "blue";
            } else {
                if (a0 != 0)
                    ctx.fillStyle = "green";
                else
                    ctx.fillStyle = "violet";
            }
        }
        // If pixel is not set and both adjacent pixels are set, pick a
        // color based on column (of adjacent pixel) and b7 (of this byte).
        else if (left != 0 && right != 0) {
            if (b7 != 0) {
                if (a0 != 0)
                    ctx.fillStyle = "blue";
                else
                    ctx.fillStyle = "red";
            } else {
                if (a0 != 0)
                    ctx.fillStyle = "violet";
                else
                    ctx.fillStyle = "green";
            }
        }
        // Else it's black.
        else
            ctx.fillStyle = "black";

        // Draw the pixel.
        ctx.fillRect(x * 2, y * 2, 2, 2);
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
        var b = ((d8_r & 0x03) << 9) | ((d8 & 0x7f) << 2) |
            ((d8_l & 0x60) >> 5);

        // Draw pixels including one pixel to the left and to the right
        // of hires byte.
        //
        for (var x = col * 7 - 1; x < col * 7 + 8; x++) {
            if (x >= 0 && x < 280)
                drawPixel(x, y, b & 0x01, b & 0x02, b & 0x04,
                          d8 & 0x80);
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
                drawChar(col, row, d8);
            }
        }
    } // write()

    // Redraw flashing characters only.  Called every time flash_on toggles.
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
}
