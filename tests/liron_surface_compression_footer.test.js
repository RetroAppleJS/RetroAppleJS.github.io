// LIRON disk surface map: live compressed-size footer and zero-copy densities.
// Run: node --test tests/liron_surface_compression_footer.test.js
"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const pako=require("../res/pako.min.js");
const TrackCompressedMedia=require("../res/EMU_DEVICE_track_compressed_media.js");

const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,"res",p),"utf8");
const lironSource=read("EMU_CARD_LIRON.js");

function createFixture()
{
    const context={
        console:{log(){},warn(){},error(){},info(){}},
        oEMU:{component:{IO:{}}},
        TrackCompressedMedia,pako
    };
    vm.createContext(context);
    vm.runInContext(read("EMU_DEVICE_HD20.js")+
        "\nthis.HD20Class=HD20Device;",context,{filename:"EMU_DEVICE_HD20.js"});
    vm.runInContext(read("EMU_DEVICE_UNIDISK35.js")+
        "\nthis.UniDiskClass=UniDisk35Device;",context,{filename:"EMU_DEVICE_UNIDISK35.js"});
    vm.runInContext(lironSource,context,{filename:"EMU_CARD_LIRON.js"});
    const liron=context.oEMU.component.IO.AppleLiron;
    let currentMarkup="",storageElement=null;
    const text={
        querySelector(selector)
        {
            if(selector==='[data-surface-storage="1"]') return storageElement;
            return null;
        },
        querySelectorAll(){return [];}
    };
    Object.defineProperty(text,"innerHTML",{
        get(){return currentMarkup;},
        set(markup)
        {
            currentMarkup=markup;
            const found=markup.match(/<div class="liron-surface-storage"[^>]*>([^<]*)<\/div>/);
            storageElement=found?{textContent:found[1],title:""}:null;
        }
    });
    const popup={hidden:false};
    const elements={
        lironSurfaceMap_popup:popup,
        lironSurfaceMap_popup_text:text
    };
    context.document={
        getElementById(id){return elements[id]||null;},
        querySelectorAll(){return [];}
    };
    const device=(kind,unit,hash)=>{
        const disk=kind==="HD20"
            ? new context.HD20Class() : new context.UniDiskClass();
        disk.attach={hash:hash};
        liron.getBus().attach(disk,unit);
        return disk;
    };
    const select=(unit,hash)=>{
        popup.hidden=true;
        assert.equal(liron.deviceToolSurfaceMapSetPage(0,unit,hash),0);
        popup.hidden=false;
        assert.equal(liron.deviceToolSurfaceMapRefresh(),true);
        assert.ok(storageElement,"footer should be present in generated HTML");
    };
    return {
        context,liron,device,select,popup,text,
        footer(){return storageElement;},
        html(){return currentMarkup;}
    };
}

test("HD20 initial map reports zero-byte payload against 20 MiB and 100% saved",()=>{
    const f=createFixture(),disk=f.device("HD20",1,101);
    // The surface map must never reconstruct/export a full uncompressed HD20.
    disk.getImage=()=>{throw new Error("Unexpected 20 MiB image reconstruction");};
    f.select(1,101);
    const label=f.footer().textContent;
    assert.match(label,/Compressed payload: 0 B \/ 20 MiB/);
    assert.match(label,/0\.00% stored · 100\.00% saved/);
    assert.equal(f.html().match(/data-surface-storage="1"/g).length,1);
    assert.equal(disk.getState().mediaStorage.trackCount,2560);
});

test("HD20 footer reflects writes and format with head-sync disabled",()=>{
    const f=createFixture(),disk=f.device("HD20",1,102);
    disk.getImage=()=>{throw new Error("No full-image surface rendering");};
    f.select(1,102);
    const before=f.footer().textContent;
    const written=new Uint8Array(512).fill(0x7B);
    assert.equal(disk.writeBlock(17,written).error,0);
    assert.equal(f.liron.deviceToolSurfaceMapMonitoring(),true);
    const after=f.footer().textContent;
    assert.notEqual(after,before);
    assert.match(after,/Compressed payload: [1-9][0-9.]*(?: B| KiB) \/ 20 MiB/);
    assert.match(after,/\d+\.\d{2}% saved/);
    assert.equal(disk.getState().mediaStorage.storedBytes>0,true);

    assert.equal(disk.format().error,0);
    assert.equal(f.liron.deviceToolSurfaceMapMonitoring(),true);
    assert.match(f.footer().textContent,/0 B \/ 20 MiB · 0\.00% stored · 100\.00% saved/);
    assert.equal(disk.getState().mediaStorage.storedBytes,0);
});

test("HD20 footer also refreshes with cell/head sync on, without exporting image",()=>{
    const f=createFixture(),disk=f.device("HD20",1,103);
    disk.getImage=()=>{throw new Error("No full-image access allowed");};
    f.select(1,103);
    f.liron.deviceToolSurfaceMapToggleSync(true);
    assert.equal(disk.writeBlock(0,new Uint8Array(512).fill(0x55)).error,0);
    assert.equal(f.liron.deviceToolSurfaceMapMonitoring(),true);
    assert.ok(disk.getState().mediaStorage.storedBytes>0);
    assert.match(f.footer().textContent,/Compressed payload: [1-9]/);
    f.liron.deviceToolSurfaceMapToggleSync(false);
});

