//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/AppleII-IDE/main/LICENSE.md
//
// apple2debug.js
//
// STEP TRACE is an attached debugger for the *live* Apple II runtime.
// It never owns a shadow CPU or RAM image. Execution is performed by the real
// Apple2Plus CPU/hardware/peripheral objects and disassembly reads the currently
// mapped CPU bus through safe_read().
//

if(oEMU===undefined) var oEMU = {"component":{"CPU":{"Apple2Debug":new Apple2Debug()}}}
else oEMU.component.CPU.Apple2Debug = new Apple2Debug();

function Apple2Debug()
{
    var dbg = this;
    var cpu_config = null;
    var max_instrlen = 3;
    var oDASM_debug = null;

    var listingRows = 20;
    var currentPC = null;
    var previousObservedPC = null;
    var previousBoundary = new Int32Array(0x10000);
    previousBoundary.fill(-1);

    // Cached decoding is always validated against the three bytes currently
    // visible on the mapped CPU bus, so self-modifying code/remapping is local.
    var decodeCache = new Array(0x10000);
    var cacheHits = 0;
    var cacheMisses = 0;
    var domWrites = 0;

    var listingColumns = "{adr:0,code:6,lin:15,lbl:21,ins:30,opr:35,com:51}";
    var listingColumnPresets = {
         "default":"{adr:0,code:6,lin:15,lbl:21,ins:30,opr:35,com:51}"
        ,"wide":"{adr:0,code:6,lin:17,lbl:24,ins:34,opr:40,com:60}"
        ,"compact":"{adr:0,code:6,lbl:15,ins:24,opr:29,com:45}"
    };

    // Run control. "system" delegates execution to the central emulator speed;
    // fixed IPS modes own instruction scheduling while the SYSTEM timer is paused.
    var runMode = "system";
    var fixedRunning = false;
    var runTimer = null;
    var resumePct = 1;

    function liveMachine()
    {
        return typeof(apple2plus)=="object" && apple2plus ? apple2plus : null;
    }

    function liveCPU()
    {
        var machine = liveMachine();
        return machine && typeof(machine.cpuObj)=="function" ? machine.cpuObj() : null;
    }

    function liveHW()
    {
        var machine = liveMachine();
        return machine && typeof(machine.hwObj)=="function" ? machine.hwObj() : null;
    }

    function init(cfg)
    {
        var cpu = liveCPU();
        if(!cpu) return false;

        cpu_config = cpu.getConfig();
        max_instrlen = Math.max.apply(null,cpu_config.instrlen);
        if(cfg && cfg.scrollH) listingRows = cfg.scrollH;

        oDASM_debug = new DASM();
        oDASM_debug.getHexByte = oCOM.getHexByte;
        oDASM_debug.sym_search = function(op,adm)
        {
            var opd = parseInt(op.substring(1,op.length),16);
            var symlink = null;

            if(typeof(oASM)!="undefined" && oASM && oASM.symlink)
                symlink = oASM.symlink;
            else if(typeof(asm)!="undefined" && asm && asm.symlink)
                symlink = asm.symlink;

            switch(adm)
            {
                case "zpg":
                case "abs":
                case "rel":
                case "iny":
                case "inx":
                    if(symlink)
                    {
                        var adr = symlink[opd];
                        if(typeof(adr)!="undefined") return adr+" <small>"+op+"h</small>";
                        adr = symlink[opd-1];
                        if(typeof(adr)!="undefined") return adr+"+1 <small>"+op+"h</small>";
                    }
                break;
            }
            return op;
        };

        return true;
    }

    function ensureInit(cfg)
    {
        return cpu_config!==null || init(cfg);
    }

    function stripMarkup(text)
    {
        return String(text==null ? "" : text)
            .replace(/&nbsp;/gi," ")
            .replace(/<[^>]*>/g,"")
            .replace(/&lt;/gi,"<")
            .replace(/&gt;/gi,">")
            .replace(/&amp;/gi,"&")
            .replace(/\s+/g," ")
            .trim();
    }

    function decodeAt(addr)
    {
        if(!ensureInit()) return null;
        var hw = liveHW();
        if(!hw || typeof(hw.safe_read)!="function") return null;

        addr &= 0xffff;
        var b0 = hw.safe_read(addr);
        var b1 = hw.safe_read((addr+1)&0xffff);
        var b2 = hw.safe_read((addr+2)&0xffff);

        var cached = decodeCache[addr];
        if(cached && cached.b0===b0 && cached.b1===b1 && cached.b2===b2)
        {
            cacheHits++;
            return cached;
        }

        cacheMisses++;
        var len = cpu_config.instrlen[b0] || 1;
        var ret = oDASM_debug.disassemble({
             "code_arr":[b0,b1,b2]
            ,"pc":addr
            ,"opctab":cpu_config.opctab
        });

        var mnemonic = stripMarkup(ret.mnemonic);
        var match = /^(\S+)(?:\s+(.*))?$/.exec(mnemonic) || ["",mnemonic,""];
        var bytes = [b0,b1,b2].slice(0,len).map(function(v){return oCOM.getHexByte(v)}).join(" ");

        cached = {
             "addr":addr
            ,"b0":b0,"b1":b1,"b2":b2
            ,"len":len
            ,"next":(addr+len)&0xffff
            ,"bytes":bytes
            ,"ins":match[1] || ""
            ,"opr":match[2] || ""
        };
        decodeCache[addr] = cached;
        return cached;
    }

    function parseColumns(text)
    {
        var out = {};
        String(text || "").replace(/([a-zA-Z_][\w]*)\s*:\s*(-?\d+)/g,function(_,key,val)
        {
            out[key] = Math.max(0,parseInt(val,10) || 0);
            return "";
        });
        return out;
    }

    function crop(text,width)
    {
        text = String(text==null ? "" : text);
        if(width<=0) return "";
        if(text.length<=width) return text;
        if(width===1) return text.slice(0,1);
        return text.slice(0,width-1)+"…";
    }

    function formatParts(parts)
    {
        var columns = parseColumns(listingColumns);
        var order = ["adr","code","lin","lbl","ins","opr","com"];
        var active = order.filter(function(k){return Object.prototype.hasOwnProperty.call(columns,k)});
        active.sort(function(a,b){return columns[a]-columns[b]});

        var line = "";
        for(var i=0;i<active.length;i++)
        {
            var key = active[i];
            var col = columns[key];
            while(line.length<col) line += " ";

            var nextCol = i+1<active.length ? columns[active[i+1]] : null;
            var value = String(parts[key]==null ? "" : parts[key]);
            if(nextCol!==null) value = crop(value,Math.max(0,nextCol-col-1));
            line += value;
        }
        return line.replace(/\s+$/g,"");
    }

    function formatDecoded(d)
    {
        return formatParts({
             "adr":oCOM.getHexWord(d.addr)+":"
            ,"code":d.bytes
            ,"lin":""
            ,"lbl":""
            ,"ins":d.ins
            ,"opr":d.opr
            ,"com":""
        });
    }

    function rememberSequential(from,to)
    {
        if(from==null || to==null) return false;
        from &= 0xffff;
        to &= 0xffff;
        var d = decodeAt(from);
        if(!d || d.next!==to) return false;
        previousBoundary[to] = from;
        return true;
    }

    function rememberEdges(edges)
    {
        if(!Array.isArray(edges)) return;
        for(var i=0;i<edges.length;i++)
            if(edges[i] && edges[i].length>=2)
                rememberSequential(edges[i][0],edges[i][1]);
    }

    function predecessorOf(addr)
    {
        addr &= 0xffff;

        var known = previousBoundary[addr];
        if(known>=0)
        {
            var kd = decodeAt(known);
            if(kd && kd.next===addr) return known;
            previousBoundary[addr] = -1;
        }

        // A backward decode is accepted only when exactly one 1..3-byte
        // candidate lands on the known instruction boundary.
        var found = -1;
        var count = 0;
        for(var delta=1;delta<=max_instrlen;delta++)
        {
            var candidate = (addr-delta)&0xffff;
            var d = decodeAt(candidate);
            if(d && d.next===addr)
            {
                found = candidate;
                count++;
            }
        }
        return count===1 ? found : -1;
    }

    function listingWindow(pc,count)
    {
        pc &= 0xffff;
        count = Math.max(1,Number(count)|0 || listingRows);

        var aboveWanted = Math.min(8,Math.floor(count/2));
        var start = pc;
        for(var i=0;i<aboveWanted;i++)
        {
            var p = predecessorOf(start);
            if(p<0) break;
            start = p;
        }

        var rows = [];
        var adr = start;
        for(var row=0;row<count;row++)
        {
            var d = decodeAt(adr);
            if(!d) break;

            rows.push({
                 "addr":adr
                ,"current":adr===pc
                ,"text":formatDecoded(d)
            });

            previousBoundary[d.next] = adr;
            adr = d.next;
        }
        return rows;
    }

    function ensureRowPool()
    {
        var el = document.getElementById(dbg.body_id);
        if(!el) return null;

        var pool = el._cpuDbgRowPool;
        if(pool && pool.length===listingRows && pool.length
            && pool[0].parentNode===el)
            return pool;

        el.innerHTML = "";
        pool = new Array(listingRows);
        for(var i=0;i<listingRows;i++)
        {
            var row = document.createElement("div");
            row.style.height = "9px";
            row.style.lineHeight = "9px";
            row.style.whiteSpace = "pre";
            row.style.fontFamily = "inherit";
            row._cpuDbgText = null;
            row._cpuDbgCurrent = null;
            el.appendChild(row);
            pool[i] = row;
        }
        el._cpuDbgRowPool = pool;
        return pool;
    }

    function renderListing(pc,force)
    {
        var pool = ensureRowPool();
        if(!pool) return false;
        var rows = listingWindow(pc,listingRows);

        for(var i=0;i<pool.length;i++)
        {
            var data = rows[i] || {text:"",current:false};
            var node = pool[i];
            var text = data.text || "";

            if(force || node._cpuDbgText!==text)
            {
                node.textContent = text;
                node._cpuDbgText = text;
                domWrites++;
            }

            if(force || node._cpuDbgCurrent!==!!data.current)
            {
                node.style.fontWeight = data.current ? "bold" : "normal";
                node.style.textDecoration = data.current ? "underline" : "none";
                node._cpuDbgCurrent = !!data.current;
            }
        }
        return true;
    }

    function parseBootAddress(value)
    {
        var s = String(value==null ? "" : value).trim();
        s = s.replace(/^\$/,"").replace(/^0x/i,"");
        if(!/^[0-9a-f]{1,4}$/i.test(s)) return null;
        return parseInt(s,16) & 0xffff;
    }

    function updateBootTriggerIcon(el,state)
    {
        if(!el) return;

        if(state && state.bDebug_boot)
        {
            var startText = state.triggerAddress==null
                ? "immediately"
                : "$"+oCOM.getHexWord(state.triggerAddress);
            var stopText = state.stopAddress==null
                ? "when buffer is full"
                : "before $"+oCOM.getHexWord(state.stopAddress);
            var mode = state.triggerArmed
                ? "armed"
                : state.logging
                    ? "logging"
                    : state.full
                        ? "buffer full"
                        : state.complete
                            ? "complete"
                            : "enabled";

            el.style.opacity = "1";
            el.title = "bootlog "+mode+"; start "+startText+"; stop "+stopText;
        }
        else
        {
            el.style.opacity = ".35";
            el.title = "bootlog trigger disabled";
        }
    }

    function systemRunning()
    {
        return typeof(_o)!="undefined" && Number(_o.CPU_TargetTicks_s)>0;
    }

    function executionRunning()
    {
        return fixedRunning || (runMode==="system" && systemRunning());
    }

    function rememberSystemSpeed()
    {
        if(typeof(_o)==="undefined") return;
        var base = Number(_o.CPU_ClocksTicks_s) || 1;
        var target = Number(_o.CPU_TargetTicks_s) || 0;
        if(target>0) resumePct = target/base;
    }

    function pauseSystem()
    {
        if(systemRunning())
        {
            rememberSystemSpeed();
            oEMUI.cpuSpd(0);
        }
    }

    function resumeSystem()
    {
        oEMUI.cpuSpd(resumePct>0 ? resumePct : 1);
    }

    function clearRunTimer()
    {
        if(runTimer!==null)
        {
            window.clearTimeout(runTimer);
            runTimer = null;
        }
    }

    function stopFixedRun()
    {
        fixedRunning = false;
        clearRunTimer();
    }

    function runSpeedConfig(mode)
    {
        switch(String(mode))
        {
            case "1":    return {batch:1,delay:1000,label:"1 IPS"};
            case "10":   return {batch:1,delay:100,label:"10 IPS"};
            case "100":  return {batch:5,delay:50,label:"100 IPS"};
            case "1000": return {batch:50,delay:50,label:"1000 IPS"};
            default:     return {batch:0,delay:0,label:"Max (SYSTEM)"};
        }
    }

    function syncRunIcon(el)
    {
        el = el || document.getElementById("cpuDbg_play");
        if(!el || !el.classList) return;
        var running = executionRunning();
        el.classList.toggle("fa-pause",running);
        el.classList.toggle("fa-play",!running);
        el.title = running ? "pause CPU execution" : "continue CPU execution";
    }

    function scheduleFixedRun(delay)
    {
        clearRunTimer();
        runTimer = window.setTimeout(fixedRunLoop,Math.max(0,delay|0));
    }

    function fixedRunLoop()
    {
        if(!fixedRunning || runMode==="system") return;
        var machine = liveMachine();
        if(!machine || typeof(machine.runLiveInstructionBatch)!="function")
        {
            stopFixedRun();
            syncRunIcon();
            return;
        }

        var cfg = runSpeedConfig(runMode);
        var result = machine.runLiveInstructionBatch(cfg.batch);
        rememberEdges(result && result.edges);

        dbg.cycle({cpu:machine.cpuObj(),force:true});

        if(!result || result.stalled)
        {
            stopFixedRun();
            syncRunIcon();
            return;
        }

        scheduleFixedRun(cfg.delay);
    }

    function startExecution()
    {
        if(runMode==="system")
        {
            stopFixedRun();
            resumeSystem();
        }
        else
        {
            pauseSystem();
            fixedRunning = true;
            scheduleFixedRun(0);
        }
        syncRunIcon();
    }

    function pauseExecution()
    {
        stopFixedRun();
        if(runMode==="system") pauseSystem();
        syncRunIcon();
    }

    this.html = function(body_id,wrapper_id)
    {
        this.body_id = body_id;
        oCOM.POPUP.set_state(wrapper_id,true);
        return "<div class=appbox style='text-align:left;height:auto;min-height:290px;width:340px;padding:0 0 0 1px;margin:0'>"
            +"<div class=marginless style='border:0'>"
                +"STEP TRACE "
                +"<i id=cpuDbg_play class='fa fa-pause' title='pause CPU execution' onclick='oEMU.component.CPU.Apple2Debug.toggleRun(this)'></i>&nbsp;"
                +"<i class='fa fa-sign-in-alt' title='step one live instruction' onclick='oEMU.component.CPU.Apple2Debug.step()'></i>&nbsp;"
                +"<i class='fa fa-paw' style='opacity:.35' title='step over (next pass)'></i>&nbsp;"
                +"<i class='fa fa-sign-out-alt' style='opacity:.35' title='step out (next pass)'></i>&nbsp;"
                +"<select id='cpuDbg_speed' title='STEP TRACE execution speed' onchange='oEMU.component.CPU.Apple2Debug.setRunSpeed(this.value)' style='font-size:10px'>"
                    +"<option value='1'>1 IPS</option>"
                    +"<option value='10'>10 IPS</option>"
                    +"<option value='100'>100 IPS</option>"
                    +"<option value='1000'>1000 IPS</option>"
                    +"<option value='system' selected>Max (SYSTEM)</option>"
                +"</select>&nbsp;"
                +"<div class='appbut skinny' onclick='oEMU.component.CPU.Apple2Debug.downloadBootLog()'><i class='fa fa-shoe-prints' title='download bootlog'></i></div>&nbsp;"
                +"<div class='appbut skinny'><i id='cpuDbg_bootTrigger' class='fa fa-coffee' style='opacity:.35' title='bootlog trigger disabled' onclick='oEMU.component.CPU.Apple2Debug.toggleBootLogTrigger(this)'></i></div>"
                +"<div class=\"appbut\" onclick=\"oEMU.component.CPU.Apple2Debug.close();oCOM.POPUP.toggle('"+wrapper_id+"');\" style=\"text-align:center;float:right;\">x</div>"
                +"<div style='font-family:Arial,sans-serif;font-size:10px;line-height:18px;margin-top:3px'>"
                    +"LISTING&nbsp; Columns <input id='cpuDbg_columns' type='text' value='"+listingColumns+"' spellcheck='false' style='width:220px;font-family:monospace;font-size:10px' onchange='oEMU.component.CPU.Apple2Debug.setListingColumns(this.value)'>"
                    +"<div style='margin-left:46px'>"
                        +"<button type='button' onclick=\"oEMU.component.CPU.Apple2Debug.applyListingPreset('default')\" style='font-size:10px'>default ▦</button> "
                        +"<button type='button' onclick=\"oEMU.component.CPU.Apple2Debug.applyListingPreset('wide')\" style='font-size:10px'>wide ▦</button> "
                        +"<button type='button' onclick=\"oEMU.component.CPU.Apple2Debug.applyListingPreset('compact')\" style='font-size:10px'>compact ▦</button>"
                    +"</div>"
                +"</div>"
                +"<div id='"+body_id+"' class=marginless style='width:338px;height:180px;border:0;font-family:Arcade;font-size:7px;color:#000;white-space:nowrap;overflow:auto;'></div>"
            +"</div></div>";
    };

    this.downloadBootLog = function()
    {
        var cpu = liveCPU();
        if(!cpu || typeof(cpu.getBootLogBase64)!="function")
        {
            alert("Bootlog download is unavailable: getBootLogBase64() is missing.");
            return;
        }

        var base64 = cpu.getBootLogBase64();
        var filename = "apple2_bootlog_" + new Date().toISOString().replace(/[:.]/g,"-") + ".txt";
        var blob = new Blob([base64],{type:"text/plain;charset=utf-8"});
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    this.toggleBootLogTrigger = function(el)
    {
        var cpu = liveCPU();
        if(!cpu || typeof(cpu.BOOTparam)!="function"
            || typeof(cpu.setBootLogTrigger)!="function")
        {
            alert("Bootlog trigger is unavailable in this CPU build.");
            return;
        }

        var state = cpu.BOOTparam();
        if(state.bDebug_boot)
        {
            state = cpu.setBootLogTrigger(state.triggerAddress,state.stopAddress,false);
            updateBootTriggerIcon(el,state);
            return;
        }

        var startDef = state.triggerAddress==null ? "" : "$"+oCOM.getHexWord(state.triggerAddress);
        var startValue = prompt("Bootlog start address (blank = immediately):",startDef);
        if(startValue===null) return;

        var startAddr = null;
        if(String(startValue).trim()!=="")
        {
            startAddr = parseBootAddress(startValue);
            if(startAddr===null)
            {
                alert("Invalid start address. Use for example $6000, or leave blank.");
                return;
            }
        }

        var stopDef = state.stopAddress==null ? "" : "$"+oCOM.getHexWord(state.stopAddress);
        var stopValue = prompt("Bootlog stop address (blank = when buffer is full):",stopDef);
        if(stopValue===null) return;

        var stopAddr = null;
        if(String(stopValue).trim()!=="")
        {
            stopAddr = parseBootAddress(stopValue);
            if(stopAddr===null)
            {
                alert("Invalid stop address. Use for example $FF69, or leave blank.");
                return;
            }
        }

        state = cpu.setBootLogTrigger(startAddr,stopAddr,true);
        updateBootTriggerIcon(el,state);
    };

    this.isReady = function()
    {
        return typeof(document)!="undefined" && !!document.getElementById(this.body_id);
    };

    this.cycle = function(obj)
    {
        var cpu = obj && obj.cpu && typeof(obj.cpu.watch)=="function"
            ? obj.cpu
            : liveCPU();
        if(!cpu || !this.isReady()) return false;
        if(!ensureInit({scrollH:listingRows})) return false;

        if(typeof(cpu.BOOTparam)=="function")
            updateBootTriggerIcon(document.getElementById("cpuDbg_bootTrigger"),cpu.BOOTparam());

        var watch = cpu.watch();
        var pc = watch.pc & 0xffff;

        if(previousObservedPC!==null && previousObservedPC!==pc)
            rememberSequential(previousObservedPC,pc);

        var changed = currentPC!==pc;
        previousObservedPC = pc;
        currentPC = pc;

        if(changed || (obj && obj.force)) renderListing(pc,!!(obj && obj.force));
        syncRunIcon();
        return true;
    };

    this.setRunSpeed = function(value)
    {
        value = String(value || "system").toLowerCase();
        if(["1","10","100","1000","system"].indexOf(value)<0) value = "system";

        var wasRunning = executionRunning();
        if(runMode==="system" && systemRunning()) pauseSystem();
        stopFixedRun();
        runMode = value;

        var sel = document.getElementById("cpuDbg_speed");
        if(sel && sel.value!==runMode) sel.value = runMode;

        if(wasRunning) startExecution();
        else syncRunIcon();
        return runMode;
    };

    this.toggleRun = function(el)
    {
        if(executionRunning()) pauseExecution();
        else startExecution();
        syncRunIcon(el);
        this.cycle({cpu:liveCPU(),force:true});
    };

    // Compatibility with the old toolbar API.
    this.play = function(bPlay)
    {
        if(!!bPlay !== executionRunning()) this.toggleRun(document.getElementById("cpuDbg_play"));
    };

    this.step = function()
    {
        var machine = liveMachine();
        if(!machine || typeof(machine.stepLiveInstruction)!="function") return false;

        pauseExecution();
        var result = machine.stepLiveInstruction();
        if(result) rememberSequential(result.startPC,result.endPC);

        this.cycle({cpu:machine.cpuObj(),force:true});
        return result;
    };

    this.setListingColumns = function(value)
    {
        if(String(value || "").trim()) listingColumns = String(value).trim();
        var input = document.getElementById("cpuDbg_columns");
        if(input && input.value!==listingColumns) input.value = listingColumns;
        if(currentPC!==null) renderListing(currentPC,true);
        return listingColumns;
    };

    this.applyListingPreset = function(name)
    {
        var preset = listingColumnPresets[name];
        if(!preset) return false;
        this.setListingColumns(preset);
        return true;
    };

    this.close = function()
    {
        // Never leave an invisible debugger-owned IPS scheduler running.
        stopFixedRun();
        syncRunIcon();
    };

    // ScrollerJS compatibility feed. The CPU PC remains the anchor; legacy
    // ScrollerJS may still ask for an initial feed until EMU_apple2main.js is
    // simplified in the next cleanup pass.
    this.scrollFeed = function(curPos,linLen,cfg)
    {
        if(!ensureInit(cfg)) return [];
        var cpu = liveCPU();
        if(!cpu) return [];
        if(linLen) listingRows = linLen;
        currentPC = cpu.watch().pc & 0xffff;
        return listingWindow(currentPC,linLen || listingRows).map(function(r){return r.text});
    };

    this.liveState = function()
    {
        var cpu = liveCPU();
        return {
             "pc":cpu ? (cpu.watch().pc & 0xffff) : null
            ,"runMode":runMode
            ,"running":executionRunning()
            ,"systemRunning":systemRunning()
            ,"resumePct":resumePct
            ,"mappedBus":!!(liveHW() && typeof(liveHW().safe_read)=="function")
            ,"liveStepAPI":!!(liveMachine() && typeof(liveMachine().stepLiveInstruction)=="function")
            ,"cacheHits":cacheHits
            ,"cacheMisses":cacheMisses
            ,"domWrites":domWrites
        };
    };
}
