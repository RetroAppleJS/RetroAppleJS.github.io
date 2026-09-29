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

replaceOnce(
  '    <button id="importBtn">Import Images</button>\n    <button id="loadBtn">Load Layout</button>',
  '    <button id="importBtn">Import Images</button>\n    <button id="unloadImagesBtn" type="button">Unload Images</button>\n    <button id="loadBtn">Load Layout</button>',
  'Unload Images toolbar insertion');

replaceOnce(
  "  refreshUI();renderPreview(); if(errors.length) alert(errors.join('\\n')); imageInput.value='';\n}\nfunction removeSelectedLayer(){",
  "  refreshUI();renderPreview(); if(errors.length) alert(errors.join('\\n')); imageInput.value='';\n}\nfunction unloadImages(){\n  for(const asset of state.assets.values()) if(asset?.objectUrl) URL.revokeObjectURL(asset.objectUrl);\n  state.assets.clear();\n  for(const layer of state.layers){\n    layer.image=null;\n    layer.width=0;\n    layer.height=0;\n    layer.resolved=false;\n  }\n  refreshUI();\n  renderPreview();\n}\nfunction removeSelectedLayer(){",
  'unloadImages implementation');

replaceOnce(
  "$('importBtn').addEventListener('click',()=>imageInput.click());imageInput.addEventListener('change',()=>importImageFiles(imageInput.files));\n$('loadBtn').addEventListener('click',()=>layoutInput.click());",
  "$('importBtn').addEventListener('click',()=>imageInput.click());imageInput.addEventListener('change',()=>importImageFiles(imageInput.files));\n$('unloadImagesBtn').addEventListener('click',unloadImages);\n$('loadBtn').addEventListener('click',()=>layoutInput.click());",
  'Unload Images click binding');

fs.writeFileSync(file,html);
console.log('Applied Composer v3 Task 3 unload-images patch.');
