//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_CARD_80col.js


// ABOUT SPECIAL SOFT SWITCH OPERATION
// https://retrocomputing.stackexchange.com/questions/5056/why-are-some-soft-switches-on-the-apple-ii-only-triggered-with-a-write
// ABOUT ROMS
// https://www.wiseowl.com/articles/a2fpga-videx-01-the-card-that-made-the-apple-ii-serious/?utm_source=chatgpt.com

if(oEMU===undefined) var oEMU = {"component":{"IO":{"col80card":new col80card()}}}
else oEMU.component.IO.col80card= new col80card();

function col80card()
{
    const bDebug = false;
    var videx = this;

    this.id = {
         "PCODE":"VIDEX"
        ,"icon":"fa fa-tv"
        ,"description":"Videx VideoTerm 80 Column Display"
    };

    /*
     * Keep hardware state serialisable. The ROM/VRAM/CRTC arrays remain private
     * implementation data and are exposed to the later video-device layer only
     * through accessor methods below.
     */
    var state = {
         "active":true
        ,"vramBank":0
        ,"cellWidth":9
        ,"crtcIndex":0
        ,"charRomKey":"VIDEX:NORMAL"
        ,"inverseVideoMode":"off"
        ,"videoRevision":0
    };
    this.state = state;

    /*
     * Video output is an attached device rather than renderer code embedded in
     * the peripheral. Apple2IO binds this MUX back to the mounted card instance.
     */
    this.deviceConfig = [
        {
             "DCODE":"VIDEXVID"
            ,"hostPCODE":"VIDEX"
            ,"coID":"VidexVideoMUX"
            ,"alias":"VidexVideo"
            ,"icon":"fa fa-tv"
            ,"description":"Videx VideoTerm video output"
            ,"range":"HostROM"
            ,"action":{}
        }
        ,{
             "DCODE":"VIDEXTXT"
            ,"hostPCODE":"VIDEX"
            ,"coID":"VidexVideoMUX"
            ,"icon":"fa fa-keyboard"
            ,"description":"Videx VideoTerm Unicode text input"
        }
    ];


    // Four 512-byte pages = the physical 2 KiB VideoTerm display RAM.
    var vram = new Uint8Array(0x800);

    // Hitachi HD46505 / Motorola MC6845-compatible register file.
    var crtc = new Uint8Array(18);

    /*
     * One physical 1 KiB U3 firmware ROM is decoded into two CPU-visible views:
     *
     *   $C800-$CBFF -> ROM offsets $000-$3FF  (complete image, while C8 owned)
     *   $C300-$C3FF -> ROM offsets $300-$3FF  (slot-3 alias; also claims C8)
     */
    const VIDEX_FIRMWARE_ROM_SIZE    = 0x400;
    const VIDEX_C8_ROM_PHYS_OFFSET   = 0x000;
    const VIDEX_C8_ROM_WINDOW_SIZE   = 0x400;
    const VIDEX_SLOT_ROM_PHYS_OFFSET = 0x300;
    const VIDEX_SLOT_ROM_WINDOW_SIZE = 0x100;

    const VIDEX_FIRMWARE_ROM = new Uint8Array([
    0xAD,0x7B,0x07,0x29,0xF8,0xC9,0x30,0xF0,
    0x21,0xA9,0x30,0x8D,0x7B,0x07,0x8D,0xFB,
    0x07,0xA9,0x00,0x8D,0xFB,0x06,0x20,0x61,
    0xC9,0xA2,0x00,0x8A,0x8D,0xB0,0xC0,0xBD,
    0xA1,0xC8,0x8D,0xB1,0xC0,0xE8,0xE0,0x10,
    0xD0,0xF1,0x8D,0x59,0xC0,0x60,0xAD,0xFB,
    0x07,0x29,0x08,0xF0,0x09,0x20,0x93,0xFE,
    0x20,0x22,0xFC,0x20,0x89,0xFE,0x68,0xA8,
    0x68,0xAA,0x68,0x60,0x20,0xD1,0xC8,0xE6,
    0x4E,0xD0,0x02,0xE6,0x4F,0xAD,0x00,0xC0,
    0x10,0xF5,0x20,0x5C,0xC8,0x90,0xF0,0x2C,
    0x10,0xC0,0x18,0x60,0xC9,0x8B,0xD0,0x02,
    0xA9,0xDB,0xC9,0x81,0xD0,0x0A,0xAD,0xFB,
    0x07,0x49,0x40,0x8D,0xFB,0x07,0xB0,0xE7,
    0x48,0xAD,0xFB,0x07,0x0A,0x0A,0x68,0x90,
    0x1F,0xC9,0xB0,0x90,0x1B,0x2C,0x63,0xC0,
    0x30,0x14,0xC9,0xB0,0xF0,0x0E,0xC9,0xC0,
    0xD0,0x02,0xA9,0xD0,0xC9,0xDB,0x90,0x08,
    0x29,0xCF,0xD0,0x04,0xA9,0xDD,0x09,0x20,
    0x48,0x29,0x7F,0x8D,0x7B,0x06,0x68,0x38,
    0x60,0x7B,0x50,0x5E,0x29,0x1B,0x08,0x18,
    0x19,0x00,0x08,0xE0,0x08,0x00,0x00,0x00,
    0x00,0x8D,0x7B,0x06,0xA5,0x25,0xCD,0xFB,
    0x05,0xF0,0x06,0x8D,0xFB,0x05,0x20,0x04,
    0xCA,0xA5,0x24,0xCD,0x7B,0x05,0x90,0x03,
    0x8D,0x7B,0x05,0xAD,0x7B,0x06,0x20,0x89,
    0xCA,0xA9,0x0F,0x8D,0xB0,0xC0,0xAD,0x7B,
    0x05,0xC9,0x50,0xB0,0x13,0x6D,0x7B,0x04,
    0x8D,0xB1,0xC0,0xA9,0x0E,0x8D,0xB0,0xC0,
    0xA9,0x00,0x6D,0xFB,0x04,0x8D,0xB1,0xC0,
    0x60,0x49,0xC0,0xC9,0x08,0xB0,0x1D,0xA8,
    0xA9,0xC9,0x48,0xB9,0xF2,0xCB,0x48,0x60,
    0xEA,0xAC,0x7B,0x05,0xA9,0xA0,0x20,0x71,
    0xCA,0xC8,0xC0,0x50,0x90,0xF8,0x60,0xA9,
    0x34,0x8D,0x7B,0x07,0x60,0xA9,0x32,0xD0,
    0xF8,0xA0,0xC0,0xA2,0x80,0xCA,0xD0,0xFD,
    0xAD,0x30,0xC0,0x88,0xD0,0xF5,0x60,0xAC,
    0x7B,0x05,0xC0,0x50,0x90,0x05,0x48,0x20,
    0xB0,0xC9,0x68,0xAC,0x7B,0x05,0x20,0x71,
    0xCA,0xEE,0x7B,0x05,0x2C,0x78,0x04,0x10,
    0x07,0xAD,0x7B,0x05,0xC9,0x50,0xB0,0x68,
    0x60,0xAC,0x7B,0x05,0xAD,0xFB,0x05,0x48,
    0x20,0x07,0xCA,0x20,0x04,0xC9,0xA0,0x00,
    0x68,0x69,0x00,0xC9,0x18,0x90,0xF0,0xB0,
    0x23,0x20,0x67,0xC9,0x98,0xF0,0xE8,0xA9,
    0x00,0x8D,0x7B,0x05,0x8D,0xFB,0x05,0xA8,
    0xF0,0x12,0xCE,0x7B,0x05,0x10,0x9D,0xA9,
    0x4F,0x8D,0x7B,0x05,0xAD,0xFB,0x05,0xF0,
    0x93,0xCE,0xFB,0x05,0x4C,0x04,0xCA,0xA9,
    0x30,0x8D,0x7B,0x07,0x68,0x09,0x80,0xC9,
    0xB1,0xD0,0x67,0xA9,0x08,0x8D,0x58,0xC0,
    0xD0,0x5B,0xC9,0xB2,0xD0,0x51,0xA9,0xFE,
    0x2D,0xFB,0x07,0x8D,0xFB,0x07,0x60,0x8D,
    0x7B,0x06,0x4E,0x78,0x04,0x4C,0xCB,0xC8,
    0x20,0x27,0xCA,0xEE,0xFB,0x05,0xAD,0xFB,
    0x05,0xC9,0x18,0x90,0x4A,0xCE,0xFB,0x05,
    0xAD,0xFB,0x06,0x69,0x04,0x29,0x7F,0x8D,
    0xFB,0x06,0x20,0x12,0xCA,0xA9,0x0D,0x8D,
    0xB0,0xC0,0xAD,0x7B,0x04,0x8D,0xB1,0xC0,
    0xA9,0x0C,0x8D,0xB0,0xC0,0xAD,0xFB,0x04,
    0x8D,0xB1,0xC0,0xA9,0x17,0x20,0x07,0xCA,
    0xA0,0x00,0x20,0x04,0xC9,0xB0,0x95,0xC9,
    0xB3,0xD0,0x0E,0xA9,0x01,0x0D,0xFB,0x07,
    0xD0,0xA9,0xC9,0xB0,0xD0,0x9C,0x4C,0x09,
    0xC8,0x4C,0x27,0xC9,0xAD,0xFB,0x05,0x8D,
    0xF8,0x04,0x0A,0x0A,0x6D,0xF8,0x04,0x6D,
    0xFB,0x06,0x48,0x4A,0x4A,0x4A,0x4A,0x8D,
    0xFB,0x04,0x68,0x0A,0x0A,0x0A,0x0A,0x8D,
    0x7B,0x04,0x60,0xC9,0x0D,0xD0,0x06,0xA9,
    0x00,0x8D,0x7B,0x05,0x60,0x09,0x80,0xC9,
    0xA0,0xB0,0xCE,0xC9,0x87,0x90,0x08,0xA8,
    0xA9,0xC9,0x48,0xB9,0xB9,0xC9,0x48,0x60,
    0x18,0x71,0x13,0xB2,0x48,0x60,0xAF,0x9D,
    0xF2,0x13,0x13,0x13,0x13,0x13,0x13,0x13,
    0x13,0x13,0x66,0x0E,0x13,0x38,0x00,0x14,
    0x7B,0x18,0x98,0x6D,0x7B,0x04,0x48,0xA9,
    0x00,0x6D,0xFB,0x04,0x48,0x0A,0x29,0x0C,
    0xAA,0xBD,0xB0,0xC0,0x68,0x4A,0x68,0xAA,
    0x60,0x0A,0x48,0xAD,0xFB,0x07,0x4A,0x68,
    0x6A,0x48,0x20,0x59,0xCA,0x68,0xB0,0x05,
    0x9D,0x00,0xCC,0x90,0x03,0x9D,0x00,0xCD,
    0x60,0x48,0xA9,0xF7,0x20,0xA0,0xC9,0x8D,
    0x59,0xC0,0xAD,0x7B,0x07,0x29,0x07,0xD0,
    0x04,0x68,0x4C,0x23,0xCA,0x29,0x04,0xF0,
    0x03,0x4C,0x87,0xC9,0x68,0x38,0xE9,0x20,
    0x29,0x7F,0x48,0xCE,0x7B,0x07,0xAD,0x7B,
    0x07,0x29,0x03,0xD0,0x15,0x68,0xC9,0x18,
    0xB0,0x03,0x8D,0xFB,0x05,0xAD,0xF8,0x05,
    0xC9,0x50,0xB0,0x03,0x8D,0x7B,0x05,0x4C,
    0x04,0xCA,0x68,0x8D,0xF8,0x05,0x60,0xAD,
    0x00,0xC0,0xC9,0x93,0xD0,0x0F,0x2C,0x10,
    0xC0,0xAD,0x00,0xC0,0x10,0xFB,0xC9,0x83,
    0xF0,0x03,0x2C,0x10,0xC0,0x60,0xA8,0xB9,
    0x31,0xCB,0x20,0xF1,0xC8,0x20,0x44,0xC8,
    0xC9,0xCE,0xB0,0x08,0xC9,0xC9,0x90,0x04,
    0xC9,0xCC,0xD0,0xEA,0x4C,0xF1,0xC8,0xEA,
    0x2C,0xCB,0xFF,0x70,0x31,0x38,0x90,0x18,
    0xB8,0x50,0x2B,0x01,0x82,0x11,0x14,0x1C,
    0x22,0x4C,0x00,0xC8,0x20,0x44,0xC8,0x29,
    0x7F,0xA2,0x00,0x60,0x20,0xA7,0xC9,0xA2,
    0x00,0x60,0xC9,0x00,0xF0,0x09,0xAD,0x00,
    0xC0,0x0A,0x90,0x03,0x20,0x5C,0xC8,0xA2,
    0x00,0x60,0x91,0x28,0x38,0xB8,0x8D,0xFF,
    0xCF,0x48,0x85,0x35,0x8A,0x48,0x98,0x48,
    0xA5,0x35,0x86,0x35,0xA2,0xC3,0x8E,0x78,
    0x04,0x48,0x50,0x10,0xA9,0x32,0x85,0x38,
    0x86,0x39,0xA9,0x07,0x85,0x36,0x86,0x37,
    0x20,0x00,0xC8,0x18,0x90,0x6F,0x68,0xA4,
    0x35,0xF0,0x1F,0x88,0xAD,0x78,0x06,0xC9,
    0x88,0xF0,0x17,0xD9,0x00,0x02,0xF0,0x12,
    0x49,0x20,0xD9,0x00,0x02,0xD0,0x3B,0xAD,
    0x78,0x06,0x99,0x00,0x02,0xB0,0x03,0x20,
    0xED,0xCA,0xA9,0x80,0x20,0xF5,0xC9,0x20,
    0x44,0xC8,0xC9,0x9B,0xF0,0xF1,0xC9,0x8D,
    0xD0,0x05,0x48,0x20,0x01,0xC9,0x68,0xC9,
    0x95,0xD0,0x12,0xAC,0x7B,0x05,0x20,0x59,
    0xCA,0xB0,0x05,0xBD,0x00,0xCC,0x90,0x03,
    0xBD,0x00,0xCD,0x09,0x80,0x8D,0x78,0x06,
    0xD0,0x08,0x20,0x44,0xC8,0xA0,0x00,0x8C,
    0x78,0x06,0xBA,0xE8,0xE8,0xE8,0x9D,0x00,
    0x01,0xA9,0x00,0x85,0x24,0xAD,0xFB,0x05,
    0x85,0x25,0x4C,0x2E,0xC8,0x68,0xAC,0xFB,
    0x07,0x10,0x08,0xAC,0x78,0x06,0xC0,0xE0,
    0x90,0x01,0x98,0x20,0xB1,0xC8,0x20,0xCF,
    0xCA,0xA9,0x7F,0x20,0xA0,0xC9,0xAD,0x7B,
    0x05,0xE9,0x47,0x90,0xD4,0x69,0x1F,0x18,
    0x90,0xD1,0x60,0x38,0x71,0xB2,0x7B,0x00,
    0x48,0x66,0xC4,0xC2,0xC1,0xFF,0xC3,0xEA
    ]);

      // Standard U20 2 KiB character-generator ROM; not CPU-addressable.
    const VIDEX_CHAR_ROM_NORMAL = new Uint8Array([
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0xFF,0xFF,0xFF,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0xFF,0xFF,0xFF,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0xFF,0xFF,
    0xFF,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0xFF,0xFF,0xFF,0x00,0x00,0x00,0xFF,0xFF,
    0xFF,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0xFF,0xFF,0xFF,0xFF,0xFF,
    0xFF,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,
    0xFF,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0xE0,0x90,0xE0,0x9E,0xF0,0x0C,0x02,0x1C,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x90,0x90,0xF0,0x90,0xBE,0x08,0x08,0x08,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x80,0x80,0x80,0x9E,0xF0,0x18,0x10,0x10,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x88,0x88,0x50,0x20,0x3E,0x08,0x08,0x08,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0xF0,0x80,0xC0,0x9E,0x90,0x18,0x10,0x10,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x70,0x80,0x80,0x7C,0x12,0x1C,0x14,0x12,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x70,0x80,0x60,0x10,0xEC,0x12,0x12,0x0C,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x70,0x80,0x60,0x1E,0xE4,0x04,0x04,0x0E,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x08,0x08,0x08,0x08,0x08,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x0F,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x08,0x08,0x08,0x08,0x0F,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x08,0x08,0x08,0x08,
    0x08,0x08,0x08,0x08,0x08,0x08,0x08,0x08,
    0x08,0x08,0x08,0x08,0x08,0x08,0x08,0x08,
    0x08,0x08,0x08,0x08,0x08,0x08,0x08,0x08,
    0x00,0x00,0x00,0x00,0x0F,0x08,0x08,0x08,
    0x08,0x08,0x08,0x08,0x08,0x08,0x08,0x08,
    0x08,0x08,0x08,0x08,0x0F,0x08,0x08,0x08,
    0x08,0x08,0x08,0x08,0x08,0x08,0x08,0x08,
    0x00,0x00,0x00,0x00,0xF8,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x08,0x08,0x08,0x08,0xF8,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0xFF,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x08,0x08,0x08,0x08,0xFF,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0xF8,0x08,0x08,0x08,
    0x08,0x08,0x08,0x08,0x08,0x08,0x08,0x08,
    0x08,0x08,0x08,0x08,0xF8,0x08,0x08,0x08,
    0x08,0x08,0x08,0x08,0x08,0x08,0x08,0x08,
    0x00,0x00,0x00,0x00,0xFF,0x08,0x08,0x08,
    0x08,0x08,0x08,0x08,0x08,0x08,0x08,0x08,
    0x08,0x08,0x08,0x08,0xFF,0x08,0x08,0x08,
    0x08,0x08,0x08,0x08,0x08,0x08,0x08,0x08,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x18,0x18,0x18,0x18,0x18,0x00,0x18,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x36,0x36,0x12,0x24,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x24,0x24,0x7E,0x24,0x7E,0x24,0x24,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x08,0x3E,0x48,0x3C,0x12,0x7C,0x10,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x62,0x94,0x68,0x10,0x2C,0x52,0x8C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x20,0x50,0x50,0x62,0x94,0x88,0x76,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x18,0x18,0x08,0x10,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x0C,0x10,0x20,0x20,0x20,0x10,0x0C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x30,0x08,0x04,0x04,0x04,0x08,0x30,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x10,0x92,0x54,0x38,0x54,0x92,0x10,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x10,0x10,0xFE,0x10,0x10,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x18,0x18,0x08,0x10,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x7E,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x18,0x18,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x38,0x44,0x8A,0x92,0xA2,0x44,0x38,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x08,0x38,0x08,0x08,0x08,0x08,0x3E,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x3C,0x42,0x02,0x1C,0x20,0x40,0x7E,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x7E,0x04,0x08,0x1C,0x02,0x42,0x3C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x04,0x0C,0x14,0x24,0x7E,0x04,0x04,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x7E,0x40,0x7C,0x02,0x02,0x42,0x3C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x1E,0x20,0x40,0x7C,0x42,0x42,0x3C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x7E,0x02,0x04,0x08,0x10,0x20,0x20,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x3C,0x42,0x42,0x3C,0x42,0x42,0x3C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x3C,0x42,0x42,0x3E,0x02,0x04,0x78,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x18,0x18,0x00,0x18,0x18,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x18,0x18,0x00,0x18,0x18,0x08,0x10,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x06,0x18,0x60,0x18,0x06,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x7E,0x00,0x7E,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x60,0x18,0x06,0x18,0x60,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x3C,0x42,0x02,0x0C,0x10,0x00,0x10,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x3C,0x42,0x9A,0xAA,0x94,0x40,0x3C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x18,0x24,0x42,0x42,0x7E,0x42,0x42,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x7C,0x42,0x42,0x7C,0x42,0x42,0x7C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x1C,0x22,0x40,0x40,0x40,0x22,0x1C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x78,0x44,0x42,0x42,0x42,0x44,0x78,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x7E,0x40,0x40,0x78,0x40,0x40,0x7E,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x7E,0x40,0x40,0x78,0x40,0x40,0x40,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x1C,0x22,0x40,0x4E,0x42,0x22,0x1E,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x42,0x42,0x42,0x7E,0x42,0x42,0x42,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x1C,0x08,0x08,0x08,0x08,0x08,0x1C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x0E,0x04,0x04,0x04,0x04,0x44,0x38,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x42,0x44,0x48,0x50,0x68,0x44,0x42,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x40,0x40,0x40,0x40,0x40,0x40,0x7E,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x82,0xC6,0xAA,0x92,0x82,0x82,0x82,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x42,0x62,0x52,0x4A,0x46,0x42,0x42,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x38,0x44,0x82,0x82,0x82,0x44,0x38,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x7C,0x42,0x42,0x7C,0x40,0x40,0x40,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x38,0x44,0x82,0x82,0x8A,0x44,0x3A,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x7C,0x42,0x42,0x7C,0x48,0x44,0x42,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x3C,0x42,0x40,0x3C,0x02,0x42,0x3C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0xFE,0x10,0x10,0x10,0x10,0x10,0x10,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x42,0x42,0x42,0x42,0x42,0x42,0x3C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x82,0x82,0x44,0x44,0x28,0x28,0x10,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x82,0x82,0x82,0x82,0x92,0xAA,0x44,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x82,0x44,0x28,0x10,0x28,0x44,0x82,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x82,0x44,0x28,0x10,0x10,0x10,0x10,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0xFE,0x04,0x08,0x10,0x20,0x40,0xFE,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x3E,0x30,0x30,0x30,0x30,0x30,0x3E,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x80,0x40,0x20,0x10,0x08,0x04,0x02,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x3E,0x06,0x06,0x06,0x06,0x06,0x3E,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x08,0x1C,0x2A,0x08,0x08,0x08,0x08,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xFE,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x18,0x18,0x10,0x08,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0xF8,0x04,0x7C,0x84,0x7A,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x40,0x40,0x7C,0x42,0x42,0x42,0x7C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x3C,0x42,0x40,0x40,0x3E,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x02,0x02,0x3E,0x42,0x42,0x42,0x3E,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x3C,0x42,0x7E,0x40,0x3C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x1C,0x22,0x20,0x78,0x20,0x20,0x20,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x02,0x3C,0x42,0x42,0x3E,0x02,0x42,
    0x3C,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x40,0x40,0x5C,0x62,0x42,0x42,0x42,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x08,0x00,0x08,0x08,0x08,0x08,0x08,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x04,0x00,0x04,0x04,0x04,0x04,0x04,0x24,
    0x18,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x40,0x40,0x46,0x58,0x60,0x58,0x46,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x18,0x08,0x08,0x08,0x08,0x08,0x1C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0xEC,0x92,0x92,0x92,0x92,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x5C,0x22,0x22,0x22,0x22,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x3C,0x42,0x42,0x42,0x3C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x7C,0x42,0x42,0x42,0x7C,0x40,
    0x40,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x3E,0x42,0x42,0x42,0x3E,0x02,
    0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x5C,0x62,0x40,0x40,0x40,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x3E,0x40,0x3C,0x02,0x7C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x10,0x3E,0x10,0x10,0x10,0x0E,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x44,0x44,0x44,0x44,0x3A,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x82,0x82,0x44,0x28,0x10,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x82,0x82,0x92,0xAA,0x44,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x42,0x24,0x18,0x24,0x42,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x82,0x82,0x44,0x28,0x10,0x20,
    0xC0,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x7E,0x04,0x18,0x20,0x7E,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x0C,0x10,0x08,0x30,0x08,0x10,0x0C,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x08,0x08,0x08,0x00,0x08,0x08,0x08,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x30,0x08,0x10,0x0C,0x10,0x08,0x30,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x60,0x92,0x0C,0x00,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x24,0x48,0x92,0x24,0x48,0x92,0x24,0x48,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00
    ]);

    /*
     * Character-generator ROM catalogue.
     *
     * The development ROM viewer keeps these images as named 8x16 ROM sets.
     * Keep the same metadata here, but decode non-default images lazily so the
     * emulator does not allocate eleven extra Uint8Arrays at startup.
     *
     * The standard U20 image above remains the default and is not duplicated.
     * Selecting another entry emulates replacing the character-generator ROM.
     */
    function decodeCharacterROMHex(hex)
    {
        var clean = String(hex || "").replace(/[^0-9A-Fa-f]/g,"");

        if(clean.length != 0x1000)
            throw new Error("VideoTerm character ROM must contain exactly 2048 bytes");

        var out = new Uint8Array(0x800);
        for(var i=0;i<out.length;i++)
            out[i] = parseInt(clean.substr(i*2,2),16);

        return out;
    }

    /*
     * Unicode metadata for character-generator ROMs.
     *
     * Each 128-entry array is indexed directly by the 7-bit character code
     * selected by the VideoTerm renderer. Values are Unicode scalar values;
     * null means that no sufficiently reliable one-character mapping is known.
     *
     * The blank low-resolution/line-drawing cells map to SPACE. Control-code
     * mnemonics use Unicode Control Pictures. The national sets are derived
     * from the normal map and replace only the glyph positions that differ.
     */
    function emptyCharacterUnicodeMap()
    {
        var map = new Array(0x80);
        for(var i=0;i<map.length;i++)
            map[i] = null;
        return map;
    }

    function unicodeMapWithOverrides(base,overrides)
    {
        var map = base ? base.slice() : emptyCharacterUnicodeMap();

        for(var i=0;overrides && i<overrides.length;i++)
        {
            var pair = overrides[i];
            map[pair[0] & 0x7F] = pair[1];
        }

        return map;
    }

    function makeNormalUnicodeMap()
    {
        var map = emptyCharacterUnicodeMap();

        // CTRL-@..CTRL-G: VideoTerm low-resolution graphics.
        map[0x00] = 0x0020;     // blank cell -> SPACE
        map[0x01] = 0x1FB02;    // upper one third block
        map[0x02] = 0x1FB0B;    // middle one third block
        map[0x03] = 0x1FB0E;    // upper two thirds block
        map[0x04] = 0x1FB2D;    // lower one third block
        map[0x05] = 0x1FB30;    // upper and lower one third block
        map[0x06] = 0x1FB39;    // lower two thirds block
        map[0x07] = 0x2588;     // full block

        // CTRL-H..CTRL-O: the ROM displays the control abbreviation.
        for(var i=0x08;i<=0x0F;i++)
            map[i] = 0x2400 + i;

        // CTRL-P..CTRL-_ line-drawing set.
        map[0x10] = 0x0020;     // blank line-drawing cell -> SPACE
        map[0x11] = 0x2575;     // box drawings light up
        map[0x12] = 0x2576;     // box drawings light right
        map[0x13] = 0x2514;     // box drawings light up and right
        map[0x14] = 0x2577;     // box drawings light down
        map[0x15] = 0x2502;     // box drawings light vertical
        map[0x16] = 0x250C;     // box drawings light down and right
        map[0x17] = 0x251C;     // box drawings light vertical and right
        map[0x18] = 0x2574;     // box drawings light left
        map[0x19] = 0x2518;     // box drawings light up and left
        map[0x1A] = 0x2500;     // box drawings light horizontal
        map[0x1B] = 0x2534;     // box drawings light up and horizontal
        map[0x1C] = 0x2510;     // box drawings light down and left
        map[0x1D] = 0x2524;     // box drawings light vertical and left
        map[0x1E] = 0x252C;     // box drawings light down and horizontal
        map[0x1F] = 0x253C;     // box drawings light vertical and horizontal

        for(var code=0x20;code<=0x7E;code++)
            map[code] = code;

        map[0x7F] = 0x1FB95;    // checker board fill
        return map;
    }

    function makeSupSubUnicodeMap()
    {
        var map = emptyCharacterUnicodeMap();

        /*
         * The ROM contains many special symbols in $00-$1F. Keep uncertain
         * symbols null, but map the ones whose bitmap identity is unambiguous.
         */
        map[0x00] = 0x25A1;     // white square
        map[0x09] = 0x2192;     // rightwards arrow
        map[0x0A] = 0x2261;     // identical to
        map[0x0B] = 0x2193;     // downwards arrow
        map[0x0D] = 0x2190;     // leftwards arrow
        map[0x17] = 0x22A3;     // left tack
        map[0x1B] = 0x0398;     // Greek capital theta

        var superscriptDigits = [
             0x2070,0x00B9,0x00B2,0x00B3,0x2074
            ,0x2075,0x2076,0x2077,0x2078,0x2079
        ];
        var subscriptDigits = [
             0x2080,0x2081,0x2082,0x2083,0x2084
            ,0x2085,0x2086,0x2087,0x2088,0x2089
        ];

        for(var digit=0;digit<10;digit++)
        {
            map[0x20+digit] = superscriptDigits[digit];
            map[0x30+digit] = subscriptDigits[digit];
        }

        // Punctuation is vertically displaced in the ROM; use its semantics.
        map[0x2A] = 0x003A;     // :
        map[0x2B] = 0x003B;     // ;
        map[0x2C] = 0x002C;     // ,
        map[0x2D] = 0x207B;     // superscript minus
        map[0x2E] = 0x002E;     // .
        map[0x2F] = 0x002F;     // /
        map[0x3A] = 0x003A;     // :
        map[0x3B] = 0x003B;     // ;
        map[0x3C] = 0x002C;     // ,
        map[0x3D] = 0x208B;     // subscript minus
        map[0x3E] = 0x002E;     // .
        map[0x3F] = 0x002F;     // /

        map[0x40] = 0x2033;     // double prime

        /*
         * Unicode has no complete superscript/subscript Latin alphabet.
         * Preserve the letter identity with base Latin capitals; the ROM
         * bitmap remains authoritative for its vertical presentation.
         */
        for(var letter=0;letter<26;letter++)
        {
            map[0x41+letter] = 0x0041 + letter;
            map[0x61+letter] = 0x0041 + letter;
        }

        map[0x5B] = 0x222B;     // integral
        map[0x5C] = 0x00AE;     // registered sign
        map[0x5D] = 0x007C;     // vertical line
        map[0x5E] = 0x00A9;     // copyright sign
        map[0x5F] = 0x005F;     // low line
        map[0x60] = 0x00B0;     // degree sign
        map[0x7B] = 0x00A7;     // section sign
        map[0x7C] = 0x00B6;     // pilcrow sign
        map[0x7D] = 0x2020;     // dagger
        map[0x7E] = 0x2122;     // trade mark sign
        map[0x7F] = 0x208C;     // subscript equals sign

        return map;
    }

    const VIDEX_UNICODE_NORMAL = makeNormalUnicodeMap();

    const VIDEX_UNICODE_NORMAL_UP = VIDEX_UNICODE_NORMAL.slice();
    for(var normalUpLetter=0;normalUpLetter<26;normalUpLetter++)
        VIDEX_UNICODE_NORMAL_UP[0x61+normalUpLetter] =
            0x41+normalUpLetter;

    const VIDEX_UNICODE_FRENCH =
        unicodeMapWithOverrides(VIDEX_UNICODE_NORMAL,[
             [0x23,0x00A3]     // £
            ,[0x3C,0x00B2]     // ²
            ,[0x3E,0x00B3]     // ³
            ,[0x40,0x00E0]     // à
            ,[0x5C,0x00E7]     // ç
            ,[0x7B,0x00E9]     // é
            ,[0x7C,0x00F9]     // ù
            ,[0x7D,0x00E8]     // è
            ,[0x7E,0x00A8]     // ¨
            ,[0x7F,0x00B0]     // °
        ]);

    const VIDEX_UNICODE_GERMAN =
        unicodeMapWithOverrides(VIDEX_UNICODE_NORMAL,[
             [0x40,0x00A7]     // §
            ,[0x5B,0x00C4]     // Ä
            ,[0x5C,0x00D6]     // Ö
            ,[0x5D,0x00DC]     // Ü
            ,[0x7B,0x00E4]     // ä
            ,[0x7C,0x00F6]     // ö
            ,[0x7D,0x00FC]     // ü
            ,[0x7E,0x00DF]     // ß
        ]);

    const VIDEX_UNICODE_SPANISH =
        unicodeMapWithOverrides(VIDEX_UNICODE_NORMAL,[
             [0x40,0x00BF]     // ¿
            ,[0x5C,0x00FC]     // ü
            ,[0x5F,0x00A1]     // ¡
            ,[0x60,0x00F1]     // ñ
            ,[0x7B,0x00E1]     // á
            ,[0x7C,0x00E9]     // é
            ,[0x7D,0x00ED]     // í
            ,[0x7E,0x00F3]     // ó
            ,[0x7F,0x00FA]     // ú
        ]);

    /*
     * The Katakana EPROM is a mixed Latin/Katakana character set rather than
     * JIS X 0201 byte order. Start with the normal VideoTerm semantics and
     * replace only cells whose actual ROM glyph differs.
     *
     * Use the Unicode halfwidth Katakana forms because they represent the
     * narrow single-cell repertoire of this ROM without implying a fullwidth
     * presentation. A few ASCII punctuation glyphs are relocated by the ROM.
     *
     * Note that $40 and $67 contain effectively the same KA glyph in this ROM;
     * both therefore map to HALFWIDTH KATAKANA LETTER KA.
     */
    const VIDEX_UNICODE_KATAKANA =
        unicodeMapWithOverrides(VIDEX_UNICODE_NORMAL,[
             [0x21,0xFF8A]     // ﾊ  halfwidth HA
            ,[0x22,0xFF9E]     // ﾞ   halfwidth voiced sound mark
            ,[0x23,0x0029]     // )   right parenthesis
            ,[0x26,0xFF7E]     // ｾ  halfwidth SE
            ,[0x27,0xFF9F]     // ﾟ   halfwidth semi-voiced sound mark
            ,[0x28,0xFF8B]     // ﾋ  halfwidth HI
            ,[0x29,0xFF92]     // ﾒ  halfwidth ME
            ,[0x2A,0xFF8C]     // ﾌ  halfwidth HU/FU
            ,[0x2F,0xFF99]     // ﾙ  halfwidth RU
            ,[0x3A,0xFF6F]     // ｯ  halfwidth small TU/TSU
            ,[0x3C,0xFF8F]     // ﾏ  halfwidth MA
            ,[0x3D,0x00A5]     // ¥   yen sign
            ,[0x3E,0xFF88]     // ﾈ  halfwidth NE
            ,[0x3F,0xFF7D]     // ｽ  halfwidth SU
            ,[0x40,0xFF76]     // ｶ  halfwidth KA
            ,[0x5B,0xFF90]     // ﾐ  halfwidth MI
            ,[0x5C,0xFF71]     // ｱ  halfwidth A
            ,[0x5D,0xFF9B]     // ﾛ  halfwidth RO
            ,[0x5E,0xFF89]     // ﾉ  halfwidth NO
            ,[0x5F,0xFF9F]     // ﾟ   halfwidth semi-voiced sound mark
            ,[0x60,0xFF9A]     // ﾚ  halfwidth RE
            ,[0x61,0xFF78]     // ｸ  halfwidth KU
            ,[0x62,0xFF96]     // ﾖ  halfwidth YO
            ,[0x63,0xFF73]     // ｳ  halfwidth U
            ,[0x64,0xFF83]     // ﾃ  halfwidth TE
            ,[0x65,0xFF86]     // ﾆ  halfwidth NI
            ,[0x66,0xFF93]     // ﾓ  halfwidth MO
            ,[0x67,0xFF76]     // ｶ  halfwidth KA (duplicate ROM glyph)
            ,[0x68,0xFF85]     // ﾅ  halfwidth NA
            ,[0x69,0xFF95]     // ﾕ  halfwidth YU
            ,[0x6A,0xFF87]     // ﾇ  halfwidth NU
            ,[0x6B,0xFF7F]     // ｿ  halfwidth SO
            ,[0x6C,0xFF7C]     // ｼ  halfwidth SI/SHI
            ,[0x6D,0xFF82]     // ﾂ  halfwidth TU/TSU
            ,[0x6E,0xFF7A]     // ｺ  halfwidth KO
            ,[0x6F,0xFF84]     // ﾄ  halfwidth TO
            ,[0x70,0xFF8E]     // ﾎ  halfwidth HO
            ,[0x71,0xFF9C]     // ﾜ  halfwidth WA
            ,[0x72,0xFF77]     // ｷ  halfwidth KI
            ,[0x73,0xFF81]     // ﾁ  halfwidth TI/CHI
            ,[0x74,0xFF75]     // ｵ  halfwidth O
            ,[0x75,0xFF98]     // ﾘ  halfwidth RI
            ,[0x76,0xFF9D]     // ﾝ  halfwidth N
            ,[0x77,0xFF91]     // ﾑ  halfwidth MU
            ,[0x78,0xFF72]     // ｲ  halfwidth I
            ,[0x79,0xFF94]     // ﾔ  halfwidth YA
            ,[0x7A,0xFF74]     // ｴ  halfwidth E
            ,[0x7B,0xFF66]     // ｦ  halfwidth WO
            ,[0x7C,0xFF97]     // ﾗ  halfwidth RA
            ,[0x7D,0xFF79]     // ｹ  halfwidth KE
            ,[0x7E,0x0028]     // (   left parenthesis
            ,[0x7F,0xFF8D]     // ﾍ  halfwidth HE
        ]);

    function makeAplUnicodeMap()
    {
        /*
         * The APL EPROM retains the normal VideoTerm graphics/control glyphs
         * in $00-$1F. The printable half follows the traditional APL layout,
         * with character positions taken from the glyphs actually in this ROM.
         */
        var map = VIDEX_UNICODE_NORMAL.slice();

        // Bit-paired punctuation and arithmetic/logical operators.
        map[0x21] = 0x00A8;     // ¨ diaeresis
        map[0x22] = 0x0029;     // )
        map[0x23] = 0x003C;     // <
        map[0x24] = 0x2264;     // ≤ less-than or equal
        map[0x25] = 0x003D;     // =
        map[0x26] = 0x003E;     // >
        map[0x27] = 0x005D;     // ]
        map[0x28] = 0x2228;     // ∨ logical or
        map[0x29] = 0x2227;     // ∧ logical and
        map[0x2A] = 0x2260;     // ≠
        map[0x2B] = 0x00F7;     // ÷
        map[0x2D] = 0x002B;     // +

        map[0x3A] = 0x0028;     // (
        map[0x3B] = 0x005B;     // [
        map[0x3C] = 0x003B;     // ;
        map[0x3D] = 0x00D7;     // ×
        map[0x3E] = 0x003A;     // :
        map[0x3F] = 0x005C;     // backslash

        // Core APL symbols.
        map[0x40] = 0x00AF;     // ¯ high minus / overbar
        map[0x41] = 0x237A;     // ⍺ alpha
        map[0x42] = 0x22A5;     // ⊥ up tack / decode
        map[0x43] = 0x2229;     // ∩ cap
        map[0x44] = 0x230A;     // ⌊ floor
        map[0x45] = 0x220A;     // ∊ epsilon
        map[0x46] = 0x005F;     // _ underbar
        map[0x47] = 0x2207;     // ∇ del
        map[0x48] = 0x2206;     // ∆ delta
        map[0x49] = 0x2373;     // ⍳ iota
        map[0x4A] = 0x2218;     // ∘ jot
        map[0x4B] = 0x0027;     // apostrophe
        map[0x4C] = 0x2395;     // ⎕ quad
        map[0x4D] = 0x007C;     // | stile
        map[0x4E] = 0x22A4;     // ⊤ down tack / encode
        map[0x4F] = 0x25CB;     // ○ circle
        map[0x50] = 0x002A;     // * star
        map[0x51] = 0x003F;     // ?
        map[0x52] = 0x2374;     // ⍴ rho
        map[0x53] = 0x2308;     // ⌈ ceiling
        map[0x54] = 0x007E;     // ~ not
        map[0x55] = 0x2193;     // ↓ drop
        map[0x56] = 0x222A;     // ∪ cup
        map[0x57] = 0x2375;     // ⍵ omega
        map[0x58] = 0x2283;     // ⊃ right shoe
        map[0x59] = 0x2191;     // ↑ take
        map[0x5A] = 0x2282;     // ⊂ left shoe
        map[0x5B] = 0x2190;     // ← assignment
        map[0x5C] = 0x22A2;     // ⊢ right tack
        map[0x5D] = 0x2192;     // → branch
        map[0x5E] = 0x2265;     // ≥ greater-than or equal
        map[0x5F] = 0x002D;     // - minus
        map[0x60] = 0x22C4;     // ⋄ diamond

        /*
         * This Videx ROM stores uppercase Latin glyphs at $61-$7A rather than
         * the lowercase ASCII glyphs used by the normal character ROM.
         */
        for(var letter=0;letter<26;letter++)
            map[0x61+letter] = 0x0041 + letter;

        // Final APL/punctuation positions; $7B and $7D remain { and }.
        map[0x7C] = 0x22A3;     // ⊣ left tack
        map[0x7E] = 0x0024;     // $
        map[0x7F] = 0x236A;     // ⍪ comma bar

        return map;
    }

    const VIDEX_UNICODE_SUPSUB = makeSupSubUnicodeMap();
    const VIDEX_UNICODE_APL = makeAplUnicodeMap();

    /*
     * APL and Symbol are intentionally omitted until their complete glyph
     * Katakana and Symbol are intentionally omitted until their complete
     * repertoires have been identified against authoritative tables.
     */
    const VIDEX_UNICODE_BY_ROM = {
         "VIDEX:NORMAL":VIDEX_UNICODE_NORMAL
        ,"VIDEX:NORMAL_UP":VIDEX_UNICODE_NORMAL_UP
        ,"VIDEX:APL":VIDEX_UNICODE_APL
        ,"VIDEX:FRENCH":VIDEX_UNICODE_FRENCH
        ,"VIDEX:GERMAN":VIDEX_UNICODE_GERMAN
        ,"VIDEX:SPANISH":VIDEX_UNICODE_SPANISH
        ,"VIDEX:KATAKANA":VIDEX_UNICODE_KATAKANA
        ,"VIDEX:SUP&SUB":VIDEX_UNICODE_SUPSUB
        ,"VIDEX:INVERSE":VIDEX_UNICODE_NORMAL
    };

    const VIDEX_CHAR_ROMS =
    [
        {
             "key":"VIDEX:NORMAL"
            ,"label":"Normal"
            ,"mirror":false
            ,"dsize":[8,16]
            ,"size":0x800
            ,"crc32":"87F89F08"
            ,"data":VIDEX_CHAR_ROM_NORMAL
        },
        {
             "key":"VIDEX:NORMAL_UP"
            ,"label":"Normal UP"
            ,"mirror":false
            ,"dsize":[8,16]
            ,"size":0x800
            ,"crc32":"3D94A7A4"
            ,"hex":
            "00000000000000000000000000000000FFFFFF00000000000000000000000000000000FFFFFF00000000000000000000FFFFFFFFFFFF00000000000000000000"
            +"000000000000FFFFFF00000000000000FFFFFF000000FFFFFF00000000000000000000FFFFFFFFFFFF00000000000000FFFFFFFFFFFFFFFFFF00000000000000"
            +"E090E09EF00C021C00000000000000009090F090BE08080800000000000000008080809EF01810100000000000000000888850203E0808080000000000000000"
            +"F080C09E9018101000000000000000007080807C121C1412000000000000000070806010EC12120C00000000000000007080601EE404040E0000000000000000"
            +"0000000000000000000000000000000008080808080000000000000000000000000000000F0000000000000000000000080808080F0000000000000000000000"
            +"0000000008080808080808080808080808080808080808080808080808080808000000000F0808080808080808080808080808080F0808080808080808080808"
            +"00000000F8000000000000000000000008080808F8000000000000000000000000000000FF000000000000000000000008080808FF0000000000000000000000"
            +"00000000F8080808080808080808080808080808F8080808080808080808080800000000FF080808080808080808080808080808FF0808080808080808080808"
            +"00000000000000000000000000000000181818181800180000000000000000003636122400000000000000000000000024247E247E2424000000000000000000"
            +"083E483C127C10000000000000000000629468102C528C0000000000000000002050506294887600000000000000000018180810000000000000000000000000"
            +"0C10202020100C0000000000000000003008040404083000000000000000000010925438549210000000000000000000001010FE101000000000000000000000"
            +"000000001818081000000000000000000000007E0000000000000000000000000000000000181800000000000000000002040810204080000000000000000000"
            +"38448A92A244380000000000000000000838080808083E0000000000000000003C42021C20407E0000000000000000007E04081C02423C000000000000000000"
            +"040C14247E04040000000000000000007E407C0202423C0000000000000000001E20407C42423C0000000000000000007E020408102020000000000000000000"
            +"3C42423C42423C0000000000000000003C42423E0204780000000000000000000018180018180000000000000000000000181800181808100000000000000000"
            +"0006186018060000000000000000000000007E007E0000000000000000000000006018061860000000000000000000003C42020C100010000000000000000000"
            +"3C429AAA94403C000000000000000000182442427E42420000000000000000007C42427C42427C0000000000000000001C22404040221C000000000000000000"
            +"784442424244780000000000000000007E40407840407E0000000000000000007E4040784040400000000000000000001C22404E42221E000000000000000000"
            +"4242427E4242420000000000000000001C08080808081C0000000000000000000E04040404443800000000000000000042444850684442000000000000000000"
            +"4040404040407E00000000000000000082C6AA928282820000000000000000004262524A46424200000000000000000038448282824438000000000000000000"
            +"7C42427C404040000000000000000000384482828A443A0000000000000000007C42427C4844420000000000000000003C42403C02423C000000000000000000"
            +"FE1010101010100000000000000000004242424242423C000000000000000000828244442828100000000000000000008282828292AA44000000000000000000"
            +"8244281028448200000000000000000082442810101010000000000000000000FE0408102040FE0000000000000000003E30303030303E000000000000000000"
            +"804020100804020000000000000000003E06060606063E000000000000000000081C2A0808080800000000000000000000000000000000FE0000000000000000"
            +"1818100800000000000000000000000000000814223E2200000000000000000000003C223C223C00000000000000000000001C2220221C000000000000000000"
            +"00003C2222223C00000000000000000000003E2038203E00000000000000000000003E2038202000000000000000000000001E2026221E000000000000000000"
            +"000022223E222200000000000000000000001C0808081C00000000000000000000000E0404241800000000000000000000002224283422000000000000000000"
            +"0000202020203E000000000000000000000022362A2222000000000000000000000022322A262200000000000000000000001C2222221C000000000000000000"
            +"00003C223C202000000000000000000000001C222A241A00000000000000000000003C223C242200000000000000000000001E201C023C000000000000000000"
            +"00003E080808080000000000000000000000222222221C00000000000000000000002222221408000000000000000000000022222A3622000000000000000000"
            +"000022140814220000000000000000000000221408080800000000000000000000003E0408103E0000000000000000000C10083008100C000000000000000000"
            +"080808000808080000000000000000003008100C10083000000000000000000060920C0000000000000000000000000024489224489224480000000000000000"
        },
        {
             "key":"VIDEX:APL"
            ,"label":"APL"
            ,"mirror":false
            ,"dsize":[8,16]
            ,"size":0x800
            ,"crc32":"1ADB704E"
            ,"hex":
            "00000000000000000000000000000000FFFFFF00000000000000000000000000000000FFFFFF00000000000000000000FFFFFFFFFFFF00000000000000000000"
            +"000000000000FFFFFF00000000000000FFFFFF000000FFFFFF00000000000000000000FFFFFFFFFFFF00000000000000FFFFFFFFFFFFFFFFFF00000000000000"
            +"E090E09EF00C021C00000000000000009090F090BE08080800000000000000008080809EF01810100000000000000000888850203E0808080000000000000000"
            +"F080C09E9018101000000000000000007080807C121C1412000000000000000070806010EC12120C00000000000000007080601EE404040E0000000000000000"
            +"0000000000000000000000000000000008080808080000000000000000000000000000000F0000000000000000000000080808080F0000000000000000000000"
            +"0000000008080808080808080808080808080808080808080808080808080808000000000F0808080808080808080808080808080F0808080808080808080808"
            +"00000000F8000000000000000000000008080808F8000000000000000000000000000000FF000000000000000000000008080808FF0000000000000000000000"
            +"00000000F8080808080808080808080808080808F8080808080808080808080800000000FF080808080808080808080808080808FF0808080808080808080808"
            +"00000000000000000000000000000000220000000000000000000000000000003008040404083000000000000000000000061860180600000000000000000000"
            +"0618601806007E0000000000000000000000FE00FE0000000000000000000000006018061860000000000000000000003E06060606063E000000000000000000"
            +"00824428100000000000000000000000001028448200000000000000000000000204FE10FE4080000000000000000000001000FE001000000000000000000000"
            +"00000000181808100000000000000000001010FE1010000000000000000000000000000000181800000000000000000002040810204080000000000000000000"
            +"38448A92A244380000000000000000000838080808083E0000000000000000003C42021C20407E0000000000000000007E04081C02423C000000000000000000"
            +"040C14247E04040000000000000000007E407C0202423C0000000000000000001E20407C42423C0000000000000000007E020408102020000000000000000000"
            +"3C42423C42423C0000000000000000003C42423E0204780000000000000000000C10202020100C0000000000000000003E30303030303E000000000000000000"
            +"00181800181808100000000000000000002214081422000000000000000000000018180018180000000000000000000080402010080402000000000000000000"
            +"FE00000000000000000000000000000000006294889462000000000000000000000010101010FE00000000000000000000003C42424200000000000000000000"
            +"1010101010101C00000000000000000000003E4078403E00000000000000000000007C0400000000FE000000000000000000FE44281000000000000000000000"
            +"0000102844FE000000000000000000000000180808080C0000000000000000000000182418000000000000000000000018180810000000000000000000000000"
            +"7E42424242427E000000000000000000080808080808080000000000000000000000FE1010101000000000000000000000007C8282827C000000000000000000"
            +"109254385492100000000000000000003C42020C10001000000000000000000000003C4242625C4040000000000000001C101010101010000000000000000000"
            +"000060920C0000000000000000000000080808082A1C0800000000000000000000004242423C000000000000000000000000448292926C000000000000000000"
            +"00007C02027C00000000000000000000081C2A0808080800000000000000000000007E80807E00000000000000000000002040FE402000000000000000000000"
            +"0040407E404000000000000000000000000804FE0408000000000000000000006018061860007E0000000000000000000000007E000000000000000000000000"
            +"10284482442810000000000000000000182442427E42420000000000000000007C42427C42427C0000000000000000001C22404040221C000000000000000000"
            +"784442424244780000000000000000007E40407840407E0000000000000000007E4040784040400000000000000000001C22404E42221E000000000000000000"
            +"4242427E4242420000000000000000001C08080808081C0000000000000000000E04040404443800000000000000000042444850684442000000000000000000"
            +"4040404040407E00000000000000000082C6AA928282820000000000000000004262524A46424200000000000000000038448282824438000000000000000000"
            +"7C42427C404040000000000000000000384482828A443A0000000000000000007C42427C4844420000000000000000003C42403C02423C000000000000000000"
            +"FE1010101010100000000000000000004242424242423C000000000000000000828244442828100000000000000000008282828292AA44000000000000000000"
            +"8244281028448200000000000000000082442810101010000000000000000000FE0408102040FE0000000000000000000C10083008100C000000000000000000"
            +"0002027E0202000000000000000000003008100C100830000000000000000000083E483C127C100000000000000000000000007E020200000000000000000000"
        },
        {
             "key":"VIDEX:FRENCH"
            ,"label":"French"
            ,"mirror":false
            ,"dsize":[8,16]
            ,"size":0x800
            ,"crc32":"266AA837"
            ,"hex":
            "00000000000000000000000000000000FFFFFF00000000000000000000000000000000FFFFFF00000000000000000000FFFFFFFFFFFF00000000000000000000"
            +"000000000000FFFFFF00000000000000FFFFFF000000FFFFFF00000000000000000000FFFFFFFFFFFF00000000000000FFFFFFFFFFFFFFFFFF00000000000000"
            +"E090E09EF00C021C00000000000000009090F090BE08080800000000000000008080809EF01810100000000000000000888850203E0808080000000000000000"
            +"F080C09E9018101000000000000000007080807C121C1412000000000000000070806010EC12120C00000000000000007080601EE404040E0000000000000000"
            +"0000000000000000000000000000000008080808080000000000000000000000000000000F0000000000000000000000080808080F0000000000000000000000"
            +"0000000008080808080808080808080808080808080808080808080808080808000000000F0808080808080808080808080808080F0808080808080808080808"
            +"00000000F8000000000000000000000008080808F8000000000000000000000000000000FF000000000000000000000008080808FF0000000000000000000000"
            +"00000000F8080808080808080808080808080808F8080808080808080808080800000000FF080808080808080808080808080808FF0808080808080808080808"
            +"0000000000000000000000000000000018181818180018000000000000000000363612240000000000000000000000001824207020227C000000000000000000"
            +"083E483C127C10000000000000000000629468102C528C0000000000000000002050506294887600000000000000000018180810000000000000000000000000"
            +"0C10202020100C0000000000000000003008040404083000000000000000000010925438549210000000000000000000001010FE101000000000000000000000"
            +"000000001818081000000000000000000000007E0000000000000000000000000000000000181800000000000000000002040810204080000000000000000000"
            +"38448A92A244380000000000000000000838080808083E0000000000000000003C42021C20407E0000000000000000007E04081C02423C000000000000000000"
            +"040C14247E04040000000000000000007E407C0202423C0000000000000000001E20407C42423C0000000000000000007E020408102020000000000000000000"
            +"3C42423C42423C0000000000000000003C42423E0204780000000000000000000018180018180000000000000000000000181800181808100000000000000000"
            +"380418203C000000000000000000000000007E007E0000000000000000000000380418043800000000000000000000003C42020C100010000000000000000000"
            +"4020F8047C847A000000000000000000182442427E42420000000000000000007C42427C42427C0000000000000000001C22404040221C000000000000000000"
            +"784442424244780000000000000000007E40407840407E0000000000000000007E4040784040400000000000000000001C22404E42221E000000000000000000"
            +"4242427E4242420000000000000000001C08080808081C0000000000000000000E04040404443800000000000000000042444850684442000000000000000000"
            +"4040404040407E00000000000000000082C6AA928282820000000000000000004262524A46424200000000000000000038448282824438000000000000000000"
            +"7C42427C404040000000000000000000384482828A443A0000000000000000007C42427C4844420000000000000000003C42403C02423C000000000000000000"
            +"FE1010101010100000000000000000004242424242423C000000000000000000828244442828100000000000000000008282828292AA44000000000000000000"
            +"8244281028448200000000000000000082442810101010000000000000000000FE0408102040FE0000000000000000003E30303030303E000000000000000000"
            +"00003C4240403E0810000000000000003E06060606063E00000000000000000008142200000000000000000000000000000000000000FE000000000000000000"
            +"181810080000000000000000000000000000F8047C847A00000000000000000040407C4242427C00000000000000000000003C4240403E000000000000000000"
            +"02023E4242423E00000000000000000000003C427E403C0000000000000000001C22207820202000000000000000000000023C42423E02423C00000000000000"
            +"40405C62424242000000000000000000080008080808080000000000000000000400040404040424180000000000000040404658605846000000000000000000"
            +"1808080808081C0000000000000000000000EC9292929200000000000000000000005C2222222200000000000000000000003C4242423C000000000000000000"
            +"00007C4242427C40400000000000000000003E4242423E02020000000000000000005C6240404000000000000000000000003E403C027C000000000000000000"
            +"00103E1010100E0000000000000000000000444444443A000000000000000000000082824428100000000000000000000000828292AA44000000000000000000"
            +"000042241824420000000000000000000000828244281020C00000000000000000007E0418207E00000000000000000004083C427E403C000000000000000000"
            +"2010444444443A00000000000000000020103C427E403C000000000000000000002400000000000000000000000000001C22221C000000000000000000000000"
        },
        {
             "key":"VIDEX:GERMAN"
            ,"label":"German"
            ,"mirror":false
            ,"dsize":[8,16]
            ,"size":0x800
            ,"crc32":"DF7324FA"
            ,"hex":
            "00000000000000000000000000000000FFFFFF00000000000000000000000000000000FFFFFF00000000000000000000FFFFFFFFFFFF00000000000000000000"
            +"000000000000FFFFFF00000000000000FFFFFF000000FFFFFF00000000000000000000FFFFFFFFFFFF00000000000000FFFFFFFFFFFFFFFFFF00000000000000"
            +"E090E09EF00C021C00000000000000009090F090BE08080800000000000000008080809EF01810100000000000000000888850203E0808080000000000000000"
            +"F080C09E9018101000000000000000007080807C121C1412000000000000000070806010EC12120C00000000000000007080601EE404040E0000000000000000"
            +"0000000000000000000000000000000008080808080000000000000000000000000000000F0000000000000000000000080808080F0000000000000000000000"
            +"0000000008080808080808080808080808080808080808080808080808080808000000000F0808080808080808080808080808080F0808080808080808080808"
            +"00000000F8000000000000000000000008080808F8000000000000000000000000000000FF000000000000000000000008080808FF0000000000000000000000"
            +"00000000F8080808080808080808080808080808F8080808080808080808080800000000FF080808080808080808080808080808FF0808080808080808080808"
            +"0000000000000000000000000000000000181818181800180000000000000000003636122400000000000000000000000024247E247E24240000000000000000"
            +"00083E483C127C10000000000000000000629468102C528C00000000000000000020505062948876000000000000000000181808100000000000000000000000"
            +"000C10202020100C0000000000000000003008040404083000000000000000000010925438549210000000000000000000001010FE1010000000000000000000"
            +"00000000001818081000000000000000000000007E00000000000000000000000000000000001818000000000000000000020408102040800000000000000000"
            +"0038448A92A244380000000000000000000838080808083E0000000000000000003C42021C20407E0000000000000000007E04081C02423C0000000000000000"
            +"00040C14247E04040000000000000000007E407C0202423C0000000000000000001E20407C42423C0000000000000000007E0204081020200000000000000000"
            +"003C42423C42423C0000000000000000003C42423E02047800000000000000000000181800181800000000000000000000001818001818081000000000000000"
            +"000006186018060000000000000000000000007E007E0000000000000000000000006018061860000000000000000000003C42020C1000100000000000000000"
            +"3844304844241844380000000000000000182442427E42420000000000000000007C42427C42427C0000000000000000001C22404040221C0000000000000000"
            +"00784442424244780000000000000000007E40407840407E0000000000000000007E4040784040400000000000000000001C22404E42221E0000000000000000"
            +"004242427E4242420000000000000000001C08080808081C0000000000000000000E040404044438000000000000000000424448506844420000000000000000"
            +"004040404040407E00000000000000000082C6AA928282820000000000000000004262524A464242000000000000000000384482828244380000000000000000"
            +"007C42427C404040000000000000000000384482828A443A0000000000000000007C42427C4844420000000000000000003C42403C02423C0000000000000000"
            +"00FE1010101010100000000000000000004242424242423C000000000000000000828244442828100000000000000000008282828292AA440000000000000000"
            +"008244281028448200000000000000000082442810101010000000000000000000FE0408102040FE000000000000000024001824427E42420000000000000000"
            +"44003844828244380000000000000000240042424242423C00000000000000000008142200000000000000000000000000000000000000FE0000000000000000"
            +"00181810080000000000000000000000000000F8047C847A00000000000000000040407C4242427C00000000000000000000003C4240403E0000000000000000"
            +"0002023E4242423E00000000000000000000003C427E403C0000000000000000001C22207820202000000000000000000000023C42423E027C00000000000000"
            +"0040405C624242420000000000000000000800080808080800000000000000000004000404040424180000000000000000404046586058460000000000000000"
            +"001808080808081C0000000000000000000000EC9292929200000000000000000000005C2222222200000000000000000000003C4242423C0000000000000000"
            +"0000007C42427C4040000000000000000000003E42423E0202000000000000000000005C6240404000000000000000000000003E403C027C0000000000000000"
            +"0000103E1010100E0000000000000000000000444444443A000000000000000000000082824428100000000000000000000000828292AA440000000000000000"
            +"00000042241824420000000000000000000000824428102040000000000000000000007E0418207E0000000000000000004800F8047C847A0000000000000000"
            +"0024003C4242423C0000000000000000002400444444443A0000000000000000003C42425C42525C400000000000000024489224489224480000000000000000"
        },
        {
             "key":"VIDEX:SPANISH"
            ,"label":"Spanish"
            ,"mirror":false
            ,"dsize":[8,16]
            ,"size":0x800
            ,"crc32":"439EAC08"
            ,"hex":
            "00000000000000000000000000000000FFFFFF00000000000000000000000000000000FFFFFF00000000000000000000FFFFFFFFFFFF00000000000000000000"
            +"000000000000FFFFFF00000000000000FFFFFF000000FFFFFF00000000000000000000FFFFFFFFFFFF00000000000000FFFFFFFFFFFFFFFFFF00000000000000"
            +"E090E09EF00C021C00000000000000009090F090BE08080800000000000000008080809EF01810100000000000000000888850203E0808080000000000000000"
            +"F080C09E9018101000000000000000007080807C121C1412000000000000000070806010EC12120C00000000000000007080601EE404040E0000000000000000"
            +"0000000000000000000000000000000008080808080000000000000000000000000000000F0000000000000000000000080808080F0000000000000000000000"
            +"0000000008080808080808080808080808080808080808080808080808080808000000000F0808080808080808080808080808080F0808080808080808080808"
            +"00000000F8000000000000000000000008080808F8000000000000000000000000000000FF000000000000000000000008080808FF0000000000000000000000"
            +"00000000F8080808080808080808080808080808F8080808080808080808080800000000FF080808080808080808080808080808FF0808080808080808080808"
            +"00000000000000000000000000000000181818181800180000000000000000002424240000000000000000000000000024247E247E2424000000000000000000"
            +"083E483C127C10000000000000000000629468102C528C0000000000000000002050506294887600000000000000000008080000000000000000000000000000"
            +"0C10202020100C0000000000000000003008040404083000000000000000000010925438549210000000000000000000001010FE101000000000000000000000"
            +"000000001818081000000000000000000000007E0000000000000000000000000000000000181800000000000000000002040810204080000000000000000000"
            +"38448A92A244380000000000000000000838080808083E0000000000000000003C42021C20407E0000000000000000007E04081C02423C000000000000000000"
            +"040C14247E04040000000000000000007E407C0202423C0000000000000000001E20407C42423C0000000000000000007E020408102020000000000000000000"
            +"3C42423C42423C0000000000000000003C42423E0204780000000000000000000018180018180000000000000000000000181800181808100000000000000000"
            +"0006186018060000000000000000000000007E007E0000000000000000000000006018061860000000000000000000003C42020C100010000000000000000000"
            +"000800083040423C0000000000000000182442427E42420000000000000000007C42427C42427C0000000000000000001C22404040221C000000000000000000"
            +"784442424244780000000000000000007E40407840407E0000000000000000007E4040784040400000000000000000001C22404E42221E000000000000000000"
            +"4242427E4242420000000000000000001C08080808081C0000000000000000000E04040404443800000000000000000042444850684442000000000000000000"
            +"4040404040407E00000000000000000082C6AA928282820000000000000000004262524A46424200000000000000000038448282824438000000000000000000"
            +"7C42427C404040000000000000000000384482828A443A0000000000000000007C42427C4844420000000000000000003C42403C02423C000000000000000000"
            +"FE1010101010100000000000000000004242424242423C000000000000000000828244442828100000000000000000008282828292AA44000000000000000000"
            +"8244281028448200000000000000000082442810101010000000000000000000FE0408102040FE0000000000000000003E30303030303E000000000000000000"
            +"4400444444443A0000000000000000003E06060606063E0000000000000000000814220000000000000000000000000000180018181818180000000000000000"
            +"324C005C2222220000000000000000000000F8047C847A00000000000000000040407C4242427C00000000000000000000003C4240403E000000000000000000"
            +"02023E4242423E00000000000000000000003C427E403C0000000000000000001C22207820202000000000000000000000023C42423E02423C00000000000000"
            +"40405C62424242000000000000000000080008080808080000000000000000000400040404040424180000000000000040404658605846000000000000000000"
            +"1808080808081C0000000000000000000000EC9292929200000000000000000000005C2222222200000000000000000000003C4242423C000000000000000000"
            +"00007C4242427C40400000000000000000003E4242423E02020000000000000000005C6240404000000000000000000000003E403C027C000000000000000000"
            +"00103E1010100E0000000000000000000000444444443A000000000000000000000082824428100000000000000000000000828292AA44000000000000000000"
            +"000042241824420000000000000000000000828244281020C00000000000000000007E0418207E0000000000000000001020F8047C847A000000000000000000"
            +"04083C427E403C0000000000000000000408000808080800000000000000000004083C4242423C0000000000000000000810444444443A000000000000000000"
        },
        {
             "key":"VIDEX:KATAKANA"
            ,"label":"Katakana"
            ,"mirror":false
            ,"dsize":[8,16]
            ,"size":0x800
            ,"crc32":"93922C30"
            ,"hex":
            "00000000000000000000000000000000FFFFFF00000000000000000000000000000000FFFFFF00000000000000000000FFFFFFFFFFFF00000000000000000000"
            +"000000000000FFFFFF00000000000000FFFFFF000000FFFFFF00000000000000000000FFFFFFFFFFFF00000000000000FFFFFFFFFFFFFFFFFF00000000000000"
            +"E090E09EF00C021C00000000000000009090F090BE08080800000000000000008080809EF01810100000000000000000888850203E0808080000000000000000"
            +"F080C09E9018101000000000000000007080807C121C1412000000000000000070806010EC12120C00000000000000007080601EE404040E0000000000000000"
            +"0000000000000000000000000000000008080808080000000000000000000000000000000F0000000000000000000000080808080F0000000000000000000000"
            +"0000000008080808080808080808080808080808080808080808080808080808000000000F0808080808080808080808080808080F0808080808080808080808"
            +"00000000F8000000000000000000000008080808F8000000000000000000000000000000FF000000000000000000000008080808FF0000000000000000000000"
            +"00000000F8080808080808080808080808080808F8080808080808080808080800000000FF080808080808080808080808080808FF0808080808080808080808"
            +"0000000000000000000000000000000000084442424242820000000000000000002A2A0000000000000000000000000000300804040408300000000000000000"
            +"00083E483C127C10000000000000000000629468102C528C00000000000000004040FE424448403E000000000000000070888870000000000000000000000000"
            +"8080FC808080807E000000000000000000022214081422C0000000000000000000FE020204081060000000000000000000001010FE1010000000000000000000"
            +"00000000001818081000000000000000000000007E00000000000000000000000000000000001818000000000000000000505050525254980000000000000000"
            +"0038448A92A244380000000000000000000838080808083E0000000000000000003C42021C20407E0000000000000000007E04081C02423C0000000000000000"
            +"00040C14247E04040000000000000000007E407C0202423C0000000000000000001E20407C42423C0000000000000000007E0204081020200000000000000000"
            +"003C42423C42423C0000000000000000003C42423E02047800000000000000000000005454040810000000000000000000001818001818081000000000000000"
            +"00FE0204281008040000000000000000824428FE10FE10100000000000000000087F0204081C2A49000000000000000000FE0408102844820000000000000000"
            +"2020FC2222224284000000000000000000182442427E42420000000000000000007C42427C42427C0000000000000000001C22404040221C0000000000000000"
            +"00784442424244780000000000000000007E40407840407E0000000000000000007E4040784040400000000000000000001C22404E42221E0000000000000000"
            +"004242427E4242420000000000000000001C08080808081C0000000000000000000E040404044438000000000000000000424448506844420000000000000000"
            +"004040404040407E00000000000000000082C6AA928282820000000000000000004262524A464242000000000000000000384482828244380000000000000000"
            +"007C42427C404040000000000000000000384482828A443A0000000000000000007C42427C4844420000000000000000003C42403C02423C0000000000000000"
            +"00FE1010101010100000000000000000004242424242423C000000000000000000828244442828100000000000000000008282828292AA440000000000000000"
            +"008244281028448200000000000000000082442810101010000000000000000000FE0408102040FE0000000000000000380600300C0038060000000000000000"
            +"FE02121C10101020000000000000000000FE82828282FE0000000000000000000202020204081020000000000000000060909060000000000000000000000000"
            +"00404040424448700000000000000000007E428204081020000000000000000000FE02027E0202FE00000000000000001010FE82020408100000000000000000"
            +"007C00FE101020400000000000000000007C00000000FE00000000000000000000FE2020FE20201E0000000000000000002020FC222242840000000000000000"
            +"001010FE101020400000000000000000003808080808087C0000000000000000007E428214081420000000000000000000824222040810200000000000000000"
            +"00E20202E20408F0000000000000000000929292020408100000000000000000007F010101017F00000000000000000020203028242020200000000000000000"
            +"10FE101014529200000000000000000000FE828202040830000000000000000010107C1010FE1010000000000000000004781010FE1020400000000000000000"
            +"08FE0818284888080000000000000000004242424202040800000000000000000000C002020408F00000000000000000000810204082FE020000000000000000"
            +"040810305090101000000000000000004040FE42444040400000000000000000007C10101010FE000000000000000000FE0202FE020408300000000000000000"
            +"007C00FE02040810000000000000000040407E88080810200000000000000000000C10202020100C000000000000000000002050880402020000000000000000"
        },
        {
             "key":"VIDEX:SUP&SUB"
            ,"label":"Sup & Sub"
            ,"mirror":false
            ,"dsize":[8,16]
            ,"size":0x800
            ,"crc32":"08B7C538"
            ,"hex":
            "FE8282828282FE000000000000000000FE808080808080000000000000000000101010101010FE000000000000000000020202020202FE000000000000000000"
            +"2010087C201008000000000000000000FEC6AA92AAC6FE00000000000000000000040890A0C08000000000000000000038448282FE28EE000000000000000000"
            +"2040F844220202000000000000000000100804FE040810000000000000000000FE0000FE0000FE00000000000000000010101092543810000000000000000000"
            +"10543892543810000000000000000000102040FE4020100000000000000000003844AA92AA443800000000000000000038448292824438000000000000000000"
            +"FE8282FE8282FE0000000000000000003854929E8244380000000000000000003844829E925438000000000000000000384482F2925438000000000000000000"
            +"385492F282443800000000000000000022140814A2C0800000000000000000007C4444444444C6000000000000000000020202FE020202000000000000000000"
            +"FE4428102844FE00000000000000000008081C1C0808080000000000000000003C424030080008000000000000000000384482FE824438000000000000000000"
            +"FE9292F28282FE000000000000000000FE8282F29292FE000000000000000000FE82829E9292FE000000000000000000FE92929E8282FE000000000000000000"
            +"18242424180000000000000000000000081808081C0000000000000000000000380418203C000000000000000000000038041804380000000000000000000000"
            +"0818283C0800000000000000000000003C2038043800000000000000000000001C2038241800000000000000000000003C040810100000000000000000000000"
            +"1824182418000000000000000000000018241C043800000000000000000000000018001800000000000000000000000000180018081000000000000000000000"
            +"0000001808100000000000000000000000003C000000000000000000000000000000000018000000000000000000000002040810200000000000000000000000"
            +"00000018242424180000000000000000000000081808081C0000000000000000000000380418203C000000000000000000000038041804380000000000000000"
            +"0000000818283C0800000000000000000000003C2038043800000000000000000000001C2038241800000000000000000000003C040810100000000000000000"
            +"0000001824182418000000000000000000000018241C043800000000000000000000000018001800000000000000000000000000180018081000000000000000"
            +"0000000000001808100000000000000000000000003C000000000000000000000000000000000018000000000000000000000002040810200000000000000000"
            +"3636241200000000000000000000000018243C242400000000000000000000003824382438000000000000000000000018242024180000000000000000000000"
            +"382424243800000000000000000000003C2038203C00000000000000000000003C2038202000000000000000000000001C202C241C0000000000000000000000"
            +"24243C242400000000000000000000001C0808081C00000000000000000000000404042418000000000000000000000024283028240000000000000000000000"
            +"202020203C000000000000000000000022362A2222000000000000000000000024342C2424000000000000000000000018242424180000000000000000000000"
            +"3824382020000000000000000000000018242428140000000000000000000000382438282400000000000000000000001C201804380000000000000000000000"
            +"3E080808080000000000000000000000242424241800000000000000000000002222221408000000000000000000000022222A2A140000000000000000000000"
            +"22140814220000000000000000000000221408080800000000000000000000003C0408103C000000000000000000000010384040381000000000000000000000"
            +"3844BAB2AA44380000000000000000000808080808080808080000000000000038449AA29A443800000000000000000000000000000000FE0000000000000000"
            +"1824180000000000000000000000000000000018243C242400000000000000000000003824382438000000000000000000000018242024180000000000000000"
            +"000000382424243800000000000000000000003C2038203C00000000000000000000003C2038202000000000000000000000001C202C241C0000000000000000"
            +"00000024243C242400000000000000000000001C0808081C00000000000000000000000404042418000000000000000000000024283028240000000000000000"
            +"000000202020203C000000000000000000000022362A2222000000000000000000000024342C2424000000000000000000000018242424180000000000000000"
            +"0000003824382020000000000000000000000018242428140000000000000000000000382438282400000000000000000000001C201804380000000000000000"
            +"0000003E080808080000000000000000000000242424241800000000000000000000002222221408000000000000000000000022222A2A140000000000000000"
            +"00000022140814220000000000000000000000221408080800000000000000000000003C0408103C00000000000000001C22304824120C443800000000000000"
            +"7EF4F474141414140000000000000000083E0808080808000000000000000000EE4A4A4A000000000000000000000000000000000000FE00FE00000000000000"
        },
        {
             "key":"VIDEX:INVERSE"
            ,"label":"Inverse"
            ,"mirror":false
            ,"dsize":[8,16]
            ,"size":0x800
            ,"crc32":"4945F4E9"
            ,"hex":
            "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000FFFFFFFFFFFFFFFFFFFF000000000000FFFFFFFFFFFFFFFFFFFF"
            +"FFFFFFFFFFFF000000FFFFFFFFFFFFFF000000FFFFFF000000FFFFFFFFFFFFFFFFFFFF000000000000FFFFFFFFFFFFFF000000000000000000FFFFFFFFFFFFFF"
            +"1F6F1F610FF3FDE3FFFFFFFFFFFFFFFF6F6F0F6F41F7F7F7FFFFFFFFFFFFFFFF7F7F7F610FE7EFEFFFFFFFFFFFFFFFFF7777AFDFC1F7F7F7FFFFFFFFFFFFFFFF"
            +"0F7F3F616FE7EFEFFFFFFFFFFFFFFFFF8F7F7F83EDE3EBEDFFFFFFFFFFFFFFFF8F7F9FEF13EDEDF3FFFFFFFFFFFFFFFF8F7F9FE11BFBFBF1FFFFFFFFFFFFFFFF"
            +"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF7F7F7F7F7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0FFFFFFFFFFFFFFFFFFFFFFF7F7F7F7F0FFFFFFFFFFFFFFFFFFFFFF"
            +"FFFFFFFFF7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7FFFFFFFFF0F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F0F7F7F7F7F7F7F7F7F7F7F7"
            +"FFFFFFFF07FFFFFFFFFFFFFFFFFFFFFFF7F7F7F707FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00FFFFFFFFFFFFFFFFFFFFFFF7F7F7F700FFFFFFFFFFFFFFFFFFFFFF"
            +"FFFFFFFF07F7F7F7F7F7F7F7F7F7F7F7F7F7F7F707F7F7F7F7F7F7F7F7F7F7F7FFFFFFFF00F7F7F7F7F7F7F7F7F7F7F7F7F7F7F700F7F7F7F7F7F7F7F7F7F7F7"
            +"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE7E7E7E7E7FFE7FFFFFFFFFFFFFFFFFFC9C9EDDBFFFFFFFFFFFFFFFFFFFFFFFFDBDB81DB81DBDBFFFFFFFFFFFFFFFFFF"
            +"F7C1B7C3ED83EFFFFFFFFFFFFFFFFFFF9D6B97EFD3AD73FFFFFFFFFFFFFFFFFFDFAFAF9D6B7789FFFFFFFFFFFFFFFFFFE7E7F7EFFFFFFFFFFFFFFFFFFFFFFFFF"
            +"F3EFDFDFDFEFF3FFFFFFFFFFFFFFFFFFCFF7FBFBFBF7CFFFFFFFFFFFFFFFFFFFEF6DABC7AB6DEFFFFFFFFFFFFFFFFFFFFFEFEF01EFEFFFFFFFFFFFFFFFFFFFFF"
            +"FFFFFFFFE7E7F7EFFFFFFFFFFFFFFFFFFFFFFF81FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE7E7FFFFFFFFFFFFFFFFFFFDFBF7EFDFBF7FFFFFFFFFFFFFFFFFFF"
            +"C7BB756D5DBBC7FFFFFFFFFFFFFFFFFFF7C7F7F7F7F7C1FFFFFFFFFFFFFFFFFFC3BDFDE3DFBF81FFFFFFFFFFFFFFFFFF81FBF7E3FDBDC3FFFFFFFFFFFFFFFFFF"
            +"FBF3EBDB81FBFBFFFFFFFFFFFFFFFFFF81BF83FDFDBDC3FFFFFFFFFFFFFFFFFFE1DFBF83BDBDC3FFFFFFFFFFFFFFFFFF81FDFBF7EFDFDFFFFFFFFFFFFFFFFFFF"
            +"C3BDBDC3BDBDC3FFFFFFFFFFFFFFFFFFC3BDBDC1FDFB87FFFFFFFFFFFFFFFFFFFFE7E7FFE7E7FFFFFFFFFFFFFFFFFFFFFFE7E7FFE7E7F7EFFFFFFFFFFFFFFFFF"
            +"FFF9E79FE7F9FFFFFFFFFFFFFFFFFFFFFFFF81FF81FFFFFFFFFFFFFFFFFFFFFFFF9FE7F9E79FFFFFFFFFFFFFFFFFFFFFC3BDFDF3EFFFEFFFFFFFFFFFFFFFFFFF"
            +"C3BD65556BBFC3FFFFFFFFFFFFFFFFFFE7DBBDBD81BDBDFFFFFFFFFFFFFFFFFF83BDBD83BDBD83FFFFFFFFFFFFFFFFFFE3DDBFBFBFDDE3FFFFFFFFFFFFFFFFFF"
            +"87BBBDBDBDBB87FFFFFFFFFFFFFFFFFF81BFBF87BFBF81FFFFFFFFFFFFFFFFFF81BFBF87BFBFBFFFFFFFFFFFFFFFFFFFE3DDBFB1BDDDE1FFFFFFFFFFFFFFFFFF"
            +"BDBDBD81BDBDBDFFFFFFFFFFFFFFFFFFE3F7F7F7F7F7E3FFFFFFFFFFFFFFFFFFF1FBFBFBFBBBC7FFFFFFFFFFFFFFFFFFBDBBB7AF97BBBDFFFFFFFFFFFFFFFFFF"
            +"BFBFBFBFBFBF81FFFFFFFFFFFFFFFFFF7D39556D7D7D7DFFFFFFFFFFFFFFFFFFBD9DADB5B9BDBDFFFFFFFFFFFFFFFFFFC7BB7D7D7DBBC7FFFFFFFFFFFFFFFFFF"
            +"83BDBD83BFBFBFFFFFFFFFFFFFFFFFFFC7BB7D7D75BBC5FFFFFFFFFFFFFFFFFF83BDBD83B7BBBDFFFFFFFFFFFFFFFFFFC3BDBFC3FDBDC3FFFFFFFFFFFFFFFFFF"
            +"01EFEFEFEFEFEFFFFFFFFFFFFFFFFFFFBDBDBDBDBDBDC3FFFFFFFFFFFFFFFFFF7D7DBBBBD7D7EFFFFFFFFFFFFFFFFFFF7D7D7D7D6D55BBFFFFFFFFFFFFFFFFFF"
            +"7DBBD7EFD7BB7DFFFFFFFFFFFFFFFFFF7DBBD7EFEFEFEFFFFFFFFFFFFFFFFFFF01FBF7EFDFBF01FFFFFFFFFFFFFFFFFFC1CFCFCFCFCFC1FFFFFFFFFFFFFFFFFF"
            +"7FBFDFEFF7FBFDFFFFFFFFFFFFFFFFFFC1F9F9F9F9F9C1FFFFFFFFFFFFFFFFFFF7E3D5F7F7F7F7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF01FFFFFFFFFFFFFFFF"
            +"E7E7EFF7FFFFFFFFFFFFFFFFFFFFFFFFFFFF07FB837B85FFFFFFFFFFFFFFFFFFBFBF83BDBDBD83FFFFFFFFFFFFFFFFFFFFFFC3BDBFBFC1FFFFFFFFFFFFFFFFFF"
            +"FDFDC1BDBDBDC1FFFFFFFFFFFFFFFFFFFFFFC3BD81BFC3FFFFFFFFFFFFFFFFFFE3DDDF87DFDFDFFFFFFFFFFFFFFFFFFFFFFDC3BDBDC1FDBDC3FFFFFFFFFFFFFF"
            +"BFBFA39DBDBDBDFFFFFFFFFFFFFFFFFFF7FFF7F7F7F7F7FFFFFFFFFFFFFFFFFFFBFFFBFBFBFBFBDBE7FFFFFFFFFFFFFFBFBFB9A79FA7B9FFFFFFFFFFFFFFFFFF"
            +"E7F7F7F7F7F7E3FFFFFFFFFFFFFFFFFFFFFF136D6D6D6DFFFFFFFFFFFFFFFFFFFFFFA3DDDDDDDDFFFFFFFFFFFFFFFFFFFFFFC3BDBDBDC3FFFFFFFFFFFFFFFFFF"
            +"FFFF83BDBDBD83BFBFFFFFFFFFFFFFFFFFFFC1BDBDBDC1FDFDFFFFFFFFFFFFFFFFFFA39DBFBFBFFFFFFFFFFFFFFFFFFFFFFFC1BFC3FD83FFFFFFFFFFFFFFFFFF"
            +"FFEFC1EFEFEFF1FFFFFFFFFFFFFFFFFFFFFFBBBBBBBBC5FFFFFFFFFFFFFFFFFFFFFF7D7DBBD7EFFFFFFFFFFFFFFFFFFFFFFF7D7D6D55BBFFFFFFFFFFFFFFFFFF"
            +"FFFFBDDBE7DBBDFFFFFFFFFFFFFFFFFFFFFF7D7DBBD7EFDF3FFFFFFFFFFFFFFFFFFF81FBE7DF81FFFFFFFFFFFFFFFFFFF3EFF7CFF7EFF3FFFFFFFFFFFFFFFFFF"
            +"F7F7F7FFF7F7F7FFFFFFFFFFFFFFFFFFCFF7EFF3EFF7CFFFFFFFFFFFFFFFFFFF9F6DF3FFFFFFFFFFFFFFFFFFFFFFFFFFDBB76DDBB76DDBB7FFFFFFFFFFFFFFFF"
        },
        {
             "key":"VIDEX_EPSON"
            ,"label":"Epson"
            ,"mirror":false
            ,"dsize":[8,16]
            ,"size":0x800
            ,"crc32":"0C6EF8D0"
            ,"hex":
            "90D0B09010101E00000000000000000070806012F21E1212000000000000000070806010F40814220000000000000000F080C080F40814220000000000000000"
            +"F080C080FE0808080000000000000000F080C08CF212140A00000000000000006090F090941814120000000000000000E090E090F010101E0000000000000000"
            +"E090E09EF00C021C00000000000000009090F090BE08080800000000000000008080809EF01810100000000000000000888850203E0808080000000000000000"
            +"F080C09E9018101000000000000000007080807C121C141200000000000000007080601CF212120C00000000000000007080601EE404040E0000000000000000"
            +"E0909090F010101E0000000000000000E0909094EC04040E0000000000000000E090909CE204081E0000000000000000E090909CE20C021C0000000000000000"
            +"E0909094EC143E04000000000000000090D0B09014181412000000000000000070806010F21A16120000000000000000F080C09CF21C121C0000000000000000"
            +"70808070121A16120000000000000000F080C0A2F62A222200000000000000007080601CF21C121C0000000000000000F080C080EE10100E0000000000000000"
            +"F080C08E900C021C00000000000000007080B09E700C021C0000000000000000E090E0AE900C021C00000000000000009090906E100C021C0000000000000000"
            +"00000000000000000000000000000000F0F0F0000000000000000000000000000F0F0F00000000000000000000000000FFFFFF00000000000000000000000000"
            +"000000F0F0F000000000000000000000F0F0F0F0F0F0000000000000000000000F0F0FF0F0F000000000000000000000FFFFFFF0F0F000000000000000000000"
            +"0000000F0F0F00000000000000000000F0F0F00F0F0F000000000000000000000F0F0F0F0F0F00000000000000000000FFFFFF0F0F0F00000000000000000000"
            +"000000FFFFFF00000000000000000000F0F0F0FFFFFF000000000000000000000F0F0FFFFFFF00000000000000000000FFFFFFFFFFFF00000000000000000000"
            +"000000000000F0F0F000000000000000F0F0F0000000F0F0F0000000000000000F0F0F000000F0F0F000000000000000FFFFFF000000F0F0F000000000000000"
            +"000000F0F0F0F0F0F000000000000000F0F0F0F0F0F0F0F0F0000000000000000F0F0FF0F0F0F0F0F000000000000000FFFFFFF0F0F0F0F0F000000000000000"
            +"0000000F0F0FF0F0F000000000000000F0F0F00F0F0FF0F0F0000000000000000F0F0F0F0F0FF0F0F000000000000000FFFFFF0F0F0FF0F0F000000000000000"
            +"000000FFFFFFF0F0F000000000000000F0F0F0FFFFFFF0F0F0000000000000000F0F0FFFFFFFF0F0F000000000000000FFFFFFFFFFFFF0F0F000000000000000"
            +"0000000000000F0F0F00000000000000F0F0F00000000F0F0F000000000000000F0F0F0000000F0F0F00000000000000FFFFFF0000000F0F0F00000000000000"
            +"000000F0F0F00F0F0F00000000000000F0F0F0F0F0F00F0F0F000000000000000F0F0FF0F0F00F0F0F00000000000000FFFFFFF0F0F00F0F0F00000000000000"
            +"0000000F0F0F0F0F0F00000000000000F0F0F00F0F0F0F0F0F000000000000000F0F0F0F0F0F0F0F0F00000000000000FFFFFF0F0F0F0F0F0F00000000000000"
            +"000000FFFFFF0F0F0F00000000000000F0F0F0FFFFFF0F0F0F000000000000000F0F0FFFFFFF0F0F0F00000000000000FFFFFFFFFFFF0F0F0F00000000000000"
            +"000000000000FFFFFF00000000000000F0F0F0000000FFFFFF000000000000000F0F0F000000FFFFFF00000000000000FFFFFF000000FFFFFF00000000000000"
            +"000000F0F0F0FFFFFF00000000000000F0F0F0F0F0F0FFFFFF000000000000000F0F0FF0F0F0FFFFFF00000000000000FFFFFFF0F0F0FFFFFF00000000000000"
            +"0000000F0F0FFFFFFF00000000000000F0F0F00F0F0FFFFFFF000000000000000F0F0F0F0F0FFFFFFF00000000000000FFFFFF0F0F0FFFFFFF00000000000000"
            +"000000FFFFFFFFFFFF00000000000000F0F0F0FFFFFFFFFFFF000000000000000F0F0FFFFFFFFFFFFF00000000000000FFFFFFFFFFFFFFFFFF00000000000000"
            +"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
            +"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
            +"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
            +"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
            +"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
            +"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
            +"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
            +"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        }
    ];

    /*
     * Attach Unicode maps after the ROM catalogue is built. Keeping the large
     * ROM byte strings untouched makes the metadata patch easy to audit.
     */
    for(var unicodeROMIndex=0;
        unicodeROMIndex<VIDEX_CHAR_ROMS.length;
        unicodeROMIndex++)
    {
        var unicodeROM = VIDEX_CHAR_ROMS[unicodeROMIndex];
        var unicodeMap = VIDEX_UNICODE_BY_ROM[unicodeROM.key];

        if(unicodeMap)
            unicodeROM.unicode = unicodeMap;
    }

    function findCharacterROM(key)
    {
        key = String(key || "");
        for(var i=0;i<VIDEX_CHAR_ROMS.length;i++)
            if(VIDEX_CHAR_ROMS[i].key == key)
                return VIDEX_CHAR_ROMS[i];

        return null;
    }

    function characterROMData(entry)
    {
        if(!entry) return null;

        if(!(entry.data instanceof Uint8Array))
            entry.data = decodeCharacterROMHex(entry.hex);

        return entry.data;
    }

    /*
     * Normal-sync 80x24 values used by the resident VideoTerm 2.4 firmware.
     * R16/R17 are light-pen registers and power up clear.
     */
    const CRTC_NORMAL = new Uint8Array([
         0x7B,0x50,0x5E,0x29,0x1B,0x08,0x18,0x19
        ,0x00,0x08,0xE0,0x08,0x00,0x00,0x00,0x00
        ,0x00,0x00
    ]);
    crtc.set(CRTC_NORMAL);

    /*
     * The later Videx video MUX can subscribe here without putting renderer
     * knowledge into the peripheral. Bus writes remain authoritative.
     */
    var videoChangeListeners = [];

    this.subscribeVideoChange = function(callback)
    {
        if(typeof(callback)!="function")
            return function(){};

        if(videoChangeListeners.indexOf(callback)<0)
            videoChangeListeners.push(callback);

        var subscribed = true;
        return function()
        {
            if(!subscribed) return;
            subscribed = false;

            var index = videoChangeListeners.indexOf(callback);
            if(index>=0) videoChangeListeners.splice(index,1);
        };
    };

    function emitVideoChange(type,address,value)
    {
        state.videoRevision++;

        var change = {
             "type":type
            ,"address":address
            ,"value":value
            ,"revision":state.videoRevision
            ,"vramBank":state.vramBank
            ,"cellWidth":state.cellWidth
            ,"crtcIndex":state.crtcIndex
        };

        var listeners = videoChangeListeners.slice();
        for(var i=0;i<listeners.length;i++)
        {
            try { listeners[i](change); }
            catch(err) { console.error("VideoTerm video-change listener failed",err); }
        }
    }

    /*
     * Apple2IO owns the address-space wiring. SlotROM is fixed to this card's
     * slot; HostROM is the shared $C800-$CFFF window selected through Hslot.
     */
    this.action =
    {
        "SlotROM":
        {
             "RD":{"callback":function(addr,ctx) {
                return videx.readSlotROM(addr,ctx);
             }}
            ,"WR":{"callback":function(addr,d8,ctx) {
                return videx.writeSlotROM(addr,d8,ctx);
             }}
        },
        "SlotIO":
        {
             "RD":{"callback":function(addr,ctx) {
                return videx.readSlotIO(addr,ctx);
             }}
            ,"WR":{"callback":function(addr,d8,ctx) {
                return videx.writeSlotIO(addr,d8,ctx);
             }}
        },
        "HostROM":
        {
             "RD":{"callback":function(addr,ctx) {
                return videx.readHostROM(addr,ctx);
             }}
            ,"WR":{"callback":function(addr,d8,ctx) {
                return videx.writeHostROM(addr,d8,ctx);
             }}
        }
    };
    
    /*
     * In this peripheral API, "SlotROM" and "HostROM" name CPU address-space
     * mappings; they are not separate physical ROM arrays.
     *
     * The character-generator ROM is a video-side asset for the later
     * EMU_DEVICE_videx_* renderer and is not mapped into the 6502 address space.
     *
     * The old HostROM byte array below is retained temporarily only as a
     * byte-for-byte validation copy. No bus path should read from it after this
     * mapping cleanup; it can be deleted once the equality assertion passes.
     */

    // Videx Videoterm expansion ROM 2.4
    var HostROM = new Uint8Array([0xAD,0x7B,0x07,0x29,0xF8,0xC9,0x30,0xF0,0x21,0xA9,0x30,0x8D,0x7B,0x07,0x8D,0xFB,0x07,0xA9,0x00,0x8D,0xFB,0x06,0x20,0x61,0xC9,0xA2,0x00,0x8A,0x8D,0xB0,0xC0,0xBD,0xA1,0xC8,0x8D,0xB1,0xC0,0xE8,0xE0,0x10,0xD0,0xF1,0x8D,0x59,0xC0,0x60,0xAD,0xFB,0x07,0x29,0x08,0xF0,0x09,0x20,0x93,0xFE,0x20,0x22,0xFC,0x20,0x89,0xFE,0x68,0xA8,0x68,0xAA,0x68,0x60,0x20,0xD1,0xC8,0xE6,0x4E,0xD0,0x02,0xE6,0x4F,0xAD,0x00,0xC0,0x10,0xF5,0x20,0x5C,0xC8,0x90,0xF0,0x2C,0x10,0xC0,0x18,0x60,0xC9,0x8B,0xD0,0x02,0xA9,0xDB,0xC9,0x81,0xD0,0x0A,0xAD,0xFB,0x07,0x49,0x40,0x8D,0xFB,0x07,0xB0,0xE7,0x48,0xAD,0xFB,0x07,0x0A,0x0A,0x68,0x90,0x1F,0xC9,0xB0,0x90,0x1B,0x2C,0x63,0xC0,0x30,0x14,0xC9,0xB0,0xF0,0x0E,0xC9,0xC0,0xD0,0x02,0xA9,0xD0,0xC9,0xDB,0x90,0x08,0x29,0xCF,0xD0,0x04,0xA9,0xDD,0x09,0x20,0x48,0x29,0x7F,0x8D,0x7B,0x06,0x68,0x38,0x60,0x7B,0x50,0x5E,0x29,0x1B,0x08,0x18,0x19,0x00,0x08,0xE0,0x08,0x00,0x00,0x00,0x00,0x8D,0x7B,0x06,0xA5,0x25,0xCD,0xFB,0x05,0xF0,0x06,0x8D,0xFB,0x05,0x20,0x04,0xCA,0xA5,0x24,0xCD,0x7B,0x05,0x90,0x03,0x8D,0x7B,0x05,0xAD,0x7B,0x06,0x20,0x89,0xCA,0xA9,0x0F,0x8D,0xB0,0xC0,0xAD,0x7B,0x05,0xC9,0x50,0xB0,0x13,0x6D,0x7B,0x04,0x8D,0xB1,0xC0,0xA9,0x0E,0x8D,0xB0,0xC0,0xA9,0x00,0x6D,0xFB,0x04,0x8D,0xB1,0xC0,0x60,0x49,0xC0,0xC9,0x08,0xB0,0x1D,0xA8,0xA9,0xC9,0x48,0xB9,0xF2,0xCB,0x48,0x60,0xEA,0xAC,0x7B,0x05,0xA9,0xA0,0x20,0x71,0xCA,0xC8,0xC0,0x50,0x90,0xF8,0x60,0xA9,0x34,0x8D,0x7B,0x07,0x60,0xA9,0x32,0xD0,0xF8,0xA0,0xC0,0xA2,0x80,0xCA,0xD0,0xFD,0xAD,0x30,0xC0,0x88,0xD0,0xF5,0x60,0xAC,0x7B,0x05,0xC0,0x50,0x90,0x05,0x48,0x20,0xB0,0xC9,0x68,0xAC,0x7B,0x05,0x20,0x71,0xCA,0xEE,0x7B,0x05,0x2C,0x78,0x04,0x10,0x07,0xAD,0x7B,0x05,0xC9,0x50,0xB0,0x68,0x60,0xAC,0x7B,0x05,0xAD,0xFB,0x05,0x48,0x20,0x07,0xCA,0x20,0x04,0xC9,0xA0,0x00,0x68,0x69,0x00,0xC9,0x18,0x90,0xF0,0xB0,0x23,0x20,0x67,0xC9,0x98,0xF0,0xE8,0xA9,0x00,0x8D,0x7B,0x05,0x8D,0xFB,0x05,0xA8,0xF0,0x12,0xCE,0x7B,0x05,0x10,0x9D,0xA9,0x4F,0x8D,0x7B,0x05,0xAD,0xFB,0x05,0xF0,0x93,0xCE,0xFB,0x05,0x4C,0x04,0xCA,0xA9,0x30,0x8D,0x7B,0x07,0x68,0x09,0x80,0xC9,0xB1,0xD0,0x67,0xA9,0x08,0x8D,0x58,0xC0,0xD0,0x5B,0xC9,0xB2,0xD0,0x51,0xA9,0xFE,0x2D,0xFB,0x07,0x8D,0xFB,0x07,0x60,0x8D,0x7B,0x06,0x4E,0x78,0x04,0x4C,0xCB,0xC8,0x20,0x27,0xCA,0xEE,0xFB,0x05,0xAD,0xFB,0x05,0xC9,0x18,0x90,0x4A,0xCE,0xFB,0x05,0xAD,0xFB,0x06,0x69,0x04,0x29,0x7F,0x8D,0xFB,0x06,0x20,0x12,0xCA,0xA9,0x0D,0x8D,0xB0,0xC0,0xAD,0x7B,0x04,0x8D,0xB1,0xC0,0xA9,0x0C,0x8D,0xB0,0xC0,0xAD,0xFB,0x04,0x8D,0xB1,0xC0,0xA9,0x17,0x20,0x07,0xCA,0xA0,0x00,0x20,0x04,0xC9,0xB0,0x95,0xC9,0xB3,0xD0,0x0E,0xA9,0x01,0x0D,0xFB,0x07,0xD0,0xA9,0xC9,0xB0,0xD0,0x9C,0x4C,0x09,0xC8,0x4C,0x27,0xC9,0xAD,0xFB,0x05,0x8D,0xF8,0x04,0x0A,0x0A,0x6D,0xF8,0x04,0x6D,0xFB,0x06,0x48,0x4A,0x4A,0x4A,0x4A,0x8D,0xFB,0x04,0x68,0x0A,0x0A,0x0A,0x0A,0x8D,0x7B,0x04,0x60,0xC9,0x0D,0xD0,0x06,0xA9,0x00,0x8D,0x7B,0x05,0x60,0x09,0x80,0xC9,0xA0,0xB0,0xCE,0xC9,0x87,0x90,0x08,0xA8,0xA9,0xC9,0x48,0xB9,0xB9,0xC9,0x48,0x60,0x18,0x71,0x13,0xB2,0x48,0x60,0xAF,0x9D,0xF2,0x13,0x13,0x13,0x13,0x13,0x13,0x13,0x13,0x13,0x66,0x0E,0x13,0x38,0x00,0x14,0x7B,0x18,0x98,0x6D,0x7B,0x04,0x48,0xA9,0x00,0x6D,0xFB,0x04,0x48,0x0A,0x29,0x0C,0xAA,0xBD,0xB0,0xC0,0x68,0x4A,0x68,0xAA,0x60,0x0A,0x48,0xAD,0xFB,0x07,0x4A,0x68,0x6A,0x48,0x20,0x59,0xCA,0x68,0xB0,0x05,0x9D,0x00,0xCC,0x90,0x03,0x9D,0x00,0xCD,0x60,0x48,0xA9,0xF7,0x20,0xA0,0xC9,0x8D,0x59,0xC0,0xAD,0x7B,0x07,0x29,0x07,0xD0,0x04,0x68,0x4C,0x23,0xCA,0x29,0x04,0xF0,0x03,0x4C,0x87,0xC9,0x68,0x38,0xE9,0x20,0x29,0x7F,0x48,0xCE,0x7B,0x07,0xAD,0x7B,0x07,0x29,0x03,0xD0,0x15,0x68,0xC9,0x18,0xB0,0x03,0x8D,0xFB,0x05,0xAD,0xF8,0x05,0xC9,0x50,0xB0,0x03,0x8D,0x7B,0x05,0x4C,0x04,0xCA,0x68,0x8D,0xF8,0x05,0x60,0xAD,0x00,0xC0,0xC9,0x93,0xD0,0x0F,0x2C,0x10,0xC0,0xAD,0x00,0xC0,0x10,0xFB,0xC9,0x83,0xF0,0x03,0x2C,0x10,0xC0,0x60,0xA8,0xB9,0x31,0xCB,0x20,0xF1,0xC8,0x20,0x44,0xC8,0xC9,0xCE,0xB0,0x08,0xC9,0xC9,0x90,0x04,0xC9,0xCC,0xD0,0xEA,0x4C,0xF1,0xC8,0xEA,0x2C,0xCB,0xFF,0x70,0x31,0x38,0x90,0x18,0xB8,0x50,0x2B,0x01,0x82,0x11,0x14,0x1C,0x22,0x4C,0x00,0xC8,0x20,0x44,0xC8,0x29,0x7F,0xA2,0x00,0x60,0x20,0xA7,0xC9,0xA2,0x00,0x60,0xC9,0x00,0xF0,0x09,0xAD,0x00,0xC0,0x0A,0x90,0x03,0x20,0x5C,0xC8,0xA2,0x00,0x60,0x91,0x28,0x38,0xB8,0x8D,0xFF,0xCF,0x48,0x85,0x35,0x8A,0x48,0x98,0x48,0xA5,0x35,0x86,0x35,0xA2,0xC3,0x8E,0x78,0x04,0x48,0x50,0x10,0xA9,0x32,0x85,0x38,0x86,0x39,0xA9,0x07,0x85,0x36,0x86,0x37,0x20,0x00,0xC8,0x18,0x90,0x6F,0x68,0xA4,0x35,0xF0,0x1F,0x88,0xAD,0x78,0x06,0xC9,0x88,0xF0,0x17,0xD9,0x00,0x02,0xF0,0x12,0x49,0x20,0xD9,0x00,0x02,0xD0,0x3B,0xAD,0x78,0x06,0x99,0x00,0x02,0xB0,0x03,0x20,0xED,0xCA,0xA9,0x80,0x20,0xF5,0xC9,0x20,0x44,0xC8,0xC9,0x9B,0xF0,0xF1,0xC9,0x8D,0xD0,0x05,0x48,0x20,0x01,0xC9,0x68,0xC9,0x95,0xD0,0x12,0xAC,0x7B,0x05,0x20,0x59,0xCA,0xB0,0x05,0xBD,0x00,0xCC,0x90,0x03,0xBD,0x00,0xCD,0x09,0x80,0x8D,0x78,0x06,0xD0,0x08,0x20,0x44,0xC8,0xA0,0x00,0x8C,0x78,0x06,0xBA,0xE8,0xE8,0xE8,0x9D,0x00,0x01,0xA9,0x00,0x85,0x24,0xAD,0xFB,0x05,0x85,0x25,0x4C,0x2E,0xC8,0x68,0xAC,0xFB,0x07,0x10,0x08,0xAC,0x78,0x06,0xC0,0xE0,0x90,0x01,0x98,0x20,0xB1,0xC8,0x20,0xCF,0xCA,0xA9,0x7F,0x20,0xA0,0xC9,0xAD,0x7B,0x05,0xE9,0x47,0x90,0xD4,0x69,0x1F,0x18,0x90,0xD1,0x60,0x38,0x71,0xB2,0x7B,0x00,0x48,0x66,0xC4,0xC2,0xC1,0xFF,0xC3,0xEA]);
    console.assert(
        HostROM.length==0x400,
        "Videx VideoTerm firmware ROM must be exactly 1 KiB"
    );

    console.assert(
        VIDEX_FIRMWARE_ROM.length==VIDEX_FIRMWARE_ROM_SIZE,
        "VIDEX_FIRMWARE_ROM must be exactly 1 KiB"
    );
    console.assert(
        HostROM.length==VIDEX_FIRMWARE_ROM.length &&
        HostROM.every(function(d8,i) { return d8==VIDEX_FIRMWARE_ROM[i]; }),
        "Legacy HostROM copy differs from VIDEX_FIRMWARE_ROM"
    );

    function ownsExpansionROM()
    {
        if(!videx.mount || !oEMU.component.IO.ACTION_MAP) return false;
        return oEMU.component.IO.ACTION_MAP.Hslot == (videx.mount.slotN-1);
    }

    function selectExpansionROM(ctx)
    {
        // Debugger/read-only ROM inspection must never change C8 ownership.
        if(ctx && ctx.bRO===true) return false;
        if(!videx.mount || !videx.mount.ranges || !videx.mount.ranges.HostROM)
            return false;

        var CIO = oEMU.component.IO;
        if(!CIO.ACTION_MAP) return false;

        if(CIO.ACTION_MAP.Hslot == (videx.mount.slotN-1))
            return true;

        CIO.ACTION_MAP.Hslot = videx.mount.slotN-1;

        /*
         * HostROM reads are selected dynamically because $C800-$CFFF is shared.
         * HostROM writes are dispatched by Apple2IO.write() to the same Hslot
         * owner, so no permanent shared-window WR callback is installed here.
         */
        var range = videx.mount.ranges.HostROM;
        for(var i=range.from;i<=range.to;i++)
            CIO.ACTION_MAP.RD[i] = videx.action.HostROM.RD.callback;

        if(bDebug)
            console.log(
                "VideoTerm claims $C800-$CFFF from PR#"+(videx.mount.slotN-1)
            );

        return true;
    }

    function releaseExpansionROM()
    {
        if(!videx.mount || !oEMU.component.IO.ACTION_MAP) return false;

        var CIO = oEMU.component.IO;
        if(CIO.ACTION_MAP.Hslot != (videx.mount.slotN-1))
            return false;

        CIO.ACTION_MAP.Hslot = null;

        if(bDebug) console.log("VideoTerm releases $C800-$CFFF");
        return true;
    }

    function hostRelativeAddress(addr,ctx)
    {
        if(ctx && Number.isFinite(ctx.rel_addr))
            return ctx.rel_addr;

        if(ctx && Number.isFinite(ctx.line))
            return ctx.line + (addr & 0xFF);

        var base = videx.action.HostROM && Number.isFinite(videx.action.HostROM.base)
            ? videx.action.HostROM.base
            : 0x800;

        return base + (addr & 0xFF);
    }

    function applyDeviceSelect(addr,ctx)
    {
        addr &= 0x0F;
        if(ctx && ctx.bRO===true) return addr;

        var previousWidth = state.cellWidth;
        state.vramBank = (addr >> 2) & 0x03;

        // Device-select bit 1 chooses an 8- or 9-dot character cell.
        state.cellWidth = (addr & 0x02) ? 8 : 9;

        if(previousWidth != state.cellWidth)
            emitVideoChange("cell-width",addr,state.cellWidth);

        return addr;
    }

    this.readSlotROM = function(addr,ctx)
    {
        selectExpansionROM(ctx);

        /*
         * VideoTerm is currently constrained by _CFG_PSLOT to Apple slot 3.
         * $C300-$C3FF aliases physical U3 offsets $0300-$03FF.
         */
        var slotOffset = addr & (VIDEX_SLOT_ROM_WINDOW_SIZE-1);
        return VIDEX_FIRMWARE_ROM[
            VIDEX_SLOT_ROM_PHYS_OFFSET + slotOffset
        ] & 0xFF;  
    };

    this.writeSlotROM = function(addr,d8,ctx)
    {
        // STA $C300 is a normal way for firmware/software to claim C8 space.
        selectExpansionROM(ctx);
        return 0x00;        // U3 remains read-only
    };

    this.readSlotIO = function(addr,ctx)
    {
        addr = applyDeviceSelect(addr,ctx);

        // Bit 0: 0 = CRTC register selector, 1 = selected register contents.
        if((addr & 0x01)==0)
            return 0x00;    // MC6845 address register is write-oriented

        return state.crtcIndex < crtc.length
            ? crtc[state.crtcIndex] & 0xFF
            : 0x00;
    };

    this.writeSlotIO = function(addr,d8,ctx)
    {
        addr = applyDeviceSelect(addr,ctx);
        d8 &= 0xFF;

        if(ctx && ctx.bRO===true)
            return 0x00;

        if((addr & 0x01)==0)
        {
            state.crtcIndex = d8 & 0x1F;
            return 0x00;
        }

        /*
         * R0-R15 are programmable. R16/R17 are light-pen registers and remain
         * read-only in this first MC6845 model.
         */
        if(state.crtcIndex < 16)
        {
            var index = state.crtcIndex;
            if(crtc[index] != d8)
            {
                crtc[index] = d8;
                emitVideoChange("crtc",index,d8);
            }
        }

        return 0x00;
    };

    this.readHostROM = function(addr,ctx)
    {
        var rel_addr = hostRelativeAddress(addr,ctx);
        var windowAddr = rel_addr - 0x800;

        if(!ownsExpansionROM())
            return 0x00;

        var d8 = 0x00;

        // $C800-$CBFF: complete 1 KiB U3 resident firmware.
        if(windowAddr>=0x000 && windowAddr<VIDEX_C8_ROM_WINDOW_SIZE)
        {
            var firmwareOffset = VIDEX_C8_ROM_PHYS_OFFSET + windowAddr;
            d8 = VIDEX_FIRMWARE_ROM[firmwareOffset] & 0xFF;
        }
        // $CC00-$CDFF: selected 512-byte page of 2 KiB VideoTerm RAM.
        else if(windowAddr>=0x400 && windowAddr<0x600)
        {
            var vramAddr =
                  (state.vramBank << 9)
                | (windowAddr & 0x01FF);

            d8 = vram[vramAddr] & 0xFF;
        }

        // $CFFF releases the selected expansion-ROM window on a real bus access.
        if(windowAddr==0x7FF && !(ctx && ctx.bRO===true))
            releaseExpansionROM();

        return d8;
    };

    this.writeHostROM = function(addr,d8,ctx)
    {
        var rel_addr = hostRelativeAddress(addr,ctx);
        var windowAddr = rel_addr - 0x800;
        d8 &= 0xFF;

        if(!ownsExpansionROM())
            return 0x00;

        if(windowAddr>=0x400 && windowAddr<0x600)
        {
            var vramAddr =
                  (state.vramBank << 9)
                | (windowAddr & 0x01FF);

            if(vram[vramAddr] != d8)
            {
                vram[vramAddr] = d8;
                emitVideoChange("vram",vramAddr,d8);
            }
        }

        // The firmware itself uses STA $CFFF to turn off the expansion window.
        if(windowAddr==0x7FF && !(ctx && ctx.bRO===true))
            releaseExpansionROM();

        return 0x00;
    };

    /*
     * Read-only hardware accessors for the next-stage Videx video MUX/device.
     * Arrays are intentionally returned by reference: the renderer consumes
     * live hardware state while all writes continue to enter through this card.
     */
    this.getVideoRAM = function() { return vram; };
    this.getCRTCRegisters = function() { return crtc; };
    this.getFirmwareROM = function() { return VIDEX_FIRMWARE_ROM; };

    // Compatibility accessor retained for older Videx renderer revisions.
    this.getNormalCharacterROM = function() { return VIDEX_CHAR_ROM_NORMAL; };
    
    this.getCharacterROMCatalog = function()
    {
        return VIDEX_CHAR_ROMS.map(function(entry)
        {
            return {
                 "key":entry.key
                ,"label":entry.label
                ,"mirror":entry.mirror
                ,"dsize":entry.dsize.slice()
                ,"size":entry.size
                ,"crc32":entry.crc32
                ,"unicode":entry.unicode ? entry.unicode.slice() : null
            };
        });
    };

    this.getCharacterROMKey = function()
    {
        return state.charRomKey;
    };

    this.getCharacterROM = function()
    {
        var entry = findCharacterROM(state.charRomKey)
            || findCharacterROM("VIDEX:NORMAL");

        return entry
            ? {
                 "key":entry.key
                ,"label":entry.label
                ,"mirror":entry.mirror
                ,"dsize":entry.dsize.slice()
                ,"size":entry.size
                ,"crc32":entry.crc32
                ,"unicode":entry.unicode ? entry.unicode.slice() : null
                ,"data":characterROMData(entry)
              }
            : null;
    };

    this.setCharacterROM = function(key)
    {
        var entry = findCharacterROM(key);
        if(!entry) return false;

        // Decode now so an invalid ROM can never become active.
        characterROMData(entry);

        if(state.charRomKey == entry.key)
            return true;

        state.charRomKey = entry.key;
        emitVideoChange("charrom",-1,entry.key);
        return true;
    };

    /*
     * Manual peripheral control for the VideoTerm character-cell width.
     *
     * This is the same state normally selected by slot-I/O device-select bit 1:
     *   0 -> 9-dot cell
     *   1 -> 8-dot cell
     *
     * A later real slot-I/O access remains authoritative and may therefore
     * change this setting again.
     */
    this.setCharacterCellWidth = function(width)
    {
        width = Number(width);
        if(width!==8 && width!==9)
            return false;

        if(state.cellWidth===width)
            return width;

        state.cellWidth = width;
        emitVideoChange("cell-width",-1,width);
        return width;
    };

    /*
     * Optional VideoTerm inverse-video hardware configurations.
     *
     * "off"
     *      Normal VideoTerm polarity. VRAM bit 7 does not affect polarity.
     *
     * "screen"
     *      Whole-screen inverse modification: the complete VideoTerm raster is
     *      rendered with reversed foreground/background polarity.
     *
     * "char-bit7"
     *      Character-bit inverse modification. Firmware 2.4 already stores
     *      FLAGS bit 0 in each character's VRAM bit 7:
     *
     *          CTRL-Z 2 -> FLAGS bit 0 clear -> normal subsequent characters
     *          CTRL-Z 3 -> FLAGS bit 0 set   -> inverse subsequent characters
     *
     * No firmware interception or character-ROM substitution is performed.
     */
    this.setInverseVideoMode = function(mode)
    {
        mode = String(mode || "off").toLowerCase();
        if(["off","screen","char-bit7"].indexOf(mode)<0)
            return false;

        if(state.inverseVideoMode===mode)
            return mode;

        state.inverseVideoMode = mode;
        emitVideoChange("inverse-video-mode",-1,mode);
        return mode;
    };

    function videoOutputDevice()
    {
        var devices = Array.isArray(videx.devices) ? videx.devices : [];

        for(var i=0;i<devices.length;i++)
            if(devices[i] && devices[i].id && devices[i].id.DCODE=="VIDEXVID")
                return devices[i];

        return null;
    }

    this.getVideoOutputDevice = function()
    {
        return videoOutputDevice();
    };

    this.setDisplayContrast = function(value)
    {
        var device = videoOutputDevice();
        return device && typeof(device.setContrast)=="function"
            ? device.setContrast(value)
            : false;
    };

    this.setDisplayPhosphor = function(value)
    {
        var device = videoOutputDevice();
        return device && typeof(device.setPhosphor)=="function"
            ? device.setPhosphor(value)
            : false;
    };

    this.setSoftVideoSwitchInstalled = function(flag)
    {
        var device = videoOutputDevice();
        return device && typeof(device.setSoftVideoSwitchInstalled)=="function"
            ? device.setSoftVideoSwitchInstalled(flag)
            : false;
    };
    
    this.getVideoState = function()
    {
        return {
             "vramBank":state.vramBank
            ,"cellWidth":state.cellWidth
            ,"crtcIndex":state.crtcIndex
            ,"charRomKey":state.charRomKey
            ,"inverseVideoMode":state.inverseVideoMode
            ,"revision":state.videoRevision
        };
    };

    this.reset = function()
    {
        state.vramBank = 0;
        state.cellWidth = 9;
        state.crtcIndex = 0;
        crtc.set(CRTC_NORMAL);
        releaseExpansionROM();
        emitVideoChange("reset",-1,0);
        return true;
    };

    this.restart = function()
    {
        return this.reset();
    };
       


    this.deviceToolSlotHTML = function(ctx)
    {
        ctx = ctx || {};

        var slotN = Number(ctx.slotN);
        var target = "apple2plus.hwObj().io.SLOT2obj("+slotN+")";
        var catalog = this.getCharacterROMCatalog();
        var selectedROM = this.getCharacterROMKey();
        var device = videoOutputDevice();
        var display = device && typeof(device.getDisplaySettings)=="function"
            ? device.getDisplaySettings()
            : {
                 "contrast":100
                ,"phosphor":"white"
                ,"softVideoSwitchInstalled":true
              };

        var options = "";
        for(var i=0;i<catalog.length;i++)
        {
            var rom = catalog[i];
            options += "<option value=\""+oCOM.escapeHTML(rom.key)+"\""
                + (rom.key==selectedROM ? " selected" : "")
                + ">"+oCOM.escapeHTML(rom.label)+"</option>";
        }

        var phosphors = ["white","green","amber"];
        var phosphorOptions = "";
        for(var p=0;p<phosphors.length;p++)
        {
            var name = phosphors[p];
            phosphorOptions += "<option value=\""+name+"\""
                + (name==display.phosphor ? " selected" : "")
                + ">"+name.charAt(0).toUpperCase()+name.slice(1)+"</option>";
        }

        var columns = crtc[1] & 0xFF;
        var rows = crtc[6] & 0x7F;
        if(columns<1 || columns>132) columns = 80;
        if(rows<1 || rows>64) rows = 24;

        var contrastID = "videx_contrast_value_"+slotN;
        var contrastSliderID = "videx_contrast_slider_"+slotN;
        var cellWidthID = "videx_cell_width_value_"+slotN;

        /*
         * Compact two-column layout, sized closer to the Serial Pro toolbox.
         * The slot selector already identifies the peripheral, so no duplicate
         * VideoTerm title is rendered inside the panel.
         */
        return ""
    + "<div class=toolbox id=\""+(ctx.toolboxID || ("device_tool_"+ctx.slotID))+"\" hidden>"
    + "  <div class=appbox style=\"text-align:left;width:440px;max-width:calc(100vw - 24px);min-height:75px;padding:4px 6px;\">"
    + "    <div style=\"display:grid;grid-template-columns:60px 105px 50px minmax(95px,1fr) 72px;gap:5px 8px;align-items:center;font-size:11px;\">"

    // Row 1

    + "      <label style=\"white-space:nowrap\">Char ROM</label>"
    + "      <select style=\"min-width:0;width:100%\"" + " onchange=\""+target+".setCharacterROM(this.value)\">"
    +          options
    + "      </select>"

    + "<div style=\"width:55px;height:20px;border:1px solid;padding:0px\">&nbsp;</div>"
    + "<div style=\"min-width:190px;height:20px;border:1px solid;padding:0px\">"
    + "&nbsp;"
    + "</div>"
    + "<div style=\"width:0px\"></div>"

    // Row 2

    + "      <label style=\"white-space:nowrap\">Phosphor</label>"
    + "      <select style=\"min-width:0;width:100%\""
    + "       onchange=\""+target+".setDisplayPhosphor(this.value)\">"
    +          phosphorOptions
    + "      </select>"

    + "      <label style=\"white-space:nowrap\">Inv/Char</label>"
    + "      <select style=\"min-width:0;width:100%\""
    + "       onchange=\""+target+".setInverseVideoMode(this.value)\">"
    + "        <option value=\"off\"" + (state.inverseVideoMode=="off" ? " selected" : "") + ">Off</option>"
    + "        <option value=\"screen\"" + (state.inverseVideoMode=="screen" ? " selected" : "") + ">Whole screen</option>"
    + "        <option value=\"char-bit7\"" + (state.inverseVideoMode=="char-bit7" ? " selected" : "") + ">Character bit 7</option>"
    + "      </select>"
    + "      <select style=\"min-width:0;width:100%\" onchange=\""+target+".setCharacterCellWidth(this.value)\">"
    + "        <option value=\"9\"" + (state.cellWidth==9 ? " selected" : "") + ">9-dot</option>"
    + "        <option value=\"8\"" + (state.cellWidth==8 ? " selected" : "") + ">8-dot</option>"
    + "      </select>"

    // Row 3

    + "      <label style=\"white-space:nowrap;grid-column:1\">Status</label>"
    + "      <span style=\"grid-column:2;font-size:10px;opacity:.75;white-space:nowrap;\">"
    +          columns+"×"+rows+" · Normal Sync"
    + "      </span>"

    + "      <label style=\"white-space:nowrap;grid-column:3\">Contrast</label>"
    + "      <input id=\""+contrastSliderID+"\""
    + "       style=\"grid-column:4;min-width:0;width:100%\""
    + "       type=\"range\" min=\"0\" max=\"200\" step=\"1\""
    + "       value=\""+Number(display.contrast)+"\""
    + "       oninput=\""
    +          target+".setDisplayContrast(this.value);"
    +          "document.getElementById('"+contrastID+"').textContent=this.value+'%'"
    + "       \">"

    + "      <span id=\""+contrastID+"\""
    + "       title=\"Reset contrast to 100%\""
    + "       style=\""
    + "         grid-column:5;"
    + "         cursor:pointer;"
    + "         justify-self:end;"
    + "         white-space:nowrap;"
    + "         width:100%;"
    + "         text-align:center;"
    + "       \""
    + "       onclick=\""
    +          target+".setDisplayContrast(100);"
    +          "document.getElementById('"+contrastSliderID+"').value=100;"
    +          "this.textContent='100%'"
    + "       \">"
    +          Number(display.contrast)+"%"
    + "      </span>"


    + "    </div>"
    + "  </div>"
    + "</div>";
    };

}
