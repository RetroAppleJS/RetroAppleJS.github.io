'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=process.cwd();
const input=path.join(root,'res','COM_LAYOUT_CONFIG.js');
const output=path.join(root,'tools','GUI_DEV','COM_LAYOUT_CONFIG.v2.js');
const source=fs.readFileSync(input,'utf8');
const sandbox={};
vm.runInNewContext(source+'\n;this.__composer=composer;',sandbox,{filename:input});
const v1=sandbox.__composer;

if(!v1 || v1.version!==1) throw new Error('Expected res/COM_LAYOUT_CONFIG.js to contain Composer version 1 data.');
if(!Array.isArray(v1.layers) || v1.layers.length!==14) throw new Error(`Expected 14 v1 layers, found ${v1.layers?.length}.`);

const mapping=new Map([
  ['A2P_Monitor.png@80,0',{id:'SYSTEM.MONITOR',slotN:0,labels:{ROLE:'MONITOR'}}],
  ['A2P_TAPE.png@80,520',{id:'SYSTEM.TAPE',slotN:0,labels:{ROLE:'TAPE'}}],
  ['A2P_DISKII_LED.png@545,684',{id:'DISKII.D2.LED',slotN:7,labels:{PCODE:'DISKII',DCODE:'D2',ROLE:'LED'}}],
  ['A2P_DISKII_LED.png@154,684',{id:'DISKII.D1.LED',slotN:7,labels:{PCODE:'DISKII',DCODE:'D1',ROLE:'LED'}}],
  ['A2P_DISKII_LID.png@591,576',{id:'DISKII.D2.LID',slotN:7,labels:{PCODE:'DISKII',DCODE:'D2',ROLE:'LID'}}],
  ['A2P_DISKII_LID.png@207,577',{id:'DISKII.D1.LID',slotN:7,labels:{PCODE:'DISKII',DCODE:'D1',ROLE:'LID'}}],
  ['A2P_DISKII_right.png@472,463',{id:'DISKII.D2.BODY',slotN:7,labels:{PCODE:'DISKII',DCODE:'D2',ROLE:'BODY'}}],
  ['A2P_DISKII_left.png@81,463',{id:'DISKII.D1.BODY',slotN:7,labels:{PCODE:'DISKII',DCODE:'D1',ROLE:'BODY'}}],
  ['A2P_DISKII_gap.png@446,486',{id:'DISKII.GAP',slotN:7,labels:{PCODE:'DISKII',ROLE:'GAP'}}],
  ['A2P_HD20.png@164,394',{id:'LIRON.HD20.1.BODY',slotN:6,labels:{PCODE:'LIRON',DCODE:'HD20',UNIT:'1',ROLE:'BODY'}}],
  ['A2P_UNIDISK_left.png@170,460',{id:'LIRON.UNIDISK.1.BODY',slotN:6,labels:{PCODE:'LIRON',DCODE:'UNIDISK',UNIT:'1',ROLE:'BODY'}}],
  ['A2P_UNIDISK_right.png@463,460',{id:'LIRON.UNIDISK.2.BODY',slotN:6,labels:{PCODE:'LIRON',DCODE:'UNIDISK',UNIT:'2',ROLE:'BODY'}}],
  ['A2P_HD20.png@164,501',{id:'LIRON.HD20.2.BODY',slotN:6,labels:{PCODE:'LIRON',DCODE:'HD20',UNIT:'2',ROLE:'BODY'}}],
  ['A2P_Body.png@5,489',{id:'SYSTEM.CHASSIS',slotN:0,labels:{ROLE:'CHASSIS'}}]
]);

const used=new Set();
const layers=v1.layers.map((layer,index)=>{
  const key=`${layer.file}@${layer.x},${layer.y}`;
  const meta=mapping.get(key);
  if(!meta) throw new Error(`No v2 metadata mapping for layer ${index+1}: ${key}`);
  used.add(key);
  return {
    id:meta.id,
    slotN:meta.slotN,
    labels:{...meta.labels},
    file:layer.file,
    x:layer.x,
    y:layer.y,
    visible:layer.visible,
    shadow:{...layer.shadow}
  };
});

for(const key of mapping.keys()) if(!used.has(key)) throw new Error(`Mapped v1 layer not found: ${key}`);
const addresses=layers.map(layer=>`A2P.${layer.slotN}.${layer.id}`);
if(new Set(addresses).size!==addresses.length) throw new Error('Converted v2 layout contains duplicate qualified runtime addresses.');

const v2={
  version:2,
  canvas:{...v1.canvas},
  layers,
  assets:{...(v1.assets||{})}
};

fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,'var composer =\n'+JSON.stringify(v2,null,2)+';\n');
console.log(`Wrote ${path.relative(root,output)} with ${layers.length} layers and ${Object.keys(v2.assets).length} assets.`);
