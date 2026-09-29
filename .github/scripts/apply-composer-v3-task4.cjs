'use strict';
const fs=require('node:fs');
const path=require('node:path');
const file=path.resolve(__dirname,'../../tools/GUI_DEV/apple2-system-composer.html');
let html=fs.readFileSync(file,'utf8');

function replaceOnce(oldText,newText,label){
  const first=html.indexOf(oldText);
  if(first<0) throw new Error('Could not find '+label);
  if(html.indexOf(oldText,first+oldText.length)>=0) throw new Error('Expected one '+label);
  html=html.slice(0,first)+newText+html.slice(first+oldText.length);
}
function functionRange(name){
  const marker='function '+name+'(';
  const start=html.indexOf(marker);
  if(start<0) throw new Error('Could not find '+name+'()');
  const paramsStart=html.indexOf('(',start);
  let paramsEnd=-1,parenDepth=0,quote=null,escaped=false;
  for(let i=paramsStart;i<html.length;i++){
    const ch=html[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote=null;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='(')parenDepth++;
    else if(ch===')'){parenDepth--;if(parenDepth===0){paramsEnd=i;break;}}
  }
  if(paramsEnd<0) throw new Error('Incomplete parameter list for '+name+'()');
  const bodyStart=html.indexOf('{',paramsEnd+1);
  let depth=0;quote=null;escaped=false;
  for(let i=bodyStart;i<html.length;i++){
    const ch=html[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote=null;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}') {depth--;if(depth===0)return [start,i+1];}
  }
  throw new Error('Incomplete body for '+name+'()');
}
function replaceFunction(name,newText){const [start,end]=functionRange(name);html=html.slice(0,start)+newText+html.slice(end);}

replaceOnce(
  "const DEFAULT_SHADOW=Object.freeze({enabled:false,offsetX:0,offsetY:15,blur:12,opacity:0.75});\nconst state={layers:[],configurations:[],activeConfigurationId:null,selectedLayerUid:null,assets:new Map(),dragging:null};",
  "const DEFAULT_SHADOW=Object.freeze({enabled:false,offsetX:0,offsetY:15,blur:12,opacity:0.75});\nconst HISTORY_LIMIT=100;\nconst state={layers:[],configurations:[],activeConfigurationId:null,selectedLayerUid:null,assets:new Map(),dragging:null,history:{undo:[],redo:[]}};",
  'history state');

