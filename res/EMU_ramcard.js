//
// Copyright (c) 2022 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/AppleII-IDE/main/LICENSE.md
//
// EMU_ramcard.js.js

function RamCard()
{
    const BANK          =  0
         ,BANK_SIZE     =  4096
         ,RAMCARD       =  4096
         ,RAMCARD_SIZE  =  8192

    this.active = true;
 
    this.softswitch = {
        0: {"RAMCARD":true          ,"BANK":2}
       ,1: {               "WE":true,"BANK":2}
       ,2: {                         "BANK":2}
       ,3: {"RAMCARD":true,"WE":true,"BANK":2}

       ,8: {"RAMCARD":true          ,"BANK":1}
       ,9: {               "WE":true,"BANK":1}
       ,10:{                         "BANK":1}
       ,11:{"RAMCARD":true,"WE":true,"BANK":1}     
    } 

    this.softswitch_pos = 1;    // default softswitch

    this.soft_switch = function(addr)
    {
        console.log("RAMCARD softswitch addr: $"+this.getHexByte(addr));
        console.log(this.softswitch[addr]);
        this.softswitch_pos = addr;
        return 0;
    }

    this.read = function(addr)
    {
        if(addr < BANK+BANK_SIZE)
        {
            var sw = this.softswitch[this.softswitch_pos];
            if(sw.RAMCARD)
            {
                d8 = this.BANK[sw.BANK-1][addr];
                console.log("BANK"+sw.BANK+" read $#"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr));
            }
            else d8 = apple2Rom[addr];

            
        }
        else if(addr < RAMCARD+RAMCARD_SIZE)
        {
            var sw = this.softswitch[this.softswitch_pos];
            if(sw.RAMCARD)
            {
                d8 = this.RAMCARD[addr-RAMCARD];
                console.log("RAMCARD read #$"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr-RAMCARD));
            }
            else d8 = apple2Rom[addr];
        }

        return d8;
    }

    this.write = function(addr,d8)
    {
        if(addr < BANK+BANK_SIZE)
        {
            var sw = this.softswitch[this.softswitch_pos];
            if(sw.WE)
            {
                this.BANK[sw.BANK-1][addr] = d8;
                console.log("BANK"+sw.BANK+" write #$"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr));
            }
            if(!sw.WE) console.log("BANK"+sw.BANK+" write-protected at addr $"+this.getHexWord(addr));          
        }
        else if(addr < RAMCARD+RAMCARD_SIZE)
        {
            var sw = this.softswitch[this.softswitch_pos];
            if(sw.WE)
            {
                this.RAMCARD[addr-RAMCARD] = d8;
                console.log("RAMCARD write #$"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr-RAMCARD));
            }
            if(!sw.WE) console.log("RAMCARD write-protected at addr $"+this.getHexWord(addr-RAMCARD));
        }

        return 0;
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


//  ██████   █████  ███    ██ ██   ██      ██        ██        ██████  
//  ██   ██ ██   ██ ████   ██ ██  ██      ███        ██             ██ 
//  ██████  ███████ ██ ██  ██ █████        ██     ████████      █████  
//  ██   ██ ██   ██ ██  ██ ██ ██  ██       ██     ██  ██       ██      
//  ██████  ██   ██ ██   ████ ██   ██      ██     ██████       ███████ 
 

    this.BANK = [ new Uint8Array(4096), new Uint8Array(4096) ];  // 2 * 4K
   

//  ██████   █████  ███    ███  ██████  █████  ██████  ██████      ██████   █████  ███    ███ 
//  ██   ██ ██   ██ ████  ████ ██      ██   ██ ██   ██ ██   ██     ██   ██ ██   ██ ████  ████ 
//  ██████  ███████ ██ ████ ██ ██      ███████ ██████  ██   ██     ██████  ███████ ██ ████ ██ 
//  ██   ██ ██   ██ ██  ██  ██ ██      ██   ██ ██   ██ ██   ██     ██   ██ ██   ██ ██  ██  ██ 
//  ██   ██ ██   ██ ██      ██  ██████ ██   ██ ██   ██ ██████      ██   ██ ██   ██ ██      ██

    this.RAMCARD = new Uint8Array(8192);  // 8K  

}

/*  EXAMPLE CODE

M.PRNTYX  = $F940   ; print hex word (Y=hi X=lo)
M.OUTSP   = $DB57   ; space

*=$6000

; WRITE BANK2 and RAMCARD in mode 3 :o)
LDA $C083   ; 3: {"RAMCARD":true,"WE":true,"BANK":2}
LDA #$12
STA $E000   ; WRITE IN RAMCARD
LDA #$34
STA $D000   ; WRITE IN BANK 2
LDX $D000
LDY $E000
LDA $C081   ; 1: {"WE":true,"BANK":2}
JSR M.PRNTYX
JSR M.OUTSP

; WRITE BANK2 and RAMCARD in mode 2 :o(
LDA $C082   ; 2: {"BANK":2}
LDA #$23
STA $E000   ; WRITE IN RAMCARD
LDA #$45
STA $D000   ; WRITE IN BANK 2
LDX $D000
LDY $E000
LDA $C081   ; 1: {"WE":true,"BANK":2}
JSR M.PRNTYX
JSR M.OUTSP

; WRITE BANK2 and RAMCARD in mode 1 :o)
LDA $C081   ; 1: {"WE":true,"BANK":2}
LDA #$34
STA $E000   ; WRITE IN RAMCARD
LDA #$56
STA $D000   ; WRITE IN BANK 2
LDX $D000
LDY $E000
JSR M.PRNTYX
JSR M.OUTSP

; WRITE BANK2 and RAMCARD in mode 0 :o(
LDA $C080   ; 0: {"RAMCARD":true,"BANK":2}
LDA #$45
STA $D000   ; WRITE IN BANK 2
LDA #$67
STA $E000   ; WRITE IN RAMCARD
LDX $D000
LDY $E000
LDA $C081   ; 1: {"WE":true,"BANK":2}
JSR M.PRNTYX
JSR M.OUTSP

RTS





CALL-151
6000: AD 83 C0 A9 12 8D 00 E0 
6008: A9 34 8D 00 D0 AE 00 D0 
6010: AC 00 E0 AD 81 C0 20 40 
6018: F9 20 57 DB AD 82 C0 A9 
6020: 23 8D 00 E0 A9 45 8D 00 
6028: D0 AE 00 D0 AC 00 E0 AD 
6030: 81 C0 20 40 F9 20 57 DB 
6038: AD 81 C0 A9 34 8D 00 E0 
6040: A9 56 8D 00 D0 AE 00 D0 
6048: AC 00 E0 20 40 F9 20 57 
6050: DB AD 80 C0 A9 45 8D 00 
6058: D0 A9 67 8D 00 E0 AE 00 
6060: D0 AC 00 E0 AD 81 C0 20 
6068: 40 F9 20 57 DB 60 







*/

