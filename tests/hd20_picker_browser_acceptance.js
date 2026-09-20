'use strict';

const {chromium}=require('playwright');
const baseURL=process.env.RETROAPPLE_URL || 'http://127.0.0.1:8000';

function normalizeText(value)
{
    return String(value || '').replace(/\u00a0/g,' ');
}

(async()=>{
    const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const page=await browser.newPage({viewport:{width:1400,height:1000}});
    const pageErrors=[];
    page.on('pageerror',err=>pageErrors.push(String(err)));

    await page.goto(baseURL+'/index.html?mute=1',{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>typeof apple2plus==='object' && !!apple2plus && apple2plus.hwObj && apple2plus.hwObj().io,{timeout:120000});

    const result=await page.evaluate(()=>{
        if(typeof appleIntervalHandle!=='undefined' && appleIntervalHandle)
        {
            clearInterval(appleIntervalHandle);
            appleIntervalHandle=null;
        }

        const io=apple2plus.hwObj().io;
        let slot=-1, owner=null;
        for(let i=0;i<io.slots.length;i++)
        {
            const candidate=io.SLOT2obj(i);
            if(candidate && candidate.id && candidate.id.PCODE==='LIRON')
            {
                slot=i;
                owner=candidate;
                break;
            }
        }
        if(!owner) throw new Error('Liron peripheral not mounted');

        const initial=(owner.devices||[]).map(device=>({
            dcode:device.id && device.id.DCODE,
            unit:typeof device.getUnit==='function' ? device.getUnit() : null
        }));

        io.devicePicker_popup(slot);
        const popup=document.getElementById('deviceConfig_popup');
        if(!popup || popup.hidden) throw new Error('device picker did not open');
        const rows=[...popup.querySelectorAll('.device-picker-entry')];
        const firstHD20=rows.find(row=>/HD20/.test(row.textContent));
        if(!firstHD20) throw new Error('HD20 is missing from Liron picker');
        const pickerText=popup.textContent;
        firstHD20.click();

        const afterFirst=(owner.devices||[]).map(device=>({
            dcode:device.id && device.id.DCODE,
            instance:device.attach && device.attach.hash,
            unit:typeof device.getUnit==='function' ? device.getUnit() : null,
            port:device.ports && device.ports.smartport ? {...device.ports.smartport} : null
        }));

        const mediaMounted=typeof EMU_mountDiskImage==='function' &&
            EMU_mountDiskImage(new Uint8Array(20971520),slot,'HD20','HD20.po',2);
        const hd20=typeof owner.getHD20==='function' ? owner.getHD20(2) : null;
        const hd20Media=hd20 && typeof hd20.getState==='function' ? hd20.getState() : null;
        const slotID=typeof io.slot2ID==='function' ? io.slot2ID(slot) : String(slot);
        const toolboxHTML=typeof owner.deviceToolSlotHTML==='function'
            ? owner.deviceToolSlotHTML({slotN:slot,slotID,toolboxID:'hd20_test_toolbox',devices:owner.devices})
            : '';

        io.devicePicker_popup(slot);
        const popup2=document.getElementById('deviceConfig_popup');
        const secondHD20=[...popup2.querySelectorAll('.device-picker-entry')].find(row=>/HD20/.test(row.textContent));
        if(!secondHD20) throw new Error('HD20 disappeared after first attachment');
        const secondPickerText=secondHD20.textContent;
        secondHD20.click();

        const afterSecond=(owner.devices||[]).map(device=>({
            dcode:device.id && device.id.DCODE,
            instance:device.attach && device.attach.hash,
            unit:typeof device.getUnit==='function' ? device.getUnit() : null,
            port:device.ports && device.ports.smartport ? {...device.ports.smartport} : null
        }));

        return {slot,initial,pickerText,secondPickerText,afterFirst,mediaMounted,hd20Media,toolboxHTML,afterSecond};
    });

    console.log('HD20_PICKER_BROWSER_ACCEPTANCE',JSON.stringify({
        ...result,
        toolboxHTML:result.toolboxHTML.includes('HD20_2') ? '[contains HD20_2]' : '[missing HD20_2]'
    }));
    if(pageErrors.length) throw new Error('browser page errors: '+pageErrors.join(' | '));

    const pickerText=normalizeText(result.pickerText);
    const secondPickerText=normalizeText(result.secondPickerText);
    const initialHD20=result.initial.filter(d=>d.dcode==='HD20');
    if(initialHD20.length!==0) throw new Error('HD20 must not auto-attach: '+JSON.stringify(result.initial));
    if(!/HD20/.test(pickerText) || !/Apple Hard Disk 20/.test(pickerText))
        throw new Error('picker does not advertise HD20 correctly: '+pickerText);

    const firstHD20=result.afterFirst.filter(d=>d.dcode==='HD20');
    if(firstHD20.length!==1 || firstHD20[0].unit!==2 || !firstHD20[0].port || firstHD20[0].port.unit!==2)
        throw new Error('first HD20 did not attach as SmartPort unit 2: '+JSON.stringify(result.afterFirst));
    if(!result.mediaMounted || !result.hd20Media || !result.hd20Media.mediaLoaded ||
       result.hd20Media.mediaBytes!==20971520 || result.hd20Media.mediaFilename!=='HD20.po')
        throw new Error('browser HD20 media mount failed: '+JSON.stringify(result.hd20Media));
    if(!result.toolboxHTML.includes('HD20_2'))
        throw new Error('HD20 toolbox row did not use its device identity');

    const secondHD20=result.afterSecond.filter(d=>d.dcode==='HD20');
    if(secondHD20.length!==2 || secondHD20[0].instance===secondHD20[1].instance ||
       secondHD20[0].unit!==2 || secondHD20[1].unit!==3 ||
       secondHD20[0].port.unit!==2 || secondHD20[1].port.unit!==3)
        throw new Error('second HD20 instance/unit allocation failed: '+JSON.stringify(result.afterSecond));
    if(!/Attached:\s*1/.test(secondPickerText))
        throw new Error('picker did not report one attached HD20 before adding another: '+secondPickerText);

    await browser.close();
})().catch(err=>{
    console.error('HD20_PICKER_BROWSER_ACCEPTANCE_ERROR',err && err.stack ? err.stack : String(err));
    process.exit(10);
});
