# SID Peripheral — Phase 1: Native diagnostic and minimal PSID playback

This phase exercises **Apple II 6502 → native $D400 writes → EMU_CARD_SID → EMU_DEVICE_SID_audio → Web Audio**. It is not a general PSID loader or a hardware-accurate 6581/8580 sound comparison.

## Files and entrypoints

- **asm/AUDIO/SID_PHASE1_MINIPLAYER.S** — native Apple II diagnostic, with PSID-compatible initialization and playback routines
- **tools/SID_Phase1_pack.js** — builds a PSID v2 and an Apple II binary from exactly the same assembled machine code
- **tools/music/SID_Phase1_Test.sid.b64.txt** — precomputed Base64 PSID fixture to paste into tools/SIDchipJS.html
- **tests/sid_phase1_playback.test.js** — executes the compiled code in RetroAppleJS's actual JavaScript 6502

| Address | Meaning | Applesoft command |
|---|---|---|
| $6000 | Standalone diagnostic, with software timing | CALL 24576 |
| $6003 | PSID-style INIT, no built-in timing | CALL 24579 |
| $6006 | PSID-style PLAY, one callback | CALL 24582 |
| $6009 | Silence SID | CALL 24585 |

## Run the native Apple II demo

1. Mount **MOS 6581 / 8580 SID synthesizer** (PCODE SID) in **slot 5**, with its audio device attached. Use the regular JavaScript 6502, not the WASM accelerator.
2. In the toolbox, select **6581**, **PAL 985248 Hz**, enable **Native $D400 writes** and choose a nonzero output volume.
3. Turn on the emulator audio; the browser may need an explicit click to unlock Web Audio.
4. In the RetroAppleJS assembler, open **asm/AUDIO/SID_PHASE1_MINIPLAYER.S** (raJS dialect), assemble and load it into $6000–$615A (347 bytes).
5. From Applesoft BASIC, enter **CALL 24576**; alternatively execute $6000 from the machine monitor.

The demonstration runs approximately six seconds, one second per distinct stage:

| Stage | Features | What to hear |
|---|---|---|
| 0 | Voice 1, 440 Hz, 50% pulse, oscillator TEST + ADSR/GATE | Square-like tone |
| 1 | Triangle, retrigger, lower master volume | Softer tone |
| 2 | Sawtooth, retrigger | Brighter tone |
| 3 | Noise, retrigger | Noise texture |
| 4 | Three voices (C4/E4/G4), resonance, low-pass filter | Filtered major chord |
| 5 | Triangle RING on voice 2, hard SYNC on voice 3 | Modulated chord |
| 6 | All gates off and volume zero | Silence; program returns |

The standalone delay routine measures approximately **20,104 host CPU cycles** in the current 6502 implementation. That corresponds to 50.83 cycles of the delay per second at 1,021,800 Hz, *before* playback routine overhead. It is an approximate polling timer, **not a hardware timer or exact 50.000 Hz IRQ**.

The INIT and PLAY entrypoints are separate and have no built-in wait loops. Calling PLAY manually once from BASIC is not one second of music; it advances only one of the 50 ticks needed for a stage transition.

## Play the same code as a PSID in SIDchipJS

Run from a repository checkout:

    node tools/SID_Phase1_pack.js

The tool generates two files in tools/music:

- **SID_Phase1_Test.sid** — PSID v2, PAL / 6581 preference, load=$6000, init=$6003, play=$6006, one subtune, VBI-rate callbacks
- **SID_Phase1_Test.bin** — exact 347-byte executable for the Apple II

Or paste the supplied Base64 text fixture into **tools/SIDchipJS.html**, then choose **Load from Base64** and play subtune 1.

The PSID player and the Apple II use the **same 6502 INIT and PLAY implementation**. Only the standalone RUN entry contains the Apple II-specific $C0D0 signature check and polling delay, so normal PSID execution does not depend on Apple II hardware.

The two synthesizers (jsSID and our new SIDAudio) are not identical, so the sounds do not yet have to match sample-for-sample. This experiment checks that native 6502 control, SID register writes, gate transitions and music callback structure work.

This does **not** execute arbitrary third-party PSID files directly on the Apple II. That is the Phase 2 target.

## Acceptance checks

| Test | Expected result |
|---|---|
| Assembler | ASM_core raJS dialect reports no errors |
| Entry points | JMP stubs at $6000, $6003, $6006, $6009 |
| Native write path | Writes to $D400–$D418 captured without modification |
| 50 Hz scheduler | Busy-wait within 5% of nominal, no extra IRQ requirement |
| Playback | Six 50-tick phases; three voices + low-pass in phase 4; TEST, ring and sync exercised; then silence |
| Audio output | Device-owned Web Audio source delivers nonzero PCM when enabled |
| Device off | Sound stops and buffers are cleared without rebuilding the card |
| Models | 6581 and 8580 selections remain functional |
| Clocks | PAL and NTSC clock options do not crash; frequency shifts as expected |
| Snooping | Disabling $D400 interception prevents native writes; SlotIO remains usable |
| ROM compatibility | Standard Apple II ROM / Language Card writes remain unchanged |

Automated tests:

    node --test tests/sid_card.test.js tests/sid_phase1_playback.test.js

## Deliberate limits

Only one SID chip, no native PSID file loader, no C64 $01 banking, CIA/VIC timers or 6510 extensions, no SID global-read interception, and no hardware-accurate 6581/8580 model. The standalone demo monopolizes the Apple II CPU while playing and should not run simultaneously with DOS or ProDOS operations. On a writable Language Card the $D400 write is also written to that card's RAM, just as with passive physical-bus snooping.
