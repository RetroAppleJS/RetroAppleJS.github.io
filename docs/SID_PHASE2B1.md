# SID Phase 2B.1 — Safe-window generic PSID loader

Phase 2A is complete. Phase 2B.1 adds a **generic, conservative PSID v1/v2
loader** and a **262-byte foreground 6502 player at $1C00**. The original
music payload executes **unmodified** on the Apple II CPU and writes directly
to the SID peripheral at $D400–$D41F.

## Memory contract

| RAM | Purpose |
|---|---|
| $0000–$00FF | C64 music zero page while playback runs; original Apple II ZP restored on exit |
| $1C00–$1D05 | Installed 262-byte native foreground driver |
| $1D06–$1FFF | Reserved for future player growth |
| $2000–$8FFF | **Music executable region: 28 KiB (28,672 bytes)** |
| $9000–$90FF | Apple II zero-page backup while C64 music runs |
| Anywhere else in 64 KiB, or even overlapping the target | Input PSID **file staging**, provided it is copied into a snapshot before installation |

The original PSID file can be loaded at **any start address** where the complete
file fits in 64K RAM, including $0000 or $F000 for short files. The loader
parses a **copy** of the PSID before writing memory, so input staging can even
overlap the executable destination or the resident driver.

**The PSID executable's original load address is not relocatable.** Its
machine code generally contains absolute addresses. The current conservative
native execution contract therefore requires the PSID-declared code range to
fit entirely inside **$2000–$8FFF**, including INIT and PLAY. This provides
28 KiB of executable capacity, but does not magically make all 28 KiB tunes
compatible. Programs requiring data outside that region, C64 ROM/I/O or other
C64 system behavior may still fail. Such dependencies are not yet discovered
by static disassembly.

Mr. Heli's load address is **$0CA0**, so it is **not** eligible for this safe
generic window. Phase 2A remains its supported player. Phase 2B.2 may add a
legacy, separately isolated execution mode.

## Compatible PSID features

- PSID **v1/v2**, with ordinary 16-bit header load, INIT and PLAY addresses;
- zero load-header address with an embedded little-endian PRG load address;
- default or explicit subtune (converted to zero-based accumulator for INIT);
- PAL 50 Hz or NTSC 60 Hz, via PSID v2 clock flags or explicit override;
- true 6502-compatible code that returns from INIT and PLAY normally.

The loader deliberately **rejects** RSID, PSID v3/v4, CIA-timed subtunes,
PLAY=0 (requires a C64 interrupt environment), invalid or out-of-window
addresses, unsupported subtune values, and oversized payloads. For songs over
32, the PSID speed bitmap's bit 31 convention is observed.

The host program parses and validates the file, then patches *only the
resident player* at $1C00 with the subtune, INIT, PLAY and timer period.
Original music data is unchanged. The SID card's emulator-only latched CPU
clock indices $1E/$1F provide 20,436 CPU ticks/frame (50 Hz) or 17,030
ticks/frame (60 Hz).

## Build and test

From the repository checkout:

```bash
node tools/SID_Phase2B1_build.js path/to/compatible.sid output-dir
node --test tests/sid_phase2b1.test.js
```

The builder writes four files:

- `SID_Phase2B1_player.bin` — load at **$1C00**, then `CALL 7168`;
- `SID_Phase2B1_music.bin` — original executable bytes, load at the
  PSID's declared address (shown by the builder);
- `SID_Phase2B1_player_monitor.txt` — monitor hex for the resident player;
- `SID_Phase2B1_music_monitor.txt` — monitor hex for the original payload.

Alternatively, JavaScript code with access to the emulator's **underlying
physical 64K RAM Uint8Array** can invoke:

```js
const psid = require('./tools/SID_Phase2B1_build.js');
// The original complete PSID file was staged in RAM at some address:
const prepared = psid.installStaged(ram, 0xA000, fileByteLength, {
  subtune: 1, clock: 'PAL'
});
// prepared.entry === 0x1C00; launch through the emulated CPU, not JS execution.
```

This API does **not** claim the UI has direct access to physical RAM in the
browser; direct binary-memory upload and GUI tune selection will be integrated
in a later Phase 2B delivery. This first implementation provides a validated
data path, CLI, monitor listings and a real-6502 regression harness.

Use a **disposable text-mode emulator session**. Running arbitrary C64 machine
code can overwrite Apple II memory, ROM-backed soft switches or the original
tune's data. Do not run disk activity or Apple II operating systems alongside
the foreground player. The driver only restores the 256-byte zero page, not
arbitrary memory that a tune might have modified. The STOP entry at $1C03
silences SID only after foreground playback exits; press any key to end.

## Validation

Tests use the actual RetroAppleJS 6502 core to execute synthetic original
PSID payloads at $2000, $4600 and $8E00, with slots 1, 4 and 7, PAL/NTSC
music timing, subtune selection, native SID writes and zero-page restoration.
Additional tests cover arbitrary input staging, PSID v1/v2 header handling,
memory limits, full 28 KiB payloads and deliberate incompatibility rejection.

Phase 2B.2 follows with tune selection in the UI, a curated compatibility
matrix, and safe handling of additional memory layouts. Phase 2C covers
background playback with true IRQ-aware host state preservation.
