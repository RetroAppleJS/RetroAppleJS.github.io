#!/usr/bin/env bash
set -euo pipefail

curl -L --fail --silent --show-error \
  'https://raw.githubusercontent.com/freitz85/AppleIIMouse/master/Apple%20Mouse%20Interface%20Card%20ROM%20-%20342-0270-C.bin' \
  -o /tmp/applemouse.bin

python - <<'PY'
from pathlib import Path
import base64,hashlib,textwrap,zlib

rom=Path('/tmp/applemouse.bin').read_bytes()
assert len(rom)==2048, len(rom)
assert hashlib.sha1(rom).hexdigest()=='3a9d881a8a8d30f55b9719aceebbcf717f829d6f'
assert zlib.crc32(rom)&0xffffffff==0x0bcd1e8e
print('verified AppleMouse ROM:',len(rom),'bytes, sha1',hashlib.sha1(rom).hexdigest())

b64=base64.b64encode(rom).decode('ascii')
wrapped='\n'.join(textwrap.wrap(b64,76))
path=Path('res/EMU_CARD_applemouse.js')
source=path.read_text()

if 'const APPLE_MOUSE_ROM_B64' not in source:
    raise SystemExit('authentic AppleMouse ROM is not bundled in production source')
if 'var rom=new Uint8Array(APPLE_MOUSE_ROM);' not in source:
    raise SystemExit('AppleMouse constructor is not using bundled ROM')
PY

node --test tests/*.test.js
