'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname,'..','res','EMU_CARD_applemouse.js');

function load()
{
    assert.equal(fs.existsSync(sourcePath),true,'res/EMU_CARD_applemouse.js must exist');
    const source = fs.readFileSync(sourcePath,'utf8');
    const context = { console:{log(){},warn(){},error(){}}, Uint8Array, oEMU:{component:{IO:{}}} };
    vm.createContext(context);
    vm.runInContext(source,context,{filename:'EMU_CARD_applemouse.js'});
    return context;
}

function makeRig()
{
    const context=load();
    const pia=new context.MousePIA6821();
    const mcu=new context.AppleMouse68705(pia);
    pia.write(0,0xFF);
    pia.write(2,0x3E);
    pia.write(1,0x04);
    pia.write(3,0x04);
    return {context,pia,mcu};
}

function hostPortAOutput(pia)
{
    pia.write(1,0x00);
    pia.write(0,0xFF);
    pia.write(1,0x04);
}

function hostPortAInput(pia)
{
    pia.write(1,0x00);
    pia.write(0,0x00);
    pia.write(1,0x04);
}

function hostWriteByte(pia,value)
{
    hostPortAOutput(pia);
    pia.write(0,value);
    const base=pia.getOutputB()&~0x30;
    pia.write(2,base|0x20);
    assert.equal(pia.read(2)&0x80,0x80,'WRACK must rise');
    pia.write(2,base);
    assert.equal(pia.read(2)&0x80,0,'WRACK must fall');
}

function hostReadByte(pia)
{
    hostPortAInput(pia);
    assert.equal(pia.read(2)&0x40,0x40,'RDREADY must be high');
    const value=pia.read(0);
    const base=pia.getOutputB()&~0x30;
    pia.write(2,base|0x10);
    assert.equal(pia.read(2)&0x40,0,'RDREADY must fall after RDACK');
    pia.write(2,base);
    return value;
}

test('AppleMouse source exposes a PIA and 68705 controller surface', () => {
    const context=load();
    assert.equal(typeof context.MousePIA6821,'function');
    assert.equal(typeof context.AppleMouse68705,'function');
    assert.equal(typeof context.AppleMouse,'function');
});

test('PIA register 0/2 switch between DDR and data using control bit 2', () => {
    const {MousePIA6821}=load();
    const pia=new MousePIA6821();

    pia.write(0,0xF0);
    pia.write(2,0x3E);
    assert.equal(pia.read(0),0xF0);
    assert.equal(pia.read(2),0x3E);

    pia.write(1,0x04);
    pia.write(3,0x04);
    pia.setInputA(0x0F);
    pia.setInputB(0xC1);
    pia.write(0,0xA0);
    pia.write(2,0x12);

    assert.equal(pia.read(0),0xAF);
    assert.equal(pia.read(2),0xD3);
});

test('WRREQUEST/WRACK performs a four-phase 6502-to-68705 byte transfer', () => {
    const {MousePIA6821,AppleMouse68705}=load();
    const pia=new MousePIA6821();
    const mcu=new AppleMouse68705(pia);

    pia.write(0,0xFF);
    pia.write(2,0x3E);
    pia.write(1,0x04);
    pia.write(3,0x04);

    pia.write(0,0x03);
    assert.equal(pia.read(2)&0x80,0);

    pia.write(2,0x20);
    assert.equal(pia.read(2)&0x80,0x80);
    assert.equal(mcu.getState().operatingMode,0x03);

    pia.write(2,0x00);
    assert.equal(pia.read(2)&0x80,0);
});

test('READMOUSE returns XL XH YL YH status through repeated RDREADY/RDACK phases', () => {
    const {pia,mcu}=makeRig();
    hostWriteByte(pia,0x01);
    mcu.setMouse(0x0123,0x02AB,false);
    hostWriteByte(pia,0x10);

    assert.deepEqual(
        [hostReadByte(pia),hostReadByte(pia),hostReadByte(pia),hostReadByte(pia),hostReadByte(pia)],
        [0x23,0x01,0xAB,0x02,0x20]
    );
    assert.equal(mcu.getState().replyLength,0);
});

