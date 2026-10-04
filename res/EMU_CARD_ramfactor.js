// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
// EMU_CARD_ramfactor.js — Applied Engineering RAMFactor, default 8 MB.
// Include from index.html: <script src="res/EMU_CARD_ramfactor.js"></script>
// Replace the RAMFACTOR entry in _CFG_PSLOT (res/COM_CONFIG.js) with:
// ,"RAMFAC":{"NAME":"AE RAMFactor 8 MB", "HostIO":"", "SlotIO":"X",
// "SlotROM":"X", "HostROM":"X", "SLOTrange":"1,2,3,4,5,6,7",
// "SYScode":"A2,A2P,A2e", "Manuals":"[user_manual](https://garrettsworkshop.com/files/GR8RAM/ae_ramfactor_manual.pdf)"}
// Registers, not language-card banking; no interception of $D000-$FFFF.
// Raw uploads start at physical $000000, preserve the remaining RAM, and are
// not DOS .dsk/.do images. Cold power cycling/ejection creates a fresh card;
// reset/restart preserves RAM. Constructor optionally accepts installed bytes
// (256 KB, 512 KB, 1 MB, 2 MB, 4 MB or 8 MB).
// Hardware reference: AE RAMFactor User's Manual, chapter 6.
// Firmware dump: https://github.com/whscullin/apple2js/blob/main/js/roms/cards/ramfactor.ts
// Original ROM copyright (c) 1986-89 Applied Engineering; Bob Sander-Cederlof,
// Michael Wilks and Steven Malechek. Dump distributed by apple2js under this license:
/*
The MIT License (MIT)

Copyright (c) 2010-2021 Will Scullin and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

if(oEMU===undefined) var oEMU = {"component":{"IO":{}}};
oEMU.component.IO.RAMFactor = new RAMFactor();

function RAMFactor(installedBytes)
{
    this.id = {"PCODE":"RAMFAC", "icon":"fa fa-microchip"};
    this.state = {"active":true, "registersEnabled":false, "address":0, "firmwareBank":0};
    this.action = {
        "SlotIO":{
            "RD":{"callback":function(addr,ctx) { return card.readSlotIO(addr,ctx); }},
            "WR":{"callback":function(addr,d8,ctx) { return card.writeSlotIO(addr,d8,ctx); }}
        },
        "SlotROM":{
            "RD":{"callback":function(addr,ctx) { return card.readROM(addr,ctx); }},
            "WR":{"callback":function(addr,d8,ctx) { return card.writeROM(addr,d8,ctx); }}
        },
        "HostROM":{
            "RD":{"callback":function(addr,ctx) { return card.readHostROM(addr,ctx); }},
            "WR":{"callback":function(addr,d8,ctx) { return card.writeHostROM(addr,d8,ctx); }}
        }
    };

    const MAX_SIZE = 0x800000;
    const CELL_BITS = 15; // 32768 physical bytes/cell: 256 cells for 8 MB.
    const CELL_SIZE = 1<<CELL_BITS;
    const TOTAL_SIZE = installedBytes===undefined ? MAX_SIZE : Number(installedBytes);
    if([0x40000,0x80000,0x100000,0x200000,0x400000,MAX_SIZE].indexOf(TOTAL_SIZE)<0)
        throw new RangeError("RAMFactor size must be 256 KB, 512 KB, 1 MB, 2 MB, 4 MB or 8 MB");
    this.capacity = TOTAL_SIZE;
    var RAMCARD_MEM = new Uint8Array(TOTAL_SIZE);
    var card = this;
    var hw, io;
    var loadGeneration = 0;
    var fileReader = null;
    this.mem_mon = {};
    this.bMEM_monitoring = false;
    this.MEM_grid = null;
    this.MEM_refresh_id = null;

    // One immutable 8 KB firmware image is shared by live instances.
    var ROM = RAMFactor.firmware;
    if(!ROM)
    {
        var binary = atob("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BMkBrXgE6QBKSkpKqKn/hT6pA0pmPogQ+p37v6U+nfu/aKhgIFPOqQFIIAbOqRGd+79oSJ37vyBTzmgYaQHJH5DnYKkALKn/nfu/3fi/0PhqkAOd+79gyUCwI8kwsD7JILCOyRCwlckE8EqwCMkCkFjw0LDRyQaQSfCpTPTOSCk/8BhoSCnACvAIqf+wBMi5MM+d+79oOOkB0ONoYCkPSKn/nfu/nfu/IAbOnfu/aDjpAdDrYK34BJ37v614BJ37v2Ct+AdJ8ND1qQCd+L/IuTDPnfm/yLkwz536v5hIIJ3KaKhgmEiseATwDeqYSKAgICfPaKiI0PSt+ARISkpK8ASoICfPaCkHqKkAOGqIEPsKnfu/aKhgqf+d+7+I0PpgAQAAAgIBAgACAiAjRPRSQU0FmUPDJw0gJgQCAiIkAgIjJQICJCACAgcCAgEMABAAAQAAAgEEAEQCDyCTARABRzMRDwQAAP6gQXqISBEBAAAjEAABiD+EPzICBgABAAACAQQARAIPIJMBIAJHMxEfBAAA/qBBeohIEQEAADIgAAGEyPiEAwYAAQAAAgIBAgACAoJBBoNEBFJBTQWDBAICAgICAgICAgICAgBErvQIUgICADBcubgFSo14BLk4BmqN+ARg/////////////////0NPUFlSSUdIVCAoQykgMTk4Ni04OSBBUFBMSUVEIEVOR0lORUVSSU5HAEJPQiBTQU5ERVItQ0VERVJMT0YATUlDSEFFTCBXSUxLUwBTVEVWRU4gTUFMRUNIRUsArq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq7JIMkAyQPJALAxIBbBTJvBIBbBTJ/BjQzAjQDAjQ7AIC/7IJP+IIn+oMGu/88On8CimIz4B454B0zfyanBxTkIIBbBKNAaIOzN8BWpII0SvanqjRO9jBS9ogCpjY0AAmClANAKxAHQBiB7wUy6+rk4BMkB0Coge8EYkCQgmsog68qgwa0BCPASuTgHSVrZuAbQCI0A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");
        ROM = RAMFactor.firmware = new Uint8Array(binary.length);
        for(var i=0;i<binary.length;i++) ROM[i] = binary.charCodeAt(i);
    }

    function mounted()
    {
        return io && card.mount && card.state.active && io.HASH2obj(card.mount.hash)===card;
    }
    function monitoring_enabled()
    {
        var master = oCOM.RefreshEvent_arr && oCOM.RefreshEvent_arr.MEM_monitoring;
        return !!(card.state.active && hw && hw.bMEM_monitoring && master && master.active);
    }
    function readOnly(ctx) { return !!((ctx && ctx.bRO) || (hw && hw.bRO)); }
    function physicalSlot()
    {
        var slot = card.mount ? Number(card.mount.slotN)-1 : null;
        return Number.isInteger(slot) && slot>=1 && slot<=7 ? slot : null;
    }
    function actionMap() { return oEMU.component.IO.ACTION_MAP; }
    function ownsExpansionROM()
    {
        var map = actionMap(), slot = physicalSlot();
        return !!(map && slot!==null && map.Hslot===slot);
    }
    function selectExpansionROM(ctx)
    {
        if(!card.state.active || readOnly(ctx)) return false;
        card.state.registersEnabled = true;
        var map = actionMap(), slot = physicalSlot();
        var range = card.mount && card.mount.ranges && card.mount.ranges.HostROM;
        if(!map || slot===null || !range) return false;
        if(map.Hslot===slot) return true;
        map.Hslot = slot;
        for(var line=range.from;line<=range.to;line++) map.RD[line] = card.action.HostROM.RD.callback;
        // HostROM writes are resolved by Apple2IO using the current Hslot owner.
        return true;
    }
    function releaseExpansionROM()
    {
        if(!ownsExpansionROM()) return false;
        actionMap().Hslot = null;
        return true;
    }
    function hostRelativeAddress(addr,ctx)
    {
        if(ctx && Number.isFinite(ctx.rel_addr)) return ctx.rel_addr & 0xFFF;
        if(ctx && Number.isFinite(ctx.line)) return (ctx.line+(Number(addr)&0xFF)) & 0xFFF;
        return 0x800+(Number(addr)&0x7FF);
    }
    function setHigh(d8)
    {
        card.state.address = (card.state.address & 0xFFFF) | ((d8 & 0xFF)<<16);
    }
    function setMiddle(d8)
    {
        var address = card.state.address;
        if((address & 0x8000) && !(d8 & 0x80)) setHigh((address>>16)+1);
        card.state.address = (card.state.address & 0xFF00FF) | ((d8 & 0xFF)<<8);
    }
    function setLow(d8)
    {
        var address = card.state.address;
        if((address & 0x80) && !(d8 & 0x80)) setMiddle(((address>>8)&0xFF)+1);
        card.state.address = (card.state.address & 0xFFFF00) | (d8 & 0xFF);
    }
    this.readSlotIO = function(addr,ctx)
    {
        if(!this.state.active || !this.state.registersEnabled) return 0xFF;
        var reg = Number(addr) & 15;
        if(reg<8) reg &= 3; // $C0n4-$C0n7 mirror the four address/data registers.
        var address = this.state.address;
        switch(reg)
        {
            case 0: return address & 0xFF;
            case 1: return (address>>8) & 0xFF;
            case 2: return ((address>>16) & 0xFF) | (TOTAL_SIZE<=0x100000 ? 0xF0 : 0);
            case 3:
                var physical = address & (TOTAL_SIZE-1);
                var d8 = RAMCARD_MEM[physical];
                if(!readOnly(ctx))
                {
                    this.mark_MEM_monitoring(physical);
                    setLow((address & 0xFF)+1);
                }
                return d8;
            case 15: return this.state.firmwareBank;
            default: return 0xFF;
        }
    };
    this.writeSlotIO = function(addr,d8,ctx)
    {
        if(!this.state.active || !this.state.registersEnabled || readOnly(ctx)) return 0;
        var reg = Number(addr) & 15;
        if(reg<8) reg &= 3;
        d8 &= 0xFF;
        switch(reg)
        {
            case 0: setLow(d8); break;
            case 1: setMiddle(d8); break;
            case 2: setHigh(d8); break;
            case 3:
                var physical = this.state.address & (TOTAL_SIZE-1);
                RAMCARD_MEM[physical] = d8;
                this.mark_MEM_monitoring(physical);
                setLow((this.state.address & 0xFF)+1);
                break;
            case 15: this.state.firmwareBank = d8 & 1; break;
        }
        return 0;
    };
    this.readROM = function(addr,ctx)
    {
        if(!this.state.active) return 0xFF;
        selectExpansionROM(ctx);
        var slot = physicalSlot();
        if(slot===null) return 0xFF;
        return ROM[(this.state.firmwareBank<<12) | (slot<<8) | (Number(addr)&0xFF)];
    };
    this.writeROM = function(addr,d8,ctx)
    {
        selectExpansionROM(ctx);
        return 0;
    };
    this.readHostROM = function(addr,ctx)
    {
        if(!this.state.active || !ownsExpansionROM()) return 0xFF;
        var rel = hostRelativeAddress(addr,ctx);
        var d8 = rel>=0x800 ? ROM[(this.state.firmwareBank<<12) | rel] : 0xFF;
        if(rel===0xFFF && !readOnly(ctx)) releaseExpansionROM();
        return d8;
    };
    this.writeHostROM = function(addr,d8,ctx)
    {
        if(hostRelativeAddress(addr,ctx)===0xFFF && !readOnly(ctx)) releaseExpansionROM();
        return 0;
    };
    this.reset = function()
    {
        this.state.address = 0;
        this.state.firmwareBank = 0;
        this.state.registersEnabled = false;
        releaseExpansionROM();
        this.update_MEM_status();
    };
    this.restart = function()
    {
        hw = apple2plus.hwObj();
        io = hw.io;
        this.state.active = true;
        var prefix = this.id.PCODE+"_"+this.mount.hash+"_";
        this.MEM_grid = {"cnf":{"id_prefix":prefix,"table_id":prefix+"grid","digits":6,"mem_gran":CELL_BITS},"layout":{}};
        this.MEM_status_id = prefix+"status";
        this.MEM_root_id = prefix+"map";
        this.MEM_sync_id = prefix+"sync";
        this.MEM_file_id = prefix+"file";
        this.MEM_upload_id = prefix+"upload";
        this.MEM_refresh_id = "MEM_monitoring_"+prefix;
        for(var megabyte=0;megabyte<8;megabyte++)
        {
            var base = megabyte<<20;
            var end = base+0x100000;
            this.MEM_grid.layout[oCOM.getHexMulti(base,6)+"-"+oCOM.getHexMulti(end,6)] =
                [base<TOTAL_SIZE ? (megabyte & 1 ? "#B05050" : "#A04040") : "#CCCCCC",
                 "RAMFactor "+megabyte+"–"+(megabyte+1)+" MB", "RAM"];
        }
        this.reset();
        this.enable_MEM_monitoring(!!hw.bMEM_monitoring);
        oCOM.addRefreshEvent(function() { card.MEM_monitoring(); },this.MEM_refresh_id,this.bMEM_monitoring);
        // Older main-memory controls toggle only the master event and hardware.
        // Follow both directly, without peripheral code in index.html or polling.
        Object.defineProperty(oCOM.RefreshEvent_arr[this.MEM_refresh_id],"active",{
            "enumerable":true, "configurable":true,
            "get":function()
            {
                var enabled = monitoring_enabled();
                if(!enabled) card.bMEM_monitoring = false;
                return enabled;
            },
            "set":function(enabled) { card.bMEM_monitoring = !!enabled; }
        });
        oCOM.checkActiveRefreshEvents();
    };
    this.onUnmount = function()
    {
        releaseExpansionROM();
        this.state.registersEnabled = false;
        this.state.active = false;
        loadGeneration++;
        if(fileReader && fileReader.readyState===1) fileReader.abort();
        fileReader = null;
        this.bMEM_monitoring = false;
        this.mem_mon = {};
        if(this.MEM_refresh_id && oCOM.RefreshEvent_arr)
        {
            delete oCOM.RefreshEvent_arr[this.MEM_refresh_id];
            oCOM.checkActiveRefreshEvents();
        }
    };
    this.load_ram = function(bytes)
    {
        if(!(bytes instanceof Uint8Array)) throw new TypeError("RAMFactor RAM image must be a Uint8Array");
        if(bytes.length<1 || bytes.length>TOTAL_SIZE)
            throw new RangeError("RAMFactor RAM image must contain 1 to "+TOTAL_SIZE+" bytes");
        RAMCARD_MEM.set(bytes,0);
        this.reset_MEM_monitoring();
        return {"loadedBytes":bytes.length,"from":0,"to":bytes.length-1};
    };
    this.deviceToolLoadFile = async function(input)
    {
        var file = input && input.files && input.files[0];
        if(!file) return false;
        var generation = ++loadGeneration;
        try
        {
            if(!mounted()) return false;
            if(file.size<1 || file.size>TOTAL_SIZE)
                throw new RangeError("RAMFactor RAM image must contain 1 to "+TOTAL_SIZE+" bytes");
            var buffer;
            if(typeof(file.arrayBuffer)=="function") buffer = await file.arrayBuffer();
            else buffer = await new Promise(function(resolve,reject)
            {
                var reader = new FileReader();
                fileReader = reader;
                reader.onload = function() { resolve(reader.result); };
                reader.onerror = function() { reject(reader.error || new Error("Unable to read RAM image")); };
                reader.onabort = function() { reject(new Error("RAM image loading cancelled")); };
                reader.readAsArrayBuffer(file);
            });
            if(generation!==loadGeneration || !mounted()) return false;
            var result = this.load_ram(new Uint8Array(buffer));
            var upload = document.getElementById(this.MEM_upload_id);
            if(upload) upload.title = "Loaded "+result.loadedBytes+" bytes into RAMFactor RAM";
            return true;
        }
        catch(error)
        {
            if(generation===loadGeneration && mounted())
            {
                var upload = document.getElementById(this.MEM_upload_id);
                if(upload) upload.title = error.message;
                if(typeof(alert)=="function") alert(error.message);
            }
            return false;
        }
        finally
        {
            if(generation===loadGeneration) { input.value = ""; fileReader = null; }
        }
    };
    this.MEM_status_text = function()
    {
        return "RAMFACTOR &nbsp; "+(TOTAL_SIZE/0x100000)+" MB<br>"
            + (this.state.registersEnabled ? "Enabled" : "Disabled")
            + " &nbsp; ROM "+this.state.firmwareBank
            + "<br>Address $"+oCOM.getHexMulti(this.state.address,6)
            + "<br>32 KB / cell";
    };
    this.update_MEM_status = function()
    {
        if(typeof(document)!="object") return;
        var status = document.getElementById(this.MEM_status_id);
        if(status) status.innerHTML = this.MEM_status_text();
        var sync = document.getElementById(this.MEM_sync_id);
        if(sync) sync.className = "fa "+(hw && hw.bMEM_monitoring ? "fa-stop-circle" : "fa-sync-alt");
    };
    this.build_MEM_map = function()
    {
        if(!this.MEM_grid) return "";
        var cfg = this.MEM_grid.cnf;
        var grid = "<table class=gtable style='display:inline-block' id='gtable_"+cfg.table_id+"'><tbody>";
        for(var row=0;row<16;row++)
        {
            var base = row*0x80000;
            grid += "<tr><td title='Physical row start'>"+oCOM.getHexMulti(base,6)+"</td>";
            for(var col=0;col<16;col++)
            {
                var physical = base+col*CELL_SIZE;
                grid += "<td id='"+cfg.id_prefix+oCOM.getHexMulti(physical,6)+"'></td>";
            }
            grid += "</tr>";
        }
        grid += "</tbody></table>";
        return "<div style='display:flex;gap:6px;align-items:flex-end'>"+grid
            +"<div id='"+this.MEM_status_id+"' style='padding:2px;background:white;border-radius:5px'>"
            +this.MEM_status_text()+"</div></div>";
    };
    this.paint_MEM_map = function()
    {
        if(!this.MEM_grid || typeof(document)!="object") return false;
        var cfg = this.MEM_grid.cnf;
        oMEMGRID.paint_grid(this.MEM_grid.layout,cfg);
        var selected = (this.state.address & (TOTAL_SIZE-1))>>CELL_BITS;
        for(var cell=0;cell<(MAX_SIZE>>CELL_BITS);cell++)
        {
            var physical = cell*CELL_SIZE;
            var el = document.getElementById(cfg.id_prefix+oCOM.getHexMulti(physical,6));
            if(!el) continue;
            var present = physical<TOTAL_SIZE;
            var title = "Physical $"+oCOM.getHexMulti(physical,6)+"-$"
                +oCOM.getHexMulti(physical+CELL_SIZE-1,6)+" | 32 KB"
                +(present ? "" : " | Not installed");
            el.title = title;
            el.innerHTML = "<span class=gt>"+title+"</span>";
            el.style.boxShadow = present && cell===selected && this.state.registersEnabled
                ? "inset 0 0 0 1px #202020" : "none";
        }
        this.update_MEM_status();
        return true;
    };
    this.mark_MEM_monitoring = function(physical)
    {
        if(!monitoring_enabled()) { this.bMEM_monitoring = false; return; }
        if(!this.bMEM_monitoring) this.enable_MEM_monitoring(true);
        this.mem_mon[physical>>CELL_BITS] = true;
    };
    this.reset_MEM_monitoring = function()
    {
        this.mem_mon = {};
        this.paint_MEM_map();
    };
    this.enable_MEM_monitoring = function(enabled)
    {
        var wasEnabled = this.bMEM_monitoring;
        this.bMEM_monitoring = !!enabled;
        if(enabled && !wasEnabled) this.reset_MEM_monitoring();
        if(this.MEM_refresh_id) oCOM.enableRefreshEvent(this.MEM_refresh_id,!!enabled);
        this.update_MEM_status();
    };
    this.toggle_MEM_monitoring = function()
    {
        if(!mounted()) return false;
        var enabled = oCOM.toggleRefreshEvent("MEM_monitoring");
        hw.enable_MEM_monitoring(enabled);
        for(var slotN in io.slots)
        {
            var peripheral = io.SLOT2obj(slotN);
            if(!peripheral || typeof(peripheral.enable_MEM_monitoring)!="function") continue;
            peripheral.enable_MEM_monitoring(enabled);
            var eventID = peripheral.MEM_refresh_id
                || (peripheral.id.PCODE==="MS16K" ? "MEM_monitoring_MS16K" : null);
            if(eventID) oCOM.enableRefreshEvent(eventID,enabled);
        }
        var icon = document.getElementById("MEM_monitoring");
        if(icon) icon.className = "fa "+(enabled ? "fa-stop-circle" : "fa-sync-alt");
        return enabled;
    };
    this.MEM_monitoring = function()
    {
        if(!monitoring_enabled() || !this.MEM_grid) return;
        if(!this.bMEM_monitoring) this.enable_MEM_monitoring(true);
        this.paint_MEM_map();
        oMEMGRID.update_grid(this.mem_mon,this.MEM_grid.cnf);
        if(hw && hw.bClear_mon) this.mem_mon = {};
    };
    this.render_MEM_map = function()
    {
        var root = document.getElementById(this.MEM_root_id);
        if(!root) return false;
        if(!document.getElementById("gtable_"+this.MEM_grid.cnf.table_id)) root.innerHTML = this.build_MEM_map();
        this.paint_MEM_map();
        oMEMGRID.update_grid(this.mem_mon,this.MEM_grid.cnf);
        return true;
    };
    this.deviceToolSlotHTML = function(ctx)
    {
        ctx = ctx || {};
        var access = "apple2plus.hwObj().io.HASH2obj("+Number(this.mount.hash)+")";
        var title = "Load 1–"+TOTAL_SIZE+" bytes into RAMFactor RAM; linear physical order from $000000";
        return "<div class=toolbox id='"+(ctx.toolboxID || "device_tool_"+ctx.slotID)+"' hidden>"
            +"<div class=appbox style='padding:0px 6px;min-height:76px' title='RAMFactor "+(TOTAL_SIZE/0x100000)+" MB memory map'>"
            +"<div style='float:left;width:28px;text-align:center'>MEM<br>"
            +"<button class=appbut title='Start/stop synchronised memory monitoring' onclick='"
            +access+"?.toggle_MEM_monitoring()'>"
            +"<i id='"+this.MEM_sync_id+"' class='fa "+(hw && hw.bMEM_monitoring ? "fa-stop-circle" : "fa-sync-alt")+"'></i></button><br>"
            +"<button class=appbut id='"+this.MEM_upload_id+"' title='"+title+"' onclick='document.getElementById(\""
            +this.MEM_file_id+"\").click()'><i class='fa fa-cloud-upload-alt'></i></button>"
            +"<input id='"+this.MEM_file_id+"' type=file accept='.bin,application/octet-stream' hidden onchange='"
            +access+"?.deviceToolLoadFile(this)'></div>"
            +"<div id='"+this.MEM_root_id+"' style='margin-left:30px;white-space:nowrap'>"+this.build_MEM_map()+"</div>"
            +"</div></div>";
    };
}
