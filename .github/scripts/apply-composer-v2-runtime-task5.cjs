'use strict';

const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(),'res','COM_A2P_LAYOUT.js');
let source = fs.readFileSync(file,'utf8');

if(source.includes('this.visibleAt = function(slotN,id,state)') && source.includes('this.find = function(query)'))
{
    console.log('Composer v2 slot-qualified runtime API already applied.');
    process.exit(0);
}

const legacyRuntimeStart = source.indexOf('function runtimeLayerIdForFile(');
const renderStart = source.indexOf('\nfunction renderLayout(',legacyRuntimeStart);
if(legacyRuntimeStart >= 0 && renderStart > legacyRuntimeStart)
    source = source.slice(0,legacyRuntimeStart) + source.slice(renderStart+1);

const domStart = source.indexOf('function buildDOMComposition(');
const layoutStart = source.indexOf('\nfunction LAYOUT(rootWindow)',domStart);
if(domStart < 0 || layoutStart < 0) throw new Error('Could not locate buildDOMComposition().');

const domReplacement = `function buildDOMComposition(doc,layout,registry,aliasRegistry)
{
    var host = doc.createElement("div");
    host.id = "a2p-system-layout";
    host.style.position = "absolute";
    host.style.left = "0px";
    host.style.top = "0px";
    host.style.width = layout.canvas.width + "px";
    host.style.height = layout.canvas.height + "px";
    host.style.transformOrigin = "0 0";
    host.style.transform = "scale(" + (DISPLAY_SIZE / layout.canvas.width) + ")";
    host.style.pointerEvents = "none";
    host.style.overflow = "visible";
    host.style.zIndex = "-1";

    for(var i=layout.layers.length-1;i>=0;i--)
    {
        var layer = layout.layers[i];
        var img = doc.createElement("img");
        var address = layer.address || layoutAddress(layer.slotN,layer.id);

        img.src = assetURL(layer.file,layout);
        img.alt = "";
        img.draggable = false;
        img.dataset.layerIndex = String(i);
        img.dataset.file = layer.file;
        img.dataset.layerId = layer.id;
        img.dataset.layoutAddress = address;
        img.dataset.slotN = String(layer.slotN);
        img.style.position = "absolute";
        img.style.left = layer.x + "px";
        img.style.top = layer.y + "px";
        img.style.maxWidth = "none";
        img.style.userSelect = "none";
        img.style.pointerEvents = "none";
        img.style.filter = "none";
        img.style.display = "";
        img.style.visibility = layer.visible ? "visible" : "hidden";
        img.style.opacity = layer.visible ? "1" : "0";

        if(layer.shadow && layer.shadow.enabled)
            img.style.filter = "drop-shadow("
                + layer.shadow.offsetX + "px "
                + layer.shadow.offsetY + "px "
                + layer.shadow.blur + "px rgba(0,0,0,"
                + layer.shadow.opacity + "))";

        host.appendChild(img);

        if(registry)
        {
            var entry = {
                id: layer.id,
                address: address,
                slotN: layer.slotN,
                labels: layer.labels || {},
                model: layer,
                element: img
            };
            registry[address] = entry;

            if(aliasRegistry && Array.isArray(layer.aliases))
            {
                for(var a=0;a<layer.aliases.length;a++)
                {
                    var alias = layer.aliases[a];
                    if(alias && !aliasRegistry[alias]) aliasRegistry[alias] = entry;
                }
            }
        }
    }

    return host;
}
`;
source = source.slice(0,domStart) + domReplacement + source.slice(layoutStart+1);

source = source.replace(
    '    var layersById = Object.create(null);\n    var pending = Object.create(null);',
    '    var layersById = Object.create(null);\n    var layersByAlias = Object.create(null);\n    var pending = Object.create(null);'
);

source = source.replace(
    '    this.layoutAddress = layoutAddress;\n',
    '    this.layoutAddress = layoutAddress;\n    this.address = function(slotN,id)\n    {\n        return layoutAddress(validateSlotN(slotN,0),validateSemanticId(id,0));\n    };\n'
);

const apiStart = source.indexOf('    this.getLayer = function(id)');
const visibleByFileStart = source.indexOf('\n    this.visibleByFile = function(filename,state)',apiStart);
if(apiStart < 0 || visibleByFileStart < 0) throw new Error('Could not locate runtime lookup API block.');

const apiReplacement = `    function resolveLayerEntry(id)
    {
        return layersById[id] || layersByAlias[id] || null;
    }

    this.getLayer = function(id)
    {
        return resolveLayerEntry(id);
    };

    this.visible = function(id,state)
    {
        var entry = resolveLayerEntry(id);
        if(state === undefined)
        {
            if(entry) return entry.model.visible;
            if(Object.prototype.hasOwnProperty.call(pending,id)) return pending[id];
            return undefined;
        }

        state = !!state;
        if(!entry)
        {
            pending[id] = state;
            return state;
        }

        return applyLayerVisibility(entry,state);
    };

    this.visibleAt = function(slotN,id,state)
    {
        return self.visible(self.address(slotN,id),state);
    };

    this.find = function(query)
    {
        if(!query || typeof query != "object" || Array.isArray(query)) return [];
        if(!self.lastLayout || !Array.isArray(self.lastLayout.layers)) return [];

        var queryKeys = Object.keys(query);
        var matches = [];
        for(var i=0;i<self.lastLayout.layers.length;i++)
        {
            var layer = self.lastLayout.layers[i];
            var entry = layersById[layer.address];
            if(!entry) continue;
            var matched = true;

            for(var q=0;q<queryKeys.length;q++)
            {
                var rawKey = queryKeys[q];
                if(rawKey == "slotN")
                {
                    if(layer.slotN !== query[rawKey]) { matched = false; break; }
                    continue;
                }

                var key = String(rawKey).toUpperCase();
                if(!layer.labels || layer.labels[key] !== query[rawKey])
                {
                    matched = false;
                    break;
                }
            }

            if(matched) matches.push(entry);
        }
        return matches;
    };

    this.setVisible = this.visible;
`;
source = source.slice(0,apiStart) + apiReplacement + source.slice(visibleByFileStart+1);

source = source.replace(
    '                var registry = Object.create(null);\n                var host = buildDOMComposition(doc,layout,registry);',
    '                var registry = Object.create(null);\n                var aliasRegistry = Object.create(null);\n                var host = buildDOMComposition(doc,layout,registry,aliasRegistry);'
);

source = source.replace(
    '                layersById = registry;\n                Object.keys(pending).forEach(function(id)\n                {\n                    if(layersById[id])\n                    {\n                        applyLayerVisibility(layersById[id],pending[id]);\n                        delete pending[id];\n                    }\n                });',
    '                layersById = registry;\n                layersByAlias = aliasRegistry;\n                Object.keys(pending).forEach(function(id)\n                {\n                    var entry = resolveLayerEntry(id);\n                    if(entry)\n                    {\n                        applyLayerVisibility(entry,pending[id]);\n                        delete pending[id];\n                    }\n                });'
);

fs.writeFileSync(file,source);
console.log('Applied Composer v2 slot-qualified runtime API.');
