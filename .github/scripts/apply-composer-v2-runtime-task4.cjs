'use strict';

const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(),'res','COM_A2P_LAYOUT.js');
let source = fs.readFileSync(file,'utf8');

if(source.includes('function normalizeLayout(raw)') && source.includes('var LEGACY_LAYOUT_VERSION = 1;'))
{
    console.log('Composer v2 runtime normalization already applied.');
    process.exit(0);
}

source = source.replace(
    'var LAYOUT_VERSION = 1;',
    'var LAYOUT_VERSION = 2;\nvar LEGACY_LAYOUT_VERSION = 1;'
);

const start = source.indexOf('function validateLayerId(');
const end = source.indexOf('\nfunction assetURL(',start);
if(start < 0 || end < 0) throw new Error('Could not locate the legacy layout validation block.');

const replacement = `function validateLegacyLayerId(rawId,index)
{
    if(rawId === undefined || rawId === null || rawId === "") return null;
    if(typeof rawId != "string" || !rawId.trim())
        throw new Error("Layer " + (index+1) + " id must be a non-empty string when supplied.");
    return rawId.trim();
}

function validateSemanticId(rawId,index)
{
    if(typeof rawId != "string" || !rawId.trim())
        throw new Error("Layer " + (index+1) + " semantic id must be a non-empty string.");
    var id = rawId.trim();
    if(!/^[A-Za-z0-9._-]+$/.test(id))
        throw new Error("Layer " + (index+1) + " semantic id contains unsupported characters: " + id);
    return id;
}

function validateSlotN(rawSlotN,index)
{
    if(!Number.isInteger(rawSlotN) || rawSlotN < 0 || rawSlotN > 8)
        throw new Error("Layer " + (index+1) + " slotN must be an integer from 0 through 8.");
    return rawSlotN;
}

function validateLabels(raw,index)
{
    if(!raw || typeof raw != "object" || Array.isArray(raw))
        throw new Error("Layer " + (index+1) + " labels must be an object.");

    var labels = {};
    Object.keys(raw).forEach(function(rawKey)
    {
        var key = String(rawKey || "").trim().toUpperCase();
        if(!key || !/^[A-Z0-9_-]+$/.test(key))
            throw new Error("Layer " + (index+1) + " has an invalid metadata label key: " + rawKey);
        if(Object.prototype.hasOwnProperty.call(labels,key))
            throw new Error("Layer " + (index+1) + " has duplicate metadata label " + key + ".");
        if(typeof raw[rawKey] != "string")
            throw new Error("Layer " + (index+1) + " metadata label " + key + " must have a string value.");
        labels[key] = raw[rawKey];
    });
    return labels;
}

function layoutAddress(slotN,id)
{
    return "A2P." + slotN + "." + id;
}

function validateLayerGeometry(layer,index)
{
    if(!layer || typeof layer != "object" || Array.isArray(layer))
        throw new Error("Layer " + (index+1) + " is malformed.");
    if(typeof layer.file != "string" || !layer.file.trim())
        throw new Error("Layer " + (index+1) + " filename must be non-empty.");
    if(!Number.isInteger(layer.x) || !Number.isInteger(layer.y))
        throw new Error("Layer " + (index+1) + " X/Y coordinates must be integer pixels.");
    if(typeof layer.visible != "boolean")
        throw new Error("Layer " + (index+1) + " visibility must be boolean.");
}

function labelsForLegacySemanticId(id)
{
    var parts = String(id || "").split(".");
    if(parts[0] != "DISKII") return {};
    if(parts.length == 2)
        return {PCODE:"DISKII",ROLE:parts[1]};
    if(parts.length >= 3)
        return {PCODE:"DISKII",DCODE:parts[1],ROLE:parts.slice(2).join(".")};
    return {PCODE:"DISKII"};
}

function legacyDiskIISemanticForFile(filename)
{
    switch(String(filename || ""))
    {
        case "A2P_DISKII_left.png": return "DISKII.D1.BODY";
        case "A2P_DISKII_right.png": return "DISKII.D2.BODY";
        case "A2P_DISKII_gap.png": return "DISKII.GAP";
    }
    return null;
}

function normalizeLegacyIdentity(layer,index)
{
    var rawId = validateLegacyLayerId(layer.id,index);
    var semanticId = null;
    var slotN = 0;
    var aliases = [];

    if(rawId)
    {
        aliases.push(rawId);
        if(rawId.indexOf("A2P.DISKII.") === 0)
        {
            semanticId = rawId.slice(4);
            slotN = 7;
        }
        else if(rawId.indexOf("A2P.") === 0 && /^[A-Za-z0-9._-]+$/.test(rawId.slice(4)))
        {
            semanticId = rawId.slice(4);
        }
        else if(/^[A-Za-z0-9._-]+$/.test(rawId))
        {
            semanticId = rawId;
        }
    }

    if(!semanticId)
    {
        semanticId = legacyDiskIISemanticForFile(layer.file);
        if(semanticId)
        {
            slotN = 7;
            aliases.push("A2P." + semanticId);
        }
    }

    if(!semanticId)
        semanticId = "COMPAT.LAYER" + (index+1);

    return {
        id: validateSemanticId(semanticId,index),
        slotN: slotN,
        labels: labelsForLegacySemanticId(semanticId),
        aliases: aliases
    };
}

function normalizeV2Layout(raw)
{
    var seenAddresses = Object.create(null);
    var layers = raw.layers.map(function(layer,index)
    {
        validateLayerGeometry(layer,index);
        var id = validateSemanticId(layer.id,index);
        var slotN = validateSlotN(layer.slotN,index);
        var labels = validateLabels(layer.labels,index);
        var address = layoutAddress(slotN,id);
        if(seenAddresses[address])
            throw new Error("Duplicate Apple II layout address: " + address);
        seenAddresses[address] = true;

        return {
            id: id,
            slotN: slotN,
            labels: labels,
            address: address,
            aliases: [],
            file: layer.file,
            x: layer.x,
            y: layer.y,
            visible: layer.visible,
            shadow: validateShadow(layer.shadow,index)
        };
    });

    return {
        version: LAYOUT_VERSION,
        canvas: {width:CANVAS_W,height:CANVAS_H},
        layers: layers,
        assets: validateAssets(raw.assets)
    };
}

function normalizeV1Layout(raw)
{
    var seenAddresses = Object.create(null);
    var layers = raw.layers.map(function(layer,index)
    {
        validateLayerGeometry(layer,index);
        var identity = normalizeLegacyIdentity(layer,index);
        var address = layoutAddress(identity.slotN,identity.id);
        if(seenAddresses[address])
            throw new Error("Duplicate Apple II layout address after v1 normalization: " + address);
        seenAddresses[address] = true;

        return {
            id: identity.id,
            slotN: identity.slotN,
            labels: identity.labels,
            address: address,
            aliases: identity.aliases,
            file: layer.file,
            x: layer.x,
            y: layer.y,
            visible: layer.visible,
            shadow: validateShadow(layer.shadow,index)
        };
    });

    return {
        version: LAYOUT_VERSION,
        canvas: {width:CANVAS_W,height:CANVAS_H},
        layers: layers,
        assets: validateAssets(raw.assets)
    };
}

function normalizeLayout(raw)
{
    if(!raw || typeof raw != "object" || Array.isArray(raw))
        throw new Error("Apple II layout must be a JSON object.");
    if(raw.version !== LAYOUT_VERSION && raw.version !== LEGACY_LAYOUT_VERSION)
        throw new Error("Unsupported Apple II layout version: " + raw.version + ".");
    if(!raw.canvas || raw.canvas.width !== CANVAS_W || raw.canvas.height !== CANVAS_H)
        throw new Error("Apple II layout canvas must be exactly 1144 x 1144.");
    if(!Array.isArray(raw.layers))
        throw new Error("Apple II layout layers must be an array.");

    return raw.version === LAYOUT_VERSION ? normalizeV2Layout(raw) : normalizeV1Layout(raw);
}

function validateLayout(raw)
{
    return normalizeLayout(raw);
}
`;

source = source.slice(0,start) + replacement + source.slice(end);

const exposure = '    this.validateLayout = validateLayout;';
if(!source.includes(exposure)) throw new Error('Could not locate LAYOUT validation API exposure.');
source = source.replace(
    exposure,
    exposure + '\n    this.normalizeLayout = normalizeLayout;\n    this.layoutAddress = layoutAddress;'
);

fs.writeFileSync(file,source);
console.log('Applied Composer v2 runtime normalization.');
