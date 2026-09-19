'use strict';

const fs=require('node:fs');
const {chromium}=require('playwright');

const source=fs.readFileSync(__filename,'utf8');
if(/\.loadImage\s*\(/.test(source) || /EMU_mountDiskImage\s*\(/.test(source) || /\.readBlock\s*\(/.test(source))
{
    console.error('Toolbox acceptance must not originate direct UniDisk mount/block calls');
    process.exit(90);
}

const baseURL=process.env.RETROAPPLE_URL || 'http://127.0.0.1:8000';
const CHUNK_TICKS=500000;
const MAX_CHUNKS=180;

async function runTicks(page,count=1)
{
    for(let i=0;i<count;i++)
        await page.evaluate(ticks=>apple2plus.runLiveCpuTicks(ticks,{videoScale:0.02}),CHUNK_TICKS);
}

async function snapshot(page)
{
    return page.evaluate(()=>{
        function findCard(io,pcode)
        {
            for(let i=0;i<io.slots.length;i++)
            {
                const card=io.SLOT2obj(i);
                if(card && card.id && card.id.PCODE===pcode) return {slotIndex:i,card};
            }
            return null;
        }
        function decode(raw)
        {
            if(raw===0) return ' ';
            let c=raw&0x7f;
            if(c===0x7f) return '?';
            if(c<0x20) c+=0x40;
            return String.fromCharCode(c);
        }
        const io=apple2plus.hwObj().io;
        const videxInfo=findCard(io,'VIDEX');
        const lironInfo=findCard(io,'LIRON');
        let screen='',linear='';
        if(videxInfo && typeof videxInfo.card.getVideoRAM==='function')
        {
            const vram=videxInfo.card.getVideoRAM();
            const crtc=videxInfo.card.getCRTCRegisters();
            let cols=Math.min(80,Math.max(1,(crtc[1]&0x7f)||80));
            let rows=Math.min(25,Math.max(1,(crtc[6]&0x7f)||24));
            const start=((crtc[12]<<8)|crtc[13])&0x07ff;
            const lines=[];
            for(let r=0;r<rows;r++)
            {
                let line='';
                for(let c=0;c<cols;c++) line+=decode(vram[(start+r*cols+c)&0x07ff]);
                lines.push(line.replace(/\s+$/,''));
            }
            screen=lines.join('\n');
            for(let i=0;i<vram.length;i++) linear+=decode(vram[i]);
        }
        const liron=lironInfo && lironInfo.card;
        const disk=liron && typeof liron.getUniDisk==='function' ? liron.getUniDisk() : null;
        return {
            screen,linear,
            lironSlot:lironInfo ? lironInfo.slotIndex : null,
            media:disk && typeof disk.getState==='function' ? disk.getState() : null,
            observed:globalThis.__toolboxCardCatObserved || null
        };
    });
}

async function runUntil(page,predicate,label,maxChunks=MAX_CHUNKS)
{
    let snap=null;
    for(let i=0;i<maxChunks;i++)
    {
        await runTicks(page,1);
        if((i%4)!==3) continue;
        snap=await snapshot(page);
        if(predicate(snap))
        {
            console.log(label+'_TICKS',String((i+1)*CHUNK_TICKS));
            return snap;
        }
    }
    snap=snap || await snapshot(page);
    throw new Error(label+' timed out\n'+snap.screen+'\nOBS '+JSON.stringify(snap.observed));
}

(async()=>{
    const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const page=await browser.newPage({viewport:{width:1500,height:1000}});
    page.on('pageerror',err=>console.log('[pageerror]',String(err)));
    page.on('console',msg=>{
        const text=msg.text();
        if(/Liron|UniDisk|SmartPort|error/i.test(text)) console.log('[browser]',text);
    });

    await page.goto(baseURL+'/index.html?mute=1',{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>typeof apple2plus==='object' && !!apple2plus && typeof loadDisk_fromBuffer==='function',{timeout:120000});

    const bootSetup=await page.evaluate(async()=>{
        if(typeof appleIntervalHandle!=='undefined' && appleIntervalHandle)
        {
            clearInterval(appleIntervalHandle);
            appleIntervalHandle=null;
        }
        const response=await fetch('/disks/Utility/Card%20Cat%201.94.dsk');
        if(!response.ok) throw new Error('Card Cat DSK fetch failed: '+response.status);
        const bytes=new Uint8Array(await response.arrayBuffer());
        const slot=EMU_defaultDiskIISlot();
        const mounted=loadDisk_fromBuffer(bytes,slot,'D1','Card Cat 1.94.dsk');
        apple2plus.reset();
        return {bytes:bytes.length,slot,mounted};
    });
    if(!bootSetup.mounted || bootSetup.bytes!==143360)
        throw new Error('Unable to boot Card Cat DSK: '+JSON.stringify(bootSetup));

    const cardCat=await runUntil(page,snap=>{
        const text=(snap.screen+'\n'+snap.linear).toUpperCase();
        return text.includes('CARD CAT') && text.includes('LIRON') && /SP\s*:\s*1/.test(text) && text.includes('[S]MARTPORT');
    },'CARD_CAT_MENU');
    console.log('--- CARD CAT MENU ---');
    console.log(cardCat.screen);
    console.log('--- END CARD CAT MENU ---');

    const toolboxSetup=await page.evaluate(()=>{
        const io=apple2plus.hwObj().io;
        const lirons=io.PCODE2obj('LIRON');
        if(lirons.length!==1) throw new Error('Expected one Liron card');
        const liron=lirons[0];
        const slotN=Number(liron.mount.slotN);
        if(typeof(io.refreshDeviceToolboxes)!=='function')
            throw new Error('Device toolbox refresh is unavailable');
        io.refreshDeviceToolboxes({id:'devices',default_slot:io.slot2ID(slotN)});
        const disk=liron.getUniDisk();
        if(!disk) throw new Error('UniDisk child missing');
        return {slotN,slotID:io.slot2ID(slotN),unit:disk.getUnit(),media:disk.getState()};
    });
    console.log('TOOLBOX_SETUP',JSON.stringify(toolboxSetup));

    const inputID='#liron_unit_'+toolboxSetup.slotID+'_'+toolboxSetup.unit+'_file';
    const input=page.locator(inputID);
    if(await input.count()!==1)
        throw new Error('Liron toolbox UniDisk file input is missing: '+inputID);

    await input.setInputFiles('disks/Utility/CardCat 1.94.po');
    await page.waitForFunction(({slotID,unit})=>{
        const input=document.querySelector('#liron_unit_'+slotID+'_'+unit+'_file');
        const io=apple2plus.hwObj().io;
        const liron=io.PCODE2obj('LIRON')[0];
        const disk=liron && liron.getUniDisk ? liron.getUniDisk() : null;
        const state=disk && disk.getState ? disk.getState() : null;
        return !!input && !!state && state.mediaLoaded===true && state.mediaBytes===819200 && state.mediaFilename==='CardCat 1.94.po';
    },{slotID:toolboxSetup.slotID,unit:toolboxSetup.unit},{timeout:30000});

    const mounted=await page.evaluate(()=>{
        const io=apple2plus.hwObj().io;
        const liron=io.PCODE2obj('LIRON')[0];
        const disk=liron.getUniDisk();
        const original=disk.readBlock;
        globalThis.__toolboxCardCatObserved={blocks:[],directoryText:'',directoryEntries:false};
        disk.readBlock=function(blockNo)
        {
            const reply=Reflect.apply(original,disk,[blockNo]);
            const n=Number(blockNo);
            globalThis.__toolboxCardCatObserved.blocks.push(n);
            if(n===2 && reply && reply.data)
            {
                let text='';
                for(const byte of reply.data)
                    text += byte>=0x20 && byte<=0x7e ? String.fromCharCode(byte) : ' ';
                globalThis.__toolboxCardCatObserved.directoryText=text;
                const upper=text.toUpperCase();
                globalThis.__toolboxCardCatObserved.directoryEntries=
                    upper.includes('SYSTEM.APPLE') && upper.includes('SYSTEM.PASCAL') && upper.includes('SYSTEM.STARTUP');
            }
            return reply;
        };
        return disk.getState();
    });
    console.log('TOOLBOX_MOUNTED_MEDIA',JSON.stringify(mounted));

    const rowText=await page.locator('[data-smartport-unit="1"]').innerText();
    if(!/CardCat 1\.94\.po/i.test(rowText))
        throw new Error('Mounted filename is not visible in Unit 1 row: '+rowText);

    const smartPortInput=await page.evaluate(()=>{
        const io=apple2plus.hwObj().io;
        const boards=io.DCODE2obj('PASTEBO','A2BO');
        const pasteboard=boards.length===1 ? boards[0] : null;
        if(!pasteboard || typeof(pasteboard.sendText)!=='function')
            throw new Error('Normal browser pasteboard input unavailable');
        return {target:pasteboard.getTargetAddress(io),sent:pasteboard.sendText(io,'S')};
    });
    console.log('CARD_CAT_SMARTPORT_INPUT',JSON.stringify(smartPortInput));
    if(!smartPortInput.sent) throw new Error('Unable to select Card Cat SmartPort operation');

    const accessed=await runUntil(page,snap=>{
        const obs=snap.observed || {};
        return Array.isArray(obs.blocks) && obs.blocks.includes(2) && obs.directoryEntries===true;
    },'CARD_CAT_DIRECTORY_READ',120);

    const result={
        sp1:/SP\s*:\s*1/i.test(cardCat.screen+'\n'+cardCat.linear),
        toolboxMounted:!!mounted.mediaLoaded && mounted.mediaBytes===819200 && mounted.mediaFilename==='CardCat 1.94.po',
        rowShowsFilename:/CardCat 1\.94\.po/i.test(rowText),
        block2Read:Array.isArray(accessed.observed && accessed.observed.blocks) && accessed.observed.blocks.includes(2),
        directoryEntries:!!(accessed.observed && accessed.observed.directoryEntries),
        blocks:accessed.observed ? accessed.observed.blocks : []
    };
    console.log('CARD_CAT_LIRON_TOOLBOX_ACCEPTANCE',JSON.stringify(result));
    console.log('DIRECTORY_TEXT',String(accessed.observed && accessed.observed.directoryText || '').replace(/\s+/g,' ').trim());
    await browser.close();

    if(!result.sp1 || !result.toolboxMounted || !result.rowShowsFilename || !result.block2Read || !result.directoryEntries)
        process.exit(2);
})().catch(err=>{
    console.error('CARD_CAT_LIRON_TOOLBOX_ACCEPTANCE_ERROR',err && err.stack ? err.stack : String(err));
    process.exit(10);
});
