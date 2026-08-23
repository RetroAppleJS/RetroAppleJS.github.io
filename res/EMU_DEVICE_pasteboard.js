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
}