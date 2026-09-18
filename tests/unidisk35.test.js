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

    assert.equal(disk.id.DCODE,'UNIDISK35');
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

test('unsupported status codes fail without inventing block I/O', () => {
    const context = loadUniDisk();
    const disk = new context.UniDisk35Device();

    const reply = disk.status(0x7F);
    assert.equal(reply.error,0x01);
    assert.equal(reply.data.length,0);
    assert.equal(typeof disk.readBlock,'undefined');
    assert.equal(typeof disk.writeBlock,'undefined');
});
