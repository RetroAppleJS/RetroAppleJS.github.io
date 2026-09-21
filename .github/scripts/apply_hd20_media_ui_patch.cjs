'use strict';

const fs=require('node:fs');

function replaceOnce(source,needle,replacement,label)
{
    const first=source.indexOf(needle);
    if(first<0) throw new Error('Missing '+label);
    if(source.indexOf(needle,first+needle.length)>=0) throw new Error('Ambiguous '+label);
    return source.slice(0,first)+replacement+source.slice(first+needle.length);
}

// Extend the shared media row with an optional logical filename presentation.
{
    const file='res/EMU_apple2io.js';
    let source=fs.readFileSync(file,'utf8');
    const start=source.indexOf('function EMU_deviceMediaRowHTML(spec)');
    const end=source.indexOf('\nfunction Apple2IO(',start);
    if(start<0 || end<0) throw new Error('Unable to locate EMU_deviceMediaRowHTML');

    const replacement=`function EMU_deviceMediaRowHTML(spec)
{
    spec = spec || {};

    function attr(value)
    {
        return String(value==null ? "" : value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/\\"/g,"&quot;");
    }

    var label = String(spec.label || "Disk");
    var buttonTitle = spec.buttonTitle || (label+": no disk");
    var downloadTitle = spec.downloadTitle || "Save disk";
    var managedFilename = spec.fileDisplayName!==undefined && spec.fileDisplayName!==null;
    var fileID = String(spec.fileID || "");
    var fileControl = "";

    if(managedFilename)
    {
        fileControl += "        <input type=\\"file\\""
            + (spec.fileName ? " name=\\""+attr(spec.fileName)+"\\"" : "")
            + (fileID ? " id=\\""+attr(fileID)+"\\"" : "")
            + " style=\\"display:none\\""
            + (spec.fileAccept ? " accept=\\""+attr(spec.fileAccept)+"\\"" : "")
            + (spec.fileOnChange ? " onchange=\\""+spec.fileOnChange+"\\"" : "")
            + ">";
        if(fileID)
            fileControl += "        <label class=appbut for=\\""+attr(fileID)+"\\" style=\\"display:inline-block;cursor:pointer\\">Choose File</label>";
        fileControl += "        <span"
            + (fileID ? " id=\\""+attr(fileID+"_name")+"\\"" : "")
            + " style=\\"padding-left:6px\\">"+attr(spec.fileDisplayName)+"</span>";
    }
    else
    {
        fileControl += "        <input type=\\"file\\""
            + (spec.fileName ? " name=\\""+attr(spec.fileName)+"\\"" : "")
            + (fileID ? " id=\\""+attr(fileID)+"\\"" : "")
            + " style=\\"display:inline-block\\""
            + (spec.fileAccept ? " accept=\\""+attr(spec.fileAccept)+"\\"" : "")
            + (spec.fileOnChange ? " onchange=\\""+spec.fileOnChange+"\\"" : "")
            + ">";
    }

    return ""
        + "    <div class=appbut style=\\"padding:5px 0px 0px 0px;text-align:left;\\">"
        + "      <input type=button method=get class=appbut"
        + (spec.buttonID ? " id=\\""+attr(spec.buttonID)+"\\"" : "")
        + " value=\\""+attr(label)+"\\""
        + " data-empty=\\""+attr(spec.buttonDataEmpty || label)+"\\" data-loaded=\\"\\""
        + " title=\\""+attr(buttonTitle)+"\\""
        + (spec.buttonOnClick ? " onclick=\\""+spec.buttonOnClick+"\\"" : "")
        + (spec.buttonOnMouseOver ? " onmouseover=\\""+spec.buttonOnMouseOver+"\\"" : "")
        + (spec.buttonOnMouseOut ? " onmouseout=\\""+spec.buttonOnMouseOut+"\\"" : "")
        + ">"
        + "      <form action=\\"index.html\\""
        + (spec.formID ? " id=\\""+attr(spec.formID)+"\\"" : "")
        + " style=\\"display:inline;\\">"
        + fileControl
        + "      </form>"
        + "      <button class=appbut value=\\"Download\\""
        + (spec.downloadID ? " id=\\""+attr(spec.downloadID)+"\\"" : "")
        + (spec.downloadDisabled ? " disabled" : (spec.downloadOnClick ? " onclick=\\""+spec.downloadOnClick+"\\"" : ""))
        + " title=\\""+attr(downloadTitle)+"\\" style=\\"float:right\\">"
        + "<i class=\\"fa fa-cloud-download-alt\\"></i></button>"
        + "    </div>";
}
`;

    source=source.slice(0,start)+replacement+source.slice(end);
    fs.writeFileSync(file,source);
}

