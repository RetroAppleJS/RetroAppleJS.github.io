'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const mainSource=fs.readFileSync(path.join(root,'res','EMU_apple2main.js'),'utf8');
const deviceSource=fs.readFileSync(path.join(root,'res','EMU_DEVICE_UNIDISK35.js'),'utf8');

function extractFunction(source,name)
{
    const start=source.indexOf('function '+name+'(');
    if(start<0) return null;
    const open=source.indexOf('{',start);
    if(open<0) return null;
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
    return null;
}

function loadRouter({unidisks=[],slotOwners={},disk2=null}={})
{
    const diskIILoads=[];
    const io={
        DCODE2obj(DCODE,hostPCODE)
        {
            return DCODE==='UNIDISK35' && hostPCODE==='LIRON' ? unidisks : [];
        },
        SLOT2obj(slotN)
        {
            return slotOwners[slotN] || null;
        }
    };

    const context={
        console:{log(){},warn(){},error(){}},
        apple2plus:{
            hwObj(){return {io};},
            loadDisk(bytes,deviceID,slotN)
            {
                diskIILoads.push({bytes:Array.from(bytes),deviceID,slotN});
                return true;
            }
        },
        EMU_slotPeripheral(slotN,PCODE)
        {
            return PCODE==='DISKII' ? disk2 : null;
        }
    };
    vm.createContext(context);
    vm.runInContext(deviceSource,context,{filename:'EMU_DEVICE_UNIDISK35.js'});

    const resolveSource=extractFunction(mainSource,'EMU_unidisk35Device');
    const routerSource=extractFunction(mainSource,'EMU_mountDiskImage');
    assert.ok(resolveSource,'EMU_unidisk35Device must exist in EMU_apple2main.js');
    assert.ok(routerSource,'EMU_mountDiskImage must exist in EMU_apple2main.js');
    vm.runInContext(resolveSource,context,{filename:'EMU_unidisk35Device.js'});
    vm.runInContext(routerSource,context,{filename:'EMU_mountDiskImage.js'});
    return {context,diskIILoads};
}

test('819200 bytes route to the mounted UniDisk child with filename metadata',()=>{
    const unidiskLoads=[];
    const disk={
        id:{DCODE:'UNIDISK35',hostPCODE:'LIRON'},
        loadImage(bytes,metadata){unidiskLoads.push({bytes:Array.from(bytes),metadata});return bytes.length;}
    };
    const {context,diskIILoads}=loadRouter({unidisks:[disk]});
    const image=new Uint8Array(819200);

    assert.equal(context.EMU_mountDiskImage(image,null,'UNIDISK35','CardCat 1.94.po'),true);
    assert.equal(unidiskLoads.length,1);
    assert.equal(unidiskLoads[0].bytes.length,819200);
    assert.equal(unidiskLoads[0].metadata.filename,'CardCat 1.94.po');
    assert.equal(diskIILoads.length,0);
});

test('800K routing fails cleanly when no unique UniDisk child is mounted',()=>{
    {
        const {context}=loadRouter({unidisks:[]});
        assert.equal(context.EMU_mountDiskImage(new Uint8Array(819200),null,'D1','x.po'),false);
    }
    {
        const a={id:{DCODE:'UNIDISK35'},loadImage(){throw new Error('must not choose first');}};
        const b={id:{DCODE:'UNIDISK35'},loadImage(){throw new Error('must not choose second');}};
        const {context}=loadRouter({unidisks:[a,b]});
        assert.equal(context.EMU_mountDiskImage(new Uint8Array(819200),null,'D1','x.po'),false);
    }
});

test('explicit UniDisk target rejects wrong size without falling through to Disk II',()=>{
    let loads=0;
    const disk={id:{DCODE:'UNIDISK35'},loadImage(){loads++;}};
    const disk2={getState(){return {active:true};},convertDsk2Nib(bytes){return bytes;}};
    const {context,diskIILoads}=loadRouter({unidisks:[disk],disk2});

    assert.equal(context.EMU_mountDiskImage(new Uint8Array(819199),null,'UNIDISK35','bad.po'),false);
    assert.equal(loads,0);
    assert.equal(diskIILoads.length,0);
});

