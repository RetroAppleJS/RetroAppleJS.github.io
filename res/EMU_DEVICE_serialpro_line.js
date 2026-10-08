//
// Copyright (c) 2026 Freddy Vandriessche.
// All rights reserved.
//
// EMU_DEVICE_serialpro_line.js
//
// External byte-stream line owned by the Applied Engineering Serial Pro card.
// The card/firmware/6551 remain the SPC peripheral; this device models the
// external serial connection presented by the UART.
//

function SerialProLine()
{
    var line = this;
    var host = null;
    var listeners = [];
    var scriptPorts = [];

    this.API = {
        NAME:"SPSERIAL",
        DESCRIPTION:"Remote endpoint: write sends to the Apple II UART; read observes Apple II output. Raw 8-bit bytes, independent of terminal ASCII mode.",
        METHODS:{
            write:{signature:"await port.write(data)",description:"Queue an 8-bit string, byte, byte array or ArrayBuffer into the UART. Returns accepted byte count. Does not append CR."},
            read:{signature:"await port.read(count?)",description:"Consume up to count bytes from this facade, or all available bytes. Returns Uint8Array. Cannot read while waitFor is pending."},
            available:{signature:"await port.available()",description:"Number of bytes in this facade's receive buffer (maximum 65536). Overflow raises RangeError and clears the buffer."},
            flush:{signature:"await port.flush()",description:"Clear this facade's receive buffer and cancel its wait. Returns discarded byte count; leaves UART and terminal data intact."},
            waitFor:{signature:"await port.waitFor(pattern, timeout=3000)",abortArgument:2,description:"Match a string or RegExp in raw byte text. Returns text through the first match, consumes those bytes and retains trailing bytes. One pending wait. TimeoutError on expiry."},
            startGPT:{signature:'await port.startGPT("ascii" | "utf16le")',abortArgument:1,description:"Start the attached SPGPT peer with the validated API-key dialog and existing GPT8/GPT16 protocols. Returns false if cancelled. Stop/completion/disposal ends this script's GPT session."},
            stopGPT:{signature:"await port.stopGPT()",description:"End this script's GPT session and clear its API key from memory."},
            gptInfo:{signature:"await port.gptInfo()",description:"Read the attached GPT peer's status and encoding. Never returns the API key."},
            onReceive:{signature:"const off = port.onReceive(callback)",description:"Observe Uint8Array chunks without consuming them. Call off() to unsubscribe; callbacks end with the script."}
        },
        EVENTS:{receive:{signature:"receive(bytes)",description:"Apple II output arriving at the remote endpoint. Raw byte chunks; high bits are preserved."}}
    };

    this.getScriptAPI = function()
    {
        var facade = new EMU_SCRIPT_PORT({
            write:function(bytes)
            {
                if(!host) throw new Error("SPSERIAL is not attached");
                return line.receiveBytes(bytes,{source:"script"});
            },
            subscribe:function(callback) { return line.subscribe(callback); }
        });
        var gptAbort = null;
        var unlinkGPT = null;
        var disposed = false;
        function stopGPT()
        {
            if(unlinkGPT) unlinkGPT();
            unlinkGPT = null;
            if(gptAbort) gptAbort.abort();
            gptAbort = null;
            return true;
        }
        facade.startGPT = function(mode,signal)
        {
            if(disposed) throw new Error("Script port is closed");
            if(!host || typeof(host.serialGPTStart)!=="function")
                throw new Error("SPGPT peer is not attached");
            if(mode!=="ascii" && mode!=="utf16le") throw new TypeError("GPT mode must be ascii or utf16le");
            stopGPT();
            gptAbort = new AbortController();
            var controller = gptAbort;
            if(signal)
            {
                if(signal.aborted) controller.abort();
                else
                {
                    var abort = function() { controller.abort(); };
                    signal.addEventListener("abort",abort,{once:true});
                    unlinkGPT = function() { signal.removeEventListener("abort",abort); };
                }
            }
            return host.serialGPTStart(mode,controller.signal);
        };
        facade.stopGPT = stopGPT;
        facade.gptInfo = function()
        {
            if(disposed) throw new Error("Script port is closed");
            if(!host || typeof(host.serialGPTInfo)!=="function")
                throw new Error("SPGPT peer is not attached");
            return host.serialGPTInfo();
        };
        var dispose = facade.dispose;
        facade.dispose = function()
        {
            disposed = true;
            stopGPT();
            dispose();
            var index = scriptPorts.indexOf(facade);
            if(index>=0) scriptPorts.splice(index,1);
        };
        scriptPorts.push(facade);
        return facade;
    };

    this.id = {
         "DCODE":"SPSERIAL"
        ,"hostPCODE":"SPC"
        ,"icon":"fa fa-exchange-alt"
        ,"description":"Serial Pro external serial line"
    };

    this.ports = {
        "serial":{
             "direction":"duplex"
            ,"mime":["application/octet-stream"]
            ,"handler":"receive"
            ,"description":"Serial Pro external 8-bit serial byte stream"
        }
    };

    function normalizeBytes(data)
    {
        if(data instanceof Uint8Array)
            return data;

        if(data instanceof ArrayBuffer)
            return new Uint8Array(data);

        if(ArrayBuffer.isView(data))
            return new Uint8Array(
                data.buffer,
                data.byteOffset,
                data.byteLength
            );

        if(Array.isArray(data))
        {
            var bytes = new Uint8Array(data.length);
            for(var i=0;i<data.length;i++)
                bytes[i] = Number(data[i]) & 0xFF;
            return bytes;
        }

        if(Number.isInteger(Number(data)))
            return new Uint8Array([Number(data) & 0xFF]);

        return null;
    }

    this.bindHost = function(card)
    {
        host = card || null;

        if(host && typeof(host.bindSerialLineDevice)=="function")
            host.bindSerialLineDevice(line);

        return !!host;
    };

    this.unbindHost = function()
    {
        scriptPorts.slice().forEach(function(port) { port.dispose(); });
        if(host && typeof(host.bindSerialLineDevice)==="function" &&
            (typeof(host.getSerialLineDevice)!=="function" || host.getSerialLineDevice()===line))
            host.bindSerialLineDevice(null);
        host = null;
        return true;
    };

    /*
     * Bytes entering the public duplex port are remote -> Serial Pro traffic.
     * The owning SPC card is responsible for applying 6551 receive timing,
     * word length, RDRF and IRQ behavior.
     */
    this.receive = function(message,context)
    {
        var bytes = normalizeBytes(
            message && message.data!==undefined
                ? message.data
                : message
        );

        if(!bytes || !host ||
           typeof(host.serialLineReceiveBytes)!="function")
            return false;

        return host.serialLineReceiveBytes(
            bytes,
            {
                 "source":"pipe"
                ,"context":context || null
            }
        )==bytes.length;
    };

    this.receiveBytes = function(data,meta)
    {
        var bytes = normalizeBytes(data);

        if(!bytes || !host ||
           typeof(host.serialLineReceiveBytes)!="function")
            return 0;

        return host.serialLineReceiveBytes(bytes,meta || {});
    };

    /*
     * ACIA -> external-line traffic is streaming/event-driven. Until the
     * generic pipe layer grows persistent pipeConnect()/pipeDisconnect(),
     * subscribers are the adapter boundary used by oTERM and Web Serial.
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

    this.transmitBytes = function(data,meta)
    {
        var bytes = normalizeBytes(data);
        if(!bytes) return false;

        var snapshot = listeners.slice();

        for(var i=0;i<snapshot.length;i++)
        {
            try
            {
                snapshot[i](bytes,meta || {});
            }
            catch(error)
            {
                console.error("SPSERIAL serial subscriber failed",error);
            }
        }

        return bytes.length;
    };

    this.reset = function()
    {
        // The external cable/line remains present across Apple II RESET.
        return true;
    };
}
