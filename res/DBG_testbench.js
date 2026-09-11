/*
 * DBG_testbench.js
 *
 * First-pass algorithm test harness for Debugger tab 3.2.
 * Deliberately small: UI plumbing + a trusted JavaScript REPL/editor +
 * direct debugger-RAM helpers. Test profiles/generators/assertions come later.
 */
(function(global){
  "use strict";

  var terminal = null;

  function el(id){ return document.getElementById(id); }

  function hex(v,width)
  {
    width = width || 2;
    var mask = width <= 2 ? 0xff : 0xffff;
    return "$" + ("0000" + ((Number(v)||0) & mask).toString(16).toUpperCase()).slice(-width);
  }

  function parseAddress(value)
  {
    if(typeof value === "number") return value & 0xffff;
    var s = String(value == null ? "" : value).trim();
    if(!s) throw new Error("Address is required.");
    if(/^\$[0-9a-f]+$/i.test(s)) return parseInt(s.slice(1),16) & 0xffff;
    if(/^0x[0-9a-f]+$/i.test(s)) return parseInt(s,16) & 0xffff;
    if(/^[0-9]+$/.test(s)) return parseInt(s,10) & 0xffff;
    throw new Error("Invalid address '" + s + "'. Use $0000, 0x0000 or decimal.");
  }

  function parseBytes(value)
  {
    if(value instanceof Uint8Array) return new Uint8Array(value);
    if(Array.isArray(value)) return Uint8Array.from(value.map(function(v){ return Number(v) & 0xff; }));
    if(typeof value === "number") return Uint8Array.of(value & 0xff);

    var s = String(value == null ? "" : value).trim();
    if(!s) return new Uint8Array(0);

    // Trusted concept tool: allow an inline JS array/expression when prefixed with '='.
    if(s.charAt(0) === "=")
    {
      var evaluated = (0,eval)(s.slice(1));
      return parseBytes(evaluated);
    }

    var tokens = s.split(/[\s,;]+/).filter(Boolean);
    return Uint8Array.from(tokens.map(function(tok){
      if(/^\$[0-9a-f]+$/i.test(tok)) return parseInt(tok.slice(1),16) & 0xff;
      if(/^0x[0-9a-f]+$/i.test(tok)) return parseInt(tok,16) & 0xff;
      if(/^[0-9a-f]{1,2}$/i.test(tok)) return parseInt(tok,16) & 0xff;
      if(/^[0-9]+$/.test(tok)) return parseInt(tok,10) & 0xff;
      throw new Error("Invalid byte '" + tok + "'.");
    }));
  }

  function formatValue(value)
  {
    if(value === undefined) return "undefined";
    if(value === null) return "null";
    if(typeof value === "string") return value;
    if(value instanceof Uint8Array)
      return Array.from(value).map(function(v){ return hex(v,2); }).join(" ");
    if(Array.isArray(value))
      return "[" + value.map(function(v){ return typeof v === "number" ? hex(v,2) : String(v); }).join(", ") + "]";
    if(typeof value === "object")
    {
      try { return JSON.stringify(value,null,2); }
      catch(_) { return String(value); }
    }
    return String(value);
  }

  function termWrite(text,channel)
  {
    text = String(text == null ? "" : text);
    if(terminal && typeof terminal.write === "function")
      terminal.write(text + (text.endsWith("\n") ? "" : "\n"),channel || "host");
    else
    {
      var fallback = el("DBG_testConsoleFallback");
      if(fallback)
      {
        fallback.value += text + (text.endsWith("\n") ? "" : "\n");
        fallback.scrollTop = fallback.scrollHeight;
      }
    }
  }

  var TB = {
    version: "0.1-ui",

    get RAM(){
      if(!(global.DBG_RAM instanceof Uint8Array)) throw new Error("DBG_RAM is not available.");
      return global.DBG_RAM;
    },

    hex: hex,
    address: parseAddress,
    bytes: parseBytes,

    print: function(){
      var parts = Array.prototype.slice.call(arguments).map(formatValue);
      termWrite(parts.join(" "),"host");
      return arguments.length ? arguments[arguments.length-1] : undefined;
    },

    ram: {
      read: function(address,length)
      {
        var ram = TB.RAM;
        var a = parseAddress(address);
        length = length == null ? 1 : Math.max(0,Number(length)|0);
        if(length === 1) return ram[a] & 0xff;
        var out = new Uint8Array(length);
        for(var i=0;i<length;i++) out[i] = ram[(a+i)&0xffff] & 0xff;
        return out;
      },

      write: function(address,value)
      {
        var ram = TB.RAM;
        var a = parseAddress(address);
        var bytes = parseBytes(value);
        for(var i=0;i<bytes.length;i++) ram[(a+i)&0xffff] = bytes[i] & 0xff;
        return bytes.length;
      },

      load: function(address,value){ return TB.ram.write(address,value); },

      fill: function(address,length,value)
      {
        var ram = TB.RAM;
        var a = parseAddress(address);
        var n = Math.max(0,Number(length)|0);
        var b = Number(value) & 0xff;
        for(var i=0;i<n;i++) ram[(a+i)&0xffff] = b;
        return n;
      },

      dump: function(address,length,columns)
      {
        var ram = TB.RAM;
        var a = parseAddress(address);
        var n = Math.max(0,Number(length == null ? 16 : length)|0);
        var cols = Math.max(1,Number(columns == null ? 16 : columns)|0);
        var lines = [];
        for(var offset=0;offset<n;offset+=cols)
        {
          var row = [];
          var ascii = "";
          var count = Math.min(cols,n-offset);
          for(var i=0;i<count;i++)
          {
            var b = ram[(a+offset+i)&0xffff] & 0xff;
            row.push(("0"+b.toString(16).toUpperCase()).slice(-2));
            ascii += b>=32 && b<127 ? String.fromCharCode(b) : ".";
          }
          lines.push(hex((a+offset)&0xffff,4) + "  " + row.join(" ").padEnd(cols*3-1," ") + "  " + ascii);
        }
        return lines.join("\n");
      }
    }
  };

  function harnessConsole()
  {
    return {
      log: function(){ TB.print.apply(TB,arguments); },
      info: function(){ TB.print.apply(TB,arguments); },
      warn: function(){ termWrite(Array.prototype.slice.call(arguments).map(formatValue).join(" "),"warn"); },
      error:function(){ termWrite(Array.prototype.slice.call(arguments).map(formatValue).join(" "),"error"); }
    };
  }

  TB.eval = function(code)
  {
    code = String(code == null ? "" : code);
    var RAM = TB.RAM;
    var ram = TB.ram;
    var print = TB.print;
    var console = harnessConsole();
    // Deliberately trusted eval() test harness for this concept/debugging project.
    return eval(code);
  };

  function runCode(code,echoResult)
  {
    try
    {
      var result = TB.eval(code);
      if(echoResult && result !== undefined) termWrite("← " + formatValue(result),"result");
      setStatus("ready");
      return result;
    }
    catch(err)
    {
      termWrite("[ERROR] " + (err && err.stack ? err.stack : String(err)),"error");
      setStatus("error");
      return undefined;
    }
  }

  function setStatus(text)
  {
    var node = el("DBG_testbenchStatus");
    if(node) node.textContent = text;
  }

  function runEditor()
  {
    var editor = el("DBG_testScript");
    if(!editor) return;
    termWrite("▶ run script","command");
    runCode(editor.value,false);
  }

  function clearConsole()
  {
    if(terminal && typeof terminal.clear === "function") terminal.clear();
    var fallback = el("DBG_testConsoleFallback");
    if(fallback) fallback.value = "";
  }

  function injectRam()
  {
    try
    {
      var address = parseAddress(el("DBG_testRamAddress").value);
      var bytes = parseBytes(el("DBG_testRamData").value);
      TB.ram.write(address,bytes);
      termWrite("RAM ← " + bytes.length + " byte(s) @ " + hex(address,4),"ram");
      setStatus(bytes.length + " byte(s) injected");
    }
    catch(err){ termWrite("[ERROR] " + err.message,"error"); setStatus("error"); }
  }

  function readRam()
  {
    try
    {
      var address = parseAddress(el("DBG_testRamAddress").value);
      var length = Math.max(0,parseInt(el("DBG_testRamLength").value,10) || 16);
      var dump = TB.ram.dump(address,length,16);
      termWrite(dump,"ram");
      var data = el("DBG_testRamData");
      if(data) data.value = Array.from(TB.ram.read(address,length)).map(function(v){ return ("0"+v.toString(16).toUpperCase()).slice(-2); }).join(" ");
      setStatus(length + " byte(s) read");
    }
    catch(err){ termWrite("[ERROR] " + err.message,"error"); setStatus("error"); }
  }

  function loadExample()
  {
    var editor = el("DBG_testScript");
    if(!editor) return;
    editor.value = [
      "// DBG_RAM is exposed as RAM; helpers live under TB.",
      "TB.ram.fill(0x3000, 16, 0xA5);",
      "TB.ram.write(0x3004, [0x44,0x45,0x46,0x4C,0x41,0x54,0x45]);",
      "print(TB.ram.dump(0x3000, 32));",
      "",
      "// Expressions also work directly in the console:",
      "// TB.ram.read(0x3004, 7)",
      "// RAM[0x3000]"
    ].join("\n");
    editor.focus();
  }

  function bindButton(id,handler)
  {
    var node = el(id);
    if(node) node.addEventListener("click",handler);
  }

  function initTerminal()
  {
    var host = el("DBG_testConsole");
    if(!host) return;

    if(typeof global.TERMINAL === "function")
    {
      try
      {
        terminal = new global.TERMINAL({
          container:"DBG_testConsole",
          welcome:"JavaScript test harness ready.  Try <b>TB.ram.dump(0x0000,16)</b>.",
          prompt:"JS",
          separator:"&gt;",
          storageKey:"RetroAppleJS.Debugger.TestBench",
          preserveWhitespace:true,
          allowEmptyInput:false
        });
        terminal.onInput(function(command,params,commandLine){
          runCode(commandLine,true);
          return true;
        });
        return;
      }
      catch(err)
      {
        host.innerHTML = "";
        termWrite("COM_oTERM initialization failed: " + err.message,"error");
      }
    }

    var fallback = document.createElement("textarea");
    fallback.id = "DBG_testConsoleFallback";
    fallback.readOnly = true;
    fallback.spellcheck = false;
    host.appendChild(fallback);
    termWrite("Fallback console active; COM_oTERM.js was not available.","warn");
  }

  function init()
  {
    if(!el("DBG_testbenchBox")) return false;
    global.DBG_TESTBENCH = TB;
    global.TB = TB;

    initTerminal();
    bindButton("DBG_testRunButton",runEditor);
    bindButton("DBG_testClearConsoleButton",clearConsole);
    bindButton("DBG_testRamInjectButton",injectRam);
    bindButton("DBG_testRamReadButton",readRam);
    bindButton("DBG_testExampleButton",loadExample);

    var editor = el("DBG_testScript");
    if(editor)
      editor.addEventListener("keydown",function(ev){
        if((ev.ctrlKey || ev.metaKey) && ev.key === "Enter")
        {
          ev.preventDefault();
          runEditor();
        }
      });

    setStatus("ready");
    return true;
  }

  TB.ui = {
    init:init,
    run:runEditor,
    clear:clearConsole,
    inject:injectRam,
    read:readRam,
    example:loadExample
  };

  global.DBG_TESTBENCH = TB;
  global.TB = TB;

  if(global.oCOM && typeof global.oCOM.addToEventStack === "function")
    global.oCOM.addToEventStack("onload",init);
  else
    global.addEventListener("load",init);

})(window);
