'use strict';

const fs=require('node:fs');
const path=require('node:path');
const file=path.resolve(__dirname,'../../tools/GUI_DEV/apple2-system-composer.html');
let source=fs.readFileSync(file,'utf8');

function replaceOnce(before,after,label)
{
    if(source.includes(after)) return;
    const count=source.split(before).length-1;
    if(count!==1) throw new Error(`${label}: expected one source match, found ${count}`);
    source=source.replace(before,after);
}

replaceOnce(
`          <button id="addConfigurationBtn" type="button" title="Add visual configuration">+</button>
          <button id="renameConfigurationBtn" type="button" disabled>Rename</button>
          <button id="deleteConfigurationBtn" type="button" class="danger" disabled>Delete</button>`,
`          <button id="addConfigurationBtn" type="button" title="Add visual configuration">+</button>
          <button id="duplicateConfigurationBtn" type="button" disabled>Duplicate</button>
          <button id="renameConfigurationBtn" type="button" disabled>Rename</button>
          <button id="deleteConfigurationBtn" type="button" class="danger" disabled>Delete</button>
          <button id="importConfigurationBtn" type="button">Import Configuration</button>
          <button id="exportConfigurationBtn" type="button" disabled>Export Configuration</button>
          <input id="configurationInput" type="file" accept="application/json,.json" hidden>`,
'configuration toolbar');

replaceOnce(
`const CANVAS_W=1144, CANVAS_H=1144, LAYOUT_VERSION=3;
const DEFAULT_SHADOW=Object.freeze({enabled:false,offsetX:0,offsetY:15,blur:12,opacity:0.75});`,
`const CANVAS_W=1144, CANVAS_H=1144, LAYOUT_VERSION=3;
const CONFIGURATION_FILE_TYPE='apple2-system-composer-configuration', CONFIGURATION_FILE_VERSION=1;
const DEFAULT_SHADOW=Object.freeze({enabled:false,offsetX:0,offsetY:15,blur:12,opacity:0.75});`,
'configuration file constants');

replaceOnce(
`const imageInput=$('imageInput'), layoutInput=$('layoutInput');`,
`const imageInput=$('imageInput'), layoutInput=$('layoutInput'), configurationInput=$('configurationInput');`,
'configuration file input');

replaceOnce(
`function selectConfiguration(id){
  if(id==null){ state.activeConfigurationId=null; return null; }
  const config=state.configurations.find(item=>item.id===id);
  if(!config) throw new Error('Unknown configuration: '+id);
  state.activeConfigurationId=id; return config;
}
function replaceSemanticIdInConfigurations(oldId,newId){`,
`function selectConfiguration(id){
  if(id==null){ state.activeConfigurationId=null; return null; }
  const config=state.configurations.find(item=>item.id===id);
  if(!config) throw new Error('Unknown configuration: '+id);
  state.activeConfigurationId=id; return config;
}
function serializeStandaloneConfiguration(config=getActiveConfiguration()){
  if(!config) throw new Error('A named configuration must be selected for export.');
  return {type:CONFIGURATION_FILE_TYPE,version:CONFIGURATION_FILE_VERSION,id:config.id,title:config.title,visible:[...config.visible]};
}
function validateStandaloneConfiguration(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new Error('Configuration file must contain an object.');
  if(raw.type!==CONFIGURATION_FILE_TYPE) throw new Error('Configuration file type must be '+CONFIGURATION_FILE_TYPE+'.');
  if(raw.version!==CONFIGURATION_FILE_VERSION) throw new Error('Unsupported configuration file version: '+raw.version+'.');
  const validated=validateConfigurations([{id:raw.id,title:raw.title,visible:raw.visible}],new Set(state.layers.map(layer=>layer.id)))[0];
  return {type:CONFIGURATION_FILE_TYPE,version:CONFIGURATION_FILE_VERSION,id:validated.id,title:validated.title,visible:[...validated.visible]};
}
function importStandaloneConfiguration(raw){
  const validated=validateStandaloneConfiguration(raw);
  let id=validated.id,suffix=2;
  while(state.configurations.some(config=>config.id===id)) id=validated.id+'-'+suffix++;
  const config={id,title:validated.title,visible:[...validated.visible]};
  state.configurations.push(config);state.activeConfigurationId=config.id;return config;
}
function duplicateConfiguration(id=state.activeConfigurationId){
  const source=id==null?getActiveConfiguration():state.configurations.find(config=>config.id===id);
  if(!source) throw new Error('A named configuration must be selected to duplicate.');
  const title=source.title+' copy';
  const config={id:makeConfigurationId(title),title,visible:[...source.visible]};
  state.configurations.push(config);state.activeConfigurationId=config.id;return config;
}
function replaceSemanticIdInConfigurations(oldId,newId){`,
'standalone configuration functions');

