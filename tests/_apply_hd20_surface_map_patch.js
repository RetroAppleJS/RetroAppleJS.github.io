'use strict';

const fs=require('node:fs');
const path='res/EMU_CARD_LIRON.js';
let src=fs.readFileSync(path,'utf8');

function replaceOnce(oldText,newText,label)
{
    const n=src.split(oldText).length-1;
    if(n!==1) throw new Error(label+': expected exactly one match, got '+n);
    src=src.replace(oldText,newText);
}

replaceOnce(
'    var deviceSurfaceMapState = {"unit":null,"hash":null};',
'    var deviceSurfaceMapState = {"unit":null,"hash":null,"page":0};',
'surface-map state');

replaceOnce(
'            var canMap=deviceCode==="UNIDISK" && typeof(device.getSurfaceMapGeometry)==="function" && !!state.mediaLoaded;',
'            var canMap=(deviceCode==="UNIDISK" || deviceCode==="HD20") && typeof(device.getSurfaceMapGeometry)==="function" && !!state.mediaLoaded;',
'sync controls capability');

replaceOnce(
'        if(!device || device.id?.DCODE!=="UNIDISK" || typeof(device.getSurfaceMapGeometry)!==="function") return null;',
'        if(!device || (device.id?.DCODE!=="UNIDISK" && device.id?.DCODE!=="HD20") || typeof(device.getSurfaceMapGeometry)!==="function") return null;',
'surface target');

