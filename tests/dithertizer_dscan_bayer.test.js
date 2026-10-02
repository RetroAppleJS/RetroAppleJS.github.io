'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');

function dscanPayload()
{
    const disk=fs.readFileSync(path.join(ROOT,'disks/GFX/Computer Stations Dithertizer II Driver Software for II II+.dsk'));
    const sector=(t,n)=>disk.subarray((t*16+n)*256,(t*16+n+1)*256);
    let t=sector(17,0)[1],n=sector(17,0)[2],entry;
    const seen=new Set();
    while(t)
    {
        assert.ok(!seen.has(t+':'+n),'catalog chain must not cycle');
        seen.add(t+':'+n);
        const b=sector(t,n);
        for(let o=11;o+35<=256;o+=35)
        {
            const e=b.subarray(o,o+35);
            const name=Array.from(e.subarray(3,33),c=>String.fromCharCode(c&127)).join('').trimEnd();
            if(e[0]!==0 && e[0]!==255 && name==='DSCAN 4.2.OBJ') entry=e;
        }
        t=b[1];n=b[2];
    }
    assert.ok(entry,'driver disk must contain DSCAN 4.2.OBJ');
    t=entry[0];n=entry[1];
    const data=[];
    seen.clear();
    while(t)
    {
        assert.ok(!seen.has(t+':'+n),'track/sector chain must not cycle');
        seen.add(t+':'+n);
        const b=sector(t,n);
        for(let o=12;o+1<256;o+=2)
            if(b[o]||b[o+1]) data.push(...sector(b[o],b[o+1]));
        t=b[1];n=b[2];
    }
    const raw=Buffer.from(data);
    assert.equal(raw.readUInt16LE(0),0x1C00);
    assert.equal(raw.readUInt16LE(2),1024);
    return raw.subarray(4,1028);
}

function line(base,y){return base+((y&7)<<10)+((y&0x38)<<4)+((y&0xC0)>>1)+((y&0xC0)>>3);}

test('stock DSCAN 4.2 runs four comparator captures and builds all five Bayer densities in PAGE2',()=>{
    const sandbox={console,oEMU:{component:{CPU:{},IO:{},ROM:{}}}};
    vm.createContext(sandbox);
    for(const name of ['EMU_cpu6502.js','EMU_apple2roms.js','EMU_CARD_dithertizer.js'])
        vm.runInContext(fs.readFileSync(path.join(ROOT,'res',name),'utf8'),sandbox,{filename:name});
    const ram=new Uint8Array(65536);
    ram.fill(0xA5,0x2000,0x6000);
    ram.set(vm.runInContext('apple2Rom',sandbox),0xD000);
    ram.set(dscanPayload(),0x1C00);
    // DSCAN parameters: 2x2 lattice, threshold spacing 25, base threshold $73.
    ram[0]=2;ram[1]=25;ram[2]=115;
    // The final RTS returns to a sentinel at $0800.
    ram[0x1FE]=0xFF;ram[0x1FF]=7;
    let ticks=0;
    const vid={state:{page2:false}};
    const hw={RD:[],WR:[],lineDecode:a=>a>>12};
    const card=new sandbox.DithertizerII();
    const levels=[114,115,120,121,127,128,133,134];
    const frame=new Uint8Array(280*192);
    for(let y=0;y<192;y++)
        for(let x=0;x<280;x++) frame[y*280+x]=levels[(x>>1)%8];
    card.setCameraSource({getLumaFrame:()=>frame});
    const captures=[];
    function read(a)
    {
        if(a===0xC054) vid.state.page2=false;
        if(a===0xC055) vid.state.page2=true;
        if(a===0xC0F0||a===0xC0F8)
        {
            if(a===0xC0F8) captures.push(card.state.threshold);
            return card.readSlotIO(a,{hw,vid,io:{getClockTicks:()=>ticks}});
        }
        return ram[a];
    }
    function write(a,d)
    {
        if(a===0xC0F0) card.writeSlotIO(a,d,{});
        else ram[a]=d;
    }
    for(let i=0;i<16;i++){hw.RD[i]=read;hw.WR[i]=write;}
    const cpu=new sandbox.Cpu6502(hw);
    cpu.setState({pc:0x1C00,sp:0xFD});
    for(;ticks<1000000;ticks++)
    {
        cpu.cycle();
        if(cpu.watch().pc===0x0800) break;
    }
    assert.equal(cpu.watch().pc,0x0800,'stock driver must complete without a sync-loop stall');
    assert.deepEqual(captures,[115,134,128,121]);
    const states=[[0,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,1],[1,0,0,1],[1,1,0,1],[1,1,0,1],[1,1,1,1]];
    const pixel=(x,y)=>(ram[line(0x4000,y)+Math.floor(x/7)]>>(x%7))&1;
    for(let y=0;y<192;y+=2)
        for(let x=0;x<280;x+=2)
            assert.deepEqual([pixel(x,y),pixel(x+1,y),pixel(x,y+1),pixel(x+1,y+1)],states[(x>>1)%8],`cell ${x},${y}`);
    for(let y=0;y<192;y++)
        for(let x=0;x<40;x++) assert.equal(ram[line(0x4000,y)+x]&0x80,0);
    assert.equal(ram[0x2078],0xA5,'PAGE1 holes are untouched');
    assert.equal(ram[0x4078],0xA5,'PAGE2 holes are untouched');
});
