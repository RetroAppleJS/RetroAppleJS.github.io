'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');

const composerPath=path.join(__dirname,'..','tools','GUI_DEV','apple2-system-composer.html');
const html=fs.readFileSync(composerPath,'utf8');
const scriptStart=html.indexOf('<script>');
const scriptEnd=html.lastIndexOf('</script>');
assert.notEqual(scriptStart,-1);
assert.notEqual(scriptEnd,-1);
const source=html.slice(scriptStart+'<script>'.length,scriptEnd);

function extractStatement(pattern,label){
  const match=source.match(pattern);
  assert.ok(match,`Composer must define ${label}`);
  return match[0];
}

function extractFunction(name){
  const marker=`function ${name}(`;
  const start=source.indexOf(marker);
  assert.notEqual(start,-1,`Composer must define ${name}()`);
  const paramsStart=source.indexOf('(',start);
  let paramsEnd=-1,parenDepth=0,quote=null,escaped=false;
  for(let i=paramsStart;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote=null;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='(')parenDepth++;
    else if(ch===')'){parenDepth--;if(parenDepth===0){paramsEnd=i;break;}}
  }
  assert.notEqual(paramsEnd,-1,`${name}() must have a complete parameter list`);
  const bodyStart=source.indexOf('{',paramsEnd+1);
  assert.notEqual(bodyStart,-1,`${name}() must have a body`);
  let depth=0;quote=null;escaped=false;
  for(let i=bodyStart;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote=null;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'){depth--;if(depth===0)return source.slice(start,i+1);}
  }
  assert.fail(`Could not extract ${name}()`);
}

function plain(value){return JSON.parse(JSON.stringify(value));}
function shadow(){return {enabled:false,offsetX:0,offsetY:15,blur:12,opacity:0.75};}
function layer(overrides={}){
  return Object.assign({uid:'u1',id:'A',idMode:'custom',labels:{PCODE:'DISKII',DCODE:'D1',ROLE:'BODY'},file:'a.png',x:10,y:20,visible:true,shadow:shadow(),image:{name:'decoded-a'},width:100,height:50,resolved:true},overrides);
}
function stateWithAsset(){
  const asset={file:'a.png',image:{name:'cache-a'},width:100,height:50,dataUrl:'data:image/png;base64,AAAA',objectUrl:'blob:a'};
  return {layers:[layer({image:asset.image})],configurations:[{id:'view',title:'View',visible:['A']}],activeConfigurationId:'view',selectedLayerUid:'u1',assets:new Map([['a.png',asset]]),dragging:null,history:{undo:[],redo:[]}};
}

function loadHistoryCore(initialState=stateWithAsset()){
  const buttons={undoBtn:{disabled:true},redoBtn:{disabled:true}};
  const context=vm.createContext({console,Map,Set,Object,Array,Number,String,Boolean,Math,JSON,Error});
  context.__state=initialState;
  context.__buttons=buttons;
  const core=[
    "'use strict';",
    extractStatement(/const\s+HISTORY_LIMIT\s*=\s*100\s*;/,'HISTORY_LIMIT'),
    'const state=globalThis.__state;',
    'const $=id=>globalThis.__buttons[id];',
    'function refreshUI(){}',
    'function renderPreview(){}',
    extractFunction('findCachedAsset'),
    extractFunction('attachAsset'),
    extractFunction('captureHistorySnapshot'),
    extractFunction('historySnapshotsEqual'),
    extractFunction('updateHistoryButtons'),
    extractFunction('restoreHistorySnapshot'),
    extractFunction('commitHistory'),
    extractFunction('resetHistory'),
    extractFunction('undo'),
    extractFunction('redo'),
    extractFunction('commitAuthoringMutation'),
    'globalThis.__api={state,captureHistorySnapshot,restoreHistorySnapshot,commitHistory,resetHistory,undo,redo,commitAuthoringMutation,buttons:globalThis.__buttons};'
  ].join('\n');
  vm.runInContext(core,context,{filename:'composer-history-core.js'});
  return context.__api;
}

