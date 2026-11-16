/*
 * Pasteboard keyboard-handshake / offline ProDOS boot tests.
 * Run: node --test tests/pasteboard_prodos_automation.test.cjs
 */
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const ui=fs.readFileSync(path.join(ROOT,"res/EMU_pasteboard_script.js"),"utf8");
const keyboardSource=fs.readFileSync(path.join(ROOT,"res/EMU_DEVICE_keyboard.js"),"utf8");

function loadKeyboard() {
    const ctx={console,Date};
    vm.runInNewContext(keyboardSource,ctx);
    return new ctx.A2Pkeys();
}

test("A2KBD reports real CPU polling, latch and queue drain without side-effecting probes", () => {
    const kbd=loadKeyboard();
    assert.equal(kbd.getInputState().pollCount,0);
    kbd.read(0,{bRO:true});
    assert.equal(kbd.getInputState().pollCount,0,"safe debugger reads must not count");
    kbd.receiveText({data:"\x15\x15\r"});
    assert.equal(kbd.getInputState().queued,3);
    for(const expected of [0x15,0x15,0x0d]) {
        assert.equal(kbd.read(0,{}),expected);
        assert.equal(kbd.getInputState().latched,true);
        kbd.strobe();
    }
    const state=kbd.getInputState();
    assert.equal(state.queued,0);
    assert.equal(state.latched,false);
    assert.equal(state.pollCount,3);
    assert.equal(state.strobeCount,3);
    assert.ok(state.lastPollMs>0);
    kbd.reset();
    assert.equal(kbd.getInputState().pollCount,0);
    assert.equal(kbd.getInputState().lastPollMs,0);
});

function mockDeviceHost(opts={}) {
    const calls=[];
    const embeddedPath="disks/ProDOS 8.dsk";
    const disk={
        id:{PCODE:"DISKII"},
        getState() {return {active:true};},
        getOfflineDisks() {return [{name:"ProDOS 8.dsk",path:embeddedPath,size:143360}];},
        getOfflineDiskBytes(arg) {
            calls.push({event:"decode",path:arg.path});
            if(arg.path===embeddedPath) return new Uint8Array(143360);
            return null;
        }
    };
    const keyboard={
        getInputState() {
            return opts.status ? opts.status() :
                {active:true,pollCount:20,lastPollMs:Date.now(),
                    strobeCount:0,queued:0,latched:false};
        }
    };
    const io={
        SLOT2obj(index) {
            calls.push({event:"slot",index});
            return index===7?disk:null;
        },
        getTextInputTargetAddress() {return opts.target || "0:A2KBD:text";},
        pipeIsOpen(addr) {
            return opts.portOpen === undefined ? true : !!opts.portOpen;
        },
        pipeResolve(addr) {
            return {device:addr==="0:A2KBD:text"?keyboard:{
                captureText(){return opts.screen ? opts.screen() : "]";},
                sendText(_io,value){calls.push({event:"type",value});return true;}}};
        }
    };
    const elements=opts.editor? {
        EMU_pasteboardScriptEditor:{value:opts.editor},
        EMU_pasteboardScriptMode:{value:"program",disabled:false},
        EMU_pasteboardScriptStatus:{textContent:"ready"},
        EMU_pasteboardScriptRun:{disabled:false},
        EMU_pasteboardScriptStop:{disabled:true},
        EMU_pasteboardScriptConsoleFallback:{value:"",scrollTop:0}
    }:{};
    const window={
        document:{getElementById(id){return elements[id]||null;}},
        setTimeout,clearTimeout,
        apple2plus:{hwObj(){return {io};}},
        EMU_mountDiskImage(bytes,slot,drive,image) {
            calls.push({event:"mount",slot,drive,image,size:bytes.length});
            return true;
        }
    };
    vm.runInNewContext(ui,{window}, {filename:"EMU_pasteboard_script.js"});
    return {api:window.EMU_PASTEBOARD_SCRIPT,calls,elements,window};
}

