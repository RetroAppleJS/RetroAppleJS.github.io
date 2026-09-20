from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)

# --- Apple2IO generic device lifecycle + UI ---------------------------------
p = Path('res/EMU_apple2io.js')
s = p.read_text()

old = '''            if(entry.owner !== owner || (DCODE && device?.id?.DCODE != DCODE)) continue;

            unmapAttachedActions(entry);'''
new = '''            if(entry.owner !== owner || (DCODE && device?.id?.DCODE != DCODE)) continue;

            /*
             * Let a child release any host-owned state before the generic
             * attachment record disappears.  Liron/SmartPort needs this so an
             * ejected UniDisk does not remain resident on the SmartPort bus.
             */
            if(device && typeof(device.unbindHost)=="function")
            {
                try
                {
                    if(device.unbindHost(owner)===false) continue;
                }
                catch(e)
                {
                    console.error("Device host detach failed",e);
                    continue;
                }
            }

            unmapAttachedActions(entry);'''
s = replace_once(s, old, new, 'generic detach host release')

marker = '''    /*
     * Render the live child devices attached to one peripheral.
'''
insert = r'''    function deviceJSONClone(value,seen)
    {
        if(value===null || value===undefined) return value;
        if(typeof(value)=="string" || typeof(value)=="number" || typeof(value)=="boolean") return value;
        if(typeof(value)=="function" || typeof(value)=="symbol") return undefined;

        if(typeof(ArrayBuffer)!="undefined" && ArrayBuffer.isView && ArrayBuffer.isView(value))
            return Array.from(value);

        seen = seen || [];
        if(typeof(value)=="object")
        {
            if(seen.indexOf(value)>=0) return undefined;
            seen.push(value);

            if(Array.isArray(value))
            {
                var arr=[];
                for(var i=0;i<value.length;i++)
                {
                    var item=deviceJSONClone(value[i],seen);
                    if(item!==undefined) arr.push(item);
                }
                seen.pop();
                return arr;
            }

            var out={};
            for(var key in value)
            {
                var cloned=deviceJSONClone(value[key],seen);
                if(cloned!==undefined) out[key]=cloned;
            }
            seen.pop();
            return out;
        }
        return undefined;
    }

    this.deviceMetadata = function(owner,DCODE)
    {
        if(!owner) return null;
        var entry=null;
        var device=null;

        for(var key in this.attachments)
        {
            var candidate=this.attachments[key];
            var candidateDevice=candidate && candidate.device;
            if(candidate && candidate.owner===owner &&
               (!DCODE || candidateDevice?.id?.DCODE===DCODE))
            {
                entry=candidate;
                device=candidateDevice;
                break;
            }
        }
        if(!device) return null;

        var id=device.id || {};
        var state;
        try
        {
            state=typeof(device.getState)=="function"
                ? device.getState()
                : device.state;
        }
        catch(e) { state=undefined; }

        return {
             "DCODE":String(id.DCODE || DCODE || "")
            ,"hostPCODE":String(id.hostPCODE || owner.id?.PCODE || "")
            ,"coID":String(id.coID || entry.info?.coID || "")
            ,"description":String(id.description || entry.info?.description || "")
            ,"id":deviceJSONClone(id) || {}
            ,"config":deviceJSONClone(entry.info || {}) || {}
            ,"attachment":deviceJSONClone(device.attach || {}) || {}
            ,"ports":deviceJSONClone(device.ports || {}) || {}
            ,"state":deviceJSONClone(state)
        };
    };

    function devicePopupElement()
    {
        var popup=document.getElementById("deviceConfig_popup");
        if(popup) return popup;

        popup=document.createElement("div");
        popup.id="deviceConfig_popup";
        popup.className="appbox";
        popup.hidden=true;
        popup.style.cssText="position:fixed;z-index:6;width:360px;max-width:42vw;padding:8px;text-align:left";
        (document.getElementById("feature_box") || document.body).appendChild(popup);
        return popup;
    }

    function positionDevicePopup(popup)
    {
        var host=document.getElementById("slotConfig_popup");
        if(!popup || !host || typeof(host.getBoundingClientRect)!="function") return;
        var rect=host.getBoundingClientRect();
        var gap=8;
        var width=360;
        var left=rect.right+gap;
        if(typeof(window)!="undefined" && left+width>window.innerWidth-gap)
            left=Math.max(gap,rect.left-width-gap);
        popup.style.left=Math.round(left)+"px";
        popup.style.top=Math.max(gap,Math.round(rect.top))+"px";
    }

    this.deviceConfig_close = function()
    {
        var popup=document.getElementById("deviceConfig_popup");
        if(!popup) return false;
        popup.hidden=true;
        popup.innerHTML="";
        return true;
    };

    this.devicePicker_entries = function(owner)
    {
        var out=[];
        var cfg=owner && Array.isArray(owner.deviceConfig) ? owner.deviceConfig : [];
        var pcode=owner && owner.id ? owner.id.PCODE : "";
        for(var i=0;i<cfg.length;i++)
        {
            var info=cfg[i];
            if(!info || (info.hostPCODE && info.hostPCODE!==pcode)) continue;
            out.push(info);
        }
        return out;
    };

    this.devicePicker_popup = function(slotN)
    {
        slotN=Number(slotN);
        var owner=this.SLOT2obj(slotN);
        if(!owner) return false;

        var popup=devicePopupElement();
        var entries=this.devicePicker_entries(owner);
        var html="<button class='appbut' type='button' style='float:right' title='Close' onclick=\"apple2plus.hwObj().io.deviceConfig_close()\">x</button>";
        html += "<b>ADD DEVICE</b><br><br>";

        if(!entries.length)
            html += "<div class='appbox' style='float:none;padding:8px'>No compatible devices declared.</div>";
        else
        {
            html += "<div style='display:flex;flex-wrap:wrap;gap:3px'>";
            for(var i=0;i<entries.length;i++)
            {
                var info=entries[i];
                var dcode=String(info.DCODE || info.coID || "device");
                var attached=false;
                var devices=Array.isArray(owner.devices) ? owner.devices : [];
                for(var d=0;d<devices.length;d++)
                    if(devices[d]?.id?.DCODE===dcode) { attached=true; break; }

                var ctor=globalThis[info.coID];
                var addable=!attached && typeof(ctor)=="function";
                var title=info.description || dcode;
                if(attached) title += " — already attached";
                else if(typeof(ctor)!="function") title += " — device constructor unavailable";

                html += "<div class='appbut label"+(addable ? "" : " greyed")+"' style='cursor:default;white-space:nowrap;' title='"+oCOM.escapeHTML(title)+"'>"
                    + "<button class='appbut skinny' type='button'"
                    + (addable
                        ? " title='Attach device' onclick=\"event.stopPropagation();apple2plus.hwObj().io.devicePicker_select("+slotN+",'"+dcode+"')\""
                        : " disabled")
                    + "><i class='fa fa-plus'></i></button>&nbsp;"
                    + "<i class='"+slotDeviceIconClass(info.icon)+"'></i>&nbsp;"
                    + oCOM.escapeHTML(dcode)
                    + "</div>";
            }
            html += "</div>";
        }

        popup.innerHTML=html;
        popup.hidden=false;
        positionDevicePopup(popup);
        return true;
    };

    this.devicePicker_select = function(slotN,DCODE)
    {
        slotN=Number(slotN);
        DCODE=String(DCODE || "");
        var owner=this.SLOT2obj(slotN);
        if(!owner || !DCODE) return false;

        var entries=this.devicePicker_entries(owner);
        var info=null;
        for(var i=0;i<entries.length;i++)
            if(String(entries[i].DCODE || entries[i].coID || "")===DCODE) { info=entries[i]; break; }
        if(!info) return false;

        var devices=Array.isArray(owner.devices) ? owner.devices : [];
        for(var d=0;d<devices.length;d++)
            if(devices[d]?.id?.DCODE===DCODE) return false;

        var device=this.attach(owner,info);
        if(!device) return false;

        this.deviceConfig_close();
        this.slotConfig_refresh(slotN);
        this.refreshDeviceToolboxes({"id":"devices","default_slot":this.slot2ID(slotN)});
        return true;
    };

    this.deviceConfig_detail = function(slotN,DCODE)
    {
        slotN=Number(slotN);
        DCODE=String(DCODE || "");
        var owner=this.SLOT2obj(slotN);
        var metadata=this.deviceMetadata(owner,DCODE);
        if(!owner || !metadata) return false;

        var popup=devicePopupElement();
        var description=metadata.description || "";
        var html="<button class='appbut' type='button' style='float:right' title='Close' onclick=\"apple2plus.hwObj().io.deviceConfig_close()\">x</button>"
            + "<div style='padding-right:28px'><b>"+oCOM.escapeHTML(metadata.DCODE)+"</b>"
            + (description ? "<br>"+oCOM.escapeHTML(description) : "")
            + "</div><div style='margin-top:10px'>"
            + "<button class='appbut' type='button' title='Download device JSON' onclick=\"event.stopPropagation();apple2plus.hwObj().io.deviceConfig_download("+slotN+",'"+metadata.DCODE+"')\"><i class='fa fa-cloud-download-alt'></i></button>&nbsp;"
            + "<button class='appbut' type='button' title='Detach device' onclick=\"event.stopPropagation();apple2plus.hwObj().io.deviceConfig_eject("+slotN+",'"+metadata.DCODE+"')\"><i class='fa fa-eject'></i></button>"
            + "</div>";

        popup.innerHTML=html;
        popup.hidden=false;
        positionDevicePopup(popup);
        return true;
    };

    this.deviceConfig_download = function(slotN,DCODE)
    {
        slotN=Number(slotN);
        var owner=this.SLOT2obj(slotN);
        var metadata=this.deviceMetadata(owner,String(DCODE || ""));
        if(!metadata) return false;
        try
        {
            var name=(metadata.DCODE+"_"+slotN2name(slotN).replace("#","")).replace(/[^A-Za-z0-9_.-]/g,"_")+".json";
            var json=JSON.stringify(metadata,null,2);
            oCOM.Download(name,new TextEncoder("utf-8").encode(json));
            return true;
        }
        catch(e)
        {
            console.error("Device JSON download failed",e);
            return false;
        }
    };

    this.deviceConfig_eject = function(slotN,DCODE)
    {
        slotN=Number(slotN);
        var owner=this.SLOT2obj(slotN);
        DCODE=String(DCODE || "");
        if(!owner || !DCODE) return false;
        if(!this.detach(owner,DCODE)) return false;

        this.deviceConfig_close();
        this.slotConfig_refresh(slotN);
        this.refreshDeviceToolboxes({"id":"devices","default_slot":this.slot2ID(slotN)});
        return true;
    };

'''
if marker not in s:
    raise SystemExit('anchor not found: device table marker')
