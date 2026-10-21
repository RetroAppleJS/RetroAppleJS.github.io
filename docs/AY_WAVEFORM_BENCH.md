# AY Waveform Bench v1.3 — Phase 1.3

## Purpose

A self-contained browser **laboratory** (not a standalone AY synthesizer) using the existing RetroAppleJS production `AYCore`. Phase 1.3 extends the Phase 1.2 single-oscillator reference comparison, contrasting envelope and software-timed triangle reconstruction, testing tone–envelope phase dependence, and measuring composite spectral fingerprints against **mathematically ideal, pitch-matched square, sawtooth, and triangle waveforms**. It does **not** compare against SID 6581 recordings, physical AY hardware, or the complete SID signal path.

Phase 1.3 changes only the drop-in bench and tests; no emulator peripherals, SID player, audio scheduler, or AYCore files have been modified.

## Installation

Copy the supplied files into the corresponding paths under the RetroAppleJS repository root:

- `tools/AY_WAVEFORM_BENCH.html`
- `tools/AY_WAVEFORM_BENCH_core.js` (the browser loads the `.js` file)
- `tests/ay_waveform_bench.test.js` (optional automated tests)
- `docs/AY_WAVEFORM_BENCH.md`

The package additionally contains `.txt` copies of the core and test files for attachment/upload workflows. The original `.js` names must remain when running the bench.

The HTML loads existing project assets in this order: `../res/ayumi.js`, `../res/EMU_CHIP_AY_JS.js`, `../res/EMU_CHIP_AY_WASM.js`, `../res/EMU_CHIP_AY.js`, then `AY_WAVEFORM_BENCH_core.js`.

To test, serve the repository root over HTTP, e.g. `python3 -m http.server 8000`, open `http://localhost:8000/tools/AY_WAVEFORM_BENCH.html`, and click **Render selected waveform**. Run automated tests with `node --test tests/ay_waveform_bench.test.js`.

## Sources and signal path

- AY clock default: 1,021,800 Hz, configurable from 500 kHz to 1.8 MHz.
- PCM sample rate: 22,050 samples/second, `renderProfile:'economy'`.
- Default backend: JavaScript; WASM option uses the project WASM AYCore.
- Two AY chips: AY0 goes left and AY1 right with production-compatible equal channel mixing; the bench averages channels to mono for plots and WAV exports.
- All fixture register writes are explicitly logged with chip, register, value, and nanosecond timestamps; a fresh AYCore instance is used for each measurement.
- Twelve fixed techniques: square, saw-down, saw-up, triangle envelope $A, triangle envelope $E, raw 32-step software triangle, calibrated 32-step software triangle, buzzer (tone × envelope), noise, tone+noise, detuned tone pair, and two-chip layering.

## Pitch calculation

For AY chip clock `F` and register period `P`:

| Oscillator | Programmed pitch formula | Register range |
| --- | --- | --- |
| Tone / 50% square | `F/(16 × P)` | 12 bits (`1 … 4095` for this bench) |
| Repeating saw envelope (`R13=$8` or `$C`) | `F/(256 × P)` | 16 bits (`1 … 65535`) |
| Alternating triangle-like envelope (`R13=$A` / `$E`) | `F/(512 × P)` | 16 bits (`1 … 65535`) |

At 1,021,800 Hz and `P=1`, the nominal maximum saw pitch is **3,991.40625 Hz**, and the triangle maximum is **1,995.703125 Hz**. These are theoretical divider rates. The integer period can cause substantial note-to-note quantization error at high pitches. Selected notes in the standard 48-case survey: 55, 110, 220 and 440 Hz; 0.5 s per note. The phase sweep has 32 cases at 1 s each. The UI distinguishes *requested frequency*, *actual programmed frequency*, and *dominant FFT peak*.

## Phase 1.2 (retained): pitch-matched ideal reference analysis

### Applicability

The default (**Auto**) reference for single-oscillator fixtures is:

| AY fixture | Ideal magnitude-spectrum reference |
| --- | --- |
| `square` | Ideal 50% square |
| `saw-down` and `saw-up` | Ideal sawtooth |
| `triangle`, `triangle-invert`, `triangle-dac-raw`, `triangle-dac` | Ideal triangle |

