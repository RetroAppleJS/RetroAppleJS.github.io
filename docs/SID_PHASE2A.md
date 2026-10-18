# SID Phase 2A — Native Mr. Heli foreground playback

Phase 2A plays **Charles Deenen's original Mr. Heli (1989)** using the
**Apple II NMOS 6502**, writing unmodified $D400–$D418 SID register addresses
through PCODE **SID** and **EMU_DEVICE_SID_audio.js**. There is no C64 emulator,
Mockingboard, SID-to-AY conversion, or SID instruction patching in this path.

## Repository files

| Path | Function |
|---|---|
| asm/AUDIO/SID2MB_prototype/Mr_Heli_original.sid | **Original 4,841-byte PSID**, unchanged |
| asm/AUDIO/SID2MB_prototype/SID_PHASE2A_MR_HELI.S | New **foreground 6502 driver** at $2000 |
| asm/AUDIO/SID2MB_prototype/SID_PHASE2A_MR_HELI_monitor.txt | Ready-to-enter Apple II monitor listing |
| asm/AUDIO/SID2MB_prototype/Mr_Heli_PSID_at_6000_monitor.txt | Original PSID bytes for entry at $6000 |
| tools/SID_Phase2A_build.js | Regenerate .bin and monitor image from the assembly source |
| tests/sid_phase2a_mrheli.test.js | Execute actual 6502 and compare SID writes |

Do **not** run the older SID2MB_native_MrHeli.asm: that is a distinct,
unfinished SID-to-Mockingboard translation prototype.

## Running the music in RetroAppleJS

1. Start a **disposable** Apple II+ session in **text mode**, with the
   regular JavaScript 6502 and CPU speed at **100%**. No HGR, disk
   activity, IRQ-driven applications or unsaved work while the player runs.
2. Mount PCODE **SID** with attached SIDAUDIO in slot 1–7 (slot **4** preferred).
   Select **6581**, **PAL 985248 Hz**, native $D400 writes ON, nonzero volume,
   and enable browser audio.
3. From a fresh Applesoft prompt, use **NEW** and **HIMEM:3072** before loading.
   This restricts ordinary BASIC allocations below $0C00 but **does not**
   guarantee DOS or ProDOS compatibility.
4. Load the **complete original 4,841-byte .sid file including PSID header**
   as a raw binary into RAM at **$6000–$72E8**. The existing
   Mr_Heli_PSID_at_6000_monitor.txt is an alternative to a binary RAM loader.
   Do not stage the 4,715-byte code body alone, a Mockingboard driver, or SREG.
5. Assemble SID_PHASE2A_MR_HELI.S with **ASM_core.js / raJS** and load it at
   **$2000–$21F3** (596 bytes), or use the checked-in monitor hex listing.
6. Run **CALL 8192**. Default subtune **5** (zero-based selector 4) plays in
   the foreground. **Press any key** to stop, restore Apple II zero page,
   and mute the SID master volume.

To test the slot-4 signature, **PRINT PEEK(49344)** should return **83** ($53).
The player itself scans $C090, $C0A0, ..., $C0F0 and does not require slot 4.
**Caveat:** probing other cards' SlotIO addresses can trigger their soft
switches. This proof of concept assumes a controlled peripheral configuration.

### Entrypoints

| Address | Applesoft | Function |
|---|---|---|
| $2000 | CALL 8192 | Validate, copy, INIT, play until keypress, restore state |
| $2003 | CALL 8195 | Silence SID (only available after foreground exit) |
| $2006 | CALL 8198 | Restart same music in foreground |
| $2009 | CALL 8201 | Return error code in 6502 A (observe in debugger) |

ERRORCD is currently at **$224C** (decimal 8780), inspect using
**PRINT PEEK(8780)**: 0 = success, 1 = invalid/incomplete PSID, 2 = SID not
detected. Failure prints **SID 2A ERROR** through the Apple II monitor.

The foreground player intentionally disables maskable IRQs until a key stops
playback; STOP cannot be called asynchronously from another BASIC command.

## Memory layout and data integrity

