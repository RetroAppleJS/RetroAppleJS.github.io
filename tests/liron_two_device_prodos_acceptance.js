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
        const vectors=[];
        for(let addr=0xBF10;addr<0xBF30;addr+=2)
            vectors.push({addr,lo:read(addr),hi:read(addr+1)});
        const fe70=[];
        for(let addr=0xFE70;addr<0xFE90;addr++) fe70.push(read(addr));
        const c500=[];
        for(let addr=0xC500;addr<0xC520;addr++) c500.push(read(addr));
        return {devcnt,devlst,nodev,s5d1,s5d2,mli,c5tail,vectors,fe70,c500};
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
        const uniInfo=liron.deviceConfig.find(info=>info.DCODE==='UNIDISK');
        const hd=io.attach(liron,hdInfo,{newInstance:true});
        const uni=io.attach(liron,uniInfo,{newInstance:true});
        if(!hd || !uni) throw new Error('Unable to attach HD20 then UniDisk');
        if(hd.getUnit()!==1 || uni.getUnit()!==2)
            throw new Error('Unexpected SmartPort unit order: '+hd.getUnit()+','+uni.getUnit());

        if(!EMU_mountDiskImage(poBytes,liron.mount.slotN,'UNIDISK','CardCat 1.94.po',2))
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
    console.log('PRODOS_DRIVER_VECTORS',JSON.stringify(prodos.vectors));
    console.log('PRODOS_FE70',JSON.stringify(prodos.fe70));
    console.log('LIRON_C500',JSON.stringify(prodos.c500));
    console.log('PRODOS_INSTALLED_HIGH_NIBBLES',JSON.stringify(installed));
    console.log('SMARTPORT_BUS_AFTER_BOOT',JSON.stringify(bus));
    console.log('SMARTPORT_LOG_COUNT',smartportLogs.length);

    if(!installed.includes(0x50))
        throw new Error('ProDOS did not install Liron Unit 1 as S5,D1; globals='+JSON.stringify(prodos)+' bus='+JSON.stringify(bus));
    if(!installed.includes(0xD0))
        throw new Error('ProDOS did not install Liron Unit 2 as S5,D2; globals='+JSON.stringify(prodos)+' bus='+JSON.stringify(bus));
    const mliRead=await page.evaluate(async()=>{
        const mediaResponse=await fetch('/disks/Utility/CardCat%201.94.po');
        if(!mediaResponse.ok) throw new Error('UniDisk image fetch failed for MLI verification: '+mediaResponse.status);
        const mediaBytes=new Uint8Array(await mediaResponse.arrayBuffer());
        const expectedBytes=Array.from(mediaBytes.slice(0,512));

        const hw=apple2plus.hwObj();
        const cpu=apple2plus.cpuObj();
        const write=(addr,value)=>{
            addr &= 0xFFFF;
            const fn=hw.WR[hw.lineDecode(addr)];
            if(typeof fn!=='function') throw new Error('No CPU-bus writer for $'+addr.toString(16));
            fn(addr,value&0xFF);
        };
        const writeBytes=(addr,bytes)=>bytes.forEach((value,index)=>write(addr+index,value));

        const codeAddr=0x6000;
        const parmAddr=0x6100;
        const bufferAddr=0x7000;
        for(let i=0;i<512;i++) write(bufferAddr+i,0);

        // JSR ProDOS MLI; READ_BLOCK; parameter pointer; NOP as the return trap.
        writeBytes(codeAddr,[0x20,0x00,0xBF,0x80,0x00,0x61,0xEA]);
        // READ_BLOCK params: count=3, unit=$D0 (slot 5 drive 2), buffer=$7000, block 0.
        writeBytes(parmAddr,[0x03,0xD0,0x00,0x70,0x00,0x00]);

        const before=cpu.watch();
        cpu.setExecutionTrap(codeAddr+6);
        cpu.setState({a:before.a,x:before.x,y:before.y,sp:before.sp,p:before.p,pc:codeAddr,cycle_delay:0});
        const run=apple2plus.runLiveCpuTicks(2000000,{videoScale:0.001});
        const after=cpu.watch();
        cpu.clearExecutionTrap();

        const actual=Array.from(hw.safe_dump(bufferAddr,bufferAddr+511));
        const mismatches=[];
        for(let i=0;i<512 && mismatches.length<8;i++)
            if(actual[i]!==expectedBytes[i]) mismatches.push({offset:i,actual:actual[i],expected:expectedBytes[i]});

        return {
            trapped:!!run.trapped,
            completedTicks:run.completedTicks,
            pc:after.pc&0xFFFF,
            a:after.a&0xFF,
            carry:after.p&1,
            match:mismatches.length===0,
            mismatches,
            actualPrefix:actual.slice(0,16),
            expectedPrefix:expectedBytes.slice(0,16)
        };
    });
    console.log('PRODOS_MLI_D0_READ',JSON.stringify(mliRead));
    if(!mliRead.trapped || mliRead.carry || !mliRead.match)
        throw new Error('ProDOS MLI READ_BLOCK on S5,D2 ($D0) failed: '+JSON.stringify(mliRead));
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
