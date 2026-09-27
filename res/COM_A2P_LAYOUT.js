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

        var id = validateLayerId(layer.id,index);
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
                    layer.visible = state;
                    changed = true;
                }
            });
        }

        if(self.lastComposition && typeof self.lastComposition.querySelectorAll == "function")
        {
            var nodes = self.lastComposition.querySelectorAll("img[data-file]");
            for(var i=0;i<nodes.length;i++)
            {
                if(nodes[i].dataset && nodes[i].dataset.file == filename)
                {
                    nodes[i].style.display = state ? "" : "none";
                    changed = true;
                }
            }
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
                var isD1 = code == "D1";
                var bodyFile = isD1
                    ? "A2P_FULL_DISKII_left.png"
                    : "A2P_FULL_DISKII_right.png";
                var prefix = "A2P.DISKII." + code + ".";

                info.layout = {
                    attached: [
                        {file: bodyFile, visible: true},
                        {id: prefix + "LED", visible: false},
                        {id: prefix + "LID", visible: false}
                    ],
                    detached: [
                        {file: bodyFile, visible: false},
                        {id: prefix + "LED", visible: false},
                        {id: prefix + "LID", visible: false}
                    ]
                };
                changed = true;
            }
        });

        if(!Array.isArray(owner.layoutRules))
        {
            owner.layoutRules = [
                {
                    when: { allAttached: ["D1","D2"] },
                    attached: [
                        { file: "A2P_FULL_DISKII_gap.png", visible: true }
                    ],
                    detached: [
                        { file: "A2P_FULL_DISKII_gap.png", visible: false }
                    ]
                }
            ];
            changed = true;
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

        if(target.id && layout && typeof layout.visible == "function")
            changed = layout.visible(target.id,state) || changed;

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

    function hasAttached(owner,code)
    {
        return attachedCount(owner,code) > 0;
    }

    function ruleMatches(owner,rule)
    {
        var when = rule && rule.when ? rule.when : {};

        if(Array.isArray(when.allAttached))
        {
            for(var i=0;i<when.allAttached.length;i++)
                if(!hasAttached(owner,when.allAttached[i])) return false;
        }

        if(Array.isArray(when.anyAttached))
        {
            var any = false;
            for(var j=0;j<when.anyAttached.length;j++)
            {
                if(hasAttached(owner,when.anyAttached[j]))
                {
                    any = true;
                    break;
                }
            }
            if(!any) return false;
        }

        if(Array.isArray(when.noneAttached))
        {
            for(var k=0;k<when.noneAttached.length;k++)
                if(hasAttached(owner,when.noneAttached[k])) return false;
        }

        return true;
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

        changed = applyOwnerLayoutRules(owner) || changed;
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
