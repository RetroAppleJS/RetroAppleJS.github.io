'use strict';

const assert=require('node:assert/strict');
const {chromium}=require('playwright');

const baseURL=process.env.RETROAPPLE_URL || 'http://127.0.0.1:8000';

(async()=>{
    const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const page=await browser.newPage({viewport:{width:1400,height:900}});
    page.on('pageerror',err=>console.log('[pageerror]',String(err)));

    try
    {
        await page.goto(baseURL+'/index.html?mute=1',{waitUntil:'load',timeout:120000});
        await page.waitForFunction(()=>typeof apple2plus==='object' && !!apple2plus && apple2plus.hwObj && apple2plus.hwObj().io,{timeout:120000});

        const setup=await page.evaluate(()=>{
            const io=apple2plus.hwObj().io;
            let liron=null;
            for(let slotN=0;slotN<io.slots.length;slotN++)
            {
                const card=io.SLOT2obj(slotN);
                if(card && card.id && card.id.PCODE==='LIRON') { liron=card; break; }
            }
            if(!liron) throw new Error('Liron card not found');
            const slotN=Number(liron.mount.slotN);
            const slotID=String(io.slot2ID(slotN));
            const disk=liron.getBus().getDevice(1);
            if(!disk || disk.id.DCODE!=='UNIDISK') throw new Error('UNIDISK Unit1 not found');
            if(typeof disk.ejectImage==='function') disk.ejectImage();

            const owner=document.getElementById('tab1.2');
            if(owner)
            {
                owner.hidden=false;
                if(owner.classList) owner.classList.add('active');
            }

            const ids={
                slotN,slotID,
                fileID:'liron_unit_'+slotID+'_1_file',
                downloadID:'liron_unit_'+slotID+'_1_dump',
                surfaceID:'liron_unit_'+slotID+'_1_surface',
                buttonID:'liron_unit_'+slotID+'_1_but',
                hash:Number(disk.attach && disk.attach.hash)
            };
            for(const key of ['fileID','downloadID','surfaceID','buttonID'])
            {
                const matches=document.querySelectorAll('#'+ids[key]);
                if(matches.length!==1) throw new Error(ids[key]+' expected exactly once, got '+matches.length);
            }
            return ids;
        });

        assert.ok(Number.isInteger(setup.hash),'UniDisk must have an attachment instance hash');
        const image=Buffer.alloc(819200);
        image[0]=0x11;
        image[819199]=0xEE;
        await page.locator('#'+setup.fileID).setInputFiles({
            name:'ProDOS Packer 6.0.po',
            mimeType:'application/octet-stream',
            buffer:image
        });

        await page.waitForFunction(({slotN})=>{
            const card=apple2plus.hwObj().io.SLOT2obj(slotN);
            const disk=card && card.getBus().getDevice(1);
            const state=disk && disk.getState ? disk.getState() : null;
            return !!(state && state.mediaLoaded && state.mediaFilename==='ProDOS Packer 6.0.po');
        },{slotN:setup.slotN});

        const loaded=await page.evaluate(ids=>{
            const file=document.getElementById(ids.fileID);
            const download=document.getElementById(ids.downloadID);
            const surface=document.getElementById(ids.surfaceID);
            const button=document.getElementById(ids.buttonID);
            return {
                selectedName:file && file.files && file.files[0] ? file.files[0].name : '',
                fileValue:file ? file.value : '',
                downloadDisabled:download ? download.disabled : null,
                downloadTitle:download ? download.title : '',
                surfaceDisabled:surface ? surface.disabled : null,
                surfaceTitle:surface ? surface.title : '',
                rowLabel:button ? button.value : '',
                ejectTitle:button ? button.title : ''
            };
        },setup);

        assert.equal(loaded.selectedName,'ProDOS Packer 6.0.po');
        assert.match(loaded.fileValue,/ProDOS Packer 6\.0\.po$/);
        assert.equal(loaded.downloadDisabled,false);
        assert.equal(loaded.downloadTitle,'Save ProDOS Packer 6.0.po');
        assert.equal(loaded.surfaceDisabled,false);
        assert.equal(loaded.surfaceTitle,'Disk Surface Map');
        assert.equal(loaded.rowLabel,'UNIDISK Unit1');
        assert.match(loaded.ejectTitle,/^Instance #[0-9A-F]{4}: eject disk$/);

        await page.evaluate(id=>document.getElementById(id).click(),setup.surfaceID);
        await page.waitForFunction(()=>{
            const popup=document.getElementById('lironSurfaceMap_popup');
            const text=document.getElementById('lironSurfaceMap_popup_text');
            return !!(popup && !popup.hidden && text && text.querySelectorAll('[data-surface-cell="1"]').length===1920);
        });

        const map=await page.evaluate(()=>{
            const popup=document.getElementById('lironSurfaceMap_popup');
            const text=document.getElementById('lironSurfaceMap_popup_text');
            const rect=popup.getBoundingClientRect();
            return {
                title:text.querySelector('.liron-surface-title')?.textContent || '',
                meta:text.querySelector('.liron-surface-meta')?.textContent || '',
                sides:text.querySelectorAll('.liron-surface-side').length,
                cells:text.querySelectorAll('[data-surface-cell="1"]').length,
                active:text.querySelectorAll('[data-active="1"]').length,
                inactive:text.querySelectorAll('[data-active="0"]').length,
                scrollWidth:popup.scrollWidth,
                clientWidth:popup.clientWidth,
                left:rect.left,right:rect.right,viewport:window.innerWidth
            };
        });
        assert.equal(map.title,'Disk Surface Map — UNIDISK Unit1');
        assert.match(map.meta,/1600 × 512-byte sectors/);
        assert.equal(map.sides,2);
        assert.equal(map.cells,1920);
        assert.equal(map.active,1600);
        assert.equal(map.inactive,320);
        assert.ok(map.scrollWidth<=map.clientWidth+1,'surface map popup must not scroll horizontally');
        assert.ok(map.left>=0 && map.right<=map.viewport+1,'surface map popup must fit the desktop viewport');

        await page.evaluate(id=>document.getElementById(id).click(),setup.buttonID);
        await page.waitForFunction(({slotN})=>{
            const card=apple2plus.hwObj().io.SLOT2obj(slotN);
            const disk=card && card.getBus().getDevice(1);
            return !!(disk && disk.getState && !disk.getState().mediaLoaded);
        },{slotN:setup.slotN});

        const ejected=await page.evaluate(ids=>({
            fileValue:document.getElementById(ids.fileID)?.value || '',
            downloadDisabled:document.getElementById(ids.downloadID)?.disabled,
            surfaceDisabled:document.getElementById(ids.surfaceID)?.disabled,
            popupText:document.getElementById('lironSurfaceMap_popup_text')?.textContent || ''
        }),setup);
        assert.equal(ejected.fileValue,'');
        assert.equal(ejected.downloadDisabled,true);
        assert.equal(ejected.surfaceDisabled,true);
        assert.match(ejected.popupText,/No media loaded/);

        console.log('LIRON_SURFACE_MAP_BROWSER_ACCEPTANCE',JSON.stringify({setup,loaded,map,ejected}));
    }
    finally
    {
        await browser.close();
    }
})().catch(err=>{
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
