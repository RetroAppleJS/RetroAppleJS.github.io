'use strict';

const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(),'tools','GUI_DEV','apple2-system-composer.html');
let source = fs.readFileSync(file,'utf8');

function fail(message){ throw new Error(message); }
function replaceOnce(search,replacement,label)
{
    const next = source.replace(search,replacement);
    if(next===source) fail(`Could not apply ${label}`);
    source = next;
}

function functionRange(name)
{
    const marker = `function ${name}(`;
    const start = source.indexOf(marker);
    if(start<0) fail(`Missing function ${name}()`);
    const paramsStart = source.indexOf('(',start);
    let quote=null, escaped=false, depth=0, paramsEnd=-1;
    for(let i=paramsStart;i<source.length;i++)
    {
        const ch=source[i];
        if(quote)
        {
            if(escaped) escaped=false;
            else if(ch==='\\') escaped=true;
            else if(ch===quote) quote=null;
            continue;
        }
        if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
        if(ch==='(') depth++;
        else if(ch===')' && --depth===0){paramsEnd=i;break;}
    }
    if(paramsEnd<0) fail(`Unterminated params for ${name}()`);
    const bodyStart=source.indexOf('{',paramsEnd+1);
    if(bodyStart<0) fail(`Missing body for ${name}()`);
    quote=null;escaped=false;depth=0;
    for(let i=bodyStart;i<source.length;i++)
    {
        const ch=source[i];
        if(quote)
        {
            if(escaped) escaped=false;
            else if(ch==='\\') escaped=true;
            else if(ch===quote) quote=null;
            continue;
        }
        if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
        if(ch==='{') depth++;
        else if(ch==='}' && --depth===0) return [start,i+1];
    }
    fail(`Unterminated body for ${name}()`);
}

function replaceFunction(name,replacement)
{
    const [start,end]=functionRange(name);
    source=source.slice(0,start)+replacement+source.slice(end);
}

function removeFunction(name)
{
    const [start,end]=functionRange(name);
    let tail=end;
    while(source[tail]==='\r'||source[tail]==='\n') tail++;
    source=source.slice(0,start)+source.slice(tail);
}

replaceOnce(
`                <div class="field-grid">\n                  <div class="field"><label for="slotNInput">SlotN</label><input id="slotNInput" type="number" min="0" max="8" step="1"></div>\n                  <div class="field"><label for="runtimeAddressInput">Runtime address</label><input id="runtimeAddressInput" class="runtime-address" type="text" readonly></div>\n                </div>\n`,
'',
'SlotN/runtime-address controls removal'
);
replaceOnce('<div class="metadata-title">Layout metadata</div>','<div class="metadata-title">Element identity</div>','metadata title');
replaceOnce('.runtime-address{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}','', 'runtime-address CSS removal');
replaceOnce('const CANVAS_W=1144, CANVAS_H=1144, LAYOUT_VERSION=2;','const CANVAS_W=1144, CANVAS_H=1144, LAYOUT_VERSION=3;','layout version');
replaceOnce('const state={layers:[],selectedLayerUid:null,assets:new Map(),dragging:null};','const state={layers:[],configurations:[],selectedLayerUid:null,assets:new Map(),dragging:null};','v3 state');

