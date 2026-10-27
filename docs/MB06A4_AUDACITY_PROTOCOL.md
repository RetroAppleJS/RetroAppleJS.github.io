# MB-06A.4 — Listening comparison and Audacity waveform inspection

**Status:** Browser listening laboratory created and source/unit tests passed. **Real RetroAppleJS AYCore browser rendering and Safari listening still require user execution.** This is deliberately an **offline AYCore experiment**, not a replacement or merge of the accepted native MB-06A.3 6502 player.

## Objective

Compare the same 14-note *Frère Jacques* melody with four **actual AY register programming techniques**, then inspect the waveform and spectrum in Audacity. Keep the original MB-06A.3 full multivoice E1 score as a fifth, unmodified reference.

The four isolated melodic timbres are **AY0 channel A only**. Only one hardware envelope exists per AY chip. Bass, harmony and envelope percussion cannot each have an independent envelope on AY0; these are excluded from isolated timbre comparisons. The original fifth track keeps bass, harmony and percussion via its exact 150-event source fixture.

## Use with local RetroAppleJS checkout

1. Copy `tools/MB06A4_WAVEFORM_LISTENING_LAB.html` and `tools/MB06A4_WAVEFORM_LISTENING_LAB_core.js` into **the repository's `tools/` folder**, alongside its existing AY Waveform Bench.
2. At the RetroAppleJS repository root run `python3 -m http.server 8000` (or another local static server). Open `http://localhost:8000/tools/MB06A4_WAVEFORM_LISTENING_LAB.html` in Safari. **Do not** open the HTML from a different directory or through a standalone `file://` URL; it expects `../res/ayumi.js`, `../res/EMU_CHIP_AY_JS.js`, `../res/EMU_CHIP_AY_WASM.js`, `../res/EMU_CHIP_AY.js` from the repository.
3. Click **Generate all nine AYCore WAVs**; this uses the existing AYCore **JavaScript backend**, **22,050 Hz** PCM, **economy** rendering profile, model `AY`, and chip clock **1,021,800 Hz**. Nothing is uploaded to a remote server.
4. Listen to the full melody comparisons, and download the individual C4 probe files or **Download WAV + metadata ZIP**. The latter includes **five melody WAVs, four single-note C4 probes and a metadata JSON** with all requested/programmed frequencies and waveform register periods.
5. The page also contains a **local WAV picker** to compare the previous approximate audio guide, without cross-origin `file://` access errors.

## Timbre mechanisms and pitch formulas

| Test | AY0 register actions | Pitch formula | R13 |
|---|---|---|---|
| Square | R0/R1 tone period, R7=`$3E` tone A on, R8=fixed volume 13 | `F / (16 × P_tone)` | No |
| Saw down | R7=`$3F` disables tone/noise gates, R8=`$10`, envelope R11/R12 | `F / (256 × P_env)` | `$08` on **each note** |
| Saw up | Same but ascending envelope | `F / (256 × P_env)` | `$0C` on **each note** |
| Triangle | Same but alternating envelope | `F / (512 × P_env)` | `$0A` on **each note** |

These are **stepped AY amplitude waveforms**, not an AY with dedicated analog sawtooth/triangle oscillators. Their shape and spectral content depend on the AY DAC characteristic and renderer filters. Explicit R13 writes retrigger on every note; repeated same-value writes are not optimized away.

The envelope generator divides the AY chip clock differently from the tone generator. The period is a **positive integer**; consequently, a nominal 261.63 Hz C4 becomes:

| Test | Period | Programmed frequency | Difference from equal-tempered C4 |
|---|---:|---:|---:|
| Square | 244 | 261.732 Hz | +0.70 cents |
| Saw down/up | 15 | 266.094 Hz | +29.32 cents |
| Triangle | 8 | 249.463 Hz | −82.41 cents |

