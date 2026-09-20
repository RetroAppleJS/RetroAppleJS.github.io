from pathlib import Path

p=Path('tools/patch_device_attachment_ui.py')
s=p.read_text()
old="new = '''        var slotN=peripheral && peripheral.mount ? Number(peripheral.mount.slotN) : -1;"
new="new = r'''        var slotN=peripheral && peripheral.mount ? Number(peripheral.mount.slotN) : -1;"
if old not in s:
    raise SystemExit('device table raw-string anchor not found')
s=s.replace(old,new,1)
old="new = '''            + \" data-dcode=\\\\\\\"\"+oCOM.escapeHTML(deviceCode)+\"\\\\\\\"\""
new="new = r'''            + \" data-dcode=\\\\\\\"\"+oCOM.escapeHTML(deviceCode)+\"\\\\\\\"\""
if old not in s:
    raise SystemExit('device label raw-string anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
