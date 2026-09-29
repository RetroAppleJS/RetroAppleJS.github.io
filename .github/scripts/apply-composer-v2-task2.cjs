'use strict';

const fs=require('node:fs');
const path=require('node:path');

const file=path.join(process.cwd(),'tools','GUI_DEV','apple2-system-composer.html');
let source=fs.readFileSync(file,'utf8');

if(source.includes('function suggestSemanticId(layer)') && source.includes('id="semanticIdInput"'))
{
    console.log('Composer Task 2 metadata editor already applied.');
    process.exit(0);
}

function replaceOnce(before,after,label)
{
    const first=source.indexOf(before);
    if(first<0) throw new Error(`Could not find ${label}`);
    if(source.indexOf(before,first+before.length)>=0) throw new Error(`Expected exactly one ${label}`);
    source=source.slice(0,first)+after+source.slice(first+before.length);
}

function replaceUntil(startMarker,endMarker,replacement,label)
{
    const start=source.indexOf(startMarker);
    if(start<0) throw new Error(`Could not find start of ${label}`);
    const end=source.indexOf(endMarker,start);
    if(end<0) throw new Error(`Could not find end of ${label}`);
    source=source.slice(0,start)+replacement+source.slice(end);
}

replaceOnce(
    '.empty{color:var(--muted);font-style:italic;padding:8px 2px}',
    '.empty{color:var(--muted);font-style:italic;padding:8px 2px}.metadata-section{margin:10px 0 14px;padding:10px;border:1px solid var(--line);border-radius:5px;background:#fffaf2}.metadata-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.metadata-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.id-mode{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}.runtime-address{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}.metadata-labels{display:flex;flex-direction:column;gap:5px;margin:7px 0}.metadata-row{display:grid;grid-template-columns:minmax(72px,.8fr) minmax(90px,1.2fr) auto;gap:5px;align-items:center}.metadata-row input{min-width:0;width:100%;padding:5px;border:1px solid var(--line);border-radius:4px;background:#fff}.metadata-row input[readonly]{background:#eeeae1;color:var(--muted)}.metadata-row .remove-label{padding:4px 7px}.metadata-actions{display:flex;gap:6px;margin-top:7px}.metadata-actions button{padding:5px 8px;font-size:12px}',
    'metadata CSS insertion point'
);

replaceUntil(
    '          <div id="selectedFilename" class="filename"></div>',
    '          <label class="check"><input id="visibleInput" type="checkbox"> Visible</label>',
`          <div id="selectedFilename" class="filename"></div>
          <section class="metadata-section">
            <div class="metadata-head"><div class="metadata-title">Layout metadata</div><span id="idModeBadge" class="id-mode">auto</span></div>
            <div class="field"><label for="semanticIdInput">Semantic ID</label><input id="semanticIdInput" type="text" placeholder="DISKII.D2.LED"></div>
            <div class="field-grid">
              <div class="field"><label for="slotNInput">SlotN</label><input id="slotNInput" type="number" min="0" max="8" step="1"></div>
              <div class="field"><label for="runtimeAddressInput">Runtime address</label><input id="runtimeAddressInput" class="runtime-address" type="text" readonly></div>
            </div>
            <div class="metadata-title" style="margin-top:9px">Labels</div>
            <div id="labelsEditor" class="metadata-labels"></div>
            <div class="metadata-actions">
              <button id="addLabelBtn" type="button">+ Add label</button>
              <button id="resetSuggestedIdBtn" type="button">Reset to suggested ID</button>
            </div>
          </section>
          <div class="field-grid">
            <div class="field"><label for="xInput">X</label><input id="xInput" type="number" step="1"></div>
            <div class="field"><label for="yInput">Y</label><input id="yInput" type="number" step="1"></div>
          </div>
`,
    'selected-layer metadata controls'
);

