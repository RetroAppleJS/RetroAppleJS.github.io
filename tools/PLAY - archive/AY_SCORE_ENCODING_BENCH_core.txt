/* RetroAppleJS research tool - AY Score Encoding Bench v0.1.1 (Phase 1.5A.1).
 * Standalone UMD; no dependencies; no production emulator modifications.
 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.AYScoreEncodingBench=factory();})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
var SCHEMA='retroapplejs.ay.score-encoding-bench.v0.1', VERSION=1; // unchanged binary/report schema family
var CPUHZ=1023000, AYHZ=1021800, MAX_EVENTS=220000, MAX_ACTIONS=40000;
var CODECS=[{id:0,key:'E0',name:'Raw absolute events'},{id:1,key:'E1',name:'Delta varint events'},{id:2,key:'E2',name:'LZ pattern events'},{id:3,key:'E3',name:'Instrument VM'},{id:4,key:'E4',name:'Hybrid auto'}];
var INST={square:0,saw:1,triangle:2,buzzer:3,dac8:4,dac32s:5};
var INS_BY_ID=['square','saw','triangle','buzzer','dac8','dac32s'];
var VOICES=[{chip:0,channel:0},{chip:0,channel:1},{chip:1,channel:0},{chip:1,channel:1},{chip:0,channel:2},{chip:1,channel:2}];
var CODE_BYTES={E0:260,E1:435,E2:925,E3:1500,E4:1810}; // illustrative until assembled/benchmarked
var INSTR_BYTES={square:24,saw:48,triangle:48,buzzer:64,dac8:64,dac32s:112};
function assert(ok,msg){if(!ok)throw new Error(msg);}
function int(n,name,lo,hi){assert(Number.isSafeInteger(n)&&n>=lo&&n<=hi,name+' must be integer in '+lo+'..'+hi);return n;}
function cloneSimple(x){return JSON.parse(JSON.stringify(x));}
function midiHz(n){return 440*Math.pow(2,(n-69)/12);}
function tonePeriod(hz,clock){return Math.max(1,Math.min(4095,Math.round(clock/(16*hz))));}
function envelopePeriod(hz,clock,triangle){return Math.max(1,Math.min(65535,Math.round(clock/((triangle?512:256)*hz))));}
function triangleVolume(step,steps,vol){var phase=step/steps, level=1-Math.abs(2*phase-1);return Math.round(vol*Math.sqrt(Math.max(0,level)));}
function event(cycle,chip,reg,value){return {cycle:cycle,chip:chip,reg:reg,value:value};}
function action(cycle,type,voice,midi,instrument,volume,extra){var x={cycle:cycle,type:type};if(voice!=null)x.voice=voice;if(midi!=null)x.midi=midi;if(instrument!=null)x.instrument=instrument;if(volume!=null)x.volume=volume;if(extra){x.chip=extra.chip;x.reg=extra.reg;x.value=extra.value;}return x;}
function normalizeActions(actions){assert(Array.isArray(actions)&&actions.length<=MAX_ACTIONS,'too many actions');return actions.map(function(a,i){
 int(a.cycle,'action cycle',0,4294967295);assert(['on','off','write'].indexOf(a.type)>=0,'invalid action type');
 var b=Object.assign({_seq:i},a);
 if(a.type==='on'){int(a.voice,'voice',0,5);int(a.midi,'MIDI note',12,108);assert(INS_BY_ID.indexOf(a.instrument)>=0,'invalid instrument');int(a.volume,'volume',0,15);}
 if(a.type==='off')int(a.voice,'voice',0,5);
 if(a.type==='write'){int(a.chip,'chip',0,1);int(a.reg,'register',0,15);int(a.value,'register value',0,255);}
 return b;
 }).sort(function(a,b){return a.cycle-b.cycle||a._seq-b._seq;});}
function normalizeEvents(events){assert(Array.isArray(events)&&events.length<=MAX_EVENTS,'too many events');return events.map(function(e,i){
 int(e.cycle,'event cycle',0,4294967295);int(e.chip,'chip',0,1);int(e.reg,'register',0,15);int(e.value,'register value',0,255);
 return {_seq:i,cycle:e.cycle,chip:e.chip,reg:e.reg,value:e.value};
 }).sort(function(a,b){return a.cycle-b.cycle||a._seq-b._seq;}).map(function(e){return event(e.cycle,e.chip,e.reg,e.value);});}
function validateScore(score){assert(score&&typeof score==='object','score required');int(score.cpuHz,'CPU Hz',500000,4000000);int(score.ayHz,'AY Hz',500000,1800000);int(score.durationCycles,'duration cycles',1,4294967295);
 if(score.actions){var acts=normalizeActions(score.actions);assert(acts.every(function(a){return a.cycle<=score.durationCycles;}),'actions outside duration');}
 if(score.events){var ev=normalizeEvents(score.events);assert(ev.every(function(e){return e.cycle<=score.durationCycles;}),'events outside duration');}
 return score;
}
function compileActions(input){var acts=normalizeActions(input.actions||[]),cpuhz=input.cpuHz,ayhz=input.ayHz,duration=input.durationCycles;var events=[],active=Object.create(null),ownership=Object.create(null),mixer=[63,63];
 function put(t,chip,reg,val,pri,order){if(t<=duration){assert(events.length<MAX_EVENTS,'generated events exceed '+MAX_EVENTS);events.push({cycle:t,chip:chip,reg:reg,value:val,pri:pri,order:order,seq:events.length});}}
 function setMixer(t,chip,channel,toneEnabled,ord){var mask=1<<channel;if(toneEnabled)mixer[chip]&=~mask;else mixer[chip]|=mask;put(t,chip,7,mixer[chip],0,ord);}
 function stepEvents(on,end){var voice=VOICES[on.voice],hz=midiHz(on.midi),steps=on.instrument==='dac8'?8:32;if(on.instrument!=='dac8'&&on.instrument!=='dac32s')return;
 var previous=-1,period=cpuhz/hz;
 for(var i=0;;i++){
  var t=on.cycle+Math.round(i*period/steps);if(t>=end||t>duration)break;
  var val=triangleVolume(i%steps,steps,on.volume);
  if(on.instrument==='dac32s'&&val===previous)continue;
  if(i===0&&val===0){previous=0;continue;}
  put(t,voice.chip,8+voice.channel,val,1,on._seq);previous=val;
 }
 }
 acts.forEach(function(a){var target=a.type==='write'?null:VOICES[a.voice],key=a.voice;
  if(a.type==='write'){put(a.cycle,a.chip,a.reg,a.value,0,a._seq);return;}
  if(a.type==='off'){
   if(active[key]){var old=active[key];stepEvents(old,a.cycle);delete active[key];if(old.instrument==='saw'||old.instrument==='triangle'||old.instrument==='buzzer')delete ownership[target.chip];}
   put(a.cycle,target.chip,8+target.channel,0,0,a._seq);return;
  }
  assert(!active[key],'overlapping notes on voice '+key);
  if(['saw','triangle','buzzer'].indexOf(a.instrument)>=0){assert(ownership[target.chip]==null,'shared AY envelope conflict on chip '+target.chip+' at cycle '+a.cycle);ownership[target.chip]=key;}
  active[key]=a;var p=tonePeriod(midiHz(a.midi),ayhz);
  if(a.instrument==='buzzer'){var pe=envelopePeriod(midiHz(a.midi),ayhz,false);p=Math.min(4095,16*pe);}
  if(a.instrument==='square'||a.instrument==='buzzer'){
    put(a.cycle,target.chip,target.channel*2,p&255,0,a._seq);
    put(a.cycle,target.chip,target.channel*2+1,(p>>>8)&15,0,a._seq);
  }
  if(a.instrument==='saw'||a.instrument==='triangle'||a.instrument==='buzzer'){
    var ep=a.instrument==='buzzer'?p/16:envelopePeriod(midiHz(a.midi),ayhz,a.instrument==='triangle');
    put(a.cycle,target.chip,11,ep&255,0,a._seq);put(a.cycle,target.chip,12,(ep>>>8)&255,0,a._seq);
    put(a.cycle,target.chip,13,a.instrument==='triangle'?10:a.instrument==='saw'?8:8,0,a._seq);
  }
  setMixer(a.cycle,target.chip,target.channel,a.instrument==='square'||a.instrument==='buzzer',a._seq);
  put(a.cycle,target.chip,8+target.channel,(['saw','triangle','buzzer'].indexOf(a.instrument)>=0)?16:a.instrument==='square'?a.volume:0,0,a._seq);
 });
 Object.keys(active).forEach(function(key){stepEvents(active[key],duration);});
 events.sort(function(a,b){return a.cycle-b.cycle||a.pri-b.pri||a.order-b.order||a.seq-b.seq;});
 return events.map(function(e){return event(e.cycle,e.chip,e.reg,e.value);});
}
function generate(options){options=options||{};var scenario=options.scenario||'mixed',seconds=Number(options.seconds==null?8:options.seconds),seed=Number(options.seed==null?12345:options.seed),bpm=Number(options.bpm==null?120:options.bpm),cpuHz=Number(options.cpuHz==null?CPUHZ:options.cpuHz),ayHz=Number(options.ayHz==null?AYHZ:options.ayHz);
 assert(['chord','arpeggio','bass','mixed','ambient','action'].indexOf(scenario)>=0,'invalid scenario');assert(Number.isFinite(seconds)&&seconds>=1&&seconds<=90,'duration 1..90s');int(seed,'seed',0,4294967295);int(bpm,'BPM',40,240);int(cpuHz,'CPU Hz',500000,4000000);int(ayHz,'AY Hz',500000,1800000);
 var durationCycles=Math.round(seconds*cpuHz),rng=seed>>>0,actions=[];
 function rand(){rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;}
 function cycle(beat){return Math.min(durationCycles,Math.round(beat*60/bpm*cpuHz));}
 function note(voice,start,length,midi,instrument,volume){var a=cycle(start),b=cycle(start+length);if(a>=durationCycles||b<=a)return;
  actions.push(action(a,'on',voice,midi,instrument,volume));actions.push(action(Math.min(b,durationCycles),'off',voice));}
 var beats=seconds*bpm/60;
 if(scenario==='chord'){
  for(var t=0;t<beats;t+=8){note(0,t,Math.min(7.5,beats-t),48,'dac8',13);note(1,t,Math.min(7.5,beats-t),55,'square',10);note(2,t,Math.min(7.5,beats-t),60,'triangle',12);}
 } else if(scenario==='arpeggio'){
  for(var b=0;b<beats;b+=.25){var v=Math.round(b*4)%3;note(v,b,.19,[48,52,55,60,64,67][Math.floor(b*4)%6],v===0?'dac8':v===1?'square':'saw',12);}
 } else if(scenario==='bass'){
  for(var bar=0;bar<beats;bar+=4){for(var k=0;k<4;k++)note(0,bar+k,.8,[36,36,43,39][k],'dac32s',13);note(1,bar,3.7,55,'square',8);}
 } else if(scenario==='ambient'){
  for(var u=0;u<beats;u+=5){note(0,u,Math.min(4.3,beats-u),[45,48,50,52][Math.floor(u/5)%4],'triangle',12);note(2,u+1,Math.min(2.4,beats-u-1),[64,60,67][Math.floor(u/5)%3],'square',8);}
 } else {
  for(var q=0;q<beats;q+=1){
    var intense=scenario==='action';
    note(0,q,intense?.82:.91,48+Math.floor(rand()*5)*2,intense?'dac8':(rand()<.5?'dac8':'dac32s'),13);
    note(1,q,Math.min(intense?.38:.77,beats-q),55+Math.floor(rand()*8),'square',10);
    note(2,q,Math.min(intense?.85:.97,beats-q),60+Math.floor(rand()*6),'buzzer',12);
    if(intense&&Math.floor(q)%3===0){actions.push(action(cycle(q+.35),'write',null,null,null,null,{chip:0,reg:10,value:7}));}
  }
 }
 // Stable order at the same instant: off before on (e.g. arpeggio cadence / repeated note).
 actions.sort(function(a,b){return a.cycle-b.cycle||({off:0,on:1,write:2}[a.type]-{off:0,on:1,write:2}[b.type]);});
 var score={kind:'synthetic',scenario:scenario,seed:seed,bpm:bpm,cpuHz:cpuHz,ayHz:ayHz,durationCycles:durationCycles,actions:actions};
 score.events=compileActions(score);validateScore(score);return score;
}
function fromWaveformSurvey(data,options){options=options||{};assert(data&&typeof data==='object','invalid JSON');var results=data.results?data.results:[data],index=options.resultIndex==null?0:Number(options.resultIndex);int(index,'result index',0,Math.max(0,results.length-1));var r=results[index];assert(r&&r.spec&&Array.isArray(r.spec.events),'no AY Waveform Bench events found');
 var cpuHz=Number(options.cpuHz||CPUHZ),ayHz=Number(r.spec.clock||AYHZ);int(cpuHz,'CPU Hz',500000,4000000);int(ayHz,'AY Hz',500000,1800000);
 var events=r.spec.events.map(function(e){return event(Math.round(Number(e.tick)/1e9*cpuHz),e.chip,e.reg,e.value);});
 var durationCycles=Math.max(1,Math.round(Number(r.spec.duration||1)*cpuHz));var score={kind:'import',scenario:'AY Waveform Bench: '+r.spec.fixture,seed:null,bpm:null,cpuHz:cpuHz,ayHz:ayHz,durationCycles:durationCycles,actions:[],events:normalizeEvents(events),importInfo:{fixture:r.spec.fixture,resultIndex:index,sourceSchema:data.schema||r.schema||'unknown',timeConversion:'round(tickNanoseconds * cpuHz / 1e9)',sourceEventCount:events.length}};
 validateScore(score);return score;
}
function fromEventJson(data,options){options=options||{};assert(data&&Array.isArray(data.events),'requires events array');var cpuHz=Number(options.cpuHz||data.cpuHz||CPUHZ),ayHz=Number(data.ayHz||AYHZ);int(cpuHz,'CPU Hz',500000,4000000);int(ayHz,'AY Hz',500000,1800000);
 var events=normalizeEvents(data.events),durationCycles=Number(data.durationCycles||Math.max(1,events.length?events[events.length-1].cycle+1:cpuHz));int(durationCycles,'duration',1,4294967295);
 var s={kind:'import',scenario:data.name||'Imported canonical AY events',cpuHz:cpuHz,ayHz:ayHz,durationCycles:durationCycles,actions:[],events:events};validateScore(s);return s;
}
function bytesOf(str){var out=[];for(var i=0;i<str.length;i++)out.push(str.charCodeAt(i)&255);return out;}
function Writer(){this.a=[];}Writer.prototype.b=function(v){this.a.push(v&255);};Writer.prototype.u32=function(v){v>>>=0;for(var j=0;j<4;j++)this.b(v>>>(8*j));};Writer.prototype.v=function(n){assert(Number.isSafeInteger(n)&&n>=0&&n<=4294967295,'bad varuint');do{var x=n%128;n=Math.floor(n/128);this.b(x|(n?128:0));}while(n);};Writer.prototype.cat=function(a){for(var i=0;i<a.length;i++)this.a.push(a[i]);};Writer.prototype.arr=function(){return Uint8Array.from(this.a);};
function Reader(bytes){this.a=bytes;this.i=0;}Reader.prototype.b=function(){assert(this.i<this.a.length,'unexpected end of stream');return this.a[this.i++];};Reader.prototype.u32=function(){var n=0;for(var k=0;k<4;k++)n+=(this.b()*Math.pow(256,k));return n>>>0;};Reader.prototype.v=function(){var n=0,f=1;for(var j=0;j<5;j++){var b=this.b();n+=(b&127)*f;assert(n<=4294967295,'varuint overflow');if(!(b&128))return n;f*=128;}throw Error('varuint longer than 5 bytes');};Reader.prototype.done=function(){assert(this.i===this.a.length,'trailing unread bytes');};
function checksum(b){var h=2166136261>>>0;for(var i=0;i<b.length;i++){h^=b[i];h=Math.imul(h,16777619)>>>0;}return h;}
function packEventId(e){return e.chip*16+e.reg;}
function unwrapEvent(d,id,value){assert(id<32,'invalid packed AY register');return event(d,id>>>4,id&15,value);}
function eventEqual(a,b){return a.cycle===b.cycle&&a.chip===b.chip&&a.reg===b.reg&&a.value===b.value;}
function compareEvents(a,b){if(a.length!==b.length)return {equal:false,index:Math.min(a.length,b.length),message:'event count differs ('+a.length+' vs '+b.length+')'};for(var i=0;i<a.length;i++)if(!eventEqual(a[i],b[i]))return {equal:false,index:i,message:'different event at index '+i};return {equal:true,index:null,message:'Exact event order and cycle timestamps preserved'};}
function tokens(events){var last=0;return events.map(function(e){var dt=e.cycle-last;assert(dt>=0,'nonmonotonic event time');last=e.cycle;return {dt:dt,id:packEventId(e),value:e.value};});}
function expandTokens(t){var time=0;return t.map(function(x){time+=x.dt;assert(time<=4294967295,'timeline overflow');return unwrapEvent(time,x.id,x.value);});}
function tokKey(t){return t.dt+','+t.id+','+t.value;}
function putToken(w,t){w.v(t.dt);w.b(t.id);w.b(t.value);}
function getToken(r){var x={dt:r.v(),id:r.b(),value:r.b()};assert(x.id<32,'bad AY id');return x;}
function encodeRaw(events){var w=new Writer();for(var i=0;i<events.length;i++){var e=events[i];w.u32(e.cycle);w.b(packEventId(e));w.b(e.value);}return {bytes:w.arr(),stats:{literals:events.length,backrefs:0,copied:0,deltaBytes:events.length*4}};}
function decodeRaw(bytes,count){assert(bytes.length===count*6,'invalid raw payload length');var r=new Reader(bytes),events=[];for(var i=0;i<count;i++)events.push(unwrapEvent(r.u32(),r.b(),r.b()));r.done();return events;}
function encodeDelta(events){var w=new Writer(),t=tokens(events),deltaBytes=0;for(var i=0;i<t.length;i++){var before=w.a.length;putToken(w,t[i]);deltaBytes+=w.a.length-before-2;}return {bytes:w.arr(),stats:{literals:t.length,backrefs:0,copied:0,deltaBytes:deltaBytes}};}
function decodeDelta(bytes,count){var r=new Reader(bytes),t=[];for(var i=0;i<count;i++)t.push(getToken(r));r.done();return expandTokens(t);}
function encodePattern(events,options){options=options||{};var chunkSize=Number(options.chunkSize||512);int(chunkSize,'chunk size',64,2048);var t=tokens(events),w=new Writer(),blocks=Math.ceil(t.length/chunkSize);w.v(blocks);var copied=0,literals=0,backrefs=0,deltaBytes=0;
 for(var s=0;s<t.length;s+=chunkSize){var block=t.slice(s,s+chunkSize),cw=new Writer(),map=new Map(),lit=[],pos=0;
  function flush(){if(!lit.length)return;cw.b(0);cw.v(lit.length);lit.forEach(function(tok){var x=cw.a.length;putToken(cw,tok);deltaBytes+=cw.a.length-x-2;});literals+=lit.length;lit=[];}
  function keyAt(p){return p+2<block.length?tokKey(block[p])+'|'+tokKey(block[p+1])+'|'+tokKey(block[p+2]):'';}
  function add(p){var k=keyAt(p);if(!k)return;var arr=map.get(k)||[];arr.push(p);if(arr.length>24)arr.shift();map.set(k,arr);}
  while(pos<block.length){var key=keyAt(pos),candidates=map.get(key)||[],bestLength=0,bestDistance=0;
   for(var j=candidates.length-1;j>=0;j--){var p=candidates[j],dist=pos-p;if(dist>128)continue;var len=0;
    while(len<255&&pos+len<block.length&&tokKey(block[p+len])===tokKey(block[pos+len]))len++;
    if(len>bestLength){bestLength=len;bestDistance=dist;}if(bestLength>=128)break;
   }
   if(bestLength>=4){flush();cw.b(1);cw.v(bestDistance);cw.v(bestLength);backrefs++;copied+=bestLength;for(var n=0;n<bestLength;n++)add(pos+n);pos+=bestLength;}
   else{lit.push(block[pos]);add(pos);pos++;if(lit.length>=255)flush();}
  }
  flush();w.v(block.length);w.v(cw.a.length);w.cat(cw.a);
 }
 return {bytes:w.arr(),stats:{literals:literals,backrefs:backrefs,copied:copied,blocks:blocks,deltaBytes:deltaBytes,windowTokens:128}};
}
function decodePattern(bytes,count){var r=new Reader(bytes),blocks=r.v(),all=[];assert(blocks<=Math.ceil(count/64)+1,'too many blocks');for(var b=0;b<blocks;b++){
 var want=r.v(),length=r.v(),end=r.i+length;assert(want>0&&want<=2048,'bad pattern block count');assert(end<=bytes.length,'truncated pattern block');var block=[];
 while(r.i<end){var cmd=r.b();if(cmd===0){var n=r.v();assert(n>0&&n<=want-block.length,'invalid literal count');for(var k=0;k<n;k++)block.push(getToken(r));}
  else if(cmd===1){var dist=r.v(),num=r.v();assert(dist>=1&&dist<=128&&dist<=block.length&&num>=4&&num<=255&&num<=want-block.length,'invalid pattern backreference');for(var m=0;m<num;m++)block.push(block[block.length-dist]);}
  else throw Error('bad pattern opcode '+cmd);
 }
 assert(r.i===end&&block.length===want,'pattern block size mismatch');all.push.apply(all,block);assert(all.length<=count,'too many events decoded');}
 r.done();assert(all.length===count,'decoded event count mismatch');return expandTokens(all);
}
function encodeVM(actions,allowWrites){var w=new Writer(),prev=0;actions=normalizeActions(actions);
 for(var i=0;i<actions.length;i++){var a=actions[i];w.v(a.cycle-prev);prev=a.cycle;
  if(a.type==='on'){w.b(1);w.b(a.voice);w.b(a.midi);w.b(INST[a.instrument]);w.b(a.volume);}
  else if(a.type==='off'){w.b(2);w.b(a.voice);}
  else{assert(allowWrites,'E3 does not support direct AY writes');w.b(3);w.b(a.chip*16+a.reg);w.b(a.value);}
 }
 return {bytes:w.arr(),stats:{actions:actions.length,notes:actions.filter(function(a){return a.type==='on';}).length,directWrites:actions.filter(function(a){return a.type==='write';}).length}};
}
function decodeVM(bytes,count,cpuHz,ayHz,durationCycles,allowWrites){var r=new Reader(bytes),actions=[],current=0;for(var i=0;i<count;i++){
 current+=r.v();assert(current<=durationCycles,'VM event outside duration');var op=r.b();
 if(op===1){var voice=r.b(),midi=r.b(),inst=r.b(),vol=r.b();assert(inst<INS_BY_ID.length,'unsupported instrument');actions.push(action(current,'on',voice,midi,INS_BY_ID[inst],vol));}
 else if(op===2)actions.push(action(current,'off',r.b()));
 else if(op===3&&allowWrites){var id=r.b(),value=r.b();assert(id<32,'invalid direct register');actions.push(action(current,'write',null,null,null,null,{chip:id>>>4,reg:id&15,value:value}));}
 else throw Error('unsupported VM opcode '+op);
 }
 r.done();return {actions:actions,events:compileActions({cpuHz:cpuHz,ayHz:ayHz,durationCycles:durationCycles,actions:actions})};
}
function wrap(codec,payload,score,eventCount,actionCount){var w=new Writer();w.cat(bytesOf('AYSB'));w.b(VERSION);w.b(codec);w.b(0);w.b(0);w.u32(score.cpuHz);w.u32(score.ayHz);w.u32(score.durationCycles);w.u32(eventCount);w.u32(actionCount);w.u32(payload.length);w.u32(checksum(payload));w.cat(payload);return w.arr();}
function unwrap(binary){var r=new Reader(binary);assert(r.b()===65&&r.b()===89&&r.b()===83&&r.b()===66,'not AYSB format');var ver=r.b(),codec=r.b(),flags=r.b(),reserved=r.b();assert(ver===VERSION,'unsupported AYSB version');assert(codec>=0&&codec<=4,'unsupported codec');assert(flags===0&&reserved===0,'unsupported header flags');var cpuHz=r.u32(),ayHz=r.u32(),durationCycles=r.u32(),eventCount=r.u32(),actionCount=r.u32(),size=r.u32(),hash=r.u32();assert(eventCount<=MAX_EVENTS&&actionCount<=MAX_ACTIONS,'untrusted file exceeds safety limits');assert(size===binary.length-r.i,'binary payload length mismatch');var payload=binary.slice(r.i);assert(checksum(payload)===hash,'binary payload checksum mismatch');return {codec:codec,cpuHz:cpuHz,ayHz:ayHz,durationCycles:durationCycles,eventCount:eventCount,actionCount:actionCount,payload:payload};}
function encode(codec,score,opts){validateScore(score);assert(CODECS.some(function(c){return c.key===codec;}),'unknown encoding '+codec);var base=normalizeEvents(score.events),actions=score.actions||[],r,actualCodec=codec,hasVM=score.kind==='synthetic';
 if(codec==='E0')r=encodeRaw(base);else if(codec==='E1')r=encodeDelta(base);else if(codec==='E2')r=encodePattern(base,opts);
 else if(codec==='E3'){
  assert(hasVM&&actions.every(function(a){return a.type!=='write';}),'E3 requires supported notes without arbitrary direct writes');r=encodeVM(actions,false);
 }else{
  var pattern=encodePattern(base,opts),candidate=hasVM?encodeVM(actions,true):null;
  var w=new Writer();if(candidate&&candidate.bytes.length<pattern.bytes.length){w.b(1);w.cat(candidate.bytes);r={bytes:w.arr(),stats:Object.assign({hybridMode:'VM with direct escapes'},candidate.stats)};}
  else{w.b(0);w.cat(pattern.bytes);r={bytes:w.arr(),stats:Object.assign({hybridMode:'LZ event fallback'},pattern.stats)};}
 }
 var id=CODECS.filter(function(c){return c.key===codec;})[0].id,binary=wrap(id,r.bytes,score,base.length,actions.length);
 return {codec:codec,binary:binary,bytes:binary.length,payloadBytes:r.bytes.length,headerBytes:36,stats:r.stats,roundTrip:compareEvents(base,decode(binary).events),actualCodec:actualCodec};
}
function decode(binary){assert(binary instanceof Uint8Array,'Uint8Array required');var h=unwrap(binary),kind=CODECS[h.codec].key,events,actions=[],mode=kind;
 if(kind==='E0')events=decodeRaw(h.payload,h.eventCount);
 if(kind==='E1')events=decodeDelta(h.payload,h.eventCount);
 if(kind==='E2')events=decodePattern(h.payload,h.eventCount);
 if(kind==='E3'){var v=decodeVM(h.payload,h.actionCount,h.cpuHz,h.ayHz,h.durationCycles,false);events=v.events;actions=v.actions;}
 if(kind==='E4'){
 var variant=h.payload[0];assert(variant===0||variant===1,'bad E4 variant');mode=variant===0?'E2 event fallback':'Instrument VM + direct writes';if(variant===0)events=decodePattern(h.payload.slice(1),h.eventCount);
 else{var v2=decodeVM(h.payload.slice(1),h.actionCount,h.cpuHz,h.ayHz,h.durationCycles,true);events=v2.events;actions=v2.actions;}
 }
 assert(events.length===h.eventCount,'decoded event count differs from header');return {codec:kind,mode:mode,events:events,actions:actions,cpuHz:h.cpuHz,ayHz:h.ayHz,durationCycles:h.durationCycles};
}
function defaultCost(opts){
 opts=opts||{};
 var via=Number(opts.cyclesPerWrite==null?50:opts.cyclesPerWrite),budget=Number(opts.musicBudget==null?15:opts.musicBudget),graphics=Number(opts.graphicsPercent==null?55:opts.graphicsPercent),reserve=Number(opts.reservePercent==null?10:opts.reservePercent),toleranceUs=Number(opts.toleranceUs==null?1000:opts.toleranceUs),memoryBudgetKiB=Number(opts.memoryBudgetKiB==null?16:opts.memoryBudgetKiB),streamBufferBytes=Number(opts.streamBufferBytes==null?512:opts.streamBufferBytes);
 var mode=opts.schedulerMode||'irq',interruptOverheadCycles=Number(opts.interruptOverheadCycles==null?32:opts.interruptOverheadCycles);
 assert(Number.isFinite(via)&&via>=1&&via<=500,'cycles/write out of range');
 assert(Number.isFinite(budget)&&budget>0&&budget<=95,'music budget out of range');
 assert(Number.isFinite(graphics)&&graphics>=0&&graphics<=95,'graphics fraction out of range');
 assert(Number.isFinite(reserve)&&reserve>=0&&reserve<=75,'host reserve out of range');
 assert(Number.isFinite(toleranceUs)&&toleranceUs>=0&&toleranceUs<=100000,'tolerance invalid');
 assert(Number.isFinite(memoryBudgetKiB)&&memoryBudgetKiB>=1&&memoryBudgetKiB<=64,'memory budget invalid');
 int(streamBufferBytes,'stream buffer bytes',64,8192);
 assert(mode==='irq'||mode==='cooperative','scheduler mode must be irq or cooperative');
 int(interruptOverheadCycles,'IRQ entry cycles',0,500);
 assert(['idle','steady','action','bursty'].indexOf(opts.graphicsProfile||'steady')>=0,'invalid graphics profile');
 return {cyclesPerWrite:via,musicBudget:budget,graphicsPercent:graphics,reservePercent:reserve,toleranceUs:toleranceUs,memoryBudgetKiB:memoryBudgetKiB,streamBufferBytes:streamBufferBytes,graphicsProfile:opts.graphicsProfile||'steady',chunkSize:Number(opts.chunkSize||512),schedulerMode:mode,interruptOverheadCycles:interruptOverheadCycles};
}
function graphicsAt(frame,model){var base=model.graphicsPercent;if(model.graphicsProfile==='idle')return Math.min(95,base*.45);if(model.graphicsProfile==='action')return Math.min(98,base+(frame%6>=3&&frame%6<=4?30:0));if(model.graphicsProfile==='bursty')return Math.min(98,base+(frame%8===0?45:frame%8===1?20:0));return base;}
function availableAt(frame,model){return Math.min(model.musicBudget,Math.max(0,100-graphicsAt(frame,model)-model.reservePercent));}
function eventDecodeCycles(codec,enc){var s=enc.stats||{},n=s.literals+s.copied;if(codec==='E0')return 12;
 if(codec==='E1')return 18+(s.deltaBytes/Math.max(1,n))*6;
 if(codec==='E2')return ((s.literals*24+s.copied*11+s.backrefs*26+s.blocks*30)/Math.max(1,n));
 if(codec==='E3')return 15+(s.actions||0)*65/Math.max(1,n);
 if(codec==='E4')return s.hybridMode==='LZ event fallback'?((s.literals*24+s.copied*11+s.backrefs*26+s.blocks*30)/Math.max(1,n)):15+(s.actions||0)*70/Math.max(1,n);
 return 20;
}
/* A deterministic service-window model, NOT cycle-accurate graphics emulation.
 * Tasks always execute at nominal 6502 speed. In cooperative mode the last N%
 * of each 20ms frame forms one uninterrupted CPU window for music. An IRQ can
 * preempt graphics at task release; its budget cost is charged against graphics.
 * modelOnlyBus omits decode, notes and IRQ entry costs for the physical lower
 * bound. All three runs share exactly the same task order and due timestamps.
 */
