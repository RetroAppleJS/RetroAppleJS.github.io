(function(g){
'use strict';

var D=g.document||null,term=null,armed=false,arming=false,callback=null,inCallback=false,haltRequested=false;

function E(id){return D&&D.getElementById?D.getElementById(id):null}
function DBG(){return g.oEMU&&g.oEMU.component&&g.oEMU.component.CPU?g.oEMU.component.CPU.Apple2Debug:null}
function M(){var m=g.apple2plus;if(!m||!m.cpuObj||!m.hwObj)throw Error('Live Apple II runtime is not available.');return m}
function C(){var c=M().cpuObj();if(!c||!c.watch)throw Error('Live 6502 state API is not available.');return c}
function W(){var h=M().hwObj();if(!h||!h.safe_read||!Array.isArray(h.WR)||!h.lineDecode)throw Error('Live mapped-memory API is not available.');return h}
function H(v,w){w=w||2;var mask=w<=2?255:65535;return '$'+('000000000000'+((Number(v)||0)&mask).toString(16).toUpperCase()).slice(-w)}
function num(s){s=String(s==null?'':s).trim();if(/^\$[\da-f]+$/i.test(s))return parseInt(s.slice(1),16);if(/^0x[\da-f]+$/i.test(s))return parseInt(s,16);if(/^\d+$/.test(s))return parseInt(s,10);return null}
function out(t,ch){t=String(t==null?'':t);if(term&&term.write)term.write(t+(t.endsWith('\n')?'':'\n'),ch||'host');else{var f=E('DBG_steptraceConsoleFallback');if(f){f.value+=t+(t.endsWith('\n')?'':'\n');f.scrollTop=f.scrollHeight}else if(g.console&&g.console.log)g.console.log(t)}}
function bytes(v){
  if(v instanceof Uint8Array)return new Uint8Array(v);
  if(Array.isArray(v))return Uint8Array.from(v.map(function(x){return Number(x)&255}));
  if(typeof v==='number')return Uint8Array.of(v&255);
  var s=String(v==null?'':v).trim();if(!s)return new Uint8Array(0);
  return Uint8Array.from(s.split(/[\s,;]+/).filter(Boolean).map(function(t){
    if(/^\$[\da-f]+$/i.test(t))return parseInt(t.slice(1),16)&255;
    if(/^0x[\da-f]+$/i.test(t))return parseInt(t,16)&255;
    if(/^[\da-f]{1,2}$/i.test(t))return parseInt(t,16)&255;
    if(/^\d+$/.test(t))return parseInt(t,10)&255;
    throw Error("Invalid byte '"+t+"'.");
  }));
}
function symValue(name){var d=DBG();return d&&typeof d.resolveSymbol==='function'?d.resolveSymbol(name):null}
function adr(v){
  if(typeof v==='number')return v&65535;
  var s=String(v==null?'':v).trim(),n=num(s);if(n!==null)return n&65535;
  var m=/^(.*?)\s*([+-])\s*(\$[\da-f]+|0x[\da-f]+|\d+)$/i.exec(s);
  if(m){var base=symValue(m[1].trim()),delta=num(m[3]);if(base!==null&&delta!==null)return(base+(m[2]==='-'?-delta:delta))&65535}
  n=symValue(s);if(n!==null)return n&65535;
  throw Error("Unknown STEP TRACE symbol/address '"+s+"'.");
}
function rb(a){a&=65535;if(a>=0xc000&&a<0xc100)throw Error('STEP TRACE safe read masks Apple II I/O at '+H(a,4)+'.');var v=W().safe_read(a);if(v==null)throw Error('Mapped memory unreadable at '+H(a,4)+'.');return Number(v)&255}
function wb(a,v){a&=65535;v=Number(v)&255;if(a>=0xc000&&a<=0xcfff)throw Error('Scenario RAM injection refuses Apple II I/O/slot space '+H(a,4)+'.');var h=W(),f=h.WR[h.lineDecode(a)];if(typeof f!=='function')throw Error('Mapped memory not writable at '+H(a,4)+'.');f(a,v);if((a<0xc000||a>=0xc100)&&rb(a)!==v)throw Error('Write did not stick at '+H(a,4)+'.');return v}
function state(){var s=C().watch();return{pc:+s.pc&65535,a:+s.a&255,x:+s.x&255,y:+s.y&255,sp:+s.sp&255,p:+s.p&255,cycle_delay:+s.cycle_delay|0,ic:Math.max(0,Math.floor(+s.ic||0))}}
function syncButton(){
  var b=E('DBG_steptraceRunButton');if(!b)return;
  b.setAttribute('aria-pressed',armed?'true':'false');
  b.title=armed?'RUN script at breakpoint — execute scenario callback and continue':'HALT at breakpoint — BREAK IF pauses execution';
  b.innerHTML=armed?'<i class="fa fa-sign-in-alt"></i> RUN script at breakpoint':'<i class="fa fa-pause"></i> HALT at breakpoint';
}
function clearAction(){var d=DBG();if(d&&typeof d.setBreakpointActionHandler==='function')d.setBreakpointActionHandler(null);armed=false;callback=null;syncButton();return true}
function onBreakpoint(fn){
  if(!arming)throw Error('onBreakpoint() is only valid while arming the scenario script.');
  if(typeof fn!=='function')throw TypeError('onBreakpoint() requires a function.');
  if(callback)throw Error('Scenario script may register exactly one onBreakpoint() callback.');
  callback=fn;return fn;
}
function haltAtBreakpoint(){if(!inCallback)throw Error('haltAtBreakpoint() is only valid inside onBreakpoint().');haltRequested=true;return true}
function dispatch(bp){
  if(!armed||typeof callback!=='function')return;
  haltRequested=false;inCallback=true;
  try{callback(bp)}catch(err){armed=false;var d=DBG();if(d&&d.setBreakpointActionHandler)d.setBreakpointActionHandler(null);out('ERROR breakpoint scenario — '+(err&&err.message?err.message:String(err))+(err&&err.stack?'\n'+err.stack:''),'error');syncButton();throw err}
  finally{inCallback=false}
  if(haltRequested){var dbg=DBG();armed=false;if(dbg&&dbg.setBreakpointActionHandler)dbg.setBreakpointActionHandler(null);syncButton();return{halt:true}}
}
function armScript(code){
  if(armed)return true;
  var d=DBG();if(!d||typeof d.setBreakpointActionHandler!=='function')throw Error('STEP TRACE breakpoint-action API is unavailable.');
  callback=null;arming=true;
  try{
    var ram=S.ram,cpu=S.cpu,assert=S.assert,sym=S.sym,symbol=S.symbol,symbols=S.symbols,print=S.print;
    eval(String(code||''));
  }catch(err){callback=null;out('ERROR arming breakpoint scenario — '+(err&&err.message?err.message:String(err))+(err&&err.stack?'\n'+err.stack:''),'error');throw err}
  finally{arming=false}
  if(typeof callback!=='function'){callback=null;throw Error('Scenario script must register exactly one onBreakpoint() callback.');}
  d.setBreakpointActionHandler(dispatch);armed=true;syncButton();return true;
}
function mode(){var d=DBG(),st=d&&typeof d.breakpointActionState==='function'?d.breakpointActionState():null;if(st&&!st.active&&armed){armed=false;callback=null}return armed?'run':'halt'}

var S={version:'0.3-breakpoint-scenario',hex:H,address:adr,bytes:bytes,print:function(){out([].slice.call(arguments).map(String).join(' '));return arguments[arguments.length-1]}};
S.ram={
  read:function(a,n){a=adr(a);n=n==null?1:Math.max(0,+n|0);if(n===1)return rb(a);var x=new Uint8Array(n);for(var i=0;i<n;i++)x[i]=rb(a+i);return x},
  read16:function(a){a=adr(a);return rb(a)|(rb(a+1)<<8)},
  write:function(a,v){a=adr(a);var x=bytes(v);for(var i=0;i<x.length;i++)wb(a+i,x[i]);return x.length},
  load:function(a,v){return S.ram.write(a,v)},
  write16:function(a,v){a=adr(a);v=+v&65535;wb(a,v);wb(a+1,v>>8);return v},
  fill:function(a,n,v){a=adr(a);for(var i=0;i<(+n|0);i++)wb(a+i,v);return+n|0},
  dump:function(a,n,c){a=adr(a);n=Math.max(0,n==null?16:+n|0);c=Math.max(1,c==null?16:+c|0);var z=[];for(var o=0;o<n;o+=c){var r=[],q='';for(var i=0;i<Math.min(c,n-o);i++){var b=rb(a+o+i);r.push(('0'+b.toString(16).toUpperCase()).slice(-2));q+=b>=32&&b<127?String.fromCharCode(b):'.'}z.push(H(a+o,4)+'  '+r.join(' ')+'  '+q)}return z.join('\n')}
};
S.cpu={state:state};
S.assert=function(value,description){if(typeof value!=='boolean')throw TypeError('assert() requires a JavaScript boolean.');var text=String(description||'assertion');out((value?'PASS ':'FAIL ')+text,value?'result':'error');return value};
S.sym=function(name,fallback){var v=symValue(name);if(v!==null)return v;if(arguments.length>1)return fallback;var e=Error("Unknown STEP TRACE symbol '"+name+"'.");e.code='STB_UNKNOWN_SYMBOL';throw e};
S.symbol=function(name){var d=DBG();return d&&typeof d.symbol==='function'?d.symbol(name):null};
S.symbols=function(){var d=DBG();return d&&typeof d.symbols==='function'?d.symbols():[]};
S.onBreakpoint=onBreakpoint;S.haltAtBreakpoint=haltAtBreakpoint;S.arm=armScript;S.disarm=clearAction;S.mode=mode;

function evaluateEditor(code){try{return armScript(code)}catch(_){clearAction();return false}}
function rename(root){if(!root)return;var a=[root];if(root.querySelectorAll)a=a.concat([].slice.call(root.querySelectorAll('[id]')));a.forEach(function(n){if(n.id&&/^DBG_test/.test(n.id))n.id=n.id.replace(/^DBG_test/,'DBG_steptrace')})}
function loadExample(){var e=E('DBG_steptraceScript');if(!e)return;e.value="let vector = 0;\nonBreakpoint(function(bp) {\n  print('break', hex(bp.PC,4), 'hit', bp.hit);\n  if (++vector >= 3) haltAtBreakpoint();\n});";if(e.focus)e.focus()}
function initTerminal(){
  if(term||typeof g.TERMINAL!=='function'||!E('DBG_steptraceConsole'))return;
  try{
    term=new g.TERMINAL({container:'DBG_steptraceConsole',welcome:'STEP TRACE breakpoint scenario ready.',prompt:'ST',separator:'&gt;',storageKey:'RetroAppleJS.Debugger.StepTraceScenario',preserveWhitespace:true,allowEmptyInput:false});
    if(term&&typeof term.onInput==='function')term.onInput(function(){out('Use the scenario editor and HALT/RUN control.','host');return true});
  }catch(_){term=null}
}
var uiObserver=null,resizeBound=false;
function setTriggerState(open){var button=E('cpuDbg_scenario');if(!button)return;button.style.opacity=open?'1':'.45';button.setAttribute('aria-pressed',open?'true':'false')}
function companionPopup(){var p=E('DBG_steptraceScenarioPopup');if(p)return p;if(!D||!D.createElement)return null;p=D.createElement('div');p.id='DBG_steptraceScenarioPopup';p.className='toolbox';p.hidden=true;p.style.cssText='position:fixed;z-index:2000;';(D.body||D.documentElement).appendChild(p);return p}
function positionPopup(){var p=E('DBG_steptraceScenarioPopup'),d=E('cpuDbg_popup');if(!p||!d||p.hidden||!d.getBoundingClientRect)return false;var r=d.getBoundingClientRect();p.style.left=Math.round(r.right+4)+'px';p.style.top=Math.round(r.top)+'px';return true}
function buildPopup(){
  var p=companionPopup();if(!p)return false;if(E('DBG_steptracebenchBox')){syncButton();return true}var b=E('DBG_testbenchBox');if(!b||!b.cloneNode)return false;
  var q=b.cloneNode(true);rename(q);if(q.classList)q.classList.remove('appbox');var title=q.querySelector&&q.querySelector('.DBG_testbenchTitle');if(title)title.textContent='STEP TRACE SCENARIO';
  var header=q.querySelector&&q.querySelector('.DBG_testbenchHeader'),headerButtons=q.querySelector&&q.querySelector('.DBG_testbenchHeaderButtons');
  if(header&&D.createElement){var close=D.createElement('button');close.type='button';close.textContent='×';close.title='Close STEP TRACE scenario';close.style.cssText='float:right;margin-left:6px;padding:0 5px;font-size:11px';close.onclick=function(){S.ui.close()};(headerButtons||header).appendChild(close)}
  var ed=q.querySelector&&q.querySelector('#DBG_steptraceScript');if(ed){ed.value="let vector = 0;\nonBreakpoint(function(bp) {\n  print('break', hex(bp.PC,4), 'hit', bp.hit);\n  if (++vector >= 3) haltAtBreakpoint();\n});";ed.onkeydown=function(ev){if((ev.ctrlKey||ev.metaKey)&&ev.key==='Enter'&&!armed){ev.preventDefault();evaluateEditor(ed.value)}}}
  p.appendChild(q);initTerminal();
  var run=E('DBG_steptraceRunButton');if(run)run.onclick=function(){if(armed)clearAction();else{var x=E('DBG_steptraceScript');if(x)evaluateEditor(x.value)};syncButton()};
  var example=E('DBG_steptraceExampleButton');if(example)example.onclick=loadExample;
  var clear=E('DBG_steptraceClearConsoleButton');if(clear)clear.onclick=function(){if(term&&term.clear)term.clear();var f=E('DBG_steptraceConsoleFallback');if(f)f.value=''};
  var inj=E('DBG_steptraceRamInjectButton');if(inj)inj.onclick=function(){S.ram.write(E('DBG_steptraceRamAddress').value,E('DBG_steptraceRamData').value)};
  var rd=E('DBG_steptraceRamReadButton');if(rd)rd.onclick=function(){var a=E('DBG_steptraceRamAddress').value,n=parseInt(E('DBG_steptraceRamLength').value,10)||16;out(S.ram.dump(a,n))};
  syncButton();return true;
}
function installTrigger(){if(E('cpuDbg_scenario'))return true;var play=E('cpuDbg_play');if(!play||!play.parentNode||!D.createElement)return false;var button=D.createElement('i');button.id='cpuDbg_scenario';button.className='fa fa-code';button.setAttribute('role','button');button.setAttribute('aria-pressed','false');button.title='Open STEP TRACE scenario test script';button.style.cssText='font-size:11px;cursor:pointer;opacity:.45;margin-left:2px';button.onclick=function(){S.ui.toggle()};if(play.nextSibling)play.parentNode.insertBefore(button,play.nextSibling);else play.parentNode.appendChild(button);return true}
function init(){var ok=installTrigger();companionPopup();if(!resizeBound&&g.addEventListener){g.addEventListener('resize',positionPopup);resizeBound=true}return ok}
S.ui={init:init,open:function(){init();if(!buildPopup())return false;var p=E('DBG_steptraceScenarioPopup');if(!p)return false;p.hidden=false;setTriggerState(true);syncButton();positionPopup();return true},close:function(){var p=E('DBG_steptraceScenarioPopup');if(p)p.hidden=true;setTriggerState(false);return true},toggle:function(){var p=E('DBG_steptraceScenarioPopup');if(!p||p.hidden)return S.ui.open();return S.ui.close()},position:positionPopup,example:loadExample};

g.DBG_STEPTRACE_SCENARIO=S;g.STB=S;
g.onBreakpoint=onBreakpoint;g.haltAtBreakpoint=haltAtBreakpoint;g.ram=S.ram;g.cpu=S.cpu;g.assert=S.assert;g.sym=S.sym;g.symbol=S.symbol;g.symbols=S.symbols;g.print=S.print;
if(g.oCOM&&g.oCOM.addToEventStack)g.oCOM.addToEventStack('onload',init);else if(g.addEventListener)g.addEventListener('load',init);
})(window);
