'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const INDEX_HTML=path.join(ROOT,'index.html');

function scriptPosition(html,src)
{
    const marker='src="'+src+'"';
    const pos=String(html).indexOf(marker);
    assert.notEqual(pos,-1,'index.html must load '+src);
    return pos;
}

test('index.html loads only the historical Dithertizer card without ConvertHGR',()=>{
    const html=fs.readFileSync(INDEX_HTML,'utf8');
    scriptPosition(html,'res/EMU_CARD_dithertizer.js');
    for(const src of ['res/EMU_DITHERTIZER_converthgr_worker.js','res/EMU_DITHERTIZER_converthgr.js'])
        assert.equal(html.includes('src="'+src+'"'),false,src+' must not load in the historical card path');
});
