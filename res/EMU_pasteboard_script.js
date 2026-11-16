/*
 * PASTEBOARD SCRIPT — user-facing automation IDE and emulator API adapter.
 *
 * Trusted user-authored macros execute directly in the page with async/await.
 * They reuse the existing Apple2IO device model without a Worker or a second
 * CPU scheduler. STOP cooperatively cancels pending waits and future actions.
 */
(function (g) {
    "use strict";

    var D = g.document, currentRun = null, generation = 0, terminal = null;
    var POPUP = "EMU_pasteboardScriptPopup";
    // Same zlib/Deflate + Base64URL encoding used by index.html?asm=.
    var MAX_SCRIPT_BYTES = 65536, MAX_COMPRESSED_CHARS = 32768;
    var uriImportHandled = false;
    var DEFAULT_SCRIPT = [
        "// PASTEBOARD SCRIPT — Ctrl/Cmd+Enter to run",
        "// Start at the Apple II Applesoft BASIC ] prompt.",
        "// Optional: await apple.script.hide(); // Reveal the Apple II screen",
        "console.log('Typing PRINT 6*7 through PASTEBO...');",
        "await apple.text.type('PRINT 6*7\\r');",
        "console.log('Waiting for the computed result 42...');",
        "console.log(await apple.text.waitFor('42', {timeout:10000}));",
        "console.log(await apple.memory.dump(0x0400, 32));",
        "// Optional: await apple.script.show(); // Restore the IDE"
    ].join("\n");

    // Uses Bitsy Bye's visible boot-menu prompt rather than requiring
    // continuous $C000 polling, which is not guaranteed by that menu.
    // A2KBD still serializes arrow/RETURN input through the guest strobe.
    var PRODOS_BOOT_SCRIPT = [
        "// ProDOS 8 embedded-offline boot demonstration (DISKII S6,D1)",
        "// Requires an Apple II configuration with DISKII in physical S6.",
        "await apple.script.hide();",
        "try {",
        "  await apple.cpu.setSpeed(400); // 4× CPU throttle for boot",
        "  console.log('Mounting embedded ProDOS 8 image in S6,D1...');",
        "  console.log(await apple.disk.loadOffline({",
        "    slot: 6, drive: 1, path: 'disks/ProDOS 8.dsk'",
        "  }));",
        "  await apple.reboot();",
        "  console.log('Waiting for the Bitsy Bye boot-menu prompt...');",
        "  await apple.text.waitForReady({",
        "    prompt: /RETURN\\s*:/i, timeout: 60000",
        "  });",
        "  console.log('Boot menu visible; keyboard:', await apple.text.status());",
        "  // Apple II right-arrow = $15 (CTRL-U); RETURN = $0D.",
        "  await apple.text.type('\\x15\\x15\\r');",
        "  await apple.text.waitForDrain({timeout:20000});",
        "  console.log('Waiting for the BASIC.SYSTEM prompt...');",
        "  await apple.text.waitForReady({",
        "    prompt: /(?:^|\\n)\\s*]/, timeout: 60000",
        "  });",
        "  await apple.text.type('PRINT \"HELLO WORLD\"\\r');",
        "  await apple.text.waitForDrain({timeout:20000});",
        "  await apple.text.waitFor(/(?:^|\\n)\\s*HELLO WORLD\\s*(?:\\n|$)/i, {",
        "    timeout: 15000",
        "  });",
        "  console.log('BASIC.SYSTEM demonstration complete.');",
        "} finally {",
        "  await apple.cpu.setSpeed(100); // restore normal CPU speed",
        "  await apple.script.show();",
        "}"
    ].join("\n");

    function ensureCompression()
    {
        if(!g.pako || typeof g.pako.deflate!=="function" ||
           typeof g.pako.Inflate!=="function")
            throw new Error("Deflate compression library (pako) is unavailable.");
        if(typeof g.TextEncoder!=="function" || typeof g.TextDecoder!=="function" ||
           typeof g.btoa!=="function" || typeof g.atob!=="function")
            throw new Error("Browser text/Base64 codecs are unavailable.");
    }

    function encodeCompressedScript(source)
    {
        ensureCompression();
        var text=String(source==null ? "" : source);
        var bytes=new g.TextEncoder().encode(text);
        if(!text.trim() || !bytes.length || bytes.length>MAX_SCRIPT_BYTES)
            throw new RangeError("Script must be nonempty and at most 64 KiB.");
        var packed=g.pako.deflate(bytes,{level:9}), binary="";
        for(var i=0;i<packed.length;i+=8192)
            binary+=String.fromCharCode.apply(null,packed.subarray(i,i+8192));
        var value=g.btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
        if(value.length>MAX_COMPRESSED_CHARS)
            throw new RangeError("Compressed script is too long for a URI.");
        return value;
    }

    function decodeCompressedScript(value)
    {
        ensureCompression();
        // Match the existing ?asm= zlib/Deflate + Base64 link format.
        // URL-safe, unpadded Base64 is preferred, but standard Base64 is
        // accepted, including + characters changed to spaces by URL parsing.
        var data=String(value==null ? "" : value);
        if(!data || data.length>MAX_COMPRESSED_CHARS)
            throw new RangeError("Invalid or oversized pscript parameter.");
        data=data.replace(/\s/g,"+").replace(/-/g,"+").replace(/_/g,"/");
        if(!/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length%4===1)
            throw new Error("Invalid Base64 pscript payload.");
        data+="===".slice(0,(4-data.length%4)%4);
        var binary=g.atob(data), compressed=Uint8Array.from(binary,function(c) {
            return c.charCodeAt(0);
        });

        // Stream decoded chunks so a small malicious compression bomb cannot
        // allocate an arbitrarily large script before the size check.
        var inflater=new g.pako.Inflate({chunkSize:8192});
        var parts=[],size=0;
        inflater.onData=function(chunk) {
            size+=chunk.length;
            if(size>MAX_SCRIPT_BYTES)
                throw new RangeError("Expanded pscript exceeds 64 KiB.");
            parts.push(chunk);
        };
        inflater.push(compressed,true);
        if(inflater.err || !inflater.ended)
            throw new Error("Invalid Deflate pscript payload: "+(inflater.msg || "incomplete data"));
        if(!size)throw new Error("Empty pscript payload.");
        var bytes=new Uint8Array(size),offset=0;
        parts.forEach(function(part){bytes.set(part,offset);offset+=part.length;});
        var decoded=new g.TextDecoder("utf-8",{fatal:true}).decode(bytes);
        if(!decoded.trim())throw new Error("Empty pscript source.");
        return decoded;
    }

    function currentScriptURI()
    {
        var editor=el("EMU_pasteboardScriptEditor");
        if(!editor)throw new Error("Open the Script IDE before sharing a URI.");
        if(!g.URL || !g.location)
            throw new Error("Browser URL APIs are unavailable.");
        var url=new g.URL(g.location.href);
        url.searchParams.set("pscript",encodeCompressedScript(editor.value));
        return url.toString();
    }

    function shareURI()
    {
        var url;
        try { url=currentScriptURI(); }
        catch(error) {
            log("ERROR creating script URI: "+(error.message || String(error)),"error");
            return Promise.resolve(false);
        }
        if(g.navigator && g.navigator.clipboard &&
           typeof g.navigator.clipboard.writeText==="function")
            return g.navigator.clipboard.writeText(url).then(function(){
                log("Compressed script URI copied to clipboard ("+url.length+" characters).","result");
                return true;
            }).catch(function(error){
                log("Clipboard failed: "+(error.message || error)+". URI: "+url,"error");
                return false;
            });
        log("Copy this URI: "+url,"info");
        return Promise.resolve(false);
    }

    function importScriptFromURI()
    {
        if(uriImportHandled) return false;
        uriImportHandled=true;
        if(!g.location || !g.URLSearchParams) return false;
        var params=new g.URLSearchParams(g.location.search || "");
        if(!params.has("pscript"))return false;
        try {
            var source=decodeCompressedScript(params.get("pscript"));
            makePopup();
            el("EMU_pasteboardScriptEditor").value=source;
            open();
            log("Imported compressed script from ?pscript= (not executed).","info");
            return true;
        } catch(error) {
            makePopup();
            open();
            setStatus("error");
            log("ERROR importing ?pscript=: "+(error.message || String(error)),"error");
            return false;
        }
    }

    function el(id) { return D && D.getElementById(id); }
    function io() {
        var machine = g.apple2plus;
        if(!machine || typeof machine.hwObj !== "function")
            throw new Error("Apple II emulator is not ready.");
        var hardware = machine.hwObj();
        if(!hardware || !hardware.io) throw new Error("Apple2IO is not ready.");
        return hardware.io;
    }
    function pasteboard(router) {
        var endpoint = router && typeof router.pipeResolve === "function"
            ? router.pipeResolve("0:PASTEBO:text") : null;
        if(!endpoint || !endpoint.device)
            throw new Error("PASTEBO device is not mounted.");
        return endpoint.device;
    }
    function hex(value, width) {
        return "$" + ("0000" + value.toString(16).toUpperCase()).slice(-width);
    }
    function address(value) {
        var n = typeof value === "string" && /^\\$[0-9a-f]{1,4}$/i.test(value)
            ? parseInt(value.slice(1), 16) : Number(value);
        if(!Number.isInteger(n) || n < 0 || n > 0xFFFF)
            throw new RangeError("Address must be between $0000 and $FFFF.");
        return n;
    }
    function memory(start, length) {
        var a = address(start), n = Number(length);
        if(!Number.isInteger(n) || n < 0 || n > 65536 || a + n > 65536)
            throw new RangeError("Memory range must stay within $0000-$FFFF.");
        if(!n) return new Uint8Array(0);
        var hw = g.apple2plus.hwObj(), result;
        if(typeof hw.safe_dump === "function")
            result = hw.safe_dump(a, a + n - 1);
        else if(typeof hw.safe_read === "function") {
            result = new Uint8Array(n);
            for(var i = 0; i < n; i++) result[i] = hw.safe_read(a + i) & 255;
        } else throw new Error("Side-effect-free memory capture is not available.");
        return result instanceof Uint8Array ? result : Uint8Array.from(result);
    }
    function memoryDump(start, length) {
        var a = address(start), b = memory(a, length);
        var rows = [];
        for(var offset = 0; offset < b.length; offset += 16) {
            var part = Array.from(b.slice(offset, offset + 16));
            var nums = part.map(function(x) { return ("0" + x.toString(16).toUpperCase()).slice(-2); });
            var ascii = part.map(function(x) { return x >= 32 && x < 127 ? String.fromCharCode(x) : "."; }).join("");
            rows.push(hex(a + offset, 4) + "  " + nums.join(" ").padEnd(47, " ") + "  " + ascii);
        }
        return rows.join("\n");
    }
    function setPause(paused) {
        if(!g.oEMUI || typeof g.oEMUI.pauseBtn !== "function")
            throw new Error("Emulator run control is unavailable.");
        g.oEMUI.pauseBtn({
            id:"pausebutton", class1:"fa-play", class2:"fa-pause", pause:paused
        });
        return true;
    }
    function keyboardStatus()
    {
        var router = io();
        var target = router.getTextInputTargetAddress
            ? router.getTextInputTargetAddress()
            : "0:A2KBD:text";
        var endpoint = router.pipeResolve && router.pipeResolve("0:A2KBD:text");
        var keyboard = endpoint && endpoint.device;
        if(!keyboard || typeof keyboard.getInputState !== "function")
            throw new Error("A2KBD input telemetry is unavailable.");

        // A2KBD.isActive() only controls *host keyboard capture*. Its
        // boolean may be false when Script/Debugger owns focus, even while
        // ProDOS is actively reading the emulated keyboard at $C000.
        // Scripted text uses the independent semantic input port.
        var state = keyboard.getInputState();
        var endpointOpen = router.pipeIsOpen
            ? router.pipeIsOpen(target)
            : !!(router.pipeResolve && router.pipeResolve(target));
        var inputOpen = !!endpointOpen;
        return Object.assign({},state,{
             target:target
            ,hostCaptureActive:!!state.active
            ,active:inputOpen
            ,inputOpen:inputOpen
            ,available:inputOpen && state.queued===0 && !state.latched
                && state.lastPollMs>0
                && Date.now()-state.lastPollMs<1000
        });
    }

    function offlineDiskController(slot)
    {
        if(!Number.isInteger(slot) || slot<1 || slot>7)
            throw new RangeError("Disk II physical slot must be S1 through S7.");
        var internalSlot = slot+1;
        var controller = io().SLOT2obj(internalSlot);
        if(!controller || controller.id?.PCODE !== "DISKII" ||
           controller.getState?.().active===false)
            throw new Error("No active DISKII peripheral in physical slot S"+slot+".");
        if(typeof controller.getOfflineDisks!=="function" ||
           typeof controller.getOfflineDiskBytes!=="function")
            throw new Error("This DISKII controller does not expose embedded offline disks.");
        return {controller:controller,internalSlot:internalSlot};
    }

    function invoke(method, args) {
        args = args || {};
        var router, board, value;
        switch(method) {
        case "text.type":
            router = io();
            board = pasteboard(router);
            if(typeof board.sendText !== "function") throw new Error("PASTEBO text output is unavailable.");
            value = String(args.text == null ? "" : args.text);
            if(board.sendText(router, value) === false)
                throw new Error("PASTEBO rejected the text transfer.");
            if(typeof g.onBoardPasteRefresh === "function") g.onBoardPasteRefresh();
            return true;
        case "text.status": return keyboardStatus();
        case "disk.listOffline":
            return offlineDiskController(args.slot).controller.getOfflineDisks();
        case "disk.loadOffline":
            var dest = offlineDiskController(args.slot);
            var drive = args.drive;
            var driveID = drive===1 || drive==="D1" ? "D1"
                : drive===2 || drive==="D2" ? "D2" : null;
            if(!driveID) throw new RangeError("DISKII drive must be 1/D1 or 2/D2.");
            var path = String(args.path || "");
            var known = dest.controller.getOfflineDisks().some(function(disk) {
                return disk.path===path;
            });
            if(!known) throw new Error("Not an embedded offline DISKII image: "+path);
            var bytes = dest.controller.getOfflineDiskBytes({path:path},null);
            if(!bytes || bytes.length!==143360)
                throw new Error("Embedded offline disk is unavailable or invalid: "+path+
                    " (expected 143360 bytes, decoded "+(bytes ? bytes.length : "none")+")");
            if(typeof g.EMU_mountDiskImage!=="function")
                throw new Error("The existing DISKII mount function is unavailable.");
            if(g.EMU_mountDiskImage(bytes,dest.internalSlot,driveID,path)!==true)
                throw new Error("Mounting offline image failed: "+path);
            return {slot:args.slot,drive:driveID,path:path,bytes:bytes.length};
        case "text.capture":
            router = io();
            board = pasteboard(router);
            if(typeof board.captureText !== "function") throw new Error("PASTEBO text capture is unavailable.");
            value = board.captureText(router);
            if(value === null) throw new Error("No active semantic text source.");
            return String(value);
        case "memory.capture":
            return memory(args.start, args.length);
        case "memory.dump":
            return memoryDump(args.start, args.length);
        case "emulator.reset":
            if(!g.apple2plus || typeof g.apple2plus.reset !== "function")
                throw new Error("Reset is unavailable.");
            g.apple2plus.reset();
            return true;
        case "emulator.reboot":
            if(!g.apple2plus || typeof g.apple2plus.restart !== "function")
                throw new Error("Reboot is unavailable.");
            g.apple2plus.restart();
            return true;
        case "emulator.pause": return setPause(true);
        case "emulator.resume": return setPause(false);
        case "cpu.getSpeed":
            if(!g.oEMUI || typeof g.oEMUI.cpuGetPercent !== "function")
                throw new Error("CPU speed control is unavailable.");
            return g.oEMUI.cpuGetPercent();
        case "cpu.setSpeed":
            if(!g.oEMUI || typeof g.oEMUI.cpuSetPercent !== "function")
                throw new Error("CPU speed control is unavailable.");
            return g.oEMUI.cpuSetPercent(args.percent);
        case "script.hide": return close();
        case "script.show": return open();
        default: throw new Error("Unknown pasteboard script operation: " + method);
        }
    }

    // Safari's Error.stack can omit the exception message entirely and only
    // display invoke@...:line. Always show name/message first, then location.
    function formatScriptError(error) {
        if(error===null || error===undefined) return String(error);
        var name=error.name || "Error";
        var message=error.message || String(error);
        var description=name+": "+message;
        var stack=typeof error.stack==="string" ? error.stack : "";
        return stack && stack.indexOf(message)<0
            ? description+"\n"+stack
            : (stack || description);
    }
    function log(text, channel) {
        text = String(text == null ? "" : text);
        if(terminal && typeof terminal.write === "function")
            terminal.write(text + "\n", channel || "host");
        else {
            var area = el("EMU_pasteboardScriptConsoleFallback");
            if(area) {
                area.value += text + "\n";
                area.scrollTop = area.scrollHeight;
            }
        }
    }
    function setStatus(value) {
        var node = el("EMU_pasteboardScriptStatus");
        if(node) node.textContent = value;
        var runButton = el("EMU_pasteboardScriptRun");
        var stopButton = el("EMU_pasteboardScriptStop");
        if(runButton) runButton.disabled = !!currentRun;
        if(stopButton) stopButton.disabled = !currentRun;
    }

    function cancelledError() {
        var error = new Error("Script stopped.");
        error.name = "AbortError";
        return error;
    }

    function checkRun(runState) {
        if(!runState || runState.cancelled || currentRun !== runState)
            throw cancelledError();
    }

    function finish(status, message, channel) {
        var state = currentRun;
        if(!state) return false;
        state.cancelled = true;
        currentRun = null;
        // Cooperative STOP interrupts macro finally-block API calls.
        // Restore the throttle on its behalf so a stopped boot demo cannot
        // leave the emulator accidentally running at 400%.
        if(status==="stopped" && state.originalCpuSpeed!==undefined)
        {
            try { invoke("cpu.setSpeed",{percent:state.originalCpuSpeed}); }
            catch(error) {
                log("Could not restore CPU speed: "+(error.message || error),"error");
            }
        }
        state.waits.forEach(function(waiter) {
            g.clearTimeout(waiter.timer);
            waiter.reject(cancelledError());
        });
        state.waits.clear();
        setStatus(status);
        if(message) log(message, channel);
        return true;
    }

    function stop() {
        // A running synchronous loop cannot be preempted on the main thread.
        // STOP cancels waits and prevents all subsequent awaited host actions.
        return finish("stopped", "■ Script stopped.", "warn");
    }

    function formatValue(value) {
        if(typeof value === "string") return value;
        if(value instanceof Error) return value.stack || value.message;
        if(value === undefined) return "undefined";
        try { return JSON.stringify(value); }
        catch(_) { return String(value); }
    }

    function makeAPI(runState) {
        function printAs(level, values) {
            if(currentRun !== runState) return;
            log(Array.from(values).map(formatValue).join(" "), level);
        }

        function call(method, args) {
            checkRun(runState);
            return Promise.resolve().then(function() {
                checkRun(runState);
                if(method==="cpu.setSpeed" && runState.originalCpuSpeed===undefined)
                    runState.originalCpuSpeed=invoke("cpu.getSpeed");
                return invoke(method, args || {});
            }).then(function(result) {
                checkRun(runState);
                return result;
            });
        }

        function integer(value, name, min, max) {
            if(!Number.isInteger(value) || value < min || value > max)
                throw new RangeError(name + " must be an integer between " + min + " and " + max + ".");
            return value;
        }

        function wait(ms) {
            integer(ms, "Wait duration (ms)", 0, 60000);
            checkRun(runState);
            return new Promise(function(resolve, reject) {
                var entry = {timer:null, reject:reject};
                entry.timer = g.setTimeout(function() {
                    runState.waits.delete(entry);
                    if(runState.cancelled || currentRun !== runState)
                        reject(cancelledError());
                    else resolve();
                }, ms);
                runState.waits.add(entry);
            });
        }

        var scriptConsole = {
            log:function() { printAs("log", arguments); },
            info:function() { printAs("info", arguments); },
            warn:function() { printAs("warn", arguments); },
            error:function() { printAs("error", arguments); }
        };
        var textAPI = {
            type:function(value) {
                return call("text.type", {text:String(value == null ? "" : value)});
            },
            capture:function() { return call("text.capture"); },
            waitFor:async function(pattern, options) {
                options = options || {};
                var timeout = integer(options.timeout === undefined ? 10000 : options.timeout,
                    "Text timeout (ms)", 0, 120000);
                var interval = integer(options.interval === undefined ? 100 : options.interval,
                    "Polling interval (ms)", 50, 60000);
                if(typeof pattern !== "string" && !(pattern instanceof RegExp))
                    throw new TypeError("waitFor expects a string or regular expression.");
                var deadline = Date.now() + timeout;
                do {
                    checkRun(runState);
                    var screen = await textAPI.capture();
                    if(pattern instanceof RegExp) pattern.lastIndex = 0;
                    if(typeof pattern === "string" ? screen.includes(pattern) : pattern.test(screen))
                        return screen;
                    var remaining = deadline - Date.now();
                    if(remaining <= 0) break;
                    await wait(Math.min(interval, remaining));
                } while(true);
                throw new Error("Timed out waiting for screen text: " + String(pattern));
            }
        };
        // $C000 polls only count when issued by the emulated CPU.
        // Port acceptance is not the same as guest readiness: require several
        // *fresh* polls in a sustained interval and an empty keyboard latch.
        textAPI.status = function() {
            return call("text.status");
        };
        textAPI.waitForReady = async function(options) {
            options = options || {};
            var timeout = integer(options.timeout === undefined ? 30000 : options.timeout,
                "Ready timeout (ms)", 0, 180000);
            var interval = integer(options.interval === undefined ? 75 : options.interval,
                "Polling interval (ms)", 25, 60000);

            // A boot menu or BASIC prompt is a more reliable sign of
            // application-level readiness than continuously reading $C000.
            // When explicitly supplied, a visible prompt is the readiness
            // condition. It never injects test keystrokes or modifies the
            // guest's keyboard latch.
            if(options.prompt !== undefined) {
                var pattern = options.prompt;
                if(typeof pattern !== "string" && !(pattern instanceof RegExp))
                    throw new TypeError("Ready prompt must be a string or regular expression.");
                try {
                    await textAPI.waitFor(pattern,{
                        timeout:timeout, interval:Math.max(50,interval)
                    });
                } catch(error) {
                    if(error && error.name==="AbortError") throw error;
                    var state=await textAPI.status(), captured=await textAPI.capture();
                    throw new Error("Timed out waiting for guest prompt "+String(pattern)+
                        "; keyboard="+JSON.stringify(state)+
                        "; screen="+JSON.stringify(captured.slice(0,320)));
                }
                var readyState=await textAPI.status();
                if(!readyState.inputOpen)
                    throw new Error("The guest prompt is visible, but the text input port "+
                        readyState.target+" is closed or unavailable.");
                return readyState;
            }
            var stableMs = integer(options.stableMs === undefined ? 250 : options.stableMs,
                "Stable polling period (ms)", 0, 10000);
            var minPolls = integer(options.minPolls === undefined ? 4 : options.minPolls,
                "Minimum fresh polls", 1, 1000000);
            var deadline=Date.now()+timeout, lastCount=null;
            var first=null, lastProgress=null, accumulated=0;
            while(true) {
                var status = await textAPI.status(), now = Date.now();
                var count = status.pollCount;
                if(lastCount===null || count<lastCount) {
                    lastCount=count;
                    first=null;
                    lastProgress=null;
                    accumulated=0;
                }
                var fresh = Math.max(0,count-lastCount);
                lastCount=count;
                // The CPU runs in scheduler batches (often around 100ms).
                // A poll snapshot may legitimately stay unchanged for one
                // or two samples; do not reset the stability window merely
                // because no new poll occurred in this particular sample.
                var receptive = status.lastPollMs>0 &&
                    now-status.lastPollMs<=Math.max(750,interval*4) &&
                    status.active && status.queued===0 && !status.latched;
                if(receptive) {
                    if(fresh>0) {
                        if(first===null) first=now;
                        lastProgress=now;
                        accumulated+=fresh;
                    }
                    // Distinct CPU-polling updates must span the stability
                    // window. One short burst followed by silence is not a
                    // reliable sign that the guest has finished booting.
                    if(first!==null && lastProgress-first>=stableMs &&
                       accumulated>=minPolls)
                        return status;
                } else {
                    first=null; lastProgress=null; accumulated=0;
                }
                if(now>=deadline)throw new Error("Timed out waiting for guest keyboard polling.");
                await wait(Math.min(interval,Math.max(0,deadline-now)));
            }
        };
        textAPI.waitForDrain = async function(options) {
            options = options || {};
            var timeout = integer(options.timeout === undefined ? 20000 : options.timeout,
                "Drain timeout (ms)", 0, 180000);
            var interval = integer(options.interval === undefined ? 50 : options.interval,
                "Polling interval (ms)", 25, 60000);
            var deadline=Date.now()+timeout;
            while(true) {
                var status=await textAPI.status();
                if(status.queued===0 && !status.latched) return status;
                var now=Date.now();
                if(now>=deadline) throw new Error("Timed out waiting for keyboard queue/strobe drain.");
                await wait(Math.min(interval,Math.max(0,deadline-now)));
            }
        };

        var memoryAPI = {
            capture:function(start, length) {
                return call("memory.capture", {start:start, length:length});
            },
            read:async function(address) {
                var bytes = await memoryAPI.capture(address, 1);
                return bytes[0];
            },
            dump:function(start, length) {
                return call("memory.dump", {
                    start:start, length:length === undefined ? 128 : length
                });
            }
        };
        var apple = {
            wait:wait,
            text:Object.freeze(textAPI),
            memory:Object.freeze(memoryAPI),
            disk:Object.freeze({
                listOffline:function(slot) {
                    return call("disk.listOffline", {slot:slot});
                },
                loadOffline:function(options) {
                    options=options||{};
                    return call("disk.loadOffline", {
                        slot:options.slot, drive:options.drive, path:options.path
                    });
                }
            }),
            reset:function() { return call("emulator.reset"); },
            reboot:function() { return call("emulator.reboot"); },
            pause:function() { return call("emulator.pause"); },
            resume:function() { return call("emulator.resume"); },
            cpu:Object.freeze({
                getSpeed:function() { return call("cpu.getSpeed"); },
                setSpeed:function(percent) {
                    return call("cpu.setSpeed", {percent:percent});
                }
            }),
            assert:function(condition, description) {
                checkRun(runState);
                if(typeof condition !== "boolean")
                    throw new TypeError("assert requires a boolean.");
                printAs(condition ? "pass" : "error",
                    [(condition ? "PASS " : "FAIL ") + (description || "assertion")]);
                if(!condition)
                    throw new Error("Assertion failed: " + (description || "assertion"));
                return true;
            },
            script:Object.freeze({
                running:function() { return currentRun === runState && !runState.cancelled; },
                stop:function() {
                    checkRun(runState);
                    stop();
                    throw cancelledError();
                },
                hide:function() { return call("script.hide"); },
                show:function() { return call("script.show"); }
            })
        };
        return {apple:Object.freeze(apple), console:scriptConsole,
            print:function() { printAs("log", arguments); }};
    }

    function run() {
        if(currentRun) return false;
        var editor = el("EMU_pasteboardScriptEditor");
        if(!editor) return false;
        var fn;
        try {
            var AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            fn = new AsyncFunction("apple", "console", "print",
                '"use strict";\n' + editor.value);
        } catch(error) {
            setStatus("error");
            log("ERROR " + formatScriptError(error), "error");
            return false;
        }

        var state = {id:++generation, cancelled:false, waits:new Set()};
        currentRun = state;
        var api = makeAPI(state);
        setStatus("running");
        log("▶ Running script", "command");

        // Yield once so normal browser painting and event processing can occur.
        // Subsequent awaited operations/timers run on the page's event loop.
        Promise.resolve().then(function() {
            checkRun(state);
            return fn(api.apple, api.console, api.print);
        }).then(function() {
            if(currentRun === state) finish("ready", "✓ Script completed.", "result");
        }).catch(function(error) {
            if(currentRun !== state) return; // Already stopped by user/macro.
            finish("error", "ERROR " + formatScriptError(error), "error");
        });
        return true;
    }
    function clearConsole() {
        if(terminal && typeof terminal.clear === "function") terminal.clear();
        var fallback = el("EMU_pasteboardScriptConsoleFallback");
        if(fallback) fallback.value = "";
    }
    function copyConsole() {
        var host = el("EMU_pasteboardScriptConsole");
        var output = host && host.querySelector("output");
        var fallback = el("EMU_pasteboardScriptConsoleFallback");
        var content = fallback ? fallback.value : output ? output.innerText || output.textContent : "";
        if(g.navigator && g.navigator.clipboard && g.navigator.clipboard.writeText)
            return g.navigator.clipboard.writeText(content).catch(function() {
                log("Clipboard permission denied; select console text manually.", "warn");
            });
        log("Clipboard API unavailable; select console text manually.", "warn");
        return Promise.resolve(false);
    }
    function makePopup() {
        var p = el(POPUP);
        if(p) return p;
        p = D.createElement("div");
        p.id = POPUP;
        p.className = "appbox DBG_steptraceScenarioPopup EMU_pasteboardScriptPopup";
        p.hidden = true;
        p.style.cssText = "position:absolute;z-index:2000;width:460px";
        p.innerHTML = [
            '<div class="DBG_testbenchBox">',
            '  <div class="DBG_testbenchHeader">',
            '    <span class="DBG_testbenchTitle">PASTEBOARD SCRIPT</span>',
            '    <div class="DBG_testbenchHeaderButtons">',
            '      <span id="EMU_pasteboardScriptStatus">ready</span>',
            '      <button class="appbut" type="button" id="EMU_pasteboardScriptClose" title="Close script editor">×</button>',
            '    </div>',
            '  </div>',
            '  <div class="DBG_testbenchGrid">',
            '    <div class="DBG_testbenchSection">',
            '      <div class="DBG_testbenchSectionHeader"><span>JavaScript IDE</span>',
            '        <span>async/await · page context</span></div>',
            '      <textarea id="EMU_pasteboardScriptEditor" spellcheck="false" aria-label="Pasteboard JavaScript editor"></textarea>',
            '      <div class="EMU_pasteboardScriptActions">',
            '        <button class="appbut" type="button" id="EMU_pasteboardScriptRun">▶ RUN</button>',
            '        <button class="appbut" type="button" id="EMU_pasteboardScriptStop" disabled>■ STOP</button>',
            '        <button class="appbut" type="button" id="EMU_pasteboardScriptExample">Example</button>',
            '        <button class="appbut" type="button" id="EMU_pasteboardScriptProDOS">ProDOS Demo</button>',
            '        <button class="appbut" type="button" id="EMU_pasteboardScriptShareURI">Copy URI</button>',
            '      </div>',
            '    </div>',
            '    <div class="DBG_testbenchSection">',
            '      <div class="DBG_testbenchSectionHeader"><span>CONSOLE</span>',
            '        <div class="DBG_testbenchConsoleHeaderRight">',
            '          <button class="appbut" type="button" id="EMU_pasteboardScriptCopy">Copy</button>',
            '          <button class="appbut" type="button" id="EMU_pasteboardScriptClear">Clear</button>',
            '        </div>',
            '      </div>',
            '      <div class="DBG_testConsole" id="EMU_pasteboardScriptConsole"></div>',
            '    </div>',
            '    <div class="EMU_pasteboardScriptNote">Ctrl/Cmd+Enter runs the editor. Closing this window does not stop scripts.</div>',
            '  </div>',
            '</div>'
        ].join("\n");
        (D.body || D.documentElement).appendChild(p);

        var editor = el("EMU_pasteboardScriptEditor");
        editor.value = DEFAULT_SCRIPT;
        editor.addEventListener("keydown", function(ev) {
            if((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
                ev.preventDefault();
                run();
            }
        });
        el("EMU_pasteboardScriptClose").onclick = close;
        el("EMU_pasteboardScriptRun").onclick = run;
        el("EMU_pasteboardScriptStop").onclick = stop;
        el("EMU_pasteboardScriptClear").onclick = clearConsole;
        el("EMU_pasteboardScriptCopy").onclick = copyConsole;
        el("EMU_pasteboardScriptExample").onclick = function() {
            if(currentRun) return;
            editor.value = DEFAULT_SCRIPT;
            editor.focus();
        };
        el("EMU_pasteboardScriptProDOS").onclick = function() {
            if(currentRun) return;
            editor.value = PRODOS_BOOT_SCRIPT;
            editor.focus();
        };
        el("EMU_pasteboardScriptShareURI").onclick = shareURI;
        if(typeof g.TERMINAL === "function") {
            try {
                terminal = new g.TERMINAL({
                    container:"EMU_pasteboardScriptConsole",
                    welcome:"Pasteboard macro console ready.",
                    prompt:"JS", separator:"&gt;",
                    storageKey:"RetroAppleJS.Pasteboard.ScriptConsole",
                    preserveWhitespace:true, allowEmptyInput:false
                });
                if(terminal && terminal.onInput)
                    terminal.onInput(function() {
                        log("Use the script editor to run JavaScript.", "host");
                        return true;
                    });
            } catch(error) { terminal = null; }
        }
        if(!terminal) {
            var fallback = D.createElement("textarea");
            fallback.id = "EMU_pasteboardScriptConsoleFallback";
            fallback.readOnly = true;
            fallback.setAttribute("aria-label", "Pasteboard script console");
            el("EMU_pasteboardScriptConsole").appendChild(fallback);
        }
        if(g.oCOM && g.oCOM.POPUP && g.oCOM.POPUP.addScope)
            g.oCOM.POPUP.addScope(POPUP, "tab1.2");
        setStatus("ready");
        return p;
    }
    function position() {
        var popup = el(POPUP);
        var layout = g.EMU_COMPANION_LAYOUT;
        // STEP TRACE SCENARIO provides the authoritative companion geometry.
        // Never anchor to the pasteboard toolbox or depend on the scenario
        // popup having been opened previously.
        return !!(popup && layout && typeof layout.position === "function" &&
            layout.position(popup));
    }
    function open() {
        var p = makePopup();
        // The editor is a document-positioned companion, not an overlay
        // anchored inside the monitor or pasteboard toolbox.
        p.style.position = "absolute";
        if(g.oCOM && g.oCOM.POPUP && g.oCOM.POPUP.on)
            g.oCOM.POPUP.on(POPUP);
        else p.hidden = false;
        var button = el("EMU_pasteboardScriptToggle");
        if(button) button.setAttribute("aria-pressed", "true");
        position();
        return true;
    }
    function close() {
        var p = el(POPUP);
        if(!p) return false;
        if(g.oCOM && g.oCOM.POPUP && g.oCOM.POPUP.off)
            g.oCOM.POPUP.off(POPUP);
        else p.hidden = true;
        var button = el("EMU_pasteboardScriptToggle");
        if(button) button.setAttribute("aria-pressed", "false");
        return true;
    }
    function toggle() {
        var p = el(POPUP);
        if(!p) return open();
        var popup = g.oCOM && g.oCOM.POPUP;
        var logicallyClosed = popup && popup.states && popup.states[POPUP] !== undefined
            ? popup.states[POPUP] : p.hidden;
        return logicallyClosed ? open() : close();
    }
    function init() {
        var button = el("EMU_pasteboardScriptToggle");
        if(!button) return false;
        button.setAttribute("aria-pressed", "false");
        if(g.addEventListener) g.addEventListener("resize", position);
        // Import only; never execute JavaScript automatically from a URL.
        importScriptFromURI();
        return true;
    }
    g.EMU_PASTEBOARD_SCRIPT = {
        ui:{init:init, open:open, close:close, toggle:toggle, position:position},
        run:run, stop:stop,
        uri:{
            encode:encodeCompressedScript,
            decode:decodeCompressedScript,
            current:currentScriptURI,
            importFromLocation:importScriptFromURI
        },
        // Public only for testing/integration; macros invoke the page-context adapter.
        invoke:invoke
    };
    if(g.oCOM && g.oCOM.addToEventStack)
        g.oCOM.addToEventStack("onload", init);
    else if(g.addEventListener)
        g.addEventListener("load", init);
})(window);