s = s.replace(marker, insert + marker, 1)

# Replace slotConfig_detail with a render-only helper plus the existing toggle.
pattern = re.compile(r'''    this\.slotConfig_detail = function\(slotName\)\n    \{.*?\n    \}\n\n    this\.slotConfig_download''', re.S)
m = pattern.search(s)
if not m:
    raise SystemExit('slotConfig_detail function not found')
replacement = r'''    this.slotConfig_refresh = function(slotN)
    {
        slotN=Number(slotN);
        var slot=this.slots[slotN] || {};
        var popup=document.getElementById("slotConfig_popup");
        if(!popup) return false;

        var close="<div class=\"appbut\" onclick=\"oCOM.POPUP.toggle('slotConfig_popup');apple2plus.hwObj().io.deviceConfig_close();\" style=\"text-align:center;float:right;\">x</div>";
        var html=close+slotConfigDetail_html(slot);
        if(slotN==0)
        {
            html += "<div style='overflow-y:scroll;height:350px'>";
            var model=typeof(EMU_system_get)=="function" ? EMU_system_get() : "A2P";
            var board=this.SLOT2obj(0);
            html += "<div class='appbox' style='float:none;'>"+(board && typeof(board.boardIO_html)=="function" ? board.boardIO_html(model) : "")+"</div>";
            html += "</div>";
        }
        popup.innerHTML=html;
        return true;
    };

    this.slotConfig_detail = function(slotName)
    {
        var n=slotName2n(slotName);
        this.slotConfig_refresh(n);
        this.deviceConfig_close();
        oCOM.POPUP.toggle("slotConfig_popup");
    }

    this.slotConfig_download'''
