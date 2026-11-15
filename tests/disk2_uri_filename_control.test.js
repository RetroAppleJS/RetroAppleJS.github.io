// Disk II URI images must display their mounted filenames, not native "no file selected".
// node --test tests/disk2_uri_filename_control.test.js
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const dir=path.join(__dirname,"..");
const main=fs.readFileSync(path.join(dir,"res/EMU_apple2main.js"),"utf8");
const disk=fs.readFileSync(path.join(dir,"res/EMU_CARD_appledisk2.js"),"utf8");

function methodsBetween(source,startText,endText)
{
    const start=source.indexOf(startText);
    const end=source.indexOf(endText,start+startText.length);
    assert.ok(start>=0 && end>start,"missing source section "+startText);
    return source.slice(start,end);
}

function makeCard()
{
    const state={active:true,diskData:[null,null],diskName:[null,null]};
    const form={innerHTML:""};
    const button={dataset:{empty:"Drive1"},value:"Drive1",title:""};
    const card={
        mount:{slotN:7},state,
        getState(){return state;},
        driveElementID(prefix,drv){return prefix+"_7_"+drv;},
        diskMiddleEl(){return form;},
        diskButtonEl(){return button;},
        setDriveLidClosed(drv,closed){this.lidClosed=closed;},
        setDiskName(drv,filename){
            const deviceN=drv==="D1"?0:1;
            state.diskName[deviceN]=String(filename||"dump.dsk").split(/[\\/]/).pop();
        },
        getDiskName(drv){return state.diskName[drv==="D1"?0:1]||"dump.dsk";},
        setDiskData(bytes,drv,filename){
            state.diskData[drv==="D1"?0:1]=bytes;
            this.setDiskName(drv,filename);
        },
    };
    const methods=methodsBetween(disk,
        "    this.diskFileInputHTML = function(drv, mountedName)",
        "    //    ███████ ██    ██ ██████");
    const esc=value=>String(value).replace(/&/g,"&amp;")
       .replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    new Function("oCOM","console",methods).call(card,{escapeHTML:esc},console);
    return {card,form,button,state};
}

function mountImage(card,filename="ProDos/ProDOS_8_JPlus.dsk")
{
    const helpers=methodsBetween(main,
        "function EMU_mountDiskImage(",
        "/*\n * Browser-facing handler");
    const mount=new Function("EMU_slotPeripheral","apple2plus",
        "console",helpers+"\nreturn EMU_mountDiskImage;")(
        ()=>card,{loadDisk(){return true}},console);
    return mount(new Uint8Array(143360),7,"D1",filename);
}

test("Disk II mount retains the basename and shows an actionable Choose File control",()=>{
    const {card,form,state,button}=makeCard();
    assert.equal(mountImage(card),true);
    assert.equal(state.diskName[0],"ProDOS_8_JPlus.dsk");
    assert.match(form.innerHTML,/ProDOS_8_JPlus\.dsk/);
    assert.match(form.innerHTML,/type="file"/);
    assert.match(form.innerHTML,/style="display:none"/);
    assert.match(form.innerHTML,/for="file_7_D1"/);
    assert.match(form.innerHTML,/onchange="javascript:EMU_audio_event_unlock\(\);loadDisk_fromFile\(this,7,'D1'\)"/);
    assert.doesNotMatch(form.innerHTML,/<button disabled/);
    assert.match(button.title,/D1 loaded: ProDOS_8_JPlus\.dsk/);
});

test("empty drive continues using its native file input",()=>{
    const {card,form}=makeCard();
    form.innerHTML=card.diskFileInputHTML("D1");
    assert.match(form.innerHTML,/type="file"/);
    assert.match(form.innerHTML,/style="display:inline-block"/);
    assert.doesNotMatch(form.innerHTML,/Choose File<\/label>/);
});

test("the same active file picker accepts a subsequent user-selected local image",()=>{
    const {card,form,state}=makeCard();
    mountImage(card);
    const remoteName=state.diskName[0];
    const local="C:\\Users\\Owner\\new_disk.dsk";
    card.setDiskData([1,2,3],"D1",local);
    card.setDriveCatalogFile("D1",card.getDiskName("D1"));
    assert.equal(state.diskName[0],"new_disk.dsk");
    assert.notEqual(state.diskName[0],remoteName);
    assert.match(form.innerHTML,/new_disk\.dsk/);
    assert.match(form.innerHTML,/for="file_7_D1"/);
});

test("eject restores the native file chooser and drive title",()=>{
    const {card,form,button,state}=makeCard();
    mountImage(card);
    state.diskData[0]=null;
    state.diskName[0]=null;
    card.restoreDriveFileInput("D1");
    assert.match(form.innerHTML,/type="file"/);
    assert.match(form.innerHTML,/style="display:inline-block"/);
    assert.doesNotMatch(form.innerHTML,/ProDOS_8_JPlus/);
    assert.match(button.title,/D1: no disk/);
});

test("HTML filename labels escape unsafe names without breaking input markup",()=>{
    const {card,form}=makeCard();
    card.setDriveCatalogFile("D1",'<bad & "special">.dsk');
    assert.match(form.innerHTML,/&lt;bad &amp; &quot;special&quot;&gt;\.dsk/);
    assert.doesNotMatch(form.innerHTML,/<bad &/);
});

test("D1_DIR asynchronous callback preserves filename and disk bytes",()=>{
    const handler=methodsBetween(main,'case "D1_DIR":',"            break;");
    const output={};
    let restarted=0,seenURL="";
    const oCOM={
        URL:{uri:{D1_DIR:"ProDos/ProDOS_8_JPlus.dsk",boot:"1"}},
        GetHTTP(url,type,callback){
            seenURL=url;
            assert.equal(type,"arraybuffer");
            callback.call({status:200,response:new ArrayBuffer(143360)});
        },
        POPUP:{set_class(){}}
    };
    const pako={Deflate:class {
        constructor(){this.result=new Uint8Array([1]);}
        push(){}
    }};
    new Function("oCOM","_o","pako","btoa","document","apple2plus",
        '"use strict"; switch("D1_DIR"){\n'+handler+'break;\n}')(oCOM,output,pako,()=>"",
        {getElementById(){return {};}},
        {restart(){restarted++;}});
    assert.equal(output.D1_filename,"ProDos/ProDOS_8_JPlus.dsk");
    assert.equal(output.D1_buffer.byteLength,143360);
    assert.match(seenURL,/\/disks\/ProDos\/ProDOS_8_JPlus\.dsk$/);
    assert.equal(restarted,1);
});

test("both startup paths forward D1_filename into loadDisk_fromBuffer",()=>{
    const calls=main.match(/loadDisk_fromBuffer\(\s*_o\.D1_buffer[\s\S]*?_o\.D1_filename\s*\)/g)||[];
    assert.equal(calls.length,2,"legacy and onrestart paths must both retain the name");
    assert.match(main,/delete _o\.D1_filename;/);
    const cardSource=disk.slice(disk.indexOf("this.deviceToolSlotHTML"),
        disk.indexOf("this.deviceToolSlotHTML")+1900);
    assert.match(cardSource,/if\(displayName\) spec\.fileDisplayName = displayName/);
});
