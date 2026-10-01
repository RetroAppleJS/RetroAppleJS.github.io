//
// EMU_DITHERTIZER_converthgr.js
//
// Thin adapter around the existing ConvertHGR browser worker. The worker is
// sourced from tools/ConvertHGR.html so the Dithertizer and the standalone tool
// execute the same conversion code. Live Dithertizer conversion requires the
// worker's WASM backend; JavaScript quantizer fallback is rejected.
//

function DithertizerConvertHGRAdapter(options)
{
    options=options || {};

    var worker=null;
    var workerBlobURL=null;
    var initPromise=null;
    var requestSeq=0;
    var pending=null;
    var settings=null;
    var closed=false;

    function failPending(error)
    {
        if(!pending) return;
        var p=pending;
        pending=null;
        p.reject(error instanceof Error ? error : new Error(String(error)));
    }

    function workerMessage(event)
    {
        var msg=event && event.data ? event.data : {};
        if(!pending || Number(msg.requestId)!==pending.requestId)
            return;

        if(msg.type==="progress") return;

        if(msg.type==="error")
        {
            failPending(new Error("ConvertHGR worker: "+String(msg.message || msg.code || "conversion failed")));
            return;
        }

        if(msg.type!=="conversionResult") return;

        var p=pending;
        pending=null;

        var metadata=msg.metadata || {};
        if(metadata.backendUsed!=="wasm")
        {
            p.reject(new Error("ConvertHGR WASM backend required; worker used "+String(metadata.backendUsed || "unknown")+
                (metadata.fallbackReason ? " ("+metadata.fallbackReason+")" : "")));
            return;
        }

        var buffers=msg.buffers || {};
        var paletteBuffer=buffers.paletteImage;
        if(!(paletteBuffer instanceof ArrayBuffer) || paletteBuffer.byteLength!==280*192)
        {
            p.reject(new Error("ConvertHGR worker returned an invalid 280x192 palette buffer"));
            return;
        }

        p.resolve({
             width:280
            ,height:192
            ,backendUsed:"wasm"
            ,metadata:metadata
            ,timing:msg.timing || {}
            ,processedRGB:buffers.processedRGB instanceof ArrayBuffer ? new Uint8Array(buffers.processedRGB) : null
            ,paletteIndex:new Uint8Array(paletteBuffer)
            ,linearHGR:buffers.linearHgr instanceof ArrayBuffer ? new Uint8Array(buffers.linearHgr) : null
            ,hgrPage:buffers.hgrPage instanceof ArrayBuffer ? new Uint8Array(buffers.hgrPage) : null
        });
    }

    this.init=function()
    {
        if(closed) return Promise.reject(new Error("ConvertHGR adapter is closed"));
        if(worker) return Promise.resolve(this);
        if(initPromise) return initPromise;

        var sourceURL=String(options.workerSourceUrl || "tools/ConvertHGR.html");
        var fetchFn=options.fetch || (typeof(fetch)==="function" ? fetch : null);
        var WorkerCtor=options.Worker || (typeof(Worker)!=="undefined" ? Worker : null);
        var BlobCtor=options.Blob || (typeof(Blob)!=="undefined" ? Blob : null);
        var URLApi=options.URL || (typeof(URL)!=="undefined" ? URL : null);

        if(!fetchFn || !WorkerCtor || !BlobCtor || !URLApi || typeof(URLApi.createObjectURL)!=="function")
            return Promise.reject(new Error("ConvertHGR worker APIs are unavailable"));

        var self=this;
        initPromise=Promise.resolve(fetchFn(sourceURL)).then(function(response)
        {
            if(!response || response.ok===false || typeof(response.text)!=="function")
                throw new Error("Unable to load "+sourceURL);
            return response.text();
        }).then(function(html)
        {
            var match=String(html).match(/<script\s+id=["']worker-source["'][^>]*>([\s\S]*?)<\/script>/i);
            if(!match || !match[1])
                throw new Error("ConvertHGR worker-source script was not found");

            var blob=new BlobCtor([match[1]],{type:"text/javascript"});
            workerBlobURL=URLApi.createObjectURL(blob);
            worker=new WorkerCtor(workerBlobURL);
            worker.onmessage=workerMessage;
            worker.onerror=function(event)
            {
                failPending(new Error("ConvertHGR worker error: "+String(event && event.message || "worker failure")));
            };
            return self;
        }).catch(function(error)
        {
            initPromise=null;
            throw error;
        });

        return initPromise;
    };

    this.configure=function(nextSettings)
    {
        if(!nextSettings || typeof(nextSettings)!=="object")
            throw new TypeError("ConvertHGR settings object required");
        settings=JSON.parse(JSON.stringify(nextSettings));
        return this;
    };

    this.convert=function(rgb,width,height,seed)
    {
        if(closed) return Promise.reject(new Error("ConvertHGR adapter is closed"));
        if(!worker) return Promise.reject(new Error("ConvertHGR adapter is not initialized"));
        if(pending) return Promise.reject(new Error("ConvertHGR conversion already in flight"));
        if(!settings) return Promise.reject(new Error("ConvertHGR adapter is not configured"));

        width=Number(width)|0;
        height=Number(height)|0;
        if(width<=0 || height<=0)
            return Promise.reject(new Error("ConvertHGR source dimensions must be positive"));

        if(rgb instanceof ArrayBuffer) rgb=new Uint8Array(rgb);
        else if(typeof(ArrayBuffer)!=="undefined" && typeof(ArrayBuffer.isView)==="function" && ArrayBuffer.isView(rgb))
            rgb=new Uint8Array(rgb.buffer,rgb.byteOffset,rgb.byteLength);
        if(!rgb || rgb.byteLength!==width*height*3)
            return Promise.reject(new Error("ConvertHGR source must be tightly packed RGB24"));

        var transferBuffer;
        if(rgb.byteOffset===0 && rgb.byteLength===rgb.buffer.byteLength)
            transferBuffer=rgb.buffer;
        else
            transferBuffer=new Uint8Array(rgb).buffer;

        var requestId=++requestSeq;
        return new Promise(function(resolve,reject)
        {
            pending={requestId:requestId,resolve:resolve,reject:reject};
            try
            {
                worker.postMessage({
                     type:"convert"
                    ,requestId:requestId
                    ,settings:settings
                    ,source:{rgbBuffer:transferBuffer,width:width,height:height}
                    ,randomSeed:Number(seed)>>>0
                    ,backend:"wasm"
                },[transferBuffer]);
            }
            catch(error)
            {
                pending=null;
                reject(error);
            }
        });
    };

    this.close=function()
    {
        if(closed) return;
        closed=true;
        failPending(new Error("ConvertHGR adapter closed"));
        if(worker && typeof(worker.terminate)==="function") worker.terminate();
        worker=null;
        initPromise=null;
        if(workerBlobURL)
        {
            var URLApi=options.URL || (typeof(URL)!=="undefined" ? URL : null);
            if(URLApi && typeof(URLApi.revokeObjectURL)==="function") URLApi.revokeObjectURL(workerBlobURL);
        }
        workerBlobURL=null;
    };
}
