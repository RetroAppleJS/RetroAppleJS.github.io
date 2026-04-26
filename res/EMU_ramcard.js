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

    this.id    = {"PCODE":"MS16K", "icon":"fa fa-microchip"}
    this.state = {"active":true};
    this.mem_mon = {"ramcard":{}, "bankA":{}, "bankB":{}};
    this.bMEM_monitoring = false;
    this.MEM_grid_cnf = {"id_prefix":"x","digits":5};
    this.mem_layout = {
        "3F000-40000":["#D06060","MS16K","RF"]
       ,"3E000-3F000":["#D06060","MS16K","RE"]
       ,"2D000-2E000":["#B05050","MS16K BANK B","DB"]
       ,"1D000-1E000":["#A04040","MS16K BANK A","DA"]
    };    

    this.MEM_grid = {
        "ramcard":{
            "cnf":{"id_prefix":"x","digits":4},
            "layout":{
                "F000-10000":["#D06060","MS16K","RF"],
                "E000-F000":["#D06060","MS16K","RE"]
            }
        },
        "bankB":{
            "cnf":{"id_prefix":"z","digits":4},
            "layout":{
                "D000-E000":["#B05050","MS16K BANK B","DB"]
            }
        },
        "bankA":{
            "cnf":{"id_prefix":"y","digits":4},
            "layout":{
                "D000-E000":["#A04040","MS16K BANK A","DA"]
            }
        }
    };

    var bDebug   = false;   // debug all RAM R/W operations
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


    this.mark_MEM_monitoring = function(bucket, addr)
    {
        if(this.bMEM_monitoring)
            this.mem_mon[bucket][ addr >> oMEMGRID.mem_gran ] = true;
    }

    this.reset_MEM_monitoring = function()
    {
        this.mem_mon = {"ramcard":{}, "bankA":{}, "bankB":{}};
    }

    this.enable_MEM_monitoring = function(b)
    {
        this.bMEM_monitoring = b;
        if(b) this.reset_MEM_monitoring();
    }


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
                this.mark_MEM_monitoring(sw.BANK1 ? "bankA" : "bankB", addr + 0xD000);
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
                this.mark_MEM_monitoring("ramcard", addr + 0xD000);
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

