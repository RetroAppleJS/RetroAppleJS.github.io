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



/*
 * Shared removable-media row used by Disk II drives and SmartPort disk units.
 * Keep the native <input type="file"> visible: the browser then owns filename
 * presentation instead of each peripheral inventing a parallel label/state UI.
 */
function EMU_deviceMediaRowHTML(spec)
{
    spec = spec || {};

    function attr(value)
    {
        return String(value==null ? "" : value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/\"/g,"&quot;");
    }

    var label = String(spec.label || "Disk");
    var buttonTitle = spec.buttonTitle || (label+": no disk");
    var downloadTitle = spec.downloadTitle || "Save disk";
    var managedFilename = spec.fileDisplayName!==undefined && spec.fileDisplayName!==null;
    var fileID = String(spec.fileID || "");
    var fileControl = "";

    if(managedFilename)
    {
        fileControl += "        <input type=\"file\""
            + (spec.fileName ? " name=\""+attr(spec.fileName)+"\"" : "")
            + (fileID ? " id=\""+attr(fileID)+"\"" : "")
            + " style=\"display:none\""
            + (spec.fileAccept ? " accept=\""+attr(spec.fileAccept)+"\"" : "")
            + (spec.fileOnChange ? " onchange=\""+spec.fileOnChange+"\"" : "")
            + ">";
        if(fileID)
            fileControl += "        <label class=appbut for=\""+attr(fileID)+"\" style=\"display:inline-block;cursor:pointer\">Choose File</label>";
        fileControl += "        <span"
            + (fileID ? " id=\""+attr(fileID+"_name")+"\"" : "")
            + " style=\"padding-left:6px\">"+attr(spec.fileDisplayName)+"</span>";
    }
    else
    {
        fileControl += "        <input type=\"file\""
            + (spec.fileName ? " name=\""+attr(spec.fileName)+"\"" : "")
            + (fileID ? " id=\""+attr(fileID)+"\"" : "")
            + " style=\"display:inline-block\""
            + (spec.fileAccept ? " accept=\""+attr(spec.fileAccept)+"\"" : "")
            + (spec.fileOnChange ? " onchange=\""+spec.fileOnChange+"\"" : "")
            + ">";
    }

    return ""
        + "    <div class=appbut style=\"padding:5px 0px 0px 0px;text-align:left;\">"
        + "      <input type=button method=get class=appbut"
        + (spec.buttonID ? " id=\""+attr(spec.buttonID)+"\"" : "")
        + " value=\""+attr(label)+"\""
        + " data-empty=\""+attr(spec.buttonDataEmpty || label)+"\" data-loaded=\"\""
        + " title=\""+attr(buttonTitle)+"\""
        + (spec.buttonOnClick ? " onclick=\""+spec.buttonOnClick+"\"" : "")
        + (spec.buttonOnMouseOver ? " onmouseover=\""+spec.buttonOnMouseOver+"\"" : "")
        + (spec.buttonOnMouseOut ? " onmouseout=\""+spec.buttonOnMouseOut+"\"" : "")
        + ">"
        + "      <form action=\"index.html\""
        + (spec.formID ? " id=\""+attr(spec.formID)+"\"" : "")
        + " style=\"display:inline;\">"
        + fileControl
        + "      </form>"
        + "      <span style=\"float:right;white-space:nowrap\">"
        + "<button class=appbut value=\"Download\""
        + (spec.downloadID ? " id=\""+attr(spec.downloadID)+"\"" : "")
        + (spec.downloadDisabled ? " disabled" : (spec.downloadOnClick ? " onclick=\""+spec.downloadOnClick+"\"" : ""))
        + " title=\""+attr(downloadTitle)+"\">"
        + "<i class=\"fa fa-cloud-download-alt\"></i></button>"
        + (function()
          {
              var out="";
              var actions=Array.isArray(spec.capabilityActions) ? spec.capabilityActions : [];
              for(var i=0;i<actions.length;i++)
              {
                  var action=actions[i] || {};
                  out += "<button class=\"appbut\""
                      + (action.id ? " id=\""+attr(action.id)+"\"" : "")
                      + (action.disabled ? " disabled" : (action.onClick ? " onclick=\""+action.onClick+"\"" : ""))
                      + " title=\""+attr(action.title || "")+"\">"
                      + "<i class=\""+attr(action.icon || "fa fa-circle")+"\"></i></button>";
              }
              return out;
          })()
        + "</span>"
        + "    </div>";
}

function Apple2IO(vid,hostHardware)
{
    const bDebug = true;
    var io = this;
    hostHardware = hostHardware || null;

    this.slot_ctx = {};
    this.slots = [];
    this.attachments = {};

    /*
     * Device hook lists are rebuilt only when attachments or their active
     * state change.  The CPU hot path then performs direct callback calls
     * without rescanning attachments or testing method types.
     */
    var tickCallbacks = [];
    var cycleCallbacks = [];

    /*
     * Monotonic emulated CPU-cycle timebase.  This advances only when a 6502
     * tick actually completes; it is deliberately independent of host RTC.
     * Slow peripherals can sample it lazily instead of adding another callback
     * to the one-call-per-CPU-tick hot path.
     */
    var clockTicks = 0;

    function hookActive(device,hook)
    {
        var predicate = hook=="tick" ? device.isTickActive : device.isCycleActive;
        return typeof(predicate)!="function" || predicate.call(device)!==false;
    }

    function rebuildDeviceHooks()
    {
        tickCallbacks.length = 0;
        cycleCallbacks.length = 0;

        for(var key in io.attachments)
        {
            var device = io.attachments[key].device;
            if(!device) continue;

            if(typeof(device.tick)=="function" && hookActive(device,"tick"))
                tickCallbacks.push(device.tick.bind(device));

            if(typeof(device.cycle)=="function" && hookActive(device,"cycle"))
                cycleCallbacks.push(device.cycle.bind(device));
        }
    }

    this.refreshDeviceHooks = rebuildDeviceHooks;    

    // restart() installs the real empty-bus filler; live remounts reuse it.
    var refillEmptyIOActions = function(){};

    if(typeof(oEMU.component.IO)!="undefined")
    {
        //var keys = oCOM.default(oEMU.component.Keyboard,{"KbdHover":function(){},"cycle":function(){},"keystroke":function(){},"strobe":function(){},"polling":function(){},"events":function(){},"KbdHTML":function(){},"reset":function(){},"lastkey":0x00},"A2Pkeys");
        //var keys = oCOM.default(oEMU.component.Keyboard,{"KbdHover":function(){},"cycle":function(){},"keystroke":function(){},"strobe":function(){},"polling":function(){},"events":function(){},"KbdHTML":function(){},"reset":function(){},"lastkey":0x00},"A2Pkeys");
        //var snd = oCOM.default(oEMU.component.IO.AppleSpeaker,{"toggle":function(){}},"AppleSpeaker");
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
        // Reset every mounted peripheral by its unique slot ownership.
        for(var slotN in this.slots)
        {
            var peripheral = this.SLOT2obj(slotN);
            if(peripheral && typeof(peripheral.reset)=="function")
                peripheral.reset();
        }

        for(var deviceKey in this.attachments)
        {
            var device = this.attachments[deviceKey].device;
            if(device && typeof(device.reset)=="function")
                device.reset();
        }

        rebuildDeviceHooks();
    }

    this.provisionPeripheral = function(owner,model)
    {
        if(!owner) return false;

        if(typeof(owner.IO_map)=="function")
            mergeActionMap(CIO.ACTION_MAP,owner.IO_map(model));

        var deviceConfig = Array.isArray(owner.deviceConfig) ? owner.deviceConfig : [];
        for(var deviceN=0;deviceN<deviceConfig.length;deviceN++)
        {
            var deviceInfo=deviceConfig[deviceN];
            if(!deviceInfo || deviceInfo.autoAttach===false) continue;

            if(deviceInfo.autoAttach==="if-empty")
            {
                var mountedDevices=Array.isArray(owner.devices) ? owner.devices : [];
                if(mountedDevices.length>0) continue;
            }

            this.attach(owner,deviceInfo);
        }

        return true;
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

        // _CFG_PSLOT is the whitelist; eligible IO containers are discovered.
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

            if(bDebug) console.log("EMU_apple2io.js - mount(<"+pinfo.PCODE+" in "+slotN2name(slotN)+">)" );
        }

        // Peripherals may expose host maps and declarative attached devices.
        // Re-run this on every restart, including when the mounted object is reused.
        for(var mountedSlotN in this.slots)
        {
            var owner = this.slots[mountedSlotN].peripheral;
            if(!owner) continue;
            this.provisionPeripheral(owner,model);
        }

        refillEmptyIOActions = installEmptyIOActions;
        installEmptyIOActions();

        function installEmptyIOActions()
        {
            function isSafeRead(ctx) { return ctx && ctx.bRO === true; }

            function rd_empty(base,label)
            {
                var fn = function(rel_addr,ctx)
                {
                    if(!isSafeRead(ctx) && bDebug)
                        console.warn(
                            label + ": RD unmapped address at $" +
                            oCOM.getHexWord(0xC000 + base + rel_addr)
                        );

                    return 0x00;
                };

                fn._ioEmpty = true;
                return fn;
            }

            function wr_empty(base,label)
            {
                var fn = function(rel_addr,d8,ctx)
                {
                    if(!isSafeRead(ctx) && bDebug)
                        console.warn(
                            label + ": WR unmapped address at $" +
                            oCOM.getHexWord(0xC000 + base + rel_addr)
                        );

                    return 0x00;
                };

                fn._ioEmpty = true;
                return fn;
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

        for(var deviceKey in this.attachments)
        {
            var device = this.attachments[deviceKey].device;
            if(device && typeof(device.restart)=="function")
            {
                device.restart();
                if(bDebug) console.log("EMU_apple2io.js - restart device <"+device.id.DCODE+" on "+device.id.hostPCODE+">");
            }
        }

        rebuildDeviceHooks();
        /*
         * Every mounted peripheral was restarted in the slot loop above.
         * Do not restart one arbitrarily selected PCODE match a second time.
         */


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

    /*
     * Type query: intentionally returns every matching instance.
     * Never select obj_arr[0] when the caller means a particular slot.
     */
    this.PCODE2obj = function(PCODE)
    {
        var obj_arr = [];
        for(var o in this.slots)
        {
            if(this.slots[o].peripheral?.id.PCODE == PCODE)
                obj_arr.push(this.slots[o].peripheral);
        }
        return obj_arr;
    }

    this.DCODE2obj = function(DCODE,hostPCODE)
    {
        var obj_arr = [];

        for(var slotN in this.slots)
        {
            var owner = this.slots[slotN].peripheral;
            if(!owner || (hostPCODE && owner.id?.PCODE != hostPCODE)) continue;

            var devices = Array.isArray(owner.devices) ? owner.devices : [];
            for(var i=0;i<devices.length;i++)
                if(devices[i]?.id?.DCODE == DCODE)
                    obj_arr.push(devices[i]);
        }

        return obj_arr;
    }

    /*
     * Pipe addresses identify one named port on one child device:
     *
     *     <slot>:<DCODE>:<port>
     *
     * The first live connection is:
     *
     *     0:PASTEBO:text  ->  0:A2KBD:text
     *
     * Apple2IO only resolves endpoints and validates their contracts.  Payload
     * interpretation belongs to the destination device.
     */

    function pipeMimeParse(mime)
    {
        var fields = String(mime || "").split(";");
        var base = String(fields.shift() || "").trim().toLowerCase();
        var params = {};

        for(var i=0;i<fields.length;i++)
        {
            var field = fields[i].trim();
            if(!field) continue;

            var eq = field.indexOf("=");
            if(eq<1) continue;

            var key = field.substring(0,eq).trim().toLowerCase();
            var value = field.substring(eq+1).trim();

            if(value.length>=2 &&
               ((value[0]=='"' && value[value.length-1]=='"') ||
                (value[0]=="'" && value[value.length-1]=="'")))
                value = value.substring(1,value.length-1);

            if(key=="charset") value = value.toLowerCase();
            if(key) params[key] = value;
        }

        return {"base":base,"params":params};
    }

    function pipeMimeBase(mime)
    {
        return pipeMimeParse(mime).base;
    }

    function pipeMimeNormalize(mime)
    {
        var parsed = pipeMimeParse(mime);
        if(!parsed.base) return "";

        var keys = Object.keys(parsed.params).sort();
        var out = parsed.base;

        for(var i=0;i<keys.length;i++)
            out += "; "+keys[i]+"="+parsed.params[keys[i]];

        return out;
    }

    function pipeMimeList(port)
    {
        if(!port || port.mime===undefined || port.mime===null) return [];

        var list = Array.isArray(port.mime) ? port.mime : [port.mime];
        var out = [];

        for(var i=0;i<list.length;i++)
        {
            var mime = pipeMimeNormalize(list[i]);
            if(mime) out.push(mime);
        }

        return out;
    }

    function pipeMimeSupported(port,mime)
    {
        var requested = pipeMimeParse(mime);
        if(!requested.base) return false;

        var list = pipeMimeList(port);
        var slash = requested.base.indexOf("/");
        var major = slash>=0
            ? requested.base.substring(0,slash)
            : requested.base;

        for(var i=0;i<list.length;i++)
        {
            var advertised = pipeMimeParse(list[i]);
            var baseMatch =
                   advertised.base=="*/*"
                || advertised.base==requested.base
                || advertised.base==major+"/*";

            if(!baseMatch) continue;

            /*
             * Parameters advertised by a port are constraints. Thus
             * text/plain;charset=us-ascii and text/plain;charset=utf-16le are
             * distinct contracts, while a generic text/plain port can accept
             * either representation.
             */
            var keys = Object.keys(advertised.params);
            var paramsMatch = true;

            for(var k=0;k<keys.length;k++)
            {
                var key = keys[k];
                if(requested.params[key]!==advertised.params[key])
                {
                    paramsMatch = false;
                    break;
                }
            }

            if(paramsMatch) return true;
        }

        return false;
    }

    function pipeBytePayload(data)
    {
        if(data instanceof Uint8Array || data instanceof ArrayBuffer)
            return true;

        if(typeof(ArrayBuffer)!="undefined" &&
           typeof(ArrayBuffer.isView)=="function" &&
           ArrayBuffer.isView(data))
            return true;

        if(Array.isArray(data))
        {
            for(var i=0;i<data.length;i++)
                if(!Number.isFinite(Number(data[i])))
                    return false;
            return true;
        }

        return false;
    }

    function pipeMimeCompatible(port,mime,data)
    {
        if(pipeMimeSupported(port,mime))
            return true;

        /*
         * application/octet-stream denotes a representation-agnostic byte
         * carrier. It may transparently carry a more specific semantic MIME
         * when the actual payload is already bytes; no transcoding occurs.
         *
         * Example:
         *   SPGPT  text/plain; charset=utf-16le
         *      <-> SPSERIAL application/octet-stream
         */
        return (
            pipeBytePayload(data) &&
            pipeMimeSupported(port,"application/octet-stream")
        );
    }

    function pipeDirectionAllows(port,flow)
    {
        var direction = String(port && port.direction || "").toLowerCase();

        if(direction=="duplex") return true;
        if(flow=="in")  return direction=="in"  || direction=="input";
        if(flow=="out") return direction=="out" || direction=="output";

        return false;
    }

    function pipeDevice(owner,DCODE)
    {
        var devices = owner && Array.isArray(owner.devices) ? owner.devices : [];

        for(var i=0;i<devices.length;i++)
            if(String(devices[i]?.id?.DCODE || "").toUpperCase()==DCODE)
                return devices[i];

        return null;
    }

    function pipeDeviceAtSlot(slotAddress,DCODE)
    {
        slotAddress = Number(slotAddress);
        if(!Number.isInteger(slotAddress) || slotAddress<0) return null;

        if(slotAddress==0)
        {
            var board = io.SLOT2obj(0);
            var boardDevice = pipeDevice(board,DCODE);

            if(boardDevice)
                return {
                     "slotIndex":0
                    ,"owner":board
                    ,"device":boardDevice
                };
        }

        var slotIndex = slotAddress + 1;
        var owner = io.SLOT2obj(slotIndex);
        var device = pipeDevice(owner,DCODE);

        return device
            ? {
                 "slotIndex":slotIndex
                ,"owner":owner
                ,"device":device
              }
            : null;
    }

    function pipeEndpointOpen(endpoint)
    {
        if(!endpoint || !endpoint.port) return false;

        var open = endpoint.port.open;

        if(open===undefined || open===null) return true;
        if(typeof(open)=="boolean") return open;

        if(typeof(open)=="string")
        {
            var method = endpoint.device && endpoint.device[open];
            return typeof(method)=="function"
                ? method.call(endpoint.device,endpoint)!==false
                : false;
        }

        if(typeof(open)=="function")
            return open.call(endpoint.device,endpoint)!==false;

        return !!open;
    }

    this.pipeResolve = function(address)
    {
        var match =
            /^(\d+):([A-Za-z0-9_-]+):([A-Za-z0-9_.-]+)$/
            .exec(String(address || "").trim());

        if(!match) return null;

        var slotN = Number(match[1]);
        var DCODE = match[2].toUpperCase();
        var requestedPort = match[3];
        var resolved = pipeDeviceAtSlot(slotN,DCODE);
        if(!resolved) return null;
        
        var owner = resolved.owner;
        var device = resolved.device;

        if(!device.ports) return null;


        var portName = null;
        var requestedLower = requestedPort.toLowerCase();

        for(var name in device.ports)
        {
            if(String(name).toLowerCase()==requestedLower)
            {
                portName = name;
                break;
            }
        }

        if(portName===null) return null;

        return {
             "address":slotN+":"+DCODE+":"+portName
            ,"slotN":slotN
            ,"slotIndex":resolved.slotIndex
            ,"owner":owner
            ,"device":device
            ,"DCODE":DCODE
            ,"portName":portName
            ,"port":device.ports[portName]
        };
    };

    this.pipeIsOpen = function(address)
    {
        return pipeEndpointOpen(this.pipeResolve(address));
    }
    /*
     * Resolve the semantic text-input endpoint that currently owns user text.
     *
     * Motherboard keyboard input is the permanent fallback. An active
     * VideoTerm takes precedence only while its VIDEXTXT:text port is open,
     * which is already tied to the VideoTerm video-selection state.
     *
     * Both pasteboard text and printable host-keyboard characters use this
     * selector so they cannot drift into separate character-mapping rules.
     */
    this.getTextInputTargetAddress = function()
    {
        const fallback = "0:A2KBD:text";

        if(!Array.isArray(this.slots) ||
           typeof(this.SLOT2obj)!="function")
            return fallback;

        for(var slotIndex=1;slotIndex<this.slots.length;slotIndex++)
        {
            var owner = this.SLOT2obj(slotIndex);

            if(!owner ||
               String(owner.id?.PCODE || "").toUpperCase()!="VIDEX")
                continue;

            if(owner.state && owner.state.active===false)
                continue;

            var slotID =
                typeof(this.slot2ID)=="function"
                    ? this.slot2ID(slotIndex)
                    : String(slotIndex-1);

            var address = slotID + ":VIDEXTXT:text";

            if(this.pipeIsOpen(address))
                return address;
        }

        return fallback;
    };

    /*
     * Pipe availability is runtime state, not merely topology. Consumers such
     * as the pasteboard UI can subscribe once and recompute their preferred
     * route whenever a device reports that one of its routing conditions
     * changed.
     */
    var pipeStateListeners = [];

    this.subscribePipeStateChange = function(callback)
    {
        if(typeof(callback)!="function") return function(){};

        pipeStateListeners.push(callback);
        var subscribed = true;

        return function()
        {
            if(!subscribed) return;
            subscribed = false;

            var index = pipeStateListeners.indexOf(callback);
            if(index>=0) pipeStateListeners.splice(index,1);
        };
    };

    this.notifyPipeStateChange = function(change)
    {
        var listeners = pipeStateListeners.slice();

        for(var i=0;i<listeners.length;i++)
        {
            try { listeners[i](change || {}); }
            catch(err)
            {
                console.error("Apple2IO pipe-state listener failed",err);
            }
        }
    };

    this.pipeSend = function(sourceAddress,targetAddress,message)
    {
        var source = this.pipeResolve(sourceAddress);
        var target = this.pipeResolve(targetAddress);

        if(!source || !target)
        {
            console.error(
                "Apple2IO.pipeSend: unresolved pipe endpoint",
                sourceAddress,
                targetAddress
            );
            return false;
        }

        if(!pipeEndpointOpen(source))
        {
            console.error("Apple2IO.pipeSend: source port is closed",source.address);
            return false;
        }

        if(!pipeEndpointOpen(target))
        {
            console.error("Apple2IO.pipeSend: target port is closed",target.address);
            return false;
        }

        if(!pipeDirectionAllows(source.port,"out"))
        {
            console.error("Apple2IO.pipeSend: source port is not an output",source.address);
            return false;
        }

        if(!pipeDirectionAllows(target.port,"in"))
        {
            console.error("Apple2IO.pipeSend: target port is not an input",target.address);
            return false;
        }

        var envelope = Object.assign({},message || {});
        var mime = pipeMimeNormalize(envelope.mime);

        if(!mime)
        {
            var sourceMimes = pipeMimeList(source.port);
            mime = sourceMimes.length ? sourceMimes[0] : "";
        }

        if(!pipeMimeCompatible(source.port,mime,envelope.data) ||
           !pipeMimeCompatible(target.port,mime,envelope.data))
        {
            console.error(
                "Apple2IO.pipeSend: incompatible MIME type",
                mime,
                source.address,
                target.address
            );
            return false;
        }

        envelope.mime = mime;

        var handler = target.port.handler;

        if(typeof(handler)=="string")
            handler = target.device[handler];

        if(typeof(handler)!="function" && typeof(target.device.pipeReceive)=="function")
            handler = target.device.pipeReceive;

        if(typeof(handler)!="function")
        {
            console.error(
                "Apple2IO.pipeSend: target port has no receiver",
                target.address
            );
            return false;
        }

        var result = handler.call(
            target.device,
            envelope,
            {
                 "io":this
                ,"hw":hostHardware
                ,"source":source
                ,"target":target
            }
        );

        return result===undefined ? true : result;
    };

    /*
     * Pull one current payload from an output endpoint and route it through the
     * normal pipeSend() validation/delivery path.
     *
     * Pull-capable output ports publish:
     *
     *     provider: "methodName"
     *
     * The provider may return a complete message envelope ({mime,data,...}) or
     * raw data. Raw data is wrapped using the first MIME advertised by source.
     */
    this.pipeTransfer = function(sourceAddress,targetAddress,request)
    {
        var source = this.pipeResolve(sourceAddress);
        var target = this.pipeResolve(targetAddress);

        if(!source || !target)
        {
            console.error(
                "Apple2IO.pipeTransfer: unresolved pipe endpoint",
                sourceAddress,
                targetAddress
            );
            return false;
        }

        if(!pipeEndpointOpen(source))
        {
            console.error("Apple2IO.pipeTransfer: source port is closed",source.address);
            return false;
        }

        if(!pipeEndpointOpen(target))
        {
            console.error("Apple2IO.pipeTransfer: target port is closed",target.address);
            return false;
        }

        if(!pipeDirectionAllows(source.port,"out"))
        {
            console.error("Apple2IO.pipeTransfer: source port is not an output",source.address);
            return false;
        }

        if(!pipeDirectionAllows(target.port,"in"))
        {
            console.error("Apple2IO.pipeTransfer: target port is not an input",target.address);
            return false;
        }

        var provider = source.port.provider;

        if(typeof(provider)=="string")
            provider = source.device[provider];

        if(typeof(provider)!="function")
        {
            console.error(
                "Apple2IO.pipeTransfer: source port has no provider",
                source.address
            );
            return false;
        }

        var produced = provider.call(
            source.device,
            request || {},
            {
                 "io":this
                ,"hw":hostHardware
                ,"source":source
                ,"target":target
            }
        );

        if(produced===undefined || produced===null || produced===false)
            return false;

        var envelope;

        if(produced &&
           typeof(produced)=="object" &&
           !Array.isArray(produced) &&
           produced.mime!==undefined)
        {
            envelope = Object.assign({},produced);
        }
        else
        {
            var sourceMimes = pipeMimeList(source.port);
            envelope = {
                 "mime":sourceMimes.length ? sourceMimes[0] : ""
                ,"data":produced
            };
        }

        return this.pipeSend(sourceAddress,targetAddress,envelope)
            ? envelope
            : false;
    };

    function emptyActionMap()
    {
        return {"WR":{},"RD":{},"RR":{},"SV":{},"VA":{},"BT":{},"RG":{}};
    }

    function unmapPeripheralActions(peripheral_obj)
    {
        var ranges = peripheral_obj && peripheral_obj.mount ? peripheral_obj.mount.ranges || {} : {};
        var actions = peripheral_obj && peripheral_obj.action ? peripheral_obj.action : {};
        var bindings = [
             ["HostROM","RD"]
            ,["HostROM","WR"]
            ,["SlotROM","RD"]
            ,["SlotROM","WR"]
            ,["SlotIO","RD"]
            ,["SlotIO","WR"]
            ,["HostIO","RD"]
            ,["HostIO","WR"]
        ];

        for(var b=0;b<bindings.length;b++)
        {
            var rangeName = bindings[b][0];
            var op = bindings[b][1];
            var range = ranges[rangeName];
            var action = actions[rangeName] && actions[rangeName][op];
            var callback = action && action.callback;

            if(!range || typeof(callback)!="function") continue;

            for(var addr=range.from;addr<=range.to;addr++)
                if(CIO.ACTION_MAP[op][addr] === callback)
                    delete CIO.ACTION_MAP[op][addr];
        }
    }


    function unmapAttachedActions(entry)
    {
        var bindings = entry && Array.isArray(entry.bindings) ? entry.bindings : [];

        for(var i=0;i<bindings.length;i++)
        {
            var binding = bindings[i];
            var map = CIO.ACTION_MAP[binding.op];
            if(!map || map[binding.addr] !== binding.callback) continue;

            if(typeof(binding.previous)=="function") map[binding.addr] = binding.previous;
            else delete map[binding.addr];
        }

        if(entry) entry.bindings = [];
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

        const ctx2 =
        {
            //"keys": keys,
            //"snd": snd,
            "vid": vid,
            "io": this,
            "bRO": (typeof(apple2plus) == "object" && apple2plus && apple2plus.hwObj().bRO === true),
            "rel_addr": rel_addr,
            "line": line,
            "abs_addr": 0xC000 + rel_addr
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

        const ctx2 =
        {
            //"keys": keys,
            //"snd": snd,
            "vid": vid,
            "io": this,
            "bRO": (typeof(apple2plus) == "object" && apple2plus && apple2plus.hwObj().bRO === true),
            "rel_addr": rel_addr,
            "line": line,
            "abs_addr": 0xC000 + rel_addr
        };

        var fn = CIO.ACTION_MAP.WR[line];

        /*
        * Empty-bus WR fillers must not hide a peripheral's dynamic HostROM
        * write handler or an RD-style soft-switch fallback.
        */
        if(fn && fn._ioEmpty!==true)
            return fn(rel_addr-line,d8,ctx2);

        /*
         * $C800-$CFFF is a shared expansion window. Its write target must follow
         * the same Hslot owner as its read target; permanently installing one
         * card's HostROM.WR callback would become stale as soon as another card
         * claims C8 space.
         *
         * Peripheral mount.slotN uses RetroAppleJS' internal +1 convention while
         * ACTION_MAP.Hslot stores the real Apple slot number, hence +1 here.
         */
        if(line>=0x800 && line<=0xF00 &&
           CIO.ACTION_MAP.Hslot!==null &&
           CIO.ACTION_MAP.Hslot!==undefined)
        {
            var hostOwner = this.SLOT2obj(Number(CIO.ACTION_MAP.Hslot)+1);
            var hostWrite =
                hostOwner &&
                hostOwner.action &&
                hostOwner.action.HostROM &&
                hostOwner.action.HostROM.WR;

            if(hostWrite && typeof(hostWrite.callback)=="function")
                return hostWrite.callback(rel_addr-line,d8,ctx2);
        }

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
        if(rd && rd._ioEmpty!==true) return rd(rel_addr-line,ctx2);

        /*
        * Nothing real handled the write. Use the installed empty-WR callback
        * now, so diagnostics remain unchanged for genuinely unmapped writes.
        */
        if(fn) return fn(rel_addr-line,d8,ctx2);
        if(!ctx2.bRO) console.warn("CIO.ACTION_MAP.WR["+oCOM.getHexWord(line)+"] I/O call out of bounds (0x"+oCOM.getHexWord(line+0xC000)+")");

        return 0x00;
    }

    // CPU-tick hook for devices that need sub-cycle sampling, such as the speaker.
    this.tick = function(n)
    {
        clockTicks++;
        for(var i=0;i<tickCallbacks.length;i++)
            tickCallbacks[i](n);
    }

    this.getClockTicks = function()
    {
        return clockTicks;
    }

    // Processing-cycle hook, called once after the configured CPU-tick group.
    this.cycle = function()
    {
        for(var i=0;i<cycleCallbacks.length;i++)
            cycleCallbacks[i]();



        /*
         * Mounted peripherals with slow independent timing domains (UARTs,
         * timers, etc.) can synchronize once per processing slice as well as
         * lazily on their own register accesses.  Passing the absolute counter
         * avoids loss of time when processing slices are shortened by turbo
         * host-capacity limits.
         */
        for(var slotN in this.slots)
        {
            var peripheral = this.slots[slotN] && this.slots[slotN].peripheral;
            if(peripheral && typeof(peripheral.syncClock)=="function")
                peripheral.syncClock(clockTicks);
        }
    }

    this.attach = function(owner,device_info,options)
    {
        if(!owner || !owner.id?.PCODE || !device_info || !device_info.coID) return null;

        options=options || {};
        var newInstance=options.newInstance===true;
        var hostPCODE=owner.id.PCODE;
        var dcode=device_info.DCODE || device_info.coID;
        if(device_info.hostPCODE && device_info.hostPCODE != hostPCODE) return null;

        var ownerHash=owner.mount && owner.mount.hash!==undefined
            ? owner.mount.hash
            : hostPCODE;
        var entry=null;
        var key="";
        var device=null;
        var createdInstance=false;

        /*
         * Normal provisioning is idempotent: it reuses the one declarative
         * instance for this owner/device type.  An explicit UI attach requests
         * a new mounted instance instead, even when the DCODE is identical.
         */
        if(!newInstance)
        {
            for(var existingKey in this.attachments)
            {
                var existing=this.attachments[existingKey];
                if(existing && existing.owner===owner &&
                   existing.device?.id?.DCODE===dcode &&
                   existing.explicitInstance!==true)
                {
                    entry=existing;
                    key=existingKey;
                    device=existing.device;
                    break;
                }
            }
        }

        if(entry) unmapAttachedActions(entry);

        if(!device)
        {
            var Device=globalThis[device_info.coID];
            if(typeof(Device)!="function") return null;

            device=new Device(device_info);
            createdInstance=true;
            if(!device.id) device.id={};
            if(device.id.DCODE && device.id.DCODE != dcode) return null;
            if(device.id.hostPCODE && device.id.hostPCODE != hostPCODE) return null;

            /*
             * Device instance identity mirrors peripheral mount identity: a
             * stable 16-bit hash belongs to this mounted object for its lifetime.
             * The registry key includes it, so equal DCODEs do not collide.
             */
            var instanceHash;
            var attempts=0;
            do
            {
                instanceHash=oCOM.crc16(new TextEncoder("utf-8").encode(
                    String(ownerHash)+":"+dcode+":"+Math.random()+":"+attempts
                ));
                key=String(ownerHash)+":"+dcode+":"+instanceHash;
                attempts++;
            }
            while(this.attachments[key] && attempts<65536);

            if(this.attachments[key]) return null;
            entry={
                 "owner":owner
                ,"device":device
                ,"info":device_info
                ,"bindings":[]
                ,"explicitInstance":newInstance
                ,"hash":instanceHash
            };
            this.attachments[key]=entry;
        }

        device.id.DCODE=dcode;
        device.id.hostPCODE=hostPCODE;
        device.id.coID=device_info.coID;
        if(device_info.icon!==undefined) device.id.icon=device_info.icon;
        if(device_info.description!==undefined) device.id.description=device_info.description;
        if(device_info.deviceN!==undefined && device.id.deviceN===undefined)
            device.id.deviceN=Number(device_info.deviceN);

        if(!Array.isArray(owner.devices))
            Object.defineProperty(owner,"devices",{
                 "value":[]
                ,"writable":true
                ,"configurable":true
                ,"enumerable":false
            });
        if(owner.devices.indexOf(device)<0) owner.devices.push(device);

        entry.owner=owner;
        entry.info=device_info;
        entry.bindings=[];

        var attachHash=entry.hash!==undefined
            ? entry.hash
            : device.attach && device.attach.hash!==undefined
                ? device.attach.hash
                : oCOM.crc16(new TextEncoder("utf-8").encode(key));
        entry.hash=attachHash;
        device.attach={
             "hostPCODE":hostPCODE
            ,"ownerHash":ownerHash
            ,"range":device_info.range || "HostIO"
            ,"hash":attachHash
            ,"actions":[]
        };

        if(typeof(device.bindHost)=="function")
        {
            var rollbackHostBind=function()
            {
                if(!createdInstance) return;
                delete io.attachments[key];
                var failedIdx=owner.devices.indexOf(device);
                if(failedIdx>=0) owner.devices.splice(failedIdx,1);
            };
            var hostResult;
            try
            {
                hostResult=device.bindHost(owner);
            }
            catch(e)
            {
                rollbackHostBind();
                throw e;
            }
            if(hostResult===false)
            {
                rollbackHostBind();
                return null;
            }
        }

        if(typeof(device.bindIO)=="function")
            device.bindIO(io);

        var actionMap=device_info.action || {};
        for(var op in actionMap)
        {
            op=String(op).toUpperCase();
            if(!CIO.ACTION_MAP[op]) continue;

            for(var address in actionMap[op])
            {
                var addr=Number(address);
                var handler=actionMap[op][address];
                var method=typeof(handler)=="string"
                    ? device[handler]
                    : (handler && typeof(handler.handler)=="string"
                        ? device[handler.handler]
                        : (handler && handler.callback ? handler.callback : handler));
                var allowReadOnly=!!(
                    handler && typeof(handler)=="object" && handler.readOnly===true
                );

                if(!Number.isInteger(addr) || typeof(method)!="function") continue;

                var callback=function(target,fn,readOnly,writeAction)
                {
                    if(writeAction)
                    {
                        return function(rel_addr,d8,ctx)
                        {
                            if(ctx && ctx.bRO===true && !readOnly) return 0x00;
                            var result=fn.call(target,rel_addr,d8,ctx);
                            return result===undefined ? 0x00 : result;
                        };
                    }

                    return function(rel_addr,ctx)
                    {
                        if(ctx && ctx.bRO===true && !readOnly) return 0x00;
                        var result=fn.call(target,rel_addr,ctx);
                        return result===undefined ? 0x00 : result;
                    };
                }(device,method,allowReadOnly,op=="WR");

                callback._ioReport={
                     "DCODE":dcode
                    ,"hostPCODE":hostPCODE
                    ,"slotTitle":owner.mount ? slotN2name(owner.mount.slotN) : "attached"
                    ,"range":device.attach.range
                    ,"op":op
                    ,"hash":attachHash
                };

                var previous=CIO.ACTION_MAP[op][addr];
                CIO.ACTION_MAP[op][addr]=callback;
                entry.bindings.push({"op":op,"addr":addr,"callback":callback,"previous":previous});
                device.attach.actions.push({"op":op,"addr":addr,"handler":typeof(handler)=="string" ? handler : (handler.handler || method.name || "callback")});
            }
        }

        if(device_info.alias && oEMU.component && oEMU.component.IO)
            Object.defineProperty(oEMU.component.IO,device_info.alias,{
                 "value":device
                ,"writable":true
                ,"configurable":true
                ,"enumerable":false
            });

        Object.defineProperty(device,"_ioRefreshHooks",{
             "value":rebuildDeviceHooks
            ,"writable":true
            ,"configurable":true
            ,"enumerable":false
        });

        Object.defineProperty(device,"_ioPipeStateChanged",{
             "value":function(change)
             {
                 io.notifyPipeStateChange(Object.assign({
                      "type":"device-state"
                     ,"DCODE":device.id?.DCODE || ""
                     ,"instanceID":device.attach?.hash
                 },change || {}));
             }
            ,"writable":true
            ,"configurable":true
            ,"enumerable":false
        });

        rebuildDeviceHooks();

        this.notifyPipeStateChange({
             "type":"attach"
            ,"DCODE":dcode
            ,"hostPCODE":hostPCODE
            ,"instanceID":attachHash
        });

        if(newInstance && typeof(owner.onDeviceTopologyChanged)==="function")
        {
            try
            {
                owner.onDeviceTopologyChanged({
                     "type":"attach"
                    ,"DCODE":dcode
                    ,"device":device
                    ,"instanceID":attachHash
                });
            }
            catch(e) { console.error("Device topology attach notification failed",e); }
        }

        if(bDebug)
            console.log("EMU_apple2io.js - attach(<"+dcode+" #"+oCOM.getHexWord(attachHash)+" to "+hostPCODE+">)");

        return device;
    }

    this.detach = function(owner,DCODE,instanceHash)
    {
        if(!owner) return false;
        var removed = false;

        for(var key in this.attachments)
        {
            var entry = this.attachments[key];
            var device = entry.device;
            if(entry.owner !== owner || (DCODE && device?.id?.DCODE != DCODE)) continue;
            if(instanceHash!==undefined && instanceHash!==null &&
               Number(device?.attach?.hash)!==Number(instanceHash)) continue;

            /*
             * Let a child release any host-owned state before the generic
             * attachment record disappears.  Liron/SmartPort needs this so an
             * ejected UniDisk does not remain resident on the SmartPort bus.
             */
            if(device && typeof(device.unbindHost)=="function")
            {
                try
                {
                    if(device.unbindHost(owner)===false) continue;
                }
                catch(e)
                {
                    console.error("Device host detach failed",e);
                    continue;
                }
            }

            unmapAttachedActions(entry);
            if(entry.info.alias && oEMU.component.IO[entry.info.alias] === device)
                delete oEMU.component.IO[entry.info.alias];

            if(Array.isArray(owner.devices))
            {
                var idx = owner.devices.indexOf(device);
                if(idx>=0) owner.devices.splice(idx,1);
            }

            delete this.attachments[key];
            removed = true;

            if(typeof(owner.onDeviceTopologyChanged)==="function")
            {
                try
                {
                    owner.onDeviceTopologyChanged({
                         "type":"detach"
                        ,"DCODE":device?.id?.DCODE || DCODE || ""
                        ,"device":device
                        ,"instanceID":Number(device?.attach?.hash)
                    });
                }
                catch(e) { console.error("Device topology detach notification failed",e); }
            }
        }

        if(removed)
        {
            rebuildDeviceHooks();
            this.notifyPipeStateChange({
                 "type":"detach"
                ,"DCODE":DCODE || ""
                ,"instanceID":instanceHash===undefined ? null : Number(instanceHash)
            });
        }
        return removed;
    }

    this.detachInstance = function(owner,instanceHash)
    {
        instanceHash=Number(instanceHash);
        if(!owner || !Number.isInteger(instanceHash)) return false;
        return this.detach(owner,null,instanceHash);
    };

    this.unmount = function(slotN)
    {
        slotN = Number(slotN);
        var slot = this.slots[slotN];

        if(!Number.isInteger(slotN) || !slot || slot.lock || !slot.peripheral)
            return false;

        var peripheral_obj = slot.peripheral;
        this.detach(peripheral_obj);

        unmapPeripheralActions(peripheral_obj);

        if(this.MEMORY_MAP && typeof(this.MEMORY_MAP.unmount)=="function")
            this.MEMORY_MAP.unmount(peripheral_obj);

        delete slot.peripheral;
        refillEmptyIOActions();

        if(bDebug)
            console.log("EMU_apple2io.js - unmount(<"+peripheralPCODE(peripheral_obj)+" from "+slotN2name(slotN)+">)");

        return true;
    }

    this.mount = function(cinfo,peripheral_info,slotIdx,slotFit,peripheral_obj)
    {
        var remounting = peripheral_obj != null;
        var slot_info = {};

        if(oEMU.system===undefined) return {"sInfo":slot_info,"pObj":null};
        if(!cinfo || !peripheral_info) return {"sInfo":slot_info,"pObj":null};
        if(!oEMU.system["IORANGES"]) return {"sInfo":slot_info,"pObj":null};
        if(!remounting && typeof(peripheral_info.ctor)!="function")
            return {"sInfo":slot_info,"pObj":null};

        slotIdx = Number(slotIdx);
        if(!Number.isInteger(slotIdx))
            return {"sInfo":slot_info,"pObj":null};

        if(Array.isArray(slotFit) && slotFit.length>0 &&
           slotFit.indexOf(peripheral_info.PCODE)<0)
            return {"sInfo":slot_info,"pObj":null};

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

            // Reuse a live object when moving it; constructing a new one would lose device state.
            if(remounting) unmapPeripheralActions(peripheral_obj);
            else peripheral_obj = new peripheral_info.ctor();
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

                // Keep stable ownership metadata and dynamic mappings during a live move.
                var oldMount = peripheral_obj.mount || {};
                var mountHash = oldMount.hash;
                if(mountHash===undefined)
                    mountHash = oCOM.crc16(new TextEncoder("utf-8").encode(Math.random()));

                peripheral_obj.mount = Object.assign({},oldMount,{
                     "slotN":slotIdx
                    ,"slotFit":slotFit || []
                    ,"ranges":ranges
                    ,"hash":mountHash
                    ,"source":oldMount.source || (cinfo!=null?"COM_CONFIG":"USER")
                });

                //if(slotIdx == 7)
                //    alert("mounted DISKII "+peripheral_obj.mount.hash)

                /*
                if (peripheral_obj.id && peripheral_obj.id.PCODE == "MS16K")  // temporary patch!!!  making sure oEMU.component.IO.RamCard (old) remains in sync with peripheral_obj, so that mem monitoring uses the same object between apple ram updates in EMU_apple2hw.js and ramcard ram updates in EMU_CARD_ramcard.js
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
                    tagActionCallback(_act.HostROM && _act.HostROM.WR, "HostROM", "WR");
                    tagActionCallback(_act.SlotROM && _act.SlotROM.RD, "SlotROM", "RD");
                    tagActionCallback(_act.SlotROM && _act.SlotROM.WR, "SlotROM", "WR");
                    tagActionCallback(_act.SlotIO  && _act.SlotIO.RD,  "SlotIO",  "RD");
                    tagActionCallback(_act.SlotIO  && _act.SlotIO.WR,  "SlotIO",  "WR");
                    tagActionCallback(_act.HostIO  && _act.HostIO.RD,  "HostIO",  "RD");
                    tagActionCallback(_act.HostIO  && _act.HostIO.WR,  "HostIO",  "WR");
                    /*
                     * HostROM.WR is deliberately not installed here: HostROM is a
                     * shared C8 window and write dispatch follows ACTION_MAP.Hslot
                     * dynamically in Apple2IO.write().
                     */
                    if(_bHostROM && _act.HostROM.RD && ranges.HostROM) { for(var i=ranges.HostROM.from;i<=ranges.HostROM.to;i++) CIO.ACTION_MAP.RD[i] = _act.HostROM.RD.callback; }
                    if(_bSlotROM && _act.SlotROM.RD && ranges.SlotROM) { for(var i=ranges.SlotROM.from;i<=ranges.SlotROM.to;i++) CIO.ACTION_MAP.RD[i] = _act.SlotROM.RD.callback; }
                    if(_bSlotROM && _act.SlotROM.WR && ranges.SlotROM) { for(var i=ranges.SlotROM.from;i<=ranges.SlotROM.to;i++) CIO.ACTION_MAP.WR[i] = _act.SlotROM.WR.callback; }
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
                if(remounting) refillEmptyIOActions();
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
        },

        unmount: function(owner)
        {
            var hw = typeof(apple2plus)=="object" && apple2plus
                ? apple2plus.hwObj()
                : null;

            if(!owner || !owner.mount || !hw || !hw.RD || !hw.WR || !hw.default_map)
                return false;

            var hash = owner.mount.hash;
            var mappings = Array.isArray(owner.mount.mappings)
                ? owner.mount.mappings
                : (this.evidence[hash] || []);

            for(var i=0;i<mappings.length;i++)
            {
                var mapping = mappings[i] || {};
                var op = String(mapping.op || "").toUpperCase();
                var from = Number(mapping.from);
                var to = Number(mapping.to);

                if((op!="RD" && op!="WR") || !Number.isFinite(from) || !Number.isFinite(to))
                    continue;

                for(var address=from;address<=to;address+=0x1000)
                {
                    var line = hw.lineDecode(address);
                    hw[op][line] = hw.default_map[op][line];
                }
            }

            delete this.evidence[hash];
            delete this.rules[peripheralPCODE(owner)+":"+hash];
            owner.mount.mappings = [];
            return true;
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

    // SLOT MAPPING
    /*
     * Discover peripheral types from the existing IO containers.
     *
     * _CFG_PSLOT defines which PCODEs are eligible. Merely being present in
     * oEMU.component.IO is not sufficient: the container must expose
     * id.PCODE, and that PCODE must occur in _CFG_PSLOT.
     *
     * The constructor is retained directly. No parallel registry and no
     * globalThis constructor lookup are required.
     */
    this.scanPeripheralContainers = function()
    {
        var discovered = {};

        if(typeof(_CFG_PSLOT)=="undefined" ||
           !oEMU.component ||
           !oEMU.component.IO)
            return discovered;

        for(var coID in oEMU.component.IO)
        {
            var container = oEMU.component.IO[coID];
            var PCODE = container?.id?.PCODE;

            if(!PCODE || !_CFG_PSLOT[PCODE]) continue;
            if(typeof(container.constructor)!="function") continue;
            if(container.constructor===Object) continue;

            var info = Object.assign({},container.id,{
                 "PCODE":PCODE
                ,"coID":coID
                ,"ctor":container.constructor
            });

            if(info.description===undefined)
                info.description = _CFG_PSLOT[PCODE].NAME;

            discovered[PCODE] = info;
        }

        return discovered;
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
        slotN = Number(slotN);

        if(
            !Number.isInteger(slotN) ||
            !this.slots[slotN] ||
            !this.slots[slotN].peripheral
        )
            return null;

        return this.slots[slotN].peripheral;
    }

    this.DeviceName2obj = function(str)
    {

    }

    this.deviceID2obj = function(str,slotN)
    {
        if(typeof str !== "string") return null;

        var DCODE = str.trim().toUpperCase();
        if(!DCODE) return null;

        var slotNumbers = [];
        var requestedSlotN = Number(slotN);

        if(slotN!==undefined && slotN!==null && Number.isInteger(requestedSlotN))
            slotNumbers.push(requestedSlotN);
        else
        {
            for(var mountedSlotN in this.slots)
                if(this.slots[mountedSlotN] && this.slots[mountedSlotN].peripheral)
                    slotNumbers.push(Number(mountedSlotN));
        }

        for(var s=0;s<slotNumbers.length;s++)
        {
            var resolvedSlotN = slotNumbers[s];
            var owner = this.SLOT2obj(resolvedSlotN);
            var devices = owner && Array.isArray(owner.devices) ? owner.devices : [];

            for(var d=0;d<devices.length;d++)
            {
                var device = devices[d];
                var id = device && device.id ? device.id : {};
                var candidate = String(id.DCODE || "").toUpperCase();

                if(candidate!=DCODE) continue;

                var deviceN = Number(id.deviceN);
                if(!Number.isInteger(deviceN)) deviceN = d;

                return {
                     "slotN":resolvedSlotN
                    ,"slotID":this.slot2ID(resolvedSlotN)
                    ,"periID":peripheralPCODE(owner)
                    ,"DCODE":candidate
                    ,"deviceID":candidate
                    ,"deviceN":deviceN
                };
            }
        }

        return null;
    };

    this.obj2deviceID = function(obj)
    {
        if(obj == null) return null;

        if(typeof obj === "string")
            return obj.trim().toUpperCase() || null;

        var DCODE =
               obj.id?.DCODE
            || obj.DCODE
            || obj.deviceID
            || obj.device?.id?.DCODE;

        if(typeof DCODE === "string")
            return DCODE.trim().toUpperCase() || null;

        return null;
    };

    this.deviceN2ID = function(n,PCODE,slotN)
    {
        var owner = Number.isInteger(Number(slotN))
            ? this.SLOT2obj(Number(slotN))
            : this.PCODE2obj(PCODE)[0];
        if(PCODE && peripheralPCODE(owner)!==PCODE) return null;

        var devices = owner && Array.isArray(owner.devices) ? owner.devices : [];
        var deviceN = Number(n);

        for(var i=0;i<devices.length;i++)
        {
            var ordinal = Number(devices[i]?.id?.deviceN);
            if(!Number.isInteger(ordinal)) ordinal = i;
            if(ordinal===deviceN) return this.obj2deviceID(devices[i]);
        }

        return null;
    }

    this.deviceID2N = function(str,PCODE,slotN)
    {
        var ref = this.deviceID2obj(str,slotN);
        return ref && (!PCODE || ref.periID===PCODE) ? ref.deviceN : undefined;
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
      //alert("Move " + ctx.hostId + " peripheral "+periID+" slot " + fromSlotId + "->" + toSlotId);
      //alert("onSlotMove checkpoint: this.slots["+toSlotId+"] = "+JSON.stringify(this.slots[ slotName2n(toSlotId) ]));
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
        if (toSlotId && slotMove(ctx.slots, fromSlotId, toSlotId))
        {
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
                return false;

            var from = getSlotById(slots, fromSlotId);
            var to   = getSlotById(slots, toSlotId);

            if (!from ||
                !to ||
                from.lock ||
                !from.peripheral ||
                to.peripheral)
                return false;

            var peripheral = from.peripheral;
            var pcode = peripheralPCODE(peripheral);
            var discovered = emui.scanPeripheralContainers();
            var pinfo = discovered[pcode] || null;
            var cinfo = typeof(_CFG_PSLOT)!="undefined" ? _CFG_PSLOT[pcode] : null;
            var toSlotN = slotName2n(toSlotId);
            var mounted = emui.mount(
                 cinfo
                ,pinfo
                ,toSlotN
                ,slotR.slotFit ? slotR.slotFit[toSlotN] : []
                ,peripheral

            );
            if(!mounted || !mounted.pObj) return false;

            for(var key in mounted.sInfo) to[key] = mounted.sInfo[key];
            to.peripheral = mounted.pObj;

            var model = typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P";
            emui.provisionPeripheral(mounted.pObj,model);
            refillEmptyIOActions();

            delete from.peripheral;
            return true;
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

    this.slotConfig_refresh = function(slotN)
    {
        slotN=Number(slotN);
        var slot=this.slots[slotN] || {};
        var popup=document.getElementById("slotConfig_popup");
        if(!popup) return false;

        var close="<div class=\"appbut\" onclick=\"oCOM.POPUP.toggle('slotConfig_popup');apple2plus.hwObj().io.deviceConfig_close();\" style=\"text-align:center;float:right;\">x</div>";
        var html=close+slotConfigDetail_html(slot);
        if(slotN==0)
        {
            html += "<div style='overflow-y:scroll;height:350px'>";
            var model=typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P";
            var board=this.SLOT2obj(0);
            html += "<div class='appbox' style='float:none;'>"+(board && typeof(board.boardIO_html)=="function" ? board.boardIO_html(model) : "")+"</div>";
            html += "</div>";
        }
        popup.innerHTML=html;
        return true;
    };

    this.slotConfig_detail = function(slotName)
    {
        var n=slotName2n(slotName);
        this.slotConfig_refresh(n);
        this.deviceConfig_close();
        oCOM.POPUP.toggle("slotConfig_popup");
    }

    this.slotConfig_download = function(slotN)
    {
        slotN = Number(slotN);
        var slot = this.slots[slotN];
        if(!slot) return false;

        try
        {
            var pcode = peripheralPCODE(slot.peripheral) || "slot";
            var slotName = slotN2name(slotN).replace("#","");
            var fileName = (pcode+"_"+slotName).replace(/[^A-Za-z0-9_.-]/g,"_")+".json";
            var json = JSON.stringify(slot,null,2);
            oCOM.Download(fileName,new TextEncoder("utf-8").encode(json));
            return true;
        }
        catch(e)
        {
            console.error("Slot JSON download failed",e);
            return false;
        }
    }

    this.slotConfig_eject = function(slotN)
    {
        slotN = Number(slotN);
        var slot = this.slots[slotN];

        if(!Number.isInteger(slotN) || !slot || slot.lock || !slot.peripheral)
            return false;

        var previous = document.getElementById("slotConfig_eject_confirm");
        if(previous) previous.remove();

        var io = this;
        var peripheral = slot.peripheral;
        var dialog = document.createElement("dialog");
        dialog.id = "slotConfig_eject_confirm";
        dialog.className = "appbox";
        dialog.style.cssText = "max-width:360px;text-align:left;padding:12px";

        var question = document.createElement("div");
        question.style.marginBottom = "12px";
        question.textContent = "Eject "
            + peripheralPCODE(peripheral)
            + " from "
            + slotN2name(slotN)
            + "?";

        var note = document.createElement("div");
        note.style.cssText = "font-size:11px;margin-bottom:12px";
        note.textContent = "The peripheral and its active I/O mappings will be removed.";

        var buttons = document.createElement("div");
        buttons.style.textAlign = "right";

        var noButton = document.createElement("button");
        noButton.type = "button";
        noButton.className = "appbut";
        noButton.textContent = "No";

        var yesButton = document.createElement("button");
        yesButton.type = "button";
        yesButton.className = "appbut";
        yesButton.textContent = "Yes";

        function eraseDialog()
        {
            if(dialog.open && typeof(dialog.close)=="function")
                dialog.close();
            dialog.remove();
        }

        noButton.onclick = eraseDialog;
        dialog.addEventListener("cancel",function(ev)
        {
            ev.preventDefault();
            eraseDialog();
        });

        yesButton.onclick = function()
        {
            var removed = io.unmount(slotN);
            eraseDialog();
            if(!removed) return;

            var detail = document.getElementById("slotConfig_popup");
            if(detail)
            {
                detail.innerHTML = "";
                oCOM.POPUP.off("slotConfig_popup");
            }

            for(var hostId in io.slot_ctx)
                io.slotsRender(hostId);

            if(typeof(io.refreshDeviceToolboxes)=="function")
                io.refreshDeviceToolboxes({"id":"devices"});
        };

        buttons.appendChild(noButton);
        buttons.appendChild(yesButton);
        dialog.appendChild(question);
        dialog.appendChild(note);
        dialog.appendChild(buttons);
        document.body.appendChild(dialog);

        if(typeof(dialog.showModal)=="function") dialog.showModal();
        else dialog.setAttribute("open","");
        return true;
    }

    function slotConfigDetail_html(slot)
    {
        var peripheral = slot && slot.peripheral;
        if(!peripheral)
            return "<div class='appbox' style='margin-top:8px;padding:8px'>No peripheral mounted.</div>";

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
        for(var r=0;r<rows.length;r++) body += mappingRow_html(rows[r]);
        if(!body) body = "<tr><td colspan='4' style='padding:8px'>No mappings registered.</td></tr>";
 
        var slotN = Number(peripheral.mount.slotN);
        var ejectButton = "<button class=\"appbut\" type=\"button\""
            + (slot.lock
                ? " disabled title=\"This peripheral is locked\""
                : " title=\"Eject peripheral\""
                    + " onclick=\"event.stopPropagation();apple2plus.hwObj().io.slotConfig_eject("+slotN+")\"")
            + ">"
            + "<i class=\"fa fa-eject\"></i>"
            + "</button>";
        return "<div class='appbox' style='float:none;width:520px;max-width:80vw;overflow:auto;margin-top:8px;padding:8px'>"
            + "<div><b>"+oCOM.escapeHTML(peripheralPCODE(peripheral))+"</b>"
            + (peripheralDescription(peripheral) ? " &mdash; "+oCOM.escapeHTML(peripheralDescription(peripheral)) : "")
            + " &mdash; " + slotN2name(slot.peripheral.mount.slotN)
            + "&nbsp;<button class=\"appbut\" type=\"button\""
            + " title=\"Download slot JSON\""
            + " onclick=\"event.stopPropagation();apple2plus.hwObj().io.slotConfig_download("+slotN+")\">"
            + "<i class=\"fa fa-cloud-download-alt\"></i></button>"
            + "&nbsp;"+ejectButton
            + "</div>"
            
            + "<table style='width:100%;border-collapse:collapse;margin-top:8px;text-align:left'>"
            + "<thead><tr style='border-bottom:1px solid #888'>"
            + "<th style='padding:4px 6px'>Space</th>"
            + "<th style='padding:4px 6px'>CPU address</th>"
            + "<th style='padding:4px 6px'>I/O offset</th>"
            + "<th style='padding:4px 6px'>R/W</th>"
            + "</tr></thead>"
            + "<tbody>"+body+"</tbody>"
            + "</table>"
            + slotDeviceTable_html(peripheral)
            + "</div>"
    }

    function mappingRow_html(row)
    {
        return ""
            + "<tr>"
            + "<td style='padding:4px 6px'>"+oCOM.escapeHTML(row.space)+"</td>"
            + "<td style='padding:4px 6px'>"+mappingRange_html(row.cpuFrom,row.cpuTo)+"</td>"
            + "<td style='padding:4px 6px'>"+mappingRange_html(row.offsetFrom,row.offsetTo)+"</td>"
            + "<td style='padding:4px 6px'>"+mappingOperations_html(row.operations)+"</td>"
            + "</tr>";
    }

    function mappingRange_html(from,to,digits)
    {
        if(from===undefined || to===undefined) return "&mdash;";
        var range = digits===undefined
            ? fmtRange(from,to,0)
            : "$"+oCOM.getHexMulti(from,digits)+"-$"+oCOM.getHexMulti(to,digits);

        return "<div class=\"appbut skinny\">"+range+"</div>";
    }

    function mappingOperations_html(operations)
    {
        if(!operations || !operations.length) return "&mdash;";

        var html = "<div style='display:flex;gap:3px;white-space:nowrap'>";
        for(var i=0;i<operations.length;i++)
        {
            var operation = operations[i];
            html += "<div class=\"appbut skinny\""
                + (operation.title ? " title=\""+oCOM.escapeHTML(operation.title)+"\"" : "")
                + (operation.enabled===false ? " style=\"opacity:.55\"" : "")
                + ">"+oCOM.escapeHTML(operation.op)+"</div>";
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

    function deviceJSONClone(value,seen)
    {
        if(value===null || value===undefined) return value;
        if(typeof(value)=="string" || typeof(value)=="number" || typeof(value)=="boolean") return value;
        if(typeof(value)=="function" || typeof(value)=="symbol") return undefined;

        if(typeof(ArrayBuffer)!="undefined" && ArrayBuffer.isView && ArrayBuffer.isView(value))
            return Array.from(value);

        seen = seen || [];
        if(typeof(value)=="object")
        {
            if(seen.indexOf(value)>=0) return undefined;
            seen.push(value);

            if(Array.isArray(value))
            {
                var arr=[];
                for(var i=0;i<value.length;i++)
                {
                    var item=deviceJSONClone(value[i],seen);
                    if(item!==undefined) arr.push(item);
                }
                seen.pop();
                return arr;
            }

            var out={};
            for(var key in value)
            {
                var cloned=deviceJSONClone(value[key],seen);
                if(cloned!==undefined) out[key]=cloned;
            }
            seen.pop();
            return out;
        }
        return undefined;
    }

    this.deviceMetadata = function(owner,deviceRef)
    {
        if(!owner) return null;
        var entry=null;
        var device=null;
        var refHash=typeof(deviceRef)==="number" ? deviceRef : NaN;
        var refCode=Number.isInteger(refHash) ? "" : String(deviceRef || "");

        for(var key in this.attachments)
        {
            var candidate=this.attachments[key];
            var candidateDevice=candidate && candidate.device;
            if(!candidate || candidate.owner!==owner || !candidateDevice) continue;

            if(Number.isInteger(refHash))
            {
                if(Number(candidateDevice.attach?.hash)!==refHash) continue;
            }
            else if(refCode && candidateDevice.id?.DCODE!==refCode) continue;

            entry=candidate;
            device=candidateDevice;
            break;
        }
        if(!device) return null;

        var id=device.id || {};
        var state;
        try
        {
            state=typeof(device.getState)=="function"
                ? device.getState()
                : device.state;
        }
        catch(e) { state=undefined; }

        return {
             "DCODE":String(id.DCODE || refCode || "")
            ,"instanceID":Number(device.attach?.hash)
            ,"hostPCODE":String(id.hostPCODE || owner.id?.PCODE || "")
            ,"coID":String(id.coID || entry.info?.coID || "")
            ,"description":String(id.description || entry.info?.description || "")
            ,"id":deviceJSONClone(id) || {}
            ,"config":deviceJSONClone(entry.info || {}) || {}
            ,"attachment":deviceJSONClone(device.attach || {}) || {}
            ,"ports":deviceJSONClone(device.ports || {}) || {}
            ,"state":deviceJSONClone(state)
        };
    };

    function devicePopupElement()
    {
        var popup=document.getElementById("deviceConfig_popup");
        if(popup) return popup;

        popup=document.createElement("div");
        popup.id="deviceConfig_popup";
        popup.className="appbox";
        popup.hidden=true;
        popup.style.cssText="position:fixed;z-index:6;width:360px;max-width:42vw;padding:8px;text-align:left";
        (document.getElementById("feature_box") || document.body).appendChild(popup);
        return popup;
    }

    function positionDevicePopup(popup)
    {
        var host=document.getElementById("slotConfig_popup");
        if(!popup || !host || typeof(host.getBoundingClientRect)!="function") return;
        var rect=host.getBoundingClientRect();
        var gap=8;
        var width=360;
        var left=rect.right+gap;
        if(typeof(window)!="undefined" && left+width>window.innerWidth-gap)
            left=Math.max(gap,rect.left-width-gap);
        popup.style.left=Math.round(left)+"px";
        popup.style.top=Math.max(gap,Math.round(rect.top))+"px";
    }

    function devicePickerAnchorID(slotN)
    {
        return "device_add_"+Number(slotN);
    }

    function devicePickerAnchor(slotN,active)
    {
        var anchor=document.getElementById(devicePickerAnchorID(slotN));
        if(!anchor) return;
        anchor.style.background=active ? "rgba(255,255,0,.5)" : "";
        anchor.setAttribute("aria-expanded",active ? "true" : "false");
    }

    function clearDevicePickerAnchors()
    {
        var anchors=document.querySelectorAll("[id^='device_add_']");
        for(var i=0;i<anchors.length;i++)
        {
            anchors[i].style.background="";
            anchors[i].setAttribute("aria-expanded","false");
        }
    }

    this.deviceConfig_close = function()
    {
        var popup=document.getElementById("deviceConfig_popup");
        clearDevicePickerAnchors();
        if(!popup) return false;
        popup.hidden=true;
        popup.innerHTML="";
        popup.removeAttribute("data-mode");
        popup.removeAttribute("data-slot");
        return true;
    };

    this.devicePicker_message = function(text)
    {
        var el=document.getElementById("devicePicker_message");
        if(!el) return false;
        el.textContent=String(text || "");
        el.hidden=!text;
        return true;
    };

    this.devicePicker_entries = function(owner)
    {
        var out=[];
        var cfg=owner && Array.isArray(owner.deviceConfig) ? owner.deviceConfig : [];
        var pcode=owner && owner.id ? owner.id.PCODE : "";
        for(var i=0;i<cfg.length;i++)
        {
            var info=cfg[i];
            if(!info || (info.hostPCODE && info.hostPCODE!==pcode)) continue;
            out.push(info);
        }
        return out;
    };

    this.devicePicker_popup = function(slotN)
    {
        slotN=Number(slotN);
        var owner=this.SLOT2obj(slotN);
        if(!owner) return false;

        var popup=devicePopupElement();
        if(!popup.hidden && popup.getAttribute("data-mode")==="picker" &&
           Number(popup.getAttribute("data-slot"))===slotN)
        {
            this.deviceConfig_close();
            return true;
        }

        this.deviceConfig_close();
        var entries=this.devicePicker_entries(owner);
        var pcode=peripheralPCODE(owner) || owner.id?.PCODE || "PERIPHERAL";
        var description=peripheralDescription(owner);
        var slotTitle=slotN2name(slotN);
        var html="<button class='appbut' type='button' style='float:right' title='Close' aria-label='Close device picker' onclick=\"apple2plus.hwObj().io.deviceConfig_close()\">x</button>";
        html += "<div style='padding-right:28px'><b>ADD DEVICE TO "+oCOM.escapeHTML(pcode)+"</b> &mdash; "+oCOM.escapeHTML(slotTitle)+"</div>";
        if(description)
            html += "<div style='margin-top:2px;opacity:.75'>"+oCOM.escapeHTML(description)+"</div>";
        html += "<div id='devicePicker_message' role='status' hidden style='margin-top:8px;padding:6px'></div>";
        html += "<div style='margin-top:10px;display:flex;flex-direction:column;gap:4px'>";

        if(!entries.length)
            html += "<div class='appbox' style='float:none;padding:8px'>No compatible devices declared.</div>";
        else
        {
            for(var i=0;i<entries.length;i++)
            {
                var info=entries[i];
                var dcode=String(info.DCODE || info.coID || "device");
                var devices=Array.isArray(owner.devices) ? owner.devices : [];
                var attachedCount=0;
                for(var d=0;d<devices.length;d++)
                    if(devices[d]?.id?.DCODE===dcode) attachedCount++;

                var ctor=globalThis[info.coID];
                var available=typeof(ctor)==="function";
                var state=available
                    ? (attachedCount ? "Add another · Attached: "+attachedCount : "Available")
                    : "Unavailable";
                var title=info.description || dcode;
                if(attachedCount) title += " — "+attachedCount+" attached";
                if(typeof(ctor)!=="function") title += " — device constructor unavailable";

                html += "<button class='appbut label device-picker-entry"+(available ? "" : " greyed")+"' type='button'"
                    + " style='width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 8px;text-align:left;cursor:"+(available ? "pointer" : "default")+";'"
                    + " title='"+oCOM.escapeHTML(title)+"'"
                    + (available
                        ? " onclick=\"event.stopPropagation();apple2plus.hwObj().io.devicePicker_select("+slotN+",'"+dcode+"')\""
                        : " disabled aria-disabled='true'")
                    + ">"
                    + "<span style='min-width:0'>"
                    + "<span style='white-space:nowrap'><i class='"+slotDeviceIconClass(info.icon)+"'></i>&nbsp;<b>"+oCOM.escapeHTML(dcode)+"</b></span>"
                    + (info.description ? "<br><span style='font-size:90%;opacity:.78'>"+oCOM.escapeHTML(info.description)+"</span>" : "")
                    + "</span>"
                    + "<span style='white-space:nowrap'>"
                    + (available ? "<i class='fa fa-plus'></i>&nbsp;" : "")
                    + oCOM.escapeHTML(state)
                    + "</span>"
                    + "</button>";
            }
        }
        html += "</div>";

        popup.innerHTML=html;
        popup.setAttribute("data-mode","picker");
        popup.setAttribute("data-slot",String(slotN));
        popup.hidden=false;
        devicePickerAnchor(slotN,true);
        positionDevicePopup(popup);
        return true;
    };

    this.devicePicker_select = function(slotN,DCODE)
    {
        slotN=Number(slotN);
        DCODE=String(DCODE || "");
        var owner=this.SLOT2obj(slotN);
        if(!owner || !DCODE)
        {
            this.devicePicker_message("Could not attach device: invalid target.");
            return false;
        }

        var entries=this.devicePicker_entries(owner);
        var info=null;
        for(var i=0;i<entries.length;i++)
            if(String(entries[i].DCODE || entries[i].coID || "")===DCODE) { info=entries[i]; break; }
        if(!info)
        {
            this.devicePicker_message("Could not attach device: it is not compatible with this peripheral.");
            return false;
        }

        var device=null;
        try
        {
            device=this.attach(owner,info,{"newInstance":true});
        }
        catch(e)
        {
            console.error("Device attach failed",e);
        }

        if(!device)
        {
            this.devicePicker_message("Could not attach device "+DCODE+".");
            return false;
        }

        this.deviceConfig_close();
        this.slotConfig_refresh(slotN);
        this.refreshDeviceToolboxes({"id":"devices","default_slot":this.slot2ID(slotN)});
        return true;
    };

    this.deviceConfig_detail = function(slotN,instanceHash)
    {
        slotN=Number(slotN);
        instanceHash=Number(instanceHash);
        var owner=this.SLOT2obj(slotN);
        var metadata=this.deviceMetadata(owner,instanceHash);
        if(!owner || !metadata) return false;

        var popup=devicePopupElement();
        var description=metadata.description || "";
        var instanceLabel="#"+oCOM.getHexWord(metadata.instanceID);
        var html="<button class='appbut' type='button' style='float:right' title='Close' onclick=\"apple2plus.hwObj().io.deviceConfig_close()\">x</button>"
            + "<div style='padding-right:28px'><b>"+oCOM.escapeHTML(metadata.DCODE)+" "+instanceLabel+"</b>"
            + (description ? "<br>"+oCOM.escapeHTML(description) : "")
            + "</div><div style='margin-top:10px'>"
            + "<button class='appbut' type='button' title='Download device JSON' onclick=\"event.stopPropagation();apple2plus.hwObj().io.deviceConfig_download("+slotN+","+metadata.instanceID+")\"><i class='fa fa-cloud-download-alt'></i></button>&nbsp;"
            + "<button class='appbut' type='button' title='Detach device' onclick=\"event.stopPropagation();apple2plus.hwObj().io.deviceConfig_eject("+slotN+","+metadata.instanceID+")\"><i class='fa fa-eject'></i></button>"
            + "</div>";

        popup.innerHTML=html;
        popup.hidden=false;
        positionDevicePopup(popup);
        return true;
    };

    this.deviceConfig_download = function(slotN,instanceHash)
    {
        slotN=Number(slotN);
        instanceHash=Number(instanceHash);
        var owner=this.SLOT2obj(slotN);
        var metadata=this.deviceMetadata(owner,instanceHash);
        if(!metadata) return false;
        try
        {
            var name=(metadata.DCODE+"_"+oCOM.getHexWord(metadata.instanceID)+"_"+slotN2name(slotN).replace("#","")).replace(/[^A-Za-z0-9_.-]/g,"_")+".json";
            var json=JSON.stringify(metadata,null,2);
            oCOM.Download(name,new TextEncoder("utf-8").encode(json));
            return true;
        }
        catch(e)
        {
            console.error("Device JSON download failed",e);
            return false;
        }
    };

    this.deviceConfig_eject = function(slotN,instanceHash)
    {
        slotN=Number(slotN);
        instanceHash=Number(instanceHash);
        var owner=this.SLOT2obj(slotN);
        if(!owner || !Number.isInteger(instanceHash)) return false;
        if(!this.detachInstance(owner,instanceHash)) return false;

        this.deviceConfig_close();
        this.slotConfig_refresh(slotN);
        this.refreshDeviceToolboxes({"id":"devices","default_slot":this.slot2ID(slotN)});
        return true;
    };

    /*
     * Render the live child devices attached to one peripheral.
     *
     * Use peripheral.devices rather than deviceConfig: Apple2IO.attach()
     * populates peripheral.devices only after a child device was actually
     * instantiated and attached.
     */
    function slotDeviceTable_html(peripheral)
    {
        var devices = peripheral && Array.isArray(peripheral.devices)
            ? peripheral.devices
            : [];
        var body = "";

        for(var i=0;i<devices.length;i++)
        {
            var device = devices[i];
            if(!device) continue;

            body += ""
                + "<tr>"
                + "<td style='padding:4px 6px;vertical-align:top'>"
                + slotDeviceLabel_html(peripheral,device)
                + "</td>"
                + "<td style='padding:4px 6px;vertical-align:top;white-space:nowrap'>"
                + deviceInstanceLabel_html(device)
                + "</td>"
                + "<td style='padding:4px 6px;vertical-align:top'>"
                + slotDevicePorts_html(device)
                + "</td>"
                + "</tr>";
        }

        if(!body)
            body = "<tr><td colspan='3' style='padding:8px'>No devices attached.</td></tr>";

        var slotN=peripheral && peripheral.mount ? Number(peripheral.mount.slotN) : -1;
        var declaredDevices=io.devicePicker_entries(peripheral);
        var canPick=declaredDevices.length>0;
        var addDevice = Number.isInteger(slotN) && slotN>=0
            ? "<div style='margin-top:10px;margin-bottom:3px'>"
                + "<button class='slot-add' type='button' id='"+devicePickerAnchorID(slotN)+"'"
                + " aria-label='Attach device' aria-haspopup='dialog' aria-expanded='false'"
                + " title='"+(canPick ? "Attach device" : "No compatible devices declared")+"'"
                + (canPick
                    ? " onclick=\"event.stopPropagation();apple2plus.hwObj().io.devicePicker_popup("+slotN+")\""
                    : " disabled")
                + "><i class='fa fa-plus dots dots1'></i></button></div>"
            : "";

        return addDevice
            + "<table style='width:100%;border-collapse:collapse;margin-top:0px;text-align:left'>"
            + "<thead><tr style='border-bottom:1px solid #888'>"
            + "<th style='padding:4px 6px'>Device</th>"
            + "<th style='padding:4px 6px'>Instance</th>"
            + "<th style='padding:4px 6px'>Ports</th>"
            + "</tr></thead>"
            + "<tbody>"+body+"</tbody>"
            + "</table>";
    }

    /*
     * Match the labels used by Peripheral controls: appbut + label,
     * pictogram, DCODE and description/range in the tooltip.
     */
    function slotDeviceLabel_html(peripheral,device)
    {
        var id=device && device.id ? device.id : {};
        var deviceCode=String(
            id.DCODE ||
            id.coID ||
            (device && device.constructor && device.constructor.name) ||
            "device"
        );
        var description=id.description ? String(id.description) : "";
        var icon=slotDeviceIconClass(id.icon);
        var instanceHash=Number(device && device.attach ? device.attach.hash : NaN);

        return ""
            + "<div class='appbut label'"
            + " data-dcode='"+oCOM.escapeHTML(deviceCode)+"'"
            + (Number.isInteger(instanceHash) ? " data-instance='"+instanceHash+"'" : "")
            + " style='display:inline-block;cursor:pointer;white-space:nowrap;'"
            + (peripheral && peripheral.mount && Number.isInteger(instanceHash)
                ? " onclick='event.stopPropagation();apple2plus.hwObj().io.deviceConfig_detail("+Number(peripheral.mount.slotN)+","+instanceHash+")'"
                : "")
            + (description
                ? " title=\""+oCOM.escapeHTML(description)+"\""
                : "")
            + ">"
            + "<i class=\""+icon+"\" aria-hidden=\"true\"></i>&nbsp;"
            + oCOM.escapeHTML(deviceCode)
            + "</div>";
    }

    function deviceInstanceLabel_html(device)
    {
        var hash=Number(device && device.attach ? device.attach.hash : NaN);
        return Number.isInteger(hash) ? "#"+oCOM.getHexWord(hash) : "&mdash;";
    }

    /*
     * Font Awesome icon identifiers are CSS class lists such as
     * "fa fa-keyboard".  Do not pass the complete class list through
     * oCOM.escapeHTML(): that helper intentionally converts spaces to
     * &nbsp;, which turns the list into one invalid CSS class token.
     *
     * Instead, accept only ordinary CSS class-name characters in each token
     * and join the validated tokens with real spaces.
     */
    function slotDeviceIconClass(value)
    {
        var tokens = String(value || "fa fa-cube")
            .trim()
            .split(/\s+/)
            .filter(function(token)
            {
                return /^[A-Za-z0-9_-]+$/.test(token);
            });

        return tokens.length ? tokens.join(" ") : "fa fa-cube";
    }

    function slotDevicePorts_html(device)
    {
        var ports = device && device.ports;
        if(!ports || typeof(ports)!="object")
            return "&mdash;";

        var names = Object.keys(ports).filter(function(name)
        {
            var port = ports[name] || {};
            return String(port.visibility || "public").toLowerCase()!="internal";
        });
        if(!names.length)
            return "&mdash;";

        var html = "<div style='display:flex;flex-wrap:wrap;gap:3px'>";

        for(var i=0;i<names.length;i++)
        {
            var name = names[i];
            var port = ports[name] || {};
            var label = slotDevicePortLabel(name,port);
            var description = port.description ? String(port.description) : "";

            html += ""
                + "<div class=\"appbut label\""
                + " style=\"display:inline-block;cursor:default;white-space:nowrap;"
                + "background:rgba(192,192,192,.35);\""
                + (description
                    ? " title=\""+oCOM.escapeHTML(description)+"\""
                    : "")
                + ">"
                + oCOM.escapeHTML(label)
                + "</div>";
        }

        return html+"</div>";
    }

    function slotDevicePortLabel(name,port)
    {
        port = port || {};

        /*
         * Structured bus/device ports provide their own human-facing label and
         * runtime instance selector.  Keep transport details such as protocol,
         * direction and MIME metadata available in JSON without crowding the
         * compact Device-table chip.
         */
        if(port.label!==undefined || port.unit!==undefined)
        {
            var label = port.label===undefined || port.label===null || String(port.label)===""
                ? String(name)
                : String(port.label);
            var structured = [label];
            if(port.unit!==undefined && port.unit!==null && port.unit!=="")
                structured.push("Unit "+String(port.unit));
            return structured.join(" · ");
        }

        /* Legacy port metadata keeps its existing direction/MIME rendering. */
        var parts = [String("<b>"+name+"</b>")];

        if(port.direction)
            parts.push(String(port.direction.toUpperCase()));

        if(port.mime)
        {
            var mime = Array.isArray(port.mime)
                ? port.mime.join(", ")
                : String(port.mime);
            if(mime) parts.push(mime);
        }

       return parts.join("·");
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

        return oCOM.escapeHTML(
            name == "(anonymous)"
                ? name
                : name+"()"
        );
    }

    /////////////////////////////////////////////////////////////////



    this.slotPicker_popup = function(ctx, slotTitle) 
    {
        var popupId = "slotConfig_popup";
        var anchorId = "d_slot_" + ctx.hostId + "_" + slotTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
        document.getElementById(anchorId).style = "background:rgba(255, 255, 0, 0.5); border-radius:10px"
        
        var close   = "<button class='appbut' style='float:right' onclick=\"oCOM.POPUP.toggle('" + popupId + "');document.getElementById('"+anchorId+"').style=''\">x</button>";
        var html = "";
        
        html += "<div style=\"float:left\">ADD PERIPHERAL</div>";
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

        var slotN = slotName2n(slotTitle);
        var targetSlot = io.slots[slotN];
        var slotFit = slotR.slotFit && Array.isArray(slotR.slotFit[slotN])
            ? slotR.slotFit[slotN]
            : [];
        var names = io.scanPeripheralContainers();
        var pcodes = Object.keys(names).sort();
        
        html += "<div style='display:flex;flex-wrap:wrap;gap:2px'>";

        for(var i=0;i<pcodes.length;i++)        
        {
            var id = names[pcodes[i]];
            var cinfo = typeof(_CFG_PSLOT)!="undefined" ? _CFG_PSLOT[id.PCODE] : null;
            var compatible = slotFit.indexOf(id.PCODE)>=0;
            var addable = !!(
                targetSlot &&
                !targetSlot.lock &&
                !targetSlot.peripheral &&
                id.slotLock!==true &&
                compatible &&
                cinfo
            );
            var title = id.description || id.PCODE;

            if(id.slotLock===true)
                title += " — fixed peripheral";
            else if(!compatible)
                title += " — not compatible with "+slotTitle;

            html += "<div class='appbut label"+(addable ? "" : " greyed")+"'"
                +" style='cursor:default;white-space:nowrap;'"
                +" title='"+oCOM.escapeHTML(title)+"'>"
                +"<button class='appbut skinny' type='button'"
                +(addable
                    ? " title='Add to "+slotTitle+"' onclick=\"event.stopPropagation();apple2plus.hwObj().io.slotPicker_select('" + ctx.hostId + "','" + slotTitle + "','" + id.PCODE + "')\""
                    : " disabled")
                +"><i class='fa fa-plus'></i></button>&nbsp;"
                +"<i class='" + (id.icon || "fa fa-cube") + "'></i>&nbsp;"
                +oCOM.escapeHTML(id.PCODE)
                +"</div>";
        }
        html += "</div>";

        

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
        if (!slot || slot.lock || slot.peripheral) return false;

        var io = oEMU.component.IO.self;
        var discovered = io ? io.scanPeripheralContainers() : {};
        var id = discovered[pcode] || null;
        
        var cinfo = typeof(_CFG_PSLOT) !== "undefined" && _CFG_PSLOT[pcode] ? _CFG_PSLOT[pcode] : null;
        var slotN = slotName2n(slotTitle);
        var slotFit = slotR.slotFit && Array.isArray(slotR.slotFit[slotN])
            ? slotR.slotFit[slotN]
            : [];
        if(!id || !cinfo || id.slotLock===true || slotFit.indexOf(pcode)<0)
            return false;

        var o = io.mount(cinfo,id,slotN,slotFit);
        if(!o || !o.pObj) return false;

        for(var so in o.sInfo) slot[so] = o.sInfo[so];
        slot.peripheral = o.pObj;

        var model = typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P";
        io.provisionPeripheral(o.pObj,model);
        refillEmptyIOActions();

        if(typeof(o.pObj.restart)=="function")
            o.pObj.restart();

        oCOM.POPUP.toggle("slotConfig_popup");
        this.slotsRender(hostId);

        if(typeof(this.refreshDeviceToolboxes)=="function")
            this.refreshDeviceToolboxes({"id":"devices"});

        return true;
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
        var slots = [];
        for(var slotN=0;slotN<this.slots.length;slotN++)
        {
            if(this.SLOT2obj(slotN))
                slots.push(this.slot2ID(slotN));
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
            var slotN = slotID2n(s);
            var peripheral = this.SLOT2obj(slotN);
            var pcode = peripheralPCODE(peripheral);
            var instance = peripheral && peripheral.mount ? peripheral.mount.hash : "";
            var deviceCodes = [];
            var devices = peripheral && Array.isArray(peripheral.devices)
                ? peripheral.devices
                : [];

            for(var d=0;d<devices.length;d++)
            {
                var id = devices[d] && devices[d].id;
                if(id && id.DCODE) deviceCodes.push(String(id.DCODE));
            }

            sig.push(String(s)+":"+pcode+":"+instance+":"+deviceCodes.join(","));
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

    this.showDeviceTool = function(slot)
    {
        var all = document.querySelectorAll("[id^='device_tool_']");
        for(var i=0;i<all.length;i++)
            all[i].hidden = true;

        if(slot == null) return;

        var el = document.getElementById("device_tool_" + (slot==="H" ? "H" : slot));
        if(el) el.hidden = false;
    }

    this.deviceToolSlotHTML = function(slotID)
    {
        var slotN = slotID2n(slotID);

        var peripheral = this.SLOT2obj(slotN);
        var pcode = peripheralPCODE(peripheral);
        var model = typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P";
        var ctx =
        {
             "io":this
            ,"peripheral":peripheral
            ,"slotN":slotN
            ,"slotID":slotID
            ,"model":model
            ,"toolboxID":"device_tool_"+slotID
            ,"devices":peripheral && Array.isArray(peripheral.devices)
                ? peripheral.devices
                : []
        };

        if(peripheral && typeof(peripheral.deviceToolSlotHTML)=="function")
        {
            try
            {
                var html = peripheral.deviceToolSlotHTML(ctx);
                if(typeof(html)=="string" && html.length>0) return html;
            }
            catch(e)
            {
                console.error(
                    "Peripheral toolbox failed for "+(pcode || slotID),
                    e
                );
            }
         }
 
        var label = pcode || "EMPTY";
        var description = peripheralDescription(peripheral);


        return ""
            + "<div class=toolbox id=\"device_tool_"+slotID+"\" hidden>"
            + "  <div class=appbox style=\"text-align:left;height:63px;padding:0px 6px 0px 6px;\">"
            + "    <b>#"+slotID+" "+oCOM.escapeHTML(label)+"</b><br>"
            +      (description ? oCOM.escapeHTML(description)+"<br>" : "")
            + "    No toolbox is available yet."
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
        return "$"+(base+from).toString(16).toUpperCase()+"-$"+(base+to).toString(16).toUpperCase();
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
