'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

function hgrLineAddress(pageBase,y)
{
    return pageBase
        + ((y & 0x07) << 10)
        + ((y & 0x38) << 4)
        + ((y & 0xC0) >> 1)
        + ((y & 0xC0) >> 3);
}

function expectedCheckerTrace()
{
    const out=[];
    let index=0;
    for(let y=0;y<192;y++)
    {
        const line=hgrLineAddress(0x2000,y);
        for(let xb=0;xb<40;xb++)
        {
            out.push({
                index:index++,
                y,
                xb,
                addr:line+xb,
                value:((xb+y)&1) ? 0x7F : 0x00
            });
        }
    }
    return out;
}

(async()=>{
    const expected=expectedCheckerTrace();
    assert.equal(expected.length,7680);

    const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    try
    {
        const page=await browser.newPage({viewport:{width:1400,height:1000}});
        const pageErrors=[];
        page.on('pageerror',err=>pageErrors.push(String(err)));
        await page.goto(`http://127.0.0.1:8000/index.html?mute=1&c0f8trace=${Date.now()}`,
            {waitUntil:'load',timeout:120000});
        await page.waitForFunction(()=>typeof apple2plus==='object' && apple2plus && apple2plus.hwObj,
            {timeout:120000});

        const observed=await page.evaluate(()=>{
            if(typeof appleIntervalHandle!=='undefined' && appleIntervalHandle)
            {
                clearInterval(appleIntervalHandle);
                appleIntervalHandle=null;
            }

            apple2plus.restart();
            const hw=apple2plus.hwObj();
            const dither=hw.io.SLOT2obj(8);
            if(!dither || !dither.id || dither.id.PCODE!=='DITHER')
                throw new Error('DITHER not present at SLOT2obj(8)');

            // Force the diagnostic no-camera path added by PR #181.
            dither.reset();
            dither.setCameraSource(null);

            const trace={
                hwWriteType:typeof hw.write,
                vidHwWriteType:null,
                startCaptureCalled:false,
                startCaptureReturn:null,
                ctxHwPresent:false,
                ctxHwWriteType:null,
                ctxVidHwPresent:false,
                ctxVidHwWriteType:null,
                captureEnabledBefore:!!dither.state.captureEnabled,
                captureEnabledAfter:null,
                page2Before:!!dither.state.page2,
                page2After:null,
                slotReadReturn:null,
                writes:[],
                page1:null
            };

            try
            {
                const v=(typeof oApple2Video!=='undefined' && oApple2Video) ? oApple2Video : null;
                trace.vidHwWriteType=v && v.hw ? typeof v.hw.write : null;
            }
            catch(_){ trace.vidHwWriteType='unavailable'; }

            const originalStart=dither.startCapture;
            dither.startCapture=function(ctx)
            {
                trace.startCaptureCalled=true;
                trace.ctxHwPresent=!!(ctx && ctx.hw);
                trace.ctxHwWriteType=ctx && ctx.hw ? typeof ctx.hw.write : null;
                trace.ctxVidHwPresent=!!(ctx && ctx.vid && ctx.vid.hw);
                trace.ctxVidHwWriteType=ctx && ctx.vid && ctx.vid.hw ? typeof ctx.vid.hw.write : null;
                const result=originalStart.call(dither,ctx);
                trace.startCaptureReturn=result;
                return result;
            };

            const originalWR2=hw.WR[2];
            const originalWR3=hw.WR[3];
            let callIndex=0;
            hw.WR[2]=function(addr,d8)
            {
                if(addr>=0x2000 && addr<0x4000)
                    trace.writes.push({index:callIndex++,addr:addr&0xFFFF,value:d8&0xFF,line:2});
                return originalWR2(addr,d8);
            };
            hw.WR[3]=function(addr,d8)
            {
                if(addr>=0x2000 && addr<0x4000)
                    trace.writes.push({index:callIndex++,addr:addr&0xFFFF,value:d8&0xFF,line:3});
                return originalWR3(addr,d8);
            };

            try
            {
                hw.bRO=false;
                // Apple2IO uses relative $C000 addresses, so $00F8 is CPU $C0F8.
                trace.slotReadReturn=hw.io.read(0x00F8)&0xFF;
            }
            finally
            {
                hw.WR[2]=originalWR2;
                hw.WR[3]=originalWR3;
                dither.startCapture=originalStart;
            }

            trace.captureEnabledAfter=!!dither.state.captureEnabled;
            trace.page2After=!!dither.state.page2;
            trace.page1=Array.from(hw.safe_videodump().slice(0x2000,0x4000));
            return trace;
        });

        assert.deepEqual(pageErrors,[]);
        assert.equal(observed.startCaptureCalled,true,'$C0F8 must call startCapture');
        assert.equal(observed.page2After,false,'diagnostic capture must target PAGE1');

        const expectedByAddress=new Map(expected.map(r=>[r.addr,r]));
        const actual=observed.writes;
        let firstWriteDivergence=null;
        const pairCount=Math.max(expected.length,actual.length);
        for(let i=0;i<pairCount;i++)
        {
            const e=expected[i]||null;
            const a=actual[i]||null;
            if(!e || !a || e.addr!==a.addr || e.value!==a.value)
            {
                firstWriteDivergence={index:i,expected:e,actual:a};
                break;
            }
        }

        const memoryMismatches=[];
        for(const e of expected)
        {
            const got=observed.page1[e.addr-0x2000]&0xFF;
            if(got!==e.value)
            {
                memoryMismatches.push({index:e.index,y:e.y,xb:e.xb,addr:e.addr,expected:e.value,actual:got});
                if(memoryMismatches.length>=64) break;
            }
        }

        const report={
            trigger:'CPU $C0F8 via hw.io.read($00F8)',
            expectedWriteCount:expected.length,
            actualWriteCount:actual.length,
            startCaptureCalled:observed.startCaptureCalled,
            startCaptureReturn:observed.startCaptureReturn,
            captureEnabledBefore:observed.captureEnabledBefore,
            captureEnabledAfter:observed.captureEnabledAfter,
            page2Before:observed.page2Before,
            page2After:observed.page2After,
            hwWriteType:observed.hwWriteType,
            vidHwWriteType:observed.vidHwWriteType,
            ctxHwPresent:observed.ctxHwPresent,
            ctxHwWriteType:observed.ctxHwWriteType,
            ctxVidHwPresent:observed.ctxVidHwPresent,
            ctxVidHwWriteType:observed.ctxVidHwWriteType,
            slotReadReturn:observed.slotReadReturn,
            firstWriteDivergence,
            memoryMismatchSample:memoryMismatches,
            expectedWrites:expected,
            actualWrites:actual
        };

        fs.mkdirSync('test-results',{recursive:true});
        fs.writeFileSync('test-results/dithertizer-c0f8-write-trace.json',JSON.stringify(report,null,2));

        const hex2=n=>'$'+(n&0xFF).toString(16).toUpperCase().padStart(2,'0');
        const hex4=n=>'$'+(n&0xFFFF).toString(16).toUpperCase().padStart(4,'0');
        console.log('C0F8_WRITE_TRACE_SUMMARY',JSON.stringify({
            expectedWriteCount:report.expectedWriteCount,
            actualWriteCount:report.actualWriteCount,
            startCaptureCalled:report.startCaptureCalled,
            startCaptureReturn:report.startCaptureReturn,
            captureEnabledAfter:report.captureEnabledAfter,
            page2After:report.page2After,
            hwWriteType:report.hwWriteType,
            ctxHwWriteType:report.ctxHwWriteType,
            ctxVidHwWriteType:report.ctxVidHwWriteType
        }));

        console.log('EXPECTED_FIRST_16',expected.slice(0,16).map(e=>`${e.index}:${hex4(e.addr)}=${hex2(e.value)}`).join(' '));
        console.log('EXPECTED_LINE_STARTS',Array.from({length:16},(_,y)=>{
            const e=expected[y*40];
            return `y=${y}:${hex4(e.addr)}=${hex2(e.value)}`;
        }).join(' '));

        if(actual.length===0)
            console.log('ACTUAL_WRITES none');
        else
            for(const w of actual)
                console.log(`ACTUAL_WRITE ${w.index} ${hex4(w.addr)}=${hex2(w.value)} WR[${w.line}]`);

        if(firstWriteDivergence)
        {
            const e=firstWriteDivergence.expected;
            const a=firstWriteDivergence.actual;
            console.log('FIRST_WRITE_DIVERGENCE',JSON.stringify({
                index:firstWriteDivergence.index,
                expected:e ? {addr:hex4(e.addr),value:hex2(e.value),y:e.y,xb:e.xb} : null,
                actual:a ? {addr:hex4(a.addr),value:hex2(a.value),line:a.line} : null
            }));
        }
        else console.log('FIRST_WRITE_DIVERGENCE none');

        console.log('PAGE1_MEMORY_MISMATCH_SAMPLE',JSON.stringify(memoryMismatches.map(m=>({
            index:m.index,y:m.y,xb:m.xb,addr:hex4(m.addr),expected:hex2(m.expected),actual:hex2(m.actual)
        }))));

        console.log('C0F8_WRITE_TRACE_REPORT test-results/dithertizer-c0f8-write-trace.json');
    }
    finally
    {
        await browser.close();
    }
})().catch(err=>{
    console.error('C0F8_WRITE_TRACE FAIL',err&&err.stack?err.stack:String(err));
    process.exit(1);
});
