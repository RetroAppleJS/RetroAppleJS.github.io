from pathlib import Path
import re

path = Path('res/EMU_apple2io.js')
s = path.read_text()

# Add stable plus-button anchor handling and an in-picker message surface.
pattern = re.compile(r'''    this\.deviceConfig_close = function\(\)\n    \{.*?\n    \};\n\n    this\.devicePicker_entries''', re.S)
replacement = r'''    function devicePickerAnchorID(slotN)
    {
        return "device_add_"+Number(slotN);
    }

    function devicePickerAnchor(slotN,active)
    {
        var anchor=document.getElementById(devicePickerAnchorID(slotN));
        if(!anchor) return;
        anchor.style.background=active ? "rgba(255,255,0,.5)" : "";
        anchor.setAttribute("aria-expanded",active ? "true" : "false");
    }

    function clearDevicePickerAnchors()
    {
        var anchors=document.querySelectorAll("[id^='device_add_']");
        for(var i=0;i<anchors.length;i++)
        {
            anchors[i].style.background="";
            anchors[i].setAttribute("aria-expanded","false");
        }
    }

    this.deviceConfig_close = function()
    {
        var popup=document.getElementById("deviceConfig_popup");
        clearDevicePickerAnchors();
        if(!popup) return false;
        popup.hidden=true;
        popup.innerHTML="";
        popup.removeAttribute("data-mode");
        popup.removeAttribute("data-slot");
        return true;
    };

    this.devicePicker_message = function(text)
    {
        var el=document.getElementById("devicePicker_message");
        if(!el) return false;
        el.textContent=String(text || "");
        el.hidden=!text;
        return true;
    };

    this.devicePicker_entries'''
if not pattern.search(s):
    raise SystemExit('deviceConfig_close block not found')
s = pattern.sub(replacement, s, count=1)

# Replace the picker renderer: host context, whole-row selection, visible state.
pattern = re.compile(r'''    this\.devicePicker_popup = function\(slotN\)\n    \{.*?\n    \};\n\n    this\.devicePicker_select''', re.S)
replacement = r'''    this.devicePicker_popup = function(slotN)
    {
        slotN=Number(slotN);
        var owner=this.SLOT2obj(slotN);
        if(!owner) return false;

        var popup=devicePopupElement();
        if(!popup.hidden && popup.getAttribute("data-mode")==="picker" &&
           Number(popup.getAttribute("data-slot"))===slotN)
        {
            this.deviceConfig_close();
            return true;
        }

        this.deviceConfig_close();
        var entries=this.devicePicker_entries(owner);
        var pcode=peripheralPCODE(owner) || owner.id?.PCODE || "PERIPHERAL";
        var description=peripheralDescription(owner);
        var slotTitle=slotN2name(slotN);
        var html="<button class='appbut' type='button' style='float:right' title='Close' aria-label='Close device picker' onclick=\"apple2plus.hwObj().io.deviceConfig_close()\">x</button>";
        html += "<div style='padding-right:28px'><b>ADD DEVICE TO "+oCOM.escapeHTML(pcode)+"</b> &mdash; "+oCOM.escapeHTML(slotTitle)+"</div>";
        if(description)
            html += "<div style='margin-top:2px;opacity:.75'>"+oCOM.escapeHTML(description)+"</div>";
        html += "<div id='devicePicker_message' role='status' hidden style='margin-top:8px;padding:6px'></div>";
        html += "<div style='margin-top:10px;display:flex;flex-direction:column;gap:4px'>";

        if(!entries.length)
            html += "<div class='appbox' style='float:none;padding:8px'>No compatible devices declared.</div>";
        else
        {
            for(var i=0;i<entries.length;i++)
            {
                var info=entries[i];
                var dcode=String(info.DCODE || info.coID || "device");
                var devices=Array.isArray(owner.devices) ? owner.devices : [];
                var attached=false;
                for(var d=0;d<devices.length;d++)
                    if(devices[d]?.id?.DCODE===dcode) { attached=true; break; }

                var ctor=globalThis[info.coID];
                var available=!attached && typeof(ctor)==="function";
                var state=attached ? "Attached" : (available ? "Available" : "Unavailable");
                var title=info.description || dcode;
                if(attached) title += " — already attached";
                else if(typeof(ctor)!=="function") title += " — device constructor unavailable";

                html += "<button class='appbut label device-picker-entry"+(available ? "" : " greyed")+"' type='button'"
                    + " style='width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 8px;text-align:left;cursor:"+(available ? "pointer" : "default")+";'"
                    + " title='"+oCOM.escapeHTML(title)+"'"
                    + (available
                        ? " onclick=\"event.stopPropagation();apple2plus.hwObj().io.devicePicker_select("+slotN+",'"+dcode+"')\""
                        : " disabled aria-disabled='true'")
                    + ">"
                    + "<span style='min-width:0'>"
                    + "<span style='white-space:nowrap'><i class='"+slotDeviceIconClass(info.icon)+"'></i>&nbsp;<b>"+oCOM.escapeHTML(dcode)+"</b></span>"
                    + (info.description ? "<br><span style='font-size:90%;opacity:.78'>"+oCOM.escapeHTML(info.description)+"</span>" : "")
                    + "</span>"
                    + "<span style='white-space:nowrap'>"
                    + (attached ? "<i class='fa fa-check'></i>&nbsp;" : (available ? "<i class='fa fa-plus'></i>&nbsp;" : ""))
                    + oCOM.escapeHTML(state)
                    + "</span>"
                    + "</button>";
            }
        }
        html += "</div>";

        popup.innerHTML=html;
        popup.setAttribute("data-mode","picker");
        popup.setAttribute("data-slot",String(slotN));
        popup.hidden=false;
        devicePickerAnchor(slotN,true);
        positionDevicePopup(popup);
        return true;
    };

    this.devicePicker_select'''
