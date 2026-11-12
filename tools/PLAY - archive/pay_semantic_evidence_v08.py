#!/usr/bin/env python3
"""PAY-00.8: deterministic *evidence index*, NOT a semantic transcoder.
Read an original short complete report (with GPT batches), plus longer trace.
No API call, no PSID execution and no inference from AY frame deltas.
"""
import argparse, hashlib, json
from collections import Counter
from pathlib import Path

HEX = lambda a: f'${a:04X}'

# Each item is a question to resolve, NOT a statement of recovered source grammar.
MECHANISMS = [
 dict(id='player_entry',kind='transport',label='INIT / PLAY entry and subtune selection',
      pcs=[0x1000,0x1003,0x10F1,0x1126],targetOps=['PLAYER_INIT','PLAYER_TICK'],
      question='Which source state and tables does INIT initialize for a selected subtune?',
      unknowns=['Full subtune 2/3 behaviour has not been traced','PLAY frame rate is caller-controlled; no C64 CIA timing inferred']),
 dict(id='voice_tick',kind='sequencer',label='Per-voice step countdown',
      pcs=[0x11C5,0x11C8,0x11CA,0x11E4,0x11E1,0x14D9],targetOps=['CHANNEL_WAIT','NEXT_STEP'],
      question='What are the reload, expiry and command-fetch conditions for each voice?',
      unknowns=['Meaning of all $14D8/$14D9 settings','Any shared timing state across voices']),
 dict(id='pointer_stream',kind='stream',label='Per-voice indirect command / pattern streams',
      pcs=[0x1205,0x1385,0x13A7,0x13EC,0x14AF],targetOps=['FETCH_TOKEN','SET_PATTERN_PTR'],
      question='Determine the pointer tables, byte grammar, escape markers and stream termination behaviour.',
      unknowns=['Complete token alphabet','Pointer wrap, jump and nested-loop semantics','Data/address equivalence outside observed runs']),
 dict(id='command_dispatch',kind='control',label='Decoded command classes and dynamic helper selection',
      pcs=[0x1280,0x1289,0x1291,0x128C,0x13A3,0x13C1,0x13EB],targetOps=['DECODE_COMMAND','EXEC_COMMAND'],
      question='Which command bytes cause which helper routines and mutations of voice state?',
      unknowns=['Exact command-byte ranges and operand widths','Unseen dynamic helper targets']),
 dict(id='runtime_patching',kind='control',label='Replace source self-modified instructions with state',
      pcs=[0x11AB,0x1162,0x1166,0x1281,0x128A,0x1306],targetOps=['SET_STATE','DISPATCH_STATE'],
      question='Classify each patched operand as variable, counter, selected helper or genuinely changed code.',
      unknowns=['Source patches reused in multiple contexts','Data dependencies for each target byte']),
 dict(id='pitch_slide',kind='pitch',label='Frequency arithmetic / portamento and step-to-target',
      pcs=[0x10C4,0x10DB,0x1305,0x109D,0x1070,0x10A0],targetOps=['PITCH_STEP','PORTAMENTO'],
      question='Derive the exact sign, magnitude, target, termination and per-voice state for each pitch mode.',
      unknowns=['Pitch deltas and thresholds are not yet decoded as command operands','SID frequency arithmetic differs from AY period arithmetic']),
 dict(id='instrument_control',kind='instrument',label='Instrument tables, ADSR, gate and waveforms',
      pcs=[0x1422,0x1428,0x14D8,0x14C5,0x13FF],targetOps=['SELECT_INSTRUMENT','NOTE_GATE','SET_ENVELOPE'],
      question='Identify instrument selection and the ADSR/waveform event timing independent of SID commit writes.',
      unknowns=['Full table-to-instrument mapping','SID envelopes are analogue and require AY approximation']),
 dict(id='global_timbre',kind='effect',label='Filter, resonance, routing and master-volume intent',
      pcs=[0x1161,0x1165,0x11AC,0x11B1,0x11B8],targetOps=['SET_GLOBAL_VOLUME','SET_TIMBRE_INTENT'],
      question='Which global changes represent volume dynamics, filtered instruments, or song transitions?',
      unknowns=['SID filter resonance and cutoff do not map directly to AY','Whether global parameters track specific instruments']),
 dict(id='sid_output',kind='driver',label='Final SID hardware commit (to be replaced)',
      pcs=[0x13FF,0x1405,0x140B,0x1411,0x1417,0x1422,0x1428],targetOps=['AY_COMMIT'],
      question='What is the boundary between semantic state calculations and write-only SID output?',
      unknowns=['Preserve ordering where it affects audible gate/envelope articulation']),
 dict(id='song_loops',kind='loop',label='Source-level pattern repeats and song loops',
      pcs=[0x13EC,0x1205,0x1305,0x1126],targetOps=['PATTERN_CALL','PATTERN_RETURN','LOOP_BEGIN','LOOP_END'],
      question='Prove source-level jumps/repeats from token grammar and relevant control state, not from repeated AY frames.',
      unknowns=['No original-song loop proven','No nested loop semantics proven','Only subtune 1 has been dynamically exercised']),
]

