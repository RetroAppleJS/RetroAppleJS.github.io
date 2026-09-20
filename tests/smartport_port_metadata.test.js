'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const unidiskSource=fs.readFileSync('res/EMU_DEVICE_UNIDISK35.js','utf8');
const ioSource=fs.readFileSync('res/EMU_apple2io.js','utf8');

function extractFunction(source,name)
{
    const marker='function '+name+'(';
    const start=source.indexOf(marker);
    assert.notEqual(start,-1,'missing function '+name);
    const brace=source.indexOf('{',start);
    let depth=0, quote='', escape=false;
    for(let i=brace;i<source.length;i++)
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
    throw new Error('unterminated function '+name);
}

test('UniDisk publishes structured SmartPort metadata and tracks its assigned unit',()=>{
    const context={Uint8Array,ArrayBuffer,Number,String,RangeError};
    vm.createContext(context);
    vm.runInContext(unidiskSource,context,{filename:'EMU_DEVICE_UNIDISK35.js'});

    const disk=new context.UniDisk35Device();
    assert.deepEqual(JSON.parse(JSON.stringify(disk.ports)),{
        smartport:{
            label:'SmartPort',
            kind:'bus',
            direction:'bidirectional',
            protocol:'SmartPort',
            unit:null,
            visibility:'public'
        }
    });

    disk.setUnit(1);
    assert.equal(disk.ports.smartport.unit,1);
    disk.setUnit(2);
    assert.equal(disk.ports.smartport.unit,2);
    disk.setUnit(0);
    assert.equal(disk.ports.smartport.unit,null,'detached unit 0 renders as no assigned unit');
});

test('Device-table port renderer shows SmartPort unit without inventing a MIME type',()=>{
    const labelFn=extractFunction(ioSource,'slotDevicePortLabel');
    const portsFn=extractFunction(ioSource,'slotDevicePorts_html');
    const context={
        oCOM:{escapeHTML(value){return String(value);}}
    };
    vm.createContext(context);
    vm.runInContext(labelFn+'\n'+portsFn,context);

    const port1={
        label:'SmartPort',kind:'bus',direction:'bidirectional',
        protocol:'SmartPort',unit:1,visibility:'public'
    };
    const port2={...port1,unit:2};

    const label1=vm.runInContext(`slotDevicePortLabel('smartport',${JSON.stringify(port1)})`,context);
    const label2=vm.runInContext(`slotDevicePortLabel('smartport',${JSON.stringify(port2)})`,context);
    assert.equal(label1,'SmartPort · Unit 1');
    assert.equal(label2,'SmartPort · Unit 2');

    const html1=vm.runInContext(`slotDevicePorts_html({ports:{smartport:${JSON.stringify(port1)}}})`,context);
    const html2=vm.runInContext(`slotDevicePorts_html({ports:{smartport:${JSON.stringify(port2)}}})`,context);
    assert.match(html1,/SmartPort · Unit 1/);
    assert.match(html2,/SmartPort · Unit 2/);
    assert.doesNotMatch(html1,/mime|octet-stream/i);
});
