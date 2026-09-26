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
    snippet='''const APPLE_MOUSE_ROM_B64 = `\n%s\n`;

function decodeAppleMouseBase64(text)
{
    const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    text=String(text).replace(/[^A-Za-z0-9+/=]/g,"");
    var padding=text.slice(-2)=="==" ? 2 : (text.slice(-1)=="=" ? 1 : 0);
    if((text.length&3)!==0) throw new Error("Invalid AppleMouse ROM base64 length");

    var out=new Uint8Array((text.length/4)*3-padding);
    var p=0;
    for(var i=0;i<text.length;i+=4)
    {
        var c0=alphabet.indexOf(text[i]);
        var c1=alphabet.indexOf(text[i+1]);
        var c2=text[i+2]=="=" ? 0 : alphabet.indexOf(text[i+2]);
        var c3=text[i+3]=="=" ? 0 : alphabet.indexOf(text[i+3]);
        if(c0<0 || c1<0 || c2<0 || c3<0) throw new Error("Invalid AppleMouse ROM base64");

        var n=(c0<<18)|(c1<<12)|(c2<<6)|c3;
        if(p<out.length) out[p++]=(n>>16)&0xFF;
        if(p<out.length) out[p++]=(n>>8)&0xFF;
        if(p<out.length) out[p++]=n&0xFF;
    }
    return out;
}

const APPLE_MOUSE_ROM=decodeAppleMouseBase64(APPLE_MOUSE_ROM_B64);
if(APPLE_MOUSE_ROM.length!==0x800) throw new Error("AppleMouse ROM must be exactly 2048 bytes");
''' % wrapped
    marker='\n\nfunction MousePIA6821()'
    if marker not in source:
        raise SystemExit('AppleMouse insertion marker not found')
    source=source.replace(marker,'\n\n'+snippet+marker,1)

old='    var rom=new Uint8Array(0x800);'
new='    var rom=new Uint8Array(APPLE_MOUSE_ROM);'
if old in source:
    source=source.replace(old,new,1)
elif new not in source:
    raise SystemExit('AppleMouse ROM initializer marker not found')

path.write_text(source)
PY

node --test tests/applemouse_rom.test.js tests/applemouse_68705.test.js

if ! git diff --quiet -- res/EMU_CARD_applemouse.js; then
  git config user.name 'github-actions[bot]'
  git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
  git add res/EMU_CARD_applemouse.js
  git commit -m 'feat: bundle authentic AppleMouse slot ROM'
  git push origin HEAD:feature/applemouse-authentic-rom
fi
