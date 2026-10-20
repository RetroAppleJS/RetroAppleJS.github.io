# AY Waveform Bench v1 — Phase 1

## Scope

Standalone, offline instrument-synthesis laboratory for the existing RetroAppleJS
AYCore shared with the Mockingboard. No production audio, SID, VIA or Apple II
scheduler code is changed. No physical chip fidelity is asserted.

## Installation

Copy `tools/AY_WAVEFORM_BENCH.html` and
`tools/AY_WAVEFORM_BENCH_core.js` to the `tools/` folder at the root of the
RetroAppleJS repository. The HTML loads the already existing
`res/ayumi.js`, `res/EMU_CHIP_AY_JS.js`, `res/EMU_CHIP_AY_WASM.js`, and
`res/EMU_CHIP_AY.js` in that order, then this laboratory's core module.

Serve the repository root over HTTP (for example `python3 -m http.server 8000`)
and open `http://localhost:8000/tools/AY_WAVEFORM_BENCH.html`.

`tests/ay_waveform_bench.test.js` can be copied to the project's `tests/` folder.
Run: `node --test tests/ay_waveform_bench.test.js`.

## Test coverage

- Native square wave through AY channel A
- Envelope falling saw, rising saw and triangle (R13=8, C, A)
- Tone AND amplitude-envelope buzzer
- AY noise and mixed tone+noise
- Detuned channel A/B square pair
- Layered two-chip sound, with a separate AY1 hardware envelope

The output rate is exactly 22,050 Hz using `renderProfile: 'economy'`, matching
live Mockingboard output settings. The default backend is the common JavaScript
AYCore; switching to WASM uses the production WASM backend if available.
Both AY chips receive separate stereo assignments matching production (AY0 left,
AY1 right). The oscillator plot, reported RMS and downloaded WAV average the two
channels to mono; stereo spatial information is not preserved in that output.

## How to use

1. Choose a technique and frequency, leave the clock at 1,021,800 Hz initially.
2. Click **Render selected waveform**. Listen, inspect the waveform and spectrum.
3. Check **actual fundamental** and pitch error before judging envelope shapes.
4. Save the WAV and JSON for particular experiments.
5. Run **Survey all techniques × 4 notes** and export the JSON for tracking results.

The sample survey uses 55, 110, 220 and 440 Hz across all nine techniques. Noise
has no meaningful theoretical fundamental. Dominant FFT peak is not assumed to
be the fundamental, especially in buzzer and noise spectra.

## AY frequency relationships

Assuming an AY clock `F` and a nonzero integer period:

| Technique | Fundamental |
| --- | --- |
| AY square tone | `F / (16 * period)` (12-bit period) |
| Repeating one-direction envelope (saw) | `F / (4096 * period)` |
| Alternating two-direction envelope (triangle) | `F / (8192 * period)` |

At 1,021,800 Hz with envelope period 1, the maxima are 249.46 Hz (saw) and
124.73 Hz (triangle). Requests beyond these maxima are clamped. Envelope DAC
outputs consist of only 16 amplitude levels, not a mathematically ideal ramp.

## Bench limitations and next steps

- Pitch values are theoretical register-divider frequencies, not fitted
  frequency estimates from recorded audio. A separate FFT dominant-peak reading
  measures what the PCM contains.
- The 2,048-point Hann-window FFT has approximately 10.77 Hz bin spacing; the
  dominant-frequency reading uses log-parabolic interpolation.
- Rendering duration is not emulated 6502/VIA write cost or Apple II runtime.
- Comparisons with SID_AUDIO_BENCH are still separate. A subsequent instrument
  matching laboratory can reuse the same PCM and metadata metrics.
- Envelope generators are shared within each AY. Only the selected fixture's
  required channels are active; the bench is not yet a dynamic voice allocator.
- Timed fixture events are captured at the AYCore nanosecond timebase. This
  avoids treating a 50 Hz SREG stream as an audio-rate source.

## Export schema

`retroapplejs.ay.waveform-bench.v1`; survey export suffix `.survey`.
Per-experiment JSON stores exact register writes and ticks, backend, render
profile, output metrics, requested frequency and theoretical quantized pitch.
No audio PCM is embedded in JSON. Use **Save WAV** for audio captures.
