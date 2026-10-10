// Copyright (c) 2026 Freddy Vandriessche.
// Standalone raw-kernel benchmark. No emulator scheduling or hardware loop.
var ScreenGPUBenchmark =
{
    parseRates: function(text)
    {
        var rates = String(text).split(",").map(Number);
        if(rates.length>16 || rates.some(function(rate) { return !Number.isFinite(rate) || rate<1 || rate>50000; }))
            throw new Error("Rates must contain 1–16 FPS values between 1 and 50000");
        return Array.from(new Set(rates)).sort(function(a,b) { return a-b; });
    },

    summarize: function(rows,driver)
    {
        var points = rows.filter(function(row) { return row.driver===driver; });
        var rates = Array.from(new Set(points.map(function(row) { return row.targetFps; })))
            .filter(function(rate) { return rate!==null; }).sort(function(a,b) { return a-b; });
        var sustained = null, failed = null;
        rates.forEach(function(rate)
        {
            var passing = points.filter(function(row) { return row.targetFps===rate; })
                .every(function(row) { return row.metTarget; });
            if(passing && failed===null) sustained = rate;
            else if(!passing && failed===null) failed = rate;
        });
        return {sustainableFps:sustained,firstFailedFps:failed,
            maximumCompletedFps:points.length?Math.max.apply(null,points.map(function(row) { return row.completedFps; })):null};
    },

    percentile: function(values,fraction)
    {
        if(!values.length) return null;
        var sorted = Array.from(values).sort(function(a,b) { return a-b; });
        return sorted[Math.max(0,Math.ceil(sorted.length*fraction)-1)];
    },

    pause: function(milliseconds,signal)
    {
        return new Promise(function(resolve,reject)
        {
            var timer;
            function finish(error)
            {
                clearTimeout(timer);
                if(signal) signal.removeEventListener("abort",cancel);
                if(error) reject(error);else resolve();
            }
            function cancel() { finish(new Error("Benchmark cancelled")); }
            if(signal && signal.aborted) { cancel();return; }
            if(signal) signal.addEventListener("abort",cancel,{once:true});
            timer = setTimeout(function() { finish(); },milliseconds);
        });
    },

    createDriver: async function(kind,frame)
    {
        var dispatch;
        if(kind==="javascript")
            dispatch = function(count) { for(var i=0;i<count;i++) frame(i); };
        else if(kind==="wasm")
        {
            // Equivalent WAT is recorded in docs/SCREENGPU_BENCHMARK.md.
            // Only the dispatch loop is WASM; GPU.js and WebGL stay in JS.
            var body = [1,1,127,2,64,3,64,32,1,32,0,79,13,1,32,1,16,0,
                32,1,65,1,106,33,1,12,0,11,11,11];
            var bytes = new Uint8Array([
                0,97,115,109,1,0,0,0,
                1,5,1,96,1,127,0,
                2,13,1,3,101,110,118,5,102,114,97,109,101,0,0,
                3,2,1,0,7,7,1,3,114,117,110,0,1,
                10,body.length+2,1,body.length
            ].concat(body));
            var module = await WebAssembly.instantiate(bytes,{env:{frame:frame}});
            dispatch = module.instance.exports.run;
        }
        else throw new Error("Unknown dispatch driver");
        return {run:function(count)
        {
            if(!Number.isInteger(count) || count<0 || count>128) throw new Error("Invalid batch size");
            dispatch(count);
        }};
    },

    measurePoint: async function(adapter,kind,options)
    {
        var size = options.batchSize, duration = options.durationMs, target = options.targetFps;
        if(!Number.isInteger(size) || size<1 || size>128 || !Number.isFinite(duration) || duration<=0)
            throw new Error("Invalid benchmark duration or batch size");
        if(target!==null && (!Number.isFinite(target) || target<=0)) throw new Error("Invalid target FPS");
        var driver = await this.createDriver(kind,function(index) { adapter.draw(index); });
        if(adapter.resetSequence) adapter.resetSequence();
        for(var warm=0;warm<(options.warmupBatches || 0);warm++)
        {
            if(options.signal && options.signal.aborted) throw new Error("Benchmark cancelled");
            driver.run(size);
            await adapter.complete();
        }
        var start = adapter.now(), frames = 0, cpu = 0, latencies = [], deadline = start;
        while(adapter.now()-start<duration)
        {
            if(options.signal && options.signal.aborted) throw new Error("Benchmark cancelled");
            var begin = adapter.now();
            driver.run(size);
            cpu += adapter.now()-begin;
            // One outstanding batch. Never count submitted work as completed.
            await adapter.complete();
            latencies.push(adapter.now()-begin);
            frames += size;
            if(options.signal && options.signal.aborted) throw new Error("Benchmark cancelled");
            if(target!==null)
            {
                deadline += size*1000/target;
                await adapter.waitUntil(deadline,options.signal);
                if(options.signal && options.signal.aborted) throw new Error("Benchmark cancelled");
            }
        }
        var elapsed = adapter.now()-start, fps = frames*1000/elapsed;
        var p95 = this.percentile(latencies,0.95);
        return {
            driver:kind,targetFps:target,batchSize:size,frames:frames,elapsedMs:elapsed,
            completedFps:fps,cpuMsPerFrame:cpu/frames,
            latencyMedianMs:this.percentile(latencies,0.5),latencyP95Ms:p95,
            missedFrames:target===null?null:Math.max(0,Math.floor(target*elapsed/1000)-frames),
            metTarget:target===null?null:fps>=target*0.95 && p95<=size*1000/target
        };
    },

    capture: function(ram,mode,flash)
    {
        var bytes = new Uint8Array(7680), modes = new Uint8Array(7680);
        for(var y=0;y<192;y++) for(var col=0;col<40;col++)
        {
            var graphics = mode.gfx && !(mode.mix && y>=160), high = graphics && mode.hires;
            var row = ((y&0x38)<<4)+Math.floor(y/64)*40+col;
            var address = high?(mode.page2?0x4000:0x2000)+(y&7)*1024+row
                :(mode.page2?0x800:0x400)+row;
            bytes[y*40+col] = ram[address];
            modes[y*40+col] = graphics?(high?2:1):0;
        }
        return {bytes:bytes,modes:modes,flash:flash};
    },

    createRenderer: function(canvas,options)
    {
        var video = new Apple2VideoGPU(canvas);
        video.reset();
        video.setGfx(options.mode!=="text");
        video.setMix(options.mode.indexOf("mixed")===0);
        video.setHires(options.mode.indexOf("hires")>=0);
        video.setPage2(options.page2);
        video.setMonitor(options.chrome);
        video.setCharRom(Apple2CharROM_get(options.rom),options.rom);
        video.serial8[video.idx8("GFX_FLG")] = video.register_mode();
        video.serial8[video.idx8("CHROME_MODE")] = options.chrome;
        var pool = [], captures = [], sequence = 0, seed = 0x12345678;
        for(var frame=0;frame<32;frame++)
        {
            var ram = new Uint8Array(0x6000);
            for(var i=0;i<ram.length;i++)
            {
                seed = (Math.imul(seed,1664525)+1013904223)>>>0;
                ram[i] = seed>>>24;
            }
            pool.push(ram);
            captures.push(this.capture(ram,video.modes,!!(frame&1)));
        }
        if(options.input==="capture") video.rasterKernel = Apple2RasterCreateKernel(video.gpu,2);
        function draw()
        {
            var index = sequence++&31;
            if(options.input==="capture")
            {
                var picture = captures[index];
                video.rasterKernel(picture.bytes,picture.modes,video.charRom,video.INTCols,
                    options.chrome,picture.flash?1:0);
            }
            else
            {
                video.serial8[video.idx8("FLASH")] = index&1;
                video.kernel(options.snapshot?pool[index].slice():pool[index],video.charRom,video.serial8);
            }
        }
        // Compile and initialize the actual bundled GPU.js kernel before timing.
        draw();
        var kernel = options.input==="capture"?video.rasterKernel:video.kernel;
        var gl = kernel.kernel.context;
        var webgl2 = typeof(gl.fenceSync)==="function";
        var ext = gl.getExtension(webgl2?"EXT_disjoint_timer_query_webgl2":"EXT_disjoint_timer_query");
        var channel = new MessageChannel(), resume = null;
        channel.port1.onmessage = function()
        {
            var callback = resume; resume = null;
            if(callback) callback();
        };
        function yieldTask()
        {
            return new Promise(function(resolve) { resume = resolve; channel.port2.postMessage(0); });
        }
        function queryCreate() { return webgl2?gl.createQuery():ext.createQueryEXT(); }
        function queryBegin(query)
        {
            if(webgl2) gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
            else ext.beginQueryEXT(ext.TIME_ELAPSED_EXT,query);
        }
        function queryEnd()
        {
            if(webgl2) gl.endQuery(ext.TIME_ELAPSED_EXT);
            else ext.endQueryEXT(ext.TIME_ELAPSED_EXT);
        }
        function queryDelete(query) { if(webgl2) gl.deleteQuery(query); else ext.deleteQueryEXT(query); }
        function queryAvailable(query)
        {
            return webgl2?gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)
                :ext.getQueryObjectEXT(query,ext.QUERY_RESULT_AVAILABLE_EXT);
        }
        async function queryWait(query)
        {
            var start = performance.now();
            while(!queryAvailable(query))
            {
                if(gl.isContextLost()) throw new Error("WebGL context lost");
                if(performance.now()-start>10000) throw new Error("GPU completion timeout");
                await yieldTask();
            }
        }
        async function complete()
        {
            if(gl.isContextLost()) throw new Error("WebGL context lost");
            if(!webgl2)
            {
                // WebGL 1 has no fenceSync. Clearly report this blocking fallback.
                gl.finish();
                await yieldTask();
                return;
            }
            var sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
            if(!sync) throw new Error("Unable to create GPU completion fence");
            gl.flush();
            var begin = performance.now();
            try
            {
                while(true)
                {
                    await yieldTask();
                    var status = gl.clientWaitSync(sync,0,0);
                    if(status===gl.ALREADY_SIGNALED || status===gl.CONDITION_SATISFIED) return;
                    if(status===gl.WAIT_FAILED || gl.isContextLost()) throw new Error("GPU completion failed");
                    if(performance.now()-begin>10000) throw new Error("GPU completion timeout");
                }
            }
            finally { gl.deleteSync(sync); }
        }
        var adapter =
        {
            draw:draw,now:function() { return performance.now(); },complete:complete,
            resetSequence:function() { sequence = 0; },
            kernelSource:options.input==="capture"?Apple2RasterKernel.toString():video.kProcess_v6.toString(),
            snapshotPixels:function()
            {
                // Default framebuffer contents can expire after a browser task yield.
                // Redraw and read back in the same task, entirely outside measurements.
                if(gl.isContextLost()) throw new Error("WebGL context lost");
                draw();
                return kernel.getPixels();
            },
            waitUntil:async function(deadline,signal)
            {
                while(performance.now()<deadline)
                {
                    if(signal && signal.aborted) throw new Error("Benchmark cancelled");
                    var remaining = deadline-performance.now();
                    if(remaining>2) await ScreenGPUBenchmark.pause(remaining-1,signal);
                    else await yieldTask();
                }
            },
            info:{backend:webgl2?"WebGL2":"WebGL1",kernel:options.input==="capture"?"Apple2RasterKernel":"kProcess_v6",
                completion:webgl2?"asynchronous fence":"blocking gl.finish fallback",
                gpuTiming:!!ext,renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR)},
            profile:async function()
            {
                await complete();
                var uploadMs = 0, uploadBytes = 0, query = ext?queryCreate():null;
                var originals = {}, drawCount = 0;
                ["texImage2D","texSubImage2D","drawArrays"].forEach(function(name)
                {
                    originals[name] = gl[name];
                    gl[name] = function()
                    {
                        if(name==="drawArrays")
                        {
                            if(query && drawCount===0) queryBegin(query);
                            var result = originals[name].apply(gl,arguments);
                            if(query && drawCount===0) queryEnd();
                            drawCount++;
                            return result;
                        }
                        var begin = performance.now(), result = originals[name].apply(gl,arguments);
                        uploadMs += performance.now()-begin;
                        for(var i=0;i<arguments.length;i++)
                            if(ArrayBuffer.isView(arguments[i])) { uploadBytes += arguments[i].byteLength; break; }
                        return result;
                    };
                });
                var gpuMs = null;
                try
                {
                    draw();
                    await complete();
                    if(query && drawCount===1)
                    {
                        await queryWait(query);
                        if(!gl.getParameter(ext.GPU_DISJOINT_EXT))
                            gpuMs = (webgl2?gl.getQueryParameter(query,gl.QUERY_RESULT)
                                :ext.getQueryObjectEXT(query,ext.QUERY_RESULT_EXT))/1000000;
                    }
                    return {uploadCallMs:uploadMs,uploadBytes:uploadBytes,gpuDrawMs:gpuMs};
                }
                finally
                {
                    Object.keys(originals).forEach(function(name) { gl[name] = originals[name]; });
                    if(query) queryDelete(query);
                }
            },
            dispose:function()
            {
                channel.port1.close();channel.port2.close();
                video.setActive(false);
                return video.gpu.destroy();
            }
        };
        return adapter;
    }
};