const hd20Helpers=`
    function deviceToolHD20SurfaceRangeLabel(page,panel)
    {
        var start=Number(page)+(Number(panel)*0.5);
        var end=start+0.5;
        function point(value)
        {
            if(value===0) return "0";
            if(value<1) return Math.round(value*1024)+" KiB";
            return (Number.isInteger(value) ? String(value) : String(value))+" MiB";
        }
        return point(start)+"–"+point(end);
    }

    function deviceToolHD20SurfaceMapHTML(device,header)
    {
        var instance=deviceToolInstanceHex(device) || "????";
        var geometry=device.getSurfaceMapGeometry();
        var page=Math.max(0,Math.min(geometry.pageCount-1,Number(deviceSurfaceMapState.page)||0));
        deviceSurfaceMapState.page=page;
        var image=typeof(device.getImage)==="function" ? device.getImage() : null;
        var head=typeof(device.getHeadSurfacePosition)==="function" ? device.getHeadSurfacePosition() : null;
        var unit=Number(device.getUnit ? device.getUnit() : device.id?.deviceN);
        var hash=Number(device.attach?.hash);
        var slotN=liron.mount ? Number(liron.mount.slotN) : NaN;
        var previous=Math.max(0,page-1), next=Math.min(geometry.pageCount-1,page+1);
        var nav="";
        if(Number.isInteger(slotN))
        {
            nav="<div class=\\"liron-surface-page\\" style=\\"display:flex;align-items:center;justify-content:center;gap:5px;margin:0 0 4px 0;font-size:10px\\">"+
                "<button class=\\"appbut\\" type=\\"button\\" title=\\"Previous MiB\\" "+(page<=0?"disabled ":"")+"onclick=\\"apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolSurfaceMapSetPage("+previous+","+unit+","+hash+");event.stopPropagation();\\">‹</button>"+
                "<span>MiB "+page+" / "+(geometry.pageCount-1)+"</span>"+
                "<button class=\\"appbut\\" type=\\"button\\" title=\\"Next MiB\\" "+(page>=geometry.pageCount-1?"disabled ":"")+"onclick=\\"apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolSurfaceMapSetPage("+next+","+unit+","+hash+");event.stopPropagation();\\">›</button>"+
                "</div>";
        }

        var meta="<div class=\\"liron-surface-meta\\" style=\\"font-size:10px;color:#888;margin-top:4px;line-height:12px\\">"+
            "Instance #"+instance+" · 20 MiB · 40960 × 512-byte blocks · MiB "+page+"/"+(geometry.pageCount-1)+
            "</div>";
        var out=header+nav+"<div class=\\"liron-surface-panels liron-surface-hd20\\" style=\\"display:inline-flex;align-items:flex-start;gap:8px;width:max-content\\">";

        for(var panel=0;panel<geometry.panels;panel++)
        {
            out += "<section class=\\"liron-surface-side liron-surface-hd20-panel\\" data-panel=\\""+panel+"\\" style=\\"flex:0 0 auto;margin:0\\">"+
                "<div class=\\"liron-surface-side-title\\" style=\\"text-align:center;font-size:11px;line-height:12px;padding:0 0 2px 30px\\">"+deviceToolHD20SurfaceRangeLabel(page,panel)+"</div>"+
                "<div class=\\"liron-surface-grid\\" style=\\"display:grid;grid-template-columns:30px repeat(16,10px);grid-template-rows:repeat(64,10px);gap:0;overflow:hidden\\">";

            for(var row=0;row<geometry.rowsPerPanel;row++)
            {
                var rowLabel=(row%8===0) ? ((row*8)+"K") : "";
                out += "<span class=\\"liron-surface-track\\" data-row-label=\\""+row+"\\" style=\\"display:flex;align-items:center;justify-content:flex-end;height:10px;padding-right:4px;box-sizing:border-box;color:#aaa;font-family:Courier;font-size:9px\\">"+rowLabel+"</span>";
                for(var column=0;column<geometry.columnsPerPanel;column++)
                {
                    var block=device.surfaceCellToBlock(page,panel,row,column);
                    var offset=block*geometry.bytesPerBlock;
                    var density=deviceToolSurfaceDensity(image,block);
                    var isHead=!!(head && head.block===block);
                    var bandStart=row>0 && row%8===0;
                    var tip="Block "+block+" · 512 bytes · offset "+offset+" · nonzero="+density.nonzero+"/512 · avg="+density.avg;
                    out += "<span class=\\"liron-surface-cell active"+(isHead?" liron-surface-head":"")+"\\" style=\\""+
                        deviceToolSurfaceDensityCellStyle(density.pct,true)+(bandStart?"border-top-width:2px;":"")+(isHead?"outline:2px solid #FFF;outline-offset:-1px;":"")+
                        "\\" data-surface-cell=\\"1\\" data-active=\\"1\\" data-density=\\""+density.pct+"\\" data-page=\\""+page+"\\" data-panel=\\""+panel+"\\" data-row=\\""+row+"\\" data-column=\\""+column+
                        "\\" data-block=\\""+block+"\\" data-offset=\\""+offset+"\\" data-head=\\""+(isHead?"1":"0")+"\\" title=\\""+deviceToolSurfaceEscape(tip)+"\\"></span>";
                }
            }
            out += "</div></section>";
        }
        return out+"</div>"+meta;
    }

    function deviceToolHD20SurfaceMapUpdate(device,text)
    {
        var head=typeof(device.getHeadSurfacePosition)==="function" ? device.getHeadSurfacePosition() : null;
        if(deviceSurfaceMapSyncEnabled && head && Number(head.page)!==Number(deviceSurfaceMapState.page))
        {
            deviceSurfaceMapState.page=Number(head.page);
            text.innerHTML=liron.deviceToolSurfaceMapHTML(deviceSurfaceMapState.unit,deviceSurfaceMapState.hash);
            return true;
        }

        var image=typeof(device.getImage)==="function" ? device.getImage() : null;
        var cells=typeof(text.querySelectorAll)==="function"
            ? text.querySelectorAll('[data-surface-cell="1"][data-active="1"]')
            : [];
        for(var i=0;i<cells.length;i++)
        {
            var cell=cells[i];
            var block=Number(cell.dataset ? cell.dataset.block : cell.getAttribute("data-block"));
            var density=deviceToolSurfaceDensity(image,block);
            cell.style.backgroundColor=deviceToolSurfaceDensityPalette()[density.pct];
            if(cell.dataset) cell.dataset.density=String(density.pct);
            cell.style.outline="";
            cell.style.outlineOffset="";
            if(cell.classList) cell.classList.remove("liron-surface-head");
            if(cell.dataset) cell.dataset.head="0";
        }
        if(head && Number(head.page)===Number(deviceSurfaceMapState.page) && typeof(text.querySelector)==="function")
        {
            var headCell=text.querySelector('[data-surface-cell="1"][data-block="'+head.block+'"]');
            if(headCell)
            {
                headCell.style.outline="2px solid #FFF";
                headCell.style.outlineOffset="-1px";
                if(headCell.classList) headCell.classList.add("liron-surface-head");
                if(headCell.dataset) headCell.dataset.head="1";
            }
        }
        return true;
    }

    this.deviceToolSurfaceMapSetPage = function(page,unit,expectedHash)
    {
        if(unit!==undefined && expectedHash!==undefined)
        {
            unit=Number(unit); expectedHash=Number(expectedHash);
            if(!deviceToolSurfaceTarget(unit,expectedHash)) return false;
            deviceSurfaceMapState.unit=unit;
            deviceSurfaceMapState.hash=expectedHash;
        }
        var device=deviceToolSurfaceTarget(deviceSurfaceMapState.unit,deviceSurfaceMapState.hash);
        if(!device || device.id?.DCODE!=="HD20") return false;
        var geometry=device.getSurfaceMapGeometry();
        page=Math.max(0,Math.min(geometry.pageCount-1,Math.floor(Number(page)||0)));
        deviceSurfaceMapState.page=page;
        if(typeof(document)!==="undefined" && document.getElementById)
        {
            var popup=document.getElementById("lironSurfaceMap_popup");
            if(popup && popup.hidden===false) liron.deviceToolSurfaceMapRefresh();
        }
        return page;
    };

    this.deviceToolSurfaceMapFollowHead = function()
    {
        var device=deviceToolSurfaceTarget(deviceSurfaceMapState.unit,deviceSurfaceMapState.hash);
        if(!device || device.id?.DCODE!=="HD20" || typeof(device.getHeadSurfacePosition)!==="function") return false;
        var head=device.getHeadSurfacePosition();
        if(!head) return deviceSurfaceMapState.page;
        deviceSurfaceMapState.page=Number(head.page);
        if(typeof(document)!==="undefined" && document.getElementById)
        {
            var popup=document.getElementById("lironSurfaceMap_popup");
            if(popup && popup.hidden===false) liron.deviceToolSurfaceMapRefresh();
        }
        return deviceSurfaceMapState.page;
    };

`;
replaceOnce(
'    this.deviceToolSurfaceMapHTML = function(unit,expectedHash)\n    {',
hd20Helpers+'    this.deviceToolSurfaceMapHTML = function(unit,expectedHash)\n    {',
'HD20 helpers insertion');

