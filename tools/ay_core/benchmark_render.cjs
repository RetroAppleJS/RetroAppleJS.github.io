// Numerical render benchmark; run with node tools/ay_core/benchmark_render.cjs.
const {load}=require('../../tests/helpers/mockingboard_scheduler');
const {performance}=require('node:perf_hooks');
(async()=>{
 const results=[];
 for(const backend of ['js','wasm'])for(const [sampleRate,renderProfile] of [[44100,'reference'],[22050,'reference'],[22050,'economy']]) {
  const ctx=load(),c=await ctx.AYCore.create({backend,sampleRate,renderProfile,chipCount:2,timebaseHz:sampleRate,maxFrames:1024});
  for(let i=0;i<2;i++) {
   c.configureChip(i,{model:'AY',clockHz:1021800});
   c.setMix(i,[.5,.5,.5,.5,.5,.5]);
   for(const [r,v] of [[0,100],[2,170],[4,43],[6,3],[7,0],[8,16],[9,15],[10,12],[11,64],[13,10]])c.writeNow(i,r,v);
  }
  const out={left:new Float32Array(1024),right:new Float32Array(1024)};
  let tick=0;for(let b=0;b<500;b++)c.renderUntil(tick+=512,null,out);
  const runs=[];for(let r=0;r<5;r++) {
   const start=performance.now();for(let b=0;b<1000;b++)c.renderUntil(tick+=512,null,out);
   runs.push((performance.now()-start)/(512000/sampleRate));
  }
  runs.sort((a,b)=>a-b);results.push({backend,sampleRate,renderProfile,medianMsPerAudioSecond:runs[2],runs});c.destroy();
 }
 console.log(JSON.stringify({node:process.version,results},null,2));
})();
