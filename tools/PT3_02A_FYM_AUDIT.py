#!/usr/bin/env python3
"""Audit paired RetroAppleJS Mockingboard FYM exports (zlib FYM format)."""
import sys, struct, zlib, json, math, wave
from pathlib import Path

def read(path):
    buf=zlib.decompress(Path(path).read_bytes())
    off,n,loop,clock,fps=struct.unpack_from('<5I',buf)
    if not 20<=off<len(buf) or fps<=0 or n<=0 or len(buf)!=off+14*n:
        raise ValueError('Invalid FYM format or payload size')
    return {'frames':n,'clock':clock,'fps':fps,
            'columns':[buf[off+i*n:off+(i+1)*n] for i in range(14)]}

def stats(track):
    c=track['columns'];n=track['frames']
    identical_tone=sum(c[0][i]==c[2][i]==c[4][i] and
      c[1][i]==c[3][i]==c[5][i] for i in range(n))
    identical_volume=sum(c[8][i]==c[9][i]==c[10][i] for i in range(n))
    return {
      'identicalThreeTonePeriodsPct':round(100*identical_tone/n,2),
      'identicalThreeVolumesPct':round(100*identical_volume/n,2),
      'toneAChangesPerSecond':round(sum(c[0][i]!=c[0][i-1] or
        c[1][i]!=c[1][i-1] for i in range(1,n))/(n/track['fps']),2),
      'allToneAndNoiseEnabledPct':round(100*sum(c[7][i]==0 for i in range(n))/n,2),
      'register7Counts':{str(v):sum(x==v for x in c[7]) for v in sorted(set(c[7]))}
    }

def main():
    if len(sys.argv)<3:
        raise SystemExit('Usage: PT3_02A_FYM_AUDIT.py AY0.fym AY1.fym [mono8.wav]')
    a,b=read(sys.argv[1]),read(sys.argv[2]);assert (a['frames'],a['fps'],a['clock'])==(b['frames'],b['fps'],b['clock'])
    n=a['frames'];ca,cb=a['columns'],b['columns']
    report={
       'frames':n,'frameRateHz':a['fps'],'seconds':round(n/a['fps'],4),
       'AY0':stats(a),'AY1':stats(b),
       'mirroredFramesPct':round(100*sum(all(ca[r][i]==cb[r][i] for r in range(13))
                                   for i in range(n))/n,2),
       'mirrorByRegisterPct':{f'R{r}':round(100*sum(ca[r][i]==cb[r][i]
                                  for i in range(n))/n,2) for r in range(14)}
    }
    if len(sys.argv)>3:
        with wave.open(sys.argv[3],'rb') as f:
            if f.getsampwidth()!=1 or f.getnchannels()!=1: raise ValueError('Expected mono 8-bit WAV')
            data=f.readframes(f.getnframes());rate=f.getframerate()
        window=rate//2
        rms=[round(math.sqrt(sum((v-128)**2 for v in data[i:i+window])/
             len(data[i:i+window])),2) for i in range(0,len(data),window)]
        report['wav']={'seconds':round(len(data)/rate,3),
                       'halfSecondRMS':rms,'nearSilentWindows':sum(v<2 for v in rms)}
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
