//
// Copyright (c) 2022 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_ramcard.js

oEMU.component.IO["RamCard"] = {RamCard};

function RamCard()
{
    const BANK          =  0
         ,BANK_SIZE     =  4096
         ,RAMCARD       =  4096
         ,RAMCARD_SIZE  =  8192

    this.active = true; 
    this.bDebug = false;   // debug all RAM R/W operations
    this.bDebug_S = false; // debug soft switch updates
 
    this.softswitch = {
        0: {"RAMCARD":true                       }
       ,1: {               "WE":true             }
       ,2: {                                     }
       ,3: {"RAMCARD":true,"WE":true,            }

       ,8: {"RAMCARD":true          ,"BANK1":true}
       ,9: {               "WE":true,"BANK1":true}
       ,10:{                         "BANK1":true}
       ,11:{"RAMCARD":true,"WE":true,"BANK1":true}
    } 


    // TODO FVD - emulate status leds !

    this.softswitch_pos = 1;    // default softswitch
    this.NEXT  = false;         // flag to remember double-triggered Write-Enables

    this.soft_switch = function(addr)
    {
        if(this.bDebug_S)
        {
            if(this.softswitch[addr].WE)
            {
                if(this.NEXT) console.log("SOFTSWITCH $"+this.getHexByte(addr)+" -> "+JSON.stringify(this.softswitch[addr]));
                else          console.log("waiting for NEXT to write-enable ($"+this.getHexByte(addr)+")");
            }
            else console.log("SOFTSWITCH $"+this.getHexByte(addr)+" -> "+JSON.stringify(this.softswitch[addr]));
        }

        // only flip switch after double trigger
        if(this.softswitch[addr].WE) this.NEXT = this.NEXT==false?true:this.NEXT;
        else this.NEXT= false;

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
                d8 = this.BANK[sw.BANK1?0:1][addr];
                if(this.bDebug) console.log("BANK"+(sw.BANK1?1:2)+" read $#"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr));
            }
            else d8 = apple2Rom[addr];  
        }
        else if(addr < RAMCARD+RAMCARD_SIZE)
        {
            var sw = this.softswitch[this.softswitch_pos];
            if(sw.RAMCARD)
            {
                d8 = this.RAMCARD[addr-RAMCARD];
                if(this.bDebug) console.log("RAMCARD read #$"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr-RAMCARD));
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
            if(sw.WE && this.NEXT)
            {
                this.BANK[sw.BANK1?0:1][addr] = d8;
                if(this.bDebug) console.log("BANK="+(sw.BANK1?1:2)+" write #$"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr));
            } 
            else if(this.bDebug) console.log("FAILED ATTEMPT: (WE="+(sw.WE?true:false)+") BANK"+(sw.BANK1?1:2)+" write #$"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr));       
        }
        else if(addr < RAMCARD+RAMCARD_SIZE)
        {
            var sw = this.softswitch[this.softswitch_pos];
            if(sw.WE && this.NEXT)
            {
                this.RAMCARD[addr-RAMCARD] = d8;
                if(this.bDebug) console.log("RAMCARD write #$"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr-RAMCARD));
            }
            else if(this.bDebug) console.log("FAILED ATTEMPT: (WE="+(sw.WE?true:false)+") RAMCARD write #$"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr-RAMCARD));
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

// SiteMinder SP6
// Kubernetes development
// Postman API
// Token security knowledge (Jason Web Tokens)
// Siteminder understanding


// propose new timeframe
// around midday  3-4 PM
// Lionel

// Grant Clements
// Jeoffrey Lemoine

// replacement of Brahma Reddy

/*  EXAMPLE CODE

M.PRNTYX  = $F940   ; print hex word (Y=hi X=lo)
M.OUTSP   = $DB57   ; space

*=$6000

; WRITE BANK2 and RAMCARD in mode 3 :o)
LDA $C083   ; 3: {"RAMCARD":true,"WE":true,"BANK":2}
LDA $C083   ; 3: {"RAMCARD":true,"WE":true,"BANK":2}
LDA #$12
STA $E000   ; WRITE IN RAMCARD
LDA #$34
STA $D000   ; WRITE IN BANK 2
LDX $D000
LDY $E000
LDA $C081   ; 1: {"WE":true,"BANK":2}
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
LDA $C081   ; 1: {"WE":true,"BANK":2}
JSR M.PRNTYX
JSR M.OUTSP

; WRITE BANK2 and RAMCARD in mode 1 :o)
LDA $C081   ; 1: {"WE":true,"BANK":2}
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
LDA $C081   ; 1: {"WE":true,"BANK":2}
JSR M.PRNTYX
JSR M.OUTSP

RTS





CALL-151
6000: AD 83 C0 AD 83 C0 A9 12 
6008: 8D 00 E0 A9 34 8D 00 D0 
6010: AE 00 D0 AC 00 E0 AD 81 
6018: C0 AD 81 C0 20 40 F9 20 
6020: 57 DB AD 82 C0 A9 23 8D 
6028: 00 E0 A9 45 8D 00 D0 AE 
6030: 00 D0 AC 00 E0 AD 81 C0 
6038: AD 81 C0 20 40 F9 20 57 
6040: DB AD 81 C0 AD 81 C0 A9 
6048: 34 8D 00 E0 A9 56 8D 00 
6050: D0 AE 00 D0 AC 00 E0 20 
6058: 40 F9 20 57 DB AD 80 C0 
6060: A9 45 8D 00 D0 A9 67 8D 
6068: 00 E0 AE 00 D0 AC 00 E0 
6070: AD 81 C0 AD 81 C0 20 40 
6078: F9 20 57 DB 60 








*/

