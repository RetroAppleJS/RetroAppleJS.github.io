/*
 * PASTEBOARD SCRIPT — isolated macro runner.
 *
 * Only explicitly named automation methods are bridged to the emulator.
 * User-authored scripts are trusted code, not a security sandbox.
 * Terminating this Worker also terminates CPU-bound JavaScript loops.
 */
(function (scope) {
    "use strict";

    var nextCall = 0;
    var pending = new Map();
    var active = false;

    function host(method, args) {
        if(!active) return Promise.reject(new Error("Script is not running."));
        return new Promise(function(resolve, reject) {
            var id = ++nextCall;
            pending.set(id, {resolve:resolve, reject:reject});
            scope.postMessage({type:"call", id:id, method:method, args:args || {}});
        });
    }

    function write(level, values) {
        var args = Array.from(values).map(function(value) {
            if(value instanceof Error) return value.stack || value.message;
            if(typeof value === "string") return value;
            if(value === undefined) return "undefined";
            try { return JSON.stringify(value); }
            catch(_) { return String(value); }
        });
        scope.postMessage({type:"console", level:level, text:args.join(" ")});
    }

    function integer(value, name, min, max) {
        if(!Number.isInteger(value) || value < min || value > max)
            throw new RangeError(name + " must be an integer between " + min + " and " + max + ".");
        return value;
    }

    function wait(ms) {
        ms = integer(ms, "Wait duration (ms)", 0, 60000);
        return new Promise(function(resolve) { scope.setTimeout(resolve, ms); });
    }

    function buildAPI() {
        var log = {
            log:function() { write("log", arguments); },
            info:function() { write("info", arguments); },
            warn:function() { write("warn", arguments); },
            error:function() { write("error", arguments); }
        };
        var text = {
            type:function(value) {
                return host("text.type", {text:String(value == null ? "" : value)});
            },
            capture:function() {
                return host("text.capture");
            },
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
                    var screen = await text.capture();
                    if(typeof pattern === "string" ? screen.includes(pattern) : pattern.test(screen))
                        return screen;
                    var remaining = deadline - Date.now();
                    if(remaining <= 0) break;
                    // Reused global RegExp values must not retain a previous lastIndex.
                    if(pattern instanceof RegExp) pattern.lastIndex = 0;
                    await wait(Math.min(interval, Math.max(0, remaining)));
                } while(true);
                throw new Error("Timed out waiting for screen text: " + String(pattern));
            }
        };
        var memory = {
            capture:async function(start, length) {
                var bytes = await host("memory.capture", {start:start, length:length});
                return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
            },
            read:async function(address) {
                var bytes = await memory.capture(address, 1);
                return bytes[0];
            },
            dump:function(start, length) {
                return host("memory.dump", {start:start, length:length === undefined ? 128 : length});
            }
        };
        var apple = {
            wait:wait,
            text:Object.freeze(text),
            memory:Object.freeze(memory),
            reset:function() { return host("emulator.reset"); },
            reboot:function() { return host("emulator.reboot"); },
            pause:function() { return host("emulator.pause"); },
            resume:function() { return host("emulator.resume"); },
            assert:function(condition, description) {
                if(typeof condition !== "boolean") throw new TypeError("assert requires a boolean.");
                write(condition ? "pass" : "error", [(condition ? "PASS " : "FAIL ") + (description || "assertion")]);
                if(!condition) throw new Error("Assertion failed: " + (description || "assertion"));
                return true;
            },
            script:Object.freeze({
                running:function() { return active; },
                // Hide/show only the editor overlay. The Worker and guest CPU
                // continue running; the toolbar Script button can reopen it.
                hide:function() { return host("script.hide"); },
                show:function() { return host("script.show"); },
                stop:function() {
                    active = false;
                    scope.postMessage({type:"selfStop"});
                    throw new Error("Script stopped.");
                }
            })
        };
        return {apple:Object.freeze(apple), console:log};
    }

    scope.onmessage = async function(event) {
        var message = event.data || {};
        if(message.type === "response") {
            var item = pending.get(message.id);
            if(!item) return;
            pending.delete(message.id);
            if(message.error) item.reject(new Error(message.error));
            else item.resolve(message.result);
            return;
        }
        if(message.type !== "run" || active) return;
        active = true;
        var api = buildAPI();
        try {
            var AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            var fn = new AsyncFunction("apple", "console", "print",
                '"use strict";\n' + String(message.code || ""));
            await fn(api.apple, api.console, function() { write("log", arguments); });
            scope.postMessage({type:"done"});
        } catch(err) {
            if(active) scope.postMessage({
                type:"failure",
                error:err && (err.stack || err.message) || String(err)
            });
        } finally {
            active = false;
        }
    };
})(self);
