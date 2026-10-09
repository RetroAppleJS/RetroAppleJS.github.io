// Reusable port console. Device contracts supply all peripheral-specific help.
function EMU_PORT_SCRIPT(cfg)
{
    var component = this;
    var container = typeof(cfg.container)==="string"
        ? document.getElementById(cfg.container) : cfg.container;
    var storageKey = cfg.storageKey || "";
    var state = {source:cfg.source || "// Remote endpoint: send bytes to the emulated device.\nawait port.write(\"HELLO\\r\");\nlog(\"Bytes queued\");",split:50};
    var session = null;
    var destroyed = false;
    var observer = null;

    this.port = cfg.port;
    this.contract = cfg.api || {};
    this.console = cfg.console || null;
    this.consoleContract = cfg.consoleAPI || {};
    this.isRunning = false;

    if(!container || !this.port) throw new Error("Port Script requires a container and port facade");
    try
    {
        var saved = storageKey && localStorage.getItem(storageKey);
        if(saved)
        {
            saved = JSON.parse(saved);
            if(typeof(saved.source)==="string") state.source = saved.source;
            if(Number.isFinite(saved.split)) state.split = Math.max(20,Math.min(80,saved.split));
        }
    }
    catch(ignore) {}

    function save()
    {
        state.source = component.editor.value;
        try { if(storageKey) localStorage.setItem(storageKey,JSON.stringify(state)); }
        catch(ignore) {}
    }

    function element(tag,className,text)
    {
        var node = document.createElement(tag);
        if(className) node.className = className;
        if(text!==undefined) node.textContent = text;
        return node;
    }

    function button(title,icon,attribute,action)
    {
        var node = element("button","appbut skinny");
        node.type = "button";
        node.title = title;
        node.setAttribute("aria-label",title);
        node.setAttribute(attribute,"");
        node.appendChild(element("i",icon));
        node.onclick = action;
        return node;
    }

    function setSplit(value)
    {
        state.split = Math.max(20,Math.min(80,value));
        component.pane.style.flexBasis = state.split+"%";
        component.divider.setAttribute("aria-valuenow",String(Math.round(state.split)));
        save();
    }

    function appendLog(values)
    {
        var text = values.map(function(value)
        {
            if(typeof(value)==="string") return value;
            if(ArrayBuffer.isView(value)) return JSON.stringify(Array.from(value));
            try
            {
                var serialized = JSON.stringify(value);
                return serialized===undefined ? String(value) : serialized;
            }
            catch(ignore) { return String(value); }
        }).join(" ");
        try
        {
            if(component.console)
            {
                var written = component.console.write(text+"\n","meta");
                if(written && typeof(written.catch)==="function")
                    written.catch(function(failure) { console.error("Script console output failed",failure); });
            }
            else console.log(text);
        }
        catch(failure) { console.error("Script console output failed",failure); }
    }

    function updateExecutionButton()
    {
        var running = component.isRunning;
        var control = component.runButton;
        control.disabled = destroyed;
        control.title = running ? "Stop script" : "Run script";
        control.setAttribute("aria-label",control.title);
        control.children[0].className = running ? "fa fa-stop" : "fa fa-play";
        control.removeAttribute(running ? "data-port-script-run" : "data-port-script-stop");
        control.setAttribute(running ? "data-port-script-stop" : "data-port-script-run","");
    }

    function finish(status,failure)
    {
        var run = session;
        if(!run) return;
        session = null;
        run.abort.abort();
        run.subscriptions.forEach(function(off) { off(); });
        if(run.worker) run.worker.terminate();
        if(run.url) URL.revokeObjectURL(run.url);
        component.isRunning = false;
        updateExecutionButton();
        component.status.textContent = status;
        if(failure) appendLog([failure.name+": "+failure.message]);
        run.resolve({status:status,error:failure || null});
    }

    this.build = function()
    {
        var root = element("div","emu_port_script_split");
        var pane = element("section","emu_port_script");
        var toolbar = element("div","emu_port_script_toolbar");
        toolbar.appendChild(element("span","emu_port_script_title",cfg.title || "PORT SCRIPT"));
        this.status = element("span","emu_port_script_status","ready");
        this.status.setAttribute("role","status");
        toolbar.appendChild(this.status);
        toolbar.appendChild(button("Port and console API","fa fa-info-circle","data-port-script-api",function() { component.showAPI(); }));
        this.runButton = button("Run script","fa fa-play","data-port-script-run",function()
        {
            if(component.isRunning) component.stop();
            else component.run();
        });
        toolbar.appendChild(this.runButton);
        toolbar.appendChild(button("Clear script source","fa fa-trash","data-port-script-clear",function() { component.clear(); }));
        if(typeof(cfg.onClose)==="function")
            toolbar.appendChild(button("Close port console","fa fa-times","data-port-script-close",cfg.onClose));
        this.toolbar = toolbar;
        this.editor = element("textarea","emu_port_script_editor");
        this.editor.value = state.source;
        this.editor.spellcheck = false;
        this.editor.wrap = "off";
        this.editor.setAttribute("aria-label","JavaScript port script");
        this.editor.oninput = save;
        this.editor.onkeydown = function(event)
        {
            if(event.key==="Enter" && (event.ctrlKey || event.metaKey))
            { event.preventDefault(); component.run(); }
            if(event.key==="Tab")
            {
                event.preventDefault();
                this.setRangeText("    ",this.selectionStart,this.selectionEnd,"end");
                save();
            }
        };
        this.help = element("div","emu_port_script_api");
        this.help.hidden = true;
        pane.appendChild(toolbar);
        pane.appendChild(this.editor);
        pane.appendChild(this.help);
        root.appendChild(pane);
        this.root = root;
        this.pane = pane;
        if(cfg.lowerPane)
        {
            this.divider = element("div","emu_port_script_divider");
            this.divider.tabIndex = 0;
            this.divider.setAttribute("role","separator");
            this.divider.setAttribute("aria-label","Script and terminal divider");
            this.divider.setAttribute("aria-orientation","horizontal");
            this.divider.setAttribute("aria-valuemin","20");
            this.divider.setAttribute("aria-valuemax","80");
            this.divider.onkeydown = function(event)
            {
                if(event.key!=="ArrowUp" && event.key!=="ArrowDown") return;
                event.preventDefault();
                setSplit(state.split+(event.key==="ArrowUp" ? -5 : 5));
            };
            this.divider.onpointerdown = function(event)
            {
                if(event.button!==0) return;
                event.preventDefault();
                this.setPointerCapture(event.pointerId);
                this._dragging = true;
            };
            this.divider.onpointermove = function(event)
            {
                if(!this._dragging) return;
                var rect = root.getBoundingClientRect();
                if(rect.height>0) setSplit(100*(event.clientY-rect.top)/rect.height);
            };
            this.divider.onpointerup = this.divider.onlostpointercapture = function()
            { this._dragging = false; };
            root.appendChild(this.divider);
            cfg.lowerPane.classList.add("emu_port_script_lower");
            root.appendChild(cfg.lowerPane);
        }
        container.replaceChildren(root);
        if(this.divider) setSplit(state.split);
        else pane.style.flex = "1 1 auto";
    };

    this.run = function(source)
    {
        if(destroyed) return Promise.resolve({status:"error",error:{message:"Console is closed"}});
        if(session) return session.promise;
        if(source!==undefined) this.editor.value = String(source);
        save();
        var run = {abort:new AbortController(),subscriptions:new Map(),worker:null,url:null};
        run.promise = new Promise(function(resolve) { run.resolve = resolve; });
        session = run;
        this.isRunning = true;
        updateExecutionButton();
        this.status.textContent = "running";
        try
        {
            run.url = URL.createObjectURL(new Blob(["("+EMU_PORT_SCRIPT.workerMain.toString()+")();"],{type:"text/javascript"}));
            run.worker = new Worker(run.url);
            run.worker.onerror = function(event)
            {
                event.preventDefault();
                if(session===run) finish("error",{name:"WorkerError",message:event.message});
            };
            run.worker.onmessage = async function(event)
            {
                if(session!==run) return;
                var message = event.data;
                if(message.type==="log") { appendLog(message.values); return; }
                if(message.type==="done") { finish("complete"); return; }
                if(message.type==="error") { finish("error",message.error); return; }
                if(message.type==="subscribe")
                {
                    try
                    {
                        var off = component.port.onReceive(function(bytes)
                        {
                            if(session===run) run.worker.postMessage({type:"receive",id:message.id,bytes:bytes});
                        });
                        run.subscriptions.set(message.id,off);
                    }
                    catch(failure) { finish("error",{name:failure.name,message:failure.message}); }
                    return;
                }
                if(message.type==="unsubscribe")
                {
                    var unsubscribe = run.subscriptions.get(message.id);
                    if(unsubscribe) unsubscribe();
                    run.subscriptions.delete(message.id);
                    return;
                }
                if(message.type!=="call") return;
                try
                {
                    var target = message.target==="terminal" ? component.console : component.port;
                    var contract = message.target==="terminal" ? component.consoleContract : component.contract;
                    if(!target || !Object.prototype.hasOwnProperty.call(contract.METHODS || {},message.method)
                        || typeof(target[message.method])!=="function" || message.method==="onReceive")
                        throw new Error("Unknown script API method");
                    var args = message.args;
                    var abortArgument = contract.METHODS[message.method].abortArgument;
                    if(Number.isInteger(abortArgument))
                    {
                        args = args.slice();
                        args[abortArgument] = run.abort.signal;
                    }
                    var result = await target[message.method].apply(target,args);
                    if(session===run) run.worker.postMessage({type:"result",id:message.id,value:result});
                }
                catch(failure)
                {
                    if(session===run) run.worker.postMessage({type:"result",id:message.id,error:{name:failure.name,message:failure.message}});
                }
            };
            run.worker.postMessage({type:"start",source:this.editor.value,
                methods:Object.keys(this.contract.METHODS || {}),
                consoleMethods:this.console ? Object.keys(this.consoleContract.METHODS || {}) : []});
        }
        catch(failure) { finish("error",{name:failure.name,message:failure.message}); }
        return run.promise;
    };

    this.stop = function()
    {
        finish("stopped");
    };

    this.loadSource = function(source)
    {
        if(destroyed) return false;
        this.editor.value = String(source);
        this.help.hidden = true;
        this.editor.hidden = false;
        if(!this.isRunning) this.status.textContent = "ready";
        save();
        this.editor.focus();
        return true;
    };

    this.clear = function()
    {
        return this.loadSource("");
    };

    this.showAPI = function()
    {
        this.help.hidden = !this.help.hidden;
        this.editor.hidden = !this.help.hidden;
        if(this.help.hidden) return;
        this.help.replaceChildren();
        [this.contract,this.consoleContract].forEach(function(contract)
        {
            if(!contract.NAME) return;
            component.help.appendChild(element("h4","",contract.NAME));
            component.help.appendChild(element("p","",contract.DESCRIPTION || ""));
            [contract.METHODS,contract.EVENTS].forEach(function(items)
            {
                Object.keys(items || {}).forEach(function(key)
                {
                    var item = items[key];
                    component.help.appendChild(element("code","",item.signature || key));
                    component.help.appendChild(element("p","",item.description || ""));
                });
            });
        });
        this.help.appendChild(element("code","","sleep(ms) · log(...) · hex(value, width=2)"));
        this.help.appendChild(element("p","","Await port/terminal calls. log() and script errors report to the terminal below; terminal.write() or console.write() reports there too. Stop terminates the worker and pending waits. Ctrl/Cmd-Enter runs. The script trashcan clears the source; the terminal trashcan clears the transcript."));
    };

    this.destroy = function()
    {
        if(destroyed) return;
        save();
        destroyed = true;
        this.stop();
        if(observer) observer.disconnect();
        if(typeof(this.port.dispose)==="function") this.port.dispose();
        this.root.remove();
    };

    this.build();
    // Popup hiding via any existing close/scope path ends a run, but preserves
    // the live facade and editor for reopening. No popup-manager changes needed.
    if(cfg.visibilityElement)
    {
        observer = new MutationObserver(function()
        {
            if(cfg.visibilityElement.hidden) component.stop();
        });
        observer.observe(cfg.visibilityElement,{attributes:true,attributeFilter:["hidden"]});
    }
}

