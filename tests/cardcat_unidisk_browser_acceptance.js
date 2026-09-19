'use strict';

const fs=require('node:fs');
const {chromium}=require('playwright');

const source=fs.readFileSync(__filename,'utf8');
if(/\.loadImage\s*\(/.test(source) || /\.readBlock\s*\(/.test(source))
{
    console.error('Acceptance harness must not originate direct UniDisk media/block calls');
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
        const diskInfo=findCard(io,'DISKII');
        let screen='',linear='';

        if(videxInfo && typeof videxInfo.card.getVideoRAM==='function')
        {
            const vram=videxInfo.card.getVideoRAM();
            const crtc=videxInfo.card.getCRTCRegisters();
            let cols=(crtc[1]&0x7f)||80;
            let rows=(crtc[6]&0x7f)||24;
            cols=Math.min(80,Math.max(1,cols));
            rows=Math.min(25,Math.max(1,rows));
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
            screen,
            linear,
            lironSlot:lironInfo ? lironInfo.slotIndex : null,
            diskIISlot:diskInfo ? diskInfo.slotIndex : null,
            bus:liron && typeof liron.getBus==='function' ? liron.getBus().getState() : null,
            media:disk && typeof disk.getState==='function' ? disk.getState() : null,
            observed:globalThis.__cardcatUniDiskObserved || null
        };
    });
}

async function runUntil(page,predicate,label)
{
    let snap=null;
    for(let i=0;i<MAX_CHUNKS;i++)
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
    throw new Error(label+' timed out\n'+snap.screen+'\nBUS '+JSON.stringify(snap.bus));
}

