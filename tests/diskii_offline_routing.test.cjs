/*
 * Offline Disk II paths: software catalog, manual selection, and startup D1_DIR.
 * Deliberately simulate navigator.onLine=true while GitHub is unreachable.
 *
 * node --test tests/diskii_offline_routing.test.cjs
 */
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const ROOT=path.resolve(__dirname,"..");
const common=fs.readFileSync(path.join(ROOT,"res/COM_MAIN.js"),"utf8");
const card=fs.readFileSync(path.join(ROOT,"res/EMU_CARD_appledisk2.js"),"utf8");
const main=fs.readFileSync(path.join(ROOT,"res/EMU_apple2main.js"),"utf8");

function section(source,begin,end) {
    const a=source.indexOf(begin);
    const b=source.indexOf(end,a+begin.length);
    assert.ok(a>=0 && b>a,"Missing "+begin+" or "+end);
    return source.slice(a,b);
}

test("offline software catalog is rendered without any GitHub request", () => {
    const fn=section(common,"    list:function(inst,arg,callback)","    renderList:function(inst,list,arg)");
    const methods=vm.runInNewContext("({"+fn.trim().replace(/,\s*$/,"")+"})",{
        oCOM:{GetHTTP(){throw Error("unexpected HTTP request for embedded catalog");}}
    });
    const rows=[{name:"ProDOS 8.dsk",path:"disks/ProDOS 8.dsk",type:"file",size:143360}];
    let obtained=null,called=0;
    const host={
        githubContentsURL(){return "https://api.github.com/repos/RetroAppleJS/RetroAppleJS.github.io/contents/disks?ref=main";},
        isOffline(){return false;}, // file:// browsers can incorrectly report online
        cache:{}
    };
    const inst={cfg:{
        offlineFirst:true,
        offlineProvider(_url,arg,reason){
            called++;
            assert.equal(arg.path,"disks");
            assert.match(reason,/embedded catalog preferred/);
            return {list:rows};
        }
    }};
    assert.equal(methods.list.call(host,inst,{path:"disks",source:"embedded"},
        (_err,items)=>{obtained=items;}),true);
    assert.equal(called,1);
    assert.equal(obtained.length,1);
    assert.equal(obtained[0].path,"disks/ProDOS 8.dsk");
    assert.equal(Object.keys(host.cache).length,0,"embedded lists must not poison the GitHub cache");
});

function diskFileHarness(config={}) {
    const source=section(card,"    this.getFile = function(arg)","    this.githubContentsURL = function(arg)");
    const events=[],messages=[],status={active:true};
    const device={periID:"DISKII",DCODE:"D1",deviceN:0};
    const io={
        deviceID2obj(){return device;},
        deviceN2ID(){return "D1";}
    };
    const binary=Array.from({length:143360},()=>0);
    const controller={
        getState(){return status;},
        getDiskCatalogContext(){return {slotN:7,DCODE:"D1"};},
        githubRawURL(){return "https://raw.githubusercontent.com/test/disk.dsk";},
        getOfflineDisks(){
            return [{path:"disks/ProDOS 8.dsk",name:"ProDOS 8.dsk"}];
        },
        getOfflineDiskBytes(arg){
            events.push(["decode",arg.path]);
            return arg.path==="disks/ProDOS 8.dsk"?binary:null;
        },
        isLikelyOffline(){return !!config.offline;},
        detectDiskImageType(){return {type:"dsk"};},
        convertDsk2Nib(){return new Uint8Array(232960);},
        setDriveLidClosed(_id,value){events.push(["lid",value]);},
        setDriveCatalogFile(_id,file){events.push(["filename",file]);}
    };
    const ctx={
        ssSlotNumber(){return 7;},
        apple2plus:{
            hwObj(){return {io};},
            loadDisk(_bytes,deviceID,slotN){events.push(["mounted",deviceID,slotN]);return true;}
        },
        oCOM:{
            GetHTTP(_url,_mode,onload,_arg,onerror){
                events.push(["http"]);
                if(config.networkError)onerror.call({status:0});
                else if(config.respondHTTP)onload.call({status:200,response:{byteLength:0}});
            },
            POPUP:{html(m){messages.push(m);}}
        },
        console:{log(){},warn(){},error(){}}
    };
    vm.runInNewContext("(function(){"+source+"}).call(card);",{...ctx,card:controller});
    return {card:controller,events,messages};
}

test("selecting an embedded disk uses no network when navigator reports online", () => {
    const h=diskFileHarness();
    h.card.getFile({path:"disks/ProDOS 8.dsk",DCODE:"D1"});
    assert.equal(h.events.filter(x=>x[0]==="http").length,0);
    assert.ok(h.events.some(x=>x[0]==="mounted"));
    assert.ok(h.events.some(x=>x[0]==="filename"&&x[1]==="ProDOS 8.dsk"));
});

test("explicit GitHub mode remains available and falls back on network error", () => {
    const h=diskFileHarness({networkError:true});
    h.card.getFile({
        path:"disks/ProDOS 8.dsk",DCODE:"D1",source:"github"
    });
    assert.equal(h.events.filter(x=>x[0]==="http").length,1);
    assert.ok(h.events.some(x=>x[0]==="mounted"));
});

