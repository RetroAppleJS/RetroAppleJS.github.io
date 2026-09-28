/*
 * EMU_CARD_appledisk2_ui_state.js
 *
 * UI-state policy for Disk II topology changes.
 *
 * The runtime controller owns motor/media cleanup, while this layer keeps the
 * peripheral toolbox and disk surface-map views derived from the currently
 * attached physical drives.  Rebuilding a device row must not erase the
 * remaining drive's mounted filename.
 */
(function(root,factory){
    "use strict";
    var api = factory(root || null);
    if(typeof module == "object" && module.exports) module.exports = api;
    if(root) api.installDiskIIUIStatePatch(root);
})(typeof window != "undefined" ? window : null,function(root){
    "use strict";

    function diskDeviceID(device)
    {
        if(device==null) return null;

        var DCODE = typeof(device)=="string"
            ? device
            : (device.id && device.id.DCODE!==undefined ? device.id.DCODE : device.DCODE);

        return DCODE==null ? null : String(DCODE).toUpperCase();
    }

    function diskDeviceN(device)
    {
        var id = diskDeviceID(device);
        if(id=="D1") return 0;
        if(id=="D2") return 1;
        return null;
    }

    function diskState(card)
    {
        return card && typeof card.getState == "function" ? card.getState() : null;
    }

    function attachedDiskDevices(card)
    {
        var devices = Array.isArray(card && card.devices) ? card.devices.slice() : [];
        devices = devices.filter(function(device)
        {
            return diskDeviceN(device)!==null;
        });
        devices.sort(function(a,b)
        {
            var A = diskDeviceID(a) || "";
            var B = diskDeviceID(b) || "";
            return A < B ? -1 : (A > B ? 1 : 0);
        });
        return devices;
    }

    function driveFileDisplayName(card,deviceN)
    {
        var state = diskState(card);
        deviceN = Number(deviceN);
        if(!state || !Number.isInteger(deviceN) || deviceN<0 || deviceN>1) return null;
        if(!Array.isArray(state.diskData) || state.diskData[deviceN]==null) return null;

        var name = Array.isArray(state.diskName) ? state.diskName[deviceN] : null;
        name = name==null ? "" : String(name);
        return name || "disk image";
    }

    function mediaRowFactory()
    {
        if(root && typeof root.EMU_deviceMediaRowHTML == "function")
            return root.EMU_deviceMediaRowHTML;
        if(typeof EMU_deviceMediaRowHTML == "function")
            return EMU_deviceMediaRowHTML;
        return null;
    }

    function renderAttachedDiskIIRows(card,ctx,nativeToolSlotHTML)
    {
        ctx = ctx || {};
        var slotN = Number(ctx.slotN);
        var slotID = ctx.slotID;
        var rowFactory = mediaRowFactory();

        if(!Number.isInteger(slotN) || !slotID || !rowFactory || typeof card.driveElementID != "function")
            return nativeToolSlotHTML ? nativeToolSlotHTML.call(card,ctx) : "";

        function mediaRow(deviceID,label)
        {
            var deviceN = diskDeviceN(deviceID);
            var displayName = driveFileDisplayName(card,deviceN);
            var spec = {
                 "label":label
                ,"buttonID":card.driveElementID("but",deviceID)
                ,"formID":card.driveElementID("f",deviceID)
                ,"fileID":card.driveElementID("file",deviceID)
                ,"downloadID":card.driveElementID("dump",deviceID)
                ,"fileName":deviceID
                ,"buttonTitle":displayName ? (label+" loaded: "+displayName) : (label+": no disk")
                ,"buttonOnClick":"ejectDisk(this,"+slotN+",'"+deviceID+"')"
                ,"buttonOnMouseOver":"apple2plus.hwObj().io.SLOT2obj("+slotN+").driveButtonHover(this,true)"
                ,"buttonOnMouseOut":"apple2plus.hwObj().io.SLOT2obj("+slotN+").driveButtonHover(this,false)"
                ,"fileOnChange":"javascript:EMU_audio_event_unlock();loadDisk_fromFile(this,"+slotN+",'"+deviceID+"')"
                ,"downloadOnClick":"apple2plus.hwObj().io.SLOT2obj("+slotN+").downloadDisk('"+deviceID+"')"
                ,"downloadTitle":"Save disk"
            };

            if(displayName)
                spec.fileDisplayName = displayName;

            return rowFactory(spec);
        }

        var rows = "";
        var devices = attachedDiskDevices(card);
        for(var i=0;i<devices.length;i++)
        {
            var id = diskDeviceID(devices[i]);
            if(id=="D1") rows += mediaRow("D1","Drive1");
            if(id=="D2") rows += mediaRow("D2","Drive2");
        }

        return ""
            + "<div class=toolbox id=\""+(ctx.toolboxID || ("device_tool_"+slotID))+"\" hidden>"
            + "  <div class=appbox style=\"height:63px;padding:0px 6px 0px 6px;\">"
            + rows
            + "  </div>"
            + "  <div class=appbox style=\"text-align:left;height:63px;padding:0px 6px 0px 6px;\">"
            + "    <button class=appbut onclick=\"apple2plus.hwObj().io.SLOT2obj("+slotN+").diskMenu_detail({id:'softwareCat'})\" title=\"Software Catalog\"><i class=\"fa fa-cat\"></i></button><br>"
            + "    <button class=appbut onclick=\"apple2plus.hwObj().io.SLOT2obj("+slotN+").diskMenu_detail({id:'surfaceMap'})\" title=\"Disk Surface Map\"><i class=\"fa fa-th\"></i></button>"
            + "  </div>"
            + "</div>";
    }

    function renderAttachedDiskIISurfaceMap(card,popupID,nativeSurfaceMapHTML)
    {
        if(typeof nativeSurfaceMapHTML != "function") return "";
        var html = String(nativeSurfaceMapHTML.call(card,popupID));
        if(typeof card.surfaceMap_grid_html != "function") return html;

        var nativeGrids = card.surfaceMap_grid_html(0) + card.surfaceMap_grid_html(1);
        var attachedGrids = "";
        var devices = attachedDiskDevices(card);

        for(var i=0;i<devices.length;i++)
        {
            var deviceN = diskDeviceN(devices[i]);
            if(deviceN!==null)
                attachedGrids += card.surfaceMap_grid_html(deviceN);
        }

        return html.replace(nativeGrids,attachedGrids);
    }

    function documentRef()
    {
        if(root && root.document) return root.document;
        if(typeof document == "object") return document;
        return null;
    }

    function refreshVisibleSurfaceMap(card)
    {
        var doc = documentRef();
        var popup = doc && typeof doc.getElementById == "function"
            ? doc.getElementById("surfaceMap_popup")
            : null;

        if(!popup || popup.hidden===true) return false;

        if(typeof card.surfaceMap_render == "function")
            return card.surfaceMap_render("surfaceMap_popup");

        if(typeof card.surfaceMap_update == "function")
            return card.surfaceMap_update("surfaceMap_popup");

        return false;
    }

    function decorateDiskIIUIState(card)
    {
        if(!card || !card.id || card.id.PCODE!="DISKII") return card;
        if(card.__A2PDiskIIUIStateDecorated) return card;
        card.__A2PDiskIIUIStateDecorated = true;

        var nativeDeviceToolSlotHTML = card.deviceToolSlotHTML;
        var nativeSurfaceMapHTML = card.surfaceMap_html;
        var nativeTopologyChanged = card.onDeviceTopologyChanged;

        card.deviceToolSlotHTML = function(ctx)
        {
            return renderAttachedDiskIIRows(this,ctx,nativeDeviceToolSlotHTML);
        };

        card.surfaceMap_html = function(popupID)
        {
            return renderAttachedDiskIISurfaceMap(this,popupID,nativeSurfaceMapHTML);
        };

        card.onDeviceTopologyChanged = function(change)
        {
            var result = typeof nativeTopologyChanged == "function"
                ? nativeTopologyChanged.apply(this,arguments)
                : true;

            if(change && (change.type=="attach" || change.type=="detach"))
                refreshVisibleSurfaceMap(this);

            return result;
        };

        return card;
    }

    function decorateKnownDiskIICards(rootWindow)
    {
        var changed = false;

        if(rootWindow.oEMU && rootWindow.oEMU.component && rootWindow.oEMU.component.IO)
        {
            var discovery = rootWindow.oEMU.component.IO.AppleDisk2;
            if(discovery && discovery.id && discovery.id.PCODE=="DISKII")
            {
                decorateDiskIIUIState(discovery);
                changed = true;
            }
        }

        try
        {
            if(rootWindow.apple2plus && typeof rootWindow.apple2plus.hwObj == "function")
            {
                var hw = rootWindow.apple2plus.hwObj();
                var io = hw && hw.io;
                if(io && Array.isArray(io.slots))
                {
                    for(var slotN=0;slotN<io.slots.length;slotN++)
                    {
                        var owner = typeof io.SLOT2obj == "function" ? io.SLOT2obj(slotN) : null;
                        if(owner && owner.id && owner.id.PCODE=="DISKII")
                        {
                            decorateDiskIIUIState(owner);
                            changed = true;
                        }
                    }
                }
            }
        }
        catch(e) {}

        return changed;
    }

    function wrapDiskIIConstructor(rootWindow)
    {
        if(!rootWindow || typeof rootWindow.AppleDisk2 != "function") return false;
        if(rootWindow.AppleDisk2.__A2PDiskIIUIStateWrapped) return true;

        var OriginalAppleDisk2 = rootWindow.AppleDisk2;
        var WrappedAppleDisk2 = function AppleDisk2()
        {
            var instance = Object.create(OriginalAppleDisk2.prototype || Object.prototype);
            var result = OriginalAppleDisk2.apply(instance,arguments);
            var card = result && (typeof result == "object" || typeof result == "function")
                ? result
                : instance;
            return decorateDiskIIUIState(card);
        };

        WrappedAppleDisk2.prototype = OriginalAppleDisk2.prototype;
        WrappedAppleDisk2.prototype.constructor = WrappedAppleDisk2;
        for(var key in OriginalAppleDisk2)
            if(Object.prototype.hasOwnProperty.call(OriginalAppleDisk2,key))
                WrappedAppleDisk2[key] = OriginalAppleDisk2[key];

        WrappedAppleDisk2.__A2PDiskIIUIStateWrapped = true;
        WrappedAppleDisk2.__A2POriginalAppleDisk2 = OriginalAppleDisk2;
        rootWindow.AppleDisk2 = WrappedAppleDisk2;
        return true;
    }

    function installDiskIIUIStatePatch(rootWindow)
    {
        rootWindow = rootWindow || root;
        if(!rootWindow || rootWindow.__A2PDiskIIUIStatePatchInstalled) return false;
        rootWindow.__A2PDiskIIUIStatePatchInstalled = true;

        var attempts = 0;
        var timer = null;

        function poll()
        {
            attempts++;
            wrapDiskIIConstructor(rootWindow);
            decorateKnownDiskIICards(rootWindow);

            if(attempts > 200 && timer)
            {
                rootWindow.clearInterval(timer);
                timer = null;
            }
        }

        poll();
        if(typeof rootWindow.setInterval == "function")
            timer = rootWindow.setInterval(poll,50);
        if(rootWindow.addEventListener)
            rootWindow.addEventListener("load",poll,{once:true});

        return true;
    }

    return {
         "diskDeviceID":diskDeviceID
        ,"diskDeviceN":diskDeviceN
        ,"attachedDiskDevices":attachedDiskDevices
        ,"driveFileDisplayName":driveFileDisplayName
        ,"decorateDiskIIUIState":decorateDiskIIUIState
        ,"installDiskIIUIStatePatch":installDiskIIUIStatePatch
    };
});
