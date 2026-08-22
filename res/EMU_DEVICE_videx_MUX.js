//
// Videx VideoTerm video-device MUX
//
// The VideoTerm has its own video output. This object keeps that output
// separate from the Apple motherboard video MUX. Stage 4 can formalise
// display-source arbitration; show()/hide() are deliberately explicit for
// this renderer-integration test.
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
    var savedAppleCanvas = null;

    function ensureCanvas()
    {
        if(canvas) return canvas;
        if(typeof(document)=="undefined") return null;

        var base = document.getElementById("applescreen");

        /*
         * cloneNode(false) preserves the screen class, tabindex and inline
         * keyboard/audio handlers without copying pixels or child state.
         */
        canvas = base ? base.cloneNode(false) : document.createElement("canvas");
        canvas.id = "videxscreen";
        canvas.width = 560;
        canvas.height = 384;

        if(canvas.style)
        {
            canvas.style.display = "block";
            canvas.style.outline = "none";
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

        if(r && typeof(r.redraw)=="function")
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
        return !!(
            canvas &&
            typeof(document)!="undefined" &&
            document.getElementById("applescreen") === canvas
        );
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
        if(!c || !r || typeof(document)=="undefined") return false;

        var visible = document.getElementById("applescreen");

        if(visible === c)
        {
            r.redraw();
            return true;
        }

        if(!visible || !visible.parentNode) return false;

        savedAppleCanvas = visible;
        savedAppleCanvas.id = "applescreen_apple";
        c.id = "applescreen";

        visible.parentNode.replaceChild(c,visible);
        r.redraw();

        return true;
    };

    this.hide = function()
    {
        if(!canvas || typeof(document)=="undefined") return false;

        var visible = document.getElementById("applescreen");

        /*
         * The motherboard MUX may already have replaced the Videx canvas.
         * In that case there is nothing for this MUX to restore.
         */
        if(visible !== canvas || !canvas.parentNode || !savedAppleCanvas)
            return false;

        var parent = canvas.parentNode;

        canvas.id = "videxscreen";
        savedAppleCanvas.id = "applescreen";

        parent.replaceChild(savedAppleCanvas,canvas);
        savedAppleCanvas = null;

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
        var r = ensureRenderer();
        return r && typeof(r.redraw)=="function"
            ? r.redraw()
            : false;
    };

    this.reset = function()
    {
        var r = ensureRenderer();

        if(r && typeof(r.reset)=="function")
            r.reset();

        return true;
    };

    /*
     * Apple2IO registers attached-device cycle() hooks. The renderer therefore
     * coalesces hundreds/thousands of VRAM writes from one CPU slice and paints
     * them once, instead of drawing on the CPU I/O hot path.
     */
    this.cycle = function()
    {
        var r = ensureRenderer();

        if(r && typeof(r.cycle)=="function")
            return r.cycle();
    };

    this.isCycleActive = function()
    {
        return true;
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
