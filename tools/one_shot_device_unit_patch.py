from pathlib import Path

io_path=Path('res/EMU_apple2io.js')
io=io_path.read_text()

old_detail='''    this.deviceConfig_detail = function(slotN,instanceHash)
    {
        slotN=Number(slotN);
        instanceHash=Number(instanceHash);
        var owner=this.SLOT2obj(slotN);
        var metadata=this.deviceMetadata(owner,instanceHash);
        if(!owner || !metadata) return false;

        var popup=devicePopupElement();
        var description=metadata.description || "";
        var instanceLabel="#"+oCOM.getHexWord(metadata.instanceID);
        var html="<button class='appbut' type='button' style='float:right' title='Close' onclick=\\"apple2plus.hwObj().io.deviceConfig_close()\\">x</button>"
            + "<div style='padding-right:28px'><b>"+oCOM.escapeHTML(metadata.DCODE)+" "+instanceLabel+"</b>"
            + (description ? "<br>"+oCOM.escapeHTML(description) : "")
            + "</div><div style='margin-top:10px'>"
            + "<button class='appbut' type='button' title='Download device JSON' onclick=\\"event.stopPropagation();apple2plus.hwObj().io.deviceConfig_download("+slotN+","+metadata.instanceID+")\\"><i class='fa fa-cloud-download-alt'></i></button>&nbsp;"
            + "<button class='appbut' type='button' title='Detach device' onclick=\\"event.stopPropagation();apple2plus.hwObj().io.deviceConfig_eject("+slotN+","+metadata.instanceID+")\\"><i class='fa fa-eject'></i></button>"
            + "</div>";

        popup.innerHTML=html;
        popup.hidden=false;
        positionDevicePopup(popup);
        return true;
    };
'''

new_detail='''    this.deviceConfig_detail = function(slotN,instanceHash)
    {
        slotN=Number(slotN);
        instanceHash=Number(instanceHash);
        var owner=this.SLOT2obj(slotN);
        var metadata=this.deviceMetadata(owner,instanceHash);
        if(!owner || !metadata) return false;

        var liveDevice=null;
        var devices=Array.isArray(owner.devices) ? owner.devices : [];
        for(var i=0;i<devices.length;i++)
        {
            if(Number(devices[i]?.attach?.hash)===instanceHash)
            {
                liveDevice=devices[i];
                break;
            }
        }
        var unit=liveDevice && typeof(liveDevice.getUnit)==="function"
            ? Number(liveDevice.getUnit())
            : Number(liveDevice?.id?.deviceN);
        var bus=typeof(owner.getBus)==="function" ? owner.getBus() : null;
        var canMove=!!(bus && typeof(bus.move)==="function" && Number.isInteger(unit));
        var upDisabled=!canMove || unit<=1;
        var downDisabled=!canMove || unit>=8;

        var popup=devicePopupElement();
        var description=metadata.description || "";
        var instanceLabel="#"+oCOM.getHexWord(metadata.instanceID);
        var html="<button class='appbut' type='button' style='float:right' title='Close' onclick=\\"apple2plus.hwObj().io.deviceConfig_close()\\">x</button>"
            + "<div style='padding-right:28px'><b>"+oCOM.escapeHTML(metadata.DCODE)+" "+instanceLabel+"</b>"
            + (description ? "<br>"+oCOM.escapeHTML(description) : "")
            + "</div><div style='margin-top:10px'>"
            + "<button class='appbut' type='button' title='Move device one unit up'"+(upDisabled ? " disabled" : " onclick=\\"event.stopPropagation();apple2plus.hwObj().io.deviceConfig_move("+slotN+","+metadata.instanceID+",-1)\\"")+"><i class='fa fa-arrow-up'></i></button>&nbsp;"
            + "<button class='appbut' type='button' title='Move device one unit down'"+(downDisabled ? " disabled" : " onclick=\\"event.stopPropagation();apple2plus.hwObj().io.deviceConfig_move("+slotN+","+metadata.instanceID+",1)\\"")+"><i class='fa fa-arrow-down'></i></button>&nbsp;"
            + "<button class='appbut' type='button' title='Detach device' onclick=\\"event.stopPropagation();apple2plus.hwObj().io.deviceConfig_eject("+slotN+","+metadata.instanceID+")\\"><i class='fa fa-eject'></i></button>"
            + "</div>";

        popup.innerHTML=html;
        popup.hidden=false;
        positionDevicePopup(popup);
        return true;
    };

    this.deviceConfig_move = function(slotN,instanceHash,delta)
    {
        slotN=Number(slotN);
        instanceHash=Number(instanceHash);
        delta=Number(delta);
        if(delta!==-1 && delta!==1) return false;

        var owner=this.SLOT2obj(slotN);
        if(!owner || !Number.isInteger(instanceHash)) return false;

        var devices=Array.isArray(owner.devices) ? owner.devices : [];
        var device=null;
        for(var i=0;i<devices.length;i++)
        {
            if(Number(devices[i]?.attach?.hash)===instanceHash)
            {
                device=devices[i];
                break;
            }
        }
        if(!device) return false;

        var currentUnit=typeof(device.getUnit)==="function"
            ? Number(device.getUnit())
            : Number(device.id?.deviceN);
        var targetUnit=currentUnit+delta;
        if(!Number.isInteger(currentUnit) || targetUnit<1 || targetUnit>8) return false;

        var bus=typeof(owner.getBus)==="function" ? owner.getBus() : null;
        if(!bus || typeof(bus.move)!=="function") return false;

        try
        {
            if(bus.move(device,targetUnit)!==device) return false;
        }
        catch(e)
        {
            console.error("Device unit move failed",e);
            return false;
        }

        if(typeof(owner.onDeviceTopologyChanged)==="function")
        {
            try
            {
                owner.onDeviceTopologyChanged({
                     "type":"move"
                    ,"DCODE":device.id?.DCODE || ""
                    ,"device":device
                    ,"instanceID":instanceHash
                    ,"fromUnit":currentUnit
                    ,"toUnit":targetUnit
                });
            }
            catch(e) { console.error("Device topology move notification failed",e); }
        }

        this.slotConfig_refresh(slotN);
        this.refreshDeviceToolboxes({"id":"devices","default_slot":this.slot2ID(slotN)});
        this.deviceConfig_detail(slotN,instanceHash);
        return true;
    };
'''
if io.count(old_detail)!=1:
    raise SystemExit(f'device detail marker count={io.count(old_detail)}')
