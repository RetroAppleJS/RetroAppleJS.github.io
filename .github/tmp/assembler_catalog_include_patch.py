from pathlib import Path

path = Path('index.html')
s = path.read_text()

old = '''              function finish(text)
              {
                ASM_loadSourceText(name,text);
                oCOM.CATALOG.close("sourceCat");
              }
'''

new = '''              function finish(text)
              {
                if(/\\.inc$/i.test(name))
                {
                  var result = ASM_addIncludeText(
                    name,
                    text,
                    arg.path || name
                  );

                  ASM_clearOutputs(
                    (result.replaced ? "Replaced include " : "Loaded include ")
                    + name
                    + ". Reassemble to refresh the listing and byte code.",
                    "ok"
                  );
                }
                else
                  ASM_loadSourceText(name,text);

                oCOM.CATALOG.close("sourceCat");
              }
'''

count = s.count(old)
if count != 1:
    raise SystemExit(f'expected exactly one catalog finish block, got {count}')

path.write_text(s.replace(old, new, 1))
print('patched catalog .INC routing')
