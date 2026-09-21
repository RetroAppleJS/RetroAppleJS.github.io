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

function loadApple2IO(extraSource='')
{
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
    if(extraSource) vm.runInContext(extraSource,context);
    return context;
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
    assert.match(html,/data-dcode=['"]UNIDISK35['"]/);
    assert.match(html,/onclick=['"]event\.stopPropagation\(\);apple2plus\.hwObj\(\)\.io\.deviceConfig_detail\(6,/);
});

test('Device table exposes a per-instance identifier column',()=>{
    assert.match(ioSource,/<th[^>]*>Instance<\/th>/,
        'the live Device table must show an Instance column');
    assert.match(ioSource,/attach\.hash/,
        'the displayed instance identifier must be based on the mounted device attachment hash');
});

test('Apple2IO supports explicit duplicate instances while declarative provisioning stays idempotent',()=>{
    const context=loadApple2IO(`
        function TestDevice(){ this.id={}; }
        this.TestDevice=TestDevice;
    `);

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

test('if-empty declarative defaults stay absent when the host already has an explicit device',()=>{
    const context=loadApple2IO(`
        function DefaultDevice(){ this.id={}; }
        function ExplicitDevice(){ this.id={}; }
        this.DefaultDevice=DefaultDevice;
        this.ExplicitDevice=ExplicitDevice;
    `);

    const io=new context.Apple2IO(null,null);
    const defaultInfo={DCODE:'DEFAULT',hostPCODE:'HOST',coID:'DefaultDevice',autoAttach:'if-empty'};
    const explicitInfo={DCODE:'EXPLICIT',hostPCODE:'HOST',coID:'ExplicitDevice',autoAttach:false};
    const owner={id:{PCODE:'HOST'},mount:{hash:0x4567},deviceConfig:[defaultInfo,explicitInfo]};

    const explicit=io.attach(owner,explicitInfo,{newInstance:true});
    assert.ok(explicit);
    assert.equal(owner.devices.length,1);

    io.provisionPeripheral(owner,'A2P');

    assert.equal(owner.devices.length,1,
        'restart provisioning must not add the if-empty default beside an existing explicit device');
    assert.equal(owner.devices[0],explicit);
    assert.equal(owner.devices.some(device=>device.id.DCODE==='DEFAULT'),false);
    assert.equal(Object.keys(io.attachments).length,1,
        'restart provisioning must not create a hidden default attachment either');
});

test('if-empty declarative defaults still attach when the host really is empty',()=>{
    const context=loadApple2IO(`
        function DefaultDevice(){ this.id={}; }
        this.DefaultDevice=DefaultDevice;
    `);

    const io=new context.Apple2IO(null,null);
    const defaultInfo={DCODE:'DEFAULT',hostPCODE:'HOST',coID:'DefaultDevice',autoAttach:'if-empty'};
    const owner={id:{PCODE:'HOST'},mount:{hash:0x5678},deviceConfig:[defaultInfo]};

    io.provisionPeripheral(owner,'A2P');

    assert.equal(owner.devices.length,1);
    assert.equal(owner.devices[0].id.DCODE,'DEFAULT');
});

test('failed host binding rolls back the new instance registry and owner row',()=>{
    const context=loadApple2IO(`
        function FullDevice(){
            this.id={};
            this.bindHost=function(){ throw new Error('host full'); };
        }
        this.FullDevice=FullDevice;
    `);
    const io=new context.Apple2IO(null,null);
    const info={DCODE:'FULLDEV',hostPCODE:'HOST',coID:'FullDevice'};
    const owner={id:{PCODE:'HOST'},mount:{hash:0x3456},deviceConfig:[]};

    assert.throws(()=>io.attach(owner,info,{newInstance:true}),/host full/);
    assert.equal(owner.devices.length,0,
        'failed bind must not leave a ghost row on the host peripheral');
    assert.equal(Object.keys(io.attachments).length,0,
        'failed bind must not leave a ghost attachment instance');
});