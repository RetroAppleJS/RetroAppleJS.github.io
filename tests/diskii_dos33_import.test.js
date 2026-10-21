const assert=require("node:assert/strict");
const test=require("node:test");
const imp=require("../res/EMU_DISKII_DOS33_import.js");
function disk(){
  const b=new Uint8Array(143360);
  const vtoc=17*4096;
  b[vtoc+1]=17;b[vtoc+2]=15;b[vtoc+3]=3;b[vtoc+0x34]=35;
  b[vtoc+0x35]=16;b[vtoc+0x36]=0;b[vtoc+0x37]=1;
  for(let t=3;t<35;t++)if(t!==17)for(let k=0;k<2;k++)b[vtoc+0x38+t*4+k]=255;
  return b;
}
test("binary address boundaries and length metadata",()=>{
  assert.equal(imp.parseAddress("$2000"),0x2000);
  assert.equal(imp.parseAddress("0x2000"),0x2000);
  assert.throws(()=>imp.prepare({kind:"B",name:"CODE",address:"$FFFF",bytes:[1,2]}),/exceed/);
  const f=imp.prepare({kind:"B",name:"CODE.BIN",address:"$FFFE",bytes:[1,2]});
  assert.deepEqual(Array.from(f.bytes),[0xfe,0xff,2,0,1,2]);
});
test("ASCII text transcodes to Apple II high-bit bytes",()=>{
  assert.deepEqual(Array.from(imp.encodeText("Hi\n","A2_US").bytes),[0xc8,0xc9,0x8d,0]);
  assert.deepEqual(Array.from(imp.encodeText("abc","A2e_UK").bytes),[0xe1,0xe2,0xe3,0]);
});
test("Applesoft lines have ordered line numbers and linked pointers",()=>{
  const a=imp.tokenizeApplesoft("10 PRINT \"HI\"\n20 END");
  assert.equal(a[2],10);assert.equal(a[3],0);
  assert.ok(Array.from(a).includes(0xba));
  assert.deepEqual(Array.from(a.slice(-2)),[0,0]);
  assert.throws(()=>imp.tokenizeApplesoft("20 END\n10 END"),/increasing/);
});
test("insert into DOS 3.3 VTOC and catalog without mutating original",()=>{
  const b=disk(),file=imp.prepare({kind:"B",name:"HELLO",address:"$2000",bytes:[1,2,3]});
  const result=imp.insert(b,file);
  assert.equal(b[17*4096+15*256+0x0b],0);
  const cat=17*4096+15*256+0x0b;
  assert.equal(result.image[cat+2],4);
  assert.equal(result.image[cat+3],0xc8);
  assert.equal(result.sectors,2);
  assert.throws(()=>imp.insert(result.image,file),/already exists/);
});
test("reject unformatted volumes and full allocation maps",()=>{
  assert.throws(()=>imp.insert(new Uint8Array(143360),imp.prepare({kind:"T",name:"TEXT",text:"hi"})),/recognized/);
  const b=disk();b.fill(0,17*4096+0x38,17*4096+0xc4);
  assert.throws(()=>imp.insert(b,imp.prepare({kind:"T",name:"TEXT",text:"hello"})),/Not enough/);
});
