// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
// EMU_CARD_legendRAM.js — Legend 1MB RAM board. Include explicitly in index.html.
// Legend Operational Manual, chapter 12 (1984):
// https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/Memory/Legend%20S-Card/Manuals/Legend%20Industries%20RAM%20Card%20Operation%20Manual.pdf
// 64 x 16KB banks; write slot offset $04 to select bank 0–63.
// Image order per bank: 4KB A, 4KB B, common 8KB (same convention as Saturn).
// A is manual sub-bank 2 (offsets $00–$03); B is sub-bank 1 ($08–$0B).
// Other offsets are ignored. Reads/protected debugger probes never select a bank.

// Discovery container; Apple2IO constructs independent live instances.
if(oEMU===undefined) var oEMU = {"component":{"IO":{}}};
oEMU.component.IO.LegendRAM = new LegendRAM();

function LegendRAM()
{
    this.id = {"PCODE":"LEGEND", "icon":"fa fa-microchip"};
    this.state = {"active":true, "softswitch_pos":2, "bank":0, "BANK":0,
                  "RE":false, "RR":false, "WE":false, "bMapped":false};
    this.action = {"SlotIO":{
         "RD":{"callback":function(addr,ctx) { return card.soft_switch(addr,undefined,ctx); }}
        ,"WR":{"callback":function(addr,d8,ctx) { return card.soft_switch(addr,d8,ctx); }}
    }};

    const BANK_SIZE = 0x1000;
    const BANK_TOTAL = 0x4000;
    const TOTAL_SIZE = 0x100000;
    const BANK_COUNT = TOTAL_SIZE/BANK_TOTAL;
    const CELL_BITS = 12; // 4096 physical bytes/cell
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
    function monitoring_enabled()
    {
        var master = oCOM.RefreshEvent_arr && oCOM.RefreshEvent_arr.MEM_monitoring;
        return !!(card.state.active && hw && hw.bMEM_monitoring && master && master.active);
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
             "position":"$"+oCOM.getHexByte(state.softswitch_pos), "bank":state.bank
            ,"BANK":state.BANK===0 ? "A" : "B", "RE":state.RE, "WE":state.WE, "RR":state.RR
        });
        if(result) state.bMapped = state.RE;
        return result;
    };
    this.soft_switch = function(rel_io_addr,d8,ctx)
    {
        var state = this.state;
        var status = state.BANK | (state.RE ? 2 : 0) | (state.WE ? 4 : 0) | (state.RR ? 8 : 0);
        if(!state.active || (hw && hw.bRO) || (ctx && ctx.bRO)) return status;
        var nibble = rel_io_addr & 15;
        var isWrite = d8!==undefined;
        if(nibble===4)
        {
            // Legend uses the DATA bus at $C080 + 16*slot + $04, unlike Saturn's address selectors.
            // Reading this write-only register has no emulated side effect.
            if(!isWrite) return status;
            state.bank = (d8 & 0xFF) & (BANK_COUNT-1);
        }
        else
        {
            // Bit-2 aliases of the language card switches are NOT decoded by Legend.
            if(nibble & 4) return status;
            var mode = nibble & 3;
            state.softswitch_pos = nibble;
            // Keep Saturn's image order: A (manual sub-bank 2), B (sub-bank 1), common 8K.
            state.BANK = (nibble & 8) ? 1 : 0;
            state.RE = mode===0 || mode===3;
            if(!(mode & 1)) state.WE = state.RR = false;
            else if(isWrite) state.RR = false; // writes cannot arm the two-read latch
            else
            {
                state.WE = state.WE || state.RR;
                state.RR = true;
            }
        }
        this.updateMemoryMap();
        return status;
    };
    this.reset = function()
    {
        // Emulator reset: bank 0, A, ROM readable, RAM write-protected; contents preserved.
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
            var target = "LEGEND bank "+state.bank+" / "+state.BANK+" + common 8K";
            return {"owner":card, "source":"Legend 1MB RAM board soft switches", "state":state,
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
        for(var bank=0;bank<BANK_COUNT;bank++)
        {
            var base = bank*BANK_TOTAL;
            var label = "LEGEND bank "+bank;
            var segments = [[0,0x1000,"#A04040","A","DA"],[0x1000,0x2000,"#B05050","B","DB"],
                            [0x2000,0x4000,"#D06060","common","RAM"]];
            for(var i=0;i<segments.length;i++)
            {
                var segment = segments[i];
                var from = oCOM.getHexMulti(base+segment[0],5);
                // $100000 is an exclusive endpoint: six digits avoid wrapping to $00000.
                var to = oCOM.getHexMulti(base+segment[1],base+segment[1]===TOTAL_SIZE ? 6 : 5);
                this.MEM_grid.layout[from+"-"+to] = [segment[2],label+" "+segment[3],segment[4]];
            }
        }
        this.reset();
        this.enable_MEM_monitoring(!!hw.bMEM_monitoring);
        oCOM.addRefreshEvent(function() { card.MEM_monitoring(); },this.MEM_refresh_id,this.bMEM_monitoring);
        // Follow the master event even when the older MS16K toolbox toggles it directly.
        // The sequencer already reads event.active each tick; no polling or core edits.
        Object.defineProperty(oCOM.RefreshEvent_arr[this.MEM_refresh_id],"active",{
            "enumerable":true, "configurable":true,
            "get":function()
            {
                var enabled = monitoring_enabled();
                // Observe legacy stop transitions so resume clears old highlights.
                if(!enabled) card.bMEM_monitoring = false;
                return enabled;
            },
            "set":function(enabled) { card.bMEM_monitoring = !!enabled; }
        });
        oCOM.checkActiveRefreshEvents();
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
        if(!(bytes instanceof Uint8Array)) throw new TypeError("Legend RAM image must be a Uint8Array");
        if(bytes.length<1 || bytes.length>TOTAL_SIZE)
            throw new RangeError("Legend RAM image must contain 1 to 1048576 bytes");
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
                throw new RangeError("Legend RAM image must contain 1 to 1048576 bytes");
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
            if(upload) upload.title = "Loaded "+result.loadedBytes+" bytes into Legend RAM";
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
        return "LEGEND 1MB<br>"+(state.RE ? '<i class="fa fa-microchip" title="RAM read"></i>'
            : '<i class="fa fa-apple-alt" title="ROM read"></i>')
            + ' &nbsp; <i class="fa '+(state.WE ? 'fa-lock-open' : 'fa-lock')+'" title="'
            +(state.WE ? 'Write enabled' : 'Write protected')+'"></i> &nbsp; Bank '
            +state.bank+" / "+(state.BANK===0 ? "A" : "B")+"<br>4KB/cell";
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
        // 8 rows x 8 banks x 4 cells: full 1MB in a main-monitor-sized grid.
        // Each bank is A (D000), B (D000), E000 and F000, all 4KB cells.
        for(var row=0;row<8;row++)
        {
            var firstBank = row*8;
            grid += "<tr><td style='width:28px;min-width:28px' title='16K banks "
                +firstBank+" through "+(firstBank+7)+"'>"+firstBank+"–"+(firstBank+7)+"</td>";
            for(var group=0;group<8;group++)
            {
                if(group) grid += "<td aria-hidden='true' style='width:3px;min-width:3px'></td>";
                var bank = firstBank+group;
                for(var cell=0;cell<4;cell++)
                {
                    var physical = bank*BANK_TOTAL+(cell<<CELL_BITS);
                    grid += "<td id='"+cfg.id_prefix+oCOM.getHexMulti(physical,5)+"'></td>";
                }
            }
            grid += "</tr>";
        }
        grid += "</tbody></table>";
        return "<div style='display:flex;gap:6px;align-items:flex-end'>"+grid
            +"<div id='"+this.MEM_status_id+"' style='padding:2px;background:white;border-radius:5px;font-size:8px'>"
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
            var title = "Bank "+bank+" "+part+" | phys $"+oCOM.getHexMulti(physical,5)
                +"-$"+oCOM.getHexMulti(physical+0xFFF,5)+"<br>CPU $"+oCOM.getHexWord(cpu)
                +"-$"+oCOM.getHexWord(cpu+0xFFF)+" | 4KB";
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
        var title = "Load 1–1048576 bytes into Legend RAM; bank order A, B, common 8K";
        return "<div class=toolbox id='"+(ctx.toolboxID || "device_tool_"+ctx.slotID)+"' hidden>"
            +"<div class=appbox style='padding:0px 6px;min-height:76px' title='Legend 1MB memory map: banks 0–63; A, B, common E000 and F000; 4KB per cell'>"
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