replaceOnce(
'        if(!device)\n            return header+"<div class=\\"liron-surface-status\\">Device instance is no longer attached.</div>";\n\n        var instance=deviceToolInstanceHex(device) || "????";',
'        if(!device)\n            return header+"<div class=\\"liron-surface-status\\">Device instance is no longer attached.</div>";\n\n        if(device.id?.DCODE==="HD20")\n            return deviceToolHD20SurfaceMapHTML(device,header);\n\n        var instance=deviceToolInstanceHex(device) || "????";',
'HD20 renderer dispatch');

replaceOnce(
'        if(!state.mediaLoaded) return false;\n\n        var image=typeof(device.getImage)==="function" ? device.getImage() : null;',
'        if(!state.mediaLoaded) return false;\n\n        if(device.id?.DCODE==="HD20")\n            return deviceToolHD20SurfaceMapUpdate(device,text);\n\n        var image=typeof(device.getImage)==="function" ? device.getImage() : null;',
'HD20 update dispatch');

replaceOnce(
'        popup.style.width=Math.min(326,available)+"px";',
'        var surfaceDevice=deviceToolSurfaceTarget(deviceSurfaceMapState.unit,deviceSurfaceMapState.hash);\n        var desiredWidth=surfaceDevice && surfaceDevice.id?.DCODE==="HD20" ? 414 : 326;\n        popup.style.width=Math.min(desiredWidth,available)+"px";',
'popup width');

replaceOnce(
'            var isUniDisk=deviceCode==="UNIDISK" && typeof(device.getSurfaceMapGeometry)==="function";',
'            var supportsSurfaceMap=(deviceCode==="UNIDISK" || deviceCode==="HD20") && typeof(device.getSurfaceMapGeometry)==="function";',
'toolbox surface capability');

replaceOnce(
'                ,"capabilityActions":isUniDisk ? [{"id":controlID+"_surface","icon":"fa fa-th","title":deviceState.mediaLoaded ? "Disk Surface Map" : "Disk Surface Map (no media loaded)","onClick":deviceState.mediaLoaded ? ("apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolSurfaceMapToggle("+unit+","+instanceHash+")") : undefined,"disabled":!deviceState.mediaLoaded}] : []',
'                ,"capabilityActions":supportsSurfaceMap ? [{"id":controlID+"_surface","icon":"fa fa-th","title":deviceState.mediaLoaded ? "Disk Surface Map" : "Disk Surface Map (no media loaded)","onClick":deviceState.mediaLoaded ? ("apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolSurfaceMapToggle("+unit+","+instanceHash+")") : undefined,"disabled":!deviceState.mediaLoaded}] : []',
'toolbox action');

replaceOnce(
'        if(opening)\n        {\n            deviceSurfaceMapState.unit=unit;\n            deviceSurfaceMapState.hash=expectedHash;',
'        if(opening)\n        {\n            var targetChanged=deviceSurfaceMapState.unit!==unit || deviceSurfaceMapState.hash!==expectedHash;\n            deviceSurfaceMapState.unit=unit;\n            deviceSurfaceMapState.hash=expectedHash;\n            if(targetChanged) deviceSurfaceMapState.page=0;',
'toggle target page reset');

replaceOnce(
'        deviceSurfaceMapState.unit=unit;\n        deviceSurfaceMapState.hash=expectedHash;\n        if(!liron.deviceToolSurfaceMapRefresh()) return false;',
'        var targetChanged=deviceSurfaceMapState.unit!==unit || deviceSurfaceMapState.hash!==expectedHash;\n        deviceSurfaceMapState.unit=unit;\n        deviceSurfaceMapState.hash=expectedHash;\n        if(targetChanged) deviceSurfaceMapState.page=0;\n        if(!liron.deviceToolSurfaceMapRefresh()) return false;',
'open target page reset');

fs.writeFileSync(path,src);
console.log('patched',path);
