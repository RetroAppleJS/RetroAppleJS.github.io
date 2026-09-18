'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname,'..');
const deviceSource = fs.readFileSync(path.join(root,'res','EMU_DEVICE_UNIDISK35.js'),'utf8');
const cardSource = fs.readFileSync(path.join(root,'res','EMU_CARD_LIRON.js'),'utf8');

function loadLiron()
{
    const context = {
        console:{ log(){}, warn(){}, error(){} },
        oEMU:{ component:{ IO:{ ACTION_MAP:{ Hslot:null, RD:new Array(0x1000), WR:new Array(0x1000) } } } }
    };
    vm.createContext(context);
    vm.runInContext(deviceSource,context,{filename:'EMU_DEVICE_UNIDISK35.js'});
    vm.runInContext(cardSource,context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

function encodePayload(payload)
{
    payload = Array.from(payload, b => b & 0xFF);
    const out = [];
    const odd = payload.length % 7;
    const groups = Math.floor(payload.length / 7);
    let pos = 0;

    if(odd)
    {
        let prefix = 0x80;
        for(let i=0;i<odd;i++) if(payload[pos+i] & 0x80) prefix |= 0x40 >> i;
        out.push(prefix);
        for(let i=0;i<odd;i++) out.push(payload[pos+i] | 0x80);
        pos += odd;
    }

    for(let g=0;g<groups;g++)
    {
        let prefix = 0x80;
        for(let i=0;i<7;i++) if(payload[pos+i] & 0x80) prefix |= 0x40 >> i;
        out.push(prefix);
        for(let i=0;i<7;i++) out.push(payload[pos+i] | 0x80);
        pos += 7;
    }

    return {bytes:out,odd,groups};
}

function encodePacket({dest=1,src=0,type=0,status=0,payload=[]}={})
{
    const enc = encodePayload(payload);
    const header = [dest&0x7F,src&0x7F,type&0x7F,0,status&0x7F,enc.odd,enc.groups];
    const wireHeader = header.map(b => b | 0x80);
    let checksum = 0;
    for(const b of payload) checksum ^= b & 0xFF;
    for(const b of wireHeader) checksum ^= b;

    return [
        0xFF,0x3F,0xCF,0xF3,0xFC,0xFF,0xC3,
        ...wireHeader,
        ...enc.bytes,
        checksum | 0xAA,
        (checksum >> 1) | 0xAA,
        0xC8
    ];
}

function decodePayload(encoded,odd,groups)
{
    const out=[];
    let pos=0;
    if(odd)
    {
        const prefix=encoded[pos++] & 0x7F;
        for(let i=0;i<odd;i++)
        {
            const low=encoded[pos++] & 0x7F;
            out.push(low | (((prefix >> (6-i)) & 1) ? 0x80 : 0));
        }
    }
    for(let g=0;g<groups;g++)
    {
        const prefix=encoded[pos++] & 0x7F;
        for(let i=0;i<7;i++)
        {
            const low=encoded[pos++] & 0x7F;
            out.push(low | (((prefix >> (6-i)) & 1) ? 0x80 : 0));
        }
    }
    return {payload:out,used:pos};
}

function decodePacket(packet)
{
    const begin = packet.indexOf(0xC3);
    assert.ok(begin>=0,'response must contain $C3 packet begin');
    const h = packet.slice(begin+1,begin+8);
    assert.equal(h.length,7,'response must contain seven header bytes');
    const header=h.map(b=>b&0x7F);
    const odd=header[5], groups=header[6];
    const encodedLen=(odd?odd+1:0)+groups*8;
    const encoded=packet.slice(begin+8,begin+8+encodedLen);
    const decoded=decodePayload(encoded,odd,groups);
    const c0=packet[begin+8+encodedLen];
    const c1=packet[begin+9+encodedLen];
    const end=packet[begin+10+encodedLen];
    assert.equal(end,0xC8,'response must end with $C8');

    let checksum=0;
    for(const b of decoded.payload) checksum ^= b;
    for(const b of h) checksum ^= b;
    const wireChecksum=(c0 & 0x55) | ((c1 & 0x55) << 1);
    assert.equal(wireChecksum,checksum,'response checksum must validate');

    return {
        dest:header[0], src:header[1], type:header[2], status:header[4],
        payload:decoded.payload
    };
}

function makeBus(context)
{
    const bus = new context.SmartPortBus();
    const disk = new context.UniDisk35Device();
    bus.attach(disk,1);
    return {bus,disk};
}

function exchange(bus,packet)
{
    // SmartPort enabled (PH1+PH3) with host REQ asserted (PH0).
    bus.setLines(0x0B);
    for(const b of packet) bus.writeData(b,0x0B);

    assert.equal(bus.getState().protocolState,'RESPONSE_PENDING');
    assert.equal(bus.getState().ack,true,'device must assert ACK after accepting the command');
    assert.equal(bus.readSense(),false,'asserted active-low ACK must appear as SENSE low');

    // Complete command handshake, then request the response.
    bus.setLines(0x0A);
    assert.equal(bus.getState().ack,false,'device releases ACK when REQ returns low');
    bus.setLines(0x0B);
    assert.equal(bus.getState().protocolState,'SEND_RESPONSE');

    const response=[];
    for(let guard=0;guard<1024 && bus.getState().protocolState!=='RESPONSE_DONE';guard++)
        response.push(bus.readData(0x0B));

    assert.equal(bus.getState().protocolState,'RESPONSE_DONE');
    assert.equal(bus.getState().ack,true,'device asserts ACK when the response transfer completes');
    bus.setLines(0x0A);
    assert.equal(bus.getState().protocolState,'WAIT_SYNC');
    assert.equal(bus.getState().ack,false);
    return response;
}

test('SmartPort STATUS $00 to resident ID 1 returns UniDisk 1600-block status packet', () => {
    const context=loadLiron();
    const {bus}=makeBus(context);
    // Standard SmartPort frame: command, parameter count, device id, reserved, status code.
    const command=encodePacket({dest:1,type:0,payload:[0x00,0x03,0x01,0x00,0x00]});
    const reply=decodePacket(exchange(bus,command));

    assert.equal(reply.type,0x01,'reply packet type must be STATUS');
    assert.equal(reply.status,0x00);
    assert.deepEqual(reply.payload,[0xF8,0x40,0x06,0x00]);
});

test('SmartPort STATUS $03 returns the UniDisk 3.5 DIB over the packet path', () => {
    const context=loadLiron();
    const {bus}=makeBus(context);
    const reply=decodePacket(exchange(bus,encodePacket({dest:1,payload:[0x00,0x03,0x01,0x00,0x03]})));

    assert.equal(reply.status,0x00);
    assert.equal(reply.payload.length,25);
    assert.deepEqual(reply.payload.slice(0,4),[0xF8,0x40,0x06,0x00]);
    assert.equal(String.fromCharCode(...reply.payload.slice(5,13)),'DISK 3.5');
    assert.equal(reply.payload[21],0x01);
    assert.equal(reply.payload[22],0x00);
});

test('SmartPort INIT assigns resident ID 1 and reports end of the one-device chain', () => {
    const context=loadLiron();
    const {bus,disk}=makeBus(context);
    const reply=decodePacket(exchange(bus,encodePacket({dest:1,payload:[0x05,0x00]})));

    assert.equal(disk.getUnit(),1,'logical bus unit remains unit 1');
    assert.equal(reply.src,1,'INIT reply must identify assigned resident ID 1');
    assert.equal(reply.type,0x01);
    assert.equal(reply.status,0x7F,'single attached device is end of chain');
});

test('SmartPort unit-zero STATUS reports exactly one resident device', () => {
    const context=loadLiron();
    const {bus}=makeBus(context);
    const reply=decodePacket(exchange(bus,encodePacket({dest:0,payload:[0x00,0x03,0x00,0x00,0x00]})));

    assert.equal(reply.type,0x01);
    assert.equal(reply.status,0x00);
    assert.equal(reply.payload[0],1);
});

test('bad packet checksum is rejected without dispatching a response', () => {
    const context=loadLiron();
    const {bus}=makeBus(context);
    const packet=encodePacket({dest:1,payload:[0x00,0x03,0x01,0x00,0x00]});
    packet[packet.length-3] ^= 0x01;

    bus.setLines(0x0B);
    for(const b of packet) bus.writeData(b,0x0B);

    assert.equal(bus.getState().protocolState,'WAIT_SYNC');
    assert.equal(bus.getState().ack,false);
    assert.match(bus.getState().lastError,/checksum/i);
});

test('PH0+PH2 resets protocol state without detaching UniDisk unit 1', () => {
    const context=loadLiron();
    const {bus,disk}=makeBus(context);
    bus.setLines(0x0B);
    for(const b of encodePacket({dest:1,payload:[0x00,0x03,0x01,0x00,0x00]})) bus.writeData(b,0x0B);
    assert.equal(bus.getState().protocolState,'RESPONSE_PENDING');

    bus.setLines(0x05);
    assert.equal(bus.getState().protocolState,'WAIT_SYNC');
    assert.deepEqual(Array.from(bus.getUnits()),[1]);
    assert.equal(bus.getDevice(1),disk);
});

test('LironIWM forwards phase line transitions to SmartPortBus and exposes ACK through SENSE', () => {
    const context=loadLiron();
    const {bus}=makeBus(context);
    const iwm=new context.LironIWM(bus);

    iwm.read(0x03); // PH1 high
    iwm.read(0x07); // PH3 high -> SmartPort enabled, REQ low
    assert.equal(bus.getState().enabled,true);
    assert.equal(bus.getState().req,false);

    iwm.read(0x01); // PH0 high -> REQ asserted
    assert.equal(bus.getState().req,true);
    assert.equal(bus.readSense(),true,'ACK line is high/deasserted before a command is accepted');
});
