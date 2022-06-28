//
// Copyright (c) 2022 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/AppleII-IDE/main/LICENSE.md
//
// EMU_ramcard.js.js

function RamCard()
{
    this.active = true;
    this.softswitch = {
        0: {                "RAMCARD":"RWP","BANK2":true}
       ,1: {"APPLE ROM":"R","RAMCARD":"WE" ,"BANK2":true}
       ,2: {"APPLE ROM":"R","RAMCARD":"WP" ,"BANK2":true}
       ,3: {                "RAMCARD":"RWE","BANK2":true}

       ,8: {                "RAMCARD":"RWP","BANK1":true}
       ,9: {"APPLE ROM":"R","RAMCARD":"WE" ,"BANK1":true}
       ,10:{"APPLE ROM":"R","RAMCARD":"WP" ,"BANK1":true}
       ,11:{                "RAMCARD":"RWE","BANK1":true}       
    }

    this.read = function(addr)
    {
        console.log("RAMCARD addr: $"+this.getHexByte(addr));
        console.log(this.softswitch[addr]);
        return this.softswitch[addr]
    }

    this.hextab= ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
    this.getHexByte    = function(v) { return this.hextab[v>>4]+this.hextab[v&0xf] }
    this.getHexWord = function(v)
    {
        return '' + hextab[Math.floor(v / 0x1000)]
                            + hextab[Math.floor((v & 0x0f00) / 256)]
                            + hextab[Math.floor((v & 0xf0) / 16)]
                            + hextab[v & 0x000f];
    }
}
