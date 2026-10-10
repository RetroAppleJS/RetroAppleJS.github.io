// Copyright (c) 2026 Freddy Vandriessche.
// Standalone raw WebGPU benchmark. No emulator scheduling or hardware loop.
var ScreenWEBGPUBenchmark = Object.create(ScreenGPUBenchmark);

ScreenWEBGPUBenchmark.parameters = function(options,captured,flash)
{
    var mode = options.mode;
    return new Uint32Array([
        captured?1:0,
        mode!=="text"?1:0,
        mode.indexOf("mixed")===0?1:0,
        options.page2?1:0,
        mode.indexOf("hires")>=0?1:0,
        options.chrome&3,
        flash?1:0,
        0
    ]);
};

ScreenWEBGPUBenchmark.createInputPools = function(options)
{
    var ramPool = [], capturePool = [], seed = 0x12345678;
    var mode = {gfx:options.mode!=="text",mix:options.mode.indexOf("mixed")===0,
        hires:options.mode.indexOf("hires")>=0,page2:!!options.page2};
    for(var frame=0;frame<32;frame++)
    {
        var ram = new Uint8Array(0x6000);
        for(var index=0;index<ram.length;index++)
        {
            seed = (Math.imul(seed,1664525)+1013904223)>>>0;
            ram[index] = seed>>>24;
        }
        var picture = ScreenGPUBenchmark.capture(ram,mode,!!(frame&1));
        var packed = new Uint8Array(15360);
        packed.set(picture.bytes);
        packed.set(picture.modes,7680);
        ramPool.push(ram);
        capturePool.push(packed);
    }
    return {ram:ramPool,capture:capturePool};
};

ScreenWEBGPUBenchmark.createPalette = function(bytes)
{
    var palette = new Float32Array(256);
    for(var index=0;index<64;index++)
    {
        palette[index*4] = bytes[index*4]/256;
        palette[index*4+1] = bytes[index*4+1]/256;
        palette[index*4+2] = bytes[index*4+2]/256;
        palette[index*4+3] = 1;
    }
    return palette;
};

ScreenWEBGPUBenchmark.timestampMilliseconds = function(begin,end)
{
    if(typeof(begin)!=="bigint" || typeof(end)!=="bigint" || end<begin) return null;
    return Number(end-begin)/1000000;
};

ScreenWEBGPUBenchmark.awaitCompletion = async function(work,failure)
{
    // Chromium rejects onSubmittedWorkDone when the outstanding work loses its device.
    // The separate signal catches an already-reported loss/error with a clearer message.
    var outcome = await Promise.race([
        failure.then(function(message) { return {error:message || "WebGPU device lost"}; }),
        work.then(function() { return {done:true}; },function(error)
        {
            return {error:error && error.message || String(error)};
        })
    ]);
    if(outcome.error) throw new Error(outcome.error);
};

