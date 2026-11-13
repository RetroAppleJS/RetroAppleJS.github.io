// Apple II J-Plus character ROM, AN2 soft-switch, and renderer regression tests.
// Run with: node --test tests/a2jp_katakana_video.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname,"..");
const source = name => fs.readFileSync(path.join(root,"res",name),"utf8");
const romSource = source("EMU_apple2roms.js");
const muxSource = source("EMU_DEVICE_video_MUX.js");
const boardSource = source("EMU_CARD_hostio.js");
const gpuSource = source("EMU_DEVICE_video_GPU.js");

const jpStart = romSource.indexOf('"A2_JP": new Uint8Array([');
assert.ok(jpStart>=0,"A2_JP must exist");
const jpBlock = romSource.slice(jpStart,romSource.indexOf("])",jpStart));
const jPlusROM = Uint8Array.from([...jpBlock.matchAll(/0x([0-9a-f]{2})/gi)]
    .map(m=>parseInt(m[1],16)));

function crc32(bytes)
{
    let crc = 0xFFFFFFFF;
    for(const b of bytes)
    {
        crc ^= b;
        for(let i=0;i<8;i++)
            crc=(crc>>>1)^((crc&1)?0xEDB88320:0);
    }
    return (crc^0xFFFFFFFF)>>>0;
}

const helperSource = romSource.slice(
    romSource.indexOf("function Apple2CharROM_glyphIndex"),
    romSource.indexOf("function Apple2CharROM_get"));
assert.ok(helperSource.startsWith("function Apple2CharROM_glyphIndex"));
const helpers = {};
vm.runInNewContext(helperSource,helpers);
const index = helpers.Apple2CharROM_glyphIndex;

test("bundled A2_JP font remains the original 256-glyph / 2 KB ROM",()=>{
    assert.equal(jPlusROM.length,2048);
    assert.equal(crc32(jPlusROM),0x487104B5);
    // Three 64-character Roman blocks are identical.
    assert.deepEqual(jPlusROM.slice(0x200,0x400),jPlusROM.slice(0x400,0x600));
    assert.deepEqual(jPlusROM.slice(0x400,0x600),jPlusROM.slice(0x600,0x800));
});

test("J-Plus bank lookup follows Apple II video addresses for every screen byte",()=>{
    for(let d=0;d<256;d++)
    {
        const base = d>=0x40 && d<0x80 ? d&0x3F : d;
        assert.equal(index(d,"A2_JP",false),base,"kana d=$"+d.toString(16));
        assert.equal(index(d,"A2_JP",true),base|0x80,"Roman d=$"+d.toString(16));
        assert.equal(index(d,"A2_US",false),(d&63)^32,"base A2P d=$"+d.toString(16));
        assert.equal(index(d,"A2_US",true),(d&63)^32,"base A2P AN2 d=$"+d.toString(16));
    }
    // Ctrl-T toggles the inverse mask (screen codes $01/$81, etc.); 
    // the soft switch determines whether inverse glyphs are Roman or Kana.
    assert.equal(index(0x41,"A2_JP",false),0x01);
    assert.equal(index(0x41,"A2_JP",true),0x81);
    assert.equal(index(0xC1,"A2_JP",false),0xC1);
});

test("motherboard $C05C/$C05D reads and writes toggle AN2, but safe scans do not",()=>{
    const emu={system:{A2JP:{active:true}},component:{IO:{}}};
    const context=new Function("oEMU","oCOM","_CFG_IORANGES","_CFG_IOADDR","console",
        boardSource+"\nreturn oEMU.component.IO.board");
    const board=context(emu,{
        parseRngExpr:()=>({from:0xC000,to:0xC07F}),
        trim:s=>String(s).trim()
    },{"A2,A2P,A2JP":{HostIO:"$C000-$C07F"}},
    {"$C05C":{Name:"CLRAN2",SYScode:"A2JP",Behaviors:"RD,WR"},
     "$C05D":{Name:"SETAN2",SYScode:"A2JP",Behaviors:"RD,WR"}},
    {warn(){},log(){},error(){}});
    const map=board.IO_map("A2JP");
    const transitions=[], ctx={
        bRO:false,io:{FLOATING_BUS:0xFF},
        vid:{setAnnunciator2(flag){transitions.push(flag);}}
    };
    assert.equal(map.RD[0x50](0x0C,ctx),0xFF);
    assert.equal(map.WR[0x50](0x0D,0,ctx),0xFF);
    assert.deepEqual(transitions,[false,true]);
    ctx.bRO=true;
    map.RD[0x50](0x0C,ctx);
    map.WR[0x50](0x0D,0,ctx);
    assert.deepEqual(transitions,[false,true]);
});

