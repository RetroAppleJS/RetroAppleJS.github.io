//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Adapted in 2022 by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// apple2io.js

// oEMU.component.IO is only a dataset referencing to the peripherals, but it should not contain the Apple2IO ojbject, instead hw.io owns the instance of Apple2IO like hw.io.<method> !!!
if(oEMU===undefined) var oEMU = {"component":{"IO":{"ACTION_MAP":[]}},"system":{"A2P":{"active":true}}}

if(oEMUI===undefined) var oEMUI = {"slotConfig":function(){},"slotsRender":function(){},"deviceBtn":function(){}} // allow tools to include apple2io.js without apple2main.js


var slotObj = [];
var slotCfg = [{slotTitle: "board", lock:true, peripheral: { objID: "Mboard", PCODE: "BOARD" ,icon: "fa fa-cube"}}];  // FILL SLOTS WITH BASICS
  

function Apple2IO(vid)
{

    const ROM_ADDR =    0xD000;
    const ROM_SIZE =    0x4000;

    // Slot I/O addresses
    const SLOT_IO =    [0x80,
                        0x90,
                        0xA0,
                        0xB0,
                        0xC0,
                        0xD0, 
                        0xE0,
                        0xF0];
    const SLT_IO_SIZE = 0x10;

    // Slot RAM/ROM spaces
    const SLOT_ROM =  [0,   // SLOT0_PROM does not exist
                        0x100,
                        0x200,
                        0x300,
                        0x400,
                        0x500,
                        0x600,
                        0x700];
    const SLT_ROM_SIZE = 0x100;     


    // MAP DISK I/O TO SLOT#6 MEMORY
    var DISK_IO =       SLOT_IO[6],
        DISK_IO_SIZE =  SLT_IO_SIZE,
        DISK_PROM =     SLOT_ROM[6],
        DISK_PROM_SIZE = SLT_ROM_SIZE;
 
    // MAP RAMCARD I/O TO SLOT#0 MEMORY
    var MEM_RAMCARD_IO =  SLOT_IO[0], MEM_RAMCARD_IO_SIZE =  SLT_IO_SIZE;

    // MAP 80 COLUMN CARD I/O TO SLOT#3 MEMORY
    var MEM_COL80CARD_IO =  SLOT_IO[3], MEM_COL80CARD_IO_SIZE =  SLT_IO_SIZE;
    
    // HOST_IO callbacks (keyboard, speaker, gfx) 

    if(typeof(oEMU.component.IO)!="undefined")
    {
        // TODO: autosearch for self-declared oEMU.component.IO objects ?
        //var keys = oCOM.default(oEMU.component.Keyboard,{keystroke:function(){},reset:function(){},lastkey:0x00},"Keyboard");
        var keys = oCOM.default(oEMU.component.Keyboard,{"KbdHover":function(){},"cycle":function(){},"keystroke":function(){},"strobe":function(){},"polling":function(){},"events":function(){},"KbdHTML":function(){},"reset":function(){},"lastkey":0x00},"A2Pkeys");
        var snd = oCOM.default(oEMU.component.IO.AppleSpeaker,{"toggle":function(){}},"AppleSpeaker");
        this.ramcard = oCOM.default(oEMU.component.IO.RamCard,{"state":{"active":false}},"RamCard");
        this.col80card = oCOM.default(oEMU.component.IO.col80card,{"state":{"active":false}},"col80card");
        this.disk2 = oCOM.default(oEMU.component.IO.AppleDisk,{"reset":function(){},"state":{"active":false,"diskData":[]}},"AppleDisk");
        oEMU.component.IO.self = this;
    }

    const IOMAP_CALLS = 
    {1: // _CFG_IOMAP index
        {
            "KBD":         function(){ return keys.polling(keys.lastkey)}
            ,"KBDSTRB":     function(){ keys.strobe();      return 0x00 }
            ,"SPKR":        function(){ snd.toggle();       return 0x00 }
            ,"TXTCLR":      function(){ vid.setGfx(true);   return 0x00 }
            ,"TXTSET":      function(){ vid.setGfx(false);  return 0x00 }
            ,"MIXCLR":      function(){ vid.setMix(false);  return 0x00 }
            ,"MIXSET":      function(){ vid.setMix(true);   return 0x00 }
            ,"TXTPAGE1":    function(){ vid.setPage2(false);return 0x00 }
            ,"TXTPAGE2":    function(){ vid.setPage2(true); return 0x00 }
            ,"LORES":       function(){ vid.setHires(false);return 0x00 }
            ,"HIRES":       function(){ vid.setHires(true); return 0x00 }
        }
    }

    var CIO = {ACTION_MAP:{RD:{}, WR:{}}};

    function ensureActionMap()
    {
        if(!CIO.ACTION_MAP) CIO.ACTION_MAP = {};
        if(!CIO.ACTION_MAP.RD) CIO.ACTION_MAP.RD = {};
        if(!CIO.ACTION_MAP.WR) CIO.ACTION_MAP.WR = {};
    }


//     _____      __  ___          _       _______  _____  
//    |_   _|    / /.'   `.       / \     |_   __ \|_   _| 
//      | |     / //  .-.  \     / _ \      | |__) | | |   
//      | |    / / | |   | |    / ___ \     |  ___/  | |   
//     _| |_  / /  \  `-'  /  _/ /   \ \_  _| |_    _| |_  
//    |_____|/_/    `.___.'  |____| |____||_____|  |_____| 
    
    this.reset = function()
    {
        keys.reset();
        this.disk2.reset();
        if(this.ramcard && this.ramcard.reset) this.ramcard.reset();
    }

    this.restart = function()
    {
        if(this.ramcard && this.ramcard.restart) this.ramcard.restart();
        if(this.disk2 && this.disk2.restart) this.disk2.restart();

        ensureActionMap();

        // Some tools, such as tools/HGRpatternJS.html, instantiate Apple2Hw/Apple2IO
        // without the full emulator shell.  In that case there are no slots to mount.
        const bFullEmulator =
               typeof(apple2plus) == "object"
            && apple2plus
            && typeof(apple2plus.hwObj) == "function"
            && typeof(oEMU) == "object"
            && oEMU
            && typeof(oEMU.component) == "object"
            && oEMU.component.IO
            && typeof(slot_count) != "undefined"
            && typeof(slotR) != "undefined"
            && typeof(_CFG_PSLOT) != "undefined";

        if(!bFullEmulator)
            return;

        // FIRST TODO: TAKE MAPPED I/O INPUT AND MOUNT YOUR DEVICES (OBJECT) ON THIS DATASTRUCTURE
        // MAKE SURE slot_cfg is declared and provisioned at this moment!!! (currently it is declared later)
        oEMU.component.MIO = apple2plus.hwObj().io.slot_cfg;
        console.log("oEMU.component.MIO = "+JSON.stringify(oEMU.component.MIO));

        for(var slotIdx=0;slotIdx<slot_count;slotIdx++)
        {
            if(slotR.slotMap[slotIdx])
            {
                var peripheral_names = this.listPeripheralNames();
                var pinfo = peripheral_names[slotR.slotMap[slotIdx][0]];
                if(pinfo===undefined) continue;
                var cinfo = _CFG_PSLOT[pinfo.PCODE];
                var o = this.mount(cinfo,pinfo,slotIdx);

                slotCfg[slotIdx+1]  = {"slotTitle":"PR#"+slotIdx,"peripheral":o.pInfo}
                slotObj[slotIdx+1]  = o.pObj;
            }
            else slotCfg[slotIdx+1] = {"slotTitle":"PR#"+slotIdx}
        }

        console.log(CIO.ACTION_MAP);
        console.group("ACTION_MAP overview");
        console.log("ACTION_MAP size="+oCOM.roughSizeOfObject(CIO.ACTION_MAP)+"bytes");
        console.table(actionMapEntryCount(CIO.ACTION_MAP));
        console.table(actionMapSpanReport(CIO.ACTION_MAP));
        console.groupEnd();

        console.group("slot configuration overview");
        console.table(slotConfigReport(slotCfg));
        console.log("slotCfg = "+JSON.stringify(slotCfg));
        console.groupEnd();
    }

    this.address_encoder = function(rel_addr,bucket,slot)
    {
        switch(bucket)
        {
            case "HostIO":  return rel_addr;
            case "SlotIO":  return rel_addr - 0x80  - (slot<<4);
            case "SlotROM": return rel_addr - 0x100 - (slot-1<<8);
            case "HostROM": return rel_addr - 0x800;
        } 
    }

    if(typeof(EMU_system_get)!="undefined")
    {
        CIO = oEMU.component.IO;
        CIO.ACTION_MAP = oEMU.component.IO.board.IO_map(EMU_system_get(),IOMAP_CALLS);
        ensureActionMap();
    }

    function line_decode(adr) { return adr<256 ? adr & 0xF0 : (adr & 0xFF00); } // line decoder on IO & PROM addressing

    this.read = function(rel_addr)
    {
        var line = line_decode(rel_addr);

        switch(line)
        {
            //case 0xA545:  // DISKII

            // TODO: ACTION MAP SHOULD LOOKUP IN WHICH SLOT IS EACH DEVICE, AND ASSIGN READ ADDRESSES
            // LIKELY THIS INFORMATION CAN BE LOOKED-UP IN BIND.. we also need to solve slot re-assignment

            case 0xE0:   return this.disk2.read(rel_addr - DISK_IO);
            case 0x600:  return this.disk2.readROM(rel_addr - DISK_PROM);

            default:

                if(this.ramcard.state.active  && // RAMCARD SOFT SWITCHES
                    rel_addr >= MEM_RAMCARD_IO && rel_addr < MEM_RAMCARD_IO + MEM_RAMCARD_IO_SIZE)
                {// 0080
                    //return this.ramcard.soft_switch(rel_addr - MEM_RAMCARD_IO); // REPLACED BY I/O ACTION MAP (below)
                }
                else if(this.ramcard.state.active &&
                    rel_addr >= ROM_ADDR && rel_addr < ROM_ADDR + ROM_SIZE)
                {// FD00
                    //return this.ramcard.read(rel_addr - ROM_ADDR);
                }
                else if(this.col80card.state.active &&
                    rel_addr >= MEM_COL80CARD_IO && rel_addr < MEM_COL80CARD_IO + ROM_SIZE)
                {
                    // TODO: read ROM from 80-column card !!
                    //alert("80_COL $"+oCOM.getHexWord(rel_addr));
                }

                ////////////////////////////////////////////////////////////
                // MAIN FUNCTION CALL: I/O ACTION MAP FOR READ OPERATIONS //
                ////////////////////////////////////////////////////////////

                if(CIO.ACTION_MAP.RD[rel_addr]!==undefined)
                {
                    //if(rel_addr > 16) console.log("ACTION: "+CIO.ACTION_MAP.RD[rel_addr]);
                    return CIO.ACTION_MAP.RD[rel_addr](rel_addr);   // EXECUTE ACTION TRIGGERED BY A READ AT THIS ADDRESS
                }
            break;
        }
        return 0x00;
    }

    this.write = function(rel_addr, d8)
    {
        if (rel_addr >= DISK_IO && rel_addr < DISK_IO + DISK_IO_SIZE)   // detect I/O range of DISK2
            this.disk2.write(rel_addr - DISK_IO, d8);
        else if(this.ramcard.state.active && rel_addr >= ROM_ADDR && rel_addr < ROM_ADDR + ROM_SIZE)
            return this.ramcard.write(rel_addr - ROM_ADDR,d8)
        
        // I/O ACTION MAP FOR WRITE OPERATIONS
        if(CIO.ACTION_MAP.WR[rel_addr]!==undefined)
        {
            //if(rel_addr > 16) console.log("ACTION: "+ACTION_MAP.RD[rel_addr]);
            return CIO.ACTION_MAP.WR[rel_addr](rel_addr);   // EXECUTE ACTION TRIGGERED BY A WRITE AT THIS ADDRESS
        }

        // Implement same side-effects as read.
        // TODO: double check if we want writes to SLOTIO etc.. to have the same effect as reads
        this.read(rel_addr);
    }

    this.cycle = function() {}

    this.mount = function(cinfo,pinfo,slotIdx)
    {
        if(oEMU.system===undefined) return;
        oPeri = null;
        if(oEMU.system["IORANGES"] && pinfo)                       // ENRICH PERIPHERAL INFO
        {
            const bHostROM = typeof(oEMU.system.IORANGES.HostROM)!="undefined" && cinfo.HostROM == "X";
            const bSlotIO  = typeof(oEMU.system.IORANGES.SlotIO) !="undefined" && cinfo.SlotIO  == "X";
            const bSlotROM = typeof(oEMU.system.IORANGES.SlotROM)!="undefined" && cinfo.SlotROM == "X";
            // TODO: check if range is applicable or not

            var ioBase = oCOM.parseRngExpr(oEMU.system.IORANGES.HostIO).from; // usually $C000 = base reference for the I/O address space
            if(bHostROM) pinfo["HostROM"] = oCOM.parseRngExpr(oEMU.system.IORANGES.HostROM,{n:slotIdx,base:ioBase});     // _CFG_PSLOT -> LROMrange
            if(bSlotIO)  pinfo["SlotIO"]  = oCOM.parseRngExpr(oEMU.system.IORANGES.SlotIO, {n:slotIdx,base:ioBase});     // _CFG_PSLOT -> IOrange
            if(bSlotROM) pinfo["SlotROM"] = oCOM.parseRngExpr(oEMU.system.IORANGES.SlotROM,{n:slotIdx,base:ioBase});     // _CFG_PSLOT -> SlotROM

            // ASK THE PERIPHERAL TO PROVIDE AN ACTION_MAP
            //const oPeripheral = oEMU.component.IO[pinfo.objID]; // TODO: (deprecated) WE MUST INSTANTIATE COMPONENTS PER SLOT INSEAD OF DEFINING THEM ONCE, otherwise we will have peripheral conflicts!!!!

            const hashKey = slotIdx +  pinfo.PCODE;   // constituted of initial slot and PCODE, but is meaningless since this object can move from one slot to another, while keeping the hashKey 
            let oPeri = new globalThis[pinfo.coID](); // this is our freshly made object instance from the object container
            if (oPeri.id && oPeri.id.PCODE == "MS16K")  // temporary patch!!!  making sure oEMU.component.IO.RamCard (old) remains in sync with oPeri, so that mem monitoring uses the same object between apple ram updates in EMU_apple2hw.js and ramcard ram updates in EMU_ramcard.js 
            {
                this.ramcard = oPeri;
                oEMU.component.IO.RamCard = oPeri;
            }


            oPeri.hash =  oCOM.crc16(new TextEncoder("utf-8").encode(hashKey)); // DETERMINE DEVICE ID (CRC16 hash)
  

            if(oPeri && oPeri.action)
            {
                const _act = oPeri.action;     // ACTION_MAP
                var CIO = oEMU.component.IO;
                const _bHostROM  = !(_act.HostROM === undefined);
                const _bSlotIO   = !(_act.SlotIO  === undefined);
                const _bSlotROM  = !(_act.SlotROM === undefined);

                // PROVIDE SLOT NUMBER TO THE PERIPHERAL INSTANCE
                oPeri.state.slot = slotIdx;

                // PROVIDE PERIPHERAL INFO TO THE PERIPHERAL
                oPeri.state.pinfo = pinfo;

                // PROVIDE THE BASE ADDRESS FOR EACH MEMORY SPACE
                if(_bHostROM) _act.HostROM.base  = pinfo.HostROM.from;
                if(_bSlotROM) _act.SlotROM.base  = pinfo.SlotROM.from;
                if(_bSlotIO)  _act.SlotIO.base   = pinfo.SlotIO.from;

                // Add non-functional metadata to callbacks so diagnostics can show
                // the actual mounted owner behind each ACTION_MAP span.
                tagActionCallback(_act.HostROM && _act.HostROM.RD, "HostROM", "RD");
                tagActionCallback(_act.SlotROM && _act.SlotROM.RD, "SlotROM", "RD");
                tagActionCallback(_act.SlotIO  && _act.SlotIO.RD,  "SlotIO",  "RD");
                tagActionCallback(_act.SlotIO  && _act.SlotIO.WR,  "SlotIO",  "WR");

                if(_bHostROM && _act.HostROM.RD) { for(var i=pinfo.HostROM.from;i<=pinfo.HostROM.to;i++) CIO.ACTION_MAP.RD[i] = _act.HostROM.RD.callback; }
                if(_bSlotROM && _act.SlotROM.RD) { for(var i=pinfo.SlotROM.from;i<=pinfo.SlotROM.to;i++) CIO.ACTION_MAP.RD[i] = _act.SlotROM.RD.callback; }
                    //console.log("ACTION_MAP.RD["+(pinfo.from+i)+"] = ",_act.SlotROM.RD.callback); // pinfo.from --> pinfo.to ???  where is defined the address range of _act.SlotROM ?
                if(_bSlotIO && _act.SlotIO.RD) { for(var i=pinfo.SlotIO.from;i<=pinfo.SlotIO.to;i++) CIO.ACTION_MAP.RD[i] = _act.SlotIO.RD.callback; }
                if(_bSlotIO && _act.SlotIO.WR) { for(var i=pinfo.SlotIO.from;i<=pinfo.SlotIO.to;i++) CIO.ACTION_MAP.WR[i] = _act.SlotIO.WR.callback; }

                function tagActionCallback(action,rangeName,op)
                {
                    if(!action || typeof action.callback !== "function") return;

                    action.callback._ioReport =
                    {
                         "PCODE": pinfo.PCODE
                        ,"slotTitle": "PR#" + slotIdx
                        ,"range": rangeName
                        ,"op": op
                        ,"hash": oPeri.hash
                    };
                }

            }
        }
        pinfo["description"] = cinfo.NAME;
        return {"pInfo":pinfo,"pObj":oPeri};
    }

    // _CFG_PSLOT[pinfo.PCODE] =    {"MOCK":{"NAME":"Mockingboard C" ,"SlotIO":"X" ,"SlotROM":"" ,"HostROM":"" ,"SLOTrange":"1,2,3,4*,5,6,7" ,"SYScode":"A2,A2P,A2E"}
    //var peripheral_names = this.listPeripheralNames();
    //console.log("peripheral_names="+JSON.stringify(peripheral_names));
    
    this.unmount = function(name,slot_num)
    {
        if(typeof(oEMUI.slotConfig)=="function")
            oEMUI.slotConfig({"id":"slot"+slot_num,"icon":"fa fa-cube","active":false});

        if(typeof(oEMUI.refreshDeviceToolboxes)=="function")
            oEMUI.refreshDeviceToolboxes({"id":"devices"});
    }

    // TODO: let apple2keys.js itself intercept keypress events   or eventually make a generic event dispatcher in io
    this.keypress = function(code)
    {
        keys.lastkey = code;
    }

    // TODO: belongs in oEMUI -> stand-in for peripheral operations triggered by UI elements
    this.loadDisk = function(bytes,drv)
    {
        alert("AppleDisk2() does not have a method called loadDisk")
    }

    // SLOT MAPPING
    this.listPeripheralNames = function()
    {
        var names = {};
        for(var o in oEMU.component.IO)
        {
            var objID = oEMU.component.IO[o].constructor.name;
            var PCODE = oEMU.component.IO[o]?.id?.PCODE;
            if(PCODE===undefined) continue;
            names[PCODE] = oEMU.component.IO[o].id;
            names[PCODE]["objID"] = oEMU.component.IO[o].constructor.name; // TODO: deprecate
            names[PCODE]["coID"]  = oEMU.component.IO[o].constructor.name; // new: coID = container ID
        }
        return names;
    }

    function extract_slotrange_mask(str)
    {
        var mask = new Uint16Array(2);
        mask[0] = 0; mask[1] = 0;

        var arr = str.split(",");
        for(var i=0;i<arr.length;i++)
        {
            var n = Number( arr[i].replace(RegExp("\\*","g"),"") );
            if(isNaN(n)==false)         mask[0] |= 1<<n
            if(arr[i].indexOf("*")>=0)  mask[1] |= 1<<n
        } 
        return mask; // [0]:compatible slotrange for peripheral  [1]:pre-installed slots with peripheral
    }

    function extract_slotrange(str)
    {
        var  slotPut = [], slotFit = [];
        var arr = str.split(",");
        for(var i=0;i<arr.length;i++)
        {
            var n = Number( arr[i].replace(RegExp("\\*","g"),"") );
            if(isNaN(n)==false)
            {
                slotFit.push( n );
            }
            if(arr[i].indexOf("*")>=0)  
            { 
                slotPut.push( n );
            }
        } 
        return {"slotPut":slotPut, "slotFit":slotFit}
    }    

    function extract_slotRef(str,PCODE,ref)
    {
        var arr = str.split(",");
        for(var i=0;i<arr.length;i++)
        {
            var n = slotID2n( arr[i].replace(RegExp("\\*","g"),"") );
            if(isNaN(n)==false)
            {
                if(ref.slotFit[n]===undefined) { ref.slotFit[n] = [] };
                ref.slotFit[n].push(PCODE);
            }
            if(arr[i].indexOf("*")>=0)  
            {       
                if(ref.slotMap[n]===undefined) { ref.slotMap[n] = [] };
                ref.slotMap[n].push(PCODE);
            }
        } 
        return {"slotMap":ref.slotMap, "slotFit":ref.slotFit}
    }     

    function slotID2n(slotID)
    {
        // previously slotID == "B"
        return slotID == "H" ? 0 : Number(slotID) + 1;
    }

    this.PCODE2obj = function(PCODE)
    {
        // TODO search across slotCfg for occurences of PCODE
        for(var slotIdx = 0; slotIdx < slotCfg.length; slotIdx++)
        {
            //var isPCODE =  slotCfg 
        }
    }

    this.DeviceName2obj = function(str)
    {

    }

    this.deviceID2obj = function(str)
    {
        if(typeof str !== "string") return null;

        var raw = str.trim().toUpperCase();

        var table = [
            {
                rx: /^D([12])$/,
                periID: "DISKII",
                deviceID: "D$1",
                script: function(arg)
                {
                    var deviceN = Number(arg.deviceID.slice(1)) - 1;

                    var slotN = null;
                    if(typeof _CFG_PSLOT !== "undefined" &&
                    _CFG_PSLOT[arg.periID] &&
                    _CFG_PSLOT[arg.periID].SLOTrange)
                    {
                        var slotRange = extract_slotrange(_CFG_PSLOT[arg.periID].SLOTrange);
                        slotN = slotRange.slotPut[0];   // starred/default slot, e.g. 6*
                    }

                    return {
                        "deviceN": deviceN,
                        "slotN": slotN
                    };
                }
            }
        ];

        function applyTemplate(tpl, match)
        {
            return tpl.replace(/\$(\d+)/g, function(_, n)
            {
                return match[Number(n)] || "";
            });
        }

        function orderedDeviceObj(obj)
        {
            return {
                "slotN": obj.slotN,
                "slotID": obj.slotID,
                "periID": obj.periID,
                "deviceID": obj.deviceID,
                "deviceN": obj.deviceN
            };
        }

        for(var i = 0; i < table.length; i++)
        {
            var rule = table[i];
            var match = raw.match(rule.rx);

            if(match)
            {
                var obj = {
                    "periID": rule.periID,
                    "deviceID": applyTemplate(rule.deviceID, match)
                };

                var extra = {};
                if(typeof rule.script === "function")
                {
                    extra = rule.script({
                        "raw": raw,
                        "match": match,
                        "periID": obj.periID,
                        "deviceID": obj.deviceID
                    }) || {};
                }

                for(var k in extra)
                    if(extra.hasOwnProperty(k)) obj[k] = extra[k];

                if(typeof obj.slotN === "number") { obj.slotID = "PR#" + obj.slotN; }

                return orderedDeviceObj(obj);
            }
        }

        return null;
    };

    this.obj2deviceID = function(obj)
    {
        if(obj == null) return null;

        /*
            Allow strings to be normalized through deviceID2obj().
            Example:
            obj2deviceID("d1") -> "D1"
        */
        if(typeof obj === "string")
        {
            var parsed = this.deviceID2obj(obj);
            return parsed ? parsed.deviceID : null;
        }

        /*
            Canonical Disk II reverse mapping.
            deviceN 0 -> D1
            deviceN 1 -> D2
        */
        if(obj.periID === "DISKII")
        {
            if(typeof obj.deviceN === "number")
            {
                return "D" + (obj.deviceN + 1);
            }

            if(typeof obj.deviceID === "string")
            {
                var id = obj.deviceID.trim().toUpperCase();
                if(/^D[12]$/.test(id)) return id;
            }
        }

        /*
            Generic fallback.
            Useful when later devices define their own canonical IDs.
        */
        if(typeof obj.deviceID === "string")
        {
            return obj.deviceID.trim().toUpperCase();
        }

        return null;
    };

    this.deviceN2ID = function(n,PCODE)
    {
        switch(PCODE)
        {
            case "DISKII": return "D"+(Number(n)+1);
        }
    }

    this.deviceID2N = function(str,PCODE) 
    {
        switch(PCODE)
        {
            case "DISKII": return Number(str.slice(1))-1;
        }
    }

    this.config_slotAvail = function(cfg)        // HOW MANY SLOTS CAN WE FILL?
    {
        var model = typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P";
        if(cfg===undefined) { var cfg = "[0-7] [0-7]"; console.warn("CONFIG file is not available (missing _CFG_SYSCODE)"); }
        var str = cfg[model]?.Slotslogphy;
        var a = parseSlotAvail(str);

        // dataset completions
        for(var i=0;i<a.logSlots.length;i++)  a.logSlots[i]  = "PR#" + a.logSlots[i];
        for(var i in a.lockSlots)             a.lockSlots[i] = "PR#" + a.lockSlots[i];
        
        a.logSlots.unshift("board"); a.lockSlots["board"] = true;
        return a;
    }

    function parseSlotAvail(s)
    {
        if(s===undefined) return {};
        let a=[...s.matchAll(/\[(\d+)-(\d+)\]/g)].map(m=>
        Array.from({length:m[2]-m[1]+1},(_,i)=>+m[1]+i)
        );
        return {
        logSlots:a[0],
        phySlots:a[1],
        lockSlots:Object.fromEntries(a[0].filter(n=>!a[1].includes(n)).map(n=>[n,true])),
        logSlots_n:a[0].length,
        phySlots_n:a[1].length
        };
    }












    // SLOT MAPPING
    //var SLOT_MAP  = new Uint16Array(8<<3);   // SLOT ADDRESS MAPPING
    //var SLOT_NAME = new Array(8);           // 8 SLOTS, 6 CHARACTERS PER SLOT NAME
    var SLOT_IDX  = new Array(8);
    var SLOT_REG  = [];

    var model = typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P";

    var slot_count = 0;
    if(typeof(_CFG_SYSCODE)!="undefined")
    {
        var slotAvail = this.config_slotAvail(_CFG_SYSCODE);
        // example: slotAvail={"logSlots":["board","PR#0","PR#1","PR#2","PR#3","PR#4","PR#5","PR#6","PR#7"],"phySlots":[0,1,2,3,4,5,6,7],"lockSlots":{"board":true},"logSlots_n":8,"phySlots_n":8}
        var slot_count = slotAvail.logSlots_n;
    }

    var slotR = {slotMap:{"B":["BOARD"]},slotFit:{"B":["BOARD"]}};  // TODO: remove as this is now in CONFIG     
    
    if(typeof(_CFG_PSLOT)!="undefined") // DO WE HAVE A CONFIGURATION FILE FOR OUR PERIPHERALS?
    {
        // LOAD ALL PERIPHERALS FROM CONFIGURATION
        for(var PCODE in _CFG_PSLOT)
        {
            var srange = _CFG_PSLOT[PCODE].SLOTrange.split(",");
            //var slotrange_mask = extract_slotrange_mask(_CFG_PSLOT[PCODE].SLOTrange);  // [0]:compatible slotrange for peripheral  [1]:pre-installed slots with peripheral
            slotR = extract_slotRef(_CFG_PSLOT[PCODE].SLOTrange,PCODE,slotR);
        }
        /*
       slotR =  {
                     "slotMap":{"B":["BOARD"],"0":["MS16K"],"3":["VIDEX"],"6":["DISKII"]}
                    ,"slotFit":{"B":["BOARD"],"0":["MS16K"],"1":["DISKII","VIDEX"],"2":["DISKII","VIDEX"],"3":["DISKII","VIDEX"],"4":["DISKII","VIDEX"],"5":["DISKII","VIDEX"],"6":["DISKII","VIDEX"],"7":["DISKII","VIDEX"]}
                }
        */
    }


















//      ______   __          _                               ___  _          
//    .' ____ \ [  |        / |_                           .' ..](_)         
//    | (___ \_| | |  .--. `| |-'  .---.   .--.   _ .--.  _| |_  __   .--./) 
//     _.____`.  | |/ .'`\ \| |   / /'`\]/ .'`\ \[ `.-. |'-| |-'[  | / /'`\; 
//    | \____) | | || \__. || |,  | \__. | \__. | | | | |  | |   | | \ \._// 
//     \______.'[___]'.__.' \__/  '.___.' '.__.' [___||__][___] [___].',__`  
//                                                                  ( ( __)) 

    this.slot_ctx = {};
    this.slot_cfg = {};

    this.onSlotAdd = function(ctx, ev) 
    {
        var anchor = ev.target.closest(".slot-anchor.empty");
        if (!anchor || !ctx.host.contains(anchor)) return;

        var slotTitle = anchor.dataset.slotId;
        this.slotPicker_popup(ctx, slotTitle);
    };

    this.onSlotMove = function(ctx, ev, fromSlotId, toSlotId)
    {
      var parent = ev.currentTarget.parentElement.parentElement.parentElement;
      var periID = parent.children[0].id;

      console.log(JSON.stringify(this.slot_cfg[ctx.hostId]));
      alert("Move " + ctx.hostId + " peripheral "+periID+" slot " + fromSlotId + "->" + toSlotId);
      alert(JSON.stringify(this.slot_cfg[ctx.hostId]));
    };

    this.slotsRender = function(elid, cfg)
    {
      if (!elid) return;

      if (!this.slot_ctx[elid])
      {
        this.slot_ctx[elid] = {
          hostId: elid,
          host: null,
          clickBound: false,
          pointerDrag: null
        };
      }

      var ctx = this.slot_ctx[elid];

      if (cfg !== undefined) this.slot_cfg[elid] = cfg;
      if (!this.slot_cfg[elid]) this.slot_cfg[elid] = [];

      ctx.host = document.getElementById(elid);
      if (!ctx.host) return;

      function getSlotById(slotCfg, slotTitle) { return slotCfg.find(function(slot) { return slot.slotTitle === slotTitle; }) }

      function renderGhost(slot)
      {
        var iconClass = (slot && slot.peripheral && slot.peripheral.icon) ? slot.peripheral.icon : "fa fa-circle";

        return `
          <button class="appbut ghost-cog" type="button" tabindex="-1" aria-hidden="true">
            <i class="${iconClass}"></i>
          </button>
          <span class="ghost-handle" aria-hidden="true">
            <i class="fa fa-ellipsis-h"></i>
            <i class="fa fa-ellipsis-h"></i>
          </span>
        `;
      }

      function renderAnchor(slot)
      {
        var anchorId = "d_slot_" + ctx.hostId + "_" + slot.slotTitle.replace(/[^a-zA-Z0-9_-]/g, "_");

        if (slot.peripheral)
        {
          return `
            <div class="slot-anchor occupied ${slot.lock ? "locked" : "movable"}"
                  id="${anchorId}"
                  data-slot-id="${slot.slotTitle}"
                  data-host-id="${ctx.hostId}">
              <div class="peripheral-card">
                ${slot.lock ? "" : `
                  <span class="drag-handle" title="Move ${slot.peripheral.PCODE}">
                    <i class="fa fa-ellipsis-h dots dots1"></i>
                    <i class="fa fa-ellipsis-h dots"></i>
                  </span>
                `}
              </div>
            </div>
          `;
        }

        return `
          <div class="slot-anchor empty"
                id="${anchorId}"
                data-slot-id="${slot.slotTitle}"
                data-host-id="${ctx.hostId}">
            <button class="slot-add" type="button" title="Add peripheral to ${slot.slotTitle}">
              <i class="fa fa-plus dots dots1"></i>
            </button>
          </div>
        `;
      }

      function renderSlot(slot)
      {
        return `
          <div class="appbox slotbox slot"
                data-slot-id="${slot.slotTitle}"
                data-host-id="${ctx.hostId}">
            <div class="slot-label">${slot.slotTitle}</div>
            <div class="sloticons">
              ${slot.peripheral
                ? `<button id="${slot.peripheral.PCODE}" class="appbut cogbtn" type="button" title="configure ${slot.peripheral.PCODE} / ${slot.peripheral.objID}()"><i class="${slot.peripheral.icon || ""}"></i></button>`
                : ""}
              ${renderAnchor(slot)}
            </div>
          </div>
        `;
      }

      function buildDragGhost(slot)
      {
        var ghost = document.createElement("div");
        ghost.className = "drag-ghost";
        ghost.innerHTML = renderGhost(slot);
        document.body.appendChild(ghost);
        return ghost;
      }

      function positionDragGhost(x, y)
      {
        if (!ctx.pointerDrag || !ctx.pointerDrag.ghostEl) return;
        ctx.pointerDrag.ghostEl.style.left = x + "px";
        ctx.pointerDrag.ghostEl.style.top  = y + "px";
      }

      function updatePointerHotTarget(x, y)
      {
        if (!ctx.pointerDrag) return;
        var el = document.elementFromPoint(x, y);
        var nextHot = el ? el.closest('[data-host-id="' + ctx.hostId + '"].slot-anchor.empty') : null;
        if (ctx.pointerDrag.hotTarget === nextHot) return;
        if (ctx.pointerDrag.hotTarget) ctx.pointerDrag.hotTarget.classList.remove("drop-ok");
        ctx.pointerDrag.hotTarget = nextHot;
        if (ctx.pointerDrag.hotTarget) ctx.pointerDrag.hotTarget.classList.add("drop-ok");     
      }

      function cleanupPointerDrag()
      {
        if (!ctx.pointerDrag) return;
        var handleEl = ctx.pointerDrag.handleEl;
        var pointerId = ctx.pointerDrag.pointerId;
        if (ctx.pointerDrag.hotTarget) ctx.pointerDrag.hotTarget.classList.remove("drop-ok");
        if (ctx.pointerDrag.ghostEl) ctx.pointerDrag.ghostEl.remove();
        if (handleEl)
        {
          try { if (handleEl.hasPointerCapture(pointerId)) handleEl.releasePointerCapture(pointerId) }
          catch (e) {}

          handleEl.removeEventListener("pointermove", onPointerDragMove);
          handleEl.removeEventListener("pointerup", onPointerDragEnd);
          handleEl.removeEventListener("pointercancel", onPointerDragCancel);
        }

        document.body.classList.remove("dragging");
        ctx.host.querySelectorAll(".slot.drag-source").forEach(function(el)
          {
            el.classList.remove("drag-source");
          });

          ctx.pointerDrag = null;
      }

      function onPointerDragStart(emui, host, ev)
      {
        if (ev.button != null && ev.button !== 0) return;

        ev.preventDefault();
        ev.stopPropagation();

        var slotEl = ev.currentTarget.closest(".slot");
        if (!slotEl) return;

        var fromSlotId = slotEl.dataset.slotId;
        var fromSlot = getSlotById(emui.slot_cfg[ctx.hostId], fromSlotId);
        if (!fromSlot || !fromSlot.peripheral) return;

        ctx.pointerDrag = {
          emui: emui,
          host: host,
          pointerId: ev.pointerId,
          fromSlotId: fromSlotId,
          handleEl: ev.currentTarget,
          hotTarget: null,
          ghostEl: buildDragGhost(fromSlot)
        };

        document.body.classList.add("dragging");
        slotEl.classList.add("drag-source");

        ev.currentTarget.setPointerCapture(ev.pointerId);
        ev.currentTarget.addEventListener("pointermove", onPointerDragMove);
        ev.currentTarget.addEventListener("pointerup", onPointerDragEnd);
        ev.currentTarget.addEventListener("pointercancel", onPointerDragCancel);

        positionDragGhost(ev.clientX, ev.clientY);
        updatePointerHotTarget(ev.clientX, ev.clientY);
      }

      function onPointerDragMove(ev)
      {
        if (!ctx.pointerDrag || ev.pointerId !== ctx.pointerDrag.pointerId) return;

        ev.preventDefault();
        positionDragGhost(ev.clientX, ev.clientY);
        updatePointerHotTarget(ev.clientX, ev.clientY);
      }

      function onPointerDragEnd(ev)
      {
        if (!ctx.pointerDrag || ev.pointerId !== ctx.pointerDrag.pointerId) return;
        ev.preventDefault();
        var fromSlotId = ctx.pointerDrag.fromSlotId;
        var toSlotId = ctx.pointerDrag.hotTarget ? ctx.pointerDrag.hotTarget.dataset.slotId : null;
        var emui = ctx.pointerDrag.emui;
        cleanupPointerDrag();
        if (toSlotId)
        {
          slotMove(emui.slot_cfg, ctx, ev, fromSlotId, toSlotId);
          emui.slotsRender(ctx.hostId);
          console.log("Move peripheral from->to", ctx.hostId, fromSlotId, toSlotId);
          emui.onSlotMove(ctx, ev, fromSlotId, toSlotId);
        }

        function slotMove(cfg, ctx, ev, fromSlotId, toSlotId)
        {
          if (!ctx || !fromSlotId || !toSlotId || fromSlotId === toSlotId) return;

          var from = getSlotById(cfg[ctx.hostId], fromSlotId);
          var to   = getSlotById(cfg[ctx.hostId], toSlotId);
          if (!from || !to || from.lock || !from.peripheral || to.peripheral) return;

          to.peripheral = from.peripheral;
          //to.icon = from.icon;

          //from.peripheral = null;
          delete from.peripheral;
          //delete from.icon;
        };
      }

      function onPointerDragCancel(ev) { if (ctx.pointerDrag && ev.pointerId == ctx.pointerDrag.pointerId) cleanupPointerDrag() }
      function onClick(emui, ctx, ev) { emui.onSlotClick(ctx, ev) }
      function onHostClick(emui, ctx, ev) 
      { 
        var addBtn = ev.target.closest(".slot-add");
        if (addBtn && ctx.host.contains(addBtn)) emui.onSlotAdd(ctx, ev); 
      }

      function wireEvents(emui, ctx)
      {
        ctx.host.querySelectorAll(".drag-handle").forEach(function(el)
        {
          el.addEventListener("pointerdown", function(ev) { onPointerDragStart(emui, ctx, ev) });
        });

        ctx.host.querySelectorAll(".appbut").forEach(function(el)
        {
          el.addEventListener("click", function(ev) { onClick(emui, ctx, ev) });
        });

        if (!ctx.clickBound)
        {
          ctx.host.addEventListener("click", function(ev) { onHostClick(emui, ctx, ev) });
          ctx.clickBound = true;
        }
      }

      ctx.host.innerHTML = (this.slot_cfg[ctx.hostId] || []).map(renderSlot).join("");
      wireEvents(this, ctx);
    };



    this.onSlotClick = function(ctx, ev)
    {
      var parent  = ev.currentTarget.closest(".slot");
      var periID = ev.currentTarget.id;
      var slotID  = parent ? parent.dataset.slotId : "";
      var hostId  = ctx.hostId;

      this.slotConfig_detail(slotID);
      //oCOM.POPUP.toggle("slotConfig_popup");

      console.log(JSON.stringify(this.slot_cfg[ctx.hostId]));
    };


    /////////////////////////////////////////////////////////////////



    this.slotPicker_popup = function(ctx, slotTitle) 
    {
        var popupId = "slotConfig_popup";
        var anchorId = "d_slot_" + ctx.hostId + "_" + slotTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
        document.getElementById(anchorId).style = "background:rgba(255, 255, 0, 0.5); border-radius:10px"
        
        var close   = "<button class='appbut' style='float:right' onclick=\"oCOM.POPUP.toggle('" + popupId + "');document.getElementById('"+anchorId+"').style=''\">x</button>";
        var html = "";
        
        html += "<div style=\"float:left\">ADD / REMOVE PERIPHERAL</div>" //+" FROM " + slotTitle;
        html += close;
        html += "<br><br>";

        var io = apple2plus.hwObj().io;
        var names = io && io.listPeripheralNames ? io.listPeripheralNames() : {};
        console.log(names);
        for (var pcode in names) 
        {
            var id = names[pcode];
            html +=
                 "<button class='appbut' onclick=\"apple2plus.hwObj().io.slotPicker_select('" + ctx.hostId + "','" + slotTitle + "','" + id.PCODE + "')\">"
                +"<div class='slot-add' style='float:left'>"
                +"<i class='fa fa-plus dots dots1'></i>&nbsp;"
                +"</div>"
                +"<i class='" + (id.icon || "fa fa-cube") + "'></i> "
                + id.PCODE
                + "</button>"
        }

        html += "<button class='appbut' onclick=\"apple2plus.hwObj().io.slotPicker_select('" + ctx.hostId + "','" + slotTitle + "','" + id.PCODE + "')\">"
            +"<div class='slot-add' style='float:left'>"
            +"<i class='fa fa-minus dots dots1'></i>&nbsp;"
            +"</div>"
            +"<i class='" + (id.icon || "fa fa-cube") + "'></i> "
            + id.PCODE
            + "</button>"
        

        /*
        // TODO: LOOKUP WHICH PERIPHERAL IS IN CURRENTLY IN 'slotTitle'

        html += "<button class=appbut>"
            +"<a href=\"https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/CONFIG.md#peripherals-list\" target=_blank> "
            +"<i class='fa fa-info-circle'></i>"
            +"</a>"
            +"</button> ";
        */


        document.getElementById(popupId).innerHTML = html;

        if(oCOM.POPUP.get_state(popupId)==false) document.getElementById(anchorId).style = "";
        oCOM.POPUP.toggle(popupId);
    };

    this.slotPicker_select = function(hostId, slotTitle, pcode) {
        var cfg = this.slot_cfg[hostId] || [];
        var slot = cfg.find(function(s) {
            return s.slotTitle === slotTitle;
        });

        if (!slot || slot.lock || slot.peripheral) return;

        var io = oEMU.component.IO.self;
        var names = io && io.listPeripheralNames ? io.listPeripheralNames() : {};
        var id = names[pcode];

        if (!id) return;

        slot.peripheral = {
            PCODE: id.PCODE,
            icon: id.icon || "fa fa-cube",
            objID: id.objID,
            active: true
        };

        oCOM.POPUP.toggle("slotConfig_popup");
        this.slotsRender(hostId);
    };

    this.slotPicker_info = function() {
        oCOM.POPUP.wipe();
        oCOM.POPUP.html(
            "<b>Peripheral configuration</b><br><br>" +
            "To make a peripheral appear in this picker, add or modify its " +
            "entry in <code>CONFIG.md</code>.<br><br>" +
            "After editing <code>CONFIG.md</code>, compile it into " +
            "<code>COM_CONFIG.js</code> with:<br><br>" +
            "<code>tools/ConfigFile_updater.html</code><br><br>" +
            "Do not edit <code>COM_CONFIG.js</code> manually."
        );
    };













    this.deviceBtn = function(arg)
    {
        var btn = document.getElementById(arg.id);
        if(btn == null) return;

        // First reconcile the UI with the currently mounted topology.
        var slot = this.refreshDeviceToolboxes(arg);
        var slots = this.deviceSlots();

        if(slots.length == 0) return;
        if(arg.init === true) return;

        if(slot == null || slots.indexOf(slot) < 0) slot = slots[0];
        else slot = slots[(slots.indexOf(slot)+1)%slots.length];

        this.refreshDeviceToolboxes({"id":arg.id,"default_slot":slot});       
     }

    this.deviceSlots = function()
    {
        var slots = ["H"];
        if(typeof(_CFG_SLOT) == "object")
        {
            for(var i=0;i<8;i++)
                if(_CFG_SLOT[i] && _CFG_SLOT[i].PCODE)
                    slots.push(i);
        }
        return slots;
    }

    this.deviceLabel = function(slot)
    {
        return slot==="H" ? "H▹" : slot + "▹";
    }

    this.deviceTopologySig = function()
    {
        var slots = this.deviceSlots();
        var sig = [];

        for(var i=0;i<slots.length;i++)
        {
            var s = slots[i];
            var pcode = s==="H"
                ? "HostIO"
                : (_CFG_SLOT[s] && _CFG_SLOT[s].PCODE ? _CFG_SLOT[s].PCODE : "");
            sig.push(String(s)+":"+pcode);
        }

        return sig.join("|");
    }

    this.refreshDeviceToolboxes = function(arg)
    {
        arg = arg || {};

        var box = document.getElementById("device_toolbox_body");
        var btn = document.getElementById(arg.id || "devices");
        if(box == null || btn == null) return null;

        var slots = this.deviceSlots();
        var sig = this.deviceTopologySig();
        var oldSig = box.getAttribute("data-topology");

        // Rebuild only when mounted devices changed.
        if(oldSig !== sig)
        {
            box.innerHTML = this.deviceToolHTML();
            box.setAttribute("data-topology",sig);
            if(typeof(EMU_mem_map)=="function" && typeof(apple2plus)=="object" && apple2plus!=null)
                EMU_mem_map();
        }

        if(slots.length == 0)
        {
            btn.innerHTML = "∅";
            btn.setAttribute("data-slot","");
            this.showDeviceTool(null);
            return null;
        }

        var cur = btn.getAttribute("data-slot");
        var slot = cur==="H" ? "H"
                 : (cur==null || cur==="" ? null : Number(cur));

        // default_slot explicitly requested slot if still mounted
        if(arg.default_slot === "H" && slots.indexOf("H") >= 0) slot = "H";
        else if(typeof(arg.default_slot)=="number" && slots.indexOf(arg.default_slot) >= 0) slot = arg.default_slot;
        else if(slot == null || slots.indexOf(slot) < 0) slot = slots[0];

        btn.setAttribute("data-slot", slot==="H" ? "H" : String(slot));
        btn.innerHTML = this.deviceLabel(slot);
        this.showDeviceTool(slot);
        return slot;
    }


    this.renderDeviceTool = function(slot)
    {
      this.refreshDeviceToolboxes({"id":"devices","default_slot":slot});
    }

    this.showDeviceTool = function(slot)
    {
        var all = document.querySelectorAll("[id^='device_tool_']");
        for(var i=0;i<all.length;i++)
            all[i].hidden = true;

        if(slot == null) return;

        var el = document.getElementById("device_tool_" + (slot==="H" ? "H" : slot));
        if(el) el.hidden = false;
    }

    this.deviceToolHTML = function()
    {
        var slots = this.deviceSlots();
        var out = [];

        for(var i=0;i<slots.length;i++)
            out.push(this.deviceToolSlotHTML(slots[i]));

        return out.join("");
    }

    this.deviceToolSlotHTML = function(slot)
    {
        var pcode = slot==="H"
            ? "HostIO"
            : (_CFG_SLOT[slot] && _CFG_SLOT[slot].PCODE ? _CFG_SLOT[slot].PCODE : "");
 

        switch(pcode)
        {
            case "HostIO":
                var model = typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P";
                return ""
                    + "<div class=toolbox id=\"device_tool_H\" hidden>"
                    + "  <div class=appbox style=\"text-align:left;height:63px;padding:0px 6px 0px 6px;\">"
                    + "    <div><b>HostIO ["+model+"]</b>"
                    + "    <button class=appbut style=\"float:right;margin-top:0px\" onclick=\"apple2plus.hwObj().io.slotConfig_detail('BOARD')\">details</button></div>"
                    + "    <div style=\"padding-top:4px\">"
                    + "    <img src=res/cassette_50.png style=\"height:40px\">"
                    //+ "keyboard, speaker, cassette, paddles<br>and other soft-switches."
                    + "    </div>"
                    + "  </div>"
                    + "</div>";
            case "MS16K":
                return ""
                + "<div class=toolbox id=\"device_tool_"+slot+"\" hidden>"
                + "  <div class=appbox style=\"height:76px;padding:0px 6px 0px 6px;\" title=\"Memory map\">"
                + "    <div style=\"float:left;width:28px;text-align:center\">MEM<br><button class=appbut><i class=\"fa fa-sync-alt\" id=\"MEM_monitoring\" onclick=\""
                        +"oCOM.POPUP.toggle_class(this,'fa-stop-circle','fa-sync-alt');"
                        +"apple2plus.hwObj().enable_MEM_monitoring(oCOM.toggleRefreshEvent('MEM_monitoring'));"
                        +"oEMU.component.IO.RamCard?.enable_MEM_monitoring(oCOM.toggleRefreshEvent('MEM_monitoring_MS16K'));"
                        +"\"></i></button></div>"
                + "    <div id=\"EMU_mem_map\" style=\"margin-left:30px;white-space:nowrap\"></div>"
                + "  </div>"
                + "</div>";

            case "VIDEX":
                return ""
                    + "<div class=toolbox id=\"device_tool_"+slot+"\" hidden>"
                    + "  <div class=appbox style=\"text-align:left;height:63px;padding:0px 6px 0px 6px;\">"
                    + "    <b>#"+slot+" VIDEX</b><br>80-column toolbox is under construction."
                    + "  </div>"
                    + "</div>";
            case "DISKII":
                return ""
                    + "<div class=toolbox id=\"device_tool_"+slot+"\" hidden>"
                    + "  <div class=appbox style=\"height:63px;padding:0px 6px 0px 6px;\">"

                    // FILE BOX D1
                    + "    <div class=appbut style=\"padding:5px 0px 0px 0px;text-align:left;\">"
                    
                    + "        <input type=button method=get class=appbut id=\"but_D1\" value=\"Drive1\""
                    + " data-empty=\"Drive1\" data-loaded=\"\" title=\"Drive1: no disk\"  "
                    + " onclick=\"ejectDisk(this,'D1')\""
                    + " onmouseover=\"apple2plus.DiskObj().driveButtonHover(this,true)\""
                    + " onmouseout=\"apple2plus.DiskObj().driveButtonHover(this,false)\">"

                    + "      <form action=\"index.html\" id=\"f_D1\" style=\"display:inline;\">"
                    // TODO: this HTML is duplicated in apple2plus.DiskObj().diskFileInputHTML(), but cannot be called since apple2plus object does not exist at this time
                    + "        <input type=\"file\" name=\"D1\" id=\"file_D1\" style=\"display:inline-block\" onchange=\"javascript:EMU_audio_event_unlock();loadDisk_fromFile(this,'D1')\">"
                    + "      </form>"
                    
                    + "      <button class=appbut value=\"Download\" onclick=\"oCOM.Download('dump.dsk',apple2plus.DiskObj().getDiskData('D1'))\" id=\"dump_D1\" title=\"Dump\" style=\"float:right\"><i class=\"fa fa-cloud-download-alt\"></i></button>"
                    + "    </div>"

                    // FILE BOX D2
                    + "    <div class=appbut style=\"padding:5px 0px 0px 0px;text-align:left\">"

                    + "        <input type=button method=get class=appbut id=\"but_D2\" value=\"Drive2\""
                    + " data-empty=\"Drive2\" data-loaded=\"\" title=\"Drive2: no disk\"  "
                    + " onclick=\"ejectDisk(this,'D2')\""
                    + " onmouseover=\"apple2plus.DiskObj().driveButtonHover(this,true)\""
                    + " onmouseout=\"apple2plus.DiskObj().driveButtonHover(this,false)\">"
                    // TODO: this HTML is duplicated in apple2plus.DiskObj().diskFileInputHTML(), but cannot be called since apple2plus object does not exist at this time
                    + "      <form action=\"index.html\" id=\"f_D2\" style=\"display:inline;\">"
                    + "        <input type=\"file\" name=\"D2\" id=\"file_D2\" style=\"display:inline-block\" onchange=\"javascript:EMU_audio_event_unlock();loadDisk_fromFile(this,'D2')\">"
                    + "      </form>"

                    + "      <button class=appbut value=\"Download\" onclick=\"oCOM.Download('dump.dsk',apple2plus.DiskObj().getDiskData('D2'))\" id=\"dump_D2\" title=\"Dump\" style=\"float:right\"><i class=\"fa fa-cloud-download-alt\"></i></button>"
                    + "    </div>"

                    + "  </div>"

                    // BUTTON BOX
                    + "  <div class=appbox style=\"text-align:left;height:63px;padding:0px 6px 0px 6px;\">"
                    + "      <button class=appbut onclick=\"apple2plus.DiskObj().diskMenu_detail({id:'softwareCat'})\" title=\"Software Catalog\"><i class=\"fa fa-cat\"></i></button>"
                    + "      <br>"
                    + "      <button class=appbut onclick=\"apple2plus.DiskObj().diskMenu_detail({id:'surfaceMap'})\" title=\"Disk Surface Map\"><i class=\"fa fa-th\"></i></button>"
                    //+ "      <button class=appbut onclick=\"\" id=\"surfaceMap\" title=\"Surface Map\"><i class=\"fa fa-chart-pie\"></i></button>"
                    //+ "      <button class=appbut id=\"surfaceMap\" title=\"Surface Map\" onclick=\"apple2plus.DiskObj().diskMenu_detail({id:'surfaceMap'});\"><i class=\"fa fa-th\"></i></button>"
                    + "  </div>"
                    + "</div>"

                    // LIST BOXES
                    + "<div class=toolbox id=softwareCat></div>"
                    + "<div class=toolbox id=surfaceMap></div>";
        }

        return ""
            + "<div class=toolbox id=\"device_tool_"+slot+"\" hidden>"
            + "  <div class=appbox style=\"text-align:left;height:63px;padding:0px 6px 0px 6px;\">"
            + "    <b>#"+slot+" "+pcode+"</b><br>No toolbox is available yet."
            + "  </div>"
            + "</div>";
    }




    this.slotConfig = function(arg)
    {
        if(arg.active==false) document.getElementById(arg.id).innerHTML = "";

        //var ss = "<div class=\"appbut\" onclick=\"oCOM.POPUP.toggle('"+wrapper_id+"');\" style=\"text-align:center;float:right;\">x</div>"
        var s = "document.getElementById('"+arg.id+"').innerHTML='"+arg.id+"';"
        if(document.getElementById(arg.id)!=null)
            document.getElementById(arg.id).innerHTML = "<button class=appbut onclick=\"apple2plus.hwObj().io.slotConfig_detail('"+arg.id+"')\" style=\"margin-left:0px\"><i class=\""+arg.icon+"\"></i></button>"
    }

    this.slotConfig_detail = function(id)
    {
        //oCOM.POPUP.on("slotConfig_popup");
        var close = "<div class=\"appbut\" onclick=\"oCOM.POPUP.toggle('slotConfig_popup');\" style=\"text-align:center;float:right;\">x</div>";
        // TODO extend here to all popup customisations?
        if(id=="board")
        {
            var model = typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P";
            document.getElementById("slotConfig_popup").innerHTML =
                "board I/O ["+model+"]" + close + oEMU.component.IO.board.boardIO_html(model);
                
            oCOM.POPUP.toggle("slotConfig_popup");
            return;
        }
        document.getElementById("slotConfig_popup").innerHTML = id + close;
        console.log("apple2plus.hwObj().io.slotConfig_detail('"+id+"')");
    }










    function actionMapEntryCount(map)
    {
        var rows = [];
        var ops = orderedActionOps(map);

        for(var oi=0;oi<ops.length;oi++)
        {
            var op = ops[oi];
            var opMap = map[op];
            var addrs = numericActionAddrs(opMap);
            var spans = buildActionMapSpans(op,opMap);
            var callbacks = [];

            for(var ai=0;ai<addrs.length;ai++)
                if(callbacks.indexOf(opMap[addrs[ai]]) < 0) callbacks.push(opMap[addrs[ai]]);

            rows.push({
                 "op": op
                ,"entries": addrs.length
                ,"spans": spans.length
                ,"callbacks": callbacks.length
                ,"relative": addrs.length ? fmtRange(addrs[0],addrs[addrs.length-1],0) : ""
                ,"absolute": addrs.length ? fmtRange(addrs[0],addrs[addrs.length-1],ioBase()) : ""
            });
        }
        return rows;
    }

    function actionMapSpanReport(map)
    {
        var rows = [];
        var ops = orderedActionOps(map);

        for(var oi=0;oi<ops.length;oi++)
        {
            var spans = buildActionMapSpans(ops[oi],map[ops[oi]]);
            for(var si=0;si<spans.length;si++)
            {
                var span = spans[si];
                var space = ioSpaceLabel(span.from,span.to);
                var meta = callbackMeta(span.callback);
                if(!meta.PCODE && space === "HostIO")
                    meta = {"slotTitle":"board","PCODE":"BOARD","range":"HostIO"};

                rows.push({
                     "op": span.op
                    ,"relative": fmtRange(span.from,span.to,0)
                    ,"absolute": fmtRange(span.from,span.to,ioBase())
                    ,"bytes": span.to-span.from+1
                    ,"space": space
                    ,"slot": meta.slotTitle
                    ,"PCODE": meta.PCODE
                    ,"range": meta.range
                    ,"callback": callbackLabel(span.callback)
                });
            }
        }
        return rows;
    }

    function slotConfigReport(cfg)
    {
        var rows = [];
        for(var i=0;i<cfg.length;i++)
        {
            var slot = cfg[i] || {};
            var p = slot.peripheral || {};
            rows.push({
                 "slot": slot.slotTitle || ""
                ,"lock": slot.lock ? "yes" : ""
                ,"PCODE": p.PCODE || ""
                ,"container": p.coID || p.objID || ""
                ,"HostROM": reportRange(p.HostROM)
                ,"SlotIO": reportRange(p.SlotIO)
                ,"SlotROM": reportRange(p.SlotROM)
                ,"description": p.description || ""
            });
        }
        return rows;
    }

    function buildActionMapSpans(op,opMap)
    {
        var addrs = numericActionAddrs(opMap);
        var rows = [];
        if(addrs.length==0) return rows;

        var from = addrs[0];
        var prev = addrs[0];
        var callback = opMap[from];

        for(var i=1;i<addrs.length;i++)
        {
            var addr = addrs[i];
            var nextCallback = opMap[addr];

            if(addr == prev+1 && nextCallback === callback)
            {
                prev = addr;
                continue;
            }

            rows.push({"op":op,"from":from,"to":prev,"callback":callback});
            from = prev = addr;
            callback = nextCallback;
        }
        rows.push({"op":op,"from":from,"to":prev,"callback":callback});
        return rows;
    }

    function numericActionAddrs(opMap)
    {
        if(!opMap || typeof opMap !== "object") return [];
        return Object.keys(opMap)
            .map(function(k){ return Number(k) })
            .filter(function(n){ return Number.isFinite(n) })
            .sort(function(a,b){ return a-b });
    }

    function orderedActionOps(map)
    {
        if(!map || typeof map !== "object") return [];
        var order = ["RD","WR","RR","BT","RG","SV","VA"];
        return Object.keys(map)
            .filter(function(op){ return map[op] && typeof map[op] === "object" })
            .sort(function(a,b)
            {
                var ai = order.indexOf(a); if(ai<0) ai = order.length;
                var bi = order.indexOf(b); if(bi<0) bi = order.length;
                return ai == bi ? a.localeCompare(b) : ai-bi;
            });
    }

    function callbackMeta(callback)
    {
        var m = callback && callback._ioReport;
        if(m) return m;

        return {
             "slotTitle": ""
            ,"PCODE": ""
            ,"range": ""
        };
    }

    function callbackLabel(callback)
    {
        if(typeof callback !== "function") return String(callback);
        return callback.name || "(anonymous)";
    }

    function ioBase()
    {
        if(oEMU.system && oEMU.system.IORANGES && oEMU.system.IORANGES.HostIO)
            return oCOM.parseRngExpr(oEMU.system.IORANGES.HostIO).from;
        return 0xC000;
    }

    function reportRange(range)
    {
        if(!range) return "";
        return fmtRange(range.from,range.to,0)+" ("+fmtRange(range.from,range.to,ioBase())+")";
    }

    function fmtRange(from,to,base)
    {
        return fmtAddr(from+base)+"-"+fmtAddr(to+base);
    }

    function fmtAddr(addr)
    {
        return "$"+("0000"+Number(addr).toString(16).toUpperCase()).slice(-4);
    }

    function ioSpaceLabel(from,to)
    {
        var hostIO = parseNamedRange("HostIO");
        var hostROM = parseNamedRange("HostROM");

        if(within(from,to,hostIO)) return "HostIO";
        if(within(from,to,hostROM)) return "HostROM";

        for(var n=0;n<8;n++)
        {
            var slotIO = parseNamedRange("SlotIO",n);
            var slotROM = parseNamedRange("SlotROM",n);
            if(within(from,to,slotIO)) return "SlotIO PR#"+n;
            if(within(from,to,slotROM)) return "SlotROM PR#"+n;
        }
        return "";
    }

    function parseNamedRange(name,n)
    {
        if(!oEMU.system || !oEMU.system.IORANGES || !oEMU.system.IORANGES[name]) return null;
        return oCOM.parseRngExpr(oEMU.system.IORANGES[name],{"n":n || 0,"base":ioBase()});
    }

    function within(from,to,range)
    {
        return range && from >= range.from && to <= range.to;
    }



}
