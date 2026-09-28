/*
 * EMU_CARD_appledisk2_topology.js
 *
 * Runtime topology policy for the Disk II controller.
 *
 * Apple2IO owns the list of attached child devices.  The Disk II controller
 * still owns two soft-switch-addressable hardware slots, so detached drives
 * must be suppressed at the controller boundary as well as in the layout.
 */
(function(root,factory){
    "use strict";
    var api = factory(root || null);
    if(typeof module == "object" && module.exports) module.exports = api;
    if(root) api.installDiskIITopologyPatch(root);
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

    function diskDriveID(deviceN)
    {
        deviceN = Number(deviceN);
        return Number.isInteger(deviceN) && deviceN>=0 && deviceN<=1
            ? "D" + (deviceN + 1)
            : null;
    }

    function isDriveAttached(card,deviceN)
    {
        deviceN = Number(deviceN);
        if(!Number.isInteger(deviceN) || deviceN<0 || deviceN>1) return false;
        if(!card || !Array.isArray(card.devices)) return false;

        var code = "D" + (deviceN + 1);
        for(var i=0;i<card.devices.length;i++)
            if(diskDeviceID(card.devices[i])==code) return true;

        return false;
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

    function shouldSuppressDiskNoise(card,status)
    {
        status = String(status || "");
        if(status!="MOTOR_ON" && status!="ARM_IN" && status!="ARM_OUT" && status!="CLICK_IN" && status!="CLICK_OUT")
            return false;

        var state = diskState(card);
        var deviceN = state ? Number(state.drv) : NaN;
        return !isDriveAttached(card,deviceN);
    }

    function clearDetachedDriveState(card,deviceN)
    {
        deviceN = Number(deviceN);
        if(!card || !Number.isInteger(deviceN) || deviceN<0 || deviceN>1) return false;

        var state = diskState(card);
        if(!state) return false;

        var selected = Number(state.drv) == deviceN;
        var wasMotorOn = !!(Array.isArray(state.hw) && state.hw[deviceN] && state.hw[deviceN].motor);

        if(typeof card.cancelTrackStatsFlush == "function")
            card.cancelTrackStatsFlush(deviceN);

        if(Array.isArray(state.diskData)) state.diskData[deviceN] = null;
        if(Array.isArray(state.diskName)) state.diskName[deviceN] = null;

        if(Array.isArray(state.hw) && state.hw[deviceN])
        {
            state.hw[deviceN].motor = 0;
            state.hw[deviceN].q6 = 0;
            state.hw[deviceN].q7 = 0;
            state.hw[deviceN].offset = 0;
            state.hw[deviceN].data_latch = 0;

            if(state.hw[deviceN].stats)
            {
                state.hw[deviceN].stats.read = 0;
                state.hw[deviceN].stats.write = 0;
                state.hw[deviceN].stats.motorOffTimer = null;
            }
        }

        if(selected)
            state.drive_enable = 0;

        if((wasMotorOn || selected) && typeof card.dN_update == "function")
            card.dN_update("MOTOR_OFF");

        if(typeof card.setDriveLED == "function") card.setDriveLED(deviceN,false);
        if(typeof card.setDriveLidClosed == "function") card.setDriveLidClosed(deviceN,false);

        return true;
    }

    function renderAttachedDiskIIRows(card,ctx,nativeToolSlotHTML)
    {
        ctx = ctx || {};
        var slotN = Number(ctx.slotN);
        var slotID = ctx.slotID;
        var rowFactory = root && typeof root.EMU_deviceMediaRowHTML == "function"
            ? root.EMU_deviceMediaRowHTML
            : (typeof EMU_deviceMediaRowHTML == "function" ? EMU_deviceMediaRowHTML : null);

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

    function decorateDiskIITopology(card)
    {
        if(!card || !card.id || card.id.PCODE!="DISKII") return card;
        if(card.__A2PDiskIITopologyDecorated) return card;
        card.__A2PDiskIITopologyDecorated = true;

        var nativeSetDriveLED = card.setDriveLED;
        var nativeSetDriveLidClosed = card.setDriveLidClosed;
        var nativeSyncDriveVisuals = card.syncDriveVisuals;
        var nativeDeviceToolSlotHTML = card.deviceToolSlotHTML;
        var nativeSurfaceMapHTML = card.surfaceMap_html;
        var nativeTopologyChanged = card.onDeviceTopologyChanged;
        var nativeDNUpdate = card.dN_update;

        card.isDriveAttached = function(deviceN)
        {
            return isDriveAttached(this,deviceN);
        };

        card.setDriveLED = function(deviceN,on)
        {
            if(!this.isDriveAttached(deviceN)) on = false;
            return typeof nativeSetDriveLED == "function"
                ? nativeSetDriveLED.call(this,deviceN,!!on)
                : false;
        };

        card.setDriveLidClosed = function(deviceN,closed)
        {
            if(!this.isDriveAttached(deviceN)) closed = false;
            return typeof nativeSetDriveLidClosed == "function"
                ? nativeSetDriveLidClosed.call(this,deviceN,!!closed)
                : false;
        };

        card.dN_update = function(status)
        {
            if(shouldSuppressDiskNoise(this,status)) return false;
            return typeof nativeDNUpdate == "function"
                ? nativeDNUpdate.apply(this,arguments)
                : false;
        };

        card.applyDriveEnable = function(reason)
        {
            var state = diskState(this);
            if(!state || !Array.isArray(state.hw)) return false;

            var deviceN = Number(state.drv);
            var enabled = state.drive_enable ? 1 : 0;

            for(var i=0;i<state.hw.length;i++)
            {
                var oldMotor = state.hw[i] ? state.hw[i].motor : 0;
                var newMotor = (enabled && i == deviceN && this.isDriveAttached(i)) ? 1 : 0;
                if(state.hw[i]) state.hw[i].motor = newMotor;
                this.setDriveLED(i,newMotor);

                if(oldMotor != newMotor)
                {
                    if(typeof this.traceChange == "function")
                        this.traceChange(
                            newMotor ? "MOTOR_ON" : "MOTOR_OFF",
                            i,
                            "motor",
                            oldMotor,
                            newMotor,
                            {"reason":reason}
                        );

                    if(newMotor && typeof this.cancelTrackStatsFlush == "function")
                        this.cancelTrackStatsFlush(i);
                    else if(!newMotor && typeof this.scheduleTrackStatsFlush == "function")
                        this.scheduleTrackStatsFlush(i,"SPINDOWN",1000);
                }
            }
            return true;
        };

        card.detachDriveDevice = function(deviceN)
        {
            var cleared = clearDetachedDriveState(this,deviceN);
            if(cleared && typeof this.syncDriveVisuals == "function") this.syncDriveVisuals();
            return cleared;
        };

        card.syncDriveVisuals = function()
        {
            var state = diskState(this);
            if(state && Array.isArray(state.hw))
            {
                for(var i=0;i<state.hw.length;i++)
                    if(!this.isDriveAttached(i) && state.hw[i]) state.hw[i].motor = 0;
            }

            var result = typeof nativeSyncDriveVisuals == "function"
                ? nativeSyncDriveVisuals.apply(this,arguments)
                : false;

            for(var d=0;d<2;d++)
            {
                if(!this.isDriveAttached(d))
                {
                    this.setDriveLED(d,false);
                    this.setDriveLidClosed(d,false);
                }
            }
            return result;
        };

        card.onDeviceTopologyChanged = function(change)
        {
            if(typeof nativeTopologyChanged == "function")
                nativeTopologyChanged.apply(this,arguments);

            var deviceN = diskDeviceN(change && change.DCODE);
            if(change && change.type == "detach" && deviceN!==null)
                this.detachDriveDevice(deviceN);
            else if(typeof this.syncDriveVisuals == "function")
                this.syncDriveVisuals();

            return true;
        };

        card.deviceToolSlotHTML = function(ctx)
        {
            return renderAttachedDiskIIRows(this,ctx,nativeDeviceToolSlotHTML);
        };

        card.surfaceMap_html = function(popupID)
        {
            return renderAttachedDiskIISurfaceMap(this,popupID,nativeSurfaceMapHTML);
        };

        if(typeof card.syncDriveVisuals == "function") card.syncDriveVisuals();
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
                decorateDiskIITopology(discovery);
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
                            decorateDiskIITopology(owner);
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
        if(rootWindow.AppleDisk2.__A2PDiskIITopologyWrapped) return true;

        var OriginalAppleDisk2 = rootWindow.AppleDisk2;
        var WrappedAppleDisk2 = function AppleDisk2()
        {
            var instance = Object.create(OriginalAppleDisk2.prototype || Object.prototype);
            var result = OriginalAppleDisk2.apply(instance,arguments);
            var card = result && (typeof result == "object" || typeof result == "function")
                ? result
                : instance;
            return decorateDiskIITopology(card);
        };

        WrappedAppleDisk2.prototype = OriginalAppleDisk2.prototype;
        WrappedAppleDisk2.prototype.constructor = WrappedAppleDisk2;
        for(var key in OriginalAppleDisk2)
            if(Object.prototype.hasOwnProperty.call(OriginalAppleDisk2,key))
                WrappedAppleDisk2[key] = OriginalAppleDisk2[key];

        WrappedAppleDisk2.__A2PDiskIITopologyWrapped = true;
        WrappedAppleDisk2.__A2POriginalAppleDisk2 = OriginalAppleDisk2;
        rootWindow.AppleDisk2 = WrappedAppleDisk2;
        return true;
    }

    function installDiskIITopologyPatch(rootWindow)
    {
        rootWindow = rootWindow || root;
        if(!rootWindow || rootWindow.__A2PDiskIITopologyPatchInstalled) return false;
        rootWindow.__A2PDiskIITopologyPatchInstalled = true;

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
        ,"diskDriveID":diskDriveID
        ,"isDriveAttached":isDriveAttached
        ,"clearDetachedDriveState":clearDetachedDriveState
        ,"decorateDiskIITopology":decorateDiskIITopology
        ,"installDiskIITopologyPatch":installDiskIITopologyPatch
    };
});
