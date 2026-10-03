'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'res/EMU_CARD_dithertizer2.js'),'utf8');
function offset(y,x){return ((y&7)<<10)+((y&0x38)<<4)+((y&0xC0)>>1)+((y&0xC0)>>3)+x;}
function load(extra={})
{
    const sandbox={console,Uint8Array,Uint8ClampedArray,ArrayBuffer,Promise,setTimeout,clearTimeout,...extra};
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_DEVICE_camera.js'),'utf8'),sandbox);
    vm.runInContext(source+'\nthis.ColorCard=typeof DithertizerII_2==="function" ? DithertizerII_2 : DithertizerII;',sandbox);
    const card=new sandbox.ColorCard();
    new sandbox.DithertizerCameraDevice().bindHost(card);
    return card;
}
function capture(card,page2)
{
    const writes=new Map();
    const ctx={vid:{state:{page2}},hw:{write(addr,value){writes.set(addr,value);}}};
    card.readSlotIO(0x08,ctx);
    return writes;
}
function dscanPayload()
{
    const disk=fs.readFileSync(path.join(ROOT,'disks/GFX/Computer Stations Dithertizer II Driver Software for II II+.dsk'));
    const sector=(track,number)=>disk.subarray((track*16+number)*256,(track*16+number+1)*256);
    let track=sector(17,0)[1],number=sector(17,0)[2],entry=null;
    while(track)
    {
        const catalog=sector(track,number);
        for(let i=11;i+35<=256;i+=35)
        {
            const item=catalog.subarray(i,i+35);
            const name=Array.from(item.subarray(3,33),c=>String.fromCharCode(c&127)).join('').trimEnd();
            if(item[0]!==0 && item[0]!==255 && name==='DSCAN 4.2.OBJ') entry=item;
        }
        track=catalog[1];number=catalog[2];
    }
    assert.ok(entry);
    track=entry[0];number=entry[1];
    const bytes=[];
    while(track)
    {
        const list=sector(track,number);
        for(let i=12;i+1<256;i+=2)
            if(list[i]||list[i+1]) bytes.push(...sector(list[i],list[i+1]));
        track=list[1];number=list[2];
    }
    const data=Buffer.from(bytes);
    assert.equal(data.readUInt16LE(0),0x1C00);
    return data.subarray(4,4+1024);
}

test('color source writes complete HGR bytes and preserves bit 7 in either selected page',()=>{
    const card=load();
    const page=new Uint8Array(8192);
    page[offset(0,0)]=0xD5;
    page[offset(1,0)]=0x8A;
    page[offset(191,39)]=0xFF;
    page[0x78]=0xEE; // The HGR memory hole is not a pixel.
    card.setCameraSource({getHGRPage(){return page;}});
    card.writeSlotIO(0,255,{}); // Color data must not be thresholded.
    const first=capture(card,false);
    assert.equal(first.size,7680);
    assert.equal(first.get(0x2000),0xD5);
    assert.equal(first.get(0x2400),0x8A);
    assert.equal(first.get(0x2000+offset(191,39)),0xFF);
    assert.equal(first.has(0x2078),false);
    const second=capture(card,true);
    assert.equal(second.get(0x4000),0xD5);
    assert.equal(second.get(0x4400),0x8A);
    assert.equal(second.has(0x4078),false);
});

test('live camera publishes the complete WASM HGR page at a capture boundary',async()=>{
    const page=new Uint8Array(8192);
    page[0]=0xD5;
    page[offset(64,39)]=0xA6;
    const stream={getTracks(){return [{stop(){}}];}};
    const video={videoWidth:280,videoHeight:192,async play(){},pause(){}};
    const canvas={getContext(){return {drawImage(){},getImageData(){return {data:new Uint8ClampedArray(280*192*4)};}};}};
    class Adapter
    {
        async init(){}
        configure(){}
        async convert(){return {paletteIndex:new Uint8Array(280*192),hgrPage:page};}
        close(){}
    }
    const card=load({DithertizerConvertHGRAdapter:Adapter,
        document:{createElement(type){return type==='video'?video:canvas;},getElementById(){return null;}},
        navigator:{mediaDevices:{async getUserMedia(){return stream;}}}});
    assert.equal(await card.deviceToolCameraToggle('camera'),true);
    try
    {
        card.writeSlotIO(0,255,{});
        const writes=capture(card,true);
        assert.equal(writes.get(0x4000),0xD5);
        assert.equal(writes.get(0x4000+offset(64,39)),0xA6);
    }
    finally {card.reset();}
});

