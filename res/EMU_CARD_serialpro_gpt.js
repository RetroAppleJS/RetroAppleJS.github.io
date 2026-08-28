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
    const SERIAL_GPT_MODEL = "gpt-5.6-luna";
    const SERIAL_GPT_MAX_OUTPUT_TOKENS = 512;
    const SERIAL_GPT_MAX_INPUT_CHARS = 4096;
    const SERIAL_GPT_HISTORY_MESSAGES = 8;
    const SERIAL_GPT_HISTORY_CHARS = 12000;
    const SERIAL_GPT_ECHO_GUARD_MS = 15000;

    const SERIAL_GPT_MODE_ASCII = "ascii";
    const SERIAL_GPT_MODE_UTF16LE = "utf16le";
    const SERIAL_GPT_MIME_ASCII = "text/plain; charset=us-ascii";
    const SERIAL_GPT_MIME_UTF16LE = "text/plain; charset=utf-16le";

    const SERIAL_GPT_INSTRUCTIONS = [
        "You are the remote conversational peer on an Apple II serial link.",
        "Answer the newest APPLE II message as plain text.",
        "Do not use Markdown unless the user explicitly asks for Markdown.",
        "Be concise enough for a vintage text terminal.",
        "Do not prefix the answer with GPT:, ASSISTANT:, or another speaker label.",
        "When source code is requested, return plain source text suitable for a serial terminal."
    ];

    function serialGPTInstructions(state)
    {
        var instructions = SERIAL_GPT_INSTRUCTIONS.slice();

        if(state && state.mode===SERIAL_GPT_MODE_ASCII)
        {
            instructions.push(
                "The active GPT8 serial session uses US-ASCII: use only standard 7-bit ASCII characters."
            );
            instructions.push(
                "Avoid Unicode punctuation or characters that require transliteration."
            );
        }
        else
        {
            instructions.push(
                "The active GPT16 serial session transports Unicode text as UTF-16LE."
            );
            instructions.push(
                "Unicode characters are allowed."
            );
        }

        return instructions.join(" ");
    }

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

    function serialGPTASCII(text)
    {
        text = serialGPTNormalizeText(text)
            .replace(/[\u2018\u2019\u2032]/g,"'")
            .replace(/[\u201C\u201D\u2033]/g,'"')
            .replace(/[\u2013\u2014]/g,"-")
            .replace(/\u2026/g,"...")
            .replace(/\u00A0/g," ");

        if(typeof(text.normalize)==="function")
            text = text.normalize("NFKD").replace(/[\u0300-\u036f]/g,"");

        var out = "";
        for(var i=0;i<text.length;i++)
        {
            var c = text.charCodeAt(i);
            if(c===0x0A) out += "\n";
            else if(c===0x09) out += "\t";
            else if(c>=0x20 && c<=0x7E) out += text.charAt(i);
            else out += "?";
        }
        return out;
    }

    function serialGPTEncodeASCII(text)
    {
        text = String(text===undefined || text===null ? "" : text);

        var bytes = new Uint8Array(text.length);
        for(var i=0;i<text.length;i++)
            bytes[i] = text.charCodeAt(i) & 0x7F;

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

    function serialGPTEncodeForMode(mode,text)
    {
        mode = mode===SERIAL_GPT_MODE_ASCII
            ? SERIAL_GPT_MODE_ASCII
            : SERIAL_GPT_MODE_UTF16LE;

        var sourceText = mode===SERIAL_GPT_MODE_ASCII
            ? serialGPTASCII(text)
            : serialGPTNormalizeText(text);

        var formatted = serialGPTWireText(sourceText);

        return {
             "mode":mode
            ,"mime":mode===SERIAL_GPT_MODE_ASCII
                ? SERIAL_GPT_MIME_ASCII
                : SERIAL_GPT_MIME_UTF16LE
            ,"text":formatted.text
            ,"wire":formatted.wire
            ,"bytes":mode===SERIAL_GPT_MODE_ASCII
                ? serialGPTEncodeASCII(formatted.wire)
                : serialGPTEncodeUTF16LE(formatted.wire)
        };
    }

    /*
     * SPGPT is a remote serial peer device. SPSERIAL remains a representation-
     * agnostic byte stream; SPGPT advertises the two textual representations it
     * can serialize onto that stream.
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
        var consoleUnsubscribe = null;
        var listeners = [];
        var consoleListeners = [];

        this.id = {
             "DCODE":"SPGPT"
            ,"hostPCODE":"SPC"
            ,"icon":"fa fa-robot"
            ,"description":"Serial Pro GPT8/GPT16 serial peer"
        };

        this.ports = {
            "serial":{
                 "direction":"duplex"
                ,"mime":[
                     SERIAL_GPT_MIME_ASCII
                    ,SERIAL_GPT_MIME_UTF16LE
                 ]
                ,"handler":"receive"
                ,"open":"isSessionOpen"
                ,"description":"GPT text peer: US-ASCII (GPT8) or UTF-16LE (GPT16)"
            }
            ,"console":{
                 "direction":"out"
                ,"mime":["text/plain; charset=utf-8"]
                ,"description":"GPT request/encoding/serial diagnostics"
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

            var state = serialGPTState(host);
            if(!state.enabled)
            {
                lowByte = null;
                return bytes.length;
            }

            if(state.mode===SERIAL_GPT_MODE_ASCII)
            {
                lowByte = null;

                for(var i=0;i<bytes.length;i++)
                {
                    /*
                     * GPT8 is standard US-ASCII transported in one 8-bit serial
                     * frame per character. Strip bit 7 on receive so Apple-style
                     * high-bit ASCII remains usable without changing the wire MIME.
                     */
                    serialGPTCaptureCodeUnit(host,bytes[i] & 0x7F);
                }

                return bytes.length;
            }

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
            if(consoleUnsubscribe)
            {
                consoleUnsubscribe();
                consoleUnsubscribe = null;
            }

            host = card || null;
            lowByte = null;

            if(!host) return false;

            /*
             * Install GPT session behavior on the live mounted card. This is
             * more reliable than depending on the discovery-constructor wrapper:
             * bindHost() is called by Apple2IO.attach() for this exact instance.
             */
            install(host);

            Object.defineProperty(host,"_serialGPTDevice",{
                 "configurable":true
                ,"enumerable":false
                ,"writable":true
                ,"value":device
            });

            // No-op when the terminal popup has not been opened yet.
            serialGPTEnsureButton(host);

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

            var terminal =
                typeof(host.getSerialTerminalConsoleDevice)=="function"
                    ? host.getSerialTerminalConsoleDevice()
                    : null;

            if(terminal && typeof(terminal.receiveText)=="function")
                consoleUnsubscribe = device.subscribeConsole(function(text,meta)
                {
                    terminal.receiveText(
                        text,
                        Object.assign({"source":"spgpt"},meta || {})
                    );
                });

            return true;
        };

        this.isSessionOpen = function()
        {
            return !!(
                host &&
                serialGPTState(host).enabled
            );
        };

        this.setMode = function(mode)
        {
            lowByte = null;
            return mode===SERIAL_GPT_MODE_ASCII
                ? SERIAL_GPT_MODE_ASCII
                : SERIAL_GPT_MODE_UTF16LE;
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

        this.subscribeConsole = function(callback)
        {
            if(typeof(callback)!="function")
                return function(){};

            if(consoleListeners.indexOf(callback)<0)
                consoleListeners.push(callback);

            var subscribed = true;
            return function()
            {
                if(!subscribed) return;
                subscribed = false;

                var index = consoleListeners.indexOf(callback);
                if(index>=0) consoleListeners.splice(index,1);
            };
        };

        this.transmitConsole = function(text,meta)
        {
            text = String(text===undefined ? "" : text);
            var snapshot = consoleListeners.slice();

            for(var i=0;i<snapshot.length;i++)
            {
                try { snapshot[i](text,meta || {}); }
                catch(error)
                {
                    console.error("SPGPT console subscriber failed",error);
                }
            }

            return text.length;
        };

        this.transmitText = function(text)
        {
            var state = host ? serialGPTState(host) : null;
            var packet = serialGPTEncodeForMode(
                state ? state.mode : SERIAL_GPT_MODE_UTF16LE,
                text
            );

            if(state)
                serialGPTSetEchoGuard(state,packet.wire);

            var zeroBytes = 0;
            var nulWords = 0;
            var hex = [];
            var bytes = packet.bytes;

            for(var i=0;i<bytes.length;i++)
            {
                if(bytes[i]===0) zeroBytes++;

                if(i<24)
                    hex.push(
                        (bytes[i] & 0xFF)
                            .toString(16)
                            .toUpperCase()
                            .padStart(2,"0")
                    );
            }

            if(packet.mode===SERIAL_GPT_MODE_UTF16LE)
            {
                for(var i=0;i+1<bytes.length;i+=2)
                    if(bytes[i]===0 && bytes[i+1]===0)
                        nulWords++;
            }

            var before = host &&
                typeof(host.serialLineReceiveInfo)=="function"
                    ? host.serialLineReceiveInfo()
                    : null;

            serialGPTStatus(
                host,
                (packet.mode===SERIAL_GPT_MODE_ASCII ? "GPT8" : "GPT16")
                +" reply encode: text="+packet.text.length
                +" wire="+packet.wire.length
                +" bytes="+bytes.length
                +" zeroBytes="+zeroBytes
                +" nulWords="+nulWords
            );

            serialGPTStatus(
                host,
                "wire prefix: "+hex.join(" ")
            );

            this.transmitBytes(
                packet.bytes,
                {
                     "source":"gpt"
                    ,"mime":packet.mime
                    ,"mode":packet.mode
                }
            );

            var after = host &&
                typeof(host.serialLineReceiveInfo)=="function"
                    ? host.serialLineReceiveInfo()
                    : null;

            if(before && after)
            {
                serialGPTStatus(
                    host,
                    "SPSERIAL RX inject: before q="+before.queued
                    +" full="+(before.rxFull?1:0)
                    +" busy="+(before.rxBusy?1:0)
                    +" -> after q="+after.queued
                    +" full="+(after.rxFull?1:0)
                    +" busy="+(after.rxBusy?1:0)
                );
            }

            if(host && typeof(setTimeout)=="function")
            {
                setTimeout(function()
                {
                    if(typeof(host.serialLineReceiveInfo)!="function") return;
                    var info = host.serialLineReceiveInfo();

                    serialGPTStatus(
                        host,
                        "SPSERIAL RX +500ms: q="+info.queued
                        +" full="+(info.rxFull?1:0)
                        +" busy="+(info.rxBusy?1:0)
                        +" data=$"+(info.rxData & 0xFF)
                            .toString(16).toUpperCase().padStart(2,"0")
                        +" shift=$"+(info.rxShift & 0xFF)
                            .toString(16).toUpperCase().padStart(2,"0")
                    );
                },500);
            }

            return packet.text;
        };

        this.reset = function()
        {
            // A reset may interrupt a code unit between its low/high byte.
            lowByte = null;
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
                ,mode:null
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
        text = "[GPT] "+String(text)+"\n";

        var device = card && card._serialGPTDevice;
        if(device && typeof(device.transmitConsole)=="function")
        {
            var delivered = device.transmitConsole(
                text,
                {
                     "source":"spgpt"
                    ,"mime":"text/plain; charset=utf-8"
                }
            );

            if(delivered) return delivered;
        }

        // Bootstrap fallback before SPTERM is provisioned/opened.
        var terminal = serialGPTTerminal(card);
        if(terminal && typeof(terminal.write)==="function")
            terminal.write(text,"meta");

        return text.length;
    }

    function serialGPTUpdateButton(card)
    {
        var popup = serialGPTPopup(card);
        if(!popup) return false;

        var state = serialGPTState(card);
        var modes = [
            {
                 "mode":SERIAL_GPT_MODE_ASCII
                ,"label":"GPT8"
                ,"button":"[data-serial-gpt8-button]"
                ,"icon":"[data-serial-gpt8]"
                ,"description":"US-ASCII"
            }
            ,{
                 "mode":SERIAL_GPT_MODE_UTF16LE
                ,"label":"GPT16"
                ,"button":"[data-serial-gpt16-button]"
                ,"icon":"[data-serial-gpt16]"
                ,"description":"UTF-16LE"
            }
        ];
        var found = false;

        for(var i=0;i<modes.length;i++)
        {
            var info = modes[i];
            var button = popup.querySelector(info.button);
            var icon = popup.querySelector(info.icon);
            if(!button || !icon) continue;

            found = true;
            var active = state.enabled && state.mode===info.mode;

            button.title = active
                ? "Stop "+info.label+" "+info.description+" serial session"
                : (state.enabled
                    ? "Switch GPT serial session to "+info.label+" "+info.description
                    : "Start "+info.label+" "+info.description+" serial session");

            button.setAttribute("aria-label",button.title);
            button.style.fontWeight = active ? "bold" : "normal";
            icon.classList.toggle("blink",!!state.busy && active);
            icon.style.opacity = active ? "1" : "0.55";
        }

        return found;
    }

    function serialGPTEnsureButton(card)
    {
        var popup = serialGPTPopup(card);
        if(!popup) return false;

        var title = popup.querySelector(".com_popup_title");
        if(!title) return false;

        // Remove the single-mode control left by an older live DOM, if any.
        var legacy = title.querySelector("[data-serial-gpt-button]");
        if(legacy && legacy.parentNode)
            legacy.parentNode.removeChild(legacy);

        var plugIcon = title.querySelector("[data-serial-webserial]");
        var plugButton = plugIcon && plugIcon.closest ? plugIcon.closest("button") : null;

        function ensureModeButton(mode,label,buttonAttr,iconAttr)
        {
            var existing = title.querySelector("["+buttonAttr+"]");
            if(existing) return existing;

            var button = document.createElement("button");
            button.className = "appbut skinny";
            button.type = "button";

            button.setAttribute(buttonAttr,"");
            button.innerHTML =
                '<i class="fa fa-robot" '+iconAttr+'></i>&nbsp;'+label;
            button.addEventListener("mousedown",function(event){ event.preventDefault(); });
            button.addEventListener("click",function(){ card.serialGPTToggle(mode); });

            if(plugButton) title.insertBefore(button,plugButton);
            else title.appendChild(button);
            return button;
        }

        ensureModeButton(
            SERIAL_GPT_MODE_ASCII,
            "GPT8",
            "data-serial-gpt8-button",
            "data-serial-gpt8"
        );

        ensureModeButton(
            SERIAL_GPT_MODE_UTF16LE,
            "GPT16",
            "data-serial-gpt16-button",
            "data-serial-gpt16"
        );

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

        serialGPTStatus(
            card,
            "API request start: mode="
            +(state.mode===SERIAL_GPT_MODE_ASCII ? "GPT8" : "GPT16")
            +" promptChars="+String(message || "").length
        );

        var payload = {
             model:SERIAL_GPT_MODEL
            ,instructions:serialGPTInstructions(state)
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

        serialGPTStatus(
            card,
            "API HTTP "+response.status
            +(serialGPTRequestId(response)
                ? " requestId="+serialGPTRequestId(response)
                : "")
        );

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

        var answerNuls = 0;
        for(var i=0;i<answer.length;i++)
            if(answer.charCodeAt(i)===0) answerNuls++;

        serialGPTStatus(
            card,
            "API text decoded: chars="+answer.length
            +" U+0000="+answerNuls
        );

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
        var device = card && card._serialGPTDevice;

        if(device && typeof(device.transmitText)=="function")
            return device.transmitText(text);

        /*
         * Defensive fallback for tools that construct the card without attached
         * devices. Preserve the selected GPT8/GPT16 representation.
         */
        if(card && typeof(card.serialLineReceiveBytes)=="function")
        {
            var packet = serialGPTEncodeForMode(state.mode,text);
            serialGPTSetEchoGuard(state,packet.wire);

            card.serialLineReceiveBytes(
                packet.bytes,
                {
                     "source":"spgpt"
                    ,"mime":packet.mime
                    ,"mode":packet.mode
                }
            );
            return packet.text;
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

        serialGPTStatus(
            card,
            "prompt complete: chars="+message.length
            +" pending="+(state.pending.length+1)
        );

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

    function serialGPTEnable(card,mode)
    {
        var state = serialGPTState(card);

        mode = mode===SERIAL_GPT_MODE_ASCII
            ? SERIAL_GPT_MODE_ASCII
            : SERIAL_GPT_MODE_UTF16LE;

        /*
         * Switching GPT8 <-> GPT16 keeps the API key but resets in-flight text
         * framing/history so no half UTF-16 code unit or ASCII line crosses the
         * representation boundary.
         */
        if(state.enabled)
        {
            if(state.mode===mode) return true;

            if(state.abortController)
            {
                try { state.abortController.abort(); } catch(ignore) {}
            }

            if(typeof(card.serialLineResetReceiveSession)=="function")
                card.serialLineResetReceiveSession();

            state.mode = mode;
            state.line = "";
            state.lastCR = false;
            state.pending = [];
            state.busy = false;
            state.abortController = null;
            state.history = [];
            state.echoGuard = [];
            state.echoGuardIndex = 0;
            state.echoGuardExpires = 0;

            if(card._serialGPTDevice &&
               typeof(card._serialGPTDevice.setMode)=="function")
                card._serialGPTDevice.setMode(mode);

            serialGPTUpdateButton(card);
            serialGPTStatus(
                card,
                mode===SERIAL_GPT_MODE_ASCII
                    ? "switched to GPT8: US-ASCII, one serial byte per character; CR is 0D."
                    : "switched to GPT16: UTF-16LE; CR is U+000D (bytes 0D 00)."
            );
            return true;
        }

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

        if(typeof(card.serialLineResetReceiveSession)=="function")
            card.serialLineResetReceiveSession();

        state.apiKey = key;
        state.enabled = true;
        state.mode = mode;
        state.line = "";
        state.lastCR = false;
        state.pending = [];
        state.history = [];
        state.echoGuard = [];
        state.echoGuardIndex = 0;
        state.echoGuardExpires = 0;

        if(card._serialGPTDevice &&
           typeof(card._serialGPTDevice.setMode)=="function")
            card._serialGPTDevice.setMode(mode);

        serialGPTUpdateButton(card);
        serialGPTStatus(
            card,
            mode===SERIAL_GPT_MODE_ASCII
                ? "GPT8 enabled ("+SERIAL_GPT_MODEL+"): US-ASCII; terminate with CR byte 0D."
                : "GPT16 enabled ("+SERIAL_GPT_MODEL+"): UTF-16LE; terminate with U+000D bytes 0D 00."
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
        state.mode = null;
        state.apiKey = "";
        state.line = "";
        state.lastCR = false;
        state.pending = [];
        state.history = [];
        state.echoGuard = [];
        state.echoGuardIndex = 0;
        state.echoGuardExpires = 0;

        if(card._serialGPTDevice &&
           typeof(card._serialGPTDevice.setMode)=="function")
            card._serialGPTDevice.setMode(null);

        serialGPTUpdateButton(card);
        serialGPTStatus(card,"GPT serial peer disabled; API key cleared from memory.");
        return false;
    }

    function install(card)
    {
        if(!card || card._serialGPTInstalled) return card;

        /*
         * SPGPT is declared by SerialProCard.deviceConfig. install() now owns
         * only GPT session/API/UI behavior; device topology is not mutated here.
         */

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
                        +"Use <i class=\"fa fa-robot\"></i> GPT8 for one-byte US-ASCII or <i class=\"fa fa-robot\"></i> GPT16 for UTF-16LE. Only one mode is active at a time.<br>"
                        +"Click the active mode again to stop GPT; click the other mode to switch without re-entering the API key.<br>"
                        +"Enabling prompts for an OpenAI API key; the key stays only in page memory and is cleared when disabled/reloaded.<br>"
                        +"SPSERIAL remains a raw byte transport (<code>application/octet-stream</code>). SPGPT declares the text representation in MIME: <code>text/plain; charset=us-ascii</code> or <code>text/plain; charset=utf-16le</code>.<br>"
                        +"GPT8 collects one ASCII character per byte (bit 7 is ignored on receive); CR is $0D. GPT16 collects UTF-16LE code units; CR is bytes $0D $00.<br>"
                        +"Use 8 data bits on the 6551 for unrestricted GPT16 byte values. An exact echo of a GPT reply is suppressed briefly to avoid a terminal echo feedback loop."
                    );
                }
                return result;
            };
        }

        card.serialGPTToggle = function(mode)
        {
            var state = serialGPTState(card);
            mode = mode===SERIAL_GPT_MODE_ASCII
                ? SERIAL_GPT_MODE_ASCII
                : SERIAL_GPT_MODE_UTF16LE;

            if(state.enabled && state.mode===mode)
                return serialGPTDisable(card);

            return serialGPTEnable(card,mode);
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
                ,mode:state.mode
                ,busy:!!state.busy
                ,pending:state.pending.length
                ,lineChars:state.line.length
                ,historyMessages:state.history.length
                ,model:SERIAL_GPT_MODEL
                ,apiUrl:SERIAL_GPT_API_URL
                ,serialMime:state.mode===SERIAL_GPT_MODE_ASCII
                    ? SERIAL_GPT_MIME_ASCII
                    : (state.mode===SERIAL_GPT_MODE_UTF16LE
                        ? SERIAL_GPT_MIME_UTF16LE
                        : null)
                ,serialMimes:[
                     SERIAL_GPT_MIME_ASCII
                    ,SERIAL_GPT_MIME_UTF16LE
                 ]
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
