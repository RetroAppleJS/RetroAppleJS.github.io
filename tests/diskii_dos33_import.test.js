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
test("BASIC tokenization is not included in disk import",()=>{
  assert.equal(typeof imp.tokenizeApplesoft,"undefined");
  assert.throws(()=>imp.prepare({kind:"A",name:"BASIC",text:"10 PRINT 1"}),/Unsupported import type/);
});
test("catalog sectors use DOS 3.3 physical-to-file skew",()=>{
  const b=disk(),base=17*4096;
  // The next physical catalog sector is $E, at DOS-order byte sector $8.
  b[base+15*256+1]=17;
  b[base+15*256+2]=14;
  for(let i=0;i<7;i++){
    const e=base+15*256+0x0b+i*0x23;
    b[e]=3;b[e+1]=0;b[e+2]=4;
    for(let c=0;c<30;c++)b[e+3+c]=0xa0;
    b[e+3]=0xc1+i;
  }
  const f=imp.prepare({kind:"B",name:"SECOND",address:"$2000",bytes:[0xaa,0xbb]});
  const image=imp.insert(b,f).image;
  assert.equal(image[base+8*256+0x0b+2],4);
  assert.equal(image[base+14*256+0x0b+2],0);
  const cat=base+8*256+0x0b;
  const listTrack=image[cat],listSec=image[cat+1];
  const skew=[0,7,14,6,13,5,12,4,11,3,10,2,9,1,8,15];
  const list=listTrack*4096+skew[listSec]*256;
  const dataTrack=image[list+0x0c],dataSec=image[list+0x0d];
  const data=dataTrack*4096+skew[dataSec]*256;
  assert.deepEqual(Array.from(image.slice(data,data+6)),[0,0x20,2,0,0xaa,0xbb]);
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


test("real DOS 3.3 disk retains BLOAD $2000 header after NIB conversion",()=>{
  const fs=require("node:fs"),path=require("node:path");
  const raw=new Uint8Array(fs.readFileSync(path.join(__dirname,"../disks/BLANK_DOS.DSK")));
  const payload=new Uint8Array(8192);
  payload[0]=0x12;payload[1]=0x34;payload[8191]=0x56;
  const file=imp.prepare({kind:"B",name:"HGR-PAGE1",address:"$2000",bytes:payload});
  const inserted=imp.insert(raw,file);
  const check=imp.verify(inserted.image,file);
  assert.deepEqual(check.header,[0,0x20,0,0x20]);
  assert.equal(check.loadAddress,0x2000);
  assert.equal(check.length,8192);
  const cardSrc=fs.readFileSync(path.join(__dirname,"../res/EMU_CARD_appledisk2.js"),"utf8");
  const card=new Function("var oEMU=undefined;"+cardSrc+"; return new AppleDisk2()")();
  const roundTrip=card.convertNib2Dsk(card.convertDsk2Nib(Array.from(inserted.image)));
  assert.deepEqual(imp.verify(roundTrip,file).header,[0,0x20,0,0x20]);
  // Verify a tampered stored header cannot be reported as a successful import.
  const bad=Uint8Array.from(roundTrip);
  const skew=[0,7,14,6,13,5,12,4,11,3,10,2,9,1,8,15],at=(t,sec)=>t*4096+skew[sec]*256;
  let t=bad[17*4096+1],sector=bad[17*4096+2],list=null;
  for(let guard=0;t!==0 && guard<32;guard++){
    const pos=at(t,sector);
    for(let k=0;k<7;k++){
      const p=pos+0x0b+k*0x23;
      const name=Array.from(bad.slice(p+3,p+33),b=>String.fromCharCode(b&127)).join("").trim();
      if(name==="HGR-PAGE1")list=[bad[p],bad[p+1]];
    }
    const nextT=bad[pos+1],nextS=bad[pos+2];t=nextT;sector=nextS;
  }
  assert.ok(list,"Imported DOS catalog entry missing");
  const listPos=at(list[0],list[1]),dataPos=at(bad[listPos+0x0c],bad[listPos+0x0d]);
  bad[dataPos+1]=0;
  assert.throws(()=>imp.verify(bad,file),/mismatch/);
});


test("VTOC sector bits follow actual DOS 3.3 descending numbering",()=>{
  const raw=disk(),vtoc=17*4096;
  const bytes=new Uint8Array(8192);
  const imported=imp.prepare({kind:"B",name:"HGR-BITMAP",address:"$2000",bytes});
  const result=imp.insert(raw,imported);
  // Import places 1 T/S list + 33 data sectors in physical order:
  // all of tracks 3 and 4, then physical sectors 15 and 14 on track 5.
  const bit=(track,sector)=>{
    const index=vtoc+0x38+track*4+((15-sector)>>3);
    return (result.image[index]&(0x80>>((15-sector)&7)))!==0;
  };
  for(let t=3;t<=4;t++)for(let s=0;s<16;s++)
    assert.equal(bit(t,s),false,"allocated T"+t+" S"+s+" must be in use");
  assert.equal(bit(5,15),false);
  assert.equal(bit(5,14),false);
  assert.equal(bit(5,13),true);
  assert.equal(bit(5,0),true);
  assert.deepEqual(Array.from(result.image.slice(vtoc+0x38+5*4,vtoc+0x38+5*4+4)),[0x3f,0xff,0,0]);
  assert.equal(imp.verify(result.image,imported).loadAddress,0x2000);
  // Previous importer wrote into the opposite bitmap bits; read-back must
  // flag such a disk rather than blindly trusting its DOS file pointers.
  const corrupted=Uint8Array.from(result.image);
  corrupted[vtoc+0x38+5*4] |= 0xc0;
  assert.throws(()=>imp.verify(corrupted,imported),/VTOC marks .* free/);
});

test("real DOS disk's existing HELLO allocation matches bitmap",()=>{
  const fs=require("node:fs"),path=require("node:path");
  const raw=new Uint8Array(fs.readFileSync(path.join(__dirname,"../disks/BLANK_DOS.DSK")));
  const vtoc=17*4096;
  const tr20=vtoc+0x38+20*4;
  // HELLO has a T/S sector on T20/S15 and a data sector on T20/S14.
  // The actual DOS-created disk marks these USED as 00111111 11111111.
  assert.deepEqual(Array.from(raw.slice(tr20,tr20+4)),[0x3f,0xff,0,0]);
});