test('143360-byte media preserves the existing Disk II path',()=>{
    let converted=0;
    const disk2={
        getState(){return {active:true};},
        convertDsk2Nib(bytes){converted++;return bytes.concat([0xAA]);}
    };
    const unidisk={id:{DCODE:'UNIDISK35'},loadImage(){throw new Error('UniDisk must not receive 140K media');}};
    const {context,diskIILoads}=loadRouter({unidisks:[unidisk],disk2});

    assert.equal(context.EMU_mountDiskImage(new Uint8Array(143360),7,'D1','boot.dsk'),true);
    assert.equal(converted,1);
    assert.equal(diskIILoads.length,1);
    assert.equal(diskIILoads[0].deviceID,'D1');
    assert.equal(diskIILoads[0].slotN,7);
});

test('rejected UniDisk-targeted media leaves previously mounted media unchanged',()=>{
    const context={console:{log(){},warn(){},error(){}}};
    vm.createContext(context);
    vm.runInContext(deviceSource,context,{filename:'EMU_DEVICE_UNIDISK35.js'});
    const disk=new context.UniDisk35Device();
    const image=new Uint8Array(819200);
    for(let i=0;i<512;i++) image[2*512+i]=(i^0x5A)&0xFF;

    const fixture=loadRouter({unidisks:[disk]});
    assert.equal(fixture.context.EMU_mountDiskImage(image,null,'UNIDISK35','good.po'),true);
    const before=Array.from(disk.readBlock(2).data);
    assert.equal(fixture.context.EMU_mountDiskImage(new Uint8Array(819199),null,'UNIDISK35','bad.po'),false);
    assert.deepEqual(Array.from(disk.readBlock(2).data),before);
});

test('normal browser loaders converge on EMU_mountDiskImage',()=>{
    const loadBuffer=extractFunction(mainSource,'loadDisk_fromBuffer');
    assert.ok(loadBuffer,'loadDisk_fromBuffer must exist');
    assert.match(loadBuffer,/EMU_mountDiskImage\s*\(/);
    const calls=(mainSource.match(/EMU_mountDiskImage\s*\(/g)||[]).length;
    assert.ok(calls>=3,'router must be used by its definition, loadDisk_fromBuffer, and local file loading');
    assert.doesNotMatch(mainSource,/disk was not loaded: likely needs Apple 3\.5/);
});

test('explicit slot and SmartPort unit route 800K media to that exact UniDisk child',()=>{
    const unit1Loads=[];
    const unit2Loads=[];
    const unit1={
        id:{DCODE:'UNIDISK35',hostPCODE:'LIRON',deviceN:1},
        getUnit(){return 1;},
        loadImage(bytes,metadata){unit1Loads.push({bytes:Array.from(bytes),metadata});return bytes.length;}
    };
    const unit2={
        id:{DCODE:'UNIDISK35',hostPCODE:'LIRON',deviceN:2},
        getUnit(){return 2;},
        loadImage(bytes,metadata){unit2Loads.push({bytes:Array.from(bytes),metadata});return bytes.length;}
    };
    const owner={id:{PCODE:'LIRON'},devices:[unit1,unit2]};
    const {context}=loadRouter({
        unidisks:[unit1,unit2],
        slotOwners:{6:owner}
    });

    assert.equal(context.EMU_mountDiskImage(new Uint8Array(819200),6,'UNIDISK35','TOOLS.po',2),true);
    assert.equal(unit1Loads.length,0,'unit 1 must not receive a unit-2 mount');
    assert.equal(unit2Loads.length,1,'unit 2 must receive the explicitly targeted image');
    assert.equal(unit2Loads[0].metadata.filename,'TOOLS.po');
});
