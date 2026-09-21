'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');

function load()
{
    const context={console:{log(){},warn(){},error(){}},Uint8Array,ArrayBuffer,Number,String,RangeError,oEMU:{component:{IO:{ACTION_MAP:{Hslot:null,RD:new Array(0x1000),WR:new Array(0x1000)}}}}};
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root,'res','EMU_DEVICE_HD20.js'),'utf8'),context,{filename:'EMU_DEVICE_HD20.js'});
    vm.runInContext(fs.readFileSync(path.join(root,'res','EMU_CARD_LIRON.js'),'utf8'),context,{filename:'EMU_CARD_LIRON.js'});
    return context;
}

function encPayload(payload)
{
    const out=[]; let p=0; const odd=payload.length%7,groups=Math.floor(payload.length/7);
    if(odd){let prefix=0x80;for(let i=0;i<odd;i++)if(payload[p+i]&0x80)prefix|=0x40>>i;out.push(prefix);for(let i=0;i<odd;i++)out.push((payload[p+i]&0x7F)|0x80);p+=odd;}
    for(let g=0;g<groups;g++){let prefix=0x80;for(let i=0;i<7;i++)if(payload[p+i]&0x80)prefix|=0x40>>i;out.push(prefix);for(let i=0;i<7;i++)out.push((payload[p+i]&0x7F)|0x80);p+=7;}
    return {out,odd,groups};
}

function packet(dest,type,payload,source=0,status=0)
{
    payload=Array.from(payload||[],b=>Number(b)&0xFF);
    const e=encPayload(payload);
    const h=[dest&0x7F,source&0x7F,type&0x7F,0,status&0x7F,e.odd,e.groups].map(b=>b|0x80);
    let c=0; for(const b of payload)c^=b; for(const b of h)c^=b;
    return [0xFF,0x3F,0xCF,0xF3,0xFC,0xFF,0xC3,...h,...e.out,c|0xAA,(c>>1)|0xAA,0xC8];
}

function decodePacket(bytes)
{
    const b=bytes.indexOf(0xC3);
    assert.notEqual(b,-1,'response packet must contain $C3 marker');
    const h=bytes.slice(b+1,b+8).map(v=>v&0x7F),odd=h[5],groups=h[6];
    let pos=b+8,out=[];
    if(odd){const prefix=bytes[pos++]&0x7F;for(let i=0;i<odd;i++){const low=bytes[pos++]&0x7F;out.push(low|(((prefix>>(6-i))&1)?0x80:0));}}
    for(let g=0;g<groups;g++){const prefix=bytes[pos++]&0x7F;for(let i=0;i<7;i++){const low=bytes[pos++]&0x7F;out.push(low|(((prefix>>(6-i))&1)?0x80:0));}}
    return {dest:h[0],source:h[1],type:h[2],status:h[4],payload:out};
}

function sendBytes(bus,bytes)
{
    for(const b of bytes) bus.writeData(b,0x0B);
}

function readResponse(bus)
{
    const out=[];
    for(let i=0;i<2048 && bus.getState().protocolState!=='RESPONSE_DONE';i++) out.push(bus.readData(0x0B));
    assert.equal(bus.getState().protocolState,'RESPONSE_DONE');
    return decodePacket(out);
}

function writableHD20(c)
{
    const disk=new c.HD20Device();
    disk.loadImage(new Uint8Array(40960*512),{filename:'HD20.po'});
    return disk;
}

function prepareIWMForHostWrite(iwm)
{
    // SmartPort PH1+PH3 enabled, REQ asserted, IWM motor on and Q7 high.
    iwm.read(0x03);
    iwm.read(0x07);
    iwm.read(0x01);
    iwm.read(0x09);
    iwm.read(0x0F);
}

function sendPacketThroughIWM(iwm,bytes)
{
    let handshake=0xFF;
    for(const b of bytes)
    {
        // Q6 high with Q7+motor high selects WRITE DATA; Q6 low selects HANDSHAKE.
        iwm.write(0x0D,b);
        handshake=iwm.read(0x0C);
    }
    return handshake;
}