replaceOnce(
    'function layoutAddress(slotN,id){ return `A2P.${slotN}.${id}`; }',
`function layoutAddress(slotN,id){ return \`A2P.\${slotN}.\${id}\`; }
function canonicalSuggestionSegment(value){
  return String(value??'').trim().toUpperCase().replace(/[^A-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
}
function suggestSemanticId(layer){
  const labels=layer?.labels||{};
  const pcode=canonicalSuggestionSegment(labels.PCODE);
  const dcode=canonicalSuggestionSegment(labels.DCODE);
  const role=canonicalSuggestionSegment(labels.ROLE);
  const parts=[];
  if(pcode) parts.push(pcode); else if(layer?.slotN===0) parts.push('SYSTEM');
  if(dcode) parts.push(dcode);
  if(role) parts.push(role);
  return parts.join('.');
}
function syncSuggestedSemanticId(layer){
  if(!layer || layer.idMode==='custom') return layer?.id||'';
  const suggested=suggestSemanticId(layer);
  layer.idMode='auto';
  if(suggested) layer.id=suggested;
  return layer.id||'';
}
function setLayerSemanticId(layer,value){
  layer.id=validateSemanticId(value,0);
  layer.idMode='custom';
  return layer.id;
}
function setLayerLabel(layer,key,value){
  const normalized=String(key??'').trim().toUpperCase();
  if(!/^[A-Z][A-Z0-9_-]*$/.test(normalized)) throw new Error('Label key is invalid.');
  layer.labels=layer.labels||{};
  layer.labels[normalized]=String(value??'');
  syncSuggestedSemanticId(layer);
  return layer.labels[normalized];
}
function setLayerSlotN(layer,value){
  layer.slotN=validateSlotN(value,0);
  syncSuggestedSemanticId(layer);
  return layer.slotN;
}
function resetSemanticIdToSuggested(layer){
  layer.idMode='auto';
  const suggested=suggestSemanticId(layer);
  if(suggested) layer.id=suggested;
  return layer.id||'';
}
function runtimeAddressForLayer(layer){
  if(!layer || !Number.isInteger(layer.slotN) || !layer.id) return '';
  return layoutAddress(layer.slotN,layer.id);
}`,
    'layout address helper'
);

replaceOnce(
    'const l={uid:makeRuntimeId(),id:entry.id,slotN:entry.slotN,labels:{...(entry.labels||{})},file:entry.file,x:entry.x,y:entry.y,visible:entry.visible,shadow:{...(entry.shadow||DEFAULT_SHADOW)},image:null,width:0,height:0,resolved:false};',
    'const l={uid:makeRuntimeId(),id:entry.id,idMode:"custom",slotN:entry.slotN,labels:{...(entry.labels||{})},file:entry.file,x:entry.x,y:entry.y,visible:entry.visible,shadow:{...(entry.shadow||DEFAULT_SHADOW)},image:null,width:0,height:0,resolved:false};',
    'layerFromLayout authoring mode'
);

replaceOnce(
    'const l={uid:makeRuntimeId(),id:makeDefaultSemanticId(),slotN:0,labels:{},file:asset.file,x:Math.round((CANVAS_W-asset.width)/2),y:Math.round((CANVAS_H-asset.height)/2),visible:true,shadow:{...DEFAULT_SHADOW},image:asset.image,width:asset.width,height:asset.height,resolved:true};',
    'const l={uid:makeRuntimeId(),id:makeDefaultSemanticId(),idMode:"auto",slotN:0,labels:{},file:asset.file,x:Math.round((CANVAS_W-asset.width)/2),y:Math.round((CANVAS_H-asset.height)/2),visible:true,shadow:{...DEFAULT_SHADOW},image:asset.image,width:asset.width,height:asset.height,resolved:true};',
    'new-layer authoring mode'
);

