// Real-browser acceptance of Disk II D1_DIR filename presentation.
// node tests/disk2_uri_filename_browser.mjs (requires Playwright Chromium).
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const origin=process.env.RETROAPPLE_URL || "http://127.0.0.1:8000";
const filename="ProDOS_8_JPlus.dsk";
const remoteURL="https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/disks/ProDos/"+filename;
const disk=readFileSync("disks/ProDos/"+filename);
const replacement=readFileSync("disks/ProDOS 8.dsk");
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const page=await browser.newPage({viewport:{width:1400,height:900}});
const pageErrors=[];
page.on("pageerror",e=>pageErrors.push(String(e)));

try
{
    // Serve the real committed bytes deterministically; do not depend on
    // GitHub raw download availability during browser acceptance tests.
    await page.route(remoteURL,route=>route.fulfill({
        status:200,contentType:"application/octet-stream",
        headers:{"access-control-allow-origin":"*"},
        body:disk
    }));
    const start=origin+"/index.html?sys=A2JP&slots=3:VIDEX,6:DISKII"+
        "&D1_DIR=ProDos/ProDOS_8_JPlus.dsk&boot=1";
    await page.goto(start,{waitUntil:"domcontentloaded",timeout:35000});
    await page.waitForFunction(()=>document.getElementById("file_7_D1_name")?.textContent==="ProDOS_8_JPlus.dsk",
        null,{timeout:45000});
    const state=await page.evaluate(()=>{
        const io=apple2plus.hwObj().io;
        const disk2=io.SLOT2obj(7);
        const input=document.getElementById("file_7_D1");
        return {
            filename:document.getElementById("file_7_D1_name")?.textContent,
            filePicker:input?.type,
            filePickerDisabled:input?.disabled,
            nativeFileCount:input?.files?.length,
            label:document.querySelector('label[for="file_7_D1"]')?.textContent,
            diskState:disk2?.getState()?.diskName?.[0],
            mounted:!!disk2?.getState()?.diskData?.[0],
            videx:io.SLOT2obj(4)?.id?.PCODE,
            diskCard:disk2?.id?.PCODE
        };
    });
    console.log("REMOTE DRIVE",JSON.stringify(state));
    if(state.filename!==filename || state.diskState!==filename ||
       !state.mounted || state.videx!=="VIDEX" || state.diskCard!=="DISKII" ||
       state.label!=="Choose File" || state.filePicker!=="file" ||
       state.filePickerDisabled || state.nativeFileCount!==0)
        throw new Error("Incorrect D1 URI-loaded filename or replacement picker state");

    // Local replacement should still be possible with the same file input.
    await page.locator("#file_7_D1").setInputFiles({
        name:"replacement.dsk",
        mimeType:"application/octet-stream",
        buffer:replacement
    });
    await page.waitForFunction(()=>
        document.getElementById("file_7_D1_name")?.textContent==="replacement.dsk",
        null,{timeout:20000});
    console.log("LOCAL REPLACEMENT OK");

    // Eject clears both media data and its UI filename, restoring native input.
    const ejected=await page.evaluate(()=>{
        ejectDisk(document.getElementById("but_7_D1"),7,"D1");
        const io=apple2plus.hwObj().io;
        const disk2=io.SLOT2obj(7);
        const input=document.getElementById("file_7_D1");
        return {
            mounted:!!disk2?.getState()?.diskData?.[0],
            filename:disk2?.getState()?.diskName?.[0],
            nameLabel:document.getElementById("file_7_D1_name"),
            inputStyle:input?.style?.display,
            pickerExists:input?.type==="file"
        };
    });
    console.log("EJECT",JSON.stringify(ejected));
    if(ejected.mounted || ejected.filename || ejected.nameLabel ||
       ejected.inputStyle!=="inline-block" || !ejected.pickerExists)
        throw new Error("Eject did not clear the filename and restore file picker");
    if(pageErrors.length)throw new Error("Browser script errors: "+pageErrors.join("; "));
    console.log("PASS: D1_DIR name, local replace, eject and original slot configuration");
}
finally
{
    await page.close();
    await browser.close();
}
