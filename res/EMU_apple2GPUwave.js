//
// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_apple2GPUwave.js
//
// First-phase Apple II HGR GPU renderer using the waveform/YIQ method from
// ScreenGPU_HGR_NTSC_stepE_v10_2.html.
//
// Scope of this first phase:
// - HGR page 1 ($2000-$3FFF) and HGR page 2 ($4000-$5FFF)
// - full-screen HGR only
// - no TEXT, LORES, or MIXED-mode rendering yet
// - fixed/default waveform parameters:
//      Y slope = 1.00, Y gain = 1.00, Chroma = 1.00, I' gain = 1.00, Q' gain = 1.00
//

if (typeof(oEMU) === "undefined")
    var oEMU = {"component":{"Video":{}}};
else if (oEMU.component === undefined)
    oEMU.component = {"Video":{}};
else if (oEMU.component.Video === undefined)
    oEMU.component.Video = {};

oEMU.component.Video.Apple2Video = new Apple2Video();

function Apple2Video(ctx)
{
    const bDebug_snd = false;

    const HGR_W = 280;
    const HGR_H = 192;
    const HGR_BYTES_PER_LINE = 40;
    const HGR_PAGE1 = 0x2000;
    const HGR_PAGE2 = 0x4000;
    const HGR_PAGE_SIZE = 0x2000;

    const HGR_OS = 4;                       // 4 waveform samples per HGR pixel
    const WAVE_W = HGR_W * HGR_OS;          // 1120 samples per line
    const WAVE_CHANNELS = 3;                // stacked Y, I', Q' planes
    const WAVE_H = HGR_H * WAVE_CHANNELS;   // 576 rows

    var gfx_mode;
    var mix_mode;
    var page2_mode;
    var hires_mode;
    var chrome_mode = 0;
    var flash_on = false;
    var flash_count = 0;
    var frame_count = 0;
    var frame_redraw = true;
    var hgr_linear_dirty = true;

    if (ctx) this.ctx = ctx;

    this.vidram = null; // apple2hw.js sets this to give me reference/copy of RAM
    this.hw = null;     // reserved for possible future direct hardware binding

    this.gpu = null;
    this.waveKernel = null;
    this.renderKernel = null;
    this.blackKernel = null;

    this.hgrLinear = new Uint8Array(HGR_H * HGR_BYTES_PER_LINE);

    // Fixed/default parameters from ScreenGPU_HGR_NTSC_stepE_v10_2.html.
    // cfg[0] ySlope, cfg[1] yGain, cfg[2] chromaGain, cfg[3] iGain, cfg[4] qGain
    this.cfg = new Float32Array([1.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0]);

    this.reset = function()
    {
        gfx_mode = false;
        mix_mode = false;
        page2_mode = false;
        hires_mode = false;
        chrome_mode = 0;
        flash_on = true;
        flash_count = 0;
        frame_count = 0;
        frame_redraw = true;
        hgr_linear_dirty = true;
        this.register_mode();

        if (this.ctx && !this.gpu)
            this.initGPU(this.ctx);
    };

    this.register_mode = function()
    {
        this.modes = {"gfx":gfx_mode,"mix":mix_mode,"page2":page2_mode,"hires":hires_mode,"chrome":chrome_mode};
        return (gfx_mode?1:2) + (mix_mode?8:4) + (page2_mode?32:16) + (hires_mode?128:64);
    };

    this.cycle = function()
    {
        frame_count++;

        // Keep the same low-frequency redraw gate style as EMU_apple2GPU.js,
        // but only submit GPU work when a visible HGR change or mode change happened.
        if (frame_count > 20000)
        {
            frame_count = 0;
            if (frame_redraw)
            {
                this.redraw();
                if (bDebug_snd) oEMU.component.IO.AppleSpeaker.toggle();
            }
        }
    };

    this.markDirty = function()
    {
        frame_redraw = true;
        hgr_linear_dirty = true;
    };

    this.write = function(addr, d8)
    {
        const a = addr & 0xFFFF;
        const v = d8 & 0xFF;

        // apple2hw.js currently gives video.vidram a slice at mount time.
        // Keep that local copy coherent enough for fallback use and avoid
        // marking dirty when the byte is unchanged.
        if (this.vidram && a < this.vidram.length)
        {
            if (this.vidram[a] === v) return;
            this.vidram[a] = v;
        }

        if (this.isHgrScreenByte(a))
        {
            hgr_linear_dirty = true;
            if (this.addrVisible(a))
                frame_redraw = true;
        }
    };

    this.setGfx = function(flag)
    {
        if (gfx_mode != flag)
        {
            gfx_mode = flag;
            frame_redraw = true;
            hgr_linear_dirty = true;
            this.register_mode();
        }
    };

    this.setMix = function(flag)
    {
        if (mix_mode != flag)
        {
            // Mixed mode is intentionally not rendered in this phase.
            // Track the switch for compatibility, but keep full-screen HGR output.
            mix_mode = flag;
            this.register_mode();
        }
    };

    this.setPage2 = function(flag)
    {
        if (page2_mode != flag)
        {
            page2_mode = flag;
            frame_redraw = true;
            hgr_linear_dirty = true;
            this.register_mode();
        }
    };

    this.setHires = function(flag)
    {
        if (hires_mode != flag)
        {
            hires_mode = flag;
            frame_redraw = true;
            hgr_linear_dirty = true;
            this.register_mode();
        }
    };

    this.isHgrScreenByte = function(addr)
    {
        const a = addr & 0xFFFF;
        const inHgr1 = ((a - HGR_PAGE1) >>> 0) < HGR_PAGE_SIZE;
        const inHgr2 = ((a - HGR_PAGE2) >>> 0) < HGR_PAGE_SIZE;

        // HGR screen holes: offsets 120..127 in each 128-byte block are invisible.
        return (inHgr1 || inHgr2) && ((a & 0x7F) < 0x78);
    };

    this.addrVisible = function(addr)
    {
        const a = addr & 0xFFFF;
        const hgrBase = page2_mode ? HGR_PAGE2 : HGR_PAGE1;

        // Only HGR is implemented in this first phase.  TEXT/LORES writes are ignored.
        if (!(gfx_mode && hires_mode)) return false;

        // HGR page range selected by PAGE1/PAGE2 soft switch.
        if (((a - hgrBase) >>> 0) >= HGR_PAGE_SIZE) return false;

        return this.isHgrScreenByte(a);
    };

    this.setMonitor = function(mode)
    {
        chrome_mode = mode & 3;
        this.register_mode();

        // The waveform renderer is color-only for now; keep UI compatibility.
        if (typeof(_CFG_CHROMA) !== "undefined" && _CFG_CHROMA[chrome_mode])
            return {"color":_CFG_CHROMA[chrome_mode].COL_num?_CFG_CHROMA[chrome_mode].COL_num:"#000000", "name":_CFG_CHROMA[chrome_mode].COL_name};

        return {"color":"#000000", "name":"Color"};
    };

    this.getChromeMode = function() { return chrome_mode; };
    this.getloresCols = function() { return loresCols; };
    this.gethiresCols = function() { return hiresCols; };
    this.setCol = function(idx,column,val) { return loresCols[idx][column] = val; };

    // Retain the old palette helpers for UI compatibility, even though the
    // actual HGR path below is waveform/YIQ based and does not use this table.
    var loresCols = [
        ["#000000","#000000","#000000","#000000","Black"]
       ,["#901740","#4D4D4D","#304D48","#4C4631","Magenta"]
       ,["#402CA5","#5B5B5B","#395B56","#5A5239","Dark Blue"]
       ,["#D143E6","#A8A8A8","#69A89E","#A6986A","Purple"]
       ,["#006940","#383838","#233835","#383324","Dark Green"]
       ,["#808080","#808080","#508078","#7E7451","Grey 1"]
       ,["#2F96E6","#8E8E8E","#598E85","#8C8059","Medium Blue"]
       ,["#BFABFF","#CECECE","#81CEC2","#CBBA82","Light Blue"]
       ,["#405400","#313131","#1F312E","#312D1F","Brown"]
       ,["#D06B1A","#717171","#47716B","#706748","Orange"]
       ,["#808080","#808080","#508078","#7E7451","Grey 2"]
       ,["#FF96BF","#C7C7C7","#7DC7BB","#C4B47D","Pink"]
       ,["#30BD1B","#575757","#375752","#564F37","Light Green"]
       ,["#BFD35A","#A4A4A4","#67A49A","#A29568","Yellow"]
       ,["#6FE8BF","#B2B2B2","#70B2A8","#B0A170","Aquamarine"]
       ,["#FFFFFF","#FFFFFF","#A0FFF0","#FCE7A1","White"]
    ];

    var hiresCols = [loresCols[0], loresCols[3], loresCols[6], loresCols[9], loresCols[12], loresCols[15]];

    this.hgr_PixelColor = function(x, y, left, me, right, b7)
    {
        var a0 = x & 0x01;
        if (me != 0 && (left != 0 || right != 0)) return loresCols[15][0];
        else if (me != 0)
        {
            if (b7 != 0) return a0 ? loresCols[9][0] : loresCols[6][0];
            else         return a0 ? loresCols[12][0] : loresCols[3][0];
        }
        else if (left != 0 && right != 0)
        {
            if (b7 != 0) return a0 ? loresCols[6][0] : loresCols[9][0];
            else         return a0 ? loresCols[3][0] : loresCols[12][0];
        }
        return loresCols[0][0];
    };

    this.initGPU = function(canvas)
    {
        const outW = canvas.width || 560;
        const outH = canvas.height || 384;
        const xScale = Math.max(1, (outW / HGR_W) | 0);
        const yScale = Math.max(1, (outH / HGR_H) | 0);

        this.gpu = createGPUInstance({canvas:canvas, mode:"gpu"});

        this.waveKernel = this.gpu.createKernel(function(hgr, cfg)
        {
            // x = 0..1119: four 14M-ish waveform samples per visible HGR pixel.
            // y = stacked plane index: 0..191 Y, 192..383 I', 384..575 Q'.
            const sx = this.thread.x;
            const wy = this.thread.y;
            const ch = (wy / 192) | 0;
            const y = wy - ch * 192;
            const rowBase = y * 40;

            const xp0 = sx >> 2;
            const xByte0 = (xp0 / 7) | 0;
            const b0 = hgr[rowBase + xByte0];

            // Apple II HGR bit 7 shifts this 7-pixel group by one 14M sample.
            const delay = (b0 >> 7) & 1;
            let dsx = sx - delay;
            if (dsx < 0) dsx = 0;

            const dxp = dsx >> 2;
            const sub = dsx & 3;
            const f = (sub + 0.5) * 0.25;

            let p = dxp;
            let bx = (p / 7) | 0;
            let bt = p - bx * 7;
            const cur = (hgr[rowBase + bx] >> bt) & 1;

            p = dxp - 1;
            if (p < 0) p = 0;
            bx = (p / 7) | 0;
            bt = p - bx * 7;
            const prev = (hgr[rowBase + bx] >> bt) & 1;

            p = dxp + 1;
            if (p > 279) p = 279;
            bx = (p / 7) | 0;
            bt = p - bx * 7;
            const next = (hgr[rowBase + bx] >> bt) & 1;

            const yRaw = cur > 0 ? 1.0 : 0.0;
            const ySlope = 0.5 * yRaw + 0.5 * ((1.0 - f) * prev + f * next);
            let yOut = yRaw * (1.0 - cfg[0]) + ySlope * cfg[0];

            if (yOut < 0.0) yOut = 0.0;
            if (yOut > 1.0) yOut = 1.0;

            let chroma = yRaw - 0.5 * (prev + next);
            if (chroma < 0.0001)
            {
                if (chroma > -0.0001) chroma = 0.0;
            }

            const xByte = (dxp / 7) | 0;
            const b = hgr[rowBase + xByte];
            const hi = (b >> 7) & 1;
            const hiF = hi === 1 ? 1.0 : 0.0;
            const sign = 1.0 - 2.0 * (dxp & 1);

            if (ch === 0) return yOut;

            if (ch === 1)
            {
                // I' family: sign intentionally flipped, as in Step E v10.2.
                return -chroma * sign * hiF;
            }

            // Q' family unchanged.
            return chroma * sign * (1.0 - hiF);
        }, {
            output:[WAVE_W, WAVE_H],
            pipeline:true,
            immutable:true
        });

        this.renderKernel = this.gpu.createKernel(function(wave, cfg)
        {
            // Native HGR coordinate behind this canvas pixel.
            const xp = (this.thread.x / this.constants.XS) | 0;
            const yp = 191 - ((this.thread.y / this.constants.YS) | 0);

            // Each native HGR pixel owns 4 waveform samples.
            const sx = xp << 2;

            // Small 3-tap luma filter around the first sample of the HGR pixel.
            let pxm1 = sx - 1;
            if (pxm1 < 0) pxm1 = 0;
            const pxp1 = sx + 1;

            let yy = wave[yp][pxm1] * 0.25 + wave[yp][sx] * 0.50 + wave[yp][pxp1] * 0.25;
            yy = yy * cfg[1];

            // Four samples span one carrier cycle in this simplified model.
            let ii = 0.0;
            let qq = 0.0;

            for (let k = -2; k <= 1; k++)
            {
                let px = sx + k;
                if (px < 0) px = 0;

                ii += wave[192 + yp][px];
                qq += wave[384 + yp][px];
            }

            ii = ii * 0.25 * cfg[2] * cfg[3];
            qq = qq * 0.25 * cfg[2] * cfg[4];

            // YIQ -> RGB
            const r = yy + 0.956 * ii + 0.621 * qq;
            const g = yy - 0.272 * ii - 0.647 * qq;
            const b = yy - 1.106 * ii + 1.703 * qq;

            this.color(r, g, b, 1.0);
        }, {
            output:[outW, outH],
            graphical:true,
            constants:{XS:xScale, YS:yScale}
        });

        this.blackKernel = this.gpu.createKernel(function()
        {
            this.color(0.0, 0.0, 0.0, 1.0);
        }, {
            output:[outW, outH],
            graphical:true
        });
    };

    this.redraw = function()
    {
        if (!this.gpu || !this.waveKernel || !this.renderKernel) return;

        this.register_mode();

        // No TEXT, LORES, or MIXED-mode rendering in this first phase.
        
        /*
        if (!(gfx_mode && hires_mode))
        {
            this.blackKernel();
            frame_redraw = false;
            return;
        }
        */

        this.ensureLinearHgr();

        const wave = this.waveKernel(this.hgrLinear, this.cfg);
        this.renderKernel(wave, this.cfg);

        frame_redraw = false;
    };

    this.ensureLinearHgr = function()
    {
        if (!hgr_linear_dirty) return;

        const mem = this.getVideoMemory();
        linearizeHgrPage(mem, this.hgrLinear, page2_mode ? HGR_PAGE2 : HGR_PAGE1);
        hgr_linear_dirty = false;
    };

    this.getVideoMemory = function()
    {
        // Normal integrated emulator path.
        if (typeof(apple2plus) === "object" && apple2plus && apple2plus.hwObj)
        {
            const hw = apple2plus.hwObj();
            if (hw && hw.safe_videodump) return hw.safe_videodump();
            if (hw && hw.safe_flashdump) return hw.safe_flashdump();
        }

        // Fallback paths for tests or alternate integration.
        if (this.hw && this.hw.safe_videodump) return this.hw.safe_videodump();
        if (this.hw && this.hw.safe_flashdump) return this.hw.safe_flashdump();
        if (this.vidram) return this.vidram;

        return new Uint8Array(0x6000);
    };

    function linearizeHgrPage(mem, out, pageBase)
    {
        for (let y = 0; y < HGR_H; y++)
        {
            const adr_ofs = ((y << 4) & 0x0380) | ((y >> 3) & 0x18) | ((y >> 1) & 0x60);
            const rowBase = pageBase + ((y << 10) & 0x1C00) + adr_ofs;
            const dstBase = y * HGR_BYTES_PER_LINE;

            for (let xb = 0; xb < HGR_BYTES_PER_LINE; xb++)
                out[dstBase + xb] = rowBase + xb < mem.length ? mem[rowBase + xb] : 0;
        }
    }

    function createGPUInstance(options)
    {
        try { return new window.GPU.GPU(options || {}); }
        catch (e) { return new GPU(options || {}); }
    }
}