EMU_PORT_SCRIPT.workerMain = function()
{
    var pending = new Map();
    var callbacks = new Map();
    var nextID = 0;

    function failure(error)
    {
        self.postMessage({type:"error",error:{name:error.name || "Error",message:error.message || String(error)}});
    }

    function call(target,method,args)
    {
        var id = ++nextID;
        var promise = new Promise(function(resolve,reject)
        {
            pending.set(id,{resolve:resolve,reject:reject});
            self.postMessage({type:"call",target:target,method:method,args:args,id:id});
        });
        pending.get(id).promise = promise;
        return promise;
    }

    self.addEventListener("unhandledrejection",function(event)
    { event.preventDefault(); failure(event.reason); });

    self.onmessage = async function(event)
    {
        var message = event.data;
        if(message.type==="result")
        {
            var request = pending.get(message.id);
            if(!request) return;
            pending.delete(message.id);
            if(message.error)
            {
                var error = new Error(message.error.message);
                error.name = message.error.name;
                request.reject(error);
            }
            else request.resolve(message.value);
            return;
        }
        if(message.type==="receive")
        {
            var callback = callbacks.get(message.id);
            if(callback)
            {
                try { await callback(message.bytes); } catch(error) { failure(error); }
            }
            return;
        }
        if(message.type!=="start") return;
        try
        {
            var port = Object.create(null);
            var terminal = Object.create(null);
            message.methods.forEach(function(method)
            {
                if(method!=="onReceive") port[method] = function()
                { return call("port",method,Array.from(arguments)); };
            });
            if(message.methods.indexOf("onReceive")>=0)
            {
                port.onReceive = function(callback)
                {
                    if(typeof(callback)!=="function") throw new TypeError("Callback must be a function");
                    var id = ++nextID;
                    callbacks.set(id,callback);
                    self.postMessage({type:"subscribe",id:id});
                    return function()
                    {
                        callbacks.delete(id);
                        self.postMessage({type:"unsubscribe",id:id});
                    };
                };
            }
            message.consoleMethods.forEach(function(method)
            {
                terminal[method] = function() { return call("terminal",method,Array.from(arguments)); };
            });
            var log = function() { self.postMessage({type:"log",values:Array.from(arguments)}); };
            var sleep = function(ms)
            {
                if(!Number.isFinite(ms) || ms<0 || ms>2147483647) throw new RangeError("Invalid sleep duration");
                return new Promise(function(resolve) { setTimeout(resolve,ms); });
            };
            var hex = function(value,width)
            {
                if(width===undefined) width = 2;
                if(!Number.isSafeInteger(value) || value<0 || !Number.isInteger(width) || width<1 || width>16)
                    throw new RangeError("hex expects a non-negative integer and width 1..16");
                return "$"+value.toString(16).toUpperCase().padStart(width,"0");
            };
            Object.freeze(port);
            Object.freeze(terminal);
            var AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            await new AsyncFunction("port","terminal","console","sleep","log","hex",
                '"use strict";\n'+message.source)(port,terminal,terminal,sleep,log,hex);
            // Honor fire-and-forget RPC writes before completion tears down the
            // worker. Await remains recommended for errors and explicit order.
            await Promise.all(Array.from(pending.values()).map(function(request) { return request.promise; }));
            self.postMessage({type:"done"});
        }
        catch(error) { failure(error); }
    };
};
