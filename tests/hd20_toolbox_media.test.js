'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('res/EMU_CARD_LIRON.js','utf8');
const hd20Source=fs.readFileSync('res/EMU_DEVICE_HD20.js','utf8');
const pakoSource=fs.readFileSync('res/pako.min.js','utf8');

function blankImage()
{
    return new Uint8Array(40960*512);
}

function prodosImage(volumeName)
{
    const image=blankImage();
    const name=String(volumeName || '').slice(0,15);
    const offset=2*512+4;
    image[offset]=0xF0 | name.length;
    for(let i=0;i<name.length;i++) image[offset+1+i]=name.charCodeAt(i)&0x7F;
    return image;
}

function fakeDevice(dcode,description,unit,blocks,options={})
{
    const device={
        id:{DCODE:dcode,description,hostPCODE:'LIRON',deviceN:unit},
        getUnit(){return unit;},
        getBlockSize(){return 512;},
        getBlockCount(){return blocks;},
        getState(){return {unit,mediaLoaded:dcode==='HD20',mediaFilename:options.mediaFilename || ''};},
        ejectImage(){return true;}
    };
    if(dcode==='HD20')
    {
        device.getSuggestedFilename=()=>options.logicalFilename || 'HD20.po';
        device.getImage=()=>options.image ? Uint8Array.from(options.image) : new Uint8Array(blocks*512);
    }
    return device;
}

function loadLiron(extra={})
{
    const context=vm.createContext(Object.assign({
        console:{log(){},warn(){},error(){}},
        Uint8Array,ArrayBuffer,Array,Number,String,Object,Math,RangeError,Error,Reflect,
        oEMU:{component:{IO:{}}}
    },extra));
    vm.runInContext(pakoSource,context,{filename:'pako.min.js'});
    vm.runInContext(hd20Source,context,{filename:'EMU_DEVICE_HD20.js'});
    vm.runInContext(source,context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

test('Liron toolbox names media controls by each SmartPort device type',()=>{
    const rows=[];
    const context=loadLiron({
        EMU_deviceMediaRowHTML(spec){rows.push(spec);return '<row>'+spec.label+'</row>';}
    });
    const card=new context.AppleLiron();
    const uni=fakeDevice('UNIDISK','Apple UniDisk 3.5',1,1600);
    const hd=fakeDevice('HD20','Apple Hard Disk 20',2,40960);
    card.devices=[uni,hd];

    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});

    assert.equal(rows.length,2);
    assert.equal(rows[0].fileName,'UNIDISK_1');
    assert.equal(rows[1].fileName,'HD20_2');
    assert.match(rows[0].fileOnChange,/deviceToolLoadFile\(this,1\)/);
    assert.match(rows[1].fileOnChange,/deviceToolLoadFile\(this,2\)/);
    assert.equal(rows[0].fileAccept,'.po');
    assert.equal(rows[1].fileAccept,'.po,.po.gz');
});

test('HD20 toolbox uses a logical filename and enables image download while UniDisk keeps native removable-media behavior',()=>{
    const rows=[];
    const context=loadLiron({
        EMU_deviceMediaRowHTML(spec){rows.push(spec);return '<row>'+spec.label+'</row>';}
    });
    const card=new context.AppleLiron();
    const uni=fakeDevice('UNIDISK','Apple UniDisk 3.5',1,1600,{mediaFilename:'TOOLS.po'});
    const hd=fakeDevice('HD20','Apple Hard Disk 20',2,40960,{logicalFilename:'BLANK92.po'});
    card.devices=[uni,hd];

    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});

    assert.equal(rows[0].fileDisplayName,undefined,'UniDisk must keep the browser-owned native file input');
    assert.equal(rows[0].downloadDisabled,true);
    assert.equal(rows[0].buttonTitle,'Unit1: eject disk');

    assert.equal(rows[1].fileDisplayName,'BLANK92.po');
    assert.equal(rows[1].downloadDisabled,false);
    assert.match(rows[1].downloadOnClick,/deviceToolDownload\(2\)/);
    assert.equal(rows[1].downloadTitle,'Save BLANK92.po.gz');
    assert.equal(rows[1].buttonTitle,'Unit2: erase/reset disk');
});

