'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const hd20Path=path.join(__dirname,'..','res','EMU_DEVICE_HD20.js');

function loadDevice()
{
    const context={console:{log(){},warn(){},error(){}},Uint8Array,ArrayBuffer,Number,String,RangeError};
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(hd20Path,'utf8'),context,{filename:'EMU_DEVICE_HD20.js'});
    return new context.HD20Device();
}

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

test('HD20 writeBlock writes exactly one 512-byte block and marks media dirty',()=>{
    const disk=loadDevice();
    disk.loadImage(blankImage(),{filename:'HD20.po'});
    assert.equal(disk.getState().dirty,false);

    const block=123;
    const data=Uint8Array.from({length:512},(_,i)=>(i^0xA5)&0xFF);
    const result=disk.writeBlock(block,data);

    assert.equal(result.error,0x00);
    assert.equal(disk.getState().dirty,true);
    assert.deepEqual(Array.from(disk.readBlock(block).data),Array.from(data));
    assert.deepEqual(Array.from(disk.readBlock(block-1).data),new Array(512).fill(0));
    assert.deepEqual(Array.from(disk.readBlock(block+1).data),new Array(512).fill(0));
});

test('HD20 writeBlock accepts first and last legal blocks',()=>{
    const disk=loadDevice();
    disk.loadImage(blankImage());
    const first=new Uint8Array(512); first.fill(0x11);
    const last=new Uint8Array(512); last.fill(0xEE);

    assert.equal(disk.writeBlock(0,first).error,0x00);
    assert.equal(disk.writeBlock(40959,last).error,0x00);
    assert.deepEqual(Array.from(disk.readBlock(0).data),Array.from(first));
    assert.deepEqual(Array.from(disk.readBlock(40959).data),Array.from(last));
});

test('HD20 writeBlock rejects bad blocks, malformed data, protected media and offline media atomically',()=>{
    const disk=loadDevice();
    disk.loadImage(blankImage());
    const data=new Uint8Array(512); data.fill(0x5A);

    for(const block of [-1,40960,40961,0.5,NaN,Infinity])
        assert.equal(disk.writeBlock(block,data).error,0x2D,'invalid block '+String(block));

    for(const malformed of [new Uint8Array(0),new Uint8Array(511),new Uint8Array(513),null,undefined])
        assert.equal(disk.writeBlock(20,malformed).error,0x27);

    disk.setWriteProtected(true);
    assert.equal(disk.writeBlock(20,data).error,0x2B);
    disk.setWriteProtected(false);

    disk.setOnline(false);
    assert.equal(disk.writeBlock(20,data).error,0x2F);
    disk.setOnline(true);

    assert.deepEqual(Array.from(disk.readBlock(20).data),new Array(512).fill(0));
    assert.equal(disk.getState().dirty,false);
});

test('HD20 format zero-fills mounted media, honours protection/offline and marks media dirty',()=>{
    const disk=loadDevice();
    const image=blankImage();
    image.fill(0xCC,512*8,512*9);
    disk.loadImage(image);

    assert.equal(disk.format().error,0x00);
    assert.deepEqual(Array.from(disk.readBlock(8).data),new Array(512).fill(0));
    assert.equal(disk.getState().dirty,true);

    disk.setWriteProtected(true);
    assert.equal(disk.format().error,0x2B);
    disk.setWriteProtected(false);
    disk.setOnline(false);
    assert.equal(disk.format().error,0x2F);
});

test('HD20 writes mutate the mounted copy, not the caller source image',()=>{
    const disk=loadDevice();
    const source=blankImage();
    disk.loadImage(source);
    const data=new Uint8Array(512); data.fill(0x77);

    assert.equal(disk.writeBlock(4,data).error,0x00);
    assert.equal(disk.readBlock(4).data[0],0x77);
    assert.equal(source[4*512],0x00);
});

test('HD20 always exposes a downloadable 20 MiB image with a default logical filename',()=>{
    const disk=loadDevice();

    assert.equal(typeof disk.getImage,'function');
    assert.equal(typeof disk.getVolumeName,'function');
    assert.equal(typeof disk.getSuggestedFilename,'function');
    assert.equal(disk.getVolumeName(),'');
    assert.equal(disk.getSuggestedFilename(),'HD20.po');

    const image=disk.getImage();
    assert.equal(image.length,20971520);
    image[0]=0xAA;
    assert.equal(disk.readBlock(0).data[0],0x00,'export image must be a copy, not mutable device storage');
});

test('HD20 derives its logical filename from the ProDOS volume directory header in block 2',()=>{
    const disk=loadDevice();
    disk.loadImage(prodosImage('BLANK92'),{filename:'uploaded.po'});

    assert.equal(disk.getVolumeName(),'BLANK92');
    assert.equal(disk.getSuggestedFilename(),'BLANK92.po');
    assert.equal(disk.getState().logicalFilename,'BLANK92.po');

    const plain=blankImage();
    disk.loadImage(plain,{filename:'TOOLS.po'});
    assert.equal(disk.getVolumeName(),'');
    assert.equal(disk.getSuggestedFilename(),'TOOLS.po','uploaded filename is the fallback when no ProDOS volume name exists');
});

test('HD20 notifies its Liron host only when a block-2 write changes the logical filename',()=>{
    const disk=loadDevice();
    let changes=0;
    const host={
        id:{PCODE:'LIRON'},
        attachSmartPortDevice(device){return device;},
        detachSmartPortDevice(){return true;},
        deviceMediaMetadataChanged(device){assert.equal(device,disk);changes++;}
    };
    assert.equal(disk.bindHost(host),true);

    const block2=prodosImage('WORK').slice(2*512,3*512);
    assert.equal(disk.writeBlock(2,block2).error,0x00);
    assert.equal(disk.getSuggestedFilename(),'WORK.po');
    assert.equal(changes,1);

    const other=new Uint8Array(512); other.fill(0x66);
    assert.equal(disk.writeBlock(3,other).error,0x00);
    assert.equal(changes,1,'ordinary data writes must not rebuild the toolbox');
});

test('HD20 eject resets the non-removable hard disk to blank media instead of removing it',()=>{
    const disk=loadDevice();
    disk.loadImage(prodosImage('BLANK92'),{filename:'source.po'});
    const data=new Uint8Array(512); data.fill(0xA5);
    assert.equal(disk.writeBlock(20,data).error,0x00);

    assert.equal(disk.ejectImage(),true);
    const state=disk.getState();
    assert.equal(state.online,true);
    assert.equal(state.mediaLoaded,true);
    assert.equal(state.mediaBytes,20971520);
    assert.equal(state.mediaFilename,'');
    assert.equal(state.logicalFilename,'HD20.po');
    assert.equal(state.dirty,false);
    assert.equal(disk.getVolumeName(),'');
    assert.equal(disk.getSuggestedFilename(),'HD20.po');
    assert.deepEqual(Array.from(disk.readBlock(2).data),new Array(512).fill(0));
    assert.deepEqual(Array.from(disk.readBlock(20).data),new Array(512).fill(0));
});
