'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

const DISK_PATH='disks/GFX/Computer Stations Dithertizer II Driver Software for II II+.dsk';

function extractDSCAN42()
{
    const disk=fs.readFileSync(DISK_PATH);
    const sector=(track,sec)=>disk.subarray((track*16+sec)*256,(track*16+sec+1)*256);

    function fileBytes(track,sec)
    {
        const out=[];
        const seen=new Set();
        while(track)
        {
            const key=track+':'+sec;
            if(seen.has(key)) break;
            seen.add(key);
            const b=sector(track,sec);
            const nextTrack=b[1],nextSec=b[2];
            for(let off=0x0C;off<0x100;off+=2)
            {
                if(off+1>=256) break;
                const dataTrack=b[off],dataSec=b[off+1];
                if(dataTrack===0 && dataSec===0) continue;
                if(dataTrack<35 && dataSec<16) out.push(...sector(dataTrack,dataSec));
            }
            track=nextTrack; sec=nextSec;
        }
        return Buffer.from(out);
    }

    const vt=sector(17,0);
    let track=vt[1],sec=vt[2],target=null;
    const seen=new Set();
    while(track)
    {
        const key=track+':'+sec;
        if(seen.has(key)) break;
        seen.add(key);
        const b=sector(track,sec);
        const nextTrack=b[1],nextSec=b[2];
        for(let off=0x0B;off<0x100;off+=35)
        {
            const e=b.subarray(off,off+35);
            if(e.length<35 || e[0]===0 || e[0]===0xFF) continue;
            const name=Array.from(e.subarray(3,33),x=>String.fromCharCode(x&0x7F)).join('').trimEnd();
            if(name==='DSCAN 4.2.OBJ') target=[e[0],e[1]];
        }
        track=nextTrack; sec=nextSec;
    }

    assert.ok(target,'DSCAN 4.2.OBJ not found');
    const raw=fileBytes(target[0],target[1]);
    const address=raw[0]|(raw[1]<<8);
    const length=raw[2]|(raw[3]<<8);
    const payload=raw.subarray(4,4+length);
    assert.equal(address,0x1C00);
    assert.equal(length,1024);
    assert.equal(payload.length,1024);
    return Uint8Array.from(payload);
}

