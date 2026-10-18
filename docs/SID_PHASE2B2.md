# SID Phase 2B.2 — native Apple II PSID v1/v2 player

**The Apple II 6502 assembly source is authoritative.** The browser is only a
binary file-transfer utility and does not parse PSID music, select subtunes,
build descriptors, run a substitute player, or inject playback commands.

## What to do

1. Mount the SID peripheral in any Apple II slot 1–7 with audio enabled.
2. Load the **assembled native player images** from the Phase 2B.2 build:
   - `SID_Phase2B2_bootstrap.bin` at **$1C00**
   - `SID_Phase2B2_runtime.bin` at **$9000**
   These are distinct RAM segments, generated exclusively from
   `asm/AUDIO/SID_PHASE2B2_NATIVE_PLAYER.S`. Matching Apple II monitor
   listings are generated for either segment. The native player needs a
   disposable Apple II session; never execute alongside unsaved BASIC work.
3. In **Tools → Peripheral controls → SID → PSID**, choose a local raw
   `.sid` file and a hexadecimal start address in the **$2000–$8FFF**
   staging window. The transfer tool checks `start + file_length <= $9000`
   and copies **all original file bytes without modification**.
4. At the Applesoft prompt, enter `CALL 7168`. The Apple II player asks
   **PSID START ($HEX, ENTER=TRANSFER):**. Press Return to accept the
   browser-transfer address, or enter another hexadecimal address.
5. If you typed an address other than the recorded transfer address, the
   Apple II asks for the **complete raw PSID file length in hex** (for
   example, `12E9` for a 4,841-byte file). This makes manual uploads possible
   without the browser.
6. The native parser validates PSID v1/v2, shows the title, number of subtunes
   and default subtune, then asks for a **decimal subtune**. Press Return
   to accept the default or enter a value from 1 through the song count.
7. The Apple II calculates the executable payload start and length from the
   original PSID header plus the transfer byte count, checks destination and
   INIT/PLAY addresses, runs original INIT, and invokes original PLAY
   every 20,436 ticks (PAL) or 17,030 ticks (NTSC).
8. **Press any key** to stop; the native player mutes SID, restores the
   Apple II zero page and public entry stub, then returns to Applesoft.
   It does **not** automatically stop at the end of a composition.

Do **not** expect arbitrary C64 programs to work. This executes raw original
6502 music code, not a C64 ROM, VIC, CIA or 6510 environment.

## Transfer record (not a PSID descriptor)

A successful browser upload creates precisely eight bytes at **$9E00**:

| Offset | Contents |
|---|---|
| +0..+3 | ASCII `SIDF` (magic) |
| +4..+5 | 16-bit little-endian file start address |
| +6..+7 | 16-bit little-endian **complete** file byte length |

The file itself occupies **only** the selected staging addresses. Its
PSID header, optional embedded PRG load word, original music code and data
are not changed. The host knows the exact file size and contiguous RAM
capacity without interpreting PSID music. The native player can use the
record or accept manually entered start/length values.

The PSID v1/v2 header contains a *data offset* but no total file length.
The Apple II therefore computes:
`executable_length = recorded_file_length - data_offset - optional_PRG_word_bytes`.
This is the length of data copied to its **original declared C64 address**.
The music's *duration* is independent and is not used to determine copying.

## Native memory contract

| Address | Role |
|---|---|
| $1C00–$1C0B | Public 12-byte jump table, reconstructed after playback |
| $2000–$8FFF | Complete raw PSID file staging: 28 KiB including header |
| $9000–$9CFF | Resident native assembly code and variables (builder checks end) |
| $9D00–$9D11 | Native-generated 18-byte descriptor for existing playback core |
| $9E00–$9E07 | Raw-transfer size/location record |
| $9F00–$9FFF | Original Apple II zero-page backup |

The copy target must be entirely in $0C00–$BFFF and must **not** intersect
$9000–$9FFF. Header processing and keyboard/ROM I/O run before music zero
page is initialised. The original PLAY loop continues using the Phase 2B.1
deadline logic and unmodified SID $D400–$D41F bus writes.

## Compatibility and safety

Native parser supports genuine PSID v1/v2 with a compatible 6502 payload,
header-declared or embedded little-endian PRG load address, valid INIT and
PLAY inside the declared executable range, one SID, and VBI-timed subtunes.
Selected v1 speed flags repeat every 32 tunes; v2 uses bit 31 for higher
subtunes. Unsupported cases are rejected before executing the music:
RSID, v3/v4, PlaySID-specific samples/MUS, CIA-timed subtunes, additional
SID chips, IRQ-vector PLAY=0, illegal range/entrypoints, or insufficient data.

PSID header validation **cannot** prove that original code is independent
of other C64 ROM/RAM/CIA/VIC/6510 features or undocumented opcodes.
Use a disposable Apple II state. Only the zero page and overwritten
public entry stub are restored automatically; other overwritten memory
is not backed up.

## Build and verification

The new **single source of truth** is
`asm/AUDIO/SID_PHASE2B2_NATIVE_PLAYER.S`. The project CI assembles it with
the existing `ASM_core.js` (RetroAppleJS dialect), verifies every emitted
byte fits outside protected memory, and runs native emulator regressions.
The build-time helper `tools/SID_Phase2B2_build.js` emits the two binary
images, their monitor listings and a memory manifest; CI can publish these
as downloadable artifacts. You do not need to install Node.

The regression harness uses the **actual RetroAppleJS 6502** to exercise
ROM-style keyboard prompts and original SID register writes with v1/v2
containers, different staging addresses and the no-transfer-record path.
The browser transfer utility has independent tests checking exact copy,
file size, destination end and its eight-byte record.
