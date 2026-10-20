#!/usr/bin/env node
'use strict';
// Phase 4C.0 diagnostic only: compare current SIDAudio envelope observations
// against an independent, deliberately slow, idealized per-SID-cycle model.
// Never imported by production/browser and never used in timed benchmarks.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const B=require('./SID_AUDIO_BENCH_core.js');
const {compareTrace}=require('../tests/helpers/sid_adsr_cycle_reference.js');
const root=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
const fixtureArg=args.find(a=>a.startsWith('--fixture='));
const all=args.includes('--all');
const clockArg=args.find(a=>a.startsWith('--clock='));
const clock=clockArg?clockArg.split('=')[1]:'PAL';
if(!Object.hasOwn(B.CLOCKS,clock))throw new Error('Unknown clock: '+clock);
const fixtures=all?B.FIXTURES.filter(f=>f.suite==='4C').map(f=>f.id):
  [fixtureArg?fixtureArg.slice('--fixture='.length):'adsr-rate-change'];
for(const name of fixtures)if(B.fixtureSuite(name)!=='4C')
  throw new Error('Expected a 4C fixture: '+name);
const c=vm.createContext({console,Math,Number,Float32Array,Uint8Array,
  Uint16Array,Int16Array,ArrayBuffer,DataView});
vm.runInContext(fs.readFileSync(path.join(root,'res/EMU_DEVICE_SID_audio.js'),'utf8'),
  c,{filename:'EMU_DEVICE_SID_audio.js'});
const runs=[];
for(const fixture of fixtures)for(const model of [6581,8580]){
 const trace=B.traceEnvelope(c.SIDAudio,{fixture,clock,model,stride:64});
 runs.push(compareTrace(trace));
}
process.stdout.write(JSON.stringify({
 schema:'retroapplejs.sid.adsr-cycle-comparison.v1',
 purpose:'Diagnostic differences; not a claim of hardware-cycle accuracy',
 clock,sampleRate:B.RATE,fixtureCount:fixtures.length,runs
},null,2)+'\n');
