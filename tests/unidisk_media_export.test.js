'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const deviceSource=fs.readFileSync('res/EMU_DEVICE_UNIDISK35.js','utf8');
const cardSource=fs.readFileSync('res/EMU_CARD_LIRON.js','utf8');

function loadContext(extra={})
{
    const context=vm.createContext(Object.assign({
        console:{log(){},warn(){},error(){}},
        Uint8Array,ArrayBuffer,Array,Number,String,Object,Math,RangeError,Error,Reflect,
        oEMU:{component:{IO:{}}}
    },extra));
    vm.runInContext(deviceSource,context,{filename:'EMU_DEVICE_UNIDISK35.js'});
    vm.runInContext(cardSource,context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

test('loaded UniDisk exposes an independent downloadable 800 KiB image using its mounted filename',()=>{
    const context=loadContext();
    const disk=new context.UniDisk35Device();
    const source=new Uint8Array(819200);
    source[0]=0x11;
    source[source.length-1]=0xEE;
    disk.loadImage(source,{filename:'ProDOS Packer 6.0.po'});

    assert.equal(typeof disk.getImage,'function');
    assert.equal(typeof disk.getSuggestedFilename,'function');
    assert.equal(disk.getSuggestedFilename(),'ProDOS Packer 6.0.po');

    const image=disk.getImage();
    assert.equal(image.length,819200);
    assert.equal(image[0],0x11);
    assert.equal(image[image.length-1],0xEE);
    image[0]=0x99;
    assert.equal(disk.readBlock(0).data[0],0x11,
        'export must return a copy rather than exposing mutable device media');
});

test('Liron enables UniDisk download only while removable media is loaded',()=>{
    const rows=[];
    const downloads=[];
    const context=loadContext({
        EMU_deviceMediaRowHTML(spec){ rows.push(spec); return '<row></row>'; },
        oCOM:{Download(filename,data){downloads.push({filename,data:Uint8Array.from(data)});}}
    });
    const card=new context.AppleLiron();
    const disk=new context.UniDisk35Device();
    card.devices=[disk];
    assert.equal(disk.bindHost(card),true);

    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});
    assert.equal(rows[0].downloadDisabled,true,'empty UniDisk must not offer a download');

    disk.loadImage(new Uint8Array(819200),{filename:'ProDOS Packer 6.0.po'});
    rows.length=0;
    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});
    assert.equal(rows[0].downloadDisabled,false,'loaded UniDisk must enable the download icon');
    assert.match(rows[0].downloadOnClick,/deviceToolDownload\(1\)/);
    assert.equal(rows[0].downloadTitle,'Save ProDOS Packer 6.0.po');

    assert.equal(card.deviceToolDownload(1),true);
    assert.equal(downloads.length,1);
    assert.equal(downloads[0].filename,'ProDOS Packer 6.0.po');
    assert.equal(downloads[0].data.length,819200);

    assert.equal(card.deviceToolEject(1),true);
    rows.length=0;
    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});
    assert.equal(rows[0].downloadDisabled,true,'ejected UniDisk must disable download again');
});
