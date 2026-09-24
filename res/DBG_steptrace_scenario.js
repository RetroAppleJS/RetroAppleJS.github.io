(function(g){'use strict';
var term=null,cur=null,D=g.document;
function E(i){return D&&D.getElementById?D.getElementById(i):null}
function H(v,w){w=w||2;return '$'+('000000000000'+((Number(v)||0)&(w<=2?255:65535)).toString(16).toUpperCase()).slice(-w)}
function IH(v){return '$'+Math.max(0,Math.floor(Number(v)||0)).toString(16).toUpperCase().padStart(12,'0').slice(-12)}
function now(){return g.performance&&g.performance.now?g.performance.now():Date.now()}
function TB(){var t=g.TB||g.DBG_TESTBENCH;if(!t)throw Error('TEST BENCH symbol services are not available.');return t}
function M(){var m=g.apple2plus;if(!m||!m.cpuObj||!m.hwObj)throw Error('Live Apple II runtime is not available.');return m}
function C(){var c=M().cpuObj();if(!c||!c.watch||!c.setState)throw Error('Live 6502 state API is not available.');return c}
function W(){var h=M().hwObj();if(!h||!h.safe_read||!Array.isArray(h.WR)||!h.lineDecode)throw Error('Live mapped-memory API is not available.');return h}
function DBG(){return g.oEMU&&g.oEMU.component&&g.oEMU.component.CPU?g.oEMU.component.CPU.Apple2Debug:null}
function stop(){var d=DBG();if(d){if(d.play)d.play(false);if(d.clearConditionalBreakpoint)d.clearConditionalBreakpoint()}}
function refresh(){var d=DBG();try{if(d&&d.cycle)d.cycle({cpu:C(),force:true})}catch(_){}}
function num(s){s=String(s==null?'':s).trim();if(/^\$[\da-f]+$/i.test(s))return parseInt(s.slice(1),16);if(/^0x[\da-f]+$/i.test(s))return parseInt(s,16);if(/^\d+$/.test(s))return parseInt(s,10);return null}
function sym(n){var t=TB(),x={};if(t.sym){var v=t.sym(n,x);if(v!==x&&typeof v==='number'&&isFinite(v))return v&65535}return null}
function adr(v){if(typeof v==='number')return v&65535;var s=String(v==null?'':v).trim(),n=num(s);if(n!==null)return n&65535;var m=/^(.*?)\s*([+-])\s*(\$[\da-f]+|0x[\da-f]+|\d+)$/i.exec(s);if(m){var b=sym(m[1].trim()),d=num(m[3]);if(b!==null&&d!==null)return(b+(m[2]==='-'?-d:d))&65535}n=sym(s);if(n!==null)return n;throw Error("Unknown address/symbol '"+s+"'.")}
function bytes(v){if(v instanceof Uint8Array)return new Uint8Array(v);if(Array.isArray(v))return Uint8Array.from(v.map(x=>Number(x)&255));if(typeof v==='number')return Uint8Array.of(v&255);var s=String(v==null?'':v).trim();if(!s)return new Uint8Array(0);return Uint8Array.from(s.split(/[\s,;]+/).filter(Boolean).map(t=>{if(/^\$[\da-f]+$/i.test(t))return parseInt(t.slice(1),16)&255;if(/^0x[\da-f]+$/i.test(t))return parseInt(t,16)&255;if(/^[\da-f]{1,2}$/i.test(t))return parseInt(t,16)&255;if(/^\d+$/.test(t))return parseInt(t,10)&255;throw Error("Invalid byte '"+t+"'.")}))}
function rb(a){a&=65535;if(a>=0xc000&&a<0xc100)throw Error('STEP TRACE safe read masks Apple II I/O at '+H(a,4)+'.');var v=W().safe_read(a);if(v==null)throw Error('Mapped memory unreadable at '+H(a,4)+'.');return Number(v)&255}
function wb(a,v){a&=65535;v=Number(v)&255;if(a>=0xc000&&a<=0xcfff)throw Error('Scenario RAM injection refuses Apple II I/O/slot space '+H(a,4)+'.');var h=W(),f=h.WR[h.lineDecode(a)];if(typeof f!=='function')throw Error('Mapped memory not writable at '+H(a,4)+'.');f(a,v);if((a<0xc000||a>=0xc100)&&rb(a)!==v)throw Error('Write did not stick at '+H(a,4)+'.');return v}
function state(){var s=C().watch();return{pc:+s.pc&65535,a:+s.a&255,x:+s.x&255,y:+s.y&255,sp:+s.sp&255,p:+s.p&255,cycle_delay:+s.cycle_delay|0,ic:Math.max(0,Math.floor(+s.ic||0))}}
function out(t,ch){t=String(t==null?'':t);if(term&&term.write)term.write(t+(t.endsWith('\n')?'':'\n'),ch||'host');else{var f=E('DBG_steptraceConsoleFallback');if(f){f.value+=t+(t.endsWith('\n')?'':'\n');f.scrollTop=f.scrollHeight}else if(g.console&&g.console.log)g.console.log(t)}}
function toks(s){s=String(s||'');var o=[],i=0,F=(m,p)=>{throw Error(m+' at column '+((p==null?i:p)+1))};while(i<s.length){var c=s[i];if(/\s/.test(c)){i++;continue}var z=s.substr(i,2);if(['&&','||','==','!=','<=','>='].includes(z)){o.push({k:'o',v:z,p:i});i+=2;continue}if('()[]&|^!<>=+-'.includes(c)){o.push({k:'o',v:c,p:i++});continue}if(c==='$'){var p=i++,h='';while(/[\da-f]/i.test(s[i]||''))h+=s[i++];if(!h)F('Expected hexadecimal digits',p);o.push({k:'n',v:parseInt(h,16),p});continue}if(c==='0'&&/[xX]/.test(s[i+1]||'')){var p=i;i+=2;var h='';while(/[\da-f]/i.test(s[i]||''))h+=s[i++];if(!h)F('Expected hexadecimal digits',p);o.push({k:'n',v:parseInt(h,16),p});continue}if(/\d/.test(c)){var p=i,h='';while(/\d/.test(s[i]||''))h+=s[i++];o.push({k:'n',v:parseInt(h,10),p});continue}if(/[a-z_.$@?]/i.test(c)){var p=i,h='';while(/[a-z0-9_.$@?]/i.test(s[i]||''))h+=s[i++];o.push({k:'i',v:h.toUpperCase(),r:h,p});continue}F("Unexpected character '"+c+"'",i)}o.push({k:'e',v:'',p:i});return o}
function compile(text){text=String(text||'').trim();if(!text)throw Error('Condition is required.');var t=toks(text),p=0,R={A:1,X:1,Y:1,SP:1,P:1,PC:1,INS:1},F={N:1,V:1,B:1,D:1,I:1,Z:1,C:1},MM={M:8,M8:8,MEM:8,MEM8:8,M16:16,MEM16:16},q=()=>t[p],take=v=>q().v===v?(p++,1):0,need=v=>{if(!take(v))throw Error("Expected '"+v+"' at column "+(q().p+1))};function pri(){var x=q();if(x.k==='n'){p++;return{t:'n',v:x.v}}if(x.k==='i'){p++;if(x.v==='TRUE'||x.v==='FALSE')return{t:'n',v:x.v==='TRUE'?1:0};if(R[x.v])return{t:'r',v:x.v};if(F[x.v])return{t:'f',v:x.v};if(MM[x.v]){need('[');var a=lor();need(']');return{t:'m',w:MM[x.v],a}}var v=sym(x.r);if(v!==null)return{t:'n',v};throw Error("Unknown condition name '"+x.r+"' at column "+(x.p+1))}if(take('(')){var n=lor();need(')');return n}throw Error('Expected value at column '+(x.p+1))}function un(){if(take('!'))return{t:'u',o:'!',a:un()};if(take('+'))return{t:'u',o:'+',a:un()};if(take('-'))return{t:'u',o:'-',a:un()};return pri()}function bin(next,ops){var n=next();while(ops.includes(q().v)){var o=q().v;p++;n={t:'b',o,a:n,b:next()}}return n}function add(){return bin(un,['+','-'])}function ba(){return bin(add,['&'])}function bx(){return bin(ba,['^'])}function bo(){return bin(bx,['|'])}function cmp(){return bin(bo,['=','==','!=','<','<=','>','>='])}function land(){return bin(cmp,['&&'])}function lor(){return bin(land,['||'])}var a=lor();if(q().k!=='e')throw Error("Unexpected token '"+q().v+"' at column "+(q().p+1));return{text,ast:a}}
function val(n,s){if(n.t==='n')return+n.v||0;if(n.t==='r'){var k=n.v==='INS'?'ic':n.v.toLowerCase();return+s[k]||0}if(n.t==='f'){var m={N:128,V:64,B:16,D:8,I:4,Z:2,C:1};return(+s.p&m[n.v])?1:0}if(n.t==='m'){var a=val(n.a,s)&65535,l=rb(a);return n.w===8?l:l|(rb(a+1)<<8)}if(n.t==='u'){var a=val(n.a,s);return n.o==='!'?!a:n.o==='-'?-a:+a}if(n.t==='b'){if(n.o==='&&')return val(n.a,s)?!!val(n.b,s):0;if(n.o==='||')return val(n.a,s)?1:!!val(n.b,s);var a=val(n.a,s),b=val(n.b,s);switch(n.o){case'+':return a+b;case'-':return a-b;case'&':return((a|0)&(b|0))>>>0;case'|':return((a|0)|(b|0))>>>0;case'^':return((a|0)^(b|0))>>>0;case'=':case'==':return a===b;case'!=':return a!==b;case'<':return a<b;case'<=':return a<=b;case'>':return a>b;case'>=':return a>=b}}throw Error('Invalid condition expression')}
function Abort(){} Abort.prototype=Object.create(Error.prototype);function req(n){if(!cur)throw Error(n+'(): no active scenario');return cur}function fatal(st,r,e){var c=req('scenario');c.status=st;c.pass=false;c.reason=r;c.error=e||null;throw new Abort()}
var S={version:'0.1-live-steptrace-scenario',results:[],hex:H,address:adr,bytes,sym:function(n,d){var v=sym(n);if(v!==null)return v;if(arguments.length>1)return d;throw Error("Unknown assembler symbol '"+n+"'.")},symbol:n=>TB().symbol?TB().symbol(n):null,symbols:()=>TB().symbols?TB().symbols():[],print:function(){out([].slice.call(arguments).map(String).join(' '));return arguments[arguments.length-1]}};
S.ram={read:function(a,n){a=adr(a);n=n==null?1:Math.max(0,+n|0);if(n===1)return rb(a);var x=new Uint8Array(n);for(var i=0;i<n;i++)x[i]=rb(a+i);return x},read16:function(a){a=adr(a);return rb(a)|(rb(a+1)<<8)},write:function(a,v){a=adr(a);var x=bytes(v);for(var i=0;i<x.length;i++)wb(a+i,x[i]);return x.length},load:function(a,v){return S.ram.write(a,v)},write16:function(a,v){a=adr(a);v=+v&65535;wb(a,v);wb(a+1,v>>8);return v},fill:function(a,n,v){a=adr(a);for(var i=0;i<(+n|0);i++)wb(a+i,v);return+n|0},dump:function(a,n,c){a=adr(a);n=Math.max(0,n==null?16:+n|0);c=Math.max(1,c==null?16:+c|0);var z=[];for(var o=0;o<n;o+=c){var r=[],q='';for(var i=0;i<Math.min(c,n-o);i++){var b=rb(a+o+i);r.push(('0'+b.toString(16).toUpperCase()).slice(-2));q+=b>=32&&b<127?String.fromCharCode(b):'.'}z.push(H(a+o,4)+'  '+r.join(' ')+'  '+q)}return z.join('\n')}};
S.reset=function(){stop();var c=C(),n=Object.assign({},c.watch(),{pc:0,a:0,x:0,y:0,sp:255,p:32,cycle_delay:0,ic:0});c.setState(n);refresh();return state()};
S.cpu={state,start:function(a,r){stop();r=r||{};var c=C(),n=Object.assign({},c.watch(),{pc:adr(a),a:r.A==null?0:+r.A&255,x:r.X==null?0:+r.X&255,y:r.Y==null?0:+r.Y&255,sp:r.SP==null?255:+r.SP&255,p:r.P==null?32:+r.P&255,cycle_delay:0,ic:0});c.setState(n);refresh();return state()}};
S.breakIf=function(ex,opt){var c=req('breakIf'),co;try{co=compile(ex)}catch(e){out('ERROR BREAK\n  expression: '+ex+'\n  '+e.message,'error');fatal('ERROR','expression-error',e.message)}opt=opt||{};var lim=+opt.maxInstructions;if(!isFinite(lim)||lim<1)lim=1e6;lim=Math.floor(lim);var tm=opt.timeoutMs==null?5000:+opt.timeoutMs;if(!isFinite(tm)||tm<0)tm=5000;var st=now(),ins=0,cy=0,reason='condition',err=null,m=M();stop();while(1){var s=state();try{if(val(co.ast,s)){reason='condition';break}}catch(e){fatal('ERROR','expression-error',e.message)}if(ins>=lim){reason='instruction-limit';break}if(tm>0&&(ins&255)===0&&now()-st>=tm){reason='timeout';break}var one;try{one=m.stepLiveInstruction()}catch(e){reason='cpu-fault';err=e.message;break}if(!one||one.stalled||+one.ticks<=0){reason='cpu-fault';err='live instruction did not complete';break}ins++;cy+=+one.ticks||0}var r={ok:reason==='condition',reason,expression:co.text,maxInstructions:lim,timeoutMs:tm,instructions:ins,cycles:cy,elapsedMs:Math.max(0,now()-st),state:state(),error:err};c.breaks++;c.instructions+=ins;c.cycles+=cy;c.elapsedMs+=r.elapsedMs;c.runs.push(r);refresh();if(r.ok){out('BREAK '+co.text+' — PC='+H(r.state.pc,4)+' INS='+IH(r.state.ic)+' — '+ins+' ins / '+cy+' cyc','command');return r}out('FAIL BREAK '+co.text+'\n  reason: '+reason+'\n  last: PC='+H(r.state.pc,4)+' INS='+IH(r.state.ic),'error');fatal('FAIL',reason,err)};
S.assert=function(ex,d){var c=req('assert'),ok=false,co,s=state();c.assertions++;try{if(typeof ex==='boolean')ok=ex;else{co=compile(ex);ok=!!val(co.ast,s)}}catch(e){out('ERROR assertion\n  expression: '+ex+'\n  '+e.message,'error');fatal('ERROR','expression-error',e.message)}var n=String(d||(co?co.text:'assertion'));if(ok){out('PASS '+n,'result');return true}c.failedAssertions++;c.status='FAIL';c.pass=false;c.reason=c.reason||'assertion';out('FAIL '+n+(co?' — '+co.text:'')+'\n  at: PC='+H(s.pc,4)+' INS='+IH(s.ic),'error');return false};
S.scenario=function(n,f){if(cur)throw Error('Nested scenarios are not supported.');var r={name:String(n||'scenario'),status:'PASS',pass:true,assertions:0,failedAssertions:0,breaks:0,instructions:0,cycles:0,elapsedMs:0,reason:null,error:null,runs:[]};try{S.reset();cur=r;if(typeof f!=='function')throw TypeError('scenario() requires a callback.');f()}catch(e){if(!(e instanceof Abort)){r.status='ERROR';r.pass=false;r.reason='javascript-error';r.error=e.message||String(e);out('ERROR '+r.name+' — '+r.error,'error')}}finally{cur=null;if(r.status==='PASS'&&r.failedAssertions){r.status='FAIL';r.pass=false;r.reason='assertion'}var z=r.status+' '+r.name;if(r.status==='PASS')z+=' — '+r.assertions+' assertions / '+r.instructions+' ins / '+r.cycles+' cyc / '+r.elapsedMs.toFixed(1)+' ms';else if(r.failedAssertions)z+=' — '+r.failedAssertions+'/'+r.assertions+' assertions failed';else if(r.reason)z+=' — '+r.reason.replace(/-/g,' ');out(z,r.status==='PASS'?'result':'error');S.results.push(r)}return r};S.condition={compile,evaluate:(c,s)=>!!val(c.ast,s||state())};
S.eval=function(code){var scenario=S.scenario,reset=S.reset,ram=S.ram,cpu=S.cpu,breakIf=S.breakIf,assert=S.assert,sym=S.sym,print=S.print;return eval(String(code||''))};
function rename(root){if(!root)return;var a=[root];if(root.querySelectorAll)a=a.concat([].slice.call(root.querySelectorAll('[id]')));a.forEach(n=>{if(n.id&&/^DBG_test/.test(n.id))n.id=n.id.replace(/^DBG_test/,'DBG_steptrace')})}

var uiObserver=null,resizeBound=false;
function setTriggerState(open)
{
  var button=E('cpuDbg_scenario');
  if(!button)return;
  button.style.opacity=open?'1':'.45';
  button.setAttribute('aria-pressed',open?'true':'false');
}
function companionPopup()
{
  var p=E('DBG_steptraceScenarioPopup');
  if(p)return p;
  if(!D||!D.createElement)return null;
  p=D.createElement('div');
  p.id='DBG_steptraceScenarioPopup';
  p.className='appbox DBG_steptraceScenarioPopup';
  p.hidden=true;
  p.style.cssText='position:fixed;z-index:8;width:520px;max-width:calc(100vw - 8px);padding:0;text-align:left;box-sizing:border-box';
  var host=D.body||E('feature_box');
  if(!host)return null;
  host.appendChild(p);
  return p;
}
function positionPopup()
{
  var p=E('DBG_steptraceScenarioPopup'),dbg=E('cpuDbg_popup');
  if(!p||!dbg||p.hidden||!dbg.getBoundingClientRect)return false;
  var r=dbg.getBoundingClientRect(),gap=8,vw=g.innerWidth||(D.documentElement&&D.documentElement.clientWidth)||1024,vh=g.innerHeight||(D.documentElement&&D.documentElement.clientHeight)||768;
  var wanted=Math.min(520,Math.max(320,vw-8));
  p.style.width=wanted+'px';
  var pw=p.getBoundingClientRect?p.getBoundingClientRect().width:wanted;
  if(!pw)pw=wanted;
  var left=r.right+gap;
  if(left+pw>vw-4)left=Math.max(4,r.left-pw-gap);
  p.style.left=Math.round(left)+'px';
  p.style.top=Math.round(Math.max(4,Math.min(r.top,vh-40)))+'px';
  return true;
}
function initTerminal()
{
  if(term||typeof g.TERMINAL!=='function'||!E('DBG_steptraceConsole'))return;
  try{
    term=new g.TERMINAL({container:'DBG_steptraceConsole',welcome:'Live STEP TRACE scenario harness ready.',prompt:'ST',separator:'&gt;',storageKey:'RetroAppleJS.Debugger.StepTraceScenario',preserveWhitespace:true,allowEmptyInput:false});
    term.onInput((a,b,line)=>{try{var r=S.eval(line);if(r!==undefined)out('← '+String(r),'result')}catch(e){out('[ERROR] '+e.stack,'error')}return true});
  }catch(_){ }
}
function loadExample()
{
  var e=E('DBG_steptraceScript');
  if(!e)return;
  e.value="scenario('example',function(){\n  ram.write('$3000','$42');\n  cpu.start('$0800');\n  breakIf('PC==$0810');\n  assert('A==$42');\n});";
  if(e.focus)e.focus();
}
function buildPopup()
{
  var p=companionPopup();
  if(!p)return false;
  if(E('DBG_steptracebenchBox'))return true;
  var b=E('DBG_testbenchBox');
  if(!b||!b.cloneNode)return false;
  var q=b.cloneNode(true);
  rename(q);
  if(q.classList)q.classList.remove('appbox');
  var title=q.querySelector&&q.querySelector('.DBG_testbenchTitle');
  if(title)title.textContent='STEP TRACE SCENARIO';
  var header=q.querySelector&&q.querySelector('.DBG_testbenchHeader');
  var headerButtons=q.querySelector&&q.querySelector('.DBG_testbenchHeaderButtons');
  if(header&&D.createElement){
    var close=D.createElement('button');
    close.type='button';
    close.textContent='×';
    close.title='Close STEP TRACE scenario';
    close.style.cssText='float:right;margin-left:6px;padding:0 5px;font-size:11px';
    close.onclick=()=>S.ui.close();
    (headerButtons||header).appendChild(close);
  }
  var ed=q.querySelector&&q.querySelector('#DBG_steptraceScript');
  if(ed){
    ed.value="scenario('example',function(){ ram.write('$3000','$42'); cpu.start('$0800'); breakIf('PC==$0810'); assert('A==$42'); });";
    ed.onkeydown=function(ev){if((ev.ctrlKey||ev.metaKey)&&ev.key==='Enter'){ev.preventDefault();S.eval(ed.value)}};
  }
  var host=q.querySelector&&q.querySelector('#DBG_steptraceConsole');
  if(host)host.innerHTML='';
  p.appendChild(q);
  initTerminal();
  var run=E('DBG_steptraceRunButton');if(run)run.onclick=()=>{var e=E('DBG_steptraceScript');if(e)S.eval(e.value)};
  var example=E('DBG_steptraceExampleButton');if(example)example.onclick=loadExample;
  var clear=E('DBG_steptraceClearConsoleButton');if(clear)clear.onclick=()=>{if(term&&term.clear)term.clear();var f=E('DBG_steptraceConsoleFallback');if(f)f.value=''};
  var inj=E('DBG_steptraceRamInjectButton');if(inj)inj.onclick=()=>S.ram.write(E('DBG_steptraceRamAddress').value,E('DBG_steptraceRamData').value);
  var rd=E('DBG_steptraceRamReadButton');if(rd)rd.onclick=()=>{var a=E('DBG_steptraceRamAddress').value,n=parseInt(E('DBG_steptraceRamLength').value,10)||16;out(S.ram.dump(a,n))};
  return true;
}
function installTrigger()
{
  if(E('cpuDbg_scenario'))return true;
  var play=E('cpuDbg_play');
  if(!play||!play.parentNode||!D.createElement)return false;
  var button=D.createElement('i');
  button.id='cpuDbg_scenario';
  button.className='fa fa-code';
  button.setAttribute('role','button');
  button.setAttribute('aria-pressed','false');
  button.title='Open STEP TRACE scenario test script';
  button.style.cssText='font-size:11px;cursor:pointer;opacity:.45;margin-left:2px';
  button.onclick=()=>S.ui.toggle();
  if(play.nextSibling)play.parentNode.insertBefore(button,play.nextSibling);else play.parentNode.appendChild(button);
  return true;
}
function hideIfTraceClosed()
{
  var dbg=E('cpuDbg_popup'),p=E('DBG_steptraceScenarioPopup');
  if(p&&dbg&&dbg.hidden)S.ui.close();
}
function observeTracePopup()
{
  var dbg=E('cpuDbg_popup');
  if(!dbg||uiObserver||typeof g.MutationObserver!=='function')return;
  uiObserver=new g.MutationObserver(()=>{hideIfTraceClosed();if(!dbg.hidden)installTrigger();if(E('DBG_steptraceScenarioPopup')&&!E('DBG_steptraceScenarioPopup').hidden)positionPopup()});
  uiObserver.observe(dbg,{attributes:true,attributeFilter:['hidden','style','class'],childList:true,subtree:true});
}
function init()
{
  var ok=installTrigger();
  companionPopup();
  observeTracePopup();
  if(!resizeBound&&g.addEventListener){g.addEventListener('resize',positionPopup);resizeBound=true}
  if(ok)return true;
  var host=E('feature_box')||(D&&D.body);
  if(host&&!uiObserver&&typeof g.MutationObserver==='function'){
    uiObserver=new g.MutationObserver(()=>{if(installTrigger()){uiObserver.disconnect();uiObserver=null;observeTracePopup()}});
    uiObserver.observe(host,{childList:true,subtree:true});
  }
  return false;
}
S.ui={
  init:init,
  open:function(){init();if(!buildPopup())return false;var p=E('DBG_steptraceScenarioPopup');if(!p)return false;p.hidden=false;setTriggerState(true);positionPopup();return true},
  close:function(){var p=E('DBG_steptraceScenarioPopup');if(p)p.hidden=true;setTriggerState(false);return true},
  toggle:function(){var p=E('DBG_steptraceScenarioPopup');if(!p||p.hidden)return S.ui.open();return S.ui.close()},
  position:positionPopup,
  example:loadExample
};
g.DBG_STEPTRACE_SCENARIO=S;g.STB=S;if(g.oCOM&&g.oCOM.addToEventStack)g.oCOM.addToEventStack('onload',init);else if(g.addEventListener)g.addEventListener('load',init);
})(window);