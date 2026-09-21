'use strict';

const {chromium}=require('playwright');

const baseURL=process.env.RETROAPPLE_URL || 'http://127.0.0.1:8000';
const CHUNK_TICKS=500000;
const MAX_CHUNKS=120;

async function runTicks(page,count=1)
{
    for(let i=0;i<count;i++)
        await page.evaluate(ticks=>apple2plus.runLiveCpuTicks(ticks,{videoScale:0.02}),CHUNK_TICKS);
}

async function globalPage(page)
{
    return page.evaluate(()=>{
        const hw=apple2plus.hwObj();
        const read=addr=>hw.safe_read(addr)&0xFF;
        const devcnt=read(0xBF31);
        const devlst=[];
        for(let i=0;i<14;i++) devlst.push(read(0xBF32+i));
        const nodev=[read(0xBF10),read(0xBF11)];
        const s5d1=[read(0xBF1A),read(0xBF1B)];
        const s5d2=[read(0xBF2A),read(0xBF2B)];
        const mli=[read(0xBF00),read(0xBF01),read(0xBF02)];
        const c5tail=[];
        for(let addr=0xC5F8;addr<=0xC5FF;addr++) c5tail.push(read(addr));
        return {devcnt,devlst,nodev,s5d1,s5d2,mli,c5tail};
    });
}

function highNibbles(state)
{
    if(!state || state.devcnt===0xFF || state.devcnt>13) return [];
    const count=(state.devcnt&0xFF)+1;
    return state.devlst.slice(0,count).map(value=>value&0xF0);
}

async function waitForProDOS(page)
{
    let state=null;
    for(let i=0;i<MAX_CHUNKS;i++)
    {
        await runTicks(page,1);
        if((i%2)!==1) continue;
        state=await globalPage(page);
        const units=highNibbles(state);
        if(state.devcnt<=13 && units.includes(0x60)) return state;
    }
    throw new Error('ProDOS did not establish a valid global device table: '+JSON.stringify(state));
}

async function stopRealtime(page)
{
    await page.waitForFunction(()=>typeof apple2plus==='object' && !!apple2plus && typeof loadDisk_fromBuffer==='function',{timeout:120000});
    await page.evaluate(()=>{
        if(typeof appleIntervalHandle!=='undefined' && appleIntervalHandle)
        {
            clearInterval(appleIntervalHandle);
            appleIntervalHandle=null;
        }
    });
}

async function setupTwoDevicesBeforeBoot(page)
{
    return page.evaluate(async()=>{
        function findCard(io,pcode)
        {
            for(let i=0;i<io.slots.length;i++)
            {
                const card=io.SLOT2obj(i);
                if(card && card.id && card.id.PCODE===pcode) return {slotIndex:i,card};
            }
            return null;
        }

        const [prodosResponse,poResponse]=await Promise.all([
            fetch('/disks/ProDOS%208.dsk'),
            fetch('/disks/Utility/CardCat%201.94.po')
        ]);
        if(!prodosResponse.ok) throw new Error('ProDOS boot disk fetch failed: '+prodosResponse.status);
        if(!poResponse.ok) throw new Error('UniDisk image fetch failed: '+poResponse.status);
        const prodosBytes=new Uint8Array(await prodosResponse.arrayBuffer());
        const poBytes=new Uint8Array(await poResponse.arrayBuffer());

        const io=apple2plus.hwObj().io;
        const lironInfo=findCard(io,'LIRON');
        if(!lironInfo) throw new Error('Liron card missing');
        const liron=lironInfo.card;

        for(const child of Array.from(liron.devices || []))
        {
            if(!child.attach || !io.detachInstance(liron,child.attach.hash))
                throw new Error('Unable to remove existing Liron child before topology setup');
        }

        const hdInfo=liron.deviceConfig.find(info=>info.DCODE==='HD20');
        const uniInfo=liron.deviceConfig.find(info=>info.DCODE==='UNIDISK35');
        const hd=io.attach(liron,hdInfo,{newInstance:true});
        const uni=io.attach(liron,uniInfo,{newInstance:true});
        if(!hd || !uni) throw new Error('Unable to attach HD20 then UniDisk');
        if(hd.getUnit()!==1 || uni.getUnit()!==2)
            throw new Error('Unexpected SmartPort unit order: '+hd.getUnit()+','+uni.getUnit());

        if(!EMU_mountDiskImage(poBytes,liron.mount.slotN,'UNIDISK35','CardCat 1.94.po',2))
            throw new Error('Unable to mount valid ProDOS media on UniDisk unit 2');

        const diskIISlot=EMU_defaultDiskIISlot();
        if(!loadDisk_fromBuffer(prodosBytes,diskIISlot,'D1','ProDOS 8.dsk'))
            throw new Error('Unable to mount ProDOS boot disk');

        liron.setDebug(true);
        apple2plus.reset();
        return {
            lironSlot:lironInfo.slotIndex,
            diskIISlot,
            bus:liron.getBus().getState(),
            hdUnit:hd.getUnit(),
            uniUnit:uni.getUnit(),
            uniMedia:uni.getState()
        };
    });
}

