/*
 * COM_A2P_LAYOUT.js
 *
 * Runtime HTML compositor and control API for the emulator tab background.
 * It consumes Composer v2 layouts and normalizes legacy v1 layouts for compatibility.
 * Embedded PNG data URLs are used directly when present, with the legacy
 * asset directory retained as a compatibility fallback for non-embedded layouts.
 */
"use strict";

var root = typeof window != "undefined" ? window : null;

var LAYOUT_VERSION = 2;
var LEGACY_LAYOUT_VERSION = 1;
var CANVAS_W = 1144;
var CANVAS_H = 1144;
var DISPLAY_SIZE = 1300;
var ASSET_BASE = "tools/GUI_DEV/assets/";

function isFiniteNumber(v)
{
    return typeof v == "number" && Number.isFinite(v);
}

function validateShadow(raw,index)
{
    raw = raw || {};
    var out = {
        enabled: raw.enabled === undefined ? false : raw.enabled,
        offsetX: raw.offsetX === undefined ? 0 : raw.offsetX,
        offsetY: raw.offsetY === undefined ? 15 : raw.offsetY,
        blur: raw.blur === undefined ? 12 : raw.blur,
        opacity: raw.opacity === undefined ? 0.75 : raw.opacity
    };

    if(typeof out.enabled != "boolean")
        throw new Error("Layer " + (index+1) + " shadow enabled must be boolean.");
    if(!Number.isInteger(out.offsetX) || !Number.isInteger(out.offsetY))
        throw new Error("Layer " + (index+1) + " shadow offsets must be integer pixels.");
    if(!isFiniteNumber(out.blur) || out.blur < 0)
        throw new Error("Layer " + (index+1) + " shadow blur must be non-negative.");
    if(!isFiniteNumber(out.opacity) || out.opacity < 0 || out.opacity > 1)
        throw new Error("Layer " + (index+1) + " shadow opacity must be between 0 and 1.");

    return out;
}

function validateAssets(raw)
{
    if(raw === undefined) return {};
    if(!raw || typeof raw != "object" || Array.isArray(raw))
        throw new Error("Apple II layout assets must be an object.");

    var assets = {};
    Object.keys(raw).forEach(function(filename)
    {
        if(typeof raw[filename] != "string" || !raw[filename].trim())
            throw new Error("Embedded Apple II layout asset " + filename + " must be a non-empty data URL string.");
        assets[filename] = raw[filename];
    });
    return assets;
}

function validateLegacyLayerId(rawId,index)
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

function assetURL(filename,layout)
{
    if(layout && layout.assets && typeof layout.assets[filename] == "string" && layout.assets[filename])
        return layout.assets[filename];

    return ASSET_BASE + String(filename)
        .split("/")
        .map(function(part){ return encodeURIComponent(part); })
        .join("/");
}

function loadImage(rootWindow,filename,layout)
{
    return new Promise(function(resolve,reject)
    {
        var img = new rootWindow.Image();
        img.onload = function(){ resolve(img); };
        img.onerror = function(){ reject(new Error("Could not load Apple II layout asset: " + filename)); };
        img.src = assetURL(filename,layout);
    });
}

function loadAssets(rootWindow,layout)
{
    var files = [];
    var seen = Object.create(null);

    layout.layers.forEach(function(layer)
    {
        if(!layer.visible || seen[layer.file]) return;
        seen[layer.file] = true;
        files.push(layer.file);
    });

    return Promise.all(files.map(function(file)
    {
        return loadImage(rootWindow,file,layout).then(function(image){ return [file,image]; });
    })).then(function(entries){ return new Map(entries); });
}

function drawComposition(ctx,layout,images)
{
    ctx.clearRect(0,0,layout.canvas.width,layout.canvas.height);

    for(var i=layout.layers.length-1;i>=0;i--)
    {
        var layer = layout.layers[i];
        if(!layer.visible) continue;

        var image = images.get(layer.file);
        if(!image) throw new Error("Missing Apple II layout asset: " + layer.file);

        ctx.save();
        if(layer.shadow && layer.shadow.enabled)
        {
            ctx.shadowOffsetX = layer.shadow.offsetX;
            ctx.shadowOffsetY = layer.shadow.offsetY;
            ctx.shadowBlur = layer.shadow.blur;
            ctx.shadowColor = "rgba(0,0,0," + layer.shadow.opacity + ")";
        }
        ctx.drawImage(image,layer.x,layer.y);
        ctx.restore();
    }

    return ctx;
}

