'use strict';

const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');

function edit(rel,mutate)
{
    const file=path.join(ROOT,rel);
    let source=fs.readFileSync(file,'utf8');
    function replaceOnce(before,after,label)
    {
        if(source.includes(after)) return;
        const count=source.split(before).length-1;
        if(count!==1) throw new Error(`${rel} ${label}: expected one source match, found ${count}`);
        source=source.replace(before,after);
    }
    mutate({replaceOnce,get source(){return source;}});
    fs.writeFileSync(file,source);
}

edit('res/COM_A2P_LAYOUT.js',({replaceOnce})=>{
    replaceOnce(
` * It consumes Composer v2 layouts and normalizes legacy v1 layouts for compatibility.`,
` * It consumes Composer v3 authoring scenes, Composer v2 runtime layouts, and\n * normalizes legacy v1 layouts for compatibility.`,
'header');

    replaceOnce(
`var LAYOUT_VERSION = 2;\nvar LEGACY_LAYOUT_VERSION = 1;`,
`var LAYOUT_VERSION = 2;\nvar AUTHORING_LAYOUT_VERSION = 3;\nvar LEGACY_LAYOUT_VERSION = 1;`,
'versions');

    replaceOnce(
`function layoutAddress(slotN,id)\n{\n    return "A2P." + slotN + "." + id;\n}`,
`function layoutAddress(slotN,id)\n{\n    return "A2P." + slotN + "." + id;\n}\n\nfunction sceneLayoutAddress(id)\n{\n    return "A2P.SCENE." + id;\n}`,
'scene address');

    replaceOnce(
`function normalizeV1Layout(raw)`,
`function normalizeV3Layout(raw)\n{\n    var seenIds = Object.create(null);\n    var layers = raw.layers.map(function(layer,index)\n    {\n        validateLayerGeometry(layer,index);\n        var id = validateSemanticId(layer.id,index);\n        var labels = validateLabels(layer.labels,index);\n        if(seenIds[id])\n            throw new Error("Duplicate Apple II Composer v3 semantic id: " + id);\n        seenIds[id] = true;\n\n        var scene = !!String(labels.PCODE || "");\n        return {\n            id: id,\n            slotN: scene ? null : 0,\n            labels: labels,\n            address: scene ? sceneLayoutAddress(id) : layoutAddress(0,id),\n            aliases: [],\n            file: layer.file,\n            x: layer.x,\n            y: layer.y,\n            visible: layer.visible,\n            shadow: validateShadow(layer.shadow,index)\n        };\n    });\n\n    return {\n        version: AUTHORING_LAYOUT_VERSION,\n        canvas: {width:CANVAS_W,height:CANVAS_H},\n        layers: layers,\n        assets: validateAssets(raw.assets)\n    };\n}\n\nfunction normalizeV1Layout(raw)`,
'v3 normalizer');

    replaceOnce(
`    if(raw.version !== LAYOUT_VERSION && raw.version !== LEGACY_LAYOUT_VERSION)\n        throw new Error("Unsupported Apple II layout version: " + raw.version + ".");`,
`    if(raw.version !== AUTHORING_LAYOUT_VERSION && raw.version !== LAYOUT_VERSION && raw.version !== LEGACY_LAYOUT_VERSION)\n        throw new Error("Unsupported Apple II layout version: " + raw.version + ".");`,
'accepted versions');

    replaceOnce(
`    return raw.version === LAYOUT_VERSION ? normalizeV2Layout(raw) : normalizeV1Layout(raw);`,
`    if(raw.version === AUTHORING_LAYOUT_VERSION) return normalizeV3Layout(raw);\n    return raw.version === LAYOUT_VERSION ? normalizeV2Layout(raw) : normalizeV1Layout(raw);`,
'normalizer dispatch');

    replaceOnce(
`        img.dataset.slotN = String(layer.slotN);`,
`        img.dataset.slotN = layer.slotN === null ? "" : String(layer.slotN);`,
'scene dataset slot');

    replaceOnce(
`        return peripheralContext.slotN !== null &&\n            entry.slotN === peripheralContext.slotN &&\n            pcode === peripheralContext.pcode;`,
`        // Composer v3 PCODE layers are a reusable slot-agnostic scene.  The\n        // selected slot determines which live peripheral supplies the state;\n        // presentation then filters that scene by the selected PCODE.\n        if(entry.slotN === null) return pcode === peripheralContext.pcode;\n\n        return peripheralContext.slotN !== null &&\n            entry.slotN === peripheralContext.slotN &&\n            pcode === peripheralContext.pcode;`,
'v3 scene presentation');

    replaceOnce(
`    this.visibleAt = function(slotN,id,state)\n    {\n        return self.visible(self.address(slotN,id),state);\n    };`,
`    this.visibleAt = function(slotN,id,state)\n    {\n        id = validateSemanticId(id,0);\n        var rootWindow = resolveRoot();\n        var isScene = (self.lastLayout && self.lastLayout.version === AUTHORING_LAYOUT_VERSION) ||\n            (!self.lastLayout && rootWindow && rootWindow.composer && rootWindow.composer.version === AUTHORING_LAYOUT_VERSION);\n\n        if(isScene) return self.visible(sceneLayoutAddress(id),state);\n        return self.visible(self.address(slotN,id),state);\n    };`,
'v3 visibleAt bridge');
});

