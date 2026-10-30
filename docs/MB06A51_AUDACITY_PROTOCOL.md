# MB-06A.5.1 — Audacity and listening acceptance protocol

The goal is to determine the **lowest acceptable DAC resolution** for pitch-correct software saw and triangle timbres, not to force every version to match an ideal analog waveform.

## Generate reproducible WAVs

1. Place the three files in the ZIP's `tools/` folder in `RetroAppleJS.github.io/tools/`. From the repository root run `python3 -m http.server 8000` and open `http://localhost:8000/tools/MB06A5_INSTRUMENT_SYNTH_LAB.html`.
2. Select one AYCore backend (JS or WASM). Use the same backend for the entire comparison.
3. Click **Generate 8 DAC C4 probes**, **Generate 8 DAC melodies**, and **Download WAV + JSON ZIP**. Export names include instrument ID and C4 `probe` / `melody`.
4. Select A/B pairs such as `saw4`/`saw8` and `triangle4`/`triangle8`. Listen at identical speaker volume. A and B are not loudness normalized, so loudness differences are part of the output and may bias preference.
5. Keep the ZIP manifest for the actual AY register-write schedule, source calibration method and modeled CPU share.

## Audacity measurements

1. Import one C4 WAV per track. All WAVs must show **22,050 Hz, mono, 16-bit PCM**.
2. Zoom to approximately **0.300–0.315 s** for visible cycles (C4 ≈ 261.7 Hz, period ≈ 3.82 ms). A square is approximately two-level; a 2-step triangle is also two-level. Four-step DAC variants should show rough staircases. Eight/sixteen-step variants may show softened transitions due to AY volume DAC and source filtering.
3. For spectral comparison, select a longer stable excerpt, e.g. **0.20–0.80 s**, then open **Analyze → Plot Spectrum**. Use the same FFT size/window settings for each WAV (e.g. Hann window, 8192 samples). Identify the fundamental near 261.7 Hz; do **not** assume the largest peak always represents fundamental frequency. Check higher harmonics and possible aliases.
4. The browser's A/B harmonic table provides a convenient comparison (H1–H8 relative to the modeled C4 f0). This uses a windowed direct Fourier projection **at the programmed fundamental**, not a peak search. Audacity is the independent review.
5. Compare the four melody WAVs within each family: perceived tuning, continuity across notes, stair-stepping distortion, and whether the higher step version gives a useful improvement over fewer steps.

## Listening scorecard

| Family | Steps | Pitch okay? | Sound acceptable? | Timbre comments | Audio / spectrum concerns |
|---|---:|---|---|---|---|
| Saw | 2 | | | | |
| Saw | 4 | | | | |
| Saw | 8 | | | | |
| Saw | 16 | | | | |
| Triangle | 2 | | | | |
| Triangle | 4 | | | | |
| Triangle | 8 | | | | |
| Triangle | 16 | | | | |

The `MB06A51_DAC_RESOLUTION_MATRIX.csv` reports default original E1 payload size and write-only CPU assumptions. **None of the eight DAC versions is certified to run in the existing 6502 native score player.** Even a good-sounding two-step waveform needs additional streaming, scheduler and native timing work before deployment on real or emulated Apple II hardware.