For a single render, **Ideal reference** also permits manually selecting square, sawtooth or triangle to evaluate alternative sound families. A frequency-range survey always uses **Auto** regardless of the selected reference, so exports remain consistent between runs.

**Not applicable** to `buzzer`, `noise`, `tone-noise`, `detune`, and `two-chip`. Their scores, harmonic lists, and THD are absent/null rather than being misrepresented as a harmonic series. The JSON supplies `comparison.reason`. The ordinary FFT peak, RMS, spectral centroid and WAV export still work for all twelve fixtures.

### Ideal harmonic reference (relative magnitude)

For harmonic index `h >= 1`, the ideal reference magnitudes are:

- **Square:** `1/h` for odd `h`, 0 for even `h`.
- **Sawtooth:** `1/h` for all `h`.
- **Triangle:** `1/h²` for odd `h`, 0 for even `h`.

All magnitudes are normalized to a fundamental amplitude of 1; ideal amplitudes don't imply the SID's absolute DAC voltage or analog filtering. Upward and downward saws have the **same magnitude spectrum** and are therefore indistinguishable by the Phase 1.2 scores; phase and polarity are **not** matched. The separately drawn ideal waveform is an analytic phase-0 visual guide, not an aligned oscillogram.

### How pitches and harmonics are matched

- The score uses the **actual programmed fundamental** `spec.pitch.actualHz`, not the requested key/pitch, eliminating tuning error from the shape comparison. Tuning error remains visible as cents.
- The existing broadband spectrum plot uses a **2,048-point Hann-windowed FFT** (10.77 Hz frequency bins). Its highest peak is a separate quantity from the programmed fundamental.
- The detailed harmonic analysis uses **up to 8,192 central PCM samples**, Hann-windowed, with mean/DC subtraction and matched-frequency complex projections at `h × actualHz`. This reduces contamination between adjacent low-frequency harmonics compared with using the 2,048-point FFT alone.
- Only harmonics `h <= 32` **strictly below Nyquist (11,025 Hz)** are evaluated. Unmeasurable or silent fundamentals yield `comparison.status:'unmeasurable'` instead of a fabricated score.
- Harmonic levels are normalized relative to the measured fundamental and use a **−48 dB floor only for logarithmic shape scoring**. Raw absolute harmonic readings remain in `metrics.harmonicDb`.

### Metrics

Let `A_h` be measured harmonic magnitude relative to the measured fundamental, `I_h` the ideal magnitude relative to the ideal fundamental, and `h=2 … H` the comparable higher harmonics. Define:

`error_h = clip_dB(A_h, −48) − clip_dB(I_h, −48)`

`shapeErrorDb = sqrt( Σ_h (1/sqrt(h)) × error_h² / Σ_h (1/sqrt(h)) )`

`shapeScore = 100 × exp(−0.5 × (shapeErrorDb/12)²)`

`cosineSimilarity = 100 × cosine_similarity(weighted_linear_harmonic_magnitudes)`

The table shows the shape score against the chosen reference. The JSON additionally includes scores against **all three** references and `bestReference`. The score intentionally penalizes excess even harmonics in triangle/square, a weakness of cosine similarity alone. These are deterministic engineering heuristics, **not** listening-test grades, physical SID similarity scores, or calibrated perceptual metrics.

**THD** is an approximate sum of higher harmonics relative to the fundamental (through at most harmonic 32). It is calculated **only** for qualifying single-oscillator fixtures. Broad-spectrum or composite signals have no meaningful single-harmonic THD.

**Aliasing-risk** reports whether a hypothetical 8th or 32nd harmonic crosses Nyquist. It is not a measurement of aliased PCM energy; sharp edges can generate still higher harmonics. The flag is N/A for composite/multitone/noise sounds.

## How to use the new comparison

1. Select **Saw down** and request 220 Hz. Leave **Ideal reference = Auto**. The programmed pitch will differ slightly from 220 Hz because AY register divisors are integral.
2. Render. The orange points show the *ideal relative harmonic levels* and the turquoise points the *measured* harmonics at the **same actual fundamental pitch**. The weighted shape error and shape score quantify the mismatch.
3. Change Ideal reference manually to **Triangle**, render again, and compare score and harmonic differences. This changes only the *reference*, not the generated AY register writes or audio.
4. Select **Triangle**. Watch for even-harmonic contamination and for much larger register-quantization error at higher notes.
5. Select **Buzzer**. Shape/THD now read **N/A**, while the FFT and other measurable properties remain available.
6. Run **Survey all techniques × 4 notes** (now 48 cases), export `ay-waveform-survey-v1.3.json`, and retain it for later JS/WASM comparison.

