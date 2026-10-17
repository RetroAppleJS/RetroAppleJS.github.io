'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

const root=path.join(__dirname,'..');
const configText=fs.readFileSync(path.join(root,'res/COM_CONFIG.js'),'utf8');
const docs=fs.readFileSync(path.join(root,'docs/CONFIG.md'),'utf8');
const config=vm.runInNewContext(configText+
    '\n;({PSLOT:_CFG_PSLOT,IORANGES:_CFG_IORANGES})');

test('SID has exactly one PSLOT entry in source and configuration documentation',()=>{
    const srcBlock=configText.match(/const _CFG_PSLOT\s*=\s*\{([\s\S]*?)\n\}/);
    assert.ok(srcBlock,'cannot find _CFG_PSLOT');
    const keys=[...srcBlock[1].matchAll(/^\s*,?\s*"([^"]+)"\s*:/gm)].map(m=>m[1]);
    assert.equal(keys.filter(pcode=>pcode==='SID').length,1);
    assert.equal(new Set(keys).size,keys.length,'no duplicate PCODE keys in PSLOT');
    const sidRows=docs.split('\n').filter(row=>/^\|\s*SID\s*\|/.test(row));
    assert.equal(sidRows.length,1,'SID should have only one documentation row');
    assert.match(sidRows[0],/\|\s*X\s*\|/);
    assert.equal(config.PSLOT.SID.SlotIO,'X');
    assert.match(config.PSLOT.SID.SLOTrange,/(?:^|,)4\$/);
});

test('actual Apple2IO mounts SID in slot 4 and exposes C0D0 signature and writable registers',()=>{
    const emu={component:{IO:{ACTION_MAP:{RD:[],WR:[],Hslot:null}}},
        system:{IORANGES:{
            HostIO:'$C000-$C07F',SlotIO:'$C080-$C0FF',
            SlotROM:'$C100-$C7FF',HostROM:'$C800-$CFFF'
        }}};
    function parseRngExpr(value,options={}){
        const slot=Number(options.n)||0;
        let from,to;
        if(value.includes('C080')){from=0xC080+16*slot;to=from+15;}
        else if(value.includes('C100')){from=0xC100+256*slot;to=from+255;}
        else if(value.includes('C800')){from=0xC800;to=0xCFFF;}
        else {from=0xC000;to=0xC07F;}
        if(options.base!==undefined){
            from-=options.base;to-=options.base;
        }
        return {from,to};
    }
    const com={
        URL:{uri:{}},trim:v=>String(v).trim(),
        parseRngExpr,crc16:()=>42,getHexWord:x=>(x&65535).toString(16)
    };
    const context=vm.createContext({
        oEMU:emu,oEMUI:{},oCOM:com,_CFG_PSLOT:config.PSLOT,
        _CFG_IORANGES:config.IORANGES,EMU_system_get:()=>'A2P',
        console:{log(){},warn(){},error(){},assert(){}},
        TextEncoder,Uint8Array,Float32Array
    });
    for(const name of ['EMU_DEVICE_SID_audio.js','EMU_CARD_SID.js','EMU_apple2io.js']){
        vm.runInContext(
            fs.readFileSync(path.join(root,'res',name),'utf8'),
            context,{filename:name}
        );
    }
    const io=new context.Apple2IO(null,null);
    io.slots=Array.from({length:9},(_,i)=>({slotTitle:i?'PR#'+(i-1):'board',lock:false}));
    io.slot_ctx.peripheral_slots={slots:io.slots};
    const mount=io.mount(config.PSLOT.SID,
        {PCODE:'SID',ctor:context.SIDCard,coID:'SIDCard'},5,['SID']);
    const card=mount.pObj;
    assert.ok(card,'SID should mount in physical slot 4');
    assert.deepEqual({from:card.mount.ranges.SlotIO.from,
        to:card.mount.ranges.SlotIO.to},{from:0xC0,to:0xCF});
    const device=new context.SIDAudio();
    card.devices=[device];
    device.bindHost(card);device.bindIO(io);
    io.slots[5].peripheral=card;
    assert.equal(io.read(0xC0),0x53,'slot-4 signature must equal ASCII S');
    assert.equal(io.read(0xC1)&0x0B,0x0B,'enabled, snoop, device present');
    io.write(0xC2,0x04);  // choose control register 1
    io.write(0xC3,0x41);  // pulse + gate
    assert.equal(device.getRegisters()[4],0x41);
    assert.equal(card.getStatistics().slotWrites,1);
});
