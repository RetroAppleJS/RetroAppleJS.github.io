// Lossless SmartPort media compression with the browser's bundled pako.
// Run: node --test tests/liron_track_compressed_media.test.js
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const pako=require("../res/pako.min.js");
const TrackCompressedMedia=require("../res/EMU_DEVICE_track_compressed_media.js");

const BLOCK_SIZE=512;
const HD20_BYTES=20971520;
const UNIDISK_BYTES=819200;
assert.equal(typeof(pako.deflateRaw),"function");
assert.equal(typeof(pako.inflateRaw),"function");

function device(name)
{
    const sandbox={TrackCompressedMedia,pako,console};
    vm.runInNewContext(fs.readFileSync(
        path.join(__dirname,"../res/EMU_DEVICE_"+name+".js"),"utf8"),sandbox);
    return name==="HD20" ? new sandbox.HD20Device() : new sandbox.UniDisk35Device();
}

function writePattern(image,block,seed)
{
    let x=seed>>>0;
    for(let i=0;i<BLOCK_SIZE;i++)
    {
        x=(Math.imul(x,1664525)+1013904223)>>>0;
        image[block*BLOCK_SIZE+i]=x>>>24;
    }
}

function checkBlock(disk,image,block)
{
    const result=disk.readBlock(block);
    assert.equal(result.error,0,"read block "+block);
    assert.deepEqual(Buffer.from(result.data),
        Buffer.from(image.subarray(block*BLOCK_SIZE,(block+1)*BLOCK_SIZE)),
        "block "+block);
}

test("HD20 begins blank without allocating its logical 20 MiB image",()=>{
    const disk=device("HD20");
    const state=disk.getState();
    assert.equal(state.mediaBytes,HD20_BYTES);
    assert.equal(state.mediaStorage.trackCount,2560);
    assert.equal(state.mediaStorage.mode,"pako-raw-deflate");
    assert.equal(state.mediaStorage.storedBytes,0);
    assert.equal(state.mediaStorage.zeroTracks,2560);
    assert.deepEqual(Buffer.from(disk.readBlock(40959).data),Buffer.alloc(512));
    assert.equal(disk.getState().mediaStorage.cacheBytes,8192);
});

test("HD20 20 MiB load is compressed by 8 KiB logical track, not retained raw",()=>{
    const disk=device("HD20"),image=new Uint8Array(HD20_BYTES);
    for(const b of [0,1,15,16,17,255,256,257,20480,40959])
        writePattern(image,b,0xCAFEBABE^b);
    // ProDOS volume header in block 2.
    image[1028]=0xF4;
    image.set(Buffer.from("TEST"),1029);
    assert.equal(disk.loadImage(image,{filename:"test.po"}),HD20_BYTES);
    const st=disk.getState();
    assert.equal(st.mediaStorage.trackCount,2560);
    assert.ok(st.mediaStorage.storedBytes<80000,JSON.stringify(st.mediaStorage));
    assert.equal(disk.getVolumeName(),"TEST");
    assert.equal(disk.getSuggestedFilename(),"TEST.po");
    // Modifying the input after loading must not modify compressed media.
    const expected=Uint8Array.from(image);
    image.fill(0);
    for(const b of [0,1,15,16,17,255,256,257,20480,40959])
        checkBlock(disk,expected,b);
    assert.deepEqual(Buffer.from(disk.getImage()),Buffer.from(expected));
});

test("HD20 randomly ordered writes are retained across cache evictions",()=>{
    const disk=device("HD20"),expected=new Uint8Array(HD20_BYTES);
    for(const b of [3,17,19,0,40959,1024,17,40958,3,8192,8193,20480])
    {
        const data=new Uint8Array(BLOCK_SIZE);
        writePattern(data,0,0xACDC0000^b^expected[b*512]);
        const reply=disk.writeBlock(b,data);
        assert.equal(reply.error,0);
        expected.set(data,b*512);
    }
    assert.equal(disk.getState().dirty,true);
    for(const b of [8193,0,40959,3,17,19,8192,1024,40958,20480])
        checkBlock(disk,expected,b);
    assert.deepEqual(Buffer.from(disk.getImage()),Buffer.from(expected));
    assert.ok(disk.getState().mediaStorage.storedBytes<150000);
});

