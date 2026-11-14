// End-to-end 6502 boot test for the unmodified J-Plus monitor and a
// separately patched ProDOS 2.5.0a8 disk. Requires Playwright Chromium.
// Run after generating ProDOS_8_JPlus.dsk and starting a local web server:
// RETROAPPLE_URL=http://127.0.0.1:8000 node tests/prodos_jplus_browser_acceptance.mjs
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const url=process.env.RETROAPPLE_URL || "http://127.0.0.1:8000";
const base=readFileSync("disks/ProDOS 8.dsk");
const patched=readFileSync("ProDOS_8_JPlus.dsk");
const bytes=Array.from(base),patchedBytes=Array.from(patched);
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});

async function scenario(model,image,name)
{
    const page=await browser.newPage({viewport:{width:1300,height:900}});
    const errors=[];
    page.on("pageerror",err=>errors.push(String(err)));
    page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text());});
    try
    {
        await page.goto(url+"/index.html?sys="+model,{waitUntil:"domcontentloaded",timeout:30000});
        await page.waitForFunction(()=>
            typeof apple2plus==="object" && apple2plus &&
            typeof EMU_defaultDiskIISlot==="function" &&
            EMU_defaultDiskIISlot()!==null,
            {timeout:35000});
        const inserted=await page.evaluate(raw=>{
            const slotN=EMU_defaultDiskIISlot();
            const ok=loadDisk_fromBuffer(Uint8Array.from(raw),slotN,"D1","ProDOS.dsk");
            if(ok) apple2plus.restart();
            const card=apple2plus.hwObj().io.SLOT2obj(1);
            return {ok,slotN,card:card?.id?.PCODE || null,romB3:apple2plus.hwObj().read(0xFBB3),
                    rom1E:apple2plus.hwObj().read(0xFB1E)};
        },image);
        if(!inserted.ok || inserted.card!=="MS16K")
            throw new Error("Disk or MS16K not available: "+JSON.stringify(inserted));
        const began=Date.now();
        let sample;
        do
        {
            sample=await page.evaluate(()=>{
                const hw=apple2plus.hwObj();
                const codes=[];
                for(let addr=0x400;addr<0x800;addr++)codes.push(hw.read(addr)&127);
                const text=String.fromCharCode(...codes);
                const disk=hw.io.SLOT2obj(7);
                return {
                    requires:text.includes("REQUIRES 64K"),
                    title:text.includes("PRODOS"),
                    msg:text.match(/[A-Z0-9 ]{8,}/g)?.filter(v=>v.trim().length>8).slice(0,12),
                    machid:hw.read(0xBF98),
                    pc:apple2plus.cpuObj?.()?.getPC?.(),
                    ms16k:hw.io.SLOT2obj(1)?.state?.softswitch_pos,
                    floppy:disk?.id?.PCODE,
                };
            });
            if(sample.requires)break;
            // The patched boot succeeds if ProDOS's global machine ID
            // is installed (high nibble encodes memory/configuration).
            if(sample.machid!==0 && sample.machid!==255 && sample.machid!==null &&
               sample.title===false && Date.now()-began>3000) break;
            await page.waitForTimeout(250);
        }while(Date.now()-began<15000);
        console.log("BOOT",name,JSON.stringify({inserted,sample,errors:errors.slice(0,8)}));
        return {inserted,sample,errors};
    }
    finally{await page.close();}
}

try
{
    const a2p=await scenario("A2P",bytes,"A2P original");
    if(a2p.sample.requires)throw new Error("A2P original unexpectedly rejects 64K");
    const original=await scenario("A2JP",bytes,"A2JP original");
    if(!original.sample.requires)
        throw new Error("J-Plus original ROM-ID incompatibility was not reproduced");
    const compatible=await scenario("A2JP",patchedBytes,"A2JP patched");
    if(compatible.sample.requires)
        throw new Error("J-Plus compatibility image still reports REQUIRES 64K");
    console.log("PASS: A2P original, A2JP original regression, A2JP compatible image");
}
finally{await browser.close();}
