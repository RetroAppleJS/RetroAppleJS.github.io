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
        getState(){return {unit,mediaLoaded:dcode==='HD20'};},
        getSuggestedFilename(){return dcode==='HD20' ? 'HD20.po' : 'UNIDISK.po';},
        getImage(){return new Uint8Array(blocks*512);}
    };
}

function loadLiron(rows)
{
    const context=vm.createContext({
        console:{log(){},warn(){},error(){}},
        Uint8Array,ArrayBuffer,Array,Number,String,Object,Math,RangeError,Error,Reflect,
        oEMU:{component:{IO:{}}},
        EMU_deviceMediaRowHTML(spec){rows.push(spec);return '<row>'+spec.label+'</row>';}
    });
    vm.runInContext(source,context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

test('HD20 picker advertises generic gzip types for Safari while UniDisk remains raw .po',()=>{
    const rows=[];
    const context=loadLiron(rows);
    const card=new context.AppleLiron();
    const uni=fakeDevice('UNIDISK','Apple UniDisk 3.5',1,1600);
    const hd=fakeDevice('HD20','Apple Hard Disk 20',2,40960);
    card.devices=[uni,hd];

    card.deviceToolSlotHTML({slotN:6,slotID:'5',toolboxID:'device_tool_5',devices:card.devices});

    assert.equal(rows.length,2);
    assert.equal(rows[0].fileAccept,'.po');
    assert.equal(rows[1].fileAccept,'.po,.gz,application/gzip,application/x-gzip');
});