replaceOnce(
  "function attachAsset(layer,asset){ layer.image=asset.image;layer.width=asset.width;layer.height=asset.height;layer.resolved=true; }",
  `function attachAsset(layer,asset){ layer.image=asset.image;layer.width=asset.width;layer.height=asset.height;layer.resolved=true; }\nfunction captureHistorySnapshot(){\n  return {\n    layers:state.layers.map(layer=>({uid:layer.uid,id:layer.id,idMode:layer.idMode==='auto'?'auto':'custom',labels:{...(layer.labels||{})},file:layer.file,x:layer.x,y:layer.y,visible:!!layer.visible,shadow:{...(layer.shadow||{})}})),\n    configurations:(state.configurations||[]).map(config=>({...config,visible:[...(config.visible||[])]})),\n    selectedLayerUid:state.selectedLayerUid||null,\n    activeConfigurationId:state.activeConfigurationId||null\n  };\n}\nfunction historySnapshotsEqual(a,b){return JSON.stringify(a)===JSON.stringify(b);}\nfunction updateHistoryButtons(){\n  $('undoBtn').disabled=state.history.undo.length===0;\n  $('redoBtn').disabled=state.history.redo.length===0;\n}\nfunction restoreHistorySnapshot(snapshot){\n  const next=(snapshot.layers||[]).map(entry=>{\n    const layer={uid:entry.uid||makeRuntimeId(),id:entry.id,idMode:entry.idMode==='auto'?'auto':'custom',labels:{...(entry.labels||{})},file:entry.file,x:entry.x,y:entry.y,visible:!!entry.visible,shadow:{...(entry.shadow||{})},image:null,width:0,height:0,resolved:false};\n    const asset=findCachedAsset(entry.file);if(asset)attachAsset(layer,asset);return layer;\n  });\n  state.layers=next;\n  state.configurations=(snapshot.configurations||[]).map(config=>({...config,visible:[...(config.visible||[])]}));\n  state.activeConfigurationId=snapshot.activeConfigurationId&&state.configurations.some(config=>config.id===snapshot.activeConfigurationId)?snapshot.activeConfigurationId:null;\n  state.selectedLayerUid=snapshot.selectedLayerUid&&next.some(layer=>layer.uid===snapshot.selectedLayerUid)?snapshot.selectedLayerUid:(next[0]?.uid||null);\n  state.dragging=null;\n  refreshUI();renderPreview();\n}\nfunction commitHistory(snapshot){\n  if(!snapshot)return false;\n  const current=captureHistorySnapshot();\n  if(historySnapshotsEqual(snapshot,current)){updateHistoryButtons();return false;}\n  state.history.undo.push(snapshot);\n  if(state.history.undo.length>HISTORY_LIMIT)state.history.undo.splice(0,state.history.undo.length-HISTORY_LIMIT);\n  state.history.redo.length=0;\n  updateHistoryButtons();return true;\n}\nfunction resetHistory(){state.history.undo.length=0;state.history.redo.length=0;updateHistoryButtons();}\nfunction undo(){\n  if(!state.history.undo.length){updateHistoryButtons();return false;}\n  const current=captureHistorySnapshot(),previous=state.history.undo.pop();\n  state.history.redo.push(current);if(state.history.redo.length>HISTORY_LIMIT)state.history.redo.shift();\n  restoreHistorySnapshot(previous);updateHistoryButtons();return true;\n}\nfunction redo(){\n  if(!state.history.redo.length){updateHistoryButtons();return false;}\n  const current=captureHistorySnapshot(),next=state.history.redo.pop();\n  state.history.undo.push(current);if(state.history.undo.length>HISTORY_LIMIT)state.history.undo.shift();\n  restoreHistorySnapshot(next);updateHistoryButtons();return true;\n}\nfunction commitAuthoringMutation(mutator){const before=captureHistorySnapshot();const result=mutator();commitHistory(before);return result;}`,
  'history helpers');

replaceFunction('applyLayout',`function applyLayout(layout){\n  const next=layout.layers.map(layerFromLayout);\n  state.layers=next;state.configurations=(layout.configurations||[]).map(c=>({...c,visible:[...c.visible]}));state.activeConfigurationId=null;state.selectedLayerUid=next[0]?.uid||null;state.dragging=null;resetHistory();refreshUI();renderPreview();\n}`);

replaceFunction('importImageFiles',`async function importImageFiles(files){\n  const before=captureHistorySnapshot();\n  const errors=[];\n  for(const file of Array.from(files)){\n    try{\n      const asset=await loadImageFile(file);\n      const old=state.assets.get(asset.file);if(old?.objectUrl)URL.revokeObjectURL(old.objectUrl);\n      state.assets.set(asset.file,asset);\n      const resolved=resolveLayersForAsset(asset);if(!resolved)addLayerFromAsset(asset);\n    }catch(e){errors.push(e.message);}\n  }\n  commitHistory(before);refreshUI();renderPreview();if(errors.length)alert(errors.join('\\n'));imageInput.value='';\n}`);

replaceFunction('removeSelectedLayer',`function removeSelectedLayer(){\n  const idx=state.layers.findIndex(layer=>layer.uid===state.selectedLayerUid);if(idx<0)return;\n  commitAuthoringMutation(()=>{\n    const removed=state.layers[idx];state.layers.splice(idx,1);\n    for(const config of state.configurations)config.visible=config.visible.filter(id=>id!==removed.id);\n    const next=state.layers[Math.min(idx,state.layers.length-1)]||null;state.selectedLayerUid=next?.uid||null;\n  });\n  refreshUI();renderPreview();\n}`);
replaceFunction('moveSelected',`function moveSelected(dx,dy){const layer=getSelectedLayer();if(!layer||(!dx&&!dy))return;commitAuthoringMutation(()=>{layer.x+=dx;layer.y+=dy;});refreshUI();renderPreview();}`);
replaceFunction('bringForward',`function bringForward(){const i=state.layers.findIndex(layer=>layer.uid===state.selectedLayerUid);if(i>0){commitAuthoringMutation(()=>{[state.layers[i-1],state.layers[i]]=[state.layers[i],state.layers[i-1]];});refreshUI();renderPreview();}}`);
replaceFunction('sendBackward',`function sendBackward(){const i=state.layers.findIndex(layer=>layer.uid===state.selectedLayerUid);if(i>=0&&i<state.layers.length-1){commitAuthoringMutation(()=>{[state.layers[i],state.layers[i+1]]=[state.layers[i+1],state.layers[i]];});refreshUI();renderPreview();}}`);

