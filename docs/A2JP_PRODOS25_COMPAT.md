# Apple II J-Plus: ProDOS 2.5 alpha 8 64K check

## Symptoms

The same ProDOS 8 floppy boots normally as `?sys=A2P`, but when booted
as `?sys=A2JP` it displays the ProDOS 8 2.5.0a8 title followed by:

```text
REQUIRES 64K
```

The MS16K in physical slot 0 is still installed. This message does not,
by itself, prove a malfunctioning 16K language card.

## Cause

ProDOS 2.5 alpha 8 has a machine-identification routine that reads monitor
ROM byte **`$FBB3`**. The authentic J-Plus ROM differs from the standard
Apple II Plus ROM exactly at the machine identification byte:

| Monitor ROM | `$FBB3` | `$FB1E` |
| --- | --- | --- |
| Apple II Plus | `$EA` | `$AD` |
| Apple II J-Plus | `$C9` | `$AD` |

The emulator's J-Plus monitor image is byte-for-byte authentic: the J-Plus
uses `CMP #$94` at `$FBB3` as part of its Control-T output interception.
Replacing that ROM byte with `$EA` would **break real J-Plus monitor
execution**. Do **not** change the ROM or MS16K soft switches to work
around a disk-based program's model detection.

At disk offset `$4E8D` in the repository's
`disks/ProDOS 8.dsk`, the loader begins with `LDX $FBB3` and dispatches
to its machine/64K configuration logic. Around disk offset `$4EA4`
it contains this sequence:

```asm
CPX #$EA      ; Apple II Plus monitor identifier
BNE OTHER     ; J-Plus has $C9, so does not take the II Plus path
LDX $FB1E
CPX #$AD      ; Second Apple II Plus identifier
BEQ LC_TEST   ; Continue to the language-card memory test
```

The ProDOS loader recognizes the normal Apple II Plus (`$EA`) but omits
the J-Plus (`$C9`). The J-Plus passes the second check (`$AD`).
Apple's published machine-identification technical note separately
describes ROM fingerprinting and probing for the 16K language card.

## Safe workaround: separate J-Plus boot disk

This repository supplies a **version- and CRC-guarded offline patcher**
that changes just the immediate operand of that ProDOS comparison,
`CPX #$EA` → `CPX #$C9`, and writes a **new copy** of the image.

```sh
node tools/patch_prodos25_jplus.mjs \
  "disks/ProDOS 8.dsk" \
  "disks/ProDOS_8_JPlus.dsk"
```

The tool only accepts the exact repository disk version:

| Property | Expected |
| --- | --- |
| Length | 143,360 bytes |
| Original CRC32 | `4811045A` |
| Patch location (file offset) | `$4EA5` |
| Original operand byte | `$EA` |
| Replacement operand byte | `$C9` |
| Other modified bytes | **None** |

It does not overwrite source or existing output disks. A failed CRC,
unexpected instruction signature, wrong size or already-modified disk
causes an error instead of an unsafe patch.

The patch is specific to A2JP; use the **original unmodified ProDOS 8
disk for A2P**. The motherboard's J-Plus ROM, Katakana font, MS16K driver,
memory mapping and disk controller implementation remain unchanged.

### Loading it in RetroAppleJS

1. Open `index.html?sys=A2JP`.
2. Keep the MS16K language card in **PR#0**.
3. Mount the generated `ProDOS_8_JPlus.dsk` in Disk II's D1 drive
   (typically PR#6, or PR#5 if your `slots` URL relocates Disk II).
4. Cold boot from that floppy.

The GitHub Actions workflow **ProDOS 2.5 J-Plus boot compatibility**
also builds the same generated floppy as an artifact named
`ProDOS_8_JPlus`. You can download its `.dsk` file from the workflow
run without needing Node on your computer.

## Status and limitation

The test suite checks that the source image exactly matches the known
ProDOS 2.5a8 bytes, only one byte changes, and the J-Plus identification
sequence now reaches the same language-card probe as the Apple II Plus.
**Booting the generated floppy in a real browser emulator remains the
final integration acceptance check.** If it still displays a 64K error,
capture a debugger trace around the ROM-ID routine and `$C080–$C08F`
soft switches; do not assume a second ROM or MS16K issue without evidence.

```sh
node --test tests/prodos_jplus_patch.test.mjs
```

This is a deliberately software-specific compatibility disk, not a change
to authentic J-Plus hardware emulation.
