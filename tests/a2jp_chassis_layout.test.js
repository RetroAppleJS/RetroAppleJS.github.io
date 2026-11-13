// Apple II J-Plus chassis selection for the Composer v3 emulator layout.
// Run from the repository root: node --test tests/a2jp_chassis_layout.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rootDir = path.join(__dirname,"..");
const source = name => fs.readFileSync(path.join(rootDir,"res",name),"utf8");
const composerContext = {};
vm.runInNewContext(source("COM_LAYOUT_CONFIG.js"),composerContext);
const authored = composerContext.composer;
const chassisName = "A2P_Body.png";
const jplusName = "A2JP_Body.png";

function fakeRoot(config = authored, model = "A2P", urlModel = null)
{
    let doc;
    function node(tag)
    {
        const el = {
            tagName:tag, id:"", style:{}, dataset:{}, children:[],
            parentNode:null, ownerDocument:null, offsetHeight:0,
            appendChild(child)
            {
                child.parentNode=this;
                this.children.push(child);
                return child;
            },
            insertBefore(child,next)
            {
                child.parentNode=this;
                const index=this.children.indexOf(next);
                if(index<0) this.children.push(child);
                else this.children.splice(index,0,child);
                return child;
            },
            removeChild(child)
            {
                const index=this.children.indexOf(child);
                if(index>=0) this.children.splice(index,1);
                child.parentNode=null;
                return child;
            }
        };
        Object.defineProperty(el,"firstChild",{
            get(){return this.children[0] || null;}
        });
        el.ownerDocument=doc;
        return el;
    }
    doc = {
        createElement:node,
        getElementById(id)
        {
            if(id==="tab1") return tab;
            if(id==="app") return app;
            if(id==="a2p-system-layout")
                return tab.children.find(child=>child.id===id) || null;
            return null;
        }
    };
    const tab=node("div"),app=node("div");
    tab.id="tab1";
    app.id="app";
    const root={
        document:doc,composer:config,
        console:{error(){}},
        EMU_system_get(){return model;},
        requestAnimationFrame(cb){cb();return 1;}
    };
    doc.defaultView=root;
    if(urlModel) root.oCOM={URL:{uri:{sys:urlModel}}};
    return {root,tab,app};
}

function layoutFixture(options)
{
    const env=fakeRoot(options && options.composer,options && options.model,
        options && options.urlModel);
    const sandbox={console,setTimeout(fn){fn();}};
    vm.runInNewContext(source("COM_A2P_LAYOUT.js"),sandbox);
    const layout=new sandbox.LAYOUT(env.root);
    return {layout, ...env};
}

function layerState(layout,filename)
{
    const layer=layout.lastLayout.layers.find(item=>item.file===filename);
    if(!layer) return null;
    const entry=layout.getLayer(layer.address);
    assert.ok(entry,"registered Composer layer: "+filename);
    return {
        visible:layer.visible,
        css:entry.element.style.visibility,
        imgSource:entry.element.src,
        id:layer.id
    };
}

test("generated Composer layout embeds both authentic system body assets",()=>{
    assert.equal(authored.version,3);
    const base=authored.layers.filter(layer=>layer.file===chassisName);
    const jp=authored.layers.filter(layer=>layer.file===jplusName);
    assert.equal(base.length,1);
    assert.equal(jp.length,1);
    assert.equal(base[0].id,"SYSTEM.CHASSIS");
    assert.equal(jp[0].id,"SYSTEM.LAYER2");
    assert.equal(base[0].y,jp[0].y);
    const url=authored.assets[jplusName];
    assert.ok(url.startsWith("data:image/png;base64,"));
    const png=Buffer.from(url.slice("data:image/png;base64,".length),"base64");
    assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16),1144);
    assert.equal(png.readUInt32BE(20),656);
});

test("default Apple II Plus install shows only the original chassis",async()=>{
    const {layout,root,tab}=layoutFixture();
    assert.equal(await layout.install(root),true);
    assert.equal(layerState(layout,chassisName).visible,true);
    assert.equal(layerState(layout,chassisName).css,"visible");
    assert.equal(layerState(layout,jplusName).visible,false);
    assert.equal(layerState(layout,jplusName).css,"hidden");
    assert.equal(tab.children.filter(e=>e.id==="a2p-system-layout").length,1);
    const image=layerState(layout,jplusName);
    assert.equal(image.id,"SYSTEM.LAYER2");
    assert.equal(image.imgSource,authored.assets[jplusName]);
});

