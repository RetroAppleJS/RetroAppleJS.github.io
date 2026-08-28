//
// Copyright (c) 2026 Freddy Vandriessche.
// All rights reserved.
//
// EMU_DEVICE_pasteboard.js
//
// Host-side pasteboard device owned by A2BO.
// The HTML textarea is only a UI for this device; data leaves the device
// through its published text/plain output port.
//

function PasteBoard()
{
    var receivedText = "";

    this.id = {
         "DCODE":"PASTEBO"
        ,"hostPCODE":"A2BO"
        ,"icon":"fa fa-clipboard"
    };

    /*
     * OUT: textarea -> emulated text input
     * IN : active display -> textarea (TxtCap)
     */

    this.ports = {
        "text":{
             "direction":"duplex"
            ,"mime":["text/plain"]
            ,"handler":"receiveText"
            ,"description":"Host pasteboard text"
        }
    };


    this.receiveText = function(message)
    {
        receivedText =
            message && message.data!==undefined
                ? String(message.data)
                : "";

        return true;
    };

    this.getReceivedText = function()
    {
        return receivedText;
    };

    this.getTargetAddress = function(io)
    {
        if(io && typeof(io.getTextInputTargetAddress)=="function")
            return io.getTextInputTargetAddress();
        return "0:A2KBD:text";
    };

    this.sendText = function(io,text)
    {
        if(!io || typeof(io.pipeSend)!="function")
            return false;

        return io.pipeSend(
            "0:PASTEBO:text",
            this.getTargetAddress(io),
            {
                 "mime":"text/plain"
                ,"data":String(text==null ? "" : text)
            }
        );
    };

    this.getCaptureSourceAddress = function(io)
    {
        const fallback = "0:A2VIDEOTXT:text";

        if(!io || !Array.isArray(io.slots) ||
           typeof(io.SLOT2obj)!="function")
            return fallback;

        /*
         * The same VideoTerm semantic-text device is used in both directions:
         *
         *   Paste  : 0:PASTEBO:text -> n:VIDEXTXT:text
         *   TxtCap : n:VIDEXTXT:text -> 0:PASTEBO:text
         *
         * Prefer it only while its duplex text port is open/active.
         */

        for(var slotIndex=1;slotIndex<io.slots.length;slotIndex++)
        {
            var owner = io.SLOT2obj(slotIndex);
            if(!owner ||
               String(owner.id?.PCODE || "").toUpperCase()!="VIDEX")
                continue;

            var slotID =
                typeof(io.slot2ID)=="function"
                    ? io.slot2ID(slotIndex)
                    : String(slotIndex-1);

            var address = slotID + ":VIDEXTXT:text";

            if(typeof(io.pipeIsOpen)=="function" &&
               io.pipeIsOpen(address))
                return address;
        }

        return fallback;
    };

    this.captureText = function(io)
    {
        if(!io || typeof(io.pipeTransfer)!="function")
            return null;

        var source = this.getCaptureSourceAddress(io);
        if(!source) return null;

        var message = io.pipeTransfer(
            source,
            "0:PASTEBO:text",
            {}
        );

        return message && message.data!==undefined
            ? String(message.data)
            : null;
    };

}