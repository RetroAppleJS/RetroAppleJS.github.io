// 2025 adaptations by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// Thanks to Thomas Skibo - Copyright (c) 2014.
// apple2video.js

//oEMU.component.Video["A2P"] = {Apple2Video};
if(oEMU===undefined) var oEMU = {"component":{"Video":{"Apple2Video":new Apple2Video()}}}
else oEMU.component.Video.Apple2Video = new Apple2Video();

function Apple2Video(ctx)
{

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
    var charFlow = {"prev":{}};
    if(ctx) this.ctx = ctx;

    this.vidram = null; // apple2hw.js sets this to give me reference to ram
    this.hw = null;     // apple2hw provides its reference during initialisation

    this.reset = function() {
        gfx_mode = false;
        mix_mode = false;
        page2_mode = false;
        hires_mode = false;
        chrome_mode = 0;
        flash_on = true;
        flash_count = 0;
        this.register_mode();
    }

    this.register_mode = function()
    {
        this.modes = {"gfx":gfx_mode,"mix":mix_mode,"page2":page2_mode,"hires":hires_mode,"chrome":chrome_mode};
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
        return {
             "color": _CFG_CHROMA[chrome_mode].COL_num?_CFG_CHROMA[chrome_mode].COL_num:"#000000"
            ,"name": _CFG_CHROMA[chrome_mode].COL_name
        };
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

    const INTCols = new Uint8Array([
    0X00,0X00,0X00,0X0,0x00,0x00,0x00,0x0,0x00,0x00,0x00,0x0,0x00,0x00,0x00,0x0  // Black       * color 0 & 4
    ,0X90,0X17,0X40,0X0,0x4D,0x4D,0x4D,0x0,0x30,0x4D,0x48,0x0,0x4C,0x46,0x31,0x0  // Magenta
    ,0X40,0X2C,0XA5,0X0,0x5B,0x5B,0x5B,0x0,0x39,0x5B,0x56,0x0,0x5A,0x52,0x39,0x0  // Dark Blue
    ,0XD0,0X43,0XE5,0X0,0xA8,0xA8,0xA8,0x0,0x69,0xA8,0x9E,0x0,0xA6,0x98,0x6A,0x0  // Purple      * color 2
    ,0X00,0X69,0X40,0X0,0x38,0x38,0x38,0x0,0x23,0x38,0x35,0x0,0x38,0x33,0x24,0x0  // Dark Green
    ,0X80,0X80,0X80,0X0,0x80,0x80,0x80,0x0,0x50,0x80,0x78,0x0,0x7E,0x74,0x51,0x0  // Grey 1
    ,0X2F,0X95,0XE5,0X0,0x8E,0x8E,0x8E,0x0,0x59,0x8E,0x85,0x0,0x8C,0x80,0x59,0x0  // Medium Blue * color 6
    ,0XBF,0XAB,0XFF,0X0,0xCE,0xCE,0xCE,0x0,0x81,0xCE,0xC2,0x0,0xCB,0xBA,0x82,0x0  // Light Blue
    ,0X40,0X54,0X00,0X0,0x31,0x31,0x31,0x0,0x1F,0x31,0x2E,0x0,0x31,0x2D,0x1F,0x0  // Brown
    ,0XD0,0X6A,0X1A,0X0,0x71,0x71,0x71,0x0,0x47,0x71,0x6B,0x0,0x70,0x67,0x48,0x0  // Orange      * color 5
    ,0X80,0X80,0X80,0X0,0x80,0x80,0x80,0x0,0x50,0x80,0x78,0x0,0x7E,0x74,0x51,0x0  // Grey 2
    ,0XFF,0X96,0XBF,0X0,0xC7,0xC7,0xC7,0x0,0x7D,0xC7,0xBB,0x0,0xC4,0xB4,0x7D,0x0  // Pink
    ,0X2F,0XBC,0X1A,0X0,0x57,0x57,0x57,0x0,0x37,0x57,0x52,0x0,0x56,0x4F,0x37,0x0  // Light Green * color 1
    ,0XBF,0XD3,0X5A,0X0,0xA4,0xA4,0xA4,0x0,0x67,0xA4,0x9A,0x0,0xA2,0x95,0x68,0x0  // Yellow  
    ,0X6F,0XE8,0XBF,0X0,0xB2,0xB2,0xB2,0x0,0x70,0xB2,0xA8,0x0,0xB0,0xA1,0x70,0x0  // Aquamarine
    ,0XFF,0XFF,0XFF,0X0,0xFF,0xFF,0xFF,0x0,0xA0,0xFF,0xF0,0x0,0xFC,0xE7,0xA1,0x0  // White       * color 3 & 7
    ]);
    var ColNames = ["Black","Magenta","Dark Blue","Purple","Dark Green","Grey 1","Medium Blue","Light Blue","Brown","Orange","Grey 2","Pink","Light Green","Yellow","Aquamarine","White"];

    const hex2tab=[
    "00","01","02","03","04","05","06","07","08","09","0A","0B","0C","0D","0E","0F","10","11","12","13","14","15","16","17","18","19","1A","1B","1C","1D","1E","1F",
    "20","21","22","23","24","25","26","27","28","29","2A","2B","2C","2D","2E","2F","30","31","32","33","34","35","36","37","38","39","3A","3B","3C","3D","3E","3F",
    "40","41","42","43","44","45","46","47","48","49","4A","4B","4C","4D","4E","4F","50","51","52","53","54","55","56","57","58","59","5A","5B","5C","5D","5E","5F",
    "60","61","62","63","64","65","66","67","68","69","6A","6B","6C","6D","6E","6F","70","71","72","73","74","75","76","77","78","79","7A","7B","7C","7D","7E","7F",
    "80","81","82","83","84","85","86","87","88","89","8A","8B","8C","8D","8E","8F","90","91","92","93","94","95","96","97","98","99","9A","9B","9C","9D","9E","9F",
    "A0","A1","A2","A3","A4","A5","A6","A7","A8","A9","AA","AB","AC","AD","AE","AF","B0","B1","B2","B3","B4","B5","B6","B7","B8","B9","BA","BB","BC","BD","BE","BF",
    "C0","C1","C2","C3","C4","C5","C6","C7","C8","C9","CA","CB","CC","CD","CE","CF","D0","D1","D2","D3","D4","D5","D6","D7","D8","D9","DA","DB","DC","DD","DE","DF",
    "E0","E1","E2","E3","E4","E5","E6","E7","E8","E9","EA","EB","EC","ED","EE","EF","F0","F1","F2","F3","F4","F5","F6","F7","F8","F9","FA","FB","FC","FD","FE","FF"];
    var RGB2HEX = function(color) { return [hex2tab[color[0]&0xFF],hex2tab[color[1]&0xFF],hex2tab[color[2]&0xFF]] }

    const transformColors = function(INTCols, ColNames, indexes)
    {
        const colorsPerEntry = 4;
        if (!Array.isArray(indexes)) indexes = ColNames.map((_, i) => i);
        return indexes.map(function(i)
        {
            const ofs = i * colorsPerEntry * 4, row = [];
            for (let j = 0; j < 4; j++)
                row.push( "#" + RGB2HEX([INTCols[ofs + (j << 2)],INTCols[ofs + 1 +(j << 2)],INTCols[ofs + 2 + (j << 2)]]).join("") );
            row.push(ColNames[i]);
            return row;
        });
    };

    var hiresCols = transformColors(INTCols,ColNames,[0,3,6,9,12,15]);
    var loresCols = transformColors(INTCols,ColNames);

    // Draw a text character from character ROM.
    // col is [0..39], row is [0..23], d8 is video memory contents
    function text_Draw(col, row, d8) {

        // Black out entire character
        ctx.fillStyle = text_PixelColor(0);
        ctx.fillRect(col * 14, row * 16, 14, 16);

        // Color for character pixels.
        ctx.fillStyle = text_PixelColor(1);

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

    // Redraw a lores two pixel block.
    // col is [0..39], row is [0..23], d8 is video memory contents
    function lores_Draw(col, row, d8)
    {
        ctx.fillStyle = lores_PixelColor(d8 & 0x0F);
        ctx.fillRect(col * 14, row * 16, 14, 8);

        ctx.fillStyle = lores_PixelColor(d8>>4);
        ctx.fillRect(col * 14, 8 + row * 16, 14, 8);
    }

    // Draw a hires memory location, ends up redrawing pixels
    // to the left and right of the byte.
    //
    // col is [0..39], y is [0..191].
    //
    // Needs byte left and right of the location to handle
    // weird color algorithm (see hgr_drawPixel()).  If column is
    // leftmost or rightmost, use zero for non-existant adjacent bytes.
    
    // Convoluted way of plotting hires colors.
    // coordinates: x is [0..279], y is [0..191]
    //
    // The rest are integers treated as booleans:
    // left != 0, pixel to the left is set
    // me != 0, this pixel is set
    // right != 0, pixel to the right is set
    // b7 != 0, the relevant byte in hires memory has bit 7 set
    //

    function text_PixelColor(me)
    {
        // White or monochrome color
        if(me!=0) return _CFG_CHROMA[chrome_mode].COL_num ? _CFG_CHROMA[chrome_mode].COL_num : loresCols[15][0];
        else return loresCols[0][0];    // Black
    }

    function lores_PixelColor(d8) {
        var m = chrome_mode?chrome_mode:0;
        return loresCols[d8 & 0x0f][m];
    }

    this.hgr_PixelColor = function(x, y, l, m, r, b7) 
    {
        const chr = 0;
        const b   = x<<4 | l<<3 | (m<<2 | m<<1)&4 | (r<<1 | r>>1)&2 | b7>>7;
        const col =  0xF4E0F8D0>>>b &1 | 0x08200820>>>b-1 &2 | 0xF0D0F4C0>>>b-2 &4;
        const ofs = (col<<4)+(col<<5) | chr<<2;
        const a   = INTCols.slice(ofs,ofs+3);
        return "#"+RGB2HEX(a).join("");
    }

    // Called if a write lands in any possible video RAM area.
    this.write = function(addr, d8)
    {
        if(this.ctx === undefined) return;

        if (gfx_mode && hires_mode &&
            addr >= (page2_mode ? HIRES2_ADDR : HIRES1_ADDR) &&
            addr < (page2_mode ? HIRES2_ADDR : HIRES1_ADDR) + HPAGE_SIZE) {

            // HIRES graphics.
            // Calculate column [0..39] and y [0..191] from address.
            var col = (addr & 0x07f) % 40;
            var y = ((addr & 0x380) >> 4) | ((addr & 0x1c00) >> 10);
            var d8_l = 0, d8_r = 0;

            // Hidden by text in mix-mode?
            if (y >= 160 && mix_mode) return;

            if ((addr & 0x07f) < 40);
            else if ((addr & 0x07f) < 80) y |= 0x40;
            else if ((addr & 0x07f) < 120) y |= 0x80;
            else return; // off-screen bytes

            // Get bytes to the left and right of this byte (if they exist).
            if (col > 0) d8_l = this.vidram[addr - 1];
            if (col < 39) d8_r = this.vidram[addr + 1];

            this.hgr_Draw(col, y, d8_l, d8, d8_r, this.modes);
        }
        else if (addr >= (page2_mode ? LORES2_ADDR : LORES1_ADDR) &&
                addr < (page2_mode ? LORES2_ADDR : LORES1_ADDR) + LPAGE_SIZE) {

            // LORES or TEXT.
            // Calculate column [0..39] and row [0..23] from address.
            var col = (addr & 0x07f) % 40;
            var row = ((addr & 0x380) >> 7);

            if ((addr & 0x07f) < 40);
            else if ((addr & 0x07f) < 80) row |= 0x08;
            else if ((addr & 0x07f) < 120) row |= 0x10;
            else return; // off-screen

            if (gfx_mode && (!mix_mode || row < 20))
            {
                // LO-RES Graphics.
                if (!hires_mode) lores_Draw(col, row, d8);
            }
            else
            {
                // Text mode
                text_Draw(col, row, d8);
                charFlow.prev = {"col":col,"row":row,"d8":d8}
            }
        }
    } // write()

    // Redraw flashing characters only (including cursor).  Called every time flash_on toggles.
    this.reflash = function()
    {
        if(this.ctx === undefined) return;

        if (!gfx_mode || mix_mode) {            
            for (var col = 0; col < 40; col++)
               for (var row = (gfx_mode && mix_mode) ? 20 : 0; row < 24; row++)
               {
                    var addr = (((row & 0x07) << 7) | (row & 0x18) | ((row & 0x18) << 2) |
                        (page2_mode ? LORES2_ADDR : LORES1_ADDR)) + col;
                    var d8 = this.vidram[addr];

                    // Redraw flashing characters.
                    if ((d8 & 0xc0) == 0x40) text_Draw(col, row, d8);
                }
        }
        //oEMU.component.IO.AppleSpeaker.toggle();  // toggle speaker at each key frame
    }

    // Redraw everything.  Called whenever the graphics modes change.
    this.redraw = function()
    {
        if(this.ctx === undefined) return;
        
        this.register_mode();
        for (var row = 0; row < 24; row++)
            for (var col = 0; col < 40; col++)
            {
                var addr = (((row & 0x07) << 7) |
                            (row & 0x18) |
                            ((row & 0x18) << 2)) + col;

                if (gfx_mode && (!mix_mode || row < 20))
                {
                    if (hires_mode)
                    {
                        addr += page2_mode ? HIRES2_ADDR : HIRES1_ADDR;
                        for (var y = 0; y < 8; y++)
                        {
                            // HIRES graphics
                            var d8_l = 0, d8, d8_r = 0;
                            addr = (addr & 0xe3ff) | (y << 10);
                            d8 = this.vidram[addr];
                            if (col > 0)  d8_l = this.vidram[addr - 1];
                            if (col < 39) d8_r = this.vidram[addr + 1];
                            this.hgr_Draw(col, row * 8 + y, d8_l, d8, d8_r, this.modes);
                        }
                    }
                    else
                    {
                        // LORES graphics
                        addr += page2_mode ? LORES2_ADDR : LORES1_ADDR;
                        lores_Draw(col, row, this.vidram[addr]);
                    }
                } 
                else
                {
                    // Text
                    addr += page2_mode ? LORES2_ADDR : LORES1_ADDR;
                    text_Draw(col, row, this.vidram[addr]);
                }
            }
            //oEMU.component.IO.AppleSpeaker.toggle();  // toggle speaker at each key frame
    }

    this.rept = function() {
    // cursor repeat pace (TODO)
    }

    this.hgr_Draw = function(col, y, d8_l, d8, d8_r, modes)
    {
        // Concatenate 11 bits of pixels.  LSB is the leftmost pixel.
        // { d8_r[0:1], d8[0:6], d8_l[5:6] }
        var b = ((d8_r & 0x03) << 9) | ((d8 & 0x7f) << 2) | ((d8_l & 0x60) >> 5);
        var chr = _CFG_CHROMA[modes.chrome].COL_num;

        // Draw pixels including one pixel to the left and to the right of hires byte.
        for (var x = col * 7 - 1; x < col * 7 + 8; x++) {
            if (x >= 0 && x < 280 && y < (modes.mix?160:192))
            {
                if(chr) ctx.fillStyle = b & 0x02 != 0 ? chr : loresCols[0][0];
                else ctx.fillStyle = this.hgr_PixelColor( x, y, b & 0x01, b & 0x02, b & 0x04, d8 & 0x80);
                //                                   x  y  left pix  this pix  right pix bit7
                ctx.fillRect(x * 2, y * 2, 2, 2);    // Draw the pixel.
            }
            //hgr_drawPixel(x, y, b & 0x01, b & 0x02, b & 0x04, d8 & 0x80);
            b >>= 1;
        }
    }

}
