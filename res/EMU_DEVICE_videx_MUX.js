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

        var lastKeyTranslation = {
             "initialLowerCase":false
            ,"finalLowerCase":false
            ,"caseModeKnown":false
            ,"flagsAddress":null
            ,"events":[]
            ,"unreachable":[]
            ,"sent":false
        };

        const VIDEX_KEYEVENT_MIME =
            "application/x-retroapple-keyevent";

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
                 "direction":"duplex"
                ,"mime":["text/plain"]
                ,"handler":"receiveText"
                ,"provider":"captureText"
                ,"open":"isTextPortOpen"
                ,"description":"VideoTerm semantic text input/output using the active character ROM"
            }
            ,"keyevent":{
                 "direction":"out"
                ,"mime":[VIDEX_KEYEVENT_MIME]
                ,"open":"isTextPortOpen"
                ,"visibility":"internal"
                ,"description":"Internal VideoTerm-to-Apple-II keyboard event transport"
            }
        };

        this.bindHost = function(card)
        {
            textHost = card || null;
            return !!textHost;
        };

        this.isTextPortOpen = function()
        {
            /*
             * A mounted VideoTerm is not automatically the active text target.
             * Keep VIDEXTXT closed while motherboard video is selected, so the
             * pasteboard default remains 0:A2KBD:text.
             *
             * VIDEXVID is the authoritative runtime selector: its isVisible()
             * state follows the VideoTerm soft-video-switch/show()/hide() path.
             * Open this text port only while that sibling device is visible.
             */
            if(!textHost ||
               (textHost.state && textHost.state.active===false))
                return false;

            var devices =
                Array.isArray(textHost.devices)
                    ? textHost.devices
                    : [];

            for(var i=0;i<devices.length;i++)
            {
                var device = devices[i];
                if(String(device?.id?.DCODE || "").toUpperCase()!="VIDEXVID")
                    continue;

                return typeof(device.isVisible)=="function" &&
                    device.isVisible()===true;
            }

            return false;
        }

        /*
         * Reverse direction of this same semantic text endpoint.
         *
         * Read the visible MC6845 character matrix from VideoTerm VRAM and map
         * every 7-bit glyph through the currently active character-ROM Unicode
         * metadata. VRAM bit 7 may be presentation/inverse state and is not part
         * of the glyph identity.
         */
        this.captureText = function()
        {
            if(!textHost ||
               typeof(textHost.getVideoRAM)!="function" ||
               typeof(textHost.getCRTCRegisters)!="function")
                return false;

            var vram = textHost.getVideoRAM();
            var crtc = textHost.getCRTCRegisters();
            var rom =
                typeof(textHost.getCharacterROM)=="function"
                    ? textHost.getCharacterROM()
                    : null;

            if(!(vram instanceof Uint8Array) ||
               !(crtc instanceof Uint8Array))
                return false;

            var columns = crtc[1] & 0xFF;
            var rows = crtc[6] & 0x7F;
            var start = ((crtc[12]<<8) | crtc[13]) & 0x07FF;

            if(columns<1 || columns>132) columns = 80;
            if(rows<1 || rows>64) rows = 24;

            var unicode =
                rom && Array.isArray(rom.unicode)
                    ? rom.unicode
                    : null;

            var lines = [];

            for(var row=0;row<rows;row++)
            {
                var line = "";

                for(var col=0;col<columns;col++)
                {
                    var address =
                        (start + row*columns + col) & 0x07FF;

                    var glyph = vram[address] & 0x7F;
                    var cp =
                        unicode && Number.isInteger(unicode[glyph])
                            ? unicode[glyph]
                            : null;

                    line += cp===null
                        ? "\uFFFD"
                        : String.fromCodePoint(cp);
                }

                lines.push(line);
            }

            return {
                 "mime":"text/plain"
                ,"data":lines.join("\n")
                ,"meta":{
                     "columns":columns
                    ,"rows":rows
                    ,"start":start
                    ,"romKey":rom && rom.key ? rom.key : null
                }
            };
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

        /*
         * Model the input transformation performed by VideoTerm firmware 2.4
         * KEYSTA. The assembled slot-3 ROM tests FLAGS bit 6 for lower-case
         * mode and reads the one-wire Shift modification at $C063.
         *
         * rawCode is the 7-bit Apple II keyboard encoder value; A2KBD adds the
         * keyboard-strobe high bit when it places the code in the latch.
         */
        function videoTermKeyResult(rawCode,shiftPressed,lowerCaseMode)
        {
            var a = (Number(rawCode) & 0x7F) | 0x80;

            // Firmware maps CTRL-K to the bracket key before case conversion.
            if(a==0x8B) a = 0xDB;

            // CTRL-A toggles case mode and is consumed by KEYSTA.
            if(a==0x81) return null;

            /*
             * The ROM binary compares against $B0 here. This deliberately uses
             * the assembled firmware behavior rather than the older manual
             * listing's OCR/transcription of that compare.
             */
            if(lowerCaseMode && a>=0xB0)
            {
                if(!shiftPressed)
                    a |= 0x20;
                else if(a==0xB0)
                    a = 0xFD;
                else
                {
                    if(a==0xC0) a = 0xD0;

                    if(a>=0xDB)
                    {
                        a &= 0xCF;
                        if(a==0x00) a = 0xFD;
                    }
                }
            }

            return a & 0x7F;
        }

        /*
         * Find a physical Apple II-class keyboard code for one desired
         * VideoTerm character code. Restrict raw codes to $00-$5F: lowercase
         * and the upper half of the VideoTerm character set must therefore be
         * obtained through VideoTerm's own CTRL-A/Shift processing rather than
         * by injecting impossible lowercase Apple II+ key codes.
         */
        function keyEventForGlyph(glyph,lowerCaseMode)
        {
            glyph = Number(glyph) & 0x7F;

            if(glyph!=0x0D && (glyph<0x20 || glyph>0x7F))
                return null;

            var best = null;
            var bestScore = Infinity;

            for(var raw=0x00;raw<=0x5F;raw++)
            {
                if(raw==0x01) continue; // reserved CTRL-A case toggle

                for(var shiftN=0;shiftN<2;shiftN++)
                {
                    var shift = shiftN===1;

                    if(videoTermKeyResult(raw,shift,lowerCaseMode)!==glyph)
                        continue;

                    // Prefer the same encoder code, then unshifted, then low raw.
                    var score =
                          (raw==glyph ? 0 : 0x100)
                        + (shift ? 0x80 : 0)
                        + raw;

                    if(score<bestScore)
                    {
                        bestScore = score;
                        best = {
                             "keyCode":raw
                            ,"shift":shift
                            ,"glyph":glyph
                        };
                    }
                }
            }

            return best;
        }

        function readVideoTermCaseMode(context)
        {
            var slotN =
                context && context.target
                    ? Number(context.target.slotN)
                    : NaN;

            var flagsAddress =
                Number.isInteger(slotN)
                    ? 0x07F8 + (slotN & 0x07)
                    : null;

            var hw = context && context.hw;

            if(flagsAddress===null ||
               !hw ||
               typeof(hw.safe_read)!="function")
            {
                return {
                     "known":false
                    ,"lowerCase":false
                    ,"flagsAddress":flagsAddress
                };
            }

            return {
                 "known":true
                ,"lowerCase":(hw.safe_read(flagsAddress) & 0x40)!==0
                ,"flagsAddress":flagsAddress
            };
        }

        function translateGlyphsToKeyEvents(glyphs,context)
        {
            var mode = readVideoTermCaseMode(context);
            var initialLowerCase = mode.lowerCase;
            var lowerCase = initialLowerCase;
            var events = [];
            var unreachable = [];

            for(var i=0;i<glyphs.length;i++)
            {
                var glyph = Number(glyphs[i]) & 0x7F;
                var event = keyEventForGlyph(glyph,lowerCase);

                /*
                 * Some glyph positions are reachable only in the opposite
                 * VideoTerm case mode. CTRL-A changes that firmware mode without
                 * producing an input character.
                 */
                if(!event && mode.known)
                {
                    var alternate = keyEventForGlyph(glyph,!lowerCase);

                    if(alternate)
                    {
                        events.push({
                             "keyCode":0x01
                            ,"shift":false
                            ,"control":"CTRL-A"
                            ,"purpose":"case-toggle"
                        });
                        lowerCase = !lowerCase;
                        event = alternate;
                    }
                }

                if(!event)
                {
                    unreachable.push({
                         "index":i
                        ,"glyph":glyph
                        ,"reason":mode.known
                            ? "not keyboard-reachable"
                            : "VideoTerm case state unavailable"
                    });
                    continue;
                }

                events.push(event);
            }

            /*
             * Paste must not leave the user's VideoTerm in a different
             * upper/lower-case mode from the one that was active beforehand.
             */
            if(mode.known && lowerCase!==initialLowerCase)
            {
                events.push({
                     "keyCode":0x01
                    ,"shift":false
                    ,"control":"CTRL-A"
                    ,"purpose":"restore-case-mode"
                });
                lowerCase = initialLowerCase;
            }

            return {
                 "initialLowerCase":initialLowerCase
                ,"finalLowerCase":lowerCase
                ,"caseModeKnown":mode.known
                ,"flagsAddress":mode.flagsAddress
                ,"events":events
                ,"unreachable":unreachable
            };
        }

        this.receiveText = function(message,context)
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

            var translation =
                translateGlyphsToKeyEvents(glyphQueue,context);

            var sent = translation.events.length===0;

            if(translation.events.length>0 &&
               context &&
               context.io &&
               context.target &&
               typeof(context.io.pipeSend)=="function")
            {
                var keySource =
                    context.target.slotN + ":VIDEXTXT:keyevent";

                sent = context.io.pipeSend(
                    keySource,
                    "0:A2KBD:keyevent",
                    {
                         "mime":VIDEX_KEYEVENT_MIME
                        ,"data":translation.events
                    }
                );
            }

            lastKeyTranslation = {
                 "initialLowerCase":translation.initialLowerCase
                ,"finalLowerCase":translation.finalLowerCase
                ,"caseModeKnown":translation.caseModeKnown
                ,"flagsAddress":translation.flagsAddress
                ,"events":translation.events.map(function(event)
                    { return Object.assign({},event); })
                ,"unreachable":translation.unreachable.map(function(item)
                    { return Object.assign({},item); })
                ,"sent":sent===true
            };

            if(translation.unreachable.length &&
               typeof(console)!="undefined" &&
               console.warn)
            {
                console.warn(
                    "VIDEXTXT:key skipped " +
                    translation.unreachable.length +
                    " glyph" +
                    (translation.unreachable.length==1 ? "" : "s") +
                    " that cannot be generated through VideoTerm keyboard input",
                    translation.unreachable
                );
            }

            /*
             * The glyph queue represents pending downstream work. Once A2KBD
             * has accepted the translated key sequence it owns delivery through
             * the keyboard latch, so these glyphs have been consumed.
             */
            if(sent===true)
                glyphQueue.length = 0;

            return sent===true;
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

        this.getLastKeyTranslation = function()
        {
            return {
                 "initialLowerCase":lastKeyTranslation.initialLowerCase
                ,"finalLowerCase":lastKeyTranslation.finalLowerCase
                ,"caseModeKnown":lastKeyTranslation.caseModeKnown
                ,"flagsAddress":lastKeyTranslation.flagsAddress
                ,"events":lastKeyTranslation.events.map(function(event)
                    { return Object.assign({},event); })
                ,"unreachable":lastKeyTranslation.unreachable.map(function(item)
                    { return Object.assign({},item); })
                ,"sent":lastKeyTranslation.sent
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
            lastKeyTranslation = {
                 "initialLowerCase":false
                ,"finalLowerCase":false
                ,"caseModeKnown":false
                ,"flagsAddress":null
                ,"events":[]
                ,"unreachable":[]
                ,"sent":false
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
        if(typeof(mux._ioPipeStateChanged)=="function")
            mux._ioPipeStateChanged({
                 "reason":"videx-output"
                ,"visible":true
            });
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
        if(typeof(mux._ioPipeStateChanged)=="function")
            mux._ioPipeStateChanged({
                 "reason":"videx-output"
                ,"visible":false
            });
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