replaceUntil(
    'function refreshUI(){',
    "canvas.addEventListener('pointerdown'",
`function addressInUse(layer,slotN,id){
  if(!id) return false;
  const address=layoutAddress(slotN,id);
  return state.layers.some(other=>other!==layer && runtimeAddressForLayer(other)===address);
}
function renderLabelsEditor(layer){
  const host=$('labelsEditor');host.textContent='';
  const primary=['PCODE','DCODE','ROLE'];
  const labels=layer.labels||{};
  const keys=[...primary,...Object.keys(labels).filter(key=>!primary.includes(key)).sort()];
  for(const key of keys){
    const row=document.createElement('div');row.className='metadata-row';
    const type=document.createElement('input');type.type='text';type.value=key;type.setAttribute('aria-label',\`Label type \${key}\`);
    const value=document.createElement('input');value.type='text';value.value=labels[key]??'';value.setAttribute('aria-label',\`Label value \${key}\`);
    if(primary.includes(key)) type.readOnly=true;
    else type.addEventListener('change',()=>commitCustomLabelType(key,type.value));
    value.addEventListener('change',()=>commitLabelValue(key,value.value));
    row.append(type,value);
    if(!primary.includes(key)){
      const remove=document.createElement('button');remove.type='button';remove.className='remove-label danger';remove.textContent='×';remove.title=\`Remove \${key}\`;
      remove.addEventListener('click',()=>removeCustomLabel(key));row.append(remove);
    }else{
      const spacer=document.createElement('span');row.append(spacer);
    }
    host.appendChild(row);
  }
}
function refreshUI(){
  const list=$('layerList');list.textContent='';
  if(!state.layers.length){const d=document.createElement('div');d.className='empty';d.textContent='No layers';list.appendChild(d);}
  state.layers.forEach(l=>{
    const address=runtimeAddressForLayer(l);
    const row=document.createElement('div');row.className='layer-row'+(l.uid===state.selectedLayerUid?' selected':'');row.dataset.uid=l.uid;row.title=address?\`\${address}\\n\${l.file}\`:l.file;
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=l.visible;cb.setAttribute('aria-label',\`Show \${l.file}\`);cb.addEventListener('click',e=>e.stopPropagation());cb.addEventListener('change',()=>{l.visible=cb.checked;refreshUI();renderPreview();});
    const name=document.createElement('span');name.className='layer-name';name.textContent=runtimeAddressForLayer(l)||l.file;
    const tag=document.createElement('span');tag.className='missing';tag.textContent=l.resolved?'':'MISSING';
    row.append(cb,name,tag);row.addEventListener('click',()=>selectLayer(l.uid));list.appendChild(row);
  });
  const s=getSelectedLayer(), controls=$('selectionControls'); $('noSelection').hidden=!!s;controls.hidden=!s;
  if(s){
    $('selectedFilename').textContent=s.file;$('semanticIdInput').value=s.id||'';$('slotNInput').value=s.slotN;$('runtimeAddressInput').value=runtimeAddressForLayer(s);$('idModeBadge').textContent=s.idMode==='custom'?'custom':'auto';$('xInput').value=s.x;$('yInput').value=s.y;$('visibleInput').checked=s.visible;
    renderLabelsEditor(s);
    $('shadowEnabledInput').checked=!!s.shadow.enabled;$('shadowOffsetXInput').value=s.shadow.offsetX;$('shadowOffsetYInput').value=s.shadow.offsetY;$('shadowBlurInput').value=s.shadow.blur;$('shadowOpacityInput').value=s.shadow.opacity;
    $('shadowSection').classList.toggle('disabled',!s.shadow.enabled);
    for(const id of ['shadowOffsetXInput','shadowOffsetYInput','shadowBlurInput','shadowOpacityInput'])$(id).disabled=!s.shadow.enabled;
    const i=state.layers.indexOf(s);$('forwardBtn').disabled=i<=0;$('backwardBtn').disabled=i<0||i>=state.layers.length-1;
  }
  const missing=state.layers.filter(l=>!l.resolved).length; $('statusBar').textContent=\`\${state.layers.length} layer\${state.layers.length===1?'':'s'} | \${s?\`Selected: \${runtimeAddressForLayer(s)||s.file} | \${s.file} | x=\${s.x} y=\${s.y}\`:'No layer selected'}\${missing?\` | \${missing} missing asset\${missing===1?'':'s'}\`:''}\`;
}

`,
    'refreshUI and metadata label renderer'
);

