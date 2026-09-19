'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');

function load(){
  const context={console:{log(){},warn(){},error(){}},oEMU:{component:{IO:{ACTION_MAP:{Hslot:null,RD:new Array(0x1000),WR:new Array(0x1000)}}}}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root,'res','EMU_DEVICE_UNIDISK35.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(root,'res','EMU_CARD_LIRON.js'),'utf8'),context);
  return context;
}

function encPayload(payload){
  const out=[]; let p=0; const odd=payload.length%7, groups=Math.floor(payload.length/7);
  if(odd){let prefix=0x80;for(let i=0;i<odd;i++)if(payload[p+i]&0x80)prefix|=0x40>>i;out.push(prefix);for(let i=0;i<odd;i++)out.push((payload[p+i]&0x7F)|0x80);p+=odd;}
  for(let g=0;g<groups;g++){let prefix=0x80;for(let i=0;i<7;i++)if(payload[p+i]&0x80)prefix|=0x40>>i;out.push(prefix);for(let i=0;i<7;i++)out.push((payload[p+i]&0x7F)|0x80);p+=7;}
  return {out,odd,groups};
}

function packet(dest,payload){
  const e=encPayload(payload), h=[dest&0x7F,0,0,0,0,e.odd,e.groups].map(b=>b|0x80); let c=0;
  for(const b of payload)c^=b&0xFF; for(const b of h)c^=b;
  return [0xFF,0x3F,0xCF,0xF3,0xFC,0xFF,0xC3,...h,...e.out,c|0xAA,(c>>1)|0xAA,0xC8];
}

function dec(packet){
  const b=packet.indexOf(0xC3), h=packet.slice(b+1,b+8).map(v=>v&0x7F), odd=h[5],groups=h[6];
  let pos=b+8,out=[];
  if(odd){const prefix=packet[pos++]&0x7F;for(let i=0;i<odd;i++){const low=packet[pos++]&0x7F;out.push(low|(((prefix>>(6-i))&1)?0x80:0));}}
  for(let g=0;g<groups;g++){const prefix=packet[pos++]&0x7F;for(let i=0;i<7;i++){const low=packet[pos++]&0x7F;out.push(low|(((prefix>>(6-i))&1)?0x80:0));}}
  return {status:h[4],payload:out};
}

function exchange(bus,cmd){
  bus.setLines(0x0B); for(const b of cmd)bus.writeData(b,0x0B);
  bus.setLines(0x0A); bus.setLines(0x0B);
  const out=[]; for(let i=0;i<2048&&bus.getState().protocolState!=='RESPONSE_DONE';i++)out.push(bus.readData(0x0B));
  assert.equal(bus.getState().protocolState,'RESPONSE_DONE');
  bus.setLines(0x0A); return out;
}

test('SmartPort READ BLOCK returns mounted UniDisk media block',()=>{
  const c=load(),bus=new c.SmartPortBus(),disk=new c.UniDisk35Device(); bus.attach(disk,1);
  const image=new Uint8Array(1600*512), block=2;
  for(let i=0;i<512;i++)image[block*512+i]=(i^0xA5)&0xFF;
  disk.loadImage(image);
  const payload=[0x01,0x03,0x00,0x20,block&0xFF,(block>>8)&0xFF,(block>>16)&0xFF,0x00,0x00];
  const r=dec(exchange(bus,packet(1,payload)));
  assert.equal(r.status,0);
  assert.equal(r.payload.length,512);
  assert.deepEqual(r.payload,Array.from(image.slice(block*512,(block+1)*512)));
});
