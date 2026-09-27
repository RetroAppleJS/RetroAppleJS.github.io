'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const layout = require('../res/COM_A2P_LAYOUT.js');

const repoRoot=path.join(__dirname,'..');
const emuMainSource=fs.readFileSync(path.join(repoRoot,'res','EMU_apple2main.js'),'utf8');
const layoutConfigSource=fs.readFileSync(path.join(repoRoot,'res','COM_LAYOUT_CONFIG.js'),'utf8');
const compositorSource=fs.readFileSync(path.join(repoRoot,'res','COM_A2P_LAYOUT.js'),'utf8');

test('Apple II layout exposes an HTML composition builder', () => {
  assert.equal(typeof layout.buildDOMComposition, 'function');
});

function fakeElement(tag) {
  return {
    tagName: tag.toUpperCase(),
    id: '',
    style: {},
    dataset: {},
    children: [],
    parentNode: null,
    appendChild(child) { this.children.push(child); child.parentNode=this; return child; },
    insertBefore(child,before) { this.children.unshift(child); child.parentNode=this; return child; },
    removeChild(child) { this.children=this.children.filter(c => c!==child); child.parentNode=null; return child; },
    setAttribute() {}
  };
}
function fakeDocument() { return { createElement: fakeElement }; }

function layer(file,x,y,visible,id) {
  const out={file,x,y,visible,shadow:{enabled:false,offsetX:0,offsetY:15,blur:12,opacity:.75}};
  if(id) out.id=id;
  return out;
}

test('HTML composition preserves JSON top-to-bottom stacking, geometry, shadows and embedded assets', () => {
  const doc=fakeDocument();
  const cfg={canvas:{width:1144,height:1144},assets:{
    'top.png':'data:image/png;base64,TOP',
    'hidden.png':'data:image/png;base64,HIDDEN',
    'bottom.png':'data:image/png;base64,BOTTOM'
  },layers:[
    {id:'TOP',file:'top.png',x:10,y:20,visible:true,shadow:{enabled:false,offsetX:0,offsetY:0,blur:0,opacity:0}},
    {id:'HIDDEN',file:'hidden.png',x:0,y:0,visible:false,shadow:{enabled:false,offsetX:0,offsetY:0,blur:0,opacity:0}},
    {id:'BOTTOM',file:'bottom.png',x:30,y:40,visible:true,shadow:{enabled:true,offsetX:0,offsetY:15,blur:12,opacity:.75}}
  ]};
  const host=layout.buildDOMComposition(doc,cfg);
  assert.equal(host.id,'a2p-system-layout');
  assert.equal(host.style.width,'1144px');
  assert.equal(host.style.height,'1144px');
  assert.equal(host.style.transform,`scale(${1300/1144})`);
  assert.equal(host.children.length,3);
  assert.equal(host.children[0].dataset.file,'bottom.png');
  assert.equal(host.children[1].dataset.file,'hidden.png');
  assert.equal(host.children[2].dataset.file,'top.png');
  assert.equal(host.children[1].dataset.layerId,'HIDDEN');
  assert.equal(host.children[0].src,'data:image/png;base64,BOTTOM');
  assert.equal(host.children[1].src,'data:image/png;base64,HIDDEN');
  assert.equal(host.children[2].src,'data:image/png;base64,TOP');
  assert.equal(host.children[0].style.left,'30px');
  assert.equal(host.children[0].style.top,'40px');
  assert.match(host.children[0].style.filter,/drop-shadow\(0px 15px 12px rgba\(0,0,0,0\.75\)\)/);
  assert.equal(host.children[1].style.display,'');
  assert.equal(host.children[1].style.visibility,'hidden');
  assert.equal(host.children[1].style.opacity,'0');
  assert.equal(host.children[2].style.filter,'none');
});

test('HTML composition falls back to the legacy asset URL when an embedded asset is absent', () => {
  const doc=fakeDocument();
  const cfg={canvas:{width:1144,height:1144},assets:{},layers:[
    layer('legacy image.png',0,0,true)
  ]};
  const host=layout.buildDOMComposition(doc,cfg);
  assert.equal(host.children[0].src,'tools/GUI_DEV/assets/legacy%20image.png');
});

test('duplicate semantic layer ids are rejected', () => {
  assert.throws(() => layout.validateLayout({
    version:1,
    canvas:{width:1144,height:1144},
    assets:{},
    layers:[
      layer('one.png',0,0,true,'A2P.DISKII.D1.LED'),
      layer('two.png',0,0,true,'A2P.DISKII.D1.LED')
    ]
  }),/Duplicate Apple II layout layer id/);
});

test('layout artwork stays behind emulator canvas and top tab chrome', async () => {
  const tab=fakeElement('div');
  tab.id='tab1';
  tab.firstChild={name:'existing-ui'};
  tab.insertBefore=function(child,before){ this.inserted=child; child.parentNode=this; return child; };
  const app=fakeElement('div');
  app.id='app';
  const ids={tab1:tab,app};
  const doc={
    createElement:fakeElement,
    getElementById(id){ return ids[id] || null; }
  };
  const cfg={version:1,canvas:{width:1144,height:1144},assets:{
    'monitor.png':'data:image/png;base64,MONITOR'
  },layers:[
    layer('monitor.png',0,0,true)
  ]};
  const win={document:doc,composer:cfg,console:{error(){}}};
  const ok=await layout.install(win);
  assert.equal(ok,true);
  assert.equal(tab.style.position,'relative');
  assert.equal(tab.style.zIndex,'0');
  assert.equal(tab.inserted.style.zIndex,'-1');
  assert.equal(app.style.position,'relative');
  assert.equal(app.style.zIndex,'1');
});