def build(short,long):
    if short['source']['originalSID']['base64'] != long['source']['originalSID']['base64']:
        raise ValueError('Short and long reports are NOT the same original PSID')
    if short['source']['selectedSubtune'] != long['source']['selectedSubtune']:
        raise ValueError('Subtunes differ')
    tr=long['runtimeTrace']; ir=long['musicalIR']; stat=long['staticAnalysis']
    short_tr=short['runtimeTrace']; c=long['completeness'];s=tr['summary']
    if s['dropSidEvents'] or ir['metrics']['droppedDataReads']:
        raise ValueError('Long audio/control evidence is incomplete')
    if s['framesCompleted'] < 3000 or short_tr['summary']['framesCompleted'] < 300:
        raise ValueError('Trace insufficient for this fixture')
    idx={}
    def put(k,type_,payload):idx[k]={'kind':type_,**payload}
    # Important: runtime variant evidence must not be mistaken for original stable source code.
    for cvar in tr['codeVariants']:
        pc=cvar['pc'];
        if pc in {pc for m in MECHANISMS for pc in m['pcs']}:
            put('code:'+HEX(pc),'executed_instruction_variants',{'pc':HEX(pc),'executions':cvar['count'], 'variants':cvar['variants'][:18], 'cappedVariants':len(cvar['variants'])>18})
    for row in stat['instructions']:
        pc=row['pc'];
        if pc in {p for m in MECHANISMS for p in m['pcs']}:
            put('static:'+HEX(pc),'static_disassembly',{'pc':HEX(pc),'bytes':row['bytes'],'mnemonic':row['mnemonic'],'mode':row['mode'],'operand':row['operand'],'notRuntimeProof':True})
    for edge in tr['flowEdges']:
        if edge['from'] in {p for m in MECHANISMS for p in m['pcs']}:
            put('flow:'+HEX(edge['from'])+'->'+HEX(edge['to']),'executed_control_flow',{'from':HEX(edge['from']),'to':HEX(edge['to']),'kindOfFlow':edge['kind'],'count':edge['count'],'firstFrame':edge.get('frameFirst')})
    for i,row in enumerate(s['modifications']):
        put('patch:'+HEX(row['addr'])+'<-'+HEX(row['pc']), 'self_modified_executable_byte',{'sourcePC':HEX(row['pc']),'byteAddress':HEX(row['addr']),'writes':row['count'],'firstFrame':row['frameFirst'],'lastFrame':row['frameLast'],'initial':row['initial'],'latest':row['latest']})
    for row in ir['indirectReadSites']:
        key='read:'+HEX(row['sourcePC'])+':X'+str(row['registerX'])
        put(key,'observed_effective_indirect_reads', {'pc':HEX(row['sourcePC']), 'x':row['registerX'], 'reads':row['reads'], 'distinctAddresses':row['uniqueAddresses'], 'range':list(map(HEX,row['range'])),'samples':[{**r,'address':HEX(r['address']), 'pointerBase':HEX(r['pointerBase']) if r.get('pointerBase') is not None else None} for r in row['examples'][:14]],'samplesTruncated':row['reads']>14})
    for row in s['sidWriteSources']:
        pc=row['pc'];ev=next((x for x in tr['sidEvents'] if x['pc']==pc),None)
        put('sid:'+HEX(pc),'executed_SID_write_site',{'pc':HEX(pc),'writes':row['count'], 'firstSIDOffset':HEX(ev['offset']) if ev else None,'firstSIDAddress':HEX(ev['address']) if ev else None})
    for b in short['gpt']['completedBatches']:
        # Retain previous GPT interpretation as *candidate*, not as evidence proving an assertion.
        put('gpt:batch:'+str(b['batch']),'prior_model_interpretation',{'batch':b['batch'],'model':short['gpt']['model'],'text':b['text'],'trustedAsProof':False})
    # Explicitly seed cross references only from the actual indexed report.
    mechanisms=[]
    for m in MECHANISMS:
        candidate=dict(m)
        pcs=m['pcs']
        evidence=[]
        for pc in pcs:
            h=HEX(pc)
            # Keep per-mechanism evidence small enough to fit in one focused API prompt.
            ev=[k for k in idx if k.startswith(('static:'+h,'code:'+h,'sid:'+h, 'flow:'+h+'->','read:'+h+':'))]
            evidence.extend(ev[:15])
        evidence.extend(k for k,x in idx.items() if k.startswith('patch:') and (int(x['byteAddress'][1:],16) in pcs or int(x['sourcePC'][1:],16) in pcs))
        candidate['evidenceIds']=list(dict.fromkeys(evidence))[:65]
        candidate['seedStatus']='evidence_indexed__semantic_grammar_not_verified'
        candidate['gptBatchIds']=['gpt:batch:1','gpt:batch:2','gpt:batch:3','gpt:batch:4']
        mechanisms.append(candidate)
    sha=hashlib.sha256(__import__('base64').b64decode(short['source']['originalSID']['base64'])).hexdigest()
    return {'format':'PAY_Semantic_Evidence_v0.8','evidencePolicy':'Source/traces are observations. Prior GPT analysis and AY register streams do not prove decoder semantics.',
      'source':{'fileName':short['source']['fileName'],'title':short['source']['title'],'author':short['source']['author'],'selectedSubtune':short['source']['selectedSubtune'],'songs':short['source']['songs'], 'originalSIDBytes':short['source']['totalBytes'],'sha256PSID':sha,'init':HEX(short['source']['initAddress']),'play':HEX(short['source']['playAddress'])},
      'capture':{'shortFrames':short_tr['summary']['framesCompleted'],'longFrames':s['framesCompleted'],'sidWrites':s['sidWrites'],'droppedSIDWrites':s['dropSidEvents'],'effectiveDataReads':len(tr['dataReads']),'droppedDataReads':ir['metrics']['droppedDataReads'],'selfModifyingWrites':s['selfModifyingWrites'],'liveCodeVariantsCapped':c['droppedRecords']['codeVariants'],'stateGraphCapped':c['droppedRecords']['stateGraphNodes'],'platformTiming':'PLAY invoked as bounded frame calls; C64 IRQ/CIA/VIC/analog SID not emulated','sourceSongLoopProven':False},
      'mechanisms':mechanisms,'evidence':idx,
      'prohibitions':['No compilation from frameSnapshots or 60s AY score as primary program','No claim of original musical loop from period-identical sound states','No new semantics inferred from GPT prose alone','No unsafe assumptions about original ZP on Apple II','Never use unreviewed GPT output as executable assembler']}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--short',required=True);p.add_argument('--long',required=True);p.add_argument('--out',required=True)
    a=p.parse_args(); short=json.load(open(a.short)); long=json.load(open(a.long));result=build(short,long)
    Path(a.out).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print('PAY08 evidence built:',len(result['evidence']),'indexed records,',len(result['mechanisms']),'semantic mechanisms;',Path(a.out).stat().st_size,'bytes')