function serviceTasks(tasks,score,model,variant){
 var frameLen=score.cpuHz/50,now=0,finishes=new Array(tasks.length),totalCycles=0,irqEntries=0;
 var byFrame=new Map(),canRun=variant!=='cooperative'||Array.from({length:24},function(_,i){return availableAt(i,model)>0;}).some(Boolean);
 if(!canRun)return {capacityExhausted:true,finishes:finishes,now:null,totalCycles:0,irqEntries:0,frameWork:byFrame};
 for(var i=0;i<tasks.length;i++){
  var t=tasks[i],due=t.cycle;
  var cost=variant==='bus'?(t.kind==='write'?model.cyclesPerWrite:0):t.cost;
  if(cost===0){finishes[i]=Math.max(now,due);continue;}
  // IRQ dispatch is once per contiguous processing burst, not once per AY write.
  if(variant==='irq'&&now<=due){cost+=model.interruptOverheadCycles;irqEntries++;}
  var fDue=Math.floor(due/frameLen);byFrame.set(fDue,(byFrame.get(fDue)||0)+cost);
  totalCycles+=cost;now=Math.max(now,due);
  if(variant==='cooperative'){
   var remaining=cost,guard=0;
   while(remaining>1e-7){
    if(++guard>200000)throw new Error('cooperative scheduler ran out of frame windows');
    var f=Math.floor(now/frameLen),start=f*frameLen,end=start+frameLen,cap=availableAt(f,model);
    if(cap<=0){now=end;continue;}
    var windowStart=end-frameLen*cap/100;
    if(now<windowStart)now=windowStart;
    if(now>=end-1e-7){now=end;continue;}
    var grant=Math.min(remaining,end-now);
    now+=grant;remaining-=grant;
    if(remaining>1e-7&&now>=end-1e-7)now=end;
   }
  }else{now+=cost;}
  finishes[i]=now;
 }
 return {capacityExhausted:false,finishes:finishes,now:now,totalCycles:totalCycles,irqEntries:irqEntries,frameWork:byFrame};
}
function simulateSchedule(score,encoded,model){
 model=defaultCost(model);
 var ev=score.events,frameLen=score.cpuHz/50,tolerance=score.cpuHz*model.toleranceUs/1e6;
 var dpc=eventDecodeCycles(encoded.codec,encoded);
 var vm=(encoded.codec==='E3'||(encoded.codec==='E4'&&encoded.stats.hybridMode==='VM with direct escapes'));
 var tasks=ev.map(function(e,i){return {cycle:e.cycle,kind:'write',order:i,eventIndex:i,cost:model.cyclesPerWrite+(vm?12:dpc)};});
 if(vm)(score.actions||[]).forEach(function(a,i){tasks.push({cycle:a.cycle,kind:'command',order:i,eventIndex:null,cost:a.type==='on'?95:a.type==='off'?55:40});});
 tasks.sort(function(a,b){return a.cycle-b.cycle||(a.kind===b.kind?a.order-b.order:a.kind==='command'?-1:1);});
 // Three synchronized simulations: physical writes only, ideal music at full
 // speed including decoder/dispatch, and actual mode with graphics windows.
 var bus=serviceTasks(tasks,score,model,'bus');
 var intrinsic=serviceTasks(tasks,score,model,model.schedulerMode==='irq'?'irq':'full');
 var actual=model.schedulerMode==='irq'?intrinsic:serviceTasks(tasks,score,model,'cooperative');
 var frameDemand=new Map(),frameMiss=new Map(),eventDetails=[],missed=0,missBus=0,missDecode=0,missGraphics=0,maxLate=0,maxBus=0,maxDecode=0,maxGraphics=0,totalLate=0;
 var budgetConflictCycles=0,missExamples=[];
 var frames=Math.ceil(score.durationCycles/frameLen),timeline=[],peak=0,overBudget=0;
 for(var i=0;i<tasks.length;i++){
  var t=tasks[i];if(t.kind!=='write')continue;
  var desired=t.cycle,busLate=Math.max(0,bus.finishes[i]-desired),intrinsicLate=Math.max(0,intrinsic.finishes[i]-desired);
  var totalLate=actual.capacityExhausted?null:Math.max(0,actual.finishes[i]-desired);
  var decodeLate=Math.max(0,intrinsicLate-busLate),graphicsLate=totalLate===null?null:Math.max(0,totalLate-intrinsicLate);
  maxBus=Math.max(maxBus,busLate);maxDecode=Math.max(maxDecode,decodeLate);
  if(busLate>tolerance)missBus++;
  if(intrinsicLate>tolerance&&busLate<=tolerance)missDecode++;
  if(totalLate===null||totalLate>tolerance){missed++;var fDue=Math.floor(desired/frameLen);frameMiss.set(fDue,(frameMiss.get(fDue)||0)+1);
   if(totalLate===null||(intrinsicLate<=tolerance&&totalLate>tolerance))missGraphics++;
   if(missExamples.length<12)missExamples.push({eventIndex:t.eventIndex,cycle:desired,chip:ev[t.eventIndex].chip,reg:ev[t.eventIndex].reg,totalUs:totalLate===null?null:totalLate/score.cpuHz*1e6,busUs:busLate/score.cpuHz*1e6,decoderUs:decodeLate/score.cpuHz*1e6,graphicsWaitUs:graphicsLate===null?null:graphicsLate/score.cpuHz*1e6});
  }
  if(totalLate!==null){maxLate=Math.max(maxLate,totalLate);maxGraphics=Math.max(maxGraphics,graphicsLate);}
  eventDetails.push({totalLate:totalLate,busLate:busLate,decoderLate:decodeLate,graphicsLate:graphicsLate});
 }
 var totalLateSum=0;for(var j=0;j<eventDetails.length;j++)if(eventDetails[j].totalLate!==null)totalLateSum+=eventDetails[j].totalLate;
 for(var f=0;f<frames;f++){
  var demand=(actual.frameWork.get(f)||0)/frameLen*100,capacity=availableAt(f,model);
  peak=Math.max(peak,demand);if(demand>capacity+1e-7){overBudget++;budgetConflictCycles+=((demand-capacity)/100)*frameLen;}
  timeline.push({frame:f,timeSeconds:f/50,demandPercent:demand,availablePercent:capacity,missed:frameMiss.get(f)||0});
 }
 return {
  schedulerMode:model.schedulerMode,estimatedDecodeCyclesPerEvent:dpc,estimatedTotalCycles:actual.capacityExhausted?tasks.reduce(function(n,t){return n+t.cost;},0):actual.totalCycles,
  avgMusicCpuPercent:(actual.capacityExhausted?tasks.reduce(function(n,t){return n+t.cost;},0):actual.totalCycles)/score.durationCycles*100,
  peakFrameDemandPercent:peak,overBudgetFrames:overBudget,frames:frames,missedDeadlines:missed,eventCount:ev.length,
  commandCount:vm?(score.actions||[]).length:0,maximumBusSerializationUs:maxBus/score.cpuHz*1e6,
  maximumDecodeAndDispatchUs:maxDecode/score.cpuHz*1e6,maximumGraphicsWaitUs:actual.capacityExhausted?null:maxGraphics/score.cpuHz*1e6,
  missesBusSerialization:missBus,missesDecodeAndDispatch:missDecode,missesGraphicsContention:missGraphics,
  maxLatenessUs:actual.capacityExhausted?null:maxLate/score.cpuHz*1e6,
  meanLatenessUs:actual.capacityExhausted?null:(ev.length?totalLateSum/ev.length/score.cpuHz*1e6:0),
  deadlineToleranceUs:model.toleranceUs,finishSeconds:actual.capacityExhausted?null:actual.now/score.cpuHz,
  capacityExhausted:actual.capacityExhausted,irqDispatches:actual.irqEntries,graphicsBudgetOvercommitCycles:model.schedulerMode==='irq'?budgetConflictCycles:0,
  missedExamples:missExamples,frameTimeline:timeline,model:model
 };
}
function schedulerChecks(){
 var results=[],sc=fromEventJson({cpuHz:1023000,ayHz:1021800,durationCycles:1023000,events:Array.from({length:15},function(_,i){return {cycle:0,chip:0,reg:8,value:i};})});
 var encoded=encode('E0',sc),base={cyclesPerWrite:50,musicBudget:30,graphicsPercent:55,reservePercent:10,graphicsProfile:'action',toleranceUs:1000};
 var irq=simulateSchedule(sc,encoded,Object.assign({},base,{schedulerMode:'irq'}));
 var coop=simulateSchedule(sc,encoded,Object.assign({},base,{schedulerMode:'cooperative'}));
 function check(name,ok,details){results.push({name:name,pass:!!ok,detail:details});}
 check('IRQ uses nominal CPU speed',irq.missedDeadlines===0&&irq.maxLatenessUs<1000,'15 same-cycle writes, IRQ maximum '+irq.maxLatenessUs.toFixed(1)+' us');
 check('Cooperative blocking adds delay',coop.missedDeadlines>irq.missedDeadlines&&coop.maximumGraphicsWaitUs>0,'Cooperative '+coop.missedDeadlines+' misses vs IRQ '+irq.missedDeadlines);
 check('Intrinsically serial writes are accounted separately',irq.maximumBusSerializationUs>0&&irq.maximumDecodeAndDispatchUs>0&&irq.missesGraphicsContention===0,'Physical and decoder components are reported independently');
 var quiet=simulateSchedule(sc,encoded,Object.assign({},base,{schedulerMode:'irq',graphicsPercent:5,graphicsProfile:'steady'}));
 check('IRQ deadlines independent of graphics profile',quiet.missedDeadlines===irq.missedDeadlines&&quiet.maxLatenessUs===irq.maxLatenessUs,'Different graphics utilization does not slow an interrupt-driven 6502');
 var more=simulateSchedule(sc,encoded,Object.assign({},base,{schedulerMode:'irq',cyclesPerWrite:120}));
 check('Higher bus cost increases intrinsic lateness',more.maximumBusSerializationUs>irq.maximumBusSerializationUs,'Bus serialization cost increases when VIA cost increases');
 var exhausted=simulateSchedule(sc,encoded,Object.assign({},base,{schedulerMode:'cooperative',graphicsPercent:95,reservePercent:10,graphicsProfile:'steady'}));
 check('Exhausted cooperative CPU is explicit',exhausted.capacityExhausted&&exhausted.missedDeadlines===15,'No cooperative CPU window; codec remains valid');
 var report=benchmark(sc,Object.assign({},base,{schedulerMode:'irq'}));
 check('All E0/E1/E2/E4 preserve the same score',report.results.filter(function(r){return r.status==='ok';}).length===4&&report.results.every(function(r){return r.status!=='ok'||r.validation.equal;}),'Codec round-trips unchanged');
 return {passed:results.filter(function(r){return r.pass;}).length,total:results.length,results:results};
}
function memoryModel(score,enc,opts){var model=defaultCost(opts),code=CODE_BYTES[enc.codec],instructions=0,types=new Set();(score.actions||[]).forEach(function(a){if(a.type==='on')types.add(a.instrument);});
 if(enc.codec==='E3'||(enc.codec==='E4'&&enc.stats.hybridMode==='VM with direct escapes'))types.forEach(function(k){instructions+=INSTR_BYTES[k]||0;});
 var voiceState=VOICES.length*12,state=64+voiceState,history=(enc.codec==='E2'||(enc.codec==='E4'&&enc.stats.hybridMode==='LZ event fallback'))?128*6:0;
 var tempBuffers=(enc.codec==='E3'||(enc.codec==='E4'&&enc.stats.hybridMode==='VM with direct escapes'))?48:32;
 var ram=state+history+tempBuffers,buffer=model.streamBufferBytes*2,streamResident=code+instructions+ram+buffer,allResident=code+instructions+ram+enc.bytes;
 return {scoreBytes:enc.bytes,playerCodeBytes:code,instrumentBytes:instructions,workingRamBytes:ram,streamBuffersBytes:buffer,fullyResidentBytes:allResident,streamingResidentBytes:streamResident,fullyResidentFitsBudget:allResident<=model.memoryBudgetKiB*1024,streamingFitsBudget:streamResident<=model.memoryBudgetKiB*1024,workingWindowTokens:history?128:0,totalStorageBytes:enc.bytes};
}
function benchmark(score,options){options=options||{};validateScore(score);var codecs=options.codecs||CODECS.map(function(c){return c.key;}),out=[];var start=Date.now();
 for(var k=0;k<codecs.length;k++){
  var id=codecs[k];try{var enc=encode(id,score,options),validation=enc.roundTrip,schedule=simulateSchedule(score,enc,options),memory=memoryModel(score,enc,options);
   out.push({codec:id,status:validation.equal?'ok':'mismatch',validation:validation,encoded:enc,cycles:schedule,memory:memory,compressionRatio:score.events.length*6/Math.max(1,enc.bytes),scoreBytesPerSecond:enc.bytes/(score.durationCycles/score.cpuHz)});
  }catch(e){out.push({codec:id,status:'unavailable',reason:e.message});}
 }
 var valid=out.filter(function(r){return r.status==='ok';});valid.forEach(function(a){a.pareto=!valid.some(function(b){return b!==a&&b.memory.fullyResidentBytes<=a.memory.fullyResidentBytes&&b.cycles.estimatedTotalCycles<=a.cycles.estimatedTotalCycles&&(b.memory.fullyResidentBytes<a.memory.fullyResidentBytes||b.cycles.estimatedTotalCycles<a.cycles.estimatedTotalCycles);});});
 return {schema:SCHEMA,version:VERSION,score:{kind:score.kind,scenario:score.scenario,durationSeconds:score.durationCycles/score.cpuHz,events:score.events.length,actions:(score.actions||[]).length,cpuHz:score.cpuHz,ayHz:score.ayHz,seed:score.seed,bpm:score.bpm,importInfo:score.importInfo||null},model:defaultCost(options),modelsAreEstimates:true,elapsedMs:Date.now()-start,results:out};
}
function exportReport(report){return {schema:report.schema,version:report.version,score:report.score,model:report.model,modelsAreEstimates:true,elapsedMs:report.elapsedMs,results:report.results.map(function(r){if(r.status!=='ok')return {codec:r.codec,status:r.status,reason:r.reason};return {codec:r.codec,status:r.status,pareto:r.pareto,bytes:r.encoded.bytes,compressionRatio:r.compressionRatio,scoreBytesPerSecond:r.scoreBytesPerSecond,codecStats:r.encoded.stats,validation:r.validation,memory:r.memory,cycles:Object.assign({},r.cycles,{frameTimeline:r.cycles.frameTimeline})};})};}
function csv(report){var headings=['codec','status','scoreBytes','ratio','fullyResidentBytes','streamingResidentBytes','schedulerMode','avgMusicCpuPercent','peakFrameDemandPercent','missedDeadlines','missesBusSerialization','missesDecodeAndDispatch','missesGraphicsContention','maximumBusSerializationUs','maximumDecodeAndDispatchUs','maximumGraphicsWaitUs','graphicsBudgetOvercommitCycles','estimatedTotalCycles','pareto'];var lines=[headings.join(',')];report.results.forEach(function(r){lines.push([r.codec,r.status,r.encoded?r.encoded.bytes:'',r.compressionRatio||'',r.memory?r.memory.fullyResidentBytes:'',r.memory?r.memory.streamingResidentBytes:'',r.cycles?r.cycles.schedulerMode:'',r.cycles?r.cycles.avgMusicCpuPercent:'',r.cycles?r.cycles.peakFrameDemandPercent:'',r.cycles?r.cycles.missedDeadlines:'',r.cycles?r.cycles.missesBusSerialization:'',r.cycles?r.cycles.missesDecodeAndDispatch:'',r.cycles?r.cycles.missesGraphicsContention:'',r.cycles?r.cycles.maximumBusSerializationUs:'',r.cycles?r.cycles.maximumDecodeAndDispatchUs:'',r.cycles?r.cycles.maximumGraphicsWaitUs:'',r.cycles?r.cycles.graphicsBudgetOvercommitCycles:'',r.cycles?r.cycles.estimatedTotalCycles:'',r.pareto===true?'true':'false'].join(','));});return lines.join('\n')+'\n';}
function hex(binary,limit){limit=limit||256;var lines=[];for(var i=0;i<Math.min(binary.length,limit);i+=16){var slice=Array.from(binary.slice(i,i+16));lines.push(i.toString(16).padStart(6,'0')+': '+slice.map(function(x){return x.toString(16).padStart(2,'0');}).join(' '));}if(binary.length>limit)lines.push('… '+(binary.length-limit)+' more bytes');return lines.join('\n');}
return {SCHEMA:SCHEMA,VERSION:VERSION,CODECS:CODECS,INST:INST,VOICES:VOICES,generate:generate,fromWaveformSurvey:fromWaveformSurvey,fromEventJson:fromEventJson,normalizeEvents:normalizeEvents,compileActions:compileActions,encode:encode,decode:decode,benchmark:benchmark,simulateSchedule:simulateSchedule,memoryModel:memoryModel,exportReport:exportReport,csv:csv,hex:hex,compareEvents:compareEvents,defaultCost:defaultCost,schedulerChecks:schedulerChecks};
});