test("unembedded disks report offline absence without requesting GitHub", () => {
    const h=diskFileHarness({offline:true});
    h.card.getFile({path:"disks/unknown.dsk",DCODE:"D1"});
    assert.equal(h.events.some(x=>x[0]==="http"),false);
    assert.match(h.messages.join("\n"),/no embedded disk/i);
});

function startupHarness(boot=true,diskKnown=true) {
    const src=section(main,"function EMU_D1_DIR_load(fileName)","function EMU_init()");
    const events=[],state={},warnings=[];
    const disk={getOfflineDisks(){return diskKnown
        ? [{path:"disks/BLANK_DOS.DSK"}] : [];
    },getOfflineDiskBytes(){return new Uint8Array(143360);}};
    const globals={
        _o:state,
        oCOM:{
            URL:{uri:{boot:boot?"1":""}},
            CATALOG:{
                isOffline(){return false;},
                githubRawURL(){return "https://raw.githubusercontent.com/test/disks/BLANK_DOS.DSK";}
            },
            GetHTTP(){events.push("http");}
        },
        EMU_defaultDiskIISlot(){return 7;},
        EMU_slotPeripheral(){return disk;},
        loadDisk_fromBuffer(bytes,slot,drive,filename) {
            events.push(["mount",bytes.length,slot,drive,filename]);return true;
        },
        apple2plus:{restart(){events.push("reboot");}},
        console:{info(){},warn(){},error(...args){warnings.push(args.join(" "));}}
    };
    vm.runInNewContext(src,globals,{filename:"EMU_apple2main.js"});
    return {load:globals.EMU_D1_DIR_load,events,state,warnings};
}

test("D1_DIR mounts embedded bytes without HTTPS and reboots if requested", () => {
    const h=startupHarness(true,true);
    assert.equal(h.load("BLANK_DOS.DSK"),true);
    assert.deepEqual(h.events,["reboot"]);
    assert.equal(h.state.D1_buffer.length,143360);
    assert.equal(h.state.D1_filename,"BLANK_DOS.DSK");
});

test("D1_DIR also mounts embedded media without the boot flag", () => {
    const h=startupHarness(false,true);
    assert.equal(h.load("BLANK_DOS.DSK"),true);
    assert.equal(h.events.length,1);
    assert.deepEqual(h.events[0],["mount",143360,7,"D1","BLANK_DOS.DSK"]);
    assert.equal(h.state.D1_buffer,undefined);
});

test("D1_DIR still attempts remote access for non-embedded paths", () => {
    const h=startupHarness(true,false);
    assert.equal(h.load("OTHER.DSK"),true);
    assert.deepEqual(h.events,["http"]);
});

test("initial D1_DIR URL is deferred until after Disk II initialization", () => {
    assert.match(main,/case "D1_DIR":[\s\S]{0,280}_o\.D1_DIR_filename\s*=/);
    const start=main.indexOf("function EMU_init()");
    const body=main.slice(start);
    const reboot=body.indexOf("apple2plus.restart(); // mounts LIRON");
    const offline=body.indexOf("EMU_D1_DIR_load(_o.D1_DIR_filename)");
    assert.ok(reboot>=0 && offline>reboot);
});


test("software catalog callback uses the actual Disk II instance", () => {
    const fn=section(card,"    this.getSoftwareCatRows = function(arg)","    this.getFile = function(arg)");
    let created=null,rendered=null;
    const disk={
        getDiskCatalogContext(){return {slotN:7,DCODE:"D1",arg:{source:"embedded"}};},
        setDiskCatalogPath(arg){rendered=arg;},
        getOfflineDir(url){
            assert.match(url,/api\.github\.com/);
            return {list:[{name:"BLANK_DOS.DSK",path:"disks/BLANK_DOS.DSK",type:"file",size:143360}]};
        },
        diskCatalogLoad(){return true;},
        diskCatalogToggleSource(){return true;},
        diskCatalogCycleDrive(){return true;},
        diskCatalogCycleSlot(){return true;}
    };
    const io={SLOT2obj(){return disk;},slot2ID(){return 6;}};
    const env={
        disk,
        apple2plus:{hwObj(){return {io};}},
        ssSlotNumber(){return 7;},
        console:{warn(){},log(){}},
        oCOM:{
            CATALOG:{
                create(cfg){
                    created=cfg;
                    return {render(arg){
                        assert.equal(arg.source,"embedded");
                        const data=cfg.offlineProvider(
                            "https://api.github.com/repos/RetroAppleJS/RetroAppleJS.github.io/contents/disks?ref=main"
                        );
                        assert.equal(data.list[0].name,"BLANK_DOS.DSK");
                        return true;
                    }};
                }
            },
            escapeHTML(str){return String(str);}
        }
    };
    vm.runInNewContext("(function(){"+fn+"}).call(disk);",env);
    assert.equal(disk.getSoftwareCatRows(),true);
    assert.equal(created.offlineFirst,true);
    assert.equal(rendered.source,"embedded");
    assert.match(created.titleHTML(),/Offline/);
});
