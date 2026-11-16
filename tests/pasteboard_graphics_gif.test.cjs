/*
 * Pasteboard graphics recorder: visible memory, compact deltas, GIF89a.
 * node --test tests/pasteboard_graphics_gif.test.cjs
 */
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const G=require(path.join(root,"res/EMU_pasteboard_gif.js"));

function readGif(bytes) {
    function u16(i){return bytes[i]|bytes[i+1]<<8;}
    const header=Buffer.from(bytes.slice(0,6)).toString("ascii");
    assert.equal(header,"GIF89a");
    assert.equal(u16(6),280);
    assert.equal(u16(8),192);
    assert.ok(bytes[10]&128,"GIF global color table required");
    const gct=3*(1<<((bytes[10]&7)+1));
    let i=13+gct,delays=[],frames=[],loop=null;
    while(i<bytes.length) {
        let tag=bytes[i++];
        if(tag===0x3b)break;
        if(tag===0x21) {
            let kind=bytes[i++];
            if(kind===0xf9) {
                assert.equal(bytes[i++],4);
                i++;
                delays.push(u16(i));
                i+=4;
            } else if(kind===0xff) {
                const n=bytes[i++];
                const ext=Buffer.from(bytes.slice(i,i+n)).toString("ascii");
                i+=n;
                assert.equal(ext,"NETSCAPE2.0");
                const len=bytes[i++];
                assert.equal(len,3);
                assert.equal(bytes[i++],1);
                loop=u16(i);
                i+=2;assert.equal(bytes[i++],0);
            } else {
                while(true) {
                    const n=bytes[i++];
                    if(!n)break;
                    i+=n;
                }
            }
            continue;
        }
        assert.equal(tag,0x2c,"GIF record type");
        assert.equal(u16(i),0);assert.equal(u16(i+2),0);
        assert.equal(u16(i+4),280);assert.equal(u16(i+6),192);
        i+=8;
        const local=bytes[i++];
        assert.equal(local&128,0,"uses fixed global palette");
        const minCodeSize=bytes[i++],data=[];
        while(true) {
            const len=bytes[i++];
            if(!len)break;
            for(let b=0;b<len;b++)data.push(bytes[i++]);
        }
        frames.push(decodeGifLzw(Uint8Array.from(data),minCodeSize,280*192));
    }
    assert.equal(bytes[i-1],0x3b,"GIF trailer present");
    return {frames,delays,loop};
}

// Independent GIF LZW implementation in tests, including 5-to-12-bit
// code-width transitions, so GIF output isn't tested by its own encoder.
function decodeGifLzw(input,min,length) {
    const clear=1<<min,end=clear+1;
    let size,next,dictionary,previous,bit=0;
    const output=[];
    function reset() {
        size=min+1;next=end+1;
        dictionary=new Array(4096);
        for(let n=0;n<clear;n++)dictionary[n]=[n];
        previous=null;
    }
    reset();
    for(let guard=0;guard<500000;guard++) {
        const off=bit>>3,shift=bit&7;
        assert.ok(off<input.length,"LZW terminated by an end code");
        const n=((input[off]||0)|((input[off+1]||0)<<8)|
            ((input[off+2]||0)<<16))>>>shift&((1<<size)-1);
        bit+=size;
        if(n===clear){reset();continue;}
        if(n===end)break;
        let entry=dictionary[n];
        if(!entry) {
            assert.ok(previous && n===next,"Unknown GIF LZW code "+n);
            entry=previous.concat(previous[0]);
        }
        output.push(...entry);
        assert.ok(output.length<=length,"GIF output must fit screen");
        if(previous && next<4096) {
            dictionary[next++]=previous.concat(entry[0]);
            if(next===(1<<size) && size<12)size++;
        }
        previous=entry;
    }
    assert.equal(output.length,length,"Full raster decoded");
    return Uint8Array.from(output);
}

