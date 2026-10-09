'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Minimal DOM surface for worker/runtime tests only; rendering and interactions
// are exercised by port_script_browser.js in a real browser.
function element()
{
    return {style:{},classList:{add() {}},textContent:'',value:'',children:[],attributes:{},
        setAttribute(name,value) { this.attributes[name]=value; },
        removeAttribute(name) { delete this.attributes[name]; },
        appendChild(node) { this.children.push(node); },replaceChildren() {},remove() {},focus() {}};
}

function harness(t,peer,config)
{
    const saved=new Map();
    const ctx = {console,Worker:require('./helpers/web_worker'),Blob,URL,AbortController,
        setTimeout,clearTimeout,Uint8Array,ArrayBuffer,document:{createElement:element},
        localStorage:{getItem:key => saved.get(key) || null,setItem:(key,value) => saved.set(key,value)}};
    vm.createContext(ctx);
    for(const file of ['EMU_PORT_API.js','EMU_DEVICE_serialpro_line.js','EMU_DEVICE_serialpro_terminal.js','EMU_PORT_SCRIPT.js'])
        vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res',file),'utf8'),ctx);
    const line = new ctx.SerialProLine(), terminal = new ctx.SerialProTerminalDevice();
    const sent = [], rows = [];
    line.bindHost(Object.assign({serialLineReceiveBytes(bytes)
    {
        sent.push(...bytes);
        line.transmitBytes(new Uint8Array([79,75,13]));
        return bytes.length;
    }},peer));
    terminal.bindHost({serialTerminalScriptWrite(text,channel)
        { rows.push({text,channel}); return text.length; },serialTerminalClear() { rows.length=0; return true; }});
    const ui = new ctx.EMU_PORT_SCRIPT(Object.assign({container:element(),port:line.getScriptAPI(),api:line.API,
        console:terminal.getScriptAPI(),consoleAPI:terminal.API},config));
    t.after(() => ui.destroy());
    return {ui,line,sent,rows,saved};
}

function transcript(h) { return h.rows.map(row => row.text).join(''); }

test('one execution button toggles play and stop and resets after termination or completion', async t =>
{
    const h=harness(t), button=h.ui.runButton;
    assert.equal(h.ui.toolbar.children.filter(node => node.attributes &&
        ('data-port-script-run' in node.attributes || 'data-port-script-stop' in node.attributes)).length,1);
    assert.equal(button.children[0].className,'fa fa-play');
    h.ui.editor.value='await sleep(60000);';
    button.onclick();
    const pending=h.ui.run();
    assert.equal(h.ui.isRunning,true);
    assert.equal(button.disabled,false);
    assert.equal(button.children[0].className,'fa fa-stop');
    assert.equal(button.title,'Stop script');
    assert.equal(button.attributes['aria-label'],'Stop script');
    button.onclick();
    assert.equal((await pending).status,'stopped');
    assert.equal(button.children[0].className,'fa fa-play');
    assert.equal(button.title,'Run script');
    assert.equal(button.attributes['aria-label'],'Run script');
    assert.equal((await h.ui.run('log("complete");')).status,'complete');
    assert.equal(button.children[0].className,'fa fa-play');
});

test('log output and script errors go to the terminal without injecting UART bytes', async t =>
{
    const h=harness(t);
    assert.equal((await h.ui.run('log("hello", new Uint8Array([0,255]), {state:"ready"}); throw new Error("boom");')).status,'error');
    assert.deepEqual(h.rows,[
        {text:'hello [0,255] {"state":"ready"}\n',channel:'meta'},
        {text:'Error: boom\n',channel:'meta'}
    ]);
    assert.deepEqual(h.sent,[]);
});

test('clearing source persists an empty editor and leaves the terminal and current run alone', async t =>
{
    const h=harness(t,null,{storageKey:'source'});
    const running=h.ui.run('log("running"); await sleep(60000);');
    await until(() => transcript(h).includes('running'));
    const before=transcript(h);
    h.ui.clear();
    assert.equal(h.ui.editor.value,'');
    assert.equal(JSON.parse(h.saved.get('source')).source,'');
    assert.equal(transcript(h),before);
    assert.equal(h.ui.isRunning,true);
    h.ui.stop();assert.equal((await running).status,'stopped');
});

test('a script starts GPT through the port contract and Stop aborts its session', async t =>
{
    let signal,mode,enabled=false;
    const h = harness(t,{
        serialGPTStart(selected,abortSignal)
        {
            mode=selected; signal=abortSignal; enabled=true;
            signal.addEventListener('abort',() => { enabled=false; },{once:true});
            return true;
        },
        serialGPTInfo() { return {enabled}; }
    });
    const running=h.ui.run('await port.startGPT("ascii"); log((await port.gptInfo()).enabled); await sleep(60000);');
    await until(() => transcript(h).includes('true'));
    assert.equal(mode,'ascii');
    assert.equal(enabled,true);
    h.ui.stop();
    assert.equal((await running).status,'stopped');
    assert.equal(signal.aborted,true);
    assert.equal(enabled,false);
});

