//
// Videx VideoTerm - Normal Sync renderer
//
// Normal Sync renderer:
// - MC6845 drives geometry/start/cursor.
// - VideoTerm VRAM remains authoritative.
// - The installed character-generator ROM is selected by peripheral config.
// - Optional inverse-video hardware uses VRAM bit 7 as the polarity selector.
//

function VidexVideoNormal(ctx)
{
    var video = this;

    this.id = {
         "DCODE":"VIDEX_NS"
        ,"coID":"VidexVideo"
        ,"hostPCODE":"VIDEX"
        ,"deviceIdx":0
        ,"mode":"normal"
        ,"icon":"fa fa-tv"
        ,"description":"VideoTerm Normal Sync 80x24"
        ,"deviceEnable":true
    };

    var host = null;
    var vram = null;
    var crtc = null;
    var charRom = null;

    var charRomInfo = null;

    var displaySettings = {
         "contrast":100
        ,"phosphor":"white"
    };

    const PHOSPHOR_RGB = {
         "white":[255,255,255]
        ,"green":[128,255,160]
        ,"amber":[255,190,96]
    };

    function refreshCharacterROM()
    {
        var info = host && typeof(host.getCharacterROM)=="function"
            ? host.getCharacterROM()
            : null;

        if(info && info.data instanceof Uint8Array)
        {
            charRomInfo = info;
            charRom = info.data;
            return true;
        }

        charRom = host && typeof(host.getNormalCharacterROM)=="function"
            ? host.getNormalCharacterROM()
            : null;

        charRomInfo = charRom
            ? {
                 "key":"VIDEX:NORMAL"
                ,"label":"Normal"
                ,"mirror":false
                ,"dsize":[8,16]
                ,"data":charRom
              }
            : null;

        return !!charRom;
    }

    function foregroundStyle()
    {
        var rgb = PHOSPHOR_RGB[displaySettings.phosphor]
            || PHOSPHOR_RGB.white;
        /*
         * Keep the logical glyph raster at full phosphor intensity.
         * Display contrast/gain is applied after resampling in present(), where
         * it can also brighten the gray edge pixels produced by 720->display
         * interpolation.
         */

        return "rgb("
            +rgb[0]+","
            +rgb[1]+","
            +rgb[2]+")";
    }

    var displayCtx = ctx || null;
    var logicalCanvas = null;
    var logicalCtx = null;

    var dirtyFlags = new Uint8Array(0x800);
    var dirtyList = [];
    var dirtyAll = true;
    var needsPresent = true;
    var lastGeometryKey = "";

    function clearDirty()
    {
        for(var i=0;i<dirtyList.length;i++)
            dirtyFlags[dirtyList[i]] = 0;

        dirtyList.length = 0;
    }

    function markAddress(address)
    {
        address &= 0x07FF;
        if(dirtyFlags[address]) return;

        dirtyFlags[address] = 1;
        dirtyList.push(address);
    }

    function geometry()
    {
        var state = host && typeof(host.getVideoState)=="function"
            ? host.getVideoState()
            : {};

        var columns = crtc ? crtc[1] & 0xFF : 80;
        var rows = crtc ? crtc[6] & 0x7F : 24;
        var scanlines = crtc ? ((crtc[9] & 0x1F) + 1) : 9;
        var cellWidth = state.cellWidth == 8 ? 8 : 9;
        var inverseVideoModification =
            state.inverseVideoModification === true;

        // Defensive limits only; normal VideoTerm firmware gives 80x24x9.
        if(columns<1 || columns>132) columns = 80;
        if(rows<1 || rows>64) rows = 24;
        if(scanlines<1 || scanlines>32) scanlines = 9;

        return {
             "columns":columns
            ,"rows":rows
            ,"scanlines":scanlines
            ,"cellWidth":cellWidth
            ,"start":crtc ? (((crtc[12]<<8) | crtc[13]) & 0x07FF) : 0
            ,"cursor":crtc ? (((crtc[14]<<8) | crtc[15]) & 0x07FF) : 0
            ,"cursorStart":crtc ? (crtc[10] & 0x1F) : 0
            ,"cursorEnd":crtc ? (crtc[11] & 0x1F) : 8
            ,"cursorMode":crtc ? ((crtc[10] >> 5) & 0x03) : 0
            ,"inverseVideoModification":inverseVideoModification
        };
    }

    function geometryKey(g)
    {
        return [
             g.columns
            ,g.rows
            ,g.scanlines
            ,g.cellWidth
            ,g.start
            ,g.cursor
            ,g.cursorStart
            ,g.cursorEnd
            ,g.cursorMode
            ,g.inverseVideoModification ? 1 : 0
        ].join(":");
    }

    function ensureLogicalCanvas(g)
    {
        if(!logicalCanvas)
        {
            if(typeof(document)=="undefined") return false;

            logicalCanvas = document.createElement("canvas");
            logicalCtx = logicalCanvas.getContext("2d");
        }

        var width = g.columns * g.cellWidth;
        var height = g.rows * g.scanlines;

        if(logicalCanvas.width != width || logicalCanvas.height != height)
        {
            logicalCanvas.width = width;
            logicalCanvas.height = height;
            logicalCtx = logicalCanvas.getContext("2d");
            logicalCtx.imageSmoothingEnabled = false;
            dirtyAll = true;
        }

        return true;
    }

    function cursorVisible(g)
    {
        /*
         * MC6845 cursor mode 01 suppresses the cursor. Modes 10/11 are blink
         * modes; this first stage renders them steadily and adds timing later.
         */
        return g.cursorMode != 1;
    }

    function drawCell(col,row,g)
    {
        var address = (g.start + row*g.columns + col) & 0x07FF;
        var x0 = col * g.cellWidth;
        var y0 = row * g.scanlines;

        var code = vram[address] & 0xFF;

        /*
         * With the documented inverse-video hardware modification installed,
         * firmware FLAGS bit 0 is stored in VRAM bit 7 for every character.
         * The hardware then interprets that bit as character polarity instead
         * of as an alternate-character-set selector.
         *
         * Fill the complete character cell with the selected background so a
         * 9-dot cell in inverse mode also inverts the ninth spacing column.
         */
        var inverseCell =
            g.inverseVideoModification &&
            ((code & 0x80) != 0);

        var phosphor = foregroundStyle();
        logicalCtx.fillStyle = inverseCell ? phosphor : "#000000";
        logicalCtx.fillRect(x0,y0,g.cellWidth,g.scanlines);


        /*
         * Character ROM metadata follows the ROM viewer: dsize describes one
         * glyph raster and mirror describes its horizontal bit orientation.
         * Current VideoTerm sets are 8x16, but keeping the metadata here avoids
         * hard-wiring the renderer to one ROM image.
         *
         */
        var dsize = charRomInfo && Array.isArray(charRomInfo.dsize)
            ? charRomInfo.dsize
            : [8,16];
        var glyphWidth = Math.max(1,Math.min(8,Number(dsize[0]) || 8));
        var glyphHeight = Math.max(1,Number(dsize[1]) || 16);
        var glyphBase = (code & 0x7F) * glyphHeight;

        /*
         * The VideoTerm manual notes that the character-bit inverse-video
         * modification sacrifices the hardware cursor.
         */
        var isCursor =
            !g.inverseVideoModification &&
            cursorVisible(g) &&
            address == g.cursor;

        logicalCtx.fillStyle = inverseCell ? "#000000" : phosphor;

        for(var raster=0;raster<g.scanlines;raster++)
        {
            var bits = charRom[
                glyphBase + (raster % glyphHeight)
            ] & 0xFF;

            if(isCursor &&
               raster>=g.cursorStart &&
               raster<=g.cursorEnd)
            {
                bits ^= 0xFF;
            }

            var pixels = Math.min(glyphWidth,g.cellWidth);


            for(var x=0;x<pixels;x++)
            {
                var mask = charRomInfo && charRomInfo.mirror
                    ? (1 << x)
                    : (0x80 >> x);

                if(bits & mask)
                    logicalCtx.fillRect(x0+x,y0+raster,1,1);
            }
        }
    }

    function present()
    {
        if(!displayCtx || !displayCtx.canvas || !logicalCanvas) return false;

        var canvas = displayCtx.canvas;
        displayCtx.save();
        /*
         * The native Normal Sync raster is 720x216 (80 x 9-dot cells).
         * RetroAppleJS' shared display canvas is smaller, so nearest-neighbour
         * downscaling can entirely drop one-pixel glyph strokes. Match the
         * proven Videx ROM viewer and use high-quality resampling here.
         */
        displayCtx.imageSmoothingEnabled = true;
        if(displayCtx.imageSmoothingQuality !== undefined)
            displayCtx.imageSmoothingQuality = "high";
        displayCtx.fillStyle = "#000000";
        displayCtx.fillRect(0,0,canvas.width,canvas.height);

        /*
         * Treat the control as display gain:
         *
         *   0..100%   -> attenuate the resampled VideoTerm image.
         *   100%      -> neutral.
         *   100..200% -> draw the resampled image a second time with additive
         *                blending. Full-white pixels saturate at white while
         *                gray interpolation pixels become brighter.
         *
         * Applying gain here, rather than making logical RGB values exceed
         * 255, is what allows values above 100% to have a visible effect.
         */
        var gain = Math.max(0,Math.min(200,displaySettings.contrast)) / 100;

        displayCtx.globalCompositeOperation = "source-over";
        displayCtx.globalAlpha = Math.min(1,gain);
        displayCtx.drawImage(
             logicalCanvas
            ,0,0,logicalCanvas.width,logicalCanvas.height
            ,0,0,canvas.width,canvas.height
        );

        if(gain>1)
        {
            displayCtx.globalCompositeOperation = "lighter";
            displayCtx.globalAlpha = gain-1;
            displayCtx.drawImage(
                 logicalCanvas
                ,0,0,logicalCanvas.width,logicalCanvas.height
                ,0,0,canvas.width,canvas.height
            );
        }

        displayCtx.restore();

        needsPresent = false;
        return true;
    }


    function flush(forcePresent)
    {
        if(!host || !vram || !crtc || !charRom) return false;
        var g = geometry();
        if(!ensureLogicalCanvas(g)) return false;

        var key = geometryKey(g);
        if(key != lastGeometryKey)
        {
            lastGeometryKey = key;
            dirtyAll = true;
        }

        var changed = false;

        if(dirtyAll)
        {
            clearDirty();

            logicalCtx.fillStyle = "#000000";
            logicalCtx.fillRect(
                0,0,
                logicalCanvas.width,
                logicalCanvas.height
            );

            for(var row=0;row<g.rows;row++)
                for(var col=0;col<g.columns;col++)
                    drawCell(col,row,g);

            dirtyAll = false;
            changed = true;
        }
        else
        {
            for(var i=0;i<dirtyList.length;i++)
            {
                var address = dirtyList[i];
                dirtyFlags[address] = 0;

                var delta = (address - g.start) & 0x07FF;
                if(delta >= g.columns*g.rows) continue;

                var row = Math.floor(delta/g.columns);
                var col = delta - row*g.columns;

                drawCell(col,row,g);
                changed = true;
            }

            dirtyList.length = 0;
        }

        if(changed || needsPresent || forcePresent===true)
            present();

        return changed || forcePresent===true;
    }

    this.setContext = function(ctx2)
    {
        displayCtx = ctx2 || null;
        needsPresent = true;
        return displayCtx;
    };

    this.bindHost = function(card)
    {
        host = card || null;

        vram = host && typeof(host.getVideoRAM)=="function"
            ? host.getVideoRAM()
            : null;

        crtc = host && typeof(host.getCRTCRegisters)=="function"
            ? host.getCRTCRegisters()
            : null;
        refreshCharacterROM();


        dirtyAll = true;
        needsPresent = true;
        lastGeometryKey = "";

        return !!(vram && crtc && charRom);
    };

    this.onVideoChange = function(change)
    {
        if(!change)
        {
            dirtyAll = true;
            needsPresent = true;
            return;
        }

        if(change.type=="charrom")
        {
            refreshCharacterROM();
            dirtyAll = true;
        }
        else if(change.type=="vram" && Number.isFinite(change.address))
            markAddress(change.address);
        else
            dirtyAll = true;

        needsPresent = true;
    };

    this.cycle = function(forcePresent)
    {
        return flush(forcePresent===true);
    };

    this.redraw = function()
    {
        dirtyAll = true;
        needsPresent = true;
        return flush();
    };

    this.reset = function()
    {
        clearDirty();
        dirtyAll = true;
        needsPresent = true;
        lastGeometryKey = "";
        return flush();
    };

    this.setContrast = function(value)
    {
        value = Math.max(0,Math.min(200,Number(value)));
        if(!Number.isFinite(value)) value = 100;

        if(displaySettings.contrast == value)
            return value;

        displaySettings.contrast = value;

        // Contrast/gain is a presentation-stage property; glyphs need no rebuild.
        needsPresent = true;
        return value;
    };

    this.setPhosphor = function(value)
    {
        value = String(value || "").toLowerCase();
        if(!PHOSPHOR_RGB[value]) value = "white";

        if(displaySettings.phosphor == value)
            return value;

        displaySettings.phosphor = value;
        dirtyAll = true;
        needsPresent = true;
        return value;
    };

    this.getDisplaySettings = function()
    {
        return {
             "contrast":displaySettings.contrast
            ,"phosphor":displaySettings.phosphor
        };
    };

    this.getGeometry = function()
    {
        return geometry();
    };

    this.getCharacterROMKind = function()
    {
        return charRomInfo
            ? charRomInfo.label+" ("+charRomInfo.key+")"
            : "character ROM unavailable";
    };
}
