from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f"patch anchor not found: {label}")
    return text.replace(old, new, 1)


# 1) Shared removable-media row renderer.  This deliberately preserves the
# Disk II row structure and is reused by Liron rather than reimplemented there.
io_path = Path('res/EMU_apple2io.js')
io = io_path.read_text()
helper = r'''

/*
 * Shared removable-media row used by Disk II drives and SmartPort disk units.
 * Keep the native <input type="file"> visible: the browser then owns filename
 * presentation instead of each peripheral inventing a parallel label/state UI.
 */
function EMU_deviceMediaRowHTML(spec)
{
    spec = spec || {};

    function attr(value)
    {
        return String(value==null ? "" : value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/\"/g,"&quot;");
    }

    var label = String(spec.label || "Disk");
    var buttonTitle = spec.buttonTitle || (label+": no disk");
    var downloadTitle = spec.downloadTitle || "Save disk";

    return ""
        + "    <div class=appbut style=\"padding:5px 0px 0px 0px;text-align:left;\">"
        + "      <input type=button method=get class=appbut"
        + (spec.buttonID ? " id=\""+attr(spec.buttonID)+"\"" : "")
        + " value=\""+attr(label)+"\""
        + " data-empty=\""+attr(spec.buttonDataEmpty || label)+"\" data-loaded=\"\""
        + " title=\""+attr(buttonTitle)+"\""
        + (spec.buttonOnClick ? " onclick=\""+spec.buttonOnClick+"\"" : "")
        + (spec.buttonOnMouseOver ? " onmouseover=\""+spec.buttonOnMouseOver+"\"" : "")
        + (spec.buttonOnMouseOut ? " onmouseout=\""+spec.buttonOnMouseOut+"\"" : "")
        + ">"
        + "      <form action=\"index.html\""
        + (spec.formID ? " id=\""+attr(spec.formID)+"\"" : "")
        + " style=\"display:inline;\">"
        + "        <input type=\"file\""
        + (spec.fileName ? " name=\""+attr(spec.fileName)+"\"" : "")
        + (spec.fileID ? " id=\""+attr(spec.fileID)+"\"" : "")
        + " style=\"display:inline-block\""
        + (spec.fileAccept ? " accept=\""+attr(spec.fileAccept)+"\"" : "")
        + (spec.fileOnChange ? " onchange=\""+spec.fileOnChange+"\"" : "")
        + ">"
        + "      </form>"
        + "      <button class=appbut value=\"Download\""
        + (spec.downloadID ? " id=\""+attr(spec.downloadID)+"\"" : "")
        + (spec.downloadDisabled ? " disabled" : (spec.downloadOnClick ? " onclick=\""+spec.downloadOnClick+"\"" : ""))
        + " title=\""+attr(downloadTitle)+"\" style=\"float:right\">"
        + "<i class=\"fa fa-cloud-download-alt\"></i></button>"
        + "    </div>";
}
'''
anchor = 'function Apple2IO(vid,hostHardware)\n{'
if 'function EMU_deviceMediaRowHTML(spec)' not in io:
    if anchor not in io:
        raise SystemExit('patch anchor not found: Apple2IO constructor')
    io = io.replace(anchor, helper + '\n' + anchor, 1)
io_path.write_text(io)