test('disposal cancels a pending GPT start and a closed facade cannot start another session', async t =>
{
    let signal;
    const h=harness(t,{
        serialGPTStart(mode,abortSignal)
        {
            signal=abortSignal;
            return new Promise(resolve => signal.addEventListener('abort',() => resolve(false),{once:true}));
        }
    });
    const running=h.ui.run('await port.startGPT("utf16le");');
    await until(() => signal);
    const port=h.ui.port;
    h.ui.destroy();
    assert.equal((await running).status,'stopped');
    assert.equal(signal.aborted,true);
    assert.throws(() => port.startGPT('ascii'),/closed/i);
});

async function until(condition)
{
    const start = Date.now();
    while(!condition())
    {
        assert.ok(Date.now()-start<3000,'worker did not reach expected state');
        await new Promise(resolve => setTimeout(resolve,5));
    }
}

test('a physical connection started by a worker is aborted by Stop', async t =>
{
    let signal,connected=false;
    const h=harness(t,{
        serialPhysicalScriptConnect(abortSignal)
        {
            signal=abortSignal; connected=true;
            signal.addEventListener('abort',() => { connected=false; },{once:true});
            return true;
        },
        serialPhysicalState() { return {connected}; },
        serialPhysicalScriptDisconnect() { connected=false; return true; }
    });
    assert.equal(typeof h.ui.port.connectPhysical,'function');
    const running=h.ui.run('await port.connectPhysical(); log((await port.physicalInfo()).connected); await sleep(60000);');
    await until(() => transcript(h).includes('true'));
    h.ui.stop();
    assert.equal((await running).status,'stopped');
    assert.equal(signal.aborted,true);
    assert.equal(connected,false);
});

test('worker RPC honors default wait timeout and separate console reporting', async t =>
{
    const h = harness(t);
    const result = await h.ui.run('await terminal.write("Sending A\\n","tx"); await port.write("A"); await console.write("Received: "+await port.waitFor("OK")+"\\n","rx"); log(await port.read());');
    assert.equal(result.status,'complete');
    assert.deepEqual(h.sent,[65]);
    assert.deepEqual(h.rows,[{text:'Sending A\n',channel:'tx'},{text:'Received: OK\n',channel:'rx'},
        {text:'[13]\n',channel:'meta'}]);
    assert.match(transcript(h),/\[13\]/);
});

test('Stop terminates runaway worker code and leaves the next Run usable', async t =>
{
    const h = harness(t);
    const pending = h.ui.run('log("started"); while(true) {}');
    await until(() => transcript(h).includes('started'));
    h.ui.stop();
    assert.equal((await pending).status,'stopped');
    assert.equal((await h.ui.run('log(hex(255));')).status,'complete');
    assert.match(transcript(h),/\$FF/);
});

test('Stop cancels waits and unregisters receive callbacks', async t =>
{
    const h = harness(t);
    let subscriptions = 0;
    const subscribe = h.ui.port.onReceive;
    h.ui.port.onReceive = callback =>
    {
        subscriptions++;
        const off = subscribe(callback);
        return () => { subscriptions--; off(); };
    };
    const pending = h.ui.run('port.onReceive(bytes=>log(bytes)); const waiting=port.waitFor("never",60000); log("waiting"); await waiting;');
    await until(() => transcript(h).includes('waiting'));
    h.ui.stop();
    assert.equal((await pending).status,'stopped');
    assert.equal(subscriptions,0);
    assert.equal((await h.ui.run('await port.write("A"); log(await port.waitFor("OK"));')).status,'complete');
});

test('syntax errors, RPC timeouts and callback exceptions restore controls', async t =>
{
    const h = harness(t);
    for(const source of ['const = ;','throw new Error("broken");','await port.waitFor("never",5);'])
        assert.equal((await h.ui.run(source)).status,'error');
    const pending = h.ui.run('port.onReceive(()=>{ throw new Error("callback"); }); log("listening"); await sleep(60000);');
    await until(() => transcript(h).includes('listening'));
    h.line.transmitBytes(new Uint8Array([65]));
    assert.equal((await pending).status,'error');
    assert.equal(h.ui.runButton.disabled,false);
    assert.equal(h.ui.runButton.children[0].className,'fa fa-play');
});

test('completion waits for an unawaited write and removes receive subscriptions', async t =>
{
    const h = harness(t);
    const result = await h.ui.run('port.write("Z"); port.onReceive(bytes=>log(bytes));');
    assert.equal(result.status,'complete');
    assert.deepEqual(h.sent,[90]);
    const log = transcript(h);
    h.line.transmitBytes(new Uint8Array([65]));
    assert.equal(transcript(h),log);
});
