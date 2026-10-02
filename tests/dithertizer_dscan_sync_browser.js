'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

const CARD_PATH='res/EMU_CARD_dithertizer.js';
const DISK_PATH='disks/GFX/Computer Stations Dithertizer II Driver Software for II II+.dsk';
const FRAME=17030;
const TARGET_READS=128;
const original=fs.readFileSync(CARD_PATH,'utf8');

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

function syncBoundaryVariant(source,width)
{
    const candidates=['if(phase < 102) return 0x00;','if(phase < 103) return 0x00;'];
    const present=candidates.filter(text=>source.includes(text));
    assert.equal(present.length,1,'expected exactly one known second-LOW sync boundary');
    return source.replace(present[0],`if(phase < ${96+width}) return 0x00;`);
}

async function runCase(source,label,payload)
{
    fs.writeFileSync(CARD_PATH,source);
    const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    try
    {
        const page=await browser.newPage({viewport:{width:1400,height:1000}});
        const pageErrors=[];
        page.on('pageerror',err=>pageErrors.push(String(err)));
        await page.goto(`http://127.0.0.1:8000/index.html?mute=1&case=${encodeURIComponent(label)}&t=${Date.now()}`,
            {waitUntil:'load',timeout:120000});
        await page.waitForFunction(()=>
            typeof apple2plus==='object' && apple2plus &&
            typeof DBG_STEPTRACE_SCENARIO==='object' && DBG_STEPTRACE_SCENARIO &&
            document.getElementById('cpuDbg_breakCond'),{timeout:120000});

        await page.evaluate(()=>{
            if(typeof appleIntervalHandle!=='undefined' && appleIntervalHandle)
            {
                clearInterval(appleIntervalHandle);
                appleIntervalHandle=null;
            }
            apple2plus.reset();
            apple2plus.runLiveCpuTicks(500000,{videoScale:0.02});
        });

        const setup=await page.evaluate(({FRAME,TARGET_READS,payload})=>{
            const hw=apple2plus.hwObj();
            const cpu=apple2plus.cpuObj();
            const dither=hw.io.SLOT2obj(8);
            if(!dither || !dither.id || dither.id.PCODE!=='DITHER')
                throw new Error('DITHER not present at SLOT2obj(8)');
            if(typeof dither.readVideoSync!=='function' || typeof dither.readSlotIO!=='function')
                throw new Error('Dithertizer production I/O unavailable');

            for(let i=0;i<payload.length;i++)
            {
                const address=0x1C00+i;
                const write=hw.WR[hw.lineDecode(address)];
                if(typeof write!=='function') throw new Error('RAM not writable at '+address.toString(16));
                write(address,payload[i]);
            }

            const productionReadVideoSync=dither.readVideoSync;
            const productionReadSlotIO=dither.readSlotIO;
            globalThis.__prodReadVideoSync=productionReadVideoSync;
            globalThis.__dscanCase={reads:[],reached1D37:false,reason:'running'};
            const phase=t=>((Number(t)%FRAME)+FRAME)%FRAME;
            const ticks=ctx=>(ctx&&ctx.io&&typeof ctx.io.getClockTicks==='function'
                ? Number(ctx.io.getClockTicks())
                : Number(oEMU.component.IO.self.getClockTicks()))||0;
            const pc=()=>{
                const state=cpu.watch();
                return state&&Number.isFinite(Number(state.pc)) ? (Number(state.pc)&0xFFFF) : null;
            };

            // Passive observer only. readVideoSync() itself remains untouched.
            dither.readSlotIO=function(addr,ctx)
            {
                const reg=Number(addr)&0x0F;
                const t=ticks(ctx);
                const p=pc();
                const value=productionReadSlotIO.apply(this,arguments);
                const state=globalThis.__dscanCase;
                if(reg===0 && p!==null && p>=0x1D23 && p<=0x1D40 && state.reads.length<TARGET_READS)
                {
                    state.reads.push({
                        pc:p,
                        clockTicks:Math.trunc(t),
                        phase:Math.trunc(phase(t)),
                        d7:(Number(value)&0x80)?1:0
                    });
                }
                return value;
            };

            const dbg=oEMU.component.CPU.Apple2Debug;
            const cond=document.getElementById('cpuDbg_breakCond');
            cond.value='PC==$1D37';
            if(dbg.liveState().conditionalBreakpoint.armed) dbg.toggleConditionalBreakpointFromInput();
            if(!dbg.liveState().conditionalBreakpoint.armed) dbg.toggleConditionalBreakpointFromInput();

            DBG_STEPTRACE_SCENARIO.arm(`
                onBreakpoint(function(bp){
                    const state=globalThis.__dscanCase;
                    if((bp.PC&0xFFFF)===0x1D37){
                        state.reached1D37=true;
                        state.reason='reached_$1D37';
                        haltAtBreakpoint();
                    }
                });
            `);

            cpu.setState({pc:0x1C00});
            return {
                pc:cpu.watch().pc&0xFFFF,
                breakArmed:dbg.liveState().conditionalBreakpoint.armed,
                scenarioMode:DBG_STEPTRACE_SCENARIO.mode(),
                readVideoSyncUntouched:dither.readVideoSync===productionReadVideoSync
            };
        },{FRAME,TARGET_READS,payload:Array.from(payload)});

        let state=null;
        for(let i=0;i<40;i++)
        {
            await page.evaluate(()=>apple2plus.runLiveCpuTicks(50000,{videoScale:0.02}));
            state=await page.evaluate(()=>{
                const s=globalThis.__dscanCase;
                const d=apple2plus.hwObj().io.SLOT2obj(8);
                return {
                    reached1D37:s.reached1D37,
                    reason:s.reason,
                    reads:s.reads.slice(),
                    pc:apple2plus.cpuObj().watch().pc&0xFFFF,
                    readVideoSyncUntouched:d.readVideoSync===globalThis.__prodReadVideoSync
                };
            });
            if(state.reached1D37 || state.reads.length>=TARGET_READS) break;
        }

        assert.ok(state,'no DSCAN state returned');
        if(!state.reached1D37 && state.reads.length>=TARGET_READS)
            state.reason='read_limit_without_$1D37';
        state.focus=state.reads.filter(row=>row.phase>=88 && row.phase<=110);
        state.setup=setup;
        state.pageErrors=pageErrors;
        state.label=label;
        return state;
    }
    finally
    {
        await browser.close();
    }
}

