/*
 * Unit-level checks for the Pasteboard Script Worker and its device adapter.
 * Run with: node --test tests/pasteboard_script.test.cjs
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const workerSource = fs.readFileSync(path.join(ROOT, "res/EMU_pasteboard_script_worker.js"), "utf8");
const hostSource = fs.readFileSync(path.join(ROOT, "res/EMU_pasteboard_script.js"), "utf8");

function mockHost() {
    const calls = [];
    const textDevice = {
        getTargetAddress() { return "0:A2KBD:text"; },
        sendText(_router, value) { calls.push(["text", value]); return true; },
        captureText() { return "APPLE II\n]"; }
    };
    const router = {
        pipeResolve(address) {
            assert.equal(address, "0:PASTEBO:text");
            return {device:textDevice};
        }
    };
    const hardware = {
        io:router,
        safe_dump(start, end) {
            calls.push(["memory", start, end]);
            return Uint8Array.from({length:end-start+1}, (_, i) => (start+i)&255);
        }
    };
    const globalObject = {
        document:{getElementById() { return null; }},
        apple2plus:{
            hwObj() { return hardware; },
            reset() { calls.push(["reset"]); },
            restart() { calls.push(["reboot"]); }
        },
        oEMUI:{pauseBtn(arg) { calls.push(["pause", arg.pause]); }}
    };
    vm.runInNewContext(hostSource, {window:globalObject}, {filename:"EMU_pasteboard_script.js"});
    return {api:globalObject.EMU_PASTEBOARD_SCRIPT, calls, textDevice, router};
}

async function mockWorker(code, dispatch) {
    const messages = [], calls = [];
    const scope = {
        setTimeout:setTimeout,
        postMessage(message) {
            if(message.type !== "call") { messages.push(message); return; }
            calls.push(message);
            Promise.resolve().then(() => dispatch(message.method, message.args)).then(
                result => scope.onmessage({data:{type:"response",id:message.id,result}}),
                error => scope.onmessage({data:{type:"response",id:message.id,error:String(error.message || error)}})
            );
        }
    };
    vm.runInNewContext(workerSource, {self:scope, setTimeout:setTimeout, Uint8Array:Uint8Array}, {
        filename:"EMU_pasteboard_script_worker.js"
    });
    await scope.onmessage({data:{type:"run", code}});
    return {messages,calls};
}

test("pasteboard host adapter uses PASTEBO and side-effect-free memory", () => {
    const {api, calls} = mockHost();
    assert.equal(api.invoke("text.type", {text:"10 PRINT 1\r"}), true);
    assert.equal(api.invoke("text.capture"), "APPLE II\n]");
    assert.deepEqual(Array.from(api.invoke("memory.capture", {start:0x400,length:3})), [0,1,2]);
    assert.match(api.invoke("memory.dump", {start:0x400,length:4}), /\$0400  00 01 02 03/);
    assert.deepEqual(calls.slice(0,3), [
        ["text","10 PRINT 1\r"], ["memory",0x400,0x402], ["memory",0x400,0x403]
    ]);
    assert.throws(() => api.invoke("memory.capture",{start:0xFFFF,length:2}), /range/i);
    assert.throws(() => api.invoke("memory.capture",{start:0,length:-1}), /range/i);
    assert.throws(() => api.invoke("invalid.action"), /Unknown pasteboard script operation/);
});

test("host adapter reuses reset/reboot and pause/resume controls", () => {
    const {api,calls} = mockHost();
    api.invoke("emulator.reset");
    api.invoke("emulator.reboot");
    api.invoke("emulator.pause");
    api.invoke("emulator.resume");
    assert.deepEqual(calls, [["reset"],["reboot"],["pause",true],["pause",false]]);
});

test("Worker executes asynchronous text, memory, assertions and timers", async () => {
    const {messages,calls} = await mockWorker(
        String.raw`await apple.text.type("CATALOG\r");
        const screen = await apple.text.waitFor("READY", {timeout:200,interval:50});
        const bytes = await apple.memory.capture(0x400, 2);
        apple.assert(screen === "READY" && bytes[1] === 2, "capture");
        await apple.wait(1);
        console.log(await apple.memory.read(0x400));
        `,
        (method) => {
            if(method === "text.capture") return "READY";
            if(method === "memory.capture") return Uint8Array.of(1,2);
            return true;
        }
    );
    assert.deepEqual(calls.map(c => c.method), [
        "text.type", "text.capture", "memory.capture", "memory.capture"
    ]);
    assert.equal(messages.at(-1).type, "done");
    assert.ok(messages.some(m => m.type === "console" && /PASS capture/.test(m.text)));
});

test("Worker catches user errors without claiming completion", async () => {
    const {messages} = await mockWorker('apple.assert(false,"expected failure");', () => true);
    assert.equal(messages.at(-1).type, "failure");
    assert.match(messages.at(-1).error, /Assertion failed/);
    assert.equal(messages.some(m => m.type === "done"), false);
});

test("Worker rejects unsupported or invalid timing arguments", async () => {
    const {messages} = await mockWorker("await apple.wait(-1);", () => true);
    assert.equal(messages.at(-1).type, "failure");
    assert.match(messages.at(-1).error, /Wait duration/);
});

test("index loads the IDE and exposes Script instead of pasteboard Clear", () => {
    const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    assert.match(html, /id="EMU_pasteboardScriptToggle"/);
    assert.match(html, /res\/EMU_pasteboard_script\.js/);
    assert.match(html, /res\/EMU_pasteboard_script\.css/);
    assert.doesNotMatch(html, /value="Clear"\s+onclick="javascript:onEMUBoardClear\(\)"/);
});


test("Pasteboard and STEP TRACE use identical popup placement when Settings is hidden", () => {
    const layoutSource = fs.readFileSync(
        path.join(ROOT, "res/DBG_steptrace_scenario_layout.js"), "utf8"
    );
    function rect(left, top, width, height) {
        return {left, top, width, height, right:left+width, bottom:top+height};
    }
    const settings = {hidden:true, style:{visibility:""}, children:[]};
    const systemBox = {
        id:"systemToolbox",
        classList:{contains(name) { return name === "toolbox"; }},
        getBoundingClientRect() { return settings.hidden ? rect(0,0,0,0) : rect(0,64,144,100); }
    };
    const slotsBox = {
        id:"slotsToolbox",
        classList:{contains(name) { return name === "toolbox"; }},
        getBoundingClientRect() { return settings.hidden ? rect(0,0,0,0) : rect(148,64,488,100); }
    };
    settings.children.push(systemBox, slotsBox);
    const dbg = {
        hidden:true, style:{},
        getBoundingClientRect() {
            if(settings.hidden || this.hidden) return rect(0,0,0,0);
            return rect(640 + Number.parseFloat(this.style.left || "0"), 64,
                Number.parseFloat(this.style.width || "260"), 300);
        }
    };
    const elements = {"tab1.1":settings, "cpuDbg_popup":dbg};
    const globalObject = {
        innerWidth:1400, pageXOffset:0, pageYOffset:0,
        document:{
            getElementById(id) { return elements[id] || null; },
            documentElement:{clientWidth:1400}
        },
        addEventListener() {}
    };
    vm.runInNewContext(layoutSource, {window:globalObject}, {
        filename:"DBG_steptrace_scenario_layout.js"
    });
    const layout = globalObject.EMU_COMPANION_LAYOUT;
    assert.ok(layout);
    const pasteboard = {hidden:false, style:{}};
    assert.equal(layout.position(pasteboard), true);
    assert.equal(settings.hidden, true);
    assert.equal(dbg.hidden, true);
    assert.equal(settings.style.visibility, "");
    assert.equal(pasteboard.style.top, "64px");
    const pasteboardCoordinates = {
        left:pasteboard.style.left,
        top:pasteboard.style.top,
        width:pasteboard.style.width
    };

    settings.hidden = false;
    dbg.hidden = false;
    const steptrace = {hidden:false, style:{}};
    assert.equal(layout.position(steptrace), true);
    assert.deepEqual({
        left:steptrace.style.left,
        top:steptrace.style.top,
        width:steptrace.style.width
    }, pasteboardCoordinates);

    // Narrow viewports must also select the same left-hand fallback.
    globalObject.innerWidth = 760;
    const smallPasteboard = {hidden:false, style:{}};
    const smallSteptrace = {hidden:false, style:{}};
    settings.hidden = true;
    dbg.hidden = true;
    assert.equal(layout.position(smallPasteboard), true);
    settings.hidden = false;
    dbg.hidden = false;
    assert.equal(layout.position(smallSteptrace), true);
    assert.equal(smallPasteboard.style.left, smallSteptrace.style.left);
    assert.equal(smallPasteboard.style.width, smallSteptrace.style.width);
});

test("Pasteboard uses shared STEP TRACE layout rather than Tools anchor", () => {
    assert.match(hostSource, /layout\.position\(popup\)/);
    const begin = hostSource.indexOf("function position()");
    const end = hostSource.indexOf("function open()", begin);
    assert.ok(begin > 0 && end > begin);
    assert.doesNotMatch(hostSource.slice(begin, end), /tab1\.2|DBG_steptraceScenarioPopup/);
});
