/*
 * PASTEBOARD SCRIPT — user-facing automation IDE and emulator API adapter.
 *
 * Script execution lives in EMU_pasteboard_script_worker.js, never in the
 * main emulator's CPU scheduler. Only these named operations reach Apple2IO.
 * This is intended for user-authored/trusted JavaScript macros.
 */
(function (g) {
    "use strict";

    var D = g.document, worker = null, generation = 0, terminal = null;
    var POPUP = "EMU_pasteboardScriptPopup";
    var DEFAULT_SCRIPT = [
        "// PASTEBOARD SCRIPT — Ctrl/Cmd+Enter to run",
        "// Commands are async: always await device operations.",
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
        var run = el("EMU_pasteboardScriptRun"), stop = el("EMU_pasteboardScriptStop");
        if(run) run.disabled = !!worker;
        if(stop) stop.disabled = !worker;
    }
    function terminate(status, message, channel) {
        if(worker) worker.terminate();
        worker = null;
        generation++;
        setStatus(status);
        if(message) log(message, channel);
    }
    function stop() {
        if(!worker) return false;
        terminate("stopped", "■ Script stopped.", "warn");
        return true;
    }
    function handleMessage(source, token, message) {
        if(source !== worker || token !== generation) return;
        message = message || {};
        if(message.type === "console") {
            log(message.text, message.level);
            return;
        }
        if(message.type === "done") {
            terminate("ready", "✓ Script completed.", "result");
            return;
        }
        if(message.type === "failure") {
            terminate("error", "ERROR " + message.error, "error");
            return;
        }
        if(message.type === "selfStop") {
            terminate("stopped", "■ Script stopped.", "warn");
            return;
        }
        if(message.type !== "call") return;
        var id = message.id;
        // Only the current worker is allowed to receive a result.  A stopped
        // worker cannot cause a deferred host mutation on a subsequent run.
        Promise.resolve().then(function() {
            if(source !== worker || token !== generation) return;
            return invoke(message.method, message.args);
        }).then(function(result) {
            if(source === worker && token === generation)
                source.postMessage({type:"response", id:id, result:result});
        }).catch(function(error) {
            if(source === worker && token === generation)
                source.postMessage({type:"response", id:id,
                    error:error && error.message || String(error)});
        });
    }
    function run() {
        if(worker) return false;
        var editor = el("EMU_pasteboardScriptEditor");
        if(!editor) return false;
        if(typeof g.Worker !== "function") {
            log("ERROR Web Workers are not supported by this browser.", "error");
            setStatus("error");
            return false;
        }
        try {
            var source = new g.Worker("res/EMU_pasteboard_script_worker.js");
            worker = source;
            var token = ++generation;
            source.onmessage = function(ev) { handleMessage(source, token, ev.data); };
            source.onerror = function(ev) {
                if(source !== worker || token !== generation) return;
                terminate("error", "ERROR Worker: " + (ev.message || "script failed"), "error");
            };
            setStatus("running");
            log("▶ Running script", "command");
            source.postMessage({type:"run", code:editor.value});
            return true;
        } catch(error) {
            terminate("error", "ERROR " + (error.message || String(error)), "error");
            return false;
        }
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
            '        <span>Worker · async/await</span></div>',
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