replaceOnce(
  "canvas.addEventListener('pointerdown',e=>{const p=canvasPoint(e),l=hitTest(p.x,p.y);if(!l){state.selectedLayerUid=null;refreshUI();renderPreview();return;}selectLayer(l.uid);state.dragging={uid:l.uid,dx:p.x-l.x,dy:p.y-l.y,pointerId:e.pointerId};canvas.setPointerCapture?.(e.pointerId);e.preventDefault();});",
  "canvas.addEventListener('pointerdown',e=>{const p=canvasPoint(e),l=hitTest(p.x,p.y);if(!l){state.selectedLayerUid=null;refreshUI();renderPreview();return;}selectLayer(l.uid);state.dragging={uid:l.uid,dx:p.x-l.x,dy:p.y-l.y,pointerId:e.pointerId,startX:l.x,startY:l.y,historySnapshot:captureHistorySnapshot()};canvas.setPointerCapture?.(e.pointerId);e.preventDefault();});",
  'drag pointerdown');
replaceFunction('endDrag',`function endDrag(e){\n  const drag=state.dragging;if(!drag||(e&&drag.pointerId!==e.pointerId))return;\n  state.dragging=null;const layer=state.layers.find(item=>item.uid===drag.uid);\n  if(layer&&(layer.x!==drag.startX||layer.y!==drag.startY))commitHistory(drag.historySnapshot);\n}`);

