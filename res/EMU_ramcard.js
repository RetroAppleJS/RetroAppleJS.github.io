//
// Copyright (c) 2022 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_ramcard.js

if(oEMU===undefined) var oEMU = {"component":{"IO":{"RamCard":new RamCard()}}}
else oEMU.component.IO.RamCard = new RamCard();

function RamCard()
{
    const BANK_SIZE     =  4096
         ,RAMCARD       =  4096
         ,RAMCARD_SIZE  =  8192

    this.active = true; 
    var bDebug = false;   // debug all RAM R/W operations
    var bDebug_S = false; // debug soft switch updates
 
    var softswitch = {
        0x0: {"RAMCARD":true                       }
       ,0x1: {               "WE":true             }
       ,0x2: {                                     }
       ,0x3: {"RAMCARD":true,"WE":true,            }

       ,0x8: {"RAMCARD":true          ,"BANK1":true}
       ,0x9: {               "WE":true,"BANK1":true}
       ,0xA:{                         "BANK1":true}
       ,0xB:{"RAMCARD":true,"WE":true,"BANK1":true}
    } 


    // TODO FVD - emulate status leds !

    var softswitch_pos = 1;    // default softswitch
    var NEXT  = false;         // flag to remember double-triggered Write-Enables

    this.soft_switch = function(addr)
    {
        if(bDebug_S)
        {
            if(softswitch[addr].WE)
            {
                if(NEXT) console.log("SOFTSWITCH $"+oCOM.getHexByte(addr)+" -> "+JSON.stringify(softswitch[addr]));
                else          console.log("waiting for NEXT to write-enable ($"+oCOM.getHexByte(addr)+")");
            }
            else console.log("SOFTSWITCH $"+oCOM.getHexByte(addr)+" -> "+JSON.stringify(softswitch[addr]));
        }

        // only flip switch after double trigger
        if(softswitch[addr].WE) NEXT = NEXT==false?true:NEXT;
        else NEXT= false;

        softswitch_pos = addr;
        return 0;
    }

    this.read = function(addr)
    {
        if(addr < BANK_SIZE)
        {
            var sw = softswitch[softswitch_pos];
            if(sw.RAMCARD)
            {
                d8 = BANK_MEM[sw.BANK1?0:1][addr];
                if(bDebug) console.log("BANK"+(sw.BANK1?1:2)+" read $#"+oCOM.getHexByte(d8)+" at addr $"+oCOM.getHexWord(addr));
            }
            else d8 = apple2Rom[addr];  
        }
        else if(addr < RAMCARD+RAMCARD_SIZE)
        {
            var sw = softswitch[softswitch_pos];
            if(sw.RAMCARD)
            {
                d8 = RAMCARD_MEM[addr-RAMCARD];
                if(bDebug) console.log("RAMCARD read #$"+oCOM.getHexByte(d8)+" at addr $"+oCOM.getHexWord(addr-RAMCARD));
            }
            else d8 = apple2Rom[addr];
        }

        return d8;
    }

    this.write = function(addr,d8)
    {
        if(addr < BANK_SIZE)
        {
            var sw = softswitch[softswitch_pos];
            if(sw.WE && NEXT)
            {
                BANK_MEM[sw.BANK1?0:1][addr] = d8;
                if(bDebug) console.log("BANK="+(sw.BANK1?1:2)+" write #$"+oCOM.getHexByte(d8)+" at addr $"+oCOM.getHexWord(addr));
            } 
            else if(bDebug) console.log("FAILED ATTEMPT: (WE="+(sw.WE?true:false)+") BANK"+(sw.BANK1?1:2)+" write #$"+oCOM.getHexByte(d8)+" at addr $"+oCOM.getHexWord(addr));       
        }
        else if(addr < RAMCARD+RAMCARD_SIZE)
        {
            var sw = softswitch[softswitch_pos];
            if(sw.WE && NEXT)
            {
                RAMCARD_MEM[addr-RAMCARD] = d8;
                if(bDebug) console.log("RAMCARD write #$"+oCOM.getHexByte(d8)+" at addr $"+oCOM.getHexWord(addr-RAMCARD));
            }
            else if(bDebug) console.log("FAILED ATTEMPT: (WE="+(sw.WE?true:false)+") RAMCARD write #$"+oCOM.getHexByte(d8)+" at addr $"+oCOM.getHexWord(addr-RAMCARD));
        }

        return 0;
    }


//  ██████   █████  ███    ██ ██   ██      ██        ██        ██████  
//  ██   ██ ██   ██ ████   ██ ██  ██      ███        ██             ██ 
//  ██████  ███████ ██ ██  ██ █████        ██     ████████      █████  
//  ██   ██ ██   ██ ██  ██ ██ ██  ██       ██     ██  ██       ██      
//  ██████  ██   ██ ██   ████ ██   ██      ██     ██████       ███████ 
 

    var BANK_MEM = [ new Uint8Array(4096), new Uint8Array(4096) ];  // 2 * 4K
   

//  ██████   █████  ███    ███  ██████  █████  ██████  ██████      ██████   █████  ███    ███ 
//  ██   ██ ██   ██ ████  ████ ██      ██   ██ ██   ██ ██   ██     ██   ██ ██   ██ ████  ████ 
//  ██████  ███████ ██ ████ ██ ██      ███████ ██████  ██   ██     ██████  ███████ ██ ████ ██ 
//  ██   ██ ██   ██ ██  ██  ██ ██      ██   ██ ██   ██ ██   ██     ██   ██ ██   ██ ██  ██  ██ 
//  ██   ██ ██   ██ ██      ██  ██████ ██   ██ ██   ██ ██████      ██   ██ ██   ██ ██      ██

    var RAMCARD_MEM = new Uint8Array(8192);  // 8K  

}

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

