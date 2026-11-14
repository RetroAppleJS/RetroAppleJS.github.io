// URL-driven LIRON HD20 preload: node --test tests/liron_hd20_url_startup.test.js
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const zlib=require("node:zlib");

const source=fs.readFileSync(path.join(__dirname,"../res/EMU_apple2main.js"),"utf8");
const start=source.indexOf("function EMU_HD20_urlRequest(");
const end=source.indexOf("function EMU_init()",start);
assert.ok(start>0 && end>start,"HD20 helpers must be present");
const helpers=source.slice(start,end);

function makeHarness(options={})
{
    const owner={id:{PCODE:"LIRON"}};
    const io={
        SLOT2obj(n){return options.missingCard ? null : (n===(options.slotN||7)?owner:null);}
    };
    const device={id:{DCODE:"HD20",deviceN:1}};
    const mounts=[],requests=[];
    const sandbox={
        console:{log(){},error(){}},
        apple2plus:{hwObj(){return {io};}},
        EMU_smartportDevice(slotN,unit,code){
            return options.missingDevice?null:
                (slotN===(options.slotN||7) && unit===1 && code==="HD20" ? device : null);
        },
        EMU_mountDiskImage(bytes,slotN,code,filename,unit){
            mounts.push({bytes,slotN,code,filename,unit});
            return options.rejectMount ? false : true;
        },
        async fetch(url){
            requests.push(url);
            if(options.httpError) return {ok:false,status:404};
            const payload=options.payload || new Uint8Array(20971520);
            const body=options.gzipped
                ? zlib.gzipSync(Buffer.from(payload))
                : Buffer.from(payload);
            return {ok:true,arrayBuffer:async()=>body.buffer.slice(
                body.byteOffset,body.byteOffset+body.byteLength)};
        },
        pako:{
            Inflate:class {
                constructor(){this.err=0;this.result=null;}
                push(bytes,done){
                    try {
                        if(done!==true) throw Error("GZIP stream incomplete");
                        this.result=new Uint8Array(zlib.gunzipSync(Buffer.from(bytes)));
                    }
                    catch(err){this.err=1;this.msg=err.message;}
                }
            }
        }
    };
    vm.runInNewContext(helpers,sandbox,{filename:"EMU_apple2main.js"});
    return {sandbox,mounts,requests};
}
test("HD20 preload is opt-in and has a physical-slot/unit-1 configuration",()=>{
    const f=makeHarness();
    assert.equal(f.sandbox.EMU_HD20_urlRequest({}),null);
    const request=f.sandbox.EMU_HD20_urlRequest({
        HD20_DIR:"ProDos/BLANK_HD20.po.gz",HD20_SLOT:"6",HD20_UNIT:"1"
    });
    assert.equal(request.filename,"ProDos/BLANK_HD20.po.gz");
    assert.equal(request.slot,6);
    assert.equal(request.unit,1);
    assert.equal(f.sandbox.EMU_HD20_targetSlot(request),7);
});
test("URL paths accept both disks/ prefix and percent-encoding",()=>{
    const f=makeHarness();
    const a=f.sandbox.EMU_HD20_urlRequest({HD20_DIR:"disks/ProDos/BLANK_HD20.po.gz"});
    assert.equal(a.filename,"ProDos/BLANK_HD20.po.gz");
    const b=f.sandbox.EMU_HD20_urlRequest({HD20_DIR:"ProDos%2FBLANK_HD20.po.gz"});
    assert.equal(b.filename,"ProDos/BLANK_HD20.po.gz");
    assert.equal(b.unit,1);
    assert.equal(b.slot,null);
});
test("only repository-local sector images and valid SmartPort unit 1 are allowed",()=>{
    const f=makeHarness(), parse=f.sandbox.EMU_HD20_urlRequest;
    for(const bad of [
        "https://example.com/disk.po.gz","../secret.po.gz",
        "ProDos/../../escape.po.gz","/root.po.gz",
        "ProDos/a.po.gz?query=1","ProDos/a%252e%252e.po.gz",
        "ProDos/evil\\name.po.gz","ProDos/a.dsk"
    ]) assert.throws(()=>parse({HD20_DIR:bad}),Error,bad);
    assert.throws(()=>parse({HD20_DIR:"ProDos/BLANK_HD20.po.gz",HD20_UNIT:"2"}));
    assert.throws(()=>parse({HD20_DIR:"ProDos/BLANK_HD20.po.gz",HD20_SLOT:"8"}));
    assert.throws(()=>parse({HD20_DIR:"ProDos/BLANK_HD20.po.gz",HD20_SLOT:"3.5"}));
});
test("slot lookup requires the configured LIRON card with an attached HD20",()=>{
    const req=makeHarness().sandbox.EMU_HD20_urlRequest({
        HD20_DIR:"ProDos/BLANK_HD20.po.gz",HD20_SLOT:"6"
    });
    assert.throws(()=>makeHarness({missingCard:true}).sandbox.EMU_HD20_targetSlot(req));
    assert.throws(()=>makeHarness({missingDevice:true}).sandbox.EMU_HD20_targetSlot(req));
    assert.equal(makeHarness().sandbox.EMU_HD20_targetSlot(req),7);
});
test("gzip image loads 20 MiB into LIRON slot 6 unit 1",async()=>{
    const raw=new Uint8Array(20971520);
    raw[0]=0x50;raw[1]=0x4F;raw[20971519]=0x6A;
    const f=makeHarness({gzipped:true,payload:raw});
    const req=f.sandbox.EMU_HD20_urlRequest({
        HD20_DIR:"ProDos/BLANK_HD20.po.gz",HD20_SLOT:"6",HD20_UNIT:"1"
    });
    assert.equal(await f.sandbox.EMU_HD20_loadFromURL(req),true);
    assert.deepEqual(f.requests,["disks/ProDos/BLANK_HD20.po.gz"]);
    assert.equal(f.mounts.length,1);
    const m=f.mounts[0];
    assert.equal(m.slotN,7);
    assert.equal(m.code,"HD20");
    assert.equal(m.unit,1);
    assert.equal(m.filename,"ProDos/BLANK_HD20.po");
    assert.equal(m.bytes.length,20971520);
    assert.equal(m.bytes[0],0x50);
    assert.equal(m.bytes[20971519],0x6A);
});
test("uncompressed ProDOS 20 MiB images also load",async()=>{
    const f=makeHarness();
    const req=f.sandbox.EMU_HD20_urlRequest({HD20_DIR:"ProDos/BLANK_HD20.po"});
    assert.equal(await f.sandbox.EMU_HD20_loadFromURL(req),true);
    assert.equal(f.mounts[0].filename,"ProDos/BLANK_HD20.po");
});
test("image errors are rejected rather than mounted",async()=>{
    for(const options of [
        {httpError:true},
        {gzipped:true,payload:new Uint8Array(819200)},
        {gzipped:false,payload:new Uint8Array(819200)},
        {rejectMount:true}
    ])
    {
        const f=makeHarness(options);
        const req=f.sandbox.EMU_HD20_urlRequest({HD20_DIR:"ProDos/BLANK_HD20.po.gz"});
        await assert.rejects(f.sandbox.EMU_HD20_loadFromURL(req));
        if(!options.rejectMount) assert.equal(f.mounts.length,0);
    }
});
test("CPU scheduler waits for HD20 fetch/mount and Disk II is optional",()=>{
    const anchor=source.indexOf("var hd20Startup=null");
    const boot=source.indexOf("apple2plus.restart(); // mounts LIRON",anchor);
    const load=source.indexOf("EMU_HD20_loadFromURL(hd20Startup).then(",boot);
    const start=source.indexOf("appleIntervalHandle=EMU_systemSchedulerStart()",load);
    assert.ok(anchor>0 && boot>anchor && load>boot && start>load);
    assert.match(source,/if\(disk2\) disk2\.GUI_update = function\(cmd\)/);
    assert.match(source,/else appleIntervalHandle=EMU_systemSchedulerStart\(\)/);
});