replaceFunction('commitNumber',`function commitNumber(input,key){const layer=getSelectedLayer();if(!layer)return;const n=Number(input.value);if(Number.isInteger(n)&&layer[key]!==n){commitAuthoringMutation(()=>{layer[key]=n;});refreshUI();renderPreview();}else refreshUI();}`);
replaceFunction('commitSemanticId',`function commitSemanticId(){\n  const layer=getSelectedLayer();if(!layer)return;\n  try{const id=validateSemanticId($('semanticIdInput').value,0);commitAuthoringMutation(()=>renameLayerSemanticId(layer,id));}\n  catch(error){alert(error.message);}\n  refreshUI();renderPreview();\n}`);
replaceFunction('commitLabelValue',`function commitLabelValue(key,value){\n  const layer=getSelectedLayer();if(!layer)return;\n  if(String(key).trim().toUpperCase()==='UNIT'){alert('UNIT is runtime topology metadata and is not part of Composer v3.');refreshUI();return;}\n  const labels={...(layer.labels||{})};if(value==='')delete labels[key];else labels[key]=value;\n  const candidate={...layer,labels};const candidateId=layer.idMode==='custom'?layer.id:(suggestSemanticId(candidate)||layer.id);\n  if(semanticIdInUse(layer,candidateId)){alert('Semantic ID already used: '+candidateId);refreshUI();return;}\n  commitAuthoringMutation(()=>{const oldId=layer.id;layer.labels=labels;syncSuggestedSemanticId(layer);replaceSemanticIdInConfigurations(oldId,layer.id);});\n  refreshUI();renderPreview();\n}`);
replaceFunction('commitCustomLabelType',`function commitCustomLabelType(oldKey,rawKey){\n  const layer=getSelectedLayer();if(!layer)return;const key=String(rawKey||'').trim().toUpperCase();\n  if(!/^[A-Z][A-Z0-9_-]*$/.test(key)){alert('Label key is invalid.');refreshUI();return;}\n  if(key==='UNIT'){alert('UNIT is runtime topology metadata and is not part of Composer v3.');refreshUI();return;}\n  if(key!==oldKey&&Object.hasOwn(layer.labels||{},key)){alert('Label key already used: '+key);refreshUI();return;}\n  const labels={...(layer.labels||{})};const value=labels[oldKey]??'';delete labels[oldKey];labels[key]=value;\n  const candidate={...layer,labels};const candidateId=layer.idMode==='custom'?layer.id:(suggestSemanticId(candidate)||layer.id);\n  if(semanticIdInUse(layer,candidateId)){alert('Semantic ID already used: '+candidateId);refreshUI();return;}\n  commitAuthoringMutation(()=>{const oldId=layer.id;layer.labels=labels;syncSuggestedSemanticId(layer);replaceSemanticIdInConfigurations(oldId,layer.id);});\n  refreshUI();renderPreview();\n}`);
replaceFunction('removeCustomLabel',`function removeCustomLabel(key){\n  const layer=getSelectedLayer();if(!layer)return;const labels={...(layer.labels||{})};delete labels[key];\n  const candidate={...layer,labels};const candidateId=layer.idMode==='custom'?layer.id:(suggestSemanticId(candidate)||layer.id);\n  if(semanticIdInUse(layer,candidateId)){alert('Semantic ID already used: '+candidateId);refreshUI();return;}\n  commitAuthoringMutation(()=>{const oldId=layer.id;layer.labels=labels;syncSuggestedSemanticId(layer);replaceSemanticIdInConfigurations(oldId,layer.id);});\n  refreshUI();renderPreview();\n}`);
replaceFunction('addCustomLabel',`function addCustomLabel(){\n  const layer=getSelectedLayer();if(!layer)return;\n  commitAuthoringMutation(()=>{layer.labels=layer.labels||{};let i=1,key='LABEL';while(Object.hasOwn(layer.labels,key))key=\`LABEL\${++i}\`;layer.labels[key]='';});\n  refreshUI();\n}`);
replaceFunction('resetSelectedSemanticId',`function resetSelectedSemanticId(){\n  const layer=getSelectedLayer();if(!layer)return;const suggested=suggestSemanticId(layer);\n  if(!suggested){alert('No semantic ID can be suggested from the current metadata.');return;}\n  if(semanticIdInUse(layer,suggested)){alert('Semantic ID already used: '+suggested);return;}\n  commitAuthoringMutation(()=>{const oldId=layer.id;resetSemanticIdToSuggested(layer);replaceSemanticIdInConfigurations(oldId,layer.id);});\n  refreshUI();renderPreview();\n}`);
replaceFunction('commitShadowNumber',`function commitShadowNumber(id,key,{integer=false,min=-Infinity,max=Infinity}={}){const layer=getSelectedLayer();if(!layer)return;const n=Number($(id).value);if(Number.isFinite(n)&&(!integer||Number.isInteger(n))&&n>=min&&n<=max&&layer.shadow[key]!==n){commitAuthoringMutation(()=>{layer.shadow[key]=n;});refreshUI();renderPreview();}else refreshUI();}`);