test("offline ProDOS uses embedded Disk II image and maps physical S6 to slotN=7", () => {
    const {api,calls}=mockDeviceHost();
    const result=api.invoke("disk.loadOffline",{
        slot:6,drive:1,path:"disks/ProDOS 8.dsk"
    });
    assert.equal(result.slot,6);
    assert.equal(result.drive,"D1");
    assert.equal(result.bytes,143360);
    assert.ok(calls.some(x=>x.event==="slot" && x.index===7));
    assert.ok(calls.some(x=>x.event==="decode" && x.path==="disks/ProDOS 8.dsk"));
    assert.deepEqual(calls.filter(x=>x.event==="mount"),[
        {event:"mount",slot:7,drive:"D1",image:"disks/ProDOS 8.dsk",size:143360}
    ]);
    assert.deepEqual(Array.from(api.invoke("disk.listOffline",{slot:6})).map(x=>x.path),
        ["disks/ProDOS 8.dsk"]);
    assert.throws(()=>api.invoke("disk.loadOffline",{
        slot:6,drive:1,path:"https://example.org/disk.dsk"
    }),/Not an embedded offline/);
    assert.throws(()=>api.invoke("disk.loadOffline",{
        slot:5,drive:1,path:"disks/ProDOS 8.dsk"
    }),/No active DISKII/);
});

test("text.waitForReady waits for sustained new guest polling even with idle scheduler samples", async () => {
    let n=0;
    const runner=mockDeviceHost({
        editor:"await apple.text.waitForReady({stableMs:100,minPolls:5,interval:25,timeout:750});",
        status() {
            n++;
            return {
                active:true,
                pollCount:Math.floor(n/2)*3,
                strobeCount:0,
                lastPollMs:Date.now(),
                queued:0,
                latched:false
            };
        }
    });
    assert.equal(runner.api.run(),true);
    await new Promise(resolve=>setTimeout(resolve,220));
    assert.equal(runner.elements.EMU_pasteboardScriptStatus.textContent,"ready");
    assert.ok(n>=5);
});


test("prompt readiness proceeds with no A2KBD polls when the boot menu is visible", async () => {
    let samples=0;
    const query=mockDeviceHost({
        editor:"await apple.text.waitForReady({prompt:/RETURN\\s*:\\s*SELECT/i,timeout:500,interval:50});",
        screen(){return "BITSY BYE\nRETURN:SELECT\nBASIC.SYSTEM";},
        status(){
            samples++;
            return {active:true,pollCount:0,strobeCount:0,
                lastPollMs:0,queued:0,latched:false};
        }
    });
    assert.equal(query.api.invoke("text.status").pollCount,0);
    assert.equal(query.api.run(),true);
    await new Promise(resolve=>setTimeout(resolve,120));
    assert.equal(query.elements.EMU_pasteboardScriptStatus.textContent,"ready");
    assert.ok(samples>0);
});


test("visible ProDOS menu is ready when host keyboard capture is inactive but text port is open", async () => {
    // This is the real browser failure: opening the Script IDE can disable
    // window.onkeypress capture, but the A2KBD:text port remains functional.
    const query=mockDeviceHost({
        editor:"await apple.text.waitForReady({prompt:/RETURN\\s*:/i,timeout:500});",
        screen(){return "BITSY BYE\\nRETURN:SELECT\\nBASIC.SYSTEM";},
        status(){
            return {active:false,pollCount:0,strobeCount:0,
                lastPollMs:0,queued:0,latched:false};
        },
        portOpen:true
    });
    const input=query.api.invoke("text.status");
    assert.equal(input.hostCaptureActive,false);
    assert.equal(input.active,true,"script input must not inherit window.onkeypress focus");
    assert.equal(input.inputOpen,true);
    assert.equal(input.target,"0:A2KBD:text");
    assert.equal(query.api.run(),true);
    await new Promise(resolve=>setTimeout(resolve,110));
    assert.equal(query.elements.EMU_pasteboardScriptStatus.textContent,"ready");
    assert.doesNotMatch(query.elements.EMU_pasteboardScriptConsoleFallback.value,
        /A2KBD is inactive/);
});

test("readiness uses active VIDEXTXT port instead of motherboard host focus", async () => {
    const query=mockDeviceHost({
        editor:"await apple.text.waitForReady({prompt:'RETURN:SELECT',timeout:500});",
        target:"3:VIDEXTXT:text",
        status(){
            return {active:false,pollCount:0,strobeCount:0,
                lastPollMs:0,queued:0,latched:false};
        },
        screen(){return "RETURN:SELECT";},
        portOpen:true
    });
    const status=query.api.invoke("text.status");
    assert.equal(status.target,"3:VIDEXTXT:text");
    assert.equal(status.inputOpen,true);
    assert.equal(status.hostCaptureActive,false);
    query.api.run();
    await new Promise(resolve=>setTimeout(resolve,110));
    assert.equal(query.elements.EMU_pasteboardScriptStatus.textContent,"ready");
});

