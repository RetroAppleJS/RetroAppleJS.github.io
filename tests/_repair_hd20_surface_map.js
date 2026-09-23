'use strict';
const fs=require('node:fs');
const path='res/EMU_CARD_LIRON.js';
let src=fs.readFileSync(path,'utf8');
const matches=src.match(/!==="/g)||[];
if(matches.length<1) throw new Error('no malformed strict-inequality tokens found');
src=src.replace(/!==="/g,'!=="');
fs.writeFileSync(path,src);
console.log('repaired',matches.length,'HD20 surface-map strict-inequality tokens');
