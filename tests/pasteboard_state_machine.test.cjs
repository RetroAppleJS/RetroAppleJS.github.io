/* Frame-driven state machine regression tests.
 * node --test tests/pasteboard_state_machine.test.cjs
 */
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(ROOT,"res/EMU_pasteboard_script.js"),"utf8");
const main=fs.readFileSync(path.join(ROOT,"res/EMU_apple2main.js"),"utf8");
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(script,mode="state") {
    const elements={
        EMU_pasteboardScriptMode:{value:mode,disabled:false},
        EMU_pasteboardScriptEditor:{value:script},
        EMU_pasteboardScriptStatus:{textContent:"ready"},
        EMU_pasteboardScriptRun:{disabled:false},
        EMU_pasteboardScriptStop:{disabled:true},
        EMU_pasteboardScriptConsoleFallback:{value:"",scrollTop:0}
    };
    const texts=[];
    let screen="BOOTING";
    const device={
        captureText(){return screen;},
        sendText(_router,value){texts.push(value);return true;}
    };
    const win={
        document:{getElementById(id){return elements[id]||null;}},
        setTimeout,clearTimeout,
        apple2plus:{hwObj(){return {io:{pipeResolve(){return {device};}}};}},
        oEMUI:{cpuGetPercent(){return 100;},cpuSetPercent(p){return p;}}
    };
    vm.runInNewContext(source,{window:win},{filename:"EMU_pasteboard_script.js"});
    return {
        api:win.EMU_PASTEBOARD_SCRIPT,elements,texts,
        setScreen(value){screen=value;},
        get output(){return elements.EMU_pasteboardScriptConsoleFallback.value;}
    };
}

test("existing scheduler triggers the frame-mode hook after CPU cycles",()=>{
    const a=main.indexOf("apple2plus.cycle(_o.CPU_ClockTicks);");
    const b=main.indexOf("EMU_PASTEBOARD_SCRIPT.onFrame()",a);
    const c=main.indexOf("systemScheduler.accumulated_ms-=frameMs;",a);
    assert.ok(a>=0&&b>a&&c>b);
    assert.doesNotMatch(source,/setInterval\s*\(/);
});

test("default state example retains arrays and counters through frames",async()=>{
    const match=source.match(/var DEFAULT_STATE_SCRIPT = (\[[\s\S]*?\]\.join\("\\n"\));/);
    assert.ok(match);
    const script=vm.runInNewContext(match[1]);
    const f=fixture(script);
    assert.equal(f.api.run(),true);
    for(let i=0;i<3;i++){f.api.onFrame();await flush();}
    assert.equal(f.api.stateMachine.inspect().data.polls,3);
    f.setScreen("READY\n]");
    f.api.onFrame();await flush();
    assert.equal(f.api.stateMachine.inspect().state,"type");
    f.api.onFrame();await flush();
    const snapshot=f.api.stateMachine.inspect();
    assert.equal(snapshot.state,"verify");
    assert.equal(snapshot.data.polls,4);
    assert.deepEqual(Array.from(snapshot.data.commands),['PRINT "HELLO WORLD"']);
    assert.deepEqual(f.texts,['PRINT "HELLO WORLD"\r']);
    f.setScreen('READY\n]PRINT "HELLO WORLD"\nHELLO WORLD\n]');
    f.api.onFrame();await flush();
    assert.equal(f.elements.EMU_pasteboardScriptStatus.textContent,"ready");
    assert.match(f.output,/State machine completed/);
});

test("ctx.data is exactly the same reference across repeated calls and transitions",async()=>{
    const script=[
        "const states={",
        " first:({data})=>{",
        "   data.count=(data.count||0)+1;",
        "   (data.items ||= []).push(data.count);",
        "   if(data.count===3)return 'second';",
        " },",
        " second:({data,console})=>{console.log(data.items);return {done:true};}",
        "};",
        "const initialState='first';"
    ].join("\n");
    const f=fixture(script);
    f.api.run();
    const data=f.api.stateMachine.inspect().data;
    for(let i=0;i<3;i++){f.api.onFrame();await flush();}
    const details=f.api.stateMachine.inspect();
    assert.strictEqual(details.data,data);
    assert.equal(details.state,"second");
    assert.equal(details.transitions,1);
    assert.deepEqual(Array.from(data.items),[1,2,3]);
    f.api.onFrame();await flush();
    assert.match(f.output,/first → second/);
    assert.match(f.output,/COMPLETE state=second/);
});

test("new RUN creates new data and Program ignores frame callbacks",async()=>{
    const f=fixture("const states={start:({data})=>{data.count=1;return {done:true};}};");
    f.api.run();
    const old=f.api.stateMachine.inspect().data;
    f.api.onFrame();await flush();
    assert.equal(old.count,1);
    f.api.run();
    assert.notStrictEqual(f.api.stateMachine.inspect().data,old);
    f.api.stop();
    f.elements.EMU_pasteboardScriptMode.value="program";
    f.elements.EMU_pasteboardScriptEditor.value='console.log("LEGACY");';
    f.api.run();await flush();
    assert.equal(f.api.onFrame(),false);
    assert.match(f.output,/LEGACY/);
});

test("pending async state handler is never invoked concurrently",async()=>{
    const f=fixture([
      "const states={",
      " pending:({data})=>{",
      "   data.calls=(data.calls||0)+1;",
      "   return new Promise(resolve=>{data.release=resolve;});",
      " }",
      "};"
    ].join("\n"));
    f.api.run();
    assert.equal(f.api.onFrame(),true);
    for(let i=0;i<5;i++)assert.equal(f.api.onFrame(),false);
    assert.equal(f.api.stateMachine.inspect().data.calls,1);
    assert.equal(f.api.stateMachine.inspect().skippedFrames,5);
    f.api.stateMachine.inspect().data.release();
    await flush();
    assert.equal(f.api.onFrame(),true);
    assert.equal(f.api.stateMachine.inspect().data.calls,2);
    f.api.stop();
});

test("stalled state times out on frame tick with trace",async()=>{
    const f=fixture("const stateTimeoutMs=100;const states={start:()=>undefined};");
    f.api.run();f.api.onFrame();await flush();
    await new Promise(resolve=>setTimeout(resolve,115));
    assert.equal(f.api.onFrame(),false);
    assert.equal(f.elements.EMU_pasteboardScriptStatus.textContent,"error");
    assert.match(f.output,/Timeout after 100ms in state 'start'/);
});

test("unknown state transitions report errors",async()=>{
    const f=fixture("const states={start:()=> 'missing'};");
    f.api.run();f.api.onFrame();await flush();
    assert.equal(f.elements.EMU_pasteboardScriptStatus.textContent,"error");
    assert.match(f.output,/Invalid state transition/);
});
