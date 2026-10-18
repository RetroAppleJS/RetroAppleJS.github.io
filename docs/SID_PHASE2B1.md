# Phase 2B.1 — Generic native PSID loader for Apple II

Phase 2A (Mr. Heli) is closed. Phase 2B.1 generalises **file loading and
compatibility preflight**, while retaining native Apple II NMOS 6502 execution
of original PSID INIT/PLAY code and native `$D400–$D41F` SID bus writes.
This is **not** a C64/6510 emulator and does not translate SID writes to AY.

## Staging versus original executable location

These are **different addresses**. A PSID is a container: it carries a header
and 6502 code/data. The **complete PSID file** may be staged anywhere inside
`$2000–$8FFF` provided the last byte does not exceed `$8FFF`.
This is **28,672 bytes (28 KiB) including the PSID header**. If the file uses
the full 28 KiB, its only possible staging base is `$2000`.

The file's PSID header (or two-byte embedded PRG prefix) specifies a *native
C64 executable load address*. The 6502 player copies the payload to this
**original absolute load address**, and executes the original INIT/PLAY
instructions there. The program's internal absolute operands are **never
relocated**. The copy is direction-aware (memmove semantics), even when the
staged payload and target memory overlap. A successful copy can overwrite the
original staged PSID header; to replay, the runner re-copies from staged
memory, so reload the source if it was overwritten.

### Protected memory layout

| Apple II address | Role |
|---|---|
| `$1C00–$1C0B` | 12-byte public 6502 entry stub (may temporarily be overwritten by the tune and restored at exit) |
| `$2000–$8FFF` | **Entire 28 KiB PSID staging window**; no resident runtime or scratch allocations within it |
| `$9000–$92A3` | Native player runtime (676 bytes in this revision) |
| `$9400–$9411` | Validated 18-byte playback descriptor |
| `$9500–$95FF` | Original Apple II zero page backup |
| `$0C00–$BFFF` | Permitted *original executable* range, except the protected `$9000–$95FF` runtime/descriptor/ZP workspace |

The runtime is deliberately located above the staging window because
**Mr. Heli's original code occupies `$0CA0–$1F0A`**, overlapping a full
player resident at `$1C00`. The bootstrap at `$1C00` jumps to protected
`$9000` code. After playback it restores the 12-byte public entry stub,
the complete Apple II zero page and the previous CPU interrupt mask.

All runs should use a **disposable Apple II memory snapshot**. This player
can overwrite Applesoft program/workspace RAM and does not implement a
complete Commodore 64 RAM/ROM/CIA/VIC environment. Start in TEXT mode, at
100% Apple II CPU speed, without DOS/ProDOS, disk access or IRQ-dependent
applications. Only the original zero page is backed up automatically;
other overwritten RAM contents are **not** preserved.

## Supported PSIDs

The host-side preflight in `tools/SID_Phase2B1_build.js` accepts:

- PSID v1/v2 with a valid big-endian header and in-bounds data offset.
- Either a header-specified C64 load address or a two-byte embedded PRG
  little-endian load address when the header field is zero.
- Selected subtune 1 through `songs` (one-based CLI argument, converted
  to zero-based accumulator A for native INIT).
- VBI-timed music at **50 Hz** (PAL/unspecified) or **60 Hz** (NTSC).
  The SID chip oscillator clock is still independently chosen in the
  peripheral toolbox; select PAL 985248 Hz for PAL tunes.
- Explicit nonzero PLAY addresses, with INIT/PLAY inside the loaded code.
  INIT=0 is resolved to the original load address.

For now the preflight *rejects* RSID, PSID v3/v4, CIA-timed subtunes
(speed bit set for the selected song), MUS / PlaySID-specific flags,
multiple SID chips, PLAY=0 IRQ-vector
drivers, memory overlap with protected `$9000–$95FF`, executable code
below `$0C00` or reaching `$C000`, and invalid or conflicting addresses.

**Compatibility cannot be fully determined from the PSID header.** Some
nominal PSIDs still depend on C64 ROM calls, 6510-specific facilities,
undocumented opcodes, screen/VIC/CIA memory or RAM initialisation assumptions.
Such dependencies remain unimplemented; passing preflight means the layout
and declared timing are compatible, *not* that the tune is guaranteed to play.

## Preparing an arbitrary PSID

From a repository checkout:

