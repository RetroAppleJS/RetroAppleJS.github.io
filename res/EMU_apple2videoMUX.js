var oApple2Video = null;

function Apple2VideoMUX(canvas)
{
    const DISPLAY_W = 560;
    const DISPLAY_H = 384;

    var mux = this;

    this.id = "MUX";
    this.baseCanvas = canvas || null;
    this.canvas = canvas || null;
    this.ctx = canvas || null;

    this.vidram = null;
    this.hw = null;

    this.state = {
        gfx: false,
        mix: false,
        page2: false,
        hires: false,
        chrome: 0
    };

    this.renderModes = [
        { name: "gpu",     ctor: Apple2VideoGPU,    context: "canvas" },
        { name: "wave",    ctor: Apple2VideoWave,   context: "canvas" },
        { name: "threejs", ctor: Apple2VideoTHREE,  context: "canvas" },
        { name: "canvas",   ctor: Apple2VideoCanvas, context: "2d"     }
    ];

    this.getRenderModes = function()
    {
        return this.renderModes.slice();
    };

    this.getRenderModeSpec = function(mode)
    {
        if(typeof(mode) == "number")
            return this.renderModes[mode] || null;

        if(mode && typeof(mode) == "object" && mode.name)
            return mode;

        var name = String(mode || "").trim().toLowerCase();
        for(var i=0;i<this.renderModes.length;i++)
        {
            if(String(this.renderModes[i].name).toLowerCase() == name)
                return this.renderModes[i];
        }

        return null;
    };

    this.getRenderModeIndexByName = function(modeName)
    {
        var name = String(modeName || "").trim().toLowerCase();
        if(!name) return 0;

        for(var i=0; i<this.renderModes.length; i++)
        {
            if(String(this.renderModes[i].name).toLowerCase() == name)
                return i;
        }

        console.warn("Unknown video display mode '" + modeName + "'; using " + this.renderModes[0].name);
        return 0;
    };

    var defaultMode =
        (typeof(_o) != "undefined" && typeof(_o.EMU_vid_mode) != "undefined")
        ? _o.EMU_vid_mode
        : "";

    this.modeIndex = this.getRenderModeIndexByName(defaultMode);
    this.active = null;
    this.activeName = this.renderModes[this.modeIndex].name;

    this.renderers = {};
    this.canvases = {};
    this.devices = [];

    this.initGPU = function()
    {
        return true;
    };

    this.setCanvas = function(canvas)
    {
        this.baseCanvas = canvas;
        this.canvas = canvas;
    };

    this.getBaseCanvas = function()
    {
        if(this.baseCanvas) return this.baseCanvas;
        this.baseCanvas = document.getElementById("applescreen");
        return this.baseCanvas;
    };

    this.getCanvasFor = function(spec)
    {
        if(this.canvases[spec.name])
            return this.canvases[spec.name];

        var base = this.getBaseCanvas();
        var c;

        if(spec.name == this.renderModes[0].name && base)
            c = base;
        else if(base)
            c = base.cloneNode(false);
        else
            c = document.createElement("canvas");

        c.id = "applescreen";
        c.width = DISPLAY_W;
        c.height = DISPLAY_H;

        if(c.style)
        {
            c.style.display = "block";
            c.style.outline = "none";
        }

        this.canvases[spec.name] = c;
        return c;
    };

    this.registerRenderer = function(spec)
    {
        if(!spec) return null;

        var renderer = this.renderers[spec.name];
        if(renderer) return renderer;

        var canvas = this.getCanvasFor(spec);
        var context = spec.context == "2d" ? canvas.getContext("2d") : canvas;
        renderer = new spec.ctor(context);

        if(!renderer || !renderer.id || !renderer.id.DCODE)
        {
            console.warn("Video renderer '"+spec.name+"' has no device identity");
            return null;
        }

        renderer.id.mode = spec.name;
        renderer.vidram = this.vidram;
        renderer.hw = this.hw;

        this.renderers[spec.name] = renderer;
        this.devices.push(renderer);
        return renderer;
    };

    this.registerDevices = function()
    {
        for(var i=0;i<this.renderModes.length;i++)
            this.registerRenderer(this.renderModes[i]);

        return this.devices.slice();
    };

    this.getRegisteredDevices = function()
    {
        return this.registerDevices();
    };

    this.getRegisteredDevice = function(DCODE)
    {
        var devices = this.registerDevices();

        for(var i=0;i<devices.length;i++)
            if(devices[i].id.DCODE == DCODE) return devices[i];

        return null;
     };

    this.attachCanvas = function(c)
    {
        var visible = document.getElementById("applescreen");

        if(visible && visible !== c && visible.parentNode)
            visible.parentNode.replaceChild(c, visible);

        this.canvas = c;
        this.ctx = c;
    };

    this.applyState = function(r)
    {
        if(!r) return;

        r.vidram = this.vidram;
        r.hw = this.hw;

        if(typeof(r.setGfx) == "function")   r.setGfx(this.state.gfx);
        if(typeof(r.setMix) == "function")   r.setMix(this.state.mix);
        if(typeof(r.setPage2) == "function") r.setPage2(this.state.page2);
        if(typeof(r.setHires) == "function") r.setHires(this.state.hires);
        if(typeof(r.setMonitor) == "function") r.setMonitor(this.state.chrome);

        if(typeof(r.sync2DLinks) == "function")
            r.sync2DLinks();
    };

    this.getRenderer = function(spec, forceReset)
    {
        var r = this.renderers[spec.name];

        if(!r)
        {
            r = this.registerRenderer(spec);
            forceReset = true;
        }

        if(!r) return null;

        r.vidram = this.vidram;
        r.hw = this.hw;

        if(forceReset && typeof(r.reset) == "function")
            r.reset();

        this.applyState(r);
        return r;
    };

    this.getRendererInstance = function(mode,createIfMissing)
    {
        var spec = this.getRenderModeSpec(mode);
        if(!spec) return null;

        var r = this.renderers[spec.name] || null;
        if(!r && createIfMissing === true)
            r = this.getRenderer(spec,false);

        return r;
    };

    this.getActiveRenderer = function()
    {
        return this.ensureActive() ? this.active : null;
    };

    this.getEnabledModeIndex = function(startIndex)
    {
        this.registerDevices();

        for(var offset=0;offset<this.renderModes.length;offset++)
        {
            var index = ((startIndex + offset) % this.renderModes.length + this.renderModes.length) % this.renderModes.length;
            var renderer = this.renderers[this.renderModes[index].name];

            if(renderer && renderer.id.deviceEnable !== false)
                return index;
        }

        return -1;
    };

    this.setDeviceEnable = function(DCODE,enabled)
    {
        var renderer = this.getRegisteredDevice(DCODE);
        if(!renderer) return false;

        renderer.id.deviceEnable = !!enabled;

        if(renderer.id.deviceEnable === false && this.active === renderer)
        {
            this.active = null;
            this.activeName = "";

            var nextIndex = this.getEnabledModeIndex(this.modeIndex + 1);
            if(nextIndex >= 0)
                this.setMode(nextIndex,null,false);
        }
        else if(renderer.id.deviceEnable === true && !this.active)
        {
            this.setMode(this.getRenderModeIndexByName(renderer.id.mode),null,false);
        }

        return renderer.id.deviceEnable;
    };

    this.toggleDeviceEnable = function(DCODE)
    {
        var renderer = this.getRegisteredDevice(DCODE);
        return renderer
            ? this.setDeviceEnable(DCODE,renderer.id.deviceEnable === false)
            : false;
    };

    this.getRendererControlHTML = function(mode)
    {
        var spec = this.getRenderModeSpec(mode);
        if(!spec) return "";

        // Prefer the real object when this renderer has already been created.
        var r = this.getRendererInstance(spec,false);
        if(r && typeof(r.ctrl_dlg) == "function")
            return r.ctrl_dlg();

        // Control markup may also be exposed as constructor metadata, so merely
        // opening the HostIO popup does not instantiate every renderer.
        if(spec.ctor && typeof(spec.ctor.ctrl_dlg) == "function")
            return spec.ctor.ctrl_dlg();

        return "";
    };

    this.setMode = function(idx, uiEl, forceReset)
    {
        var enabledIndex = this.getEnabledModeIndex(idx);

        if(enabledIndex < 0)
        {
            this.active = null;
            this.activeName = "";
            this.updateRenderModeUI(uiEl);
            return this;
        }

        this.modeIndex = enabledIndex;

        var spec = this.renderModes[this.modeIndex];
        var c = this.getCanvasFor(spec);

        this.attachCanvas(c);

        this.active = this.getRenderer(spec, !!forceReset);
        this.activeName = spec.name;

        if(typeof(this.active.redraw) == "function")
            this.active.redraw();

        this.updateRenderModeUI(uiEl);
        return this;
    };

    this.nextMode = function(uiEl)
    {
        return this.setMode(this.modeIndex + 1, uiEl, false);
    };

    this.getRenderMode = function()
    {
        return this.activeName || "";
    };

    this.updateRenderModeUI = function(uiEl)
    {
        var el = uiEl || document.getElementById("render_mode");
        if(el) el.title = this.getRenderMode();
    };

    this.ensureActive = function()
    {
        if(this.active && this.active.id && this.active.id.deviceEnable === false)
            this.active = null;

        if(!this.active)
            this.setMode(this.modeIndex, null, false);

        return this.active != null;
    };

    this.reset = function()
    {
        // Register every video device once; activation remains a separate state.
        this.registerDevices();

        this.state.gfx = false;
        this.state.mix = false;
        this.state.page2 = false;
        this.state.hires = false;
        this.state.chrome = 0;

        this.setMode(this.modeIndex, null, true);
    };

    this.cycle = function()
    {
        if(this.ensureActive() && typeof(this.active.cycle) == "function")
            return this.active.cycle();
    };

    this.redraw = function()
    {
        if(this.ensureActive() && typeof(this.active.redraw) == "function")
            return this.active.redraw();
    };

    this.reflash = function()
    {
        if(this.ensureActive() && typeof(this.active.reflash) == "function")
            return this.active.reflash();

        return this.redraw();
    };

    this.write = function(addr,d8)
    {
        if(!this.ensureActive()) return;

        this.active.vidram = this.vidram;
        this.active.hw = this.hw;

        if(typeof(this.active.write) == "function")
            return this.active.write(addr,d8);
    };

    this.setGfx = function(flag)
    {
        this.state.gfx = !!flag;
        if(this.ensureActive() && typeof(this.active.setGfx) == "function")
            return this.active.setGfx(this.state.gfx);
    };

    this.setMix = function(flag)
    {
        this.state.mix = !!flag;
        if(this.ensureActive() && typeof(this.active.setMix) == "function")
            return this.active.setMix(this.state.mix);
    };

    this.setPage2 = function(flag)
    {
        this.state.page2 = !!flag;
        if(this.ensureActive() && typeof(this.active.setPage2) == "function")
            return this.active.setPage2(this.state.page2);
    };

    this.setHires = function(flag)
    {
        this.state.hires = !!flag;
        if(this.ensureActive() && typeof(this.active.setHires) == "function")
            return this.active.setHires(this.state.hires);
    };

    this.setMonitor = function(mode)
    {
        this.state.chrome = mode & 3;

        if(this.ensureActive() && typeof(this.active.setMonitor) == "function")
            return this.active.setMonitor(this.state.chrome);

        return {color:"#000000",name:"Color"};
    };

    this.getloresCols = function()
    {
        if(this.ensureActive() && typeof(this.active.getloresCols) == "function")
            return this.active.getloresCols();

        return [];
    };

    this.gethiresCols = function()
    {
        if(this.ensureActive() && typeof(this.active.gethiresCols) == "function")
            return this.active.gethiresCols();

        return [];
    };

    this.hgr_PixelColor = function(x, y, left, me, right, b7)
    {
        if(mux.ensureActive() && typeof(mux.active.hgr_PixelColor) == "function")
            return mux.active.hgr_PixelColor(x, y, left, me, right, b7);

        // Fallback: use the classic canvas renderer as the color reference.
        for(var i=0;i<mux.renderModes.length;i++)
        {
            if(mux.renderModes[i].name == "video")
            {
                var r = mux.getRenderer(mux.renderModes[i], false);
                if(r && typeof(r.hgr_PixelColor) == "function")
                    return r.hgr_PixelColor(x, y, left, me, right, b7);
            }
        }

        return "#000000";
    };

    this.setCol = function(idx,column,val)
    {
        if(this.ensureActive() && typeof(this.active.setCol) == "function")
            return this.active.setCol(idx,column,val);

        return val;
    };

    this.addrVisible = function(addr)
    {
        if(this.ensureActive() && typeof(this.active.addrVisible) == "function")
            return this.active.addrVisible(addr);

        return true;
    };
}