test("visible prompt does not incorrectly declare readiness when input port is closed", async () => {
    const query=mockDeviceHost({
        editor:"await apple.text.waitForReady({prompt:/RETURN\\s*:/i,timeout:500});",
        screen(){return "BITSY BYE\\nRETURN:SELECT";},
        status(){
            return {active:true,pollCount:12,strobeCount:0,
                lastPollMs:Date.now(),queued:0,latched:false};
        },
        portOpen:false
    });
    assert.equal(query.api.invoke("text.status").active,false);
    query.api.run();
    await new Promise(resolve=>setTimeout(resolve,110));
    assert.equal(query.elements.EMU_pasteboardScriptStatus.textContent,"error");
    assert.match(query.elements.EMU_pasteboardScriptConsoleFallback.value,
        /text input port 0:A2KBD:text is closed or unavailable/);
});

test("A2KBD queues and consumes pasteboard keys even when host-key capture is disabled", () => {
    const keyboard=loadKeyboard();
    keyboard.isActive(false);
    assert.equal(keyboard.getInputState().active,false);
    assert.equal(keyboard.receiveText({data:"\x15\x15\r"}),true);
    assert.equal(keyboard.getInputState().queued,3);
    for(const key of [0x15,0x15,0x0d]) {
        assert.equal(keyboard.read(0,{}),key);
        keyboard.strobe();
    }
    assert.equal(keyboard.getInputState().queued,0);
    assert.equal(keyboard.getInputState().latched,false);
});

test("prompt readiness times out with keyboard and screen diagnostics", async () => {
    const query=mockDeviceHost({
        editor:"await apple.text.waitForReady({prompt:/UNAVAILABLE_MENU/,timeout:100,interval:50});",
        status(){
            return {active:true,pollCount:0,strobeCount:0,
                lastPollMs:0,queued:0,latched:false};
        }
    });
    query.api.run();
    await new Promise(resolve=>setTimeout(resolve,180));
    assert.equal(query.elements.EMU_pasteboardScriptStatus.textContent,"error");
    assert.match(query.elements.EMU_pasteboardScriptConsoleFallback.value,
        /keyboard=.*pollCount/);
    assert.match(query.elements.EMU_pasteboardScriptConsoleFallback.value,
        /screen=.*]/);
});

test("one brief burst of boot-time keyboard polling is not mistaken for ready", async () => {
    let samples=0;
    const when=Date.now();
    const runner=mockDeviceHost({
        editor:"await apple.text.waitForReady({stableMs:100,minPolls:4,interval:25,timeout:200});",
        status() {
            samples++;
            return {
                active:true,
                pollCount:samples===1?0:12,
                strobeCount:0,
                lastPollMs:when,
                queued:0,latched:false
            };
        }
    });
    assert.equal(runner.api.run(),true);
    await new Promise(resolve=>setTimeout(resolve,270));
    assert.equal(runner.elements.EMU_pasteboardScriptStatus.textContent,"error");
    assert.match(runner.elements.EMU_pasteboardScriptConsoleFallback.value,
        /Timed out waiting for guest keyboard polling/);
});