function forceWebKitRepaint(element)
{
    if(!element || !element.style) return;

    var doc = element.ownerDocument || null;
    var win = doc && doc.defaultView ? doc.defaultView : root;
    var host = doc && doc.getElementById ? doc.getElementById("a2p-system-layout") : null;
    var oldTransform = element.style.transform || "";
    var oldBackface = element.style.webkitBackfaceVisibility || "";
    var oldHostWillChange = host && host.style ? (host.style.willChange || "") : "";

    element.style.webkitBackfaceVisibility = "hidden";
    element.style.transform = oldTransform
        ? oldTransform + " translateZ(0)"
        : "translateZ(0)";

    if(host && host.style)
    {
        host.style.willChange = "transform";
        void host.offsetHeight;
    }

    void element.offsetHeight;

    var repaintBack = function()
    {
        element.style.transform = oldTransform;
        element.style.webkitBackfaceVisibility = oldBackface;

        if(host && host.style)
        {
            host.style.willChange = oldHostWillChange;
            void host.offsetHeight;
        }
    };

    if(win && typeof win.requestAnimationFrame == "function")
        win.requestAnimationFrame(function(){ win.requestAnimationFrame(repaintBack); });
    else
        setTimeout(repaintBack,0);
}

function applyLayerPresentation(entry,state)
{
    if(!entry) return false;
    state = !!state;
    if(entry.element && entry.element.style)
    {
        entry.element.style.display = "";
        entry.element.style.visibility = state ? "visible" : "hidden";
        entry.element.style.opacity = state ? "1" : "0";
        forceWebKitRepaint(entry.element);
    }
    return state;
}

function applyLayerVisibility(entry,state,presentedState)
{
    if(!entry) return false;
    state = !!state;
    entry.model.visible = state;
    applyLayerPresentation(entry,presentedState === undefined ? state : presentedState);
    return state;
}

function renderLayout(rootWindow,layout)
{
    var canvas = rootWindow.document.createElement("canvas");
    canvas.width = layout.canvas.width;
    canvas.height = layout.canvas.height;
    var ctx = canvas.getContext("2d");
    if(!ctx) return Promise.reject(new Error("2D canvas is not available."));

    return loadAssets(rootWindow,layout).then(function(images)
    {
        drawComposition(ctx,layout,images);
        return canvas;
    });
}