test('POSMOUSE waits for all four little-endian position bytes before committing', () => {
    const {pia,mcu}=makeRig();
    hostWriteByte(pia,0x40);
    hostWriteByte(pia,0x23);
    hostWriteByte(pia,0x01);
    hostWriteByte(pia,0xAB);
    assert.deepEqual([mcu.getState().current.x,mcu.getState().current.y],[0,0]);
    hostWriteByte(pia,0x02);
    assert.deepEqual([mcu.getState().current.x,mcu.getState().current.y],[0x0123,0x02AB]);
});

test('CLAMPMOUSE decodes MinL MaxL MinH MaxH and selects X/Y from command bit 0', () => {
    const {pia,mcu}=makeRig();

    hostWriteByte(pia,0x60);
    hostWriteByte(pia,0x10);
    hostWriteByte(pia,0xFF);
    hostWriteByte(pia,0x00);
    hostWriteByte(pia,0x03);

    hostWriteByte(pia,0x61);
    hostWriteByte(pia,0x20);
    hostWriteByte(pia,0xEF);
    hostWriteByte(pia,0x00);
    hostWriteByte(pia,0x02);

    const clamp=mcu.getState().clamp;
    assert.deepEqual([clamp.minX,clamp.maxX,clamp.minY,clamp.maxY],[0x0010,0x03FF,0x0020,0x02EF]);
});

test('RDMEMMOUSE reads documented clamp bytes at $47-$4E using AddrL AddrH', () => {
    const {pia}=makeRig();
    hostWriteByte(pia,0x60); hostWriteByte(pia,0x10); hostWriteByte(pia,0xAA); hostWriteByte(pia,0x01); hostWriteByte(pia,0x03);
    hostWriteByte(pia,0x61); hostWriteByte(pia,0x20); hostWriteByte(pia,0xBB); hostWriteByte(pia,0x00); hostWriteByte(pia,0x02);

    const expected=new Map([[0x47,0x01],[0x48,0x00],[0x49,0x10],[0x4A,0x20],[0x4B,0x03],[0x4C,0x02],[0x4D,0xAA],[0x4E,0xBB]]);
    for(const [addr,value] of expected)
    {
        hostWriteByte(pia,0xF0);
        hostWriteByte(pia,addr&0xFF);
        hostWriteByte(pia,(addr>>8)&0xFF);
        assert.equal(hostReadByte(pia),value,'controller address $'+addr.toString(16));
    }
});

test('SERVEMOUSE reports IRQ causes, clears them, and deasserts slot IRQ', () => {
    const context=load();
    const pia=new context.MousePIA6821();
    const irq=[];
    const mcu=new context.AppleMouse68705(pia,{irq:state=>irq.push(state)});
    pia.write(0,0xFF); pia.write(2,0x3E); pia.write(1,0x04); pia.write(3,0x04);

    hostWriteByte(pia,0x0F);
    mcu.setMouse(12,34,false);
    mcu.setMouse(12,34,true);
    mcu.vbl();
    assert.equal(mcu.getState().irqAsserted,true);

    hostWriteByte(pia,0x20);
    assert.equal(hostReadByte(pia),0x0E);
    assert.equal(mcu.getState().intState,0x20);
    assert.equal(mcu.getState().irqAsserted,false);
    assert.equal(irq.at(-1),false);
});

test('idle compatibility read presents $00 instead of leaving ROM in an endless RDREADY wait', () => {
    const {pia}=makeRig();
    hostWriteByte(pia,0x01);
    assert.equal(pia.read(2)&0x40,0x40);
    assert.equal(hostReadByte(pia),0x00);
});

test('HOMEMOUSE, CLEARMOUSE and INITMOUSE preserve their documented position/clamp semantics', () => {
    const {pia,mcu}=makeRig();

    hostWriteByte(pia,0x60); hostWriteByte(pia,0x10); hostWriteByte(pia,0x00); hostWriteByte(pia,0x00); hostWriteByte(pia,0x03);
    hostWriteByte(pia,0x61); hostWriteByte(pia,0x20); hostWriteByte(pia,0x00); hostWriteByte(pia,0x00); hostWriteByte(pia,0x02);
    hostWriteByte(pia,0x40); hostWriteByte(pia,0x80); hostWriteByte(pia,0x00); hostWriteByte(pia,0x90); hostWriteByte(pia,0x00);

    hostWriteByte(pia,0x70);
    assert.deepEqual([mcu.getState().current.x,mcu.getState().current.y],[0x10,0x20]);

    hostWriteByte(pia,0x30);
    assert.deepEqual([mcu.getState().current.x,mcu.getState().current.y],[0,0]);
    assert.deepEqual([mcu.getState().clamp.minX,mcu.getState().clamp.maxX],[0x10,0x300]);

    hostWriteByte(pia,0x50);
    const state=mcu.getState();
    assert.deepEqual([state.current.x,state.current.y],[0,0]);
    assert.deepEqual([state.clamp.minX,state.clamp.maxX,state.clamp.minY,state.clamp.maxY],[0,1023,0,1023]);
});