## Export format

- Single report schema: `retroapplejs.ay.waveform-bench.v1.3`.
- Survey schema: `retroapplejs.ay.waveform-bench.v1.3.survey`.
- Existing fields such as `.spec.events`, `.metrics.rms`, `.metrics.dominantHz`, `.metrics.harmonicDb`, and `.metrics.aliasRisk` remain present.
- Added `.spec.referencePreference`, and `.metrics.comparison` containing status, reason, selected reference, reference-match ranking, selected matched harmonic data, `shapeScore`, `shapeErrorDb`, `cosineSimilarity`, pitch basis and measurement-window metadata.
- No waveform PCM is embedded in JSON; save the WAV separately.

Phase 1.1/1.2 survey exports remain valid historical baselines, but lack the new Phase 1.3 interaction and fingerprint fields.

## Testing and limitations

Automated Node regression tests cover period calculations, register fixtures, WAV export, FFT, mocked AYCore rendering, harmonic reference generation, ideal harmonic ranking, deliberate reference mismatch, exclusion of composite sound, and export schema. A browser UI smoke test with a **mock AYCore** exercised calibrated triangle rendering, the 32-row phase sweep and the 48-row frequency survey. For an actual AY audio validation, run this bench inside a RetroAppleJS checkout with its real AYCore JS/WASM backend and export the survey results.

The laboratory does not contain real 6581 oscillator recordings, model the SID analog filter or voice allocation, or claim that a high shape score automatically means close SID sound. Next phases can incorporate actual SID renderings at aligned pitches, phase/polarity comparisons, anti-aliasing measurement, and instrument-aware voice allocation.


## Phase 1.3: hardware triangle variants, software reconstruction and composites

### Fixture extensions

| Fixture | Generator | Key distinguishing feature | Pitch basis |
| --- | --- | --- | --- |
| `triangle` | AY envelope shape `$A` | Hardware baseline | `F/(512*P)` |
| `triangle-invert` | AY envelope shape `$E` | Opposite envelope orientation / compare harmonic asymmetry | `F/(512*P)` |
| `triangle-dac-raw` | AY channel A, tone and noise gated off, 32 `R8` writes per cycle | Linear *volume register indices*, not linear output voltage | Exact scheduled note Hz (nominal) |
| `triangle-dac` | Same 32 software `R8` writes | Selects nearest output amplitude using measured inverse AY volume curve | Exact scheduled note Hz (nominal) |
| `buzzer` | AY tone and envelope | Configurable R13 envelope-retrigger onset phase | Hardware tone & envelope periods |

The raw and calibrated DAC approaches are deliberately **software-intensive laboratory experiments**. They are *not* proposed as an efficient in-game Apple II 6502 implementation. Normalization to a single ideal magnitude spectrum does not indicate CPU feasibility, output loudness, or accurate phase. Note that the capture sample rate is only 22,050 Hz; high update frequencies can lose resolution or alias.

### Volume-law calibration

The `triangle-dac` fixture automatically calls `calibrateVolumeCurve()` once per `{backend, clock}` pair unless an explicit `volumeCurve` is supplied. **Calibrate AY volume curve** forces a refresh for the selected backend and clock. Calibration consists of fifteen 0.2 s, 220 Hz **square-tone RMS measurements** at AY volume registers `1..15` (volume 0 is assigned 0). Each is normalized to register 15 and a monotonic curve is enforced. The 32-step triangle chooses the nearest register amplitude not exceeding the selected maximum volume register. The auto-calibrated curve measures the **emulator's rendered output**, not a physical AY-3-8910 DAC, and is approximate if chip mixing responds differently to a static envelope-driven volume.

When calling `generate()` directly rather than `render()`, a fallback nominal exponential response is used for `triangle-dac` if `volumeCurve` is absent. This produces `spec.calibrationSource:'nominal approximation'`. Using `render()` automatically calibrates, and the report states `spec.calibrationSource:'measured AYCore tone RMS'`. The 16-entry floating-point curve is not written into the export, because the ordered register writes and source identification are sufficient to reproduce the particular fixture; retain a separate curve if reproducing the precise calibration is important.

