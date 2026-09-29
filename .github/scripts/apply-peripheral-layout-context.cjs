'use strict';

const fs=require('node:fs');

function replaceOnce(source,from,to,label)
{
    const index=source.indexOf(from);
    if(index<0) throw new Error('Missing patch anchor: '+label);
    if(source.indexOf(from,index+1)>=0) throw new Error('Ambiguous patch anchor: '+label);
    return source.slice(0,index)+to+source.slice(index+from.length);
}

let layout=fs.readFileSync('res/COM_A2P_LAYOUT.js','utf8');

layout=replaceOnce(layout,
`    var layersById = Object.create(null);\n    var layersByAlias = Object.create(null);\n    var pending = Object.create(null);\n`,
`    var layersById = Object.create(null);\n    var layersByAlias = Object.create(null);\n    var pending = Object.create(null);\n    var peripheralContext = null;\n`,
'LAYOUT state');

layout=replaceOnce(layout,
`function applyLayerVisibility(entry,state)\n{\n    if(!entry) return false;\n    state = !!state;\n    entry.model.visible = state;\n    if(entry.element && entry.element.style)\n    {\n        entry.element.style.display = \"\";\n        entry.element.style.visibility = state ? \"visible\" : \"hidden\";\n        entry.element.style.opacity = state ? \"1\" : \"0\";\n        forceWebKitRepaint(entry.element);\n    }\n    return state;\n}\n`,
`function applyLayerPresentation(entry,state)\n{\n    if(!entry) return false;\n    state = !!state;\n    if(entry.element && entry.element.style)\n    {\n        entry.element.style.display = \"\";\n        entry.element.style.visibility = state ? \"visible\" : \"hidden\";\n        entry.element.style.opacity = state ? \"1\" : \"0\";\n        forceWebKitRepaint(entry.element);\n    }\n    return state;\n}\n\nfunction applyLayerVisibility(entry,state,presentedState)\n{\n    if(!entry) return false;\n    state = !!state;\n    entry.model.visible = state;\n    applyLayerPresentation(entry,presentedState === undefined ? state : presentedState);\n    return state;\n}\n`,
'presentation split');

layout=replaceOnce(layout,
`    function resolveRoot(candidate)\n    {\n        return candidate || self.root || root || null;\n    }\n\n    function mountedDiskIISlotN(explicitSlotN)\n`,
`    function resolveRoot(candidate)\n    {\n        return candidate || self.root || root || null;\n    }\n\n    function entryPresentationState(entry)\n    {\n        if(!entry || !entry.model) return false;\n        if(!entry.model.visible) return false;\n        if(!peripheralContext) return true;\n\n        var labels = entry.labels || entry.model.labels || {};\n        var pcode = String(labels.PCODE || \"\");\n\n        // Layers without PCODE belong to the system composition (Apple II body,\n        // monitor, and other slot-0 system imagery) and remain visible according\n        // to their intrinsic topology state in every Peripheral-controls context.\n        if(!pcode) return true;\n\n        return peripheralContext.slotN !== null &&\n            entry.slotN === peripheralContext.slotN &&\n            pcode === peripheralContext.pcode;\n    }\n\n    function refreshEntryPresentation(entry)\n    {\n        return applyLayerPresentation(entry,entryPresentationState(entry));\n    }\n\n    function refreshPeripheralPresentation()\n    {\n        Object.keys(layersById).forEach(function(address)\n        {\n            refreshEntryPresentation(layersById[address]);\n        });\n    }\n\n    function mountedDiskIISlotN(explicitSlotN)\n`,
'context presentation helpers');

layout=replaceOnce(layout,
`        return applyLayerVisibility(entry,state);\n    };\n\n    this.visibleAt = function(slotN,id,state)\n    {\n        return self.visible(self.address(slotN,id),state);\n    };\n\n    this.find = function(query)\n`,
`        return applyLayerVisibility(entry,state,entryPresentationState(entry));\n    };\n\n    this.visibleAt = function(slotN,id,state)\n    {\n        return self.visible(self.address(slotN,id),state);\n    };\n\n    this.setPeripheralContext = function(slotN,pcode)\n    {\n        slotN = Number(slotN);\n        pcode = String(pcode || \"\").trim().toUpperCase();\n\n        // Missing/host/unsupported context intentionally means system-only.\n        // A valid context with no matching PCODE layers naturally has the same\n        // presentation while remaining ready for future Composer artwork.\n        peripheralContext = {\n            slotN: Number.isInteger(slotN) && slotN >= 0 && slotN <= 8 ? slotN : null,\n            pcode: pcode\n        };\n        refreshPeripheralPresentation();\n        return true;\n    };\n\n    this.getPeripheralContext = function()\n    {\n        return peripheralContext ? {slotN:peripheralContext.slotN,pcode:peripheralContext.pcode} : null;\n    };\n\n    this.find = function(query)\n`,
'context API');