io=io.replace(old_detail,new_detail,1)

eject_marker='''    this.deviceConfig_eject = function(slotN,instanceHash)
'''
download_devices='''    this.deviceConfig_downloadDevices = function(slotN)
    {
        slotN=Number(slotN);
        var owner=this.SLOT2obj(slotN);
        if(!owner) return false;

        var devices=Array.isArray(owner.devices) ? owner.devices : [];
        var metadata=[];
        for(var i=0;i<devices.length;i++)
        {
            var hash=Number(devices[i]?.attach?.hash);
            if(!Number.isInteger(hash)) continue;
            var item=this.deviceMetadata(owner,hash);
            if(item) metadata.push(item);
        }

        try
        {
            var pcode=peripheralPCODE(owner) || "peripheral";
            var slotName=slotN2name(slotN).replace("#","");
            var name=(pcode+"_devices_"+slotName).replace(/[^A-Za-z0-9_.-]/g,"_")+".json";
            var payload={
                 "hostPCODE":pcode
                ,"slot":slotN2name(slotN)
                ,"devices":metadata
            };
            var json=JSON.stringify(payload,null,2);
            oCOM.Download(name,new TextEncoder("utf-8").encode(json));
            return true;
        }
        catch(e)
        {
            console.error("Device collection JSON download failed",e);
            return false;
        }
    };

'''
if io.count(eject_marker)!=1:
    raise SystemExit(f'eject marker count={io.count(eject_marker)}')
io=io.replace(eject_marker,download_devices+eject_marker,1)

old_devices_start='''        var devices = peripheral && Array.isArray(peripheral.devices)
            ? peripheral.devices
            : [];
        var body = "";
'''
new_devices_start='''        var devices = peripheral && Array.isArray(peripheral.devices)
            ? peripheral.devices.slice()
            : [];
        devices.sort(function(a,b)
        {
            var au=typeof(a?.getUnit)==="function" ? Number(a.getUnit()) : Number(a?.id?.deviceN);
            var bu=typeof(b?.getUnit)==="function" ? Number(b.getUnit()) : Number(b?.id?.deviceN);
            if(!Number.isInteger(au)) au=99;
            if(!Number.isInteger(bu)) bu=99;
            return au-bu;
        });
        var body = "";
'''
if io.count(old_devices_start)!=1:
    raise SystemExit(f'device table start marker count={io.count(old_devices_start)}')
io=io.replace(old_devices_start,new_devices_start,1)

