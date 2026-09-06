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

    // Keep STEP TRACE on the same Unicode-capable mono stack as the assembler
    // Source/Listing panes.  In particular DejaVu Sans Mono contains the box/
    // line-drawing glyphs that the Arcade bitmap font does not provide.
    var listingFontFamily = '"DejaVu Sans Mono","Menlo","Consolas","Courier New",monospace';
    var listingFontSize = 9;

    // The listing has two independent modes:
    //   followPC=true  : CPU activity owns the viewport and keeps PC visible.
    //   followPC=false : the user owns a top-row instruction address.
    // Manual navigation never guesses a byte offset; it walks decoded
    // instruction boundaries only.
    var followPC = true;
    var manualTop = null;
    var lastViewTop = null;
    var rowPixelHeight = 12;

    // Run control. "system" delegates execution to the central emulator speed;
    // fixed IPS modes own instruction scheduling while the SYSTEM timer is paused.
    var runMode = "system";
    var fixedRunning = false;
    var runTimer = null;
    var resumePct = 1;

    // Step Over/Out are temporary debugger-owned runs.  They execute only live
    // Apple2Plus instructions, stop on exact instruction boundaries, and leave
    // the CPU paused when the requested boundary has been reached.
    var boundaryAction = null;

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
        var sanitized = String(text==null ? "" : text)
            .replace(/&nbsp;/gi," ")
            .replace(/&lt;/gi,"<")
            .replace(/&gt;/gi,">")
            .replace(/&amp;/gi,"&");

        var previous;
        do {
            previous = sanitized;
            sanitized = sanitized.replace(/<[^>]*>/g,"");
        } while (sanitized !== previous);

        return sanitized
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

    function safeWord(addr)
    {
        var hw = liveHW();
        if(!hw || typeof(hw.safe_read)!="function") return null;
        addr &= 0xffff;
        return (hw.safe_read(addr) | (hw.safe_read((addr+1)&0xffff)<<8)) & 0xffff;
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
        // candidate lands on the known instruction boundary. Ambiguity stops
        // upward navigation rather than inventing an alignment.
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

    function forwardWindow(start,pc,count)
    {
        start &= 0xffff;
        pc &= 0xffff;
        count = Math.max(1,Number(count)|0 || listingRows);

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

            // Forward disassembly starts from a known instruction boundary, so
            // every successor is safe to remember as a predecessor edge.
            previousBoundary[d.next] = adr;
            adr = d.next;
        }
        return rows;
    }

    function followWindow(pc,count)
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
        return forwardWindow(start,pc,count);
    }

    function listingWindow(pc,count)
    {
        if(followPC || manualTop===null)
            return followWindow(pc,count);
        return forwardWindow(manualTop,pc,count);
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
            row.style.height = rowPixelHeight+"px";
            row.style.lineHeight = rowPixelHeight+"px";
            row.style.whiteSpace = "pre";
            row.style.fontFamily = "inherit";
            row.style.fontKerning = "none";
            row.style.fontVariantLigatures = "none";
            row._cpuDbgText = null;
            row._cpuDbgCurrent = null;
            el.appendChild(row);
            pool[i] = row;
        }
        el._cpuDbgRowPool = pool;
        return pool;
    }

    function syncFollowControl()
    {
        var input = document.getElementById("cpuDbg_followPc");
        if(input && input.checked!==followPC) input.checked = followPC;
    }

    function boundaryActionText()
    {
        if(!boundaryAction) return "";
        if(boundaryAction.type==="over")
            return "  OVER→$"+oCOM.getHexWord(boundaryAction.returnPC);
        return "  OUT J"+boundaryAction.jsrDepth+" I"+boundaryAction.irqDepth;
    }

    function updateNavigationStatus(pc)
    {
        var el = document.getElementById("cpuDbg_navStatus");
        if(!el) return;

        var top = lastViewTop==null ? pc : lastViewTop;
        el.textContent = "TOP $"+oCOM.getHexWord(top)+"  PC $"+oCOM.getHexWord(pc)+boundaryActionText();
        el.title = followPC
            ? "Listing follows the live program counter"
            : "Manual instruction-row view; enable Follow PC to resume tracking";
    }

    function renderListing(pc,force)
    {
        var pool = ensureRowPool();
        if(!pool) return false;
        var rows = listingWindow(pc,listingRows);

        lastViewTop = rows.length ? rows[0].addr : null;
        if(!followPC && manualTop===null && lastViewTop!==null)
            manualTop = lastViewTop;

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
                node.style.fontWeight = data.current ? "700" : "500";
                node.style.textDecoration = data.current ? "underline" : "none";
                node._cpuDbgCurrent = !!data.current;
            }
        }

        syncFollowControl();
        updateNavigationStatus(pc);
        return true;
    }

    function setFollowState(enabled,renderNow)
    {
        enabled = !!enabled;

        if(enabled)
        {
            followPC = true;
            manualTop = null;
        }
        else
        {
            if(followPC)
            {
                var cpu = liveCPU();
                var pc = cpu ? (cpu.watch().pc & 0xffff) : (currentPC==null ? 0 : currentPC);
                if(lastViewTop===null)
                {
                    var rows = followWindow(pc,listingRows);
                    lastViewTop = rows.length ? rows[0].addr : pc;
                }
                manualTop = lastViewTop;
            }
            followPC = false;
        }

        syncFollowControl();
        if(renderNow && currentPC!==null) renderListing(currentPC,true);
        return followPC;
    }

    function bindNavigation()
    {
        var el = document.getElementById(dbg.body_id);
        if(!el || el._cpuDbgNavigationBound) return;
        el._cpuDbgNavigationBound = true;
        el.tabIndex = 0;
        el.title = "Instruction navigation: mouse wheel, ↑/↓, Page Up/Down. Home returns to Follow PC. F10=Over, F11=In, Shift+F11=Out.";

        el.addEventListener("wheel",function(event)
        {
            event.preventDefault();
            var page = event.shiftKey ? Math.max(1,listingRows-1) : 1;
            dbg.navigateRows(event.deltaY<0 ? -page : page);
        },{passive:false});

        el.addEventListener("keydown",function(event)
        {
            var handled = true;
            switch(event.key)
            {
                case "ArrowUp":   dbg.navigateRows(-1); break;
                case "ArrowDown": dbg.navigateRows(1); break;
                case "PageUp":    dbg.navigateRows(-Math.max(1,listingRows-1)); break;
                case "PageDown":  dbg.navigateRows(Math.max(1,listingRows-1)); break;
                case "Home":      dbg.setFollowPC(true); break;
                case "F10":       dbg.stepOver(); break;
                case "F11":       event.shiftKey ? dbg.stepOut() : dbg.step(); break;
                case "f":
                case "F":         dbg.setFollowPC(!followPC); break;
                default: handled = false;
            }

            if(handled)
            {
                event.preventDefault();
                event.stopPropagation();
            }
        });

        el.addEventListener("pointerdown",function(){ el.focus(); });

        el.addEventListener("touchstart",function(event)
        {
            if(!event.changedTouches || !event.changedTouches.length) return;
            el._cpuDbgTouchY = event.changedTouches[0].clientY;
        },{passive:true});

        el.addEventListener("touchmove",function(event)
        {
            if(!event.changedTouches || !event.changedTouches.length
                || !Number.isFinite(el._cpuDbgTouchY)) return;

            var y = event.changedTouches[0].clientY;
            var delta = el._cpuDbgTouchY-y;
            var rows = delta<0 ? Math.ceil(delta/rowPixelHeight) : Math.floor(delta/rowPixelHeight);
            if(rows!==0)
            {
                event.preventDefault();
                dbg.navigateRows(rows);
                el._cpuDbgTouchY = y;
            }
        },{passive:false});

        el.addEventListener("touchend",function(){ el._cpuDbgTouchY = null; },{passive:true});
        el.addEventListener("touchcancel",function(){ el._cpuDbgTouchY = null; },{passive:true});
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
        // CPU_TargetTicks_s is only a configured target. The main Pause button
        // clears appleIntervalHandle without changing that target, so include
        // the real scheduler state as well.
        return typeof(_o)!="undefined"
            && Number(_o.CPU_TargetTicks_s)>0
            && typeof(appleIntervalHandle)!="undefined"
            && appleIntervalHandle!=null;
    }

    function executionRunning()
    {
        return boundaryAction!==null || fixedRunning || (runMode==="system" && systemRunning());
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

    function stopBoundaryAction()
    {
        boundaryAction = null;
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
            default:      return {batch:0,delay:0,label:"Max (SYSTEM)"};
        }
    }

    // Temporary Over/Out runs honour the selected fixed IPS modes. In SYSTEM
    // mode they use cooperative live-instruction bursts so an exact boundary can
    // still be intercepted without freezing the browser.
    function boundarySpeedConfig()
    {
        if(runMode==="system") return {batch:250,delay:0,label:"Max boundary run"};
        return runSpeedConfig(runMode);
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
        if(!fixedRunning || runMode==="system" || boundaryAction) return;
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

        dbg.cycle({cpu:machine.cpuObj()});

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
        stopBoundaryAction();
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
        stopBoundaryAction();
        stopFixedRun();
        if(runMode==="system") pauseSystem();
        syncRunIcon();
    }

    function externalInterruptBoundary(before,one,opcode)
    {
        if(!before || !one || !one.state || opcode===0x00) return false;
        var spDrop = ((before.sp & 0xff)-(one.state.sp & 0xff)) & 0xff;
        if(spDrop!==3) return false;

        var endPC = one.endPC & 0xffff;
        var nmi = safeWord(0xfffa);
        var irq = safeWord(0xfffe);
        return (nmi!==null && endPC===nmi) || (irq!==null && endPC===irq);
    }

    function boundaryActionStopped(action,before,opcode,one)
    {
        if(action.type==="over")
        {
            return (one.endPC & 0xffff)===action.returnPC
                && (one.state.sp & 0xff)===action.startSP;
        }

        // Step Out follows the live control-flow events from the point where the
        // user asked to leave the current routine. JSR/RTS depth is relative to
        // that point, so local PHA/PLA use does not confuse it. BRK/external
        // interrupts get their own nesting depth and are passed through by RTI.
        if(opcode===0x00 || externalInterruptBoundary(before,one,opcode))
        {
            action.irqDepth++;
            return false;
        }

        if(opcode===0x20)
        {
            action.jsrDepth++;
            return false;
        }

        if(opcode===0x60)
        {
            if(action.jsrDepth>0)
            {
                action.jsrDepth--;
                return false;
            }
            return action.irqDepth===0;
        }

        if(opcode===0x40)
        {
            if(action.irqDepth>0)
            {
                action.irqDepth--;
                return false;
            }
            // If Step Out began inside an interrupt handler, its own RTI is the
            // equivalent of the current routine's return boundary.
            return action.jsrDepth===0;
        }

        return false;
    }

    function finishBoundaryAction()
    {
        stopBoundaryAction();
        var cpu = liveCPU();
        if(cpu) dbg.cycle({cpu:cpu,force:true});
        syncRunIcon();
    }

    function scheduleBoundaryAction(delay)
    {
        clearRunTimer();
        runTimer = window.setTimeout(boundaryActionLoop,Math.max(0,delay|0));
    }

    function boundaryActionLoop()
    {
        var action = boundaryAction;
        var machine = liveMachine();
        var cpu = liveCPU();
        if(!action || !machine || !cpu || typeof(machine.stepLiveInstruction)!="function")
        {
            finishBoundaryAction();
            return;
        }

        var cfg = boundarySpeedConfig();
        var completed = 0;
        var stopped = false;

        for(var i=0;i<cfg.batch && boundaryAction===action;i++)
        {
            var before = cpu.watch();
            var startPC = before.pc & 0xffff;
            var decoded = decodeAt(startPC);
            var opcode = decoded ? decoded.b0 : null;

            var one = machine.stepLiveInstruction();
            if(!one || one.stalled || one.ticks<=0) break;

            completed++;
            action.instructions++;
            rememberSequential(one.startPC,one.endPC);

            if(boundaryActionStopped(action,before,opcode,one))
            {
                stopped = true;
                break;
            }
        }

        dbg.cycle({cpu:cpu});

        if(stopped || completed===0)
        {
            finishBoundaryAction();
            return;
        }

        scheduleBoundaryAction(cfg.delay);
    }

    function startBoundaryAction(action)
    {
        pauseExecution();
        boundaryAction = action;
        syncRunIcon();
        if(currentPC!==null) renderListing(currentPC,true);
        scheduleBoundaryAction(0);
        return action;
    }

    this.html = function(body_id,wrapper_id)
    {
        this.body_id = body_id;
        oCOM.POPUP.set_state(wrapper_id,true);
        return "<div class=appbox style='text-align:left;height:auto;min-height:355px;width:340px;padding:0 0 0 1px;margin:0'>"
            +"<div class=marginless style='border:0'>"
                +"STEP TRACE "
                +"<i id=cpuDbg_play class='fa fa-pause' title='pause CPU execution' onclick='oEMU.component.CPU.Apple2Debug.toggleRun(this)'></i>&nbsp;"
                +"<i class='fa fa-sign-in-alt' title='step one live instruction (F11)' onclick='oEMU.component.CPU.Apple2Debug.step()'></i>&nbsp;"
                +"<i class='fa fa-paw' title='step over JSR/BRK (F10)' onclick='oEMU.component.CPU.Apple2Debug.stepOver()'></i>&nbsp;"
                +"<i class='fa fa-sign-out-alt' title='step out of current routine (Shift+F11)' onclick='oEMU.component.CPU.Apple2Debug.stepOut()'></i>&nbsp;"
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
                    +"<label><input id='cpuDbg_followPc' type='checkbox' checked onchange='oEMU.component.CPU.Apple2Debug.setFollowPC(this.checked)'> Follow PC</label>"
                    +"&nbsp; NAV "
                    +"<button type='button' title='Previous instruction' onclick='oEMU.component.CPU.Apple2Debug.navigateRows(-1)' style='font-size:10px'>▲</button>"
                    +"<button type='button' title='Next instruction' onclick='oEMU.component.CPU.Apple2Debug.navigateRows(1)' style='font-size:10px'>▼</button>"
                    +"<button type='button' title='Page up' onclick='oEMU.component.CPU.Apple2Debug.navigatePage(-1)' style='font-size:10px'>Pg↑</button>"
                    +"<button type='button' title='Page down' onclick='oEMU.component.CPU.Apple2Debug.navigatePage(1)' style='font-size:10px'>Pg↓</button>"
                    +"<button type='button' title='Return to live PC and resume following' onclick='oEMU.component.CPU.Apple2Debug.setFollowPC(true)' style='font-size:10px'>PC</button>"
                    +"<span id='cpuDbg_navStatus' style='margin-left:5px;font-family:"+listingFontFamily+"'></span>"
                    +"<br>LISTING&nbsp; Columns <input id='cpuDbg_columns' type='text' value='"+listingColumns+"' spellcheck='false' style='width:220px;font-family:"+listingFontFamily+";font-size:10px' onchange='oEMU.component.CPU.Apple2Debug.setListingColumns(this.value)'>"
                    +"<div style='margin-left:46px'>"
                        +"<button type='button' onclick=\"oEMU.component.CPU.Apple2Debug.applyListingPreset('default')\" style='font-size:10px'>default ▦</button> "
                        +"<button type='button' onclick=\"oEMU.component.CPU.Apple2Debug.applyListingPreset('wide')\" style='font-size:10px'>wide ▦</button> "
                        +"<button type='button' onclick=\"oEMU.component.CPU.Apple2Debug.applyListingPreset('compact')\" style='font-size:10px'>compact ▦</button>"
                    +"</div>"
                +"</div>"
                +"<div id='"+body_id+"' class=marginless style='width:338px;height:"+(listingRows*rowPixelHeight)+"px;border:0;font-family:"+listingFontFamily+";font-size:"+listingFontSize+"px;font-weight:500;font-kerning:none;font-variant-ligatures:none;color:#000;white-space:nowrap;overflow-x:auto;overflow-y:hidden;touch-action:none;'></div>"
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

    this.open = function()
    {
        var cpu = liveCPU();
        if(!cpu || !this.isReady()) return false;
        if(!ensureInit({scrollH:listingRows})) return false;

        bindNavigation();

        var sel = document.getElementById("cpuDbg_speed");
        if(sel) sel.value = runMode;
        var input = document.getElementById("cpuDbg_columns");
        if(input) input.value = listingColumns;

        currentPC = cpu.watch().pc & 0xffff;
        previousObservedPC = currentPC;
        renderListing(currentPC,true);
        syncRunIcon();

        if(typeof(cpu.BOOTparam)=="function")
            updateBootTriggerIcon(document.getElementById("cpuDbg_bootTrigger"),cpu.BOOTparam());

        return true;
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

        if(followPC)
        {
            if(changed || (obj && obj.force) || boundaryAction)
                renderListing(pc,!!(obj && obj.force));
        }
        else
        {
            // In manual mode keep the viewport fixed while still revalidating
            // its mapped bytes, so self-modifying code remains visible live.
            renderListing(pc,!!(obj && obj.force));
        }

        syncRunIcon();
        return true;
    };

    this.setFollowPC = function(enabled)
    {
        return setFollowState(enabled,true);
    };

    this.navigateRows = function(delta)
    {
        delta = Number(delta)|0;
        if(delta===0) return 0;
        var cpu = liveCPU();
        if(!cpu || !ensureInit({scrollH:listingRows})) return 0;

        var pc = cpu.watch().pc & 0xffff;
        currentPC = pc;

        if(followPC) setFollowState(false,false);
        if(manualTop===null) manualTop = lastViewTop===null ? pc : lastViewTop;

        var adr = manualTop;
        var wanted = Math.abs(delta);
        var dir = delta<0 ? -1 : 1;
        var moved = 0;

        for(var i=0;i<wanted;i++)
        {
            if(dir>0)
            {
                var d = decodeAt(adr);
                if(!d) break;
                previousBoundary[d.next] = adr;
                adr = d.next;
            }
            else
            {
                var prev = predecessorOf(adr);
                if(prev<0) break;
                adr = prev;
            }
            moved++;
        }

        if(moved>0) manualTop = adr;
        renderListing(pc,true);
        return moved*dir;
    };

    this.navigatePage = function(direction)
    {
        direction = Number(direction)<0 ? -1 : 1;
        return this.navigateRows(direction*Math.max(1,listingRows-1));
    };

    this.setRunSpeed = function(value)
    {
        value = String(value || "system").toLowerCase();
        if(["1","10","100","1000","system"].indexOf(value)<0) value = "system";

        // A temporary Over/Out run can change speed in place without losing its
        // boundary target.
        if(boundaryAction)
        {
            runMode = value;
            var actionSel = document.getElementById("cpuDbg_speed");
            if(actionSel && actionSel.value!==runMode) actionSel.value = runMode;
            return runMode;
        }

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

    this.stepOver = function()
    {
        var cpu = liveCPU();
        var machine = liveMachine();
        if(!cpu || !machine || typeof(machine.stepLiveInstruction)!="function") return false;
        if(!ensureInit({scrollH:listingRows})) return false;

        var state = cpu.watch();
        var pc = state.pc & 0xffff;
        var d = decodeAt(pc);
        if(!d) return false;

        // JSR and BRK are call-like on the 6502. For every other opcode, Step
        // Over is exactly one Step In.
        if(d.b0!==0x20 && d.b0!==0x00)
            return this.step();

        return startBoundaryAction({
             "type":"over"
            ,"returnPC":d.next & 0xffff
            ,"startSP":state.sp & 0xff
            ,"instructions":0
        });
    };

    this.stepOut = function()
    {
        var cpu = liveCPU();
        var machine = liveMachine();
        if(!cpu || !machine || typeof(machine.stepLiveInstruction)!="function") return false;
        if(!ensureInit({scrollH:listingRows})) return false;

        return startBoundaryAction({
             "type":"out"
            ,"jsrDepth":0
            ,"irqDepth":0
            ,"instructions":0
        });
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
        // Never leave an invisible debugger-owned IPS or boundary run active.
        stopBoundaryAction();
        stopFixedRun();
        syncRunIcon();
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
            ,"followPC":followPC
            ,"viewTop":lastViewTop
            ,"boundaryAction":boundaryAction ? {
                 "type":boundaryAction.type
                ,"returnPC":boundaryAction.returnPC===undefined ? null : boundaryAction.returnPC
                ,"jsrDepth":boundaryAction.jsrDepth===undefined ? null : boundaryAction.jsrDepth
                ,"irqDepth":boundaryAction.irqDepth===undefined ? null : boundaryAction.irqDepth
                ,"instructions":boundaryAction.instructions
            } : null
            ,"listingFont":listingFontFamily
            ,"mappedBus":!!(liveHW() && typeof(liveHW().safe_read)=="function")
            ,"liveStepAPI":!!(liveMachine() && typeof(liveMachine().stepLiveInstruction)=="function")
            ,"cacheHits":cacheHits
            ,"cacheMisses":cacheMisses
            ,"domWrites":domWrites
        };
    };
}
