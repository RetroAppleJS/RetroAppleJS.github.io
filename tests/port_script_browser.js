'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright') : 'playwright');
const root = path.join(__dirname,'..');

test('Port Script browser behavior', async t =>
{
    const server = http.createServer((req,res) =>
    {
        if(req.url === '/')
        {
            res.setHeader('Content-Type','text/html');
            res.end(`<link rel="stylesheet" href="/res/EMU_PORT_SCRIPT.css">
                <div id="console" style="height:500px;width:650px"></div>
                <script src="/res/EMU_PORT_API.js"></script>
                <script src="/res/EMU_DEVICE_serialpro_line.js"></script>
                <script src="/res/EMU_DEVICE_serialpro_terminal.js"></script>
                <script src="/res/EMU_PORT_SCRIPT.js"></script>`);
            return;
        }
        const file = path.join(root,req.url);
        if(!file.startsWith(root+path.sep) || !fs.existsSync(file))
        { res.writeHead(404); res.end(); return; }
        res.setHeader('Content-Type',file.endsWith('.css') ? 'text/css' : 'text/javascript');
        res.end(fs.readFileSync(file));
    });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    t.after(() => { server.closeAllConnections(); server.close(); });
    const browser = await chromium.launch({headless:true,args:['--no-sandbox'],
        ...(process.env.PORT_SCRIPT_CHROME ? {executablePath:process.env.PORT_SCRIPT_CHROME} : {})});
    t.after(async () => { await browser.close(); await new Promise(resolve => server.close(resolve)); });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(await page.evaluate(() => typeof EMU_PORT_SCRIPT),'function');
    await page.evaluate(() =>
    {
        window.line = new SerialProLine();
        window.sent = [];
        line.bindHost({serialLineReceiveBytes(bytes)
        {
            sent.push(...bytes);
            line.transmitBytes(new Uint8Array([79,75,13]));
            return bytes.length;
        }});
        window.lower = document.createElement('div'); lower.textContent = 'Terminal';
        window.consoleRows = [];
        window.terminalDevice = new SerialProTerminalDevice();
        terminalDevice.bindHost({serialTerminalScriptWrite(text,channel)
            { consoleRows.push({text,channel}); return text.length; },serialTerminalClear() { consoleRows.length = 0; return true; }});
        window.consoleUI = new EMU_PORT_SCRIPT({container:document.getElementById('console'),
            lowerPane:lower,port:line.getScriptAPI(),api:line.API,storageKey:'test-port',
            console:terminalDevice.getScriptAPI(),consoleAPI:terminalDevice.API});
    });

    await t.test('worker write/waitFor preserves immediate reply and raw reads',async () =>
    {
        const result = await page.evaluate(() => consoleUI.run(
            'await port.write("AT\\r"); log(await port.waitFor("OK")); log(await port.available()); log(await port.read()); log(hex(255));'));
        assert.equal(result.status,'complete');
        assert.deepEqual(await page.evaluate(() => sent),[65,84,13]);
        const log = await page.evaluate(() => consoleRows.map(row => row.text).join(''));
        assert.equal(await page.locator('.emu_port_script_log').count(),0);
        assert.match(log,/OK/); assert.match(log,/\[13\]/); assert.match(log,/\$FF/);
    });
    await t.test('Stop interrupts an infinite loop and Run works afterwards',async () =>
    {
        assert.equal(await page.locator('[data-port-script-run], [data-port-script-stop]').count(),1);
        await page.evaluate(() => { consoleUI.editor.value='while(true) {}'; window.executionControl=consoleUI.runButton; });
        await page.locator('[data-port-script-run]').click();
        await page.evaluate(() => { window.running = consoleUI.run(); });
        assert.equal(await page.locator('[data-port-script-stop] .fa-stop').count(),1);
        await page.locator('[data-port-script-stop]').click();
        assert.equal((await page.evaluate(() => running)).status,'stopped');
        assert.equal(await page.locator('[data-port-script-run] .fa-play').count(),1);
        assert.equal(await page.evaluate(() => executionControl===consoleUI.runButton),true);
        assert.equal((await page.evaluate(() => consoleUI.run('log("again");'))).status,'complete');
    });
    await t.test('scripts report to the console API without sending those messages to serial',async () =>
    {
        const result = await page.evaluate(() => {
            consoleRows.length=0;
            return consoleUI.run('await terminal.write("Sending AT\\n","tx"); await console.write("Received OK\\n","rx");');
        });
        assert.equal(result.status,'complete');
        assert.deepEqual(await page.evaluate(() => consoleRows),[
            {text:'Sending AT\n',channel:'tx'},{text:'Received OK\n',channel:'rx'}]);
        assert.deepEqual(await page.evaluate(() => sent),[65,84,13]);
    });
    await t.test('Stop cancels waitFor and removes callbacks',async () =>
    {
        await page.evaluate(() =>
        {
            window.callbackCount = 0;
            const onReceive = consoleUI.port.onReceive;
            consoleUI.port.onReceive = cb =>
            {
                callbackCount++;
                const off = onReceive(cb);
                return () => { callbackCount--; off(); };
            };
            window.running = consoleUI.run('port.onReceive(bytes => log(bytes)); await port.waitFor("never",60000);');
        });
        await page.waitForFunction(() => callbackCount === 1);
        await page.evaluate(() => consoleUI.stop());
        assert.equal((await page.evaluate(() => running)).status,'stopped');
        assert.equal(await page.evaluate(() => callbackCount),0);
        assert.equal((await page.evaluate(() => consoleUI.run('await port.write("X"); log(await port.waitFor("OK"));'))).status,'complete');
    });
    await t.test('syntax errors, callback exceptions and timeouts are shown and restore controls',async () =>
    {
        for(const source of ['const = ;','await port.waitFor("never",5);','throw new Error("broken");'])
            assert.equal((await page.evaluate(s => consoleUI.run(s),source)).status,'error');
        assert.equal(await page.locator('[data-port-script-run]').isEnabled(),true);
        await page.evaluate(() => { window.running = consoleUI.run('port.onReceive(() => { throw new Error("callback"); }); log("callback-ready"); await sleep(60000);'); });
        await page.waitForFunction(() => consoleRows.some(row => row.text.includes('callback-ready')));
        await page.evaluate(() => line.transmitBytes(new Uint8Array([65])));
        assert.equal((await page.evaluate(() => running)).status,'error');
    });
    await t.test('API help comes from metadata and cannot interpret HTML',async () =>
    {
        await page.evaluate(() => { consoleUI.contract.DESCRIPTION = '<img src=x onerror="window.injected=true">'; consoleUI.showAPI(); });
        assert.match(await page.locator('.emu_port_script_api').textContent(),/await port.write/);
        assert.equal(await page.locator('.emu_port_script_api img').count(),0);
        await page.evaluate(() => consoleUI.showAPI());
    });
    await t.test('divider is bounded and source persists across recreation',async () =>
    {
        await page.locator('.emu_port_script_divider').focus();
        for(let i=0;i<20;i++) await page.keyboard.press('ArrowUp');
        assert.equal(await page.locator('.emu_port_script_divider').getAttribute('aria-valuenow'),'20');
        await page.locator('.emu_port_script_editor').fill('log("saved");');
        await page.evaluate(() =>
        {
            consoleUI.destroy();
            consoleUI = new EMU_PORT_SCRIPT({container:document.getElementById('console'),lowerPane:lower,
                port:line.getScriptAPI(),api:line.API,storageKey:'test-port'});
        });
        assert.equal(await page.locator('.emu_port_script_editor').inputValue(),'log("saved");');
        assert.equal(await page.locator('.emu_port_script_divider').getAttribute('aria-valuenow'),'20');
        await page.screenshot({path:path.join(root,'..','port-script-preview.png')});
    });
    await t.test('two mounted Serial Pro cards keep independent script and terminal windows',async () =>
    {
        await page.evaluate(() => { consoleUI.destroy(); window.oEMU={component:{IO:{}}}; });
        for(const file of ['COM_MAIN.js','COM_oTERM.js','EMU_CARD_serialpro.js','EMU_CARD_serialpro_gpt.js'])
            await page.addScriptTag({url:'/res/'+file});
        await page.addScriptTag({url:'/tests/helpers/serialpro_slot_windows.js'});
        assert.equal(await page.evaluate(() => verifySerialProSlotWindows()),true);
    });
});