function buildDOMComposition(doc,layout,registry,aliasRegistry)
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
function LAYOUT(rootWindow)
{
    var self = this;
    var layersById = Object.create(null);
    var layersByAlias = Object.create(null);
    var pending = Object.create(null);
    var peripheralContext = null;

    this.root = rootWindow || root || null;
    this.lastLayout = null;
    this.lastCanvas = null;
    this.lastComposition = null;

    function attachToRoot(target)
    {
        if(!target) return;
        target.LAYOUT = LAYOUT;
        target.oLAYOUT = self;
        target.A2PSystemLayout = self;
        if(target.oCOM) target.oCOM.LAYOUT = self;
    }

    function resolveRoot(candidate)
    {
        return candidate || self.root || root || null;
    }

    function entryPresentationState(entry)
    {
        if(!entry || !entry.model) return false;
        if(!entry.model.visible) return false;
        if(!peripheralContext) return true;

        var labels = entry.labels || entry.model.labels || {};
        var pcode = String(labels.PCODE || "");

        // Layers without PCODE belong to the system composition (Apple II body,
        // monitor, and other slot-0 system imagery) and remain visible according
        // to their intrinsic topology state in every Peripheral-controls context.
        if(!pcode) return true;

        return peripheralContext.slotN !== null &&
            entry.slotN === peripheralContext.slotN &&
            pcode === peripheralContext.pcode;
    }

    function refreshEntryPresentation(entry)
    {
        return applyLayerPresentation(entry,entryPresentationState(entry));
    }

    function refreshPeripheralPresentation()
    {
        Object.keys(layersById).forEach(function(address)
        {
            refreshEntryPresentation(layersById[address]);
        });
    }

    function mountedDiskIISlotN(explicitSlotN)
    {
        var slotN = explicitSlotN;
        if(slotN === undefined || slotN === null)
        {
            var rootWindow = resolveRoot();
            var owner = rootWindow && rootWindow.oEMU && rootWindow.oEMU.component && rootWindow.oEMU.component.IO
                ? rootWindow.oEMU.component.IO.AppleDisk2
                : null;
            slotN = owner && owner.mount ? Number(owner.mount.slotN) : NaN;
        }
        slotN = Number(slotN);
        return Number.isInteger(slotN) && slotN >= 0 && slotN <= 8 ? slotN : null;
    }

    function setDiskLayer(id,state,slotN)
    {
        slotN = mountedDiskIISlotN(slotN);
        if(slotN === null) return false;
        return self.visibleAt(slotN,id,state);
    }

    this.A2P = {
        DISKII: {
            GAP: function(on,slotN){ return setDiskLayer("DISKII.GAP",on,slotN); },
            D1: {
                BODY: function(on,slotN){ return setDiskLayer("DISKII.D1.BODY",on,slotN); },
                LED: function(on,slotN){ return setDiskLayer("DISKII.D1.LED",on,slotN); },
                LID: function(open,slotN){ return setDiskLayer("DISKII.D1.LID",open,slotN); }
            },
            D2: {
                BODY: function(on,slotN){ return setDiskLayer("DISKII.D2.BODY",on,slotN); },
                LED: function(on,slotN){ return setDiskLayer("DISKII.D2.LED",on,slotN); },
                LID: function(open,slotN){ return setDiskLayer("DISKII.D2.LID",open,slotN); }
            }
        }
    };

    this.validateLayout = validateLayout;
    this.normalizeLayout = normalizeLayout;
    this.layoutAddress = layoutAddress;
    this.address = function(slotN,id)
    {
        return layoutAddress(validateSlotN(slotN,0),validateSemanticId(id,0));
    };
    this.assetURL = assetURL;
    this.drawComposition = drawComposition;
    this.renderLayout = renderLayout;
    this.buildDOMComposition = buildDOMComposition;

    this.loadLayout = function(rootWindow)
    {
        rootWindow = resolveRoot(rootWindow);
        return Promise.resolve().then(function()
        {
            if(!rootWindow || !rootWindow.composer)
                throw new Error("Apple II layout data is not available on window.composer.");
            return validateLayout(rootWindow.composer);
        });
    };

    function resolveLayerEntry(id)
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

        return applyLayerVisibility(entry,state,entryPresentationState(entry));
    };

    this.visibleAt = function(slotN,id,state)
    {
        return self.visible(self.address(slotN,id),state);
    };

    this.setPeripheralContext = function(slotN,pcode)
    {
        slotN = Number(slotN);
        pcode = String(pcode || "").trim().toUpperCase();

        // Missing/host/unsupported context intentionally means system-only.
        // A valid context with no matching PCODE layers naturally has the same
        // presentation while remaining ready for future Composer artwork.
        peripheralContext = {
            slotN: Number.isInteger(slotN) && slotN >= 0 && slotN <= 8 ? slotN : null,
            pcode: pcode
        };
        refreshPeripheralPresentation();
        return true;
    };

    this.getPeripheralContext = function()
    {
        return peripheralContext ? {slotN:peripheralContext.slotN,pcode:peripheralContext.pcode} : null;
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
    this.visibleByFile = function(filename,state)
    {
        filename = String(filename || "");
        if(!filename) return false;

        state = !!state;
        var changed = false;

        if(self.lastLayout && Array.isArray(self.lastLayout.layers))
        {
            self.lastLayout.layers.forEach(function(layer)
            {
                if(layer && layer.file == filename)
                {
                    self.visible(layer.address || layoutAddress(layer.slotN,layer.id),state);
                    changed = true;
                }
            });
        }

        return changed;
    };

    this.install = function(rootWindow)
    {
        rootWindow = resolveRoot(rootWindow);
        if(!rootWindow || !rootWindow.document) return Promise.resolve(false);
        self.root = rootWindow;
        attachToRoot(rootWindow);

        var doc = rootWindow.document;
        var tab = doc.getElementById("tab1");
        var app = doc.getElementById("app");
        if(!tab) return Promise.resolve(false);

        return self.loadLayout(rootWindow)
            .then(function(layout)
            {
                var oldHost = doc.getElementById("a2p-system-layout");
                if(oldHost && oldHost.parentNode) oldHost.parentNode.removeChild(oldHost);

                var registry = Object.create(null);
                var aliasRegistry = Object.create(null);
                var host = buildDOMComposition(doc,layout,registry,aliasRegistry);

                /*
                 * Keep the composed hardware as a true background layer.  The
                 * tab itself forms a stacking context so the negative layout
                 * z-index remains visible behind the emulator canvas and UI.
                 */
                tab.style.position = "relative";
                tab.style.zIndex = "0";
                tab.style.backgroundImage = "none";
                tab.style.backgroundSize = "none";
                tab.style.backgroundRepeat = "no-repeat";

                /*
                 * #app contains the floated top tab selector.  Its parent has
                 * no normal-flow height, so #tab1 begins underneath it.  Lift
                 * that tab chrome above the emulator stacking context without
                 * changing the established layout coordinates.
                 */
                if(app)
                {
                    app.style.position = "relative";
                    app.style.zIndex = "1";
                }

                if(typeof tab.insertBefore == "function")
                    tab.insertBefore(host,tab.firstChild || null);
                else
                    tab.appendChild(host);

                layersById = registry;
                layersByAlias = aliasRegistry;
                Object.keys(pending).forEach(function(id)
                {
                    var entry = resolveLayerEntry(id);
                    if(entry)
                    {
                        applyLayerVisibility(entry,pending[id],entryPresentationState(entry));
                        delete pending[id];
                    }
                });

                // setPeripheralContext() may have been called before installation.
                // Reapply presentation after the registry exists without changing
                // any intrinsic attachment/topology visibility state.
                if(peripheralContext) refreshPeripheralPresentation();

                self.lastLayout = layout;
                self.lastComposition = host;
                self.lastCanvas = null;
                return true;
            })
            .catch(function(err)
            {
                if(rootWindow.console && typeof rootWindow.console.error == "function")
                    rootWindow.console.error("Apple II HTML system composition failed.",err);
                return false;
            });
    };

    this.autoInstall = function(rootWindow)
    {
        rootWindow = resolveRoot(rootWindow);
        if(!rootWindow || !rootWindow.document) return;
        self.root = rootWindow;
        attachToRoot(rootWindow);

        if(rootWindow.document.readyState == "complete")
            self.install(rootWindow);
        else
            rootWindow.addEventListener("load",function(){ self.install(rootWindow); },{once:true});
    };

    attachToRoot(this.root);
}

