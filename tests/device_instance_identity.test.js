'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const ioSource=fs.readFileSync('res/EMU_apple2io.js','utf8');

function extractFunction(source,name)
{
    const marker='function '+name+'(';
    const start=source.indexOf(marker);
    if(start<0) return '';
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
    return '';
}

test('attached-device label emits valid HTML attributes without literal backslash escapes',()=>{
    const iconFn=extractFunction(ioSource,'slotDeviceIconClass');
    const labelFn=extractFunction(ioSource,'slotDeviceLabel_html');
    assert.ok(iconFn && labelFn,'device label helpers must exist');

    const context={oCOM:{escapeHTML(value){return String(value);}}};
    vm.createContext(context);
    vm.runInContext(iconFn+'\n'+labelFn,context);
    const html=vm.runInContext(
        `slotDeviceLabel_html({mount:{slotN:6}},{id:{DCODE:'UNIDISK35',icon:'fa fa-hdd',description:'Apple UniDisk 3.5'},attach:{hash:4660}})`,
        context
    );

    assert.equal(html.includes('\\\\"'),false,
        'rendered device HTML must never contain a literal backslash before an attribute quote');
    assert.match(html,/data-dcode="UNIDISK35"/);
    assert.match(html,/onclick="event\.stopPropagation\(\);apple2plus\.hwObj\(\)\.io\.deviceConfig_detail\(6,/);
});

test('Device table exposes a per-instance identifier column',()=>{
    assert.match(ioSource,/<th[^>]*>Instance<\/th>/,
        'the live Device table must show an Instance column');
    assert.match(ioSource,/attach\.hash/,
        'the displayed instance identifier must be based on the mounted device attachment hash');
});

test('Apple2IO supports explicit duplicate instances while declarative provisioning stays idempotent',()=>{
    let crcSeed=0x1200;
    const context={
        console:{log(){},warn(){},error(){},assert(){}},
        TextEncoder,
        Uint8Array,
        ArrayBuffer,
        oEMU:{component:{IO:{ACTION_MAP:{RD:[],WR:[]}}},system:{}},
        oEMUI:{},
        oCOM:{
            crc16(){ return (++crcSeed)&0xFFFF; },
            trim(value){return String(value).trim();},
            getHexWord(value){return Number(value).toString(16).padStart(4,'0');}
        }
    };
    vm.createContext(context);
    vm.runInContext(ioSource,context,{filename:'EMU_apple2io.js'});
    vm.runInContext(`
        function TestDevice(){ this.id={}; }
        this.TestDevice=TestDevice;
    `,context);

    const io=new context.Apple2IO(null,null);
    const info={DCODE:'TESTDEV',hostPCODE:'HOST',coID:'TestDevice'};
    const owner={id:{PCODE:'HOST'},mount:{hash:0x2345},deviceConfig:[info]};

    const first=io.attach(owner,info);
    const provisionAgain=io.attach(owner,info);
    const second=io.attach(owner,info,{newInstance:true});

    assert.equal(provisionAgain,first,
        'normal declarative provisioning must reuse the configured instance');
    assert.notEqual(second,first,
        'explicit picker attachment must create a second object of the same DCODE');
    assert.equal(owner.devices.length,2);
    assert.notEqual(first.attach.hash,second.attach.hash,
        'each mounted device instance needs a distinct stable attachment hash');
    assert.equal(io.detachInstance(owner,second.attach.hash),true);
    assert.equal(owner.devices.length,1,
        'detaching one instance must not remove another device with the same DCODE');
    assert.equal(owner.devices[0],first);
});