ScreenWEBGPUBenchmark.createRenderer = async function(canvas,options)
{
    if(!navigator.gpu) throw new Error("WebGPU requires a supported browser and secure context");
    var adapter = await navigator.gpu.requestAdapter();
    if(!adapter) throw new Error("No WebGPU adapter available");
    var timerAvailable = adapter.features.has("timestamp-query");
    var device = await adapter.requestDevice({requiredFeatures:timerAvailable?["timestamp-query"]:[]});
    var context = canvas.getContext("webgpu");
    if(!context)
    {
        device.destroy();
        throw new Error("Unable to create WebGPU canvas context");
    }
    var format = navigator.gpu.getPreferredCanvasFormat();
    var resources = [], disposed = false, lost = null, sequence = 0, configured = false;
    var failCompletion, failure = new Promise(function(resolve) { failCompletion = resolve; });
    function fail(message)
    {
        if(lost) return;
        lost = message || "WebGPU device lost";
        failCompletion(lost);
    }
    try
    {
        context.configure({device:device,format:format,alphaMode:"opaque",
            usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
        configured = true;
        device.lost.then(function(info) { if(!disposed) fail(info.message); });
        device.addEventListener("uncapturederror",function(event)
        {
            if(!disposed) fail(event.error && event.error.message || "WebGPU rendering error");
        });
        function buffer(size,usage)
        {
            var result = device.createBuffer({size:size,usage:usage});
            resources.push(result);
            return result;
        }
        var inputBuffer = buffer(0x6000,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST);
        var rom = Apple2CharROM_get(options.rom), romBytes = new Uint8Array(Math.max(512,(rom.length+3)&~3));
        romBytes.set(rom);
        var romBuffer = buffer(romBytes.length,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST);
        var palette = ScreenWEBGPUBenchmark.createPalette(Apple2VideoWebGPU.PALETTE);
        var paletteBuffer = buffer(1024,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST);
        var parameterBuffer = buffer(32,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
        device.queue.writeBuffer(romBuffer,0,romBytes);
        device.queue.writeBuffer(paletteBuffer,0,palette);
        var module = device.createShaderModule({code:Apple2VideoWebGPU.SHADER});
        var compilation = await module.getCompilationInfo();
        var errors = compilation.messages.filter(function(message) { return message.type==="error"; });
        if(errors.length)
        {
            throw new Error("Unable to compile WebGPU video shader: "+errors[0].message);
        }
        var pipeline = await device.createRenderPipelineAsync(
        {
            layout:"auto",
            vertex:{module:module,entryPoint:"vertexMain"},
            fragment:{module:module,entryPoint:"fragmentMain",targets:[{format:format}]},
            primitive:{topology:"triangle-list"}
        });
        var bindGroup = device.createBindGroup(
        {
            layout:pipeline.getBindGroupLayout(0),
            entries:[
                {binding:0,resource:{buffer:inputBuffer}},
                {binding:1,resource:{buffer:romBuffer}},
                {binding:2,resource:{buffer:paletteBuffer}},
                {binding:3,resource:{buffer:parameterBuffer}}
            ]
        });
        var pools = ScreenWEBGPUBenchmark.createInputPools(options);
        function check()
        {
            if(disposed) throw new Error("WebGPU benchmark disposed");
            if(lost) throw new Error(lost);
        }
        function nextInput()
        {
            var index = sequence++&31;
            var input = options.input==="capture"?pools.capture[index]:pools.ram[index];
            if(options.snapshot && options.input==="ram") input = input.slice();
            return {input:input,params:ScreenWEBGPUBenchmark.parameters(options,
                options.input==="capture",!!(index&1))};
        }
        function encode(encoder,texture,timestamp)
        {
            var descriptor = {colorAttachments:[{view:texture.createView(),
                clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]};
            if(timestamp) descriptor.timestampWrites = {querySet:timestamp,
                beginningOfPassWriteIndex:0,endOfPassWriteIndex:1};
            var pass = encoder.beginRenderPass(descriptor);
            pass.setPipeline(pipeline);
            pass.setBindGroup(0,bindGroup);
            pass.draw(3);
            pass.end();
        }
        function upload(frame)
        {
            device.queue.writeBuffer(inputBuffer,0,frame.input);
            device.queue.writeBuffer(parameterBuffer,0,frame.params);
            return frame.input.byteLength+frame.params.byteLength;
        }
        function draw()
        {
            check();
            upload(nextInput());
            var encoder = device.createCommandEncoder();
            encode(encoder,context.getCurrentTexture());
            device.queue.submit([encoder.finish()]);
        }
        async function complete()
        {
            check();
            await ScreenWEBGPUBenchmark.awaitCompletion(device.queue.onSubmittedWorkDone(),failure);
            check();
        }
        async function profile()
        {
            await complete();
            var frame = nextInput(), uploadBegin = performance.now();
            var uploadBytes = upload(frame), uploadCallMs = performance.now()-uploadBegin;
            var completionBegin = performance.now();
            await ScreenWEBGPUBenchmark.awaitCompletion(device.queue.onSubmittedWorkDone(),failure);
            var uploadCompletionMs = performance.now()-completionBegin;
            var gpuDrawMs = null, query = null, resolve = null, read = null;
            try
            {
                var encoder = device.createCommandEncoder();
                if(timerAvailable)
                {
                    query = device.createQuerySet({type:"timestamp",count:2});
                    resolve = device.createBuffer({size:16,
                        usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC});
                    read = device.createBuffer({size:16,
                        usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
                    encode(encoder,context.getCurrentTexture(),query);
                    encoder.resolveQuerySet(query,0,2,resolve,0);
                    encoder.copyBufferToBuffer(resolve,0,read,0,16);
                }
                else encode(encoder,context.getCurrentTexture());
                device.queue.submit([encoder.finish()]);
                await complete();
                if(read)
                {
                    await read.mapAsync(GPUMapMode.READ);
                    var ticks = new BigUint64Array(read.getMappedRange().slice(0));
                    read.unmap();
                    gpuDrawMs = ScreenWEBGPUBenchmark.timestampMilliseconds(ticks[0],ticks[1]);
                }
                return {uploadCallMs:uploadCallMs,uploadBytes:uploadBytes,
                    uploadCompletionMs:uploadCompletionMs,gpuDrawMs:gpuDrawMs};
            }
            finally
            {
                if(query) query.destroy();
                if(resolve) resolve.destroy();
                if(read) read.destroy();
            }
        }
        async function snapshotPixels()
        {
            check();
            var frame = nextInput();upload(frame);
            var bytesPerRow = 2304;
            var read = device.createBuffer({size:bytesPerRow*384,
                usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
            try
            {
                var encoder = device.createCommandEncoder(), texture = context.getCurrentTexture();
                encode(encoder,texture);
                encoder.copyTextureToBuffer({texture:texture},{buffer:read,bytesPerRow:bytesPerRow},
                    {width:560,height:384,depthOrArrayLayers:1});
                device.queue.submit([encoder.finish()]);
                await complete();
                await read.mapAsync(GPUMapMode.READ);
                var source = new Uint8Array(read.getMappedRange()), pixels = new Uint8ClampedArray(560*384*4);
                for(var y=0;y<384;y++) for(var x=0;x<560;x++)
                {
                    var from = y*bytesPerRow+x*4, to = (y*560+x)*4;
                    if(format.indexOf("bgra")===0)
                    {
                        pixels[to] = source[from+2];pixels[to+1] = source[from+1];pixels[to+2] = source[from];
                    }
                    else
                    {
                        pixels[to] = source[from];pixels[to+1] = source[from+1];pixels[to+2] = source[from+2];
                    }
                    pixels[to+3] = source[from+3];
                }
                read.unmap();
                return pixels;
            }
            finally { read.destroy(); }
        }
        var adapterInfo = adapter.info || {};
        return {
            draw:draw,complete:complete,profile:profile,snapshotPixels:snapshotPixels,
            now:function() { return performance.now(); },
            waitUntil:async function(deadline,signal)
            {
                while(performance.now()<deadline)
                {
                    if(signal && signal.aborted) throw new Error("Benchmark cancelled");
                    var remaining = deadline-performance.now();
                    if(remaining>2) await ScreenWEBGPUBenchmark.pause(remaining-1,signal);
                    else await new Promise(function(resolve) { setTimeout(resolve,0); });
                }
            },
            resetSequence:function() { sequence = 0; },
            kernelSource:Apple2VideoWebGPU.SHADER,
            info:{backend:"WebGPU",kernel:"Apple2VideoWebGPU.SHADER",
                completion:"queue.onSubmittedWorkDone",gpuTiming:timerAvailable,
                renderer:adapterInfo.description || adapterInfo.device || "WebGPU adapter",
                vendor:adapterInfo.vendor || "unreported",format:format},
            dispose:async function()
            {
                if(disposed) return;
                try { await device.queue.onSubmittedWorkDone(); } catch(error) {}
                disposed = true;
                resources.forEach(function(resource) { resource.destroy(); });
                context.unconfigure();
                device.destroy();
            }
        };
    }
    catch(error)
    {
        resources.forEach(function(resource) { resource.destroy(); });
        if(configured) context.unconfigure();
        device.destroy();
        throw error;
    }
};
