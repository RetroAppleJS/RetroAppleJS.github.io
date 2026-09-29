'use strict';

const fs=require('node:fs');
const path=require('node:path');
const file=path.join(process.cwd(),'res','COM_A2P_LAYOUT.js');
let source=fs.readFileSync(file,'utf8');

function replaceOnce(from,to,label)
{
    if(!source.includes(from)) throw new Error('Could not find '+label+' patch anchor');
    source=source.replace(from,to);
}

replaceOnce(
`    function setDiskLayer(id,state)\n    {\n        return self.visible(id,state);\n    }\n\n    this.A2P = {\n        DISKII: {\n            GAP: function(on){ return setDiskLayer("A2P.DISKII.GAP",on); },\n            D1: {\n                BODY: function(on){ return setDiskLayer("A2P.DISKII.D1.BODY",on); },\n                LED: function(on){ return setDiskLayer("A2P.DISKII.D1.LED",on); },\n                LID: function(open){ return setDiskLayer("A2P.DISKII.D1.LID",open); }\n            },\n            D2: {\n                BODY: function(on){ return setDiskLayer("A2P.DISKII.D2.BODY",on); },\n                LED: function(on){ return setDiskLayer("A2P.DISKII.D2.LED",on); },\n                LID: function(open){ return setDiskLayer("A2P.DISKII.D2.LID",open); }\n            }\n        }\n    };`,
`    function mountedDiskIISlotN(explicitSlotN)\n    {\n        var slotN = explicitSlotN;\n        if(slotN === undefined || slotN === null)\n        {\n            var rootWindow = resolveRoot();\n            var owner = rootWindow && rootWindow.oEMU && rootWindow.oEMU.component && rootWindow.oEMU.component.IO\n                ? rootWindow.oEMU.component.IO.AppleDisk2\n                : null;\n            slotN = owner && owner.mount ? Number(owner.mount.slotN) : NaN;\n        }\n        slotN = Number(slotN);\n        return Number.isInteger(slotN) && slotN >= 0 && slotN <= 8 ? slotN : null;\n    }\n\n    function setDiskLayer(id,state,slotN)\n    {\n        slotN = mountedDiskIISlotN(slotN);\n        if(slotN === null) return false;\n        return self.visibleAt(slotN,id,state);\n    }\n\n    this.A2P = {\n        DISKII: {\n            GAP: function(on,slotN){ return setDiskLayer("DISKII.GAP",on,slotN); },\n            D1: {\n                BODY: function(on,slotN){ return setDiskLayer("DISKII.D1.BODY",on,slotN); },\n                LED: function(on,slotN){ return setDiskLayer("DISKII.D1.LED",on,slotN); },\n                LID: function(open,slotN){ return setDiskLayer("DISKII.D1.LID",open,slotN); }\n            },\n            D2: {\n                BODY: function(on,slotN){ return setDiskLayer("DISKII.D2.BODY",on,slotN); },\n                LED: function(on,slotN){ return setDiskLayer("DISKII.D2.LED",on,slotN); },\n                LID: function(open,slotN){ return setDiskLayer("DISKII.D2.LID",open,slotN); }\n            }\n        }\n    };`,
'Disk II facade');

replaceOnce(
`            if(!info.layout)\n            {\n                var bodyId = "A2P.DISKII." + code + ".BODY";\n                var prefix = "A2P.DISKII." + code + ".";\n\n                info.layout = {\n                    attached: [\n                        {id: bodyId, visible: true},\n                        {id: prefix + "LED", visible: false},\n                        {id: prefix + "LID", visible: false}\n                    ],\n                    detached: [\n                        {id: bodyId, visible: false},\n                        {id: prefix + "LED", visible: false},\n                        {id: prefix + "LID", visible: false}\n                    ]\n                };\n                changed = true;\n            }`,
`            if(!info.layout)\n            {\n                var slotN = owner.mount ? Number(owner.mount.slotN) : NaN;\n                if(!Number.isInteger(slotN) || slotN < 0 || slotN > 8) return;\n\n                var bodyId = "DISKII." + code + ".BODY";\n                var prefix = "DISKII." + code + ".";\n\n                info.layout = {\n                    attached: [\n                        {slotN: slotN, id: bodyId, visible: true},\n                        {slotN: slotN, id: prefix + "LED", visible: false},\n                        {slotN: slotN, id: prefix + "LID", visible: false}\n                    ],\n                    detached: [\n                        {slotN: slotN, id: bodyId, visible: false},\n                        {slotN: slotN, id: prefix + "LED", visible: false},\n                        {slotN: slotN, id: prefix + "LID", visible: false}\n                    ]\n                };\n                changed = true;\n            }`,
'Disk II device layout targets');

replaceOnce(
`        var gapRule = {\n            id: "DISKII.GAP.BOTH_DRIVES",\n            when: {allAttached: ["D1","D2"]},\n            attached: [\n                {id: "A2P.DISKII.GAP", visible: true}\n            ],\n            detached: [\n                {id: "A2P.DISKII.GAP", visible: false}\n            ]\n        };`,
`        var gapSlotN = owner.mount ? Number(owner.mount.slotN) : NaN;\n        var gapRule = {\n            id: "DISKII.GAP.BOTH_DRIVES",\n            when: {allAttached: ["D1","D2"]},\n            attached: Number.isInteger(gapSlotN) && gapSlotN >= 0 && gapSlotN <= 8 ? [\n                {slotN: gapSlotN, id: "DISKII.GAP", visible: true}\n            ] : [],\n            detached: Number.isInteger(gapSlotN) && gapSlotN >= 0 && gapSlotN <= 8 ? [\n                {slotN: gapSlotN, id: "DISKII.GAP", visible: false}\n            ] : []\n        };`,
'Disk II gap rule');

replaceOnce(
`        if(target.id && layout && typeof layout.visible == "function")\n            changed = layout.visible(target.id,state) || changed;`,
`        if(target.id && layout)\n        {\n            if(target.slotN !== undefined && target.slotN !== null && typeof layout.visibleAt == "function")\n                changed = layout.visibleAt(Number(target.slotN),target.id,state) || changed;\n            else if(typeof layout.visible == "function")\n                changed = layout.visible(target.id,state) || changed;\n        }`,
'slot-aware layout dispatch');

replaceOnce(
` * It consumes the version-1 layout object embedded in EMU_apple2main.js.\n * Embedded PNG data URLs are used directly when present, with the legacy`,
` * It consumes Composer v2 layouts and normalizes legacy v1 layouts for compatibility.\n * Embedded PNG data URLs are used directly when present, with the legacy`,
'header documentation');

fs.writeFileSync(file,source);
console.log('Applied Composer v2 Disk II call-site migration.');
