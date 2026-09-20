'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('res/EMU_CARD_LIRON.js','utf8');

function fakeDevice(dcode,description,unit,blocks)
{
    return {
        id:{DCODE:dcode,description,hostPCODE:'LIRON',deviceN:unit},
        getUnit(){return unit;},
        getBlockSize(){return 512;},
        getBlockCount(){return blocks;},
        getState(){return {unit,mediaLoaded:false,mediaFilename:''};},
        ejectImage(){return true;}
    };
}

function loadLiron(extra={})
{
    const context=vm.createContext(Object.assign({
        console:{log(){},warn(){},error(){}},
        Uint8Array,Array,Number,String,Object,Math,RangeError,Error,Reflect,
        oEMU:{component:{IO:{}}}
    },extra));
    vm.runInContext(source,context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

test('Liron toolbox names media controls by each SmartPort device type',()=>{
    const rows=[];
    const context=loadLiron({
        EMU_deviceMediaRowHTML(spec){rows.push(spec);return '<row>'+spec.label+'</row>';}
    });
    const card=new context.AppleLiron();
    const uni=fakeDevice('UNIDISK35','Apple UniDisk 3.5',1,1600);
    const hd=fakeDevice('HD20','Apple Hard Disk 20',2,40960);
    card.devices=[uni,hd];

    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});

    assert.equal(rows.length,2);
    assert.equal(rows[0].fileName,'UNIDISK35_1');
    assert.equal(rows[1].fileName,'HD20_2');
    assert.match(rows[0].fileOnChange,/deviceToolLoadFile\(this,1\)/);
    assert.match(rows[1].fileOnChange,/deviceToolLoadFile\(this,2\)/);
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
    const uni=fakeDevice('UNIDISK35','Apple UniDisk 3.5',1,1600);
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
