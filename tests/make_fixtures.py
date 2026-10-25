"""Derive expected AY bus transactions from original 6502 assembly's model."""
import sys,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
original=Path('/mnt/data/ay-score-timing-bench-phase1.5a2')
sys.path.insert(0,str(original/'tests'))
from verify_6502 import CPU
payload=(original/'build/AY_SCORE_TIMING_BENCH.bin').read_bytes()
expectations=[]
all_history=[]
base=100000
for mode,address,body_writes in ((1,0x6000,64),(2,0x6003,64),(3,0x6006,32)):
    c=CPU(payload,0x6000)
    c.run(address)
    source=[{'cycle':tick-c.logs[0][0], 'ay':0,'register':reg,'value':value} for tick,reg,value in c.logs]
    assert len(source)==body_writes+3
    expectations.append({'mode':mode,'label':f'MB-0{mode}', 'measuredWrites':body_writes,'expectedCapturedEvents':len(source),'events':source})
    origin=base
    for event in source:
        all_history.append({'cycle':origin+event['cycle'],**{k:event[k] for k in ('ay','register','value')}})
    base=origin+source[-1]['cycle']+12000
ref={'schema':'retroapplejs.ay-score-timing-history.expected.v1','provenance':'6502 instruction-model transaction sequence; NOT captured Mockingboard history','assembly':'AY_SCORE_TIMING_BENCH.S v0.1, $6000, 548 bytes','expected':expectations}
(root/'expected'/'EXPECTED_AY_TRANSACTIONS.json').write_text(json.dumps(ref,indent=2)+'\n')

def convert(events,base_tick,source):
    prior=base_tick; output=[]
    for item in events:
        tick=item['cycle'];output.append([tick-prior,item['ay'],item['register'],item['value']]);prior=tick
    return {'format':'RetroAppleJS.MockingboardHistory','version':1,'encoding':'deltaCycles,ay,register,value; register -1 means AY reset',
        'slot':4,'clockHz':1023000,'bufferKB':64,'baseTick':base_tick,'stopTick':prior+8000,'wrapped':False,
        'initialRegisters':{'AY0':[0]*14,'AY1':[0]*14},'events':output,'testFixture':source}
(root/'tests'/'SIMULATED_COMBINED_HISTORY.json').write_text(json.dumps(convert(all_history,90000,'synthetic instruction-model fixture, NOT emulator capture'),indent=2)+'\n')
for mode in range(1,4):
    ev=[e for e in all_history if False] # below build per-mode
    local=[{'cycle':100000+e['cycle'], 'ay':e['ay'],'register':e['register'],'value':e['value']} for e in expectations[mode-1]['events']]
    (root/'tests'/f'SIMULATED_MB0{mode}_HISTORY.json').write_text(json.dumps(convert(local,90000,f'fake MB0{mode} fixture, NOT measured'),indent=2)+'\n')
print('expected records:',[(e['mode'],e['expectedCapturedEvents']) for e in expectations]);print('combined:',len(all_history))