test("UniDisk footer reports 800 KiB capacity and current track compression",()=>{
    const f=createFixture(),disk=f.device("UNIDISK",1,104);
    assert.equal(disk.loadImage(new Uint8Array(819200)),819200);
    disk.getImage=()=>{throw new Error("No full UniDisk export during surface map");};
    f.select(1,104);
    assert.match(f.footer().textContent,/0 B \/ 800 KiB · 0\.00% stored · 100\.00% saved/);
    assert.equal(disk.getState().mediaStorage.trackCount,160);
    assert.equal(disk.getState().mediaStorage.logicalBytes,819200);
    assert.equal(disk.getState().mediaStorage.storedBytes,0);
});

test("UniDisk eject and subsequent mount refresh the footer independently of sync",()=>{
    const f=createFixture(),disk=f.device("UNIDISK",1,105);
    disk.loadImage(new Uint8Array(819200));
    disk.getImage=()=>{throw new Error("No full image allocation");};
    f.select(1,105);
    assert.equal(disk.ejectImage(),true);
    assert.equal(f.liron.deviceToolSurfaceMapMonitoring(),true);
    assert.equal(f.footer().textContent,"No media loaded");
    const image=new Uint8Array(819200);
    image.fill(0x22,0,512);
    disk.loadImage(image);
    assert.equal(f.liron.deviceToolSurfaceMapMonitoring(),true);
    assert.match(f.footer().textContent,/Compressed payload: [1-9]/);
    assert.match(f.footer().textContent,/\/ 800 KiB/);
});

test("HD20 and UniDisk density APIs never mutate the guest's head position",()=>{
    const f=createFixture(),hd=f.device("HD20",1,106);
    const uni=f.device("UNIDISK",2,107);
    uni.loadImage(new Uint8Array(819200));
    hd.writeBlock(3,new Uint8Array(512).fill(0x61));
    const hdLast=hd.getLastBlock();
    const uniLast=uni.getState().lastBlock;
    assert.equal(hd.getBlockDensity(3).nonzero,512);
    assert.equal(hd.getBlockDensity(3).pct,100);
    assert.equal(hd.getBlockDensity(4).pct,0);
    assert.equal(uni.getBlockDensity(0).nonzero,0);
    assert.equal(uni.getBlockDensity(1599).pct,0);
    assert.equal(hd.getLastBlock(),hdLast);
    assert.equal(uni.getState().lastBlock,uniLast);
});

test("surface-map footprint numbers are exact and have consistent percentage precision",()=>{
    const start=lironSource.indexOf("    function deviceToolSurfaceStorageFormat(bytes)");
    const end=lironSource.indexOf("    function deviceToolSurfaceDensityCellStyle",start);
    assert.ok(start>=0&&end>start);
    const helpers=new Function("deviceToolSurfaceEscape",
        lironSource.slice(start,end)+
        "\nreturn {info:deviceToolSurfaceStorageInfo,html:deviceToolSurfaceStorageHTML};")(String);
    const half=helpers.info({mediaLoaded:true,mediaStorage:{
        storedBytes:5242880,logicalBytes:20971520,cacheBytes:8192
    }});
    assert.match(half.label,/5 MiB \/ 20 MiB · 25\.00% stored · 75\.00% saved/);
    assert.match(half.title,/8 KiB decompressed track cache/);
    const raw=helpers.info({mediaLoaded:true,mediaStorage:null,mediaBytes:819200});
    assert.match(raw.label,/Stored media: 800 KiB \/ 800 KiB · 100\.00% stored · 0\.00% saved/);
    assert.match(helpers.html({mediaLoaded:false}),/No media loaded/);
});

test("footer updater does not redraw expensive sector cells with sync off",()=>{
    const f=createFixture(),disk=f.device("HD20",1,108);
    disk.getImage=()=>{throw new Error("No image allocation");};
    f.select(1,108);
    const previousMarkup=f.html();
    disk.writeBlock(200,new Uint8Array(512).fill(0x55));
    assert.equal(f.liron.deviceToolSurfaceMapMonitoring(),true);
    assert.equal(f.html(),previousMarkup,"live text is updated without rebuilding the map");
    assert.match(f.footer().textContent,/Compressed payload: [1-9]/);
    f.popup.hidden=true;
    assert.equal(f.liron.deviceToolSurfaceMapMonitoring(),false);
});

test("full-image access remains available explicitly, but not in map render paths",()=>{
    const s=lironSource;
    const htmlSection=s.slice(s.indexOf("function deviceToolHD20SurfaceMapHTML"),
        s.indexOf("this.deviceToolSurfaceMapSetPage",s.indexOf("function deviceToolHD20SurfaceMapHTML")));
    assert.match(htmlSection,/getBlockDensity/);
    assert.match(htmlSection,/deviceToolSurfaceStorageUpdate/);
    assert.match(s,/deviceToolSurfaceStorageHTML\(state\)/);
    assert.match(s,/deviceToolSurfaceMapMonitoring = function/);
    assert.match(read("EMU_DEVICE_HD20.js"),/getBlockDensity = function/);
    assert.match(read("EMU_DEVICE_UNIDISK35.js"),/getBlockDensity = function/);
});
