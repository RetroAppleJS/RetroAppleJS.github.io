from pathlib import Path
import re

io_path=Path('res/EMU_apple2io.js')
s=io_path.read_text()

# 1) Make Apple2IO attachment identity per mounted instance while preserving
# idempotent declarative provisioning.
pat=re.compile(r'''    this\.attach = function\(owner,device_info\)\n    \{.*?\n        return device;\n    \}\n\n    this\.detach = function\(owner,DCODE\)''',re.S)
new=r'''    this.attach = function(owner,device_info,options)
    {
        if(!owner || !owner.id?.PCODE || !device_info || !device_info.coID) return null;

        options=options || {};
        var newInstance=options.newInstance===true;
        var hostPCODE=owner.id.PCODE;
        var dcode=device_info.DCODE || device_info.coID;
        if(device_info.hostPCODE && device_info.hostPCODE != hostPCODE) return null;

        var ownerHash=owner.mount && owner.mount.hash!==undefined
            ? owner.mount.hash
            : hostPCODE;
        var entry=null;
        var key="";
        var device=null;

        /*
         * Normal provisioning is idempotent: it reuses the one declarative
         * instance for this owner/device type.  An explicit UI attach requests
         * a new mounted instance instead, even when the DCODE is identical.
         */
        if(!newInstance)
        {
            for(var existingKey in this.attachments)
            {
                var existing=this.attachments[existingKey];
                if(existing && existing.owner===owner &&
                   existing.device?.id?.DCODE===dcode &&
                   existing.explicitInstance!==true)
                {
                    entry=existing;
                    key=existingKey;
                    device=existing.device;
                    break;
                }
            }
        }

        if(entry) unmapAttachedActions(entry);

        if(!device)
        {
            var Device=globalThis[device_info.coID];
            if(typeof(Device)!="function") return null;

            device=new Device(device_info);
            if(!device.id) device.id={};
            if(device.id.DCODE && device.id.DCODE != dcode) return null;
            if(device.id.hostPCODE && device.id.hostPCODE != hostPCODE) return null;

            /*
             * Device instance identity mirrors peripheral mount identity: a
             * stable 16-bit hash belongs to this mounted object for its lifetime.
             * The registry key includes it, so equal DCODEs do not collide.
             */
            var instanceHash;
            var attempts=0;
            do
            {
                instanceHash=oCOM.crc16(new TextEncoder("utf-8").encode(
                    String(ownerHash)+":"+dcode+":"+Math.random()+":"+attempts
                ));
                key=String(ownerHash)+":"+dcode+":"+instanceHash;
                attempts++;
            }
            while(this.attachments[key] && attempts<65536);

            if(this.attachments[key]) return null;
            entry={
                 "owner":owner
                ,"device":device
                ,"info":device_info
                ,"bindings":[]
                ,"explicitInstance":newInstance
                ,"hash":instanceHash
            };
            this.attachments[key]=entry;
        }

        device.id.DCODE=dcode;
        device.id.hostPCODE=hostPCODE;
        device.id.coID=device_info.coID;
        if(device_info.icon!==undefined) device.id.icon=device_info.icon;
        if(device_info.description!==undefined) device.id.description=device_info.description;
        if(device_info.deviceN!==undefined && device.id.deviceN===undefined)
            device.id.deviceN=Number(device_info.deviceN);

        if(!Array.isArray(owner.devices))
            Object.defineProperty(owner,"devices",{
                 "value":[]
                ,"writable":true
                ,"configurable":true
                ,"enumerable":false
            });
        if(owner.devices.indexOf(device)<0) owner.devices.push(device);

        entry.owner=owner;
        entry.info=device_info;
        entry.bindings=[];

        var attachHash=entry.hash!==undefined
            ? entry.hash
            : device.attach && device.attach.hash!==undefined
                ? device.attach.hash
                : oCOM.crc16(new TextEncoder("utf-8").encode(key));
        entry.hash=attachHash;
        device.attach={
             "hostPCODE":hostPCODE
            ,"ownerHash":ownerHash
            ,"range":device_info.range || "HostIO"
            ,"hash":attachHash
            ,"actions":[]
        };

        if(typeof(device.bindHost)=="function")
        {
            var hostResult=device.bindHost(owner);
            if(hostResult===false)
            {
                delete this.attachments[key];
                var failedIdx=owner.devices.indexOf(device);
                if(failedIdx>=0) owner.devices.splice(failedIdx,1);
                return null;
            }
        }

        if(typeof(device.bindIO)=="function")
            device.bindIO(io);

        var actionMap=device_info.action || {};
        for(var op in actionMap)
        {
            op=String(op).toUpperCase();
            if(!CIO.ACTION_MAP[op]) continue;

            for(var address in actionMap[op])
            {
                var addr=Number(address);
                var handler=actionMap[op][address];
                var method=typeof(handler)=="string"
                    ? device[handler]
                    : (handler && typeof(handler.handler)=="string"
                        ? device[handler.handler]
                        : (handler && handler.callback ? handler.callback : handler));
                var allowReadOnly=!!(
                    handler && typeof(handler)=="object" && handler.readOnly===true
                );

                if(!Number.isInteger(addr) || typeof(method)!="function") continue;

                var callback=function(target,fn,readOnly,writeAction)
                {
                    if(writeAction)
                    {
                        return function(rel_addr,d8,ctx)
                        {
                            if(ctx && ctx.bRO===true && !readOnly) return 0x00;
                            var result=fn.call(target,rel_addr,d8,ctx);
                            return result===undefined ? 0x00 : result;
                        };
                    }

                    return function(rel_addr,ctx)
                    {
                        if(ctx && ctx.bRO===true && !readOnly) return 0x00;
                        var result=fn.call(target,rel_addr,ctx);
                        return result===undefined ? 0x00 : result;
                    };
                }(device,method,allowReadOnly,op=="WR");

                callback._ioReport={
                     "DCODE":dcode
                    ,"hostPCODE":hostPCODE
                    ,"slotTitle":owner.mount ? slotN2name(owner.mount.slotN) : "attached"
                    ,"range":device.attach.range
                    ,"op":op
                    ,"hash":attachHash
                };

                var previous=CIO.ACTION_MAP[op][addr];
                CIO.ACTION_MAP[op][addr]=callback;
                entry.bindings.push({"op":op,"addr":addr,"callback":callback,"previous":previous});
                device.attach.actions.push({"op":op,"addr":addr,"handler":typeof(handler)=="string" ? handler : (handler.handler || method.name || "callback")});
            }
        }

        if(device_info.alias && oEMU.component && oEMU.component.IO)
            Object.defineProperty(oEMU.component.IO,device_info.alias,{
                 "value":device
                ,"writable":true
                ,"configurable":true
                ,"enumerable":false
            });

        Object.defineProperty(device,"_ioRefreshHooks",{
             "value":rebuildDeviceHooks
            ,"writable":true
            ,"configurable":true
            ,"enumerable":false
        });

        Object.defineProperty(device,"_ioPipeStateChanged",{
             "value":function(change)
             {
                 io.notifyPipeStateChange(Object.assign({
                      "type":"device-state"
                     ,"DCODE":device.id?.DCODE || ""
                     ,"instanceID":device.attach?.hash
                 },change || {}));
             }
            ,"writable":true
            ,"configurable":true
            ,"enumerable":false
        });

        rebuildDeviceHooks();

        this.notifyPipeStateChange({
             "type":"attach"
            ,"DCODE":dcode
            ,"hostPCODE":hostPCODE
            ,"instanceID":attachHash
        });

        if(bDebug)
            console.log("EMU_apple2io.js - attach(<"+dcode+" #"+oCOM.getHexWord(attachHash)+" to "+hostPCODE+">)");

        return device;
    }

    this.detach = function(owner,DCODE,instanceHash)'''