# 2) Make Disk II consume the shared renderer without changing its surrounding
# toolbox layout or its catalog/surface-map controls.
disk_path = Path('res/EMU_CARD_appledisk2.js')
disk = disk_path.read_text()
new_disk_renderer = r'''    this.deviceToolSlotHTML = function(ctx)
    {
        ctx = ctx || {};
        var slotN = Number(ctx.slotN);
        var slotID = ctx.slotID;
        var card = this;

        function mediaRow(deviceID,label)
        {
            return EMU_deviceMediaRowHTML({
                 "label":label
                ,"buttonID":card.driveElementID("but",deviceID)
                ,"formID":card.driveElementID("f",deviceID)
                ,"fileID":card.driveElementID("file",deviceID)
                ,"downloadID":card.driveElementID("dump",deviceID)
                ,"fileName":deviceID
                ,"buttonTitle":label+": no disk"
                ,"buttonOnClick":"ejectDisk(this,"+slotN+",'"+deviceID+"')"
                ,"buttonOnMouseOver":"apple2plus.hwObj().io.SLOT2obj("+slotN+").driveButtonHover(this,true)"
                ,"buttonOnMouseOut":"apple2plus.hwObj().io.SLOT2obj("+slotN+").driveButtonHover(this,false)"
                ,"fileOnChange":"javascript:EMU_audio_event_unlock();loadDisk_fromFile(this,"+slotN+",'"+deviceID+"')"
                ,"downloadOnClick":"apple2plus.hwObj().io.SLOT2obj("+slotN+").downloadDisk('"+deviceID+"')"
                ,"downloadTitle":"Save disk"
            });
        }

        return ""
            + "<div class=toolbox id=\""+(ctx.toolboxID || ("device_tool_"+slotID))+"\" hidden>"
            + "  <div class=appbox style=\"height:63px;padding:0px 6px 0px 6px;\">"
            + mediaRow("D1","Drive1")
            + mediaRow("D2","Drive2")
            + "  </div>"
            + "  <div class=appbox style=\"text-align:left;height:63px;padding:0px 6px 0px 6px;\">"
            + "    <button class=appbut onclick=\"apple2plus.hwObj().io.SLOT2obj("+slotN+").diskMenu_detail({id:'softwareCat'})\" title=\"Software Catalog\"><i class=\"fa fa-cat\"></i></button><br>"
            + "    <button class=appbut onclick=\"apple2plus.hwObj().io.SLOT2obj("+slotN+").diskMenu_detail({id:'surfaceMap'})\" title=\"Disk Surface Map\"><i class=\"fa fa-th\"></i></button>"
            + "  </div>"
            + "</div>";
    };
'''
pattern = re.compile(r'    this\.deviceToolSlotHTML = function\(ctx\)\n    \{.*?\n    \};\n\n    const SS_TRACE_LIMIT', re.S)
if 'EMU_deviceMediaRowHTML({' not in disk:
    m = pattern.search(disk)
    if not m:
        raise SystemExit('patch anchor not found: Disk II toolbox renderer')
    disk = disk[:m.start()] + new_disk_renderer + '\n    const SS_TRACE_LIMIT' + disk[m.end():]
disk_path.write_text(disk)


# 3) Liron uses the same row renderer, keeps successful native file selections,
# and clears that selection only on failure/eject.
liron_path = Path('res/EMU_CARD_LIRON.js')
liron = liron_path.read_text()

new_load = r'''    this.deviceToolLoadFile = function(input,unit)
    {
        var file=input && input.files && input.files[0];
        if(!file) return false;

        unit=Number(unit);
        var slotN=liron.mount ? Number(liron.mount.slotN) : NaN;
        if(!Number.isInteger(unit) || unit<1 || unit>8 || !Number.isInteger(slotN))
            return false;

        function clearInput()
        {
            try { input.value=""; } catch(e) {}
        }

        if(Number(file.size)!==819200)
        {
            console.error("UniDisk 3.5 load failed: invalid image size",{"slotN":slotN,"unit":unit,"filename":file.name || "","expected":819200,"actual":Number(file.size)});
            if(typeof(alert)==="function") alert("UniDisk 3.5 image must contain exactly 819200 bytes.");
            clearInput();
            return false;
        }

        var reader=new FileReader();
        reader.onload=function(ev)
        {
            try
            {
                var bytes=new Uint8Array(ev.target.result);
                var mounted=typeof(EMU_mountDiskImage)==="function" &&
                    EMU_mountDiskImage(bytes,slotN,"UNIDISK35",file.name || "",unit);
                if(!mounted)
                {
                    console.error("UniDisk 3.5 load failed: mount rejected",{"slotN":slotN,"unit":unit,"filename":file.name || "","bytes":bytes.length});
                    if(typeof(alert)==="function") alert("UniDisk 3.5 load failed: mount rejected.");
                    clearInput();
                    return;
                }

                /*
                 * Keep the successful native file input populated.  This is the
                 * same filename presentation used by the Disk II toolbox.
                 */
                if(typeof(apple2plus)==="object" && apple2plus)
                {
                    var io=apple2plus.hwObj().io;
                    if(io && typeof(io.refreshDeviceToolboxes)==="function")
                        io.refreshDeviceToolboxes({
                             "id":"devices"
                            ,"default_slot":typeof(io.slot2ID)==="function"
                                ? io.slot2ID(slotN)
                                : undefined
                        });
                }
            }
            catch(err)
            {
                clearInput();
                console.error("UniDisk 3.5 load failed: exception",{"slotN":slotN,"unit":unit,"filename":file.name || "","error":err && err.message ? err.message : String(err)},err);
                if(typeof(alert)==="function") alert("UniDisk 3.5 load failed: "+(err && err.message ? err.message : err));
            }
        };
        reader.onerror=function()
        {
            var msg=reader.error && reader.error.message ? reader.error.message : "Unable to read file.";
            clearInput();
            console.error("UniDisk 3.5 load failed: FileReader error",{"slotN":slotN,"unit":unit,"filename":file.name || "","error":msg});
            if(typeof(alert)==="function") alert("UniDisk 3.5 load failed: "+msg);
        };
        reader.readAsArrayBuffer(file);
        return true;
    };
'''
pat_load = re.compile(r'    this\.deviceToolLoadFile = function\(input,unit\)\n\{.*?\n\};\n\n    this\.deviceToolEject', re.S)
m = pat_load.search(liron)
if not m:
    raise SystemExit('patch anchor not found: Liron load handler')
