'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const mainSource=fs.readFileSync('res/EMU_apple2main.js','utf8');
const lironSource=fs.readFileSync('res/EMU_CARD_LIRON.js','utf8');

function extractFunction(source,name)
{
    const start=source.indexOf('function '+name+'(');
    assert.ok(start>=0,name+' must exist');
    const open=source.indexOf('{',start);
    let depth=0;
    for(let i=open;i<source.length;i++)
    {
        if(source[i]==='{') depth++;
        else if(source[i]==='}')
        {
            depth--;
            if(depth===0) return source.slice(start,i+1);
        }
    }
    throw new Error('unable to extract '+name);
}

function logger()
{
    const entries=[];
    return {
        entries,
        console:{
            log(...args){entries.push(['log',...args]);},
            info(...args){entries.push(['info',...args]);},
            warn(...args){entries.push(['warn',...args]);},
            error(...args){entries.push(['error',...args]);}
        }
    };
}

function loadRouter({devices=[],owner=null}={})
{
    const logs=logger();
    const io={
        SLOT2obj(){return owner;},
        DCODE2obj(){return devices;}
    };
    const context={
        console:logs.console,
        Uint8Array,
        Number,
        String,
        Array,
        apple2plus:{hwObj(){return {io};}},
        EMU_slotPeripheral(){return null;}
    };
    vm.createContext(context);
    vm.runInContext(extractFunction(mainSource,'EMU_unidisk35Device'),context);
    vm.runInContext(extractFunction(mainSource,'EMU_mountDiskImage'),context);
    return {context,logs};
}

function hasLog(entries,level,text)
{
    return entries.some(e=>e[0]===level && String(e[1]).includes(text));
}

function findLog(entries,level,text)
{
    return entries.find(e=>e[0]===level && String(e[1]).includes(text));
}

test('router logs invalid 800K image size with mount details',()=>{
    const disk={id:{DCODE:'UNIDISK'},getUnit(){return 1;},loadImage(){}};
    const {context,logs}=loadRouter({devices:[disk]});
    assert.equal(context.EMU_mountDiskImage(new Uint8Array(819199),null,'UNIDISK','bad.po',1),false);
    assert.ok(hasLog(logs.entries,'error','UniDisk 3.5 mount failed: invalid image size'));
    const entry=findLog(logs.entries,'error','invalid image size');
    assert.equal(entry[2].expected,819200);
    assert.equal(entry[2].actual,819199);
    assert.equal(entry[2].filename,'bad.po');
    assert.equal(entry[2].unit,1);
});

test('router logs missing target instead of silently returning false',()=>{
    const {context,logs}=loadRouter({devices:[]});
    assert.equal(context.EMU_mountDiskImage(new Uint8Array(819200),null,'UNIDISK','missing.po',1),false);
    assert.ok(hasLog(logs.entries,'error','UniDisk 3.5 mount failed: target device not found'));
    const entry=findLog(logs.entries,'error','target device not found');
    assert.equal(entry[2].filename,'missing.po');
    assert.equal(entry[2].unit,1);
});

test('router logs successful mount details',()=>{
    const disk={id:{DCODE:'UNIDISK'},getUnit(){return 1;},loadImage(bytes){return bytes.length;}};
    const {context,logs}=loadRouter({devices:[disk]});
    assert.equal(context.EMU_mountDiskImage(new Uint8Array(819200),null,'UNIDISK','CardCat 1.94.po',1),true);
    assert.ok(hasLog(logs.entries,'log','UniDisk 3.5 mount succeeded'));
    const entry=findLog(logs.entries,'log','mount succeeded');
    assert.equal(entry[2].bytes,819200);
    assert.equal(entry[2].filename,'CardCat 1.94.po');
    assert.equal(entry[2].unit,1);
});

function loadCard({readerClass,mountResult=true,fileSize=819200}={})
{
    const logs=logger();
    const alerts=[];
    const context={
        console:logs.console,
        Uint8Array,Array,Number,String,Object,Math,RangeError,Error,Reflect,
        FileReader:readerClass,
        alert(msg){alerts.push(String(msg));},
        EMU_mountDiskImage(){return mountResult;},
        apple2plus:{hwObj(){return {io:{slot2ID(){return '5';},refreshDeviceToolboxes(){}}};}}
    };
    context.oEMU={component:{IO:{}}};
    vm.createContext(context);
    vm.runInContext(lironSource,context,{filename:'EMU_CARD_LIRON.js'});
    const card=new context.AppleLiron();
    card.mount={slotN:6};
    const file={name:'CardCat 1.94.po',size:fileSize,bytes:new Uint8Array(Math.max(0,fileSize))};
    return {card,input:{files:[file],value:'chosen'},logs,alerts};
}

test('file chooser logs invalid size before FileReader starts',()=>{
    class Reader { readAsArrayBuffer(){throw new Error('must not read');} }
    const {card,input,logs}=loadCard({readerClass:Reader,fileSize:819199});
    assert.equal(card.deviceToolLoadFile(input,1),false);
    assert.ok(hasLog(logs.entries,'error','UniDisk 3.5 load failed: invalid image size'));
});

test('file chooser logs FileReader errors explicitly',()=>{
    class Reader {
        constructor(){this.error=new Error('read exploded');}
        readAsArrayBuffer(){this.onerror();}
    }
    const {card,input,logs}=loadCard({readerClass:Reader});
    assert.equal(card.deviceToolLoadFile(input,1),true);
    assert.ok(hasLog(logs.entries,'error','UniDisk 3.5 load failed: FileReader error'));
});

test('file chooser logs mount rejection explicitly',()=>{
    class Reader {
        readAsArrayBuffer(file){this.onload({target:{result:file.bytes.buffer}});}
    }
    const {card,input,logs}=loadCard({readerClass:Reader,mountResult:false});
    assert.equal(card.deviceToolLoadFile(input,1),true);
    assert.ok(hasLog(logs.entries,'error','UniDisk 3.5 load failed: mount rejected'));
});
