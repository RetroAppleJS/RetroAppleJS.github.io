'use strict';

const {chromium}=require('playwright');
const baseURL=process.env.RETROAPPLE_URL || 'http://127.0.0.1:8000';

(async()=>{
    const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const page=await browser.newPage({viewport:{width:1400,height:1000}});
    page.on('pageerror',err=>console.log('[pageerror]',String(err)));

    await page.goto(baseURL+'/index.html?mute=1',{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>typeof apple2plus==='object' && !!apple2plus,{timeout:120000});

    const setup=await page.evaluate(()=>{
        const io=apple2plus.hwObj().io;
        let slotIndex=-1, liron=null;
        for(let i=0;i<io.slots.length;i++)
        {
            const card=io.SLOT2obj(i);
            if(card && card.id && card.id.PCODE==='LIRON')
            {
                slotIndex=i;
                liron=card;
                break;
            }
        }
        if(!liron) throw new Error('Liron is not mounted');

        io.detach(liron,'UNIDISK35');
        io.slotConfig_refresh(slotIndex);
        const slotPopup=document.getElementById('slotConfig_popup');
        slotPopup.hidden=false;
        const plus=document.getElementById('device_add_'+slotIndex);
        return {
            slotIndex,
            plusFound:!!plus,
            plusTitle:plus ? plus.title : '',
            plusExpanded:plus ? plus.getAttribute('aria-expanded') : null,
            devices:Array.isArray(liron.devices) ? liron.devices.length : -1
        };
    });

    if(!setup.plusFound || setup.devices!==0 || setup.plusExpanded!=='false')
        throw new Error('Initial detached picker state is wrong: '+JSON.stringify(setup));

    await page.locator('#device_add_'+setup.slotIndex).click();
    const available=await page.evaluate(slotIndex=>{
        const popup=document.getElementById('deviceConfig_popup');
        const row=popup && popup.querySelector('.device-picker-entry');
        const plus=document.getElementById('device_add_'+slotIndex);
        return {
            popupHidden:popup ? popup.hidden : null,
            text:popup ? popup.innerText : '',
            rowTag:row ? row.tagName : '',
            rowDisabled:row ? row.disabled : null,
            nestedButtons:row ? row.querySelectorAll('button').length : -1,
            plusExpanded:plus ? plus.getAttribute('aria-expanded') : null
        };
    },setup.slotIndex);

    if(available.popupHidden || available.rowTag!=='BUTTON' || available.rowDisabled ||
       available.nestedButtons!==0 || available.plusExpanded!=='true' ||
       !available.text.includes('ADD DEVICE TO LIRON') ||
       !available.text.includes('UNIDISK35') ||
       !available.text.includes('Available'))
        throw new Error('Available-device picker state is wrong: '+JSON.stringify(available));

    await page.locator('#deviceConfig_popup .device-picker-entry').click();
    const attached=await page.evaluate(slotIndex=>{
        const io=apple2plus.hwObj().io;
        const liron=io.SLOT2obj(slotIndex);
        const popup=document.getElementById('deviceConfig_popup');
        const plus=document.getElementById('device_add_'+slotIndex);
        const slotPopup=document.getElementById('slotConfig_popup');
        return {
            pickerHidden:popup ? popup.hidden : null,
            plusExpanded:plus ? plus.getAttribute('aria-expanded') : null,
            childCount:Array.isArray(liron.devices) ? liron.devices.length : -1,
            unit:liron.getUniDisk && liron.getUniDisk() ? liron.getUniDisk().getUnit() : null,
            parentText:slotPopup ? slotPopup.innerText : ''
        };
    },setup.slotIndex);

    if(!attached.pickerHidden || attached.plusExpanded!=='false' || attached.childCount!==1 ||
       attached.unit!==1 || !attached.parentText.includes('UNIDISK35'))
        throw new Error('Attach flow did not return to refreshed peripheral detail: '+JSON.stringify(attached));

    await page.locator('#device_add_'+setup.slotIndex).click();
    const attachedList=await page.evaluate(()=>{
        const popup=document.getElementById('deviceConfig_popup');
        const row=popup && popup.querySelector('.device-picker-entry');
        return {
            text:popup ? popup.innerText : '',
            rowDisabled:row ? row.disabled : null
        };
    });

    if(!attachedList.rowDisabled || !attachedList.text.includes('Attached'))
        throw new Error('Attached device state is not explicit: '+JSON.stringify(attachedList));

    console.log('DEVICE_PICKER_BROWSER_ACCEPTANCE',JSON.stringify({setup,available,attached,attachedList}));
    await browser.close();
})().catch(err=>{
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
});
