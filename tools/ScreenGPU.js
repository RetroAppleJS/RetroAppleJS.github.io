// Copyright (c) 2026 Freddy Vandriessche.
var ScreenGPUApp =
{
    running:false,results:[],controller:null,metadata:null,
    element:function(id) { return document.getElementById(id); },
    number:function(value,digits) { return value===null || value===undefined?"N/A":Number(value).toFixed(digits===undefined?2:digits); },

    readOptions:function()
    {
        var e = this.element;
        return {mode:e("mode").value,input:e("input").value,driver:e("driver").value,
            chrome:Number(e("chrome").value),rom:e("rom").value,page2:e("page2").checked,
            snapshot:e("snapshot").checked,rates:ScreenGPUBenchmark.parseRates(e("rates").value),
            batchSize:Number(e("batch").value),durationMs:Number(e("duration").value)*1000,
            repeats:Number(e("repeats").value),uncapped:e("uncapped").checked,profile:e("profile").checked};
    },

    run:async function(options)
    {
        if(this.running) return;
        options = options || this.readOptions();
        if(!Number.isInteger(options.repeats) || options.repeats<1 || options.repeats>5 ||
            !Number.isInteger(options.batchSize) || options.batchSize<1 || options.batchSize>128 ||
            !Number.isFinite(options.durationMs) || options.durationMs<100 || options.durationMs>30000)
            throw new Error("Check batch size, duration and repetitions");
        options.rates = ScreenGPUBenchmark.parseRates(options.rates.join(","));
        if(options.input==="capture") options.snapshot = false;
        var app = this, adapter = null;
        this.running = true;this.results = [];this.controller = new AbortController();
        var signal = this.controller.signal;
        this.element("settings").querySelectorAll("input,select").forEach(function(input) { input.disabled = true; });
        this.element("run").disabled = true;this.element("stop").disabled = false;
        this.element("csv").disabled = this.element("json").disabled = true;
        this.element("measurements").textContent = "";
        this.renderResults();
        this.metadata = {version:1,started:new Date().toISOString(),userAgent:navigator.userAgent,
            resolution:[560,384],options:options,cancelled:false};
        try
        {
            this.element("status").textContent = "Compiling and warming the GPU.js kernel…";
            // A canvas context cannot change after creation. Use a fresh canvas per run.
            var previous = this.element("applescreen"), canvas = previous.cloneNode(false);
            previous.replaceWith(canvas);
            adapter = ScreenGPUBenchmark.createRenderer(canvas,options);
            this.metadata.capabilities = adapter.info;
            this.element("capabilities").textContent = adapter.info.backend+" · "+adapter.info.kernel+" · "+
                adapter.info.completion+" · GPU timer: "+(adapter.info.gpuTiming?"available":"unavailable")+
                " · "+options.mode+" / "+options.input+" / page "+(options.page2?2:1)+" / "+options.rom+
                " · "+adapter.info.renderer;
            this.element("source").textContent = adapter.kernelSource;
            var drivers = options.driver==="both"?["javascript","wasm"]:[options.driver];
            var rates = options.rates.slice();if(options.uncapped) rates.push(null);
            async function measure(rate,step)
            {
                for(var repeat=0;repeat<options.repeats;repeat++)
                {
                    var order = (repeat+step)&1?drivers.slice().reverse():drivers;
                    for(var driver of order)
                    {
                        app.element("status").textContent = driver+" · "+(rate===null?"MAX":rate+" FPS")+
                            " · repetition "+(repeat+1)+"/"+options.repeats;
                        var row = await ScreenGPUBenchmark.measurePoint(adapter,driver,
                            {targetFps:rate,durationMs:options.durationMs,batchSize:options.batchSize,
                                warmupBatches:3,signal:signal});
                        row.repeat = repeat+1;
                        if(options.profile)
                        {
                            var profiles = [];
                            for(var sample=0;sample<3;sample++)
                            {
                                if(signal.aborted) throw new Error("Benchmark cancelled");
                                profiles.push(await adapter.profile());
                            }
                            row.uploadCallMs = ScreenGPUBenchmark.percentile(profiles.map(function(p) { return p.uploadCallMs; }),0.5);
                            row.uploadBytes = ScreenGPUBenchmark.percentile(profiles.map(function(p) { return p.uploadBytes; }),0.5);
                            var gpu = profiles.map(function(p) { return p.gpuDrawMs; }).filter(function(t) { return t!==null; });
                            row.gpuDrawMs = ScreenGPUBenchmark.percentile(gpu,0.5);
                        }
                        else row.uploadCallMs = row.uploadBytes = row.gpuDrawMs = null;
                        app.results.push(row);app.addRow(row);app.renderResults();
                        if(signal.aborted) throw new Error("Benchmark cancelled");
                    }
                }
            }
            for(var step=0;step<rates.length;step++) await measure(rates[step],step);
            // Two bisections of the first saturation bracket for each driver.
            var visited = new Set(rates);
            for(var refinement=0;refinement<2;refinement++)
            {
                var extra = [];
                drivers.forEach(function(driver)
                {
                    var summary = ScreenGPUBenchmark.summarize(app.results,driver);
                    if(summary.sustainableFps!==null && summary.firstFailedFps!==null)
                    {
                        var midpoint = Math.round((summary.sustainableFps+summary.firstFailedFps)/2);
                        if(!visited.has(midpoint)) { visited.add(midpoint);extra.push(midpoint); }
                    }
                });
                for(var rate of extra) await measure(rate,rates.length+refinement);
            }
            this.element("status").textContent = "Complete. Export the results to compare machines or runs.";
            return this.results;
        }
        catch(error)
        {
            this.metadata.cancelled = signal.aborted;
            this.element("status").textContent = signal.aborted?"Stopped. Partial results retained.":"Test failed: "+error.message;
            if(!signal.aborted) throw error;
            return this.results;
        }
        finally
        {
            if(adapter)
            {
                try
                {
                    // One final preview render/readback after timing.
                    var preview = this.element("applescreen"), frozen = preview.cloneNode(false);
                    frozen.getContext("2d").putImageData(new ImageData(
                        new Uint8ClampedArray(adapter.snapshotPixels()),560,384),0,0);
                    preview.replaceWith(frozen);
                }
                catch(error) { this.metadata.previewError = error.message; }
                finally
                {
                    try { await adapter.dispose(); }
                    catch(error) { this.metadata.cleanupError = error.message; }
                }
            }
            this.running = false;
            this.element("settings").querySelectorAll("input,select").forEach(function(input) { input.disabled = false; });
            this.element("snapshot").disabled = this.element("input").value==="capture";
            this.element("run").disabled = false;this.element("stop").disabled = true;
            this.element("csv").disabled = this.element("json").disabled = !this.results.length;
        }
    },

    addRow:function(row)
    {
        var tr = document.createElement("tr"), app = this;
        var values = [row.driver+" / "+row.repeat,row.targetFps===null?"MAX":row.targetFps,
            this.number(row.completedFps,1),this.number(row.cpuMsPerFrame,3),this.number(row.latencyMedianMs),
            this.number(row.latencyP95Ms),this.number(row.uploadCallMs,3),
            row.uploadBytes===null?"N/A":this.number(row.uploadBytes/1024),this.number(row.gpuDrawMs,3),
            row.missedFrames===null?"N/A":row.missedFrames,row.metTarget===null?"N/A":row.metTarget?"Yes":"No"];
        values.forEach(function(value,index)
        {
            var td = document.createElement("td");td.textContent = value;
            if(index===10) td.className = row.metTarget?"pass":"fail";
            tr.appendChild(td);
        });
        app.element("measurements").appendChild(tr);
    },

    renderResults:function()
    {
        var app = this, summaries = [];
        ["javascript","wasm"].forEach(function(driver)
        {
            if(!app.results.some(function(row) { return row.driver===driver; })) return;
            var s = ScreenGPUBenchmark.summarize(app.results,driver);
            summaries.push(driver+": sustainable tested rate "+(s.sustainableFps===null?"not established":s.sustainableFps+" FPS")+
                "; first failing rate "+(s.firstFailedFps===null?"not reached":s.firstFailedFps+" FPS")+
                "; maximum completed "+app.number(s.maximumCompletedFps,1)+" FPS.");
        });
        this.element("summary").textContent = summaries.join("\n");
        this.chart("throughput",["completedFps"],"Completed renders / second",true);
        this.chart("latency",["latencyP95Ms"],"p95 batch latency / ms",false);
        this.chart("timing",["cpuMsPerFrame","uploadCallMs","gpuDrawMs"],"Milliseconds / render",false);
    },

    chart:function(id,metrics,label,ideal)
    {
        var canvas = this.element(id), ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
        var left = 75, right = w-25, top = 25, bottom = h-45;
        ctx.clearRect(0,0,w,h);ctx.font = "12px Arial";ctx.fillStyle = "#485669";
        ctx.fillText(label,left,15);
        var rows = this.results, rates = Array.from(new Set(rows.map(function(r) { return r.targetFps; })))
            .filter(function(rate) { return rate!==null; }).sort(function(a,b) { return a-b; });
        var min = Math.log2(rates[0] || 1), max = Math.log2(rates[rates.length-1] || 2);
        var hasMax = rows.some(function(r) { return r.targetFps===null; });
        if(hasMax) max += 1;if(max===min) max += 1;
        var values = [];
        rows.forEach(function(row) { metrics.forEach(function(key) { if(row[key]!==null && Number.isFinite(row[key])) values.push(row[key]); }); });
        var ymax = Math.max(0.001,Math.max.apply(null,values.length?values:[1]))*1.2;
        function x(rate) { return left+((rate===null?max:Math.log2(rate))-min)/(max-min)*(right-left); }
        function y(value) { return bottom-value/ymax*(bottom-top); }
        ctx.strokeStyle = "#dce2e9";
        for(var tick=0;tick<=4;tick++)
        {
            var yy = y(ymax*tick/4);ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(right,yy);ctx.stroke();
            ctx.fillText((ymax*tick/4).toFixed(ymax<10?2:0),5,yy+4);
        }
        rates.concat(hasMax?[null]:[]).forEach(function(rate)
        {
            ctx.fillText(rate===null?"MAX":String(rate),x(rate)-12,bottom+20);
        });
        ctx.fillText("Requested renders / second (log scale)",left,bottom+40);
        ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
        if(ideal && rates.length)
        {
            ctx.strokeStyle = "#8b95a2";ctx.setLineDash([5,5]);ctx.beginPath();
            for(var i=0;i<=100;i++)
            {
                var rate = Math.pow(2,min+(Math.log2(rates[rates.length-1])-min)*i/100);
                if(i===0) ctx.moveTo(x(rate),y(rate));else ctx.lineTo(x(rate),y(rate));
            }
            ctx.stroke();
        }
        ["javascript","wasm"].forEach(function(driver,index)
        {
            metrics.forEach(function(metric,m)
            {
                var points = [];
                rates.concat(hasMax?[null]:[]).forEach(function(rate)
                {
                    var values = rows.filter(function(row) { return row.driver===driver && row.targetFps===rate && row[metric]!==null; })
                        .map(function(row) { return row[metric]; });
                    if(values.length) points.push({rate:rate,value:ScreenGPUBenchmark.percentile(values,0.5)});
                });
                ctx.strokeStyle = ctx.fillStyle = index?"#c26912":"#1757ab";
                ctx.setLineDash(m===1?[7,4]:m===2?[2,4]:[]);ctx.beginPath();
                points.forEach(function(point,i) { if(i===0) ctx.moveTo(x(point.rate),y(point.value));else ctx.lineTo(x(point.rate),y(point.value)); });
                ctx.stroke();
                points.forEach(function(point) { ctx.beginPath();ctx.arc(x(point.rate),y(point.value),3,0,Math.PI*2);ctx.fill(); });
            });
        });
        ctx.restore();ctx.setLineDash([]);
    },

    exportResults:function(format)
    {
        var fields = ["driver","repeat","targetFps","batchSize","frames","elapsedMs","completedFps","cpuMsPerFrame",
            "latencyMedianMs","latencyP95Ms","uploadCallMs","uploadBytes","gpuDrawMs","missedFrames","metTarget"];
        var data = format==="json"?JSON.stringify({metadata:this.metadata,results:this.results},null,2)
            :fields.join(",")+"\n"+this.results.map(function(row)
            { return fields.map(function(field) { return row[field]===null?"":String(row[field]); }).join(","); }).join("\n");
        var url = URL.createObjectURL(new Blob([data],{type:format==="json"?"application/json":"text/csv"}));
        var link = document.createElement("a");link.href = url;link.download = "screengpu-results."+format;link.click();
        setTimeout(function() { URL.revokeObjectURL(url); },1000);
    }
};

Apple2CharROM_keys().forEach(function(key)
{
    var option = document.createElement("option");option.value = option.textContent = key;
    ScreenGPUApp.element("rom").appendChild(option);
});
ScreenGPUApp.element("settings").addEventListener("submit",function(event)
{
    event.preventDefault();
    ScreenGPUApp.run().catch(function(error) { ScreenGPUApp.element("status").textContent = "Test failed: "+error.message; });
});
ScreenGPUApp.element("stop").addEventListener("click",function() { ScreenGPUApp.controller.abort(); });
ScreenGPUApp.element("input").addEventListener("change",function()
{
    ScreenGPUApp.element("snapshot").disabled = this.value==="capture";
});
["csv","json"].forEach(function(format)
{
    ScreenGPUApp.element(format).addEventListener("click",function() { ScreenGPUApp.exportResults(format); });
});
document.addEventListener("visibilitychange",function()
{
    if(document.hidden && ScreenGPUApp.running) ScreenGPUApp.controller.abort();
});
window.addEventListener("pagehide",function() { if(ScreenGPUApp.running) ScreenGPUApp.controller.abort(); });
ScreenGPUApp.renderResults();
