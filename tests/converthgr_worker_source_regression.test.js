'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const TOOL_HTML=path.join(ROOT,'tools','ConvertHGR.html');
const BUNDLED_WORKER=path.join(ROOT,'res','EMU_DITHERTIZER_converthgr_worker.js');

function extractToolWorkerSource(html)
{
    const match=String(html).match(/<script\s+id=["']worker-source["'][^>]*>([\s\S]*?)<\/script>/i);
    assert.ok(match && typeof(match[1])==='string','tools/ConvertHGR.html must contain a worker-source script block');
    return match[1];
}

function extractBundledWorkerSource(js)
{
    const begin='/* CONVERTHGR_WORKER_SOURCE_BEGIN\n';
    const end='\nCONVERTHGR_WORKER_SOURCE_END */';
    const i=String(js).indexOf(begin);
    const j=String(js).lastIndexOf(end);

    assert.notEqual(i,-1,'bundled worker must contain CONVERTHGR_WORKER_SOURCE_BEGIN marker');
    assert.notEqual(j,-1,'bundled worker must contain CONVERTHGR_WORKER_SOURCE_END marker');
    assert.ok(j>i,'bundled worker source markers must be ordered');

    return String(js).slice(i+begin.length,j);
}

function firstMismatch(a,b)
{
    const n=Math.min(a.length,b.length);
    for(let i=0;i<n;i++)
        if(a.charCodeAt(i)!==b.charCodeAt(i)) return i;
    return a.length===b.length ? -1 : n;
}

test('bundled ConvertHGR worker body matches tools/ConvertHGR.html worker-source byte-for-byte',()=>{
    assert.ok(fs.existsSync(BUNDLED_WORKER),'res/EMU_DITHERTIZER_converthgr_worker.js must exist');

    const toolWorker=extractToolWorkerSource(fs.readFileSync(TOOL_HTML,'utf8'));
    const bundledWorker=extractBundledWorkerSource(fs.readFileSync(BUNDLED_WORKER,'utf8'));

    const mismatch=firstMismatch(bundledWorker,toolWorker);
    assert.equal(
        mismatch,
        -1,
        mismatch<0 ? undefined :
            `bundled worker differs from tools/ConvertHGR.html worker-source at byte ${mismatch} `+
            `(bundled length ${bundledWorker.length}, tool length ${toolWorker.length})`
    );
});
