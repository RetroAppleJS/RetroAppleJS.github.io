// Exercise browser worker code using real Node worker threads, including
// termination of runaway JavaScript. DOM/layout tests remain browser-only.
const {Worker} = require('node:worker_threads');
const {resolveObjectURL} = require('node:buffer');
module.exports = class WebWorker
{
    constructor(url)
    {
        this.queue = [];
        this.closed = false;
        resolveObjectURL(url).text().then(source =>
        {
            if(this.closed) return;
            this.worker = new Worker(`const {parentPort}=require('node:worker_threads');
                global.self={postMessage:m=>parentPort.postMessage(m),addEventListener:(name,callback)=>{
                if(name==='unhandledrejection') process.on('unhandledRejection',reason=>callback({reason,preventDefault(){}}));}};
                parentPort.on('message',data=>self.onmessage({data}));\n${source}`,{eval:true});
            this.worker.on('message',data => this.onmessage?.({data}));
            this.worker.on('error',error => this.onerror?.({message:error.message,preventDefault(){}}));
            this.queue.forEach(message => this.worker.postMessage(message));
            this.queue = [];
        });
    }
    postMessage(message)
    {
        if(this.closed) return;
        if(this.worker) this.worker.postMessage(message);
        else this.queue.push(message);
    }
    terminate()
    {
        this.closed = true;
        this.worker?.terminate();
    }
};
