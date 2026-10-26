#!/usr/bin/env python3
"""Assert hex-DATA Applesoft loader is byte-exact and small enough for HGR."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
b=(ROOT/'build/AY_SCORE_TIMING_MB05.bin').read_bytes()
s=(ROOT/'build/AY_SCORE_TIMING_MB05_LOADER.bas').read_text()
chunks=re.findall(r'^\d+ DATA "([0-9A-F]+)"$',s,re.M)
assert chunks and all(len(x)%2==0 for x in chunks), 'DATA formatting'
assembled=bytes.fromhex(''.join(chunks))
assert assembled==b, 'Loader DATA bytes differ from authoritative binary'
assert len(b)==1327 and sum(b)==124100,(len(b),sum(b))
assert 'N=1327:S=124100' in s
assert len(s.encode())<0x2000-0x801, 'Loader text alone would overlap HGR page 1'
assert len(chunks)==42,len(chunks)
print('LOADER PASS — 1327 byte-exact bytes, checksum 124100, 42 compact DATA rows; source text',len(s.encode()),'bytes, HGR headroom',0x2000-0x801-len(s.encode()))