test('install uses EMU-owned composer data without requiring Fetch API', async () => {
  const tab=fakeElement('div');
  tab.id='tab1';
  tab.firstChild={name:'existing-ui'};
  tab.insertBefore=function(child,before){ this.inserted=child; child.parentNode=this; return child; };
  const ids={tab1:tab};
  const doc={
    createElement:fakeElement,
    getElementById(id){ return ids[id] || null; }
  };
  const cfg={version:1,canvas:{width:1144,height:1144},assets:{
    'case.png':'data:image/png;base64,CASE'
  },layers:[
    layer('case.png',0,485,true)
  ]};
  const win={
    document:doc,
    composer:cfg,
    console:{error(){}}
  };
  assert.equal(typeof win.fetch,'undefined');
  const ok=await layout.install(win);
  assert.equal(ok,true);
  assert.equal(tab.style.backgroundImage,'none');
  assert.equal(tab.style.position,'relative');
  assert.equal(tab.inserted.id,'a2p-system-layout');
  assert.equal(tab.inserted.children[0].dataset.file,'case.png');
  assert.equal(tab.inserted.children[0].src,'data:image/png;base64,CASE');
});

test('LAYOUT constructor installs as oCOM.LAYOUT and applies pending Disk II facade state', async () => {
  const tab=fakeElement('div');
  tab.id='tab1';
  tab.firstChild={name:'existing-ui'};
  tab.insertBefore=function(child,before){ this.inserted=child; child.parentNode=this; return child; };
  const ids={tab1:tab};
  const doc={
    createElement:fakeElement,
    getElementById(id){ return ids[id] || null; }
  };
  const cfg={version:1,canvas:{width:1144,height:1144},assets:{
    'd1led.png':'data:image/png;base64,D1LED',
    'd2lid.png':'data:image/png;base64,D2LID'
  },layers:[
    layer('d1led.png',154,684,false,'A2P.DISKII.D1.LED'),
    layer('d2lid.png',580,576,true,'A2P.DISKII.D2.LID')
  ]};
  const win={document:doc,composer:cfg,oCOM:{},console:{error(){}}};
  const service=new layout.LAYOUT(win);
  assert.equal(win.oCOM.LAYOUT,service);
  assert.equal(service.A2P.DISKII.D1.LED(),undefined);
  assert.equal(service.A2P.DISKII.D1.LED(true),true);
  assert.equal(service.A2P.DISKII.D2.LID(false),false);

  const ok=await service.install();
  assert.equal(ok,true);
  assert.equal(service.A2P.DISKII.D1.LED(),true);
  assert.equal(service.A2P.DISKII.D2.LID(),false);
  assert.equal(service.getLayer('A2P.DISKII.D1.LED').element.style.display,'');
  assert.equal(service.getLayer('A2P.DISKII.D2.LID').element.style.display,'');
  assert.equal(service.getLayer('A2P.DISKII.D2.LID').element.style.visibility,'hidden');
  assert.equal(service.getLayer('A2P.DISKII.D2.LID').element.style.opacity,'0');
});

test('generic visibility API updates runtime layer model and DOM element atomically', async () => {
  const tab=fakeElement('div');
  tab.id='tab1';
  tab.insertBefore=function(child,before){ this.inserted=child; child.parentNode=this; return child; };
  const doc={
    createElement:fakeElement,
    getElementById(id){ return id==='tab1' ? tab : null; }
  };
  const cfg={version:1,canvas:{width:1144,height:1144},assets:{
    'part.png':'data:image/png;base64,PART'
  },layers:[layer('part.png',1,2,false,'A2P.TEST.PART')]};
  const service=new layout.LAYOUT({document:doc,composer:cfg,console:{error(){}}});
  await service.install();
  assert.equal(service.visible('A2P.TEST.PART'),false);
  assert.equal(service.visible('A2P.TEST.PART',true),true);
  const entry=service.getLayer('A2P.TEST.PART');
  assert.equal(entry.model.visible,true);
  assert.equal(entry.element.style.display,'');
  assert.equal(entry.element.style.visibility,'visible');
  assert.equal(entry.element.style.opacity,'1');
  assert.equal(service.visible('A2P.TEST.PART',false),false);
  assert.equal(entry.model.visible,false);
  assert.equal(entry.element.style.display,'');
  assert.equal(entry.element.style.visibility,'hidden');
  assert.equal(entry.element.style.opacity,'0');
});

test('COM_LAYOUT_CONFIG owns composer layout data and compositor has no JSON HTTP loader', () => {
  assert.match(layoutConfigSource,/\bvar\s+composer\s*=/);
  assert.match(layoutConfigSource,/A2P_FULL_DISKII_LED\.png/);
  assert.doesNotMatch(emuMainSource,/\bvar\s+composer\s*=/);
  assert.doesNotMatch(emuMainSource,/A2P_FULL_DISKII_LED\.png/);
  assert.match(compositorSource,/function\s+LAYOUT\s*\(/);
  assert.match(compositorSource,/oCOM\.LAYOUT/);
  assert.doesNotMatch(compositorSource,/apple2-layout-embedded_v2\.json/);
  assert.doesNotMatch(compositorSource,/\.fetch\s*\(/);
  assert.doesNotMatch(compositorSource,/\(function\s*\(\s*root\s*,\s*factory\s*\)/);
  assert.doesNotMatch(compositorSource,/factory\s*\(\s*root\s*\)/);
});