if not pat.search(s): raise SystemExit('attach block not found')
s=pat.sub(new,s,count=1)

# Add instance-hash filtering and wrapper to detach.
s=s.replace('''            if(entry.owner !== owner || (DCODE && device?.id?.DCODE != DCODE)) continue;''','''            if(entry.owner !== owner || (DCODE && device?.id?.DCODE != DCODE)) continue;
            if(instanceHash!==undefined && instanceHash!==null &&
               Number(device?.attach?.hash)!==Number(instanceHash)) continue;''',1)
s=s.replace('''                 "type":"detach"
                ,"DCODE":DCODE || ""
            });''','''                 "type":"detach"
                ,"DCODE":DCODE || ""
                ,"instanceID":instanceHash===undefined ? null : Number(instanceHash)
            });''',1)
needle='''        return removed;
    }

    this.unmount = function(slotN)'''
repl='''        return removed;
    }

    this.detachInstance = function(owner,instanceHash)
    {
        instanceHash=Number(instanceHash);
        if(!owner || !Number.isInteger(instanceHash)) return false;
        return this.detach(owner,null,instanceHash);
    };

    this.unmount = function(slotN)'''
if needle not in s: raise SystemExit('detach tail not found')
s=s.replace(needle,repl,1)

# 2) Resolve device metadata by instance hash first; DCODE fallback remains for compatibility.
pat=re.compile(r'''    this\.deviceMetadata = function\(owner,DCODE\)\n    \{.*?\n    \};\n\n    function devicePopupElement''',re.S)
new=r'''    this.deviceMetadata = function(owner,deviceRef)
    {
        if(!owner) return null;
        var entry=null;
        var device=null;
        var refHash=typeof(deviceRef)==="number" ? deviceRef : NaN;
        var refCode=Number.isInteger(refHash) ? "" : String(deviceRef || "");

        for(var key in this.attachments)
        {
            var candidate=this.attachments[key];
            var candidateDevice=candidate && candidate.device;
            if(!candidate || candidate.owner!==owner || !candidateDevice) continue;

            if(Number.isInteger(refHash))
            {
                if(Number(candidateDevice.attach?.hash)!==refHash) continue;
            }
            else if(refCode && candidateDevice.id?.DCODE!==refCode) continue;

            entry=candidate;
            device=candidateDevice;
            break;
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
             "DCODE":String(id.DCODE || refCode || "")
            ,"instanceID":Number(device.attach?.hash)
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

    function devicePopupElement'''