function readResponseThroughIWM(iwm,bus)
{
    // Q7 low selects DATA while motor remains on. Do this before asserting REQ
    // so the selector read cannot consume the first response byte.
    iwm.read(0x0E);
    iwm.read(0x01); // PH0/REQ high

    const out=[];
    for(let guard=0;guard<2048 && bus.getState().protocolState!=='RESPONSE_DONE';guard++)
        out.push(iwm.read(0x0A)); // DRIVE-off soft switch is an even DATA read without changing SmartPort phases.

    assert.equal(bus.getState().protocolState,'RESPONSE_DONE');
    iwm.read(0x00); // PH0/REQ low; complete response handshake.
    return decodePacket(out);
}

test('SmartPort WRITE BLOCK follows command/data/status REQ-ACK sequence and commits on DATA ACK release',()=>{
    const c=load(),bus=new c.SmartPortBus(),disk=writableHD20(c); bus.attach(disk,1);
    const block=0x1234;
    const data=Uint8Array.from({length:512},(_,i)=>(i^0xA5)&0xFF);
    const command=[0x02,0x03,0x00,0x20,block&0xFF,(block>>8)&0xFF,(block>>16)&0xFF,0x00,0x00];

    bus.setLines(0x0B);
    sendBytes(bus,packet(1,0x00,command));
    assert.equal(bus.getState().protocolState,'WRITE_COMMAND_ACK');
    assert.equal(bus.getState().ack,true);
    assert.deepEqual(Array.from(disk.readBlock(block).data),new Array(512).fill(0));

    bus.setLines(0x0A);
    assert.equal(bus.getState().protocolState,'WAIT_WRITE_DATA');
    assert.equal(bus.getState().ack,false);

    bus.setLines(0x0B);
    sendBytes(bus,packet(1,0x02,data));
    assert.equal(bus.getState().protocolState,'WRITE_DATA_ACK');
    assert.equal(bus.getState().ack,true);
    assert.deepEqual(Array.from(disk.readBlock(block).data),new Array(512).fill(0),'write must not commit before DATA ACK is released');

    bus.setLines(0x0A);
    assert.equal(bus.getState().protocolState,'RESPONSE_PENDING');
    assert.equal(bus.getState().ack,false);
    assert.deepEqual(Array.from(disk.readBlock(block).data),Array.from(data));

    bus.setLines(0x0B);
    const response=readResponse(bus);
    assert.equal(response.type,0x01);
    assert.equal(response.status,0x00);
    assert.deepEqual(response.payload,[]);

    bus.setLines(0x0A);
    assert.equal(bus.getState().protocolState,'WAIT_SYNC');
    assert.equal(bus.getState().ack,false);
});

test('LironIWM completes both WRITE BLOCK packet handshakes and commits through the real bus boundary',()=>{
    const c=load(),bus=new c.SmartPortBus(),iwm=new c.LironIWM(bus),disk=writableHD20(c); bus.attach(disk,1);
    const block=0x0025;
    const data=Uint8Array.from({length:512},(_,i)=>(i*3+7)&0xFF);
    const command=[0x02,0x03,0x00,0x20,block&0xFF,(block>>8)&0xFF,(block>>16)&0xFF,0x00,0x00];

    prepareIWMForHostWrite(iwm);
    const commandHandshake=sendPacketThroughIWM(iwm,packet(1,0x00,command));
    assert.equal(bus.getState().protocolState,'WRITE_COMMAND_ACK');
    assert.equal(commandHandshake&0x40,0x00,'command packet drain must signal completion to the Liron ROM');

    iwm.read(0x00); // PH0/REQ low
    assert.equal(bus.getState().protocolState,'WAIT_WRITE_DATA');
    iwm.read(0x01); // PH0/REQ high

    const dataHandshake=sendPacketThroughIWM(iwm,packet(1,0x02,data));
    assert.equal(bus.getState().protocolState,'WRITE_DATA_ACK');
    assert.equal(dataHandshake&0x40,0x00,'DATA packet drain must signal completion to the Liron ROM');
    assert.deepEqual(Array.from(disk.readBlock(block).data),new Array(512).fill(0),'media must remain untouched until DATA ACK is released');

    iwm.read(0x00); // PH0/REQ low commits the pending write.
    assert.equal(bus.getState().protocolState,'RESPONSE_PENDING');
    assert.deepEqual(Array.from(disk.readBlock(block).data),Array.from(data));

    const response=readResponseThroughIWM(iwm,bus);
    assert.equal(response.type,0x01);
    assert.equal(response.status,0x00);
    assert.deepEqual(response.payload,[]);
    assert.equal(bus.getState().protocolState,'WAIT_SYNC');
});

