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
        { name: "GPU",     ctor: Apple2VideoGPU,    context: "canvas" },
        { name: "Wave",    ctor: Apple2VideoWave,   context: "canvas" },
        { name: "ThreeJS", ctor: Apple2VideoTHREE,  context: "canvas" },
        { name: "video",   ctor: Apple2VideoCanvas, context: "2d"     }
    ];

    this.modeIndex = 0;
    this.active = null;
    this.activeName = "GPU";

    this.renderers = {};
    this.canvases = {};

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

        if(spec.name == "GPU" && base)
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
            var c = this.getCanvasFor(spec);
            var arg = spec.context == "2d" ? c.getContext("2d") : c;

            r = new spec.ctor(arg);
            this.renderers[spec.name] = r;
            forceReset = true;
        }

        r.vidram = this.vidram;
        r.hw = this.hw;

        if(forceReset && typeof(r.reset) == "function")
            r.reset();

        this.applyState(r);
        return r;
    };

    this.setMode = function(idx, uiEl, forceReset)
    {
        this.modeIndex = ((idx % this.renderModes.length) + this.renderModes.length) % this.renderModes.length;

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
        return this.activeName || "GPU";
    };

    this.updateRenderModeUI = function(uiEl)
    {
        var el = uiEl || document.getElementById("render_mode");
        if(el) el.title = this.getRenderMode();
    };

    this.ensureActive = function()
    {
        if(!this.active)
            this.setMode(this.modeIndex, null, false);

        return this.active != null;
    };

    this.reset = function()
    {
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