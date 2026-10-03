'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');

function loadAdapter(workerMode='wasm',options={})
{
    const source=fs.readFileSync(path.join(ROOT,'res','EMU_DITHERTIZER_converthgr.js'),'utf8');
    const posted=[];
    const blobs=[];
    const workerSource=Object.prototype.hasOwnProperty.call(options,'workerSource') ? options.workerSource : 'self.onmessage=function(){};';
    let fetchCalls=0;

    class FakeBlob
    {
        constructor(parts,options){this.parts=parts;this.type=options&&options.type;blobs.push(this);}
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
                    backendRequested:msg.backend,
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

    const sandbox={
        console,Uint8Array,ArrayBuffer,Promise,Error,TypeError,JSON,Math,Number,String,Object,queueMicrotask,
        Blob:FakeBlob,
        Worker:FakeWorker,
        fetch:async()=>{fetchCalls++;throw new Error('fetch must not be used');},
        URL:{createObjectURL(){return 'blob:worker';},revokeObjectURL(){}},
        document:{baseURI:'file:///RetroAppleJS/index.html'}
    };
    if(workerSource!==undefined) sandbox.CONVERTHGR_WORKER_SOURCE=workerSource;

    vm.createContext(sandbox);
    vm.runInContext(source+'\nthis.Adapter=DithertizerConvertHGRAdapter;',sandbox,{filename:'EMU_DITHERTIZER_converthgr.js'});
    return {Adapter:sandbox.Adapter,posted,blobs,getFetchCalls:()=>fetchCalls,workerSource};
}

test('adapter initializes from bundled worker source without fetch',async()=>{
    const {Adapter,blobs,getFetchCalls,workerSource}=loadAdapter('wasm');
    const adapter=new Adapter();

    await adapter.init();

    assert.equal(getFetchCalls(),0);
    assert.equal(blobs.length,1);
    assert.equal(blobs[0].parts.length,1);
    assert.equal(blobs[0].parts[0],workerSource);
    assert.equal(blobs[0].type,'text/javascript');
});

test('adapter rejects missing bundled worker source with a clear error',async()=>{
    const {Adapter}=loadAdapter('wasm',{workerSource:undefined});
    const adapter=new Adapter();

    await assert.rejects(
        adapter.init(),
        /bundled worker source is unavailable/
    );
});

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

test('adapter explicitly selects JavaScript and can switch back to WASM',async()=>{
    const {Adapter:JavaScriptAdapter,posted}=loadAdapter('javascript');
    const adapter=new JavaScriptAdapter({backend:'javascript'});
    await adapter.init();
    adapter.configure({image:{gamma:1.3}});
    const result=await adapter.convert(new Uint8Array(12),2,2,1);
    assert.equal(posted[0].backend,'javascript');
    assert.equal(result.backendUsed,'javascript');
    adapter.setBackend('wasm');
    await assert.rejects(adapter.convert(new Uint8Array(12),2,2,1),/WASM backend required/);
    assert.equal(posted[1].backend,'wasm');
});