(async()=>{
    const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const page=await browser.newPage({viewport:{width:1400,height:1000}});
    page.on('pageerror',err=>console.log('[pageerror]',String(err)));
    page.on('console',msg=>{
        const text=msg.text();
        if(/Liron|SmartPort|error/i.test(text)) console.log('[browser]',text);
    });

    await page.goto(baseURL+'/index.html?mute=1',{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>typeof apple2plus==='object' && !!apple2plus && typeof loadDisk_fromBuffer==='function',{timeout:120000});

    const setup=await page.evaluate(async()=>{
        if(typeof appleIntervalHandle!=='undefined' && appleIntervalHandle)
        {
            clearInterval(appleIntervalHandle);
            appleIntervalHandle=null;
        }
        if(typeof EMU_mountDiskImage!=='function')
            throw new Error('UniDisk browser media router is unavailable');

        function findCard(io,pcode)
        {
            for(let i=0;i<io.slots.length;i++)
            {
                const card=io.SLOT2obj(i);
                if(card && card.id && card.id.PCODE===pcode) return {slotIndex:i,card};
            }
            return null;
        }

        const [dskResponse,poResponse]=await Promise.all([
            fetch('/disks/Utility/Card%20Cat%201.94.dsk'),
            fetch('/disks/Utility/CardCat%201.94.po')
        ]);
        if(!dskResponse.ok) throw new Error('Card Cat DSK fetch failed: '+dskResponse.status);
        if(!poResponse.ok) throw new Error('CardCat PO fetch failed: '+poResponse.status);
        const dskBytes=new Uint8Array(await dskResponse.arrayBuffer());
        const poBytes=new Uint8Array(await poResponse.arrayBuffer());

        const io=apple2plus.hwObj().io;
        const diskIISlot=EMU_defaultDiskIISlot();
        const dskMounted=loadDisk_fromBuffer(dskBytes,diskIISlot,'D1','Card Cat 1.94.dsk');
        const poMounted=EMU_mountDiskImage(poBytes,null,'UNIDISK35','CardCat 1.94.po');
        const lironInfo=findCard(io,'LIRON');
        const liron=lironInfo && lironInfo.card;
        const disk=liron && liron.getUniDisk ? liron.getUniDisk() : null;
        const media=disk && disk.getState ? disk.getState() : null;

        apple2plus.reset();
        return {
            dskBytes:dskBytes.length,
            poBytes:poBytes.length,
            dskMounted,
            poMounted,
            diskIISlot,
            lironSlot:lironInfo ? lironInfo.slotIndex : null,
            unit:media ? media.unit : null,
            mediaLoaded:media ? media.mediaLoaded : false,
            mediaBytes:media ? media.mediaBytes : 0,
            mediaFilename:media ? media.mediaFilename : ''
        };
    });
    console.log('BROWSER_MOUNT_SETUP',JSON.stringify(setup));
    if(!setup.dskMounted || !setup.poMounted || setup.dskBytes!==143360 || setup.poBytes!==819200 ||
       setup.unit!==1 || !setup.mediaLoaded || setup.mediaBytes!==819200 || setup.mediaFilename!=='CardCat 1.94.po')
        throw new Error('Normal browser mount path failed: '+JSON.stringify(setup));

    const phaseA=await runUntil(page,snap=>{
        const hay=(snap.screen+'\n'+snap.linear).toUpperCase();
        return hay.includes('CARD CAT') && hay.includes('LIRON') && /SP\s*:\s*1/.test(hay);
    },'PHASE_A_CARD_CAT');
    const phaseAText=(phaseA.screen+'\n'+phaseA.linear).toUpperCase();
    const sp1=phaseAText.includes('LIRON') && /SP\s*:\s*1/.test(phaseAText);
    console.log('--- PHASE A CARD CAT SCREEN ---');
    console.log(phaseA.screen);
    console.log('--- END PHASE A ---');

    const phaseBSetup=await page.evaluate(()=>{
        function findCard(io,pcode)
        {
            for(let i=0;i<io.slots.length;i++)
            {
                const card=io.SLOT2obj(i);
                if(card && card.id && card.id.PCODE===pcode) return {slotIndex:i,card};
            }
            return null;
        }
        const io=apple2plus.hwObj().io;
        const lironInfo=findCard(io,'LIRON');
        const diskInfo=findCard(io,'DISKII');
        if(!lironInfo) throw new Error('Liron missing before UniDisk boot');
        if(!diskInfo) throw new Error('Disk II missing before requested unmount');
        const disk=lironInfo.card.getUniDisk();
        if(!disk) throw new Error('UniDisk child missing before UniDisk boot');

        const original=disk.readBlock;
        globalThis.__cardcatUniDiskObserved={blocks:[],directoryText:'',directoryEntries:false};
        disk.readBlock=function(blockNo)
        {
            const reply=Reflect.apply(original,disk,[blockNo]);
            const n=Number(blockNo);
            globalThis.__cardcatUniDiskObserved.blocks.push(n);
            if(n===2 && reply && reply.data)
            {
                let text='';
                for(const byte of reply.data)
                    text += byte>=0x20 && byte<=0x7e ? String.fromCharCode(byte) : ' ';
                globalThis.__cardcatUniDiskObserved.directoryText=text;
                const upper=text.toUpperCase();
                globalThis.__cardcatUniDiskObserved.directoryEntries=
                    upper.includes('SYSTEM.APPLE') &&
                    upper.includes('SYSTEM.PASCAL') &&
                    upper.includes('SYSTEM.STARTUP');
            }
            return reply;
        };

        const unmounted=io.unmount(diskInfo.card.mount.slotN);
        if(!unmounted) throw new Error('Normal Apple2IO Disk II unmount failed');
        const hw=apple2plus.hwObj();
        const softHigh=hw.safe_read(0x03F3);
        const validPowerup=(softHigh^0xA5)&0xFF;
        const forcedPowerup=(validPowerup^0xFF)&0xFF;
        hw.WR[hw.lineDecode(0x03F4)](0x03F4,forcedPowerup);
        apple2plus.reset();
        return {
            unmounted,
            diskIIAfter:!!findCard(io,'DISKII'),
            lironSlot:lironInfo.slotIndex,
            coldReset:{softHigh,validPowerup,forcedPowerup},
            media:disk.getState()
        };
    });
    console.log('UNIDISK_BOOT_SETUP',JSON.stringify(phaseBSetup));
    if(!phaseBSetup.unmounted || phaseBSetup.diskIIAfter)
        throw new Error('Disk II remained mounted during UniDisk boot');

    await runTicks(page,1);
    const pr5Boot=await page.evaluate(()=>{
        const io=apple2plus.hwObj().io;
        const boards=io.DCODE2obj('PASTEBO','A2BO');
        const pasteboard=boards.length===1 ? boards[0] : null;
        if(!pasteboard || typeof(pasteboard.sendText)!=='function')
            throw new Error('Normal browser pasteboard input is unavailable');
        const pc=apple2plus.cpuObj().watch().pc&0xFFFF;
        const target=pasteboard.getTargetAddress(io);
        // Control-B enters BASIC from the Apple monitor; PR#5 is the historical
        // Apple II+/unenhanced-IIe Liron boot path.
        const sent=pasteboard.sendText(io,String.fromCharCode(0x02)+'\nPR#5\n');
        return {pc,target,sent};
    });
    console.log('PR5_LIRON_BOOT',JSON.stringify(pr5Boot));
    if(!pr5Boot.sent) throw new Error('Unable to type PR#5 Liron boot command');

    const phaseB=await runUntil(page,snap=>{
        const obs=snap.observed || {};
        const blocks=Array.isArray(obs.blocks) ? obs.blocks : [];
        return blocks.includes(2) && obs.directoryEntries===true;
    },'PHASE_B_UNIDISK_BOOT');

    const phaseBText=(phaseB.screen+'\n'+phaseB.linear).toUpperCase();
    const observed=phaseB.observed || {blocks:[]};
    const directoryBlock2Read=Array.isArray(observed.blocks) && observed.blocks.includes(2) && observed.directoryEntries===true;
    const cardCatVisible=phaseBText.includes('CARD CAT');
    const diskIIAbsent=phaseB.diskIISlot===null;
    const bootedFromUniDisk=diskIIAbsent && directoryBlock2Read;

    console.log('--- PHASE B UNIDISK SCREEN ---');
    console.log(phaseB.screen);
    console.log('--- END PHASE B ---');
    console.log('OBSERVED_BLOCKS',JSON.stringify(observed.blocks));
    console.log('DIRECTORY_TEXT',String(observed.directoryText||'').replace(/\s+/g,' ').trim());

    const result={
        mounted:setup.poMounted && setup.mediaLoaded,
        mediaBytes:setup.mediaBytes,
        unit:setup.unit,
        sp1,
        bootedFromUniDisk,
        directoryBlock2Read,
        cardCatVisible,
        diskIIAbsent
    };
    console.log('CARD_CAT_BROWSER_ACCEPTANCE',JSON.stringify(result));
    await browser.close();

    if(!result.mounted || result.mediaBytes!==819200 || result.unit!==1 || !result.sp1 ||
       !result.bootedFromUniDisk || !result.directoryBlock2Read)
        process.exit(2);
})().catch(async err=>{
    console.error('CARD_CAT_BROWSER_ACCEPTANCE_ERROR',err && err.stack ? err.stack : String(err));
    process.exit(10);
});
