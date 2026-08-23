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
    this.id = {
         "DCODE":"PASTEBO"
        ,"hostPCODE":"A2BO"
        ,"icon":"fa fa-clipboard"
    };

    this.ports = {
        "text":{
             "direction":"out"
            ,"mime":["text/plain"]
            ,"description":"Host pasteboard text"
        }
    };

    this.getTargetAddress = function(io)
    {
        const fallback = "0:A2KBD:text";

        if(!io || !Array.isArray(io.slots) ||
           typeof(io.SLOT2obj)!="function")
            return fallback;

        for(var slotIndex=1;slotIndex<io.slots.length;slotIndex++)
        {
            var owner = io.SLOT2obj(slotIndex);
            if(!owner || String(owner.id?.PCODE || "").toUpperCase()!="VIDEX")
                continue;

            if(owner.state && owner.state.active===false)
                continue;

            var slotID =
                typeof(io.slot2ID)=="function"
                    ? io.slot2ID(slotIndex)
                    : String(slotIndex-1);

            var address = slotID + ":VIDEXTXT:text";

            if(typeof(io.pipeIsOpen)=="function")
            {
                if(io.pipeIsOpen(address)) return address;
            }
            else if(typeof(io.pipeResolve)=="function" &&
                    io.pipeResolve(address))
                return address;
        }

        return fallback;
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

}