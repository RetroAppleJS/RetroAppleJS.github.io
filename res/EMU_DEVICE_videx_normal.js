//
// Videx VideoTerm - Normal Sync renderer
//
// First renderer stage:
// - MC6845 drives geometry/start/cursor.
// - VideoTerm VRAM remains authoritative.
// - The standard U20 character ROM is the sole character source in this stage.
// - VRAM bit 7 is ignored until an alternate character ROM is deliberately added.
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

        logicalCtx.fillStyle = "#000000";
        logicalCtx.fillRect(x0,y0,g.cellWidth,g.scanlines);

        var code = vram[address] & 0xFF;

        /*
         * The standard U20 ROM contains 128 glyphs x 16 raster bytes.
         * Use VRAM bits 0-6 as the glyph index. Bit 7 is deliberately ignored
         * in this stage because no alternate character ROM is installed.
         */
        var glyphBase = (code & 0x7F) << 4;
        var isCursor = cursorVisible(g) && address == g.cursor;

        logicalCtx.fillStyle = "#FFFFFF";

        for(var raster=0;raster<g.scanlines;raster++)
        {
            var bits = charRom[glyphBase + (raster & 0x0F)] & 0xFF;

            if(isCursor &&
               raster>=g.cursorStart &&
               raster<=g.cursorEnd)
            {
                bits ^= 0xFF;
            }

            var pixels = Math.min(8,g.cellWidth);

            // Videx ROM glyphs use the high-order bit at the left edge.
            for(var x=0;x<pixels;x++)
                if(bits & (0x80 >> x))
                    logicalCtx.fillRect(x0+x,y0+raster,1,1);
        }
    }

    function present()
    {
        if(!displayCtx || !displayCtx.canvas || !logicalCanvas) return false;

        var canvas = displayCtx.canvas;
        displayCtx.save();
        displayCtx.imageSmoothingEnabled = false;
        displayCtx.fillStyle = "#000000";
        displayCtx.fillRect(0,0,canvas.width,canvas.height);
        displayCtx.drawImage(
             logicalCanvas
            ,0,0,logicalCanvas.width,logicalCanvas.height
            ,0,0,canvas.width,canvas.height
        );
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

        charRom = host && typeof(host.getNormalCharacterROM)=="function"
            ? host.getNormalCharacterROM()
            : null;


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

        if(change.type=="vram" && Number.isFinite(change.address))
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

    this.getGeometry = function()
    {
        return geometry();
    };

    this.getCharacterROMKind = function()
    {
        return "standard U20 character ROM";
    };
}
