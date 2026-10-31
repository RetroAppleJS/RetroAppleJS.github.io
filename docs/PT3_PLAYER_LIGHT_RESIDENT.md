# PT3 PLAYER LIGHT — Resident square-tone player (phase PT3-03A)

**Source:** `asm/AUDIO/PT3_PLAYER_LIGHT_ASM_CORE.S`

**Status:** Candidate implementation. ASM_core assembler + native 6502/VIA/AY
CI verifies the executable; real RetroAppleJS browser and physical Mockingboard
acceptance remain separate gates.

This derives from the existing `PT3_02B_ASM_CORE.S`, retaining Vince
Weaver's native PT3 library (0BSD license option, pinned upstream commit
`cb0546ede762646196169f1517735cedca72ddfe`) and the
PT3-02B Spectrumizer/ST tone-table correction for the nominal 1,021,800 Hz
AY clock. No JavaScript song decoder or direct host-side AY writes are used.

## Public entrypoints

The player loads into writable RAM at **$6000**, and the page-aligned PT3
module must already be in RAM at **$8000**. It claims ZP **$60–$7F**;
the original Apple II Monitor IRQ interface also uses **$45** and
`$03FE/$03FF`.

| Address | Call | Return A | Effect |
|---|---|---|---|
| `$6000` | START | 0 success, 1 already active, 2 bad PT3 header, 3 T1 busy | Starts a song, **returns to the host** |
| `$6003` | STOP | 0 | Disables own VIA0 Timer1 interrupt, mutes volumes, restores soft IRQ vector and saved DDR/ACR |
| `$6006` | PAUSE | 0 success, 1 invalid state | Pauses PT3 frame decoding and mutes volumes |
| `$6009` | RESUME | 0 success, 1 invalid state | Continues from the paused PT3 decoder state |
| `$600C` | STATUS | 0 stopped, 1 playing, 2 paused, 3 ended | Non-blocking status |

Call with **JSR** (or Applesoft BASIC `CALL`), not a bare `JMP`.
START/STOP/PAUSE/RESUME preserve the caller's original processor interrupt-enable
flag via PHP/SEI/PLP. All calls may modify A/X/Y; STATUS returns a value in A.
While playback runs, the caller owns the foreground and can update HGR,
execute game logic or access memory outside the reserved regions.

The track loops by default: `PT3_LIGHT_LOOP_DEFAULT = $01`. Changing the
source constant to zero and reassembling selects single-play mode; in that
case STATUS reports 3 after PT3 finishes. A subsequent STOP is still required
to detach the Timer 1 handler.

## Square-only audio profile

PT3 patterns, notes, volume motion and ornaments are still decoded at the
normal **50 Hz** music tick. The resident output forces the AY tone/noise
mixer's noise-disable bits (R7 bits 3–5), masks the hardware-envelope flag
on R8/R9/R10, and writes only R0–R10. It consequently does **not** render
tracker noise or hardware-envelope instruments faithfully. Such instruments
are deliberately simplified in this economical profile, rather than changing
the musical note data.

This phase does **not** support 4/8/16-step software-DAC shapes and uses
**no high-frequency waveform interrupt**. Both AY0 and AY1 receive mirrored
register updates (the existing Weaver 6502 behavior), not six independent
voices.

## IRQ ownership, memory and limitations

- Physical Mockingboard **slot 4** / RetroAppleJS internal **SlotN=5**.
- VIA0 Timer1 latch `$4FE7` (20,457 CPU cycles/IRQ, approximately 50 Hz).
- The player refuses to install if VIA0 Timer1 already has an enabled IRQ.
- It saves the previous Monitor soft IRQ vector and forwards non-T1 IRQs
  to that vector. STOP masks **only** the owned T1 interrupt, rather than
  disabling the VIA's other interrupt sources.
- It saves and restores the two VIAs' port direction registers and VIA0 ACR.
  It **does not** pretend to restore a previously running T1 counter/phase,
  port output latches or another sound owner's AY register image.
- The player assumes exclusive ownership of the Mockingboard's AY ports
  during playback. Do not overwrite `$03FE/$03FF`, change its VIA0 Timer1
  configuration, or reuse ZP `$60–$7F` while it is active.
- The code is **resident in RAM**, not a DOS TSR: integration with arbitrary
  DOS/ProDOS applications and a dynamically relocatable song address
  requires further work. The initial module address is fixed at `$8000`.
- A basic `ProTrack` header check guards START. This is **not** full PT3
  file validation; malformed offset tables may still cause invalid reads.
- No other session is allowed to own the same VIA0 Timer1 interrupt.
- The original II+/IIe Monitor IRQ/RTI contract is assumed; IIc/IIGS, physical
  hardware and DOS service coexistence have not yet been validated.

## Build and regression

```bash
node tools/PT3_PLAYER_LIGHT_verify.cjs
python tools/PT3_02A_fixture.py build/pt3_light/original.mid
spectrumizer build/pt3_light/original.mid --style faithful \
    -o build/pt3_light/PT3_PLAYER_LIGHT_TEST.pt3
node tools/PT3_PLAYER_LIGHT_native_run.cjs
```

The test executes the genuine `Cpu6502`, `MockingboardR6522` and
`MockingboardAYBus` components. It verifies START/host foreground concurrency,
50 Hz IRQs, no noise or envelope output, mirrored AY0/AY1 writes, pause/resume,
STOP restoration, bad module detection, busy T1 detection, and restarting.
The test's minimal Monitor IRQ bridge does not reproduce a complete browser
boot or a physical motherboard.

Generated files appear under `build/pt3_light/`, including a raw
`PT3_PLAYER_LIGHT.bin` to load at `$6000`.

## Manual browser acceptance

1. Load resident player code at `$6000`, matching raw PT3 at `$8000`
   (do **not** insert a DOS binary header into either memory image).
2. Install Mockingboard in physical slot 4. Use the Apple II Monitor or BASIC
   to invoke `CALL 24576`; **it must return** to the prompt or caller
   while the PT3 continues playing.
3. With player active, perform independent HGR work. Monitor AY/FYM history
   and record 8-bit 22,050 Hz WAV if desired.
4. Try `CALL 24582` to pause, `CALL 24585` to resume and
   `CALL 24579` to stop; after STOP, no further music IRQ writes should occur.
5. Call START again and confirm a clean restart. Confirm slot changes/reboots
   do not leave stale interrupts.
6. Check pitch, CPU budget and graphical foreground latency against the
   previously accepted PT3-02B baseline.

The present source does not itself load PT3 from disk or allocate its own
safe zero-page block; that is a separate host integration responsibility.
