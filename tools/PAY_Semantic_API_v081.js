/* PAY-00.8B candidate semantic-program handoff. Pure deterministic validator; no GPT call. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PAYSemanticAPI081=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const FORMAT='PAY_Semantic_Program_v0.8.1',CAP_FORMAT='PAY_Compiler_Capabilities_v0.8.1';
const CLASSES=['player','schedule','sequence','control','pitch','articulation','instrument','envelope','waveform','modulation','filter','volume','mix','hardware','source_state','unknown'];
const STATUS=['verified','inferred','hypothesis','unresolved'];
const REVIEW=['candidate','human_reviewed','rejected'];
const MODES=['emulate','approximate','omit','unresolved'];
const CLOCKS=['play_tick','subtick','source_irq','event','initialization'];
const TYPES=['u8','s8','u16','s16','bool','pointer16','table_ref','channel_ref','enum','q8_8'];
const EXPR_OPS=['add','sub','mul','div','mod','and','or','xor','shl','shr','eq','ne','lt','le','gt','ge','select','min','max','sign_extend','clamp'];
function isObject(x){return x&&typeof x==='object'&&!Array.isArray(x)}
function int(x){return Number.isSafeInteger(x)}
function checkExpr(x,errors,where,depth=0){
 if(depth>20){errors.push(where+': expression nesting too deep');return;}
 if(!isObject(x)||!['const','state','input','table_lookup','op'].includes(x.kind)||!TYPES.includes(x.type)){errors.push(where+': invalid typed expression');return;}
 if(x.kind==='const'&&!(typeof x.value==='boolean'||int(x.value)||typeof x.value==='string'))errors.push(where+': const must be scalar');
 if(['state','input'].includes(x.kind)&&typeof x.id!=='string')errors.push(where+': missing reference ID');
 if(x.kind==='table_lookup'){if(typeof x.tableId!=='string')errors.push(where+': missing table ID');checkExpr(x.index,errors,where+'.index',depth+1)}
 if(x.kind==='op'){if(!EXPR_OPS.includes(x.op)||!Array.isArray(x.args)||!x.args.length)errors.push(where+': invalid operation');else x.args.forEach((a,i)=>checkExpr(a,errors,where+'.args['+i+']',depth+1));}
}
function validate(program,capabilities,evidenceBundle,reviewApproval){
 const errors=[],warnings=[],required=[];const error=s=>errors.push(s),warn=s=>warnings.push(s);
 if(!isObject(program)||program.format!==FORMAT)return {valid:false,compilable:false,errors:['Expected '+FORMAT],warnings,requiredCapabilities:[]};
 if(!isObject(program.source)||!(/^[a-f0-9]{64}$/i).test(program.source.sha256PSID||'')||!int(program.source.subtune)||program.source.subtune<1)error('source must identify SHA256 PSID and selected subtune');
 if(!isObject(program.capture)||!int(program.capture.frames)||program.capture.frames<0||!Array.isArray(program.capture.limitations))error('capture frames and limitations required');
 if(!isObject(program.analysis)||!['partial','complete_candidate'].includes(program.analysis.scope)||!Array.isArray(program.analysis.uncoveredRegions))error('analysis scope/uncoveredRegions required');
 if(!Array.isArray(program.evidenceRefs)||!Array.isArray(program.state)||!Array.isArray(program.tables)||!Array.isArray(program.mechanisms)||!Array.isArray(program.unknowns))error('evidenceRefs, state, tables, mechanisms, unknowns must be arrays');
 if(errors.length)return {valid:false,compilable:false,errors,warnings,requiredCapabilities:[]};
 const evidence=new Set(program.evidenceRefs.map(x=>x.id)); const evidenceKinds=new Map(program.evidenceRefs.map(x=>[x.id,x.kind]));
 const ids=new Set(),stateIds=new Set(),tableIds=new Set(),mechIds=new Set();
 function exprRefs(x,where){
  if(!isObject(x))return;
  if(x.kind==='state' && !stateIds.has(x.id))error(where+': expression references undefined state '+x.id);
  if(x.kind==='table_lookup' && !tableIds.has(x.tableId))error(where+': expression references undefined table '+x.tableId);
  if(x.kind==='table_lookup')exprRefs(x.index,where+'.index');
  if(x.kind==='op')for(const [i,a] of (x.args||[]).entries())exprRefs(a,where+'.arg'+i);
  if(x.kind==='const'&&int(x.value)){
   const limits={u8:[0,255],s8:[-128,127],u16:[0,65535],s16:[-32768,32767],pointer16:[0,65535]};
   const lim=limits[x.type];if(lim&&(x.value<lim[0]||x.value>lim[1]))error(where+': out-of-range '+x.type+' constant '+x.value);
  }
 }

 const reference=(id,path)=>{if(!evidence.has(id))error(path+': unknown evidence '+id);};
 for(const e of program.evidenceRefs){if(!e.id||!['runtime','static','data','patch','prior_gpt','manual'].includes(e.kind))error('Malformed evidence reference');if(ids.has(e.id))error('Duplicate evidence '+e.id);ids.add(e.id);}
 if(evidenceBundle){
  if(evidenceBundle.source?.sha256PSID!==program.source.sha256PSID)error('PSID identity mismatch with evidence bundle');
  for(const e of program.evidenceRefs){if(!evidenceBundle.evidence?.[e.id])error('Evidence '+e.id+' not in supplied bundle');}
 }
 for(const s of program.state){if(!s.id||!TYPES.includes(s.type)||!isObject(s.initial)||!['known','derived','unresolved'].includes(s.initial.kind))error('Invalid state definition '+s.id);if(stateIds.has(s.id))error('Duplicate state '+s.id);stateIds.add(s.id);}
 for(const t of program.tables){if(!t.id||!['source_bytes','decoded','unknown'].includes(t.encoding)||!['verified','inferred','unresolved'].includes(t.semanticStatus)||!int(t.address)||t.address<0||t.address>65535||!int(t.length)||t.length<1)error('Invalid table definition '+t.id);if(tableIds.has(t.id))error('Duplicate table '+t.id);tableIds.add(t.id);for(const e of t.evidenceIds||[])reference(e,'table '+t.id);}
 for(const m of program.mechanisms){
  if(!m.id||mechIds.has(m.id))error('Missing or duplicate mechanism '+m.id);mechIds.add(m.id);
  if(!isObject(m.intent)||!CLASSES.includes(m.intent.category)||typeof m.intent.intentId!=='string'||!m.intent.intentId.includes('.'))error('Invalid intent for '+m.id);
  if(!isObject(m.proof)||!STATUS.includes(m.proof.level)||!REVIEW.includes(m.proof.review)||!Array.isArray(m.proof.evidenceIds))error('Invalid proof for '+m.id);
  else{
   for(const e of m.proof.evidenceIds)reference(e,'mechanism '+m.id);
   if(['verified','inferred'].includes(m.proof.level)&&!m.proof.evidenceIds.some(id=>evidenceKinds.get(id)!=='prior_gpt'))error('Mechanism '+m.id+' requires non-GPT evidence');
   if(m.proof.level==='verified'&&m.proof.review!=='human_reviewed')warn('Mechanism '+m.id+' has no completed human review');
  }
  if(!isObject(m.behavior)||!CLOCKS.includes(m.behavior.clock)||!Array.isArray(m.behavior.transitions))error('Invalid behavior for '+m.id);
  else m.behavior.transitions.forEach((tr,i)=>{
   if(!tr.id||!Array.isArray(tr.effects)||!tr.effects.length)error('Transition '+m.id+'['+i+'] missing named effects');
   if(tr.when){checkExpr(tr.when,errors,m.id+'.when['+i+']');exprRefs(tr.when,m.id+'.when['+i+']');if(tr.when.type!=='bool')error('Predicate must be bool in '+m.id+'.when['+i+']');}
   for(const [j,fx] of (tr.effects||[]).entries()){
    if(!['assign','emit_intent','call','dispatch','read_table'].includes(fx.kind))error('Illegal effect '+m.id+'['+i+']['+j+']');
    if(fx.kind==='assign'){if(!stateIds.has(fx.stateId))error('Effect targets unknown state '+fx.stateId);checkExpr(fx.value,errors,m.id+'.effect['+j+']');exprRefs(fx.value,m.id+'.effect['+j+']');}
    if(fx.kind==='read_table'&&!tableIds.has(fx.tableId))error('Unknown table '+fx.tableId);
    if(fx.kind==='dispatch'&&(!Array.isArray(fx.branches)||!fx.branches.length))error('Dispatch requires branches '+m.id);
   }
  });
  for(const input of m.inputs||[]){if(!input.id||!TYPES.includes(input.type))error('Invalid input '+m.id);if(input.expr){checkExpr(input.expr,errors,m.id+'.input '+input.id);exprRefs(input.expr,m.id+'.input '+input.id);}}
  if(!isObject(m.lowering)||!MODES.includes(m.lowering.mode)||typeof m.lowering.capabilityId!=='string'||!isObject(m.lowering.parameters)||!Array.isArray(m.lowering.constraints)||!Array.isArray(m.lowering.knownLosses))error('Invalid lowering plan for '+m.id);
  else{
   required.push(m.lowering.capabilityId);
   if(m.lowering.mode==='omit'&&!m.lowering.knownLosses.length)error('Omitted intent '+m.id+' must specify lost semantics');
   if(m.lowering.mode==='approximate'&&!m.lowering.knownLosses.length)error('Approximate intent '+m.id+' must specify deviations');
  }
  if(!Array.isArray(m.dependencies)||!isObject(m.acceptance)||!Array.isArray(m.acceptance.probes)||!m.acceptance.probes.length)error('Mechanism '+m.id+' missing dependencies/acceptance probes');
 }
 for(const m of program.mechanisms)for(const dep of m.dependencies||[])if(!mechIds.has(dep))error('Unknown mechanism dependency '+dep+' in '+m.id);
 // Detect self-dependency and cycles: different source modules may depend on each other; explicit scheduling cycles must be resolved.
 const visiting=new Set(),visited=new Set();function dfs(id){if(visiting.has(id)){error('Cyclic mechanism dependencies involving '+id);return}if(visited.has(id))return;visiting.add(id);const m=program.mechanisms.find(m=>m.id===id);for(const d of (m?.dependencies||[]))if(mechIds.has(d))dfs(d);visiting.delete(id);visited.add(id)}for(const m of program.mechanisms)dfs(m.id);
 for(const g of program.unknowns){if(!g.id||!g.question||!Array.isArray(g.blocks)||!Array.isArray(g.requiredProbe)||!g.requiredProbe.length)error('Unresolved gap needs ID, question, blocked mechanisms and concrete probe');for(const b of g.blocks||[])if(!mechIds.has(b))error('Unknown gap references missing mechanism '+b);}
 if(capabilities){if(capabilities.format!==CAP_FORMAT||!Array.isArray(capabilities.capabilities))error('Wrong compiler capabilities manifest');}
 const capmap=new Map((capabilities?.capabilities||[]).map(c=>[c.id,c]));
 const blockers=[];
 for(const m of program.mechanisms){
  const c=capmap.get(m.lowering?.capabilityId);
  if(!c||c.status!=='implemented')blockers.push(m.id+': capability '+m.lowering?.capabilityId+' not implemented');
  if(!m.proof||m.proof.level!=='verified'||m.proof.review!=='human_reviewed')blockers.push(m.id+': semantic proof/review incomplete');
  if(m.lowering?.mode==='unresolved')blockers.push(m.id+': lowering unresolved');
  if(!m.behavior?.transitions?.length)blockers.push(m.id+': no executable state transitions');
 }
 if(program.unknowns.some(g=>g.blocks.length))blockers.push('Blocking semantic unknowns remain');
 if(program.analysis.scope!=='complete_candidate')blockers.push('Partial program analysis');
 if(program.analysis.uncoveredRegions.length)blockers.push('Uncovered source regions remain');
 if(!program.mechanisms.length)blockers.push('No semantic mechanisms');
 if(!capabilities)blockers.push('No target compiler capabilities manifest');
 // GPT's own proof.review='human_reviewed' does not authorize execution. The build
 // environment must separately provide an approval document tied to the source.
 if(!reviewApproval || reviewApproval.format!=='PAY_Review_Approval_v0.8.1'||
    reviewApproval.sourceSha256PSID!==program.source.sha256PSID ||
    reviewApproval.subtune!==program.source.subtune ||
    !Array.isArray(reviewApproval.approvedMechanismIds) ||
    program.mechanisms.some(m=>!reviewApproval.approvedMechanismIds.includes(m.id)))
    blockers.push('Missing independently supplied source-matched human review approval');
 if(!errors.length&&blockers.length)warnings.push('Not compilable: '+blockers.join('; '));
 return {valid:!errors.length,compilable:!errors.length&&!blockers.length,errors,warnings,blockers,requiredCapabilities:[...new Set(required)].sort(),mechanismCount:program.mechanisms.length};
}
return {FORMAT,CAP_FORMAT,CLASSES,STATUS,REVIEW,MODES,CLOCKS,TYPES,EXPR_OPS,validate};
});