test('Liron gzip-downloads the exact HD20 backing image using a .po.gz filename',()=>{
    const downloads=[];
    const image=new Uint8Array(20971520);
    image[0]=0x11;
    image[20971519]=0xEE;
    const context=loadLiron({
        oCOM:{Download(filename,data){downloads.push({filename,data:Uint8Array.from(data)});}},
        EMU_deviceMediaRowHTML(){return '<row></row>';}
    });
    const card=new context.AppleLiron();
    const hd=fakeDevice('HD20','Apple Hard Disk 20',1,40960,{logicalFilename:'BLANK92.po',image});
    card.devices=[hd];
    card.getBus().attach(hd,1);

    assert.equal(typeof card.deviceToolDownload,'function');
    assert.equal(card.deviceToolDownload(1),true);
    assert.equal(downloads.length,1);
    assert.equal(downloads[0].filename,'BLANK92.po.gz');
    assert.equal(downloads[0].data[0],0x1F);
    assert.equal(downloads[0].data[1],0x8B);
    const inflated=Uint8Array.from(context.pako.ungzip(downloads[0].data));
    assert.equal(inflated.length,20971520);
    assert.equal(inflated[0],0x11);
    assert.equal(inflated[20971519],0xEE);
});

test('HD20 media metadata changes refresh the open Liron toolbox',()=>{
    const refreshCalls=[];
    const context=loadLiron({
        apple2plus:{hwObj(){return {io:{
            slot2ID(slotN){return String(slotN-1);},
            refreshDeviceToolboxes(arg){refreshCalls.push(arg);}
        }};}},
        EMU_deviceMediaRowHTML(){return '<row></row>';}
    });
    const card=new context.AppleLiron();
    card.mount={slotN:6};
    const hd=fakeDevice('HD20','Apple Hard Disk 20',1,40960);
    card.devices=[hd];

    assert.equal(typeof card.deviceMediaMetadataChanged,'function');
    assert.equal(card.deviceMediaMetadataChanged(hd),true);
    assert.equal(refreshCalls.length,1);
    assert.equal(refreshCalls[0].id,'devices');
    assert.equal(refreshCalls[0].default_slot,'5');
});

test('HD20 Unit button ejects a mounted ProDOS image back to unformatted backing media',()=>{
    const rows=[];
    const refreshCalls=[];
    const context=loadLiron({
        apple2plus:{hwObj(){return {io:{
            slot2ID(slotN){return String(slotN-1);},
            refreshDeviceToolboxes(arg){refreshCalls.push(arg);}
        }};}},
        EMU_deviceMediaRowHTML(spec){rows.push(spec);return '<row>'+spec.label+'</row>';}
    });
    const card=new context.AppleLiron();
    card.mount={slotN:6};
    const hd=new context.HD20Device();
    card.devices=[hd];
    assert.equal(hd.bindHost(card),true);
    hd.loadImage(prodosImage('BLANK92'),{filename:'BLANK92.po'});
    assert.equal(hd.getSuggestedFilename(),'BLANK92.po');

    assert.equal(card.deviceToolEject(1),true);
    assert.equal(card.getBus().getDevice(1),hd,'ejecting media must keep the HD20 device attached');
    assert.equal(hd.getVolumeName(),'');
    assert.equal(hd.getSuggestedFilename(),'UNFORMATTED-HD20.po');
    assert.equal(hd.getState().mediaLoaded,true);
    assert.deepEqual(Array.from(hd.readBlock(2).data),new Array(512).fill(0));

    rows.length=0;
    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});
    assert.equal(rows[0].fileDisplayName,'UNFORMATTED-HD20.po');
    assert.ok(refreshCalls.length>=1);
});

test('Liron toolbox routes a 20 MiB file to the HD20 resident at that unit',()=>{
    const mountCalls=[];
    class FakeFileReader
    {
        readAsArrayBuffer(file){this.onload({target:{result:file.bytes.buffer}});}
    }
    const context=loadLiron({
        FileReader:FakeFileReader,
        alert(){},
        EMU_mountDiskImage(bytes,slotN,deviceID,filename,unit)
        {
            mountCalls.push({length:bytes.length,slotN,deviceID,filename,unit});
            return true;
        },
        apple2plus:{hwObj(){return {io:{slot2ID(n){return String(n-1);},refreshDeviceToolboxes(){}}};}}
    });
    const card=new context.AppleLiron();
    card.mount={slotN:6};
    const uni=fakeDevice('UNIDISK','Apple UniDisk 3.5',1,1600);
    const hd=fakeDevice('HD20','Apple Hard Disk 20',2,40960);
    card.devices=[uni,hd];
    card.getBus().attach(uni,1);
    card.getBus().attach(hd,2);

    const file={name:'HD20.po',size:20971520,bytes:new Uint8Array(20971520)};
    const input={files:[file],value:'C:\\fakepath\\HD20.po'};

    assert.equal(card.deviceToolLoadFile(input,2),true);
    assert.deepEqual(mountCalls,[{
        length:20971520,slotN:6,deviceID:'HD20',filename:'HD20.po',unit:2
    }]);
    assert.equal(input.value,'C:\\fakepath\\HD20.po');
});

