# PT3-02B — Spectrumizer ST tone-table calibration

## Why the previous music was flat

The original `PT3_02A_ORIGINAL.pt3` is **not** damaged: Spectrumizer's PT3→MIDI reverse export recovers the original notes (reordering the A/C voices as part of the arrangement).

The module specifies tone-table **1 (ST)** at PT3 header offset `$63`. In our test, the native player output a tone period of **134** for the intended MIDI C5 (523.25 Hz). The period 134, played through the RetroAppleJS 1,021,800 Hz AY clock, produces **476.6 Hz**, approximately **162 cents flat**. The 6502 implementation of Weaver's PT3 library multiplies tracker periods by `9/16`, a conventional approximation for adapting 1.77 MHz-based data to a ~1 MHz Mockingboard. Spectrumizer's ST periods in this module are on a different reference scale (the observed C5 ST period is consistent with a **2 MHz reference**). Applying `9/16` directly produces the offset.

This is a **tone-table compatibility** issue, not a WebAudio/AY oscillator or VIA timer bug. The fresh browser WAV's FFT peaks match FYM-exported AY period frequencies, confirming the oscillator renders the supplied period accurately.

## Chosen fix (minimal intervention)

At player startup, **after `pt3_init_song` and before enabling interrupts**, check `PT3_LOC+PT3_HEADER_FREQUENCY`. If it is **1 (ST)**, replace the player's generated 96-entry tone-note table with precompensated equal-tempered periods for the exact RetroAppleJS Mockingboard clock **1,021,800 Hz**. The original per-IRQ frequency converter, tracker decoder, AY bus and browser audio are all unchanged. Non-ST table selections continue to use upstream note tables unmodified.

For note-table index `i` from 0 through 95, with MIDI note `m=i+24`:

```text
noteHz    = 440 × 2^((m - 69) / 12)
targetAY  = round(1_021_800 / (16 × noteHz))
rawPeriod = ceil(targetAY × 16 / 9)
```

The precomputed low and high bytes of each `rawPeriod` live in the source as two `.BYTE` tables. Weaver's existing `floor(rawPeriod × 9 / 16)` output then equals `targetAY`, subject to AY integer period resolution. This is only an adjustment to the **table-1 path**, not an arbitrary transposition of all PT3 modules.

For the actual test melody:

| MIDI note | Target AY period | 6502 observed period | Error |
|---|---:|---:|---:|
| C3 / 48 | 488 | 488 | +0.7 cents |
| C4 / 60 | 244 | 244 | +0.7 cents |
| C5 / 72 | 122 | 122 | +0.7 cents |
| G5 / 79 | 81 | 81 | +9.8 cents |

## Evidence / acceptance

The native test runs **6 seconds** with the genuine RetroAppleJS `Cpu6502`, `MockingboardR6522` and `MockingboardAYBus`. It checks actual AY register writes rather than injecting synthetic register sequences.

**GitHub Actions run 41209192589 — PASS:**

- Every one of **72 note-channel pitch samples** (24 time positions × 3 channels) is within **±15 cents** of the original source MIDI, after accounting for Spectrumizer's A/C channel mapping and quantized 240 ms notes.
- Maximum absolute error **10 cents**; mean absolute error **2.17 cents**.
- **294** 50 Hz IRQs in six simulated seconds; **3,836** AY writes **per chip**; mirrored register values identical.
- Foreground counter and visible HGR marker continue advancing under timer IRQ playback.
- `ASM_core.js` flattened source compiles **byte-for-byte identical** to pinned ca65/ld65 player.
- Source fits `$6000–$6FFF` (**3,561 bytes**). The PT3 module is separately installed at `$8000` (**862 bytes**).

**Not yet validated:** whether this corrected player and original PT3 sound right on the full *browser* emulator and a physical Mockingboard. Only the native CPU/VIA/AY harness is green. The browser listening test is the next acceptance gate.

## Load procedure

1. Assemble `asm/AUDIO/PT3_02A_ASM_CORE.S` in `ASM_core.js` / **raJS** dialect. Verify first three JMP vectors are located at `$6000`, `$6003`, and `$6006`.
2. Load the corresponding `PT3_02A_ORIGINAL.pt3` **raw, without an extra DOS file header**, at `$8000`. Check that bytes at `$8000` start `50 72 6F 54 72 61 63 6B` (`ProTrack`).
3. Attach the Mockingboard to **physical slot 4** (RetroAppleJS internal slot 5). Enable audio and execute `6000G`.
4. See foreground HGR marker and hear the short original three-voice melody. The module is deliberately nonlooping and eventually stops sounding, while foreground rendering continues.

Alternatively, paste the **matching** `PT3_02A_MONITOR.txt` produced by CI: this listing loads both program *and* song, then executes `6000G`. Do not combine binaries/listings from different CI runs.

## Scope and trade-offs

The table assumes a nominal **1,021,800 Hz AY clock**. A different actual oscillator frequency requires recalibration. At very high notes, AY integer-period quantization may exceed ±15 cents; the measured diagnostic melody stays within ±10 cents. Other PT3 table selections still use Weaver's original pitch mapping, which may require independent calibration. No browser playback claims are made based on the headless test alone.
