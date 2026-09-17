from pathlib import Path
import sys

s = Path('index.html').read_text()
required = [
    'id="ASM_includeFileInput"',
    'type="file" multiple',
    'id="ASM_includeLabelWrap"',
    'var ASM_includeFiles = [];',
    'function ASM_buildIncludeMap()',
    'function ASM_addIncludeText(name,text,sourceName)',
    'function ASM_removeIncludeFile(id)',
    'async function ASM_loadIncludeFiles(fileList)',
    'sourceName:ASM_currentFileName',
    'includes:ASM_buildIncludeMap()',
    'tokenise(sourcePane.value,ASM_currentFileName)',
    'var includeFileInput = ASM_el("ASM_includeFileInput");'
]
missing = [x for x in required if x not in s]

if '--expect-missing' in sys.argv:
    if not missing:
        raise SystemExit('RED test unexpectedly passed before implementation')
    print('RED confirmed: missing include UI markers:', ', '.join(missing))
    raise SystemExit(0)

if missing:
    raise SystemExit('missing post-patch markers: ' + ', '.join(missing))
if s.count('id="ASM_includeFileInput"') != 1:
    raise SystemExit('include chooser must occur exactly once')
if s.count('id="ASM_includeLabelWrap"') != 1:
    raise SystemExit('include label wrapper must occur exactly once')
print('UI structural checks: PASS')