// Add HD20 download/metadata refresh actions and device-specific row semantics.
{
    const file='res/EMU_CARD_LIRON.js';
    let source=fs.readFileSync(file,'utf8');

    const marker='    this.deviceToolEject = function(unit)\n';
    const methods=`    this.deviceToolDownload = function(unit)
    {
        unit=Number(unit);
        if(!Number.isInteger(unit) || unit<1 || unit>8) return false;

        var target=smartport.getDevice(unit);
        if(!target)
        {
            var attached=Array.isArray(liron.devices) ? liron.devices : [];
            for(var i=0;i<attached.length;i++)
            {
                var candidate=attached[i];
                var candidateUnit=candidate && typeof(candidate.getUnit)==="function"
                    ? Number(candidate.getUnit())
                    : Number(candidate && candidate.id ? candidate.id.deviceN : NaN);
                if(candidateUnit===unit) { target=candidate; break; }
            }
        }

        if(!target || typeof(target.getImage)!=="function" || typeof(target.getSuggestedFilename)!=="function")
            return false;
        if(typeof(oCOM)!=="object" || !oCOM || typeof(oCOM.Download)!=="function")
            return false;

        var image=target.getImage();
        if(!image || typeof(image.length)!=="number" || image.length<=0) return false;
        var filename=String(target.getSuggestedFilename() || "HD20.po");
        oCOM.Download(filename,image);
        return true;
    };

    this.deviceMediaMetadataChanged = function(device)
    {
        var attached=Array.isArray(liron.devices) ? liron.devices : [];
        if(!device || attached.indexOf(device)<0) return false;
        if(typeof(apple2plus)!=="object" || !apple2plus) return false;

        var io=apple2plus.hwObj().io;
        var slotN=liron.mount ? Number(liron.mount.slotN) : NaN;
        var slotID=Number.isInteger(slotN) && io && typeof(io.slot2ID)==="function"
            ? io.slot2ID(slotN)
            : undefined;
        if(!io || typeof(io.refreshDeviceToolboxes)!=="function") return false;

        io.refreshDeviceToolboxes({"id":"devices","default_slot":slotID});
        return true;
    };

`;
    source=replaceOnce(source,marker,methods+marker,'deviceToolEject marker');

    const rowPattern=/            rows \+= EMU_deviceMediaRowHTML\(\{[\s\S]*?                ,"downloadTitle":"Save disk \(not implemented yet\)"\n            \}\);/;
    const match=source.match(rowPattern);
    if(!match) throw new Error('Unable to locate Liron media row');

    const rowReplacement=`            var deviceCode=String(device.id?.DCODE || "SMARTPORT");
            var exportable=typeof(device.getImage)==="function" && typeof(device.getSuggestedFilename)==="function";
            var logicalFilename=exportable ? String(device.getSuggestedFilename() || "HD20.po") : undefined;
            var hardDisk=deviceCode==="HD20";

            rows += EMU_deviceMediaRowHTML({
                 "label":"Unit"+unit
                ,"buttonID":controlID+"_but"
                ,"formID":controlID+"_form"
                ,"fileID":controlID+"_file"
                ,"downloadID":controlID+"_dump"
                ,"fileName":deviceCode+"_"+unit
                ,"fileDisplayName":hardDisk ? logicalFilename : undefined
                ,"buttonTitle":hardDisk ? ("Unit"+unit+": erase/reset disk") : ("Unit"+unit+": eject disk")
                ,"buttonOnClick":"apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolEject("+unit+")"
                ,"fileAccept":".po"
                ,"fileOnChange":"javascript:EMU_audio_event_unlock();apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolLoadFile(this,"+unit+")"
                ,"downloadDisabled":!exportable
                ,"downloadOnClick":exportable ? ("apple2plus.hwObj().io.SLOT2obj("+slotN+").deviceToolDownload("+unit+")") : undefined
                ,"downloadTitle":exportable ? ("Save "+logicalFilename) : "Save disk (not implemented yet)"
            });`;

    source=source.replace(rowPattern,rowReplacement);
    fs.writeFileSync(file,source);
}
