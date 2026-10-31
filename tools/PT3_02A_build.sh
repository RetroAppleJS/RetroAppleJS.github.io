#!/usr/bin/env bash
# PT3-02A reproducible native 6502 build. Run at repository root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/build/pt3_02a"
if [[ $# -gt 0 ]]; then OUT="$1"; fi
UPSTREAM="$OUT/upstream"
UPSTREAM_SHA="cb0546ede762646196169f1517735cedca72ddfe"
mkdir -p "$OUT"
command -v ca65 >/dev/null || { echo "ca65/cc65 is required" >&2; exit 1; }
command -v ld65 >/dev/null || { echo "ld65/cc65 is required" >&2; exit 1; }
if [[ ! -d "$UPSTREAM/.git" ]]; then
  git init -q "$UPSTREAM"
  git -C "$UPSTREAM" remote add origin https://github.com/deater/dos33fsprogs.git
fi
git -C "$UPSTREAM" fetch -q --depth 1 origin "$UPSTREAM_SHA"
git -C "$UPSTREAM" checkout -q --detach FETCH_HEAD
if [[ "$(git -C "$UPSTREAM" rev-parse HEAD)" != "$UPSTREAM_SHA" ]]; then
  echo "Unpinned upstream checkout" >&2; exit 1
fi
U="$UPSTREAM/music/pt3_lib"
test -s "$U/LICENSE"
# Preserve complete, matching source alongside the compiled binary for review.
mkdir -p "$OUT/asm_source/upstream"
cp "$ROOT/asm/AUDIO/PT3_02A_NATIVE_PLAYER.s" "$OUT/asm_source/"
cp "$ROOT/asm/AUDIO/PT3_02A_LINK.cfg" "$OUT/asm_source/"
for name in zp.inc pt3_lib_core.s pt3_lib_init.s pt3_lib_mockingboard_setup.s pt3_lib_irq_handler.s interrupt_handler.s LICENSE; do
  cp "$U/$name" "$OUT/asm_source/upstream/$name"
done
printf "Pinned source commit: %s\n" "$UPSTREAM_SHA" > "$OUT/asm_source/upstream/SOURCE_COMMIT.txt"
ca65 -I "$U" "$ROOT/asm/AUDIO/PT3_02A_NATIVE_PLAYER.s" -o "$OUT/player.o" -l "$OUT/player.lst"
ld65 -C "$ROOT/asm/AUDIO/PT3_02A_LINK.cfg" -o "$OUT/PT3_02A_PLAYER.bin" -m "$OUT/player.map" "$OUT/player.o"
python3 "$ROOT/tools/PT3_02A_fixture.py" "$OUT/original.mid"
spectrumizer "$OUT/original.mid" --style faithful -o "$OUT/PT3_02A_ORIGINAL.pt3"
python3 - "$OUT" "$UPSTREAM_SHA" <<'PY'
import hashlib,json,sys
from pathlib import Path
out=Path(sys.argv[1])
player=(out/"PT3_02A_PLAYER.bin").read_bytes()
song=(out/"PT3_02A_ORIGINAL.pt3").read_bytes()
assert 0<len(player)<=4096,f"PT3 player exceeds $6000-$6FFF ({len(player)} bytes)"
assert 0<len(song)<=4096,f"PT3 fixture exceeds $8000-$8FFF ({len(song)} bytes)"
manifest={
 "schema":"retroapplejs.pt3-02a-build.v1","sourceCommit":sys.argv[2],
 "player":{"load":0x6000,"bytes":len(player),"sha256":hashlib.sha256(player).hexdigest()},
 "song":{"load":0x8000,"bytes":len(song),"sha256":hashlib.sha256(song).hexdigest()}
}
(out/"PT3_02A_build.json").write_text(json.dumps(manifest,indent=2)+"\n")
# Apple II Monitor import listing: load both binaries before the final 6000G.
lines=["CALL-151"]
for address,data in ((0x6000,player),(0x8000,song)):
    for i in range(0,len(data),16):
        lines.append(f"{address+i:04X}: "+' '.join(f"{v:02X}" for v in data[i:i+16]))
lines += ["6000G"]
(out/"PT3_02A_MONITOR.txt").write_text("\n".join(lines)+"\n")
print(json.dumps(manifest,indent=2))
PY
