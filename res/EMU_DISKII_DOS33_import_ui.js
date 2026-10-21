/* Disk II file importer popup, same frame size as Surface Map. */
(function(root){
"use strict";
var activeSlot=null;
function by(id){return document.getElementById(id);}
function safe(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function toggle(card,slot,popupFactory){
    if(slot===null)return false;
    var popup=popupFactory("diskFileImport_popup");
    if(!popup.hidden && activeSlot===slot){oCOM.POPUP.off(popup.id);return true;}
    activeSlot=slot;
    var fonts=["A2_US"];
    if(typeof _CFG_SYSCODE!=="undefined")Object.keys(_CFG_SYSCODE).forEach(function(k){
        String(_CFG_SYSCODE[k].KeyFont||"").split(/\s*,\s*/).forEach(function(f){
            if(f && fonts.indexOf(f)<0)fonts.push(f);
        });
    });
    var drives=card.attachedDriveIDs();
    popup.innerHTML="<div style='display:flex;align-items:center;justify-content:space-between;padding:9px;border-bottom:1px solid #aaa'>"
    +"<b>Import file into Disk II</b><button class='appbut' id='diClose' title='Close'>&times;</button></div>"
    +"<div style='padding:10px;display:grid;gap:9px;font:14px sans-serif'>"
    +"<label>Drive <select id='diDrive'>"+drives.map(function(d){return "<option value='"+d+"'>"+d+(card.isDiskData(d)?" — mounted":" — empty")+"</option>";}).join("")+"</select></label>"
    +"<label>Type <select id='diType'><option value='B'>Binary (B)</option><option value='T'>Text (T)</option></select></label>"
    +"<label>Host file <input type='file' id='diFile' style='max-width:100%'></label>"
    +"<label>DOS filename <input id='diName' maxlength='30' placeholder='PROGRAM' style='width:95%'></label>"
    +"<label id='diAddrRow'>Binary load address <input id='diAddr' value='$2000' style='width:86px'> <small id='diRange'></small></label>"
    +"<label id='diFontRow' hidden>UTF-8 → Apple II <select id='diFont'>"
    +fonts.map(function(f){return "<option>"+safe(f)+"</option>";}).join("")+"</select></label>"
    +"<small>Writes to a mounted DOS 3.3 disk. Existing filenames are never overwritten. Stop the drive first. For BASIC source, use the emulator pasteboard instead.</small>"
    +"<button class='appbut' id='diSubmit'>Import into disk</button>"
    +"<div id='diStatus' role='status' aria-live='polite' style='font-size:12px;overflow-wrap:anywhere'></div></div>";
    by("diClose").onclick=function(){oCOM.POPUP.off(popup.id);};
    var input=by("diFile"),type=by("diType"),addr=by("diAddr"),status=by("diStatus");
    function refresh(){
        by("diAddrRow").hidden=type.value!=="B";
        by("diFontRow").hidden=type.value!=="T";
        var f=input.files&&input.files[0];by("diRange").textContent="";
        if(type.value==="B"&&f)try{
            var start=DiskIIDOS33Import.parseAddress(addr.value),end=start+f.size;
            by("diRange").textContent=end<=65536 && f.size>0
                ? "$"+start.toString(16).toUpperCase().padStart(4,"0")+"–$"+(end-1).toString(16).toUpperCase().padStart(4,"0")
                : (end>65536?"Beyond $FFFF":"Empty file");
        }catch(e){by("diRange").textContent=e.message;}
    }
    type.onchange=refresh;addr.oninput=refresh;
    input.onchange=function(){
        var f=input.files&&input.files[0];if(!f)return;
        by("diName").value=f.name.replace(/\.[^.]+$/,"").toUpperCase().replace(/[^A-Z0-9 ._-]/g,"_").slice(0,30);
        type.value=/\.txt$|\.text$/i.test(f.name)?"T":"B";
        refresh();
    };
    by("diSubmit").onclick=async function(){
        var button=this;button.disabled=true;status.textContent="Preparing…";
        try{
            var f=input.files&&input.files[0];if(!f)throw Error("Select a file first.");
            var drive=by("diDrive").value;
            if(!card.isDiskData(drive))throw Error("Mount a DOS 3.3 disk first.");
            if(card.fileImportIsDriveBusy(drive))throw Error("Stop the disk drive before importing.");
            var bytes=new Uint8Array(await f.arrayBuffer());
            var kind=type.value;
            var file=DiskIIDOS33Import.prepare({
                kind:kind,name:by("diName").value,bytes:bytes,
                text:kind==="B"?"":new TextDecoder("utf-8",{fatal:true}).decode(bytes),
                address:addr.value,preset:by("diFont").value
            });
            var data=card.getDiskData(drive);
            var result=DiskIIDOS33Import.insert(data,file);
            // A successful conversion is committed all at once via the existing
            // nibblizer; failed conversions cannot change the mounted disk.
            card.setDiskData(Array.from(result.image),drive,card.getDiskName(drive));
            status.textContent="Imported "+result.name+" ("+result.kind+"): "+
                result.bytes+" bytes in "+result.sectors+" sectors"+
                (result.unmapped?"; "+result.unmapped+" unmappable character(s) replaced":"")+".";
            if(card.refreshVisibleSurfaceMap)card.refreshVisibleSurfaceMap();
        }catch(e){status.textContent="Import failed: "+e.message;}
        finally{button.disabled=false;}
    };
    oCOM.POPUP.on(popup.id);
    return true;
}
root.DiskIIDOS33ImportUI={toggle:toggle};
})(typeof globalThis!=="undefined"?globalThis:this);
