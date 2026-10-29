# MB-06A.5 — Pitch-controlled alternatives to AY envelope oscillators

**Status:** runnable offline AYCore listening experiment. **NOT** an assembled 6502 player and **NOT** a physical AY validation. It does not modify RetroAppleJS Mockingboard source code or the MB-06A.3 benchmark.

## Why we need this experiment

MB-06A.4 established that direct audio-frequency hardware-envelope sawtooth and triangle shapes are too coarsely tuned for the C4–G4 melody. The AY has no native sawtooth/triangle tone oscillator. Our next question is which *practical* instruments sound distinctive, stay in tune, and fit an Apple II CPU budget.

The first five candidates retain the native tone generator as the pitch source. This does not create new true steady-state analog oscillator shapes; it changes attack/decay, adds noise, or combines channels. A sixth tone/envelope buzzer tests a more complex interaction but may introduce beats and sidebands that confuse the perceived pitch.

The final four candidates are software-DAC sawtooth/triangle experiments: register R8 receives a stepped amplitude pattern at 8 or 16 samples per note period, with AY tone and noise gated off. They are **host-timed register sequences**. Their accuracy at low sample rates and compatibility with a physical 6502 must be evaluated separately.

## The ten candidates

| Candidate | Pitch source | Extra resources | Expected sound | Limitation |
|---|---|---|---|---|
| Square | Native AY tone channel A | None | Reference square | Fixed duty cycle |
| Pluck | Native tone A | AY shared envelope R11–R13 | Plucked square, natural fade | Uses the chip-wide envelope |
| Expressive | Native tone A | Low-rate R8 amplitude automation | Controlled articulation | Still a square oscillator |
| Tone + noise | Native tone A | AY noise R6, mixer R7 | Reed/buzzy/breathy | Noise masks timbre/pitch |
| Detuned pair | Native tones A + B | Second voice | Chorus/ensemble | Uses two of three channels |
| Buzzer | Native tone A + fast envelope | Shared hardware envelope | Harsh/modulated waveform | Sidebands/beating; pitch perception unknown |
| Saw 8/16 | Software R8 DAC | 8/16 volume steps per wave | Stepped sawtooth | 2,000–6,000+ writes/sec possible |
| Triangle 8/16 | Software R8 DAC | 8/16 volume steps per wave | Stepped triangle | Many writes; AY DAC nonlinearity |

**Pitch baseline:** Every version uses the same nearest native tone period for C4–G4; DAC event spacing is calculated from that period's realized pitch. This keeps programmed pitch errors between approximately −2.31 and +3.72 cents across the melody. It is a *schedule accuracy claim*, not a proof that the audio's dominant audible pitch will equal that period (particularly for buzzer, detuning, or noisy/composite sounds).

## Existing measured evidence

In the earlier user-supplied `ay-waveform-survey-v1.4.json` (AYCore JS economy at 22,050 Hz, 220 Hz tests), the eight-step calibrated software triangle received an ideal-triangle harmonic shape score of approximately **63.3/100** and the 16-step variant **65.9/100**. These are *historical 220 Hz bench results*, not measurements of the present C4–G4 suite. Correct pitch does not mean a waveform has ideal shape. The corresponding modeled volume-update rates at 220 Hz were 1,760 and 3,520 writes/sec before redundant-write suppression.

## Installation and launch

Copy these **two** files from `tools/` into the **existing** RetroAppleJS repository's `tools/` directory:

- `MB06A5_INSTRUMENT_SYNTH_LAB.html`
- `MB06A5_INSTRUMENT_SYNTH_LAB_core.js`

