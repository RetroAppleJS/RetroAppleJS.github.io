'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');

function loadAdapter(workerMode='wasm')
{
    const source=fs.readFileSync(path.join(ROOT,'res','EMU_DITHERTIZER_converthgr.js'),'utf8');
    const posted=[];

    class FakeBlob
    {
        constructor(parts,options){this.parts=parts;this.type=options&&options.type;}
    }

    class FakeWorker
    {
        constructor(url){this.url=url;this.onmessage=null;this.onerror=null;}
        postMessage(msg)
        {
            posted.push(msg);
            if(msg.type!=='convert') return;

            const palette=new Uint8Array(280*192);
            for(let x=0;x<7;x++) palette[x]=(x%2===0)?3:0;

            queueMicrotask(()=>this.onmessage({data:{
                type:'conversionResult',
                requestId:msg.requestId,
                metadata:{
                    backendRequested:'wasm',
                    backendUsed:workerMode,
                    fallbackReason:workerMode==='wasm'?'':'simulated fallback'
                },
                buffers:{
                    processedRGB:new Uint8Array(280*192*3).buffer,
                    paletteImage:palette.buffer,
                    linearHgr:new Uint8Array(7680).buffer,
                    hgrPage:new Uint8Array(8192).buffer
                }
            }}));
        }
        terminate(){}
    }

    const fakeHTML='before<script id="worker-source" type="text/plain">self.onmessage=function(){};<\/script>after';
    const sandbox={
        console,Uint8Array,ArrayBuffer,Promise,Error,TypeError,JSON,Math,Number,String,Object,queueMicrotask,
        Blob:FakeBlob,
        Worker:FakeWorker,
        fetch:async()=>({ok:true,text:async()=>fakeHTML}),
        URL:{createObjectURL(){return 'blob:worker';},revokeObjectURL(){}},
        document:{baseURI:'https://example.test/index.html'}
    };

    vm.createContext(sandbox);
    vm.runInContext(source+'\nthis.Adapter=DithertizerConvertHGRAdapter;',sandbox,{filename:'EMU_DITHERTIZER_converthgr.js'});
    return {Adapter:sandbox.Adapter,posted};
}

test('adapter forces ConvertHGR worker to WASM and returns the processed 280x192 palette index',async()=>{
    const {Adapter,posted}=loadAdapter('wasm');
    const adapter=new Adapter();
    await adapter.init();
    adapter.configure({image:{gamma:1.3}});

    const result=await adapter.convert(new Uint8Array(12),2,2,0x12345678);
    const convert=posted.find(x=>x.type==='convert');

    assert.equal(convert.backend,'wasm');
    assert.equal(convert.source.width,2);
    assert.equal(convert.source.height,2);
    assert.equal(result.paletteIndex.length,280*192);
    assert.equal(result.backendUsed,'wasm');
});

test('adapter rejects the ConvertHGR JavaScript fallback instead of publishing it',async()=>{
    const {Adapter}=loadAdapter('javascript');
    const adapter=new Adapter();
    await adapter.init();
    adapter.configure({image:{gamma:1.3}});

    await assert.rejects(
        adapter.convert(new Uint8Array(12),2,2,1),
        /WASM backend required/
    );
});
