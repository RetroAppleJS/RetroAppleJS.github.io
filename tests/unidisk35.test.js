'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadUniDisk()
{
    const source = fs.readFileSync(path.join(__dirname,'..','res','EMU_DEVICE_UNIDISK35.js'),'utf8');
    const context = { console:{ log(){}, warn(){}, error(){} } };
    vm.createContext(context);
    vm.runInContext(source,context);
    return context;
}

test('UniDisk35Device exposes a detached 800K SmartPort block device', () => {
    const context = loadUniDisk();
    const disk = new context.UniDisk35Device();

    assert.equal(disk.id.DCODE,'UNIDISK');
    assert.equal(disk.getUnit(),0);
    assert.equal(disk.getBlockSize(),512);
    assert.equal(disk.getBlockCount(),1600);
    assert.equal(disk.getState().online,true);
    assert.equal(disk.getState().writeProtected,false);
});

test('a SmartPort bus can assign UniDisk unit 1 explicitly', () => {
    const context = loadUniDisk();
    const disk = new context.UniDisk35Device();

    assert.equal(disk.setUnit(1),1);
    assert.equal(disk.getUnit(),1);
    assert.throws(() => disk.setUnit(9),/SmartPort unit/);
    assert.equal(disk.setUnit(0),0);
});

test('STATUS $00 reports an online 1600-block read/write format-capable device', () => {
    const context = loadUniDisk();
    const disk = new context.UniDisk35Device();
    const reply = disk.status(0x00);

    assert.equal(reply.error,0x00);
    assert.deepEqual(Array.from(reply.data),[0xF8,0x40,0x06,0x00]);
});

test('STATUS $03 returns a valid UniDisk 3.5 DIB', () => {
    const context = loadUniDisk();
    const disk = new context.UniDisk35Device();
    const reply = disk.status(0x03);
    const dib = Array.from(reply.data);

    assert.equal(reply.error,0x00);
    assert.equal(dib.length,25);
    assert.deepEqual(dib.slice(0,4),[0xF8,0x40,0x06,0x00]);
    assert.equal(dib[4],8);
    assert.equal(String.fromCharCode(...dib.slice(5,13)),'DISK 3.5');
    assert.equal(String.fromCharCode(...dib.slice(13,21)),'        ');
    assert.equal(dib[21],0x01,'SmartPort type $01 = 3.5-inch disk');
    assert.equal(dib[22],0x00,'UniDisk 3.5 subtype is $00');
    assert.deepEqual(dib.slice(23,25),[0x00,0x01],'firmware version 1.0 as $0100 little-endian');
});

test('online and write-protect state is reflected in STATUS and DIB', () => {
    const context = loadUniDisk();
    const disk = new context.UniDisk35Device();

    disk.setOnline(false);
    assert.equal(disk.status(0x00).data[0],0xE8);

    disk.setOnline(true);
    disk.setWriteProtected(true);
    assert.equal(disk.status(0x00).data[0],0xFC);
    assert.equal(disk.status(0x03).data[0],0xFC);
});

test('unsupported status codes fail and write path remains unimplemented', () => {
    const context = loadUniDisk();
    const disk = new context.UniDisk35Device();

    const reply = disk.status(0x7F);
    assert.equal(reply.error,0x01);
    assert.equal(reply.data.length,0);
    assert.equal(typeof disk.writeBlock,'undefined');
});

test('an 800K image can be mounted and read as exact 512-byte blocks', () => {
    const context = loadUniDisk();
    const disk = new context.UniDisk35Device();
    const image = new Uint8Array(1600*512);
    const blockNo = 17;
    for(let i=0;i<512;i++) image[blockNo*512+i]=(i*13+7)&0xFF;

    assert.equal(disk.loadImage(image),819200);
    const reply=disk.readBlock(blockNo);
    assert.equal(reply.error,0x00);
    assert.equal(reply.data.length,512);
    assert.deepEqual(Array.from(reply.data),Array.from(image.slice(blockNo*512,(blockNo+1)*512)));
    assert.equal(disk.getState().mediaLoaded,true);
    assert.equal(disk.getState().mediaBytes,819200);
});