Each software triangle performs **32 timed R8 writes per oscillator cycle**. At 55/110/220/440 Hz, this is **1,760 / 3,520 / 7,040 / 14,080 writes per second**, *excluding* Mockingboard VIA handshakes, 6502 instruction costs, and all other work. The UI highlights rates above 3,000/s as experimental. `generate()` refuses captures that would exceed 48,000 software waveform writes, preventing accidental unbounded survey sizes. No claim of physical Apple II timing feasibility is made.

### Tone–envelope phase sweep

- Select **Buzzer** and set **Buzzer envelope phase (cycles)** to 0 to 0.875 in steps of 0.125.
- `R0/R1` tone and `R11/R12` envelope periods are programmed at tick 0; the R13 retrigger and R8 enable are offset by `phaseOffset / programmedToneHz` seconds. Before the offset, the output is muted (and not a free-running envelope), so the capture onset changes. The harmonic analysis uses the central samples to avoid the short start transient.
- Click **Buzzer phase sweep · 32 cases** to generate 8 offsets at each of 55/110/220/440 Hz, using **1.0 s** capture per case; export `ay-buzzer-phase-sweep-v1.3.json`.
- The export's `interaction.relativeFrequencyHz = envelopeHz - toneHz` and `interaction.relativePhaseDriftCycles = relativeFrequencyHz * duration` are **theoretical from register divisors**, not audio-verified phase or measured beat frequency. The phase relationship can drift during the capture and is not expected to stay stationary across different pitches.
- Do not interpret changes in RMS as purely due to initial phase without checking the programmed frequency difference and any onset transition.

### Composite/broadband fingerprints (including noise)

`metrics.fingerprint` provides measures for **all** fixtures:

- `spectralFlatness`: ratio of geometric and arithmetic *power* means across the nonzero 2048-point FFT bins. A noise-like spectrum is flatter than a harmonic tone, but windowing and filtering matter.
- `rolloff85Hz`: frequency below which 85% of FFT-bin power lies.
- `highBandEnergyPercent`: FFT power at frequencies ≥ 2,000 Hz as a percentage of total power.
- `strongestPeaks`: up to eight local FFT maxima with `hz` and `relativeDb` relative to the strongest peak. FFT-bin spacing is 22050/2048 ≈ 10.77 Hz, too coarse to separate close detuned lines at low pitches.
- `peakBinWidthHz`: 10.7666… Hz at the fixed sample rate; **do not claim sub-bin resolution for `strongestPeaks`**.

The prior `comparison.eligible` and `thdPercent` rules remain unchanged: `buzzer`, `noise`, `tone-noise`, `detune`, and `two-chip` have explicit N/A single-fundamental ideal scores and THD. Their composite fingerprint is independent of this policy and requires **no invented fundamental**. Detuned and buzzer *programmed* beat/drift metadata appears separately under top-level `interaction`.

### Export additions

- Schema `retroapplejs.ay.waveform-bench.v1.3` and `.survey`.
- New `.spec.phaseOffset`, `.spec.calibrationSource` and `.spec.softwareVolumeWritesPerSecond`.
- New top-level `.interaction` (register count, phase settings, theoretical drift/beat, high-rate event estimate).
- New `.metrics.fingerprint`, with a broad FFT summary for harmonic and nonharmonic sounds.
- Surveys add `experiment:'range'` (48 records) or `experiment:'phase'` (32 records), retaining original record structures.
- Register events retain their full ordered timestamps in each JSON report, including every software volume write. The on-screen register preview truncates long lists for performance.

### Verification

- 24 automated Node tests passed, including all 15 Phase 1.2 tests, shape $E selection, 32-step event scheduling, inverse volume mapping, write-budget safeguards, phase sweep, spectral fingerprint sanity, export metadata and calibration caching.
- Chromium browser smoke test using an **explicitly synthetic mock AYCore**: one `triangle-dac` render, complete 32-case phase sweep and complete 48-case technique survey; no JavaScript exceptions.
- The supplied package does **not** bundle or modify `res/ayumi.js`, JS AYCore, WASM backend or any real SID/AY chip implementations. Real backend waveform validation requires opening the tool in a RetroAppleJS repository checkout and uploading the generated v1.3 JSON surveys. Nothing in the mock-browser results is evidence of actual AY sound quality.
