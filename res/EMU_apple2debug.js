//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/AppleII-IDE/main/LICENSE.md
//
// apple2debug.js
//
// STEP TRACE is an attached debugger for the *live* Apple II runtime.
// It never owns a shadow CPU or RAM image.  All execution is performed by the
// emulator's CPU/hardware/peripheral objects and all disassembly is read from
// the currently mapped CPU bus through safe_read().
//

if(oEMU===undefined) var oEMU = {"component":{"CPU":{"Apple2Debug":new Apple2Debug()}}}
else oEMU.component.CPU.Apple2Debug = new Apple2Debug();

function Apple2Debug()
{
    var dbg = this;
    var cpu_config = null;
    var max_instrlen = 3;
    var max_byte_lst = 9;
    var oDASM_debug = null;

    var listingRows = 20;
    var currentPC = null;
    var previousObservedPC = null;
    var previousBoundary = new Int32Array(0x10000);
    previousBoundary.fill(-1);

    // STEP TRACE can pause the central scheduler without losing the selected
    // SYSTEM speed.  The speed controls themselves are deliberately left for
    // the later run-control pass.
    var resumePct = 1;
    var liveTickSerial = 0;

    function liveCPU()
    {
        return typeof(apple2plus)=="object" && apple2plus
            && typeof(apple2plus.cpuObj)=="function"
                ? apple2plus.cpuObj()
                : null;
    }

    function liveHW()
    {
        return typeof(apple2plus)=="object" && apple2plus
            && typeof(apple2plus.hwObj)=="function"
                ? apple2plus.hwObj()
                : null;
    }

    function init(cfg)
    {
        var cpu = liveCPU();
        if(!cpu) return false;

        cpu_config = cpu.getConfig();
        max_instrlen = Math.max.apply(null,cpu_config.instrlen);
        max_byte_lst = 3 * max_instrlen;
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

    /*
     * Install the minimal live execution API on the current Apple2Plus instance.
     *
     * This is intentionally attached to the real machine rather than creating a
     * debugger CPU.  Each 6502 tick is paired with Apple2IO.tick(), and each
     * completed instruction slice advances video and device-cycle callbacks.
     * The API is installed lazily so EMU_apple2debug.js may still be loaded
     * before EMU_apple2plus.js in index.html.
     */
    function ensureLiveExecutionAPI()
    {
        if(typeof(apple2plus)!="object" || !apple2plus) return null;
        if(typeof(apple2plus.stepLiveInstruction)=="function") return apple2plus;

        apple2plus.runLiveCpuTicks = function(tickCount,options)
        {
            options = options || {};
            var cpu = this.cpuObj();
            var hw = this.hwObj();
            var video = typeof(this.vidObj)=="function" ? this.vidObj() : null;
            var requested = Math.max(0,Number(tickCount)|0);
            var completed = 0;

            for(var i=0;i<requested;i++)
            {
                // A one-shot execution trap consumes no emulated CPU tick.
                if(cpu.cycle()===true) break;
                hw.io.tick(liveTickSerial++);
                completed++;
            }

            if(completed>0 && options.video!==false
                && video && typeof(video.cycle)=="function")
                video.cycle(completed);

            if(options.deviceCycle!==false && hw.io
                && typeof(hw.io.cycle)=="function")
                hw.io.cycle();

            return completed;
        };

        apple2plus.stepLiveInstruction = function()
        {
            var cpu = this.cpuObj();
            var hw = this.hwObj();
            var video = typeof(this.vidObj)=="function" ? this.vidObj() : null;
            var ticks = 0;
            var guard = 0;

            function tickOnce()
            {
                if(cpu.cycle()===true) return false;
                hw.io.tick(liveTickSerial++);
                ticks++;
                return true;
            }

            // The normal scheduler may have paused between the opcode tick and
            // the instruction's remaining cycle_delay ticks.  Finish that tail
            // first so the displayed PC is a clean instruction boundary.
            while(cpu.watch().cycle_delay>0 && guard++<64)
                if(!tickOnce()) break;

            var start = cpu.watch();
            var startPC = start.pc & 0xffff;

            // Execute one complete instruction/boundary event, then drain its
            // remaining hardware cycles without fetching the following opcode.
            guard = 0;
            if(tickOnce())
                while(cpu.watch().cycle_delay>0 && guard++<64)
                    if(!tickOnce()) break;

            if(ticks>0 && video && typeof(video.cycle)=="function")
                video.cycle(ticks);
            if(hw.io && typeof(hw.io.cycle)=="function")
                hw.io.cycle();

            return {
                 "startPC":startPC
                ,"endPC":cpu.watch().pc & 0xffff
                ,"ticks":ticks
                ,"state":cpu.watch()
            };
        };

        return apple2plus;
    }

    function decodeAt(addr)
    {
        if(!ensureInit()) return null;
        var hw = liveHW();
        if(!hw || typeof(hw.safe_read)!="function") return null;

        addr &= 0xffff;

        // All three bytes come from the *mapped* CPU bus.  Never mix a 48K
        // physical RAM snapshot with ROM/slot/language-card reads.
        var b0 = hw.safe_read(addr);
        var b1 = hw.safe_read((addr+1)&0xffff);
        var b2 = hw.safe_read((addr+2)&0xffff);
        var len = cpu_config.instrlen[b0] || 1;
        var ret = oDASM_debug.disassemble({
             "code_arr":[b0,b1,b2]
            ,"pc":addr
            ,"opctab":cpu_config.opctab
        });

        return {
             "addr":addr
            ,"b0":b0,"b1":b1,"b2":b2
            ,"len":len
            ,"next":(addr+len)&0xffff
            ,"ret":ret
        };
    }

    function formatDecoded(d,isCurrent)
    {
        if(!d) return "";
        var line = oCOM.padding(
            [d.ret.adr_lst,d.ret.opcode_lst,d.ret.mnemonic],
            [5,max_byte_lst]
        );
        return isCurrent
            ? "<span class='cpuDbg_currentPC' style='font-weight:bold'>▶ "+line+"</span>"
            : "&nbsp;&nbsp;"+line;
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

    function predecessorOf(addr)
    {
        addr &= 0xffff;

        var known = previousBoundary[addr];
        if(known>=0)
        {
            var kd = decodeAt(known);
            if(kd && kd.next===addr) return known;
            previousBoundary[addr] = -1; // bytes/mapping changed: discard stale edge
        }

        // 6502 instructions are 1..3 bytes.  A backward decode is accepted only
        // when exactly one candidate lands on the known boundary.  Ambiguity is
        // never allowed to derail the current PC or the forward listing.
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

        var rows = new Array(count);
        var adr = start;
        for(var row=0;row<count;row++)
        {
            var d = decodeAt(adr);
            if(!d)
            {
                rows.length = row;
                break;
            }

            rows[row] = formatDecoded(d,adr===pc);

            // Forward decoding from a known instruction boundary is exact and
            // can safely teach the local predecessor map.
            previousBoundary[d.next] = adr;
            adr = d.next;
        }
        return rows;
    }

    function renderListing(pc)
    {
        var el = document.getElementById(dbg.body_id);
        if(!el) return false;
        var rows = listingWindow(pc,listingRows);
        el.innerHTML = rows.join("<br>");
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

    function schedulerRunning()
    {
        return typeof(_o)!="undefined" && Number(_o.CPU_TargetTicks_s)>0;
    }

    function syncRunIcon(el)
    {
        el = el || document.getElementById("cpuDbg_play");
        if(!el || !el.classList) return;
        var running = schedulerRunning();
        el.classList.toggle("fa-pause",running);
        el.classList.toggle("fa-play",!running);
        el.title = running ? "pause CPU execution" : "continue CPU execution";
    }

    this.html = function(body_id,wrapper_id)
    {
        this.body_id = body_id;
        oCOM.POPUP.set_state(wrapper_id,true);
        return "<div class=appbox style='text-align:left;height:250px;width:300px;padding:0px 0px 0px 1px;margin:0px'>"
            +"<div class=marginless style='border:0px solid #E0E0E0'>"
                +"STEP TRACE "
                +"<i id=cpuDbg_play class='fa fa-pause' title='pause CPU execution' onclick='oEMU.component.CPU.Apple2Debug.toggleRun(this)'></i>&nbsp;"
                +"<i class='fa fa-sign-in-alt' title='step one live instruction' onclick='oEMU.component.CPU.Apple2Debug.step()'></i>&nbsp;"
                +"<i class='fa fa-paw' style='opacity:.35' title='step over (next refactor pass)'></i>&nbsp;"
                +"<i class='fa fa-sign-out-alt' style='opacity:.35' title='step out (next refactor pass)'></i>&nbsp;"
                +"<div class='appbut skinny' onclick='oEMU.component.CPU.Apple2Debug.downloadBootLog()'><i class='fa fa-shoe-prints' title='download bootlog'></i></div>&nbsp;"
                +"<div class='appbut skinny'><i id='cpuDbg_bootTrigger' class='fa fa-coffee' style='opacity:.35' title='bootlog trigger disabled' onclick='oEMU.component.CPU.Apple2Debug.toggleBootLogTrigger(this)'></i></div>"
                +"<div class=\"appbut\" onclick=\"oCOM.POPUP.toggle('"+wrapper_id+"');\" style=\"text-align:center;float:right;\">x</div>"
                +"<div id='"+body_id+"' class=marginless style='width:299px;height:180px;border:0;font-family:Arcade;font-size:7px;color:#000;white-space:nowrap;overflow:auto;'></div>"
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

        // Learn a predecessor only when the two sampled PCs really are a
        // sequential instruction edge.  Large run slices/jumps simply teach no
        // edge; they never force a guessed alignment.
        if(previousObservedPC!==null && previousObservedPC!==pc)
            rememberSequential(previousObservedPC,pc);

        previousObservedPC = pc;
        currentPC = pc;
        renderListing(pc);
        syncRunIcon();
        return true;
    };

    this.toggleRun = function(el)
    {
        if(schedulerRunning())
        {
            var base = Number(_o.CPU_ClocksTicks_s) || 1;
            var target = Number(_o.CPU_TargetTicks_s) || 0;
            if(target>0) resumePct = target/base;
            oEMUI.cpuSpd(0);
        }
        else
            oEMUI.cpuSpd(resumePct>0 ? resumePct : 1);

        syncRunIcon(el);
        this.cycle({cpu:liveCPU()});
    };

    // Compatibility with the previous toolbar API.
    this.play = function(bPlay)
    {
        if(!!bPlay !== schedulerRunning()) this.toggleRun(document.getElementById("cpuDbg_play"));
    };

    this.step = function()
    {
        var machine = ensureLiveExecutionAPI();
        if(!machine) return false;

        // Instruction stepping owns execution; stop only the central timer's
        // CPU budget, retaining its selected SYSTEM multiplier for Continue.
        if(schedulerRunning())
        {
            var base = Number(_o.CPU_ClocksTicks_s) || 1;
            var target = Number(_o.CPU_TargetTicks_s) || 0;
            if(target>0) resumePct = target/base;
            oEMUI.cpuSpd(0);
        }

        var result = machine.stepLiveInstruction();
        if(result)
            rememberSequential(result.startPC,result.endPC);

        this.cycle({cpu:machine.cpuObj()});
        return result;
    };

    // ScrollerJS compatibility feed.  curPos is deliberately *not* interpreted
    // as a byte address anymore.  The live PC is the hard instruction boundary
    // and every visible row is reconstructed from that anchor.
    this.scrollFeed = function(curPos,linLen,cfg)
    {
        if(!ensureInit(cfg)) return [];
        var cpu = liveCPU();
        if(!cpu) return [];
        if(linLen) listingRows = linLen;
        currentPC = cpu.watch().pc & 0xffff;
        return listingWindow(currentPC,linLen || listingRows);
    };

    // Small diagnostics surface for console/tests without exposing mutable maps.
    this.liveState = function()
    {
        var cpu = liveCPU();
        return {
             "pc":cpu ? (cpu.watch().pc & 0xffff) : null
            ,"running":schedulerRunning()
            ,"resumePct":resumePct
            ,"mappedBus":!!(liveHW() && typeof(liveHW().safe_read)=="function")
            ,"liveStepAPI":!!(typeof(apple2plus)=="object" && apple2plus && typeof(apple2plus.stepLiveInstruction)=="function")
        };
    };
}
