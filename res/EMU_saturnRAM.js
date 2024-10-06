//
// Copyright (c) 2022 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_saturnRAM.js

if(oEMU===undefined) var oEMU = {"component":{"IO":{"RamCard":new RamCard()}}}
else oEMU.component.IO.RamCard = new RamCard();

function RamCard()
{
    var   BANK = 0;
    const BANK_SIZE     =  4096
         ,RAMCARD       =  4096
         ,RAMCARD_SIZE  =  8192

    this.active = true; 
    var bDebug = false;   // debug all RAM R/W operations
    var bDebug_S = true;  // debug soft switch updates

    var stats = new Uint32Array(4);   // 
 
    var softswitch = {
        0x0: {"RAMCARD":true             ,"BANKA":true}
       ,0x1: {               "WE":true   ,"BANKA":true}
       ,0x2: {                            "BANKA":true}
       ,0x3: {"RAMCARD":true,"WE":true   ,"BANKA":true}

       ,0x4: {                            "BANK":0}
       ,0x5: {                            "BANK":1}
       ,0x6: {                            "BANK":2}
       ,0x7: {                            "BANK":3}

       ,0x8: {"RAMCARD":true             ,"BANKB":true}
       ,0x9: {               "WE":true   ,"BANKB":true}
       ,0xA:{                             "BANKB":true}
       ,0xB:{"RAMCARD":true, "WE":true   ,"BANKB":true}

       ,0xC: {                            "BANK":4}
       ,0xD: {                            "BANK":5}
       ,0xE: {                            "BANK":6}
       ,0xF: {                            "BANK":7}       
    } 


    // TODO FVD - emulate status leds !

    var softswitch_pos = 0x1;    // default softswitch
    var NEXT  = false;         // flag to remember double-triggered Write-Enables

    this.soft_switch = function(addr)
    {
        const bBANKSW = typeof(softswitch[addr].BANK)!="undefined"

        if(bDebug_S)
        {
            if(softswitch[addr].WE)
            {
                if(NEXT) console.log("SOFTSWITCH $"+this.getHexByte(addr)+" -> "+JSON.stringify(softswitch[addr]));
                else     console.log("waiting for NEXT to write-enable ($"+this.getHexByte(addr)+")");
            }
            else  if(bBANKSW) console.log("SOFTSWITCH $"+this.getHexByte(addr)+" -> BANK"+(softswitch[addr].BANK+1));
            else console.log("SOFTSWITCH $"+this.getHexByte(addr)+" -> "+JSON.stringify(softswitch[addr]));
        }

        if(bBANKSW) {BANK = softswitch[addr].BANK; return 0}

        // only flip switch write-enable after double trigger
        if(softswitch[addr].WE) NEXT = NEXT==false?true:NEXT;
        else                    NEXT= false;

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
                d8 = BANK_MEM[BANK][sw.BANKB?0:1][addr];
                if(bDebug) console.log("BANK"+(BANK+1)+(sw.BANKB?"A":"B")+" read $#"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr));
            }
            else d8 = apple2Rom[addr];  
        }
        else if(addr < RAMCARD+RAMCARD_SIZE)
        {
            var sw = softswitch[softswitch_pos];
            if(sw.RAMCARD)
            {
                d8 = RAMCARD_MEM[BANK][addr-RAMCARD];
                if(bDebug) console.log("RAMCARD read #$"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr-RAMCARD));
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
                BANK_MEM[BANK][sw.BANKB?0:1][addr] = d8;
                //if(bDebug) console.log("BANK="+(sw.BANKB?1:2)+" write #$"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr));
            } 
            else if(bDebug) console.log("FAILED ATTEMPT: (WE="+(sw.WE?true:false)+") BANK"+(BANK+1)+(sw.BANKB?"A":"B")+" write #$"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr));       
        }
        else if(addr < RAMCARD+RAMCARD_SIZE)
        {
            var sw = softswitch[softswitch_pos];
            if(sw.WE && NEXT)
            {
                RAMCARD_MEM[BANK][BANK][addr-RAMCARD] = d8;
                //if(bDebug) console.log("RAMCARD write #$"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr-RAMCARD));
            }
            else if(bDebug) console.log("FAILED ATTEMPT: (WE="+(sw.WE?true:false)+") RAMCARD write #$"+this.getHexByte(d8)+" at addr $"+this.getHexWord(addr-RAMCARD));
        }

        return 0;
    }    

    var hextab= ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
    this.getHexByte    = function(v) { return hextab[v>>4]+hextab[v&0xf] }
    this.getHexWord = function(v)
    {
        return '' + hextab[Math.floor(v / 0x1000)]
                            + hextab[Math.floor((v & 0x0f00) / 256)]
                            + hextab[Math.floor((v & 0xf0) / 16)]
                            + hextab[v & 0x000f];
    }


//  ██████   █████  ███    ██ ██   ██   
//  ██   ██ ██   ██ ████   ██ ██  ██    
//  ██████  ███████ ██ ██  ██ █████  
//  ██   ██ ██   ██ ██  ██ ██ ██  ██    
//  ██████  ██   ██ ██   ████ ██   ██ 
 
    // 8 * 2*4K
    var BANK_MEM = [
                         [ new Uint8Array(4096), new Uint8Array(4096) ]
                        ,[ new Uint8Array(4096), new Uint8Array(4096) ]
                        ,[ new Uint8Array(4096), new Uint8Array(4096) ]
                        ,[ new Uint8Array(4096), new Uint8Array(4096) ]
                        ,[ new Uint8Array(4096), new Uint8Array(4096) ]
                        ,[ new Uint8Array(4096), new Uint8Array(4096) ]
                        ,[ new Uint8Array(4096), new Uint8Array(4096) ]
                        ,[ new Uint8Array(4096), new Uint8Array(4096) ]
                    ];
    // 8 * 8K
    var RAMCARD_MEM = [
                         [ new Uint8Array(8192) ]
                        ,[ new Uint8Array(8192) ]
                        ,[ new Uint8Array(8192) ]
                        ,[ new Uint8Array(8192) ]
                        ,[ new Uint8Array(8192) ]
                        ,[ new Uint8Array(8192) ]
                        ,[ new Uint8Array(8192) ]
                        ,[ new Uint8Array(8192) ]
                      ];
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

