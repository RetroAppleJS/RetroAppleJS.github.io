// Exercise the same deviceBtn/refreshDeviceToolboxes path as Peripheral controls.
async function verifySerialProNavigation()
{
    function check(condition,message) { if(!condition) throw new Error(message); }
    document.body.innerHTML = '<div class="tabs"><div id="tab1" class="active">'
        + '<div id="tab1.2"><button id="devices" data-slot="4"></button>'
        + '<div id="device_toolbox_body"></div></div></div><div id="tab2"></div></div>';
    window.oCOM = new COM();
    var io = new Apple2IO(), cards = {};
    io.slots = new Array(7);
    io.SLOT2obj = function(n) { return cards[n]; };
    // Only the panel contents are omitted; navigation and popup rules are real.
    io.deviceToolSlotHTML = function(slot) { return '<div id="device_tool_'+slot+'"></div>'; };
    window.apple2plus = {hwObj:function() { return {io:io,setIRQSource:function() {},setNMISource:function() {}}; }};
    window._o = {CPU_ClocksTicks_s:1020484};
    function mount(n)
    {
        var card = cards[n] = new SerialProCard(); card.mount = {slotN:n};
        var line = new SerialProLine(); line.bindHost(card);
        var terminal = new SerialProTerminalDevice(); terminal.bindHost(card);
        return card;
    }
    var a = mount(5), b = mount(6);
    cards[0] = {PCODE:'A2BO'};
    try
    {
        io.refreshDeviceToolboxes({id:'devices',default_slot:4});
        a.serialTerminalToggle();
        var pa = document.getElementById(a.serialTerminalPopupID()), ua = pa._portScript;
        ua.loadSource('log("slot-four");');
        check(!pa.hidden,'selected Serial Pro window opens');
        var running = ua.run('await sleep(60000);');
        io.deviceBtn({id:'devices'});
        check(pa.hidden,'Peripheral controls must hide the previous slot window');
        check((await running).status==='stopped','hiding the slot window stops its script');
        ua.loadSource('log("slot-four");');
        b.serialTerminalToggle();
        var pb = document.getElementById(b.serialTerminalPopupID()), ub = pb._portScript;
        ub.loadSource('log("slot-five");');
        check(!pb.hidden && pa.hidden,'only the selected slot window is visible');
        io.deviceBtn({id:'devices'});
        check(pa.hidden && pb.hidden,'a non-Serial Pro peripheral hides both windows');
        io.deviceBtn({id:'devices'});
        check(!pa.hidden && pb.hidden && pa._portScript===ua,'returning restores the same slot window');
        check(ua.editor.value==='log("slot-four");' && ub.editor.value==='log("slot-five");','navigation preserves per-slot source');
        oCOM.POPUP.off('tab1.2');
        check(pa.hidden && pb.hidden,'closing Tools hides descendant-owned popups');
        oCOM.POPUP.on('tab1.2');
        check(!pa.hidden && pb.hidden,'reopening Tools restores only the selected slot');
        document.getElementById('tab1').classList.remove('active'); oCOM.POPUP.syncScopes();
        check(pa.hidden && pb.hidden,'leaving the Emulator tab hides all slot windows');
        document.getElementById('tab1').classList.add('active'); oCOM.POPUP.syncScopes();
        check(!pa.hidden && pb.hidden,'returning to Emulator restores the selected slot');
        oCOM.POPUP.off(pa.id); io.deviceBtn({id:'devices'}); io.deviceBtn({id:'devices'}); io.deviceBtn({id:'devices'});
        check(pa.hidden,'navigation must not reopen an explicitly closed window');
        return true;
    }
    finally { a.onUnmount(); b.onUnmount(); }
}