if not pat.search(s): raise SystemExit('metadata block not found')
s=pat.sub(new,s,count=1)

# 3) Picker: same device type remains addable; show count and explicitly request a new instance.
old='''                var devices=Array.isArray(owner.devices) ? owner.devices : [];
                var attached=false;
                for(var d=0;d<devices.length;d++)
                    if(devices[d]?.id?.DCODE===dcode) { attached=true; break; }

                var ctor=globalThis[info.coID];
                var available=!attached && typeof(ctor)==="function";
                var state=attached ? "Attached" : (available ? "Available" : "Unavailable");
                var title=info.description || dcode;
                if(attached) title += " — already attached";
                else if(typeof(ctor)!=="function") title += " — device constructor unavailable";'''
new='''                var devices=Array.isArray(owner.devices) ? owner.devices : [];
                var attachedCount=0;
                for(var d=0;d<devices.length;d++)
                    if(devices[d]?.id?.DCODE===dcode) attachedCount++;

                var ctor=globalThis[info.coID];
                var available=typeof(ctor)==="function";
                var state=available
                    ? (attachedCount ? "Add another · Attached: "+attachedCount : "Available")
                    : "Unavailable";
                var title=info.description || dcode;
                if(attachedCount) title += " — "+attachedCount+" attached";
                if(typeof(ctor)!=="function") title += " — device constructor unavailable";'''
if old not in s: raise SystemExit('picker state block not found')
s=s.replace(old,new,1)
s=s.replace('''                    + (attached ? "<i class='fa fa-check'></i>&nbsp;" : (available ? "<i class='fa fa-plus'></i>&nbsp;" : ""))
                    + oCOM.escapeHTML(state)''','''                    + (available ? "<i class='fa fa-plus'></i>&nbsp;" : "")
                    + oCOM.escapeHTML(state)''',1)

# Replace picker select body duplicate guard + attach call.
old='''        var devices=Array.isArray(owner.devices) ? owner.devices : [];
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
        }'''
new='''        var device=null;
        try
        {
            device=this.attach(owner,info,{"newInstance":true});
        }'''
if old not in s: raise SystemExit('picker duplicate guard not found')
s=s.replace(old,new,1)

