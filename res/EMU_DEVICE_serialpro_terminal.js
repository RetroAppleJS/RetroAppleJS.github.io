//
// Serial Pro browser-terminal console device.
//
// This is deliberately separate from SPSERIAL. SPSERIAL remains the real
// byte-oriented UART line. SPTERM:console carries human/operator/status text
// that must never enter the 6551 receive stream.
//

function SerialProTerminalDevice()
{
    var device = this;
    var host = null;
    var listeners = [];

    this.API = {
        NAME:"SPTERM",
        DESCRIPTION:"Browser console reporting only; these calls never inject UART bytes.",
        METHODS:{
            write:{signature:"await terminal.write(text, channel=\"meta\")",description:"Append exact text to the lower console. Channels: tx, rx or meta. No automatic newline. console.write() is an alias."},
            clear:{signature:"await terminal.clear()",description:"Clear the terminal display/transcript, leaving the serial buffers intact."}
        }
    };

    this.getScriptAPI = function()
    {
        return {
            write:function(text,channel)
            {
                if(!host) throw new Error("SPTERM is not attached");
                if(typeof(text)!=="string") throw new TypeError("Console text must be a string");
                if(channel===undefined) channel = "meta";
                if(["tx","rx","meta"].indexOf(channel)<0) throw new TypeError("Invalid console channel");
                return host.serialTerminalScriptWrite(text,channel);
            },
            clear:function()
            {
                if(!host) throw new Error("SPTERM is not attached");
                return host.serialTerminalClear();
            }
        };
    };

    this.id = {
         "DCODE":"SPTERM"
        ,"hostPCODE":"SPC"
        ,"icon":"fa fa-terminal"
        ,"description":"Serial Pro browser terminal console"
    };

    this.ports = {
        "console":{
             "direction":"duplex"
            ,"mime":["text/plain; charset=utf-8"]
            ,"handler":"receive"
            ,"description":"Serial Pro terminal operator/status console"
        }
    };

    function normalizeText(message)
    {
        var data = message && message.data!==undefined
            ? message.data
            : message;

        if(data===undefined || data===null)
            return "";

        return String(data);
    }

    this.bindHost = function(card)
    {
        host = card || null;

        if(host &&
           typeof(host.bindSerialTerminalConsoleDevice)=="function")
            host.bindSerialTerminalConsoleDevice(device);

        return !!host;
    };

    this.unbindHost = function()
    {
        if(host && typeof(host.bindSerialTerminalConsoleDevice)==="function" &&
            (typeof(host.getSerialTerminalConsoleDevice)!=="function" || host.getSerialTerminalConsoleDevice()===device))
            host.bindSerialTerminalConsoleDevice(null);
        host = null;
        return true;
    };

    /*
     * Pipe -> browser terminal. This is UI/status text, not serial payload.
     */
    this.receive = function(message,context)
    {
        var text = normalizeText(message);
        if(!text.length || !host ||
           typeof(host.serialTerminalConsoleWrite)!="function")
            return false;

        host.serialTerminalConsoleWrite(
            text,
            {
                 "source":"pipe"
                ,"context":context || null
            }
        );
        return text.length;
    };

    this.receiveText = function(text,meta)
    {
        text = normalizeText(text);
        if(!text.length || !host ||
           typeof(host.serialTerminalConsoleWrite)!="function")
            return 0;

        host.serialTerminalConsoleWrite(text,meta || {});
        return text.length;
    };

    /*
     * Browser-terminal console -> connected observers. The current oTERM input
     * remains the serial-data input; this output side is reserved for future
     * terminal control/diagnostic commands and generic pipeConnect().
     */
    this.subscribe = function(callback)
    {
        if(typeof(callback)!="function")
            return function(){};

        if(listeners.indexOf(callback)<0)
            listeners.push(callback);

        var subscribed = true;
        return function()
        {
            if(!subscribed) return;
            subscribed = false;

            var index = listeners.indexOf(callback);
            if(index>=0) listeners.splice(index,1);
        };
    };

    this.transmitText = function(text,meta)
    {
        text = normalizeText(text);
        var snapshot = listeners.slice();

        for(var i=0;i<snapshot.length;i++)
        {
            try { snapshot[i](text,meta || {}); }
            catch(error)
            {
                console.error("SPTERM console subscriber failed",error);
            }
        }

        return text.length;
    };

    this.reset = function()
    {
        // Browser/operator console remains present across Apple II RESET.
        return true;
    };
}