if not pattern.search(s):
    raise SystemExit('devicePicker_popup block not found')
s = pattern.sub(replacement, s, count=1)

# Replace selection flow: keep failure in picker; close only after success.
pattern = re.compile(r'''    this\.devicePicker_select = function\(slotN,DCODE\)\n    \{.*?\n    \};\n\n    this\.deviceConfig_detail''', re.S)
replacement = r'''    this.devicePicker_select = function(slotN,DCODE)
    {
        slotN=Number(slotN);
        DCODE=String(DCODE || "");
        var owner=this.SLOT2obj(slotN);
        if(!owner || !DCODE)
        {
            this.devicePicker_message("Could not attach device: invalid target.");
            return false;
        }

        var entries=this.devicePicker_entries(owner);
        var info=null;
        for(var i=0;i<entries.length;i++)
            if(String(entries[i].DCODE || entries[i].coID || "")===DCODE) { info=entries[i]; break; }
        if(!info)
        {
            this.devicePicker_message("Could not attach device: it is not compatible with this peripheral.");
            return false;
        }

        var devices=Array.isArray(owner.devices) ? owner.devices : [];
        for(var d=0;d<devices.length;d++)
            if(devices[d]?.id?.DCODE===DCODE)
            {
                this.devicePicker_message(DCODE+" is already attached.");
                return false;
            }

        var device=null;
        try
        {
            device=this.attach(owner,info);
        }
        catch(e)
        {
            console.error("Device attach failed",e);
        }

        if(!device)
        {
            this.devicePicker_message("Could not attach device "+DCODE+".");
            return false;
        }

        this.deviceConfig_close();
        this.slotConfig_refresh(slotN);
        this.refreshDeviceToolboxes({"id":"devices","default_slot":this.slot2ID(slotN)});
        return true;
    };

    this.deviceConfig_detail'''
if not pattern.search(s):
    raise SystemExit('devicePicker_select block not found')
s = pattern.sub(replacement, s, count=1)

# Give the single plus button a stable, accessible identity and disable it only
# when the peripheral declares no compatible child devices at all.
pattern = re.compile(r'''        var slotN=peripheral && peripheral\.mount \? Number\(peripheral\.mount\.slotN\) : -1;\n        var addDevice = Number\.isInteger\(slotN\) && slotN>=0\n            \? .*?\n            : "";''', re.S)
replacement = r'''        var slotN=peripheral && peripheral.mount ? Number(peripheral.mount.slotN) : -1;
        var declaredDevices=io.devicePicker_entries(peripheral);
        var canPick=declaredDevices.length>0;
        var addDevice = Number.isInteger(slotN) && slotN>=0
            ? "<div style='margin-top:10px;margin-bottom:3px'>"
                + "<button class='slot-add' type='button' id='"+devicePickerAnchorID(slotN)+"'"
                + " aria-label='Attach device' aria-haspopup='dialog' aria-expanded='false'"
                + " title='"+(canPick ? "Attach device" : "No compatible devices declared")+"'"
                + (canPick
                    ? " onclick=\"event.stopPropagation();apple2plus.hwObj().io.devicePicker_popup("+slotN+")\""
                    : " disabled")
                + "><i class='fa fa-plus dots dots1'></i></button></div>"
            : "";'''
if not pattern.search(s):
    raise SystemExit('device table plus block not found')
s = pattern.sub(replacement, s, count=1)

path.write_text(s)
