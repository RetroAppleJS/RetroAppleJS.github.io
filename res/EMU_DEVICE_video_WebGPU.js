// Copyright (c) 2026 Freddy Vandriessche.
// Native II+ display; MUX owns device selection and captured-frame scheduling.

function Apple2VideoWebGPU(canvas)
{
    var video = this;
    var config = window.Apple2VideoWebGPU_CONFIG || {};
    var frameRate = Apple2VideoWebGPU.clampFrameRate(config.frameRate);
    var enabled = false, dirty = true, romDirty = true, paletteDirty = true;
    var gfx = false, mix = false, page2 = false, hires = false, chrome = 0;
    var flash = true, flashTicks = 0, frameTicks = 0;
    var pendingRaster = null, raf = null, initialization = null;
    var resources = null, resourceGeneration = 0, presentationGeneration = 0;
    var inFlight = 0, lastSubmit = -Infinity;
    var measurementStart = 0, submissions = 0, measuredRate = 0;
    var status = {state:"idle", message:"Not initialized"};
    var ramStaging = new Uint8Array(0x6000);
    var rasterStaging = new Uint8Array(15360);
    var params = new Uint32Array(8);
    var palette = new Float32Array(256);

    this.id =
    {
        DCODE:"A2WGPU", coID:"Apple2Video", hostPCODE:"A2BO", deviceIdx:4,
        icon:"fa fa-eye", description:"Apple II WebGPU video", deviceEnable:true
    };
    this.ctx = canvas;
    this.vidram = null;
    this.hw = null;
    this.frameTiming = "timer";
    this.charRom = Apple2CharROM_get("A2_US");
    this.charRomKey = "A2_US";
    this.onStatusChange = null;
    this.INTCols = new Uint8Array(Apple2VideoWebGPU.PALETTE);
    var names = ["Black","Magenta","Dark Blue","Purple","Dark Green","Grey 1",
        "Medium Blue","Light Blue","Brown","Orange","Grey 2","Pink","Light Green",
        "Yellow","Aquamarine","White"];
    var loresCols = [], hiresCols = [];
    for(var color=0;color<16;color++)
    {
        var row = [];
        for(var monitor=0;monitor<4;monitor++)
        {
            var offset = color*16+monitor*4;
            row.push("#"+Array.from(video.INTCols.subarray(offset,offset+3),function(value)
            {
                return value.toString(16).padStart(2,"0");
            }).join(""));
        }
        row.push(names[color]);
        loresCols.push(row);
    }
    [0,3,6,9,12,15].forEach(function(index) { hiresCols.push(loresCols[index]); });

    function nowMs()
    {
        return performance.now();
    }

    function clockHz()
    {
        return typeof(_o)!=="undefined" && Number.isFinite(_o.CPU_ClocksTicks_s)
            ? _o.CPU_ClocksTicks_s : 1000000;
    }

    function setStatus(state,message)
    {
        status = {state:state, message:message};
        Apple2VideoWebGPU.syncControls(video,measuredRate);
        if(typeof(video.onStatusChange)==="function") video.onStatusChange(video.getStatus());
    }

    function invalidatePresentation()
    {
        presentationGeneration++;
        if(raf!==null) window.cancelAnimationFrame(raf);
        raf = null;
        pendingRaster = null;
        dirty = true;
    }

    function releaseResources()
    {
        resourceGeneration++;
        if(resources)
        {
            resources.buffers.forEach(function(buffer) { buffer.destroy(); });
            resources.context.unconfigure();
            resources.device.destroy();
        }
        resources = null;
        inFlight = 0;
    }

    function fail(state,message)
    {
        invalidatePresentation();
        releaseResources();
        setStatus(state,message);
    }

    this.getStatus = function() { return {state:status.state, message:status.message}; };
    this.isReady = function() { return status.state==="ready" && resources!==null; };
    this.isAvailable = function()
    {
        return status.state!=="unavailable" && status.state!=="lost" && status.state!=="disposed";
    };

    async function initialize()
    {
        var generation = resourceGeneration;
        try
        {
            if(!navigator.gpu) throw new Error("WebGPU requires a supported browser and secure context");
            var adapter = await navigator.gpu.requestAdapter();
            if(!adapter) throw new Error("No WebGPU adapter available");
            var device = await adapter.requestDevice();
            if(generation!==resourceGeneration)
            {
                device.destroy();
                return false;
            }
            var context = canvas && canvas.getContext("webgpu");
            if(!context)
            {
                device.destroy();
                throw new Error("Unable to create WebGPU canvas context");
            }
            var format = navigator.gpu.getPreferredCanvasFormat();
            resources = {device:device, context:context, buffers:[]};
            var current = resources;
            device.lost.then(function()
            {
                if(resources===current) fail("lost","WebGPU device lost; select again to retry");
            });
            device.addEventListener("uncapturederror",function()
            {
                if(resources===current) fail("unavailable","WebGPU rendering error; select again to retry");
            });
            context.configure({device:device, format:format, alphaMode:"opaque"});
            function buffer(size,usage)
            {
                var result = device.createBuffer({size:size, usage:usage|GPUBufferUsage.COPY_DST});
                current.buffers.push(result);
                return result;
            }
            current.input = buffer(0x6000,GPUBufferUsage.STORAGE);
            current.romSize = Math.max(512,(video.charRom.length+3)&~3);
            current.rom = buffer(current.romSize,GPUBufferUsage.STORAGE);
            current.palette = buffer(1024,GPUBufferUsage.STORAGE);
            current.params = buffer(32,GPUBufferUsage.UNIFORM);
            var module = device.createShaderModule({code:Apple2VideoWebGPU.SHADER});
            var info = await module.getCompilationInfo();
            if(info.messages.some(function(message) { return message.type==="error"; }))
                throw new Error("Unable to compile WebGPU video shader");
            current.pipeline = await device.createRenderPipelineAsync(
            {
                layout:"auto",
                vertex:{module:module, entryPoint:"vertexMain"},
                fragment:{module:module, entryPoint:"fragmentMain", targets:[{format:format}]},
                primitive:{topology:"triangle-list"}
            });
            if(generation!==resourceGeneration || resources!==current) return false;
            updateBindGroup(current);
            romDirty = paletteDirty = dirty = true;
            setStatus("ready","Ready");
            return true;
        }
        catch(error)
        {
            if(generation===resourceGeneration)
                fail("unavailable",error.message || "WebGPU initialization failed");
            return false;
        }
    }

    this.activate = function()
    {
        if(status.state==="disposed") return Promise.resolve(false);
        enabled = true;
        if(video.isReady())
        {
            if(video.frameTiming!=="vblank") video.redraw();
            return Promise.resolve(true);
        }
        if(!initialization)
        {
            setStatus("initializing","Initializing WebGPU");
            initialization = initialize().finally(function() { initialization = null; });
        }
        return initialization.then(function(ready)
        {
            if(ready && enabled)
            {
                if(video.frameTiming==="vblank") submitPendingRaster();
                else video.redraw();
            }
            return ready;
        });
    };

    this.deactivate = function()
    {
        enabled = false;
        invalidatePresentation();
    };

    this.dispose = function()
    {
        video.deactivate();
        releaseResources();
        setStatus("disposed","Disposed");
    };

    this.reset = function()
    {
        invalidatePresentation();
        gfx = mix = page2 = hires = false;
        chrome = 0;
        flash = true;
        flashTicks = frameTicks = 0;
        lastSubmit = -Infinity;
        measurementStart = nowMs();
        submissions = measuredRate = 0;
    };

    this.setFrameTiming = function(mode)
    {
        if(video.frameTiming===mode) return;
        invalidatePresentation();
        video.frameTiming = mode;
    };

    function updateBindGroup(current)
    {
        current.bindGroup = current.device.createBindGroup(
        {
            layout:current.pipeline.getBindGroupLayout(0),
            entries:[
                {binding:0,resource:{buffer:current.input}},
                {binding:1,resource:{buffer:current.rom}},
                {binding:2,resource:{buffer:current.palette}},
                {binding:3,resource:{buffer:current.params}}
            ]
        });
    }

    function uploadColors(current)
    {
        for(var i=0;i<64;i++)
        {
            palette[i*4] = video.INTCols[i*4]/256;
            palette[i*4+1] = video.INTCols[i*4+1]/256;
            palette[i*4+2] = video.INTCols[i*4+2]/256;
            palette[i*4+3] = 1;
        }
        current.device.queue.writeBuffer(current.palette,0,palette);
        paletteDirty = false;
    }

    function recordSubmit()
    {
        lastSubmit = nowMs();
        if(!measurementStart) measurementStart = lastSubmit;
        submissions++;
        video.getFrameRateMeasured();
    }

    function submit(input,captured,monitor,flashOn)
    {
        if(!enabled || !video.isReady() || inFlight>=2) return false;
        var current = resources;
        try
        {
            var queue = current.device.queue;
            if(romDirty)
            {
                var padded = new Uint8Array(Math.max(512,(video.charRom.length+3)&~3));
                padded.set(video.charRom);
                if(padded.length>current.romSize)
                {
                    var previous = current.rom;
                    current.romSize = padded.length;
                    current.rom = current.device.createBuffer({size:current.romSize,
                        usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
                    current.buffers[current.buffers.indexOf(previous)] = current.rom;
                    updateBindGroup(current);
                    previous.destroy();
                }
                queue.writeBuffer(current.rom,0,padded);
                romDirty = false;
            }
            if(paletteDirty) uploadColors(current);
            params.set([captured?1:0,gfx?1:0,mix?1:0,page2?1:0,hires?1:0,monitor,flashOn?1:0,0]);
            queue.writeBuffer(current.input,0,input);
            queue.writeBuffer(current.params,0,params);
            var encoder = current.device.createCommandEncoder();
            var pass = encoder.beginRenderPass(
            {
                colorAttachments:[{view:current.context.getCurrentTexture().createView(),
                    clearValue:{r:0,g:0,b:0,a:1}, loadOp:"clear", storeOp:"store"}]
            });
            pass.setPipeline(current.pipeline);
            pass.setBindGroup(0,current.bindGroup);
            pass.draw(3);
            pass.end();
            queue.submit([encoder.finish()]);
            inFlight++;
            recordSubmit();
            queue.onSubmittedWorkDone().then(function()
            {
                if(resources!==current) return;
                inFlight--;
                // Pending input was cleared at invalidation. A released slot
                // can now service the current generation, even with a paused CPU.
                if(!enabled) return;
                if(video.frameTiming==="vblank") submitPendingRaster();
                else if(dirty) scheduleTimer();
            },function()
            {
                if(resources===current) fail("lost","WebGPU submission failed; select again to retry");
            });
            return true;
        }
        catch(error)
        {
            fail("unavailable","WebGPU submission failed; select again to retry");
            return false;
        }
    }

    function scheduleTimer()
    {
        if(raf!==null || !enabled || !video.isReady() || video.frameTiming==="vblank" || inFlight>=2) return;
        var generation = presentationGeneration;
        raf = window.requestAnimationFrame(function()
        {
            raf = null;
            if(generation!==presentationGeneration || !enabled || video.frameTiming==="vblank" || !dirty) return;
            if(nowMs()-lastSubmit<1000/frameRate)
            {
                scheduleTimer();
                return;
            }
            if(!video.vidram) return;
            // Hardware commits writes before this RAF; never mutate RAM here.
            ramStaging.set(video.vidram.subarray(0,0x6000));
            if(submit(ramStaging,false,chrome,flash)) dirty = false;
        });
    }

    this.redraw = function()
    {
        dirty = true;
        if(video.frameTiming!=="vblank") scheduleTimer();
    };

    function submitPendingRaster()
    {
        if(!pendingRaster || !enabled || !video.isReady() || video.frameTiming!=="vblank" || inFlight>=2) return;
        var pending = pendingRaster;
        pendingRaster = null;
        rasterStaging.set(pending.frame.bytes,0);
        rasterStaging.set(pending.frame.modes,7680);
        submit(rasterStaging,true,pending.chrome,pending.frame.flash);
    }

    this.presentRasterFrame = function(frame,state)
    {
        if(!enabled || video.frameTiming!=="vblank" || !frame ||
            frame.bytes.length!==7680 || frame.modes.length!==7680) return;
        pendingRaster = {frame:frame, chrome:state.chrome&3};
        submitPendingRaster();
    };

    this.cycle = function(ticks)
    {
        if(video.frameTiming==="vblank" || !Number.isFinite(ticks) || ticks<=0) return;
        flashTicks += ticks;
        frameTicks += ticks;
        var interval = clockHz()/4;
        var toggles = Math.floor(flashTicks/interval);
        flashTicks %= interval;
        if(toggles&1) { flash = !flash; dirty = true; }
        var frameInterval = clockHz()/frameRate;
        if(frameTicks>=frameInterval)
        {
            frameTicks %= frameInterval;
            if(dirty) scheduleTimer();
        }
    };

    this.addrVisible = function(addr)
    {
        var textBase = page2?0x800:0x400, hgrBase = page2?0x4000:0x2000;
        var low = addr&127;
        if(low>=120) return false;
        var bottom = low>=80 && ((addr>>7)&4)!==0;
        var text = addr>=textBase && addr<textBase+0x400;
        if(!gfx || !hires) return text;
        return (addr>=hgrBase && addr<hgrBase+0x2000 && (!mix || !bottom)) || (mix && text && bottom);
    };

    this.write = function(addr,value)
    {
        if(video.vidram && video.vidram[addr]!==value && video.addrVisible(addr)) dirty = true;
    };

    this.setGfx = function(flag) { if(gfx!==!!flag) { gfx=!!flag; dirty=true; } };
    this.setMix = function(flag) { if(mix!==!!flag) { mix=!!flag; dirty=true; } };
    this.setPage2 = function(flag) { if(page2!==!!flag) { page2=!!flag; dirty=true; } };
    this.setHires = function(flag) { if(hires!==!!flag) { hires=!!flag; dirty=true; } };
    this.setMonitor = function(mode)
    {
        chrome = mode&3;
        dirty = true;
        return {color:_CFG_CHROMA[chrome].COL_num || "#000000", name:_CFG_CHROMA[chrome].COL_name};
    };
    this.getChromeMode = function() { return chrome; };
    this.setCharRom = function(rom,key)
    {
        if(video.charRom!==rom || video.charRomKey!==key)
        {
            video.charRom = rom;
            video.charRomKey = key;
            romDirty = dirty = true;
        }
        return key;
    };
    this.getloresCols = function() { return loresCols; };
    this.gethiresCols = function() { return hiresCols; };
    this.setCol = function(index,column,value)
    {
        if(index<0 || index>=16 || column<0 || column>=4 || !/^#[0-9a-f]{6}$/i.test(value)) return false;
        loresCols[index][column] = value;
        for(var i=0;i<3;i++) video.INTCols[index*16+column*4+i] = parseInt(value.slice(1+i*2,3+i*2),16);
        paletteDirty = dirty = true;
        return value;
    };
    this.hgr_PixelColor = function(x,y,left,me,right,b7)
    {
        if(me && (left || right)) return loresCols[15][0];
        if(me) return loresCols[b7?(x&1?9:6):(x&1?12:3)][0];
        if(left && right) return loresCols[b7?(x&1?6:9):(x&1?3:12)][0];
        return loresCols[0][0];
    };
    this.getFrameRate = function() { return frameRate; };
    this.setFrameRate = function(value)
    {
        frameRate = Apple2VideoWebGPU.clampFrameRate(value);
        frameTicks = 0;
        video.redraw();
        return frameRate;
    };
    this.getFrameRateMeasured = function()
    {
        var now = nowMs(), elapsed = now-measurementStart;
        if(elapsed>=1000)
        {
            measuredRate = submissions*1000/elapsed;
            submissions = 0;
            measurementStart = now;
            Apple2VideoWebGPU.syncControls(video,measuredRate);
        }
        return measuredRate;
    };
    this.ctrl_dlg = function() { return Apple2VideoWebGPU.controls(video); };
}

Apple2VideoWebGPU.clampFrameRate = function(value)
{
    value = Number(value);
    return Number.isFinite(value)?Math.max(10,Math.min(60,value)):50;
};

Apple2VideoWebGPU.setFrameRateControl = function(input)
{
    var video = typeof(oApple2Video)!=="undefined" && oApple2Video
        ? oApple2Video.getRendererInstance("webgpu",false) : null;
    if(video)
    {
        input.value = video.setFrameRate(input.value);
        Apple2VideoWebGPU.syncControls(video,video.getFrameRateMeasured());
    }
};

Apple2VideoWebGPU.syncControls = function(video,measuredRate)
{
    var status = document.getElementById("webgpuStatus");
    if(status) status.textContent = video.getStatus().message;
    var rate = document.getElementById("webgpuFrameRateValue");
    if(rate) rate.textContent = Math.round(video.getFrameRate())+" fps";
    var measured = document.getElementById("webgpuFrameRateMeasured");
    if(measured) measured.textContent = Number(measuredRate || 0).toFixed(1)+" fps";
};

Apple2VideoWebGPU.controls = function(video)
{
    var rate = video?video.getFrameRate():50;
    var state = video?video.getStatus().state:"idle";
    return '<div class="appbut mini"><input type="range" min="10" max="60" step="5"'
        +' value="'+rate+'" class="slider" style="width:65px"'
        +' oninput="Apple2VideoWebGPU.setFrameRateControl(this)">'
        +' max frame rate <span id="webgpuFrameRateValue">'+rate+' fps</span>'
        +' | submitted <span id="webgpuFrameRateMeasured">'+(video?video.getFrameRateMeasured().toFixed(1):"0.0")+' fps</span>'
        +' | <span id="webgpuStatus">'+state+'</span></div><br>';
};
Apple2VideoWebGPU.ctrl_dlg = function() { return Apple2VideoWebGPU.controls(null); };

Apple2VideoWebGPU.SHADER = `
struct Parameters {
    captured: u32, gfx: u32, mix: u32, page2: u32,
    hires: u32, chrome: u32, flash: u32, padding: u32,
};
@group(0) @binding(0) var<storage, read> inputWords: array<u32>;
@group(0) @binding(1) var<storage, read> romWords: array<u32>;
@group(0) @binding(2) var<storage, read> palette: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: Parameters;

fn inputByte(index: u32) -> u32 {
    return (inputWords[index >> 2u] >> ((index & 3u)*8u)) & 255u;
}
fn romByte(index: u32) -> u32 {
    return (romWords[index >> 2u] >> ((index & 3u)*8u)) & 255u;
}
fn modeAt(col: u32, y: u32) -> u32 {
    if (params.captured != 0u) { return inputByte(7680u+y*40u+col); }
    if (params.gfx == 0u || (params.mix != 0u && y >= 160u)) { return 0u; }
    return 1u+params.hires;
}
fn byteAt(col: u32, y: u32, mode: u32) -> u32 {
    if (params.captured != 0u) { return inputByte(y*40u+col); }
    let row = ((y & 56u)<<4u)+(y/64u)*40u+col;
    if (mode == 2u) {
        return inputByte(8192u+params.page2*8192u+((y & 7u)<<10u)+row);
    }
    return inputByte(1024u+params.page2*1024u+row);
}
@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
    let positions = array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));
    return vec4<f32>(positions[index],0.0,1.0);
}
@fragment fn fragmentMain(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
    let x = u32(position.x)/2u;
    let y = u32(position.y)/2u;
    let col = x/7u;
    let bit = x-col*7u;
    let mode = modeAt(col,y);
    let d = byteAt(col,y,mode);
    var color = 0u;
    if (mode == 2u) {
        var left = 0u;
        var right = 0u;
        if (col > 0u) {
            if (modeAt(col-1u,y) == 2u) { left=byteAt(col-1u,y,2u); }
        }
        if (col < 39u) {
            if (modeAt(col+1u,y) == 2u) { right=byteAt(col+1u,y,2u); }
        }
        let bits = ((right & 127u)<<8u)|((d & 127u)<<1u)|((left>>6u)&1u);
        let b3 = (bits>>bit)&7u;
        let d1 = (36u>>b3)&1u;
        let d2 = (200u>>b3)&1u;
        // select avoids unsigned negative masks while retaining the raster kernel's six states.
        let dl = (1u+((((x^b3)<<1u)&2u)|(((x^b3)&1u)^(d>>7u)))) & select(0u,15u,d1 != 0u);
        color = (dl*3u)|select(0u,15u,d2 != 0u);
    } else if (mode == 1u) {
        color = (d>>(((y>>2u)&1u)*4u))&15u;
    } else {
        let glyph = romByte((((d&63u)^32u)*8u)+(y&7u));
        let attr = d>>6u;
        let on = ((glyph>>bit)&1u)^((1u>>attr)&1u)^((2u>>attr)&params.flash);
        color = on*15u;
    }
    return palette[color*4u+params.chrome];
}
`;

Apple2VideoWebGPU.PALETTE = [
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
       ];