old_table_controls='''        var slotN=peripheral && peripheral.mount ? Number(peripheral.mount.slotN) : -1;
        var declaredDevices=io.devicePicker_entries(peripheral);
        var canPick=declaredDevices.length>0;
        var addDevice = Number.isInteger(slotN) && slotN>=0
            ? "<div style='margin-top:10px;margin-bottom:3px'>"
                + "<button class='slot-add' type='button' id='"+devicePickerAnchorID(slotN)+"'"
                + " aria-label='Attach device' aria-haspopup='dialog' aria-expanded='false'"
                + " title='"+(canPick ? "Attach device" : "No compatible devices declared")+"'"
                + (canPick
                    ? " onclick=\\"event.stopPropagation();apple2plus.hwObj().io.devicePicker_popup("+slotN+")\\""
                    : " disabled")
                + "><i class='fa fa-plus dots dots1'></i></button></div>"
            : "";

        return addDevice
            + "<table style='width:100%;border-collapse:collapse;margin-top:0px;text-align:left'>"
'''
new_table_controls='''        var slotN=peripheral && peripheral.mount ? Number(peripheral.mount.slotN) : -1;
        var declaredDevices=io.devicePicker_entries(peripheral);
        var canPick=declaredDevices.length>0;
        var pcode=peripheralPCODE(peripheral) || peripheral?.id?.PCODE || "PERIPHERAL";
        var deviceHeader="<div style='margin-top:10px;margin-bottom:3px;display:flex;align-items:center;gap:4px'>"
            + "<span style='margin-right:4px'><b>"+oCOM.escapeHTML(pcode)+"</b> &mdash; devices</span>";
        if(Number.isInteger(slotN) && slotN>=0)
        {
            deviceHeader += "<button class='appbut' type='button' title='Download device JSON' aria-label='Download device JSON'"
                + " onclick=\\"event.stopPropagation();apple2plus.hwObj().io.deviceConfig_downloadDevices("+slotN+")\\">"
                + "<i class='fa fa-cloud-download-alt'></i></button>"
                + "<button class='appbut' type='button' id='"+devicePickerAnchorID(slotN)+"'"
                + " aria-label='Attach device' aria-haspopup='dialog' aria-expanded='false'"
                + " title='"+(canPick ? "Attach device" : "No compatible devices declared")+"'"
                + (canPick
                    ? " onclick=\\"event.stopPropagation();apple2plus.hwObj().io.devicePicker_popup("+slotN+")\\""
                    : " disabled")
                + "><i class='fa fa-plus'></i></button>";
        }
        deviceHeader += "</div>";

        return deviceHeader
            + "<table style='width:100%;border-collapse:collapse;margin-top:0px;text-align:left'>"
'''
if io.count(old_table_controls)!=1:
    raise SystemExit(f'device table controls marker count={io.count(old_table_controls)}')
io=io.replace(old_table_controls,new_table_controls,1)

old_sig='''                var id = devices[d] && devices[d].id;
                if(id && id.DCODE) deviceCodes.push(String(id.DCODE));
'''
new_sig='''                var device=devices[d];
                var id=device && device.id;
                if(id && id.DCODE)
                {
                    var unit=typeof(device.getUnit)==="function" ? Number(device.getUnit()) : Number(id.deviceN);
                    var hash=Number(device.attach?.hash);
                    deviceCodes.push(String(id.DCODE)+"#"+(Number.isInteger(hash)?hash:"")+"@"+(Number.isInteger(unit)?unit:""));
                }
'''
if io.count(old_sig)!=1:
    raise SystemExit(f'topology signature marker count={io.count(old_sig)}')
io=io.replace(old_sig,new_sig,1)
io_path.write_text(io)

liron_path=Path('res/EMU_CARD_LIRON.js')
liron=liron_path.read_text()
detach_block='''    this.detach = function(device)
    {
        var i = devices.indexOf(device);
        if(i<0) return device;

        var unit=findUnit(device);
        if(unit)
        {
            units[unit]=null;
            residentIDs[unit]=0;
        }
        devices.splice(i,1);

        if(typeof(device.setUnit)==="function") device.setUnit(0);
        else if(device && Object.prototype.hasOwnProperty.call(device,"unit")) device.unit=0;

        return device;
    };
'''
move_block=detach_block+'''
    this.move = function(device,unit)
    {
        unit=normalizeUnit(unit);
        var from=findUnit(device);
        if(!from) return null;
        if(from===unit) return device;

        var displaced=units[unit];
        units[unit]=device;
        units[from]=displaced || null;

        function assignUnit(target,targetUnit)
        {
            if(!target) return;
            if(typeof(target.setUnit)==="function") target.setUnit(targetUnit);
            else target.unit=targetUnit;
            if(target.id) target.id.deviceN=targetUnit;
        }

        assignUnit(device,unit);
        assignUnit(displaced,from);
        resetTransport(true);
        return device;
    };
'''
if liron.count(detach_block)!=1:
    raise SystemExit(f'Liron detach marker count={liron.count(detach_block)}')
liron=liron.replace(detach_block,move_block,1)
liron_path.write_text(liron)

test_path=Path('tests/liron_smartport_bus.test.js')
test=test_path.read_text()
test=test.replace(
    "test('AppleLiron keeps UniDisk as its if-empty default without privately constructing it', () => {",
    "test('AppleLiron keeps UniDisk manually attachable without privately constructing it', () => {",
    1)
test=test.replace(
    "{DCODE:'UNIDISK',hostPCODE:'LIRON',coID:'UniDisk35Device',deviceN:1,autoAttach:'if-empty'}",
    "{DCODE:'UNIDISK',hostPCODE:'LIRON',coID:'UniDisk35Device',deviceN:1,autoAttach:false}",
    1)
test_path.write_text(test)
