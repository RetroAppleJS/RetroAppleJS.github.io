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
        await page.goto(`http://127.0.0.1:${server.address().port}/tests/video_webgpu_browser.html`);
        await page.waitForFunction(()=>window.webgpuTestResult?.done,{},{timeout:120000});
        const result=await page.evaluate(()=>window.webgpuTestResult);
        console.log(JSON.stringify({...result,pageErrors},null,2));
        if(!result.passed || pageErrors.length) process.exitCode=1;
    }
    finally
    {
        if(browser) await browser.close();
        await new Promise(resolve=>server.close(resolve));
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
