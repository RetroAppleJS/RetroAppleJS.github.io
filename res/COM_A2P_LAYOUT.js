/*
 * COM_A2P_LAYOUT.js
 *
 * Runtime HTML compositor and control API for the emulator tab background.
 * It consumes the version-1 layout object embedded in EMU_apple2main.js.
 * Embedded PNG data URLs are used directly when present, with the legacy
 * asset directory retained as a compatibility fallback for non-embedded layouts.
 */
"use strict";

var root = typeof window != "undefined" ? window : null;

var LAYOUT_VERSION = 1;
var CANVAS_W = 1144;
var CANVAS_H = 1144;
var DISPLAY_SIZE = 1300;
var ASSET_BASE = "tools/GUI_DEV/assets/";
var LEGACY_DRIVE_VISUAL_IDS = ["dskLED_D1","dskLED_D2","dskLID_D1","dskLID_D2"];

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

function legacyDiskIILayerId(layer)
{
    if(!layer || typeof layer.file != "string") return null;

    if(layer.file == "A2P_FULL_DISKII_LED.png")
        return layer.x < 300 ? "A2P.DISKII.D1.LED" : "A2P.DISKII.D2.LED";

    if(layer.file == "A2P_FULL_DISKII_LID.png")
        return layer.x < 400 ? "A2P.DISKII.D1.LID" : "A2P.DISKII.D2.LID";

    return null;
}

function validateLayerId(rawId,index)
{
    if(rawId === undefined || rawId === null || rawId === "") return null;
    if(typeof rawId != "string" || !rawId.trim())
        throw new Error("Layer " + (index+1) + " id must be a non-empty string when supplied.");
    return rawId.trim();
}

function validateLayout(raw)
{
    if(!raw || typeof raw != "object" || Array.isArray(raw))
        throw new Error("Apple II layout must be a JSON object.");
    if(raw.version !== LAYOUT_VERSION)
        throw new Error("Unsupported Apple II layout version; expected version " + LAYOUT_VERSION + ".");
    if(!raw.canvas || raw.canvas.width !== CANVAS_W || raw.canvas.height !== CANVAS_H)
        throw new Error("Apple II layout canvas must be exactly 1144 x 1144.");
    if(!Array.isArray(raw.layers))
        throw new Error("Apple II layout layers must be an array.");

    var seenIds = Object.create(null);
    var layers = raw.layers.map(function(layer,index)
    {
        if(!layer || typeof layer != "object" || Array.isArray(layer))
            throw new Error("Layer " + (index+1) + " is malformed.");
        if(typeof layer.file != "string" || !layer.file.trim())
            throw new Error("Layer " + (index+1) + " filename must be non-empty.");
        if(!Number.isInteger(layer.x) || !Number.isInteger(layer.y))
            throw new Error("Layer " + (index+1) + " X/Y coordinates must be integer pixels.");
        if(typeof layer.visible != "boolean")
            throw new Error("Layer " + (index+1) + " visibility must be boolean.");

        var id = validateLayerId(layer.id,index) || legacyDiskIILayerId(layer);
        if(id)
        {
            if(seenIds[id]) throw new Error("Duplicate Apple II layout layer id: " + id);
            seenIds[id] = true;
        }

        return {
            id: id,
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

function applyLayerVisibility(entry,state)
{
    if(!entry) return false;
    state = !!state;
    entry.model.visible = state;
    if(entry.element && entry.element.style)
        entry.element.style.display = state ? "" : "none";
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

function buildDOMComposition(doc,layout,registry)
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
        img.src = assetURL(layer.file,layout);
        img.alt = "";
        img.draggable = false;
        img.dataset.layerIndex = String(i);
        img.dataset.file = layer.file;
        if(layer.id) img.dataset.layerId = layer.id;
        img.style.position = "absolute";
        img.style.left = layer.x + "px";
        img.style.top = layer.y + "px";
        img.style.maxWidth = "none";
        img.style.userSelect = "none";
        img.style.pointerEvents = "none";
        img.style.filter = "none";
        img.style.display = layer.visible ? "" : "none";

        if(layer.shadow && layer.shadow.enabled)
            img.style.filter = "drop-shadow("
                + layer.shadow.offsetX + "px "
                + layer.shadow.offsetY + "px "
                + layer.shadow.blur + "px rgba(0,0,0,"
                + layer.shadow.opacity + "))";

        host.appendChild(img);

        if(layer.id && registry)
            registry[layer.id] = {id:layer.id,model:layer,element:img};
    }

    return host;
}

function disableLegacyDriveVisuals(doc)
{
    LEGACY_DRIVE_VISUAL_IDS.forEach(function(id)
    {
        var el = doc.getElementById(id);
        if(el) el.style.display = "none";
    });
}

function LAYOUT(rootWindow)
{
    var self = this;
    var layersById = Object.create(null);
    var pending = Object.create(null);

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

    function setDiskLayer(id,state)
    {
        return self.visible(id,state);
    }

    this.A2P = {
        DISKII: {
            D1: {
                LED: function(on){ return setDiskLayer("A2P.DISKII.D1.LED",on); },
                LID: function(open){ return setDiskLayer("A2P.DISKII.D1.LID",open); }
            },
            D2: {
                LED: function(on){ return setDiskLayer("A2P.DISKII.D2.LED",on); },
                LID: function(open){ return setDiskLayer("A2P.DISKII.D2.LID",open); }
            }
        }
    };

    this.validateLayout = validateLayout;
    this.assetURL = assetURL;
    this.drawComposition = drawComposition;
    this.renderLayout = renderLayout;
    this.buildDOMComposition = buildDOMComposition;
    this.disableLegacyDriveVisuals = disableLegacyDriveVisuals;

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

    this.getLayer = function(id)
    {
        return layersById[id] || null;
    };

    this.visible = function(id,state)
    {
        if(state === undefined)
        {
            if(layersById[id]) return layersById[id].model.visible;
            if(Object.prototype.hasOwnProperty.call(pending,id)) return pending[id];
            return undefined;
        }

        state = !!state;
        if(!layersById[id])
        {
            pending[id] = state;
            return state;
        }

        return applyLayerVisibility(layersById[id],state);
    };

    this.setVisible = this.visible;

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
                var host = buildDOMComposition(doc,layout,registry);

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

                /* Embedded layout data owns the static drive visuals. */
                disableLegacyDriveVisuals(doc);

                layersById = registry;
                Object.keys(pending).forEach(function(id)
                {
                    if(layersById[id])
                    {
                        applyLayerVisibility(layersById[id],pending[id]);
                        delete pending[id];
                    }
                });

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
}
