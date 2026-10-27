"""IDEAL mathematical comparator ONLY. Does not emulate AY or Apple II.
Exact programmed frequencies from the MB06A4 note-period equations are used.
"""
import json
from pathlib import Path
import numpy as np
from scipy.io import wavfile
ROOT=Path(__file__).resolve().parent
RATE=22050
F=1021800
TARGET=261.6255653005986
families={'square':16,'sawdown':256,'sawup':256,'triangle':512}
report={'schema':'retroapplejs.mb06a4.ideal-math-probes.v1','purpose':'Ideal waveform shape comparison, not AYCore PCM','sampleRate':RATE,'clockHz':F,'files':[]}
for name,div in families.items():
    period=round(F/(div*TARGET));real=F/(div*period)
    n=round(660000*RATE/F)
    t=np.arange(n)/RATE
    start=51200/F
    alive=(t>=start)&(t<=start+0.54)
    phase=((t-start)*real)%1
    if name=='square':raw=np.where(phase<.5,1.,-1.)
    elif name=='sawdown':raw=1-2*phase
    elif name=='sawup':raw=2*phase-1
    else:raw=1-4*np.abs(phase-.5)
    audio=np.where(alive,raw,0.)
    # 1.5 ms click-limiting onset/offset; central steady-state cycles unaffected.
    env=np.clip((t-start)/.0015,0,1)*np.clip((start+.54-t)/.0015,0,1)
    audio*=env*.58
    filename=f'MB06A4_IDEAL_{name}_C4_probe_NOT_AYCORE.wav'
    wavfile.write(ROOT/filename,RATE,np.round(audio*32767).astype('<i2'))
    report['files'].append({'name':filename,'type':name,'registerPeriodMatch':period,'expectedActualPitchHz':real,'detuningCents':1200*np.log2(real/TARGET),'durationSeconds':n/RATE})
(ROOT/'IDEAL_PROBES_MANIFEST.json').write_text(json.dumps(report,indent=2,default=float)+'\n')
print([(f['type'],f['registerPeriodMatch'],round(f['expectedActualPitchHz'],3)) for f in report['files']])
