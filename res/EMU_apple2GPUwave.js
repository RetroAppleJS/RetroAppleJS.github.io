//
// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_apple2GPUwave.js
//
// First-phase Apple II HGR GPU renderer using the waveform/YIQ method from
// ScreenGPU_HGR_NTSC_stepE_v10_2.html.
//
// Scope:
// - HGR page 1 ($2000-$3FFF) and HGR page 2 ($4000-$5FFF)
// - waveform/YIQ rendering for HGR graphics
// - deterministic GPU rendering for TEXT, LORES, and mixed-mode text/lores areas
// - configurable waveform parameters, with defaults defined once below.
//
// Optional configuration before loading this file:
//   window.Apple2VideoWave_CONFIG = {
//       ySlope: 1.00,
//       yGain: 1.00,
//       chromaGain: 1.00,
//       iGain: 1.00,
//       qGain: 1.00
//   };
//

var APPLE2_GPUWAVE_CFG_DEFAULT =
{
    ySlope: 1.00,
    yGain: 1.00,
    chromaGain: 1.00,
    iGain: 1.00,
    qGain: 1.00
};

var APPLE2_GPUWAVE_PARAM_SPEC =
{
    ySlope:    { index:0, min:0.00, max:1.00 },
    yGain:     { index:1, min:0.50, max:1.50 },
    chromaGain:{ index:2, min:0.00, max:2.00 },
    iGain:     { index:3, min:0.00, max:2.00 },
    qGain:     { index:4, min:0.00, max:2.00 }
};

function Apple2VideoWave_copyConfig()
{
    var cfg = {}, user = window.Apple2VideoWave_CONFIG || {};
    for (var key in APPLE2_GPUWAVE_CFG_DEFAULT)
        cfg[key] = APPLE2_GPUWAVE_CFG_DEFAULT[key];
    for (var userKey in user)
        cfg[userKey] = user[userKey];
    return cfg;
}

function Apple2VideoWave_clampParameter(key,value)
{
    var spec = APPLE2_GPUWAVE_PARAM_SPEC[key];
    value = Number(value);

    if (!spec)
        return isFinite(value) ? value : 0;

    if (!isFinite(value))
        value = Number(APPLE2_GPUWAVE_CFG_DEFAULT[key]);

    if (!isFinite(value))
        value = 0;

    return Math.max(spec.min,Math.min(spec.max,value));
}

function Apple2VideoWave_getControlInstance()
{
    if (typeof(oApple2Video) === "undefined" || oApple2Video === null ||
        typeof(oApple2Video.getRendererInstance) !== "function")
        return null;

    return oApple2Video.getRendererInstance("wave",true);
}

function Apple2VideoWave_setParameterControl(input,key,labelId)
{
    var rendererWave = Apple2VideoWave_getControlInstance();
    if (!rendererWave || typeof(rendererWave.setWaveParameter) !== "function")
        return;

    var value = rendererWave.setWaveParameter(key,Number(input.value)/100);
    input.value = Math.round(value*100);

    var output = document.getElementById(labelId);
    if (output)
        output.textContent = Number(value).toFixed(2);
}

function Apple2VideoWave_setYSlopeControl(input)
{
    Apple2VideoWave_setParameterControl(input,"ySlope","waveYSlopeValue");
}

function Apple2VideoWave_setYGainControl(input)
{
    Apple2VideoWave_setParameterControl(input,"yGain","waveYGainValue");
}

function Apple2VideoWave_setChromaControl(input)
{
    Apple2VideoWave_setParameterControl(input,"chromaGain","waveChromaValue");
}

