/*
 * Unit-level checks for the page-context Pasteboard Script runner and device adapter.
 * Run with: node --test tests/pasteboard_script.test.cjs
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
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


function makeRunner(sourceText) {
    const calls = [];
    const elements = {
        EMU_pasteboardScriptEditor:{value:sourceText},
        EMU_pasteboardScriptStatus:{textContent:"ready"},
        EMU_pasteboardScriptRun:{disabled:false},
        EMU_pasteboardScriptStop:{disabled:true},
        EMU_pasteboardScriptConsoleFallback:{value:"",scrollTop:0},
        EMU_pasteboardScriptToggle:{setAttribute(){}},
        EMU_pasteboardScriptPopup:{hidden:false,style:{position:"absolute"}}
    };
    const popup = {
        states:{EMU_pasteboardScriptPopup:false},
        on(id) { elements[id].hidden=false; this.states[id]=false; },
        off(id) { elements[id].hidden=true; this.states[id]=true; }
    };
    const router = {
        pipeResolve() {
            return {device:{
                sendText(_io,text) { calls.push(["type",text]); return true; },
                captureText() { calls.push(["capture"]); return "READY"; }
            }};
        }
    };
    const globalObject = {
        document:{getElementById(id) { return elements[id] || null; }},
        setTimeout:setTimeout,
        clearTimeout:clearTimeout,
        oCOM:{POPUP:popup},
        EMU_COMPANION_LAYOUT:{position(el) { el.style.left="760px"; return true; }},
        apple2plus:{
            hwObj() {
                return {
                    io:router,
                    safe_dump(start,end) {
                        calls.push(["memory",start,end]);
                        return Uint8Array.from({length:end-start+1},(_,i)=>(start+i)&255);
                    }
                };
            },
            reset() { calls.push(["reset"]); },
            restart() { calls.push(["reboot"]); }
        },
        oEMUI:{pauseBtn(arg) { calls.push(["pause",arg.pause]); }}
    };
    vm.runInNewContext(hostSource, {window:globalObject}, {filename:"EMU_pasteboard_script.js"});
    return {api:globalObject.EMU_PASTEBOARD_SCRIPT, calls, elements, popup};
}

function flushRunner() {
    return new Promise(resolve => setTimeout(resolve, 20));
}

test("page-context async macro executes text/memory/timers without Worker", async () => {
    const code = [
        'console.log("Start");',
        'await apple.text.type("CATALOG\\r");',
        'const screen = await apple.text.waitFor("READY", {timeout:500});',
        'const bytes = await apple.memory.capture(0x0400,2);',
        'apple.assert(screen === "READY" && bytes[1] === 1,"memory capture");',
        'await apple.wait(1);',
        'console.log("End");'
    ].join("\n");
    const run = makeRunner(code);
    assert.equal(run.api.run(),true);
    assert.equal(run.elements.EMU_pasteboardScriptRun.disabled,true);
    await flushRunner();
    assert.equal(run.elements.EMU_pasteboardScriptStatus.textContent,"ready");
    assert.equal(run.elements.EMU_pasteboardScriptStop.disabled,true);
    assert.ok(run.calls.some(x=>x[0]==="type" && x[1]==="CATALOG\r"));
    assert.ok(run.calls.some(x=>x[0]==="memory" && x[1]===0x0400 && x[2]===0x0401));
    assert.match(run.elements.EMU_pasteboardScriptConsoleFallback.value,/PASS memory capture/);
    assert.match(run.elements.EMU_pasteboardScriptConsoleFallback.value,/Script completed/);
});

test("macro hide/show keeps executing and does not affect emulator run state", async () => {
    const run = makeRunner([
        'await apple.script.hide();',
        'console.log("Screen visible");',
        'await apple.wait(1);',
        'await apple.script.show();',
        'console.log("Back in editor");'
    ].join("\n"));
    assert.equal(run.api.run(),true);
    await flushRunner();
    assert.equal(run.elements.EMU_pasteboardScriptStatus.textContent,"ready");
    assert.equal(run.elements.EMU_pasteboardScriptPopup.hidden,false);
    assert.equal(run.elements.EMU_pasteboardScriptPopup.style.left,"760px");
    assert.match(run.elements.EMU_pasteboardScriptConsoleFallback.value,/Screen visible/);
    assert.match(run.elements.EMU_pasteboardScriptConsoleFallback.value,/Back in editor/);
    assert.equal(run.calls.some(x=>x[0]==="pause"),false);
});

test("STOP cooperatively interrupts pending waits and future actions", async () => {
    const run = makeRunner('await apple.wait(60000); await apple.text.type("SHOULD-NOT-RUN");');
    assert.equal(run.api.run(),true);
    await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(run.api.stop(),true);
    assert.equal(run.elements.EMU_pasteboardScriptStatus.textContent,"stopped");
    run.elements.EMU_pasteboardScriptEditor.value='await apple.text.type("AFTER-STOP");';
    assert.equal(run.api.run(),true);
    await flushRunner();
    assert.equal(run.elements.EMU_pasteboardScriptStatus.textContent,"ready");
    assert.equal(run.calls.some(x=>x[1]==="SHOULD-NOT-RUN"),false);
    assert.equal(run.calls.some(x=>x[1]==="AFTER-STOP"),true);
});

test("synchronous errors report their stack and allow a new run", async () => {
    const run=makeRunner('apple.assert(false,"expected failure");');
    assert.equal(run.api.run(),true);
    await flushRunner();
    assert.equal(run.elements.EMU_pasteboardScriptStatus.textContent,"error");
    assert.match(run.elements.EMU_pasteboardScriptConsoleFallback.value,/Assertion failed/);
    run.elements.EMU_pasteboardScriptEditor.value="await apple.wait(-1);";
    run.api.run();
    await flushRunner();
    assert.match(run.elements.EMU_pasteboardScriptConsoleFallback.value,/Wait duration/);
});

test("no Worker is constructed or loaded and source editor uses page context", () => {
    assert.doesNotMatch(hostSource,/new\s+(?:g\.)?Worker\s*\(/);
    assert.doesNotMatch(hostSource,/EMU_pasteboard_script_worker/);
    assert.match(hostSource,/new AsyncFunction\(/);
    assert.equal(fs.existsSync(path.join(ROOT,"res/EMU_pasteboard_script_worker.js")),false);
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

test("Script hide/show only changes popup state and uses absolute companion geometry", () => {
    const popup = {hidden:false, style:{position:"absolute"}, id:"EMU_pasteboardScriptPopup"};
    const attrs = {};
    const button = {setAttribute(key,val) { attrs[key] = val; }};
    const elements = {
        EMU_pasteboardScriptPopup:popup,
        EMU_pasteboardScriptToggle:button
    };
    const popupController = {
        states:{EMU_pasteboardScriptPopup:false},
        on(id) { assert.equal(id,popup.id); popup.hidden=false; this.states[id]=false; },
        off(id) { assert.equal(id,popup.id); popup.hidden=true; this.states[id]=true; }
    };
    let positions=0;
    const globalObject = {
        document:{getElementById(id) { return elements[id] || null; }},
        oCOM:{POPUP:popupController},
        EMU_COMPANION_LAYOUT:{
            position(target) {
                assert.equal(target,popup);
                positions++;
                target.style.left="812px";
                target.style.top="64px";
                target.style.width="460px";
                return true;
            }
        }
    };
    vm.runInNewContext(hostSource, {window:globalObject}, {
        filename:"EMU_pasteboard_script.js"
    });
    const api = globalObject.EMU_PASTEBOARD_SCRIPT;
    assert.equal(api.invoke("script.hide"),true);
    assert.equal(popup.hidden,true);
    assert.equal(attrs["aria-pressed"],"false");
    // A Script-button press must restore a script-hidden IDE.
    assert.equal(api.ui.toggle(),true);
    assert.equal(popup.hidden,false);
    assert.equal(attrs["aria-pressed"],"true");
    assert.equal(positions,1);
    assert.equal(popup.style.position,"absolute");
    assert.equal(popup.style.left,"812px");
    assert.equal(popup.style.top,"64px");
    // Script APIs must be idempotent when the dialog is already in that state.
    assert.equal(api.invoke("script.show"),true);
    assert.equal(popup.hidden,false);
    assert.equal(api.invoke("script.hide"),true);
    assert.equal(popup.hidden,true);
    assert.equal(api.invoke("script.show"),true);
    assert.equal(popup.hidden,false);
    assert.equal(positions,3);
});

test("Pasteboard companion must retain absolute document positioning", () => {
    const css = fs.readFileSync(path.join(ROOT,"res/EMU_pasteboard_script.css"),"utf8");
    assert.match(css,/\.EMU_pasteboardScriptPopup\s*\{[^}]*position:\s*absolute\s*!important/);
    assert.match(hostSource,/p\.style\.position\s*=\s*"absolute"/);
});


test("bundled starter macro sends a real BASIC command, not just a console hint", async () => {
    const found=hostSource.match(/var DEFAULT_SCRIPT = (\[[\s\S]*?\]\.join\("\\n"\));/);
    assert.ok(found,"Starter macro source is present");
    const script=vm.runInNewContext(found[1]);
    const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
    const fn=new AsyncFunction("apple","console","print",script);
    const typed=[],captured=[];
    const apple={
        text:{
            async type(text) {typed.push(text);return true;},
            async waitFor(phrase,options) {
                captured.push({phrase,timeout:options.timeout});
                return "42";
            }
        },
        memory:{async dump() {return "$0400  A0";}}
    };
    await fn(apple,{log(){}},()=>{});
    assert.deepEqual(typed,["PRINT 6*7\r"]);
    assert.deepEqual(captured,[{phrase:"42",timeout:10000}]);
});

test("real PasteBoard routes scripted text to the active A2KBD device", () => {
    const pasteboardSource=fs.readFileSync(
        path.join(ROOT,"res/EMU_DEVICE_pasteboard.js"),"utf8"
    );
    const context={};
    vm.runInNewContext(pasteboardSource,context);
    const device=new context.PasteBoard();
    const packets=[];
    const router={
        getTextInputTargetAddress() {return "0:A2KBD:text";},
        pipeResolve(address) {
            assert.equal(address,"0:PASTEBO:text");
            return {device};
        },
        pipeSend(source,target,message) {
            packets.push({source,target,mime:message.mime,data:message.data});
            return true;
        }
    };
    const host={
        document:{getElementById() {return null;}},
        apple2plus:{hwObj() {return {io:router};}}
    };
    vm.runInNewContext(hostSource,{window:host});
    assert.equal(host.EMU_PASTEBOARD_SCRIPT.invoke("text.type",{text:"PRINT 6*7\r"}),true);
    assert.deepEqual(packets,[{
        source:"0:PASTEBO:text",
        target:"0:A2KBD:text",
        mime:"text/plain",
        data:"PRINT 6*7\r"
    }]);
});

test("Example button restores the starter script and never references the removed worker", () => {
    const nodes={};
    function makeElement(tag) {
        const element={
            tagName:tag,
            style:{},
            children:[],
            hidden:false,
            value:"",
            addEventListener(){},
            setAttribute(){},
            focus(){},
            querySelector(){return null;},
            appendChild(child){this.children.push(child);}
        };
        Object.defineProperty(element,"innerHTML",{
            set(markup) {
                const ids=/\bid="(EMU_pasteboardScript[^"]+)"/g;
                let match;
                while((match=ids.exec(markup))!==null)
                    if(!nodes[match[1]]) nodes[match[1]]=makeElement("button");
            }
        });
        return element;
    }
    const dom={
        getElementById(id){return nodes[id]||null;},
        createElement:makeElement,
        body:{appendChild(node){nodes[node.id]=node;}}
    };
    nodes.EMU_pasteboardScriptToggle=makeElement("button");
    const host={
        document:dom,
        EMU_COMPANION_LAYOUT:{position(){return true;}}
    };
    vm.runInNewContext(hostSource,{window:host});
    const script=host.EMU_PASTEBOARD_SCRIPT;
    assert.equal(script.ui.open(),true);
    const editor=nodes.EMU_pasteboardScriptEditor;
    const example=nodes.EMU_pasteboardScriptExample;
    assert.match(editor.value,/await apple\.text\.type/);
    editor.value="// Changed manually";
    assert.doesNotThrow(()=>example.onclick());
    assert.match(editor.value,/PRINT 6\*7/);
    assert.doesNotMatch(hostSource,/\bif\s*\(\s*worker\s*\)/);
});

test("Safari-style message-free stack still shows exception name and reason", async () => {
    const runner=makeRunner(
        'const error = new Error("Embedded offline disk is unavailable or invalid");'+
        'error.stack = "invoke@file:///res/EMU_pasteboard_script.js:303:32";'+
        'throw error;'
    );
    assert.equal(runner.api.run(),true);
    await flushRunner();
    assert.equal(runner.elements.EMU_pasteboardScriptStatus.textContent,"error");
    const output=runner.elements.EMU_pasteboardScriptConsoleFallback.value;
    assert.match(output,/Error: Embedded offline disk is unavailable or invalid/);
    assert.match(output,/invoke@file:\/\/\/res\/EMU_pasteboard_script\.js:303:32/);
});

