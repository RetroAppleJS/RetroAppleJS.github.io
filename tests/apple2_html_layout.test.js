'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const layout = require('../res/COM_A2P_LAYOUT.js');

const repoRoot=path.join(__dirname,'..');
const emuMainSource=fs.readFileSync(path.join(repoRoot,'res','EMU_apple2main.js'),'utf8');
const compositorSource=fs.readFileSync(path.join(repoRoot,'res','COM_A2P_LAYOUT.js'),'utf8');

test('Apple II layout exposes an HTML composition builder', () => {
  assert.equal(typeof layout.buildDOMComposition, 'function');
});

function fakeElement(tag) {
  return {
    tagName: tag.toUpperCase(),
    style: {},
    dataset: {},
    children: [],
    appendChild(child) { this.children.push(child); child.parentNode=this; return child; },
    setAttribute() {}
  };
}
function fakeDocument() { return { createElement: fakeElement }; }

test('HTML composition preserves JSON top-to-bottom stacking, geometry, shadows and embedded assets', () => {
  const doc=fakeDocument();
  const cfg={canvas:{width:1144,height:1144},assets:{
    'top.png':'data:image/png;base64,TOP',
    'bottom.png':'data:image/png;base64,BOTTOM'
  },layers:[
    {file:'top.png',x:10,y:20,visible:true,shadow:{enabled:false,offsetX:0,offsetY:0,blur:0,opacity:0}},
    {file:'hidden.png',x:0,y:0,visible:false,shadow:{enabled:false,offsetX:0,offsetY:0,blur:0,opacity:0}},
    {file:'bottom.png',x:30,y:40,visible:true,shadow:{enabled:true,offsetX:0,offsetY:15,blur:12,opacity:.75}}
  ]};
  const host=layout.buildDOMComposition(doc,cfg);
  assert.equal(host.id,'a2p-system-layout');
  assert.equal(host.style.width,'1144px');
  assert.equal(host.style.height,'1144px');
  assert.equal(host.style.transform,`scale(${1300/1144})`);
  assert.equal(host.children.length,2);
  assert.equal(host.children[0].dataset.file,'bottom.png');
  assert.equal(host.children[1].dataset.file,'top.png');
  assert.equal(host.children[0].src,'data:image/png;base64,BOTTOM');
  assert.equal(host.children[1].src,'data:image/png;base64,TOP');
  assert.equal(host.children[0].style.left,'30px');
  assert.equal(host.children[0].style.top,'40px');
  assert.match(host.children[0].style.filter,/drop-shadow\(0px 15px 12px rgba\(0,0,0,0\.75\)\)/);
  assert.equal(host.children[1].style.filter,'none');
});

test('HTML composition falls back to the legacy asset URL when an embedded asset is absent', () => {
  const doc=fakeDocument();
  const cfg={canvas:{width:1144,height:1144},assets:{},layers:[
    {file:'legacy image.png',x:0,y:0,visible:true,shadow:{enabled:false,offsetX:0,offsetY:15,blur:12,opacity:.75}}
  ]};
  const host=layout.buildDOMComposition(doc,cfg);
  assert.equal(host.children[0].src,'tools/GUI_DEV/assets/legacy%20image.png');
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
    {file:'monitor.png',x:0,y:0,visible:true,shadow:{enabled:false,offsetX:0,offsetY:15,blur:12,opacity:.75}}
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
    {file:'case.png',x:0,y:485,visible:true,shadow:{enabled:false,offsetX:0,offsetY:15,blur:12,opacity:.75}}
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

test('EMU_apple2main owns composer layout data and compositor has no JSON HTTP loader', () => {
  assert.match(emuMainSource,/\bvar\s+composer\s*=/);
  assert.match(compositorSource,/rootWindow\.composer/);
  assert.doesNotMatch(compositorSource,/apple2-layout-embedded_v2\.json/);
  assert.doesNotMatch(compositorSource,/\.fetch\s*\(/);
});