(async()=>{
    const payload=extractDSCAN42();
    const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    try
    {
        const page=await browser.newPage({viewport:{width:1400,height:1000}});
        const pageErrors=[];
        page.on('pageerror',err=>pageErrors.push(String(err)));
        await page.goto(`http://127.0.0.1:8000/index.html?mute=1&fallback=${Date.now()}`,
            {waitUntil:'load',timeout:120000});
        await page.waitForFunction(()=>
            typeof apple2plus==='object' && apple2plus &&
            typeof DBG_STEPTRACE_SCENARIO==='object' && DBG_STEPTRACE_SCENARIO &&
            document.getElementById('cpuDbg_breakCond'),{timeout:120000});

        const setup=await page.evaluate((payload)=>{
            if(typeof appleIntervalHandle!=='undefined' && appleIntervalHandle)
            {
                clearInterval(appleIntervalHandle);
                appleIntervalHandle=null;
            }
            apple2plus.reset();
            apple2plus.runLiveCpuTicks(500000,{videoScale:0.02});

            const hw=apple2plus.hwObj();
            const cpu=apple2plus.cpuObj();
            const dither=hw.io.SLOT2obj(8);
            if(!dither || !dither.id || dither.id.PCODE!=='DITHER')
                throw new Error('DITHER not present at SLOT2obj(8)');
            if(dither.getCameraSource()!==null)
                throw new Error('explicit camera source must be absent for fallback test');

            // Ensure the host camera is not active. reset() is part of the production path.
            dither.reset();

            for(let i=0;i<payload.length;i++)
            {
                const address=0x1C00+i;
                const write=hw.WR[hw.lineDecode(address)];
                if(typeof write!=='function') throw new Error('RAM not writable at '+address.toString(16));
                write(address,payload[i]);
            }

            // DSCAN expects its caller to supply the two-pixel phase step in $00.
            const zeroWrite=hw.WR[hw.lineDecode(0x0000)];
            if(typeof zeroWrite!=='function') throw new Error('zero page not writable');
            zeroWrite(0x0000,0x02);

            globalThis.__fallbackTrace={captures:[],merges:[],done:false};

            const dbg=oEMU.component.CPU.Apple2Debug;
            const cond=document.getElementById('cpuDbg_breakCond');
            cond.value='PC==$1D41 || PC==$1C21';
            if(dbg.liveState().conditionalBreakpoint.armed) dbg.toggleConditionalBreakpointFromInput();
            if(!dbg.liveState().conditionalBreakpoint.armed) dbg.toggleConditionalBreakpointFromInput();

            DBG_STEPTRACE_SCENARIO.arm(`
                function pageHash(base){
                    let h=2166136261>>>0;
                    for(let a=base;a<base+0x2000;a++){
                        h^=ram.read(a)&0xFF;
                        h=Math.imul(h,16777619)>>>0;
                    }
                    return h>>>0;
                }
                function checkerOK(){
                    for(let y=0;y<192;y++){
                        const line=0x2000+((y&7)<<10)+((y&0x38)<<4)+((y&0xC0)>>1)+((y&0xC0)>>3);
                        for(let xb=0;xb<40;xb++){
                            const expected=((xb+y)&1)?0x7F:0x00;
                            if((ram.read(line+xb)&0xFF)!==expected) return false;
                        }
                    }
                    return true;
                }
                onBreakpoint(function(bp){
                    const out=globalThis.__fallbackTrace;
                    const pc=bp.PC&0xFFFF;
                    const D=globalThis.apple2plus.hwObj().io.SLOT2obj(8);
                    if(pc===0x1D41){
                        out.captures.push({
                            n:out.captures.length+1,
                            threshold:D.state.threshold&0xFF,
                            phaseX:ram.read(0x047F)&0xFF,
                            phaseY:ram.read(0x04FF)&0xFF,
                            page1:pageHash(0x2000),
                            page2:pageHash(0x4000),
                            checker:checkerOK(),
                            page2Selected:!!D.state.page2,
                            captureEnabled:!!D.state.captureEnabled
                        });
                    } else if(pc===0x1C21){
                        out.merges.push({
                            n:out.merges.length+1,
                            phaseX:ram.read(0x047F)&0xFF,
                            phaseY:ram.read(0x04FF)&0xFF,
                            page1:pageHash(0x2000),
                            page2:pageHash(0x4000)
                        });
                        if(out.merges.length>=4){
                            out.done=true;
                            haltAtBreakpoint();
                        }
                    }
                });
            `);

            cpu.setState({pc:0x1C00});
            return {
                pc:cpu.watch().pc&0xFFFF,
                breakArmed:dbg.liveState().conditionalBreakpoint.armed,
                scenarioMode:DBG_STEPTRACE_SCENARIO.mode()
            };
        },Array.from(payload));

        let trace=null;
        for(let i=0;i<160;i++)
        {
            await page.evaluate(()=>apple2plus.runLiveCpuTicks(50000,{videoScale:0.02}));
            trace=await page.evaluate(()=>JSON.parse(JSON.stringify(globalThis.__fallbackTrace)));
            if(trace && trace.done) break;
        }

        const diagnostic=await page.evaluate(()=>{
            const hw=apple2plus.hwObj();
            const cpu=apple2plus.cpuObj();
            const D=hw.io.SLOT2obj(8);
            return {
                pc:cpu.watch().pc&0xFFFF,
                zeroPage00:hw.safe_read(0x0000)&0xFF,
                phaseX:hw.safe_read(0x047F)&0xFF,
                phaseY:hw.safe_read(0x04FF)&0xFF,
                threshold:D.state.threshold&0xFF,
                captureEnabled:!!D.state.captureEnabled,
                page2Selected:!!D.state.page2
            };
        });

        fs.mkdirSync('test-results',{recursive:true});
        fs.writeFileSync('test-results/dithertizer-fallback-steptrace.json',JSON.stringify({setup,trace,diagnostic,pageErrors},null,2));
        console.log('FALLBACK_STEPTRACE_DIAGNOSTIC',JSON.stringify(diagnostic));
        console.log('FALLBACK_STEPTRACE_PARTIAL',JSON.stringify(trace));

        assert.equal(setup.pc,0x1C00);
        assert.equal(setup.breakArmed,true);
        assert.equal(setup.scenarioMode,'run');
        assert.deepEqual(pageErrors,[]);
        assert.ok(trace && trace.done,'four-capture fallback trace did not finish');
        assert.equal(trace.captures.length,4);
        assert.equal(trace.merges.length,4);
        assert.deepEqual(trace.captures.map(r=>[r.phaseX,r.phaseY]),[[0,0],[1,0],[0,1],[1,1]]);
        assert.ok(trace.captures.every(r=>r.checker),'every no-camera capture must contain the $00/$7F checker in PAGE1');
        assert.ok(trace.captures.every(r=>r.page2Selected===false),'DSCAN capture must target PAGE1');
        assert.ok(trace.captures.every(r=>r.captureEnabled===true),'capture must be enabled after $C0F8');

        const hex=n=>(n>>>0).toString(16).toUpperCase().padStart(8,'0');
        console.log('FALLBACK_STEPTRACE_SETUP',JSON.stringify(setup));
        for(const row of trace.captures)
            console.log(`CAPTURE ${row.n} phase=${row.phaseX}/${row.phaseY} threshold=$${row.threshold.toString(16).toUpperCase().padStart(2,'0')} PAGE1=${hex(row.page1)} PAGE2=${hex(row.page2)} checker=${row.checker}`);
        for(const row of trace.merges)
            console.log(`MERGE ${row.n} phase=${row.phaseX}/${row.phaseY} PAGE1=${hex(row.page1)} PAGE2=${hex(row.page2)}`);
        console.log('FALLBACK_STEPTRACE_RESULT',JSON.stringify(trace));
        console.log('FALLBACK_STEPTRACE PASS');
    }
    finally
    {
        await browser.close();
    }
})().catch(err=>{
    console.error('FALLBACK_STEPTRACE FAIL',err&&err.stack?err.stack:String(err));
    process.exit(1);
});