The repository must have its normal `res/ayumi.js`, `res/EMU_CHIP_AY_JS.js`, `res/EMU_CHIP_AY_WASM.js`, `res/EMU_CHIP_AY.js`, and `tools/AY_WAVEFORM_BENCH_core.js` files. The lab imports these rather than bundling a divergent sound core. Start a local server from your repository root:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/tools/MB06A5_INSTRUMENT_SYNTH_LAB.html` in Safari.

1. Keep backend at **JS** for first tests. Click **Generate 10 C4 probes**. The page first calibrates AY volume levels using the v1.4 RMS procedure, then renders actual AYCore sound. The initial calibration can take longer than an individual probe.
2. Play the probes and inspect the waveforms on-screen. Compare the C4 clips at ~0.30–0.32 s in Audacity. Use the same gain and rate for fair visual comparisons.
3. Select **Pluck**, **Tone + noise**, **Detuned pair**, or a software-DAC instrument and click **Generate melody**. The original 14-note pattern is reproduced; each alternative is a new offline register sequence, not the original 150-event MB-06A.3 E1 binary.
4. Click **Download WAV + JSON ZIP**. This exports every generated WAV (16-bit mono PCM, 22,050 Hz), the explicit cycle-timestamped register events for each candidate, and a manifest with estimated write cost, planned pitch and PCM peak/RMS.
5. To compare with a real peripheral capture, use PR #269's 8-bit mono recorder. The laboratory files use 16-bit mono for more detailed Audacity inspection; comparing quantization noise or sample values requires matching the formats.

### Audacity checks

- *Sustained timbre:* import selected C4 probes as individual tracks. Zoom to **0.300–0.320 seconds** and compare several waveform periods.
- *Pitch:* inspect Analyze → Plot Spectrum for a central steady-state selection. The spectrum may have a higher harmonic louder than the fundamental; noise and buzzer may have sidebands. Cross-reference the register schedule, not only the strongest FFT peak.
- *Loudness:* compare RMS, peak and dynamics in the manifest. Files are not normalized independently, so the plucked note may have lower RMS.
- *Phase/timing:* note that hardware envelope R13 rewrites retrigger the envelope, and simultaneous AY writes serialize on the 6502. The offline source timeline is not proof of precise IRQ delivery.

## CPU feasibility

The tool estimates cost as `(number of AY register writes × chosen assumed cycles/write) / song CPU cycles`. The default **50 cycles/write** is illustrative; it excludes IRQ dispatch, E1 decode, instrument logic, register selection, memory/stream access, graphics and other interrupts. The actual machine cost can be higher or lower than this simplified estimate. View the table in the lab, adjust the assumed cost, and inspect exact event counts in the exported manifest.

The accepted MB-06A.3 player dispatches on a **1,024-cycle** Timer 1 heartbeat. A software saw or triangle requiring volume changes every 150–500 cycles **cannot be accurately served by that scheduler**, even when average CPU utilization looks reasonable. Switching to a higher-frequency interrupt would add significant entry/exit overhead. For production use, investigate a timing-specific foreground synth, fewer events, voice allocation or precomputed approximations rather than assuming these software DAC experiments are ready to deploy.

## Acceptance questions

1. Is the *pitch* perceived as consistent across the notes, compared with the native square?
2. Is the *timbre* significantly more musical, rather than merely noisy or brighter?
3. Does the *C4 waveform* exhibit the expected envelope/ramp characteristics in Audacity, without obvious aliasing or unsuitable distortion?
4. Is the *modeled write rate* and memory budget plausible for a 6502 player alongside HGR?
5. Are the actual source PCM result and the measured peripheral WAV consistent once bit depth and gain are accounted for?

**Recommended order:** listen first to pluck, expressive square and detuned pair; then tone+noise and buzzer; only then compare software saw/triangle 8 and 16 steps. Preserve both favorable and unfavorable waveforms and their metadata. Once a low-overhead candidate sounds acceptable, write an MB-06A.6 native E1 fixture with instrument-specific register events and measure its actual IRQ/HGR performance.

## Verification status

- Node tests: source pitch and event order, register coverage, software update rates, unsigned 8-bit and signed 16-bit WAV headers, ZIP serialization, and mocked AYCore streaming.
- Chromium UI smoke test: in-memory page with **mock AYCore only**, checking ten probes, one melody, and download activation. This is **not actual AY synthesis playback**.
- Real AYCore in Safari: **pending user test**.
- Physical Mockingboard: not tested.
