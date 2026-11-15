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
    var DEFAULT_SCRIPT = [
        "// PASTEBOARD SCRIPT — Ctrl/Cmd+Enter to run",
        "// Commands are async: always await device operations.",
        "// Optional: await apple.script.hide();  // Reveal the Apple II screen",
        "// Optional: await apple.script.show();  // Restore the IDE",
        "console.log('Current screen:');",
        "console.log(await apple.text.capture());",
        "console.log(await apple.memory.dump(0x0400, 64));",
        "await apple.wait(250);",
        "console.log('Ready. Try apple.text.type(\\\"CATALOG\\\\r\\\");');"
    ].join("\n");

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
        case "script.hide": return close();
        case "script.show": return open();
        default: throw new Error("Unknown pasteboard script operation: " + method);
        }
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
            reset:function() { return call("emulator.reset"); },
            reboot:function() { return call("emulator.reboot"); },
            pause:function() { return call("emulator.pause"); },
            resume:function() { return call("emulator.resume"); },
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
            log("ERROR " + (error.stack || error.message || String(error)), "error");
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
            finish("error", "ERROR " + (error.stack || error.message || String(error)), "error");
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
            if(worker) return;
            editor.value = DEFAULT_SCRIPT;
            editor.focus();
        };
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
        return true;
    }
    g.EMU_PASTEBOARD_SCRIPT = {
        ui:{init:init, open:open, close:close, toggle:toggle, position:position},
        run:run, stop:stop,
        // Public only for testing/integration; scripts use the Worker bridge.
        invoke:invoke
    };
    if(g.oCOM && g.oCOM.addToEventStack)
        g.oCOM.addToEventStack("onload", init);
    else if(g.addEventListener)
        g.addEventListener("load", init);
})(window);