function Apple2VideoWave_controls(rendererWave)
{
    var ySlope = rendererWave && typeof(rendererWave.getYSlope) === "function"
        ? rendererWave.getYSlope()
        : APPLE2_GPUWAVE_CFG_DEFAULT.ySlope;
    var yGain = rendererWave && typeof(rendererWave.getYGain) === "function"
        ? rendererWave.getYGain()
        : APPLE2_GPUWAVE_CFG_DEFAULT.yGain;
    var chroma = rendererWave && typeof(rendererWave.getChromaGain) === "function"
        ? rendererWave.getChromaGain()
        : APPLE2_GPUWAVE_CFG_DEFAULT.chromaGain;

    return "<div class=\"appbut mini\">"
        +"<input id=\"waveYSlope\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\""+Math.round(ySlope*100)+"\" class=\"slider\""
        +" oninput=\"Apple2VideoWave_setYSlopeControl(this)\" style=\"width:65px;float:left\"></input>"
        +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">Y slope "
        +"<span id=\"waveYSlopeValue\">"+Number(ySlope).toFixed(2)+"</span></div>"
        +"</div><br>"

        +"<div class=\"appbut mini\">"
        +"<input id=\"waveYGain\" type=\"range\" min=\"50\" max=\"150\" step=\"1\" value=\""+Math.round(yGain*100)+"\" class=\"slider\""
        +" oninput=\"Apple2VideoWave_setYGainControl(this)\" style=\"width:65px;float:left\"></input>"
        +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">Y gain "
        +"<span id=\"waveYGainValue\">"+Number(yGain).toFixed(2)+"</span></div>"
        +"</div><br>"

        +"<div class=\"appbut mini\">"
        +"<input id=\"waveChroma\" type=\"range\" min=\"0\" max=\"200\" step=\"1\" value=\""+Math.round(chroma*100)+"\" class=\"slider\""
        +" oninput=\"Apple2VideoWave_setChromaControl(this)\" style=\"width:65px;float:left\"></input>"
        +"<div style=\"float:left;border:0px solid;padding:2px 0px 0px 10px;\">Chroma "
        +"<span id=\"waveChromaValue\">"+Number(chroma).toFixed(2)+"</span></div>"
        +"</div><br>";
}

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
    var renderCfg = Apple2VideoWave_copyConfig();

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
    this.renderKernel = null;       // full-screen HGR wave renderer
    this.mixedWaveKernel = null;    // HGR top via wave + mixed-mode text bottom
    this.deterministicKernel = null;// TEXT / LORES / deterministic fallback renderer
    this.blackKernel = null;

    this.hgrLinear = new Uint8Array(HGR_H * HGR_BYTES_PER_LINE);

    // cfg[0] ySlope, cfg[1] yGain, cfg[2] chromaGain, cfg[3] iGain, cfg[4] qGain
    this.cfg = new Float32Array([
        Apple2VideoWave_clampParameter("ySlope",renderCfg.ySlope),
        Apple2VideoWave_clampParameter("yGain",renderCfg.yGain),
        Apple2VideoWave_clampParameter("chromaGain",renderCfg.chromaGain),
        Apple2VideoWave_clampParameter("iGain",renderCfg.iGain),
        Apple2VideoWave_clampParameter("qGain",renderCfg.qGain),
        0.0, 0.0, 0.0
    ]);

    this.getWaveParameter = function(key)
    {
        var spec = APPLE2_GPUWAVE_PARAM_SPEC[key];
        if (!spec)
            return 0;

        var value = Number(this.cfg[spec.index]);
        return isFinite(value)
            ? value
            : Apple2VideoWave_clampParameter(key,renderCfg[key]);
    };

    this.setWaveParameter = function(key,value)
    {
        var spec = APPLE2_GPUWAVE_PARAM_SPEC[key];
        if (!spec)
            return 0;

        value = Apple2VideoWave_clampParameter(key,value);
        renderCfg[key] = value;
        this.cfg[spec.index] = value;
        frame_redraw = true;

        if (this.gpu && typeof(this.redraw) === "function")
            this.redraw();

        return value;
    };

    this.getYSlope = function()
    {
        return this.getWaveParameter("ySlope");
    };

    this.setYSlope = function(value)
    {
        return this.setWaveParameter("ySlope",value);
    };

    this.getYGain = function()
    {
        return this.getWaveParameter("yGain");
    };

    this.setYGain = function(value)
    {
        return this.setWaveParameter("yGain",value);
    };

    this.getChromaGain = function()
    {
        return this.getWaveParameter("chromaGain");
    };

    this.setChromaGain = function(value)
    {
        return this.setWaveParameter("chromaGain",value);
    };   

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

        // Keep the same redraw cadence as EMU_apple2GPU.js.
        // The extra flash branch matters for TEXT mode, because flashing chars
        // must redraw even when RAM is otherwise unchanged.
        if (frame_count > 20000)
        {
            if (frame_redraw)
            {
                frame_count = 0;
                this.redraw();
                if (bDebug_snd) oEMU.component.IO.AppleSpeaker.toggle();
            }
            else if (frame_count > 200000)
            {
                flash_on = !flash_on;
                frame_count = 0;
                frame_redraw = true;
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

        // apple2hw.js currently gives video.vidram a slice/copy at mount time.
        // Keep that local copy coherent enough for fallback use and avoid
        // marking dirty when the byte is unchanged.
        if (this.vidram && a < this.vidram.length)
        {
            if (this.vidram[a] === v) return;
            this.vidram[a] = v;
        }

        if (this.isHgrScreenByte(a))
            hgr_linear_dirty = true;

        if (this.addrVisible(a))
            frame_redraw = true;
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
            mix_mode = flag;
            frame_redraw = true;
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
        const lo7 = a & 0x7F;

        // Apple II screen holes: last 8 bytes of each 128-byte block.
        const scrByte = lo7 < 0x78;

        // HGR renderer reads neighbouring bytes for artifact/edge decisions.
        const hgrByte = scrByte | (lo7 == 0x78) | (lo7 == 0x7F);

        // row >= 20 test for mixed-mode text bottom / hidden graphics bottom.
        const mixBottom = ((lo7 >= 0x50) & ((a >> 7) & 4));

        const txtBase = page2_mode ? 0x0800 : 0x0400;
        const hgrBase = page2_mode ? HGR_PAGE2 : HGR_PAGE1;

        const inTxt = ((a - txtBase) >>> 0) < 0x0400;
        const inHgr = ((a - hgrBase) >>> 0) < HGR_PAGE_SIZE;

        if (!gfx_mode)                // TEXT
            return inTxt & scrByte;

        if (!hires_mode)              // LORES / mixed LORES
            return inTxt & scrByte;

        // HIRES / mixed HIRES
        return (inHgr & hgrByte & (!mix_mode | !mixBottom)) |
               (mix_mode & inTxt & scrByte & mixBottom);
    };

    this.setMonitor = function(mode)
    {
        chrome_mode = mode & 3;
        frame_redraw = true;
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

    this.INTCols = new Uint8Array([
        0X00,0X00,0X00,0X0,0x00,0x00,0x00,0x0,0x00,0x00,0x00,0x0,0x00,0x00,0x00,0x0  // Black
       ,0X90,0X17,0X40,0X0,0x4D,0x4D,0x4D,0x0,0x30,0x4D,0x48,0x0,0x4C,0x46,0x31,0x0  // Magenta
       ,0X40,0X2C,0XA5,0X0,0x5B,0x5B,0x5B,0x0,0x39,0x5B,0x56,0x0,0x5A,0x52,0x39,0x0  // Dark Blue
       ,0XD0,0X43,0XE5,0X0,0xA8,0xA8,0xA8,0x0,0x69,0xA8,0x9E,0x0,0xA6,0x98,0x6A,0x0  // Purple
       ,0X00,0X69,0X40,0X0,0x38,0x38,0x38,0x0,0x23,0x38,0x35,0x0,0x38,0x33,0x24,0x0  // Dark Green
       ,0X80,0X80,0X80,0X0,0x80,0x80,0x80,0x0,0x50,0x80,0x78,0x0,0x7E,0x74,0x51,0x0  // Grey 1
       ,0X2F,0X95,0XE5,0X0,0x8E,0x8E,0x8E,0x0,0x59,0x8E,0x85,0x0,0x8C,0x80,0x59,0x0  // Medium Blue
       ,0XBF,0XAB,0XFF,0X0,0xCE,0xCE,0xCE,0x0,0x81,0xCE,0xC2,0x0,0xCB,0xBA,0x82,0x0  // Light Blue
       ,0X40,0X54,0X00,0X0,0x31,0x31,0x31,0x0,0x1F,0x31,0x2E,0x0,0x31,0x2D,0x1F,0x0  // Brown
       ,0XD0,0X6A,0X1A,0X0,0x71,0x71,0x71,0x0,0x47,0x71,0x6B,0x0,0x70,0x67,0x48,0x0  // Orange
       ,0X80,0X80,0X80,0X0,0x80,0x80,0x80,0x0,0x50,0x80,0x78,0x0,0x7E,0x74,0x51,0x0  // Grey 2
       ,0XFF,0X96,0XBF,0X0,0xC7,0xC7,0xC7,0x0,0x7D,0xC7,0xBB,0x0,0xC4,0xB4,0x7D,0x0  // Pink
       ,0X2F,0XBC,0X1A,0X0,0x57,0x57,0x57,0x0,0x37,0x57,0x52,0x0,0x56,0x4F,0x37,0x0  // Light Green
       ,0XBF,0XD3,0X5A,0X0,0xA4,0xA4,0xA4,0x0,0x67,0xA4,0x9A,0x0,0xA2,0x95,0x68,0x0  // Yellow  
       ,0X6F,0XE8,0XBF,0X0,0xB2,0xB2,0xB2,0x0,0x70,0xB2,0xA8,0x0,0xB0,0xA1,0x70,0x0  // Aquamarine
       ,0XFF,0XFF,0XFF,0X0,0xFF,0xFF,0xFF,0x0,0xA0,0xFF,0xF0,0x0,0xFC,0xE7,0xA1,0x0  // White
       ]);

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
        // Match ScreenGPU_HGR_NTSC_stepE_v10_2 exactly:
        // - visible CSS box remains 560x384
        // - GPU graphical output/backing store is 1120x768
        // - render coordinates use >> 2 to map 1120x768 back to 280x192 HGR.
        //
        // The same GPU output size is used for TEXT/LORES as well.  This keeps
        // GPU.js from resizing the canvas between modes and avoids the old
        // 280x256-small-image symptom.
        const DISPLAY_W = 560;
        const DISPLAY_H = 384;
        const GPU_W = DISPLAY_W << 1;   // 1120
        const GPU_H = DISPLAY_H << 1;   // 768

        if (canvas && canvas.style)
        {
            canvas.style.width = DISPLAY_W + "px";
            canvas.style.height = DISPLAY_H + "px";
            canvas.style.display = "block";
            canvas.style.imageRendering = "pixelated";
            canvas.style.background = "#000";
        }

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
            // v10_2 geometry: the GPU output is 1120x768, but the visible
            // Apple II screen remains 560x384. Each native HGR pixel therefore
            // occupies 4x4 GPU threads, which CSS scales down to a 2x2 screen pixel.
            const xp = this.thread.x >> 2;
            const yp = 191 - (this.thread.y >> 2);

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
            output:[GPU_W, GPU_H],
            graphical:true
        });

        this.mixedWaveKernel = this.gpu.createKernel(function(wave, mem, rom, pal, cfg, GFX_FLG, CHROME_MODE, FLASH)
        {
            // Composite renderer used only for HIRES mixed mode:
            // - top 160 native scanlines are HGR wave/YIQ
            // - bottom 32 native scanlines are deterministic TEXT
            //
            // The old deterministic logic is kept in the non-HIRES branch so
            // the mixed-mode decision follows EMU_apple2GPU.js exactly.
            const xp = this.thread.x >> 2;
            const yp = 191 - (this.thread.y >> 2);

            const x7 = xp+1+(xp+1+(xp+1>>3)>>3)>>3;
            const m7 = xp-(x7<<3)+x7;
            const adr_ofs = yp<<4 & 0x380 | yp>>3 & 0x18 | yp>>1 & 0x60;

            const PAGE  = (GFX_FLG & 48) << 9;
            const MIX   = ((1^(yp+0x60>>8) & (GFX_FLG>>3)) | (GFX_FLG>>2)) & 1;
            const HIRES = (GFX_FLG & GFX_FLG>>7 & MIX) & 1;
            const LORES = (GFX_FLG & GFX_FLG>>6 & MIX) & 1;

            if (HIRES == 1)
            {
                const sx = xp << 2;

                let pxm1 = sx - 1;
                if (pxm1 < 0) pxm1 = 0;
                const pxp1 = sx + 1;

                let yy = wave[yp][pxm1] * 0.25 + wave[yp][sx] * 0.50 + wave[yp][pxp1] * 0.25;
                yy = yy * cfg[1];

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

                const r = yy + 0.956 * ii + 0.621 * qq;
                const g = yy - 0.272 * ii - 0.647 * qq;
                const b = yy - 1.106 * ii + 1.703 * qq;

                this.color(r, g, b, 1.0);
            }
            else if (LORES == 1)
            {
                const adr = (PAGE>>3) + adr_ofs + x7;
                const d8 = mem[adr];
                const y4 = (yp>>2&1)<<2;
                let cp = (CHROME_MODE << 2);
                cp += ((d8>>y4&15)<<4);
                this.color(pal[cp]/256.0, pal[cp+1]/256.0, pal[cp+2]/256.0, 1.0);
            }
            else
            {
                const adr   = (PAGE>>3) + adr_ofs + x7;
                const d8    = mem[adr];
                const offs  = ((d8 & 0x3F) ^ 0x20) << 3;
                const cbyte = rom[offs + (yp&7)];
                const infl  = d8>>6 & 3;
                const rgb   = (cbyte>>m7&1) ^ (0b001>>infl&1) ^ (0b010>>infl&FLASH);
                let cp = (CHROME_MODE << 2);
                cp += (rgb<<8) - (rgb<<4);
                this.color(pal[cp]/256.0, pal[cp+1]/256.0, pal[cp+2]/256.0, 1.0);
            }
        }, {
            output:[GPU_W, GPU_H],
            graphical:true
        });

        this.deterministicKernel = this.gpu.createKernel(function(mem, rom, pal, GFX_FLG, CHROME_MODE, FLASH)
        {
            // Deterministic TEXT/LORES renderer, adapted from EMU_apple2GPU.js
            // but using the same 1120x768 v10_2 output geometry as the wave
            // HGR path.
            const xp = this.thread.x >> 2;
            const yp = 191 - (this.thread.y >> 2);

            const x7 = xp+1+(xp+1+(xp+1>>3)>>3)>>3;
            const m7 = xp-(x7<<3)+x7;
            const adr_ofs = yp<<4 & 0x380 | yp>>3 & 0x18 | yp>>1 & 0x60;

            const PAGE  = (GFX_FLG & 48) << 9;
            const MIX   = ((1^(yp+0x60>>8) & (GFX_FLG>>3)) | (GFX_FLG>>2)) & 1;
            const HIRES = (GFX_FLG & GFX_FLG>>7 & MIX) & 1;
            const LORES = (GFX_FLG & GFX_FLG>>6 & MIX) & 1;

            let cp = (CHROME_MODE << 2);

            if (HIRES == 1)
            {
                // Deterministic HGR fallback, kept for safety.  In normal use,
                // full HGR and mixed-HGR top are rendered by the wave kernels.
                const adr  = PAGE + (yp<<10 & 0x1C00 | adr_ofs) + x7;
                const b171 = (0x7F & mem[adr+1])<<8  | (0x7F & mem[adr])<<1 | (mem[adr-1]>>6 & 1);
                const b3   = b171>>m7&7;
                const d1   = 0b100100>>b3&1;
                const d2   = 0b11001000>>b3&1;
                const dl   = 1+((xp^b3)<<1&2|(xp^b3)&1^mem[adr]>>7)&(d1<<4)-d1;
                cp += (dl+(dl<<1) | (d2<<4)-d2)<<4;
            }
            else if (LORES == 1)
            {
                const adr = (PAGE>>3) + adr_ofs + x7;
                const d8 = mem[adr];
                const y4 = (yp>>2&1)<<2;
                cp += ((d8>>y4&15)<<4);
            }
            else
            {
                const adr   = (PAGE>>3) + adr_ofs + x7;
                const d8    = mem[adr];
                const offs  = ((d8 & 0x3F) ^ 0x20) << 3;
                const cbyte = rom[offs + (yp&7)];
                const infl  = d8>>6 & 3;
                const rgb   = (cbyte>>m7&1) ^ (0b001>>infl&1) ^ (0b010>>infl&FLASH);
                cp += (rgb<<8) - (rgb<<4);
            }

            this.color(pal[cp]/256.0, pal[cp+1]/256.0, pal[cp+2]/256.0, 1.0);
        }, {
            output:[GPU_W, GPU_H],
            graphical:true
        });

        this.blackKernel = this.gpu.createKernel(function()
        {
            this.color(0.0, 0.0, 0.0, 1.0);
        }, {
            output:[GPU_W, GPU_H],
            graphical:true
        });
    };

    this.redraw = function()
    {
        if (!this.gpu || !this.waveKernel || !this.renderKernel || !this.deterministicKernel || !this.mixedWaveKernel) return;

        const mode = this.register_mode();
        const mem = this.getVideoMemory();
        const chr = (typeof(apple2CharRom) !== "undefined") ? apple2CharRom : new Uint8Array(2048);
        const flash = flash_on ? 1 : 0;

        if (gfx_mode && hires_mode)
        {
            this.ensureLinearHgr();

            const wave = this.waveKernel(this.hgrLinear, this.cfg);

            if (mix_mode)
                this.mixedWaveKernel(wave, mem, chr, this.INTCols, this.cfg, mode, chrome_mode, flash);
            else
                this.renderKernel(wave, this.cfg);
        }
        else
        {
            // TEXT, LORES, and mixed LORES use the deterministic GPU renderer.
            // No waveform/YIQ pass is submitted for these modes.
            this.deterministicKernel(mem, chr, this.INTCols, mode, chrome_mode, flash);
        }

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

    this.ctrl_dlg = function()
    {
        return Apple2VideoWave_controls(this);
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

Apple2Video.ctrl_dlg = function()
{
    return Apple2VideoWave_controls(null);
};