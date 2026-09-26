'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');

const sourcePath=path.join(__dirname,'..','res','EMU_CARD_applemouse.js');

function load()
{
    const source=fs.readFileSync(sourcePath,'utf8');
    const context={console:{log(){},warn(){},error(){}},Uint8Array,oEMU:{component:{IO:{}}}};
    vm.createContext(context);
    vm.runInContext(source,context,{filename:'EMU_CARD_applemouse.js'});
    return context;
}

test('AppleMouse boots with the authentic 341-0270-C / 342-0270-C 2 KiB ROM',()=>{
    const {AppleMouse}=load();
    const card=new AppleMouse();
    const rom=card.getROM();

    assert.equal(rom.length,0x800);
    assert.equal(crypto.createHash('sha1').update(Buffer.from(rom)).digest('hex'),'3a9d881a8a8d30f55b9719aceebbcf717f829d6f');
    assert.deepEqual(Array.from(rom.slice(0x05,0x0D)),[0x38,0x90,0x18,0xB8,0x50,0x15,0x01,0x20]);
    assert.deepEqual(Array.from(rom.slice(0x12,0x1A)),[0xB3,0xC4,0x9B,0xA4,0xC0,0x8A,0xDD,0xBC]);
    assert.equal(rom[0xFB],0xD6);
});

test('SlotROM callback exposes the selected 256-byte ROM bank and never requires C800 expansion ROM',()=>{
    const {AppleMouse}=load();
    const card=new AppleMouse();
    const pia=card.getPIA();
    const rom=card.getROM();

    pia.write(2,0x3E); // DDRB: PB1-PB5 outputs
    pia.write(3,0x04); // CRB: select peripheral-data register

    for(let bank=0;bank<8;bank++)
    {
        pia.write(2,(bank<<1)&0x0E);
        for(const off of [0x00,0x12,0x70,0xFB,0xFF])
            assert.equal(card.action.SlotROM.RD.callback(off,{bRO:true}),rom[(bank<<8)|off]);
    }

    assert.equal(card.action.HostROM,undefined);
});