test("HD20 caches its ProDOS volume name and refreshes it on block-2 writes",()=>{
    const disk=device("HD20");
    const image=new Uint8Array(HD20_BYTES);
    image[1028]=0xF3;
    image.set(Buffer.from("OLD"),1029);
    disk.loadImage(image,{filename:"original.po"});
    assert.equal(disk.getVolumeName(),"OLD");
    checkBlock(disk,image,40959);
    for(let i=0;i<20;i++)
        assert.equal(disk.getState().volumeName,"OLD");

    const replacement=new Uint8Array(BLOCK_SIZE);
    replacement[4]=0xF3;
    replacement.set(Buffer.from("NEW"),5);
    assert.equal(disk.writeBlock(2,replacement).error,0);
    assert.equal(disk.getVolumeName(),"NEW");
    assert.equal(disk.getSuggestedFilename(),"NEW.po");
    assert.equal(disk.format().error,0);
    assert.equal(disk.getVolumeName(),"");
});

test("HD20 surface-map 8 KiB density uses exact track statistics",()=>{
    const disk=device("HD20");
    const filled=new Uint8Array(BLOCK_SIZE).fill(0xAA);
    disk.writeBlock(16,filled);
    const map=disk.getSurfaceMapGeometry();
    assert.equal(map.blocksPerCell,16);
    const range=disk.surfaceCellToBlockRange(0,0,0,1);
    assert.equal(range.startBlock,16);
    assert.equal(range.endBlock,31);
    const html=disk.renderSurfaceMapHTML("header");
    assert.match(html,/data-start-block="16"/);
    assert.match(html,/nonzero=512\/8192/);
    assert.match(html,/data-density="6"/);
    assert.ok(disk.getState().mediaStorage.storedBytes<2000);
});

test("HD20 format and eject discard compressed tracks without losing geometry",()=>{
    const disk=device("HD20");
    disk.writeBlock(20,new Uint8Array(BLOCK_SIZE).fill(0x77));
    disk.format();
    assert.equal(disk.getState().mediaStorage.storedBytes,0);
    checkBlock(disk,new Uint8Array(HD20_BYTES),20);
    disk.writeBlock(20,new Uint8Array(BLOCK_SIZE).fill(1));
    disk.ejectImage();
    assert.equal(disk.getState().mediaStorage.storedBytes,0);
    assert.equal(disk.getState().dirty,false);
    assert.equal(disk.releaseMedia(),true);
    assert.equal(disk.getState().mediaBytes,0);
    assert.equal(disk.getImage(),null);
    assert.equal(disk.readBlock(20).error,0x27);
    disk.loadImage(new Uint8Array(HD20_BYTES));
    assert.equal(disk.getState().mediaBytes,HD20_BYTES);
});

test("HD20 invalid writes and write-protected errors match original SmartPort",()=>{
    const disk=device("HD20");
    assert.equal(disk.writeBlock(-1,new Uint8Array(512)).error,0x2D);
    assert.equal(disk.writeBlock(40960,new Uint8Array(512)).error,0x2D);
    assert.equal(disk.writeBlock(10,new Uint8Array(511)).error,0x27);
    disk.setWriteProtected(true);
    assert.equal(disk.writeBlock(10,new Uint8Array(512)).error,0x2B);
    assert.equal(disk.format().error,0x2B);
    assert.equal(disk.readBlock(40960).error,0x27);
});

test("UniDisk 3.5 uses 160 physical track-side groups and all five speed zones",()=>{
    const disk=device("UNIDISK35");
    const zero=new Uint8Array(UNIDISK_BYTES);
    assert.equal(disk.getImage(),null);
    assert.equal(disk.loadImage(zero,{filename:"blank.po"}),UNIDISK_BYTES);
    const state=disk.getState();
    assert.equal(state.mediaStorage.trackCount,160);
    assert.equal(state.mediaStorage.zeroTracks,160);
    assert.equal(state.mediaStorage.storedBytes,0);
    assert.equal(disk.getSurfaceTrackSectorCount(0),12);
    assert.equal(disk.getSurfaceTrackSectorCount(16),11);
    assert.equal(disk.getSurfaceTrackSectorCount(32),10);
    assert.equal(disk.getSurfaceTrackSectorCount(48),9);
    assert.equal(disk.getSurfaceTrackSectorCount(64),8);
    assert.equal(disk.surfaceSectorToBlock(0,0,0),0);
    assert.equal(disk.surfaceSectorToBlock(1,0,0),12);
    assert.equal(disk.surfaceSectorToBlock(0,16,0),384);
    assert.equal(disk.surfaceSectorToBlock(1,79,7),1599);
    assert.equal(disk.getState().mediaBytes,UNIDISK_BYTES);
});