layout=replaceOnce(layout,
`                if(layer && layer.file == filename)\n                {\n                    layer.visible = state;\n                    changed = true;\n                }\n`,
`                if(layer && layer.file == filename)\n                {\n                    self.visible(layer.address || layoutAddress(layer.slotN,layer.id),state);\n                    changed = true;\n                }\n`,
'visibleByFile model update');

layout=replaceOnce(layout,
`        if(self.lastComposition && typeof self.lastComposition.querySelectorAll == \"function\")\n        {\n            var nodes = self.lastComposition.querySelectorAll(\"img[data-file]\");\n            for(var i=0;i<nodes.length;i++)\n            {\n                if(nodes[i].dataset && nodes[i].dataset.file == filename)\n                {\n                    nodes[i].style.display = \"\";\n                    nodes[i].style.visibility = state ? \"visible\" : \"hidden\";\n                    nodes[i].style.opacity = state ? \"1\" : \"0\";\n                    forceWebKitRepaint(nodes[i]);\n                    changed = true;\n                }\n            }\n        }\n\n        return changed;\n`,
`        return changed;\n`,
'visibleByFile presentation delegation');

layout=replaceOnce(layout,
`                Object.keys(pending).forEach(function(id)\n                {\n                    var entry = resolveLayerEntry(id);\n                    if(entry)\n                    {\n                        applyLayerVisibility(entry,pending[id]);\n                        delete pending[id];\n                    }\n                });\n\n                self.lastLayout = layout;\n`,
`                Object.keys(pending).forEach(function(id)\n                {\n                    var entry = resolveLayerEntry(id);\n                    if(entry)\n                    {\n                        applyLayerVisibility(entry,pending[id],entryPresentationState(entry));\n                        delete pending[id];\n                    }\n                });\n\n                // setPeripheralContext() may have been called before installation.\n                // Reapply presentation after the registry exists without changing\n                // any intrinsic attachment/topology visibility state.\n                if(peripheralContext) refreshPeripheralPresentation();\n\n                self.lastLayout = layout;\n`,
'install context refresh');

fs.writeFileSync('res/COM_A2P_LAYOUT.js',layout);

let io=fs.readFileSync('res/EMU_apple2io.js','utf8');

io=replaceOnce(io,
`    this.refreshDeviceToolboxes = function(arg)\n    {\n        arg = arg || {};\n\n        var box = document.getElementById(\"device_toolbox_body\");\n`,
`    this.refreshDeviceToolboxes = function(arg)\n    {\n        arg = arg || {};\n        var io = this;\n\n        function syncPeripheralLayoutContext(selectedSlot)\n        {\n            var layout = typeof(oLAYOUT) != \"undefined\" && oLAYOUT\n                ? oLAYOUT\n                : (typeof(window) != \"undefined\" ? window.oLAYOUT : null);\n            if(!layout || typeof(layout.setPeripheralContext) != \"function\") return false;\n\n            if(selectedSlot === \"H\" || selectedSlot === null || selectedSlot === undefined)\n                return layout.setPeripheralContext(null,\"\");\n\n            var slotN = Number(slotID2n(selectedSlot));\n            var peripheral = Number.isInteger(slotN) ? io.SLOT2obj(slotN) : null;\n            var pcode = peripheralPCODE(peripheral);\n            return layout.setPeripheralContext(slotN,pcode);\n        }\n\n        var box = document.getElementById(\"device_toolbox_body\");\n`,
'refresh layout helper');

io=replaceOnce(io,
`            btn.setAttribute(\"data-slot\",\"\");\n            this.showDeviceTool(null);\n            return null;\n`,
`            btn.setAttribute(\"data-slot\",\"\");\n            this.showDeviceTool(null);\n            syncPeripheralLayoutContext(null);\n            return null;\n`,
'empty context');

io=replaceOnce(io,
`        btn.setAttribute(\"data-slot\", slot===\"H\" ? \"H\" : String(slot));\n        btn.innerHTML = this.deviceLabel(slot);\n        this.showDeviceTool(slot);\n        return slot;\n`,
`        btn.setAttribute(\"data-slot\", slot===\"H\" ? \"H\" : String(slot));\n        btn.innerHTML = this.deviceLabel(slot);\n        this.showDeviceTool(slot);\n        syncPeripheralLayoutContext(slot);\n        return slot;\n`,
'selected context');

fs.writeFileSync('res/EMU_apple2io.js',io);