function loadShortcutCore(){
  const calls=[];
  const context=vm.createContext({console});
  context.__calls=calls;
  const core=[
    "'use strict';",
    'function undo(){globalThis.__calls.push(["undo"]);return true;}',
    'function redo(){globalThis.__calls.push(["redo"]);return true;}',
    'function moveSelected(dx,dy){globalThis.__calls.push(["move",dx,dy]);}',
    'function getSelectedLayer(){return {uid:"u1"};}',
    extractFunction('isEditableTarget'),
    extractFunction('handleGlobalKeydown'),
    'globalThis.__api={handleGlobalKeydown,calls:globalThis.__calls};'
  ].join('\n');
  vm.runInContext(core,context,{filename:'composer-history-shortcuts.js'});
  return context.__api;
}

function keyEvent(key,overrides={}){
  let prevented=false;
  return Object.assign({key,ctrlKey:false,metaKey:false,shiftKey:false,target:{tagName:'DIV',isContentEditable:false},preventDefault(){prevented=true;},get prevented(){return prevented;}},overrides);
}

test('history API exists with a 100-action bound and toolbar buttons mirror stack availability',()=>{
  assert.match(html,/id="undoBtn"[^>]*disabled/);
  assert.match(html,/id="redoBtn"[^>]*disabled/);
  const api=loadHistoryCore();
  assert.equal(api.buttons.undoBtn.disabled,true);
  assert.equal(api.buttons.redoBtn.disabled,true);
  api.commitAuthoringMutation(()=>{api.state.layers[0].x=11;});
  assert.equal(api.state.history.undo.length,1);
  assert.equal(api.buttons.undoBtn.disabled,false);
  assert.equal(api.buttons.redoBtn.disabled,true);
});

test('undo and redo restore serializable document state and re-associate currently cached assets by filename',()=>{
  const api=loadHistoryCore();
  const cachedImage=api.state.assets.get('a.png').image;
  api.commitAuthoringMutation(()=>{
    api.state.layers[0].x=44;
    api.state.layers[0].shadow.enabled=true;
    api.state.configurations[0].visible=[];
  });
  assert.equal(api.state.layers[0].x,44);
  assert.equal(api.undo(),true);
  assert.equal(api.state.layers[0].x,10);
  assert.equal(api.state.layers[0].shadow.enabled,false);
  assert.deepEqual(plain(api.state.configurations[0].visible),['A']);
  assert.equal(api.state.layers[0].resolved,true);
  assert.equal(api.state.layers[0].image,cachedImage);
  assert.equal(api.redo(),true);
  assert.equal(api.state.layers[0].x,44);
  assert.equal(api.state.layers[0].shadow.enabled,true);
  assert.deepEqual(plain(api.state.configurations[0].visible),[]);
});

test('history snapshots preserve editor continuity but contain no image bytes, decoded images, or object URLs',()=>{
  const api=loadHistoryCore();
  const snap=plain(api.captureHistorySnapshot());
  assert.equal(snap.selectedLayerUid,'u1');
  assert.equal(snap.activeConfigurationId,'view');
  assert.equal(snap.layers[0].uid,'u1');
  assert.equal(snap.layers[0].idMode,'custom');
  assert.equal(Object.hasOwn(snap.layers[0],'image'),false);
  assert.equal(Object.hasOwn(snap.layers[0],'width'),false);
  assert.equal(Object.hasOwn(snap.layers[0],'height'),false);
  assert.equal(Object.hasOwn(snap.layers[0],'resolved'),false);
  assert.equal(JSON.stringify(snap).includes('blob:a'),false);
  assert.equal(JSON.stringify(snap).includes('base64'),false);
});

test('undo after assets are unloaded restores document state without resurrecting image content',()=>{
  const api=loadHistoryCore();
  api.commitAuthoringMutation(()=>{api.state.layers[0].x=99;});
  api.state.assets.clear();
  api.state.layers[0].image=null;api.state.layers[0].width=0;api.state.layers[0].height=0;api.state.layers[0].resolved=false;
  assert.equal(api.undo(),true);
  assert.equal(api.state.layers[0].x,10);
  assert.equal(api.state.layers[0].resolved,false);
  assert.equal(api.state.layers[0].image,null);
  assert.equal(api.state.layers[0].width,0);
  assert.equal(api.state.layers[0].height,0);
});

