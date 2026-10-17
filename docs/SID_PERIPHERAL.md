# SID Expansion Card — PCODE `SID` (initial implementation)

The SID card models an Apple II expansion PCB hosting a MOS 6581 or MOS 8580. Its **peripheral controller** (`res/EMU_CARD_SID.js`) handles Apple II address decoding, configuration and bus access. Its **attached audio device** (`res/EMU_DEVICE_SID_audio.js`) owns **all SID oscillator/envelope/filter synthesis, sampling, audio buffering and Web Audio output**. There is no audio synthesizer or browser audio context in the card class.

## Installation

Select **MOS 6581 / 8580 SID synthesizer** from the Slot Manager (PCODE `SID`), preferably slot 5. The card is not installed by default; the audio device `SIDAUDIO` is automatically attached when the card is mounted. Use the existing emulator speaker/audio control to activate the output.

The slot toolbox has:

- **SID model:** 6581 or 8580; default 6581.
- **Clock:** PAL 985248 Hz (default) or NTSC 1022727 Hz.
- **Native $D400 writes:** enable/disable passive CPU write listening; enabled by default.
- **Volume:** output volume 0–100%.

Model, clock and volume survive a card soft reset, but page reloads initialize them to the defaults.

## How native SID writes work

The normal Apple II `Apple2Hw.write()` dispatcher completes the original motherboard ROM/Language Card write, **then** publishes writes in `$D400–$D41F` to mounted PCODE `SID` cards. No HostROM mapping or `/INH` emulation is used, so other expansions keep their memory mapping.

```asm
LDA #$41      ; Pulse + GATE
STA $D404     ; SID voice 1 control register (no C64 address patching)
```

**Important:** If an MS16K/Language Card has writable RAM active at `$D400`, the same write also modifies that RAM. This is the expected hardware-visible behavior of a passive listener. The card does not attempt to inhibit or override the memory write. Program execution and SID initialization remain the 6502 software's responsibility.

The card intentionally **does not intercept reads** at `$D419–$D41C`: motherboard ROM or language-card memory retains ownership of these reads. Compatible SID readback is provided through the slot I/O interface.

## Slot I/O registers

In slot `n`, use `$C080 + n*16` through `$C08F + n*16` (for slot 5: `$C0D0–$C0DF`).

| Offset | Read | Write |
|---|---|---|
| 0 | Signature `$53` ('S') | — |
| 1 | Flags: bit 0 enabled, bit 1 snoop, bit 2 8580, bit 3 audio attached | — |
| 2 | Selected SID register (0–31) | Select register (0–31) |
| 3 | Selected SID register read (write-only registers return `$FF`) | Write SID register |
| 4 | Model: 0=6581, 1=8580 | Select model (bit 0) |
| 5 | Clock: 0=PAL, 1=NTSC | Select clock (bit 0) |
| 6 | Card enabled status | Enable/disable (bit 0) |
| 7 | Passive snoop status | Enable/disable snooping (bit 0) |
| 8 | POTX (unconnected: `$FF`) | — |
| 9 | POTY (unconnected: `$FF`) | — |
| A | OSC3 (approximate) | — |
| B | ENV3 (approximate) | — |
| C | Last intercepted register offset | — |
| D | Last write value | — |
| E | Low byte of snooped write count | — |
| F | High byte of snooped write count | — |

Example for slot 5:

```asm
LDA #$00
STA $C0D4    ; Select 6581 (0), or use #$01 for 8580
LDA #$04
STA $C0D2    ; SID control register index $04
LDA #$41
STA $C0D3    ; Write pulse + GATE to voice 1
```

## Sound engine — revision 1

The audio device is a preliminary synthesizer running at 22,050 Hz with three oscillators, frequency/width registers, triangle, sawtooth, pulse and pseudorandom noise, basic ADSR, gate and TEST, basic sync/ring approximations, rudimentary filter routing and master volume. The model selector changes the preliminary filter curve. **The 6581 and 8580 are not yet faithfully modeled.** Resonance, mixed-waveform interactions, noise LFSR details, true envelope quirks, analog filter behavior, 6581 DAC nonlinearity and cycle-exact sample playback remain future work.

The browser AudioContext is created only when the normal emulator audio output is activated. The device retains the CPU-tick-to-sample timeline and owns its PCM queue and playback source scheduling. Disabling output does not require replacing or restarting the peripheral.

## Deliberate first-version limitations

- **No native PSID loader, 50/60 Hz interrupt player or C64 memory environment** yet. The card works when Apple II software itself writes SID registers.
- Only **one SID chip** is supported. Multi-SID PSIDs require a later architecture extension.
- Native `$D400` **write** interception only; reads must use slot I/O.
- Live sid-bus snooping is routed via `Apple2Hw.write()` in the JavaScript CPU. The separate flat-memory **WASM CPU accelerator** bypasses live bus callbacks and therefore does not support native SID output in this revision.
- Audio filter is a coarse approximation of the two chips. Neither model claims cycle-accurate 6581 or 8580 output.

## Files

- `res/EMU_CARD_SID.js`: card identity, PCODE, SlotIO, passive write interception and toolbox.
- `res/EMU_DEVICE_SID_audio.js`: chip and audio-sink implementation.
- `res/EMU_apple2hw.js`: single passive global SID-write notification point.
- `res/EMU_apple2io.js`: dispatch to mounted SID cards.
- `docs/CONFIG.md` and `res/COM_CONFIG.js`: PSLOT registration.
- `tests/sid_card.test.js`: bus, slot controls, model selection and synthesis smoke tests.


## Phase 1 native diagnostic and minimal PSID fixture

See [SID Phase 1](SID_PHASE1.md) for the native Apple II assembly diagnostic,
the same 6502 music routines packaged as a PSID v2 file for jsSID,
a reproducible Base64 fixture and integration tests covering waveforms,
oscillator TEST, ring modulation, hard sync, filter routing and GATE.
This is a diagnostic music driver, not a general C64 PSID loader.
