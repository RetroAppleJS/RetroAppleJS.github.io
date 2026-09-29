'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const composerPath=path.join(root,'tools/GUI_DEV/apple2-system-composer.html');
const testPath=path.join(root,'tests/apple2_system_composer_v3.test.js');
let html=fs.readFileSync(composerPath,'utf8');

function replaceOnce(oldText,newText,label){
  const index=html.indexOf(oldText);
  if(index<0) throw new Error(`Could not find ${label}`);
  if(html.indexOf(oldText,index+oldText.length)>=0) throw new Error(`Expected one ${label}`);
  html=html.slice(0,index)+newText+html.slice(index+oldText.length);
}
function replaceRegex(pattern,replacement,label){
  const matches=[...html.matchAll(new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'))];
  if(matches.length!==1) throw new Error(`Expected one ${label}, found ${matches.length}`);
  html=html.replace(pattern,replacement);
}

replaceOnce(
  '.metadata-actions button{padding:5px 8px;font-size:12px}\n.stage{min-width:0;min-height:0;overflow:auto;padding:18px;display:flex;justify-content:center;align-items:flex-start;background:',
  '.metadata-actions button{padding:5px 8px;font-size:12px}.configuration-bar{width:min(1144px,calc(100vw - 340px));max-width:100%;display:flex;align-items:center;gap:6px;flex-wrap:wrap;line-height:1.35}.configuration-tabs{display:flex;gap:6px;flex-wrap:wrap}.configuration-tab.active{outline:2px solid var(--sel);outline-offset:-1px;background:#eef6fc}.stage-content{min-width:0;display:flex;flex-direction:column;align-items:center;gap:10px}\n.stage{min-width:0;min-height:0;overflow:auto;padding:18px;display:flex;justify-content:center;align-items:flex-start;background:',
  'configuration CSS');

replaceOnce(
  '    <div class="title">Apple II System Composer</div>\n    <button id="importBtn">Import Images</button>',
  '    <div class="title">Apple II System Composer</div>\n    <button id="undoBtn" type="button" disabled>Undo</button>\n    <button id="redoBtn" type="button" disabled>Redo</button>\n    <button id="importBtn">Import Images</button>',
  'Undo/Redo toolbar controls');

replaceOnce(
  '    <section class="stage">\n      <div class="canvas-shell"><canvas id="previewCanvas" width="1144" height="1144" aria-label="Apple II composition canvas" tabindex="0"></canvas></div>\n    </section>',
  '    <section class="stage">\n      <div class="stage-content">\n        <div id="configurationBar" class="configuration-bar" aria-label="Visual configurations">\n          <button id="baseConfigurationBtn" class="configuration-tab active" type="button">Base</button>\n          <div id="configurationTabs" class="configuration-tabs"></div>\n          <button id="addConfigurationBtn" type="button" title="Add visual configuration">+</button>\n          <button id="renameConfigurationBtn" type="button" disabled>Rename</button>\n          <button id="deleteConfigurationBtn" type="button" class="danger" disabled>Delete</button>\n        </div>\n        <div class="canvas-shell"><canvas id="previewCanvas" width="1144" height="1144" aria-label="Apple II composition canvas" tabindex="0"></canvas></div>\n      </div>\n    </section>',
  'configuration strip markup');

replaceOnce(
  'const state={layers:[],configurations:[],selectedLayerUid:null,assets:new Map(),dragging:null};',
  'const state={layers:[],configurations:[],activeConfigurationId:null,selectedLayerUid:null,assets:new Map(),dragging:null};',
  'active configuration state');

replaceOnce(
  'function canonicalSuggestionSegment(value){',
  `function validateConfigurations(raw,layerIds){
  if(!Array.isArray(raw)) throw new Error('Layout configurations must be an array.');
  const seenIds=new Set();
  return raw.map((config,index)=>{
    if(!config || typeof config!=='object' || Array.isArray(config)) throw new Error(\`Configuration \${index+1} is malformed.\`);
    if(typeof config.id!=='string' || !config.id.trim()) throw new Error(\`Configuration \${index+1} id must be non-empty.\`);
    const id=config.id.trim();
    if(!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error(\`Configuration \${index+1} id is invalid.\`);
    if(seenIds.has(id)) throw new Error(\`Duplicate configuration id: \${id}\`);
    seenIds.add(id);
    if(typeof config.title!=='string' || !config.title.trim()) throw new Error(\`Configuration \${id} title must be non-empty.\`);
    const title=config.title.trim();
    if(!Array.isArray(config.visible)) throw new Error(\`Configuration \${id} visible must be an array.\`);
    const seenVisible=new Set();
    const visible=config.visible.map((rawId,itemIndex)=>{
      if(typeof rawId!=='string' || !rawId.trim()) throw new Error(\`Configuration \${id} visible entry \${itemIndex+1} must be a semantic ID.\`);
      const semanticId=rawId.trim();
      if(!layerIds.has(semanticId)) throw new Error(\`Configuration \${id} references unknown semantic ID \${semanticId}.\`);
      if(seenVisible.has(semanticId)) throw new Error(\`Configuration \${id} contains duplicate visible semantic ID \${semanticId}.\`);
      seenVisible.add(semanticId);
      return semanticId;
    });
    return {id,title,visible};
  });
}

function canonicalSuggestionSegment(value){`,
  'configuration validator');

replaceOnce(
  `  const configurations=doc.configurations.map(c=>{
    if(!c || typeof c!=='object' || Array.isArray(c)) return c;
    return {...c,visible:Array.isArray(c.visible)?[...c.visible]:c.visible};
  });
  return {version:LAYOUT_VERSION,canvas:{width:CANVAS_W,height:CANVAS_H},assets,layers,configurations};`,
  `  const configurations=validateConfigurations(doc.configurations,seenIds);
  return {version:LAYOUT_VERSION,canvas:{width:CANVAS_W,height:CANVAS_H},assets,layers,configurations};`,
  'validated configurations in validateLayout');

replaceOnce(
  '  state.layers=next; state.configurations=(layout.configurations||[]).map(c=>({...c,visible:Array.isArray(c.visible)?[...c.visible]:c.visible})); state.selectedLayerUid=next[0]?.uid||null; state.dragging=null; refreshUI();renderPreview();',
  '  state.layers=next; state.configurations=(layout.configurations||[]).map(c=>({...c,visible:[...c.visible]})); state.activeConfigurationId=null; state.selectedLayerUid=next[0]?.uid||null; state.dragging=null; refreshUI();renderPreview();',
  'applyLayout configuration state');

replaceRegex(
  /function removeSelectedLayer\(\)\{[\s\S]*?\n\}/,
  `function removeSelectedLayer(){
  const idx=state.layers.findIndex(l=>l.uid===state.selectedLayerUid); if(idx<0)return;
  const removed=state.layers[idx];
  state.layers.splice(idx,1);
  for(const config of state.configurations) config.visible=config.visible.filter(id=>id!==removed.id);
  const next=state.layers[Math.min(idx,state.layers.length-1)]||null; state.selectedLayerUid=next?.uid||null; refreshUI();renderPreview();
}`,
  'removeSelectedLayer');

replaceRegex(
  /function hitTest\(x,y\)\{[^\n]*\}/,
  'function hitTest(x,y){for(const l of state.layers){if(isLayerVisibleInActiveView(l)&&l.resolved&&x>=l.x&&x<l.x+l.width&&y>=l.y&&y<l.y+l.height)return l;}return null;}',
  'hitTest');
replaceRegex(
  /function drawLayer\(targetCtx,l\)\{\n  if\(!l\.visible\|\|!l\.resolved\)return;/,
  'function drawLayer(targetCtx,l){\n  if(!isLayerVisibleInActiveView(l)||!l.resolved)return;',
  'drawLayer visibility');
replaceOnce(
  '  const s=getSelectedLayer(); if(s&&s.visible&&s.resolved){ctx.save();ctx.strokeStyle=\'#1e6ba8\';ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.strokeRect(s.x+.5,s.y+.5,s.width-1,s.height-1);ctx.restore();}',
  '  const s=getSelectedLayer(); if(s&&isLayerVisibleInActiveView(s)&&s.resolved){ctx.save();ctx.strokeStyle=\'#1e6ba8\';ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.strokeRect(s.x+.5,s.y+.5,s.width-1,s.height-1);ctx.restore();}',
  'selected-layer active visibility');

replaceOnce(
  `function semanticIdInUse(layer,id){
  if(!id) return false;
  return state.layers.some(other=>other!==layer && other.id===id);
}
function renderLabelsEditor(layer){`,
  `function semanticIdInUse(layer,id){
  if(!id) return false;
  return state.layers.some(other=>other!==layer && other.id===id);
}
function getActiveConfiguration(){
  if(state.activeConfigurationId==null) return null;
  return state.configurations.find(config=>config.id===state.activeConfigurationId)||null;
}
function isLayerVisibleInActiveView(layer){
  const config=getActiveConfiguration();
  return config ? config.visible.includes(layer.id) : !!layer.visible;
}
function setLayerVisibleInActiveView(layer,visible){
  const config=getActiveConfiguration();
  if(!config){ layer.visible=!!visible; return layer.visible; }
  const has=config.visible.includes(layer.id);
  if(visible&&!has) config.visible.push(layer.id);
  else if(!visible&&has) config.visible=config.visible.filter(id=>id!==layer.id);
  return !!visible;
}
function makeConfigurationId(title){
  const raw=String(title??'').trim().toLowerCase();
  const base=raw.replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'configuration';
  let id=base,suffix=2;
  while(state.configurations.some(config=>config.id===id)) id=\`${base}-\${suffix++}\`;
  return id;
}
function visibleIdsForActiveView(){ return state.layers.filter(isLayerVisibleInActiveView).map(layer=>layer.id); }
function createConfiguration(title){
  const clean=String(title??'').trim();
  if(!clean) throw new Error('Configuration title must be non-empty.');
  const config={id:makeConfigurationId(clean),title:clean,visible:visibleIdsForActiveView()};
  state.configurations.push(config); state.activeConfigurationId=config.id; return config;
}
function renameConfiguration(id,title){
  const config=state.configurations.find(item=>item.id===id);
  if(!config) throw new Error(\`Unknown configuration: \${id}\`);
  const clean=String(title??'').trim();
  if(!clean) throw new Error('Configuration title must be non-empty.');
  config.title=clean; return config;
}
function deleteConfiguration(id){
  const index=state.configurations.findIndex(item=>item.id===id);
  if(index<0) throw new Error(\`Unknown configuration: \${id}\`);
  state.configurations.splice(index,1);
  if(state.activeConfigurationId===id) state.activeConfigurationId=null;
}
function selectConfiguration(id){
  if(id==null){ state.activeConfigurationId=null; return null; }
  const config=state.configurations.find(item=>item.id===id);
  if(!config) throw new Error(\`Unknown configuration: \${id}\`);
  state.activeConfigurationId=id; return config;
}
function replaceSemanticIdInConfigurations(oldId,newId){
  if(oldId===newId) return;
  for(const config of state.configurations) config.visible=config.visible.map(id=>id===oldId?newId:id);
}
function renameLayerSemanticId(layer,value){
  const id=validateSemanticId(value,0);
  if(semanticIdInUse(layer,id)) throw new Error(\`Semantic ID already used: \${id}\`);
  const oldId=layer.id;
  layer.id=id; layer.idMode='custom'; replaceSemanticIdInConfigurations(oldId,id); return id;
}
function renderConfigurationBar(){
  const host=$('configurationTabs'); host.textContent='';
  $('baseConfigurationBtn').classList.toggle('active',state.activeConfigurationId==null);
  for(const config of state.configurations){
    const button=document.createElement('button'); button.type='button'; button.className='configuration-tab'+(config.id===state.activeConfigurationId?' active':''); button.textContent=config.title; button.dataset.configurationId=config.id;
    button.addEventListener('click',()=>{selectConfiguration(config.id);refreshUI();renderPreview();}); host.appendChild(button);
  }
  const active=getActiveConfiguration(); $('renameConfigurationBtn').disabled=!active; $('deleteConfigurationBtn').disabled=!active;
}
function renderLabelsEditor(layer){`,
  'configuration model helpers');

replaceOnce(
  `function refreshUI(){
  const list=$('layerList');list.textContent='';`,
  `function refreshUI(){
  renderConfigurationBar();
  const list=$('layerList');list.textContent='';`,
  'configuration bar refresh');
replaceOnce(
  `    const cb=document.createElement('input');cb.type='checkbox';cb.checked=l.visible;cb.setAttribute('aria-label',\`Show \${l.file}\`);cb.addEventListener('click',e=>e.stopPropagation());cb.addEventListener('change',()=>{l.visible=cb.checked;refreshUI();renderPreview();});`,
  `    const cb=document.createElement('input');cb.type='checkbox';cb.checked=isLayerVisibleInActiveView(l);cb.setAttribute('aria-label',\`Show \${l.file}\`);cb.addEventListener('click',e=>e.stopPropagation());cb.addEventListener('change',()=>{setLayerVisibleInActiveView(l,cb.checked);refreshUI();renderPreview();});`,
  'layer checkbox active visibility');
replaceOnce(
  `    $('selectedFilename').textContent=s.file;$('semanticIdInput').value=s.id||'';$('idModeBadge').textContent=s.idMode==='custom'?'custom':'auto';$('xInput').value=s.x;$('yInput').value=s.y;$('visibleInput').checked=s.visible;`,
  `    $('selectedFilename').textContent=s.file;$('semanticIdInput').value=s.id||'';$('idModeBadge').textContent=s.idMode==='custom'?'custom':'auto';$('xInput').value=s.x;$('yInput').value=s.y;$('visibleInput').checked=isLayerVisibleInActiveView(s);`,
  'selected visibility input');

replaceOnce(
  `    if(semanticIdInUse(l,id)) throw new Error(\`Semantic ID already used: \${id}\`);
    setLayerSemanticId(l,id);`,
  `    renameLayerSemanticId(l,id);`,
  'manual semantic id rename');

replaceOnce(
  `  l.labels=labels;syncSuggestedSemanticId(l);refreshUI();
}`,
  `  const oldId=l.id;l.labels=labels;syncSuggestedSemanticId(l);replaceSemanticIdInConfigurations(oldId,l.id);refreshUI();
}`,
  'label value semantic reference update');
replaceOnce(
  `  l.labels=labels;syncSuggestedSemanticId(l);refreshUI();
}
function removeCustomLabel(key){const l=getSelectedLayer();if(!l)return;delete l.labels[key];syncSuggestedSemanticId(l);refreshUI();}`,
  `  const oldId=l.id;l.labels=labels;syncSuggestedSemanticId(l);replaceSemanticIdInConfigurations(oldId,l.id);refreshUI();
}
function removeCustomLabel(key){const l=getSelectedLayer();if(!l)return;const labels={...(l.labels||{})};delete labels[key];const candidate={...l,labels};const candidateId=l.idMode==='custom'?l.id:(suggestSemanticId(candidate)||l.id);if(semanticIdInUse(l,candidateId)){alert(\`Semantic ID already used: \${candidateId}\`);refreshUI();return;}const oldId=l.id;l.labels=labels;syncSuggestedSemanticId(l);replaceSemanticIdInConfigurations(oldId,l.id);refreshUI();}`,
  'custom label type and removal semantic reference updates');
replaceOnce(
  `  resetSemanticIdToSuggested(l);refreshUI();`,
  `  const oldId=l.id;resetSemanticIdToSuggested(l);replaceSemanticIdInConfigurations(oldId,l.id);refreshUI();`,
  'reset suggested id reference update');
replaceOnce(
  `$('visibleInput').addEventListener('change',()=>{const l=getSelectedLayer();if(l){l.visible=$('visibleInput').checked;refreshUI();renderPreview();}});`,
  `$('visibleInput').addEventListener('change',()=>{const l=getSelectedLayer();if(l){setLayerVisibleInActiveView(l,$('visibleInput').checked);refreshUI();renderPreview();}});`,
  'selected visibility event');

replaceOnce(
  `$('addLabelBtn').addEventListener('click',addCustomLabel);$('resetSuggestedIdBtn').addEventListener('click',resetSelectedSemanticId);
$('visibleInput')`,
  `$('addLabelBtn').addEventListener('click',addCustomLabel);$('resetSuggestedIdBtn').addEventListener('click',resetSelectedSemanticId);
$('baseConfigurationBtn').addEventListener('click',()=>{selectConfiguration(null);refreshUI();renderPreview();});
$('addConfigurationBtn').addEventListener('click',()=>{const title=prompt('Configuration title:');if(title==null)return;try{createConfiguration(title);refreshUI();renderPreview();}catch(error){alert(error.message);}});
$('renameConfigurationBtn').addEventListener('click',()=>{const active=getActiveConfiguration();if(!active)return;const title=prompt('Configuration title:',active.title);if(title==null)return;try{renameConfiguration(active.id,title);refreshUI();}catch(error){alert(error.message);}});
$('deleteConfigurationBtn').addEventListener('click',()=>{const active=getActiveConfiguration();if(!active)return;if(!confirm(\`Delete visual configuration “\${active.title}”?\`))return;deleteConfiguration(active.id);refreshUI();renderPreview();});
$('visibleInput')`,
  'configuration UI event wiring');

replaceRegex(
  /function getExportBlockers\(\)\{[^\n]*\}/,
  'function getExportBlockers(){return [...new Set(state.layers.filter(l=>isLayerVisibleInActiveView(l)&&!l.resolved).map(l=>l.file))];}',
  'PNG blocker active visibility');

fs.writeFileSync(composerPath,html);

let tests=fs.readFileSync(testPath,'utf8');
if(!tests.includes("Composer toolbar exposes Undo and Redo controls")){
  tests += `\n\ntest('Composer toolbar exposes Undo and Redo controls for the history task',()=>{\n    assert.match(html,/id=\"undoBtn\"/,'Undo button must exist');\n    assert.match(html,/id=\"redoBtn\"/,'Redo button must exist');\n    assert.match(html,/id=\"undoBtn\"[^>]*disabled/,'Undo stays disabled until history is available');\n    assert.match(html,/id=\"redoBtn\"[^>]*disabled/,'Redo stays disabled until history is available');\n});\n`;
  fs.writeFileSync(testPath,tests);
}
console.log('Applied Composer v3 Task 2 configuration patch.');
