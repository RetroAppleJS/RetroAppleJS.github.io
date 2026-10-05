'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(extra){
  const refresh=[];
  const ctx={
    console,Uint8Array,Array,Number,Math,Object,JSON,
    Ayumi:function(){},
    oEMU:{component:{IO:{}}},
    oCOM:{addRefreshEvent(fn,name,active){ refresh.push({fn,name,active}); }},
    ...(extra||{})
  };
  ctx.__refresh=refresh;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res','EMU_CARD_mockingboard.js'),'utf8'),ctx);
  return ctx;
}
function u32(a,p){ return (a[p]|(a[p+1]<<8)|(a[p+2]<<16)|(a[p+3]<<24))>>>0; }
function cstr(a,p){ let s=''; while(a[p]) s+=String.fromCharCode(a[p++]); return s; }

test('FYM export separates AY chips into 60 Hz register-major streams',()=>{
  const {MockingboardHistory}=load();
  const ay0=Array(14).fill(0), ay1=Array(14).fill(0);
  ay0[0]=1; ay0[13]=5; ay1[0]=2; ay1[13]=6;
  const history={
    slot:4,clockHz:600,baseTick:100,stopTick:130,
    initialRegisters:{AY0:ay0,AY1:ay1},
    events:[[5,0,0,7],[0,1,0,8],[10,0,13,9],[0,1,13,10]]
  };
  const f0=MockingboardHistory.toFYM(history,0,60);
  const f1=MockingboardHistory.toFYM(history,1,60);
  assert.equal(u32(f0,4),3);
  assert.equal(u32(f0,8),0);
  assert.equal(u32(f0,12),600);
  assert.equal(u32(f0,16),60);
  const off0=u32(f0,0), off1=u32(f1,0);
  assert.equal(cstr(f0,20),'Mockingboard slot 4 AY0');
  assert.equal(cstr(f1,20),'Mockingboard slot 4 AY1');
  assert.deepEqual(Array.from(f0.slice(off0,off0+3)),[1,7,7]);
  assert.deepEqual(Array.from(f1.slice(off1,off1+3)),[2,8,8]);
  assert.deepEqual(Array.from(f0.slice(off0+13*3,off0+14*3)),[5,255,9]);
  assert.deepEqual(Array.from(f1.slice(off1+13*3,off1+14*3)),[6,255,10]);
});

test('FYM reset affects only its AY stream',()=>{
  const {MockingboardHistory}=load();
  const history={
    slot:null,clockHz:600,baseTick:0,stopTick:20,
    initialRegisters:{AY0:Array(14).fill(3),AY1:Array(14).fill(4)},
    events:[[10,0,-1,0]]
  };
  const f0=MockingboardHistory.toFYM(history,0,60), f1=MockingboardHistory.toFYM(history,1,60);
  const o0=u32(f0,0),o1=u32(f1,0),n=u32(f0,4);
  assert.equal(n,2);
  assert.deepEqual(Array.from(f0.slice(o0,o0+n)),[3,0]);
  assert.deepEqual(Array.from(f1.slice(o1,o1+n)),[4,4]);
  assert.deepEqual(Array.from(f0.slice(o0+13*n,o0+14*n)),[3,0]);
  assert.deepEqual(Array.from(f1.slice(o1+13*n,o1+14*n)),[4,255]);
});

test('history state exposes fill percentage and remains 100 percent after wrap',()=>{
  const {MockingboardHistory}=load();
  const h=new MockingboardHistory(1);
  h.start(0,[Array(14).fill(0),Array(14).fill(0)]);
  assert.equal(h.getState().fillPercent,0);
  for(let i=0;i<128;i++) h.recordWrite(0,0,i,1+i);
  assert.equal(h.getState().fillPercent,50);
  for(let i=128;i<256;i++) h.recordWrite(0,0,i,1+i);
  assert.equal(h.getState().fillPercent,100);
  h.recordWrite(0,0,0,300);
  assert.equal(h.getState().fillPercent,100);
});

test('peripheral UI uses the dashboard refresh event for live fill display',()=>{
  const ctx=load();
  const card=ctx.oEMU.component.IO.mockingboard;
  card.mount={hash:27};
  const html=card.deviceToolSlotHTML({toolboxID:'mock-tools',slotID:'slot4'});
  assert.equal(ctx.__refresh.length,1);
  assert.equal(ctx.__refresh[0].name,'MOCK_history_27_refresh');
  assert.equal(ctx.__refresh[0].active,true);
  assert.match(html,/MOCK_history_27_kbwrap/);
  assert.match(html,/MOCK_history_27_fill/);
  assert.match(html,/downloadHistoryFYM\(0\)/);
  assert.match(html,/downloadHistoryFYM\(1\)/);
  assert.match(html,/>FYM0</);
  assert.match(html,/>FYM1</);

  const elements={
    MOCK_history_27_toggle:{style:{}},
    MOCK_history_27_kb:{style:{},value:'1'},
    MOCK_history_27_kbwrap:{style:{}},
    MOCK_history_27_fill:{style:{},textContent:''},
    MOCK_history_27_download:{style:{}},
    MOCK_history_27_fym0:{style:{}},
    MOCK_history_27_fym1:{style:{}}
  };
  ctx.document={getElementById:id=>elements[id]||null};
  card.history.setCapacityKB(1);
  card.history.start(0,[Array(14).fill(0),Array(14).fill(0)]);
  for(let i=0;i<128;i++) card.history.recordWrite(0,0,i,i+1);
  ctx.__refresh[0].fn();
  assert.equal(elements.MOCK_history_27_fill.textContent,'50%');
  assert.equal(elements.MOCK_history_27_fill.style.display,'inline-block');
  assert.equal(elements.MOCK_history_27_kbwrap.style.display,'none');

  // Stopping through the card immediately returns the buffer-length input.
  card.toggleHistoryCapture();
  assert.equal(elements.MOCK_history_27_fill.style.display,'none');
  assert.equal(elements.MOCK_history_27_kbwrap.style.display,'inline-flex');
});

test('each FYM button emits exactly one AY file',()=>{
  const clicks=[], blobs=[];
  const ctx=load({
    pako:{deflate:bytes=>bytes},
    Blob:function(parts,options){ this.parts=parts; this.options=options; blobs.push(this); },
    setTimeout:fn=>fn(),
    window:{URL:{createObjectURL:blob=>'blob:'+blobs.indexOf(blob),revokeObjectURL(){}}}
  });
  ctx.document={
    getElementById:()=>null,
    body:{appendChild(){}},
    createElement:()=>({href:'',download:'',click(){ clicks.push(this.download); },remove(){}})
  };
  const card=ctx.oEMU.component.IO.mockingboard;
  card.history.start(0,[Array(14).fill(0),Array(14).fill(0)]);
  card.history.recordWrite(0,8,15,10);
  card.history.recordWrite(1,8,12,10);
  card.history.stop(20);
  assert.equal(card.downloadHistoryFYM(0),true);
  assert.deepEqual(clicks,['mockingboard-slotx-AY0.fym']);
  assert.equal(blobs.length,1);
  assert.equal(card.downloadHistoryFYM(1),true);
  assert.deepEqual(clicks,['mockingboard-slotx-AY0.fym','mockingboard-slotx-AY1.fym']);
  assert.equal(blobs.length,2);
  assert.equal(blobs[0].options.type,'application/octet-stream');
  assert.ok(blobs[0].parts[0] instanceof Uint8Array);
  assert.ok(blobs[1].parts[0] instanceof Uint8Array);
  assert.equal(card.downloadHistoryFYM(),false);
});