replaceOnce(
`  const active=getActiveConfiguration(); $('renameConfigurationBtn').disabled=!active; $('deleteConfigurationBtn').disabled=!active;`,
`  const active=getActiveConfiguration(); $('duplicateConfigurationBtn').disabled=!active; $('renameConfigurationBtn').disabled=!active; $('deleteConfigurationBtn').disabled=!active; $('exportConfigurationBtn').disabled=!active;`,
'configuration button availability');

replaceOnce(
`$('addConfigurationBtn').addEventListener('click',()=>{const title=prompt('Configuration title:');if(title==null)return;try{commitAuthoringMutation(()=>createConfiguration(title));refreshUI();renderPreview();}catch(error){alert(error.message);}});
$('renameConfigurationBtn').addEventListener('click',()=>{const active=getActiveConfiguration();if(!active)return;const title=prompt('Configuration title:',active.title);if(title==null)return;try{commitAuthoringMutation(()=>renameConfiguration(active.id,title));refreshUI();}catch(error){alert(error.message);}});
$('deleteConfigurationBtn').addEventListener('click',()=>{const active=getActiveConfiguration();if(!active)return;if(!confirm('Delete visual configuration “'+active.title+'”?'))return;commitAuthoringMutation(()=>deleteConfiguration(active.id));refreshUI();renderPreview();});`,
`$('addConfigurationBtn').addEventListener('click',()=>{const title=prompt('Configuration title:');if(title==null)return;try{commitAuthoringMutation(()=>createConfiguration(title));refreshUI();renderPreview();}catch(error){alert(error.message);}});
$('duplicateConfigurationBtn').addEventListener('click',()=>{try{commitAuthoringMutation(()=>duplicateConfiguration());refreshUI();renderPreview();}catch(error){alert(error.message);}});
$('renameConfigurationBtn').addEventListener('click',()=>{const active=getActiveConfiguration();if(!active)return;const title=prompt('Configuration title:',active.title);if(title==null)return;try{commitAuthoringMutation(()=>renameConfiguration(active.id,title));refreshUI();}catch(error){alert(error.message);}});
$('deleteConfigurationBtn').addEventListener('click',()=>{const active=getActiveConfiguration();if(!active)return;if(!confirm('Delete visual configuration “'+active.title+'”?'))return;commitAuthoringMutation(()=>deleteConfiguration(active.id));refreshUI();renderPreview();});
$('importConfigurationBtn').addEventListener('click',()=>configurationInput.click());
configurationInput.addEventListener('change',async()=>{const file=configurationInput.files?.[0];configurationInput.value='';if(!file)return;try{const raw=JSON.parse(await file.text());commitAuthoringMutation(()=>importStandaloneConfiguration(raw));refreshUI();renderPreview();}catch(error){alert('Could not import configuration: '+error.message);}});
$('exportConfigurationBtn').addEventListener('click',()=>{const active=getActiveConfiguration();if(!active)return;const standalone=serializeStandaloneConfiguration(active);downloadBlob(new Blob([JSON.stringify(standalone,null,2)],{type:'application/json'}),active.id+'.config.json');});`,
'configuration actions');

fs.writeFileSync(file,source);
console.log('Applied standalone configuration import/export and duplicate actions.');
