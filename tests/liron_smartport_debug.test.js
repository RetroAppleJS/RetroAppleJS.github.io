'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');

function load(){
  const logs=[];
  const context={console:{log(...a){logs.push(a);},warn(...a){logs.push(a);},error(...a){logs.push(a);}},oEMU:{component:{IO:{ACTION_MAP:{Hslot:null,RD:new Array(0x1000),WR:new Array(0x1000)}}}}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root,'res','EMU_DEVICE_UNIDISK35.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(root,'res','EMU_CARD_LIRON.js'),'utf8'),context);
  return {context,logs};
}
function encPayload(payload){const out=[];let p=0;const odd=payload.length%7,groups=Math.floor(payload.length/7);if(odd){let prefix=0x80;for(let i=0;i<odd;i++)if(payload[p+i]&0x80)prefix|=0x40>>i;out.push(prefix);for(let i=0;i<odd;i++)out.push((payload[p+i]&0x7F)|0x80);p+=odd;}for(let g=0;g<groups;g++){let prefix=0x80;for(let i=0;i<7;i++)if(payload[p+i]&0x80)prefix|=0x40>>i;out.push(prefix);for(let i=0;i<7;i++)out.push((payload[p+i]&0x7F)|0x80);p+=7;}return {out,odd,groups};}
function packet(dest,payload){const e=encPayload(payload),h=[dest&0x7F,0,0,0,0,e.odd,e.groups].map(b=>b|0x80);let c=0;for(const b of payload)c^=b&0xFF;for(const b of h)c^=b;return [0xFF,0x3F,0xCF,0xF3,0xFC,0xFF,0xC3,...h,...e.out,c|0xAA,(c>>1)|0xAA,0xC8];}
function exchange(bus,cmd){bus.setLines(0x0B);for(const b of cmd)bus.writeData(b,0x0B);bus.setLines(0x0A);bus.setLines(0x0B);for(let i=0;i<2048&&bus.getState().protocolState!=='RESPONSE_DONE';i++)bus.readData(0x0B);bus.setLines(0x0A);}

test('bDebug logs semantic SmartPort READ BLOCK lifecycle',()=>{
  const {context,logs}=load();
  const bus=new context.SmartPortBus(), disk=new context.UniDisk35Device();
  bus.attach(disk,1);
  disk.loadImage(new Uint8Array(1600*512),{filename:'CardCat 1.94.po'});
  assert.equal(bus.setDebug(true),true);
  assert.equal(bus.getDebug(),true);
  exchange(bus,packet(1,[0x01,0x03,0x00,0x20,0x02,0x00,0x00,0x00,0x00]));
  const events=logs.filter(a=>String(a[0]).startsWith('[LIRON SmartPort]')).map(a=>String(a[0]).replace('[LIRON SmartPort] ',''));
  for(const name of ['RX_PACKET','RX_COMMAND','READ_BLOCK','DEVICE_RESULT','TX_RESPONSE']) assert.ok(events.includes(name),name+' missing');
  const read=logs.find(a=>a[0]==='[LIRON SmartPort] READ_BLOCK')[1];
  assert.equal(read.blockNumber,2);
  assert.equal(read.mediaLoaded,true);
  assert.equal(read.mediaFilename,'CardCat 1.94.po');
  assert.deepEqual(Array.from(read.payload.slice(0,7)),[1,3,0,32,2,0,0]);
  const result=logs.find(a=>a[0]==='[LIRON SmartPort] DEVICE_RESULT')[1];
  assert.equal(result.error,0);
  assert.equal(result.dataLength,512);
});

test('bDebug false is silent',()=>{
  const {context,logs}=load(); const bus=new context.SmartPortBus();
  assert.equal(bus.getDebug(),false);
  bus.reset();
  assert.equal(logs.filter(a=>String(a[0]).startsWith('[LIRON SmartPort]')).length,0);
});