test('SmartPort WRITE BLOCK returns device errors and never crosses device boundaries',()=>{
    const c=load(),bus=new c.SmartPortBus(),disk1=writableHD20(c),disk2=writableHD20(c); bus.attach(disk1,1); bus.attach(disk2,2);
    disk1.setWriteProtected(true);
    const data=new Uint8Array(512); data.fill(0x66);
    const command=[0x02,0x03,0x00,0x20,0x05,0x00,0x00,0x00,0x00];

    bus.setLines(0x0B); sendBytes(bus,packet(1,0x00,command));
    bus.setLines(0x0A); bus.setLines(0x0B); sendBytes(bus,packet(1,0x02,data));
    bus.setLines(0x0A); bus.setLines(0x0B);
    const response=readResponse(bus);
    assert.equal(response.status,0x2B);
    bus.setLines(0x0A);

    assert.deepEqual(Array.from(disk1.readBlock(5).data),new Array(512).fill(0));
    assert.deepEqual(Array.from(disk2.readBlock(5).data),new Array(512).fill(0));
});

test('SmartPort rejects malformed WRITE DATA packets and reset aborts pending writes',()=>{
    const c=load(),bus=new c.SmartPortBus(),disk=writableHD20(c); bus.attach(disk,1);
    const command=[0x02,0x03,0x00,0x20,0x07,0x00,0x00,0x00,0x00];

    bus.setLines(0x0B); sendBytes(bus,packet(1,0x00,command));
    bus.setLines(0x0A); bus.setLines(0x0B);
    sendBytes(bus,packet(1,0x02,new Uint8Array(511)));
    assert.equal(bus.getState().protocolState,'WAIT_SYNC');
    assert.match(bus.getState().lastError,/512/);
    assert.deepEqual(Array.from(disk.readBlock(7).data),new Array(512).fill(0));

    bus.setLines(0x0A); bus.setLines(0x0B); sendBytes(bus,packet(1,0x00,command));
    assert.equal(bus.getState().protocolState,'WRITE_COMMAND_ACK');
    bus.reset();
    assert.equal(bus.getState().protocolState,'WAIT_SYNC');
    assert.equal(bus.getState().pendingWrite,null);
    assert.deepEqual(Array.from(disk.readBlock(7).data),new Array(512).fill(0));
});

test('SmartPort FORMAT dispatches to HD20 and returns an empty STATUS packet',()=>{
    const c=load(),bus=new c.SmartPortBus(),disk=writableHD20(c); bus.attach(disk,1);
    const data=new Uint8Array(512); data.fill(0xAB);
    assert.equal(disk.writeBlock(9,data).error,0x00);

    bus.setLines(0x0B);
    sendBytes(bus,packet(1,0x00,[0x03,0x01,0x00]));
    assert.equal(bus.getState().protocolState,'RESPONSE_PENDING');
    bus.setLines(0x0A); bus.setLines(0x0B);
    const response=readResponse(bus);
    assert.equal(response.type,0x01);
    assert.equal(response.status,0x00);
    assert.deepEqual(response.payload,[]);
    assert.deepEqual(Array.from(disk.readBlock(9).data),new Array(512).fill(0));
});
