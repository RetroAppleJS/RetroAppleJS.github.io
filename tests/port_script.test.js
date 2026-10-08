'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness()
{
    const ctx = {console, Uint8Array, ArrayBuffer, AbortController, setTimeout, clearTimeout,
        Worker:require('./helpers/web_worker'),Blob,URL};
    vm.createContext(ctx);
    for(const file of ['EMU_PORT_API.js','EMU_DEVICE_serialpro_line.js'])
    {
        const source = path.join(__dirname,'..','res',file);
        if(fs.existsSync(source)) vm.runInContext(fs.readFileSync(source,'utf8'),ctx);
    }
    const line = new ctx.SerialProLine();
    const incoming = [];
    line.bindHost({serialLineReceiveBytes(bytes)
    {
        incoming.push(...bytes);
        return bytes.length;
    }});
    assert.equal(typeof line.getScriptAPI,'function','SPSERIAL must expose its script facade');
    const port = line.getScriptAPI();
    return {ctx,line,port,incoming};
}

test('script writes raw bytes to the remote UART path without appending CR', () =>
{
    const h = harness();
    assert.equal(h.port.write('A\x80\xff'),3);
    h.port.write(new Uint8Array([0,13]));
    assert.deepEqual(h.incoming,[65,128,255,0,13]);
    assert.throws(() => h.port.write('\u0100'),/8-bit/);
    h.port.dispose();
    assert.throws(() => h.port.write('B'),/closed/i);
});

test('facade read/flush and mutable callbacks do not consume or corrupt other line observers', () =>
{
    const h = harness(), observed = [];
    h.line.subscribe(bytes => observed.push(...bytes));
    const stop = h.port.onReceive(bytes => { bytes[0] = 0; });
    h.line.transmitBytes(new Uint8Array([65,128,255]));
    assert.equal(h.port.available(),3);
    assert.deepEqual(Array.from(h.port.read(2)),[65,128]);
    assert.deepEqual(observed,[65,128,255]);
    assert.equal(h.port.flush(),1);
    assert.equal(h.port.available(),0);
    stop(); h.port.dispose();
});

test('waitFor matches across chunks, consumes through the match and preserves trailing bytes', async () =>
{
    const h = harness();
    const pending = h.port.waitFor('OK',100);
    h.line.transmitBytes(new Uint8Array([62,79]));
    h.line.transmitBytes(new Uint8Array([75,13,10]));
    assert.equal(await pending,'>OK');
    assert.deepEqual(Array.from(h.port.read()),[13,10]);
    h.line.transmitBytes(new Uint8Array([66,85,83,89,33]));
    assert.equal(await h.port.waitFor(/CONNECT|BUSY/g,1000),'BUSY');
    assert.deepEqual(Array.from(h.port.read()),[33]);
    h.port.dispose();
});

test('a reply arriving synchronously during write can be matched afterwards', async () =>
{
    const h = harness();
    h.line.bindHost({serialLineReceiveBytes(bytes)
    {
        h.line.transmitBytes(new Uint8Array([79,75]));
        return bytes.length;
    }});
    h.port.write('AT\r');
    assert.equal(await h.port.waitFor('OK',100),'OK');
    h.port.dispose();
});

test('timeout, abort and dispose settle waits and allow the next wait', async () =>
{
    const h = harness();
    await assert.rejects(h.port.waitFor('X',5),{name:'TimeoutError'});
    const abort = new AbortController();
    const pending = h.port.waitFor('X',100,abort.signal);
    abort.abort();
    await assert.rejects(pending,{name:'AbortError'});
    const final = h.port.waitFor('X',100);
    h.port.dispose();
    await assert.rejects(final,{name:'AbortError'});
});

test('invalid requests and simultaneous waits reject without stranding a subscription', async () =>
{
    const h = harness();
    assert.throws(() => h.port.read(-1),/count/i);
    await assert.rejects(h.port.waitFor('',100),/pattern/i);
    await assert.rejects(h.port.waitFor('X',-1),/timeout/i);
    const pending = h.port.waitFor('X',100);
    await assert.rejects(h.port.waitFor('Y',100),/pending/i);
    h.line.transmitBytes(new Uint8Array([88]));
    assert.equal(await pending,'X'); h.port.dispose();
});