removeFunction('validateSlotN');
replaceFunction('validateLabels',`function validateLabels(raw,index){
  if(raw==null) return {};
  if(typeof raw!=='object' || Array.isArray(raw)) throw new Error(\`Layer \${index+1} labels must be an object.\`);
  const labels={};
  const seen=new Set();
  for(const [rawKey,value] of Object.entries(raw)){
    const key=String(rawKey).trim().toUpperCase();
    if(!key) throw new Error(\`Layer \${index+1} label keys must be non-empty.\`);
    if(!/^[A-Z][A-Z0-9_-]*$/.test(key)) throw new Error(\`Layer \${index+1} label key \${rawKey} is invalid.\`);
    if(key==='UNIT') throw new Error(\`Layer \${index+1} label UNIT is runtime topology metadata and is not part of Composer v3.\`);
    if(seen.has(key)) throw new Error(\`Layer \${index+1} has duplicate label key \${key}.\`);
    if(typeof value!=='string') throw new Error(\`Layer \${index+1} label \${key} must have a string value.\`);
    seen.add(key);
    labels[key]=value;
  }
  return labels;
}`);
removeFunction('layoutAddress');
replaceFunction('suggestSemanticId',`function suggestSemanticId(layer){
  const labels=layer?.labels||{};
  const pcode=canonicalSuggestionSegment(labels.PCODE);
  const dcode=canonicalSuggestionSegment(labels.DCODE);
  const role=canonicalSuggestionSegment(labels.ROLE);
  const parts=[];
  if(pcode) parts.push(pcode); else if(dcode||role) parts.push('SYSTEM');
  if(dcode) parts.push(dcode);
  if(role) parts.push(role);
  return parts.join('.');
}`);
removeFunction('setLayerSlotN');
removeFunction('runtimeAddressForLayer');

const validateLayoutStart = functionRange('validateLayout')[0];
const normalizeCode = `function normalizeComposerDocument(raw){
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('Layout must be a JSON object.');
  if(raw.version!==2 && raw.version!==3) throw new Error(\`Unsupported layout version \${raw.version}; Composer accepts versions 2 and 3.\`);
  if(raw.version===3) return {...raw,configurations:raw.configurations??[]};
  const layers=Array.isArray(raw.layers)?raw.layers.map(layer=>{
    if(!layer || typeof layer!=='object' || Array.isArray(layer)) return layer;
    const labels={};
    if(layer.labels && typeof layer.labels==='object' && !Array.isArray(layer.labels)){
      for(const [key,value] of Object.entries(layer.labels)) if(String(key).trim().toUpperCase()!=='UNIT') labels[key]=value;
    }
    const {slotN,...rest}=layer;
    return {...rest,labels};
  }):raw.layers;
  return {version:3,canvas:raw.canvas,assets:raw.assets,layers,configurations:[]};
}

`;
source = source.slice(0,validateLayoutStart)+normalizeCode+source.slice(validateLayoutStart);
replaceFunction('validateLayout',`function validateLayout(raw){
  const doc=normalizeComposerDocument(raw);
  if(!doc.canvas || doc.canvas.width!==CANVAS_W || doc.canvas.height!==CANVAS_H) throw new Error('Canvas must be exactly 1144 × 1144.');
  if(!Array.isArray(doc.layers)) throw new Error('Layout layers must be an array.');
  if(!Array.isArray(doc.configurations)) throw new Error('Layout configurations must be an array.');
  const assets=validateAssets(doc.assets);
  const seenIds=new Set();
  const layers=doc.layers.map((l,i)=>{
    if(!l || typeof l!=='object' || Array.isArray(l)) throw new Error(\`Layer \${i+1} is malformed.\`);
    if(typeof l.file!=='string' || !l.file.trim()) throw new Error(\`Layer \${i+1} filename must be non-empty.\`);
    if(!Number.isInteger(l.x) || !Number.isInteger(l.y)) throw new Error(\`Layer \${i+1} X/Y coordinates must be integer pixels.\`);
    if(typeof l.visible!=='boolean') throw new Error(\`Layer \${i+1} visibility must be boolean.\`);
    const id=validateSemanticId(l.id,i);
    if(seenIds.has(id)) throw new Error(\`Duplicate Composer semantic id: \${id}\`);
    seenIds.add(id);
    const labels=validateLabels(l.labels,i);
    return {id,labels,file:l.file,x:l.x,y:l.y,visible:l.visible,shadow:validateShadow(l.shadow,i)};
  });
  const configurations=doc.configurations.map(c=>{
    if(!c || typeof c!=='object' || Array.isArray(c)) return c;
    return {...c,visible:Array.isArray(c.visible)?[...c.visible]:c.visible};
  });
  return {version:LAYOUT_VERSION,canvas:{width:CANVAS_W,height:CANVAS_H},assets,layers,configurations};
}`);