(async()=>{
    const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const page=await browser.newPage({viewport:{width:1400,height:1000}});
    const smartportLogs=[];
    page.on('console',msg=>{
        const text=msg.text();
        if(text.includes('[LIRON SmartPort]'))
        {
            smartportLogs.push(text);
            console.log('[browser]',text);
        }
    });
    page.on('pageerror',err=>console.log('[pageerror]',String(err)));

    await page.goto(baseURL+'/index.html?mute=1',{waitUntil:'load',timeout:120000});
    await stopRealtime(page);
    const setup=await setupTwoDevicesBeforeBoot(page);
    console.log('TWO_DEVICE_SETUP',JSON.stringify(setup));

    const firstGlobals=await waitForProDOS(page);
    console.log('PRODOS_GLOBALS_FIRST_VALID',JSON.stringify(firstGlobals));
    await runTicks(page,10);
    const prodos=await globalPage(page);
    const installed=highNibbles(prodos);
    const bus=await page.evaluate(()=>{
        const io=apple2plus.hwObj().io;
        for(let i=0;i<io.slots.length;i++)
        {
            const card=io.SLOT2obj(i);
            if(card && card.id && card.id.PCODE==='LIRON') return card.getBus().getState();
        }
        return null;
    });

    console.log('PRODOS_GLOBALS_SETTLED',JSON.stringify(prodos));
    console.log('PRODOS_INSTALLED_HIGH_NIBBLES',JSON.stringify(installed));
    console.log('SMARTPORT_BUS_AFTER_BOOT',JSON.stringify(bus));
    console.log('SMARTPORT_LOG_COUNT',smartportLogs.length);

    if(!installed.includes(0x50))
        throw new Error('ProDOS did not install Liron Unit 1 as S5,D1; globals='+JSON.stringify(prodos)+' bus='+JSON.stringify(bus));
    if(!installed.includes(0xD0))
        throw new Error('ProDOS did not install Liron Unit 2 as S5,D2; globals='+JSON.stringify(prodos)+' bus='+JSON.stringify(bus));
    if(prodos.s5d2[0]===prodos.nodev[0] && prodos.s5d2[1]===prodos.nodev[1])
        throw new Error('S5,D2 driver vector still points to NO DEVICE CONNECTED');
    if(smartportLogs.length===0)
        throw new Error('No SmartPort traffic was observed while ProDOS enumerated the two-device Liron chain');

    console.log('LIRON_TWO_DEVICE_PRODOS_ACCEPTANCE',JSON.stringify({
        unit1:installed.includes(0x50),
        unit2:installed.includes(0xD0),
        smartportLogs:smartportLogs.length,
        residentIDs:bus && bus.residentIDs
    }));
    await browser.close();
})().catch(async err=>{
    console.error('LIRON_TWO_DEVICE_PRODOS_ACCEPTANCE_ERROR',err && err.stack ? err.stack : String(err));
    process.exit(10);
});