test("UniDisk mixed random tracks roundtrip in original ProDOS block order",()=>{
    const disk=device("UNIDISK35"),bytes=new Uint8Array(UNIDISK_BYTES);
    const positions=[0,11,12,23,24,383,384,395,406,705,706,707,1000,1223,1599];
    for(const b of positions) writePattern(bytes,b,0xBEEFBABE^b);
    disk.loadImage(bytes,{filename:"real.po"});
    const expected=Uint8Array.from(bytes);
    bytes.fill(0xFF);
    for(const b of positions.slice().reverse()) checkBlock(disk,expected,b);
    assert.deepEqual(Buffer.from(disk.getImage()),Buffer.from(expected));
    const stats=disk.getState().mediaStorage;
    assert.equal(stats.trackCount,160);
    assert.ok(stats.storedBytes<50000,JSON.stringify(stats));
    assert.equal(disk.getSuggestedFilename(),"real.po");
    assert.equal(disk.ejectImage(),true);
    assert.equal(disk.getImage(),null);
    assert.equal(disk.readBlock(0).error,0x27);
});

test("standalone track store falls back to raw track records if pako unavailable",()=>{
    const store=new TrackCompressedMedia({blockCount:32,blockSize:512,blocksPerTrack:16});
    const block=new Uint8Array(512).fill(0x55);
    store.writeBlock(0,block);
    store.readBlock(16); // Evicts the first track and writes it back.
    const stats=store.stats();
    assert.equal(stats.mode,"raw");
    assert.equal(stats.storedBytes,8192);
    assert.equal(stats.rawTracks,1);
    assert.deepEqual(Buffer.from(store.readBlock(0)),Buffer.from(block));
});

test("incompressible tracks are stored raw instead of expanding",()=>{
    const store=new TrackCompressedMedia({blockCount:16,blocksPerTrack:16,codec:pako});
    const bytes=new Uint8Array(8192);
    let n=0x12345678;
    for(let i=0;i<bytes.length;i++)
    {
        n=(Math.imul(n,1664525)+1013904223)>>>0;
        bytes[i]=n>>>24;
    }
    store.loadImage(bytes);
    const stats=store.stats();
    assert.equal(stats.rawTracks,1);
    assert.equal(stats.storedBytes,8192);
    assert.deepEqual(Buffer.from(store.getImage()),Buffer.from(bytes));
});

test("track store load commits transactionally on compressor failures",()=>{
    let fail=false;
    const broken={
        deflateRaw(bytes){if(fail)throw Error("synthetic codec error");return pako.deflateRaw(bytes);},
        inflateRaw(bytes){return pako.inflateRaw(bytes);}
    };
    const store=new TrackCompressedMedia({blockCount:32,blocksPerTrack:16,codec:broken});
    const first=new Uint8Array(16384).fill(0x11);
    store.loadImage(first);
    fail=true;
    assert.throws(()=>store.loadImage(new Uint8Array(16384).fill(0x22)),/synthetic codec error/);
    assert.deepEqual(Buffer.from(store.getImage()),Buffer.from(first));
});

test("read results are detached copies and do not corrupt cache on modification",()=>{
    const store=new TrackCompressedMedia({blockCount:32,blocksPerTrack:16,codec:pako});
    store.writeBlock(0,new Uint8Array(512).fill(0x5A));
    const a=store.readBlock(0);
    a.fill(0);
    assert.deepEqual(Buffer.from(store.readBlock(0)),Buffer.alloc(512,0x5A));
    store.readBlock(31);
    assert.deepEqual(Buffer.from(store.readBlock(0)),Buffer.alloc(512,0x5A));
});

test("browser loads track media helper before the SmartPort devices",()=>{
    const index=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
    const helper=index.indexOf('src="res/EMU_DEVICE_track_compressed_media.js"');
    const uni=index.indexOf('src="res/EMU_DEVICE_UNIDISK35.js"');
    const hd=index.indexOf('src="res/EMU_DEVICE_HD20.js"');
    assert.ok(helper>0 && helper<uni && uni<hd);
    assert.ok(index.indexOf('src="res/pako.min.js"')<helper);
});

test("HD20 constructor is not rewritten by topology patch once releaseMedia exists",()=>{
    const source=fs.readFileSync(path.join(__dirname,
        "../res/EMU_CARD_smartport_topology.js"),"utf8");
    const deviceSource=fs.readFileSync(path.join(__dirname,
        "../res/EMU_DEVICE_HD20.js"),"utf8");
    assert.ok(deviceSource.includes("this.releaseMedia = function()"));
    assert.ok(!deviceSource.includes("this.getImage = function() { return media===null ? new Uint8Array(BLOCK_SIZE*BLOCK_COUNT) : media.slice(); };"));
    assert.match(source,/patched\.indexOf\("this\.releaseMedia = function\(\)"\)<0/);
});