**These pitch discrepancies are intentional properties of the AY period quantization, not an error in the WAV renderer.** The triangle may audibly sound flat. The ZIP manifest lists each of the 14 note frequencies; please compare them before attributing audible differences purely to waveform shape.

## Audacity procedure

1. Import the four `MB06A4_*_C4_probe_AYCore.wav` files into Audacity (File → Import → Audio). Use the separately supplied `MB06A4_IDEAL_*_NOT_AYCORE.wav` files only as mathematical comparison shapes, **never** as evidence of real emulator output.
2. Keep 22,050 Hz project/sample rate and **do not normalize**, resample, compress or apply effects. All files are exported as 16-bit little-endian mono WAV from *raw AYCore PCM* with no per-track amplitude compensation.
3. Zoom to **0.140–0.155 seconds** (about 4 cycles). You should see relatively flat plateaus for the square; a stepped rising/falling ramp for saw; and ascending/descending steps for triangle. The *actual* output may exhibit ringing/smoothing due to the economy filter and AY DAC nonlinearities.
4. For spectra, select a stationary segment well after note onset and before release (e.g. **0.15–0.45 s**), and use **Analyze → Plot Spectrum**. Square-wave harmonics skew odd, saw has even and odd harmonics, and triangle harmonics skew odd with faster fall-off. These are qualitative expectations, not pass/fail spectral targets for a filtered 16-level AY.
5. Compare the actual waveform frequency (period between repeats) against `expectedActualPitchHz` in the exported metadata. If plotting harmonics, align them with each track's **programmed** fundamental frequency, *not* one nominal C4 frequency.
6. Save waveform and spectrum screenshots and your listening notes. A fair timbre comparison should report note pitch detuning, waveform shape, envelope reset artifacts, RMS/peak levels and whether the melody is recognizable.

## Interpretation limits

- **Real AYCore WAVs:** generated in the provided HTML by the repository's shared JS AYCore; this is **offline rendering from idealized register-time events**, not an audio stream captured directly from the Apple II CPU/6522/AudioContext. The original music reference preserves all 150 canonical E1 events, but not their measured bus-write latency.
- **Ideal reference WAVs in `reference/`:** directly generated with mathematical `square`, `saw` and `triangle` functions at the AY's *quantized* note frequency, not a physical AY model or AYCore. They intentionally have no AY DAC/filter and should make Audacity's conceptual shapes easy to recognize.
- **Monophonic variants:** the E1 melody's note start times are retained, but the new multi-write note transitions are packed into the same offline timestamp. They **have not** been scheduled through a real 6502 IRQ handler, where VIA writes require nonzero time.
- **Amplitude:** the AY shared envelope changes the DAC output amplitude at audio frequency. On real hardware and in the emulator, coupling/filtering affects the wave's polarity and edges. A generated amplitude triangle is not expected to be a perfect linearly shaped, symmetric bipolar mathematical triangle.
- **Software-DAC alternatives** (calibrated 4/8/16/32-step triangle, phase-locked buzzers) are covered by the existing AY Waveform Bench v1.4 and can be introduced in a separate **CPU-cost-controlled** player stage. Even 8 software updates/cycle at 261.6 Hz is roughly 2,093 volume writes/second; at 50 CPU cycles/write that costs about **10.2%** of a 1,021,800-cycle/s 6502 before IRQ/decode overhead. A 32-step waveform would cost ~41%. Such high-rate writes should not be introduced silently in this melodic replay benchmark.

## Tests

Run `node --test tests/test_core.cjs`. Tests cover the canonical MB06A3 reference, note order, one R13 retrigger per note, AY tone register selection, period conversion, malformed input rejection, WAV encoding, ZIP creation and mocked AYCore batch/render interface.

The actual AYCore script set is loaded at runtime from the RetroAppleJS repository. The packaged test suite **cannot** establish its audio output fidelity until the browser has loaded the real scripts. An Audacity WAV/spectrum check is the intended final validation.