s = s[:m.start()] + replacement + s[m.end():]

# Pass peripheral into the label renderer so identical DCODEs on different
# peripheral instances resolve to the correct slot.
s = replace_once(s, '                + slotDeviceLabel_html(device)\n', '                + slotDeviceLabel_html(peripheral,device)\n', 'device label call')

# Prefix the Device table with the requested SLOTS-style plus control.
old = '''        return ""
            + "<table style='width:100%;border-collapse:collapse;margin-top:10px;text-align:left'>"'''
new = '''        var slotN=peripheral && peripheral.mount ? Number(peripheral.mount.slotN) : -1;
        var addDevice = Number.isInteger(slotN) && slotN>=0
            ? "<div style='margin-top:10px;margin-bottom:3px'><button class='slot-add' type='button' title='Attach device' onclick=\"event.stopPropagation();apple2plus.hwObj().io.devicePicker_popup("+slotN+")\"><i class='fa fa-plus dots dots1'></i></button></div>"
            : "";

        return addDevice
            + "<table style='width:100%;border-collapse:collapse;margin-top:0px;text-align:left'>"'''
s = replace_once(s, old, new, 'device table plus')

# Make the DCODE label clickable and resolve against the owning slot.
old = '''    function slotDeviceLabel_html(device)
    {
        var id = device && device.id ? device.id : {};'''
