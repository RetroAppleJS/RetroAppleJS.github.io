'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const mainSource=fs.readFileSync('res/EMU_apple2main.js','utf8');

function extractFunction(source,name)
{
    const start=source.indexOf('function '+name+'(');
    if(start<0) return null;
    const open=source.indexOf('{',start);
    if(open<0) return null;
    let depth=0,quote='',escape=false;
    for(let i=open;i<source.length;i++)
    {
        const ch=source[i];
        if(quote)
        {
            if(escape) escape=false;
            else if(ch==='\\') escape=true;
            else if(ch===quote) quote='';
            continue;
        }
        if(ch==='"' || ch==="'" || ch==='`') { quote=ch; continue; }
        if(ch==='{') depth++;
        else if(ch==='}' && --depth===0) return source.slice(start,i+1);
    }
    return null;
}

function loadRouter(devices,slotN=6)
{
    const owner={id:{PCODE:'LIRON'},devices};
    const io={
        SLOT2obj(n){return Number(n)===slotN ? owner : null;},
        DCODE2obj(dcode,hostPCODE)
        {
            if(hostPCODE!=='LIRON') return [];
            return devices.filter(device=>device.id && device.id.DCODE===dcode);
        }
    };
    const context={
        console:{log(){},warn(){},error(){}},
        Uint8Array,
        apple2plus:{hwObj(){return {io};}},
        EMU_slotPeripheral(){return null;}
    };
    vm.createContext(context);

    const generic=extractFunction(mainSource,'EMU_smartportDevice');
    assert.ok(generic,'EMU_smartportDevice must provide generic Liron child resolution');
    vm.runInContext(generic,context);

    const unidisk=extractFunction(mainSource,'EMU_unidisk35Device');
    assert.ok(unidisk,'legacy EMU_unidisk35Device helper must remain available');
    vm.runInContext(unidisk,context);

    const router=extractFunction(mainSource,'EMU_mountDiskImage');
    assert.ok(router,'EMU_mountDiskImage must remain the browser media router');
    vm.runInContext(router,context);
    return context;
}

function fakeDevice(dcode,unit,expectedBytes)
{
    const loads=[];
    return {
        loads,
        id:{DCODE:dcode,hostPCODE:'LIRON',deviceN:unit},
        getUnit(){return unit;},
        getBlockSize(){return 512;},
        getBlockCount(){return expectedBytes/512;},
        getState(){return {unit,mediaLoaded:loads.length>0,mediaFilename:loads.length ? loads.at(-1).metadata.filename : ''};},
        loadImage(bytes,metadata){loads.push({length:bytes.length,metadata});return bytes.length;}
    };
}

test('20 MiB browser media routes to the exact HD20 SmartPort unit',()=>{
    const uni=fakeDevice('UNIDISK35',1,819200);
    const hd20=fakeDevice('HD20',2,20971520);
    const context=loadRouter([uni,hd20]);

    assert.equal(context.EMU_mountDiskImage(new Uint8Array(20971520),6,'HD20','SYSTEM20.po',2),true);
    assert.equal(uni.loads.length,0);
    assert.equal(hd20.loads.length,1);
    assert.equal(hd20.loads[0].length,20971520);
    assert.equal(hd20.loads[0].metadata.filename,'SYSTEM20.po');
});

test('explicit HD20 target rejects non-20-MiB media without falling through',()=>{
    const hd20=fakeDevice('HD20',2,20971520);
    const context=loadRouter([hd20]);

    assert.equal(context.EMU_mountDiskImage(new Uint8Array(819200),6,'HD20','wrong.po',2),false);
    assert.equal(hd20.loads.length,0);
});

test('legacy UniDisk helper and 800K route remain intact',()=>{
    const uni=fakeDevice('UNIDISK35',1,819200);
    const context=loadRouter([uni]);

    assert.equal(context.EMU_unidisk35Device(6,1),uni);
    assert.equal(context.EMU_mountDiskImage(new Uint8Array(819200),6,'UNIDISK35','CARD.PO',1),true);
    assert.equal(uni.loads.length,1);
});
