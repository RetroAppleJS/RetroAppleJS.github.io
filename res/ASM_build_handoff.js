(function(g){
'use strict';

var D=g.document||null;
var generation=0,currentBuild=null;
var inputRevision=0,inputFingerprint=null;

function E(id){return D&&D.getElementById?D.getElementById(id):null}
function own(o,k){return Object.prototype.hasOwnProperty.call(o,k)}
function event(type,detail){
  if(!g.dispatchEvent)return;
  var ev;
  if(typeof g.CustomEvent==='function')ev=new g.CustomEvent(type,{detail:detail});
  else ev={type:type,detail:detail};
  try{g.dispatchEvent(ev)}catch(_){ }
}
function cloneBytes(v){return new Uint8Array(v instanceof Uint8Array?v:Uint8Array.from(v||[]))}
function cloneSymbol(s){return{key:String(s.key),name:String(s.name),value:Number(s.value)&65535,kind:String(s.kind||'unknown')}}
function cloneSegment(s){return{address:Number(s.address)&65535,bytes:cloneBytes(s.bytes)}}
function cloneBuild(b){
  if(!b)return null;
  return{
    schema:b.schema,version:b.version,id:b.id,generation:b.generation,inputRevision:b.inputRevision,
    createdAt:b.createdAt,sourceName:b.sourceName,entry:b.entry,byteCount:b.byteCount,
    segments:b.segments.map(cloneSegment),symbols:b.symbols.map(cloneSymbol)
  };
}
function text(v){return String(v==null?'':v)}
function nonEmpty(v){v=text(v).trim();return v||null}
function hashString(s){
  s=String(s);var h=2166136261>>>0;
  for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}
  return ('00000000'+h.toString(16)).slice(-8);
}
function currentInputText(){
  var parts=[];
  var src=E('ASM_sourcePane');parts.push(src&&'value'in src?src.value:'');
  var name=E('ASM_sourceFileNameInput');parts.push(name&&'value'in name?name.value:(g.oASM&&g.oASM.sourceName||''));
  var cols=E('ASM_listingColumnsInput')||E('ASM_settingsListingColumnsInput');parts.push(cols&&'value'in cols?cols.value:'');
  var dq=E('ASM_dQuoteLegacyInput');parts.push(dq&&'checked'in dq?String(!!dq.checked):'');
  var inc=g.ASM_includeFiles;
  if(Array.isArray(inc)){
    var xs=inc.map(function(f){return [text(f&&f.name),text(f&&f.sourceName),text(f&&f.source)].join('\u0001')}).sort();
    parts.push(xs.join('\u0002'));
  }
  return parts.join('\u0000');
}
function refreshInput(reason){
  var fp=hashString(currentInputText());
  if(inputFingerprint===null||fp!==inputFingerprint){
    inputFingerprint=fp;inputRevision++;
    event('retroapple:asm-input-changed',{revision:inputRevision,sourceName:sourceName(),reason:reason||'input-changed'});
  }
  API_INPUT.revision=inputRevision;
  return inputRevision;
}
function sourceName(){
  var name=E('ASM_sourceFileNameInput');
  return nonEmpty(name&&'value'in name?name.value:null)||nonEmpty(g.oASM&&g.oASM.sourceName)||'<source>';
}
function validAddress(v,label){
  v=Number(v);if(!Number.isInteger(v)||v<0||v>65535)throw new RangeError((label||'address')+' must be an unsigned 16-bit integer.');return v;
}
function validByte(v,index){
  v=Number(v);if(!Number.isInteger(v)||v<0||v>255)throw new RangeError('Invalid object byte at index '+index+'.');return v;
}
function extractSymbols(tab){
  tab=tab&&typeof tab==='object'?tab:{};
  var out=[],seen=Object.create(null),names=Object.keys(tab);
  for(var i=0;i<names.length;i++){
    var name=names[i];if(/^\.SCLOCAL_/i.test(name))continue;
    var value=Number(tab[name]);if(!Number.isInteger(value)||value<0||value>65535)throw new RangeError("Invalid assembler symbol '"+name+"'.");
    var key=String(name).trim().toUpperCase();if(!key)continue;
    if(own(seen,key))throw new Error("Duplicate canonical symbol '"+key+"'.");
    seen[key]=true;out.push({key:key,name:String(name),value:value,kind:'unknown'});
  }
  out.sort(function(a,b){return a.key<b.key?-1:a.key>b.key?1:0});
  return out;
}
function segmentsFromRecords(records){
  var out=[],seg=null,last=null;
  records=Array.isArray(records)?records:[];
  for(var i=0;i<records.length;i++){
    var r=records[i]||{};var pc=validAddress(r.pc,'object PC');var v=validByte(r.val,i);
    if(!seg||last===null||pc!==((last+1)&65535)||last===65535){seg={address:pc,bytes:[]};out.push(seg)}
    seg.bytes.push(v);last=pc;
  }
  return out.map(function(s){return{address:s.address,bytes:Uint8Array.from(s.bytes)}});
}
function segmentsFromAsm(asm){
  if(!asm||typeof asm.get_code_len!=='function'||typeof asm.read_code!=='function')return[];
  var len=Number(asm.get_code_len());if(!Number.isInteger(len)||len<0)throw new RangeError('Invalid assembler object length.');
  var out=[],seg=null,next=null,markers=asm.code_pc||[];
  for(var i=0;i<len;i++){
    var mark=Number(markers[i]);
    if(Number.isInteger(mark)&&mark>=0){mark=validAddress(mark,'ORG');seg={address:mark,bytes:[]};out.push(seg);next=mark}
    if(!seg)throw new Error('Assembler object code has no origin.');
    if(next>65535)throw new RangeError('Assembler segment exceeds the 16-bit address space.');
    seg.bytes.push(validByte(asm.read_code(i),i));next++;
  }
  return out.map(function(s){return{address:s.address,bytes:Uint8Array.from(s.bytes)}});
}
function extract(input){
  input=input||{};var compiled=input.compiled||null,asm=input.asm||null;
  var segments=[];
  if(compiled&&Array.isArray(compiled.bytes)&&compiled.bytes.length)segments=segmentsFromRecords(compiled.bytes);
  else segments=segmentsFromAsm(asm);
  if(!segments.length)throw new Error('Assembler build contains no object bytes.');
  var symbols=extractSymbols((compiled&&compiled.symtab)||(asm&&asm.symtab)||{});
  var entry=input.entry==null?segments[0].address:validAddress(input.entry,'entry');
  var rev=input.inputRevision==null?inputRevision:Number(input.inputRevision);
  if(!Number.isInteger(rev)||rev<0)throw new RangeError('inputRevision must be a non-negative integer.');
  return{
    sourceName:nonEmpty(input.sourceName)||nonEmpty(asm&&asm.sourceName)||'<source>',
    entry:entry,inputRevision:rev,
    segments:segments.map(cloneSegment),symbols:symbols.map(cloneSymbol)
  };
}
function extractCurrent(){
  refreshInput('extract');
  return extract({compiled:g.asmCompileResult||null,asm:g.oASM||null,sourceName:sourceName(),inputRevision:inputRevision});
}
function publish(spec){
  spec=spec||{};var segments=(spec.segments||[]).map(cloneSegment);if(!segments.length)throw new Error('Assembler build contains no object bytes.');
  var symbols=(spec.symbols||[]).map(cloneSymbol),count=segments.reduce(function(n,s){return n+s.bytes.length},0);
  generation++;
  currentBuild={
    schema:'RetroAppleJS.AssemblerBuild',version:1,id:'asm-build-'+generation,generation:generation,
    inputRevision:Number.isInteger(spec.inputRevision)?spec.inputRevision:inputRevision,createdAt:Date.now(),
    sourceName:nonEmpty(spec.sourceName)||'<source>',entry:validAddress(spec.entry,'entry'),byteCount:count,
    segments:segments,symbols:symbols
  };
  var snap=cloneBuild(currentBuild);event('retroapple:asm-build-published',{build:snap});return cloneBuild(currentBuild);
}
function publishCurrent(){return publish(extractCurrent())}
function clear(reason){var old=cloneBuild(currentBuild);currentBuild=null;if(old)event('retroapple:asm-build-cleared',{previous:old,reason:reason||'explicit'});return old}
function isFresh(){return !!currentBuild&&currentBuild.inputRevision===inputRevision}
function ensureFresh(){
  refreshInput('ensure');if(isFresh())return cloneBuild(currentBuild);
  if(typeof g.ASM_assembleCurrentSource!=='function')return null;
  var ok=g.ASM_assembleCurrentSource();if(ok===false)return null;
  if(Number(g.ASM_currentErrorCount||0)>0)return null;
  if(isFresh())return cloneBuild(currentBuild);
  try{return publishCurrent()}catch(e){if(g.console&&console.error)console.error(e);return null}
}
function wrapAssembler(){
  var fn=g.ASM_assembleCurrentSource;if(typeof fn!=='function'||fn._ASM_BUILD_wrapped)return false;
  function wrapped(){
    refreshInput('assemble');var ok=fn.apply(this,arguments);
    if(ok!==false&&Number(g.ASM_currentErrorCount||0)===0){try{publishCurrent()}catch(e){if(g.console&&console.error)console.error(e)}}
    return ok;
  }
  wrapped._ASM_BUILD_wrapped=true;wrapped._ASM_BUILD_original=fn;g.ASM_assembleCurrentSource=wrapped;return true;
}
function bindInput(){var src=E('ASM_sourcePane');if(src&&src.addEventListener&&!src._ASM_BUILD_input){src.addEventListener('input',function(){refreshInput('source-edited')});src._ASM_BUILD_input=true}}
function init(){refreshInput('initial');wrapAssembler();bindInput();return true}

var API_INPUT={version:1,revision:0,refresh:refreshInput,fingerprint:function(){refreshInput('query');return inputFingerprint}};
var API_BUILD={
  version:1,
  events:{published:'retroapple:asm-build-published',cleared:'retroapple:asm-build-cleared'},
  extract:extract,extractCurrent:extractCurrent,publish:publish,publishCurrent:publishCurrent,
  current:function(){return cloneBuild(currentBuild)},clear:clear,isFresh:isFresh,ensureFresh:ensureFresh,
  init:init
};
g.ASM_INPUT=API_INPUT;g.ASM_BUILD=API_BUILD;
if(g.oCOM&&g.oCOM.addToEventStack)g.oCOM.addToEventStack('onload',init);else if(g.addEventListener)g.addEventListener('load',init);
})(window);
