//
// Copyright (c) 2024 Freddy Vandriessche.
// notice: https://raw.githubusercontent.com/RetroAppleJS/AppleII-IDE/main/LICENSE.md
//
// apple2debug.js
//
// STEP TRACE is an attached debugger for the *live* Apple II runtime.
// It never owns a shadow CPU or RAM image. Execution is performed by the real
// Apple2Plus CPU/hardware/peripheral objects and disassembly reads the currently
// mapped CPU bus through safe_read().
//

if(oEMU===undefined) var oEMU = {"component":{"CPU":{"Apple2Debug":new Apple2Debug()}}}
else oEMU.component.CPU.Apple2Debug = new Apple2Debug();

function Apple2Debug()
{
    var dbg = this;
    var cpu_config = null;
    var max_instrlen = 3;
    var oDASM_debug = null;
    var oListingASM = null;

    var listingRows = 20;
    var currentPC = null;
    var previousObservedPC = null;
    var previousBoundary = new Int32Array(0x10000);
    previousBoundary.fill(-1);

    // Cached decoding is always validated against the bytes currently visible
    // on the mapped CPU bus.  Self-modifying code/remapping therefore invalidates
    // only the local decode and any predecessor edge derived from the old bytes.
    var decodeCache = new Array(0x10000);
    var cacheHits = 0;
    var cacheMisses = 0;
    var domWrites = 0;
    var lastRegisterHTML = null;

    var listingColumns = "{adr:0,code:6,lin:15,lbl:21,ins:30,opr:35,com:51}";
    var listingColumnPresets = {
         "default":"{adr:0,code:6,lin:15,lbl:21,ins:30,opr:35,com:51}"
        ,"wide":"{adr:0,code:6,lin:17,lbl:24,ins:34,opr:40,com:60}"
        ,"compact":"{adr:0,code:6,lbl:15,ins:24,opr:29,com:45}"
    };

    // A symbol export from the assembler can be attached to the live trace.
    // Labels populate lbl, label/EQU values can replace numeric operands, and
    // instruction comments populate com.  The maps are address keyed to keep
    // lookup cost constant while the live CPU is running.
    var loadedLabels = new Array(0x10000);
    var loadedSymbols = new Array(0x10000);
    var loadedComments = new Array(0x10000);
    var symbolState = {
         file:""
        ,source:""
        ,format:""
        ,labels:0
        ,equs:0
        ,comments:0
        ,error:""
    };

    // Same Unicode-capable mono stack as the assembler Source/Listing panes.
    var listingFontFamily = '"DejaVu Sans Mono","Menlo","Consolas","Courier New",monospace';
    var listingFontSize = 9;
    var rowPixelHeight = 12;

    // Listing viewport state. Manual navigation walks decoded instruction rows,
    // never address deltas.
    var followPC = true;
    // Display policy only: the live CPU always executes every instruction.
    // When showLoopSteps is false, repeated iterations of a dynamically proven
    // backward branch/JMP loop are not rendered; the display resumes exactly at
    // the first instruction boundary that exits that loop.
    var showLoopSteps = true;
    var activeClosedLoop = null;
    var loopDisplayStats = {detected:0,hiddenInstructions:0,exits:0};
    var manualTop = null;
    var lastViewTop = null;
    var lastRows = [];

    // Run control. "system" delegates execution to the central emulator speed;
    // fixed IPS modes own instruction scheduling while the SYSTEM timer is paused.
    var runMode = "system";
    var fixedRunning = false;
    var runTimer = null;
    var resumePct = 1;

    // Step Over/Out are temporary debugger-owned live boundary runs.
    var boundaryAction = null;

    // Temporary execution breakpoint. Cpu6502's execution trap is evaluated only
    // when cycle_delay==0, before interrupt dispatch and opcode fetch. Conditional
    // misses re-arm that same boundary trap and return false so the target opcode
    // executes normally; matching conditions stop before the opcode is fetched.
    var breakTarget = null;
    var breakConditionText = "";
    var breakConditionError = "";
    var breakConditionAst = null;
    var conditionHelp = "Optional breakpoint condition. Registers: A X Y SP P PC. Flags: N V B D I Z C. Memory: M[$addr] or MEM[$addr], M16[$addr] or MEM16[$addr]. Operators: == != < <= > >= & | ^ && || ! and parentheses.";
    var tempBreakpoint = {
         address:null
        ,armed:false
        ,hit:false
        ,hits:0
        ,checks:0
        ,skips:0
        ,condition:""
        ,lastResult:null
        ,error:null
    };
    var breakMessage = "";

    function liveMachine()
    {
        return typeof(apple2plus)=="object" && apple2plus ? apple2plus : null;
    }

    function liveCPU()
    {
        var machine = liveMachine();
        return machine && typeof(machine.cpuObj)=="function" ? machine.cpuObj() : null;
    }

    function liveHW()
    {
        var machine = liveMachine();
        return machine && typeof(machine.hwObj)=="function" ? machine.hwObj() : null;
    }

    /*
     * STEP TRACE has one deliberately masked CPU-bus interval: $C000-$C0FF.
     * That page contains motherboard and slot soft-switch I/O rather than code.
     * Everything else, including the complete peripheral/expansion ROM window
     * $C100-$CFFF, is read through Apple2Hw.safe_read() exactly as the CPU maps it.
     */
    function traceAddressReadable(addr)
    {
        addr &= 0xffff;
        return addr<0xc000 || addr>=0xc100;
    }

    function traceRead(addr)
    {
        addr &= 0xffff;
        if(!traceAddressReadable(addr)) return null;
        var hw = liveHW();
        if(!hw || typeof(hw.safe_read)!="function") return null;
        return hw.safe_read(addr) & 0xff;
    }

    function peripheralRomAddress(addr)
    {
        addr &= 0xffff;
        return addr>=0xc100 && addr<=0xcfff;
    }

    function currentAsmSymlink()
    {
        if(typeof(oASM)!="undefined" && oASM && oASM.symlink) return oASM.symlink;
        if(typeof(asm)!="undefined" && asm && asm.symlink) return asm.symlink;
        return null;
    }

    function symbolAtValue(value)
    {
        value &= 0xffff;
        if(loadedSymbols[value]) return loadedSymbols[value];
        var symlink = currentAsmSymlink();
        return symlink && typeof(symlink[value])!=="undefined" ? symlink[value] : null;
    }

    function labelAtAddress(addr)
    {
        return loadedLabels[addr & 0xffff] || "";
    }

    function commentAtAddress(addr,d)
    {
        var records = loadedComments[addr & 0xffff];
        if(!records || !records.length) return "";
        var bytes = [d.b0,d.b1,d.b2];
        var out = [];

        for(var i=0;i<records.length;i++)
        {
            var record = records[i];
            var opcode = record.opcode || [];
            var match = true;
            for(var j=0;j<opcode.length;j++)
            {
                if((bytes[j]&0xff)!==(opcode[j]&0xff))
                {
                    match = false;
                    break;
                }
            }
            if(match && record.text) out.push(record.text);
        }
        return out.join(" ");
    }

    function invalidateDecodeCache()
    {
        decodeCache = new Array(0x10000);
    }

    function init(cfg)
    {
        var cpu = liveCPU();
        if(!cpu) return false;

        cpu_config = cpu.getConfig();
        max_instrlen = Math.max.apply(null,cpu_config.instrlen);
        if(cfg && cfg.scrollH) listingRows = cfg.scrollH;

        oDASM_debug = new DASM();
        oDASM_debug.getHexByte = oCOM.getHexByte;
        oDASM_debug.sym_search = function(op,adm)
        {
            var opd = parseInt(op.substring(1,op.length),16);

            switch(adm)
            {
                case "zpg":
                case "zpx":
                case "zpy":
                case "abs":
                case "abx":
                case "aby":
                case "rel":
                case "ind":
                case "iny":
                case "inx":
                    var name = symbolAtValue(opd);
                    if(name) return name+" <small>"+op+"h</small>";
                    name = symbolAtValue((opd-1)&0xffff);
                    if(name) return name+"+1 <small>"+op+"h</small>";
                break;
            }
            return op;
        };
        return true;
    }

    function ensureInit(cfg)
    {
        return cpu_config!==null || init(cfg);
    }

    function stripMarkup(text)
    {
        var sanitized = String(text==null ? "" : text)
            .replace(/&nbsp;/gi," ")
            .replace(/&lt;/gi,"<")
            .replace(/&gt;/gi,">")
            .replace(/&amp;/gi,"&");

        var previous;
        do {
            previous = sanitized;
            sanitized = sanitized.replace(/<[^>]*>/g,"");
        } while(sanitized!==previous);

        return sanitized.replace(/\s+/g," ").trim();
    }

    function decodeAt(addr)
    {
        if(!ensureInit()) return null;

        addr &= 0xffff;
        var b0 = traceRead(addr);
        if(b0===null) return null;
        var b1 = traceRead((addr+1)&0xffff);
        var b2 = traceRead((addr+2)&0xffff);
        if(b1===null) b1 = 0x00;
        if(b2===null) b2 = 0x00;
        var cached = decodeCache[addr];

        if(cached && cached.b0===b0 && cached.b1===b1 && cached.b2===b2)
        {
            cacheHits++;
            return cached;
        }

        if(cached && previousBoundary[cached.next]===addr)
            previousBoundary[cached.next] = -1;

        cacheMisses++;
        var len = cpu_config.instrlen[b0] || 1;
        var entry = cpu_config.opctab[b0] || ["???","imp"];
        var adm = entry[1] || "imp";
        var val = null;

        switch(adm)
        {
            case "rel":
                var delta = (b1&0x80) ? b1-0x100 : b1;
                val = (addr+2+delta)&0xffff;
                break;
            case "abs":
            case "abx":
            case "aby":
            case "ind":
                val = (b1 | (b2<<8))&0xffff;
                break;
            case "zpg":
            case "zpx":
            case "zpy":
            case "inx":
            case "iny":
                val = b1&0xff;
                break;
        }

        var ret = oDASM_debug.disassemble({
             "code_arr":[b0,b1,b2]
            ,"pc":addr
            ,"opctab":cpu_config.opctab
        });
        var mnemonic = stripMarkup(ret.mnemonic);
        var match = /^(\S+)(?:\s+(.*))?$/.exec(mnemonic) || ["",mnemonic,""];
        var bytes = [b0,b1,b2].slice(0,len).map(function(v){return oCOM.getHexByte(v)}).join(" ");

        cached = {
             "addr":addr
            ,"b0":b0,"b1":b1,"b2":b2
            ,"len":len
            ,"next":(addr+len)&0xffff
            ,"bytes":bytes
            ,"ins":match[1] || ""
            ,"opr":match[2] || ""
            ,"adm":adm
            ,"val":val
        };
        decodeCache[addr] = cached;
        return cached;
    }

    function safeWord(addr)
    {
        addr &= 0xffff;
        var lo = traceRead(addr);
        var hi = traceRead((addr+1)&0xffff);
        if(lo===null || hi===null) return null;
        return (lo | (hi<<8)) & 0xffff;
    }

    function parseAddress(value)
    {
        var s = String(value==null ? "" : value).trim();
        s = s.replace(/^\$/,"").replace(/^0x/i,"");
        if(!/^[0-9a-f]{1,4}$/i.test(s)) return null;
        return parseInt(s,16) & 0xffff;
    }

    function parseSymbolValue(value)
    {
        if(typeof(value)==="number" && Number.isFinite(value)) return value&0xffff;
        var s = String(value==null ? "" : value).trim();
        if(/^\$[0-9a-f]+$/i.test(s)) return parseInt(s.substring(1),16)&0xffff;
        if(/^0x[0-9a-f]+$/i.test(s)) return parseInt(s.substring(2),16)&0xffff;
        if(/^[0-9]+$/.test(s)) return parseInt(s,10)&0xffff;
        if(/^[0-9a-f]+$/i.test(s)) return parseInt(s,16)&0xffff;
        return null;
    }

    function parseSymbolByte(value)
    {
        if(typeof(value)==="number" && Number.isFinite(value)) return value&0xff;
        var s = String(value==null ? "" : value).trim();
        if(/^\$[0-9a-f]{1,2}$/i.test(s)) return parseInt(s.substring(1),16)&0xff;
        if(/^0x[0-9a-f]{1,2}$/i.test(s)) return parseInt(s.substring(2),16)&0xff;
        if(/^[0-9a-f]{1,2}$/i.test(s)) return parseInt(s,16)&0xff;
        return null;
    }

    function commitLoadedSymbols(nextLabels,nextSymbols,nextComments,state)
    {
        loadedLabels = nextLabels;
        loadedSymbols = nextSymbols;
        loadedComments = nextComments;
        symbolState = state;
        invalidateDecodeCache();
        syncSymbolControls();
        if(currentPC!==null) renderListing(currentPC,true);
        return Object.assign({},symbolState);
    }

    function loadSymbolObject(raw,fileName)
    {
        var records = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.symbols) ? raw.symbols : null);
        if(!records) throw new Error("Symbol JSON must contain a symbols array");

        var nextLabels = new Array(0x10000);
        var nextSymbols = new Array(0x10000);
        var nextComments = new Array(0x10000);
        var labels = 0;
        var equs = 0;
        var comments = 0;

        for(var i=0;i<records.length;i++)
        {
            var record = records[i] || {};
            var type = String(record.type || "label").toLowerCase();
            var value = parseSymbolValue(record.value!==undefined ? record.value : record.address);
            if(value===null) continue;

            if(type==="label")
            {
                var label = String(record.name || "").trim();
                if(!label) continue;
                if(!nextLabels[value]) nextLabels[value] = label;
                nextSymbols[value] = label;
                labels++;
                continue;
            }

            if(type==="equ" || type==="symbol")
            {
                var name = String(record.name || "").trim();
                if(!name) continue;
                if(!nextSymbols[value]) nextSymbols[value] = name;
                equs++;
                continue;
            }

            if(type==="comment" && (!record.targetType || String(record.targetType).toLowerCase()==="instruction"))
            {
                var text = String(record.text || record.comment || "").trim();
                if(!text) continue;
                var opcode = [];
                if(Array.isArray(record.opcode))
                {
                    for(var b=0;b<record.opcode.length;b++)
                    {
                        var parsed = parseSymbolByte(record.opcode[b]);
                        if(parsed===null) { opcode = []; break; }
                        opcode.push(parsed);
                    }
                }
                if(!nextComments[value]) nextComments[value] = [];
                nextComments[value].push({text:text,opcode:opcode});
                comments++;
            }
        }

        if(labels+equs+comments===0) throw new Error("No usable labels, EQU symbols or instruction comments found");

        var fmt = raw && !Array.isArray(raw) && raw.format ? String(raw.format) : "JSON symbols";
        if(fmt!=="RetroAppleJS-ASM-symbols" && raw && !Array.isArray(raw) && raw.format)
            throw new Error("Unsupported symbol table format: "+fmt);

        return commitLoadedSymbols(nextLabels,nextSymbols,nextComments,{
             file:String(fileName || "symbols.json")
            ,source:raw && !Array.isArray(raw) ? String(raw.sourceName || "") : ""
            ,format:fmt
            ,labels:labels
            ,equs:equs
            ,comments:comments
            ,error:""
        });
    }

    function loadSymbolTextMap(text,fileName)
    {
        var nextLabels = new Array(0x10000);
        var nextSymbols = new Array(0x10000);
        var nextComments = new Array(0x10000);
        var labels = 0;
        var lines = String(text || "").split(/\r?\n/);

        function hexAddress(token)
        {
            token = String(token || "").trim();
            if(/^\$[0-9a-f]{1,4}$/i.test(token)) return parseInt(token.substring(1),16)&0xffff;
            if(/^0x[0-9a-f]{1,4}$/i.test(token)) return parseInt(token.substring(2),16)&0xffff;
            if(/^[0-9a-f]{1,4}$/i.test(token)) return parseInt(token,16)&0xffff;
            return null;
        }

        for(var i=0;i<lines.length;i++)
        {
            var line = lines[i].replace(/;.*/,"").trim();
            if(!line) continue;
            var m = /^([A-Za-z_.$@?][\w.$@?]*)\s*(?:=|EQU)\s*(\$?[0-9A-Fa-f]{1,4}|0x[0-9A-Fa-f]{1,4})$/i.exec(line);
            var name,addr;
            if(m)
            {
                name = m[1];
                addr = hexAddress(m[2]);
            }
            else
            {
                m = /^(\$?[0-9A-Fa-f]{1,4}|0x[0-9A-Fa-f]{1,4})\s+([A-Za-z_.$@?][\w.$@?]*)$/.exec(line);
                if(m) { addr = hexAddress(m[1]); name = m[2]; }
                else
                {
                    m = /^([A-Za-z_.$@?][\w.$@?]*)\s+(\$?[0-9A-Fa-f]{1,4}|0x[0-9A-Fa-f]{1,4})$/.exec(line);
                    if(m) { name = m[1]; addr = hexAddress(m[2]); }
                }
            }
            if(addr===null || addr===undefined || !name) continue;
            if(!nextLabels[addr]) nextLabels[addr] = name;
            if(!nextSymbols[addr]) nextSymbols[addr] = name;
            labels++;
        }

        if(!labels) throw new Error("No symbols found in text map");
        return commitLoadedSymbols(nextLabels,nextSymbols,nextComments,{
             file:String(fileName || "symbols.txt")
            ,source:""
            ,format:"text symbols"
            ,labels:labels
            ,equs:0
            ,comments:0
            ,error:""
        });
    }

    function resetLoadedSymbols()
    {
        loadedLabels = new Array(0x10000);
        loadedSymbols = new Array(0x10000);
        loadedComments = new Array(0x10000);
        symbolState = {file:"",source:"",format:"",labels:0,equs:0,comments:0,error:""};
        invalidateDecodeCache();
        syncSymbolControls();
        if(currentPC!==null) renderListing(currentPC,true);
        return true;
    }

    function tokenizeCondition(text)
    {
        var s = String(text==null ? "" : text);
        var out = [];
        var i = 0;

        function fail(message,pos)
        {
            throw new Error(message+" at column "+((pos===undefined ? i : pos)+1));
        }

        while(i<s.length)
        {
            var c = s.charAt(i);
            if(/\s/.test(c)) { i++; continue; }

            var two = s.substr(i,2);
            if(["&&","||","==","!=","<=",">="].indexOf(two)>=0)
            {
                out.push({k:"op",v:two,p:i});
                i += 2;
                continue;
            }

            if("()[]&|^!<>= ".indexOf(c)>=0 && c!==" ")
            {
                out.push({k:"op",v:c,p:i});
                i++;
                continue;
            }

            if(c==="$")
            {
                var hp = i++;
                var hs = "";
                while(i<s.length && /[0-9a-f]/i.test(s.charAt(i))) hs += s.charAt(i++);
                if(!hs) fail("Expected hexadecimal digits",hp);
                out.push({k:"num",v:parseInt(hs,16),p:hp});
                continue;
            }

            if(c==="0" && i+1<s.length && /[xX]/.test(s.charAt(i+1)))
            {
                var xp = i;
                i += 2;
                var xs = "";
                while(i<s.length && /[0-9a-f]/i.test(s.charAt(i))) xs += s.charAt(i++);
                if(!xs) fail("Expected hexadecimal digits",xp);
                out.push({k:"num",v:parseInt(xs,16),p:xp});
                continue;
            }

            if(/[0-9]/.test(c))
            {
                var np = i;
                var ns = "";
                while(i<s.length && /[0-9]/.test(s.charAt(i))) ns += s.charAt(i++);
                out.push({k:"num",v:parseInt(ns,10),p:np});
                continue;
            }

            if(/[a-z_]/i.test(c))
            {
                var ip = i;
                var id = "";
                while(i<s.length && /[a-z0-9_]/i.test(s.charAt(i))) id += s.charAt(i++);
                out.push({k:"id",v:id.toUpperCase(),p:ip});
                continue;
            }

            fail("Unexpected character '"+c+"'",i);
        }

        out.push({k:"eof",v:"",p:i});
        return out;
    }

    function parseBreakpointCondition(text)
    {
        var tokens = tokenizeCondition(text);
        var pos = 0;
        var registers = {A:1,X:1,Y:1,SP:1,P:1,PC:1};
        var flags = {N:1,V:1,B:1,D:1,I:1,Z:1,C:1};
        var memory = {M:8,M8:8,MEM:8,MEM8:8,M16:16,MEM16:16};

        function token(){ return tokens[pos]; }
        function take(value)
        {
            if(token().v===value) { pos++; return true; }
            return false;
        }
        function need(value)
        {
            if(!take(value)) throw new Error("Expected '"+value+"' at column "+(token().p+1));
        }

        function primary()
        {
            var t = token();
            if(t.k==="num")
            {
                pos++;
                return {t:"num",v:t.v};
            }

            if(t.k==="id")
            {
                pos++;
                if(t.v==="TRUE") return {t:"num",v:1};
                if(t.v==="FALSE") return {t:"num",v:0};
                if(registers[t.v]) return {t:"reg",v:t.v};
                if(flags[t.v]) return {t:"flag",v:t.v};
                if(memory[t.v])
                {
                    need("[");
                    var addr = logicalOr();
                    need("]");
                    return {t:"mem",w:memory[t.v],a:addr};
                }
                throw new Error("Unknown condition name '"+t.v+"' at column "+(t.p+1));
            }

            if(take("("))
            {
                var n = logicalOr();
                need(")");
                return n;
            }

            throw new Error("Expected value at column "+(t.p+1));
        }

        function unary()
        {
            if(take("!")) return {t:"un",o:"!",a:unary()};
            return primary();
        }

        function bitAnd()
        {
            var n = unary();
            while(take("&")) n = {t:"bin",o:"&",a:n,b:unary()};
            return n;
        }

        function bitXor()
        {
            var n = bitAnd();
            while(take("^")) n = {t:"bin",o:"^",a:n,b:bitAnd()};
            return n;
        }

        function bitOr()
        {
            var n = bitXor();
            while(take("|")) n = {t:"bin",o:"|",a:n,b:bitXor()};
            return n;
        }

        function compare()
        {
            var n = bitOr();
            while(["=","==","!=","<","<=",">",">="].indexOf(token().v)>=0)
            {
                var op = token().v;
                pos++;
                n = {t:"bin",o:op,a:n,b:bitOr()};
            }
            return n;
        }

        function logicalAnd()
        {
            var n = compare();
            while(take("&&")) n = {t:"bin",o:"&&",a:n,b:compare()};
            return n;
        }

        function logicalOr()
        {
            var n = logicalAnd();
            while(take("||")) n = {t:"bin",o:"||",a:n,b:logicalAnd()};
            return n;
        }

        var ast = logicalOr();
        if(token().k!=="eof")
            throw new Error("Unexpected token '"+token().v+"' at column "+(token().p+1));
        return ast;
    }

    function conditionValue(node,state)
    {
        if(!node) return 1;

        if(node.t==="num") return Number(node.v) || 0;

        if(node.t==="reg")
        {
            var key = node.v.toLowerCase();
            if(!state || state[key]===undefined) throw new Error("Register "+node.v+" is unavailable");
            return Number(state[key]) || 0;
        }

        if(node.t==="flag")
        {
            if(!state || state.p===undefined) throw new Error("Processor flags are unavailable");
            var masks = {N:0x80,V:0x40,B:0x10,D:0x08,I:0x04,Z:0x02,C:0x01};
            return (Number(state.p) & masks[node.v]) ? 1 : 0;
        }

        if(node.t==="mem")
        {
            var addr = conditionValue(node.a,state) & 0xffff;
            var lo = traceRead(addr);
            if(lo===null)
                throw new Error("Debugger read is masked at $"+oCOM.getHexWord(addr));
            if(node.w===8) return lo;
            var hiAddr = (addr+1)&0xffff;
            var hi = traceRead(hiAddr);
            if(hi===null)
                throw new Error("Debugger read is masked at $"+oCOM.getHexWord(hiAddr));
            return lo | ((hi & 0xff)<<8);
        }

        if(node.t==="un") return conditionValue(node.a,state) ? 0 : 1;

        if(node.t==="bin")
        {
            if(node.o==="&&") return conditionValue(node.a,state) ? (conditionValue(node.b,state) ? 1 : 0) : 0;
            if(node.o==="||") return conditionValue(node.a,state) ? 1 : (conditionValue(node.b,state) ? 1 : 0);

            var a = conditionValue(node.a,state);
            var b = conditionValue(node.b,state);
            switch(node.o)
            {
                case "&":  return ((a|0)&(b|0))>>>0;
                case "|":  return ((a|0)|(b|0))>>>0;
                case "^":  return ((a|0)^(b|0))>>>0;
                case "=":
                case "==": return a===b ? 1 : 0;
                case "!=": return a!==b ? 1 : 0;
                case "<":  return a<b ? 1 : 0;
                case "<=": return a<=b ? 1 : 0;
                case ">":  return a>b ? 1 : 0;
                case ">=": return a>=b ? 1 : 0;
            }
        }

        throw new Error("Invalid condition expression");
    }

    function compileBreakpointCondition(text)
    {
        text = String(text==null ? "" : text).trim();
        return {text:text,ast:text ? parseBreakpointCondition(text) : null};
    }

    function parseColumns(text)
    {
        var out = {};
        String(text || "").replace(/([a-zA-Z_][\w]*)\s*:\s*(-?\d+)/g,function(_,key,val)
        {
            out[key] = Math.max(0,parseInt(val,10) || 0);
            return "";
        });
        return out;
    }

    function crop(text,width)
    {
        text = String(text==null ? "" : text);
        if(width<=0) return "";
        if(text.length<=width) return text;
        if(width===1) return text.slice(0,1);
        return text.slice(0,width-1)+"…";
    }

    function formatParts(parts)
    {
        var columns = parseColumns(listingColumns);
        var order = ["adr","code","lin","lbl","ins","opr","com"];
        var active = order.filter(function(k){return Object.prototype.hasOwnProperty.call(columns,k)});
        active.sort(function(a,b){return columns[a]-columns[b]});

        var line = "";
        for(var i=0;i<active.length;i++)
        {
            var key = active[i];
            var col = columns[key];
            while(line.length<col) line += " ";

            var nextCol = i+1<active.length ? columns[active[i+1]] : null;
            var value = String(parts[key]==null ? "" : parts[key]);
            if(nextCol!==null)
            {
                // ASM_core's branch-line renderer owns the complete interval
                // [lin,nextColumn): its rightmost character is the ▶ arrowhead.
                // Other fields retain the traditional one-column separator.
                var width = nextCol-col-(key==="lin" ? 0 : 1);
                value = crop(value,Math.max(0,width));
            }
            line += value;
        }
        return line.replace(/\s+$/g,"");
    }

    function formatDecoded(d,lin,lbl,com)
    {
        return formatParts({
             "adr":oCOM.getHexWord(d.addr)+":"
            ,"code":d.bytes
            ,"lin":lin || ""
            ,"lbl":lbl || ""
            ,"ins":d.ins
            ,"opr":d.opr
            ,"com":com || ""
        });
    }

    function rememberSequential(from,to)
    {
        if(from==null || to==null) return false;
        from &= 0xffff;
        to &= 0xffff;
        var d = decodeAt(from);
        if(!d || d.next!==to) return false;
        previousBoundary[to] = from;
        return true;
    }

    function rememberEdges(edges)
    {
        if(!Array.isArray(edges)) return;
        for(var i=0;i<edges.length;i++)
            if(edges[i] && edges[i].length>=2)
                rememberSequential(edges[i][0],edges[i][1]);
    }

    function predecessorOf(addr)
    {
        addr &= 0xffff;
        var known = previousBoundary[addr];

        if(known>=0)
        {
            var kd = decodeAt(known);
            if(kd && kd.next===addr) return known;
            previousBoundary[addr] = -1;
        }

        // Backward 6502 decoding is ambiguous in general. Accept an inferred
        // predecessor only when exactly one 1..3-byte candidate lands here.
        var found = -1;
        var count = 0;
        for(var delta=1;delta<=max_instrlen;delta++)
        {
            var candidate = (addr-delta)&0xffff;
            var d = decodeAt(candidate);
            if(d && d.next===addr)
            {
                found = candidate;
                count++;
            }
        }
        return count===1 ? found : -1;
    }

    function applyListingDecorations(rows)
    {
        rows = rows || [];
        var temp = [];

        for(var i=0;i<rows.length;i++)
        {
            var d = rows[i].decoded;
            temp.push({
                 bytes:[d.b0,d.b1,d.b2].slice(0,d.len)
                ,pc:d.addr
                ,mnemonic:d.ins
                ,addrMode:d.adm
                ,val:d.val
                ,lin:""
            });
        }

        // Reuse the assembler's established Unicode branch-guide algorithm.
        // It draws relative branches and absolute JMPs only when both endpoints
        // are present in the current visible instruction window.
        if(typeof(ASM)==="function")
        {
            if(!oListingASM) oListingASM = new ASM();
            if(oListingASM && typeof(oListingASM.applyListingLineColumn)==="function")
            {
                oListingASM.listingColumns = parseColumns(listingColumns);
                oListingASM.applyListingLineColumn(temp);
            }
        }

        for(var r=0;r<rows.length;r++)
        {
            var decoded = rows[r].decoded;
            rows[r].lin = temp[r] && temp[r].lin ? temp[r].lin : "";
            rows[r].lbl = labelAtAddress(decoded.addr);
            rows[r].com = commentAtAddress(decoded.addr,decoded);
            rows[r].text = formatDecoded(decoded,rows[r].lin,rows[r].lbl,rows[r].com);
        }
        return rows;
    }

    function forwardWindow(start,pc,count)
    {
        start &= 0xffff;
        pc &= 0xffff;
        count = Math.max(1,Number(count)|0 || listingRows);

        var rows = [];
        var adr = start;
        for(var row=0;row<count;row++)
        {
            var d = decodeAt(adr);
            if(!d) break;

            rows.push({
                 "addr":adr
                ,"current":adr===pc
                ,"breakpoint":tempBreakpoint.armed && tempBreakpoint.address===adr
                ,"breakHit":tempBreakpoint.hit && tempBreakpoint.address===adr
                ,"decoded":d
                ,"text":""
            });

            previousBoundary[d.next] = adr;
            adr = d.next;
        }
        return applyListingDecorations(rows);
    }

    function followWindow(pc,count)
    {
        pc &= 0xffff;
        count = Math.max(1,Number(count)|0 || listingRows);
        var aboveWanted = Math.min(8,Math.floor(count/2));
        var start = pc;

        for(var i=0;i<aboveWanted;i++)
        {
            var p = predecessorOf(start);
            if(p<0) break;
            start = p;
        }
        return forwardWindow(start,pc,count);
    }

    function listingWindow(pc,count)
    {
        return followPC || manualTop===null
            ? followWindow(pc,count)
            : forwardWindow(manualTop,pc,count);
    }

    function setBreakpointTarget(addr)
    {
        addr = parseAddress(addr);
        if(addr===null) return false;
        breakTarget = addr;
        breakMessage = "";
        syncBreakpointControls();
        return true;
    }

    function rowClick(event)
    {
        var row = event.currentTarget;
        if(row && Number.isFinite(row._cpuDbgAddr))
            setBreakpointTarget(row._cpuDbgAddr);
    }

    function rowDoubleClick(event)
    {
        var row = event.currentTarget;
        if(row && Number.isFinite(row._cpuDbgAddr))
            dbg.runToAddress(row._cpuDbgAddr);
    }

    function ensureRowPool()
    {
        var el = document.getElementById(dbg.body_id);
        if(!el) return null;

        var pool = el._cpuDbgRowPool;
        if(pool && pool.length===listingRows && pool.length && pool[0].parentNode===el)
            return pool;

        el.innerHTML = "";
        pool = new Array(listingRows);
        for(var i=0;i<listingRows;i++)
        {
            var row = document.createElement("div");
            row.style.height = rowPixelHeight+"px";
            row.style.lineHeight = rowPixelHeight+"px";
            row.style.whiteSpace = "pre";
            row.style.fontFamily = "inherit";
            row.style.fontKerning = "none";
            row.style.fontVariantLigatures = "none";
            row.style.cursor = "default";
            row._cpuDbgText = null;
            row._cpuDbgCurrent = null;
            row._cpuDbgBreakpoint = null;
            row._cpuDbgAddr = null;
            row.addEventListener("click",rowClick);
            row.addEventListener("dblclick",rowDoubleClick);
            el.appendChild(row);
            pool[i] = row;
        }
        el._cpuDbgRowPool = pool;
        return pool;
    }

    function syncFollowControl()
    {
        var icon = document.getElementById("cpuDbg_trackPc");
        if(!icon) return;
        icon.classList.toggle("fa-lock",followPC);
        icon.classList.toggle("fa-lock-open",!followPC);
        icon.style.opacity = "1";
        icon.setAttribute("aria-pressed",followPC ? "true" : "false");
        icon.title = followPC
            ? "Track PC enabled — click to unlock the listing"
            : "Track PC disabled — click to lock the listing to the live PC";
    }

    function syncLoopControl()
    {
        var icon = document.getElementById("cpuDbg_showLoopSteps");
        if(!icon) return;
        icon.style.opacity = showLoopSteps ? "1" : ".32";
        icon.setAttribute("aria-pressed",showLoopSteps ? "true" : "false");
        icon.title = showLoopSteps
            ? "Closed-loop steps visible — click to hide repeated loop iterations"
            : "Closed-loop steps hidden — CPU still executes every instruction; click to show them";
    }

    function resetClosedLoopDisplayState()
    {
        activeClosedLoop = null;
    }

    function loopContains(loop,addr)
    {
        addr &= 0xffff;
        return !!loop && addr>=loop.lo && addr<=loop.hi;
    }

    function isTakenBackwardLoopEdge(d,from,to)
    {
        if(!d) return false;
        from &= 0xffff;
        to &= 0xffff;
        // Restrict loop discovery to actual taken relative branches and JMPs.
        // RTS/RTI/call returns may move backwards too, but are not proof of a
        // closed loop and therefore must never trigger display suppression.
        if(to>from) return false;
        if(d.adm==="rel")
            return d.val!==null && d.val!==undefined && to===(d.val&0xffff);
        // The live endPC is authoritative for JMP, including JMP (indirect),
        // whose decoded operand value is the pointer rather than its destination.
        return d.ins==="JMP";
    }

    function observeClosedLoopEdge(from,to)
    {
        from &= 0xffff;
        to &= 0xffff;
        if(showLoopSteps) return {suppress:false,entered:false,exited:false};

        var d = decodeAt(from);
        if(!d)
        {
            if(activeClosedLoop)
            {
                resetClosedLoopDisplayState();
                loopDisplayStats.exits++;
                return {suppress:false,entered:false,exited:true};
            }
            return {suppress:false,entered:false,exited:false};
        }

        if(!activeClosedLoop)
        {
            if(!isTakenBackwardLoopEdge(d,from,to))
                return {suppress:false,entered:false,exited:false};

            activeClosedLoop = {
                 target:to
                ,backPC:from
                ,lo:to
                ,hi:from
                ,callDepth:0
                ,iterations:1
                ,instructions:1
            };
            loopDisplayStats.detected++;
            loopDisplayStats.hiddenInstructions++;
            return {suppress:true,entered:true,exited:false};
        }

        var loop = activeClosedLoop;
        loop.instructions++;
        loopDisplayStats.hiddenInstructions++;

        // A subroutine called from inside the loop remains part of the hidden
        // iteration even when its address lies outside the loop's numeric range.
        // Nested JSR/RTS pairs are tracked so such calls do not look like exits.
        if(loop.callDepth>0)
        {
            if(d.b0===0x20) loop.callDepth++;       // JSR
            else if(d.b0===0x60) loop.callDepth--;  // RTS

            if(loop.callDepth===0 && !loopContains(loop,to))
            {
                resetClosedLoopDisplayState();
                loopDisplayStats.exits++;
                return {suppress:false,entered:false,exited:true};
            }
            return {suppress:true,entered:false,exited:false};
        }

        // An interrupt may temporarily take execution outside the numeric loop
        // range. Treat that as a visible escape rather than risk hiding unrelated
        // execution indefinitely; a later taken back-edge will prove the loop again.
        if(!loopContains(loop,from))
        {
            if(loopContains(loop,to))
                return {suppress:true,entered:false,exited:false};
            resetClosedLoopDisplayState();
            loopDisplayStats.exits++;
            return {suppress:false,entered:false,exited:true};
        }

        if(d.b0===0x20)
        {
            loop.callDepth = 1;
            return {suppress:true,entered:false,exited:false};
        }

        // The instruction that originally closed the loop is the definitive
        // iteration/exit boundary. A taken edge repeats; fall-through exits.
        if(from===loop.backPC)
        {
            if(to===loop.target)
            {
                loop.iterations++;
                return {suppress:true,entered:false,exited:false};
            }
            resetClosedLoopDisplayState();
            loopDisplayStats.exits++;
            return {suppress:false,entered:false,exited:true};
        }

        // Early branches/jumps out of the proven loop also end suppression.
        if(!loopContains(loop,to))
        {
            resetClosedLoopDisplayState();
            loopDisplayStats.exits++;
            return {suppress:false,entered:false,exited:true};
        }

        return {suppress:true,entered:false,exited:false};
    }

    function syncSymbolControls()
    {
        if(typeof(document)==="undefined") return;
        var status = document.getElementById("cpuDbg_symbolStatus");
        var clear = document.getElementById("cpuDbg_symbolClear");
        var total = symbolState.labels+symbolState.equs;
        var loaded = !!(symbolState.file || total || symbolState.comments);

        if(status)
        {
            status.textContent = symbolState.error
                ? "error"
                : (loaded ? total+" sym / "+symbolState.comments+" com" : "none");
            status.title = symbolState.error
                ? symbolState.error
                : (loaded
                    ? (symbolState.file+(symbolState.source ? " · "+symbolState.source : "")+" · "+symbolState.labels+" labels, "+symbolState.equs+" EQU, "+symbolState.comments+" comments")
                    : "No external symbol table loaded");
        }
        if(clear) clear.disabled = !loaded;
    }

    function syncBreakpointControls()
    {
        var input = document.getElementById("cpuDbg_breakAddr");
        if(input)
        {
            var target = breakTarget;
            if(target===null && currentPC!==null) target = currentPC;
            var value = target===null ? "" : "$"+oCOM.getHexWord(target);
            if(document.activeElement!==input && input.value!==value) input.value = value;
        }

        var cond = document.getElementById("cpuDbg_breakCond");
        if(cond)
        {
            if(document.activeElement!==cond && cond.value!==breakConditionText) cond.value = breakConditionText;
            cond.style.borderColor = breakConditionError ? "#c00" : "";
            cond.setAttribute("aria-invalid",breakConditionError ? "true" : "false");
            cond.title = breakConditionError ? "Invalid condition: "+breakConditionError : conditionHelp;
        }

        var arm = document.getElementById("cpuDbg_breakArm");
        if(arm)
        {
            var dirty = tempBreakpoint.armed && breakConditionText!==tempBreakpoint.condition;
            arm.textContent = dirty ? "Rearm" : (tempBreakpoint.armed ? "Armed" : "Arm");
        }
    }

    function boundaryActionText()
    {
        if(!boundaryAction) return "";
        if(boundaryAction.type==="over")
            return "  OVER→$"+oCOM.getHexWord(boundaryAction.returnPC);
        return "  OUT J"+boundaryAction.jsrDepth+" I"+boundaryAction.irqDepth;
    }

    function breakpointText()
    {
        var conditional = tempBreakpoint.condition ? " IF" : "";
        if(tempBreakpoint.armed)
            return "  BP→$"+oCOM.getHexWord(tempBreakpoint.address)+conditional;
        if(tempBreakpoint.error && tempBreakpoint.address!==null)
            return "  BP!$"+oCOM.getHexWord(tempBreakpoint.address);
        if(tempBreakpoint.hit)
            return "  BP@$"+oCOM.getHexWord(tempBreakpoint.address)+(conditional ? " IF✓" : "");
        return breakMessage ? "  "+breakMessage : "";
    }

    function updateNavigationStatus(pc)
    {
        var el = document.getElementById("cpuDbg_navStatus");
        if(!el) return;

        el.textContent = "PC $"+oCOM.getHexWord(pc)
            +boundaryActionText()+breakpointText();
        var title = followPC
            ? "Listing tracks the live program counter"
            : "Manual instruction-row view; enable Track PC to resume tracking";
        if(tempBreakpoint.condition)
            title += "; breakpoint condition: "+tempBreakpoint.condition;
        el.title = title;
    }

    function updateRegisterStatus(state,force)
    {
        var el = document.getElementById(dbg.body_id+"_regs");
        if(!el || !state || !oCOM || typeof(oCOM.formatCpuRegistersHTML)!=="function") return false;

        var html = oCOM.formatCpuRegistersHTML(state,{includePC:false});
        if(force || html!==lastRegisterHTML)
        {
            el.innerHTML = html;
            lastRegisterHTML = html;
            domWrites++;
        }
        return true;
    }

    function renderListing(pc,force)
    {
        var pool = ensureRowPool();
        if(!pool) return false;
        var rows = listingWindow(pc,listingRows);
        lastRows = rows;

        lastViewTop = rows.length ? rows[0].addr : null;
        if(!followPC && manualTop===null && lastViewTop!==null)
            manualTop = lastViewTop;

        for(var i=0;i<pool.length;i++)
        {
            var data = rows[i] || {text:"",current:false,breakpoint:false,breakHit:false,addr:null};
            var node = pool[i];
            var text = data.text || "";
            var marked = !!(data.breakpoint || data.breakHit);

            node._cpuDbgAddr = data.addr;
            node.title = data.addr==null
                ? ""
                : "Click: breakpoint target $"+oCOM.getHexWord(data.addr)+"; double-click: run to here";

            if(force || node._cpuDbgText!==text)
            {
                node.textContent = text;
                node._cpuDbgText = text;
                domWrites++;
            }

            if(force || node._cpuDbgCurrent!==!!data.current)
            {
                node.style.fontWeight = data.current ? "700" : "500";
                node.style.textDecoration = data.current ? "underline" : "none";
                node._cpuDbgCurrent = !!data.current;
            }

            if(force || node._cpuDbgBreakpoint!==marked)
            {
                node.style.boxShadow = marked ? "inset 2px 0 0 currentColor" : "none";
                node.style.paddingLeft = marked ? "3px" : "0";
                node._cpuDbgBreakpoint = marked;
            }
        }

        syncFollowControl();
        syncLoopControl();
        syncSymbolControls();
        syncBreakpointControls();
        updateNavigationStatus(pc);
        var cpu = liveCPU();
        if(cpu) updateRegisterStatus(cpu.watch(),force);
        return true;
    }

    function setFollowState(enabled,renderNow)
    {
        enabled = !!enabled;
        if(enabled)
        {
            followPC = true;
            manualTop = null;
        }
        else
        {
            if(followPC)
            {
                var cpu = liveCPU();
                var pc = cpu ? (cpu.watch().pc & 0xffff) : (currentPC==null ? 0 : currentPC);
                if(lastViewTop===null)
                {
                    var rows = followWindow(pc,listingRows);
                    lastViewTop = rows.length ? rows[0].addr : pc;
                }
                manualTop = lastViewTop;
            }
            followPC = false;
        }

        syncFollowControl();
        if(renderNow && currentPC!==null) renderListing(currentPC,true);
        return followPC;
    }

    function bindNavigation()
    {
        var el = document.getElementById(dbg.body_id);
        if(!el || el._cpuDbgNavigationBound) return;
        el._cpuDbgNavigationBound = true;
        el.tabIndex = 0;
        el.title = "Instruction navigation: wheel/↑/↓/PgUp/PgDn. F toggles Track PC; F9 breakpoint, F10 over, F11 step, Shift+F11 out.";

        el.addEventListener("wheel",function(event)
        {
            event.preventDefault();
            var page = event.shiftKey ? Math.max(1,listingRows-1) : 1;
            dbg.navigateRows(event.deltaY<0 ? -page : page);
        },{passive:false});

        el.addEventListener("keydown",function(event)
        {
            var handled = true;
            switch(event.key)
            {
                case "ArrowUp":   dbg.navigateRows(-1); break;
                case "ArrowDown": dbg.navigateRows(1); break;
                case "PageUp":    dbg.navigateRows(-Math.max(1,listingRows-1)); break;
                case "PageDown":  dbg.navigateRows(Math.max(1,listingRows-1)); break;
                case "Home":      dbg.setFollowPC(true); break;
                case "f":
                case "F":         dbg.setFollowPC(!followPC); break;
                case "F9":
                    if(event.shiftKey) dbg.clearTemporaryBreakpoint();
                    else dbg.setTemporaryBreakpointFromInput(false);
                    break;
                case "F10":       dbg.stepOver(); break;
                case "F11":
                    if(event.shiftKey) dbg.stepOut();
                    else dbg.step();
                    break;
                default: handled = false;
            }

            if(handled)
            {
                event.preventDefault();
                event.stopPropagation();
            }
        });

        el.addEventListener("pointerdown",function(){ el.focus(); });

        el.addEventListener("touchstart",function(event)
        {
            if(!event.changedTouches || !event.changedTouches.length) return;
            el._cpuDbgTouchY = event.changedTouches[0].clientY;
        },{passive:true});

        el.addEventListener("touchmove",function(event)
        {
            if(!event.changedTouches || !event.changedTouches.length
                || !Number.isFinite(el._cpuDbgTouchY)) return;

            var y = event.changedTouches[0].clientY;
            var delta = el._cpuDbgTouchY-y;
            var rows = delta<0 ? Math.ceil(delta/rowPixelHeight) : Math.floor(delta/rowPixelHeight);
            if(rows!==0)
            {
                event.preventDefault();
                dbg.navigateRows(rows);
                el._cpuDbgTouchY = y;
            }
        },{passive:false});

        el.addEventListener("touchend",function(){ el._cpuDbgTouchY = null; },{passive:true});
        el.addEventListener("touchcancel",function(){ el._cpuDbgTouchY = null; },{passive:true});
    }

    function syncBootTriggerInputs(state)
    {
        var start = document.getElementById("cpuDbg_bootStart");
        var stop = document.getElementById("cpuDbg_bootStop");
        var startText = state && state.triggerAddress!=null
            ? "$"+oCOM.getHexWord(state.triggerAddress)
            : "";
        var stopText = state && state.stopAddress!=null
            ? "$"+oCOM.getHexWord(state.stopAddress)
            : "";

        // Do not fight the user while an address is being edited.
        if(start && document.activeElement!==start && start.value!==startText) start.value = startText;
        if(stop && document.activeElement!==stop && stop.value!==stopText) stop.value = stopText;
    }

    function updateBootTriggerIcon(el,state)
    {
        syncBootTriggerInputs(state);
        if(!el) return;

        if(state && state.bDebug_boot)
        {
            var startText = state.triggerAddress==null ? "immediately" : "$"+oCOM.getHexWord(state.triggerAddress);
            var stopText = state.stopAddress==null ? "when buffer is full" : "before $"+oCOM.getHexWord(state.stopAddress);
            var mode = state.triggerArmed ? "armed"
                : state.logging ? "logging"
                : state.full ? "buffer full"
                : state.complete ? "complete"
                : "enabled";

            el.style.opacity = "1";
            el.title = "bootlog "+mode+"; start "+startText+"; stop "+stopText;
        }
        else
        {
            el.style.opacity = ".35";
            el.title = "bootlog trigger disabled";
        }
    }

    function systemRunning()
    {
        return typeof(_o)!="undefined"
            && Number(_o.CPU_TargetTicks_s)>0
            && typeof(appleIntervalHandle)!="undefined"
            && appleIntervalHandle!=null;
    }

    function executionRunning()
    {
        return fixedRunning || (runMode==="system" && systemRunning()) || !!boundaryAction;
    }

    function rememberSystemSpeed()
    {
        if(typeof(_o)==="undefined") return;
        var base = Number(_o.CPU_ClocksTicks_s) || 1;
        var target = Number(_o.CPU_TargetTicks_s) || 0;
        if(target>0) resumePct = target/base;
    }

    function pauseSystem()
    {
        if(systemRunning())
        {
            rememberSystemSpeed();
            oEMUI.cpuSpd(0);
        }
    }

    function resumeSystem()
    {
        oEMUI.cpuSpd(resumePct>0 ? resumePct : 1);
    }

    function clearRunTimer()
    {
        if(runTimer!==null)
        {
            window.clearTimeout(runTimer);
            runTimer = null;
        }
    }

    function stopFixedRun()
    {
        fixedRunning = false;
        clearRunTimer();
    }

    function stopBoundaryAction()
    {
        boundaryAction = null;
        clearRunTimer();
    }

    function runSpeedConfig(mode)
    {
        switch(String(mode))
        {
            case "1":    return {batch:1,delay:1000,label:"1 IPS"};
            case "10":   return {batch:1,delay:100,label:"10 IPS"};
            case "100":  return {batch:5,delay:50,label:"100 IPS"};
            case "1000": return {batch:50,delay:50,label:"1000 IPS"};
            default:      return {batch:0,delay:0,label:"Max (SYSTEM)"};
        }
    }

    function boundarySpeedConfig()
    {
        if(runMode==="system") return {batch:250,delay:0};
        return runSpeedConfig(runMode);
    }

    function syncRunIcon(el)
    {
        el = el || document.getElementById("cpuDbg_play");
        if(!el || !el.classList) return;
        var running = executionRunning();
        el.classList.toggle("fa-pause-circle",running);
        el.classList.toggle("fa-play-circle",!running);
        el.title = running ? "pause CPU execution" : "continue CPU execution";
    }

    function scheduleFixedRun(delay)
    {
        clearRunTimer();
        runTimer = window.setTimeout(fixedRunLoop,Math.max(0,delay|0));
    }

    function fixedRunLoop()
    {
        if(!fixedRunning || runMode==="system") return;
        var machine = liveMachine();
        if(!machine || typeof(machine.runLiveInstructionBatch)!="function")
        {
            stopFixedRun();
            syncRunIcon();
            return;
        }

        var cfg = runSpeedConfig(runMode);
        var renderAfterBatch = true;
        var batchOptions = {stopOnRegionChange:[0xc100,0xcfff]};

        if(!showLoopSteps)
        {
            renderAfterBatch = activeClosedLoop===null;
            batchOptions.onInstructionBoundary = function(one)
            {
                var decision = observeClosedLoopEdge(one.startPC,one.endPC);
                if(decision.suppress)
                {
                    renderAfterBatch = false;
                    return false;
                }
                if(decision.exited)
                {
                    // Stop this cooperative batch exactly at the first boundary
                    // outside the loop so the user sees the loop exit, not some
                    // later sample up to 50 instructions further on.
                    renderAfterBatch = true;
                    return true;
                }
                renderAfterBatch = true;
                return false;
            };
        }

        // Preserve large batches for 100/1000 IPS, but return at the first
        // transition into or out of peripheral/expansion ROM. Closed-loop hiding
        // is an additional display policy and never bypasses CPU execution.
        var result = machine.runLiveInstructionBatch(cfg.batch,batchOptions);
        rememberEdges(result && result.edges);

        // While a proven loop is repeating, leave listing/PC/registers frozen.
        // Breakpoints and stalled ownership changes still force an exact render.
        if(showLoopSteps || renderAfterBatch || !fixedRunning || !result || result.stalled)
            dbg.cycle({cpu:machine.cpuObj()});

        // A temporary breakpoint callback can stop fixedRunning from inside a
        // batch. Check ownership again before scheduling the next batch.
        if(!fixedRunning || !result || result.stalled)
        {
            stopFixedRun();
            syncRunIcon();
            return;
        }
        scheduleFixedRun(cfg.delay);
    }

    function startExecution()
    {
        stopBoundaryAction();
        if(runMode==="system")
        {
            resetClosedLoopDisplayState();
            stopFixedRun();
            resumeSystem();
        }
        else
        {
            pauseSystem();
            fixedRunning = true;
            scheduleFixedRun(0);
        }
        syncRunIcon();
    }

    function pauseExecution()
    {
        stopBoundaryAction();
        stopFixedRun();
        if(runMode==="system") pauseSystem();
        syncRunIcon();
    }

    function externalInterruptBoundary(before,one,opcode)
    {
        if(!before || !one || !one.state || opcode===0x00) return false;
        var spDrop = ((before.sp & 0xff)-(one.state.sp & 0xff)) & 0xff;
        if(spDrop!==3) return false;

        var endPC = one.endPC & 0xffff;
        var nmi = safeWord(0xfffa);
        var irq = safeWord(0xfffe);
        return (nmi!==null && endPC===nmi) || (irq!==null && endPC===irq);
    }

    function boundaryActionStopped(action,before,opcode,one)
    {
        if(action.type==="over")
        {
            return (one.endPC & 0xffff)===action.returnPC
                && (one.state.sp & 0xff)===action.startSP;
        }

        if(opcode===0x00 || externalInterruptBoundary(before,one,opcode))
        {
            action.irqDepth++;
            return false;
        }
        if(opcode===0x20)
        {
            action.jsrDepth++;
            return false;
        }
        if(opcode===0x60)
        {
            if(action.jsrDepth>0)
            {
                action.jsrDepth--;
                return false;
            }
            return action.irqDepth===0;
        }
        if(opcode===0x40)
        {
            if(action.irqDepth>0)
            {
                action.irqDepth--;
                return false;
            }
            return action.jsrDepth===0;
        }
        return false;
    }

    function finishBoundaryAction()
    {
        stopBoundaryAction();
        resetClosedLoopDisplayState();
        var cpu = liveCPU();
        if(cpu) dbg.cycle({cpu:cpu,force:true});
        syncRunIcon();
    }

    function scheduleBoundaryAction(delay)
    {
        clearRunTimer();
        runTimer = window.setTimeout(boundaryActionLoop,Math.max(0,delay|0));
    }

    function boundaryActionLoop()
    {
        var action = boundaryAction;
        var machine = liveMachine();
        var cpu = liveCPU();
        if(!action || !machine || !cpu || typeof(machine.stepLiveInstruction)!="function")
        {
            finishBoundaryAction();
            return;
        }

        var cfg = boundarySpeedConfig();
        var completed = 0;
        var stopped = false;
        var renderBoundaryProgress = showLoopSteps || activeClosedLoop===null;

        for(var i=0;i<cfg.batch && boundaryAction===action;i++)
        {
            var before = cpu.watch();
            var startPC = before.pc & 0xffff;
            var decoded = decodeAt(startPC);
            var opcode = decoded ? decoded.b0 : null;
            var one = machine.stepLiveInstruction();

            // Cpu6502's execution trap returns a stalled instruction when a
            // temporary breakpoint is hit. The callback already cleared the
            // boundary action, so stop without executing the target opcode.
            if(!one || one.stalled || one.ticks<=0) break;

            completed++;
            action.instructions++;
            rememberSequential(one.startPC,one.endPC);

            // Completion of Step Over/Out has priority over a display-only
            // loop yield. Otherwise an RTS/return that is also the loop exit could
            // be followed by one unintended extra instruction on the next batch.
            if(boundaryActionStopped(action,before,opcode,one))
            {
                stopped = true;
                break;
            }

            if(!showLoopSteps)
            {
                var loopDecision = observeClosedLoopEdge(one.startPC,one.endPC);
                if(loopDecision.suppress) renderBoundaryProgress = false;
                else if(loopDecision.exited)
                {
                    renderBoundaryProgress = true;
                    // Yield at the exact loop exit before continuing Over/Out.
                    break;
                }
                else renderBoundaryProgress = true;
            }
        }

        if(showLoopSteps || renderBoundaryProgress || boundaryAction!==action || stopped || completed===0)
            dbg.cycle({cpu:cpu});

        if(boundaryAction!==action || stopped || completed===0)
        {
            finishBoundaryAction();
            return;
        }
        scheduleBoundaryAction(cfg.delay);
    }

    function startBoundaryAction(action)
    {
        pauseExecution();
        boundaryAction = action;
        syncRunIcon();
        if(currentPC!==null) renderListing(currentPC,true);
        scheduleBoundaryAction(0);
        return action;
    }

    function tempBreakpointHit(state)
    {
        tempBreakpoint.armed = false;
        tempBreakpoint.error = tempBreakpoint.error || null;
        if(tempBreakpoint.error)
        {
            tempBreakpoint.hit = false;
            breakMessage = "COND ERR";
        }
        else
        {
            tempBreakpoint.hit = true;
            tempBreakpoint.hits++;
            breakMessage = "";
        }
        breakTarget = tempBreakpoint.address;

        // Stop whichever live owner was executing. The CPU trap has already
        // removed itself before this callback runs, so no target opcode is lost.
        stopBoundaryAction();
        stopFixedRun();
        if(systemRunning()) pauseSystem();

        if(state && state.pc!==undefined)
        {
            currentPC = state.pc & 0xffff;
            previousObservedPC = currentPC;
        }
        syncRunIcon();
        syncBreakpointControls();

        // SYSTEM cycle/fixed batch will normally render immediately after the
        // trap returns; this covers direct tool/API execution as well.
        window.setTimeout(function()
        {
            var cpu = liveCPU();
            if(cpu && dbg.isReady()) dbg.cycle({cpu:cpu,force:true});
        },0);
        return true;
    }

    function tempBreakpointTrap(state)
    {
        tempBreakpoint.checks++;
        var matched = true;

        try
        {
            matched = breakConditionAst ? !!conditionValue(breakConditionAst,state) : true;
            tempBreakpoint.lastResult = matched;
            tempBreakpoint.error = null;
        }
        catch(err)
        {
            tempBreakpoint.lastResult = null;
            tempBreakpoint.error = err && err.message ? err.message : String(err);
            breakMessage = "COND ERR";
            matched = true; // stop visibly rather than silently ignoring an unreadable condition
        }

        if(!matched)
        {
            tempBreakpoint.skips++;
            var cpu = liveCPU();
            if(tempBreakpoint.armed && cpu && typeof(cpu.setExecutionTrap)==="function")
                cpu.setExecutionTrap(tempBreakpoint.address,tempBreakpointTrap);
            return false;
        }

        return tempBreakpointHit(state);
    }

    function armTemporaryBreakpoint(addr,autoRun,conditionText)
    {
        var cpu = liveCPU();
        addr = parseAddress(addr);
        if(!cpu || addr===null || typeof(cpu.setExecutionTrap)!="function")
        {
            breakMessage = addr===null ? "BAD BP" : "BP unavailable";
            if(currentPC!==null) renderListing(currentPC,true);
            return false;
        }

        var compiled;
        try
        {
            compiled = compileBreakpointCondition(conditionText===undefined ? breakConditionText : conditionText);
        }
        catch(err)
        {
            breakConditionText = String(conditionText===undefined ? breakConditionText : conditionText).trim();
            breakConditionError = err && err.message ? err.message : String(err);
            breakMessage = "BAD COND";
            tempBreakpoint.error = breakConditionError;
            syncBreakpointControls();
            if(currentPC!==null) renderListing(currentPC,true);
            return false;
        }

        if(tempBreakpoint.armed && typeof(cpu.clearExecutionTrap)==="function")
            cpu.clearExecutionTrap();

        breakTarget = addr;
        breakConditionText = compiled.text;
        breakConditionError = "";
        breakConditionAst = compiled.ast;
        tempBreakpoint.address = addr;
        tempBreakpoint.armed = true;
        tempBreakpoint.hit = false;
        tempBreakpoint.condition = compiled.text;
        tempBreakpoint.lastResult = null;
        tempBreakpoint.error = null;
        breakMessage = "";

        cpu.setExecutionTrap(addr,tempBreakpointTrap);
        syncBreakpointControls();
        if(currentPC!==null) renderListing(currentPC,true);

        if(autoRun) startExecution();
        return addr;
    }

    function clearTemporaryBreakpoint(clearTarget)
    {
        var cpu = liveCPU();
        if(tempBreakpoint.armed && cpu && typeof(cpu.clearExecutionTrap)==="function")
            cpu.clearExecutionTrap();

        tempBreakpoint.address = null;
        tempBreakpoint.armed = false;
        tempBreakpoint.hit = false;
        tempBreakpoint.condition = "";
        tempBreakpoint.lastResult = null;
        tempBreakpoint.error = null;
        breakConditionAst = null;
        breakConditionError = "";
        breakMessage = "";
        if(clearTarget) breakTarget = null;

        syncBreakpointControls();
        if(currentPC!==null) renderListing(currentPC,true);
        return true;
    }

    this.html = function(body_id,wrapper_id)
    {
        this.body_id = body_id;
        oCOM.POPUP.set_state(wrapper_id,true);
        return "<div class=appbox style='text-align:left;height:auto;min-height:350px;width:350px;padding:0 0 0 1px;margin:0'>"

            +"<div class=marginless style='border:0;font-family:Arial,sans-serif;font-size:9px;line-height:18px'>"
                    +"<div style='display:flex;align-items:center;gap:3px;white-space:nowrap;min-width:0'>"
                        +"<span style='font-size:12px;'>STEP TRACE&nbsp;</span>"
                        //+"<span style='font-size:15px;font-weight:400;line-height:22px;margin-right:2px'>STEP TRACE</span>"
                        +"<i id=cpuDbg_play class='fa fa-pause-circle' style='font-size:11px;cursor:pointer' title='pause CPU execution' onclick='oEMU.component.CPU.Apple2Debug.toggleRun(this)'></i>"
                        +"<i class='fa fa-sign-in-alt' style='font-size:11px;cursor:pointer' title='step one live instruction (F11)' onclick='oEMU.component.CPU.Apple2Debug.step()'></i>"
                        +"<i class='fa fa-paw' style='font-size:11px;cursor:pointer' title='step over JSR/BRK (F10)' onclick='oEMU.component.CPU.Apple2Debug.stepOver()'></i>"
                        +"<i class='fa fa-sign-out-alt' style='font-size:11px;cursor:pointer' title='step out of current routine (Shift+F11)' onclick='oEMU.component.CPU.Apple2Debug.stepOut()'></i>"
                        
                        +"<div style='width:40px'></div>"
                        
                        +"<div class='appbut skinny'><i id='cpuDbg_bootTrigger' class='fa fa-coffee' style='opacity:.35;font-size:10px' title='bootlog trigger disabled' onclick='oEMU.component.CPU.Apple2Debug.toggleBootLogTrigger(this)'></i></div>"
                        +"<input id='cpuDbg_bootStart' type='text' value='' maxlength='6' spellcheck='false' placeholder='$....' title='Bootlog start address; blank starts immediately' style='width:43px;height:18px;padding:0 2px;box-sizing:border-box;font-family:"+listingFontFamily+";font-size:9px;text-transform:uppercase' onchange='oEMU.component.CPU.Apple2Debug.setBootLogAddresses()'>"
                        //+"<span title='bootlog start → stop'>›</span>"
                        +"<i class='fa fa-play'></i>"
                        +"<input id='cpuDbg_bootStop' type='text' value='' maxlength='6' spellcheck='false' placeholder='$....' title='Bootlog stop address; blank stops when the buffer is full' style='width:43px;height:18px;padding:0 2px;box-sizing:border-box;font-family:"+listingFontFamily+";font-size:9px;text-transform:uppercase' onchange='oEMU.component.CPU.Apple2Debug.setBootLogAddresses()'>"
                        +"<div class='appbut skinny' onclick='oEMU.component.CPU.Apple2Debug.downloadBootLog()'><i class='fa fa-cloud-download-alt' style='font-size:10px' title='download bootlog'></i></div>"
                        +"<span style='flex:1 1 auto'></span>"
                        +"<div class='appbut' onclick=\"oEMU.component.CPU.Apple2Debug.close();oCOM.POPUP.toggle('"+wrapper_id+"');\" style='text-align:center;margin-left:0;padding:4px 6px;font-size:11px'>x</div>"
                    +"</div>"
                    +"<div style='display:flex;align-items:center;gap:3px;white-space:nowrap'>"

                        +"NAV "

                        +"<button type='button' aria-label='Previous instruction; hold for page up' title='Previous instruction; hold 1/2s for page up' "
                            +"onmousedown='return oEMU.component.CPU.Apple2Debug.navButtonDown(this,-1)' onmouseup='return oEMU.component.CPU.Apple2Debug.navButtonUp(this)' onmouseleave='return oEMU.component.CPU.Apple2Debug.navButtonCancel(this)' "
                            +"ontouchstart='return oEMU.component.CPU.Apple2Debug.navButtonDown(this,-1)' ontouchend='return oEMU.component.CPU.Apple2Debug.navButtonUp(this)' ontouchcancel='return oEMU.component.CPU.Apple2Debug.navButtonCancel(this)' "
                            +"style='border:0;background:transparent;-webkit-appearance:none;appearance:none;padding:0 1px;margin:0;line-height:1;font-size:11px;cursor:pointer'>↑</button>"
                        +"<button type='button' aria-label='Next instruction; hold for page down' title='Next instruction; hold 1/2s for page down' "
                            +"onmousedown='return oEMU.component.CPU.Apple2Debug.navButtonDown(this,1)' onmouseup='return oEMU.component.CPU.Apple2Debug.navButtonUp(this)' onmouseleave='return oEMU.component.CPU.Apple2Debug.navButtonCancel(this)' "
                            +"ontouchstart='return oEMU.component.CPU.Apple2Debug.navButtonDown(this,1)' ontouchend='return oEMU.component.CPU.Apple2Debug.navButtonUp(this)' ontouchcancel='return oEMU.component.CPU.Apple2Debug.navButtonCancel(this)' "
                            +"style='border:0;background:transparent;-webkit-appearance:none;appearance:none;padding:0 1px;margin:0;line-height:1;font-size:11px;cursor:pointer'>↓</button>"
                        +"<span id='cpuDbg_navStatus' style='font-family:"+listingFontFamily+";font-size:9px'></span>"
                        +"<i id='cpuDbg_showLoopSteps' class='fa fa-retweet' role='button' aria-pressed='true' title='Closed-loop steps visible — click to hide repeated loop iterations' onclick='oEMU.component.CPU.Apple2Debug.toggleLoopSteps()' style='font-size:10px;cursor:pointer;margin-left:3px'></i>"
                        +"<i id='cpuDbg_trackPc' class='fa fa-lock' role='button' aria-pressed='true' title='Track PC enabled — click to unlock the listing' onclick='oEMU.component.CPU.Apple2Debug.toggleTrackPC()' style='font-size:10px;cursor:pointer;margin-left:4px'></i>"
                        +"<span>BREAK</span>"
                        +"<input id='cpuDbg_breakAddr' type='text' value='' maxlength='6' spellcheck='false' title='Temporary one-shot execution breakpoint address; click a listing row to fill it' style='width:40px;height:18px;padding:0 2px;box-sizing:border-box;font-family:"+listingFontFamily+";font-size:9px;text-transform:uppercase' onchange='oEMU.component.CPU.Apple2Debug.setBreakpointTarget(this.value)'>"
                        +"<select id='cpuDbg_speed' title='STEP TRACE execution speed' onchange='oEMU.component.CPU.Apple2Debug.setRunSpeed(this.value)' style='width:100px;height:18px;padding:0;font-size:9px'>"
                            +"<option value='1'>1 IPS</option>"
                            +"<option value='10'>10 IPS</option>"
                            +"<option value='100'>100 IPS</option>"
                            +"<option value='1000'>1000 IPS</option>"
                            +"<option value='system' selected>Max (SYSTEM)</option>"
                        +"</select>"                        
                    +"</div>"
                    +"<div style='display:flex;align-items:center;gap:3px;white-space:nowrap'>"
                        +"<span>IF</span>"
                        +"<input id='cpuDbg_breakCond' type='text' value='' spellcheck='false' title='"+conditionHelp+"' placeholder='e.g. A==$10 && M[$4000]==$80' style='flex:0.7 1 auto;min-width:0;height:18px;padding:0 3px;box-sizing:border-box;font-family:"+listingFontFamily+";font-size:9px' onchange='oEMU.component.CPU.Apple2Debug.setBreakpointCondition(this.value)'>"
                        +"<button id='cpuDbg_breakArm' type='button' title='Arm one-shot breakpoint (F9)' onclick='oEMU.component.CPU.Apple2Debug.setTemporaryBreakpointFromInput(false)' style='font-size:9px;padding:0 4px'>Arm</button>"
                        +"<button type='button' title='Arm breakpoint and continue execution to it' onclick='oEMU.component.CPU.Apple2Debug.setTemporaryBreakpointFromInput(true)' style='font-size:9px;padding:0 4px'>Run→</button>"
                        +"<button type='button' title='Clear temporary breakpoint (Shift+F9)' onclick='oEMU.component.CPU.Apple2Debug.clearTemporaryBreakpoint()' style='font-size:9px;padding:0 4px'>Clear</button>"
                    +"</div>"
                    +"<div style='white-space:nowrap'>LISTING&nbsp; Columns <input id='cpuDbg_columns' type='text' value='"+listingColumns+"' spellcheck='false' style='width:220px;font-family:"+listingFontFamily+";font-size:9px' onchange='oEMU.component.CPU.Apple2Debug.setListingColumns(this.value)'></div>"
                    +"<div style='white-space:nowrap;font-size:9px'>"
                        +"<button type='button' onclick=\"oEMU.component.CPU.Apple2Debug.applyListingPreset('default')\" style='font-size:9px;padding:0 3px'>default ▦</button> "
                        +"<button type='button' onclick=\"oEMU.component.CPU.Apple2Debug.applyListingPreset('wide')\" style='font-size:9px;padding:0 3px'>wide ▦</button> "
                        +"<button type='button' onclick=\"oEMU.component.CPU.Apple2Debug.applyListingPreset('compact')\" style='font-size:9px;padding:0 3px'>compact ▦</button>"
                        +"&nbsp; SYMBOLS "
                        +"<button type='button' title='Load RetroAppleJS assembler symbol export (.symbols.json) or simple text symbol map' onclick=\"oEMU.component.CPU.Apple2Debug.chooseSymbolFile()\" style='font-size:9px;padding:0 3px'>load</button> "
                        +"<button id='cpuDbg_symbolClear' type='button' title='Clear loaded symbol table' onclick=\"oEMU.component.CPU.Apple2Debug.clearSymbols()\" style='font-size:9px;padding:0 3px'>clear</button> "
                        +"<span id='cpuDbg_symbolStatus' title='No external symbol table loaded'>none</span>"
                        +"<input id='cpuDbg_symbolFile' type='file' accept='.symbols.json,.json,.sym,.txt,application/json,text/plain' style='display:none' onchange='if(this.files&&this.files[0]) oEMU.component.CPU.Apple2Debug.loadSymbolFile(this.files[0]);this.value=\"\";'>"
                    +"</div>"
                +"</div>"
                +"<div id='"+body_id+"' class=marginless style='width:348px;height:"+(listingRows*rowPixelHeight)+"px;border:0;font-family:"+listingFontFamily+";font-size:"+listingFontSize+"px;font-weight:500;font-kerning:none;font-variant-ligatures:none;color:#000;white-space:nowrap;overflow-x:auto;overflow-y:hidden;touch-action:none;'></div>"
                +"<div id='"+body_id+"_regs' class='DBG_traceRegisterInfo' style='width:348px;height:18px;line-height:18px;border:0;padding:1px 0 0 2px;font-family:"+listingFontFamily+";font-size:10px;font-weight:500;white-space:nowrap'>A=00 X=00 Y=00 SP=FF SR=<sub>n</sub>0<sub>v</sub>0<sub>-</sub>1<sub>b</sub>0<sub>d</sub>0<sub>i</sub>1<sub>z</sub>0<sub>c</sub>0</div>"
            +"</div></div>";
    };

    this.chooseSymbolFile = function()
    {
        var input = document.getElementById("cpuDbg_symbolFile");
        if(input) input.click();
    };

    this.loadSymbolsText = function(text,fileName)
    {
        text = String(text==null ? "" : text);
        var trimmed = text.trim();
        try
        {
            if(trimmed.charAt(0)==="{" || trimmed.charAt(0)==="[")
                return loadSymbolObject(JSON.parse(trimmed),fileName);
            return loadSymbolTextMap(text,fileName);
        }
        catch(err)
        {
            symbolState.error = err && err.message ? err.message : String(err);
            syncSymbolControls();
            throw err;
        }
    };

    this.loadSymbolFile = function(file)
    {
        if(!file) return false;
        var reader = new FileReader();
        reader.onload = function()
        {
            try
            {
                dbg.loadSymbolsText(reader.result,file.name || "symbols");
            }
            catch(err)
            {
                alert("Cannot load symbol table: "+(err && err.message ? err.message : err));
            }
        };
        reader.onerror = function()
        {
            symbolState.error = "Cannot read symbol file";
            syncSymbolControls();
            alert(symbolState.error);
        };
        reader.readAsText(file);
        return true;
    };

    this.clearSymbols = function()
    {
        return resetLoadedSymbols();
    };

    this.downloadBootLog = function()
    {
        var cpu = liveCPU();
        if(!cpu || typeof(cpu.getBootLogBase64)!="function")
        {
            alert("Bootlog download is unavailable: getBootLogBase64() is missing.");
            return;
        }

        var base64 = cpu.getBootLogBase64();
        var filename = "apple2_bootlog_" + new Date().toISOString().replace(/[:.]/g,"-") + ".txt";
        var blob = new Blob([base64],{type:"text/plain;charset=utf-8"});
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    function bootAddressInput(id,label,example)
    {
        var input = document.getElementById(id);
        var text = input ? String(input.value || "").trim() : "";
        if(text==="") return {ok:true,value:null};

        var addr = parseAddress(text);
        if(addr!==null) return {ok:true,value:addr};

        alert("Invalid "+label+" address. Use for example "+example+", or leave blank.");
        if(input)
        {
            input.focus();
            if(typeof(input.select)==="function") input.select();
        }
        return {ok:false,value:null};
    }

    function bootRangeFromInputs()
    {
        var start = bootAddressInput("cpuDbg_bootStart","start","$6000");
        if(!start.ok) return null;
        var stop = bootAddressInput("cpuDbg_bootStop","stop","$FF69");
        if(!stop.ok) return null;
        return {start:start.value,stop:stop.value};
    }

    this.setBootLogAddresses = function()
    {
        var cpu = liveCPU();
        if(!cpu || typeof(cpu.BOOTparam)!="function" || typeof(cpu.setBootLogTrigger)!="function") return false;
        var range = bootRangeFromInputs();
        if(!range) return false;
        var state = cpu.BOOTparam();
        state = cpu.setBootLogTrigger(range.start,range.stop,!!state.bDebug_boot);
        updateBootTriggerIcon(document.getElementById("cpuDbg_bootTrigger"),state);
        return true;
    };

    this.toggleBootLogTrigger = function(el)
    {
        var cpu = liveCPU();
        if(!cpu || typeof(cpu.BOOTparam)!="function" || typeof(cpu.setBootLogTrigger)!="function")
        {
            alert("Bootlog trigger is unavailable in this CPU build.");
            return;
        }

        var state = cpu.BOOTparam();
        if(state.bDebug_boot)
        {
            state = cpu.setBootLogTrigger(state.triggerAddress,state.stopAddress,false);
            updateBootTriggerIcon(el,state);
            return;
        }

        var range = bootRangeFromInputs();
        if(!range) return;
        state = cpu.setBootLogTrigger(range.start,range.stop,true);
        updateBootTriggerIcon(el,state);
    };

    /*
     * Short press on NAV walks one instruction. Holding the same arrow for
     * 500 ms performs one page move, matching the restart button's
     * short-press/hold interaction model in tab 1.2.
     */
    this.navButtonDown = function(el,direction)
    {
        if(!el || el._cpuDbgNavArmed) return false;

        el._cpuDbgNavArmed = true;
        el._cpuDbgNavLong = false;
        el._cpuDbgNavDirection = Number(direction)<0 ? -1 : 1;
        el._cpuDbgNavTimer = window.setTimeout(function()
        {
            el._cpuDbgNavTimer = null;
            if(!el._cpuDbgNavArmed) return;
            el._cpuDbgNavLong = true;
            dbg.navigatePage(el._cpuDbgNavDirection);
        },500);
        return false;
    };

    this.navButtonUp = function(el)
    {
        if(!el || !el._cpuDbgNavArmed) return false;

        if(el._cpuDbgNavTimer!=null)
        {
            window.clearTimeout(el._cpuDbgNavTimer);
            el._cpuDbgNavTimer = null;
        }

        var longPress = !!el._cpuDbgNavLong;
        var direction = el._cpuDbgNavDirection<0 ? -1 : 1;
        el._cpuDbgNavArmed = false;
        el._cpuDbgNavLong = false;

        if(!longPress) dbg.navigateRows(direction);
        return false;
    };

    this.navButtonCancel = function(el)
    {
        if(!el) return false;
        if(el._cpuDbgNavTimer!=null) window.clearTimeout(el._cpuDbgNavTimer);
        el._cpuDbgNavTimer = null;
        el._cpuDbgNavArmed = false;
        el._cpuDbgNavLong = false;
        return false;
    };


    this.isReady = function()
    {
        return typeof(document)!="undefined" && !!document.getElementById(this.body_id);
    };

    this.open = function()
    {
        var cpu = liveCPU();
        if(!cpu || !this.isReady()) return false;
        if(!ensureInit({scrollH:listingRows})) return false;

        bindNavigation();
        var sel = document.getElementById("cpuDbg_speed");
        if(sel) sel.value = runMode;
        var input = document.getElementById("cpuDbg_columns");
        if(input) input.value = listingColumns;
        var cond = document.getElementById("cpuDbg_breakCond");
        if(cond) cond.value = breakConditionText;
        syncSymbolControls();

        currentPC = cpu.watch().pc & 0xffff;
        previousObservedPC = currentPC;
        if(breakTarget===null) breakTarget = currentPC;
        renderListing(currentPC,true);
        syncRunIcon();

        if(typeof(cpu.BOOTparam)=="function")
            updateBootTriggerIcon(document.getElementById("cpuDbg_bootTrigger"),cpu.BOOTparam());
        return true;
    };

    this.cycle = function(obj)
    {
        var cpu = obj && obj.cpu && typeof(obj.cpu.watch)=="function" ? obj.cpu : liveCPU();
        if(!cpu || !this.isReady()) return false;
        if(!ensureInit({scrollH:listingRows})) return false;

        if(typeof(cpu.BOOTparam)=="function")
            updateBootTriggerIcon(document.getElementById("cpuDbg_bootTrigger"),cpu.BOOTparam());

        var watch = cpu.watch();
        updateRegisterStatus(watch,!!(obj && obj.force));
        var pc = watch.pc & 0xffff;
        if(previousObservedPC!==null && previousObservedPC!==pc)
            rememberSequential(previousObservedPC,pc);

        var changed = currentPC!==pc;
        previousObservedPC = pc;
        currentPC = pc;

        if(followPC)
        {
            if(changed || (obj && obj.force)) renderListing(pc,!!(obj && obj.force));
        }
        else
            renderListing(pc,!!(obj && obj.force));

        syncRunIcon();
        return true;
    };

    this.setFollowPC = function(enabled)
    {
        return setFollowState(enabled,true);
    };

    this.toggleTrackPC = function()
    {
        return this.setFollowPC(!followPC);
    };

    this.setShowLoopSteps = function(enabled)
    {
        showLoopSteps = !!enabled;
        resetClosedLoopDisplayState();
        syncLoopControl();
        if(currentPC!==null) renderListing(currentPC,true);
        return showLoopSteps;
    };

    this.toggleLoopSteps = function()
    {
        return this.setShowLoopSteps(!showLoopSteps);
    };

    this.navigateRows = function(delta)
    {
        delta = Number(delta)|0;
        if(delta===0) return 0;
        var cpu = liveCPU();
        if(!cpu || !ensureInit({scrollH:listingRows})) return 0;

        var pc = cpu.watch().pc & 0xffff;
        currentPC = pc;
        if(followPC) setFollowState(false,false);
        if(manualTop===null) manualTop = lastViewTop===null ? pc : lastViewTop;

        var adr = manualTop;
        var wanted = Math.abs(delta);
        var dir = delta<0 ? -1 : 1;
        var moved = 0;

        for(var i=0;i<wanted;i++)
        {
            if(dir>0)
            {
                var d = decodeAt(adr);
                if(!d) break;
                previousBoundary[d.next] = adr;
                adr = d.next;
            }
            else
            {
                var prev = predecessorOf(adr);
                if(prev<0) break;
                adr = prev;
            }
            moved++;
        }

        if(moved>0) manualTop = adr;
        renderListing(pc,true);
        return moved*dir;
    };

    this.navigatePage = function(direction)
    {
        direction = Number(direction)<0 ? -1 : 1;
        return this.navigateRows(direction*Math.max(1,listingRows-1));
    };

    this.setRunSpeed = function(value)
    {
        value = String(value || "system").toLowerCase();
        if(["1","10","100","1000","system"].indexOf(value)<0) value = "system";

        var wasRunning = executionRunning();
        if(runMode==="system" && systemRunning()) pauseSystem();
        stopBoundaryAction();
        stopFixedRun();
        runMode = value;
        if(runMode==="system") resetClosedLoopDisplayState();

        var sel = document.getElementById("cpuDbg_speed");
        if(sel && sel.value!==runMode) sel.value = runMode;

        if(wasRunning) startExecution();
        else syncRunIcon();
        return runMode;
    };

    this.toggleRun = function(el)
    {
        if(executionRunning()) pauseExecution();
        else startExecution();
        syncRunIcon(el);
        this.cycle({cpu:liveCPU(),force:true});
    };

    this.play = function(bPlay)
    {
        if(!!bPlay !== executionRunning()) this.toggleRun(document.getElementById("cpuDbg_play"));
    };

    this.step = function()
    {
        // A direct Step-In request is always displayed literally. Loop hiding is
        // a continuous-run presentation policy, not an instruction-skipping mode.
        resetClosedLoopDisplayState();
        var machine = liveMachine();
        if(!machine || typeof(machine.stepLiveInstruction)!="function") return false;

        pauseExecution();
        var result = machine.stepLiveInstruction();
        if(result && result.ticks>0) rememberSequential(result.startPC,result.endPC);
        this.cycle({cpu:machine.cpuObj(),force:true});
        return result;
    };

    this.stepOver = function()
    {
        var cpu = liveCPU();
        if(!cpu || !ensureInit({scrollH:listingRows})) return false;
        var state = cpu.watch();
        var pc = state.pc & 0xffff;
        var d = decodeAt(pc);
        if(!d) return false;

        // Only call-like operations need a temporary run. Everything else is
        // exactly one live instruction.
        if(d.b0!==0x20 && d.b0!==0x00) return this.step();

        return startBoundaryAction({
             "type":"over"
            ,"returnPC":d.next
            ,"startSP":state.sp & 0xff
            ,"instructions":0
        });
    };

    this.stepOut = function()
    {
        var cpu = liveCPU();
        if(!cpu || !ensureInit({scrollH:listingRows})) return false;
        return startBoundaryAction({
             "type":"out"
            ,"jsrDepth":0
            ,"irqDepth":0
            ,"instructions":0
        });
    };

    this.setBreakpointTarget = function(value)
    {
        var addr = parseAddress(value);
        if(addr===null)
        {
            breakMessage = "BAD BP";
            if(currentPC!==null) renderListing(currentPC,true);
            return false;
        }
        return setBreakpointTarget(addr);
    };

    this.setBreakpointCondition = function(value)
    {
        breakConditionText = String(value==null ? "" : value).trim();
        try
        {
            compileBreakpointCondition(breakConditionText);
            breakConditionError = "";
            breakMessage = "";
        }
        catch(err)
        {
            breakConditionError = err && err.message ? err.message : String(err);
            breakMessage = "BAD COND";
        }
        syncBreakpointControls();
        if(currentPC!==null) renderListing(currentPC,true);
        return breakConditionError ? false : breakConditionText;
    };

    this.setTemporaryBreakpoint = function(address,autoRun,condition)
    {
        return armTemporaryBreakpoint(address,!!autoRun,condition);
    };

    this.setTemporaryBreakpointFromInput = function(autoRun)
    {
        var input = document.getElementById("cpuDbg_breakAddr");
        var addr = input ? parseAddress(input.value) : breakTarget;
        var cond = document.getElementById("cpuDbg_breakCond");
        var condition = cond ? cond.value : breakConditionText;
        if(addr===null)
        {
            breakMessage = "BAD BP";
            if(currentPC!==null) renderListing(currentPC,true);
            return false;
        }
        return armTemporaryBreakpoint(addr,!!autoRun,condition);
    };

    this.runToAddress = function(address)
    {
        var cond = document.getElementById("cpuDbg_breakCond");
        return armTemporaryBreakpoint(address,true,cond ? cond.value : breakConditionText);
    };

    this.clearTemporaryBreakpoint = function()
    {
        return clearTemporaryBreakpoint(false);
    };

    this.setListingColumns = function(value)
    {
        if(String(value || "").trim()) listingColumns = String(value).trim();
        var input = document.getElementById("cpuDbg_columns");
        if(input && input.value!==listingColumns) input.value = listingColumns;
        if(currentPC!==null) renderListing(currentPC,true);
        return listingColumns;
    };

    this.applyListingPreset = function(name)
    {
        var preset = listingColumnPresets[name];
        if(!preset) return false;
        this.setListingColumns(preset);
        return true;
    };

    this.close = function()
    {
        // Never leave an invisible debugger-owned run or execution trap active.
        stopBoundaryAction();
        stopFixedRun();
        resetClosedLoopDisplayState();
        clearTemporaryBreakpoint(false);
        syncRunIcon();
    };

    this.liveState = function()
    {
        var cpu = liveCPU();
        return {
             "pc":cpu ? (cpu.watch().pc & 0xffff) : null
            ,"runMode":runMode
            ,"running":executionRunning()
            ,"systemRunning":systemRunning()
            ,"resumePct":resumePct
            ,"followPC":followPC
            ,"showLoopSteps":showLoopSteps
            ,"closedLoop":activeClosedLoop ? Object.assign({},activeClosedLoop) : null
            ,"loopDisplayStats":Object.assign({},loopDisplayStats)
            ,"viewTop":lastViewTop
            ,"mappedBus":!!(liveHW() && typeof(liveHW().safe_read)=="function")
            ,"traceMaskedRange":"$C000-$C0FF"
            ,"tracePeripheralROM":"$C100-$CFFF"
            ,"pcInPeripheralROM":cpu ? peripheralRomAddress(cpu.watch().pc) : false
            ,"liveStepAPI":!!(liveMachine() && typeof(liveMachine().stepLiveInstruction)=="function")
            ,"boundaryAction":boundaryAction ? Object.assign({},boundaryAction) : null
            ,"breakpoint":{
                 "target":breakTarget
                ,"address":tempBreakpoint.address
                ,"armed":tempBreakpoint.armed
                ,"hit":tempBreakpoint.hit
                ,"hits":tempBreakpoint.hits
                ,"checks":tempBreakpoint.checks
                ,"skips":tempBreakpoint.skips
                ,"condition":tempBreakpoint.condition
                ,"editorCondition":breakConditionText
                ,"lastResult":tempBreakpoint.lastResult
                ,"error":tempBreakpoint.error || breakConditionError || null
              }
            ,"symbols":Object.assign({},symbolState)
            ,"cacheHits":cacheHits
            ,"cacheMisses":cacheMisses
            ,"domWrites":domWrites
        };
    };
}
