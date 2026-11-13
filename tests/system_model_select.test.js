// Node tests for the model switcher without a browser or full emulator.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.join(__dirname,"..");
const config=fs.readFileSync(path.join(root,"res/COM_CONFIG.js"),"utf8")
    .split("const _CFG_ROMRANGES =")[0];
const helper=fs.readFileSync(path.join(root,"res/EMU_system_models.js"),"utf8");

function makeSystem()
{
    let boots=0, redraws=0;
    const video={
        font:"A2_US",
        getCharRomKey(){ return this.font; },
        setCharRom(key){ this.font=key; return key; }
    };
    const location={href:"https://example.org/index.html?foo=bar#tab1"};
    const history={
        replaceState(_state,_title,url)
        {
            location.href=new URL(url,location.href).href;
        }
    };
    const context={
        console:{log(){},warn(){},error(){}},
        URL,
        window:{location,history,confirm:()=>true},
        oEMU:{system:{A2P:{active:true}}},
        _TABS:{tab1:{DEF_SYS:"A2P"},tab2:{DEF_SYS:"A2P"}},
        apple2plus:{
            vidObj(){return video;},
            restart(){boots++;}
        },
        system_tab_update(){redraws++;}
    };
    vm.createContext(context);
    vm.runInContext(config,context,{filename:"COM_CONFIG.js"});
    vm.runInContext(helper,context,{filename:"EMU_system_models.js"});
    context.EMU_system_get=()=>Object.keys(context.oEMU.system)
        .find(code=>context.oEMU.system[code] &&
              context.oEMU.system[code].active===true);
    return {context,video,location,get boots(){return boots;},get redraws(){return redraws;}};
}

test("only non-dash system codes are offered",()=>{
    const {context}=makeSystem();
    assert.deepEqual(Array.from(context.EMU_system_modelCodes()),["A2P","A2JP"]);
});

test("an invalid or disabled model cannot become active",()=>{
    const s=makeSystem();
    assert.equal(s.context.EMU_system_applyModel("-A2"),false);
    assert.equal(s.context.EMU_system_selectModel("-A2"),false);
    assert.equal(s.context.EMU_system_selectModel("Unknown"),false);
    assert.equal(s.context.EMU_system_get(),"A2P");
    assert.equal(s.boots,0);
});

test("switch to J-Plus reboots, sets the Japanese character ROM and preserves URL options",()=>{
    const s=makeSystem();
    assert.equal(s.context.EMU_system_selectModel("A2JP"),true);
    assert.equal(s.context.EMU_system_get(),"A2JP");
    assert.equal(s.context.oEMU.system.A2P.active,false);
    assert.equal(s.context._TABS.tab1.SYS,"A2JP");
    assert.equal(s.video.font,"A2_JP");
    assert.equal(s.boots,1);
    assert.equal(s.location.href,"https://example.org/index.html?foo=bar&sys=A2JP#tab1");

    assert.equal(s.context.EMU_system_selectModel("A2JP"),true);
    assert.equal(s.boots,1,"reselecting the active model must not reboot");

    assert.equal(s.context.EMU_system_selectModel("A2P"),true);
    assert.equal(s.context.EMU_system_get(),"A2P");
    assert.equal(s.video.font,"A2_US");
    assert.equal(s.boots,2);
    assert.equal(s.location.href,"https://example.org/index.html?foo=bar&sys=A2P#tab1");
});

test("canceling the cold boot leaves the running machine untouched",()=>{
    const s=makeSystem();
    s.context.window.confirm=()=>false;
    assert.equal(s.context.EMU_system_selectModel("A2JP"),false);
    assert.equal(s.context.EMU_system_get(),"A2P");
    assert.equal(s.video.font,"A2_US");
    assert.equal(s.boots,0);
    assert.equal(s.location.href,"https://example.org/index.html?foo=bar#tab1");
    assert.ok(s.redraws>0,"restore the selector after cancellation");
});

test("failed restart restores the model and character ROM",()=>{
    const s=makeSystem();
    s.context.apple2plus.restart=()=>{throw new Error("restart failed");};
    assert.equal(s.context.EMU_system_selectModel("A2JP"),false);
    assert.equal(s.context.EMU_system_get(),"A2P");
    assert.equal(s.video.font,"A2_US");
    assert.equal(s.location.href,"https://example.org/index.html?foo=bar#tab1");
});

test("UI renders its model selector from the supported models",()=>{
    const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
    assert.match(html,/EMU_system_modelCodes\(\)\.map/);
    assert.match(html,/onchange="EMU_system_selectModel\(this\.value\)"/);
    assert.match(html,/id="system_model_button"/);
});