(async()=>{
    const payload=extractDSCAN42();
    try
    {
        const six=await runCase(syncBoundaryVariant(original,6),'6-cycle-negative-control',payload);
        const seven=await runCase(syncBoundaryVariant(original,7),'7-cycle-positive-control',payload);
        const production=await runCase(original,'production',payload);

        console.log('DSCAN_6_RESULT',JSON.stringify({
            reached1D37:six.reached1D37,reason:six.reason,reads:six.reads.length,
            pc:'$'+six.pc.toString(16).toUpperCase().padStart(4,'0'),focus:six.focus,
            readVideoSyncUntouched:six.readVideoSyncUntouched
        }));
        console.log('DSCAN_7_RESULT',JSON.stringify({
            reached1D37:seven.reached1D37,reason:seven.reason,reads:seven.reads.length,
            pc:'$'+seven.pc.toString(16).toUpperCase().padStart(4,'0'),focus:seven.focus,
            readVideoSyncUntouched:seven.readVideoSyncUntouched
        }));
        console.log('DSCAN_PRODUCTION_RESULT',JSON.stringify({
            reached1D37:production.reached1D37,reason:production.reason,reads:production.reads.length,
            pc:'$'+production.pc.toString(16).toUpperCase().padStart(4,'0'),focus:production.focus,
            readVideoSyncUntouched:production.readVideoSyncUntouched
        }));

        for(const result of [six,seven,production])
        {
            assert.equal(result.setup.pc,0x1C00);
            assert.equal(result.setup.breakArmed,true);
            assert.equal(result.setup.scenarioMode,'run');
            assert.equal(result.readVideoSyncUntouched,true);
            assert.deepEqual(result.pageErrors,[]);
        }

        assert.equal(six.reached1D37,false,'6-cycle second LOW must not reach $1D37');
        assert.equal(six.reads.length,TARGET_READS,'6-cycle case must exhaust the read limit');
        assert.ok(six.focus.some(row=>row.phase===95 && row.d7===1),'6-cycle case must sample HIGH at phase 95');
        assert.ok(six.focus.some(row=>row.phase===102 && row.d7===1),'6-cycle case must miss LOW at phase 102');

        assert.equal(seven.reached1D37,true,'7-cycle second LOW must reach $1D37');
        assert.equal(seven.pc,0x1D37,'7-cycle case must halt exactly at $1D37');
        assert.ok(seven.focus.some(row=>row.phase===95 && row.d7===1),'7-cycle case must sample HIGH at phase 95');
        assert.ok(seven.focus.some(row=>row.phase===102 && row.d7===0),'7-cycle case must sample LOW at phase 102');

        assert.equal(production.reached1D37,true,'production Dithertizer sync must let DSCAN reach $1D37');
        assert.equal(production.pc,0x1D37,'production DSCAN must halt exactly at $1D37');
        assert.ok(production.focus.some(row=>row.phase===102 && row.d7===0),
            'production sync must expose the second LOW at phase 102');

        console.log('DSCAN_SYNC_REGRESSION PASS');
    }
    finally
    {
        fs.writeFileSync(CARD_PATH,original);
    }
})().catch(err=>{
    try{fs.writeFileSync(CARD_PATH,original);}catch(_){}
    console.error('DSCAN_SYNC_REGRESSION FAIL',err&&err.stack?err.stack:String(err));
    process.exit(1);
});
