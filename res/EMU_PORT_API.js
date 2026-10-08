// Buffered remote-end facade for byte-stream devices. No terminal dependency.
function EMU_SCRIPT_PORT(cfg)
{
    var port = this;
    var capacity = cfg.maxBuffer || 65536;
    var buffer = new Uint8Array(capacity);
    var head = 0;
    var count = 0;
    var closed = false;
    var overflow = null;
    var pending = null;
    var observers = [];

    function error(name,message)
    {
        var result = new Error(message);
        result.name = name;
        return result;
    }

    function checkOpen()
    {
        if(closed) throw error("AbortError","Port facade is closed");
        if(overflow)
        {
            var failure = overflow;
            overflow = null;
            throw failure;
        }
    }

    function take(size)
    {
        var bytes = new Uint8Array(size);
        for(var i=0;i<size;i++) bytes[i] = buffer[(head+i)%capacity];
        head = (head+size)%capacity;
        count -= size;
        return bytes;
    }

    function byteText(bytes)
    {
        var text = "";
        for(var i=0;i<bytes.length;i++) text += String.fromCharCode(bytes[i]);
        return text;
    }

    function settle(failure,value)
    {
        var wait = pending;
        if(!wait) return;
        pending = null;
        clearTimeout(wait.timer);
        if(wait.worker) wait.worker.terminate();
        if(wait.url) URL.revokeObjectURL(wait.url);
        if(wait.signal) wait.signal.removeEventListener("abort",wait.abort);
        if(failure) wait.reject(failure);
        else wait.resolve(value);
    }

    function matchPending()
    {
        if(!pending) return;
        var text = pending.text;
        var end = -1;
        if(typeof(pending.pattern)==="string")
        {
            var start = text.indexOf(pending.pattern);
            if(start>=0) end = start+pending.pattern.length;
        }
        else
        {
            // A user RegExp may backtrack indefinitely. Keep all evaluation
            // off the emulator thread, with only one snapshot in flight.
            if(pending.matching) return;
            pending.matching = true;
            pending.snapshotLength = text.length;
            pending.worker.postMessage({text:text});
            return;
        }
        if(end>=0)
        {
            take(end);
            settle(null,text.slice(0,end));
        }
    }

    var unsubscribe = cfg.subscribe(function(bytes)
    {
        if(closed) return;
        if(count+bytes.length>capacity)
        {
            head = count = 0;
            var failure = error("RangeError","Port receive buffer overflow; flush or read before continuing");
            if(pending) settle(failure);
            else overflow = failure;
        }
        else
        {
            for(var i=0;i<bytes.length;i++) buffer[(head+count+i)%capacity] = bytes[i];
            count += bytes.length;
            if(pending)
            {
                pending.text += byteText(bytes);
                matchPending();
            }
        }
        var snapshot = observers.slice();
        for(var j=0;j<snapshot.length;j++)
        {
            try { snapshot[j](new Uint8Array(bytes)); }
            catch(failure) { console.error("Port receive callback failed",failure); }
        }
    });

    this.write = function(data)
    {
        checkOpen();
        return cfg.write(EMU_SCRIPT_PORT.bytes(data));
    };

    this.read = function(size)
    {
        checkOpen();
        if(pending) throw new Error("A waitFor is pending; cancel it before reading");
        if(size===undefined) size = count;
        if(!Number.isInteger(size) || size<0) throw new RangeError("Invalid byte count");
        return take(Math.min(size,count));
    };

    this.available = function()
    {
        checkOpen();
        return count;
    };

    this.flush = function()
    {
        if(closed) throw error("AbortError","Port facade is closed");
        var discarded = count;
        head = count = 0;
        overflow = null;
        settle(error("AbortError","Port buffer flushed"));
        return discarded;
    };

    this.waitFor = function(pattern,timeout,signal)
    {
        return new Promise(function(resolve,reject)
        {
            try
            {
                checkOpen();
                if(pending) throw new Error("A waitFor is already pending");
                if(typeof(pattern)==="string")
                {
                    if(!pattern.length) throw new TypeError("Pattern must not be empty");
                }
                else if(Object.prototype.toString.call(pattern)==="[object RegExp]")
                    pattern = new RegExp(pattern.source,pattern.flags.replace(/[gy]/g,""));
                else throw new TypeError("Pattern must be a string or RegExp");
                if(timeout===undefined) timeout = 3000;
                if(!Number.isFinite(timeout) || timeout<0 || timeout>2147483647)
                    throw new RangeError("Invalid timeout");
                if(signal && signal.aborted) throw error("AbortError","Script stopped");
            }
            catch(failure) { reject(failure); return; }

            var text = "";
            for(var i=0;i<count;i++) text += String.fromCharCode(buffer[(head+i)%capacity]);
            var wait = {pattern:pattern,text:text,resolve:resolve,reject:reject,signal:signal};
            pending = wait;
            pending.abort = function()
            {
                if(pending===wait) settle(error("AbortError","Script stopped"));
            };
            pending.timer = setTimeout(function()
            {
                settle(error("TimeoutError","Port waitFor timed out after "+timeout+" ms"));
            },timeout);
            if(signal) signal.addEventListener("abort",pending.abort,{once:true});
            if(typeof(pattern)!=="string")
            {
                try
                {
                    wait.url = URL.createObjectURL(new Blob([
                        "("+EMU_SCRIPT_PORT.matchWorker.toString()+")();"
                    ],{type:"text/javascript"}));
                    wait.worker = new Worker(wait.url);
                    wait.worker.onerror = function(event)
                    {
                        event.preventDefault();
                        if(pending===wait) settle(error("WorkerError",event.message));
                    };
                    wait.worker.onmessage = function(event)
                    {
                        if(pending!==wait) return;
                        wait.matching = false;
                        var end = event.data.end;
                        if(end>=0)
                        {
                            take(end);
                            settle(null,wait.text.slice(0,end));
                        }
                        else if(wait.text.length!==wait.snapshotLength) matchPending();
                    };
                    wait.worker.postMessage({source:pattern.source,flags:pattern.flags});
                }
                catch(failure) { settle(failure); return; }
            }
            matchPending();
        });
    };

    this.onReceive = function(callback)
    {
        checkOpen();
        if(typeof(callback)!=="function") throw new TypeError("Callback must be a function");
        observers.push(callback);
        var active = true;
        return function()
        {
            if(!active) return;
            active = false;
            var index = observers.indexOf(callback);
            if(index>=0) observers.splice(index,1);
        };
    };

    this.dispose = function()
    {
        if(closed) return;
        closed = true;
        unsubscribe();
        observers.length = 0;
        head = count = 0;
        settle(error("AbortError","Port facade is closed"));
    };
}

EMU_SCRIPT_PORT.matchWorker = function()
{
    var pattern;
    self.onmessage = function(event)
    {
        var data = event.data;
        if(data.source!==undefined) pattern = new RegExp(data.source,data.flags);
        else
        {
            pattern.lastIndex = 0;
            var match = pattern.exec(data.text);
            self.postMessage({end:match ? match.index+match[0].length : -1});
        }
    };
};

EMU_SCRIPT_PORT.bytes = function(data)
{
    if(typeof(data)==="string")
    {
        var bytes = new Uint8Array(data.length);
        for(var i=0;i<data.length;i++)
        {
            var value = data.charCodeAt(i);
            if(value>255) throw new RangeError("Serial text must contain only 8-bit characters");
            bytes[i] = value;
        }
        return bytes;
    }
    if(data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
    if(ArrayBuffer.isView(data))
        return new Uint8Array(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));
    if(Number.isInteger(data)) data = [data];
    if(Array.isArray(data) && data.every(function(value)
        { return Number.isInteger(value) && value>=0 && value<=255; }))
        return new Uint8Array(data);
    throw new TypeError("Expected byte, byte array, ArrayBuffer or 8-bit string");
};