replaceUntil(
    'function commitNumber(input,key)',
    "$('visibleInput').addEventListener('change'",
`function commitNumber(input,key){const l=getSelectedLayer();if(!l)return;const n=Number(input.value);if(Number.isInteger(n)){l[key]=n;refreshUI();renderPreview();}}
$('xInput').addEventListener('change',()=>commitNumber($('xInput'),'x'));$('yInput').addEventListener('change',()=>commitNumber($('yInput'),'y'));
$('xInput').addEventListener('keydown',e=>{if(e.key==='Enter'){commitNumber($('xInput'),'x');e.target.blur();}});$('yInput').addEventListener('keydown',e=>{if(e.key==='Enter'){commitNumber($('yInput'),'y');e.target.blur();}});
function commitSemanticId(){
  const l=getSelectedLayer();if(!l)return;
  try{
    const id=validateSemanticId($('semanticIdInput').value,0);
    if(addressInUse(l,l.slotN,id)) throw new Error(\`Runtime address already used: \${layoutAddress(l.slotN,id)}\`);
    setLayerSemanticId(l,id);
  }catch(error){alert(error.message);}
  refreshUI();
}
function commitSlotN(){
  const l=getSelectedLayer();if(!l)return;
  try{
    const slotN=validateSlotN(Number($('slotNInput').value),0);
    const candidate={...l,slotN,labels:{...(l.labels||{})}};
    const candidateId=l.idMode==='custom'?l.id:(suggestSemanticId(candidate)||l.id);
    if(addressInUse(l,slotN,candidateId)) throw new Error(\`Runtime address already used: \${layoutAddress(slotN,candidateId)}\`);
    setLayerSlotN(l,slotN);
  }catch(error){alert(error.message);}
  refreshUI();
}
function commitLabelValue(key,value){
  const l=getSelectedLayer();if(!l)return;
  const labels={...(l.labels||{})};
  if(value==='') delete labels[key]; else labels[key]=value;
  const candidate={...l,labels};
  const candidateId=l.idMode==='custom'?l.id:(suggestSemanticId(candidate)||l.id);
  if(addressInUse(l,l.slotN,candidateId)){alert(\`Runtime address already used: \${layoutAddress(l.slotN,candidateId)}\`);refreshUI();return;}
  l.labels=labels;syncSuggestedSemanticId(l);refreshUI();
}
function commitCustomLabelType(oldKey,rawKey){
  const l=getSelectedLayer();if(!l)return;
  const key=String(rawKey||'').trim().toUpperCase();
  if(!/^[A-Z][A-Z0-9_-]*$/.test(key)){alert('Label key is invalid.');refreshUI();return;}
  if(key!==oldKey && Object.hasOwn(l.labels||{},key)){alert(\`Label key already used: \${key}\`);refreshUI();return;}
  const labels={...(l.labels||{})};const value=labels[oldKey]??'';delete labels[oldKey];labels[key]=value;l.labels=labels;syncSuggestedSemanticId(l);refreshUI();
}
function removeCustomLabel(key){const l=getSelectedLayer();if(!l)return;delete l.labels[key];syncSuggestedSemanticId(l);refreshUI();}
function addCustomLabel(){
  const l=getSelectedLayer();if(!l)return;l.labels=l.labels||{};
  let i=1,key='LABEL';while(Object.hasOwn(l.labels,key))key=\`LABEL\${++i}\`;l.labels[key]='';refreshUI();
}
function resetSelectedSemanticId(){
  const l=getSelectedLayer();if(!l)return;const suggested=suggestSemanticId(l);
  if(!suggested){alert('No semantic ID can be suggested from the current metadata.');return;}
  if(addressInUse(l,l.slotN,suggested)){alert(\`Runtime address already used: \${layoutAddress(l.slotN,suggested)}\`);return;}
  resetSemanticIdToSuggested(l);refreshUI();
}
$('semanticIdInput').addEventListener('change',commitSemanticId);$('semanticIdInput').addEventListener('keydown',e=>{if(e.key==='Enter'){commitSemanticId();e.target.blur();}});
$('slotNInput').addEventListener('change',commitSlotN);$('slotNInput').addEventListener('keydown',e=>{if(e.key==='Enter'){commitSlotN();e.target.blur();}});
$('addLabelBtn').addEventListener('click',addCustomLabel);$('resetSuggestedIdBtn').addEventListener('click',resetSelectedSemanticId);
`,
    'selected-layer metadata event handlers'
);

fs.writeFileSync(file,source);
console.log('Applied Composer v2 Task 2 metadata editor patch.');
