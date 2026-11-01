#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'tools/PAY_Interpreter.html'),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/)?.[1];
const guide=html.match(/<script type="text\/plain" id="fallback-doc">([\s\S]*?)<\/script>/)?.[1];
assert(script&&guide);
assert(html.includes('id="saveComplete"'));
const elements={};
function el(id){return elements[id]||(elements[id]={value:id==='model'?'gpt-5':id==='outputTokens'?'12000':id==='traceFrames'?'300':id==='subtune'?'1':id==='reasonEffort'?'low':'',textContent:id==='fallback-doc'?guide:'',disabled:false,checked:true,dataset:{},style:{},addEventListener(){},files:null});}
const context={console,window:{},document:{getElementById:el},fetch:async()=>({ok:false,status:404}),setTimeout,clearTimeout,Blob,URL,AbortController,DOMException};
vm.createContext(context);
vm.runInContext(script,context,{timeout:25000});
function fixture(name){const v=fs.readFileSync(path.join(ROOT,'tests/fixtures',name));return v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength);}
(async()=>{
 const raw=fixture('selfmod_gate.sid');context.__input=raw;
 await vm.runInContext(`(async()=>{
  const bytes=new Uint8Array(__input);
  const h=parseSID(__input),res=disassemble(h);
  current={name:'selfmod_gate.sid',h,res,sourceBytes:bytes};
  updateSummary(h,res);
  await runTraceUI();
  reportParts.push({batch:1,text:'Verified stub GPT report',id:'resp_test_123',status:'completed',usage:{input_tokens:20,output_tokens:30}});
  $('gpt').value='# Batch 1/1\\n\\nVerified stub GPT report';
  $('apiState').textContent='CONNECTED HTTP 200';
  $('keyInput').value='sk-MUST_NOT_EXPORT_CREDENTIAL';
  apiLog('Connection test SUCCESS; response ID=resp_test_123');
 })()`,context,{timeout:45000});
 const report=JSON.parse(JSON.stringify(context.window.PAYTest.buildCompletePAYReport()));
 assert.equal(report.format,'PAY_Complete_Report_v0.5.1');
 assert.equal(report.completeness.completedFrames,300);
 assert.equal(report.runtimeTrace.summary.selfModifyingWrites,300);
 assert.equal(report.runtimeTrace.sidEvents.length,300);
 assert.equal(report.musicalIR.metrics.noteCandidates,0);
 assert.equal(report.musicalIR.metrics.unpitchedGateOns,150);
 assert.equal(report.musicalIR.observedRepetition.period,2);
 assert(report.readableReports.annotatedAssembly.includes('LIVE VARIANTS'));
 assert(report.readableReports.traceOverview.includes('Self-modifying code'));
 assert(report.readableReports.musicalIROverview.includes('unpitched GATE on=150'));
 assert(report.gpt.fullVisibleReport.includes('Verified stub GPT report'));
 assert(report.gpt.completedBatches[0].responseId==='resp_test_123');
 assert(report.interpretationGuide.text.includes('SID Interpreter'));
 assert(report.diagnostics.sessionAPILog.some(s=>s.includes('resp_test_123')));
 assert.deepEqual(Buffer.from(report.source.originalSID.base64,'base64'),Buffer.from(raw));
 assert(!JSON.stringify(report).includes('sk-MUST_NOT_EXPORT_CREDENTIAL'));
 assert(report.completeness.missingStagesOrLimits.length===0);
 console.log('PASS: one report combines source bytes, self-modifying instruction evidence, complete raw SID events, musical IR, GPT report, guide, and diagnostics without API credentials.');
 const raw2=fixture('indirect_read.sid');context.__input=raw2;
 const partial=await vm.runInContext(`(async()=>{const h=parseSID(__input),res=disassemble(h);current={name:'indirect_read.sid',h,res,sourceBytes:new Uint8Array(__input)};updateSummary(h,res);await runTraceUI();return buildCompletePAYReport();})()`,context,{timeout:45000});
 const partialResult=JSON.parse(JSON.stringify(partial));
 assert.equal(partialResult.runtimeTrace.dataReads.length,300); // default GUI requests 300 frames
 assert(partialResult.readableReports.observedDataReadsCSV.includes('$1040'));
 assert.equal(partialResult.gpt.completedBatches.length,0);
 assert(partialResult.completeness.missingStagesOrLimits.some(x=>x.includes('GPT')));
 console.log('PASS: indirect-read events and CSV consolidated; absent GPT report is explicitly identified.');
 const stat=vm.runInContext(`(()=>{const h=parseSID(__input),res=disassemble(h);current={name:'indirect_read.sid',h,res,sourceBytes:new Uint8Array(__input)};updateSummary(h,res);return buildCompletePAYReport();})()`,context);
 assert.equal(stat.runtimeTrace,null);
 assert.equal(stat.musicalIR,null);
 assert(stat.completeness.missingStagesOrLimits.some(x=>x.includes('Runtime')));
 console.log('PASS: static-only export explicitly identifies unperformed stages.');
})().catch(e=>{console.error(e);process.exitCode=1});