test('TIMEMOUSE honors $9x variable parameter lengths without parsing parameters as commands', () => {
    const {pia,mcu}=makeRig();
    hostWriteByte(pia,0x03);

    hostWriteByte(pia,0x9C);
    hostWriteByte(pia,0x01);
    hostWriteByte(pia,0x02);
    assert.equal(mcu.getState().operatingMode,0x03);
    hostWriteByte(pia,0x04);

    assert.equal(mcu.getState().operatingMode,0x03);
    assert.equal(mcu.getState().interVblCycles,17030);

    hostWriteByte(pia,0x91);
    assert.equal(mcu.getState().interVblCycles,20280);
});

test('controller reset clears parser/IRQ state and restores default clamps', () => {
    const {pia,mcu}=makeRig();
    hostWriteByte(pia,0x0F);
    mcu.setMouse(100,200,true);
    hostWriteByte(pia,0x60); hostWriteByte(pia,0x10);

    mcu.reset();
    const state=mcu.getState();
    assert.equal(state.operatingMode,0);
    assert.equal(state.intState,0);
    assert.equal(state.irqAsserted,false);
    assert.deepEqual([state.current.x,state.current.y],[0,0]);
    assert.deepEqual([state.clamp.minX,state.clamp.maxX,state.clamp.minY,state.clamp.maxY],[0,1023,0,1023]);
    assert.equal(state.parametersRemaining,0);
    assert.equal(pia.read(2)&0xC0,0);
});

test('AppleMouse card exposes SlotIO callbacks, controller test hooks, and banked slot ROM reads', () => {
    const {AppleMouse}=load();
    const card=new AppleMouse();

    assert.equal(card.id.PCODE,'AMOUSE');
    assert.equal(typeof card.action.SlotIO.RD.callback,'function');
    assert.equal(typeof card.action.SlotIO.WR.callback,'function');
    assert.equal(typeof card.action.SlotROM.RD.callback,'function');
    assert.equal(typeof card.getPIA(),'object');
    assert.equal(typeof card.getController(),'object');

    const rom=new Uint8Array(0x800);
    for(let bank=0;bank<8;bank++) rom[(bank<<8)|0x5A]=0xA0|bank;
    card.setROM(rom);

    const pia=card.getPIA();
    pia.write(2,0x3E); pia.write(3,0x04);
    pia.write(2,0x06);
    assert.equal(card.readROM(0x5A),0xA3);
    assert.equal(card.action.SlotROM.RD.callback(0x15A,{bRO:true}),0xA3);

    card.writeSlotIO(0x0E,0x02);
    assert.equal(pia.getOutputB()&0x0E,0x02);
});

test('READMOUSE includes previous/current button bits for both controller buttons', () => {
    const {pia,mcu}=makeRig();
    hostWriteByte(pia,0x01);
    mcu.setMouse(0,0,true,true);
    hostWriteByte(pia,0x10);
    const first=[hostReadByte(pia),hostReadByte(pia),hostReadByte(pia),hostReadByte(pia),hostReadByte(pia)];
    assert.equal(first[4]&0x90,0x90);

    mcu.setMouse(0,0,false,false);
    hostWriteByte(pia,0x10);
    const second=[hostReadByte(pia),hostReadByte(pia),hostReadByte(pia),hostReadByte(pia),hostReadByte(pia)];
    assert.equal(second[4]&0x41,0x41);
});

test('host mouse coordinates are clamped before movement/status processing', () => {
    const {pia,mcu}=makeRig();
    hostWriteByte(pia,0x60); hostWriteByte(pia,10); hostWriteByte(pia,20); hostWriteByte(pia,0); hostWriteByte(pia,0);
    hostWriteByte(pia,0x61); hostWriteByte(pia,30); hostWriteByte(pia,40); hostWriteByte(pia,0); hostWriteByte(pia,0);

    mcu.setMouse(255,-100,false);
    const state=mcu.getState();
    assert.deepEqual([state.current.x,state.current.y],[20,30]);
});
