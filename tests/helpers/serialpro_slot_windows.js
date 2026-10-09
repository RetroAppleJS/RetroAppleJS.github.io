// Shared by the browser suite and DOM integration checks. Uses real card,
// endpoint, popup manager, terminal and worker implementations.
async function verifySerialProSlotWindows()
{
    function check(condition,message) { if(!condition) throw new Error(message); }
    async function until(condition)
    {
        var deadline = Date.now()+3000;
        while(!condition())
        {
            check(Date.now()<deadline,"slot worker did not reach expected state");
            await new Promise(function(resolve) { setTimeout(resolve,5); });
        }
    }
    // Both owner panels are kept visible here to exercise instance isolation.
    // serialpro_navigation.js separately checks real single-slot navigation.
    document.body.innerHTML = '<div id="tab1"><div id="tab1.2">'
        + '<div id="device_tool_2"></div><div id="device_tool_3"></div></div></div>';
    localStorage.clear();
    var cards = {};
    var io = {getClockTicks:function() { return 0; },slot2ID:function(n) { return String(n); },
        SLOT2obj:function(n) { return cards[n]; }};
    window._o = {CPU_ClocksTicks_s:1020484};
    window.apple2plus = {hwObj:function() { return {io:io,setIRQSource:function() {},setNMISource:function() {}}; }};
    window.oCOM = new COM();
    function mounted(slotN)
    {
        var card = new SerialProCard();
        card.mount = {slotN:slotN}; cards[slotN] = card;
        var line = new SerialProLine(); line.bindHost(card);
        var terminal = new SerialProTerminalDevice(); terminal.bindHost(card);
        var peer = new SerialProGPTDevice(); peer.bindHost(card);
        return {card:card,line:line,terminal:terminal,peer:peer};
    }
    var a = mounted(2), b = mounted(3), replacement;
    var serialDescriptor = Object.getOwnPropertyDescriptor(navigator,'serial');
    try
    {
        a.card.serialTerminalToggle();
        var pa = document.getElementById("serialProTerminal_popup_2");
        check(pa,"slot 2 needs its own popup ID");
        var ua = pa._portScript, ta = pa._terminal;
        var arun = ua.run('log("slot-two"); await sleep(60000);');
        await until(function() { return ta._o.DOM.output.textContent.includes("slot-two"); });
        b.card.serialTerminalToggle();
        var pb = document.getElementById("serialProTerminal_popup_3");
        check(pb && pb!==pa && !pa.hidden && !pb.hidden,"both slot windows must remain open");
        var ub = pb._portScript, tb = pb._terminal;
        check(ua===pa._portScript && ua.isRunning,"opening slot 3 must preserve slot 2's running worker");
        check(ub!==ua && tb!==ta && tb._o.DOM.root!==ta._o.DOM.root,"each slot needs distinct script and terminal instances");
        check(pa.querySelector('.emu_port_script_title').textContent.includes('#2') &&
            pb.querySelector('.emu_port_script_title').textContent.includes('#3'),"script headers identify their slots");
        var ids = Array.from(document.querySelectorAll('[id]')).map(function(node) { return node.id; });
        check(new Set(ids).size===ids.length,"slot windows must not create duplicate DOM IDs");

        var brun = ub.run('log("slot-three"); await sleep(60000);');
        await until(function() { return tb._o.DOM.output.textContent.includes("slot-three"); });
        check(!ta._o.DOM.output.textContent.includes("slot-three") &&
            !tb._o.DOM.output.textContent.includes("slot-two"),"logs stay in their slot terminals");
        ua.divider.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp'}));
        ua.loadSource('log("saved-two");'); ub.loadSource('log("saved-three");');
        check(JSON.parse(localStorage.getItem('SerialProScript_2')).source==='log("saved-two");' &&
            JSON.parse(localStorage.getItem('SerialProScript_3')).source==='log("saved-three");',"source persistence is independent");
        check(ua.divider.getAttribute('aria-valuenow')==='45' && ub.divider.getAttribute('aria-valuenow')==='50',"divider positions are independent");
        ta._o.DOM.input.value='TWO'; ta._o.DOM.input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true}));
        tb._o.DOM.input.value='THREE'; tb._o.DOM.input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true}));
        check(localStorage.getItem('SerialProTerminal_2').includes('TWO') &&
            !localStorage.getItem('SerialProTerminal_2').includes('THREE'),"terminal histories are independent");
        check(a.card.serialTerminalPending()===4 && b.card.serialTerminalPending()===6,"terminal input targets only its mounted card");
        ua.port.write('A'); check(a.card.serialTerminalPending()===5 && b.card.serialTerminalPending()===6,"script UART writes stay in their slot");
        a.line.transmitBytes(new Uint8Array([65])); b.line.transmitBytes(new Uint8Array([66]));
        check(ua.port.read()[0]===65 && ub.port.read()[0]===66,"receive buffers are independent");
        a.card.serialTerminalThemeToggle(); a.card.serialTerminalDisplayToggle();
        check(ta._o.DOM.root.classList.contains('serialpro_terminal_light') &&
            !tb._o.DOM.root.classList.contains('serialpro_terminal_light'),"terminal themes are independent");
        check(pa.querySelector('[data-serial-terminal-display]').textContent==='RAW' &&
            pb.querySelector('[data-serial-terminal-display]').textContent==='ASCII',"display modes are independent");
        var beforeB = tb._o.DOM.output.textContent;
        a.card.serialTerminalClear();
        check(ta._o.DOM.output.textContent==='' && tb._o.DOM.output.textContent===beforeB,"clearing a terminal affects only its slot");
        pa.querySelector('[data-port-script-clear]').click();
        check(ua.editor.value==='' && ub.editor.value==='log("saved-three");',"source trash affects only its slot");
        pa.querySelector('[data-serial-gpt8-button]').click();
        check(ua.editor.value.includes('const mode = "ascii"') && ub.editor.value==='log("saved-three");',"GPT preset targets its own editor");
        pa.querySelector('[data-serial-webserial]').closest('button').click();
        check(ua.editor.value.includes('port.connectPhysical') && ub.editor.value==='log("saved-three");',"USB preset targets its own editor");
        pa.querySelector('[data-port-script-close]').click();
        check((await arun).status==='stopped' && ub.isRunning && !pb.hidden,"closing slot 2 must not stop slot 3");
        a.card.serialTerminalToggle();
        check(pa._portScript===ua && pa._terminal===ta && !pa.hidden,"reopening retains the slot's instances");
        ub.stop(); check((await brun).status==='stopped',"slot 3 stop succeeds independently");

        var ga = ua.run(a.card.serialGPTScript('ascii'));
        var gb = ub.run(b.card.serialGPTScript('utf16le'));
        await until(function() { return document.getElementById('serialGPTKey_popup_2') &&
            document.getElementById('serialGPTKey_popup_3'); });
        var ka = document.getElementById('serialGPTKey_popup_2'), kb = document.getElementById('serialGPTKey_popup_3');
        check(ka._serialGPTPromptOwner===a.card && kb._serialGPTPromptOwner===b.card,"GPT prompts belong to separate slots");
        ua.stop(); check((await ga).status==='stopped' && !kb.hidden && ub.isRunning,"stopping one GPT prompt leaves the other active");
        ub.stop(); check((await gb).status==='stopped',"each GPT prompt cancels independently");

        function adapter()
        {
            var resolveRead;
            return {closed:0,open:async function() {},close:async function() { this.closed++; },
                setSignals:async function() {},getSignals:async function() { return {}; },getInfo:function() { return {}; },
                readable:{getReader:function() { return {
                    read:function() { return new Promise(function(resolve) { resolveRead=resolve; }); },
                    cancel:async function() { if(resolveRead) resolveRead({done:true}); },releaseLock:function() {}
                }; }},writable:{getWriter:function() { return {write:async function() {},releaseLock:function() {}}; }}};
        }
        var usbA = adapter(), usbB = adapter(), selections = [usbA,usbB];
        Object.defineProperty(navigator,'serial',{configurable:true,value:{requestPort:async function() { return selections.shift(); }}});
        a.card.writeSlotIO(0xC0AB,0x1E); a.card.writeSlotIO(0xC0AA,0x0B);
        b.card.writeSlotIO(0xC0BB,0x1E); b.card.writeSlotIO(0xC0BA,0x0B);
        arun = ua.run(a.card.serialPhysicalScript());
        await until(function() { return a.card.serialPhysicalState().connected; });
        brun = ub.run(b.card.serialPhysicalScript());
        await until(function() { return b.card.serialPhysicalState().connected; });
        check(pa.querySelector('[data-serial-webserial]').title.includes('(connected)') &&
            pb.querySelector('[data-serial-webserial]').title.includes('(connected)'),"USB indicators belong to their slots");
        ua.stop(); await arun; await a.card.serialPhysicalScriptDisconnect();
        check(usbA.closed===1 && usbB.closed===0 && b.card.serialPhysicalState().connected && ub.isRunning,
            "stopping one physical bridge keeps the other slot connected");
        check(!pa.querySelector('[data-serial-webserial]').title.includes('(connected)') &&
            pb.querySelector('[data-serial-webserial]').title.includes('(connected)'),"USB indicator updates affect only their own slot");
        ub.stop(); await brun; await b.card.serialPhysicalScriptDisconnect();

        arun = ua.run('await sleep(60000);'); brun = ub.run('await sleep(60000);');
        oCOM.POPUP.off('tab1.2');
        await until(function() { return !ua.isRunning && !ub.isRunning; });
        check(pa.hidden && pb.hidden,"all slot windows follow the peripheral toolbox scope");
        await Promise.all([arun,brun]); oCOM.POPUP.on('tab1.2');
        check(!pa.hidden && !pb.hidden,"toolbox reopening restores each slot window's requested visibility");
        brun = ub.run('await sleep(60000);');
        var wait = ua.port.waitFor('never',60000).catch(function(error) { return error.name; });
        a.card.onUnmount();
        check(document.getElementById(pa.id)===null && pa._portScript===null,"unmount removes only that slot's window");
        check(document.getElementById(ka.id)===null && document.getElementById(kb.id)===kb,
            "unmount removes only its own GPT key dialog");
        check(await wait==='AbortError' && ub.isRunning && !pb.hidden,"unmount cancels only its own pending waits");
        replacement = mounted(2); replacement.card.serialTerminalToggle();
        var fresh = document.getElementById('serialProTerminal_popup_2');
        check(fresh!==pa && fresh._portScript!==ua && fresh._serialProOwner===replacement.card,"a replacement card gets fresh slot endpoints");
        check(ub===pb._portScript && ub.isRunning,"replacement leaves the other slot running");
        check(fresh._portScript.editor.value==='await sleep(60000);',"replacement restores source saved for its slot");
        ub.stop(); await brun;
        return true;
    }
    finally
    {
        a.card.onUnmount(); b.card.onUnmount();
        if(replacement) replacement.card.onUnmount();
        if(serialDescriptor) Object.defineProperty(navigator,'serial',serialDescriptor);
        else delete navigator.serial;
    }
}
