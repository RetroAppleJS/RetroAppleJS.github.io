// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
// EMU_CARD_saturnRAM.js — Saturn 128K RAM board. Included by index.html.

// Discovery container; Apple2IO constructs independent live instances.
if(oEMU===undefined) var oEMU = {"component":{"IO":{}}};
oEMU.component.IO.SaturnRAM = new SaturnRAM();

function SaturnRAM()
{
    this.id = {"PCODE":"SATURN", "icon":"fa fa-microchip"};
    this.state = {"active":true, "softswitch_pos":2, "bank":0, "BANK":0,
                  "RE":false, "RR":false, "WE":false, "bMapped":false};
    this.action = {"SlotIO":{
         "RD":{"callback":function(addr,ctx) { return card.soft_switch(addr,ctx); }}
        ,"WR":{"callback":function(addr,d8,ctx) { return card.soft_switch(addr,ctx); }}
    }};

    const BANK_SIZE = 0x1000;
    const BANK_TOTAL = 0x4000;
    const TOTAL_SIZE = 0x20000;
    const CELL_BITS = 10; // 1024 physical bytes/cell
    var RAMCARD_MEM = new Uint8Array(TOTAL_SIZE);
    var card = this;
    var hw, io, ROM_ID, ROM_CFG, ROM_RANGE;
    var loadGeneration = 0;
    var fileReader = null;
    this.mem_mon = {};
    this.bMEM_monitoring = false;
    this.MEM_grid = null;
    this.MEM_refresh_id = null;

    function physical_address(rel_addr)
    {
        // Each 16K bank is stored as 4K A, 4K B, common 8K.
        return card.state.bank*BANK_TOTAL
            + (rel_addr<BANK_SIZE ? card.state.BANK*BANK_SIZE+rel_addr : rel_addr+BANK_SIZE);
    }
    function valid_address(addr) { return Number.isInteger(addr) && addr>=0 && addr<0x3000; }
    function mounted()
    {
        return io && card.mount && card.state.active && io.HASH2obj(card.mount.hash)===card;
    }
    this.mapRead = function(addr) { return card.read((addr & 0xFFFF)-ROM_RANGE.from); };
    this.mapWrite = function(addr,d8) { return card.write((addr & 0xFFFF)-ROM_RANGE.from,d8); };
    this.read = function(rel_addr)
    {
        return valid_address(rel_addr) ? RAMCARD_MEM[physical_address(rel_addr)] : 0;
    };
    this.write = function(rel_addr,d8)
    {
        if(!this.state.active || !this.state.WE || !valid_address(rel_addr)) return false;
        var physical = physical_address(rel_addr);
        RAMCARD_MEM[physical] = d8 & 0xFF;
        this.mark_MEM_monitoring(physical);
        return true;
    };
    this.updateMemoryMap = function()
    {
        if(!io || !this.mount || !ROM_CFG) return false;
        var state = this.state;
        var result = io.MEMORY_MAP.runRule(this.id.PCODE+":"+this.mount.hash,{
             "position":"$"+oCOM.getHexByte(state.softswitch_pos), "bank":state.bank+1
            ,"BANK":state.BANK===0 ? "A" : "B", "RE":state.RE, "WE":state.WE, "RR":state.RR
        });
        if(result) state.bMapped = state.RE;
        return result;
    };
    this.soft_switch = function(rel_io_addr)
    {
        var state = this.state;
        var status = state.BANK | (state.RE ? 2 : 0) | (state.WE ? 4 : 0) | (state.RR ? 8 : 0);
        if(!state.active || (hw && hw.bRO)) return status;
        var nibble = rel_io_addr & 15;
        if(nibble & 4)
            // Select 16K bank without changing mode, A/B or the write latch.
            state.bank = (nibble & 3) | ((nibble & 8) >> 1);
        else
        {
            var mode = nibble & 3;
            var wantsWrite = !!(mode & 1);
            state.softswitch_pos = nibble;
            state.BANK = (nibble & 8) ? 1 : 0;
            state.RE = mode===0 || mode===3;
            state.WE = wantsWrite && state.RR;
            state.RR = wantsWrite;
        }
        this.updateMemoryMap();
        return status;
    };
    this.reset = function()
    {
        // Saturn power-up: bank 1, A, ROM readable, RAM write-protected.
        this.state.softswitch_pos = 2;
        this.state.bank = this.state.BANK = 0;
        this.state.RE = this.state.WE = this.state.RR = this.state.bMapped = false;
        this.updateMemoryMap();
        this.update_MEM_status();
    };
    this.restart = function()
    {
        hw = apple2plus.hwObj();
        io = hw.io;
        var model = typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P";
        ROM_ID = (_CFG_SYSCODE[model] || _CFG_SYSCODE.A2P).ROM || _CFG_SYSCODE.A2P.ROM;
        ROM_CFG = _CFG_ROMRANGES[ROM_ID];
        ROM_RANGE = oCOM.parseRngExpr(ROM_CFG.ROM);
        this.state.active = true;
        io.MEMORY_MAP.addRule(this.id.PCODE+":"+this.mount.hash,function(state)
        {
            var target = "SATURN bank "+state.bank+" / "+state.BANK+" + common 8K";
            return {"owner":card, "source":"Saturn 128K RAM board soft switches", "state":state,
                "mappings":[
                    {"id":"upper-memory-read", "space":ROM_ID, "op":"RD", "range":ROM_CFG.ROM,
                     "handler":state.RE ? "mapRead" : "@default", "target":state.RE ? target : "Apple II ROM",
                     "enabled":true, "condition":"RE="+Number(state.RE)+"; bank="+state.bank+"; 4K="+state.BANK},
                    {"id":"upper-memory-write", "space":ROM_ID, "op":"WR", "range":ROM_CFG.ROM,
                     "handler":state.WE ? "mapWrite" : "@default", "target":target,
                     "enabled":state.WE, "condition":"WE="+Number(state.WE)+"; bank="+state.bank+"; 4K="+state.BANK}
                ]};
        });
        var prefix = this.id.PCODE+"_"+this.mount.hash+"_";
        this.MEM_grid = {"cnf":{"id_prefix":prefix,"table_id":prefix+"grid","digits":5,"mem_gran":CELL_BITS},"layout":{}};
        this.MEM_status_id = prefix+"status";
        this.MEM_root_id = prefix+"map";
        this.MEM_sync_id = prefix+"sync";
        this.MEM_file_id = prefix+"file";
        this.MEM_upload_id = prefix+"upload";
        this.MEM_refresh_id = "MEM_monitoring_"+prefix;
        for(var bank=0;bank<8;bank++)
        {
            var base = bank*BANK_TOTAL;
            var label = "SATURN bank "+(bank+1);
            var segments = [[0,0x1000,"#A04040","A","DA"],[0x1000,0x2000,"#B05050","B","DB"],
                            [0x2000,0x4000,"#D06060","common","RAM"]];
            for(var i=0;i<segments.length;i++)
            {
                var segment = segments[i];
                var from = oCOM.getHexMulti(base+segment[0],5);
                var to = oCOM.getHexMulti(base+segment[1],5);
                this.MEM_grid.layout[from+"-"+to] = [segment[2],label+" "+segment[3],segment[4]];
            }
        }
        this.reset();
        this.enable_MEM_monitoring(!!hw.bMEM_monitoring);
        oCOM.addRefreshEvent(function() { card.MEM_monitoring(); },this.MEM_refresh_id,this.bMEM_monitoring);
    };
    this.onUnmount = function()
    {
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
        if(!(bytes instanceof Uint8Array)) throw new TypeError("Saturn RAM image must be a Uint8Array");
        if(bytes.length<1 || bytes.length>TOTAL_SIZE)
            throw new RangeError("Saturn RAM image must contain 1 to 131072 bytes");
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
                throw new RangeError("Saturn RAM image must contain 1 to 131072 bytes");
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
            if(upload) upload.title = "Loaded "+result.loadedBytes+" bytes into Saturn RAM";
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
        var state = this.state;
        return "SATURN &nbsp; "+(state.RE ? '<i class="fa fa-microchip" title="RAM read"></i>'
            : '<i class="fa fa-apple-alt" title="ROM read"></i>')
            + ' &nbsp; <i class="fa '+(state.WE ? 'fa-lock-open' : 'fa-lock')+'" title="'
            +(state.WE ? 'Write enabled' : 'Write protected')+'"></i> &nbsp; Bank '
            +(state.bank+1)+" / "+(state.BANK===0 ? "A" : "B");
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
        var grid = "<table class=gtable style='display:inline-block' id='gtable_"+cfg.table_id+"'>"
            +"<thead><tr style='font-weight:normal'>"
            //+"<th style='font-weight:normal'></th>"
            //+"<th colspan='4' style='font-weight:normal' title='4K A: CPU $D000-$DFFF'>D000-A</th>"
            //+"<th aria-hidden='true' style='width:6px'></th>"
            //+"<th colspan='4' style='font-weight:normal' title='4K B: CPU $D000-$DFFF'>D000-B</th>"
            //+"<th aria-hidden='true' style='width:6px'></th>"
            //+"<th colspan='8' style='font-weight:normal' title='Common 8K: CPU $E000-$FFFF, shared by A and B'>E000-FFFF</th>"
            +"</tr></thead><tbody>";
        for(var bank=0;bank<8;bank++)
        {
            grid += "<tr data-bank='"+(bank+1)+"'><td title='16K bank "+(bank+1)+"'>"+(bank+1)+"</td>";
            for(var cell=0;cell<16;cell++)
            {
                if(cell===4 || cell===8)
                    grid += "<td aria-hidden='true' style='width:6px;min-width:6px'></td>";
                var physical = bank*BANK_TOTAL+(cell<<CELL_BITS);
                grid += "<td id='"+cfg.id_prefix+oCOM.getHexMulti(physical,5)+"'></td>";
            }
            grid += "</tr>";
        }
        grid += "</tbody></table>";
        return "<div style='display:flex;flex-direction:column;gap:6px;align-items:flex-start'>"
            +grid
            +"<div id='"+this.MEM_status_id+"' style='padding:2px;background:white;border-radius:5px'>"
            +this.MEM_status_text()+"</div></div>";
    };
    this.paint_MEM_map = function()
    {
        if(!this.MEM_grid || typeof(document)!="object") return false;
        var cfg = this.MEM_grid.cnf;
        oMEMGRID.paint_grid(this.MEM_grid.layout,cfg);
        for(var cell=0;cell<(TOTAL_SIZE>>CELL_BITS);cell++)
        {
            var physical = cell<<CELL_BITS;
            var el = document.getElementById(cfg.id_prefix+oCOM.getHexMulti(physical,5));
            if(!el) continue;
            var local = physical & (BANK_TOTAL-1);
            var bank = physical>>14;
            var part = local<0x1000 ? "A" : local<0x2000 ? "B" : "com";
            var cpu = local<0x2000 ? 0xD000+(local & 0x0FFF) : 0xE000+local-0x2000;
            var title = "Bank "+(bank+1)+" "+part+" | phys $"+oCOM.getHexMulti(physical,5)
                +"-$"+oCOM.getHexMulti(physical+0x3FF,5)+"<br>CPU $"+oCOM.getHexWord(cpu)
                +"-$"+oCOM.getHexWord(cpu+0x3FF)+" | 1KB";
            el.title = title;
            el.innerHTML = "<span class=gt>"+title+"</span>";
            var selected = bank===this.state.bank && (part==="com" || (part==="A" ? 0 : 1)===this.state.BANK);
            el.style.boxShadow = selected ? "inset 0 0 0 1px #202020" : "none";
        }
        this.update_MEM_status();
        return true;
    };
    this.mark_MEM_monitoring = function(physical)
    {
        if(this.bMEM_monitoring) this.mem_mon[physical>>CELL_BITS] = true;
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
        if(!this.state.active || !this.MEM_grid || !this.bMEM_monitoring) return;
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
        var title = "Load 1–131072 bytes into Saturn RAM; bank order A, B, common 8K";
        return "<div class=toolbox id='"+(ctx.toolboxID || "device_tool_"+ctx.slotID)+"' hidden>"
            +"<div class=appbox style='padding:0px 6px;min-height:76px' title='Saturn 128K memory map'>"
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