replaceFunction('layerFromLayout',`function layerFromLayout(entry){
  const l={uid:makeRuntimeId(),id:entry.id,idMode:"custom",labels:{...(entry.labels||{})},file:entry.file,x:entry.x,y:entry.y,visible:entry.visible,shadow:{...(entry.shadow||DEFAULT_SHADOW)},image:null,width:0,height:0,resolved:false};
  const a=findCachedAsset(entry.file); if(a) attachAsset(l,a); return l;
}`);
replaceFunction('applyLayout',`function applyLayout(layout){
  const next=layout.layers.map(layerFromLayout);
  state.layers=next; state.configurations=(layout.configurations||[]).map(c=>({...c,visible:Array.isArray(c.visible)?[...c.visible]:c.visible})); state.selectedLayerUid=next[0]?.uid||null; state.dragging=null; refreshUI();renderPreview();
}`);
replaceFunction('serializeLayer',`function serializeLayer({id,labels,file,x,y,visible,shadow}){
  const cleanLabels={};
  for(const [key,value] of Object.entries(labels||{})) if(String(key).trim().toUpperCase()!=='UNIT') cleanLabels[key]=value;
  return {id,labels:cleanLabels,file,x,y,visible,shadow:{...shadow}};
}`);
replaceFunction('serializeLayout',`function serializeLayout(){return {version:LAYOUT_VERSION,canvas:{width:CANVAS_W,height:CANVAS_H},layers:state.layers.map(serializeLayer),configurations:(state.configurations||[]).map(c=>({...c,visible:Array.isArray(c.visible)?[...c.visible]:c.visible}))};}`);
replaceFunction('addLayerFromAsset',`function addLayerFromAsset(asset){
  const l={uid:makeRuntimeId(),id:makeDefaultSemanticId(),idMode:"auto",labels:{},file:asset.file,x:Math.round((CANVAS_W-asset.width)/2),y:Math.round((CANVAS_H-asset.height)/2),visible:true,shadow:{...DEFAULT_SHADOW},image:asset.image,width:asset.width,height:asset.height,resolved:true};
  state.layers.unshift(l); state.selectedLayerUid=l.uid; return l;
}`);
replaceFunction('addressInUse',`function semanticIdInUse(layer,id){
  if(!id) return false;
  return state.layers.some(other=>other!==layer && other.id===id);
}`);

replaceFunction('refreshUI',`function refreshUI(){
  const list=$('layerList');list.textContent='';
  if(!state.layers.length){const d=document.createElement('div');d.className='empty';d.textContent='No layers';list.appendChild(d);}
  state.layers.forEach(l=>{
    const row=document.createElement('div');row.className='layer-row'+(l.uid===state.selectedLayerUid?' selected':'');row.dataset.uid=l.uid;row.title=l.id?\`\${l.id}\\n\${l.file}\`:l.file;
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=l.visible;cb.setAttribute('aria-label',\`Show \${l.file}\`);cb.addEventListener('click',e=>e.stopPropagation());cb.addEventListener('change',()=>{l.visible=cb.checked;refreshUI();renderPreview();});
    const name=document.createElement('span');name.className='layer-name';name.textContent=l.id||l.file;
    const tag=document.createElement('span');tag.className='missing';tag.textContent=l.resolved?'':'MISSING';
    row.append(cb,name,tag);row.addEventListener('click',()=>selectLayer(l.uid));list.appendChild(row);
  });
  const s=getSelectedLayer(), controls=$('selectionControls'); $('noSelection').hidden=!!s;controls.hidden=!s;
  if(s){
    $('selectedFilename').textContent=s.file;$('semanticIdInput').value=s.id||'';$('idModeBadge').textContent=s.idMode==='custom'?'custom':'auto';$('xInput').value=s.x;$('yInput').value=s.y;$('visibleInput').checked=s.visible;
    renderLabelsEditor(s);
    $('shadowEnabledInput').checked=!!s.shadow.enabled;$('shadowOffsetXInput').value=s.shadow.offsetX;$('shadowOffsetYInput').value=s.shadow.offsetY;$('shadowBlurInput').value=s.shadow.blur;$('shadowOpacityInput').value=s.shadow.opacity;
    $('shadowSection').classList.toggle('disabled',!s.shadow.enabled);
    for(const id of ['shadowOffsetXInput','shadowOffsetYInput','shadowBlurInput','shadowOpacityInput'])$(id).disabled=!s.shadow.enabled;
    const i=state.layers.indexOf(s);$('forwardBtn').disabled=i<=0;$('backwardBtn').disabled=i<0||i>=state.layers.length-1;
  }
  const missing=state.layers.filter(l=>!l.resolved).length; $('statusBar').textContent=\`\${state.layers.length} layer\${state.layers.length===1?'':'s'} | \${s?\`Selected: \${s.id||s.file} | \${s.file} | x=\${s.x} y=\${s.y}\`:'No layer selected'}\${missing?\` | \${missing} missing asset\${missing===1?'':'s'}\`:''}\`;
}`);