test('overflow is explicit and disposal removes the observer', async () =>
{
    const h = harness(); h.port.dispose();
    let listener, released = false;
    const port = new h.ctx.EMU_SCRIPT_PORT({maxBuffer:4,write:() => 0,
        subscribe:callback => { listener = callback; return () => { released = true; }; }});
    const pending = port.waitFor('XXXXX',100);
    listener(new Uint8Array([1,2,3,4,5]));
    await assert.rejects(pending,/overflow/i);
    assert.equal(port.available(),0);
    listener(new Uint8Array([65]));
    assert.deepEqual(Array.from(port.read()),[65]);
    port.dispose(); assert.equal(released,true);
});

test('SPTERM exposes console writes with channels while keeping text off the UART', () =>
{
    const h = harness(), rows = [];
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res','EMU_DEVICE_serialpro_terminal.js'),'utf8'),h.ctx);
    const terminal = new h.ctx.SerialProTerminalDevice();
    terminal.bindHost({serialTerminalScriptWrite(text,channel)
    { rows.push({text,channel}); return text.length; },serialTerminalClear() { rows.length = 0; return true; }});
    assert.equal(typeof terminal.getScriptAPI,'function');
    const api = terminal.getScriptAPI();
    api.write('sending AT\r\n','tx'); api.write('received OK\r\n','rx');
    assert.deepEqual(rows,[{text:'sending AT\r\n',channel:'tx'},{text:'received OK\r\n',channel:'rx'}]);
    assert.deepEqual(h.incoming,[]);
    assert.throws(() => api.write('oops','invalid'),/channel/i);
    api.clear(); assert.equal(rows.length,0);
    terminal.unbindHost(); assert.throws(() => api.write('gone'),/attached/i);
    h.port.dispose();
});

test('script bytes travel through real 6551 timing and console reports preserve channels', async () =>
{
    const h = harness();
    let ticks = 0;
    const io = {getClockTicks:() => ticks};
    const hw = {io,setIRQSource() {},setNMISource() {}};
    Object.assign(h.ctx,{document:{getElementById:() => null},
        apple2plus:{hwObj:() => hw},_o:{CPU_ClocksTicks_s:1020484},oEMU:{component:{IO:{}}},oCOM:{}});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res','EMU_CARD_serialpro.js'),'utf8'),h.ctx);
    const card = new h.ctx.SerialProCard();
    card.mount = {slotN:2}; h.line.bindHost(card);
    card.writeSlotIO(0xC0AB,0x1E);
    card.writeSlotIO(0xC0AA,0x0B);
    h.port.write('A');
    assert.equal(card.serialTerminalReadByte(),null,'RX cannot bypass character timing');
    ticks += 5000; card.syncClock(ticks);
    assert.equal(card.serialTerminalReadByte(),65);
    const response = h.port.waitFor('B',100);
    card.writeSlotIO(0xC0A8,66);
    ticks += 5000; card.syncClock(ticks);
    assert.equal(await response,'B');
    assert.equal(typeof card.serialTerminalScriptWrite,'function');
    assert.equal(card.serialTerminalScriptWrite('transmitting A\n','tx'),15);
    assert.equal(card.serialTerminalPending(),0,'console output must not queue serial input');
    h.port.dispose();
});

test('removing an inactive child device does not unbind the active serial/console endpoint', () =>
{
    const h = harness();
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res','EMU_DEVICE_serialpro_terminal.js'),'utf8'),h.ctx);
    let activeLine, activeConsole;
    const host = {
        bindSerialLineDevice:line => { activeLine = line; },getSerialLineDevice:() => activeLine,
        bindSerialTerminalConsoleDevice:console => { activeConsole = console; },getSerialTerminalConsoleDevice:() => activeConsole
    };
    const lineA = new h.ctx.SerialProLine(), lineB = new h.ctx.SerialProLine();
    lineA.bindHost(host); lineB.bindHost(host); lineA.unbindHost();
    assert.equal(activeLine,lineB);
    const consoleA = new h.ctx.SerialProTerminalDevice(), consoleB = new h.ctx.SerialProTerminalDevice();
    consoleA.bindHost(host); consoleB.bindHost(host); consoleA.unbindHost();
    assert.equal(activeConsole,consoleB);
    h.port.dispose();
});