test("video MUX preserves AN2 across switching, existing renderers, and reset",()=>{
    const fonts={A2_US:new Uint8Array(512),A2_JP:jPlusROM};
    const make=new Function("Apple2VideoCanvas","Apple2CharROM_get",
        "apple2CharRom","document","console",
        muxSource+"\nreturn new Apple2VideoMUX(null)");
    const mux=make(function MockRenderer(){},key=>fonts[key],fonts,
        {getElementById(){return null;}},
        {warn(){},error(){},log(){}});
    const changes=[];
    mux.redraw=()=>{};
    mux.renderers={canvas:{setCharRom(rom,key,ann2){changes.push([rom.length,key,ann2]);}}};
    assert.equal(mux.state.annunciator2,true,"reset-selected Roman");
    assert.equal(mux.setCharRom("A2_JP"),"A2_JP");
    assert.equal(mux.setAnnunciator2(false),false);
    assert.equal(mux.setAnnunciator2(true),true);
    assert.deepEqual(changes,[
        [2048,"A2_JP",true],[2048,"A2_JP",false],[2048,"A2_JP",true]]);
    const target={setCharRom(rom,key,ann2){changes.push([rom.length,key,ann2]);}};
    mux.applyState(target);
    assert.deepEqual(changes.at(-1),[2048,"A2_JP",true]);
    mux.registerDevices=()=>[];
    mux.setMode=()=>mux;
    mux.setAnnunciator2(false);
    mux.reset();
    assert.equal(mux.state.annunciator2,true);
});

test("GPU.js raster kernel obeys J-Plus bank while preserving classic lookup",()=>{
    const tail=gpuSource.slice(gpuSource.indexOf("this.kProcess_v6 =  function"))
        .replace("this.kProcess_v6 =  ","");
    const literal=tail.slice(0,tail.lastIndexOf("\n}")).trim();
    const kernel=new Function("return ("+literal+")")();
    const glyphByte=(d,mode)=>{
        const mem=new Uint8Array(0x6000);
        mem[0x400]=d;
        const cfg=new Uint8Array(261);
        cfg[1]=192;
        cfg[2]=86; // TEXT, page 1, lores
        cfg[4]=0;  // black
        cfg[244]=255; // white
        cfg[260]=mode;
        let out;
        kernel.call({thread:{x:0,y:382},color:(r)=>{out=r;}},mem,jPlusROM,cfg);
        return out;
    };
    for(const d of [0x00,0x01,0x41,0x61,0x80,0x81,0xA1,0xC1,0xE1])
    {
        for(const mode of [0,1,2])
        {
            const glyph=mode===0?index(d,"A2_US",true):
                index(d,"A2_JP",mode===2);
            const bit=jPlusROM[glyph*8]&1;
            const invert=(d<0x40)?1:0; // FLASH=0, so flashing remains normal
            const expected=(bit^invert)?255/256:0;
            assert.equal(glyphByte(d,mode),expected,
                "GPU d=$"+d.toString(16)+" bank="+mode);
        }
    }
    // The flashing ($40-$7F) region must invert on alternating frames.
    for(const mode of [0,1,2])
    {
        const mem=new Uint8Array(0x6000);
        mem[0x400]=0x41;
        const cfg=new Uint8Array(261);
        cfg[1]=192;cfg[2]=86;cfg[244]=255;cfg[260]=mode;
        const frame=(flash)=>{
            cfg[3]=flash;
            let color;
            kernel.call({thread:{x:0,y:382},color:r=>{color=r;}},mem,jPlusROM,cfg);
            return color;
        };
        assert.ok(frame(0)!==frame(1),"flashing must toggle for mode "+mode);
    }
});

test("captured raster path uses identical glyphs and legacy default",()=>{
    const rasterSource=source("EMU_VIDEO_raster.js");
    const body=rasterSource.slice(
        rasterSource.indexOf("function Apple2RasterKernel"),
        rasterSource.indexOf("function Apple2RasterCreateKernel"));
    const makeKernel=new Function(body+"\\nreturn Apple2RasterKernel;");
    const kernel=makeKernel();
    const bytes=new Uint8Array(7680),modes=new Uint8Array(7680);
    const pal=new Uint8Array(256);
    pal[240]=255;
    const render=(d,bank)=>{
        bytes[0]=d;
        let result;
        kernel.call({
            constants:{scale:2},
            thread:{x:0,y:382},
            color:(r)=>{result=r;}
        },bytes,modes,jPlusROM,pal,0,0,bank);
        return result;
    };
    for(const d of [0x00,0x01,0x41,0x61,0x80,0x81,0xC1,0xE1])
        for(const bank of [undefined,0,1,2])
        {
            const indexByte=bank>0?index(d,"A2_JP",bank===2):
                index(d,"A2_US",true);
            const inverse=d<0x40?1:0;
            const expected=(jPlusROM[indexByte*8]&1)^inverse;
            assert.equal(render(d,bank),expected?255/256:0,
                "captured raster d=$"+d.toString(16)+" bank="+bank);
        }
});

test("every video renderer has an explicit J-Plus glyph path",()=>{
    const raster=source("EMU_VIDEO_raster.js");
    const wave=source("EMU_DEVICE_video_wave.js");
    const webgpu=source("EMU_DEVICE_video_WebGPU.js");
    const canvas=source("EMU_DEVICE_video_canvas.js");
    const three=source("EMU_DEVICE_video_THREE.js");
    assert.match(canvas,/Apple2CharROM_glyphIndex\(d8/);
    assert.match(raster,/jplusMode>0/);
    assert.match(raster,/code\*8/);
    assert.match(wave,/JPLUS > 0/g);
    assert.match(wave,/this\.jplusMode/);
    assert.match(webgpu,/params\.jplusMode/);
    assert.match(webgpu,/code\*8u/);
    assert.match(three,/this\.video2D\.setCharRom\(rom,key,this\.annunciator2\)/);
    assert.match(gpuSource,/JPLUS=cfg\[260\]/);
});
