//
// Copyright (c) 2014 Thomas Skibo.
// All rights reserved.
//
// Adapted in 2022 by Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// apple2io.js

if(oEMU===undefined) var oEMU = {"component":{"IO":{"ACTION_MAP":[]}},"system":{"A2P":{"active":true}}}
//else oEMU.component.IO = new Apple2IO();

if(oEMUI===undefined) var oEMUI = {"slotConfig":function(){},"slotsRender":function(){},"deviceBtn":function(){}} // allow tools to include apple2io.js without apple2main.js


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

    this.reset = function()
    {
        keys.reset();
        this.disk2.reset();
    }

    function line_decode(adr)
    {
        return adr<256 ? adr & 0xF0 : (adr & 0xFF00); // line decoder on IO & PROM addressing
    }


    // HOST_IO callbacks (keyboard, speaker, gfx) 

    const IOMAP_CALLS = 
    {1: // _CFG_IOMAP index
        {
            "KBD":         function(){ return keys.polling(keys.lastkey)   }
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


    if(typeof(EMU_system_get)!="undefined")
    {
        //var ACTION_MAP = oEMU.component.IO.ACTION_MAP;
        var CIO = oEMU.component.IO;
        CIO.ACTION_MAP = oEMU.component.IO.board.IO_map(EMU_system_get(),IOMAP_CALLS);
        //console.log("ACTION_MAP="+JSON.stringify(CIO.ACTION_MAP));
    }

    this.read = function(addr)
    {
        var line = line_decode(addr);

        switch(line)
        {
            //case 0xA545:  // DISKII

            // TODO: ACTION MAP SHOULD LOOKUP IN WHICH SLOT IS EACH DEVICE, AND ASSIGN READ ADDRESSES
            // LIKELY THIS INFORMATION CAN BE LOOKED-UP IN BIND.. we also need to solve slot re-assignment

            case 0xE0:   return this.disk2.read(addr - DISK_IO);
            case 0x0600: return this.disk2.readROM(addr - DISK_PROM);

            default:

                /*
                else if (addr >= DISK_IO && addr < DISK_IO + DISK_IO_SIZE)
                {
                    console.log(oCOM.getHexWord(line))
                    var o = this.disk2.read(addr - DISK_IO);
                    return o;
                }
                else if (this.disk2.diskBytes[this.disk2.drv] && addr >= DISK_PROM &&
                        addr < DISK_PROM + DISK_PROM_SIZE)
                {
                    //59 & 5A
                    console.log(oCOM.getHexWord(line))
                    return this.disk2.ROM[addr - DISK_PROM];
                }
                */
                // TODO: decode soft switches based on registry (auto declared mask)
                // ACTION_MAP = global registry ??


                if(this.ramcard.state.active  && // RAMCARD SOFT SWITCHES
                    addr >= MEM_RAMCARD_IO && addr < MEM_RAMCARD_IO + MEM_RAMCARD_IO_SIZE)
                {// 0080
                    return this.ramcard.soft_switch(addr - MEM_RAMCARD_IO);
                }
                else if(this.ramcard.state.active &&
                    addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)
                {// FD00
                    return this.ramcard.read(addr - ROM_ADDR);
                }
                else if(this.col80card.state.active &&
                    addr >= MEM_COL80CARD_IO && addr < MEM_COL80CARD_IO + ROM_SIZE)
                {
                    // TODO: read ROM from 80-column card !!
                    //alert("80_COL $"+oCOM.getHexWord(addr));
                }

                // I/O ACTION MAP FOR READ OPERATIONS
                if(CIO.ACTION_MAP.RD[addr]!==undefined)
                {
                    //if(addr > 16) console.log("ACTION: "+CIO.ACTION_MAP.RD[addr]);
                    return CIO.ACTION_MAP.RD[addr](addr);   // EXECUTE ACTION TRIGGERED BY A READ AT THIS ADDRESS
                }

            break;
        }


        return 0x00;
    }

    this.write = function(addr, d8)
    {
        if (addr >= DISK_IO && addr < DISK_IO + DISK_IO_SIZE)   // detect I/O range of DISK2
            this.disk2.write(addr - DISK_IO, d8);
        else if(this.ramcard.state.active && addr >= ROM_ADDR && addr < ROM_ADDR + ROM_SIZE)
            return this.ramcard.write(addr - ROM_ADDR,d8)
        
        // I/O ACTION MAP FOR WRITE OPERATIONS
        if(CIO.ACTION_MAP.WR[addr]!==undefined)
        {
            //if(addr > 16) console.log("ACTION: "+ACTION_MAP.RD[addr]);
            return CIO.ACTION_MAP.WR[addr](addr);   // EXECUTE ACTION TRIGGERED BY A WRITE AT THIS ADDRESS
        }

        // Implement same side-effects as read.
        this.read(addr);
    }

    this.cycle = function() {}

    this.keypress = function(code)
    {
        keys.lastkey = code;
    }


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

    this.DeviceName2obj = function(str)
    {

    }


    this.unmount = function(name,slot_num)
    {
        SLOT_NAME[slot_num] = null;
        const idx = slot_num<<3;
        SLOT_MAP[idx]   = 0;
        SLOT_MAP[idx+1] = 0;
        SLOT_MAP[idx+2] = 0;
        SLOT_MAP[idx+3] = 0;
        SLOT_MAP[idx+4] = 0;
        SLOT_MAP[idx+5] = 0;
        SLOT_MAP[idx+6] = 0;
        SLOT_MAP[idx+7] = 0;

        if(typeof(oEMUI.slotConfig)=="function")
            oEMUI.slotConfig({"id":"slot"+slot_num,"icon":"fa fa-cube","active":false});

        if(typeof(oEMUI.refreshDeviceToolboxes)=="function")
            oEMUI.refreshDeviceToolboxes({"id":"devices"});
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
            var n = Number( arr[i].replace(RegExp("\\*","g"),"") );
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
                {
                    if(extra.hasOwnProperty(k)) obj[k] = extra[k];
                }

                if(typeof obj.slotN === "number")
                {
                    obj.slotID = "PR#" + obj.slotN;
                }

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
    var SLOT_MAP  = new Uint16Array(8<<3);   // SLOT ADDRESS MAPPING
    //var SLOT_NAME = new Array(8);           // 8 SLOTS, 6 CHARACTERS PER SLOT NAME
    var SLOT_IDX  = new Array(8);
    var SLOT_REG  = [];

    var model = typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P";

    //var slot_count = 0;
    //if(typeof(_CFG_SYSCODE)!="undefined") slot_count = Number(_CFG_SYSCODE[model]?.Slots);    // HOW MANY SLOTS CAN WE FILL?

    var slotAvail = this.config_slotAvail(_CFG_SYSCODE);
    // example: slotAvail={"logSlots":["board","PR#0","PR#1","PR#2","PR#3","PR#4","PR#5","PR#6","PR#7"],"phySlots":[0,1,2,3,4,5,6,7],"lockSlots":{"board":true},"logSlots_n":8,"phySlots_n":8}
    var slot_count = slotAvail.logSlots_n;

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


    // TODO: refactor mount => must instantiate the object container, create the peripheral object and manage it, giving every object a unique ID!!!!
    this.mount = function(cinfo,pinfo,slotIdx)
    {
        if(oEMU.system===undefined) return;
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
        return pinfo;
    }

    // _CFG_PSLOT[pinfo.PCODE] =    {"MOCK":{"NAME":"Mockingboard C" ,"SlotIO":"X" ,"SlotROM":"" ,"HostROM":"" ,"SLOTrange":"1,2,3,4*,5,6,7" ,"SYScode":"A2,A2P,A2E"}
    //var peripheral_names = this.listPeripheralNames();
    //console.log("peripheral_names="+JSON.stringify(peripheral_names));
    
    
    // FIRST TODO: TAKE MAPPED I/O INPUT AND MOUNT YOUR DEVICES (OBJECT) ON THIS DATASTRUCTURE
    // MAKE SURE slot_cfg is declared and provisioned at this moment!!! (currently it is declared later)
    oEMU.component.MIO = oEMUI.slot_cfg;

    
    var slotCfg = [{slotTitle: "board", lock:true, peripheral: { objID: "mainboard", PCODE: "BOARD" ,icon: "fa fa-cube"}}];  // FILL SLOTS WITH BASICS
    for(var slotIdx=0;slotIdx<slot_count;slotIdx++)  // MOUNT = ATTACH A PERIPHERAL TO A SLOT (calculate the mapped I/O address ranges on the fly) 
    {
        if(slotR.slotMap[slotIdx])
        {
            var peripheral_names = this.listPeripheralNames();
            var pinfo = peripheral_names[slotR.slotMap[slotIdx][0]];   // BASIC PERIPHERAL INFO
            var cinfo = _CFG_PSLOT[pinfo.PCODE];                       // CONFIGURATION INFO





            pinfo = this.mount(cinfo,pinfo,slotIdx);

            slotCfg[slotIdx+1]  = {"slotTitle":"PR#"+slotIdx,"peripheral":pinfo}
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


    if(slot_count>0)
    {
        oEMUI.slotsRender("peripheral_slots",slotCfg);                      // sets oEMUI.slot_cfg = slotCfg
        oEMUI.deviceBtn({"id":"devices","init":true,"default_slot":6});    
    }

/*
slotCfg = [{"slotTitle":"board","lock":true,"peripheral":{"objID":"mainboard","PCODE":"BOARD","icon":"fa fa-cube"}}
,{"slotTitle":"PR#0","peripheral":{"PCODE":"MS16K","icon":"fa fa-microchip","objID":"RamCard","description":"Microsoft 16K Language card","SlotIO":{"from":49280,"to":49295}}}
,{"slotTitle":"PR#1"}
,{"slotTitle":"PR#2"}
,{"slotTitle":"PR#3","peripheral":{"PCODE":"VIDEX","icon":"fa fa-tv","objID":"col80card","description":"Videx Videoterm 80 Column Display","HostROM":{"from":51200,"to":53247},"SlotIO":{"from":49328,"to":49343},"SlotROM":{"from":49920,"to":50175}}}
,{"slotTitle":"PR#4"}
,{"slotTitle":"PR#5"}
,{"slotTitle":"PR#6","peripheral":{"PCODE":"DISKII","icon":"fa fa-save","objID":"AppleDisk2","description":"Apple Disk II Floppy Disk Subsystem","SlotIO":{"from":49376,"to":49391},"SlotROM":{"from":50688,"to":50943}}}
,{"slotTitle":"PR#7"}]
*/

}
