'use strict';

const {chromium}=require('playwright');
const baseURL=process.env.RETROAPPLE_URL || 'http://127.0.0.1:8000';

(async()=>{
    const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const page=await browser.newPage({viewport:{width:1400,height:1000}});
    const pageErrors=[];
    page.on('pageerror',err=>pageErrors.push(String(err)));

    await page.goto(baseURL+'/index.html?mute=1',{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>typeof apple2plus==='object' && !!apple2plus,{timeout:120000});

    const initial=await page.evaluate(()=>{
        const io=apple2plus.hwObj().io;
        let slotIndex=-1,liron=null;
        for(let i=0;i<io.slots.length;i++)
        {
            const card=io.SLOT2obj(i);
            if(card && card.id && card.id.PCODE==='LIRON') { slotIndex=i; liron=card; break; }
        }
        if(!liron) throw new Error('Liron is not mounted');
        io.slotConfig_refresh(slotIndex);
        const slotPopup=document.getElementById('slotConfig_popup');
        slotPopup.hidden=false;
        const labels=slotPopup.querySelectorAll('[data-dcode="UNIDISK35"]');
        if(labels.length!==1) throw new Error('Expected one provisioned UniDisk row, got '+labels.length);
        const first=liron.devices.find(d=>d && d.id && d.id.DCODE==='UNIDISK35');
        return {
            slotIndex,
            labelHTML:labels[0].outerHTML,
            instance:Number(first.attach.hash),
            units:liron.getBus().getUnits(),
            tableText:slotPopup.innerText
        };
    });

    if(initial.labelHTML.includes('\\\\"'))
        throw new Error('Device label still contains literal backslash escapes: '+initial.labelHTML);
    if(!initial.tableText.includes('Instance') || initial.units.length!==1 || initial.units[0]!==1)
        throw new Error('Initial device table/unit state is wrong: '+JSON.stringify(initial));

    await page.evaluate(slotIndex=>{
        const slotPopup=document.getElementById('slotConfig_popup');
        slotPopup.querySelector('[data-dcode="UNIDISK35"]').click();
    },initial.slotIndex);
    await page.waitForTimeout(50);

    const detail=await page.evaluate(()=>{
        const popup=document.getElementById('deviceConfig_popup');
        return {hidden:popup ? popup.hidden : null,text:popup ? popup.innerText : ''};
    });
    if(detail.hidden || !detail.text.includes('UNIDISK35') || !detail.text.includes('#'))
        throw new Error('Existing-device click did not open instance detail: '+JSON.stringify(detail));
    if(pageErrors.length)
        throw new Error('Browser page error after existing-device click: '+pageErrors.join(' | '));

    await page.evaluate(()=>apple2plus.hwObj().io.deviceConfig_close());

    await page.evaluate(slotIndex=>document.getElementById('device_add_'+slotIndex).click(),initial.slotIndex);
    const picker=await page.evaluate(()=>{
        const popup=document.getElementById('deviceConfig_popup');
        const row=popup && popup.querySelector('.device-picker-entry');
        return {hidden:popup ? popup.hidden : null,text:popup ? popup.innerText : '',disabled:row ? row.disabled : null};
    });
    const pickerText=picker.text.replace(/\s+/g,' ');
    if(picker.hidden || picker.disabled || !pickerText.includes('Attached: 1'))
        throw new Error('Picker does not offer another identical device: '+JSON.stringify(picker));

    await page.evaluate(()=>document.querySelector('#deviceConfig_popup .device-picker-entry').click());
    await page.waitForTimeout(50);

    const doubled=await page.evaluate(slotIndex=>{
        const io=apple2plus.hwObj().io;
        const liron=io.SLOT2obj(slotIndex);
        const disks=liron.devices.filter(d=>d && d.id && d.id.DCODE==='UNIDISK35');
        const slotPopup=document.getElementById('slotConfig_popup');
        const labels=slotPopup.querySelectorAll('[data-dcode="UNIDISK35"]');
        return {
            count:disks.length,
            hashes:disks.map(d=>Number(d.attach.hash)),
            units:liron.getBus().getUnits(),
            rowCount:labels.length,
            tableText:slotPopup.innerText
        };
    },initial.slotIndex);

    if(doubled.count!==2 || doubled.rowCount!==2 || doubled.units.join(',')!=='1,2' ||
       new Set(doubled.hashes).size!==2 || !doubled.tableText.includes('Instance'))
        throw new Error('Second identical device was not mounted distinctly: '+JSON.stringify(doubled));

    await page.evaluate(()=>{
        const labels=document.getElementById('slotConfig_popup').querySelectorAll('[data-dcode="UNIDISK35"]');
        labels[1].click();
    });
    await page.waitForTimeout(30);
    await page.evaluate(()=>{
        const eject=document.querySelector('#deviceConfig_popup button[title="Detach device"]');
        if(!eject) throw new Error('Second instance eject button missing');
        eject.click();
    });
    await page.waitForTimeout(30);

    const afterEject=await page.evaluate(slotIndex=>{
        const liron=apple2plus.hwObj().io.SLOT2obj(slotIndex);
        const disks=liron.devices.filter(d=>d && d.id && d.id.DCODE==='UNIDISK35');
        return {
            count:disks.length,
            hashes:disks.map(d=>Number(d.attach.hash)),
            units:liron.getBus().getUnits()
        };
    },initial.slotIndex);

    if(afterEject.count!==1 || afterEject.units.join(',')!=='1' || afterEject.hashes[0]!==initial.instance)
        throw new Error('Instance-specific eject removed the wrong device: '+JSON.stringify(afterEject));
    if(pageErrors.length)
        throw new Error('Browser page errors: '+pageErrors.join(' | '));

    console.log('DEVICE_INSTANCE_BROWSER_ACCEPTANCE',JSON.stringify({initial,detail,picker,doubled,afterEject}));
    await browser.close();
})().catch(err=>{
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
});