replaceOnce("  renderConfigurationBar();\n  const list=$('layerList');", "  renderConfigurationBar();\n  updateHistoryButtons();\n  const list=$('layerList');", 'history button refresh');
replaceOnce("cb.addEventListener('change',()=>{setLayerVisibleInActiveView(l,cb.checked);refreshUI();renderPreview();});", "cb.addEventListener('change',()=>{commitAuthoringMutation(()=>setLayerVisibleInActiveView(l,cb.checked));refreshUI();renderPreview();});", 'layer-list visibility history');
replaceOnce("$('addConfigurationBtn').addEventListener('click',()=>{const title=prompt('Configuration title:');if(title==null)return;try{createConfiguration(title);refreshUI();renderPreview();}catch(error){alert(error.message);}});", "$('addConfigurationBtn').addEventListener('click',()=>{const title=prompt('Configuration title:');if(title==null)return;try{commitAuthoringMutation(()=>createConfiguration(title));refreshUI();renderPreview();}catch(error){alert(error.message);}});", 'configuration add history');
replaceOnce("$('renameConfigurationBtn').addEventListener('click',()=>{const active=getActiveConfiguration();if(!active)return;const title=prompt('Configuration title:',active.title);if(title==null)return;try{renameConfiguration(active.id,title);refreshUI();}catch(error){alert(error.message);}});", "$('renameConfigurationBtn').addEventListener('click',()=>{const active=getActiveConfiguration();if(!active)return;const title=prompt('Configuration title:',active.title);if(title==null)return;try{commitAuthoringMutation(()=>renameConfiguration(active.id,title));refreshUI();}catch(error){alert(error.message);}});", 'configuration rename history');
replaceOnce("$('deleteConfigurationBtn').addEventListener('click',()=>{const active=getActiveConfiguration();if(!active)return;if(!confirm('Delete visual configuration “'+active.title+'”?'))return;deleteConfiguration(active.id);refreshUI();renderPreview();});", "$('deleteConfigurationBtn').addEventListener('click',()=>{const active=getActiveConfiguration();if(!active)return;if(!confirm('Delete visual configuration “'+active.title+'”?'))return;commitAuthoringMutation(()=>deleteConfiguration(active.id));refreshUI();renderPreview();});", 'configuration delete history');
replaceOnce("$('visibleInput').addEventListener('change',()=>{const l=getSelectedLayer();if(l){setLayerVisibleInActiveView(l,$('visibleInput').checked);refreshUI();renderPreview();}});", "$('visibleInput').addEventListener('change',()=>{const l=getSelectedLayer();if(l){commitAuthoringMutation(()=>setLayerVisibleInActiveView(l,$('visibleInput').checked));refreshUI();renderPreview();}});", 'selected visibility history');
replaceOnce("$('shadowEnabledInput').addEventListener('change',()=>{const l=getSelectedLayer();if(l){l.shadow.enabled=$('shadowEnabledInput').checked;refreshUI();renderPreview();}});", "$('shadowEnabledInput').addEventListener('change',()=>{const l=getSelectedLayer();if(l&&l.shadow.enabled!==$('shadowEnabledInput').checked){commitAuthoringMutation(()=>{l.shadow.enabled=$('shadowEnabledInput').checked;});refreshUI();renderPreview();}});", 'shadow enabled history');

replaceOnce(
  "$('semanticIdInput').addEventListener('change',commitSemanticId);$('semanticIdInput').addEventListener('keydown',e=>{if(e.key==='Enter'){commitSemanticId();e.target.blur();}});",
  "$('undoBtn').addEventListener('click',undo);$('redoBtn').addEventListener('click',redo);\n$('semanticIdInput').addEventListener('change',commitSemanticId);$('semanticIdInput').addEventListener('keydown',e=>{if(e.key==='Enter'){commitSemanticId();e.target.blur();}});",
  'undo redo button bindings');

replaceOnce(
  "document.addEventListener('keydown',e=>{const tag=e.target?.tagName?.toLowerCase();if(tag==='input'||tag==='textarea'||tag==='select'||e.target?.isContentEditable)return;if(!getSelectedLayer())return;const step=e.shiftKey?10:1;const delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];if(delta){e.preventDefault();moveSelected(...delta);}});",
  `function isEditableTarget(target){const tag=target?.tagName?.toLowerCase();return tag==='input'||tag==='textarea'||tag==='select'||!!target?.isContentEditable;}\nfunction handleGlobalKeydown(e){\n  if(isEditableTarget(e.target))return;\n  const key=String(e.key||'').toLowerCase(),modified=!!(e.metaKey||e.ctrlKey);\n  if(modified&&key==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return;}\n  if(e.ctrlKey&&!e.metaKey&&key==='y'){e.preventDefault();redo();return;}\n  if(!getSelectedLayer())return;\n  const step=e.shiftKey?10:1;const delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];\n  if(delta){e.preventDefault();moveSelected(...delta);}\n}\ndocument.addEventListener('keydown',handleGlobalKeydown);`,
  'global keydown handler');

fs.writeFileSync(file,html);
console.log('Applied Composer v3 Task 4 undo/redo patch.');
