# SID Phase 4A — Reference Sound & Performance Baseline

**Authoritative production engine:** res/EMU_DEVICE_SID_audio.js  
**Browser laboratory:** tools/SID_AUDIO_BENCH.html  
**Shared deterministic experiment core:** tools/SID_AUDIO_BENCH_core.js  
**Headless regression:** tests/sid_phase4a.test.js

## Objective

Phase 4A establishes reproducible, quantitative measurements of the **current**
SID synthesizer before Phase 4B alters its algorithms. No physical 6581 or
8580 is required for this software baseline; however, software output and
published chip recordings must not be described as interchangeable or as
proof of absolute hardware fidelity. The 6581 in particular varies by
revision and individual chip.

**Fixed output: 22,050 samples/second**, two-second audio fixtures.
No oversampling, advanced anti-aliasing or production-engine change.

The benchmark creates new original SIDAudio instances; no AudioContext or
live Web Audio output is involved. It uses the same production
writeRegister / setClock / setModel / renderOffline methods as the
actual card synthesizer. It does not implement a replacement SID model
or modify the native 6502 player.

**Current bench:** The shared tool is now **SID Audio Reference & Performance Bench v2**, covering the ten original Phase 4A fixtures and five Phase 4B combined-waveform fixtures. New results use schema `retroapplejs.sid.audio-bench.v2` and filename `sid-audio-bench-v2-results.json`. Earlier `retroapplejs.sid.phase4a.v1` JSON exports remain valid historical baselines, with the original `runs[]` fields still comparable. The benchmark version is not the synthesis engine's version.

## Browser workflow

Open tools/SID_AUDIO_BENCH.html on the RetroAppleJS website.

1. Choose a deterministic experiment, PAL/NTSC clock and number of timed
   repetitions (3, 5 or 10).
2. Choose **Run selected** or **Run entire suite**. Both 6581 and 8580
   are rendered for every selected experiment.
3. Compare the waveform, 2,048-point FFT spectrum, RMS/peak/DC, dominant
   frequency, spectral centroid, fraction of spectral energy above 5 kHz,
   render time and PCM reproducibility hash.
4. Listen to either model's generated WAV and optionally save it.
5. Export a structured JSON record of the measurements, exact register
   stimulus, PAL/NTSC selection and timing. Keep this as the baseline
   before any Phase 4B synth changes.

### Deterministic register experiments

| Fixture | Stimulus |
|---|---|
| triangle | Gated 220 Hz triangle |
| saw | Gated 220 Hz sawtooth |
| pulse | Gated 220 Hz 50%-width pulse |
| noise | Gated noise |
| pwm | Eight pulse-width settings |
| adsr | Attack/decay/sustain then release at one second |
| ring | Ring-modulated triangle, oscillator 3 as modulator |
| sync | Hard synchronized oscillator |
| filter | Eight-step low-pass cutoff/resonance sweep |
| volume | Master volume changes |

These fixtures represent deliberate SID register writes, **not
independently verified hardware test vectors**. Event positions are
quantized to the 22.05 kHz output sample grid, with the corresponding
rounded SID CPU clock position recorded in JSON. The benchmark applies
writes before rendering that sample. It does not claim accuracy for
sub-sample write timing.

### External reference WAV

An optional 22,050 Hz WAV recording can be imported for standalone
signal analysis. Supported formats: PCM16 or float32, mono or stereo
(stereo is downmixed to mono), duration approximately 0.1–60 seconds.
Other sample rates must be converted **offline** before import. Neither
the emulator nor the benchmark changes its live synthesis sample rate.

For a legitimate hardware comparison, the imported recording should
contain **the same register stimulus**, use the same PAL/NTSC SID clock,
and identify the 6581/8580 revision and recording conditions. A
recorded commercial SID song generally does not meet these conditions.
The tool therefore reports independent amplitude and spectral values;
it **does not** provide an unaligned PCM-difference score or an
unsupported hardware-accuracy percentage.

Future outside comparison resources:
- reSIDfp/libresidfp: independent software reference for oscillator,
  envelope, filter and analog model study; beware GPL licensing if
  contemplating code reuse in this MIT project.
- SOASC=: genuine SID chip recordings useful for listening and model
  identification, but not automatically comparable to our synthetic
  register fixtures.
- Existing tools/SIDchipJS.html and res/jsSID.js: an additional
  software comparison, not a physical chip reference.

## Performance measurement

The bench runs one **untimed warm-up**, then times repeated independent
two-second renders and reports the **median**. The timed scope includes
fixture setup and PCM synthesis, but not FFT analysis, JSON generation
or WAV encoding. The ratio of generated audio seconds to measured
elapsed wall seconds is a useful throughput baseline, **not** real-time
CPU utilization.

Compare measurements using the same browser and machine, same background
load, same fixture and same PAL/NTSC model. GitHub CI does not enforce
a wall-clock performance number on shared runners.

For the separate 10 FPS/VBLANK underrun and FIFO-overflow question,
continue using **the live SID peripheral's existing audio telemetry**.
An offline benchmark with no audio stream cannot verify live delivery
or underruns, and cannot replace the earlier live scheduler tests.

## Phase 4A acceptance

- No changes to res/EMU_DEVICE_SID_audio.js or res/EMU_CARD_SID.js.
- 22,050 Hz maintained for both chip models without oversampling.
- Ten deterministic register stimuli with stable event ordering.
- Browser model comparison, PCM playback/export, WAV import, JSON export.
- Headless CI covers deterministic PCM, both chip models, frequency
  analysis, output statistics, reference WAV guardrails, and interface
  JavaScript syntax.
- Audio output/performance baseline captured before Phase 4B.
- Any future synthesis optimization is evaluated for both fidelity and
  unchanged CPU/buffering performance.

**Phase 4A is an instrumented baseline, not proof of MOS hardware fidelity.**
