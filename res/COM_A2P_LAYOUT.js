/*
 * COM_A2P_LAYOUT.js
 *
 * Experimental runtime compositor for the emulator tab background.
 * It consumes the same version-1 layout JSON written by
 * tools/GUI_DEV/apple2-system-composer.html and replaces the legacy static
 * #tab1 background only after the complete composition has rendered.
 */
(function(root,factory)
{
    var api = factory();

    if(typeof module == "object" && module.exports)
        module.exports = api;

    if(root)
    {
        root.A2PSystemLayout = api;
        api.autoInstall(root);
    }
})(typeof window != "undefined" ? window : null,function()
{
    "use strict";

    var LAYOUT_VERSION = 1;
    var CANVAS_W = 1144;
    var CANVAS_H = 1144;
    var DISPLAY_SIZE = 1300;
    var LAYOUT_URL = "tools/GUI_DEV/assets/apple2-layout-6.json";
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

            return {
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
            layers: layers
        };
    }

    function assetURL(filename)
    {
        return ASSET_BASE + String(filename)
            .split("/")
            .map(function(part){ return encodeURIComponent(part); })
            .join("/");
    }

    function loadImage(rootWindow,filename)
    {
        return new Promise(function(resolve,reject)
        {
            var img = new rootWindow.Image();
            img.onload = function(){ resolve(img); };
            img.onerror = function(){ reject(new Error("Could not load Apple II layout asset: " + filename)); };
            img.src = assetURL(filename);
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
            return loadImage(rootWindow,file).then(function(image){ return [file,image]; });
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

    function loadLayout(rootWindow)
    {
        return rootWindow.fetch(LAYOUT_URL,{cache:"no-store"}).then(function(response)
        {
            if(!response.ok)
                throw new Error("Could not load " + LAYOUT_URL + " (HTTP " + response.status + ").");
            return response.json();
        }).then(validateLayout);
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

    function disableLegacyDriveVisuals(doc)
    {
        LEGACY_DRIVE_VISUAL_IDS.forEach(function(id)
        {
            var el = doc.getElementById(id);
            if(el) el.style.display = "none";
        });
    }

    function install(rootWindow)
    {
        var doc = rootWindow.document;
        var tab = doc.getElementById("tab1");
        if(!tab) return Promise.resolve(false);

        return loadLayout(rootWindow)
            .then(function(layout)
            {
                return renderLayout(rootWindow,layout).then(function(canvas)
                {
                    var dataURL = canvas.toDataURL("image/png");

                    /*
                     * Keep #tab1 itself as the coordinate system used by the
                     * existing emulator.  Only replace its background bitmap.
                     */
                    tab.style.backgroundImage = 'url("' + dataURL + '")';
                    tab.style.backgroundSize = DISPLAY_SIZE + "px " + DISPLAY_SIZE + "px";
                    tab.style.backgroundRepeat = "no-repeat";
                    tab.style.backgroundPosition = "0 0";
                    tab.style.imageRendering = "pixelated";

                    /*
                     * The JSON already contains the two static LED and lid
                     * layers.  Hide the legacy state-driven DOM overlays for
                     * this visual-only experiment; no drive integration yet.
                     */
                    disableLegacyDriveVisuals(doc);

                    api.lastLayout = layout;
                    api.lastCanvas = canvas;
                    return true;
                });
            })
            .catch(function(err)
            {
                /* Keep the base64 CSS background as a safe fallback. */
                if(rootWindow.console && typeof rootWindow.console.error == "function")
                    rootWindow.console.error("Apple II system composition failed; using legacy background.",err);
                return false;
            });
    }

    function autoInstall(rootWindow)
    {
        if(!rootWindow || !rootWindow.document) return;

        if(rootWindow.document.readyState == "complete")
            install(rootWindow);
        else
            rootWindow.addEventListener("load",function(){ install(rootWindow); },{once:true});
    }

    var api = {
        LAYOUT_URL: LAYOUT_URL,
        ASSET_BASE: ASSET_BASE,
        validateLayout: validateLayout,
        assetURL: assetURL,
        drawComposition: drawComposition,
        loadLayout: loadLayout,
        renderLayout: renderLayout,
        install: install,
        autoInstall: autoInstall,
        disableLegacyDriveVisuals: disableLegacyDriveVisuals,
        lastLayout: null,
        lastCanvas: null
    };

    return api;
});