test('UniDisk tracks the last successfully read block as the physical head position', () => {
    const context=loadUniDisk();
    const disk=new context.UniDisk35Device();
    disk.loadImage(new Uint8Array(819200),{filename:'HEAD.po'});

    assert.equal(disk.getLastBlock(),null);
    assert.equal(disk.getHeadSurfacePosition(),null);
    assert.equal(disk.readBlock(24).error,0x00);
    assert.equal(disk.getLastBlock(),24);
    assert.deepEqual(
        JSON.parse(JSON.stringify(disk.getHeadSurfacePosition())),
        {side:0,track:1,sector:0,block:24,offset:24*512,bytes:512}
    );
    assert.equal(disk.readBlock(1600).error,0x27);
    assert.equal(disk.getLastBlock(),24,'failed reads must not move the head');
    disk.ejectImage();
    assert.equal(disk.getLastBlock(),null);
    assert.equal(disk.getHeadSurfacePosition(),null);
});

test('ejectImage clears media and filename without detaching the SmartPort unit', () => {
    const context=loadUniDisk();
    const disk=new context.UniDisk35Device();
    disk.setUnit(2);
    disk.loadImage(new Uint8Array(819200),{filename:'TOOLS.po'});

    assert.equal(typeof disk.ejectImage,'function','UniDisk must expose an ejectImage media operation');
    assert.equal(disk.ejectImage(),true);

    const state=disk.getState();
    assert.equal(state.unit,2,'ejecting media must not detach the SmartPort device');
    assert.equal(state.mediaLoaded,false);
    assert.equal(state.mediaBytes,0);
    assert.equal(state.mediaFilename,'');
    assert.equal(disk.readBlock(0).error,0x27,'reads after eject must report no readable media');
});

test('UniDisk exposes the five-zone 800K surface geometry', () => {
    const context=loadUniDisk();
    const disk=new context.UniDisk35Device();
    const g=disk.getSurfaceMapGeometry();
    assert.deepEqual(JSON.parse(JSON.stringify(g)),{
        sides:2,tracksPerSide:80,maxSectorsPerTrack:12,bytesPerSector:512,
        zoneTracks:16,sectorCounts:[12,11,10,9,8],totalSectors:1600,totalBytes:819200
    });
    assert.deepEqual([0,15,16,31,32,47,48,63,64,79].map(t=>disk.getSurfaceTrackSectorCount(t)),[12,12,11,11,10,10,9,9,8,8]);
    assert.equal(disk.getSurfaceTrackSectorCount(-1),null);
    assert.equal(disk.getSurfaceTrackSectorCount(80),null);
});

test('UniDisk surface coordinates map every 512-byte block exactly once', () => {
    const context=loadUniDisk();
    const disk=new context.UniDisk35Device();
    const seen=new Set();
    for(let track=0;track<80;track++)
    {
        const count=disk.getSurfaceTrackSectorCount(track);
        for(let side=0;side<2;side++)
            for(let sector=0;sector<count;sector++)
            {
                const block=disk.surfaceSectorToBlock(side,track,sector);
                assert.ok(Number.isInteger(block));
                assert.ok(block>=0 && block<1600);
                assert.equal(seen.has(block),false);
                seen.add(block);
                assert.deepEqual(JSON.parse(JSON.stringify(disk.blockToSurfaceSector(block))),{side,track,sector,block,offset:block*512,bytes:512});
            }
    }
    assert.equal(seen.size,1600);
    assert.deepEqual([...seen].sort((a,b)=>a-b),Array.from({length:1600},(_,i)=>i));
    assert.equal(disk.surfaceSectorToBlock(0,0,12),null);
    assert.equal(disk.surfaceSectorToBlock(2,0,0),null);
    assert.equal(disk.blockToSurfaceSector(-1),null);
    assert.equal(disk.blockToSurfaceSector(1600),null);
});