replaceFunction('commitSemanticId',`function commitSemanticId(){
  const l=getSelectedLayer();if(!l)return;
  try{
    const id=validateSemanticId($('semanticIdInput').value,0);
    if(semanticIdInUse(l,id)) throw new Error(\`Semantic ID already used: \${id}\`);
    setLayerSemanticId(l,id);
  }catch(error){alert(error.message);}
  refreshUI();
}`);
removeFunction('commitSlotN');
replaceFunction('commitLabelValue',`function commitLabelValue(key,value){
  const l=getSelectedLayer();if(!l)return;
  if(String(key).trim().toUpperCase()==='UNIT'){alert('UNIT is runtime topology metadata and is not part of Composer v3.');refreshUI();return;}
  const labels={...(l.labels||{})};
  if(value==='') delete labels[key]; else labels[key]=value;
  const candidate={...l,labels};
  const candidateId=l.idMode==='custom'?l.id:(suggestSemanticId(candidate)||l.id);
  if(semanticIdInUse(l,candidateId)){alert(\`Semantic ID already used: \${candidateId}\`);refreshUI();return;}
  l.labels=labels;syncSuggestedSemanticId(l);refreshUI();
}`);
replaceFunction('commitCustomLabelType',`function commitCustomLabelType(oldKey,rawKey){
  const l=getSelectedLayer();if(!l)return;
  const key=String(rawKey||'').trim().toUpperCase();
  if(!/^[A-Z][A-Z0-9_-]*$/.test(key)){alert('Label key is invalid.');refreshUI();return;}
  if(key==='UNIT'){alert('UNIT is runtime topology metadata and is not part of Composer v3.');refreshUI();return;}
  if(key!==oldKey && Object.hasOwn(l.labels||{},key)){alert(\`Label key already used: \${key}\`);refreshUI();return;}
  const labels={...(l.labels||{})};const value=labels[oldKey]??'';delete labels[oldKey];labels[key]=value;
  const candidate={...l,labels};const candidateId=l.idMode==='custom'?l.id:(suggestSemanticId(candidate)||l.id);
  if(semanticIdInUse(l,candidateId)){alert(\`Semantic ID already used: \${candidateId}\`);refreshUI();return;}
  l.labels=labels;syncSuggestedSemanticId(l);refreshUI();
}`);
replaceFunction('resetSelectedSemanticId',`function resetSelectedSemanticId(){
  const l=getSelectedLayer();if(!l)return;const suggested=suggestSemanticId(l);
  if(!suggested){alert('No semantic ID can be suggested from the current metadata.');return;}
  if(semanticIdInUse(l,suggested)){alert(\`Semantic ID already used: \${suggested}\`);return;}
  resetSemanticIdToSuggested(l);refreshUI();
}`);

replaceOnce(/\$\('slotNInput'\)\.addEventListener\('change',commitSlotN\);\$\('slotNInput'\)\.addEventListener\('keydown',[^\n]+\n/,'','SlotN event handlers');

fs.writeFileSync(file,source);
console.log(`Patched ${file} for Composer v3 Task 1`);
