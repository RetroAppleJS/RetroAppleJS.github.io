'use strict';

// Test dependency only: npm install --no-save playwright@1.62.1
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');

(async()=>{
    const server=http.createServer((req,res)=>{
        const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
        if(!file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
        fs.readFile(file,(error,data)=>{
            if(error) {res.writeHead(404);res.end();return;}
            const type=path.extname(file)==='.js'?'application/javascript':path.extname(file)==='.html'?'text/html':'application/octet-stream';
            res.writeHead(200,{'Content-Type':type});res.end(data);
        });
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    let browser;
    try
    {
        const executablePath=process.env.WEBGPU_CHROMIUM_PATH || chromium.executablePath();
        const env={...process.env};
        const icd=path.join(path.dirname(executablePath),'vk_swiftshader_icd.json');
        if(!env.VK_ICD_FILENAMES && fs.existsSync(icd)) env.VK_ICD_FILENAMES=icd;
        browser=await chromium.launch({headless:true,env,executablePath,
            args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader',
                '--enable-unsafe-webgpu','--enable-features=Vulkan','--disable-vulkan-surface','--ignore-gpu-blocklist']});
        const page=await browser.newPage();
        const pageErrors=[];
        page.on('pageerror',error=>pageErrors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/tools/ScreenGPU.html`);
        await page.waitForFunction(()=>typeof(ScreenGPUApp)!=='undefined');
        const cases=[];
        for(const input of ['ram','capture']) for(const mode of ['text','lores','mixed-lores','hires','mixed-hires'])
        {
            const result=await page.evaluate(async({input,mode})=>{
                const rows=await ScreenGPUApp.run({mode,input,driver:'both',chrome:0,rom:'A2_US',page2:true,
                    snapshot:input==='ram',rates:[60],batchSize:2,durationMs:100,repeats:1,uncapped:true,profile:true});
                if(rows.length!==4 || rows.some(row=>!(row.frames>0 && row.completedFps>0 && row.cpuMsPerFrame>=0 && row.latencyP95Ms>0 && row.uploadBytes>0)))
                    throw new Error('Invalid completed measurements: '+JSON.stringify(rows));
                const capabilities=ScreenGPUApp.metadata.capabilities;
                if(capabilities.backend!=='WebGL2' || capabilities.completion!=='asynchronous fence')
                    throw new Error('SwiftShader smoke test must exercise completion fences');
                if(capabilities.gpuTiming && !rows.some(row=>Number.isFinite(row.gpuDrawMs) && row.gpuDrawMs>=0))
                    throw new Error('Available GPU timers must produce valid samples');
                const preview=document.getElementById('applescreen').getContext('2d');
                if(!preview || !preview.getImageData(0,0,560,384).data.some((value,index)=>index%4!==3 && value>0))
                    throw new Error('Completed run must preserve the rendered preview');
                return {input,mode,rows:rows.length,capabilities:ScreenGPUApp.metadata.capabilities,
                    gpuTimers:rows.map(row=>row.gpuDrawMs)};
            },{input,mode});
            cases.push(result);
        }
        await page.screenshot({path:process.env.SCREENGPU_SCREENSHOT || '/tmp/screengpu-benchmark.png',fullPage:true});
        const downloads=[];
        for(const format of ['json','csv'])
        {
            const pending=page.waitForEvent('download');
            await page.locator('#'+format).click();
            const download=await pending;
            const file=await download.path();
            const data=fs.readFileSync(file,'utf8');
            if(format==='json')
            {
                const parsed=JSON.parse(data);
                if(parsed.results.length!==4 || parsed.metadata.resolution[0]!==560) throw new Error('Invalid JSON export');
            }
            else if(!data.includes('completedFps') || data.split('\n').length!==5) throw new Error('Invalid CSV export');
            downloads.push(download.suggestedFilename());
        }
        // Exercise the real form, including cancellation during a long pacing wait.
        await page.selectOption('#driver','javascript');
        await page.fill('#rates','1');
        await page.fill('#batch','2');
        await page.fill('#duration','0.1');
        await page.fill('#repeats','1');
        await page.uncheck('#profile');
        await page.uncheck('#uncapped');
        await page.evaluate(()=>{
            const factory=ScreenGPUBenchmark.createRenderer;
            window.originalRenderer=factory;
            ScreenGPUBenchmark.createRenderer=function(canvas,options){
                const adapter=factory.call(this,canvas,options), wait=adapter.waitUntil;
                adapter.waitUntil=function(deadline,signal){window.pacing=true;return wait(deadline,signal);};
                return adapter;
            };
        });
        await page.locator('#run').click();
        if(await page.locator('#summary').textContent()) throw new Error('Previous summary was not cleared');
        await page.waitForFunction(()=>window.pacing);
        await page.locator('#stop').click();
        await page.waitForFunction(()=>!ScreenGPUApp.running,{},{timeout:1500});
        const cancelled=await page.evaluate(()=>ScreenGPUApp.metadata.cancelled && !ScreenGPUApp.running && !document.getElementById('run').disabled);
        if(!cancelled) throw new Error('Cancellation failed');
        await page.evaluate(()=>{ScreenGPUBenchmark.createRenderer=window.originalRenderer;});
        await page.fill('#rates','60');
        await page.locator('#run').click();
        await page.waitForFunction(()=>!ScreenGPUApp.running);
        const formCompleted=await page.evaluate(()=>ScreenGPUApp.results.length===1 && !ScreenGPUApp.metadata.cancelled);
        if(!formCompleted) throw new Error('Form submission did not complete');
        const timerFallback=await page.evaluate(async()=>{
            const prototype=WebGL2RenderingContext.prototype, original=prototype.getExtension;
            prototype.getExtension=function(name){return name==='EXT_disjoint_timer_query_webgl2'?null:original.call(this,name);};
            try {
                const rows=await ScreenGPUApp.run({mode:'text',input:'ram',driver:'javascript',chrome:0,rom:'A2_US',page2:false,
                    snapshot:false,rates:[60],batchSize:2,durationMs:100,repeats:1,uncapped:false,profile:true});
                return !ScreenGPUApp.metadata.capabilities.gpuTiming && rows.length===1 && rows[0].gpuDrawMs===null && rows[0].uploadBytes>0;
            } finally {prototype.getExtension=original;}
        });
        if(!timerFallback) throw new Error('Unsupported timer fallback failed');
        console.log(JSON.stringify({passed:pageErrors.length===0,cases,downloads,cancelled,formCompleted,timerFallback,pageErrors},null,2));
        if(pageErrors.length) process.exitCode=1;
    }
    finally
    {
        if(browser) await browser.close();
        await new Promise(resolve=>server.close(resolve));
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