new = '''    function slotDeviceLabel_html(peripheral,device)
    {
        var id = device && device.id ? device.id : {};'''
s = replace_once(s, old, new, 'device label signature')

old = '''            + " data-dcode=\\\""+oCOM.escapeHTML(deviceCode)+"\\\""
            + " style=\\\"display:inline-block;cursor:default;white-space:nowrap;\\\""'''
new = '''            + " data-dcode=\\\""+oCOM.escapeHTML(deviceCode)+"\\\""
            + " style=\\\"display:inline-block;cursor:pointer;white-space:nowrap;\\\""
            + (peripheral && peripheral.mount
                ? " onclick=\\\"event.stopPropagation();apple2plus.hwObj().io.deviceConfig_detail("+Number(peripheral.mount.slotN)+",'"+oCOM.escapeHTML(deviceCode)+"')\\\""
                : "")'''
s = replace_once(s, old, new, 'device label onclick')

p.write_text(s)

# --- Liron host detach -------------------------------------------------------
p = Path('res/EMU_CARD_LIRON.js')
s = p.read_text()
old = '''    this.attachUniDisk = function(device)
    {
        if(!device || device.id?.DCODE!=="UNIDISK35") return null;
        if(unidisk===device) return device;
        if(unidisk!==null) throw new Error("Liron already has a UniDisk 3.5 child");
        smartport.attach(device,1);
        unidisk=device;
        return device;
    };

    this.readSlotIO'''
new = '''    this.attachUniDisk = function(device)
    {
        if(!device || device.id?.DCODE!=="UNIDISK35") return null;
        if(unidisk===device) return device;
        if(unidisk!==null) throw new Error("Liron already has a UniDisk 3.5 child");
        smartport.attach(device,1);
        unidisk=device;
        return device;
    };

    this.detachUniDisk = function(device)
    {
        if(!device || unidisk!==device) return false;
        smartport.detach(device);
        unidisk=null;
        return true;
    };

    this.readSlotIO'''
s = replace_once(s, old, new, 'Liron detachUniDisk')
p.write_text(s)

# --- UniDisk reversible host binding ----------------------------------------
p = Path('res/EMU_DEVICE_UNIDISK35.js')
s = p.read_text()
old = '''    this.bindHost = function(owner)
    {
        if(!owner || owner.id?.PCODE!=="LIRON" || typeof(owner.attachUniDisk)!=="function")
            return false;
        if(host && host!==owner) return false;
        if(owner.attachUniDisk(this)!==this) return false;
        host=owner;
        return true;
    };

    this.setUnit'''
new = '''    this.bindHost = function(owner)
    {
        if(!owner || owner.id?.PCODE!=="LIRON" || typeof(owner.attachUniDisk)!=="function")
            return false;
        if(host && host!==owner) return false;
        if(owner.attachUniDisk(this)!==this) return false;
        host=owner;
        return true;
    };

    this.unbindHost = function(owner)
    {
        if(!host) return true;
        if(owner && owner!==host) return false;
        if(typeof(host.detachUniDisk)!=="function") return false;
        if(host.detachUniDisk(this)===false) return false;
        host=null;
        return true;
    };

    this.setUnit'''
s = replace_once(s, old, new, 'UniDisk unbindHost')
p.write_text(s)