function installDeviceAttachmentPolicies(rootWindow)
{
    rootWindow = rootWindow || root;
    if(!rootWindow || rootWindow.__A2PDeviceAttachmentPoliciesInstalled) return false;
    rootWindow.__A2PDeviceAttachmentPoliciesInstalled = true;

    function deviceCode(info)
    {
        return String(info && (info.DCODE || info.coID) || "").toUpperCase();
    }

    function patchDiskIIDeviceConfig(owner)
    {
        if(!owner || !owner.id || owner.id.PCODE != "DISKII" || !Array.isArray(owner.deviceConfig))
            return false;

        var changed = false;
        owner.deviceConfig.forEach(function(info)
        {
            var code = deviceCode(info);
            if(code != "D1" && code != "D2") return;

            if(info.maxInstances === undefined)
            {
                info.maxInstances = 1;
                changed = true;
            }

            if(!info.layout)
            {
                var slotN = owner.mount ? Number(owner.mount.slotN) : NaN;
                if(!Number.isInteger(slotN) || slotN < 0 || slotN > 8) return;

                var bodyId = "DISKII." + code + ".BODY";
                var prefix = "DISKII." + code + ".";

                info.layout = {
                    attached: [
                        {slotN: slotN, id: bodyId, visible: true},
                        {slotN: slotN, id: prefix + "LED", visible: false},
                        {slotN: slotN, id: prefix + "LID", visible: false}
                    ],
                    detached: [
                        {slotN: slotN, id: bodyId, visible: false},
                        {slotN: slotN, id: prefix + "LED", visible: false},
                        {slotN: slotN, id: prefix + "LID", visible: false}
                    ]
                };
                changed = true;
            }
        });

        var gapSlotN = owner.mount ? Number(owner.mount.slotN) : NaN;
        var gapRule = {
            id: "DISKII.GAP.BOTH_DRIVES",
            when: {allAttached: ["D1","D2"]},
            attached: Number.isInteger(gapSlotN) && gapSlotN >= 0 && gapSlotN <= 8 ? [
                {slotN: gapSlotN, id: "DISKII.GAP", visible: true}
            ] : [],
            detached: Number.isInteger(gapSlotN) && gapSlotN >= 0 && gapSlotN <= 8 ? [
                {slotN: gapSlotN, id: "DISKII.GAP", visible: false}
            ] : []
        };

        if(!Array.isArray(owner.layoutRules))
        {
            owner.layoutRules = [gapRule];
            changed = true;
        }
        else
        {
            var replacedGapRule = false;
            for(var r=0;r<owner.layoutRules.length;r++)
            {
                if(owner.layoutRules[r] && owner.layoutRules[r].id == gapRule.id)
                {
                    owner.layoutRules[r] = gapRule;
                    replacedGapRule = true;
                    changed = true;
                    break;
                }
            }
            if(!replacedGapRule)
            {
                owner.layoutRules.push(gapRule);
                changed = true;
            }
        }

        return changed;
    }

    function patchKnownDeviceConfigs(io)
    {
        if(rootWindow.oEMU && rootWindow.oEMU.component && rootWindow.oEMU.component.IO)
            patchDiskIIDeviceConfig(rootWindow.oEMU.component.IO.AppleDisk2);

        if(io && Array.isArray(io.slots))
        {
            for(var slotN=0;slotN<io.slots.length;slotN++)
            {
                var owner = typeof io.SLOT2obj == "function" ? io.SLOT2obj(slotN) : null;
                patchDiskIIDeviceConfig(owner);
            }
        }
    }

    function attachedCount(owner,code)
    {
        code = String(code || "").toUpperCase();
        if(!owner || !code || !Array.isArray(owner.devices)) return 0;

        var count = 0;
        for(var i=0;i<owner.devices.length;i++)
        {
            var id = owner.devices[i] && owner.devices[i].id;
            if(String(id && id.DCODE || "").toUpperCase() == code) count++;
        }
        return count;
    }

    function maxInstances(info)
    {
        if(!info || info.maxInstances === undefined || info.maxInstances === null || info.maxInstances === "")
            return Infinity;
        var max = Number(info.maxInstances);
        return Number.isFinite(max) && max >= 0 ? Math.floor(max) : Infinity;
    }

    function infoForDevice(owner,code)
    {
        code = String(code || "").toUpperCase();
        var cfg = owner && Array.isArray(owner.deviceConfig) ? owner.deviceConfig : [];
        for(var i=0;i<cfg.length;i++)
            if(deviceCode(cfg[i]) == code) return cfg[i];
        return null;
    }

    function canAttach(owner,info)
    {
        var max = maxInstances(info);
        if(max === Infinity) return true;
        return attachedCount(owner,deviceCode(info)) < max;
    }

    function limitMessage(owner,info)
    {
        var code = deviceCode(info) || "device";
        var max = maxInstances(info);
        var count = attachedCount(owner,code);
        if(max === Infinity) return "";
        return "Could not attach device " + code + ": maximum " + max +
            " instance" + (max == 1 ? "" : "s") + " already attached (" + count + ").";
    }

    function layoutTargets(layout,mode)
    {
        if(!layout || typeof layout != "object") return [];
        var raw = layout[mode];
        if(raw === undefined && mode == "attached") raw = layout.visible;
        if(raw === undefined && mode == "detached") raw = layout.hidden;
        if(raw === undefined || raw === null) return [];
        return Array.isArray(raw) ? raw : [raw];
    }

    function setLayoutTarget(target,defaultState)
    {
        if(target === undefined || target === null) return false;
        if(typeof target == "string") target = {id:target};
        if(typeof target != "object") return false;

        var state = target.visible === undefined ? !!defaultState : !!target.visible;
        var layout = rootWindow.oLAYOUT || (rootWindow.oCOM && rootWindow.oCOM.LAYOUT);
        var changed = false;

        if(target.id && layout)
        {
            if(target.slotN !== undefined && target.slotN !== null && typeof layout.visibleAt == "function")
                changed = layout.visibleAt(Number(target.slotN),target.id,state) || changed;
            else if(typeof layout.visible == "function")
                changed = layout.visible(target.id,state) || changed;
        }

        if(target.file && layout && typeof layout.visibleByFile == "function")
            changed = layout.visibleByFile(target.file,state) || changed;

        return changed;
    }

    function applyDeviceLayout(owner,info,attached)
    {
        info = info || null;
        if(!info || !info.layout) return false;

        var mode = attached ? "attached" : "detached";
        var targets = layoutTargets(info.layout,mode);
        var changed = false;

        for(var i=0;i<targets.length;i++)
            changed = setLayoutTarget(targets[i],attached) || changed;

        return changed;
    }

    function syncDeviceLayout(io,owner)
    {
        if(!owner) return false;
        patchKnownDeviceConfigs(io);

        var changed = false;
        var cfg = Array.isArray(owner.deviceConfig) ? owner.deviceConfig : [];

        for(var i=0;i<cfg.length;i++)
        {
            var info = cfg[i];
            var count = attachedCount(owner,deviceCode(info));
            changed = applyDeviceLayout(owner,info,count>0) || changed;
        }

        var rules = Array.isArray(owner.layoutRules) ? owner.layoutRules : [];
        for(var r=0;r<rules.length;r++)
        {
            var rule = rules[r];
            var when = rule && rule.when ? rule.when : {};
            var active = true;

            if(Array.isArray(when.allAttached))
            {
                for(var a=0;a<when.allAttached.length;a++)
                {
                    if(attachedCount(owner,when.allAttached[a]) <= 0)
                    {
                        active = false;
                        break;
                    }
                }
            }

            if(active && Array.isArray(when.anyAttached))
            {
                var any = false;
                for(var b=0;b<when.anyAttached.length;b++)
                {
                    if(attachedCount(owner,when.anyAttached[b]) > 0)
                    {
                        any = true;
                        break;
                    }
                }
                active = any;
            }

            if(active && Array.isArray(when.noneAttached))
            {
                for(var n=0;n<when.noneAttached.length;n++)
                {
                    if(attachedCount(owner,when.noneAttached[n]) > 0)
                    {
                        active = false;
                        break;
                    }
                }
            }

            var ruleTargets = layoutTargets(rule,active ? "attached" : "detached");
            for(var t=0;t<ruleTargets.length;t++)
                changed = setLayoutTarget(ruleTargets[t],active) || changed;
        }

        return changed;
    }

    function syncAllDeviceLayouts(io)
    {
        if(!io || !Array.isArray(io.slots)) return false;
        var changed = false;
        for(var slotN=0;slotN<io.slots.length;slotN++)
        {
            var owner = typeof io.SLOT2obj == "function" ? io.SLOT2obj(slotN) : null;
            changed = syncDeviceLayout(io,owner) || changed;
        }
        return changed;
    }

    function decorateDevicePicker(io,slotN)
    {
        if(!rootWindow.document) return false;
        var owner = io && typeof io.SLOT2obj == "function" ? io.SLOT2obj(Number(slotN)) : null;
        if(!owner) return false;

        patchKnownDeviceConfigs(io);
        var popup = rootWindow.document.getElementById("deviceConfig_popup");
        if(!popup || typeof popup.querySelectorAll != "function") return false;

        var buttons = popup.querySelectorAll(".device-picker-entry");
        var changed = false;
        for(var i=0;i<buttons.length;i++)
        {
            var button = buttons[i];
            var onclick = button.getAttribute("onclick") || "";
            var match = /devicePicker_select\(\s*\d+\s*,\s*'([^']+)'\s*\)/.exec(onclick);
            if(!match) continue;

            var info = infoForDevice(owner,match[1]);
            if(!info || canAttach(owner,info)) continue;

            var code = deviceCode(info);
            var count = attachedCount(owner,code);
            var max = maxInstances(info);
            button.disabled = true;
            button.setAttribute("aria-disabled","true");
            button.classList.add("greyed");
            button.removeAttribute("onclick");
            button.style.cursor = "default";
            button.title = (info.description || code) + " — maximum attached";

            var spans = button.getElementsByTagName("span");
            if(spans.length)
                spans[spans.length-1].textContent = "Attached: " + count + "/" + max;
            changed = true;
        }
        return changed;
    }

    function installOnIO(io)
    {
        if(!io || io.__A2PDeviceAttachmentPoliciesInstalled) return false;
        io.__A2PDeviceAttachmentPoliciesInstalled = true;

        patchKnownDeviceConfigs(io);

        io.deviceAttachedCount = function(owner,DCODE)
        {
            return attachedCount(owner,DCODE);
        };

        io.deviceMaxInstances = function(info)
        {
            return maxInstances(info);
        };

        io.deviceCanAttach = function(owner,info)
        {
            return canAttach(owner,info);
        };

        io.deviceAttachmentLimitMessage = function(owner,info)
        {
            return limitMessage(owner,info);
        };

        io.syncDeviceLayout = function(owner)
        {
            return syncDeviceLayout(io,owner);
        };

        io.syncAllDeviceLayouts = function()
        {
            return syncAllDeviceLayouts(io);
        };

        if(typeof io.devicePicker_popup == "function")
        {
            var nativePickerPopup = io.devicePicker_popup;
            io.devicePicker_popup = function(slotN)
            {
                patchKnownDeviceConfigs(this);
                var result = nativePickerPopup.apply(this,arguments);
                decorateDevicePicker(this,slotN);
                return result;
            };
        }

        if(typeof io.devicePicker_select == "function")
        {
            var nativePickerSelect = io.devicePicker_select;
            io.devicePicker_select = function(slotN,DCODE)
            {
                patchKnownDeviceConfigs(this);
                var owner = typeof this.SLOT2obj == "function" ? this.SLOT2obj(Number(slotN)) : null;
                var info = infoForDevice(owner,DCODE);
                if(info && !canAttach(owner,info))
                {
                    if(typeof this.devicePicker_message == "function")
                        this.devicePicker_message(limitMessage(owner,info));
                    decorateDevicePicker(this,slotN);
                    return false;
                }
                return nativePickerSelect.apply(this,arguments);
            };
        }

        if(typeof io.attach == "function")
        {
            var nativeAttach = io.attach;
            io.attach = function(owner,deviceInfo,options)
            {
                var device = nativeAttach.apply(this,arguments);
                if(device) syncDeviceLayout(this,owner);
                return device;
            };
        }

        if(typeof io.detach == "function")
        {
            var nativeDetach = io.detach;
            io.detach = function(owner,DCODE,instanceHash)
            {
                var removed = nativeDetach.apply(this,arguments);
                if(removed) syncDeviceLayout(this,owner);
                return removed;
            };
        }

        syncAllDeviceLayouts(io);
        return true;
    }

    function resolveIO()
    {
        try
        {
            if(rootWindow.apple2plus && typeof rootWindow.apple2plus.hwObj == "function")
            {
                var hw = rootWindow.apple2plus.hwObj();
                if(hw && hw.io) return hw.io;
            }
        }
        catch(e) {}
        return null;
    }

    function tryInstall()
    {
        var io = resolveIO();
        if(!io) return false;
        return installOnIO(io);
    }

    var attempts = 0;
    var timer = null;
    function poll()
    {
        attempts++;
        if(tryInstall() || attempts > 200)
        {
            if(timer) rootWindow.clearInterval(timer);
            timer = null;
        }
    }

    if(!tryInstall() && typeof rootWindow.setInterval == "function")
        timer = rootWindow.setInterval(poll,50);

    if(rootWindow.addEventListener)
        rootWindow.addEventListener("load",function(){ poll(); },{once:true});

    return true;
}

var oLAYOUT = new LAYOUT(root);
oLAYOUT.LAYOUT = LAYOUT;
oLAYOUT.ASSET_BASE = ASSET_BASE;

if(typeof module == "object" && module.exports)
    module.exports = oLAYOUT;

if(root)
{
    root.LAYOUT = LAYOUT;
    root.oLAYOUT = oLAYOUT;
    root.A2PSystemLayout = oLAYOUT; /* compatibility alias */
    if(root.oCOM) root.oCOM.LAYOUT = oLAYOUT;
    oLAYOUT.autoInstall(root);
    installDeviceAttachmentPolicies(root);
}