# 4) Device detail/download/eject target one instance hash, not the type code.
pat=re.compile(r'''    this\.deviceConfig_detail = function\(slotN,DCODE\)\n    \{.*?\n    \};\n\n    this\.deviceConfig_download = function\(slotN,DCODE\)\n    \{.*?\n    \};\n\n    this\.deviceConfig_eject = function\(slotN,DCODE\)\n    \{.*?\n    \};''',re.S)
new=r'''    this.deviceConfig_detail = function(slotN,instanceHash)
    {
        slotN=Number(slotN);
        instanceHash=Number(instanceHash);
        var owner=this.SLOT2obj(slotN);
        var metadata=this.deviceMetadata(owner,instanceHash);
        if(!owner || !metadata) return false;

        var popup=devicePopupElement();
        var description=metadata.description || "";
        var instanceLabel="#"+oCOM.getHexWord(metadata.instanceID);
        var html="<button class='appbut' type='button' style='float:right' title='Close' onclick=\"apple2plus.hwObj().io.deviceConfig_close()\">x</button>"
            + "<div style='padding-right:28px'><b>"+oCOM.escapeHTML(metadata.DCODE)+" "+instanceLabel+"</b>"
            + (description ? "<br>"+oCOM.escapeHTML(description) : "")
            + "</div><div style='margin-top:10px'>"
            + "<button class='appbut' type='button' title='Download device JSON' onclick=\"event.stopPropagation();apple2plus.hwObj().io.deviceConfig_download("+slotN+","+metadata.instanceID+")\"><i class='fa fa-cloud-download-alt'></i></button>&nbsp;"
            + "<button class='appbut' type='button' title='Detach device' onclick=\"event.stopPropagation();apple2plus.hwObj().io.deviceConfig_eject("+slotN+","+metadata.instanceID+")\"><i class='fa fa-eject'></i></button>"
            + "</div>";

        popup.innerHTML=html;
        popup.hidden=false;
        positionDevicePopup(popup);
        return true;
    };

    this.deviceConfig_download = function(slotN,instanceHash)
    {
        slotN=Number(slotN);
        instanceHash=Number(instanceHash);
        var owner=this.SLOT2obj(slotN);
        var metadata=this.deviceMetadata(owner,instanceHash);
        if(!metadata) return false;
        try
        {
            var name=(metadata.DCODE+"_"+oCOM.getHexWord(metadata.instanceID)+"_"+slotN2name(slotN).replace("#","")).replace(/[^A-Za-z0-9_.-]/g,"_")+".json";
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

    this.deviceConfig_eject = function(slotN,instanceHash)
    {
        slotN=Number(slotN);
        instanceHash=Number(instanceHash);
        var owner=this.SLOT2obj(slotN);
        if(!owner || !Number.isInteger(instanceHash)) return false;
        if(!this.detachInstance(owner,instanceHash)) return false;

        this.deviceConfig_close();
        this.slotConfig_refresh(slotN);
        this.refreshDeviceToolboxes({"id":"devices","default_slot":this.slot2ID(slotN)});
        return true;
    };'''
if not pat.search(s): raise SystemExit('detail/download/eject block not found')
s=pat.sub(new,s,count=1)

# 5) Device table: add instance column and fix device-label HTML escaping.
old='''                + "<td style='padding:4px 6px;vertical-align:top'>"
                + slotDeviceLabel_html(peripheral,device)
                + "</td>"
                + "<td style='padding:4px 6px;vertical-align:top'>"
                + slotDevicePorts_html(device)'''
new='''                + "<td style='padding:4px 6px;vertical-align:top'>"
                + slotDeviceLabel_html(peripheral,device)
                + "</td>"
                + "<td style='padding:4px 6px;vertical-align:top;white-space:nowrap'>"
                + deviceInstanceLabel_html(device)
                + "</td>"
                + "<td style='padding:4px 6px;vertical-align:top'>"
                + slotDevicePorts_html(device)'''
if old not in s: raise SystemExit('device table row not found')
s=s.replace(old,new,1)
s=s.replace("body = \"<tr><td colspan='2' style='padding:8px'>No devices attached.</td></tr>\";","body = \"<tr><td colspan='3' style='padding:8px'>No devices attached.</td></tr>\";",1)
s=s.replace('''            + "<th style='padding:4px 6px'>Device</th>"
            + "<th style='padding:4px 6px'>Ports</th>"''','''            + "<th style='padding:4px 6px'>Device</th>"
            + "<th style='padding:4px 6px'>Instance</th>"
            + "<th style='padding:4px 6px'>Ports</th>"''',1)

