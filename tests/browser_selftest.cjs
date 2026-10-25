// Developer-only harness. Acceptance is through the standalone browser UI.
const fs=require('fs'),vm=require('vm');
const h=fs.readFileSync(__dirname+'/../tools/AY_SCORE_MB04_VERIFY.html','utf8');
const src=h.match(/<script>([\s\S]*?)<\/script>/)?.[1];if(!src)throw Error('missing inline JS');
const elems={};const doc={getElementById(id){if(!elems[id])elems[id]={id,innerHTML:'',textContent:'',disabled:false,hidden:false,value:'',files:[],events:{},addEventListener(e,f){this.events[e]=f},getContext(){return {clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){}}}};return elems[id]},createElement(){return {click(){}}}};
const context=vm.createContext({document:doc,console,Number,Array,Math,Error,JSON,Set,structuredClone,Blob,URL,setTimeout,Intl});vm.runInContext(src,context);
elems.self.events.click();console.log(elems.selfout.innerHTML);if(!elems.selfout.innerHTML.includes('8/8'))throw Error('selftest not fully passing');
console.log('Browser-only verifier synthetic suite: PASS');
(async()=>{
 const f=JSON.parse(fs.readFileSync(__dirname+'/SIMULATED_MOCKINGBOARD_HISTORY.json','utf8'));
 await elems.file.events.change({target:{files:[{name:'SIMULATED_MOCKINGBOARD_HISTORY.json',text:async()=>JSON.stringify(f)}]}});
 console.log('Simulated history result:',elems.status.innerHTML.replace(/<[^>]+>/g,''));
 if(!elems.status.innerHTML.includes('PASS'))throw Error('Verifier rejects instruction-level simulation reference: '+elems.status.innerHTML+' / '+elems.messages.innerHTML);
 console.log('Simulated trace round-trip: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
