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

function Apple2IO(vid)
{
    const bDebug = true;

    this.slot_ctx = {};
    this.slots = [];

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
        //this.ramcard = oCOM.default(oEMU.component.IO.RamCard,{"state":{"active":false}},"RamCard");
        //this.col80card = oCOM.default(oEMU.component.IO.col80card,{"state":{"active":false}},"col80card");
        //this.disk2 = oCOM.default(oEMU.component.IO.AppleDisk,{"reset":function(){},"state":{"active":false,"diskData":[]}},"AppleDisk");
        //this.disk2 = this.PCODE2obj("DISKII")[0];

        oEMU.component.IO.self = this;
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
        var disk2 = this.PCODE2obj("DISKII")[0];
        if(disk2) disk2.reset();

        var ramcard = this.PCODE2obj("MS16K")[0];
        if(ramcard) ramcard.reset();
    }

    this.restart = function()
    {
        console.assert(Array.isArray(this.slots), "Apple2IO.slots must be initialized");

        // create empty slot info directly in the Apple2IO-owned configuration
        if (this.slots.length == 0)
        {
            for (var slotN = 0; slotN < slot_count + 1; slotN++)
                this.slots[slotN] = {"slotTitle": slotN2name(slotN)};
        }

        var model = typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P";

        update_IORANGES(model);
        if(!CIO.ACTION_MAP) CIO.ACTION_MAP = emptyActionMap();

        // discover object containers
        var pContainers = this.scanPeripheralContainers();

        // mount peripherals according to default configuration _CFG_PSLOT
        for(var slotN in slotR.slotMap)
        {
            if(isNaN(slotN)) continue;

            var pinfo = pContainers[slotR.slotMap[slotN][0]];
            if(pinfo===undefined) continue;

            var cinfo = _CFG_PSLOT[pinfo.PCODE];
            var slotObj = this.slots[slotN];
            if(slotObj===undefined) { continue; }

            if(slotObj.peripheral?.mount?.source == "COM_CONFIG") continue;     // avoid re-mounting pre-configured peripherals at the next restart

            var o = this.mount(cinfo,pinfo,slotN,slotR.slotFit[slotN]);
            if(!o || !o.pObj) continue;

            for(var so in o.sInfo) slotObj[so] = o.sInfo[so];
            slotObj.peripheral = o.pObj;

            if(o.pObj.id?.PCODE == "A2BO" && typeof(o.pObj.IO_map)=="function")
            {
                mergeActionMap(CIO.ACTION_MAP,o.pObj.IO_map(model));
            }

            if(bDebug) console.log("EMU_apple2io.js - mount(<"+pinfo.PCODE+" in "+slotN2name(slotN)+">)" );
        }

        installEmptyIOActions();

        function installEmptyIOActions()
        {
            function isSafeRead(ctx) { return ctx && ctx.bRO === true; }

            function rd_empty(base,label)
            {
                return function(rel_addr,ctx)
                {
                    if(!isSafeRead(ctx) && bDebug)  //Empty bus / unmapped I/O read. During safe memory scans, stay silent.
                        console.warn(label + ": RD unmapped address at $" + oCOM.getHexWord(0xC000 + base + rel_addr));
                    return 0x00;
                };
            }

            function wr_empty(base,label)
            {
                return function(rel_addr,d8,ctx)
                {
                    if(!isSafeRead(ctx) && bDebug)
                        console.warn(label + ": WR unmapped address at $" + oCOM.getHexWord(0xC000 + base + rel_addr));

                    return 0x00;
                };
            }

            /*
            * $C000-$C07F: Host I/O.
            * AppleBoard maps the real soft-switches; fill the remaining lines only.
            */
            for(var line = 0x00; line <= 0x70; line += 0x10)
            {
                if(!CIO.ACTION_MAP.RD[line]) CIO.ACTION_MAP.RD[line] = rd_empty(line,"HostIO");
                if(!CIO.ACTION_MAP.WR[line]) CIO.ACTION_MAP.WR[line] = wr_empty(line,"HostIO");
            }

            /*
            * $C080-$C0FF: Slot I/O.
            * This fixes the observed $C090 case when slot 1 has no mounted peripheral.
            */
            for(var line = 0x80; line <= 0xF0; line += 0x10)
            {
                if(!CIO.ACTION_MAP.RD[line]) CIO.ACTION_MAP.RD[line] = rd_empty(line,"SlotIO");
                if(!CIO.ACTION_MAP.WR[line]) CIO.ACTION_MAP.WR[line] = wr_empty(line,"SlotIO");
            }

            /*
            * $C100-$C7FF: Slot ROM.
            */
            for(var line = 0x100; line <= 0x700; line += 0x100)
            {
                if(!CIO.ACTION_MAP.RD[line]) CIO.ACTION_MAP.RD[line] = rd_empty(line,"SlotROM");
                if(!CIO.ACTION_MAP.WR[line]) CIO.ACTION_MAP.WR[line] = wr_empty(line,"SlotROM");
            }

            /*
            * $C800-$CFFF: Shared expansion ROM / Host ROM area.
            * $CFFF is the conventional "disable slot C8 ROM" address, but when no
            * card owns this area, it must still be safely readable.
            */
            for(var line = 0x800; line <= 0xF00; line += 0x100)
            {
                if(!CIO.ACTION_MAP.RD[line]) CIO.ACTION_MAP.RD[line] = rd_empty(line,"HostROM");
                if(!CIO.ACTION_MAP.WR[line]) CIO.ACTION_MAP.WR[line] = wr_empty(line,"HostROM");
            }
        }


/*
Example output of a mounted peripheral:

this.slots[3] = 
{
   "slotTitle":"PR#2",
   "peripheral":
   {
      "id":
      {
         "PCODE":"VIDEX",
         "icon":"fa fa-tv",
         "coID":"col80card",
         "description":"Videx Videoterm 80 Column Display"
      },
      "state":{ "active":true },
      "action":{ },
      "mount":
      {
         "slotN":3,
         "slotFit":["DISKII","VIDEX","MOCK"],
         "ranges":
         {
            "HostROM":{ "from":2048, "to":4095 },
            "SlotIO":{ "from":176, "to":191 },
            "SlotROM":{ "from":768, "to":1023 }
         },
         "hash":16425
      }
   }
}
*/

        //console.log(CIO.ACTION_MAP);
        //console.group("ACTION_MAP overview");
        //console.log("ACTION_MAP size="+oCOM.roughSizeOfObject(CIO.ACTION_MAP)+"bytes");
        //console.table(actionMapEntryCount(CIO.ACTION_MAP));
        //console.table(actionMapSpanReport(CIO.ACTION_MAP));
        //console.groupEnd();

        console.group("slot configuration overview");
        console.table(slotConfigReport(this.slots));
        //console.log("this.slots = "+JSON.stringify(this.slots));
        console.groupEnd();

        // restart all plugged-in and active peripherals
        for(var slotN in this.slots)
        {
            if(this.slots[slotN].peripheral===undefined) continue;
            var peripheral_obj = this.slots[slotN].peripheral;
            if(peripheral_obj.restart)
            {
                peripheral_obj.restart();
                if(bDebug) console.log("EMU_apple2io.js - restart(<"+peripheral_obj.id.PCODE+" in "+slotN2name(slotN)+">)" );
            }
        }

        // legacy adaptation
        var ramcard = this.PCODE2obj("MS16K")[0];
        if(ramcard) ramcard.restart();
        //if(this.disk2 && this.disk2.restart) this.disk2.restart();


        //if(typeof(CIO)=="undefined") var CIO = {ACTION_MAP:{}};
    }

