/**
 * PASTEBOARD SCRIPT URI and CPU-throttle tests.
 * Run: node --test tests/pasteboard_speed_uri.test.cjs
 */
"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const ROOT=path.resolve(__dirname,"..");
const hostSource=fs.readFileSync(path.join(ROOT,"res/EMU_pasteboard_script.js"),"utf8");
const mainSource=fs.readFileSync(path.join(ROOT,"res/EMU_apple2main.js"),"utf8");
const pako=require(path.join(ROOT,"res/pako.min.js"));

function hostFixture(script="console.log('Hello');",url="https://example.test/index.html") {
    const elements={},copies=[],speedCalls=[];
    let speed=100;
    function node(tag) {
        const item={
            tagName:tag,hidden:false,style:{},children:[],
            value:"",textContent:"",disabled:false,
            addEventListener(){},setAttribute(){},focus(){},
            querySelector(){return null;},appendChild(child){this.children.push(child);},
            scrollTop:0
        };
        Object.defineProperty(item,"innerHTML",{
            set(html) {
                const pattern=/\bid="(EMU_pasteboardScript[^"]+)"/g;
                let m;
                while((m=pattern.exec(html))!==null)
                    if(!elements[m[1]])elements[m[1]]=node("button");
            }
        });
        return item;
    }
    elements.EMU_pasteboardScriptToggle=node("button");
    elements.EMU_pasteboardScriptEditor=node("textarea");
    elements.EMU_pasteboardScriptMode=node("select");
    elements.EMU_pasteboardScriptMode.value="program";
    elements.EMU_pasteboardScriptEditor.value=script;
    elements.EMU_pasteboardScriptStatus=node("span");
    elements.EMU_pasteboardScriptRun=node("button");
    elements.EMU_pasteboardScriptStop=node("button");
    elements.EMU_pasteboardScriptConsoleFallback=node("textarea");

    const loc=new URL(url);
    const g={
        document:{
            getElementById(id){return elements[id]||null;},
            createElement:node,
            body:{appendChild(el){elements[el.id]=el;}}
        },
        location:loc,URL,URLSearchParams,pako,TextEncoder,TextDecoder,
        atob,btoa,
        setTimeout,clearTimeout,
        addEventListener(){},
        navigator:{clipboard:{async writeText(text){copies.push(text);}}},
        oEMUI:{
            cpuGetPercent(){return speed;},
            cpuSetPercent(percent){
                if(!Number.isInteger(percent)||percent<0||percent>400)
                    throw new RangeError("CPU speed must be 0..400.");
                speedCalls.push(percent);
                speed=percent;
                return speed;
            }
        }
    };
    vm.runInNewContext(hostSource,{window:g});
    return {
        api:g.EMU_PASTEBOARD_SCRIPT,g,elements,copies,speedCalls,
        currentSpeed(){return speed;}
    };
}

test("CPU slider percent control uses existing CPU scheduler and updates percentage UI", () => {
    const begin=mainSource.indexOf("this.cpuGetPercent = function()");
    const end=mainSource.indexOf("// MODIFY CPU SPEED",begin);
    assert.ok(begin>0 && end>begin);
    const implementation=mainSource.slice(begin,end);
    const attrs={};
    const slider={
        setAttribute(name,value){attrs[name]=value;},
        min:0,max:400,step:10,value:100
    };
    const config={CPU_ClocksTicks_s:1021800,CPU_TargetTicks_s:1021800};
    const multipliers=[];
    const cpu={
        cpuSldPreview(el,id){
            assert.equal(el,slider);
            assert.equal(id,"slider_1v");
        },
        cpuSpd(factor){
            multipliers.push(factor);
            config.CPU_TargetTicks_s=config.CPU_ClocksTicks_s*factor;
        }
    };
    const document={getElementById(id){return id==="myRange"?slider:null;}};
    vm.runInNewContext("(function(){"+implementation+"}).call(cpu);",{
        cpu,document,_o:config
    });
    assert.equal(cpu.cpuSetPercent(400),400);
    assert.equal(cpu.cpuGetPercent(),400);
    assert.equal(slider.value,400);
    assert.equal(attrs["data-speed-mode"],"pct400");
    assert.equal(cpu.cpuSetPercent(100),100);
    assert.deepEqual(multipliers,[4,1]);
    assert.throws(()=>cpu.cpuSetPercent(401),/0% to 400%/);
    assert.throws(()=>cpu.cpuSetPercent(-1),/0% to 400%/);
    assert.throws(()=>cpu.cpuSetPercent(33.5),/integer/);
});

