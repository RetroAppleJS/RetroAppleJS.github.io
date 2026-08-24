// Serial Pro GPT peer extension for RetroAppleJS.
//
// Loaded immediately after EMU_CARD_serialpro.js and before EMU_apple2io.js.
// It wraps the Serial Pro discovery constructor, so every subsequently mounted
// Serial Pro instance receives the GPT serial-peer feature without modifying
// the card ROM or the 6551 implementation.
//
// API-key handling deliberately mirrors tools/PromptJS.html: window.prompt().
// The key is kept only in this card instance's JavaScript memory and is erased
// when GPT mode is disabled or the page is reloaded. It is never persisted.

(function(global)
{
    "use strict";

    const SERIAL_GPT_API_URL = "https://api.openai.com/v1/responses";
    const SERIAL_GPT_MODEL = "gpt-5.6";
    const SERIAL_GPT_MAX_OUTPUT_TOKENS = 512;
    const SERIAL_GPT_MAX_INPUT_CHARS = 4096;
    const SERIAL_GPT_HISTORY_MESSAGES = 8;
    const SERIAL_GPT_HISTORY_CHARS = 12000;
    const SERIAL_GPT_ECHO_GUARD_MS = 15000;

    const SERIAL_GPT_INSTRUCTIONS = [
        "You are the remote conversational peer on an Apple II serial link.",
        "Answer the newest APPLE II message as plain text.",
        "Unicode characters are allowed; the serial peer transports text as UTF-16LE.",
        "Do not use Markdown unless the user explicitly asks for Markdown.",
        "Be concise enough for a vintage text terminal.",
        "Do not prefix the answer with GPT:, ASSISTANT:, or another speaker label.",
        "When source code is requested, return plain source text suitable for a serial terminal."
    ].join(" ");

    /*
     * The physical Serial Pro link remains an 8-bit byte stream. SPGPT defines
     * the application convention carried over that stream: UTF-16LE code units.
     * JavaScript strings are already UTF-16, so encoding/decoding is deliberately
     * simple and surrogate pairs naturally occupy four serial bytes.
     */
    function serialGPTNormalizeText(text)
    {
        return String(text===undefined || text===null ? "" : text)
            .replace(/\r\n/g,"\n")
            .replace(/\r/g,"\n");
    }

    function serialGPTEncodeUTF16LE(text)
    {
        text = String(text===undefined || text===null ? "" : text);

        var bytes = new Uint8Array(text.length*2);
        for(var i=0;i<text.length;i++)
        {
            var codeUnit = text.charCodeAt(i);
            bytes[i*2] = codeUnit & 0xFF;
            bytes[i*2+1] = (codeUnit >> 8) & 0xFF;
        }
        return bytes;
    }

    function serialGPTWireText(text)
    {
        var normalized = serialGPTNormalizeText(text).replace(/\n+$/g,"");
        var wire = normalized.replace(/\n/g,"\r");

        // GPT replies are line-oriented on this peer protocol.
        if(!wire.length || wire.charCodeAt(wire.length-1)!==0x000D)
            wire += "\r";

        return {
             "text":normalized
            ,"wire":wire
        };
    }

    /*
     * SPGPT is a remote serial peer device. Both SPGPT and SPSERIAL expose the
     * same raw byte-stream MIME; UTF-16LE is an application convention owned by
     * SPGPT and by the Apple II software talking to it.
     */
    function SerialProGPTDevice()
    {
        var device = this;
        var host = null;
        var lowByte = null;
        var serialUnsubscribe = null;
        var peerUnsubscribe = null;
        var listeners = [];

        this.id = {
             "DCODE":"SPGPT"
            ,"hostPCODE":"SPC"
            ,"icon":"fa fa-robot"
            ,"description":"Serial Pro GPT UTF-16LE serial peer"
        };

        this.ports = {
            "serial":{
                 "direction":"duplex"
                ,"mime":["application/octet-stream"]
                ,"handler":"receive"
                ,"description":"GPT peer byte stream carrying UTF-16LE text"
            }
        };

        function normalizeBytes(data)
        {
            if(data instanceof Uint8Array) return data;
            if(data instanceof ArrayBuffer) return new Uint8Array(data);

            if(ArrayBuffer.isView(data))
                return new Uint8Array(data.buffer,data.byteOffset,data.byteLength);

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

        function consume(bytes)
        {
            if(!bytes || !host) return 0;

            for(var i=0;i<bytes.length;i++)
            {
                var d8 = bytes[i] & 0xFF;

                if(lowByte===null)
                {
                    lowByte = d8;
                    continue;
                }

                var codeUnit = lowByte | (d8<<8);
                lowByte = null;
                serialGPTCaptureCodeUnit(host,codeUnit);
            }

            return bytes.length;
        }

        this.bindHost = function(card)
        {
            if(serialUnsubscribe)
            {
                serialUnsubscribe();
                serialUnsubscribe = null;
            }
            if(peerUnsubscribe)
            {
                peerUnsubscribe();
                peerUnsubscribe = null;
            }

            host = card || null;
            lowByte = null;

            if(!host) return false;

            Object.defineProperty(host,"_serialGPTDevice",{
                 "configurable":true
                ,"enumerable":false
                ,"writable":true
                ,"value":device
            });

            /*
             * Temporary streaming hookup until Apple2IO gains persistent
             * pipeConnect()/pipeDisconnect(). Device contracts do not depend on
             * this mechanism, so replacing it later is mechanical:
             *
             *   n:SPGPT:serial <-> n:SPSERIAL:serial
             */
            var serial =
                typeof(host.getSerialLineDevice)=="function"
                    ? host.getSerialLineDevice()
                    : null;

            if(serial && typeof(serial.subscribe)=="function")
                serialUnsubscribe = serial.subscribe(function(bytes,meta)
                {
                    consume(bytes);
                });

            if(serial && typeof(serial.receiveBytes)=="function")
                peerUnsubscribe = device.subscribe(function(bytes,meta)
                {
                    serial.receiveBytes(
                        bytes,
                        Object.assign({"source":"spgpt"},meta || {})
                    );
                });

            return true;
        };

        // Raw bytes arriving from a future generic pipe.
        this.receive = function(message,context)
        {
            var bytes = normalizeBytes(
                message && message.data!==undefined
                    ? message.data
                    : message
            );

            if(!bytes) return false;
            consume(bytes);
            return true;
        };

        this.receiveBytes = function(data)
        {
            var bytes = normalizeBytes(data);
            return bytes ? consume(bytes) : 0;
        };

        this.subscribe = function(callback)
        {
            if(typeof(callback)!="function") return function(){};

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
                try { snapshot[i](bytes,meta || {}); }
                catch(error)
                {
                    console.error("SPGPT serial subscriber failed",error);
                }
            }

            return bytes.length;
        };

        this.transmitText = function(text)
        {
            var formatted = serialGPTWireText(text);
            var bytes = serialGPTEncodeUTF16LE(formatted.wire);

            this.transmitBytes(
                bytes,
                {
                     "source":"gpt"
                    ,"encoding":"utf-16le"
                }
            );

            return formatted.text;
        };

        this.reset = function()
        {
            // A reset may interrupt a code unit between its low/high byte.
            lowByte = null;
            return true;
        };
    }

    global.SerialProGPTDevice = SerialProGPTDevice;


    /*
     * SPGPT is the remote serial peer, not part of the Serial Pro logic board.
     * Its public boundary intentionally uses the same byte-stream contract as
     * SPSERIAL. Unicode remains internal to the GPT/API side.
     */
    function SerialProGPTDevice()
    {
        var device = this;
        var host = null;
        var listeners = [];

        this.id = {
             "DCODE":"SPGPT"
            ,"hostPCODE":"SPC"
            ,"icon":"fa fa-robot"
            ,"description":"Serial Pro GPT serial peer"
        };

        this.ports = {
            "serial":{
                 "direction":"duplex"
                ,"mime":["application/octet-stream"]
                ,"handler":"receive"
                ,"description":"GPT peer 8-bit serial byte stream"
            }
        };

        function normalizeBytes(data)
        {
            if(data instanceof Uint8Array) return data;
            if(data instanceof ArrayBuffer) return new Uint8Array(data);

            if(ArrayBuffer.isView(data))
                return new Uint8Array(data.buffer,data.byteOffset,data.byteLength);

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

            if(host)
                Object.defineProperty(host,"_serialGPTDevice",{
                     "configurable":true
                    ,"enumerable":false
                    ,"writable":true
                    ,"value":device
                });

            return !!host;
        };

        /*
         * Bytes received from SPSERIAL are Apple II -> GPT traffic.
         */
        this.receive = function(message,context)
        {
            var bytes = normalizeBytes(
                message && message.data!==undefined
                    ? message.data
                    : message
            );

            if(!bytes || !host) return false;

            for(var i=0;i<bytes.length;i++)
                serialGPTCaptureByte(host,bytes[i]);

            return true;
        };

        this.receiveBytes = function(data)
        {
            var bytes = normalizeBytes(data);
            if(!bytes || !host) return 0;

            for(var i=0;i<bytes.length;i++)
                serialGPTCaptureByte(host,bytes[i]);

            return bytes.length;
        };

        /*
         * GPT -> serial traffic. Unicode is normalized to 7-bit ASCII before
         * crossing the serial boundary; CR terminates each transmitted line.
         */
        this.transmitText = function(text)
        {
            var ascii = serialGPTASCII(text)
                .replace(/\r\n/g,"\n")
                .replace(/\r/g,"\n")
                .replace(/\n+$/g,"");

            var bytes = [];
            var lines = ascii.split("\n");
            if(!lines.length) lines = [""];

            for(var i=0;i<lines.length;i++)
            {
                for(var j=0;j<lines[i].length;j++)
                    bytes.push(lines[i].charCodeAt(j) & 0x7F);
                bytes.push(0x0D);
            }

            this.transmitBytes(new Uint8Array(bytes),{"source":"gpt"});
            return ascii;
        };

        this.subscribe = function(callback)
        {
            if(typeof(callback)!="function") return function(){};

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
                try { snapshot[i](bytes,meta || {}); }
                catch(error)
                {
                    console.error("SPGPT serial subscriber failed",error);
                }
            }

            return bytes.length;
        };

        this.reset = function()
        {
            return true;
        };
    }

    global.SerialProGPTDevice = SerialProGPTDevice;

    function serialGPTState(card)
    {
        if(card._serialGPT) return card._serialGPT;

        Object.defineProperty(card,"_serialGPT",{
            configurable:true,
            enumerable:false,
            writable:true,
            value:{
                 enabled:false
                ,apiKey:""
                ,line:""
                ,lastCR:false
                ,pending:[]
                ,busy:false
                ,abortController:null
                ,history:[]
                ,echoGuard:[]
                ,echoGuardIndex:0
                ,echoGuardExpires:0
            }
        });

        return card._serialGPT;
    }

    function serialGPTPopup(card)
    {
        if(typeof(document)==="undefined") return null;

        var popup = document.getElementById("serialProTerminal_popup");
        if(!popup) return null;

        var slotN = card && card.mount ? Number(card.mount.slotN) : null;
        var popupSlotN = Number(popup.getAttribute("data-slotN"));

        if(slotN!==null && Number.isFinite(slotN) && popupSlotN!==slotN)
            return null;

        return popup;
    }

    function serialGPTTerminal(card)
    {
        var popup = serialGPTPopup(card);
        return popup && popup._terminal ? popup._terminal : null;
    }

    function serialGPTStatus(card,text)
    {
        var terminal = serialGPTTerminal(card);
        if(terminal && typeof(terminal.write)==="function")
            terminal.write("[GPT] "+String(text)+"\n","meta");
    }

    function serialGPTUpdateButton(card)
    {
        var popup = serialGPTPopup(card);
        if(!popup) return false;

        var state = serialGPTState(card);
        var button = popup.querySelector("[data-serial-gpt-button]");
        var icon = popup.querySelector("[data-serial-gpt]");
        if(!button || !icon) return false;

        button.title = state.enabled
            ? "Disable GPT serial peer ("+SERIAL_GPT_MODEL+")"
            : "Enable GPT serial peer";
        button.setAttribute("aria-label",button.title);

        icon.classList.toggle("blink",!!state.busy);
        icon.style.opacity = state.enabled ? "1" : "0.55";
        return true;
    }

    function serialGPTEnsureButton(card)
    {
        var popup = serialGPTPopup(card);
        if(!popup) return false;

        var title = popup.querySelector(".com_popup_title");
        if(!title) return false;

        var existing = title.querySelector("[data-serial-gpt-button]");
        if(!existing)
        {
            var button = document.createElement("button");
            button.className = "appbut skinny";
            button.type = "button";
            button.setAttribute("data-serial-gpt-button","");
            button.innerHTML = '<i class="fa fa-robot" data-serial-gpt></i>';
            button.addEventListener("mousedown",function(event){ event.preventDefault(); });
            button.addEventListener("click",function(){ card.serialGPTToggle(); });

            var plugIcon = title.querySelector("[data-serial-webserial]");
            var plugButton = plugIcon && plugIcon.closest ? plugIcon.closest("button") : null;
            if(plugButton) title.insertBefore(button,plugButton);
            else title.appendChild(button);
        }

        serialGPTUpdateButton(card);
        return true;
    }

    function serialGPTTrimHistory(state)
    {
        while(state.history.length>SERIAL_GPT_HISTORY_MESSAGES)
            state.history.shift();

        function chars()
        {
            var n = 0;
            for(var i=0;i<state.history.length;i++)
                n += String(state.history[i].text || "").length;
            return n;
        }

        while(state.history.length>2 && chars()>SERIAL_GPT_HISTORY_CHARS)
            state.history.shift();
    }

    function serialGPTBuildInput(state,message)
    {
        var blocks = [];
        for(var i=0;i<state.history.length;i++)
        {
            var h = state.history[i];
            blocks.push((h.role==="assistant" ? "GPT" : "APPLE II")+": "+h.text);
        }
        blocks.push("APPLE II: "+message);
        return blocks.join("\n\n");
    }

    function serialGPTExtractText(data)
    {
        if(data && typeof(data.output_text)==="string" && data.output_text.length)
            return data.output_text;

        var parts = [];
        var output = data && Array.isArray(data.output) ? data.output : [];
        for(var i=0;i<output.length;i++)
        {
            var item = output[i];
            var content = item && Array.isArray(item.content) ? item.content : [];
            for(var j=0;j<content.length;j++)
            {
                var part = content[j];
                if(part && part.type==="output_text" && typeof(part.text)==="string")
                    parts.push(part.text);
            }
        }
        return parts.join("");
    }

    function serialGPTRequestId(response)
    {
        if(!response || !response.headers || typeof(response.headers.get)!=="function")
            return null;

        return response.headers.get("x-request-id")
            || response.headers.get("openai-request-id")
            || null;
    }

    function serialGPTWarn(label,response,data,raw)
    {
        /*
         * Never include request headers or state.apiKey in diagnostics.
         * The response body is retained because status/incomplete_details,
         * output and usage are exactly what is needed to diagnose successful
         * HTTP responses that nevertheless contain no output_text.
         */
        console.warn("[SerialPro GPT] "+label,{
             httpStatus:response ? response.status : null
            ,httpStatusText:response ? response.statusText : null
            ,requestId:serialGPTRequestId(response)
            ,responseId:data && data.id ? data.id : null
            ,status:data && data.status ? data.status : null
            ,incompleteDetails:data ? data.incomplete_details || null : null
            ,error:data ? data.error || null : null
            ,usage:data ? data.usage || null : null
            ,output:data ? data.output || null : null
            ,raw:data ? null : raw
            ,response:data || null
        });
    }

    function serialGPTNoTextMessage(data)
    {
        var details = [];

        if(data && data.status)
            details.push("status="+String(data.status));

        var incomplete = data && data.incomplete_details;
        if(incomplete && incomplete.reason)
            details.push("reason="+String(incomplete.reason));

        if(data && data.error && data.error.message)
            details.push("error="+String(data.error.message));

        return "OpenAI returned no text output"
            +(details.length ? " ("+details.join(", ")+")" : "")
            +".";
    }

    async function serialGPTRequest(card,message)
    {
        var state = serialGPTState(card);
        var controller = typeof(AbortController)==="function" ? new AbortController() : null;
        state.abortController = controller;

        var payload = {
             model:SERIAL_GPT_MODEL
            ,instructions:SERIAL_GPT_INSTRUCTIONS
            ,input:serialGPTBuildInput(state,message)
            ,max_output_tokens:SERIAL_GPT_MAX_OUTPUT_TOKENS
        };

        var response = await fetch(SERIAL_GPT_API_URL,{
             method:"POST"
            ,headers:{
                 "Content-Type":"application/json"
                ,"Authorization":"Bearer "+state.apiKey
            }
            ,body:JSON.stringify(payload)
            ,signal:controller ? controller.signal : undefined
        });

        var raw = await response.text();
        var data = null;
        try { data = raw ? JSON.parse(raw) : {}; }
        catch(ignore) {}

        if(!response.ok)
        {
            serialGPTWarn("OpenAI HTTP request failed",response,data,raw);

            var messageText = data && data.error && data.error.message
                ? data.error.message
                : (raw || ("HTTP "+response.status));
            throw new Error(messageText);
        }

        if(!data)
        {
            serialGPTWarn("OpenAI returned a non-JSON response",response,null,raw);
            throw new Error("OpenAI returned a non-JSON response.");
        }
        var answer = serialGPTExtractText(data);
        if(!answer.length)
        {
            serialGPTWarn("OpenAI response contained no text output",response,data,raw);
            throw new Error(serialGPTNoTextMessage(data));
        }    

        return answer;
    }

    function serialGPTSetEchoGuard(state,wireText)
    {
        var codeUnits = [];
        wireText = String(wireText===undefined ? "" : wireText);
        for(var i=0;i<wireText.length;i++)
            codeUnits.push(wireText.charCodeAt(i));

        state.echoGuard = codeUnits;
        state.echoGuardIndex = 0;
        state.echoGuardExpires = Date.now()+SERIAL_GPT_ECHO_GUARD_MS;
    }

    function serialGPTInject(card,text)
    {
        var state = serialGPTState(card);
        var formatted = serialGPTWireText(text);

        serialGPTSetEchoGuard(state,formatted.wire);

        var device = card && card._serialGPTDevice;
        if(device && typeof(device.transmitText)=="function")
            return device.transmitText(formatted.text);

        /*
         * Defensive fallback for tools that construct the card without attached
         * devices. Preserve the UTF-16LE byte protocol even in that case.
         */
        if(card && typeof(card.serialLineReceiveBytes)=="function")
        {
            card.serialLineReceiveBytes(
                serialGPTEncodeUTF16LE(formatted.wire),
                {
                     "source":"spgpt"
                    ,"encoding":"utf-16le"
                }
            );
            return formatted.text;
        }

        return "";
    }

    function serialGPTQueueError(card,err)
    {
        var state = serialGPTState(card);
        if(!state.enabled) return;

        /*
         * This also catches browser/network failures that occur before an HTTP
         * response exists. Server-response failures already have a structured
         * warning from serialGPTRequest(); keeping the Error object here adds
         * its JavaScript stack without exposing the API key.
         */
        console.warn("[SerialPro GPT] request failed",err);

        var detail = err && err.message ? err.message : String(err);
        serialGPTStatus(card,"request failed: "+detail);

        // Give software waiting on the serial peer a deterministic reply while
        // keeping API diagnostics in the browser terminal rather than on-wire.
        serialGPTInject(card,"ERROR: GPT REQUEST FAILED");
    }

    function serialGPTProcess(card)
    {
        var state = serialGPTState(card);
        if(!state.enabled || state.busy || !state.pending.length) return;

        var message = state.pending.shift();
        state.busy = true;
        serialGPTUpdateButton(card);

        serialGPTRequest(card,message)
            .then(function(answer)
            {
                if(!state.enabled) return;
                var unicodeAnswer = serialGPTInject(card,answer);
                state.history.push({role:"user",text:message});
                state.history.push({role:"assistant",text:unicodeAnswer});
                serialGPTTrimHistory(state);
            })
            .catch(function(err)
            {
                if(err && err.name==="AbortError") return;
                serialGPTQueueError(card,err);
            })
            .finally(function()
            {
                state.busy = false;
                state.abortController = null;
                serialGPTUpdateButton(card);
                if(state.enabled && state.pending.length)
                    serialGPTProcess(card);
            });
    }

    function serialGPTFinishLine(card)
    {
        var state = serialGPTState(card);
        var message = state.line;
        state.line = "";

        if(!message.trim().length) return;
        state.pending.push(message);
        serialGPTProcess(card);
    }

    function serialGPTConsumeEcho(state,c)
    {
        if(!state.echoGuard.length) return false;
        if(Date.now()>state.echoGuardExpires)
        {
            state.echoGuard = [];
            state.echoGuardIndex = 0;
            return false;
        }

        if(c===state.echoGuard[state.echoGuardIndex])
        {
            state.echoGuardIndex++;
            if(state.echoGuardIndex>=state.echoGuard.length)
            {
                state.echoGuard = [];
                state.echoGuardIndex = 0;
            }
            return true;
        }

        // It is not an exact echo of the GPT reply; treat it as fresh Apple II
        // output immediately rather than swallowing real input.
        state.echoGuard = [];
        state.echoGuardIndex = 0;
        return false;
    }

    function serialGPTCaptureCodeUnit(card,codeUnit)
    {
        var state = serialGPTState(card);
        if(!state.enabled) return;

        var c = Number(codeUnit) & 0xFFFF;
        if(serialGPTConsumeEcho(state,c)) return;

        if(c===0x000D)
        {
            serialGPTFinishLine(card);
            state.lastCR = true;
            return;
        }

        if(c===0x000A)
        {
            if(state.lastCR)
            {
                state.lastCR = false;
                return;
            }
            serialGPTFinishLine(card);
            return;
        }

        state.lastCR = false;

        if(c===0x0008 || c===0x007F)
        {
            var length = state.line.length;
            if(length)
            {
                var last = state.line.charCodeAt(length-1);
                var remove = 1;

                // Backspace removes one Unicode scalar when it is a surrogate pair.
                if(last>=0xDC00 && last<=0xDFFF && length>=2)
                {
                    var previous = state.line.charCodeAt(length-2);
                    if(previous>=0xD800 && previous<=0xDBFF)
                        remove = 2;
                }

                state.line = state.line.slice(0,length-remove);
            }
            return;
        }

        if(c===0x0009) c = 0x0020;       // retain former terminal TAB policy
        if(c<0x0020) return;              // ignore other C0 controls
 
        if(state.line.length<SERIAL_GPT_MAX_INPUT_CHARS)
            state.line += String.fromCharCode(c);
    }

    function serialGPTEnable(card)
    {
        var state = serialGPTState(card);
        if(state.enabled) return true;

        // Same acquisition method and prompt text as tools/PromptJS.html.
        var key = typeof(global.prompt)==="function"
            ? global.prompt("Please enter your API key:")
            : null;

        key = key===null || key===undefined ? "" : String(key).trim();
        if(!key.length)
        {
            if(typeof(global.alert)==="function")
                global.alert("API key is required to enable the GPT serial peer.");
            return false;
        }

        state.apiKey = key;
        state.enabled = true;
        state.line = "";
        state.lastCR = false;
        state.pending = [];
        state.history = [];
        state.echoGuard = [];
        state.echoGuardIndex = 0;
        state.echoGuardExpires = 0;

        serialGPTUpdateButton(card);
        serialGPTStatus(
            card,
            "serial peer enabled ("+SERIAL_GPT_MODEL+"). "
            +"Protocol: UTF-16LE; terminate a line with U+000D (bytes 0D 00)."
        );
        return true;
    }

    function serialGPTDisable(card)
    {
        var state = serialGPTState(card);

        if(state.abortController)
        {
            try { state.abortController.abort(); } catch(ignore) {}
        }

        state.enabled = false;
        state.apiKey = "";
        state.line = "";
        state.lastCR = false;
        state.pending = [];
        state.history = [];
        state.echoGuard = [];
        state.echoGuardIndex = 0;
        state.echoGuardExpires = 0;

        serialGPTUpdateButton(card);
        serialGPTStatus(card,"serial peer disabled; API key cleared from memory.");
        return false;
    }

    function install(card)
    {
        if(!card || card._serialGPTInstalled) return card;

        /*
         * The wrapped constructor runs before Apple2IO.provisionPeripheral(),
         * therefore SPGPT is available as a normal SPC child device alongside
         * SPSERIAL when the mounted card is provisioned.
         */
        if(!Array.isArray(card.deviceConfig))
            card.deviceConfig = [];

        var hasSPGPT = card.deviceConfig.some(function(info)
        {
            return String(info && info.DCODE || "").toUpperCase()=="SPGPT";
        });

        if(!hasSPGPT)
            card.deviceConfig.push({
                 "DCODE":"SPGPT"
                ,"hostPCODE":"SPC"
                ,"coID":"SerialProGPTDevice"
                ,"icon":"fa fa-robot"
                ,"description":"Serial Pro GPT UTF-16LE serial peer"
            });

        if(!Array.isArray(card.deviceConfig))
            card.deviceConfig = [];

        var hasSPGPT = card.deviceConfig.some(function(info)
        {
            return String(info && info.DCODE || "").toUpperCase()=="SPGPT";
        });

        if(!hasSPGPT)
            card.deviceConfig.push({
                 "DCODE":"SPGPT"
                ,"hostPCODE":"SPC"
                ,"coID":"SerialProGPTDevice"
                ,"icon":"fa fa-robot"
                ,"description":"Serial Pro GPT serial peer"
            });

        Object.defineProperty(card,"_serialGPTInstalled",{
            configurable:true,
            enumerable:false,
            value:true
        });

        serialGPTState(card);

        /*
         * Do not wrap serialTerminalWriteByte(). SPGPT now observes the real
         * SPSERIAL output stream through its device connection instead of
         * piggy-backing on the browser terminal adapter.
         */

        var baseTerminalToggle = card.serialTerminalToggle;
        if(typeof(baseTerminalToggle)==="function")
        {
            card.serialTerminalToggle = function()
            {
                var result = baseTerminalToggle.apply(card,arguments);
                serialGPTEnsureButton(card);
                return result;
            };
        }

        var baseTerminalHelp = card.serialTerminalHelp;
        if(typeof(baseTerminalHelp)==="function")
        {
            card.serialTerminalHelp = function()
            {
                var result = baseTerminalHelp.apply(card,arguments);
                var terminal = serialGPTTerminal(card);
                if(result && terminal && typeof(terminal.output)==="function")
                {
                    terminal.output(
                        "<br><b>GPT serial peer</b><br>"
                        +"Use <i class=\"fa fa-robot\"></i> to enable/disable GPT replies.<br>"
                        +"Enabling prompts for an OpenAI API key; the key stays only in page memory and is cleared when disabled/reloaded.<br>"
                        +"SPGPT and SPSERIAL carry raw 8-bit bytes; SPGPT interprets those bytes as UTF-16LE code units.<br>"
                        +"Apple II TX text is collected until U+000D/U+000A, sent to "+SERIAL_GPT_MODEL+", and the Unicode reply is encoded as UTF-16LE back through the normal 6551 RX path.<br>"
                        +"Use 8 data bits on the 6551 for unrestricted UTF-16LE byte values. An exact echo of a GPT reply is suppressed briefly to avoid a terminal echo feedback loop."
                    );
                }
                return result;
            };
        }

        card.serialGPTToggle = function()
        {
            var state = serialGPTState(card);
            return state.enabled ? serialGPTDisable(card) : serialGPTEnable(card);
        };

        card.serialGPTDisable = function()
        {
            return serialGPTDisable(card);
        };

        card.serialGPTInfo = function()
        {
            var state = serialGPTState(card);
            return {
                 enabled:!!state.enabled
                ,busy:!!state.busy
                ,pending:state.pending.length
                ,lineChars:state.line.length
                ,historyMessages:state.history.length
                ,model:SERIAL_GPT_MODEL
                ,apiUrl:SERIAL_GPT_API_URL
                ,serialEncoding:"UTF-16LE"
                ,serialMime:"application/octet-stream"
            };
        };

        return card;
    }

    function installDiscoveryConstructor()
    {
        var IO = global.oEMU && global.oEMU.component && global.oEMU.component.IO;
        var discovery = IO && IO.SerialPro;
        if(!discovery || typeof(discovery.constructor)!=="function") return false;

        var OriginalSerialProCard = discovery.constructor;
        if(OriginalSerialProCard._serialGPTWrapped) return true;

        function SerialProCardGPT()
        {
            OriginalSerialProCard.apply(this,arguments);
            install(this);
        }

        SerialProCardGPT.prototype = OriginalSerialProCard.prototype;
        Object.defineProperty(SerialProCardGPT,"_serialGPTWrapped",{
            value:true,
            enumerable:false
        });

        // Apple2IO.scanPeripheralContainers() retains container.constructor and
        // later creates the live peripheral with new peripheral_info.ctor().
        Object.defineProperty(discovery,"constructor",{
             configurable:true
            ,enumerable:false
            ,writable:true
            ,value:SerialProCardGPT
        });

        // Keep direct/manual construction consistent with the discovery path.
        if(global.SerialProCard===OriginalSerialProCard)
            global.SerialProCard = SerialProCardGPT;

        install(discovery);
        return true;
    }

    global.SerialProGPTBridge = {
         apiUrl:SERIAL_GPT_API_URL
        ,model:SERIAL_GPT_MODEL
        ,install:install
        ,installDiscoveryConstructor:installDiscoveryConstructor
    };

    installDiscoveryConstructor();

})(typeof(window)!=="undefined" ? window : globalThis);