function mergeActionMap(dst,src)
{
    if(!dst) dst = emptyActionMap();
    if(!src) return dst;

    for(var op in src)
    {
        if(!dst[op]) dst[op] = {};
        for(var addr in src[op])
            dst[op][addr] = src[op][addr];
    }

    return dst;
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

    this.PCODE2obj = function(PCODE)
    {
        var obj_arr = [];
        for(var o in this.slots)
        {
            if(this.slots[o].peripheral?.id.PCODE == PCODE)
                obj_arr.push(this.slots[o].peripheral);         // we can have multiple matches, since we do not specify slotN
        }
        return obj_arr;
    }



    function emptyActionMap()
    {
        return {"WR":{},"RD":{},"RR":{},"SV":{},"VA":{},"BT":{},"RG":{}};
    }

function update_IORANGES(sys_model)
{
    if(oEMU.system===undefined) return;
    if(typeof(_CFG_IORANGES)==="undefined") return;

    for(var o in _CFG_IORANGES)
    {
        if(syscode_has_model(o,sys_model))
        {
            oEMU.system["IORANGES"] = _CFG_IORANGES[o];

            oEMU.system["IORANGES-SLOT"] = {};
            for(var r in _CFG_IORANGES[o])
            {
                oEMU.system["IORANGES-SLOT"][r] =
                    oCOM.parseRngExpr(_CFG_IORANGES[o][r],{n:3});
            }
            return;
        }
    }
}

function syscode_has_model(syscodes,sys_model)
{
    if(!syscodes || !sys_model) return false;

    var needle = String(sys_model).toUpperCase();
    var list = String(syscodes)
        .replace(/<br\s*\/?\s*>/gi,"")
        .split(",");

    for(var i=0;i<list.length;i++)
    {
        if(oCOM.trim(list[i]).toUpperCase()===needle) return true;
    }
    return false;
}

   var CIO = oEMU.component.IO;


    function line_decode(adr)  { return adr<256 ? adr & 0xF0 : (adr & 0xFF00); } // line decoder on IO & PROM addressing

    this.read = function(rel_addr)
    {
        var line = line_decode(rel_addr);
        var xline = oCOM.getHexMulti(line,4);

        const ctx2 =
        {
            "keys": keys,
            "snd": snd,
            "vid": vid,
            "io": this,
            "bRO": (typeof(apple2plus) == "object" && apple2plus && apple2plus.hwObj().bRO === true)
        };

        var fn = CIO.ACTION_MAP.RD[line];
        if(!fn) { if(!ctx2.bRO) console.warn("CIO.ACTION_MAP.RD["+oCOM.getHexWord(line)+"] I/O call out of bounds (0x"+oCOM.getHexWord(line+0xC000)+")"); return 0x00; }

        /*
        * Read-only bus scan policy:
        *
        * SlotROM / HostROM must still be read normally, because these are real
        * CPU-visible ROM bytes, for example Disk II card ROM.
        *
        * SlotIO reads are different: on many Apple II cards they are soft-switch
        * triggers. During bRO scans, do not call those callbacks.
        */
        if(ctx2.bRO && fn._ioReport && fn._ioReport.range == "SlotIO")
            return 0x00;

        return fn(rel_addr-line,ctx2);
    }

this.write = function(rel_addr,d8)
{
    var line = line_decode(rel_addr);
    var xline = oCOM.getHexMulti(line,4);

    const ctx2 =
    {
        "keys": keys,
        "snd": snd,
        "vid": vid,
        "io": this,
        "bRO": (typeof(apple2plus) == "object" && apple2plus && apple2plus.hwObj().bRO === true)
    };

    var fn = CIO.ACTION_MAP.WR[line];
    if(fn) return fn(rel_addr-line,d8,ctx2);

    /*
     * Some Apple II soft-switches are triggered by the address access itself.
     * The 16K language card / ramcard is the important case here:
     * DOS 3.3 may write to $C080-$C08F, while the peripheral historically
     * exposed only a read-side SlotIO callback.
     *
     * Keep this fallback so write accesses can still trigger RD-style
     * soft-switch side effects when no explicit WR handler exists.
     */
    var rd = CIO.ACTION_MAP.RD[line];
    if(rd) return rd(rel_addr-line,ctx2);
    if(!ctx2.bRO) console.warn("CIO.ACTION_MAP.WR["+oCOM.getHexWord(line)+"] I/O call out of bounds (0x"+oCOM.getHexWord(line+0xC000)+")");

    return 0x00;
}

    this.cycle = function() {}

    this.mount = function(cinfo,peripheral_info,slotIdx,slotFit)
    {
        var peripheral_obj = null;
        var slot_info = {};

        if(oEMU.system===undefined) return {"sInfo":slot_info,"pObj":peripheral_obj};
        if(!cinfo || !peripheral_info) return {"sInfo":slot_info,"pObj":peripheral_obj};
        if(!oEMU.system["IORANGES"]) return {"sInfo":slot_info,"pObj":peripheral_obj};
        if(typeof(globalThis[peripheral_info.coID])!="function") return {"sInfo":slot_info,"pObj":peripheral_obj};

        if(oEMU.system["IORANGES"] && peripheral_info)
        {
            const bHostROM = typeof(oEMU.system.IORANGES.HostROM)!="undefined" && cinfo.HostROM == "X";
            const bSlotIO  = typeof(oEMU.system.IORANGES.SlotIO) !="undefined" && cinfo.SlotIO  == "X";
            const bSlotROM = typeof(oEMU.system.IORANGES.SlotROM)!="undefined" && cinfo.SlotROM == "X";
            const bHostIO  = typeof(oEMU.system.IORANGES.HostIO) !="undefined" && cinfo.HostIO  == "X";

            var ranges = {};
            var ioBase = oCOM.parseRngExpr(oEMU.system.IORANGES.HostIO).from; // usually $C000 = base reference for the I/O address space

            if(bHostROM) ranges.HostROM = oCOM.parseRngExpr(oEMU.system.IORANGES.HostROM,{n:slotIdx,base:ioBase});
            if(bSlotIO)  ranges.SlotIO  = oCOM.parseRngExpr(oEMU.system.IORANGES.SlotIO, {n:slotIdx-1,base:ioBase});
            if(bSlotROM) ranges.SlotROM = oCOM.parseRngExpr(oEMU.system.IORANGES.SlotROM,{n:slotIdx-1,base:ioBase});
            if(bHostIO)  ranges.HostIO  = oCOM.parseRngExpr(oEMU.system.IORANGES.HostIO, {n:slotIdx,base:ioBase});

            // coID = container ID
            peripheral_obj = new globalThis[peripheral_info.coID](); // freshly made object instance from the object container
            //if(cinfo!=null)  peripheral_obj.bFirstConfig = true;

            if(peripheral_obj)
            {
                var CIO = oEMU.component.IO;

                // Keep static identity on the peripheral object itself.
                if(!peripheral_obj.id) peripheral_obj.id = {};
                if(peripheral_obj.id.PCODE===undefined) peripheral_obj.id.PCODE = peripheral_info.PCODE;
                if(peripheral_obj.id.icon===undefined)  peripheral_obj.id.icon  = peripheral_info.icon || "fa fa-cube";
                peripheral_obj.id.coID = peripheral_info.coID || peripheral_obj.constructor.name;
                peripheral_obj.id.description = cinfo.NAME;

                // Keep mount-specific metadata on the peripheral object itself.
                //const hashKey = slotIdx + peripheralPCODE(peripheral_obj);
                const hashKey = Math.random();
                peripheral_obj.mount = {
                     "slotN": slotIdx
                    ,"slotFit": slotFit || []
                    ,"ranges": ranges
                    ,"hash": oCOM.crc16(new TextEncoder("utf-8").encode(hashKey))
                    ,"source":cinfo!=null?"COM_CONFIG":"USER"
                };

                //if(slotIdx == 7)
                //    alert("mounted DISKII "+peripheral_obj.mount.hash)

                /*
                if (peripheral_obj.id && peripheral_obj.id.PCODE == "MS16K")  // temporary patch!!!  making sure oEMU.component.IO.RamCard (old) remains in sync with peripheral_obj, so that mem monitoring uses the same object between apple ram updates in EMU_apple2hw.js and ramcard ram updates in EMU_ramcard.js
                {
                    this.ramcard = peripheral_obj;
                    oEMU.component.IO.RamCard = peripheral_obj;
                }
                */

                if(peripheral_info.slotLock==true) { slot_info.lock = true; } // inform the slot to never move this peripheral

                if(peripheral_obj.action)
                {
                    const _act = peripheral_obj.action;     // ACTION_MAP

                    const _bHostROM  = !(_act.HostROM === undefined);
                    const _bSlotIO   = !(_act.SlotIO  === undefined);
                    const _bSlotROM  = !(_act.SlotROM === undefined);
                    const _bHostIO   = !(_act.HostIO  === undefined);

                    // PROVIDE THE BASE ADDRESS FOR EACH MEMORY SPACE
                    if(_bHostROM && ranges.HostROM) _act.HostROM.base = ranges.HostROM.from;
                    if(_bSlotROM && ranges.SlotROM) _act.SlotROM.base = ranges.SlotROM.from;
                    if(_bSlotIO  && ranges.SlotIO)  _act.SlotIO.base  = ranges.SlotIO.from;
                    if(_bHostIO  && ranges.HostIO)  _act.HostIO.base  = ranges.HostIO.from;

                    // Add non-functional metadata to callbacks so diagnostics can show
                    // the actual mounted owner behind each ACTION_MAP span.
                    tagActionCallback(_act.HostROM && _act.HostROM.RD, "HostROM", "RD");
                    tagActionCallback(_act.SlotROM && _act.SlotROM.RD, "SlotROM", "RD");
                    tagActionCallback(_act.SlotIO  && _act.SlotIO.RD,  "SlotIO",  "RD");
                    tagActionCallback(_act.SlotIO  && _act.SlotIO.WR,  "SlotIO",  "WR");
                    tagActionCallback(_act.HostIO  && _act.HostIO.RD,  "HostIO",  "RD");
                    tagActionCallback(_act.HostIO  && _act.HostIO.WR,  "HostIO",  "WR");

                    if(_bHostROM && _act.HostROM.RD && ranges.HostROM) { for(var i=ranges.HostROM.from;i<=ranges.HostROM.to;i++) CIO.ACTION_MAP.RD[i] = _act.HostROM.RD.callback; }
                    if(_bSlotROM && _act.SlotROM.RD && ranges.SlotROM) { for(var i=ranges.SlotROM.from;i<=ranges.SlotROM.to;i++) CIO.ACTION_MAP.RD[i] = _act.SlotROM.RD.callback; }
                    if(_bSlotIO  && _act.SlotIO.RD  && ranges.SlotIO)  { for(var i=ranges.SlotIO.from; i<=ranges.SlotIO.to;i++)  CIO.ACTION_MAP.RD[i] = _act.SlotIO.RD.callback; }
                    if(_bSlotIO  && _act.SlotIO.WR  && ranges.SlotIO)  { for(var i=ranges.SlotIO.from; i<=ranges.SlotIO.to;i++)  CIO.ACTION_MAP.WR[i] = _act.SlotIO.WR.callback; }
                    if(_bHostIO && _act.HostIO.RD   && ranges.HostIO)  { for(var i=ranges.HostIO.from;i<=ranges.HostIO.to;i++)   CIO.ACTION_MAP.RD[i] = _act.HostIO.RD.callback; }
                    if(_bHostIO && _act.HostIO.WR   && ranges.HostIO)  { for(var i=ranges.HostIO.from;i<=ranges.HostIO.to;i++)   CIO.ACTION_MAP.WR[i] = _act.HostIO.WR.callback; }
                }

                function tagActionCallback(action,rangeName,op)
                {
                    if(!action || typeof action.callback !== "function") return;

                    action.callback._ioReport =
                    {
                         "PCODE": peripheralPCODE(peripheral_obj)
                        ,"slotTitle": slotN2name(slotIdx)
                        ,"range": rangeName
                        ,"op": op
                        ,"hash": peripheral_obj.mount.hash
                    };
                }
            }
        }

        return {"sInfo":slot_info,"pObj":peripheral_obj};
    }


    /*
     * Dynamic CPU memory mappings owned by peripherals.
     *
     * A peripheral registers a rule function. The rule receives a
     * JSON-compatible state object and returns the complete mapping
     * selected by that state.
     *
     * handler:
     *   "@default"  -> restore the Apple II default callback
     *   "methodName" -> use owner[methodName]
     */
    this.MEMORY_MAP =
    {
        rules: {},
        evidence: {},

        addRule: function(id,ruleFunction)
        {
            if(!id || typeof ruleFunction != "function")
                return false;

            this.rules[id] = ruleFunction;
            return true;
        },

        runRule: function(id,state)
        {
            var ruleFunction = this.rules[id];

            if(typeof ruleFunction != "function")
                return false;

            return this.mount(ruleFunction(state || {}));
        },

        mount: function(rule)
        {
            var hw = apple2plus.hwObj();

            if(!rule || !rule.owner || !Array.isArray(rule.mappings))
                return false;

            if(!hw || !hw.RD || !hw.WR || !hw.default_map)
                return false;

            var owner = rule.owner;
            var hash = owner.mount && owner.mount.hash;

            if(hash === undefined)
                return false;

            var state = cloneMappingState(rule.state);
            var evidence = [];

            for(var i=0;i<rule.mappings.length;i++)
            {
                var mapping = rule.mappings[i] || {};
                var op = String(mapping.op || "").toUpperCase();
                var range = parseCPUMappingRange(mapping.range);

                if(op != "RD" && op != "WR")
                    continue;

                if(!range)
                    continue;

                /*
                 * Apple2Hw currently dispatches CPU memory through one
                 * callback per 4K line.
                 */
                if(
                    (range.from & 0x0FFF) != 0 ||
                    (range.to   & 0x0FFF) != 0x0FFF
                )
                {
                    console.warn(
                        "MEMORY_MAP: range must be aligned to 4K lines: "
                        + mapping.range
                    );

                    continue;
                }

                var callback = null;

                if(mapping.handler != "@default")
                {
                    if(typeof mapping.callback == "function")
                    {
                        callback = mapping.callback;
                    }
                    else if(
                        mapping.handler &&
                        typeof owner[mapping.handler] == "function"
                    )
                    {
                        callback = owner[mapping.handler].bind(owner);
                    }

                    if(typeof callback != "function")
                    {
                        console.warn(
                            "MEMORY_MAP: callback not found: "
                            + mapping.handler
                        );

                        continue;
                    }
                }

                for(
                    var address=range.from;
                    address<=range.to;
                    address+=0x1000
                )
                {
                    var line = hw.lineDecode(address);

                    hw[op][line] =
                        mapping.handler == "@default"
                            ? hw.default_map[op][line]
                            : callback;
                }

                /*
                 * Store only serialisable evidence. Function references
                 * remain in the actual hardware callback tables.
                 */
                evidence.push({
                     "id":        mapping.id || op+"_"+range.from
                    ,"space":     mapping.space || "MEMORY MAPPING"
                    ,"op":        op
                    ,"from":      range.from
                    ,"to":        range.to
                    ,"handler":   mapping.handler || ""
                    ,"target":    mapping.target || ""
                    ,"enabled":   mapping.enabled === undefined
                                    ? true
                                    : !!mapping.enabled
                    ,"condition": mapping.condition || ""
                    ,"source":    rule.source || ""
                    ,"state":     state
                });
            }

            this.evidence[hash] = evidence;

            /*
             * Also place the evidence directly in slotConfig[n], beneath
             * peripheral.mount, so the slot popup has one source.
             */
            if(!owner.mount)
                owner.mount = {};

            owner.mount.mappings = evidence;

            return evidence.length > 0;
        },

        getEvidence: function(owner)
        {
            var hash = owner && owner.mount && owner.mount.hash;

            return hash === undefined
                ? []
                : this.evidence[hash] || [];
        }
    };

    function parseCPUMappingRange(spec)
    {
        var range;

        if(typeof spec == "string")
        {
            range = oCOM.parseRngExpr(spec);
        }
        else if(spec && typeof spec == "object")
        {
            range = {
                 "from": Number(spec.from)
                ,"to":   spec.to === undefined
                            ? Number(spec.from)
                            : Number(spec.to)
            };
        }

        if(
            !range ||
            !Number.isFinite(range.from) ||
            !Number.isFinite(range.to)
        )
            return null;

        return range;
    }

    function cloneMappingState(state)
    {
        try
        {
            return JSON.parse(JSON.stringify(state || {}));
        }
        catch(e)
        {
            return {};
        }
    }




    this.mapRead = function(addr)
    {
        return card.read(abs2rel(addr));
    };

    this.mapWrite = function(addr,d8)
    {
        var rel_addr = abs2rel(addr);
        var sw = softswitch[card.state.softswitch_pos] || {};

        card.write(rel_addr,d8);

        card.mark_MEM_monitoring(
            rel_addr < BANK_SIZE
                ? (sw.BANK == 0 ? "bankA" : "bankB")
                : "cont",
            rel_addr
        );
    };





    // _CFG_PSLOT[pinfo.PCODE] =    {"MOCK":{"NAME":"Mockingboard C" ,"SlotIO":"X" ,"SlotROM":"" ,"HostROM":"" ,"SLOTrange":"1,2,3,4*,5,6,7" ,"SYScode":"A2,A2P,A2E"}

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
    // TODO: make sure we do not skip DISKII
    this.scanPeripheralContainers = function()
    {
        var names = {};

        function registerPeripheralObj(obj, coID)
        {
            var PCODE = obj?.id?.PCODE;
            if(PCODE===undefined) return;

            names[PCODE] = obj.id;
            names[PCODE]["coID"] = coID;
        }

        for(var o in oEMU.component.IO)
        {
            var obj = oEMU.component.IO[o];

            if(obj?.id?.PCODE!==undefined)
            {
                registerPeripheralObj(obj, obj.constructor.name);
                continue;
            }

            /*
                oEMU.component.IO.board is intentionally null.
                The container key is "board", but the constructor is AppleBoard().
                This keeps board ownership in slot_cfg while still allowing discovery.
            */
            if(o=="board" && typeof(globalThis.AppleBoard)=="function")
            {
                try { registerPeripheralObj(new globalThis.AppleBoard(), "AppleBoard"); }
                catch(e) {}
            }
        }

        for(var o in oEMU.component.IO)
        {
            try
            {
                if(typeof(globalThis[o])=="function")
                    registerPeripheralObj(new globalThis[o](), o);
            }
            catch(e) {}
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
        if(ref.slotFit===undefined) ref.slotFit = [];
        if(ref.slotMap===undefined) ref.slotMap = [];
        var arr = str.split(",");
        for(var i=0;i<arr.length;i++)
        {
            var n = slotID2n( arr[i].replace(RegExp("\\*","g"),"") );

            if(ref.slotFit[n]===undefined) { ref.slotFit[n] = [] };
            ref.slotFit[n].push(PCODE);

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

    this.slot2ID = function(slotN)
    {
        // previously slotID == "B"
        return slotN == 0 ? "H" : Number(slotN) - 1;
    }

    function slotN2name(slotN)  // name = display name of a slot
    {
        return slotN == 0 ? "board" : ("PR#"+(slotN-1));
    }

    function slotName2n(slotName)
    {
        return slotName=="board" ? 0 : Number(slotName.slice(-1))+1
    }

    function peripheralPCODE(p)
    {
        return p ? (p.id && p.id.PCODE ? p.id.PCODE : (p.PCODE || "")) : "";
    }

    function peripheralIcon(p)
    {
        return p ? (p.id && p.id.icon ? p.id.icon : (p.icon || "fa fa-cube")) : "fa fa-cube";
    }

    function peripheralCoID(p)
    {
        return p ? (p.id && p.id.coID ? p.id.coID : (p.coID || (p.constructor ? p.constructor.name : ""))) : "";
    }

    function peripheralDescription(p)
    {
        return p ? (p.id && p.id.description ? p.id.description : (p.description || "")) : "";
    }

    function peripheralRange(p,rangeName)
    {
        if(!p) return undefined;
        if(p.mount && p.mount.ranges && p.mount.ranges[rangeName]) return p.mount.ranges[rangeName];
        return p[rangeName]; // legacy fallback
    }

    function setPeripheralSlot(p,slotN,slotTitle)
    {
        if(!p) return;
        //p.slotN = slotN;
        if(!p.mount) p.mount = {};
        p.mount.slotN = slotN;
        //p.mount.slotTitle = slotTitle || slotN2name(slotN);
    }

    this.HASH2obj = function(HASH)
    {
        for(var o in this.slots)
        {
            if(this.slots[o].peripheral?.mount.hash == HASH)
                return this.slots[o].peripheral;         // we can have multiple matches, since we do not specify slotN
        }
        return null;
    }

    this.SLOT2obj = function(slotN)
    {
        if(this.slots[slotN].peripheral===undefined) return null;
        return this.slots[slotN].peripheral;
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

    var slotR = {};  // TODO: remove as this is now in CONFIG     
    
    if(typeof(_CFG_PSLOT)!="undefined") // DO WE HAVE A CONFIGURATION FILE FOR OUR PERIPHERALS?
    {
        // LOAD ALL PERIPHERALS FROM CONFIGURATION
        for(var PCODE in _CFG_PSLOT)
        {
            var srange = _CFG_PSLOT[PCODE].SLOTrange.split(",");
            //var slotrange_mask = extract_slotrange_mask(_CFG_PSLOT[PCODE].SLOTrange);  // [0]:compatible slotrange for peripheral  [1]:pre-installed slots with peripheral
            slotR = extract_slotRef(_CFG_PSLOT[PCODE].SLOTrange,PCODE,slotR);
        }

        //slotR = {"slotMap":[["A2BO"],["MS16K"],null,null,["VIDEX"],["MOCK"],null,["DISKII"]]
        //        ,"slotFit":[["A2BO"],["MS16K"],["DISKII","MOCK"],["DISKII","MOCK"],["DISKII","VIDEX","MOCK"],["DISKII","MOCK"],["DISKII","MOCK"],["DISKII","MOCK"],["DISKII","MOCK"]]}

    }









//      ______   __          _                               ___  _          
//    .' ____ \ [  |        / |_                           .' ..](_)         
//    | (___ \_| | |  .--. `| |-'  .---.   .--.   _ .--.  _| |_  __   .--./) 
//     _.____`.  | |/ .'`\ \| |   / /'`\]/ .'`\ \[ `.-. |'-| |-'[  | / /'`\; 
//    | \____) | | || \__. || |,  | \__. | \__. | | | | |  | |   | | \ \._// 
//     \______.'[___]'.__.' \__/  '.___.' '.__.' [___||__][___] [___].',__`  
//                                                                  ( ( __)) 

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

      //console.log(JSON.stringify(ctx.slots));
      alert("Move " + ctx.hostId + " peripheral "+periID+" slot " + fromSlotId + "->" + toSlotId);
      
      alert("onSlotMove checkpoint: this.slots["+toSlotId+"] = "+JSON.stringify(this.slots[ slotName2n(toSlotId) ]));
    };

    this.slotsRender = function(elid, cfg)
    {
      if (!elid) return;

      if (!this.slot_ctx[elid])
      {
        this.slot_ctx[elid] = {
          hostId: elid,
          host: null,
          slots: null,
          clickBound: false,
          pointerDrag: null
        };
      }

      var ctx = this.slot_ctx[elid];
      if (cfg !== undefined) ctx.slots = cfg;
      if (!ctx.slots) ctx.slots = this.slots;

      ctx.host = document.getElementById(elid);
      if (!ctx.host) return;

      function getSlotById(Cfg, slotTitle) { return Cfg.find(function(slot) { return slot.slotTitle === slotTitle; }) }

      function renderGhost(slot)
      {
        var iconClass = slot && slot.peripheral ? peripheralIcon(slot.peripheral) : "fa fa-circle";

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
                  <span class="drag-handle" title="Move ${peripheralPCODE(slot.peripheral)}">
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
                ? `<button id="${peripheralPCODE(slot.peripheral)}" class="appbut cogbtn" type="button" title="configure ${peripheralPCODE(slot.peripheral)} / ${peripheralCoID(slot.peripheral)}()"><i class="${peripheralIcon(slot.peripheral)}"></i></button>`
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
        var fromSlot = getSlotById(ctx.slots, fromSlotId);
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
          slotMove(ctx.slots, fromSlotId, toSlotId);
          emui.slotsRender(ctx.hostId);
          console.log("Move peripheral from->to", ctx.hostId, fromSlotId, toSlotId);
          emui.onSlotMove(ctx, ev, fromSlotId, toSlotId);
        }

        function slotMove(slots, fromSlotId, toSlotId)
        {
            if (!slots ||
                !fromSlotId ||
                !toSlotId ||
                fromSlotId === toSlotId)
                return;

            var from = getSlotById(slots, fromSlotId);
            var to   = getSlotById(slots, toSlotId);

            if (!from ||
                !to ||
                from.lock ||
                !from.peripheral ||
                to.peripheral)
                return;

            to.peripheral = from.peripheral;

            setPeripheralSlot(
                to.peripheral,
                slotName2n(toSlotId),
                toSlotId
            );

            delete from.peripheral;
        }
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
      ctx.host.innerHTML = (ctx.slots || []).map(renderSlot).join("");
      
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

      console.log(JSON.stringify(ctx.slots));
    };


    this.slotConfig = function(arg)
    {
        if(arg.active==false) document.getElementById(arg.id).innerHTML = "";

        //var ss = "<div class=\"appbut\" onclick=\"oCOM.POPUP.toggle('"+wrapper_id+"');\" style=\"text-align:center;float:right;\">x</div>"
        var s = "document.getElementById('"+arg.id+"').innerHTML='"+arg.id+"';"
        if(document.getElementById(arg.id)!=null)
            document.getElementById(arg.id).innerHTML = "<button class=appbut onclick=\"apple2plus.hwObj().io.slotConfig_detail('"+arg.id+"')\" style=\"margin-left:0px\"><i class=\""+arg.icon+"\"></i></button>"
    }

    this.slotConfig_detail = function(slotName)
    {
        var n = slotName2n(slotName)
        var close = "<div class=\"appbut\" onclick=\"oCOM.POPUP.toggle('slotConfig_popup');\" style=\"text-align:center;float:right;\">x</div>";
        var slot = this.slots[n] || {};
        var html = close + slotConfigDetail_html(slot);

        
        if(n==0)
        {
            html += "<div style='overflow-y:scroll;height:350px'>"
            var model = typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P";
            var board = this.PCODE2obj("A2BO")[0];
            html += "<div class='appbox' style='float:none;'>"+(board && typeof(board.boardIO_html)=="function" ? board.boardIO_html(model) : "") +"</div>";
            html += "</div>"
        }

        document.getElementById("slotConfig_popup").innerHTML = html;
        oCOM.POPUP.toggle("slotConfig_popup");
    }

    this.slotConfig_addressToggle = function(element,headerID,showOffset)
    {
        if(!element) return;

        var header = document.getElementById(headerID);
        if(showOffset && element.dataset.ioOffset)
        {
            element.textContent = element.dataset.ioOffset;
            if(header) header.textContent = "I/O offset";
        }
        else
        {
            element.textContent = element.dataset.cpuAddress || "";
            if(header) header.textContent = "CPU address";
        }
    }

    function slotConfigDetail_html(slot)
    {
        var peripheral = slot && slot.peripheral;
        if(!peripheral)
            return "<div class='appbox' style='margin-top:8px;padding:8px'>No peripheral mounted.</div>";

        var hash = peripheral.mount && peripheral.mount.hash!==undefined ? peripheral.mount.hash : "unknown";
        var headerID = "slotConfig_address_header_"+String(hash).replace(/[^a-zA-Z0-9_-]/g,"_");
        var rows = [];
        var rangeNames = ["HostIO","SlotIO","SlotROM","HostROM"];

        // Static mappings declared by peripheral.action and peripheral.mount.ranges.
        for(var i=0;i<rangeNames.length;i++)
        {
            var rangeName = rangeNames[i];
            var range = peripheralRange(peripheral,rangeName);
            if(!range) continue;

            var action = peripheral.action && peripheral.action[rangeName]
                ? peripheral.action[rangeName]
                : {};
            var operations = [];

            if(action.RD && typeof(action.RD.callback)=="function")
                operations.push({"op":"RD","title":"RD -> "+callbackLabel(action.RD.callback)});
            if(action.WR && typeof(action.WR.callback)=="function")
                operations.push({"op":"WR","title":"WR -> "+callbackLabel(action.WR.callback)});

            rows.push({
                 "space":rangeName
                ,"cpuFrom":range.from+ioBase()
                ,"cpuTo":range.to+ioBase()
                ,"offsetFrom":range.from
                ,"offsetTo":range.to
                ,"operations":operations
            });
        }

        // Dynamic CPU mappings registered through MEMORY_MAP.
        var dynamicMappings = peripheral.mount && Array.isArray(peripheral.mount.mappings)
            ? peripheral.mount.mappings
            : [];

        for(var j=0;j<dynamicMappings.length;j++)
        {
            var mapping = dynamicMappings[j];
            var space = mapping.space || "MEMORY MAPPING";
            var operation = {
                 "op":mapping.op
                ,"title":mappingTooltip(mapping)
                ,"enabled":mapping.enabled!==false
            };
            var row = rows.find(function(candidate)
            {
                return candidate.space===space &&
                    candidate.cpuFrom===mapping.from &&
                    candidate.cpuTo===mapping.to &&
                    candidate.offsetFrom===undefined &&
                    candidate.offsetTo===undefined;
             });

            /* Keep RD/WR as separate evidence, but combine their display row. */
            if(row)
                row.operations.push(operation);
            else
                rows.push({
                     "space":space
                    ,"cpuFrom":mapping.from
                    ,"cpuTo":mapping.to
                    ,"operations":[operation]
                });

        }

        var body = "";
        for(var r=0;r<rows.length;r++) body += mappingRow_html(rows[r],headerID);
        if(!body) body = "<tr><td colspan='3' style='padding:8px'>No mappings registered.</td></tr>";

        return "<div class='appbox' style='float:none;width:440px;max-width:80vw;overflow:auto;margin-top:8px;padding:8px'>"
            + "<div><b>"+slotEscapeHTML(peripheralPCODE(peripheral))+"</b>"
            + (peripheralDescription(peripheral) ? " &mdash; "+slotEscapeHTML(peripheralDescription(peripheral)) : "")
            + " &mdash; " + slotN2name(slot.peripheral.mount.slotN)
            + "</div>"
            + "<table style='width:100%;border-collapse:collapse;margin-top:8px;text-align:left'>"
            + "<thead><tr style='border-bottom:1px solid #888'>"
            + "<th style='padding:4px 6px'>Space</th>"
            + "<th id='"+headerID+"' style='padding:4px 6px'>CPU address</th>"
            + "<th style='padding:4px 6px'>R/W</th>"
            + "</tr></thead>"
            + "<tbody>"+body+"</tbody>"
            + "</table></div>"
            
    }

    function mappingRow_html(row,headerID)
    {
        return ""
            + "<tr>"
            + "<td style='padding:4px 6px'>"+slotEscapeHTML(row.space)+"</td>"
            + "<td style='padding:4px 6px'>"+mappingAddress_html(row,headerID)+"</td>"
            + "<td style='padding:4px 6px'>"+mappingOperations_html(row.operations)+"</td>"
            + "</tr>";
    }

    function mappingAddress_html(row,headerID)
    {
        var cpuRange = fmtRange(row.cpuFrom,row.cpuTo,0);
        if(row.offsetFrom===undefined || row.offsetTo===undefined)
            return "<div class=\"appbut skinny\">"+cpuRange+"</div>";

        var offsetRange = fmtRange(row.offsetFrom,row.offsetTo,0);
        return ""
            + "<div class=\"appbut skinny\""
            + " data-cpu-address=\""+cpuRange+"\""
            + " data-io-offset=\""+offsetRange+"\""
            + " onmouseenter=\"apple2plus.hwObj().io.slotConfig_addressToggle(this,'"+headerID+"',true)\""
            + " onmouseleave=\"apple2plus.hwObj().io.slotConfig_addressToggle(this,'"+headerID+"',false)\">"
            + cpuRange
            + "</div>";
    }

    function mappingOperations_html(operations)
    {
        if(!operations || !operations.length) return "&mdash;";

        var html = "<div style='display:flex;gap:3px;white-space:nowrap'>";
        for(var i=0;i<operations.length;i++)
        {
            var operation = operations[i];
            html += "<div class=\"appbut skinny\""
                + (operation.title ? " title=\""+slotEscapeHTML(operation.title)+"\"" : "")
                + (operation.enabled===false ? " style=\"opacity:.55\"" : "")
                + ">"+slotEscapeHTML(operation.op)+"</div>";
        }
        return html+"</div>";
    }

    function mappingTooltip(mapping)
    {
        var parts = [];
        if(mapping.target) parts.push(mapping.op+" -> "+mapping.target);
        if(mapping.condition) parts.push(mapping.condition);
        if(mapping.enabled===false) parts.push("disabled by current soft-switch state");
        if(mapping.source) parts.push(mapping.source);
        return parts.join("; ");
    }

    function slotEscapeHTML(value)
    {
        return String(value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#39;");




    }

    /*
     * Render the address spaces and callbacks of one mounted peripheral.
     *
     * mount.ranges contains offsets relative to the Apple II I/O base,
     * normally $C000. peripheral.action contains the actual RD and WR
     * callback functions; these functions cannot be displayed through
     * JSON.stringify().
     */
    /*
     * Kept temporarily as a legacy renderer for comparison/debugging.
     *
     * It must not use the slotConfigDetail_html name: a later function
     * declaration with that name overrides the compact renderer above.
     */
    function slotConfigDetail_legacy_html(slot)
    {
        var p = slot && slot.peripheral;

        if(!p)
        {
            return ""
                + "<div class=appbox "
                + "style='margin-top:8px;padding:8px'>"
                + "No peripheral mounted."
                + "</div>";
        }

        /*
         * This order also follows the CPU-visible Apple II address space:
         *
         * HostIO  : $C000-$C07F
         * SlotIO  : $C080-$C0FF
         * SlotROM : $C100-$C7FF
         * HostROM : $C800-$CFFF
         */
        var rangeNames = [
             "HostIO"
            ,"SlotIO"
            ,"SlotROM"
            ,"HostROM"
        ];

        var rows = "";

        for(var i=0;i<rangeNames.length;i++)
        {
            var rangeName = rangeNames[i];
            var range = peripheralRange(p,rangeName);

            if(!range) continue;

            var action =
                p.action && p.action[rangeName]
                    ? p.action[rangeName]
                    : {};

            rows += ""
                + "<tr>"

                + "<td style='padding:4px 8px'>"
                + "<b>"+escapeHTML(rangeName)+"</b>"
                + "</td>"

                + "<td style='padding:4px 8px;font-family:monospace'>"
                + fmtRange(range.from,range.to,0)
                + "</td>"

                + "<td style='padding:4px 8px;font-family:monospace'>"
                + fmtRange(range.from,range.to,ioBase())
                + "</td>"

                + "<td style='padding:4px 8px;font-family:monospace'>"
                + actionCallbackLabel(action.RD)
                + "</td>"

                + "<td style='padding:4px 8px;font-family:monospace'>"
                + actionCallbackLabel(action.WR)
                + "</td>"

                + "</tr>";
        }

        if(rows=="")
        {
            rows = ""
                + "<tr>"
                + "<td colspan=5 style='padding:8px'>"
                + "No address ranges are configured for this peripheral."
                + "</td>"
                + "</tr>";
        }

        var description = peripheralDescription(p);

        return ""
            + "<div class=appbox "
            + "style='width:650px;max-width:80vw;"
            + "overflow:auto;margin-top:8px;padding:8px'>"

            + "<div>"
            + "<b>"+escapeHTML(peripheralPCODE(p))+"</b>"
            + (
                description
                    ? " &mdash; "+escapeHTML(description)
                    : ""
              )
            + "</div>"

            + "<table "
            + "style='width:100%;border-collapse:collapse;"
            + "margin-top:8px;text-align:left'>"

            + "<thead>"
            + "<tr style='border-bottom:1px solid #888'>"
            + "<th style='padding:4px 8px'>Space</th>"
            + "<th style='padding:4px 8px'>I/O offset</th>"
            + "<th style='padding:4px 8px'>CPU address</th>"
            + "<th style='padding:4px 8px'>RD function</th>"
            + "<th style='padding:4px 8px'>WR function</th>"
            + "</tr>"
            + "</thead>"

            + "<tbody>"
            + rows
            + "</tbody>"

            + "</table>"
            + "</div>";
    }

    function actionCallbackLabel(action)
    {
        var fn = action && action.callback;

        if(typeof fn !== "function")
            return "&mdash;";

        /*
         * Function.bind() normally produces names such as
         * "bound read" and "bound write". The "bound" prefix is
         * an implementation detail and is not useful in the UI.
         */
        var name = callbackLabel(fn).replace(/^bound\s+/,"");

        return escapeHTML(
            name == "(anonymous)"
                ? name
                : name+"()"
        );
    }

    function escapeHTML(value)
    {
        return String(value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#39;");
    }


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

        console.assert(
            Array.isArray(io.slots),
            "io.slots must be an array"
        );

        console.assert(
            io.slot_ctx.peripheral_slots.slots === io.slots,
            "slot renderer must reference the canonical slot array"
        );

        console.assert(
            io.slots.length === slot_count + 1,
            "unexpected number of internal slot records"
        );

        var names = io && io.scanPeripheralContainers ? io.scanPeripheralContainers() : {};
        
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

    this.slotPicker_select = function(hostId, slotTitle, pcode)
    {
        var ctx = this.slot_ctx[hostId];
        var slots = ctx && Array.isArray(ctx.slots) ? ctx.slots : this.slots;
        var slot = slots.find(function(s) { return s.slotTitle === slotTitle; });
        if (!slot || slot.lock || slot.peripheral) return;

        var io = oEMU.component.IO.self;
        var names = io && io.scanPeripheralContainers ? io.scanPeripheralContainers() : {};
        var id = names[pcode];

        var cinfo = typeof(_CFG_PSLOT) !== "undefined" && _CFG_PSLOT[pcode] ? _CFG_PSLOT[pcode] : null;
        if (!id || !cinfo) return;

        var slotN = slotName2n(slotTitle);
        var o = io.mount( cinfo, id, slotN, slotR.slotFit ? slotR.slotFit[slotN] : [] );
        if (!o || !o.pObj) return;

        for (var so in o.sInfo) slot[so] = o.sInfo[so];
        slot.peripheral = o.pObj;

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

// END
// ^ ^ ^ ^
// | | | |
//      ______   __          _                               ___  _          
//    .' ____ \ [  |        / |_                           .' ..](_)         
//    | (___ \_| | |  .--. `| |-'  .---.   .--.   _ .--.  _| |_  __   .--./) 
//     _.____`.  | |/ .'`\ \| |   / /'`\]/ .'`\ \[ `.-. |'-| |-'[  | / /'`\; 
//    | \____) | | || \__. || |,  | \__. | \__. | | | | |  | |   | | \ \._// 
//     \______.'[___]'.__.' \__/  '.___.' '.__.' [___||__][___] [___].',__`  
//                                                                  ( ( __)) 











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
            // display all Peripheral controls
            var slots = this.deviceSlots();
            for(var slotN=0,html_arr=[];slotN<slots.length;slotN++)
                html_arr.push(this.deviceToolSlotHTML( slots[slotN] ));
            box.innerHTML = html_arr.join("");
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

/*
    this.renderDeviceTool = function(slot)
    {
      this.refreshDeviceToolboxes({"id":"devices","default_slot":slot});
    }
*/

    this.showDeviceTool = function(slot)
    {
        var all = document.querySelectorAll("[id^='device_tool_']");
        for(var i=0;i<all.length;i++)
            all[i].hidden = true;

        if(slot == null) return;

        var el = document.getElementById("device_tool_" + (slot==="H" ? "H" : slot));
        if(el) el.hidden = false;
    }

    /*
    this.deviceToolHTML = function()
    {
        var slots = this.deviceSlots();
        var out = [];

        for(var i=0;i<slots.length;i++)
            out.push(this.deviceToolSlotHTML(slots[i]));

        return out.join("");
    }
    */

    this.deviceToolSlotHTML = function(slotID)
    {
        var slotN = slotID2n(slotID);

        var pcode = slotID==="H"
            ? "HostIO"
            : (_CFG_SLOT[slotID] && _CFG_SLOT[slotID].PCODE ? _CFG_SLOT[slotID].PCODE : "");
 
        switch(pcode)
        {
            case "HostIO":
                var model = typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P";
                var board = this.PCODE2obj("A2BO")[0];
                return ""
                    + "<div class=toolbox id=\"device_tool_H\" style=\"padding:0px\" hidden>"
                        +"<div class='appbox' style='float:none;width:350px;max-width:80vw;padding:8px'>"
                        +(board && typeof(board.deviceList_html)=="function" ? board.deviceList_html(model) : "")
                        +"</div>"
                    + "</div>";
            case "MS16K":
                return ""
                + "<div class=toolbox id=\"device_tool_"+slotID+"\" hidden>"
                + "  <div class=appbox style=\"height:76px;padding:0px 6px 0px 6px;\" title=\"Memory map\">"
                + "    <div style=\"float:left;width:28px;text-align:center\">MEM<br><button class=appbut><i class=\"fa fa-sync-alt\" id=\"MEM_monitoring\" onclick=\""
                        +"oCOM.POPUP.toggle_class(this,'fa-stop-circle','fa-sync-alt');"
                        +"var bMEM_monitoring=oCOM.toggleRefreshEvent('MEM_monitoring');"
                        +"apple2plus.hwObj().enable_MEM_monitoring(bMEM_monitoring);"
                        +"oCOM.enableRefreshEvent('MEM_monitoring_MS16K',bMEM_monitoring);"
                        +"apple2plus.hwObj().io.PCODE2obj('MS16K')[0]?.enable_MEM_monitoring(bMEM_monitoring);"
                        +"\"></i></button></div>"
                + "    <div id=\"EMU_mem_map\" style=\"margin-left:30px;white-space:nowrap\"></div>"
                + "  </div>"
                + "</div>";

            case "VIDEX":
                return ""
                    + "<div class=toolbox id=\"device_tool_"+slotID+"\" hidden>"
                    + "  <div class=appbox style=\"text-align:left;height:63px;padding:0px 6px 0px 6px;\">"
                    + "    <b>#"+slotID+" VIDEX</b><br>80-column toolbox is under construction."
                    + "  </div>"
                    + "</div>";
            case "DISKII":
                return ""
                    + "<div class=toolbox id=\"device_tool_"+slotID+"\" hidden>"
                    + "  <div class=appbox style=\"height:63px;padding:0px 6px 0px 6px;\">"

                    // FILE BOX D1
                    + "    <div class=appbut style=\"padding:5px 0px 0px 0px;text-align:left;\">"
                    
                    + "        <input type=button method=get class=appbut id=\"but_D1\" value=\"Drive1\""
                    + " data-empty=\"Drive1\" data-loaded=\"\" title=\"Drive1: no disk\"  "
                    + " onclick=\"ejectDisk(this,'D1')\""

                    + " onmouseover=\"apple2plus.hwObj().io.SLOT2obj("+slotN+").driveButtonHover(this,true)\""
                    + "  onmouseout=\"apple2plus.hwObj().io.SLOT2obj("+slotN+").driveButtonHover(this,false)\">"
                    //+ " onmouseover=\"apple2plus.DiskObj().driveButtonHover(this,true)\""
                    //+ " onmouseout=\"apple2plus.DiskObj().driveButtonHover(this,false)\">"

                    + "      <form action=\"index.html\" id=\"f_D1\" style=\"display:inline;\">"
                    + "        <input type=\"file\" name=\"D1\" id=\"file_D1\" style=\"display:inline-block\" onchange=\"javascript:EMU_audio_event_unlock();loadDisk_fromFile(this,"+slotN+",'D1')\">"
                    + "      </form>"
                    
                    + "      <button class=appbut value=\"Download\" onclick=\"apple2plus.hwObj().io.SLOT2obj("+slotN+").downloadDisk('D1')\" id=\"dump_D1\" title=\"Save disk\" style=\"float:right\"><i class=\"fa fa-cloud-download-alt\"></i></button>"

                    + "    </div>"

                    // FILE BOX D2
                    + "    <div class=appbut style=\"padding:5px 0px 0px 0px;text-align:left\">"

                    + "        <input type=button method=get class=appbut id=\"but_D2\" value=\"Drive2\""
                    + " data-empty=\"Drive2\" data-loaded=\"\" title=\"Drive2: no disk\"  "
                    + " onclick=\"ejectDisk(this,'D2')\""
                    + " onmouseover=\"apple2plus.hwObj().io.SLOT2obj("+slotN+").driveButtonHover(this,true)\""
                    + " onmouseout=\"apple2plus.hwObj().io.SLOT2obj("+slotN+").driveButtonHover(this,false)\">"
                
                    + "      <form action=\"index.html\" id=\"f_D2\" style=\"display:inline;\">"
                    + "        <input type=\"file\" name=\"D2\" id=\"file_D2\" style=\"display:inline-block\" onchange=\"javascript:EMU_audio_event_unlock();loadDisk_fromFile(this,"+slotN+",'D2')\">"
                    + "      </form>"
                    + "      <button class=appbut value=\"Download\" onclick=\"apple2plus.hwObj().io.SLOT2obj("+slotN+").downloadDisk('D2')\" id=\"dump_D2\" title=\"Save disk\" style=\"float:right\"><i class=\"fa fa-cloud-download-alt\"></i></button>"
                    + "    </div>"

                    + "  </div>"

                    // BUTTON BOX
                    + "  <div class=appbox style=\"text-align:left;height:63px;padding:0px 6px 0px 6px;\">"
                    + "      <button class=appbut onclick=\"apple2plus.hwObj().io.SLOT2obj("+slotN+").diskMenu_detail({id:'softwareCat'})\" title=\"Software Catalog\"><i class=\"fa fa-cat\"></i></button>"
                    + "      <br>"
                    + "      <button class=appbut onclick=\"apple2plus.hwObj().io.SLOT2obj("+slotN+").diskMenu_detail({id:'surfaceMap'})\" title=\"Disk Surface Map\"><i class=\"fa fa-th\"></i></button>"
                    //+ "      <button class=appbut onclick=\"\" id=\"surfaceMap\" title=\"Surface Map\"><i class=\"fa fa-chart-pie\"></i></button>"
                    //+ "      <button class=appbut id=\"surfaceMap\" title=\"Surface Map\" onclick=\"apple2plus.DiskObj().diskMenu_detail({id:'surfaceMap'});\"><i class=\"fa fa-th\"></i></button>"
                    + "  </div>"
                    + "</div>"

                    // LIST BOXES
                    + "<div class=toolbox id=softwareCat></div>"
                    + "<div class=toolbox id=surfaceMap></div>";
        }

        return ""
            + "<div class=toolbox id=\"device_tool_"+slotID+"\" hidden>"
            + "  <div class=appbox style=\"text-align:left;height:63px;padding:0px 6px 0px 6px;\">"
            + "    <b>#"+slotID+" "+pcode+"</b><br>No toolbox is available yet."
            + "  </div>"
            + "</div>";
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
            var p = slot.peripheral || null;
            rows.push({
                 "slot": slot.slotTitle || ""
                ,"lock": slot.lock ? "yes" : ""
                ,"PCODE": peripheralPCODE(p)
                ,"container": peripheralCoID(p)
                ,"HostROM": reportRange(peripheralRange(p,"HostROM"))
                ,"SlotIO": reportRange(peripheralRange(p,"SlotIO"))
                ,"SlotROM": reportRange(peripheralRange(p,"SlotROM"))
                ,"description": peripheralDescription(p)
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