test('the original DSCAN $1D03 sync entry captures color PAGE2 without its bit-7-clearing merge',()=>{
    const sandbox={console,oEMU:{component:{CPU:{},IO:{},ROM:{}}}};
    vm.createContext(sandbox);
    for(const filename of ['EMU_cpu6502.js','EMU_apple2roms.js','EMU_CARD_dithertizer2.js'])
        vm.runInContext(fs.readFileSync(path.join(ROOT,'res',filename),'utf8'),sandbox,{filename});
    const ram=new Uint8Array(65536);
    ram.fill(0xA5,0x2000,0x6000);
    ram.set(vm.runInContext('apple2Rom',sandbox),0xD000);
    ram.set(dscanPayload(),0x1C00);
    ram[0]=2;
    ram[0x1FE]=0xFF;ram[0x1FF]=7;
    const page=new Uint8Array(8192);
    page[0]=0xD5;page[offset(191,39)]=0xE9;
    const card=new (sandbox.DithertizerII_2 || sandbox.DithertizerII)();
    card.setCameraSource({getHGRPage(){return page;}});
    const vid={state:{page2:false}};
    const hw={RD:[],WR:[],lineDecode:a=>a>>12};
    let ticks=0,captures=0;
    function read(addr)
    {
        if(addr===0xC054) vid.state.page2=false;
        if(addr===0xC055) vid.state.page2=true;
        if(addr===0xC0F0 || addr===0xC0F8)
        {
            if(addr===0xC0F8) captures++;
            return card.readSlotIO(addr,{hw,vid,io:{getClockTicks:()=>ticks}});
        }
        return ram[addr];
    }
    function write(addr,value)
    {
        if(addr===0xC0F0) card.writeSlotIO(addr,value,{});
        else ram[addr]=value;
    }
    for(let i=0;i<16;i++){hw.RD[i]=read;hw.WR[i]=write;}
    const cpu=new sandbox.Cpu6502(hw);
    cpu.setState({pc:0x1D03,sp:0xFD});
    for(;ticks<1000000;ticks++)
    {
        cpu.cycle();
        if(cpu.watch().pc===0x0800) break;
    }
    assert.equal(cpu.watch().pc,0x0800);
    assert.equal(captures,1);
    assert.equal(card.state.page2,true);
    assert.equal(ram[0x4000],0xD5);
    assert.equal(ram[0x4000+offset(191,39)],0xE9);
    assert.equal(ram[0x2000],0xA5);
    assert.equal(ram[0x4078],0xA5);
});

test('DITHER2 redirects the stock DSCAN $1C00 entry to one PAGE2 color capture',()=>{
    const sandbox={console,oEMU:{component:{CPU:{},IO:{},ROM:{}}}};
    vm.createContext(sandbox);
    for(const filename of ['EMU_cpu6502.js','EMU_apple2roms.js','EMU_CARD_dithertizer2.js'])
        vm.runInContext(fs.readFileSync(path.join(ROOT,'res',filename),'utf8'),sandbox,{filename});

    const driver=dscanPayload();
    const ram=new Uint8Array(65536);
    ram.fill(0xA5,0x2000,0x6000);
    ram.set(vm.runInContext('apple2Rom',sandbox),0xD000);
    ram.set(driver,0x1C00);
    ram[0]=2;ram[1]=25;ram[2]=115;
    ram[0x1FE]=0xFF;ram[0x1FF]=7;
    const page=new Uint8Array(8192);
    page[0]=0x80;
    page[offset(64,13)]=0xA5;
    page[offset(191,39)]=0xE9;
    const card=new sandbox.DithertizerII_2();
    card.setCameraSource({getHGRPage(){return page;}});
    const vid={state:{page2:false}},hw={RD:[],WR:[],lineDecode:a=>a>>12};
    let ticks=0,captures=0;
    function read(addr)
    {
        if(addr===0xC054) vid.state.page2=false;
        if(addr===0xC055) vid.state.page2=true;
        if(addr===0xC0F0 || addr===0xC0F8)
        {
            if(addr===0xC0F8) captures++;
            return card.readSlotIO(addr,{hw,vid,io:{getClockTicks:()=>ticks}});
        }
        return ram[addr];
    }
    function write(addr,value)
    {
        if(addr===0xC0F0) card.writeSlotIO(addr,value,{});
        else ram[addr]=value;
    }
    for(let i=0;i<16;i++){hw.RD[i]=read;hw.WR[i]=write;}
    sandbox.apple2plus={hwObj(){return hw;}};

    card.cycle();
    assert.deepEqual(Array.from(ram.subarray(0x1C00,0x1C03)),[0x4C,0x03,0x1D]);
    const cpu=new sandbox.Cpu6502(hw);
    cpu.setState({pc:0x1C00,sp:0xFD});
    for(;ticks<1000000;ticks++)
    {
        cpu.cycle();
        if(cpu.watch().pc===0x0800) break;
    }
    assert.equal(cpu.watch().pc,0x0800);
    assert.equal(captures,1);
    assert.equal(vid.state.page2,true);
    for(let y=0;y<192;y++)
        for(let x=0;x<40;x++)
            assert.equal(ram[0x4000+offset(y,x)],page[offset(y,x)]);
    assert.equal(ram[0x4078],0xA5,'HGR holes remain untouched');

    const firstCapture=ram.slice(0x4000,0x6000);
    ram[0x1FE]=0xFF;ram[0x1FF]=7;
    cpu.setState({pc:0x1C00,sp:0xFD});
    for(;ticks<1000000;ticks++)
    {
        cpu.cycle();
        if(cpu.watch().pc===0x0800) break;
    }
    assert.equal(cpu.watch().pc,0x0800);
    assert.equal(captures,2);
    assert.deepEqual(ram.slice(0x4000,0x6000),firstCapture,'repeated stock calls show the same color page');

    card.reset();
    assert.deepEqual(Array.from(ram.subarray(0x1C00,0x1C03)),Array.from(driver.subarray(0,3)));
    card.cycle();
    assert.deepEqual(Array.from(ram.subarray(0x1C00,0x1C03)),[0x4C,0x03,0x1D]);
    ram.set(driver,0x1C00); // A subsequent BLOAD is redirected too.
    card.cycle();
    assert.deepEqual(Array.from(ram.subarray(0x1C00,0x1C03)),[0x4C,0x03,0x1D]);

    vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_apple2io.js'),'utf8'),sandbox);
    const io=new sandbox.Apple2IO();
    io.slots[7]={peripheral:card,lock:false};
    assert.equal(io.unmount(7),true);
    assert.deepEqual(Array.from(ram.subarray(0x1C00,0x1C03)),Array.from(driver.subarray(0,3)));
    ram[0x1CCC]=0xEA; // A different program must not be redirected.
    card.cycle();
    assert.deepEqual(Array.from(ram.subarray(0x1C00,0x1C03)),Array.from(driver.subarray(0,3)));
});