test("frame-driven ProDOS demo mounts S6,D1, navigates Bitsy Bye and verifies HELLO WORLD", async () => {
    const match=ui.match(/var PRODOS_STATE_SCRIPT = (\[[\s\S]*?\]\.join\("\\n"\));/);
    assert.ok(match,"ProDOS state-machine source must be present in the editor");
    const source=vm.runInNewContext(match[1]);
    const config=new Function("apple","console","print","data",
        '"use strict";\n'+source+'\nreturn {initialState,states,stateTimeoutMs};'
    )({}, {log(){}}, ()=>{}, {});
    const expected=[
        "mountDisk","reboot","waitForBootMenu","selectBasicSystem",
        "drainMenuKeys","waitForBasicPrompt","typeHelloWorld",
        "drainBasicKeys","verifyOutput","finish"
    ];
    assert.deepEqual(Object.keys(config.states),expected);
    assert.equal(config.initialState,"mountDisk");
    assert.equal(config.stateTimeoutMs,60000);

    const events=[],data={},printed=[];
    let screen="BOOTING",queued=0;
    const apple={
        script:{
            async hide(){events.push("hide");},
            async show(){events.push("show");}
        },
        cpu:{async setSpeed(pct){events.push(["speed",pct]);return pct;}},
        disk:{
            async loadOffline(opts){events.push(["disk",opts]);return opts;}
        },
        async reboot(){events.push("reboot");},
        text:{
            async capture(){return screen;},
            async status(){return {inputOpen:true,target:"0:A2KBD:text",
                queued,latched:false};},
            async type(value){events.push(["type",value]);queued=value.length;}
        }
    };
    const log={log(...args){printed.push(args.join(" "));}};
    const step=async (name)=>{
        const result=await config.states[name]({apple,data,console:log});
        return result;
    };
    assert.equal(await step("mountDisk"),"reboot");
    assert.deepEqual(events.slice(0,3),["hide",["speed",400],["disk",{
        slot:6,drive:1,path:"disks/ProDOS 8.dsk"
    }]]);
    assert.equal(await step("reboot"),"waitForBootMenu");
    assert.equal(await step("waitForBootMenu"),undefined);
    assert.equal(data.menuChecks,1);
    screen="BITSY BYE\nRETURN:SELECT\nBASIC.SYSTEM";
    assert.equal(await step("waitForBootMenu"),"selectBasicSystem");
    assert.equal(await step("selectBasicSystem"),"drainMenuKeys");
    assert.equal(await step("drainMenuKeys"),undefined);
    queued=0;
    assert.equal(await step("drainMenuKeys"),"waitForBasicPrompt");
    assert.equal(await step("waitForBasicPrompt"),undefined);
    screen="READY\n]";
    assert.equal(await step("waitForBasicPrompt"),"typeHelloWorld");
    assert.equal(await step("typeHelloWorld"),"drainBasicKeys");
    assert.equal(await step("drainBasicKeys"),undefined);
    queued=0;
    assert.equal(await step("drainBasicKeys"),"verifyOutput");
    screen='PRINT "HELLO WORLD"\n]';
    assert.equal(await step("verifyOutput"),undefined,
        "echo of PRINT command must not count as verified output");
    screen='PRINT "HELLO WORLD"\nHELLO WORLD\n]';
    assert.equal(await step("verifyOutput"),"finish");
    assert.equal(data.outputVerified,true);
    assert.equal(data.menuChecks,2);
    assert.equal(data.basicChecks,2);
    assert.equal(data.outputChecks,2);
    assert.deepEqual(Array.from(data.history),[
        "mounted","reboot","menu ready","right, right, return",
        "BASIC.SYSTEM prompt",'PRINT "HELLO WORLD"',"HELLO WORLD verified"
    ]);
    assert.deepEqual(events.filter(x=>Array.isArray(x)&&x[0]==="type"),[
        ["type","\x15\x15\r"],["type",'PRINT "HELLO WORLD"\r']
    ]);
    assert.deepEqual(await step("finish"),{done:true});
    assert.deepEqual(events.slice(-2),[["speed",100],"show"]);
    assert.ok(printed.some(x=>x.includes("demonstration complete")));
});

test("checked-in ProDOS test script matches the IDE ProDOS Demo", () => {
    const match=ui.match(/var PRODOS_STATE_SCRIPT = (\[[\s\S]*?\]\.join\("\\n"\));/);
    assert.ok(match);
    const bundled=vm.runInNewContext(match[1]);
    const pathToScript=path.join(ROOT,"docs/examples/PASTEBOARD_ProDOS8_Offline_Boot.js");
    const standalone=fs.readFileSync(pathToScript,"utf8");
    assert.equal(standalone.trimEnd(),bundled);
    const factory=new Function("apple","console","print","data",
        '"use strict";\n'+standalone+'\nreturn {initialState,states};');
    const cfg=factory({}, {log(){}},()=>{}, {});
    assert.equal(cfg.initialState,"mountDisk");
    assert.equal(typeof cfg.states.waitForBootMenu,"function");
});