pat=re.compile(r'''    function slotDeviceLabel_html\(peripheral,device\)\n    \{.*?\n    \}\n\n    /\*\n     \* Font Awesome''',re.S)
new=r'''    function slotDeviceLabel_html(peripheral,device)
    {
        var id=device && device.id ? device.id : {};
        var deviceCode=String(
            id.DCODE ||
            id.coID ||
            (device && device.constructor && device.constructor.name) ||
            "device"
        );
        var description=id.description ? String(id.description) : "";
        var icon=slotDeviceIconClass(id.icon);
        var instanceHash=Number(device && device.attach ? device.attach.hash : NaN);

        return ""
            + "<div class='appbut label'"
            + " data-dcode='"+oCOM.escapeHTML(deviceCode)+"'"
            + (Number.isInteger(instanceHash) ? " data-instance='"+instanceHash+"'" : "")
            + " style='display:inline-block;cursor:pointer;white-space:nowrap;'"
            + (peripheral && peripheral.mount && Number.isInteger(instanceHash)
                ? " onclick='event.stopPropagation();apple2plus.hwObj().io.deviceConfig_detail("+Number(peripheral.mount.slotN)+","+instanceHash+")'"
                : "")
            + (description
                ? " title=\""+oCOM.escapeHTML(description)+"\""
                : "")
            + ">"
            + "<i class=\""+icon+"\" aria-hidden=\"true\"></i>&nbsp;"
            + oCOM.escapeHTML(deviceCode)
            + "</div>";
    }

    function deviceInstanceLabel_html(device)
    {
        var hash=Number(device && device.attach ? device.attach.hash : NaN);
        return Number.isInteger(hash) ? "#"+oCOM.getHexWord(hash) : "&mdash;";
    }

    /*
     * Font Awesome'''
if not pat.search(s): raise SystemExit('device label block not found')
s=pat.sub(new,s,count=1)

io_path.write_text(s)

# 6) Liron: remove singleton child state; SmartPortBus is the authoritative
# collection and chooses the first free unit for each new UniDisk.
liron_path=Path('res/EMU_CARD_LIRON.js')
l=liron_path.read_text()
l=l.replace('''    var smartport = new SmartPortBus();
    var unidisk = null;
    var iwm = new LironIWM(smartport);''','''    var smartport = new SmartPortBus();
    var iwm = new LironIWM(smartport);''',1)
old='''    this.attachUniDisk = function(device)
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
    };'''
new='''    this.attachUniDisk = function(device)
    {
        if(!device || device.id?.DCODE!=="UNIDISK35") return null;

        var unit=typeof(device.getUnit)==="function" ? Number(device.getUnit()) : 0;
        if(unit>=1 && unit<=8 && smartport.getDevice(unit)===device) return device;

        smartport.attach(device);
        unit=typeof(device.getUnit)==="function" ? Number(device.getUnit()) : 0;
        if(device.id && unit>=1 && unit<=8) device.id.deviceN=unit;
        return device;
    };

    this.detachUniDisk = function(device)
    {
        if(!device) return false;
        var unit=typeof(device.getUnit)==="function" ? Number(device.getUnit()) : 0;
        if(unit<1 || unit>8 || smartport.getDevice(unit)!==device) return false;
        smartport.detach(device);
        return true;
    };'''
if old not in l: raise SystemExit('Liron singleton attach block not found')
l=l.replace(old,new,1)
l=l.replace('''    this.getUniDisk = function() { return unidisk; };''','''    this.getUniDisk = function(unit)
    {
        if(unit!==undefined && unit!==null && unit!=="")
        {
            unit=Number(unit);
            if(!Number.isInteger(unit) || unit<1 || unit>8) return null;
            var exact=smartport.getDevice(unit);
            return exact && exact.id?.DCODE==="UNIDISK35" ? exact : null;
        }

        var units=smartport.getUnits();
        for(var i=0;i<units.length;i++)
        {
            var device=smartport.getDevice(units[i]);
            if(device && device.id?.DCODE==="UNIDISK35") return device;
        }
        return null;
    };''',1)
liron_path.write_text(l)
