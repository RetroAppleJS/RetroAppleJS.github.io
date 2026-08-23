//
// Videx VideoTerm video-device MUX
//
// The VideoTerm has its own video output. Stage 3 exposes that output on the
// existing initialized RetroAppleJS display surface without replacing its DOM
// canvas. Stage 4 can formalise a persistent Apple/VideoTerm output selector.
//

function VidexVideoMUX(deviceInfo)
{
    var mux = this;

    deviceInfo = deviceInfo || {};

    /*
     * VidexVideoMUX is the common constructor for two declarative Videx
     * devices:
     *
     *   VIDEXVID  - existing VideoTerm video-output MUX
     *   VIDEXTXT  - Unicode text input / active-character-ROM glyph mapper
     *
     * Apple2IO passes deviceConfig to the constructor and then applies the
     * authoritative id metadata after construction.
     */
    var configuredDCODE =
        String(deviceInfo.DCODE || "VIDEXVID").toUpperCase();

    /*
     * Text-input role. Keep this deliberately separate from the video-output
     * machinery below: accepting text must not instantiate a renderer, claim a
     * canvas, subscribe to display signals, or write directly to VideoTerm
     * VRAM.
     */
    if(configuredDCODE=="VIDEXTXT")
    {
        var textHost = null;
        var glyphQueue = [];
        var lastMapping = {
             "romKey":null
            ,"glyphs":[]
            ,"unsupported":[]
        };

        this.id = {
             "DCODE":"VIDEXTXT"
            ,"coID":"VidexVideoMUX"
            ,"hostPCODE":"VIDEX"
            ,"icon":"fa fa-keyboard"
            ,"description":"Videx VideoTerm Unicode text input"
            ,"deviceEnable":true
        };

        this.ports = {
            "text":{
                 "direction":"in"
                ,"mime":["text/plain"]
                ,"handler":"receiveText"
                ,"description":"Unicode text mapped through the active VideoTerm character ROM"
            }
        };

        this.bindHost = function(card)
        {
            textHost = card || null;
            return !!textHost;
        };

        function reverseUnicodeMap(rom)
        {
            var reverse = Object.create(null);
            var unicode =
                rom && Array.isArray(rom.unicode)
                    ? rom.unicode
                    : [];

            /*
             * Prefer the identity code where possible. Several VideoTerm ROMs
             * contain duplicate visual mappings (SPACE is the obvious case);
             * U+0020 should resolve to glyph $20 rather than an unrelated blank
             * line-drawing/control cell.
             */
            for(var i=0;i<unicode.length;i++)
            {
                var cp = unicode[i];
                if(Number.isInteger(cp) && cp==i)
                    reverse[cp] = i;
            }

            /*
             * Fill every remaining Unicode scalar from the first glyph that
             * represents it. Existing identity choices are intentionally kept.
             */
            for(var j=0;j<unicode.length;j++)
            {
                var cp2 = unicode[j];
                if(!Number.isInteger(cp2)) continue;
                if(reverse[cp2]===undefined)
                    reverse[cp2] = j;
            }

            return reverse;
        }

        this.mapTextToGlyphs = function(text)
        {
            text = String(text==null ? "" : text)
                .replace(/\r\n/g,"\n")
                .replace(/\r/g,"\n");

            var rom =
                textHost && typeof(textHost.getCharacterROM)=="function"
                    ? textHost.getCharacterROM()
                    : null;

            var reverse = reverseUnicodeMap(rom);
            var glyphs = [];
            var unsupported = [];

            for(var offset=0;offset<text.length;offset++)
            {
                var cp = text.codePointAt(offset);
                var charLength = cp>0xFFFF ? 2 : 1;
                var glyph;

                /*
                 * A host newline represents the VideoTerm RETURN input code.
                 * All printable characters are resolved strictly through the
                 * active character-ROM Unicode metadata.
                 */
                if(cp==0x0A)
                    glyph = 0x0D;
                else
                    glyph = reverse[cp];

                if(glyph===undefined)
                {
                    unsupported.push({
                         "offset":offset
                        ,"codePoint":cp
                        ,"character":String.fromCodePoint(cp)
                    });
                }
                else
                    glyphs.push(glyph & 0x7F);

                offset += charLength-1;
            }

            return {
                 "romKey":rom && rom.key ? rom.key : null
                ,"glyphs":glyphs
                ,"unsupported":unsupported
            };
        };

        this.receiveText = function(message)
        {
            var result = this.mapTextToGlyphs(
                message && message.data!==undefined
                    ? message.data
                    : ""
            );

            for(var i=0;i<result.glyphs.length;i++)
                glyphQueue.push(result.glyphs[i]);

            lastMapping = {
                 "romKey":result.romKey
                ,"glyphs":result.glyphs.slice()
                ,"unsupported":result.unsupported.slice()
            };

            if(result.unsupported.length &&
               typeof(console)!="undefined" &&
               console.warn)
            {
                console.warn(
                    "VIDEXTXT:text skipped " +
                    result.unsupported.length +
                    " character" +
                    (result.unsupported.length==1 ? "" : "s") +
                    " not present in " +
                    (result.romKey || "the active VideoTerm character ROM"),
                    result.unsupported
                );
            }

            return true;
        };

        this.getGlyphQueue = function()
        {
            return glyphQueue.slice();
        };

        this.drainGlyphQueue = function(count)
        {
            if(count===undefined || count===null)
                count = glyphQueue.length;

            count = Math.max(0,Math.min(
                glyphQueue.length,
                Number(count) || 0
            ));

            return glyphQueue.splice(0,count);
        };

        this.getLastTextMapping = function()
        {
            return {
                 "romKey":lastMapping.romKey
                ,"glyphs":lastMapping.glyphs.slice()
                ,"unsupported":lastMapping.unsupported.slice()
            };
        };

        this.reset = function()
        {
            glyphQueue.length = 0;
            lastMapping = {
                 "romKey":null
                ,"glyphs":[]
                ,"unsupported":[]
            };
            return true;
        };

        return;
    }

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

    var state = {
         "contrast":100
        ,"phosphor":"white"
        ,"softVideoSwitchInstalled":true
    };
    this.state = state;

    var appleVideo = null;
    var unsubscribeOutputSignals = null;

    /*
     * Videx Soft Video Switch truth table from the VideoTerm manual:
     *
     *   Apple color graphics active -> motherboard video
     *   otherwise AN0 off          -> motherboard video
     *   otherwise AN0 on           -> VideoTerm video
     */
    function applySoftVideoSwitch(signals)
    {
        signals = signals || (appleVideo ? appleVideo.state : null) || {};

        var selectVidex =
            signals.annunciator0 === true &&
            signals.gfx !== true;

        return selectVidex ? mux.show() : mux.hide();
    }

    function bindAppleVideoSignals()
    {
        var video =
            typeof(oApple2Video)!="undefined"
                ? oApple2Video
                : null;

        if(appleVideo === video && unsubscribeOutputSignals)
        {
            applySoftVideoSwitch();
            return true;
        }

        if(unsubscribeOutputSignals)
        {
            unsubscribeOutputSignals();
            unsubscribeOutputSignals = null;
        }

        appleVideo = video;

        if(!appleVideo || typeof(appleVideo.subscribeOutputSignals)!="function")
            return false;

        unsubscribeOutputSignals =
            appleVideo.subscribeOutputSignals(applySoftVideoSwitch);

        applySoftVideoSwitch();
        return true;
    }

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
        if(typeof(renderer.setContrast)=="function")
            renderer.setContrast(state.contrast);
        if(typeof(renderer.setPhosphor)=="function")
            renderer.setPhosphor(state.phosphor);

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

        bindAppleVideoSignals();

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

    this.getDisplaySettings = function()
    {
        return {
             "contrast":state.contrast
            ,"phosphor":state.phosphor
            ,"softVideoSwitchInstalled":state.softVideoSwitchInstalled
            ,"outputVisible":outputVisible
        };
    };

    this.setContrast = function(value)
    {
        value = Math.max(0,Math.min(200,Number(value)));
        if(!Number.isFinite(value)) value = 100;
        state.contrast = value;

        var r = ensureRenderer();
        if(r && typeof(r.setContrast)=="function")
            r.setContrast(value);
        if(outputVisible && r && typeof(r.redraw)=="function")
            r.redraw();

        return value;
    };

    this.setPhosphor = function(value)
    {
        value = String(value || "").toLowerCase();
        if(["white","green","amber"].indexOf(value)<0)
            value = "white";

        state.phosphor = value;

        var r = ensureRenderer();
        if(r && typeof(r.setPhosphor)=="function")
            r.setPhosphor(value);
        if(outputVisible && r && typeof(r.redraw)=="function")
            r.redraw();

        return value;
    };

    this.setSoftVideoSwitchInstalled = function(flag)
    {
        state.softVideoSwitchInstalled = !!flag;

        if(state.softVideoSwitchInstalled)
        {
            bindAppleVideoSignals();
            applySoftVideoSwitch();
        }
        else
        {
            // A one-monitor RetroAppleJS setup falls back to motherboard video.
            // Manual show()/hide() remain available as diagnostic selectors.
            mux.hide();
        }

        return state.softVideoSwitchInstalled;
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

        if(outputVisible)
            return true;

        outputVisible = true;

        if(typeof(mux._ioRefreshHooks)=="function")
            mux._ioRefreshHooks();
        r.redraw();

        return true;
    };

    this.hide = function()
    {
        if(!outputVisible)
            return true;
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
        /*
         * Apple reset clears annunciator zero. AppleBoard publishes that state,
         * but resynchronise here as well so restart/reset ordering cannot leave
         * a stale VideoTerm selection.
         */
        bindAppleVideoSignals();
        applySoftVideoSwitch();

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
            +"VideoTerm output diagnostics. Display characteristics are available in Peripheral controls.<br><br>"
            +"<button class=\"appbut\" "
            +"onclick=\"oEMU.component.IO.VidexVideo.show()\">Show VideoTerm</button> "
            +"<button class=\"appbut\" "
            +"onclick=\"oEMU.component.IO.VidexVideo.hide()\">Show Apple II</button>"
            +"</div>";
    };
}
