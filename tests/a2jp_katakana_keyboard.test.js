// Apple II J-Plus visual keycaps; run: node --test tests/a2jp_katakana_keyboard.test.js
"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const keyboardSrc=fs.readFileSync(path.join(__dirname,"../res/EMU_DEVICE_keyboard.js"),"utf8");
const systemSrc=fs.readFileSync(path.join(__dirname,"../res/EMU_system_models.js"),"utf8");

function fixture(model="A2P")
{
    const elements=Object.create(null);
    function make(id)
    {
        const children=[],classes=new Set();
        return {
            id:id||"",children,style:{},className:"",
            classList:{
                contains(x){return classes.has(x);},
                toggle(x,on){if(on)classes.add(x);else classes.delete(x);}
            },
            appendChild(x){children.push(x);return x;},
            querySelector(q){
                return q===".a2jp-kana-label"
                    ? children.find(x=>x.className.includes("a2jp-kana-label"))||null:null;
            },
            querySelectorAll(q){
                return q===".keylabels[id]"?Object.values(elements).filter(e=>e.keycap):[];
            }
        };
    }
    const doc={
        getElementById(id){return elements[id]||null;},
        createElement(){return make();}
    };
    elements.glyphScroller=make("glyphScroller");
    elements.kbd=make("kbd");
    const ctx={
        console:{log(){},warn(){}},document:doc,
        // Test keycaps contain plain text; HTML parsing is not part of this fixture.
        oCOM:{stripHTML:s=>s},
        EMU_system_get(){return model;}
    };
    vm.runInNewContext(keyboardSrc,ctx);
    const keyboard=new ctx.A2Pkeys();
    return {
        ctx,keyboard,doc,elements,
        add(id){elements[id]=make(id);elements[id].keycap=true;return elements[id];}
    };
}
test("reference legends map 41 keys, 77 front-face glyphs",()=>{
    const map=fixture("A2JP").ctx.A2JP_KEYCAP_LEGENDS;
    assert.equal(Object.keys(map).length,41);
    assert.equal(Object.values(map).flat().filter(v=>v!==null).length,77);
    const check=(key,expected)=>assert.deepEqual(Array.from(map[key]),expected);
    check("34D8",["｡","/","ア"]);
    check("C598",["イ","/","「"]);
    check("BC7E",[null,"ム",null]);
    check("707F",[null,"チ",null]);
    check("4C30",["タ","/","ミ"]);
    check("935E",["゜","/","サ"]);
    check("E4B9",["゛","/","ホ"]);
    check("757F",["ン","/","ヘ"]);
    check("9C51",["ソ","/","ッ"]);
    assert.equal(map["54BF"],undefined);
    assert.equal(map["E555"],undefined);
});
test("every key in the Katakana reference exists in the unchanged virtual key HTML",()=>{
    const fixtureObj=fixture("A2JP");
    fixtureObj.keyboard.KbdHTML({id:"kbd",kbd_events:"",key_events:""});
    const html=fixtureObj.elements.kbd.innerHTML;
    const ids=[...html.matchAll(/class="keylabels" id="([A-F0-9]{4})"/g)].map(x=>x[1]);
    assert.equal(ids.length,53);
    for(const id of Object.keys(fixtureObj.ctx.A2JP_KEYCAP_LEGENDS))
        assert.ok(ids.includes(id),"missing physical key for "+id);
});

test("decorations use the original key IDs, positions, and are idempotent",()=>{
    const f=fixture("A2JP");
    f.add("34D8");f.add("BC7E");f.add("757F");f.add("54BF");
    assert.equal(f.keyboard.installKatakanaKeycaps(f.elements.glyphScroller),7);
    assert.equal(f.keyboard.installKatakanaKeycaps(f.elements.glyphScroller),0);
    const x=f.elements["34D8"].children;
    assert.deepEqual(x.map(e=>e.className.match(/keylabel(?:9|10|11)/)[0]),
        ["keylabel9","keylabel10","keylabel11"]);
    assert.deepEqual(x.map(e=>e.children[0].textContent),["｡","/","ア"]);
    assert.deepEqual(f.elements["757F"].children.map(e=>e.children[0].textContent),
        ["ン","/","ヘ"]);
    assert.equal(f.elements["54BF"].children.length,0);
});
test("Kana legends cannot change original click hash or virtual key mapping",()=>{
    const f=fixture("A2JP");
    const cap={
        innerHTML:'<div class="keylabel keylabel1"><div>!</div></div>'+
            '<div class="keylabel keylabel7"><div>1</div></div>'+
            '<div class="keylabel keylabel9 a2jp-kana-label"><div>｡</div></div>'+
            '<div class="keylabel keylabel10 a2jp-kana-label"><div>/</div></div>'+
            '<div class="keylabel keylabel11 a2jp-kana-label"><div>ア</div></div>',
        getElementsByClassName(k){
            const m={keylabel1:"!",keylabel7:"1",keylabel9:"｡",keylabel10:"/",keylabel11:"ア"};
            return m[k]===undefined?[]:[{firstElementChild:{innerHTML:m[k]}}];
        }
    };
    assert.equal(f.keyboard.getKeyContent(cap),"!1");
    assert.equal(f.keyboard.events_data.HTMLmap_A2_US["34D8"].val,"1");
    assert.equal(f.keyboard.events_data.HTMLmap_A2_US["34D8"].Shift,"!");
});
test("startup A2JP shows Kana legends; switching to A2P hides them",()=>{
    const f=fixture("A2JP");
    f.keyboard.KbdHTML({id:"kbd",kbd_events:"",key_events:""});
    assert.equal(f.elements.glyphScroller.classList.contains("a2jp-keyboard"),true);
    assert.match(f.elements.kbd.innerHTML,/id="34D8"/);
    assert.match(f.elements.kbd.innerHTML,/id="FFFF"/);
    f.keyboard.setSystemModel("A2P");
    assert.equal(f.elements.glyphScroller.classList.contains("a2jp-keyboard"),false);
    f.keyboard.setSystemModel("A2JP");
    assert.equal(f.elements.glyphScroller.classList.contains("a2jp-keyboard"),true);
});
test("standard A2P remains unadorned and original key markup is retained",()=>{
    const f=fixture();
    f.keyboard.KbdHTML({id:"kbd",kbd_events:"",key_events:""});
    assert.equal(f.elements.glyphScroller.classList.contains("a2jp-keyboard"),false);
    assert.match(f.elements.kbd.innerHTML,/keylabel keylabel1/);
    assert.match(f.elements.kbd.innerHTML,/keylabel keylabel7/);
});
test("machine selection and restart rollback synchronize the keyboard",()=>{
    const f=fixture();
    const model={
        console:{warn(){}},
        _CFG_SYSCODE:{A2P:{},A2JP:{}},
        _TABS:{tab1:{SYS:"A2P",DEF_SYS:"A2P"}},
        oEMU:{system:{A2P:{active:true},A2JP:{active:false}}},
        apple2plus:{keysObj(){return f.keyboard;}}
    };
    vm.runInNewContext(systemSrc,model);
    assert.equal(model.EMU_system_applyModel("A2JP"),true);
    assert.equal(f.elements.glyphScroller.classList.contains("a2jp-keyboard"),true);
    assert.equal(model.EMU_system_applyModel("A2P"),true);
    assert.equal(f.elements.glyphScroller.classList.contains("a2jp-keyboard"),false);
    model.apple2plus={keysObj(){throw new Error("not yet attached");}};
    assert.equal(model.EMU_system_applyModel("A2JP"),true);
});
