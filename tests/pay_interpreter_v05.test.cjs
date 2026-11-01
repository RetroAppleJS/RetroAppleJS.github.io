#!/usr/bin/env node
'use strict';
// PAY Interpreter v0.5, dependency-free Node regression suite.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'tools/PAY_Interpreter.html'),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/)?.[1];
const doc=html.match(/<script type="text\/plain" id="fallback-doc">([\s\S]*?)<\/script>/)?.[1];
if(!script||!doc)throw Error('Cannot find embedded tool JavaScript / guide');
const elements={};function element(id){return elements[id]||(elements[id]={value:id==='model'?'gpt-5':id==='outputTokens'?'12000':id==='traceFrames'?'300':id==='subtune'?'1':'',textContent:id==='fallback-doc'?doc:'',disabled:false,checked:true,style:{},dataset:{},addEventListener(){},files:null});}
const context={console,window:{},document:{getElementById:element},fetch:async()=>({ok:false,status:404}),setTimeout,clearTimeout,Blob,URL,AbortController,DOMException};
vm.createContext(context);vm.runInContext(script,context,{timeout:25000});
function load(name){const f=fs.readFileSync(path.join(ROOT,'tests/fixtures',name));return f.buffer.slice(f.byteOffset,f.byteOffset+f.byteLength);}
async function trace(name,frames){const h=context.window.PAYTest.parseSID(load(name));const stat=context.window.PAYTest.disassemble(h);const result=await context.window.PAYTest.executePAYTrace(h,stat,{frames});assert.equal(result.summary.errors.length,0,`Execution errors: ${result.summary.errors.join(', ')}`);return {h,stat,result,ir:context.window.PAYTest.buildPAYMusicalIR(h,result)};}
(async()=>{
 let x=await trace('selfmod_gate.sid',300);
 assert.equal(x.result.summary.selfModifyingWrites,300);
 assert.equal(x.result.summary.sidWrites,300);
 assert.equal(x.ir.metrics.noteCandidates,0,'GATE with freq=0 must not invent a pitched note');
 assert.equal(x.ir.metrics.unpitchedGateOns,150);
 assert.equal(x.ir.observedRepetition.period,2);
 assert.equal(x.ir.metrics.rawGateEdges,300);
 console.log('PASS: 300 self-modifying dispatches / 300 SID writes / 2-state repetition / no fabricated notes');
 x=await trace('pitched.sid',24);
 assert.equal(x.ir.metrics.noteCandidates,1);
 console.log('PASS: nonzero frequency + gate + pulse becomes a pitch-bearing candidate');
 x=await trace('indirect_read.sid',15);
 assert.equal(x.ir.metrics.indirectReads,15);
 assert.equal(x.ir.indirectReadSites[0].examples[0].address,0x1040);
 assert.equal(x.ir.indirectReadSites[0].examples[0].value,0x34);
 assert.equal(x.ir.metrics.noteCandidates,1);
 console.log('PASS: 15 actual ($FE),Y reads from payload and correct effective value');
 context.__input=load('selfmod_gate.sid');
 const gui=await vm.runInContext(`(async()=>{let h=parseSID(__input);current={name:'selfmod_gate.sid',h,res:disassemble(h)};updateSummary(h,current.res);await runTraceUI();return {ir:current.musicalIR,context:runtimeGPTContext(current),traceText:$('traceText').value,irText:$('irText').value,exportEnabled:!$('saveIR').disabled};})()`,context,{timeout:30000});
 assert(gui.exportEnabled);assert(gui.context.includes('observedMusicalIR'));assert(gui.irText.includes('unpitched GATE on=150'));
 console.log('PASS: full GUI trace pipeline, IR preview/export control, GPT briefing evidence');
 console.log('All PAY-00.5 tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
