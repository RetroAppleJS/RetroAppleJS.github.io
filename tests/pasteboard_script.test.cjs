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
    assert.match(api.invoke("memory.dump", {start:0x400,length:4}), /\\$0400  00 01 02 03/);
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
        String.raw`await apple.text.type("CATALOG\\r");
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
    assert.match(html, /res\\/EMU_pasteboard_script\\.js/);
    assert.match(html, /res\\/EMU_pasteboard_script\\.css/);
    assert.doesNotMatch(html, /value="Clear"\\s+onclick="javascript:onEMUBoardClear\\(\\)"/);
});
