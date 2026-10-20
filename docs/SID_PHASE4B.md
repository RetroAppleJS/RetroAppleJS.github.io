# SID Phase 4B — Digital Oscillator Fidelity (22.05 kHz)

**Production synthesizer:** res/EMU_DEVICE_SID_audio.js  
**Comparison tool:** tools/SID_AUDIO_BENCH.html  
**New regression:** tests/sid_phase4b.test.js  
**Phase 4A baseline:** User's PAL/22,050 Hz Safari runs, 20 captures
(10 experiments × both chip models), two seconds of PCM per experiment.

## Objective

Improve SID digital oscillators without changing the operating sample
rate or adding an expensive cycle-by-cycle audio oversampling stage.

The hardware MOS 6581 and 8580 both use three 24-bit accumulators with
16-bit frequency controls, 23-bit pseudo-random noise, hard sync between
neighboring oscillators, and ring modulation of the triangle waveform.
Their analog output and combined-waveform responses are model dependent.
Phase 4B improves this **digital** behavior; the analog filter, envelope
generator and Web Audio delivery are separate work.

## Architecture

At each output sample:
1. Convert SID chip clock into an **integer number of elapsed chip
   cycles**, with fractional-cycle carry (PAL or NTSC). The PCM output
   remains fixed at **22,050 Hz**.
2. Advance each 24-bit oscillator with an integer frequency register,
   preserving hardware-meaningful phase and overflow behavior.
3. Clock the 23-bit noise LFSR at each rising edge of accumulator
   bit 19. The implementation counts all rising transitions even if
   several occur within a single output sample; it does not merely
   toggle once per PCM sample.
4. If hard sync is active, split the oscillator advance at the next
   source-oscillator **MSB rising edge**, reset its target, and
   continue advancing for the remaining cycles. This avoids the
   previous incorrect end-of-oscillator-wrap sync trigger, and avoids
   simulating each SID clock individually. Corner cases involving
   multiple simultaneous chained syncs are not claimed cycle-exact.
5. Generate 12-bit digital triangle (with source-MSB XOR ring
   modulation), saw, pulse and tapped 8-bit noise outputs.
6. When multiple waveforms are selected, **combine their digital
   bit patterns**, rather than arithmetically averaging independent
   analog-like waves. The resulting 12-bit DAC output is adjusted by
   lightweight, model-specific tables representing adjacent-bit
   coupling.

The combined-waveform bit-coupling coefficients are **experimental
approximations**, deliberately isolated for later calibration with
matched recordings or other published measurements. The numerical
coefficients must **not** be interpreted as hardware-validated 6581
or 8580 response curves. The combined NOISE + tonal waveform
interaction is also approximated; measured noise-shift-register
locking and other model-specific analog effects are future work.

No external reSID/reSIDfp code or waveform lookup tables are copied.
The existing 6581 and 8580 filters and audio buffer scheduler remain
unchanged.

## Phase 4A baseline on user's Safari Mac

Before oscillator changes, each 2-second, 44,100-sample PAL fixture took
approximately **5–8 ms** median to render (about **250–400× real time**).
All 20 captures produced finite audio, with no dropped samples or
reported offline clock rewinds. These offline counters **cannot**
establish live underrun performance because no Web Audio stream was
created.

Original single-wave PCM hashes (both models were equal before Phase 4B):

| Fixture | 4A FNV float32 checksum |
|---|---|
| triangle | db6e1ff7 |
| saw | 70a90da9 |
| pulse | 442b4dd7 |
| noise | fc75db57 |
| ring | 0c8df5f7 |
| sync | ea92b497 |

The original model-specific **filter** checksum was 06b2e4b7 for
6581 and 4683d095 for 8580. The new output need not reproduce the old
waveform hashes: an intentional Phase 4B digital change should be
evaluated through waveform shape, spectra, test invariants, listening
and cost, not exact equivalence to previous approximations.

**Shared benchmark naming:** `tools/SID_AUDIO_BENCH.html` now identifies itself as **SID Audio Bench v2**, not Phase 4A. It groups both phases' stimuli and exports `retroapplejs.sid.audio-bench.v2` without changing the original sound measurements. Older Phase 4A result JSONs are still useful for comparison.

## How to verify

1. On the Phase 4B branch, open **tools/SID_AUDIO_BENCH.html**.
2. Run the original ten Phase 4A fixtures at PAL with five
   repetitions, exporting the JSON file.
3. Run the new combined-waveform experiments:
   **tri-saw**, **saw-pulse**, **tri-pulse**,
   **tri-saw-pulse** and **noise-saw**.
4. Repeat the comparison for NTSC (no resampling).
5. Listen particularly to noise, ring modulation, hard sync and
   combined-waveform output from both chip models. A change that
   sounds brighter is **not** necessarily more hardware accurate.
6. Compare median rendering cost against the original 5–8 ms
   baseline, allowing for Safari wall-clock timer resolution and
   thermal/background load.
7. Independently test background SID music with live audio telemetry
   at **10 FPS and VBLANK** for dropped audio, overflow and underruns.

For the independent CI regression suite, use
tests/sid_phase4b.test.js (automatically run by GitHub Actions).
It checks phase advancement against integer SID-cycle arithmetic;
noise-LFSR edges against a reference shift calculation; sync timing
against simple cycle-step simulation; ring modulation invariants;
model-specific combined waveform output; reset and existing
22.05 kHz synthesis behavior.

## Guardrails

- No Language Card, no CPU/IRQ scheduling or PSID parsing changes.
- No change to SlotIO and SID register addresses, ADSR state, analog
  filter, PCM FIFO, startup latency, audio telemetry, or Web Audio.
- No mandatory oversampling/anti-aliasing; no new runtime sample rate.
- No benchmark output or binary player files checked into the project.
- Measurements must distinguish objective **digital correctness**
  from provisional combined-waveform / analog modeling.

Completion requires passing CI **and browser listening/performance
acceptance**. Do not merge solely because the PCM hashes changed.
