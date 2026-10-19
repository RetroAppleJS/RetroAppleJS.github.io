'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
function loader(){
  const ctx=vm.createContext({console,Uint8Array,ArrayBuffer,Math,Number});
  vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_SID_PSID.js'),'utf8'),ctx);
  return ctx.SIDPSID;
}
function rig(){
  const bytes=new Uint8Array(0x10000);bytes.fill(0x4B,0xA000,0xB000);
  let loadCount=0;
  return {bytes,count:()=>loadCount,
    safe_flashdump:()=>bytes.subarray(0,0xC000).slice(),
    load_ram64k(image){assert.equal(image.length,65536);
      bytes.set(image.subarray(0,0xC000),0);loadCount++;}
  };
}
test('host PSID tool transfers raw bytes unchanged and publishes start and exact file length',()=>{
  const host=loader(),hw=rig(),file=Uint8Array.from([0x50,0x53,0x49,0x44,0x01,0x02,0x03]);
  const out=host.transfer(hw,file,'$6000');
  assert.deepEqual({start:out.start,length:out.length,end:out.end},
    {start:0x6000,length:7,end:0x6006});
  assert.deepEqual(Array.from(hw.bytes.subarray(0x6000,0x6007)),Array.from(file));
  assert.deepEqual(Array.from(hw.bytes.subarray(0x9430,0x9E08)),
    [0x53,0x49,0x44,0x46,0x00,0x60,7,0]);
  assert.equal(hw.bytes[0xA000],0x4B);
  assert.equal(hw.count(),1);
});
test('host transfer checks RAM fit without interpreting PSID format or contents',()=>{
  const h=loader(),hw=rig();
  const data=new Uint8Array(28*1024);
  assert.equal(h.transfer(hw,data,'$2000').length,28*1024);
  assert.equal(hw.count(),1);
  assert.throws(()=>h.transfer(hw,data,'$2001'),/does not fit/);
  assert.throws(()=>h.transfer(hw,data,'$1000'),/does not fit/);
  assert.throws(()=>h.transfer(hw,new Uint8Array(28*1024+1),'$2000'),/28 KiB/);
  assert.equal(hw.count(),1,'invalid transfer cannot touch RAM');
});
test('peripheral toolbox retains three SID rows and offers only a raw-file transfer control',()=>{
  const ctx=vm.createContext({console,Uint8Array,Math,Number,oEMU:{component:{IO:{}}}});
  vm.runInContext(fs.readFileSync(path.join(ROOT,'res/EMU_CARD_SID.js'),'utf8'),ctx);
  const card=new ctx.SIDCard();card.mount={hash:123};
  const html=card.deviceToolSlotHTML({toolboxID:'device_tool_4',slotID:4});
  assert.match(html,/openPSIDTransfer/);
  assert.match(html,/Raw PSID file transfer/);
  assert.match(html,/Telemetry/);
  assert.equal((html.match(/class='sid-toolbox-row'/g)||[]).length,3);
});