```bash
node tools/SID_Phase2B1_build.js path/to/music.sid '$2000' 1
```

Arguments: `[file.sid] [staging-address] [subtune] [output-folder]`.
The staging address accepts `$2000`, `0x2000` or decimal `8192`.
**Quote the dollar-sign syntax in a shell**, as in the example.
Defaults are the existing original Mr. Heli file, stage `$6000`, its
default subtune (5), and output directory `tools/music`.

After header and memory validation, the builder produces:

| File | Load address |
|---|---|
| `SID_Phase2B1_bootstrap.bin` | `$1C00` (12 bytes) |
| `SID_Phase2B1_runtime.bin` | `$9000` |
| `SID_Phase2B1_descriptor.bin` | `$9400` (18 bytes) |
| **Original, unmodified input `.sid`** | Your selected staging address |

It also generates matching `*_monitor.txt` files for all four memory
images (including the staged PSID file) and
`SID_Phase2B1_manifest.json`, which lists the actual addresses, original
title/author, subtune, frame rate, preferred SID model (where declared),
and compatibility warnings.

Load the four binary images at their respective addresses using the
emulator's memory-loading facilities, or enter the monitor listings.
**Do not load the SID payload alone at the staging address**: the descriptor
expects the complete PSID container and points to its payload offset.

### Ready-to-enter original Mr. Heli demonstration

Three checked-in monitor listings are sufficient:

1. `asm/AUDIO/SID_PHASE2B1_player_monitor.txt` — entry stub at `$1C00`
   and runtime at `$9000`.
2. `asm/AUDIO/SID_PHASE2B1_MrHeli_at_6000_descriptor.txt` — descriptor
   at `$9400`, default subtune 5.
3. `asm/AUDIO/SID2MB_prototype/Mr_Heli_PSID_at_6000_monitor.txt` —
   untouched original PSID staged at `$6000`.

With SID in any slot 1–7, audio enabled, PAL/6581, 100% CPU, run:

```basic
CALL 7168
```

Press **any key** to stop. The new player retains the 50 Hz absolute
CPU-clock deadline from Phase 2A, using the RetroAppleJS-specific SID
indexed SlotIO clock extension `$1E/$1F`. This extension is **not**
part of physical MOS SID hardware.

## Entrypoints and error codes

| Address | Applesoft | Purpose |
|---|---|---|
| `$1C00` | `CALL 7168` | Validate descriptor/staged checksum, load, INIT, PLAY and wait for key |
| `$1C03` | `CALL 7171` | Mute the SID after playback |
| `$1C06` | `CALL 7174` | Restart (source PSID must still be staged intact) |
| `$1C09` | `CALL 7177` | Return last error code in 6502 A |
| `$929A` | `PRINT PEEK(37530)` | Error code variable (0 success, 1 bad descriptor, 2 SID not found, 3 RAM payload checksum mismatch) |

The resident player verifies descriptor magic `S2B1`, positive
payload length, and the **16-bit additive checksum of the staged executable
payload** *before* installing it. The checksum is stored at
`$9410–$9411` by the host builder. It detects many incomplete or damaged
RAM transfers, but is not a cryptographic integrity check.

Descriptor encoding (little-endian addresses and lengths):

| Offset | Meaning |
|---|---|
| `$00–$03` | ASCII `S2B1` |
| `$04–$05` | Start address of executable bytes inside the staged PSID |
| `$06–$07` | Original absolute executable load address |
| `$08–$09` | Executable payload length |
| `$0A–$0B` | INIT routine |
| `$0C–$0D` | PLAY routine |
| `$0E` | Selected zero-based subtune |
| `$0F` | VBI frame rate: 0=50 Hz, 1=60 Hz |
| `$10–$11` | Executable payload additive checksum |

## Regression testing

```bash
node --test tests/sid_phase2b1.test.js tests/sid_phase2a_mrheli.test.js
```

The Phase 2B.1 suite checks v1/v2 validation, the complete 28 KiB boundary,
unsafe footprints, different staging origins, original Mr. Heli SID-write
sequencing, forward/backward overlapping payload copies, correct 50/60 Hz
native timing, zero-page restoration, overwritten entrypoint restoration and
rejection of damaged staged bytes.

This is **Phase 2B.1 (loading and validation)**. Phase 2B.2 will add
a convenient browser-based PSID file picker and native subtune controls;
Phase 2C will investigate safe asynchronous/interrupt playback.
