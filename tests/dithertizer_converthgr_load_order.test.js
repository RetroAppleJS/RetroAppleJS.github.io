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

test('index.html loads ConvertHGR worker source before adapter and Dithertizer card',()=>{
    const html=fs.readFileSync(INDEX_HTML,'utf8');

    const worker=scriptPosition(html,'res/EMU_DITHERTIZER_converthgr_worker.js');
    const adapter=scriptPosition(html,'res/EMU_DITHERTIZER_converthgr.js');
    const card=scriptPosition(html,'res/EMU_CARD_dithertizer.js');

    assert.ok(
        worker<adapter,
        'EMU_DITHERTIZER_converthgr_worker.js must load before EMU_DITHERTIZER_converthgr.js'
    );
    assert.ok(
        adapter<card,
        'EMU_DITHERTIZER_converthgr.js must load before EMU_CARD_dithertizer.js'
    );
});
