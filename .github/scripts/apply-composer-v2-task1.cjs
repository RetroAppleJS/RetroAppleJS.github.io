'use strict';

const fs=require('node:fs');
const path=require('node:path');

const file=path.join(process.cwd(),'tools','GUI_DEV','apple2-system-composer.html');
let source=fs.readFileSync(file,'utf8');

if(/LAYOUT_VERSION\s*=\s*2\s*;/.test(source))
{
    console.log('Composer Task 1 v2 schema already applied.');
    process.exit(0);
}

function replaceOnce(before,after,label)
{
    const first=source.indexOf(before);
    if(first<0) throw new Error(`Could not find ${label}`);
    if(source.indexOf(before,first+before.length)>=0) throw new Error(`Expected exactly one ${label}`);
    source=source.slice(0,first)+after+source.slice(first+before.length);
}

replaceOnce(
    'const CANVAS_W=1144, CANVAS_H=1144, LAYOUT_VERSION=1;',
    'const CANVAS_W=1144, CANVAS_H=1144, LAYOUT_VERSION=2;',
    'layout version declaration'
);

replaceOnce(
    'let runtimeCounter=1;',
    'let runtimeCounter=1, semanticCounter=1;',
    'runtime counter declaration'
);

replaceOnce(
    'function makeRuntimeId(){ return `layer-${Date.now().toString(36)}-${runtimeCounter++}`; }',
    'function makeRuntimeId(){ return `layer-${Date.now().toString(36)}-${runtimeCounter++}`; }\nfunction makeDefaultSemanticId(){ return `SYSTEM.LAYER${semanticCounter++}`; }',
    'runtime id helper'
);

replaceOnce(
`function validateLayerId(raw,index){
  if(raw==null || raw==='') return null;
  if(typeof raw!=='string' || !raw.trim()) throw new Error(\`Layer \${index+1} id must be a non-empty string when supplied.\`);
  return raw.trim();
}`,
`function validateSemanticId(raw,index){
  if(typeof raw!=='string' || !raw.trim()) throw new Error(\`Layer \${index+1} id must be a non-empty semantic identifier.\`);
  const id=raw.trim();
  if(!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error(\`Layer \${index+1} id may contain only letters, digits, '.', '_' and '-'.\`);
  return id;
}

function validateSlotN(raw,index){
  if(!Number.isInteger(raw) || raw<0 || raw>8) throw new Error(\`Layer \${index+1} slotN must be an integer from 0 through 8.\`);
  return raw;
}

function validateLabels(raw,index){
  if(raw==null) return {};
  if(typeof raw!=='object' || Array.isArray(raw)) throw new Error(\`Layer \${index+1} labels must be an object.\`);
  const labels={};
  const seen=new Set();
  for(const [rawKey,value] of Object.entries(raw)){
    const key=String(rawKey).trim().toUpperCase();
    if(!key) throw new Error(\`Layer \${index+1} label keys must be non-empty.\`);
    if(!/^[A-Z][A-Z0-9_-]*$/.test(key)) throw new Error(\`Layer \${index+1} label key \${rawKey} is invalid.\`);
    if(seen.has(key)) throw new Error(\`Layer \${index+1} has duplicate label key \${key}.\`);
    if(typeof value!=='string') throw new Error(\`Layer \${index+1} label \${key} must have a string value.\`);
    seen.add(key);
    labels[key]=value;
  }
  return labels;
}

function layoutAddress(slotN,id){ return \`A2P.\${slotN}.\${id}\`; }`,
    'v1 layer id validator'
);