test("macro may accelerate the CPU and restore normal speed", async () => {
    const fixture=hostFixture();
    fixture.elements.EMU_pasteboardScriptEditor.value=[
        "const old=await apple.cpu.getSpeed();",
        "await apple.cpu.setSpeed(400);",
        "await apple.wait(1);",
        "await apple.cpu.setSpeed(100);"
    ].join("\n");
    assert.equal(fixture.api.run(),true);
    await new Promise(r=>setTimeout(r,35));
    assert.deepEqual(fixture.speedCalls,[400,100]);
    assert.equal(fixture.currentSpeed(),100);
    assert.equal(fixture.elements.EMU_pasteboardScriptStatus.textContent,"ready");
});

test("STOP restores prior CPU speed even when the script's finally cannot await", async () => {
    const fixture=hostFixture();
    fixture.elements.EMU_pasteboardScriptEditor.value=[
        "await apple.cpu.setSpeed(400);",
        "await apple.wait(60000);",
        "await apple.cpu.setSpeed(100);"
    ].join("\n");
    assert.equal(fixture.api.run(),true);
    await new Promise(r=>setTimeout(r,10));
    assert.equal(fixture.currentSpeed(),400);
    assert.equal(fixture.api.stop(),true);
    assert.equal(fixture.currentSpeed(),100);
    assert.deepEqual(fixture.speedCalls,[400,100]);
});

test("pscript round-trips Unicode and newlines using existing Deflate and Base64URL format", () => {
    const fixture=hostFixture();
    const source='// Café ☕\nconsole.log("Добрый день");\nawait apple.wait(123);\n';
    const encoded=fixture.api.uri.encode(source);
    assert.match(encoded,/^[A-Za-z0-9_-]+$/);
    assert.equal(fixture.api.uri.decode(encoded),source);
    // Also accept standard (padded) Base64 and escaped '+' conventions.
    const standard=encoded.replace(/-/g,"+").replace(/_/g,"/");
    assert.equal(fixture.api.uri.decode(standard),source);
});

test("pscript URL import opens the editor but never auto-executes source", () => {
    const fixture=hostFixture("console.log('old');","https://example.test/index.html?model=A2P#tab1");
    const script="await apple.cpu.setSpeed(400);\nthrow new Error('must not run');";
    fixture.g.location=new URL("https://example.test/index.html?model=A2P&pscript="+
        fixture.api.uri.encode(script)+"#tab1");
    assert.equal(fixture.api.uri.importFromLocation(),true);
    assert.equal(fixture.elements.EMU_pasteboardScriptEditor.value,script);
    assert.equal(fixture.elements.EMU_pasteboardScriptStatus.textContent,"ready");
    assert.deepEqual(fixture.speedCalls,[]);
    assert.equal(fixture.api.uri.importFromLocation(),false,"import is one-shot");
});

test("Copy URI preserves other query parameters and URL fragment", async () => {
    const fixture=hostFixture("await apple.cpu.setSpeed(200);",
        "https://example.test/index.html?model=A2P#tab1");
    fixture.api.ui.open();
    // A real user edits the source after opening the IDE (which initially
    // populates its bundled starter script).
    fixture.elements.EMU_pasteboardScriptEditor.value="await apple.cpu.setSpeed(200);";
    const uri=fixture.api.uri.current();
    const parsed=new URL(uri);
    assert.equal(parsed.searchParams.get("model"),"A2P");
    assert.equal(parsed.hash,"#tab1");
    assert.equal(fixture.api.uri.decode(parsed.searchParams.get("pscript")),
        fixture.elements.EMU_pasteboardScriptEditor.value);
    fixture.api.uri.importFromLocation(); // marks initial URL as handled
    // The share control is wired when the companion popup is created.
    fixture.api.ui.open();
    await fixture.elements.EMU_pasteboardScriptShareURI.onclick();
    assert.deepEqual(fixture.copies,[uri]);
});

test("pscript rejects malformed Base64 and decompression bombs without execution", () => {
    const fixture=hostFixture();
    assert.throws(()=>fixture.api.uri.decode("***"),/Base64/);
    const oversized=pako.deflate(new TextEncoder().encode("x".repeat(70000)));
    const encoded=btoa(String.fromCharCode(...oversized))
        .replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
    assert.throws(()=>fixture.api.uri.decode(encoded),/exceeds 64 KiB/);
    assert.throws(()=>fixture.api.uri.encode("A".repeat(70000)),/at most 64 KiB/);
});

test("Legacy Worker failure cannot recur: no stale worker invocation remains", () => {
    assert.doesNotMatch(hostSource,/\bif\s*\(\s*worker\s*\)/);
    assert.doesNotMatch(hostSource,/new\s+Worker\s*\(/);
});
