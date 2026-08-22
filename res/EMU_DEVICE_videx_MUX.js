//
// Videx VideoTerm video-device MUX
//
// The VideoTerm has its own video output. Stage 3 exposes that output on the
// existing initialized RetroAppleJS display surface without replacing its DOM
// canvas. Stage 4 can formalise a persistent Apple/VideoTerm output selector.
//

function VidexVideoMUX()
{
    var mux = this;

    this.id = {
         "DCODE":"VIDEXVID"
        ,"coID":"VidexVideoMUX"
        ,"hostPCODE":"VIDEX"
        ,"icon":"fa fa-tv"
        ,"description":"Videx VideoTerm video output"
        ,"deviceEnable":true
    };

    var host = null;
    var unsubscribeHost = null;

    var canvas = null;
    var renderer = null;
    var outputVisible = false;

    function ensureCanvas()
    {
        if(typeof(document)=="undefined") return null;

        /*
         * Never replace or clone the initialized Apple display node here.
         * RetroAppleJS keeps renderer/event references to that live canvas.
         * VideoTerm temporarily shares the current display surface instead.
         */
        var live = document.getElementById("applescreen");
        if(!live || typeof(live.getContext)!="function")
            return null;

        if(canvas !== live)
        {
            canvas = live;

            if(renderer && typeof(renderer.setContext)=="function")
                renderer.setContext(canvas.getContext("2d"));
        }

        return canvas;
    }

    function ensureRenderer()
    {
        if(renderer) return renderer;
        if(typeof(VidexVideoNormal)!="function") return null;

        var c = ensureCanvas();
        if(!c) return null;

        renderer = new VidexVideoNormal(c.getContext("2d"));

        if(host && typeof(renderer.bindHost)=="function")
            renderer.bindHost(host);

        return renderer;
    }

    function handleVideoChange(change)
    {
        var r = ensureRenderer();
        if(r && typeof(r.onVideoChange)=="function")
            r.onVideoChange(change);
    }

    this.bindHost = function(card)
    {
        if(host !== card)
        {
            if(unsubscribeHost)
            {
                unsubscribeHost();
                unsubscribeHost = null;
            }

            host = card || null;

            if(host && typeof(host.subscribeVideoChange)=="function")
                unsubscribeHost = host.subscribeVideoChange(handleVideoChange);
        }

        var r = ensureRenderer();

        if(r && typeof(r.bindHost)=="function")
            r.bindHost(host);

        if(outputVisible && r && typeof(r.redraw)=="function")
            r.redraw();

        return !!r;
    };

    this.getRegisteredDevices = function()
    {
        var r = ensureRenderer();
        return r ? [r] : [];
    };

    this.getActiveRenderer = function()
    {
        return ensureRenderer();
    };

    this.getCanvas = function()
    {
        return ensureCanvas();
    };

    this.isVisible = function()
    {
        return outputVisible;
    };

    /*
     * Explicit output selection for Stage 3 testing.
     * This does NOT claim that PR#3 electrically switches the motherboard
     * monitor output; the physical VideoTerm had a separate output.
     */
    this.show = function()
    {
        var c = ensureCanvas();
        var r = ensureRenderer();
        if(!c || !r) return false;

        if(typeof(r.setContext)=="function")
            r.setContext(c.getContext("2d"));

        outputVisible = true;

        if(typeof(mux._ioRefreshHooks)=="function")
            mux._ioRefreshHooks();
        r.redraw();

        return true;
    };

    this.hide = function()
    {
        outputVisible = false;

        if(typeof(mux._ioRefreshHooks)=="function")
            mux._ioRefreshHooks();

        /*
         * Motherboard video already owns the live canvas. Ask it to repaint
         * once now that VideoTerm no longer presents on top of it.
         */

        if(typeof(oApple2Video)!="undefined" &&
           oApple2Video &&
           typeof(oApple2Video.redraw)=="function")
        {
            oApple2Video.redraw();
        }

        return true;
    };

    this.redraw = function()
    {
        if(!outputVisible) return false;

        var r = ensureRenderer();
        return r && typeof(r.redraw)=="function"
            ? r.redraw()
            : false;
    };

    this.reset = function()
    {
        var r = ensureRenderer();

        if(!r) return true;

        if(outputVisible && typeof(r.reset)=="function")
            r.reset();
        else if(typeof(r.onVideoChange)=="function")
            r.onVideoChange(null);

        return true;
    };

    /*
     * Apple2IO registers attached-device cycle() hooks. The renderer therefore
     * coalesces hundreds/thousands of VRAM writes from one CPU slice and paints
     * them once, instead of drawing on the CPU I/O hot path.
     */
    this.cycle = function()
    {
        if(!outputVisible) return false;

        /*
         * Apple motherboard video runs earlier in Apple2Plus.cycle(). Since
         * VideoTerm intentionally shares the same stable canvas in this stage,
         * present its logical framebuffer once more at the end of the I/O slice.
         */
        var c = ensureCanvas();
        var r = ensureRenderer();
        if(!c || !r || typeof(r.cycle)!="function")
            return false;

        return r.cycle(true);
    };

    this.isCycleActive = function()
    {
        return outputVisible;
    };

    this.ctrl_dlg = function()
    {
        return ""
            +"<div style=\"padding:4px\">"
            +"VideoTerm output is separate from motherboard video.<br><br>"
            +"<button class=\"appbut\" "
            +"onclick=\"oEMU.component.IO.VidexVideo.show()\">Show VideoTerm</button> "
            +"<button class=\"appbut\" "
            +"onclick=\"oEMU.component.IO.VidexVideo.hide()\">Show Apple II</button>"
            +"</div>";
    };
}