replaceOnce(
`  const assets=validateAssets(raw.assets);
  const seenIds=new Set();
  const layers=raw.layers.map((l,i)=>{
    if(!l || typeof l!=='object') throw new Error(\`Layer \${i+1} is malformed.\`);
    if(typeof l.file!=='string' || !l.file.trim()) throw new Error(\`Layer \${i+1} filename must be non-empty.\`);
    if(!Number.isInteger(l.x) || !Number.isInteger(l.y)) throw new Error(\`Layer \${i+1} X/Y coordinates must be integer pixels.\`);
    if(typeof l.visible!=='boolean') throw new Error(\`Layer \${i+1} visibility must be boolean.\`);
    const id=validateLayerId(l.id,i);
    if(id&&seenIds.has(id)) throw new Error(\`Duplicate layout layer id: \${id}\`);
    if(id) seenIds.add(id);
    return {id,file:l.file,x:l.x,y:l.y,visible:l.visible,shadow:validateShadow(l.shadow,i)};
  });`,
`  const assets=validateAssets(raw.assets);
  const seenAddresses=new Set();
  const layers=raw.layers.map((l,i)=>{
    if(!l || typeof l!=='object') throw new Error(\`Layer \${i+1} is malformed.\`);
    if(typeof l.file!=='string' || !l.file.trim()) throw new Error(\`Layer \${i+1} filename must be non-empty.\`);
    if(!Number.isInteger(l.x) || !Number.isInteger(l.y)) throw new Error(\`Layer \${i+1} X/Y coordinates must be integer pixels.\`);
    if(typeof l.visible!=='boolean') throw new Error(\`Layer \${i+1} visibility must be boolean.\`);
    const id=validateSemanticId(l.id,i);
    const slotN=validateSlotN(l.slotN,i);
    const labels=validateLabels(l.labels,i);
    const address=layoutAddress(slotN,id);
    if(seenAddresses.has(address)) throw new Error(\`Duplicate layout runtime address: \${address}\`);
    seenAddresses.add(address);
    return {id,slotN,labels,file:l.file,x:l.x,y:l.y,visible:l.visible,shadow:validateShadow(l.shadow,i)};
  });`,
    'layout layer validation block'
);

replaceOnce(
`function layerFromLayout(entry){
  const l={uid:makeRuntimeId(),id:entry.id??null,file:entry.file,x:entry.x,y:entry.y,visible:entry.visible,shadow:{...(entry.shadow||DEFAULT_SHADOW)},image:null,width:0,height:0,resolved:false};
  const a=findCachedAsset(entry.file); if(a) attachAsset(l,a); return l;
}`,
`function layerFromLayout(entry){
  const l={uid:makeRuntimeId(),id:entry.id,slotN:entry.slotN,labels:{...(entry.labels||{})},file:entry.file,x:entry.x,y:entry.y,visible:entry.visible,shadow:{...(entry.shadow||DEFAULT_SHADOW)},image:null,width:0,height:0,resolved:false};
  const a=findCachedAsset(entry.file); if(a) attachAsset(l,a); return l;
}`,
    'layerFromLayout'
);

replaceOnce(
    'function serializeLayer({id,file,x,y,visible,shadow}){const out={file,x,y,visible,shadow:{...shadow}};if(id)out.id=id;return out;}',
    'function serializeLayer({id,slotN,labels,file,x,y,visible,shadow}){return {id,slotN,labels:{...(labels||{})},file,x,y,visible,shadow:{...shadow}};}',
    'serializeLayer'
);

replaceOnce(
`function addLayerFromAsset(asset){
  const l={uid:makeRuntimeId(),id:null,file:asset.file,x:Math.round((CANVAS_W-asset.width)/2),y:Math.round((CANVAS_H-asset.height)/2),visible:true,shadow:{...DEFAULT_SHADOW},image:asset.image,width:asset.width,height:asset.height,resolved:true};
  state.layers.unshift(l); state.selectedLayerUid=l.uid; return l;
}`,
`function addLayerFromAsset(asset){
  const l={uid:makeRuntimeId(),id:makeDefaultSemanticId(),slotN:0,labels:{},file:asset.file,x:Math.round((CANVAS_W-asset.width)/2),y:Math.round((CANVAS_H-asset.height)/2),visible:true,shadow:{...DEFAULT_SHADOW},image:asset.image,width:asset.width,height:asset.height,resolved:true};
  state.layers.unshift(l); state.selectedLayerUid=l.uid; return l;
}`,
    'addLayerFromAsset'
);

fs.writeFileSync(file,source);
console.log('Applied Composer v2 Task 1 schema/model patch.');
