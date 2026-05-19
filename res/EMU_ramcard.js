//    ██████   █████  ███    ███  ██████  █████  ██████  ██████  
//    ██   ██ ██   ██ ████  ████ ██      ██   ██ ██   ██ ██   ██ 
//    ██████  ███████ ██ ████ ██ ██      ███████ ██████  ██   ██ 
//    ██   ██ ██   ██ ██  ██  ██ ██      ██   ██ ██   ██ ██   ██ 
//    ██   ██ ██   ██ ██      ██  ██████ ██   ██ ██   ██ ██████ 
//
// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_ramcard.js

if(oEMU===undefined) var oEMU = {"component":{"IO":{"RamCard":new RamCard()}}}
else oEMU.component.IO["RamCard"] = new RamCard();

function RamCard()
{
    this.id     = {"PCODE":"MS16K", "icon":"fa fa-microchip"}
    this.state  = {
        "active":true
        ,"slot":null
        ,"softswitch_pos":1
        ,"bMapped":false
        ,"RR":false         // flag to remember double-triggered Write-Enables (by double read)
    };
    this.action = {"SlotIO": { "RD":{ "callback":
        soft_switch.bind(this) 
    } } }

    const BANK_SIZE   = 0x1000                        // 4K bank memory size = contiguous bank offset  = 4Kbytes  
    const CONT_SIZE   = 0x2000;                       // 8K contiguous memory size
    const BANK_TOT_SIZE = BANK_SIZE * 2;              // 2*4K linearised bank size
    const TOTAL_SIZE    = BANK_TOT_SIZE + CONT_SIZE;  // 16K

    var RAMCARD_MEM = new Uint8Array(TOTAL_SIZE);   // PERIPHERAL RAM

    var card      = this;
    var bDebug_sw = true;      // debug soft switch updates (light)
    var bDebug    = false;     // debug all RAM R/W operations   
    
    function dbg_op(label)
    {
        return {
            "label": label,
            "bytes": 0,
            "checksum": new Uint16Array(1),
            "firstAddr": null,
            "lastAddr": null,
            "suffix": ""
        };
    }

    // ON: 0="SWITCH OFF" 1="SWITCH ON" | WE: 0:"WRITE-PROTECT" 1:"WRITE-ENABLE"  | BANK: 0="BANK A", 1="BANK B"
    var softswitch = {
        0x0: {"ON":1,         "BANK":0}  // READ: $D000-$DFFF -> BANK_MEM[1]  | READ: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM
       ,0x1: {        "WE":1, "BANK":0}  // READ: $D000-$DFFF & $E000-$EFFF & $F000-$FFFF -> apple2Rom | WRITE $D000-$DFFF -> BANK_MEM[1]  | WRITE: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM
       ,0x2: {                "BANK":0}  // READ: $D000-$DFFF & $E000-$EFFF & $F000-$FFFF -> apple2Rom  
       ,0x3: {"ON":1, "WE":1, "BANK":0}  // READ: $D000-$DFFF -> BANK_MEM[1]  | READ: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM | WRITE $D000-$DFFF -> BANK_MEM[1]  | WRITE: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM

       ,0x8: {"ON":1,         "BANK":1}  // READ: $D000-$DFFF -> BANK_MEM[0]  | READ: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM
       ,0x9: {        "WE":1, "BANK":1}  // READ: $D000-$DFFF & $E000-$EFFF & $F000-$FFFF -> apple2Rom | WRITE $D000-$DFFF -> BANK_MEM[0]  | WRITE: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM
       ,0xA: {                "BANK":1}  // READ: $D000-$DFFF & $E000-$EFFF & $F000-$FFFF -> apple2Rom  
       ,0xB: {"ON":1, "WE":1, "BANK":1}  // READ: $D000-$DFFF -> BANK_MEM[0]  | READ: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM | WRITE $D000-$DFFF -> BANK_MEM[0]  | WRITE: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM
    }

    // TODO FVD - emulate status leds !
    this.updateMemoryMap = function(bRamcardActive)
    {
        var hw = apple2plus.hwObj();
        if(bDebug_sw) { debug_updateMemoryMap(bRamcardActive,this) }
        if (!hw || !hw.RD || !hw.WR || !hw.default_map) return false;

        const iD = hw.lineDecode(0xD000), iE = hw.lineDecode(0xE000), iF = hw.lineDecode(0xF000);

         // READ MAPPING
        if (bRamcardActive)
        {   
            // PERIPHERAL RAM IS SELECTED FOR READ
            hw.RD[iD] = function(addr,iD) { return card.read(addr - 0xD000); };
            hw.RD[iE] = function(addr,iE) { return card.read(addr - 0xD000); };
            hw.RD[iF] = function(addr,iF) { return card.read(addr - 0xD000); };
        }
        else
        {  
            // HARDWARE ROM IS SELECTED FOR READ
            hw.RD[iD] = hw.default_map.RD[iD];
            hw.RD[iE] = hw.default_map.RD[iE];
            hw.RD[iF] = hw.default_map.RD[iF];
        }
        // WRITE MAPPING

        hw.WR[iD] = function(addr,d8) { return card.write(addr - 0xD000, d8); };
        hw.WR[iE] = function(addr,d8) { return card.write(addr - 0xD000, d8); };
        hw.WR[iF] = function(addr,d8) { return card.write(addr - 0xD000, d8); };

        this.state.bMapped = bRamcardActive;
        return true;
    };

    this.reset = function()
    {
        debug_flush();
        this.state.bMapped = false;
        this.state.RR = false;
    }

    function soft_switch(addr) { return this.soft_switch(addr); }
    this.soft_switch = function(addr)
    {
        var MEM_RAMCARD_IO =  0x80;
        var loc_addr = addr - MEM_RAMCARD_IO;       // SlotIO offset
        var sw = softswitch[loc_addr] || {};
        debug_flush(); if(bDebug_sw) debug_soft_switch(loc_addr,sw,this.state);
        this.state.RR = sw.WE==1 ? (this.state.RR == false ? true : this.state.RR) : false;  // only flip write-enable state after double trigger sw.WE==1
        this.state.softswitch_pos = loc_addr;

        if((sw.WE==1 && this.state.RR==false) == false) // Do not update memory map when WRITE ENABLE is triggered for the first time
        {
            var ok = this.updateMemoryMap(!!sw.ON);
            if(bDebug_sw && !ok) console.warn(this.id.PCODE+": SOFTSWITCH could not update memory map");
        }
        return 0;
    };

    function address_encoder(addr,bank_bit) 
    { 
        return addr + ((bank_bit | !!(addr >> 12)) << 12) 
    }

    this.read = function(addr)
    {
        var sw = softswitch[this.state.softswitch_pos] || {};
        const d8 = RAMCARD_MEM[ address_encoder(addr,sw.BANK) ]; 
        if(bDebug) debug_record( addr < BANK_SIZE ? DBG_READ_BANK : DBG_READ_RAMCARD
            , addr
            , d8
            , addr < BANK_SIZE ? (sw.BANK ? "A" : "B") : null);

        return d8;
    }

    this.write = function(addr,d8)
    {
        var sw = softswitch[this.state.softswitch_pos] || {};
        if(sw.WE==1 && this.state.RR) 
        {
            RAMCARD_MEM[ address_encoder(addr,sw.BANK) ] = d8;
            this.mark_MEM_monitoring(addr < BANK_SIZE ? (sw.BANK==0 ? "bankA" : "bankB") : "ramcard", addr + 0xD000);

            if(bDebug) debug_record( addr < BANK_SIZE ? DBG_WRITE_BANK : DBG_WRITE_RAMCARD
                , addr
                , d8
                , addr < BANK_SIZE ? (sw.BANK==0 ? "A" : "B") : null);
            if(this.bMEM_monitoring) this.MEM_monitoring()
        }
        else {  debug_flush(); console.warn(this.id.PCODE+": FAILED ATTEMPT: (WE="+(sw.WE==1?true:false)+") BANK"+(sw.BANK==0?"A":"B")+" write #$"+oCOM.getHexByte(d8)+" at addr $"+oCOM.getHexWord(addr)) }

        return 0;
    };


    //       ______  _____  _____  _____    __             __                                 
    //     .' ___  ||_   _||_   _||_   _|  [  |           [  |                                
    //    / .'   \_|  | |    | |    | |     | |--.  .---.  | | _ .--.   .---.  _ .--.  .--.   
    //    | |   ____  | '    ' |    | |     | .-. |/ /__\\ | |[ '/'`\ \/ /__\\[ `/'`\]( (`\]  
    //    \ `.___]  |  \ \__/ /    _| |_    | | | || \__., | | | \__/ || \__., | |     `'.'.  
    //     `._____.'    `.__.'    |_____|  [___]|__]'.__.'[___]| ;.__/  '.__.'[___]   [\__) ) 
    //                                                        [__|                            

    this.mem_mon = {"ramcard":{}, "bankA":{}, "bankB":{}};
    this.bMEM_monitoring = false;
    this.MEM_grid_cnf = {"id_prefix":"x","digits":5};
    this.mem_layout = {
        "3F000-40000":["#D06060",this.id.PCODE+" CONT","RF"]
       ,"3E000-3F000":["#D06060",this.id.PCODE+" CONT","RE"]
       ,"2D000-2E000":["#B05050",this.id.PCODE+" BANK B","DB"]
       ,"1D000-1E000":["#A04040",this.id.PCODE+" BANK A","DA"]
    };    
    this.MEM_grid = 
    {
        "ramcard":{"cnf":{"id_prefix":"x","digits":4},"layout":{"F000-10000":["#D06060",this.id.PCODE+ "CONT","RF"],"E000-F000":["#D06060",this.id.PCODE+" CONT","RE"]}},
        "bankB":{"cnf":{"id_prefix":"z","digits":4},"layout":{"D000-E000":["#B05050",this.id.PCODE+" BANK B","DB"]}},
        "bankA":{"cnf":{"id_prefix":"y","digits":4},"layout":{"D000-E000":["#A04040",this.id.PCODE+" BANK A","DA"]}}
    };
    this.mark_MEM_monitoring = function(bucket, addr)
    {
        if(!this.bMEM_monitoring) return;
        if(!this.mem_mon[bucket]) this.mem_mon[bucket] = {};
        this.mem_mon[bucket][addr >> oMEMGRID.mem_gran] = true;
    };
    this.reset_MEM_monitoring = function() { this.mem_mon = {"ramcard":{}, "bankA":{}, "bankB":{}}; }
    this.enable_MEM_monitoring = function(b) 
    {
        this.bMEM_monitoring = !!b; 
        if(b) this.reset_MEM_monitoring(); 
    }

    this.MEM_monitoring = function()
    {
        // TODO: let EMU_ramcard do this when it is plugged in
        if(this && this.state.active && this.MEM_grid)
        {
            oMEMGRID.paint_grid(this.MEM_grid.ramcard.layout, this.MEM_grid.ramcard.cnf);
            oMEMGRID.paint_grid(this.MEM_grid.bankB.layout,   this.MEM_grid.bankB.cnf);
            oMEMGRID.paint_grid(this.MEM_grid.bankA.layout,   this.MEM_grid.bankA.cnf);
        }
    }

    //      _____       ___      ______     __             __                                 
    //     |_   _|    .'   `.  .' ___  |   [  |           [  |                                
    //       | |     /  .-.  \/ .'   \_|    | |--.  .---.  | | _ .--.   .---.  _ .--.  .--.   
    //       | |   _ | |   | || |   ____    | .-. |/ /__\\ | |[ '/'`\ \/ /__\\[ `/'`\]( (`\]  
    //      _| |__/ |\  `-'  /\ `.___]  |   | | | || \__., | | | \__/ || \__., | |     `'.'.  
    //     |________| `.___.'  `._____.'   [___]|__]'.__.'[___]| ;.__/  '.__.'[___]   [\__) ) 
    //                                                        [__|                                                     

    var dbgCurrent = null;
    var logStep = 0;

    var DBG_READ_BANK      = "READ RAM BANK ";
    var DBG_READ_RAMCARD   = "READ RAM CONT ";
    var DBG_WRITE_BANK     = "WRITE RAM BANK ";
    var DBG_WRITE_RAMCARD  = "WRITE RAM CONT ";

    var dbgOps = {};
    dbgOps[DBG_READ_BANK]     = dbg_op(DBG_READ_BANK);
    dbgOps[DBG_READ_RAMCARD]  = dbg_op(DBG_READ_RAMCARD);
    dbgOps[DBG_WRITE_BANK]    = dbg_op(DBG_WRITE_BANK);
    dbgOps[DBG_WRITE_RAMCARD] = dbg_op(DBG_WRITE_RAMCARD);
    const PCODE = this.id.PCODE;

    function debug_record(op, addr, d8, suffix)
    {
        suffix = suffix || "";
        if(dbgCurrent && (dbgCurrent != op || dbgOps[dbgCurrent].suffix != suffix)) debug_flush();

        var o = dbgOps[op];
        if(!o) return;

        if(!dbgCurrent)
        {
            dbgCurrent = op;
            o.firstAddr = addr;
            o.suffix = suffix;
        }

        o.bytes++;
        o.lastAddr = addr;

        // Simple 16-bit rolling checksum over address and data.
        o.checksum[0] = (o.checksum[0] + ((addr & 0xFFFF) ^ (d8 & 0xFF))) & 0xFFFF;
    }

    function debug_flush()
    {
        if(!bDebug || !dbgCurrent) return;

        var o = dbgOps[dbgCurrent];

        if(o && o.bytes)
        {
            console.log(
                PCODE+": "+o.label + o.suffix +
                " bytes=" + o.bytes +
                " range=$" + oCOM.getHexWord(o.firstAddr) + "-$" + oCOM.getHexWord(o.lastAddr) +
                " checksum=$" + oCOM.getHexWord(o.checksum[0])
            );
        }

        o.bytes = 0;
        o.checksum[0] = 0;
        o.firstAddr = null;
        o.lastAddr = null;
        o.suffix = "";
        dbgCurrent = null;
    }

    function debug_updateMemoryMap(bRamcardActive)
    {
        console.log(PCODE+": updateMemoryMap() -> SWITCH "+(bRamcardActive?"ON":"OFF"));
        if(bRamcardActive == false)
        {
            console.log(  PCODE+": BANK A: 0x"+oCOM.crc16(RAMCARD_MEM.slice(0, BANK_SIZE)).toString(16).toUpperCase()
                        +" BANK B: 0x"+oCOM.crc16(RAMCARD_MEM.slice(BANK_SIZE, BANK_TOT_SIZE)).toString(16).toUpperCase()
                        +" CONT: 0x"+oCOM.crc16(RAMCARD_MEM.slice(BANK_TOT_SIZE, TOTAL_SIZE)).toString(16).toUpperCase()
                        +" STEP "+(logStep++));
        }
    }

    function debug_soft_switch(addr,sw,state)
    {
        if(sw.WE==1)
        {
            if(state.RR) console.log(PCODE+": SOFTSWITCH $"+oCOM.getHexByte(addr)+" -> "+JSON.stringify(sw));
            else console.log(PCODE+": waiting for RR to write-enable ($"+oCOM.getHexByte(addr)+")");
        }
        else console.log(PCODE+": SOFTSWITCH $"+oCOM.getHexByte(addr)+" -> "+JSON.stringify(sw));
    }
}




/*  EXAMPLE CODE

M.PRNTYX  EQU $F940   ; print hex word (Y=hi X=lo)
M.OUTSP   EQU $DB57   ; space

ORG $6000

; WRITE BANK2 and RAMCARD in mode 3 :o)
LDA $C083   ; 3: {"ON":true,"WE":true,"BANK":2}
LDA $C083   ; 3: {"ON":true,"WE":true,"BANK":2}
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
LDA $C080   ; 0: {"ON":true,"BANK":2}
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
