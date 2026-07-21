//
// Copyright (c) 2026 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/LICENSE.md
//
// EMU_gameport.js
//
// Apple II game I/O device.
//
// Default host wiring:
//   host pointer X -> PDL0
//   host pointer Y -> PDL1
//   host pointer button -> SW0
//
// The browser Pointer Events API covers mouse and trackpad input through the
// same event path.  Wiring is deliberately fixed for now.
//

function GamePort()
{
    this.id = {
         "DCODE":"A2GAM"
        ,"hostPCODE":"A2BO"
        ,"icon":"fa fa-gamepad"
        ,"description":"Apple II game I/O port"
        ,"deviceEnable":true
    };

    this.state = {
         "paddles":[127,127,0,0]
        ,"switches":[false,false,false]
    };

    /*
     * The Apple monitor's PREAD loop advances about once every 11 CPU cycles.
     * Therefore a 0..255 host coordinate maps naturally to 0..2805 cycles.
     */
    const PADDLE_CYCLES_PER_STEP = 11;

    var gameport = this;
    var ticks = 0;
    var paddleDeadline = [0,0,0,0];
    var eventsBound = false;

    const TRACKPAD_WIRING = [
        "               ┌─────────┐",
        "               ┤+5V•   NC├",
        "     ┌─────────┤SW0   AN0├──────────┐       ┌────────────┐",
        "     │ ┌───────┤SW1   AN1├────────┐ │       │  Trackpad  │",
        "     │ │ ┌─────┤SW2   AN2├──────┐ │ │  ┌────┤Y           │",
        "     │ │ │ ┌───┤STRO  AN3├────┐ │ │ │  │ ┌──┤X           │",
        "     │ │ │ │┌──┤PDL0 PDL3├──┐ │ │ │ │  │ │ ┌┤B           │",
        "     │ │ │ ││ ┌┤PDL2 PDL1├┐ │ │ │ │ │  │ │ │└────────────┘",
        "     │ │ │ ││ │┤GND _  NC├│ │ │ │ │ │  │ │ │",
        "     │ │ │ ││ │└───┘ └───┘│ │ │ │ │ │  │ │ │",
        "PDL0─│─│─│─│┴─│───────────│─│─│─│─│─│──│─┴─│─────────────────",
        "PDL1─│─│─│─│──│───────────┴─│─│─│─│─│──┴───│─────────────────",
        "PDL2─│─│─│─│──┴─────────────│─│─│─│─│──────│─────────────────",
        "PDL3─│─│─│─│────────────────┴─│─│─│─│──────│─────────────────",
        "AN0──│─│─│─│──────────────────│─│─│─┴──────│─────────────────",
        "AN1──│─│─│─│──────────────────│─│─┴────────│─────────────────",
        "AN2──│─│─│─│──────────────────│─┴──────────│─────────────────",
        "AN3──│─│─│─│──────────────────┴────────────│─────────────────",
        "STRO─│─│─│─┴───────────────────────────────│─────────────────",
        "SW0──┴─│─│─────────────────────────────────┴─────────────────",
        "SW1────┴─│───────────────────────────────────────────────────",
        "SW2──────┴───────────────────────────────────────────────────"
    ].join("\n");

    function clampByte(value)
    {
        value = Math.round(Number(value) || 0);
        return Math.max(0,Math.min(255,value));
    }

    function isAppleScreen(target)
    {
        return target && target.id == "applescreen";
    }

    function updatePointer(event)
    {
        var target = event && event.target;
        if(!isAppleScreen(target) || typeof(target.getBoundingClientRect)!="function")
            return false;

        var rect = target.getBoundingClientRect();
        if(rect.width<=0 || rect.height<=0)
            return false;

        gameport.state.paddles[0] = clampByte(
            (event.clientX - rect.left) * 255 / rect.width
        );
        gameport.state.paddles[1] = clampByte(
            (event.clientY - rect.top) * 255 / rect.height
        );

        return true;
    }

    this.bindHostInput = function()
    {
        if(eventsBound || typeof(document)=="undefined")
            return;

        document.addEventListener("pointermove",function(event)
        {
            updatePointer(event);
        },true);

        document.addEventListener("pointerdown",function(event)
        {
            if(updatePointer(event))
                gameport.state.switches[0] = true;
        },true);

        document.addEventListener("pointerup",function()
        {
            gameport.state.switches[0] = false;
        },true);

        document.addEventListener("pointercancel",function()
        {
            gameport.state.switches[0] = false;
        },true);

        if(typeof(window)!="undefined")
            window.addEventListener("blur",function()
            {
                gameport.state.switches[0] = false;
            });

        eventsBound = true;
    };

    this.tick = function()
    {
        ticks++;
    };

    this.trigger = function()
    {
        for(var i=0;i<paddleDeadline.length;i++)
        {
            paddleDeadline[i] =
                ticks +
                clampByte(gameport.state.paddles[i]) *
                PADDLE_CYCLES_PER_STEP;
        }

        return 0x00;
    };

    this.read = function(rel_addr)
    {
        var input = Number(rel_addr) & 0x0F;

        // $C061-$C063: SW0-SW2. The input state is returned in bit 7.
        if(input>=0x01 && input<=0x03)
            return gameport.state.switches[input-1] ? 0x80 : 0x00;

        // $C064-$C067: PDL0-PDL3. Bit 7 stays high until its timer expires.
        if(input>=0x04 && input<=0x07)
            return ticks < paddleDeadline[input-4] ? 0x80 : 0x00;

        return 0x00;
    };

    this.reset = function()
    {
        ticks = 0;
        paddleDeadline = [0,0,0,0];
        gameport.state.switches[0] = false;
        gameport.state.switches[1] = false;
        gameport.state.switches[2] = false;
        this.bindHostInput();
    };

    this.restart = function()
    {
        this.reset();
    };

    this.ctrl_dlg = function()
    {
        return ""
            +"<div style=\"font-family:Arial;font-size:11px;\">"
            +"<div style=\"margin-bottom:8px;\"><b>Default host wiring</b></div>"
            +"<div style=\"margin-bottom:8px;\">"
            +"The wiring is fixed in this first implementation. "
            +"Browser pointer input represents the host trackpad or mouse."
            +"</div>"
            +"<pre style=\"font-family:monospace;font-size:11px;line-height:1.15;"
            +"white-space:pre;overflow:auto;margin:0;padding:8px;border:1px solid #888;\">"
            +TRACKPAD_WIRING
            +"</pre>"
            +"<div style=\"margin-top:8px;\">"
            +"X → PDL0 ($C064)<br>"
            +"Y → PDL1 ($C065)<br>"
            +"B → SW0 ($C061, bit 7)<br>"
            +"PTRIG ($C070) starts the paddle timers"
            +"</div>"
            +"</div>";
    };
}

globalThis.GamePort = GamePort;