edit('res/EMU_apple2io.js',({replaceOnce})=>{
    replaceOnce(
`            var slotN = Number(slotID2n(selectedSlot));\n            var peripheral = Number.isInteger(slotN) ? io.SLOT2obj(slotN) : null;\n            var pcode = peripheralPCODE(peripheral);\n            return layout.setPeripheralContext(slotN,pcode);`,
`            var slotN = Number(slotID2n(selectedSlot));\n            var peripheral = Number.isInteger(slotN) ? io.SLOT2obj(slotN) : null;\n            var pcode = peripheralPCODE(peripheral);\n\n            // Navigation is authoritative: rebuild the selected scene from the\n            // live peripheral and its attached devices before presenting it.\n            if(peripheral && typeof(io.syncDeviceLayout) == "function")\n                io.syncDeviceLayout(peripheral);\n            if(peripheral && typeof(peripheral.syncLayoutVisuals) == "function")\n                peripheral.syncLayoutVisuals();\n\n            return layout.setPeripheralContext(slotN,pcode);`,
'navigation scene sync');
});

edit('res/EMU_CARD_smartport_topology.js',({replaceOnce})=>{
    replaceOnce(
`    function syncLironLayout(owner)\n    {\n        if(!owner || !owner.id || owner.id.PCODE!="LIRON") return false;\n\n        var layout = lironLayout(owner);\n        var slotN = lironLayoutSlotN(owner);\n        if(slotN===null || !layout || typeof layout.visibleAt != "function") return false;\n\n        var state = lironVisualState(owner);\n        var unidisk1 = state.unidiskCount >= 1;\n        var unidisk2 = state.unidiskCount >= 2;\n        var hasUniDisk = state.unidiskCount > 0;\n\n        layout.visibleAt(slotN,"LIRON.UNIDISK.1.BODY",unidisk1);\n        layout.visibleAt(slotN,"LIRON.UNIDISK.2.BODY",unidisk2);\n        layout.visibleAt(slotN,"LIRON.HD20.1.BODY",state.hd20 && !hasUniDisk);\n        layout.visibleAt(slotN,"LIRON.HD20.2.BODY",state.hd20 && hasUniDisk);\n        return true;\n    }`,
`    function lironVisualEntries(layout,slotN,query)\n    {\n        if(!layout || typeof layout.find != "function") return [];\n        var found = layout.find(query);\n        if(!Array.isArray(found)) return [];\n        return found.filter(function(entry)\n        {\n            return !!entry && (entry.slotN === null || entry.slotN === undefined || entry.slotN === slotN);\n        });\n    }\n\n    function lironVisualId(entries,index,fallback)\n    {\n        var entry = entries[index];\n        return entry && entry.id ? entry.id : fallback;\n    }\n\n    function syncLironLayout(owner)\n    {\n        if(!owner || !owner.id || owner.id.PCODE!="LIRON") return false;\n\n        var layout = lironLayout(owner);\n        var slotN = lironLayoutSlotN(owner);\n        if(slotN===null || !layout || typeof layout.visibleAt != "function") return false;\n\n        var state = lironVisualState(owner);\n        var hasUniDisk = state.unidiskCount > 0;\n        var unidisks = lironVisualEntries(layout,slotN,{PCODE:"LIRON",DCODE:"UNIDISK",ROLE:"BODY"});\n        var standalone = lironVisualEntries(layout,slotN,{PCODE:"LIRON",DCODE:"HD20",ROLE:"BODY",LAYOUT:"STANDALONE"});\n        var stacked = lironVisualEntries(layout,slotN,{PCODE:"LIRON",DCODE:"HD20",ROLE:"BODY",LAYOUT:"STACKED"});\n\n        layout.visibleAt(slotN,lironVisualId(unidisks,0,"LIRON.UNIDISK.1.BODY"),state.unidiskCount >= 1);\n        layout.visibleAt(slotN,lironVisualId(unidisks,1,"LIRON.UNIDISK.2.BODY"),state.unidiskCount >= 2);\n        layout.visibleAt(slotN,lironVisualId(standalone,0,"LIRON.HD20.1.BODY"),state.hd20 && !hasUniDisk);\n        layout.visibleAt(slotN,lironVisualId(stacked,0,"LIRON.HD20.2.BODY"),state.hd20 && hasUniDisk);\n        return true;\n    }`,
'metadata driven LIRON layout');

    replaceOnce(
`        owner.__A2PSmartPortTopologyDecorated = true;\n\n        var nativeDetachSmartPortDevice = owner.detachSmartPortDevice;`,
`        owner.__A2PSmartPortTopologyDecorated = true;\n\n        // Standard hook used by Peripheral-controls navigation to reconstruct\n        // the selected scene from the card's current child-device topology.\n        owner.syncLayoutVisuals = function()\n        {\n            return syncLironLayoutTracked(this,true);\n        };\n\n        var nativeDetachSmartPortDevice = owner.detachSmartPortDevice;`,
'LIRON scene hook');
});

