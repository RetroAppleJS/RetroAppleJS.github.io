#!/usr/bin/env bash
set -euo pipefail

python3 <<'PY'
from pathlib import Path

cfg_path=Path('res/COM_CONFIG.js')
cfg=cfg_path.read_text()

pcode_liron=',"LIRON":{"NAME":"Apple 3.5 Floppy Disk Drive Interface Card" ,"IOrange":"$C08<sub>n</sub>0,$C08<sub>n</sub>F" ,"ROMrange":"$C0<sub>n</sub>00,$C0<sub>n</sub>FF" ,"LROMrange":"" ,"SLOTrange":"1,2,3,4,5,6,7" ,"SYScode":"A2,A2P,A2E" ,"Manuals":"[user_manual](https://mirrors.apple2.org.za/ftp.apple.asimov.net/documentation/hardware/storage/disks/Apple%20II%203.5%20Disk%20Controller%20Card%20Owner%27s%20Guide.pdf)"}'
pcode_mouse=',"AMOUSE":{"NAME":"AppleMouse II Interface Card" ,"IOrange":"$C08<sub>n</sub>0,$C08<sub>n</sub>F" ,"ROMrange":"$C0<sub>n</sub>00,$C0<sub>n</sub>FF" ,"LROMrange":"" ,"SLOTrange":"1,2,3,4,5,6,7" ,"SYScode":"A2,A2P,A2E" ,"Manuals":""}'
if pcode_mouse not in cfg:
    assert pcode_liron in cfg, 'PCODE LIRON anchor missing'
    cfg=cfg.replace(pcode_liron,pcode_liron+'\n'+pcode_mouse,1)

slot4=',4:{"PCODE":"" ,"DESCRIPTION":""}'
slot4_mouse=',4:{"PCODE":"AMOUSE","IOrange":["$C08<sub>n</sub>0","$C08<sub>n</sub>F"],"ROMrange":["$C0<sub>n</sub>00","$C0<sub>n</sub>FF"],"LROMrange":[""] ,"DESCRIPTION":""}'
if slot4_mouse not in cfg:
    assert slot4 in cfg, 'slot 4 anchor missing'
    cfg=cfg.replace(slot4,slot4_mouse,1)

pslot_tclk_old=',"TCLKP":{"NAME":"Thunderclock Plus" ,"HostIO":"" ,"SlotIO":"X" ,"SlotROM":"X" ,"HostROM":"X" ,"SLOTrange":"1,2,3,4*,5,6,7"'
pslot_tclk_new=',"TCLKP":{"NAME":"Thunderclock Plus" ,"HostIO":"" ,"SlotIO":"X" ,"SlotROM":"X" ,"HostROM":"X" ,"SLOTrange":"1*,2,3,4,5,6,7"'
if pslot_tclk_old in cfg:
    cfg=cfg.replace(pslot_tclk_old,pslot_tclk_new,1)
else:
    assert pslot_tclk_new in cfg, 'PSLOT Thunderclock anchor missing'

pslot_liron=',"LIRON":{"NAME":"Apple 3.5 Floppy Disk Drive Interface Card" ,"HostIO":"" ,"SlotIO":"X" ,"SlotROM":"X" ,"HostROM":"X" ,"SLOTrange":"1,2,3,4,5*,6,7" ,"SYScode":"A2,A2P,A2E" ,"Manuals":"[user_manual](https://mirrors.apple2.org.za/ftp.apple.asimov.net/documentation/hardware/storage/disks/Apple%20II%203.5%20Disk%20Controller%20Card%20Owner%27s%20Guide.pdf)"}'
pslot_mouse=',"AMOUSE":{"NAME":"AppleMouse II Interface Card" ,"HostIO":"" ,"SlotIO":"X" ,"SlotROM":"X" ,"HostROM":"" ,"SLOTrange":"1,2,3,4*,5,6,7" ,"SYScode":"A2,A2P,A2E" ,"Manuals":""}'
if pslot_mouse not in cfg:
    assert pslot_liron in cfg, 'PSLOT LIRON anchor missing'
    cfg=cfg.replace(pslot_liron,pslot_liron+'\n'+pslot_mouse,1)

cfg_path.write_text(cfg)

index_path=Path('index.html')
html=index_path.read_text()
mouse_tag='            <script type="text/javascript" src="res/EMU_CARD_applemouse.js"></script>\n'
anchor='            <script type="text/javascript" src="res/EMU_CARD_LIRON.js"></script>\n'
if mouse_tag not in html:
    assert anchor in html, 'index card-script anchor missing'
    html=html.replace(anchor,anchor+mouse_tag,1)
index_path.write_text(html)
PY

node --test tests/applemouse_default_boot.test.js tests/applemouse_68705.test.js tests/applemouse_rom.test.js

if ! git diff --quiet -- res/COM_CONFIG.js index.html; then
  git config user.name 'github-actions[bot]'
  git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
  git add res/COM_CONFIG.js index.html
  git commit -m 'feat: mount AppleMouse in default slot 4'
  git push origin HEAD:feature/applemouse-authentic-rom
fi

node --test tests/*.test.js
