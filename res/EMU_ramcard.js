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
         "active":true          // flag to remember if peripheral is altogether operational or not 
        ,"slot":null            // slot number where the current card is plugged-in (always 0 for the language card)
        ,"softswitch_pos":0x1   // default soft switch state (documented by microsoft)
        ,"bMapped":false        // flag to remember if onboard ROM is mapped by the language card (true) or not (false)
        ,"RR":false             // flag to remember double-triggered Write-Enables (by double read)
    };
    this.action = {"SlotIO": { "RD":{ "callback": function(addr) { return card.soft_switch(addr); } } } };  // callback for softswitches

    const MEM_MAP_ORG   = 0xD000;                     // the address space origin this ramcard typically overrides
    const MEM_MAP_STEP  = 0x1000;                     // address space is divided in chunks of 0x1000 bytes (according to address_encoder() logic)

    const BANK_SIZE     = 0x1000;                     // 4K bank memory size = contiguous bank offset  = 4Kbytes  
    const CONT_SIZE     = 0x2000;                     // 8K contiguous memory size
    const BANK_TOT_SIZE = BANK_SIZE * 2;              // 2*4K linearised bank size
    const TOTAL_SIZE    = BANK_TOT_SIZE + CONT_SIZE;  // 16K

    var RAMCARD_MEM = new Uint8Array(TOTAL_SIZE);     // PERIPHERAL RAM

    var hw;                      // purposed for late-binding (at restart) 
    var card       = this;       // stand-in in areas where 'this' is absent e.g. inside mapping functions

    var bDebug_sw  = true;      // debug soft switch updates (light)
    var bDebug_mon = true;      // debug RAM Write monitor
    var bDebug     = false;      // debug all RAM R/W operations   

    // RE: 0="READ-ENABLE" 1="READ-ENABLE" | WE: 0:"WRITE-PROTECT" 1:"WRITE-ENABLE"  | BANK: 0="BANK A", 1="BANK B"
    var softswitch = {
        0x0: {"RE":1,         "BANK":0}  // READ: $D000-$DFFF -> BANK_MEM[1]  | READ: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM
       ,0x1: {        "WE":1, "BANK":0}  // READ: $D000-$DFFF & $E000-$EFFF & $F000-$FFFF -> apple2Rom | WRITE $D000-$DFFF -> BANK_MEM[1]  | WRITE: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM
       ,0x2: {                "BANK":0}  // READ: $D000-$DFFF & $E000-$EFFF & $F000-$FFFF -> apple2Rom  
       ,0x3: {"RE":1, "WE":1, "BANK":0}  // READ: $D000-$DFFF -> BANK_MEM[1]  | READ: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM | WRITE $D000-$DFFF -> BANK_MEM[1]  | WRITE: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM

       ,0x8: {"RE":1,         "BANK":1}  // READ: $D000-$DFFF -> BANK_MEM[0]  | READ: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM
       ,0x9: {        "WE":1, "BANK":1}  // READ: $D000-$DFFF & $E000-$EFFF & $F000-$FFFF -> apple2Rom | WRITE $D000-$DFFF -> BANK_MEM[0]  | WRITE: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM
       ,0xA: {                "BANK":1}  // READ: $D000-$DFFF & $E000-$EFFF & $F000-$FFFF -> apple2Rom  
       ,0xB: {"RE":1, "WE":1, "BANK":1}  // READ: $D000-$DFFF -> BANK_MEM[0]  | READ: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM | WRITE $D000-$DFFF -> BANK_MEM[0]  | WRITE: $E000-$EFFF & $F000-$FFFF -> RAMCARD_MEM
    }
    var softswitch_diff = {RE:0,WE:0,BANK:0};

    function abs2rel(addr) { return (addr - MEM_MAP_ORG) & 0xFFFF; }
    function rel2abs(addr) { return (addr + MEM_MAP_ORG) & 0xFFFF; }

    this.updateMemoryMap = function(bRamcardActive)
    {
        if(this.bMEM_monitoring != hw.bMEM_monitoring) 
            this.enable_MEM_monitoring(hw.bMEM_monitoring);  // follow mem monitoring flag from hardware 
        if(bDebug_sw) 
            debug_updateMemoryMap(bRamcardActive,this);      // log memory map updates
        if (!hw || !hw.RD || !hw.WR || !hw.default_map) return false;

        const xD = hw.lineDecode(MEM_MAP_ORG), xE = hw.lineDecode(MEM_MAP_ORG+MEM_MAP_STEP), xF = hw.lineDecode(MEM_MAP_ORG+MEM_MAP_STEP+MEM_MAP_STEP);

        // READ MAPPING
        if (bRamcardActive)
        {   
            // PERIPHERAL RAM IS SELECTED FOR READ
            hw.RD[xD] = function(addr) { return card.read(abs2rel(addr)); };
            hw.RD[xE] = function(addr) { return card.read(abs2rel(addr)); };
            hw.RD[xF] = function(addr) { return card.read(abs2rel(addr)); };
        }
        else
        {  
            // HARDWARE ROM IS SELECTED FOR READ
            hw.RD[xD] = hw.default_map.RD[xD];
            hw.RD[xE] = hw.default_map.RD[xE];
            hw.RD[xF] = hw.default_map.RD[xF];
        }

        // WRITE MAPPING
        hw.WR[xD] = function(addr,d8) 
        { 
            const rel_addr = abs2rel(addr);
            const sw = softswitch[card.state.softswitch_pos];
            card.write(rel_addr, d8);
            card.mark_MEM_monitoring(sw.BANK==0?"bankA":"bankB",rel_addr); 
        };
        hw.WR[xE] = function(addr,d8)
        { 
            const rel_addr = abs2rel(addr);
            card.write(rel_addr, d8); 
            card.mark_MEM_monitoring("cont",rel_addr); 
        };
        hw.WR[xF] = function(addr,d8) 
        { 
            const rel_addr = abs2rel(addr);
            card.write(rel_addr, d8);
            card.mark_MEM_monitoring("cont",rel_addr); 
        };

        this.state.bMapped = bRamcardActive;
        return true;
    };

    this.reset = function() { }   // language card settings remain unchanged at warm boot

    this.restart = function()
    {
        hw = apple2plus.hwObj();
        debug_flush();
        this.state.bMapped = false;
        this.state.RR      = false;

        oCOM.addRefreshEvent(oEMU.component.IO.RamCard.MEM_monitoring,"MEM_monitoring_MS16K",false);
        oCOM.toggleRefreshEvent('MEM_monitoring_MS16K');
    }

    // translate addresses from the bus to ramcard addresses 
    function address_encoder(addr,bank_bit) 
    { 
        return addr + ((bank_bit | !!(addr >> 12)) << 12);
    }

    this.soft_switch = function(addr)
    {
        var MEM_RAMCARD_IO =  0x80;
        var rel_io_addr = addr - MEM_RAMCARD_IO;                   // SlotIO offset - TODO: take this from IO object (abs2rel method in IO?)
        const pre_sw = softswitch[this.state.softswitch_pos];   // previous switch state

        var sw = softswitch[rel_io_addr] || {}; mon_soft_switch(sw);
        debug_flush(); if(bDebug_sw) debug_soft_switch(rel_io_addr,sw,this.state);
        this.state.RR = sw.WE==1 ? (this.state.RR == false ? true : this.state.RR) : false;  // only flip write-enable state after double trigger sw.WE==1
        
        this.state.softswitch_pos = rel_io_addr;

        if((sw.WE==1 && this.state.RR==false) == false && sw.RE!=pre_sw.RE) // update memory map only after WRITE ENABLE was triggered twice
        {
            var ok = this.updateMemoryMap(!!sw.RE);
            if(bDebug_sw && !ok) console.warn(this.id.PCODE+": SOFTSWITCH could not update memory map");
        }
        this.update_MEM_status();
    };

    this.read = function(rel_addr)
    {
        var sw = softswitch[this.state.softswitch_pos] || {}; mon_soft_switch(sw);
        const d8 = RAMCARD_MEM[ address_encoder(rel_addr,sw.BANK) ]; 
        if(bDebug) debug_record( rel_addr < BANK_SIZE ? DBG_READ_BANK : DBG_READ_RAMCARD, rel_addr, d8, rel_addr < BANK_SIZE ? (sw.BANK ? "A" : "B") : null);
        return d8;
    }

    this.write = function(rel_addr,d8)
    {
        var sw = softswitch[this.state.softswitch_pos] || {}; mon_soft_switch(sw);
        if(sw.WE==1 && this.state.RR)
        {
            RAMCARD_MEM[ address_encoder(rel_addr,sw.BANK) ] = d8;
            if(bDebug) debug_record( rel_addr < BANK_SIZE ? DBG_WRITE_BANK : DBG_WRITE_RAMCARD, rel_addr, d8, rel_addr < BANK_SIZE ? (sw.BANK==0 ? "A" : "B") : null );
        }
        else
        {
            debug_flush();
            console.warn(this.id.PCODE+": FAILED ATTEMPT: (WE="+(sw.WE==1?true:false)+") BANK"+(sw.BANK==0?"A":"B")+" write #$"+oCOM.getHexByte(d8)+" at addr $"+oCOM.getHexWord(rel2abs(rel_addr)));
        }
    };


    //       ______  _____  _____  _____    __             __                                 
    //     .' ___  ||_   _||_   _||_   _|  [  |           [  |                                
    //    / .'   \_|  | |    | |    | |     | |--.  .---.  | | _ .--.   .---.  _ .--.  .--.   
    //    | |   ____  | '    ' |    | |     | .-. |/ /__\\ | |[ '/'`\ \/ /__\\[ `/'`\]( (`\]  
    //    \ `.___]  |  \ \__/ /    _| |_    | | | || \__., | | | \__/ || \__., | |     `'.'.  
    //     `._____.'    `.__.'    |_____|  [___]|__]'.__.'[___]| ;.__/  '.__.'[___]   [\__) ) 
    //                                                        [__|                            

    this.MEM_status_id = this.id.PCODE+"_softswitch_status";
    this.mem_mon = {"cont":{}, "bankA":{}, "bankB":{}};
    this.bMEM_monitoring = false;
    this.MEM_grid_cnf = {"id_prefix":"x","digits":5};
    this.mem_layout = 
    {
        "3F000-40000":["#D06060",this.id.PCODE+" CONT"  ,"RF"]
       ,"3E000-3F000":["#D06060",this.id.PCODE+" CONT"  ,"RE"]
       ,"2D000-2E000":["#B05050",this.id.PCODE+" BANK B","DB"]
       ,"1D000-1E000":["#A04040",this.id.PCODE+" BANK A","DA"]
    };
    this.MEM_grid = 
    {
        "cont":   {"cnf":{"id_prefix":"x","digits":4},"layout":{ "F000-FFFF":["#D06060",this.id.PCODE+ "CONT"  ,"RF"]
                                                                ,"E000-FFFF":["#D06060",this.id.PCODE+" CONT"  ,"RE"] }},
        "bankB":  {"cnf":{"id_prefix":"z","digits":4},"layout":{ "D000-DFFF":["#B05050",this.id.PCODE+" BANK B","DB"] }},
        "bankA":  {"cnf":{"id_prefix":"y","digits":4},"layout":{ "D000-DFFF":["#A04040",this.id.PCODE+" BANK A","DA"] }}
    };
    var tm = Number(new Date());
    this.MEM_status_text = function()
    {
        var on_icon = (softswitch_diff.RE>0)   ? '<i class="fa fa-microchip" title="'+this.id.PCODE+' RAM"></i>'         : '<i class="fa fa-apple-alt" title="'+this.id.PCODE+' ROM"></i>';
        var we_icon = (softswitch_diff.WE>0)   ? '<i class="fa fa-lock-open" title="'+this.id.PCODE+' WRITE ENABLE"></i>': '<i class="fa fa-lock" title="'+this.id.PCODE+' WRITE PROTECTED"></i>';
        var bank    = (softswitch_diff.BANK>0) ? '<span title="'+this.id.PCODE+' BANK B">B</span>'                       : '<span title="'+this.id.PCODE+' BANK A">A</span>'; 

        // debug
        //on_icon += " "+softswitch_diff.RE;
        //we_icon += " "+softswitch_diff.WE;
        //bank    += " "+softswitch_diff.BANK;

        softswitch_diff = {RE:0,WE:0,BANK:0};
        return this.id.PCODE+' ' + on_icon + ' ' + we_icon + ' ' + bank;
    };
    this.update_MEM_status = function()
    {
        if(typeof(document)!="object") return false;
        var el = document.getElementById(this.MEM_status_id); if(!el) return false;
        el.innerHTML = this.MEM_status_text();
        return true;
    };
    this.build_MEM_map = function(linestep)
    {
        linestep = linestep || 0x1000;
        return "<div style='display:flex;flex-direction:column;gap:6px;align-items:flex-start'>"
             +   oMEMGRID.build_grid(0xF000,2,-linestep,{id_prefix:"x",digits:4,table_id:"xEF"})
             +   oMEMGRID.build_grid(0xD000,1,-linestep,{id_prefix:"z",digits:4,table_id:"zD"})
             +   oMEMGRID.build_grid(0xD000,1,-linestep,{id_prefix:"y",digits:4,table_id:"yD"})
             +   "<div id='"+this.MEM_status_id+"' style='float:right;margin-left:30px;padding:2px;height:20px;margin-top:-6px;background-color:white;border-radius:5px'>"
             +     this.MEM_status_text()
             +   "</div>"
             + "</div>";
    };
    this.paint_MEM_map = function()
    {
        if(!this.MEM_grid) return false;

        oMEMGRID.relabel_grid_rows("xEF",["F000    ","E000    "]);
        oMEMGRID.relabel_grid_rows("zD",["D000-B"]);
        oMEMGRID.relabel_grid_rows("yD",["D000-A"]);
        oMEMGRID.paint_grid(this.MEM_grid.cont.layout, this.MEM_grid.cont.cnf);
        oMEMGRID.paint_grid(this.MEM_grid.bankB.layout,   this.MEM_grid.bankB.cnf);
        oMEMGRID.paint_grid(this.MEM_grid.bankA.layout,   this.MEM_grid.bankA.cnf);
        this.update_MEM_status();

        return true;
    };

    // mark one block in the memory grid
    this.mark_MEM_monitoring = function(bucket, rel_addr)
    {
        if(!this.bMEM_monitoring) return;
        if(!this.mem_mon[bucket]) this.mem_mon[bucket] = {};
        
        this.mem_mon[bucket][rel2abs(rel_addr) >> oMEMGRID.mem_gran] = true;

        if(hw && !hw.mem_mon_trigger[this.id.PCODE])
        {
            this.MEM_monitoring();
            hw.mem_mon_trigger[this.id.PCODE] = true;
        }
    };

    // clear all blocks in the memory grid
    this.reset_MEM_monitoring = function()
    {
        if(bDebug_mon) console.log('MEM_monitoring_'+this.id.PCODE+' -> reset_MEM_monitoring()');
        this.mem_mon = {"cont":{}, "bankA":{}, "bankB":{}};
        if(this.MEM_grid)
        {
            oMEMGRID.paint_grid(this.MEM_grid.cont.layout, this.MEM_grid.cont.cnf);
            oMEMGRID.paint_grid(this.MEM_grid.bankB.layout,this.MEM_grid.bankB.cnf);
            oMEMGRID.paint_grid(this.MEM_grid.bankA.layout,this.MEM_grid.bankA.cnf);
        }
        this.update_MEM_status();
    }

    // enable/disable monitoring - actioned by a UI button
    this.enable_MEM_monitoring = function(b)
    {
        if(bDebug_mon) console.log('MEM_monitoring_'+this.id.PCODE+' -> enable_MEM_monitoring('+b+')');
        this.bMEM_monitoring = !!b;
        if(b) this.reset_MEM_monitoring();  // clear data
    }

    // lights up memory blocks in the grid
    // called regularly as the result of oCOM.addRefreshEvent  (e.g. 2 times per second)
    this.MEM_monitoring = function()
    {
        if(!(this.state && this.MEM_grid)) return;
        this.update_MEM_status();        
        if(bDebug_mon) console.log(JSON.stringify( 'MEM_monitoring_'+this.id.PCODE+' -> bankA:'+JSON.stringify(this.mem_mon.bankA)+' bankB:'+JSON.stringify(this.mem_mon.bankB)+' cont:'+JSON.stringify(this.mem_mon.cont)) );

        if(Object.keys(this.mem_mon.cont).length>0)    // is there anything to display?
        {
            oMEMGRID.paint_grid(this.MEM_grid.cont.layout, this.MEM_grid.cont.cnf);
            oMEMGRID.update_grid(this.mem_mon.cont, this.MEM_grid.cont.cnf);
        }
        if(Object.keys(this.mem_mon.bankB).length>0)    // is there anything to display?
        {
            oMEMGRID.paint_grid(this.MEM_grid.bankB.layout,   this.MEM_grid.bankB.cnf);
            oMEMGRID.update_grid(this.mem_mon.bankB,   this.MEM_grid.bankB.cnf);
        }

        if(Object.keys(this.mem_mon.bankA).length>0)    // is there anything to display?
        {
            oMEMGRID.paint_grid(this.MEM_grid.bankA.layout,   this.MEM_grid.bankA.cnf);
            oMEMGRID.update_grid(this.mem_mon.bankA,   this.MEM_grid.bankA.cnf);
        }
        
        if(hw.bClear_mon) this.mem_mon = {"cont":{}, "bankA":{}, "bankB":{}};  // CLEAR THE GRID AFTER EACH DISPLAY
    }

    // Vote on ramcard status (since softswitches change more rapidly than visual updates, we want to show the most prevalent state) 
    function mon_soft_switch(sw)
    {
        for(var k of ["RE","WE","BANK"])
            softswitch_diff[k] += sw[k] == 1 ? 1 : -1;
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
        o.checksum[0] = (o.checksum[0] + ((addr & 0xFFFF) ^ (d8 & 0xFF))) & 0xFFFF;          // Simple 16-bit rolling checksum over address and data.
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
LDA $C083   ; 3: {"RE":true,"WE":true,"BANK":2}
LDA $C083   ; 3: {"RE":true,"WE":true,"BANK":2}
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
LDA $C080   ; 0: {"RE":true,"BANK":2}
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