liron = liron[:m.start()] + new_load + '\n    this.deviceToolEject' + liron[m.end():]

new_eject = r'''    this.deviceToolEject = function(unit)
    {
        unit=Number(unit);
        if(!Number.isInteger(unit) || unit<1 || unit>8) return false;

        var devices=Array.isArray(liron.devices) ? liron.devices : [];
        var target=null;
        for(var i=0;i<devices.length;i++)
        {
            var device=devices[i];
            var deviceUnit=device && typeof(device.getUnit)==="function"
                ? Number(device.getUnit())
                : Number(device && device.id ? device.id.deviceN : NaN);
            if(deviceUnit===unit)
            {
                target=device;
                break;
            }
        }

        if(!target || typeof(target.ejectImage)!=="function") return false;
        if(target.ejectImage()===false) return false;

        if(typeof(apple2plus)==="object" && apple2plus)
        {
            var io=apple2plus.hwObj().io;
            var slotN=liron.mount ? Number(liron.mount.slotN) : NaN;
            var slotID=Number.isInteger(slotN) && typeof(io.slot2ID)==="function"
                ? io.slot2ID(slotN)
                : null;

            if(slotID!==null && typeof(document)==="object" && document)
            {
                var fileInput=document.getElementById("liron_unit_"+slotID+"_"+unit+"_file");
                if(fileInput) try { fileInput.value=""; } catch(e) {}
            }

            if(io && typeof(io.refreshDeviceToolboxes)==="function")
                io.refreshDeviceToolboxes({
                     "id":"devices"
                    ,"default_slot":slotID
                });
        }
        return true;
    };
'''
pat_eject = re.compile(r'    this\.deviceToolEject = function\(unit\)\n\{.*?\n\};\n\n    this\.deviceToolSlotHTML', re.S)
m = pat_eject.search(liron)
if not m:
    raise SystemExit('patch anchor not found: Liron eject handler')
liron = liron[:m.start()] + new_eject + '\n    this.deviceToolSlotHTML' + liron[m.end():]

new_toolbox = r'''    this.deviceToolSlotHTML = function(ctx)
    {
        ctx = ctx || {};
        var slotN = Number(ctx.slotN);
        var slotID = ctx.slotID==null ? "?" : String(ctx.slotID);
        var toolboxID = ctx.toolboxID || ("device_tool_"+slotID);
        var devices = Array.isArray(ctx.devices)
            ? ctx.devices.slice()
            : (Array.isArray(liron.devices) ? liron.devices.slice() : []);

        function unitOf(device,index)
        {
            var unit = device && typeof(device.getUnit)==="function"
                ? Number(device.getUnit())
                : Number(device && device.id ? device.id.deviceN : NaN);
            return Number.isInteger(unit) && unit>0 ? unit : index+1;
        }

        devices.sort(function(a,b)
        {
            return unitOf(a,0)-unitOf(b,0);
        });

        var rows="";
        for(var i=0;i<devices.length;i++)
        {
            var device=devices[i];
            if(!device) continue;
            var unit=unitOf(device,i);
            var controlID="liron_unit_"+slotID+"_"+unit;

            rows += EMU_deviceMediaRowHTML({
                 "label":"Unit"+unit
                ,"buttonID":controlID+"_but"
                ,"formID":controlID+"_form"
                ,"fileID":controlID+"_file"
                ,"downloadID":controlID+"_dump"
                ,"fileName":"UNIDISK35_"+unit
                ,"buttonTitle":"Unit"+unit+": eject disk"
                ,"buttonOnClick":"apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolEject("+unit+")"
                ,"fileAccept":".po"
                ,"fileOnChange":"javascript:EMU_audio_event_unlock();apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolLoadFile(this,"+unit+")"
                ,"downloadDisabled":true
                ,"downloadTitle":"Save disk (not implemented yet)"
            });
        }

        if(!rows)
            rows="<div style=\"padding:5px 2px\">No SmartPort devices attached.</div>";

        return ""
            + "<div class=toolbox id=\""+toolboxID+"\" hidden>"
            + " <div class=appbox style=\"box-sizing:border-box;text-align:left;min-height:63px;padding:0px 6px 0px 6px;\">"
            + rows
            + " </div>"
            + "</div>";
    };
'''
pat_toolbox = re.compile(r'    this\.deviceToolSlotHTML = function\(ctx\)\n    \{.*?\n    \};\n\n    this\.reset', re.S)
m = pat_toolbox.search(liron)
if not m:
    raise SystemExit('patch anchor not found: Liron toolbox renderer')
liron = liron[:m.start()] + new_toolbox + '\n    this.reset' + liron[m.end():]

liron_path.write_text(liron)
