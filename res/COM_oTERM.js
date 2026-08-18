/*
 * COM_oTERM.js
 *
 * RetroAppleJS extraction/adaptation of the oTERM/TERMINAL framework supplied
 * from AsciiCAD_CMD.js.  The framework remains a generic DOM terminal and
 * retains its method-level .help descriptors.  Small optional extensions make
 * it suitable for an 8-bit serial-line endpoint:
 *
 *   - per-instance storageKey
 *   - preserveWhitespace / allowEmptyInput
 *   - write(text,channel) for literal streaming output
 *   - help(topic) for standalone self-help
 *   - terminal keyboard events remain scoped to the terminal
 */

function TERMINAL(props) 
{
  this._o = {env:{}};
  props = props || {};

  // ---- config --------------------------------------------------------------
  var containerId = props.container || "vanilla-terminal";
  var userCommands = props.commands || {};
  var welcome =
    props.welcome !== undefined ? props.welcome : 'Welcome to <a href="">Vanilla</a> terminal.';
  var prompt = props.prompt || "";
  var separator = props.separator || "&gt;";
  var preserveWhitespace = !!props.preserveWhitespace;
  var allowEmptyInput = !!props.allowEmptyInput;

  // ---- constants -----------------------------------------------------------
  var STORAGE_KEY = props.storageKey || "VanillaTerm";
  var ROOT_CLASS = "VanillaTerm";

  // ---- helpers -------------------------------------------------------------

  function renderMarkup(shell) {
    return (
      '\n      <div class="container">\n' +
      "        <output></output>\n" +
      '        <div class="command">\n' +
      '          <div class="prompt">' +
      shell.prompt +
      shell.separator +
      "</div>\n" +
      '          <input class="input" spellcheck="false" autofocus />\n' +
      "        </div>\n" +
      "      </div>\n    "
    );
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cloneCommandNode(commandEl) {
    var line = commandEl.cloneNode(true);
    var input = line.querySelector(".input");

    input.autofocus = false;
    input.readOnly = true;
    input.insertAdjacentHTML("beforebegin", escapeHtml(input.value));
    input.parentNode.removeChild(input);

    line.classList.add("line");
    return line;
  }

  function loadHistory() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (_) {
      // ignore quota / privacy mode errors
    }
  }

  // ---- instance state ------------------------------------------------------

  var builtins =
    window.VanillaTerminalBuiltins &&
    typeof window.VanillaTerminalBuiltins.createBuiltInCommands === "function"
      ? window.VanillaTerminalBuiltins.createBuiltInCommands()
      : {};

  this._o.commands = Object.assign({}, userCommands, builtins);

  this._o.history = loadHistory();
  this._o.historyCursor = this._o.history.length;

  this._o.shell = { prompt: prompt, separator: separator };
  this._o.promptStack = []; // stack of previous {prompt,separator} shells

  this._o.state = {
    prompt: false, // prompt mode = next ENTER answers a question
    idle: false,
  };

  this.onAskCallback = function () {};
  this.onInputCallback = null;

  // ---- DOM -----------------------------------------------------------------

  var root = document.getElementById(containerId);
  if (!root) {
    throw new Error("Container #" + containerId + " doesn't exists.");
  }

  // Cache DOM
  root.classList.add(ROOT_CLASS);
  root.insertAdjacentHTML("beforeEnd", renderMarkup(this._o.shell));   // Expected behavior in iframe: Blocked autofocusing on a form control in a cross-origin subframe.

  var container = root.querySelector(".container");
  this._o.DOM = {
    root: root,
    container: container,
    output: container.querySelector("output"),
    command: container.querySelector(".command"),
    input: container.querySelector(".command .input"),
    prompt: container.querySelector(".command .prompt"),
  };

  // ---- internal methods that need `this` -----------------------------------

  var self = this;

  function resetCommand(prefill) 
  {
    self._o.DOM.input.value = prefill?prefill:"";
    self._o.DOM.command.classList.remove("input");
    self._o.DOM.command.classList.remove("hidden");

    if (typeof self._o.DOM.input.scrollIntoView === "function")
      self._o.DOM.input.scrollIntoView({ block: "nearest" });
  }

  function handleKeyUp(event) 
  {
    // Keep terminal editing keys inside the terminal itself.
    event.stopPropagation();
    var key = event.key || "";
    var code = event.keyCode;

    if (key === "Escape" || code === 27) 
    {
      self._o.DOM.input.value = "";
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    var isUp   = key === "ArrowUp"   || code === 38;
    var isDown = key === "ArrowDown" || code === 40;
    if (!isUp && !isDown) return;
    event.preventDefault();

    if (isUp && self._o.historyCursor > 0) self._o.historyCursor -= 1;
    if (isDown && self._o.historyCursor < self._o.history.length - 1) self._o.historyCursor += 1;

    var value = self._o.history[self._o.historyCursor];
    if (value !== undefined) self._o.DOM.input.value = value;
  }

  function handleKeyDown(event) 
  {
    // Stop bubbling only once the terminal's own handler is actually running.
    event.stopPropagation();
    var key = event.key || "";
    var code = event.keyCode;


    // Overwrite-mode editing while prompting (emulates terminal overwrite)
    if (self._o.state.prompt && self._o.state.overwrite)
    {
      const k = event.key || "";
      const isChar = (k.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey);

      // Let navigation keys behave normally
      const navKeys = new Set(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","Tab"]);
      if (navKeys.has(k)) return;

      // Backspace/Delete should behave normally too (optional: custom)
      if (k === "Backspace" || k === "Delete") return;

      if (isChar)
      {
        const input = self._o.DOM.input;
        const v = input.value || "";
        const s0 = input.selectionStart ?? v.length;
        const s1 = input.selectionEnd ?? v.length;

        // If user has a selection, replace selection like normal typing
        // Otherwise replace the char under caret (overwrite)
        let newV;
        let newPos;

        if (s1 > s0) {
          newV = v.slice(0, s0) + k + v.slice(s1);
          newPos = s0 + 1;
        } else {
          // overwrite at caret
          if (s0 >= v.length) {
            newV = v + k;                 // past end => append
          } else {
            newV = v.slice(0, s0) + k + v.slice(s0 + 1);
          }
          newPos = s0 + 1;
        }

        input.value = newV;
        try { input.setSelectionRange(newPos, newPos); } catch(_) {}
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    var isEnter = key === "Enter" || code === 13;
    if (!isEnter) return;
    event.preventDefault();

    var rawLine = self._o.DOM.input.value;
    var commandLine = preserveWhitespace ? rawLine : rawLine.trim();
    if (!commandLine && !allowEmptyInput) return;

    // Prompt mode: answer a question instead of dispatching a command
    if (self._o.state.prompt)
    {
      self._o.state.prompt = false;
      self._o.state.overwrite = false;
      self.onAskCallback(commandLine);

      self.popPrompt();          // ✅ restore previous prompt from stack

      resetCommand();
      return;
    }

    // Save non-empty lines in history.  A bare Enter may still be meaningful
    // to a serial endpoint, but it does not need to occupy command history.
    if (commandLine.length)
    {
      self._o.history.push(commandLine);
      saveHistory(self._o.history);
      self._o.historyCursor = self._o.history.length;
    }

    // Echo command as output line
    self._o.DOM.output.appendChild(cloneCommandNode(self._o.DOM.command));

    // Hide live command line while processing
    self._o.DOM.command.classList.add("hidden");
    self._o.DOM.input.value = "";

    // Pre-dispatch hook: allow host to handle the raw line.
    var parts = commandLine.split(" ");
    var command = parts[0];
    var params = parts.slice(1);


    if (typeof self.onInputCallback === "function") {
      try {
        var handled = self.onInputCallback(command, params, commandLine, rawLine);
        if (handled === true) {
          resetCommand();
          return;
        }
      } catch (err) {
        self.output("[ERROR] " + escapeHtml(err && err.message ? err.message : String(err)));
        resetCommand();
        return;
      }
    }


  }

  // ---- public API (instance methods defined here) ---------------------------

  
  this.clear = function () 
  {
    this._o.DOM.output.innerHTML = "";
    resetCommand();
  };
  this.clear.help = 
  {
    type:  "TERMINAL_Fn",
    syntax: "clear()",
    summary: "Clear the terminal output area and restore the live input line.",
    returns: {
      type: "void",
      description: "No JavaScript value is returned."
    },
    output: {
      channel: "terminal",
      format: "cleared output",
      description: "Removes all rendered terminal output lines."
    },
    effects: [
      "Clears the terminal output DOM.",
      "Resets the live command input visibility and scroll position."
    ],
    remarks: ["This affects only the terminal view and does not clear command history or environment values."],
    examples:  ["oTERM.clear()"]
  };

  this.idle = function () 
  {
    this._o.state.idle = !this._o.state.idle;
    if(this._o.state.idle)
    {
      this._o.DOM.command.classList.add("idle");
      this._o.DOM.prompt.innerHTML = '<div class="spinner"></div>';
    }
    else
    {
      this._o.DOM.command.classList.remove("idle");
      this._o.DOM.prompt.innerHTML = this._o.shell.prompt + this._o.shell.separator;
      this._o.DOM.input.focus();
    }

  };
   this.idle.help = 
   {
     type: "TERMINAL_Fn",
     syntax: "idle()",
    summary: "Toggle the terminal busy state.",
    returns: {
      type: "void",
      description: "No JavaScript value is returned."
    },
    output: {
      channel: "terminal",
      format: "prompt state",
      description: "Shows a spinner while busy and restores the normal prompt when toggled back."
    },
    effects: [
      "Toggles oTERM._o.state.idle.",
      "Switches the prompt between busy and interactive modes.",
      "Refocuses the input when returning to interactive mode."
    ],
    remarks: [
      "Call a second time to return the terminal to the available state."
    ],
     examples: ["oTERM.idle();"]    
   }

  this.input = function (varName, question, prefill, overwriteMode)
  {
    const key = String(varName || "").trim();
    if (!key) throw new Error("input(varName,question,\nprefill,overwriteMode): varName is required");

    // push current prompt and show the question as the new prompt
    this.pushPrompt(String(question ?? key), { separator: this._o.shell.separator, render: true });

    this._o.state.prompt = true;
    this._o.state.overwrite = !!overwriteMode;

    const self = this;
    this.onAskCallback = function(ans) {
      self._o.env[key] = ans;
    };

    if (prefill !== undefined && prefill !== null) {
      resetCommand(String(prefill));
      this._o.DOM.command.classList.add("input");
      this._o.DOM.input.focus();
      if (this._o.state.overwrite) {
        try { this._o.DOM.input.setSelectionRange(0,0); } catch(_) {}
      }
    } else {
      this._o.DOM.input.focus();
    }
  };
  this.input.help = 
  {
      type: "TERMINAL_Fn",
      syntax: "input(<varName>,<question>\n,[prefill],[overwriteMode])",
      summary: "Prompt the user and store the answer in oTERM._o.env[varName].",
      returns: {
        type: "void",
        description: "No JavaScript value is returned."
      },
      output: {
        channel: "terminal",
        format: "interactive prompt",
        description: "Shows the supplied question as the active prompt and waits for the next submitted line."
      },
      effects: [
        "Pushes the current prompt onto the prompt stack.",
        "Enables prompt mode for the next Enter key submission.",
        "Stores the answer in oTERM._o.env[varName]."
      ],
      parameters: [
        { name: "<varName>", description: "Environment variable name used to store the answer." },
        { name: "<question>", description: "Prompt text shown while waiting for the answer." },
        { name: "[prefill]", description: "Optional initial input value inserted into the live command line." },
        { name: "[overwriteMode]", description: "Optional flag enabling terminal-like overwrite editing while prompting." }
      ],
      remarks: [
        "overwriteMode=true enables terminal-like overwrite editing instead of pure insert behavior."
      ],
      examples: [
        "oTERM.input(\"label\",\"Enter\",\"1234\",false)",
        "oTERM.input(\"label\",\"Enter\",\"1234\",true)"
      ]
  }

  this.getenv = function(key) 
  {
    return this._o.env ? this._o.env[String(key)] : undefined;
  };

  this.setenv = function(key, value) 
  {
    if (!this._o.env) this._o.env = {};
    this._o.env[String(key)] = value;
  };

  this.onInput = function (callback)
  {
    this.onInputCallback = callback;
  };

  this.output = function (html) 
  {
    if (html === undefined) html = "&nbsp;";
    this._o.DOM.output.insertAdjacentHTML("beforeEnd", "<span>" + html + "</span>");
    resetCommand();
  };

  this.write = function(text, channel)
  {
    text = String(text === undefined ? "" : text);
    if (!text.length) return null;

    var cls = "serial-stream" + (channel ? " serial-" + String(channel) : "");
    var last = this._o.DOM.output.lastElementChild;
    var span;

    if (last && last.tagName === "SPAN" && last.className === cls)
    {
      span = last;
    }
    else
    {
      span = document.createElement("span");
      span.className = cls;
      this._o.DOM.output.appendChild(span);
    }

    span.appendChild(document.createTextNode(text));
    resetCommand();
    return span;
  };
  this.write.help =
  {
    type: "TERMINAL_Fn",
    syntax: "write(<text>,[channel])",
    summary: "Append literal streaming text to the terminal without interpreting it as HTML.",
    returns: {
      type: "HTMLElement|null",
      description: "Returns the stream span used for the text, or null for empty input."
    },
    output: {
      channel: "terminal",
      format: "literal streaming text",
      description: "Appends text while preserving whitespace and line breaks."
    },
    parameters: [
      { name: "<text>", description: "Literal text to append." },
      { name: "[channel]", description: "Optional channel class suffix such as rx, tx, or meta." }
    ],
    remarks: [
      "Consecutive writes to the same channel are coalesced into one stream span.",
      "The text is appended as a DOM text node and cannot inject HTML."
    ],
    examples: [
      "oTERM.write(\"HELLO\\r\\n\",\"rx\")"
    ]
  };

  this.print = function(obj,fmt)
  {
    var s = "";
    if(fmt=="array")
    {
      var cnt = 0;
      for(var i in obj) { s+= obj[i].toString()+(cnt%16==15?"\n,":","); cnt++ }
      s = s.substring(0,s.length-1);
      this.output("<pre>"+oCOM.escapeHTML("["+s+"]")+"</pre>");
      return;
    }

    if(fmt=="array_hex")
    {
      var cnt = 0;
      for(var i in obj) { s+= "0x"+obj[i].toString(16).toUpperCase()+(cnt%16==15?"\n,":","); cnt++ }
      s = s.substring(0,s.length-1);
      this.output("<pre>"+oCOM.escapeHTML("["+s+"]")+"</pre>");
      return;
    }

    if(fmt=="literal")
    {
      var s = obj.toString().replace(/\"/g,"\\\"").replace(/\n/g,"\\n\"\n+\"");
      this.output("<pre>\""+oCOM.escapeHTML(s)+"\"</pre>");
      return;
    }

    if(fmt=="html")
    {
      var s = obj.toString()
      this.output(s);
      return;
    }

    if(fmt=="URL")
    {
      var s = obj.toString()
      this.output("<pre><a href="+s+" target=_blank>URL</a></pre>");
      return;
    }

    s = String(obj ?? "");
    // If it looks like "grid text" (newlines or leading/trailing spaces), render in <pre>
    if (s.includes("\n") || /^\s/.test(s) || /\s$/.test(s)) {
      // Use existing escape helper to avoid HTML injection and keep raw grid text intact
      this.output("<pre>" + escapeHtml(s) + "</pre>");
    } else {
      this.output(s);
    }
  }
  this.print.help = 
  {
    type: "TERMINAL_Fn",
    syntax: "print(<obj>,[fmt])",
    summary: "Format a value and write it to the terminal.",
    returns: {
    type: "void",
    description: "No JavaScript value is returned."
    },
    output: {
      channel: "terminal",
      format: "plain text|preformatted text|HTML",
      description: "Writes the formatted value to the terminal output."
    },
    effects: [
      "Appends a new terminal output line."
    ],
    parameters: [
      { name: "<obj>", description: "Value to format and print." },
      { name: "[fmt]", description: "Optional formatter: array, array_hex, literal, html, or URL." }
    ],
    remarks: [
      "Without a formatter, multiline or space-sensitive strings are wrapped in <pre> output.",
      "fmt=\"html\" writes the string directly as HTML."
    ],
    examples: ["oTERM.print(\"DONE\")","oTERM.print([0,1,2,3,4],\"array\")","oTERM.print([0,1,2,3,4],\"array_hex\")"]    
  }

  this.printJSON = function(obj)
  {
    this.output(formatForOutput(obj));

      function formatForOutput(v) 
      {
        // already HTML/string: keep as-is
        if (typeof v === "string") return v;

        if (typeof v === "array") return "["+v.join(",")+"]";

        if (v instanceof Uint8Array === "array") return "["+v.join(",")+"]";


        // null/undefined
        if (v == null) return String(v); // \"null\" / \"undefined\"

        // Error objects
        if (v instanceof Error) {
          const msg = v.stack || v.message || String(v);
          return "<pre>" + escapeHtml(msg) + "</pre>";
        }

        // Try JSON pretty print for objects/arrays
        if (typeof v === "object") {
          try {
            return "<pre>" + escapeHtml(JSON.stringify(v, null, 2)) + "</pre>";
          } catch (e) {
            // circular or non-serializable
            return "<pre>" + escapeHtml(String(v)) + "</pre>";
          }
        }

        // numbers, booleans, symbols, functions
        return "<pre>" + escapeHtml(String(v)) + "</pre>";
      }

      function escapeHtml(s) {
        return String(s).replace(/[&<>\"']/g, (ch) => {
          switch (ch) {
            case "&": return "&amp;";
            case "<": return "&lt;";
            case ">": return "&gt;";
            case '"': return "&quot;";
            case "'": return "&#39;";
            default: return ch;
          }
        });
      }
  }
  this.printJSON.help = 
  {
    type: "TERMINAL_Fn",
    syntax: "printJSON(<obj>)",
    summary: "Pretty-print a value as JSON-like terminal output.",
    returns: {
      type: "void",
      description: "No JavaScript value is returned."
    },
    output: {
      channel: "terminal",
      format: "formatted JSON",
      description: "Writes the value as pretty-printed JSON inside preformatted terminal output."
    },
    effects: [
      "Appends a new terminal output line."
    ],
    parameters: [
      { name: "<obj>", description: "Value to format for terminal display." }
    ],
    remarks: [
      "Error objects are rendered from stack or message text.",
      "Non-serializable objects fall back to their string representation."
    ],
     examples: ["oTERM.printJSON({so:true})"]    
   }

  this.pushPrompt = function(newPrompt, opts)
  {
    opts = opts || {};
    const render = (opts.render !== false);
    const sep = (opts.separator !== undefined) ? String(opts.separator) : this._o.shell.separator;

    window.__dbg?.("pushPrompt:before", {
      cur: this._o.shell?.prompt,
      stack: this._o.promptStack?.length,
      newPrompt,
      opts
    });

    if (!opts.replace)
      this._o.promptStack.push({ prompt: this._o.shell.prompt, separator: this._o.shell.separator });

    this._o.shell = { prompt: String(newPrompt ?? ""), separator: sep };
    this._o.state.idle = false;
    this._o.DOM.command.classList.remove("idle");

    if (render) {
      this._o.DOM.prompt.innerHTML = this._o.shell.prompt + this._o.shell.separator;
      this._o.DOM.input.focus();
    }

    window.__dbg?.("pushPrompt:after", {
      cur: this._o.shell?.prompt,
      stack: this._o.promptStack?.length
    });
  }
  this.pushPrompt.help = 
  {
    type: "TERMINAL_Fn",
    syntax: "pushPrompt(<newPrompt>,[opts])",
    summary: "Push the current prompt onto the prompt stack and replace it with a new prompt.",
    returns: {
      type: "void",
      description: "No JavaScript value is returned."
    },
    output: {
      channel: "terminal",
      format: "prompt state",
      description: "Updates the visible prompt unless opts.render is false."
    },
    effects: [
      "Pushes the current prompt and separator onto oTERM._o.promptStack unless opts.replace is true.",
      "Replaces the active prompt configuration."
    ],
    parameters: [
      { name: "<newPrompt>", description: "Prompt label to make active." },
      { name: "[opts]", description: "Optional configuration object supporting separator, render, and replace." }
    ],
    remarks: [
      "Use opts.replace=true to avoid pushing the previous prompt onto the stack."
    ],
      examples: ["oTERM.pushPrompt(\"CADScript\")"]    
  }

  this.popPrompt = function(opts)
  {
    opts = opts || {};
    const render = (opts.render !== false);

    window.__dbg?.("popPrompt:before", {
      cur: this._o.shell?.prompt,
      stack: this._o.promptStack?.length,
      opts
    });

    if (!this._o.promptStack || this._o.promptStack.length === 0) {
      if (render) {
        this._o.DOM.command.classList.remove("idle");
        this._o.DOM.prompt.innerHTML = this._o.shell.prompt + this._o.shell.separator;
        this._o.DOM.input.focus();
      }
      return null;
    }

    const prev = this._o.promptStack.pop();
    this._o.shell = { prompt: prev.prompt, separator: prev.separator };
    this._o.state.idle = false;
    this._o.DOM.command.classList.remove("idle");

    if (render) {
      this._o.DOM.prompt.innerHTML = this._o.shell.prompt + this._o.shell.separator;
      this._o.DOM.input.focus();
    }

    window.__dbg?.("popPrompt:after", {
      cur: this._o.shell?.prompt,
      stack: this._o.promptStack?.length,
      popped: prev
    });

    return prev;
  }
  this.popPrompt.help = 
  {
      type: "TERMINAL_Fn",
      syntax: "popPrompt([opts])",
      summary: "Restore the previous prompt from the prompt stack.",
      returns: {
        type: "object|null",
        description: "Returns the restored prompt object, or null when the prompt stack is empty."
      },
      output: {
        channel: "terminal",
        format: "prompt state",
        description: "Updates the visible prompt unless opts.render is false."
      },
      effects: [
        "Pops one prompt record from oTERM._o.promptStack when available.",
        "Restores the active prompt configuration."
      ],
      parameters: [
        { name: "[opts]", description: "Optional configuration object supporting render." }
      ],
      remarks: [
        "When the prompt stack is empty, the current prompt remains active and null is returned."
      ],
      examples: ["oTERM.popPrompt()"]    
   }

  this.help = function(topic)
  {
    topic = topic === undefined || topic === null ? "" : String(topic).trim();

    function html(s) { return escapeHtml(String(s === undefined ? "" : s)); }

    if (!topic)
    {
      var names = [];
      for (var key in self)
      {
        if (typeof self[key] === "function" && self[key].help)
          names.push(key);
      }
      names.sort();

      var rows = ["<b>Terminal API</b>"];
      for (var i=0;i<names.length;i++)
      {
        var h = self[names[i]].help || {};
        rows.push("<u>" + html(names[i]) + "</u> - " + html(h.summary || ""));
      }
      self.output(rows.join("<br>"));
      return names;
    }

    var fn = self[topic];
    if (typeof fn !== "function" || !fn.help)
    {
      self.output("[ERROR] No help is available for " + html(topic));
      return null;
    }

    var h = fn.help;
    var out = [];
    if (h.syntax) out.push("<b>" + html(h.syntax) + "</b>");
    if (h.summary) out.push(html(h.summary));

    if (Array.isArray(h.parameters) && h.parameters.length)
    {
      out.push("<br><u>Parameters</u>");
      for (var p=0;p<h.parameters.length;p++)
        out.push(html(h.parameters[p].name) + " - " + html(h.parameters[p].description));
    }

    if (Array.isArray(h.remarks) && h.remarks.length)
    {
      out.push("<br><u>Remarks</u>");
      for (var r=0;r<h.remarks.length;r++)
        out.push("- " + html(h.remarks[r]));
    }

    if (Array.isArray(h.examples) && h.examples.length)
    {
      out.push("<br><u>Examples</u>");
      for (var e=0;e<h.examples.length;e++)
        out.push("<code>" + html(h.examples[e]) + "</code>");
    }

    self.output(out.join("<br>"));
    return h;
  };
  this.help.help =
  {
    type: "TERMINAL_Fn",
    syntax: "help([topic])",
    summary: "Show self-help generated from the help metadata attached to terminal methods.",
    returns: {
      type: "object|array|null",
      description: "Returns the selected help descriptor, the list of documented methods, or null."
    },
    parameters: [
      { name: "[topic]", description: "Optional terminal method name." }
    ],
    examples: [
      "oTERM.help()",
      "oTERM.help(\"write\")"
    ]
  };

  // ---- listeners -----------------------------------------------------------

  /*
   * A browser text selection in <output> must be allowed to survive the
   * mouse/pointer release which completed it.  In particular, the resulting
   * click can be targeted at the surrounding terminal container when a drag
   * ends in whitespace rather than directly on a text node.  Refocusing the
   * command input at that point collapses the just-completed selection.
   *
   * Keep this helper in generic oTERM because it also governs the generic
   * MutationObserver auto-scroll below, not only the Serial Pro endpoint.
   */
  function outputSelectionActive()
  {
    if (typeof window.getSelection !== "function") return false;

    var selection = window.getSelection();
    if (!selection || selection.rangeCount < 1 || selection.isCollapsed)
      return false;

    var output = self._o.DOM.output;
    function inside(node)
    {
      if (!node) return false;
      if (node.nodeType === 3) node = node.parentNode;
      return node === output || output.contains(node);
    }

    return inside(selection.anchorNode) || inside(selection.focusNode);
  }

  // Auto-scroll when new output is appended.
  var observer = new MutationObserver(function () 
  {
    setTimeout(function () {
      // A live stream may continue below a user's selection.  Do not pull the
      // viewport back to the command line until that selection is released.
      if (outputSelectionActive()) return;
      self._o.DOM.input.scrollIntoView({ block: "nearest" });
    }, 0);
  });
  observer.observe(self._o.DOM.output, { childList: true, subtree: true });

  // Focus handling: focus the input when clicking inside the terminal,
  // but do NOT steal focus when selecting/copying text in the output.
  self._o.DOM.root.addEventListener(
    "click",
    function (ev) {
      // Ignore clicks outside the terminal root
      if (!self._o.DOM.root.contains(ev.target)) return;

      // Don't steal focus when the user is interacting with the output area.
      if (self._o.DOM.output.contains(ev.target)) return;

      // A selection drag may finish over terminal whitespace, in which case
      // the click target is the container rather than <output>.  The browser
      // selection is already complete by click time; preserve it instead of
      // focusing the input and collapsing the selected range.
      if (outputSelectionActive()) return;

      self._o.DOM.input.focus();
    },
    false
  );

  self._o.DOM.command.addEventListener(
    "click",
    function () {
      if (outputSelectionActive()) return;
      self._o.DOM.input.focus();
    },
    false
  );

  // Do not stop keydown/keyup during the capture phase.  A capture listener
  // can prevent the terminal's normal target listener from running in some
  // browser event implementations.  The handlers above isolate the event
  // after they have received it instead.
  this._o.DOM.input.addEventListener("keyup", handleKeyUp, false);
  this._o.DOM.input.addEventListener("keydown", handleKeyDown, false);
  this._o.DOM.input.addEventListener("keypress", function(event){ event.stopPropagation(); }, false);

  // ---- initial output ------------------------------------------------------

  if (welcome) this.output(welcome);
};