| Range | Use |
|---|---|
| $0000–$00FF | Temporarily the C64 music player's zero page |
| $0100–$01FF | Shared 6502 stack; original INIT/PLAY return normally |
| $0400–$07FF | Apple II text display |
| $0CA0–$1F0A | Copied, **unmodified** 4,715-byte Mr. Heli music program |
| $2000–$21F3 | Native foreground driver |
| $5D00–$5DFF | Saved original Apple II zero page |
| $6000–$72E8 | Staged original PSID file, including 126-byte header |
| $D400–$D41F | Passive SID write observer; Apple II ROM mapping remains |

The loader checks the known PSID header, load address, INIT and PLAY addresses,
signature bytes and **all 4,715 payload bytes** via a 16-bit additive checksum
(**$3B46**). This catches accidental corruption but is **not cryptographic**
authentication or a generic PSID parser. Data is copied in 18 pages plus
107 bytes from $607E to $0CA0.

C64 zero page remains active for the entire foreground loop, with Apple II IRQs
masked and no Apple II ROM calls until the music stops. This avoids the overhead
of swapping 256 bytes for every PLAY callback. The old Apple II zero page is
restored on exit; overwritten Applesoft workspace at $0CA0 is **not** restored.
Always use a disposable emulator snapshot.

## Playback cadence and accuracy

The native foreground player calls original INIT=$1EF3 then PLAY=$0E34.
Rather than a fixed busy-wait delay, the driver reads a **latched 16-bit
emulated CPU clock** through the SID card's SlotIO indexed data register:
index $1E returns the low byte and latches the tick; index $1F returns
the high byte from the same snapshot. The driver auto-discovers the card's
slot, so slots 1–7 work without editing any operands. The clock read extension
is provided by **RetroAppleJS's SID card**, not the original MOS SID hardware.
An unmodified physical SID expansion card cannot be assumed to provide it.

The player increments an **absolute deadline by 20,436 CPU ticks** (exactly
50 Hz at 1,021,800 CPU ticks/s) before each PLAY callback, independent of
the previous callback's execution time. A 100-interval run of the actual
RetroAppleJS 6502 with subtune 5 measured **20,435.88 ticks per interval**
(20,331–20,539 ticks, about ±0.1 ms jitter) across a 2-second window.
This significantly improves the previous ~49.69 Hz music pace. The CPU-speed
slider still scales the music tempo relative to real time.

At 18 frames, the player generated **441 unmodified original SID register
writes**, identical in address, value and order to direct execution of the
same original INIT/PLAY code. Four additional register writes mute the
device on exit. The run restored all 256 zero-page bytes and the original
CPU interrupt mask.

This validates executable music sequencing, **not** 6581 analog fidelity:
EMU_DEVICE_SID_audio.js remains a preliminary synthesizer.

## Build and test

From the repository checkout:

    node tools/SID_Phase2A_build.js

This produces **tools/music/SID_Phase2A_MrHeli_loader.bin**, to be loaded at
$2000, and **tools/music/SID_Phase2A_MrHeli_loader_monitor.txt**.

Run:

    node --test tests/sid_phase2a_mrheli.test.js tests/sid_card.test.js

Regression tests cover header and payload integrity, slot detection, actual
RetroAppleJS 6502 playback, exact SID write-sequence equivalence, CPU cadence,
keypress exit, zero-page restoration, audio mute, and error handling.

## Deliberate limitations

- Only this **specific Mr. Heli PSID**, default subtune 5, is supported.
  General PSID parsing and alternate subtunes are Phase 2B.
- No VIC, CIA, C64 ROM, 6510 banking, extra SID chips or undocumented 6502
  instruction support. Only original code already compatible with 6502 runs.
- No background music, VBL or timer IRQ; those are Phase 2C.
- The exact 50 Hz CPU clock extension is emulator-specific and is only
  provided by this revision of the SID card. Older builds with the $1E/$1F
  selector unimplemented cannot run this revised foreground player.
- Existing card and SIDAUDIO are unchanged; no SID-to-AY translation.