test('Liron toolbox rejects media whose size does not match the selected resident device',()=>{
    let mounts=0;
    const alerts=[];
    class NeverReadFileReader
    {
        readAsArrayBuffer(){throw new Error('wrong-size media must be rejected before FileReader');}
    }
    const context=loadLiron({
        FileReader:NeverReadFileReader,
        alert(msg){alerts.push(String(msg));},
        EMU_mountDiskImage(){mounts++;return true;}
    });
    const card=new context.AppleLiron();
    card.mount={slotN:6};
    const hd=fakeDevice('HD20','Apple Hard Disk 20',2,40960);
    card.devices=[hd];
    card.getBus().attach(hd,2);

    const input={files:[{name:'wrong.po',size:819200}],value:'C:\\fakepath\\wrong.po'};
    assert.equal(card.deviceToolLoadFile(input,2),false);
    assert.equal(mounts,0);
    assert.equal(input.value,'');
    assert.ok(alerts.some(msg=>msg.includes('20971520')));
});
test('HD20 media row starts with the unformatted default and switches immediately to the loaded host filename',()=>{
    const rows=[];
    const filenameNode={textContent:'UNFORMATTED-HD20.po'};
    let hd=null;

    class FakeFileReader
    {
        readAsArrayBuffer(file){this.onload({target:{result:file.bytes.buffer}});}
    }

    const context=loadLiron({
        FileReader:FakeFileReader,
        alert(){},
        document:{
            getElementById(id)
            {
                return id==='liron_unit_5_1_file_name' ? filenameNode : null;
            }
        },
        EMU_deviceMediaRowHTML(spec){rows.push(spec);return '<row>'+spec.label+'</row>';},
        EMU_mountDiskImage(bytes,slotN,deviceID,filename,unit)
        {
            assert.equal(slotN,6);
            assert.equal(deviceID,'HD20');
            assert.equal(unit,1);
            hd.loadImage(bytes,{filename});
            return true;
        },
        apple2plus:{hwObj(){return {io:{
            slot2ID(n){return String(n-1);},
            refreshDeviceToolboxes(){}
        }};}}
    });

    const card=new context.AppleLiron();
    card.mount={slotN:6};
    hd=new context.HD20Device();
    card.devices=[hd];
    assert.equal(hd.bindHost(card),true);

    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});
    assert.equal(rows[0].fileDisplayName,'UNFORMATTED-HD20.po');

    const file={name:'BLANK92-2.po',size:20971520,bytes:prodosImage('BLANK92')};
    const input={files:[file],value:'C:\\fakepath\\BLANK92-2.po'};
    assert.equal(card.deviceToolLoadFile(input,1),true);

    assert.equal(hd.getState().mediaFilename,'BLANK92-2.po');
    assert.equal(hd.getSuggestedFilename(),'BLANK92.po',
        'logical/download naming remains volume-derived');
    assert.equal(filenameNode.textContent,'BLANK92-2.po',
        'the visible managed filename must update in place after load');

    rows.length=0;
    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});
    assert.equal(rows[0].fileDisplayName,'BLANK92-2.po',
        'a rebuilt media row must still prefer the loaded host filename');
    assert.equal(rows[0].downloadTitle,'Save BLANK92.po.gz',
        'gzip download naming remains independent from the visible host filename');
});