function physicalHarness(t,requestPort)
{
    const h=harness();
    let ticks=0;
    const hw={io:{getClockTicks:() => ticks},setIRQSource() {},setNMISource() {}};
    Object.assign(h.ctx,{document:{getElementById:() => null},navigator:{serial:{requestPort}},
        apple2plus:{hwObj:() => hw},_o:{CPU_ClocksTicks_s:1020484},oEMU:{component:{IO:{}}},oCOM:{},
        setInterval,clearInterval});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','res','EMU_CARD_serialpro.js'),'utf8'),h.ctx);
    const card=new h.ctx.SerialProCard();card.mount={slotN:2};h.line.bindHost(card);
    card.writeSlotIO(0xC0AB,0x1E);card.writeSlotIO(0xC0AA,0x0B);
    t.after(async () => { h.port.dispose(); await card.serialPhysicalScriptDisconnect(); });
    return {...h,card,advance() { ticks+=5000;card.syncClock(ticks); }};
}

test('the USB preset transport keeps UART timing and releases stream locks on Stop', async t =>
{
    let read,options,readerReleased=0,writerReleased=0,closed=0;
    const writes=[];
    const reader={
        read:() => new Promise(resolve => { read=resolve; }),
        cancel:async () => { read({done:true}); },
        releaseLock() { readerReleased++; }
    };
    const selected={
        open:async config => { options=config; },close:async () => { closed++; },
        readable:{getReader:() => reader},
        writable:{getWriter:() => ({write:async bytes => writes.push(...bytes),releaseLock() { writerReleased++; }})},
        setSignals:async () => {},getSignals:async () => ({}),getInfo:() => ({usbVendorId:0x1A86})
    };
    const h=physicalHarness(t,async () => selected);
    const abort=new AbortController();
    assert.equal(await h.port.connectPhysical(abort.signal),true);
    assert.deepEqual({...options},{baudRate:9600,dataBits:8,stopBits:1,parity:'none',flowControl:'none'});
    read({done:false,value:new Uint8Array([65])});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.card.serialTerminalReadByte(),null);
    h.advance();assert.equal(h.card.serialTerminalReadByte(),65);
    h.card.writeSlotIO(0xC0A8,66);h.advance();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(writes,[66]);
    abort.abort();await h.port.disconnectPhysical();
    assert.equal(h.port.physicalInfo().connected,false);
    assert.equal(readerReleased,1);assert.equal(writerReleased,1);assert.equal(closed,1);
});

test('Stop before the USB chooser returns does not open the selected port', async t =>
{
    let select,opens=0;
    const h=physicalHarness(t,() => new Promise(resolve => { select=resolve; }));
    assert.equal(typeof h.port.connectPhysical,'function');
    const abort=new AbortController();
    const connect=h.port.connectPhysical(abort.signal);
    abort.abort();
    select({open:async () => { opens++; }});
    assert.equal(await connect,false);
    assert.equal(opens,0);
    assert.equal(h.card.serialPhysicalState().connected,false);
});

test('Stop while USB open is pending closes the late port', async t =>
{
    let finishOpen,closes=0;
    const h=physicalHarness(t,async () => ({
        open:() => new Promise(resolve => { finishOpen=resolve; }),close:async () => { closes++; }
    }));
    assert.equal(typeof h.port.connectPhysical,'function');
    const abort=new AbortController();const connect=h.port.connectPhysical(abort.signal);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(finishOpen);abort.abort();finishOpen();
    assert.equal(await connect,false);
    assert.equal(closes,1);
    assert.equal(h.card.serialPhysicalState().connected,false);
});

test('a backtracking RegExp cannot block the receive timeout or next wait', async () =>
{
    const h = harness();
    h.line.transmitBytes(new Uint8Array([...new Array(32).fill(97),33]));
    const started = Date.now();
    await assert.rejects(h.port.waitFor(/(a+)+$/,100),{name:'TimeoutError'});
    assert.ok(Date.now()-started<1000,'regexp computation must be terminable');
    h.port.flush();
    h.line.transmitBytes(new Uint8Array([79,75]));
    assert.equal(await h.port.waitFor('OK',100),'OK');
    h.port.dispose();
});
