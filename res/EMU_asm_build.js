(function(g){
'use strict';

var D=g.document||null,currentLive=null,statusState='empty',statusReason=null,transactionCounter=0;

function E(id){return D&&D.getElementById?D.getElementById(id):null}
function now(){return Date.now()}
function event(type,detail){
  if(!g.dispatchEvent)return;
  var ev=typeof g.CustomEvent==='function'?new g.CustomEvent(type,{detail:detail}):{type:type,detail:detail};
  try{g.dispatchEvent(ev)}catch(_){ }
}
function cloneSymbol(s){return{key:String(s.key),name:String(s.name),value:Number(s.value)&65535,kind:String(s.kind||'unknown')}}
function cloneRange(r){return{start:r.start,end:r.end,length:r.length}}
function cloneLive(b){
  if(!b)return null;
  return{
    schema:b.schema,version:b.version,buildId:b.buildId,generation:b.generation,inputRevision:b.inputRevision,
    sourceName:b.sourceName,entry:b.entry,loadedAt:b.loadedAt,byteCount:b.byteCount,
    ranges:b.ranges.map(cloneRange),symbols:b.symbols.map(cloneSymbol)
  };
}
function causeJSON(c){return c?{name:String(c.name||'Error'),message:String(c.message||c)}:null}
function RetroAppleBuildError(opts){
  opts=opts||{};Error.call(this,opts.message||opts.code||'RetroApple build error');
  this.name='RetroAppleBuildError';this.code=opts.code||'EMU_BUILD_INTERNAL';this.phase=opts.phase||'validate';
  this.message=opts.message||this.code;this.context=opts.context||{};this.cause=opts.cause||null;this.rollback=opts.rollback||null;
  this.memoryState=opts.memoryState||'unchanged';this.liveBuildState=opts.liveBuildState||'unchanged';this.machineState=opts.machineState||'restored';
  if(Error.captureStackTrace)Error.captureStackTrace(this,RetroAppleBuildError);
}
RetroAppleBuildError.prototype=Object.create(Error.prototype);RetroAppleBuildError.prototype.constructor=RetroAppleBuildError;
RetroAppleBuildError.prototype.toJSON=function(){
  var rb=this.rollback?Object.assign({},this.rollback):null;if(rb&&Array.isArray(rb.failures))rb.failures=rb.failures.map(function(f){var x=Object.assign({},f);x.cause=causeJSON(x.cause);return x});
  return{name:this.name,code:this.code,phase:this.phase,message:this.message,context:this.context,cause:causeJSON(this.cause),rollback:rb,memoryState:this.memoryState,liveBuildState:this.liveBuildState,machineState:this.machineState};
};
function buildError(code,phase,message,context,cause,rollback,memoryState,liveBuildState,machineState){
  return new RetroAppleBuildError({code:code,phase:phase,message:message,context:context||{},cause:cause||null,rollback:rollback||null,memoryState:memoryState||'unchanged',liveBuildState:liveBuildState||'unchanged',machineState:machineState||'restored'});
}
function HW(){
  var m=g.apple2plus,h=m&&typeof m.hwObj==='function'?m.hwObj():null;
  if(!h||typeof h.safe_flashdump!=='function'||typeof h.load_ram64k!=='function')throw buildError('EMU_BUILD_INTERNAL','preflight','Live Apple II main-RAM import API is unavailable.',{},null,null,'unchanged');
  return h;
}
function contextFor(build,address){return{transactionId:'emu-build-load-'+transactionCounter,buildId:build&&build.id||null,sourceName:build&&build.sourceName||null,previousBuildId:currentLive&&currentLive.buildId||null,byteCount:build&&build.byteCount||0,segmentCount:build&&build.segments?build.segments.length:0,address:address==null?null:address,segmentIndex:null,segmentOffset:null}}
function validateBuild(build){
  transactionCounter++;
  if(!build)throw buildError('EMU_BUILD_REQUIRED','validate','An AssemblerBuild is required.',contextFor(null,null));
  if(build.schema!=='RetroAppleJS.AssemblerBuild'||Number(build.version)!==1||!Array.isArray(build.segments)||!build.segments.length)
    throw buildError('EMU_BUILD_INVALID','validate','Invalid AssemblerBuild.',contextFor(build,null));
  for(var i=0;i<build.segments.length;i++){
    var s=build.segments[i],a=Number(s.address),bytes=s&&s.bytes;
    if(!Number.isInteger(a)||a<0||a>65535||!(bytes instanceof Uint8Array)||bytes.length<1||a+bytes.length>65536)
      throw buildError('EMU_BUILD_INVALID','validate','Invalid assembler segment.',Object.assign(contextFor(build,a),{segmentIndex:i,segmentOffset:null}));
  }
  return build;
}
function preflight(build){
  for(var si=0;si<build.segments.length;si++){
    var s=build.segments[si];
    for(var j=0;j<s.bytes.length;j++){
      var a=s.address+j;
      if(a>=0xC000&&a<=0xCFFF)
        throw buildError('EMU_BUILD_IO_RANGE','preflight','Assembler build intersects Apple II I/O/slot space.',Object.assign(contextFor(build,a),{segmentIndex:si,segmentOffset:j}));
      if(a>=0xD000)
        throw buildError('EMU_BUILD_UNWRITABLE','preflight','V1 direct live loading supports main RAM $0000-$BFFF only.',Object.assign(contextFor(build,a),{segmentIndex:si,segmentOffset:j}));
    }
  }
}
function snapshotMain(h,build){
  try{
    var snap=h.safe_flashdump();
    if(!(snap instanceof Uint8Array)||snap.length<0xC000)throw new Error('safe_flashdump() did not return 48K main RAM.');
    return new Uint8Array(snap.subarray(0,0xC000));
  }catch(e){throw buildError('EMU_BUILD_SNAPSHOT_FAILED','snapshot','Could not snapshot live Apple II main RAM.',contextFor(build,null),e)}
}
function image64(main){var x=new Uint8Array(0x10000);x.set(main.subarray(0,0xC000),0);return x}
function finalTargets(build,candidate){
  var seen=Object.create(null),list=[];
  for(var si=0;si<build.segments.length;si++){
    var s=build.segments[si];
    for(var j=0;j<s.bytes.length;j++){var a=s.address+j;candidate[a]=s.bytes[j]&255;if(!seen[a]){seen[a]=true;list.push(a)}}
  }
  list.sort(function(a,b){return a-b});return list;
}
function rangesFromTargets(targets){
  if(!targets.length)return[];var out=[],start=targets[0],prev=targets[0];
  for(var i=1;i<targets.length;i++){var a=targets[i];if(a===prev+1){prev=a;continue}out.push({start:start,end:prev,length:prev-start+1});start=prev=a}
  out.push({start:start,end:prev,length:prev-start+1});return out;
}
function verifyTargets(h,targets,candidate,build){
  var actual;
  try{actual=h.safe_flashdump()}catch(e){throw buildError('EMU_BUILD_VERIFY_FAILED','verify','Could not read live RAM for verification.',contextFor(build,null),e)}
  if(!(actual instanceof Uint8Array)||actual.length<0xC000)throw buildError('EMU_BUILD_VERIFY_FAILED','verify','Live RAM verification dump is invalid.',contextFor(build,null));
  for(var i=0;i<targets.length;i++){var a=targets[i];if(actual[a]!==candidate[a])throw buildError('EMU_BUILD_VERIFY_FAILED','verify','Live assembler build verification failed at $'+a.toString(16).toUpperCase().padStart(4,'0')+'.',Object.assign(contextFor(build,a),{expected:candidate[a],actual:actual[a],bytesVerified:i}))}
  return true;
}
function rollback(h,snapshot,trigger){
  var rb={attempted:true,trigger:trigger,succeeded:false,entriesPlanned:snapshot.length,entriesRestored:0,bytesPlanned:snapshot.length,bytesRestored:0,verificationAttempted:false,verificationSucceeded:false,failures:[]};
  try{h.load_ram64k(image64(snapshot));rb.bytesRestored=snapshot.length;rb.entriesRestored=snapshot.length}catch(e){rb.failures.push({address:null,stage:'write',expected:null,actual:null,message:'Rollback write failed.',cause:e});return rb}
  rb.verificationAttempted=true;
  try{
    var actual=h.safe_flashdump();
    if(!(actual instanceof Uint8Array)||actual.length<snapshot.length)throw new Error('Rollback verification dump is invalid.');
    for(var i=0;i<snapshot.length;i++)if(actual[i]!==snapshot[i]){rb.failures.push({address:i,stage:'verify',expected:snapshot[i],actual:actual[i],message:'Rollback verification mismatch.',cause:null});break}
    rb.verificationSucceeded=rb.failures.length===0;rb.succeeded=rb.verificationSucceeded;return rb;
  }catch(e){rb.failures.push({address:null,stage:'verify',expected:null,actual:null,message:'Rollback verification failed.',cause:e});return rb}
}
function invalidate(previous,reason){currentLive=null;statusState='invalid';statusReason=reason||'partial-write';event('retroapple:emu-build-cleared',{previous:cloneLive(previous),reason:statusReason});renderUI()}
function failAfterWrite(primary,h,snapshot,trigger,previous){
  var rb=rollback(h,snapshot,trigger);
  if(rb.succeeded){primary.rollback=rb;primary.memoryState='restored';primary.liveBuildState='unchanged';primary.machineState='restored';throw primary}
  invalidate(previous,'partial-write');
  throw buildError('EMU_BUILD_PARTIAL_WRITE','rollback','Live assembler load failed and the previous memory image could not be fully restored.',Object.assign({},primary.context||{},{primaryFailure:{code:primary.code,phase:primary.phase,address:primary.context&&primary.context.address==null?null:primary.context.address,expected:primary.context&&primary.context.expected==null?null:primary.context.expected,actual:primary.context&&primary.context.actual==null?null:primary.context.actual,message:primary.message}}),primary.cause,rb,'indeterminate','cleared','paused');
}
function makeLive(build,targets){return{schema:'RetroAppleJS.LiveAssemblerBuild',version:1,buildId:build.id,generation:build.generation,inputRevision:build.inputRevision,sourceName:build.sourceName,entry:build.entry,loadedAt:now(),byteCount:build.byteCount,ranges:rangesFromTargets(targets),symbols:(build.symbols||[]).map(cloneSymbol)}}
function load(build){
  build=validateBuild(build);preflight(build);var h=HW(),previous=cloneLive(currentLive),snapshot=snapshotMain(h,build),candidate=new Uint8Array(snapshot),targets=finalTargets(build,candidate);
  try{h.load_ram64k(image64(candidate))}catch(e){failAfterWrite(buildError('EMU_BUILD_WRITE_FAILED','write','Live assembler build write failed.',contextFor(build,null),e),h,snapshot,'write-failure',previous)}
  try{verifyTargets(h,targets,candidate,build)}catch(e){var primary=e instanceof RetroAppleBuildError?e:buildError('EMU_BUILD_INTERNAL','verify','Unexpected live-build verification error.',contextFor(build,null),e);failAfterWrite(primary,h,snapshot,'verify-failure',previous)}
  currentLive=makeLive(build,targets);statusState='loaded';statusReason=null;var snap=cloneLive(currentLive);event('retroapple:emu-build-loaded',{build:snap});renderUI();return cloneLive(currentLive);
}
function clear(reason){var old=cloneLive(currentLive);currentLive=null;statusState='empty';statusReason=reason||null;if(old)event('retroapple:emu-build-cleared',{previous:old,reason:reason||'explicit'});renderUI();return old}
function status(){return{state:statusState,current:cloneLive(currentLive),reason:statusReason}}
function relation(){
  if(statusState==='invalid')return'invalid';if(!currentLive)return'empty';var a=g.ASM_BUILD&&g.ASM_BUILD.current?g.ASM_BUILD.current():null;if(!a)return'orphaned';
  if(currentLive.buildId!==a.id)return'older-build';if(g.ASM_INPUT&&a.inputRevision!==g.ASM_INPUT.revision)return'source-changed';return'current';
}
function setAsmStatus(text,kind){if(typeof g.ASM_setStatus==='function')g.ASM_setStatus(text,kind);else if(g.console&&console.log)console.log(text)}
function loadCurrent(){
  var b=g.ASM_BUILD&&g.ASM_BUILD.ensureFresh?g.ASM_BUILD.ensureFresh():null;if(!b){setAsmStatus('Assemble successfully before loading live RAM.','warn');return null}
  try{var live=load(b);setAsmStatus('Loaded '+b.sourceName+' directly into live Apple II RAM.','ok');return live}catch(e){setAsmStatus(e.message||String(e),'bad');throw e}
}
function renderUI(){
  var label=E('ASM_liveBuildState'),button=E('ASM_loadLiveHeaderButton'),r=relation(),txt='LIVE —',tip='No assembler build is loaded directly in live RAM.';
  if(r==='invalid'){txt='LIVE !';tip='Live assembler provenance is invalid; reload a known build.'}
  else if(currentLive){txt='LIVE #'+currentLive.generation;if(r==='source-changed'){txt+=' *';tip='Live build matches the last successful assembly, but source has changed.'}else if(r==='older-build'){var a=g.ASM_BUILD&&g.ASM_BUILD.current?g.ASM_BUILD.current():null;tip='Live build #'+currentLive.generation+'; newer build '+(a?'#'+a.generation:'available')+' is not loaded.'}else tip='Live build #'+currentLive.generation+': '+currentLive.sourceName}
  if(label){label.textContent=txt;label.title=tip}if(button)button.title='Load current assembly directly into live Apple II RAM. '+tip;return r;
}
function installUI(){
  if(!D||!D.createElement)return false;var existing=E('ASM_loadLiveHeaderButton');if(existing){renderUI();return true}
  var anchor=E('ASM_toDebuggerHeaderButton')||E('ASM_toEmulatorHeaderButton');if(!anchor||!anchor.parentNode)return false;
  var b=D.createElement('div');b.id='ASM_loadLiveHeaderButton';b.className='ASM_loadLiveButton appbut skinny';b.setAttribute('role','button');b.innerHTML='<i class="fa fa-bolt"></i>&nbsp;<i class="fa fa-memory"></i>';b.onclick=function(){loadCurrent()};
  anchor.parentNode.insertBefore(b,anchor.nextSibling);
  var s=D.createElement('span');s.id='ASM_liveBuildState';s.className='ASM_liveBuildState';s.style.cssText='margin-left:5px;font-size:9px;font-weight:normal;white-space:nowrap';anchor.parentNode.insertBefore(s,b.nextSibling);renderUI();return true;
}
function init(){installUI();renderUI();return true}

var API={version:1,events:{loaded:'retroapple:emu-build-loaded',cleared:'retroapple:emu-build-cleared'},load:load,loadCurrent:loadCurrent,current:function(){return cloneLive(currentLive)},status:status,clear:clear,relation:relation,renderUI:renderUI,init:init};
g.RetroAppleBuildError=RetroAppleBuildError;g.EMU_ASM_BUILD=API;g.ASM_loadLive=loadCurrent;
if(g.addEventListener){['retroapple:asm-input-changed','retroapple:asm-build-published','retroapple:asm-build-cleared'].forEach(function(n){g.addEventListener(n,renderUI)});}
if(g.oCOM&&g.oCOM.addToEventStack)g.oCOM.addToEventStack('onload',init);else if(g.addEventListener)g.addEventListener('load',init);
})(window);
