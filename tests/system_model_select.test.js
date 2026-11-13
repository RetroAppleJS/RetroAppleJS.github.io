// Model configurations, ROM selection and STEP TRACE-sized UI tests.
// Run with: node --test tests/system_model_select.test.js
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.join(__dirname,"..");
const config=fs.readFileSync(path.join(root,"res/COM_CONFIG.js"),"utf8")
    .split("const _CFG_ROMRANGES =")[0];
const helper=fs.readFileSync(path.join(root,"res/EMU_system_models.js"),"utf8");
const popupSource=fs.readFileSync(path.join(root,"res/EMU_system_config_popup.js"),"utf8");

function makeSystem(query="")
{
    let boots=0,redraws=0;
    const warnings=[];
    const video={
        font:"A2_US",
        getCharRomKey(){return this.font;},
        setCharRom(key){this.font=key;return key;}
    };
    const location={href:"https://example.org/index.html?foo=bar"+query+"#tab1"};
    const history={replaceState(_state,_title,url){location.href=new URL(url,location.href).href;}};
    const queryParams=new URL(location.href).searchParams,uri={};
    for(const [key,value] of queryParams) uri[key]=value;
    const rom=new Uint8Array(12288);
    rom[0xFABB-0xD000]=0x07;
    const context={
        console:{log(){},warn(s){warnings.push(String(s));},error(){}},
        URL,window:{location,history,confirm:()=>true,addEventListener(){}},
        apple2Rom:rom,
        apple2CharRom:{A2_US:new Uint8Array(1),A2_JP:new Uint8Array(1)},
        oCOM:{URL:{uri}},
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
    context.EMU_system_configStartup();
    return {context,rom,video,location,uri,warnings,
        get boots(){return boots;},
        get redraws(){return redraws;}};
}

test("only enabled system rows are offered",()=>{
    const s=makeSystem();
    assert.deepEqual(Array.from(s.context.EMU_system_modelCodes()),["A2P","A2JP"]);
    assert.deepEqual(Array.from(s.context.EMU_system_options("A2P","ROM")),["A2P_R","A2P_RL"]);
    assert.deepEqual(Array.from(s.context.EMU_system_options("A2JP","KeyFont")),["A2_JP"]);
    assert.deepEqual(Array.from(s.context.EMU_system_options("-A2","CPU")),[]);
});

test("a disabled model or invalid cell selection cannot be activated",()=>{
    const s=makeSystem();
    assert.equal(s.context.EMU_system_selectConfiguration("-A2"),false);
    assert.equal(s.context.EMU_system_selectConfiguration("A2P",{CPU:"65C02"}),false);
    assert.equal(s.context.EMU_system_selectConfiguration("A2P",{ROM:"missing"}),false);
    assert.equal(s.context.EMU_system_get(),"A2P");
    assert.equal(s.boots,0);
});

test("A2P_RL applies exactly the single-byte LIRON boot-ROM patch",()=>{
    const s=makeSystem();
    assert.equal(s.rom[0xFABB-0xD000],0x07);
    assert.equal(s.context.EMU_system_selectConfiguration("A2P",{ROM:"A2P_RL"}),true);
    assert.equal(s.rom[0xFABB-0xD000],0x05);
    assert.equal(s.boots,1);
    assert.equal(s.context.EMU_system_getConfiguration("A2P").ROM,"A2P_RL");
    assert.equal(s.location.href,"https://example.org/index.html?foo=bar&sys=A2P&sys_rom=A2P_RL#tab1");

    assert.equal(s.context.EMU_system_selectConfiguration("A2P",{ROM:"A2P_R"}),true);
    assert.equal(s.rom[0xFABB-0xD000],0x07);
    assert.equal(s.boots,2);
    assert.ok(!s.location.href.includes("sys_rom"));
});

test("J-Plus selection changes the character ROM and falls back transparently to base motherboard ROM",()=>{
    const s=makeSystem();
    assert.equal(s.context.EMU_system_selectModel("A2JP"),true);
    assert.equal(s.context.EMU_system_get(),"A2JP");
    assert.equal(s.rom[0xFABB-0xD000],0x07);
    assert.equal(s.video.font,"A2_JP");
    assert.equal(s.boots,1);
    assert.equal(s.context.EMU_system_getConfiguration("A2JP").ROM,"A2P_RJ");
    assert.equal(s.context.EMU_system_effectiveRom(s.context.EMU_system_getConfiguration("A2JP")),"A2P_R");
    assert.equal(s.context.EMU_system_selectModel("A2JP"),true);
    assert.equal(s.boots,1);
    assert.equal(s.context.EMU_system_selectModel("A2P"),true);
    assert.equal(s.context.EMU_system_get(),"A2P");
    assert.equal(s.video.font,"A2_US");
    assert.equal(s.boots,2);
});

test("declining a cold boot preserves active configuration and ROM",()=>{
    const s=makeSystem();
    s.context.window.confirm=()=>false;
    assert.equal(s.context.EMU_system_selectConfiguration("A2P",{ROM:"A2P_RL"}),false);
    assert.equal(s.rom[0xFABB-0xD000],0x07);
    assert.equal(s.boots,0);
    assert.equal(s.location.href,"https://example.org/index.html?foo=bar#tab1");
    assert.ok(s.redraws===0);
});

test("a thrown reboot restores model, font and original motherboard ROM",()=>{
    const s=makeSystem();
    s.context.apple2plus.restart=()=>{throw new Error("synthetic boot failure");};
    assert.equal(s.context.EMU_system_selectConfiguration("A2P",{ROM:"A2P_RL"}),false);
    assert.equal(s.rom[0xFABB-0xD000],0x07);
    assert.equal(s.context.EMU_system_get(),"A2P");
    assert.equal(s.video.font,"A2_US");
    assert.equal(s.location.href,"https://example.org/index.html?foo=bar#tab1");
});

test("startup restores a selected ROM variant from URL before boot",()=>{
    const s=makeSystem("&sys_rom=A2P_RL");
    assert.equal(s.rom[0xFABB-0xD000],0x05);
    assert.equal(s.context.EMU_system_getConfiguration("A2P").ROM,"A2P_RL");
    assert.equal(s.boots,0);
});

test("popup renders one system radio per row and only multi-choice radios within cells",()=>{
    const s=makeSystem();
    const elements={};
    const rect={left:720,top:140,width:360,height:440};
    const dbg={hidden:true,style:{visibility:""},getBoundingClientRect(){return rect;}};
    const host={getBoundingClientRect(){return rect;}};
    elements.cpuDbg_popup=dbg;
    elements.feature_box=host;
    const popupState={states:{},scopes:{},
        addScope(id,tab){this.scopes[id]=tab;this.states[id]=true;},
        on(id){this.states[id]=false;elements[id].hidden=false;},
        off(id){this.states[id]=true;elements[id].hidden=true;}
    };
    elements.system_model_button={setAttribute(){}};
    const body={
        appendChild(node){elements[node.id]=node;},
    };
    const document={
        body,
        createElement(tag)
        {
            return {tagName:tag,style:{},hidden:false,
                addEventListener(kind,cb){this.events=this.events||{};this.events[kind]=cb;},
                setAttribute(){},
                querySelector(){return null;},
                querySelectorAll(){return [];},
            };
        },
        getElementById(id){return elements[id]||null;}
    };
    s.context.document=document;
    s.context.oCOM.POPUP=popupState;
    s.context.window.innerWidth=1280;
    s.context.window.innerHeight=900;
    vm.runInContext(popupSource,s.context,{filename:"EMU_system_config_popup.js"});
    assert.equal(s.context.EMU_SYSTEM_CONFIG.toggle(),true);
    const panel=elements.EMU_system_config_popup;
    assert.equal(panel.hidden,false);
    assert.equal(popupState.scopes.EMU_system_config_popup,"tab1.1");
    assert.equal(panel.style.width,"360px");
    assert.equal(panel.style.left,"720px");
    assert.equal(panel.style.top,"140px");
    assert.match(panel.innerHTML,/name="sysconfig_model"/);
    assert.equal((panel.innerHTML.match(/name="sysconfig_model"/g)||[]).length,2);
    assert.equal((panel.innerHTML.match(/name="sysconfig_A2P_ROM"/g)||[]).length,2);
    assert.doesNotMatch(panel.innerHTML,/name="sysconfig_A2JP_KeyFont"/);
    assert.doesNotMatch(panel.innerHTML,/Apple II EuroPlus/);

    panel.events.change({target:{type:"radio",name:"sysconfig_A2P_ROM",value:"A2P_RL",
        getAttribute(k){return k==="data-model"?"A2P":k==="data-field"?"ROM":null;}}});
    assert.equal(s.context.EMU_SYSTEM_CONFIG.getDraft().A2P.ROM,"A2P_RL");
    assert.equal(s.boots,0,"changing radio selection does not reboot immediately");
    assert.equal(s.context.EMU_SYSTEM_CONFIG.apply(),true);
    assert.equal(s.rom[0xFABB-0xD000],0x05);
    assert.equal(panel.hidden,true);
});

test("index uses only the gear and compact model label, not inline dropdown",()=>{
    const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
    assert.match(html,/onclick="EMU_SYSTEM_CONFIG\.toggle\(\)"/);
    assert.match(html,/id="system_model_name"/);
    assert.doesNotMatch(html,/id="system_model_select"/);
    assert.match(html,/res\/EMU_system_config_popup\.css/);
});