edit('res/EMU_CARD_appledisk2.js',({replaceOnce})=>{
    replaceOnce(
`    this.setDriveLED = function(deviceN,on)\n    {\n        var drive = driveLayout(deviceN);\n        if(drive && typeof drive.LED == "function") drive.LED(!!on);\n    }\n\n    this.setDriveLidClosed = function(deviceN,closed)\n    {\n        var drive = driveLayout(deviceN);\n        if(drive && typeof drive.LID == "function") drive.LID(!!closed);\n    }`,
`    this.setDriveLED = function(deviceN,on)\n    {\n        var drive = driveLayout(deviceN);\n        var slotN = this.mount ? Number(this.mount.slotN) : NaN;\n        if(drive && typeof drive.LED == "function")\n            drive.LED(!!on,Number.isInteger(slotN) ? slotN : undefined);\n    }\n\n    this.setDriveLidClosed = function(deviceN,closed)\n    {\n        var drive = driveLayout(deviceN);\n        var slotN = this.mount ? Number(this.mount.slotN) : NaN;\n        if(drive && typeof drive.LID == "function")\n            drive.LID(!!closed,Number.isInteger(slotN) ? slotN : undefined);\n    }`,
'Disk II live slot status');

    replaceOnce(
`    this.syncDriveVisuals = function()\n    {\n        for(var i=0;i<state.hw.length;i++)\n        {\n            this.setDriveLED(i,state.hw[i] && state.hw[i].motor);\n            this.setDriveLidClosed(i,state.diskData[i]!=null);\n        }\n    };`,
`    this.syncDriveVisuals = function()\n    {\n        for(var i=0;i<state.hw.length;i++)\n        {\n            this.setDriveLED(i,state.hw[i] && state.hw[i].motor);\n            this.setDriveLidClosed(i,state.diskData[i]!=null);\n        }\n    };\n\n    // Standard navigation-time visual synchronization hook.\n    this.syncLayoutVisuals = this.syncDriveVisuals;`,
'Disk II scene hook');
});

console.log('Applied Composer v3 runtime scene and peripheral visual synchronization fixes.');