test("A2JP selected before asynchronous compositor install shows only J-Plus body",async()=>{
    const {layout,root}=layoutFixture({model:"A2P"});
    assert.equal(layout.setSystemModel("A2JP"),"A2JP");
    assert.equal(await layout.install(root),true);
    assert.equal(layerState(layout,jplusName).css,"visible");
    assert.equal(layerState(layout,chassisName).css,"hidden");
    assert.equal(layout.lastLayout.layers.find(l=>l.id==="SYSTEM.MONITOR").visible,true);
});

test("startup can detect an already selected A2JP system even without explicit callback",async()=>{
    const {layout,root}=layoutFixture({model:"A2JP"});
    assert.equal(await layout.install(root),true);
    assert.equal(layerState(layout,jplusName).css,"visible");
    assert.equal(layerState(layout,chassisName).css,"hidden");
});

test("startup URL selects J-Plus chassis before emulator model state is applied",async()=>{
    const {layout,root}=layoutFixture({model:"A2P",urlModel:"A2JP"});
    assert.equal(await layout.install(root),true);
    assert.equal(layerState(layout,jplusName).css,"visible");
    assert.equal(layerState(layout,chassisName).css,"hidden");
    layout.setSystemModel("A2P");
    assert.equal(layerState(layout,jplusName).css,"hidden");
    assert.equal(layerState(layout,chassisName).css,"visible");
});

test("system model changes, restores, and selects chassis without reloading the page",async()=>{
    const {layout,root}=layoutFixture();
    assert.equal(await layout.install(root),true);
    const otherLayers=layout.lastLayout.layers.filter(l=>
        l.file!==chassisName && l.file!==jplusName)
        .map(l=>[l.id,l.visible]);
    const system={
        console,
        _CFG_SYSCODE:{A2P:{},A2JP:{}},
        oEMU:{system:{A2P:{active:true},A2JP:{active:false}}},
        oLAYOUT:layout,
        _TABS:{EMULATOR:{SYS:"A2P",DEF_SYS:"A2P"}}
    };
    vm.runInNewContext(source("EMU_system_models.js"),system);
    assert.equal(system.EMU_system_applyModel("A2JP"),true);
    assert.equal(layout.systemModel,"A2JP");
    assert.equal(layerState(layout,jplusName).css,"visible");
    assert.equal(layerState(layout,chassisName).css,"hidden");
    assert.equal(system._TABS.EMULATOR.SYS,"A2JP");

    assert.equal(system.EMU_system_applyModel("A2P"),true);
    assert.equal(layerState(layout,jplusName).css,"hidden");
    assert.equal(layerState(layout,chassisName).css,"visible");
    // A second selection simulates a rollback after a failed cold boot.
    assert.equal(system.EMU_system_applyModel("A2JP"),true);
    assert.equal(layerState(layout,jplusName).css,"visible");
    assert.equal(layerState(layout,chassisName).css,"hidden");
    assert.equal(system.EMU_system_applyModel("INVALID"),false);
    assert.equal(layerState(layout,jplusName).css,"visible");
    assert.deepEqual(layout.lastLayout.layers.filter(l=>
        l.file!==chassisName && l.file!==jplusName).map(l=>[l.id,l.visible]),otherLayers);
});

test("reinstalling the same layout retains model selection without duplicated chassis",async()=>{
    const {layout,root,tab}=layoutFixture();
    layout.setSystemModel("A2JP");
    assert.equal(await layout.install(root),true);
    assert.equal(await layout.install(root),true);
    assert.equal(tab.children.filter(e=>e.id==="a2p-system-layout").length,1);
    assert.equal(layerState(layout,jplusName).css,"visible");
    assert.equal(layerState(layout,chassisName).css,"hidden");
    layout.setSystemModel("A2P");
    assert.equal(layerState(layout,chassisName).css,"visible");
});

test("legacy Composer layout without J-Plus artwork keeps its only chassis visible",async()=>{
    const original={
        ...authored,
        layers:authored.layers.filter(l=>l.file!==jplusName)
    };
    const {layout,root}=layoutFixture({composer:original});
    layout.setSystemModel("A2JP");
    assert.equal(await layout.install(root),true);
    assert.equal(layerState(layout,chassisName).css,"visible");
    layout.setSystemModel("A2P");
    assert.equal(layerState(layout,chassisName).css,"visible");
});