test('HD20 loads .po.gz through pako while preserving the exact host filename in the media row',()=>{
    const rows=[];
    const filenameNode={textContent:'UNFORMATTED-HD20.po'};
    const mountCalls=[];
    let hd=null;

    class FakeFileReader
    {
        readAsArrayBuffer(file){this.onload({target:{result:file.bytes.buffer}});}
    }

    const context=loadLiron({
        FileReader:FakeFileReader,
        alert(){},
        document:{getElementById(id){return id==='liron_unit_5_1_file_name' ? filenameNode : null;}},
        EMU_deviceMediaRowHTML(spec){rows.push(spec);return '<row>'+spec.label+'</row>';},
        EMU_mountDiskImage(bytes,slotN,deviceID,filename,unit)
        {
            mountCalls.push({length:bytes.length,slotN,deviceID,filename,unit});
            hd.loadImage(bytes,{filename});
            return true;
        },
        apple2plus:{hwObj(){return {io:{slot2ID(n){return String(n-1);},refreshDeviceToolboxes(){}}};}}
    });

    const card=new context.AppleLiron();
    card.mount={slotN:6};
    hd=new context.HD20Device();
    card.devices=[hd];
    assert.equal(hd.bindHost(card),true);

    const raw=prodosImage('BLANK92');
    const compressed=context.pako.gzip(raw);
    const file={name:'BLANK92-2.po.gz',size:compressed.length,bytes:compressed};
    const input={files:[file],value:'C:\\fakepath\\BLANK92-2.po.gz'};

    assert.equal(card.deviceToolLoadFile(input,1),true);
    assert.deepEqual(mountCalls,[{
        length:20971520,slotN:6,deviceID:'HD20',filename:'BLANK92-2.po.gz',unit:1
    }]);
    assert.equal(input.value,'C:\\fakepath\\BLANK92-2.po.gz');
    assert.equal(hd.getState().mediaFilename,'BLANK92-2.po.gz');
    assert.equal(hd.getSuggestedFilename(),'BLANK92.po');
    assert.equal(filenameNode.textContent,'BLANK92-2.po.gz');

    rows.length=0;
    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});
    assert.equal(rows[0].fileDisplayName,'BLANK92-2.po.gz');
    assert.equal(rows[0].downloadTitle,'Save BLANK92.po.gz');
});

test('HD20 rejects corrupt .po.gz media without mounting it',()=>{
    let mounts=0;
    const alerts=[];
    class FakeFileReader
    {
        readAsArrayBuffer(file){this.onload({target:{result:file.bytes.buffer}});}
    }
    const context=loadLiron({
        FileReader:FakeFileReader,
        alert(msg){alerts.push(String(msg));},
        EMU_mountDiskImage(){mounts++;return true;}
    });
    const card=new context.AppleLiron();
    card.mount={slotN:6};
    const hd=fakeDevice('HD20','Apple Hard Disk 20',1,40960);
    card.devices=[hd];
    card.getBus().attach(hd,1);

    const bytes=new Uint8Array([0x1F,0x8B,0x00,0x00,0x00]);
    const input={files:[{name:'BROKEN.po.gz',size:bytes.length,bytes}],value:'C:\\fakepath\\BROKEN.po.gz'};
    assert.equal(card.deviceToolLoadFile(input,1),true);
    assert.equal(mounts,0);
    assert.equal(input.value,'');
    assert.ok(alerts.some(msg=>msg.includes('Unable to decompress')));
});

test('HD20 rejects a valid gzip whose expanded image is not exactly 20 MiB',()=>{
    let mounts=0;
    const alerts=[];
    class FakeFileReader
    {
        readAsArrayBuffer(file){this.onload({target:{result:file.bytes.buffer}});}
    }
    const context=loadLiron({
        FileReader:FakeFileReader,
        alert(msg){alerts.push(String(msg));},
        EMU_mountDiskImage(){mounts++;return true;}
    });
    const card=new context.AppleLiron();
    card.mount={slotN:6};
    const hd=fakeDevice('HD20','Apple Hard Disk 20',1,40960);
    card.devices=[hd];
    card.getBus().attach(hd,1);

    const compressed=context.pako.gzip(new Uint8Array(819200));
    const input={files:[{name:'TOOSMALL.po.gz',size:compressed.length,bytes:compressed}],value:'C:\\fakepath\\TOOSMALL.po.gz'};
    assert.equal(card.deviceToolLoadFile(input,1),true);
    assert.equal(mounts,0);
    assert.equal(input.value,'');
    assert.ok(alerts.some(msg=>msg.includes('expand to exactly 20971520 bytes')));
});

test('HD20 strips the .po.gz wrapper when deriving a logical filename from unformatted host media',()=>{
    const context=loadLiron();
    const hd=new context.HD20Device();
    hd.loadImage(blankImage(),{filename:'BLANK92-2.po.gz'});
    assert.equal(hd.getState().mediaFilename,'BLANK92-2.po.gz');
    assert.equal(hd.getSuggestedFilename(),'BLANK92-2.po');
});
