# SID Phase 2C.2 — Assembly-first resident PSID player

**Authoritative deliverable:** `asm/AUDIO/SID_PHASE2C2_BACKGROUND_PLAYER.S`.

This is a native 6502 Apple II+ program. All PSID v1/v2 header handling,
subtune choice, original INIT/PLAY calls, resident IRQ handling and STOP/
REPLAY/NEXT are implemented in **assembly**, not a browser-side music player.
There is no maintained or downloadable Phase 2C.2 precompiled binary.

## Assemble and load with RetroAppleJS

1. Boot a disposable Apple II+ session with the SID card in **slot 4**
   and ProntoDOS beginning at $9600. No Language Card is required.
2. In the built-in **RetroAppleJS Assembler**, load
   `asm/AUDIO/SID_PHASE2C2_BACKGROUND_PLAYER.S`. Select the
   **RetroAppleJS** dialect.
3. Click **Assemble** (not *Byte encode source*). The assembler emits a
   **single contiguous, ordered stream** beginning at **$8000**. The
   source uses one `ORG $8000` and explicit `.RES` directives to emit
   each intervening padding byte. No packaging script invents missing
   bytes or relocates code.
4. Use **Tools → to emulator**, then **Paste** in the emulator to load
   the assembled machine code at its correct address.
5. In **Peripheral controls → SID → PSID**, transfer an unchanged raw PSID
   of up to **8 KiB** into **$6000–$7FFF** (for example, start $6000).
   The host knows the actual file length and writes the 8-byte `SIDF`
   transfer record. It does not parse or execute the tune.
6. At Applesoft, start the interactive parser with:
   ```basic
   CALL 32768
   ```
   Select the subtune. The original INIT runs, then background IRQs invoke
   the original PLAY while foreground Applesoft continues.

The *source* is the project artifact. The compiled byte stream lives only
as the output of the assembler or in emulator RAM.

## Save your own program for later BLOAD (optional)

When the assembled bytes are already loaded in emulator RAM, **you**
can save them onto a writable DOS-compatible disk using Applesoft/DOS:

```text
BSAVE SIDPLAYER,A$8000,L$13F6
```

The length `$13F6` (5,110 bytes) describes the assembly image before
future source edits; **always verify the new assembled length** before
BSAVE. Later, `BLOAD SIDPLAYER` reloads your own assembled program in a
single operation. These disk commands are optional: development and testing
use source → Assemble → to emulator → Paste.

## Resident callable controls

No artificial public jump table exists at $1C00. CALL targets correspond
to actual 6502 assembly labels, which can move if the source changes:

| Assembly label | Purpose | Last verified CALL address |
|---|---|---|
| `NATIVE_ENTRY` | Parse raw PSID and choose subtune | `CALL 32768` ($8000) |
| `BG_STOP` | Stop timer and silence SID | `CALL 37738` |
| `BG_REPLAY` | Restart same subtune from INIT | `CALL 34816` |
| `BG_NEXT_SUBTUNE` | Advance one subtune and restart | `CALL 35500` |

The numbers reflect a previous validated layout; use the **Symbols**
pane of your current RetroAppleJS assembly for the actual addresses.
The CI assembly validator also prints these symbol-derived values.

## Fixed RAM requirements

| Address | Use |
|---|---|
| $6000–$7FFF | Complete raw PSID file, up to 8 KiB including PSID header |
| $8000–$87FF | Native PSID interpreter and prompts |
| $8800–$8FFF | Resident playback controls, $8FF0 `S2C2` marker |
| $9000–$92FF | Source-assembled zero padding |
| $9300–$93FF | Interrupt service, STOP and resident state |
| $9400–$94FF | Persistent C64 music zero-page shadow |
| $9500–$95FF | Foreground Apple II zero-page backup |
| $9600+ | ProntoDOS, preserved |

The assembly emits program bytes only at $8000–$93xx; context pages
$9400–$95FF are reserved **RAM working storage**, not part of the
assembled image. The original C64 tune's executable must remain entirely
below $8000 and cannot overwrite the resident code. Also verify it does
not conflict with BASIC program text, DOS buffers, or raw PSID staging.

## Timer, lifecycle and limitations

The emulated SID expansion card provides a CPU-tick-driven IRQ timer at
50 or 60 Hz, independent of display FPS. The resident assembly IRQ handler
saves X and Y, acknowledges only its own timer, preserves the interrupted
foreground zero page at $9500, restores the music zero page from $9400,
runs original C64 PLAY, saves updated music ZP, restores Apple II ZP,
then restores registers and uses `RTI`. Unrelated IRQs are chained.

This is **controlled compatibility**, not C64 memory virtualization.
The Apple II Monitor IRQ dispatcher writes to zero-page $45 before
invoking its software IRQ vector, so perfect foreground zero-page isolation
is not yet guaranteed. Tunes relying on CIA-timed playback, arbitrary C64
peripherals, incompatible memory ranges, or unusual stack behaviour remain
unsupported. Original PLAY and music context switching may consume a large
fraction of the CPU time available between timer interrupts.

Regression tests compile the same `.S` through `ASM_core.js`, require
the resulting **assembly records themselves** to cover every byte of the
single range (without JavaScript filling gaps), and exercise actual 6502
background playback, STOP, replay, subtune changes and host transfer bounds.
CI validates the source but does not publish a binary.