test("graphics modes map only visible RAM offsets to compact snapshots",()=>{
    const memory=new Uint8Array(0x6000);
    memory[0x2000]=0x31;memory[0x2078]=0xf1;
    const hgr=G.visibleBytes("HGR",memory.subarray(0x2000,0x4000));
    assert.equal(hgr.length,7680);
    assert.equal(hgr[0],0x31);
    const ignored=hgr.slice();
    memory[0x2078]=0x25; // unused HGR byte in 128-byte block
    assert.deepEqual(G.visibleBytes("HGR",memory.subarray(0x2000,0x4000)),ignored);
    memory[0x2000]=0x32;
    assert.equal(G.visibleBytes("HGR",memory.subarray(0x2000,0x4000))[0],0x32);
    memory[0x4000]=0x12;
    assert.equal(G.visibleBytes("HGR2",memory.subarray(0x4000,0x6000))[0],0x12);
    memory[0x0400]=0xf3;memory[0x0800]=0xa2;
    assert.equal(G.visibleBytes("GR",memory.subarray(0x400,0x800))[0],0xf3);
    assert.equal(G.visibleBytes("GR2",memory.subarray(0x800,0xc00))[0],0xa2);
    assert.throws(()=>G.visibleBytes("HGR",new Uint8Array(32)),/8192-byte/);
});

test("RLE handles long zero runs and nonzero literals, and rejects corrupt input",()=>{
    const input=Uint8Array.from({length:1200},(_,i)=>i%211<196?0:(i*7)&255);
    const packed=G.zeroRLE(input);
    assert.ok(packed.length<input.length/4);
    assert.deepEqual(G.decodeZeroRLE(packed,input.length),input);
    assert.throws(()=>G.decodeZeroRLE(Uint8Array.of(0x01,0x03),4),/short literal/);
    assert.throws(()=>G.decodeZeroRLE(Uint8Array.of(0x80),2),/incomplete frame/);
});

test("changed-only recording excludes identical pages and packs XOR deltas",()=>{
    let now=100;
    const recorder=new G.Recorder({now:()=>now});
    const a=new Uint8Array(7680);
    const first=recorder.capture("HGR",a);
    assert.equal(first.captured,true);
    assert.ok(first.storedBytes<150,"zero HGR page RLE is tiny");
    now=120;
    assert.equal(recorder.capture("HGR",a).captured,false);
    assert.equal(recorder.status().frames,1);
    const b=a.slice();b[5]=1;
    now=200;
    assert.equal(recorder.changed("HGR",b),true);
    const second=recorder.capture("HGR",b);
    assert.equal(second.captured,true);
    assert.equal(second.encoding,"xrle");
    assert.equal(recorder.changed("HGR",b),false);
    assert.equal(recorder.capture("HGR",b,{changedOnly:false}).captured,true);
    assert.equal(recorder.status().frames,3);
    assert.equal(recorder.clear(),true);
    assert.equal(recorder.status().frames,0);
});

test("GIF encoder round-trips HGR, GR and HGR2 pixels with a separate GIF decoder",()=>{
    const cases=[
        ["GR",new Uint8Array(960)],
        ["GR2",Uint8Array.from({length:960},(_,i)=>(i*13+i%29)&255)],
        ["HGR",new Uint8Array(7680).fill(127)],
        ["HGR2",Uint8Array.from({length:7680},(_,i)=>(i*17+i%21)&255)]
    ];
    for(const [mode,bytes] of cases) {
        const r=new G.Recorder({now:()=>100});
        r.capture(mode,bytes);
        const result=r.gif({animated:false});
        const gif=readGif(result.bytes);
        assert.equal(gif.frames.length,1,mode);
        assert.equal(gif.loop,null,"single GIF has no looping extension");
        assert.deepEqual(gif.frames[0],G.render(mode,bytes),mode);
    }
});

test("animated GIF uses real time delta, global 16-color palette and looping",()=>{
    const r=new G.Recorder({now:()=>100});
    const a=new Uint8Array(960);const b=a.slice();b[0]=0x21;
    const c=b.slice();c[7]=0xf4;
    r.capture("GR",a,{timestampMs:100});
    r.capture("GR",b,{timestampMs:300});
    r.capture("GR",c,{timestampMs:450});
    const result=r.gif({animated:true,loop:0,lastDelayMs:240});
    const gif=readGif(result.bytes);
    assert.equal(gif.loop,0);
    assert.deepEqual(gif.delays,[20,15,24]);
    assert.equal(gif.frames.length,3);
    assert.deepEqual(gif.frames[2],G.render("GR",c));
    const fixed=readGif(r.gif({animated:true,loop:2,frameDelayMs:80}).bytes);
    assert.deepEqual(fixed.delays,[8,8,8]);
    assert.equal(fixed.loop,2);
});

