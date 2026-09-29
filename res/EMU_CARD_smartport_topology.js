/*
 * EMU_CARD_smartport_topology.js
 *
 * Runtime topology policy for SmartPort-style child devices.
 *
 * A physical device detach must also release/eject any mounted media owned by
 * that child device. This is particularly important for HD20-sized images:
 * removing the device must not keep a stale 20 MiB backing store alive.
 *
 * LIRON device visuals use Composer v2 semantic BODY ids through visibleAt().
 * UniDisk visuals are layout positions filled by the first/second attached
 * UniDisk, independently of their SmartPort unit numbers. The two HD20 images
 * are layout positions: visual 1 is the upper position used by a standalone
 * HD20, while visual 2 is the lower position used when UniDisks are present.
 * UniDisk/HD20 LED visuals are intentionally outside this design milestone.
 */
(function(root,factory){
    "use strict";
    var api = factory(root || null);
    if(typeof module == "object" && module.exports) module.exports = api;
    if(root) api.installSmartPortTopologyPatch(root);
})(typeof window != "undefined" ? window : (typeof globalThis != "undefined" ? globalThis : null),function(root){
    "use strict";

    function deviceCode(device)
    {
        return String(device && device.id ? device.id.DCODE || "" : "").toUpperCase();
    }

    function deviceUnit(device)
    {
        var unit = device && typeof device.getUnit == "function"
            ? Number(device.getUnit())
            : Number(device && device.id ? device.id.deviceN : NaN);
        return Number.isInteger(unit) && unit>=1 && unit<=8 ? unit : null;
    }

    function deviceHash(device)
    {
        var hash = Number(device && device.attach ? device.attach.hash : NaN);
        return Number.isInteger(hash) ? hash : null;
    }

    function copyStatics(from,to)
    {
        for(var key in from)
            if(Object.prototype.hasOwnProperty.call(from,key))
                to[key] = from[key];
    }

    function lironLayout(owner)
    {
        if(root && root.oLAYOUT) return root.oLAYOUT;
        if(root && root.oCOM && root.oCOM.LAYOUT) return root.oCOM.LAYOUT;
        return null;
    }

    function lironLayoutSlotN(owner)
    {
        var slotN = owner && owner.mount ? Number(owner.mount.slotN) : NaN;
        return Number.isInteger(slotN) && slotN>=0 && slotN<=8 ? slotN : null;
    }

    function lironVisualState(owner)
    {
        var unidiskCount = 0;
        var hd20 = false;
        var devices = Array.isArray(owner && owner.devices) ? owner.devices : [];

        for(var i=0;i<devices.length;i++)
        {
            var code = deviceCode(devices[i]);
            if(code=="UNIDISK") unidiskCount++;
            else if(code=="HD20") hd20 = true;
        }

        return {
            unidiskCount: unidiskCount,
            hd20: hd20
        };
    }

    function lironTopologySignature(owner)
    {
        var slotN = lironLayoutSlotN(owner);
        if(slotN===null) return null;

        var state = lironVisualState(owner);
        return slotN + "|U" + Math.min(state.unidiskCount,2) + "|H" + (state.hd20 ? 1 : 0);
    }

    function lironVisualEntries(layout,slotN,query)
    {
        if(!layout || typeof layout.find != "function") return [];
        var found = layout.find(query);
        if(!Array.isArray(found)) return [];
        return found.filter(function(entry)
        {
            return !!entry && (entry.slotN === null || entry.slotN === undefined || entry.slotN === slotN);
        });
    }

    function lironVisualId(entries,index,fallback)
    {
        var entry = entries[index];
        return entry && entry.id ? entry.id : fallback;
    }

    function syncLironLayout(owner)
    {
        if(!owner || !owner.id || owner.id.PCODE!="LIRON") return false;

        var layout = lironLayout(owner);
        var slotN = lironLayoutSlotN(owner);
        if(slotN===null || !layout || typeof layout.visibleAt != "function") return false;

        var state = lironVisualState(owner);
        var hasUniDisk = state.unidiskCount > 0;
        var unidisks = lironVisualEntries(layout,slotN,{PCODE:"LIRON",DCODE:"UNIDISK",ROLE:"BODY"});
        var standalone = lironVisualEntries(layout,slotN,{PCODE:"LIRON",DCODE:"HD20",ROLE:"BODY",LAYOUT:"STANDALONE"});
        var stacked = lironVisualEntries(layout,slotN,{PCODE:"LIRON",DCODE:"HD20",ROLE:"BODY",LAYOUT:"STACKED"});

        layout.visibleAt(slotN,lironVisualId(unidisks,0,"LIRON.UNIDISK.1.BODY"),state.unidiskCount >= 1);
        layout.visibleAt(slotN,lironVisualId(unidisks,1,"LIRON.UNIDISK.2.BODY"),state.unidiskCount >= 2);
        layout.visibleAt(slotN,lironVisualId(standalone,0,"LIRON.HD20.1.BODY"),state.hd20 && !hasUniDisk);
        layout.visibleAt(slotN,lironVisualId(stacked,0,"LIRON.HD20.2.BODY"),state.hd20 && hasUniDisk);
        return true;
    }

    function syncLironLayoutTracked(owner,force)
    {
        var signature = lironTopologySignature(owner);
        if(!force && signature!==null && owner && owner.__A2PSmartPortLayoutSignature===signature)
            return true;

        var synced = syncLironLayout(owner);
        if(synced && owner)
            owner.__A2PSmartPortLayoutSignature = signature;
        return synced;
    }

    function patchHD20Constructor(rootWindow)
    {
        if(!rootWindow || typeof rootWindow.HD20Device != "function") return false;
        if(rootWindow.HD20Device.__A2PMediaReleasePatched) return true;

        var OriginalHD20Device = rootWindow.HD20Device;
        var source = Function.prototype.toString.call(OriginalHD20Device);
        var patched = source;

        var oldGetImage = "this.getImage = function() { return media===null ? new Uint8Array(BLOCK_SIZE*BLOCK_COUNT) : media.slice(); };";
        var newGetImage = "this.getImage = function() { return media===null ? null : media.slice(); };";
        if(patched.indexOf(oldGetImage)>=0)
            patched = patched.replace(oldGetImage,newGetImage);

        var marker = "    this.readBlock = function(blockNumber)\n    {";
        if(patched.indexOf("this.releaseMedia = function()")<0 && patched.indexOf(marker)>=0)
        {
            patched = patched.replace(marker,
                "    this.releaseMedia = function()\n"+
                "    {\n"+
                "        var previous=suggestedFilename();\n"+
                "        media=null;\n"+
                "        state.online=false;\n"+
                "        state.mediaFilename=\"\";\n"+
                "        state.dirty=false;\n"+
                "        state.lastBlock=null;\n"+
                "        notifyFilenameChange(previous);\n"+
                "        return true;\n"+
                "    };\n\n"+
                marker
            );
        }

        if(patched===source) return false;

        var PatchedHD20Device;
        try
        {
            PatchedHD20Device = Function("return ("+patched+");")();
        }
        catch(e)
        {
            console.error("HD20 media-release patch failed",e);
            return false;
        }

        PatchedHD20Device.prototype = OriginalHD20Device.prototype;
        PatchedHD20Device.prototype.constructor = PatchedHD20Device;
        copyStatics(OriginalHD20Device,PatchedHD20Device);
        PatchedHD20Device.__A2PMediaReleasePatched = true;
        PatchedHD20Device.__A2POriginalHD20Device = OriginalHD20Device;
        rootWindow.HD20Device = PatchedHD20Device;
        return true;
    }

    function releaseDeviceMedia(device)
    {
        if(!device) return false;

        if(typeof device.releaseMedia == "function")
            return device.releaseMedia()!==false;

        if(typeof device.ejectImage == "function")
            return device.ejectImage()!==false;

        return false;
    }

    function refreshLironMediaUI(owner,device,clearFile)
    {
        if(!owner || !device) return false;

        var unit = deviceUnit(device);
        if(unit!==null && typeof owner.deviceToolSyncMediaControls == "function")
            owner.deviceToolSyncMediaControls(unit,{"clearFile":!!clearFile});

        if(typeof owner.deviceToolSurfaceMapRefresh == "function")
            owner.deviceToolSurfaceMapRefresh();

        try
        {
            if(typeof apple2plus == "object" && apple2plus && owner.mount)
            {
                var io = apple2plus.hwObj().io;
                var slotN = Number(owner.mount.slotN);
                var slotID = Number.isInteger(slotN) && io && typeof io.slot2ID == "function"
                    ? io.slot2ID(slotN)
                    : undefined;

                if(io && typeof io.refreshDeviceToolboxes == "function")
                    io.refreshDeviceToolboxes({"id":"devices","default_slot":slotID});
            }
        }
        catch(e) {}

        return true;
    }

    function decorateLironTopology(owner)
    {
        if(!owner || !owner.id || owner.id.PCODE!="LIRON") return owner;
        if(owner.__A2PSmartPortTopologyDecorated)
        {
            // Discovery may encounter the card before its slot/device topology is
            // initialized. Retry only until a new visual topology is synchronized.
            syncLironLayoutTracked(owner,false);
            return owner;
        }
        owner.__A2PSmartPortTopologyDecorated = true;

        // Standard hook used by Peripheral-controls navigation to reconstruct
        // the selected scene from the card's current child-device topology.
        owner.syncLayoutVisuals = function()
        {
            return syncLironLayoutTracked(this,true);
        };

        var nativeDetachSmartPortDevice = owner.detachSmartPortDevice;
        var nativeDetachUniDisk = owner.detachUniDisk;
        var nativeTopologyChanged = owner.onDeviceTopologyChanged;

        owner.detachSmartPortDevice = function(device)
        {
            releaseDeviceMedia(device);
            var result = typeof nativeDetachSmartPortDevice == "function"
                ? nativeDetachSmartPortDevice.apply(this,arguments)
                : false;
            refreshLironMediaUI(this,device,true);
            syncLironLayoutTracked(this,true);
            return result;
        };

        owner.detachUniDisk = function(device)
        {
            releaseDeviceMedia(device);
            var result = typeof nativeDetachUniDisk == "function"
                ? nativeDetachUniDisk.apply(this,arguments)
                : false;
            refreshLironMediaUI(this,device,true);
            syncLironLayoutTracked(this,true);
            return result;
        };

        owner.onDeviceTopologyChanged = function(change)
        {
            var result = typeof nativeTopologyChanged == "function"
                ? nativeTopologyChanged.apply(this,arguments)
                : true;

            if(change && change.type=="detach" && change.device)
            {
                releaseDeviceMedia(change.device);
                refreshLironMediaUI(this,change.device,true);
            }
            else if(change && change.type=="attach" && change.device)
            {
                refreshLironMediaUI(this,change.device,false);
            }

            syncLironLayoutTracked(this,true);
            return result;
        };

        syncLironLayoutTracked(owner,true);
        return owner;
    }

    function wrapLironConstructor(rootWindow)
    {
        if(!rootWindow || typeof rootWindow.AppleLiron != "function") return false;
        if(rootWindow.AppleLiron.__A2PSmartPortTopologyWrapped) return true;

        var OriginalAppleLiron = rootWindow.AppleLiron;
        var WrappedAppleLiron = function AppleLiron()
        {
            var instance = Object.create(OriginalAppleLiron.prototype || Object.prototype);
            var result = OriginalAppleLiron.apply(instance,arguments);
            var card = result && (typeof result == "object" || typeof result == "function")
                ? result
                : instance;
            return decorateLironTopology(card);
        };

        WrappedAppleLiron.prototype = OriginalAppleLiron.prototype;
        WrappedAppleLiron.prototype.constructor = WrappedAppleLiron;
        copyStatics(OriginalAppleLiron,WrappedAppleLiron);
        WrappedAppleLiron.__A2PSmartPortTopologyWrapped = true;
        WrappedAppleLiron.__A2POriginalAppleLiron = OriginalAppleLiron;
        rootWindow.AppleLiron = WrappedAppleLiron;
        return true;
    }

    function decorateKnownLironCards(rootWindow)
    {
        var changed = false;

        if(rootWindow.oEMU && rootWindow.oEMU.component && rootWindow.oEMU.component.IO)
        {
            var discovery = rootWindow.oEMU.component.IO.AppleLiron;
            if(discovery && discovery.id && discovery.id.PCODE=="LIRON")
            {
                decorateLironTopology(discovery);
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
                        if(owner && owner.id && owner.id.PCODE=="LIRON")
                        {
                            decorateLironTopology(owner);
                            changed = true;
                        }
                    }
                }
            }
        }
        catch(e) {}

        return changed;
    }

    function installSmartPortTopologyPatch(rootWindow)
    {
        rootWindow = rootWindow || root;
        if(!rootWindow || rootWindow.__A2PSmartPortTopologyPatchInstalled) return false;
        rootWindow.__A2PSmartPortTopologyPatchInstalled = true;

        var attempts = 0;
        var timer = null;

        function poll()
        {
            attempts++;
            patchHD20Constructor(rootWindow);
            wrapLironConstructor(rootWindow);
            decorateKnownLironCards(rootWindow);

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
         "deviceCode":deviceCode
        ,"deviceUnit":deviceUnit
        ,"deviceHash":deviceHash
        ,"syncLironLayout":syncLironLayout
        ,"releaseDeviceMedia":releaseDeviceMedia
        ,"decorateLironTopology":decorateLironTopology
        ,"installSmartPortTopologyPatch":installSmartPortTopologyPatch
    };
});