test('new committed edit after undo clears redo and history retains only the latest 100 actions',()=>{
  const api=loadHistoryCore();
  api.commitAuthoringMutation(()=>{api.state.layers[0].x=11;});
  api.commitAuthoringMutation(()=>{api.state.layers[0].x=12;});
  assert.equal(api.undo(),true);
  assert.equal(api.state.history.redo.length,1);
  api.commitAuthoringMutation(()=>{api.state.layers[0].y=21;});
  assert.equal(api.state.history.redo.length,0);

  api.resetHistory();
  for(let i=0;i<101;i++) api.commitAuthoringMutation(()=>{api.state.layers[0].x++;});
  assert.equal(api.state.history.undo.length,100);
});

test('drag captures one pre-drag snapshot and commits once at drag end only if coordinates changed',()=>{
  const pointerDown=source.match(/canvas\.addEventListener\('pointerdown',[^\n]+/i)?.[0]||'';
  const endDrag=extractFunction('endDrag');
  assert.match(pointerDown,/captureHistorySnapshot\(/);
  assert.match(pointerDown,/historySnapshot/);
  assert.match(pointerDown,/startX/);
  assert.match(pointerDown,/startY/);
  assert.match(endDrag,/commitHistory\(/);
  assert.match(endDrag,/startX|startY/);
});

test('document mutations are wrapped as committed history actions, while loading resets history and unloading does not commit',()=>{
  for(const name of ['moveSelected','commitNumber','commitSemanticId','commitLabelValue','commitCustomLabelType','removeCustomLabel','addCustomLabel','resetSelectedSemanticId','removeSelectedLayer','bringForward','sendBackward','commitShadowNumber']){
    assert.match(extractFunction(name),/commitAuthoringMutation|captureHistorySnapshot|commitHistory/,`${name} must participate in history`);
  }
  assert.match(extractFunction('importImageFiles'),/captureHistorySnapshot/);
  assert.match(extractFunction('importImageFiles'),/commitHistory/);
  assert.match(extractFunction('applyLayout'),/resetHistory\(/);
  assert.doesNotMatch(extractFunction('unloadImages'),/commitHistory|commitAuthoringMutation|captureHistorySnapshot/);
  assert.match(source,/addConfigurationBtn[\s\S]{0,400}commitAuthoringMutation/);
  assert.match(source,/renameConfigurationBtn[\s\S]{0,400}commitAuthoringMutation/);
  assert.match(source,/deleteConfigurationBtn[\s\S]{0,500}commitAuthoringMutation/);
  assert.match(source,/visibleInput[\s\S]{0,300}commitAuthoringMutation/);
  assert.match(source,/shadowEnabledInput[\s\S]{0,300}commitAuthoringMutation/);
});

test('Cmd/Ctrl-Z, shifted Z and Ctrl-Y dispatch history outside editors without stealing native text undo',()=>{
  const api=loadShortcutCore();
  for(const e of [keyEvent('z',{metaKey:true}),keyEvent('z',{ctrlKey:true})]){api.handleGlobalKeydown(e);assert.equal(e.prevented,true);}
  api.handleGlobalKeydown(keyEvent('z',{metaKey:true,shiftKey:true}));
  api.handleGlobalKeydown(keyEvent('z',{ctrlKey:true,shiftKey:true}));
  api.handleGlobalKeydown(keyEvent('y',{ctrlKey:true}));
  assert.deepEqual(api.calls.map(c=>c[0]),['undo','undo','redo','redo','redo']);

  for(const target of [{tagName:'INPUT',isContentEditable:false},{tagName:'TEXTAREA',isContentEditable:false},{tagName:'SELECT',isContentEditable:false},{tagName:'DIV',isContentEditable:true}]){
    const before=api.calls.length;const e=keyEvent('z',{ctrlKey:true,target});api.handleGlobalKeydown(e);
    assert.equal(api.calls.length,before);assert.equal(e.prevented,false);
  }
});

test('arrow-key movement remains available and becomes an undoable committed action outside editors',()=>{
  const api=loadShortcutCore();
  const right=keyEvent('ArrowRight');api.handleGlobalKeydown(right);
  const up10=keyEvent('ArrowUp',{shiftKey:true});api.handleGlobalKeydown(up10);
  assert.deepEqual(plain(api.calls),[['move',1,0],['move',0,-10]]);
  assert.equal(right.prevented,true);
  assert.equal(up10.prevented,true);
});