function hostFixture() {
    const graphics=new Uint8Array(0x6000),calls=[];
    const hw={
        safe_videoPage(start,length){
            calls.push(["snapshot",start,length]);
            return graphics.slice(start,start+length);
        },
        getVideoMode(){
            return {gfx:true,mix:false,page2:false,hires:true};
        }
    };
    const nodes={
        EMU_pasteboardScriptEditor:{value:""},
        EMU_pasteboardScriptMode:{value:"program"},
        EMU_pasteboardScriptStatus:{textContent:"ready"},
        EMU_pasteboardScriptRun:{disabled:false},
        EMU_pasteboardScriptStop:{disabled:true},
        EMU_pasteboardScriptConsoleFallback:{value:"",scrollTop:0}
    };
    const scripts=fs.readFileSync(path.join(root,"res/EMU_pasteboard_script.js"),"utf8");
    const links=[];
    const doc={
        getElementById(id){return nodes[id]||null;},
        createElement(type) {
            assert.equal(type,"a");
            const link={remove(){},click(){links.push({href:this.href,download:this.download});}};
            return link;
        },
        body:{appendChild(){}}
    };
    const uris=[];
    const urlAPI={
        createObjectURL(blob){uris.push(blob);return "blob:testgif";},
        revokeObjectURL(uri){calls.push(["revoke",uri]);}
    };
    const browser={
        document:doc,apple2plus:{hwObj(){return hw;}},
        EMU_PASTEBOARD_GIF:G,
        Blob,URL:urlAPI,setTimeout,clearTimeout
    };
    vm.runInNewContext(scripts,{window:browser},{filename:"EMU_pasteboard_script.js"});
    return {api:browser.EMU_PASTEBOARD_SCRIPT,graphics,calls,links,uris,nodes};
}

test("Script API snapshots visible HGR bytes and skips offscreen writes",()=>{
    const h=hostFixture();
    assert.equal(h.api.invoke("graphics.capture",{mode:"HGR"}).captured,true);
    assert.equal(h.api.invoke("graphics.capture",{mode:"HGR"}).captured,false);
    h.graphics[0x2078]=7;
    assert.equal(h.api.invoke("graphics.changed",{mode:"HGR"}),false);
    assert.equal(h.api.invoke("graphics.capture",{mode:"HGR"}).captured,false);
    h.graphics[0x2000]=7;
    assert.equal(h.api.invoke("graphics.changed",{mode:"HGR"}),true);
    assert.equal(h.api.invoke("graphics.capture",{mode:"HGR"}).captured,true);
    const active=h.api.invoke("graphics.capture",{mode:"active"});
    assert.equal(active.mode,"HGR");
    assert.equal(h.api.invoke("graphics.status").frames,2);
    assert.ok(h.calls.some(x=>x[0]==="snapshot"&&x[1]===0x2000&&x[2]===8192));
    assert.equal(h.api.invoke("graphics.clear"),true);
    assert.equal(h.api.invoke("graphics.status").frames,0);
});

test("GIF export performs no encoding/download until explicitly requested",()=>{
    const h=hostFixture();
    h.api.invoke("graphics.capture",{mode:"GR2"});
    assert.equal(h.links.length,0);
    const single=h.api.invoke("graphics.exportGIF",{
        filename:"frame.gif",download:false
    });
    assert.equal(single.frames,1);
    assert.equal(single.downloaded,false);
    assert.equal(String.fromCharCode(...single.data.slice(0,6)),"GIF89a");
    assert.equal(h.links.length,0);
    const animated=h.api.invoke("graphics.exportAnimatedGIF",{
        filename:"recording",frameDelayMs:100
    });
    assert.equal(animated.downloaded,true);
    assert.equal(animated.filename,"recording.gif");
    assert.equal(animated.frames,1);
    assert.equal(h.links.length,1);
    assert.equal(h.links[0].download,"recording.gif");
    assert.equal(h.uris[0].type,"image/gif");
});

test("capture works across script runs until explicitly cleared",async()=>{
    const h=hostFixture();
    h.nodes.EMU_pasteboardScriptEditor.value=[
        "await apple.graphics.capture({mode:'HGR'});",
        "await apple.graphics.capture({mode:'HGR'});"
    ].join("\n");
    assert.equal(h.api.run(),true);
    await new Promise(resolve=>setTimeout(resolve,15));
    assert.equal(h.api.invoke("graphics.status").frames,1);
    assert.equal(h.api.run(),true);
    await new Promise(resolve=>setTimeout(resolve,15));
    assert.equal(h.api.invoke("graphics.status").frames,1);
});
