// Serial Pro GPT peer extension for RetroAppleJS.
//
// Loaded immediately after EMU_CARD_serialpro.js and before EMU_apple2io.js.
// It wraps the Serial Pro discovery constructor, so every subsequently mounted
// Serial Pro instance receives the GPT serial-peer feature without modifying
// the card ROM or the 6551 implementation.
// API-key entry uses an oCOM.POPUP password field with live API validation.
// The key is kept only in this card instance's JavaScript memory after the user
// confirms it and is erased when GPT mode is disabled or the page is reloaded.
// It is never persisted.


(function(global)
{
    "use strict";

    const SERIAL_GPT_API_URL = "https://api.openai.com/v1/responses";
    const SERIAL_GPT_API_VALIDATE_URL = "https://api.openai.com/v1/models";
    const SERIAL_GPT_MODEL = "gpt-5.6-luna";
    const SERIAL_GPT_MAX_INPUT_CHARS = 4096;
    const SERIAL_GPT_HISTORY_MESSAGES = 8;
    const SERIAL_GPT_HISTORY_CHARS = 12000;
    const SERIAL_GPT_REASONING_EFFORT = "low";
    const SERIAL_GPT_VERBOSITY = "low";
    const SERIAL_GPT_ECHO_GUARD_MS = 15000;
    const SERIAL_GPT_MAX_OUTPUT_TOKENS = 2048;
    const SERIAL_GPT_RETRY_OUTPUT_TOKENS = 4096;
    const SERIAL_GPT_MAX_OUTPUT_RETRIES = 1;
    const SERIAL_GPT_MODE_ASCII = "ascii";
    const SERIAL_GPT_MODE_UTF16LE = "utf16le";
    const SERIAL_GPT_MIME_ASCII = "text/plain; charset=us-ascii";
    const SERIAL_GPT_MIME_UTF16LE = "text/plain; charset=utf-16le";

    // G16/1 is an application control plane carried below GPT16 UTF-16LE text.
    // Its frames are always raw 7-bit ASCII between SOH and ETX.
    const SERIAL_G16_SOH = 0x01;
    const SERIAL_G16_ETX = 0x03;
    const SERIAL_G16_FRAME_MAX = 192;
    const SERIAL_G16_DUP_MS = 60000;
    const SERIAL_G16_DP = "G16D1";
    const SERIAL_G16_BASE = "CP437";
    const SERIAL_G16_FALL = "CELL1";
    const SERIAL_G16_GRID_COLS = 80;
    const SERIAL_G16_GRID_ROWS = 24;
    const SERIAL_G16_ROM_CAPS = Object.freeze({
         VN:{vg1:0x7F}
        ,VDE:{vg1:0x7F}
        ,VFR:{vg1:0x3F}
        ,VES:{vg1:0x3F}
    });
    const SERIAL_G16_VG1_CODEPOINTS = Object.freeze([
         0x1FB02,0x1FB0B,0x1FB0E,0x1FB2D
        ,0x1FB30,0x1FB39,0x1FB95
    ]);

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
                "The active GPT16 serial session transports text as UTF-16LE."
            );

        }

            var display = state && state.g16Profile;
            if(display && display.ready)
            {
                instructions.push(
                    "The negotiated terminal display profile is "
                    +display.dp+": semantic base "+display.base
                    +", Videx ROM "+display.rom
                    +", VG1 capability bitmap "+serialG16Hex(display.vg1,2)
                    +" (enabled extension code points "
                    +serialG16VG1List(display.vg1)+")"
                    +", grid "+display.cols+"x"+display.rows
                    +", fallback "+display.fall
                    +". Restrict displayed reply characters to this negotiated repertoire "
                    +"and keep terminal layouts within the negotiated grid."
                );
            }
            else
            {
                // Legacy GPT16 clients that do not negotiate G16D1 retain the
                // pre-G16 behavior.
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


    function serialG16Hex(value,width)
    {
        return (Number(value)>>>0)
            .toString(16)
            .toUpperCase()
            .padStart(width,"0")
            .slice(-width);
    }

    function serialG16Dec2(value)
    {
        return String(Number(value)||0).padStart(2,"0").slice(-2);
    }

    function serialG16VG1List(mask)
    {
        var values = [];
        mask = Number(mask) & 0x7F;

        for(var bit=0;bit<SERIAL_G16_VG1_CODEPOINTS.length;bit++)
        {
            if(mask & (1<<bit))
            {
                values.push(
                    "U+"+SERIAL_G16_VG1_CODEPOINTS[bit]
                        .toString(16).toUpperCase().padStart(5,"0")
                );
            }
        }

        return values.length ? values.join(",") : "none";
    }

    // CRC-16/CCITT-FALSE: poly 1021, init FFFF, refin/refout false, xorout 0000.
    function serialG16CRC16ASCII(text)
    {
        var crc = 0xFFFF;
        text = String(text===undefined || text===null ? "" : text);

        for(var i=0;i<text.length;i++)
        {
            var b = text.charCodeAt(i);
            if(b>0x7F) return null;

            crc ^= (b & 0xFF) << 8;
            for(var bit=0;bit<8;bit++)
            {
                crc = (crc & 0x8000)
                    ? (((crc << 1) ^ 0x1021) & 0xFFFF)
                    : ((crc << 1) & 0xFFFF);
            }
        }

        return crc & 0xFFFF;
    }

    function serialG16EncodeFrame(body)
    {
        body = String(body===undefined || body===null ? "" : body);
        var crc = serialG16CRC16ASCII(body);
        if(crc===null) return null;

        var text = body+"*"+serialG16Hex(crc,4);
        var bytes = new Uint8Array(text.length+2);
        bytes[0] = SERIAL_G16_SOH;

        for(var i=0;i<text.length;i++)
            bytes[i+1] = text.charCodeAt(i) & 0x7F;

        bytes[bytes.length-1] = SERIAL_G16_ETX;
        return bytes;
    }

    function serialG16ASCIIFromBytes(bytes)
    {
        var text = "";
        for(var i=0;i<bytes.length;i++)
        {
            var b = Number(bytes[i]) & 0xFF;
            if(b>0x7F) return null;
            text += String.fromCharCode(b);
        }
        return text;
    }

    function serialG16DecodeFrame(bytes)
    {
        if(!bytes || bytes.length<6)
            return {ok:false,code:1001,name:"BAD_FRAME",body:""};

        var text = serialG16ASCIIFromBytes(bytes);
        if(text===null)
            return {ok:false,code:1001,name:"BAD_FRAME",body:""};

        // ETX is not in bytes; the last five collected characters must be *HHHH.
        var star = text.length-5;
        if(star<1 || text.charAt(star)!=="*")
            return {ok:false,code:1001,name:"BAD_FRAME",body:text};

        var body = text.slice(0,star);
        var crcText = text.slice(star+1);
        if(!/^[0-9A-Fa-f]{4}$/.test(crcText))
            return {ok:false,code:1001,name:"BAD_FRAME",body:body};

        var expected = parseInt(crcText,16) & 0xFFFF;
        var actual = serialG16CRC16ASCII(body);
        if(actual===null || actual!==expected)
        {
            return {
                 ok:false
                ,code:1002
                ,name:"BAD_CRC"
                ,body:body
                ,expected:expected
                ,actual:actual
            };
        }

        return {ok:true,body:body,crc:actual};
    }

    function serialG16SequenceFromBody(body)
    {
        var match = String(body || "")
            .match(/^G16\|[^|]+\|([0-9A-Fa-f]{4})\|/);
        return match ? match[1].toUpperCase() : "0001";
    }

    function serialG16ParseFields(payload)
    {
        var fields = Object.create(null);
        var list = String(payload || "").split(";");

        for(var i=0;i<list.length;i++)
        {
            var item = list[i];
            var eq = item.indexOf("=");
            if(eq<=0 || eq===item.length-1) return null;

            var key = item.slice(0,eq).toUpperCase();
            if(fields[key]!==undefined) return null;
            fields[key] = item.slice(eq+1);
        }

        return fields;
    }

    /*
     * Validate the transport-neutral G16D1 HELLO and calculate only downward
     * capability negotiation. ROM/BASE/FALL remain exact; VG1 is intersected
     * with the canonical ROM mask and GRID is reduced to gateway maxima.
     */
    function serialG16NegotiateHello(body,gatewayMode)
    {
        var parts = String(body || "").split("|");
        if(parts.length!==5 || parts[0]!=="G16")
        {
            return {
                 ok:false,kind:"NAK",code:1001,name:"BAD_FRAME"
                ,seq:serialG16SequenceFromBody(body)
            };
        }

        var version = parts[1];
        var seq = parts[2].toUpperCase();
        var type = parts[3];
        var fields = serialG16ParseFields(parts[4]);

        if(!/^[0-9A-F]{4}$/.test(seq) || !fields)
        {
            return {
                 ok:false,kind:"NAK",code:1001,name:"BAD_FRAME"
                ,seq:/^[0-9A-F]{4}$/.test(seq) ? seq : "0001"
            };
        }

        if(version!=="1")
            return {ok:false,kind:"FAIL",code:1101,name:"VERSION_UNSUPPORTED",seq:seq};
        if(type!=="HELLO")
            return {ok:false,kind:"FAIL",code:1102,name:"COMMAND_UNSUPPORTED",seq:seq};

        var required = ["MODE","DP","ROM","BASE","VG1","GRID","FALL"];
        for(var r=0;r<required.length;r++)
        {
            if(fields[required[r]]===undefined)
                return {ok:false,kind:"NAK",code:1001,name:"BAD_FRAME",seq:seq};
        }

        var ackBody = "G16|1|"+seq+"|ACK|FOR=HELLO";

        // From this point the HELLO is syntactically accepted. Semantic
        // failures are ACKed first, then completed with FAIL.
        function semanticFail(code,name)
        {
            return {
                 ok:false,kind:"FAIL",code:code,name:name,seq:seq
                ,ackFirst:true,ackBody:ackBody
            };
        }

        if(fields.MODE!=="UTF16LE" || gatewayMode!==SERIAL_GPT_MODE_UTF16LE)
            return semanticFail(1201,"MODE_UNSUPPORTED");
        if(fields.DP!==SERIAL_G16_DP)
            return semanticFail(2151,"DP_UNSUPPORTED");

        var rom = fields.ROM.toUpperCase();
        var romCaps = SERIAL_G16_ROM_CAPS[rom];
        if(!romCaps)
            return semanticFail(2101,"ROM_UNKNOWN");
        if(fields.BASE!==SERIAL_G16_BASE)
            return semanticFail(2111,"BASE_UNSUPPORTED");
        if(!/^[0-9A-Fa-f]{2}$/.test(fields.VG1))
            return semanticFail(2121,"VG1_INVALID");

        var requestedVG1 = parseInt(fields.VG1,16) & 0xFF;
        if(requestedVG1 & 0x80)
            return semanticFail(2121,"VG1_INVALID");

        var grid = fields.GRID.match(/^([0-9]{2})x([0-9]{2})$/);
        if(!grid)
            return semanticFail(2131,"GRID_INVALID");

        var requestedCols = parseInt(grid[1],10);
        var requestedRows = parseInt(grid[2],10);
        if(!requestedCols || !requestedRows)
            return semanticFail(2131,"GRID_INVALID");
        if(fields.FALL!==SERIAL_G16_FALL)
            return semanticFail(2141,"FALL_UNSUPPORTED");

        var effectiveVG1 = requestedVG1 & romCaps.vg1;
        var effectiveCols = Math.min(requestedCols,SERIAL_G16_GRID_COLS);
        var effectiveRows = Math.min(requestedRows,SERIAL_G16_GRID_ROWS);
        if(!effectiveCols || !effectiveRows)
            return semanticFail(2132,"GRID_UNSUPPORTED");

        var dg = 0;
        if(effectiveVG1!==requestedVG1) dg |= 0x04;
        if(effectiveCols!==requestedCols || effectiveRows!==requestedRows)
            dg |= 0x08;

        var profile = {
             ready:true
            ,version:"1"
            ,seq:seq
            ,mode:"UTF16LE"
            ,dp:SERIAL_G16_DP
            ,rom:rom
            ,base:SERIAL_G16_BASE
            ,vg1:effectiveVG1
            ,cols:effectiveCols
            ,rows:effectiveRows
            ,fall:SERIAL_G16_FALL
            ,dg:dg
        };

        var readyBody =
            "G16|1|"+seq+"|READY|MODE=UTF16LE"
            +";DP="+SERIAL_G16_DP
            +";ROM="+rom
            +";BASE="+SERIAL_G16_BASE
            +";VG1="+serialG16Hex(effectiveVG1,2)
            +";GRID="+serialG16Dec2(effectiveCols)+"x"+serialG16Dec2(effectiveRows)
            +";FALL="+SERIAL_G16_FALL
            +";DG="+serialG16Hex(dg,2);

        return {
             ok:true
            ,seq:seq
            ,profile:profile
            ,ackBody:ackBody
            ,readyBody:readyBody
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
        var g16Frame = null;
        var g16FrameStarted = 0;
        var g16Discard = false;
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

        function g16ResetFrame()
        {
            g16Frame = null;
            g16FrameStarted = 0;
            g16Discard = false;
        }

        function g16TransmitBody(body,kind)
        {
            var bytes = serialG16EncodeFrame(body);
            if(!bytes) return false;

            serialGPTStatus(
                host,
                "G16 TX "+String(kind || "FRAME")+": "+body
            );

            device.transmitBytes(
                bytes,
                {
                     "source":"spgpt-g16"
                    ,"mime":"application/octet-stream"
                    ,"control":"G16/1"
                }
            );
            return true;
        }

        function g16ErrorBody(kind,seq,code,retry,name)
        {
            seq = /^[0-9A-F]{4}$/.test(String(seq || "")) ? seq : "0001";
            return "G16|1|"+seq+"|"+kind
                +"|CODE="+String(code)
                +";RETRY="+(retry ? "Y" : "N")
                +";NAME="+String(name || "ERROR");
        }

        function g16SendError(kind,seq,code,retry,name)
        {
            return g16TransmitBody(
                g16ErrorBody(kind,seq,code,retry,name),
                kind
            );
        }

        function g16RememberTransaction(state,seq,requestBody,ackBody,finalBody)
        {
            state.g16Transaction = {
                 seq:seq
                ,requestBody:requestBody
                ,ackBody:ackBody
                ,finalBody:finalBody
                ,time:Date.now()
            };
        }

        function g16HandleFrame(state,rawFrame)
        {
            var decoded = serialG16DecodeFrame(rawFrame);
            var seq = serialG16SequenceFromBody(decoded.body);

            if(!decoded.ok)
            {
                serialGPTStatus(
                    host,
                    "G16 RX rejected: "+decoded.name
                );
                g16SendError("NAK",seq,decoded.code,true,decoded.name);
                return;
            }

            serialGPTStatus(host,"G16 RX: "+decoded.body);

            var now = Date.now();
            var prior = state.g16Transaction;
            if(
                prior &&
                prior.seq===seq &&
                now-prior.time<=SERIAL_G16_DUP_MS
            )
            {
                if(prior.requestBody!==decoded.body)
                {
                    g16SendError("NAK",seq,1005,false,"SEQ_CONFLICT");
                    return;
                }

                // Idempotent replay: a lost ACK or READY must not create a new
                // logical negotiation transaction.
                prior.time = now;
                g16TransmitBody(prior.ackBody,"ACK replay");
                g16TransmitBody(prior.finalBody,"result replay");
                return;
            }

            var result = serialG16NegotiateHello(decoded.body,state.mode);

            if(!result.ok)
            {
                if(result.ackFirst && result.ackBody)
                    g16TransmitBody(result.ackBody,"ACK");

                var finalBody = g16ErrorBody(
                    result.kind,
                    result.seq,
                    result.code,
                    false,
                    result.name
                );

                if(result.ackFirst && result.ackBody)
                {
                    g16RememberTransaction(
                        state,result.seq,decoded.body,result.ackBody,finalBody
                    );
                }

                g16TransmitBody(finalBody,result.kind);
                return;
            }

            // A valid HELLO is acknowledged before its final READY result.
            g16TransmitBody(result.ackBody,"ACK");
            state.g16Profile = result.profile;
            g16RememberTransaction(
                state,result.seq,decoded.body,result.ackBody,result.readyBody
            );
            g16TransmitBody(result.readyBody,"READY");

            serialGPTStatus(
                host,
                "G16 ready: DP="+result.profile.dp
                +" ROM="+result.profile.rom
                +" BASE="+result.profile.base
                +" VG1="+serialG16Hex(result.profile.vg1,2)
                +" GRID="+result.profile.cols+"x"+result.profile.rows
                +" FALL="+result.profile.fall
                +" DG="+serialG16Hex(result.profile.dg,2)
            );
        }

        /*
         * Consume the raw G16 control plane before UTF-16LE pairing. Return true
         * when d8 belongs to G16 and must not enter the text decoder.
         */
        function g16ConsumeByte(state,d8)
        {
            if(state.mode!==SERIAL_GPT_MODE_UTF16LE)
                return false;

            var now = Date.now();

            if(g16Frame!==null && now-g16FrameStarted>1000)
            {
                serialGPTStatus(host,"G16 RX partial-frame timeout; resynchronizing.");
                g16ResetFrame();

                // Drop this byte as part of the damaged control transaction.
                // A retransmitted SOH below immediately starts a fresh frame.
                if(d8!==SERIAL_G16_SOH) return true;
            }

            if(g16Frame===null)
            {
                // Only claim SOH at a UTF-16LE code-unit boundary. This keeps a
                // high byte 01 in ordinary U+01xx text from looking like G16.
                if(lowByte!==null || d8!==SERIAL_G16_SOH)
                    return false;

                lowByte = null;
                g16Frame = [];
                g16FrameStarted = now;
                g16Discard = false;
                return true;
            }

            if(d8===SERIAL_G16_SOH)
            {
                // SOH inside an incomplete frame is an explicit resync point.
                g16Frame = [];
                g16FrameStarted = now;
                g16Discard = false;
                return true;
            }

            if(d8===SERIAL_G16_ETX)
            {
                var frame = g16Frame.slice();
                var discard = g16Discard;
                g16ResetFrame();
                if(!discard) g16HandleFrame(state,frame);
                return true;
            }

            if(g16Discard) return true;

            if(g16Frame.length>=SERIAL_G16_FRAME_MAX)
            {
                var partial = serialG16ASCIIFromBytes(g16Frame) || "";
                var seq = serialG16SequenceFromBody(partial);
                serialGPTStatus(host,"G16 RX frame too long; discarding to ETX.");
                g16SendError("NAK",seq,1003,true,"FRAME_TOO_LONG");
                g16Discard = true;
                return true;
            }

            g16Frame.push(d8 & 0xFF);
            return true;
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

                if(g16ConsumeByte(state,d8))
                    continue;

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
            g16ResetFrame();

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
            g16ResetFrame();
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
            g16ResetFrame();
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
                ,g16Profile:null
                ,g16Transaction:null
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

        function chars()
        {
            var n = 0;
            for(var i=0;i<state.history.length;i++)
                n += String(state.history[i].text || "").length;
            return n;
        }
        /*
         * History is stored as complete user/assistant turns. Never trim only
         * one side of a turn: an orphan assistant message changes the semantic
         * conversation presented to the model.
         */
        while(
            state.history.length>SERIAL_GPT_HISTORY_MESSAGES ||
            (state.history.length>2 && chars()>SERIAL_GPT_HISTORY_CHARS)
        )
        {
            if(
                state.history.length>=2 &&
                state.history[0].role==="user" &&
                state.history[1].role==="assistant"
            )
                state.history.splice(0,2);
            else
                state.history.shift();
        }

    }

    function serialGPTBuildInput(state,message)
    {
        /*
         * Responses API input supports explicit user/assistant messages.
         * Preserve roles structurally instead of flattening the conversation
         * into "APPLE II:" / "GPT:" speaker labels inside one text string.
         */
        var messages = [];
        for(var i=0;i<state.history.length;i++)
        {
            var h = state.history[i];
            if(h.role!=="user" && h.role!=="assistant")
                continue;

            messages.push({
                 role:h.role
                ,content:String(h.text || "")
            });            
        }
        messages.push({
             role:"user"
            ,content:String(message || "")
        });

        return messages;
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

    function serialGPTOutputTokenLimitReached(data)
    {
        return !!(
            data &&
            data.status==="incomplete" &&
            data.incomplete_details &&
            data.incomplete_details.reason==="max_output_tokens"
        );
    }

    async function serialGPTRequest(card,message)
    {
        var state = serialGPTState(card);
        var controller = typeof(AbortController)==="function" ? new AbortController() : null;
        state.abortController = controller;

        var outputTokens = SERIAL_GPT_MAX_OUTPUT_TOKENS;
        var retry = 0;

        while(true)
        {
            serialGPTStatus(
                card,
                "API request start: mode="
                +(state.mode===SERIAL_GPT_MODE_ASCII ? "GPT8" : "GPT16")
                +" promptChars="+String(message || "").length
                +" historyMessages="+state.history.length
                +" maxOutputTokens="+outputTokens
                +(retry ? " retry="+retry : "")
            );



            var payload = {
                 model:SERIAL_GPT_MODEL
                ,instructions:serialGPTInstructions(state)
                ,input:serialGPTBuildInput(state,message)
                ,max_output_tokens:outputTokens
                ,reasoning:{effort:SERIAL_GPT_REASONING_EFFORT}
                ,text:{verbosity:SERIAL_GPT_VERBOSITY}
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
            var outputLimited = serialGPTOutputTokenLimitReached(data);       

            /*
             * A reasoning model can consume a small output allowance before
             * producing visible text. Retry this one recoverable condition once
             * with a larger ceiling. The retry is a fresh generation from the
             * same structured conversation, so no failed turn enters history.
             */
            if(
                outputLimited &&
                retry<SERIAL_GPT_MAX_OUTPUT_RETRIES
            )
            {
                serialGPTWarn(
                    "OpenAI output token limit reached; retrying",
                    response,data,raw
                );
       
                retry++;
                outputTokens = SERIAL_GPT_RETRY_OUTPUT_TOKENS;

                serialGPTStatus(
                    card,
                    "API retry: reason=max_output_tokens"
                    +" maxOutputTokens="+outputTokens
                );
                continue;
            }

            if(!answer.length)
            {
                serialGPTWarn("OpenAI response contained no text output",response,data,raw);
                throw new Error(serialGPTNoTextMessage(data));
            }

            /*
             * If even the larger retry ceiling is exhausted but visible text
             * exists, return that partial text instead of turning a useful
             * response into the generic serial error string.
             */
            if(outputLimited)
            {
                serialGPTWarn(
                    "OpenAI response remained incomplete; using partial text",
                    response,data,raw
                );
                serialGPTStatus(
                    card,
                    "API partial response accepted: reason=max_output_tokens"
                );
            }

            var answerNuls = 0;
            for(var i=0;i<answer.length;i++)
                if(answer.charCodeAt(i)===0) answerNuls++;

            serialGPTStatus(
                card,
                "API text decoded: chars="+answer.length
                +" U+0000="+answerNuls
                +" status="+String(data.status || "unknown")
            );

            return answer;
        }

       
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

    function serialGPTMaskAPIKey(key)
    {
        key = String(key===undefined || key===null ? "" : key);

        if(!key.length) return "";
        if(key.length<=12) return "*".repeat(key.length);

        // Keep the verification preview compact regardless of key length.
        return key.slice(0,6)+"************"+key.slice(-6);
    }

    async function serialGPTValidateAPIKey(key,signal)
    {
        /*
         * Do not parse or surface the response body here. Authentication errors
         * may include fragments of the submitted credential; validation status
         * and our own fixed messages are sufficient for this UI.
         */
        var response = await fetch(SERIAL_GPT_API_VALIDATE_URL,{
             method:"GET"
            ,headers:{"Authorization":"Bearer "+key}
            ,signal:signal
        });

        if(response.ok)
            return {valid:true,state:"valid",message:"API key is valid."};

        if(response.status===401)
            return {valid:false,state:"invalid",message:"Invalid API key."};

        if(response.status===403)
        {
            return {
                 valid:false
                ,state:"invalid"
                ,message:"API key is not authorized."
            };
        }

        if(response.status===429)
        {
            return {
                 valid:false
                ,state:"error"
                ,message:"OpenAI could not verify the key (rate limit/quota)."
            };
        }

        return {
             valid:false
            ,state:"error"
            ,message:"API key validation failed (HTTP "+response.status+")."
        };
    }

    function serialGPTRequestAPIKey(card)
    {
        var popupAPI = global.oCOM && global.oCOM.POPUP;
        if(
            typeof(document)==="undefined" ||
            !popupAPI ||
            typeof(popupAPI.on)!=="function" ||
            typeof(popupAPI.off)!=="function" ||
            typeof(popupAPI.title_body_html)!=="function"
        )
        {
            serialGPTStatus(card,"API key popup is unavailable.");
            return Promise.resolve(null);
        }

        var popupId = "serialGPTKey_popup";
        var popup = document.getElementById(popupId);

        if(!popup)
        {
            popup = document.createElement("div");
            popup.id = popupId;
            popup.className = "appbox";
            popup.hidden = true;
            popup.setAttribute("role","dialog");
            popup.setAttribute("aria-modal","true");
            popup.setAttribute("aria-labelledby","serialGPTKey_title");
            popup.style.position = "fixed";
            popup.style.zIndex = "10000";
            popup.style.left = "50%";
            popup.style.top = "35%";
            popup.style.transform = "translate(-50%,-50%)";
            popup.style.width = "760px";
            popup.style.maxWidth = "calc(100vw - 24px)";
            popup.style.fontSize = "13px";
            document.body.appendChild(popup);
        }

        /*
         * Reuse one outstanding prompt. This prevents rapid GPT8/GPT16 clicks
         * from replacing the DOM underneath an unresolved key-entry promise.
         */
        if(popup._serialGPTPromptPromise)
            return popup._serialGPTPromptPromise;

        var titleHtml =
            "<span id='serialGPTKey_title' "
            +"style='white-space:nowrap;font-size:14px'>"
            +"<i class='fa fa-key'></i>&nbsp;OpenAI API key"
            +"</span>"
            +"<button type='button' class='appbut skinny' data-gpt-key-close "
            +"aria-label='Close API key dialog' title='Close' "
            +"style='float:right;font-size:12px;line-height:1'>x</button>";
 
        /*
         * Four compact visual rows: title, password field, verification/status,
         * and the memory note with the OK action.
         */

        var bodyHtml =
            "<input id='serialGPTKey_input' data-gpt-key-input "
            +"type='password' autocomplete='off' autocorrect='off' "
            +"autocapitalize='off' spellcheck='false' "
            +"aria-label='OpenAI API key' "
            +"data-1p-ignore='true' data-lpignore='true' "
            +"style='box-sizing:border-box;width:100%;padding:4px 6px;"
            +"font-family:monospace;font-size:13px'>"
            +"<div style='display:flex;align-items:center;gap:12px;"
            +"min-height:1.4em;margin-top:6px;white-space:nowrap'>"
            +"<span data-gpt-key-mask style='font-family:monospace'></span>"
            +"<span data-gpt-key-status role='status' aria-live='polite'></span>"            
            +"</div>"
            +"<div style='display:flex;align-items:center;"
            +"justify-content:space-between;gap:12px;margin-top:6px;"
            +"white-space:nowrap'>"
            +"<span style='font-size:12px;opacity:.75'>"
            +"Key stays only in page memory and is cleared when GPT is disabled "
            +"or the page reloads.</span>"
            +"<button type='button' class='appbut' data-gpt-key-ok disabled "
            +"style='font-size:12px'>OK</button>"
            +"</div>";

        popup.innerHTML = popupAPI.title_body_html(
            titleHtml,
            bodyHtml,
            "serialGPTKey_body",
            "com_popup_body"
        );

        var input = popup.querySelector("[data-gpt-key-input]");
        var masked = popup.querySelector("[data-gpt-key-mask]");
        var status = popup.querySelector("[data-gpt-key-status]");
        var ok = popup.querySelector("[data-gpt-key-ok]");
        var close = popup.querySelector("[data-gpt-key-close]");

        var validationTimer = null;
        var validationController = null;
        var validationSequence = 0;
        var validKey = "";
        var finished = false;
        var resolvePrompt = null;

        var promptPromise = new Promise(function(resolve)
        {
            resolvePrompt = resolve;
        });
        popup._serialGPTPromptPromise = promptPromise;

        function stopValidation()
        {
            validationSequence++;

            if(validationTimer!==null)
            {
                clearTimeout(validationTimer);
                validationTimer = null;
            }

            if(validationController)
            {
                try { validationController.abort(); } catch(ignore) {}
                validationController = null;
            }
        }

        function setVisual(state,message,key)
        {
            var color = "";
            if(state==="valid") color = "#188038";
            else if(state==="invalid") color = "#b3261e";
            else if(state==="error") color = "#946200";

            masked.textContent = key ? serialGPTMaskAPIKey(key) : "";
            status.textContent = message || "";
            masked.style.color = color;
            status.style.color = color;
            input.style.borderColor = color;
            ok.disabled = state!=="valid";
        }

        function finish(value)
        {
            if(finished) return;
            finished = true;

            stopValidation();
            validKey = "";
            input.value = "";
            masked.textContent = "";
            status.textContent = "";
            popup.onkeydown = null;
            popupAPI.off(popupId);
            resolvePrompt(value);
        }

        input.oninput = function()
        {
            stopValidation();
            validKey = "";

            var key = String(input.value || "").trim();
            if(!key.length)
            {
                setVisual("neutral","",key);
                return;
            }

            setVisual("neutral","Waiting to validate...",key);
            var sequence = validationSequence;

            validationTimer = setTimeout(async function()
            {
                validationTimer = null;
                if(sequence!==validationSequence || finished) return;

                validationController =
                    typeof(AbortController)==="function"
                        ? new AbortController()
                        : null;

                setVisual("neutral","Checking API key...",key);

                try
                {
                    var result = await serialGPTValidateAPIKey(
                        key,
                        validationController
                            ? validationController.signal
                            : undefined
                    );

                    if(sequence!==validationSequence || finished) return;

                    if(result.valid)
                    {
                        validKey = key;
                        setVisual("valid",result.message,key);
                    }
                    else
                    {
                        validKey = "";
                        setVisual(result.state,result.message,key);
                    }
                }
                catch(error)
                {
                    if(error && error.name==="AbortError") return;
                    if(sequence!==validationSequence || finished) return;

                    validKey = "";
                    setVisual(
                        "error",
                        "Unable to validate API key. Check the network connection.",
                        key
                    );
                }
                finally
                {
                    if(sequence===validationSequence)
                        validationController = null;
                }
            },400);
        };

        close.onclick = function()
        {
            finish(null);
        };

        ok.onclick = function()
        {
            if(validKey) finish(validKey);
        };

        popup.onkeydown = function(event)
        {
            if(event.key==="Escape")
            {
                event.preventDefault();
                finish(null);
                return;
            }

            if(event.key==="Enter" && event.target===input && validKey)
            {
                event.preventDefault();
                finish(validKey);
            }
        };

        promptPromise.then(function()
        {
            if(popup._serialGPTPromptPromise===promptPromise)
                popup._serialGPTPromptPromise = null;
        });

        popupAPI.on(popupId);
        setTimeout(function(){ input.focus(); },0);

        return promptPromise;
    }

    async function serialGPTEnable(card,mode)
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


        var key = await serialGPTRequestAPIKey(card);
        key = key===null || key===undefined ? "" : String(key).trim();
        if(!key.length) return false;
        /*
         * A second GPT mode button may have been clicked while the shared key
         * popup was open. Re-enter through the enabled path so the last mode
         * request performs the normal GPT8/GPT16 switch/reset logic.
         */
        if(state.enabled)
            return serialGPTEnable(card,mode);

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
                        +"Enabling opens a masked OpenAI API-key popup and validates the key before OK is enabled; the key stays only in page memory and is cleared when disabled/reloaded.<br>"
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
                ,g16Profile:state.g16Profile
                    ? {
                         ready:!!state.g16Profile.ready
                        ,dp:state.g16Profile.dp
                        ,rom:state.g16Profile.rom
                        ,base:state.g16Profile.base
                        ,vg1:serialG16Hex(state.g16Profile.vg1,2)
                        ,grid:state.g16Profile.cols+"x"+state.g16Profile.rows
                        ,fall:state.g16Profile.fall
                        ,dg:serialG16Hex(state.g16Profile.dg,2)
                     }
                    : null
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
