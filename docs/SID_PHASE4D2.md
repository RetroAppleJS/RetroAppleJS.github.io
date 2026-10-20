# SID Phase 4D.2 — Hardware-guided filter calibration

## 4D.2a — Frequency-selective emulator measurements (this PR)

**This stage is instrumentation and evidence collection. It does not
change the 4D.1 filter coefficients or assert silicon-level accuracy.**

### Why Phase 4D.1's 880 Hz lab is not enough

The 4D.0/4D.1 filter lab measures the AC RMS energy of a sawtooth after
passing through the emulator. Since a sawtooth contains many harmonics,
that is **not a measured frequency-response transfer function**.
Numerical stability, a resonant bump, and correct Voice 3 routing
do not establish MOS 6581/8580 fidelity.

The new [4D.2 Calibration Laboratory](../tools/SID_FILTER_CALIBRATION.html)
measures the **complex fundamental response** of the *unchanged 4D.1
production filter* with matched dry and wet recordings.

### Method

1. Use the same SIDAudio implementation as playback but create
   **fresh isolated devices** for each capture.
2. Program Voice 1 as a triangle oscillator (CONTROL=$11,
   attack=0, sustain=$F). Triangle is preferred to sawtooth
   because its harmonics are weaker; it is **not a pure sine**.
3. Capture the direct Voice 1 output and filtered Voice 1 using actual
   production offline PCM. Compare identical oscillator frequency,
   phase origin and ADSR; do not inject a synthetic signal into DSP.
4. Use oscillator frequency register
   round(freq * 2^24 / SID_clock) and project at the **actual
   quantized SID oscillator frequency**, not merely requested Hz.
5. Analyze the last 0.4 seconds of a 0.5-second capture (22,050 Hz
   PCM), using a Hann window and complex single-frequency projection.
   Compute H(f) = WetFundamental / DryFundamental and record gain in
   dB, phase in degrees, RMS, DC, peak, and clipped PCM count.
6. Survey both 6581 and 8580, PAL/NTSC selectable, separately for
   LP/BP/HP. Six fundamentals 110/220/440/880/1760/3520 Hz,
   ten cutoff register codes (0 to 2047), resonance $0/$8/$F:
   **360 filtered captures per mode** (plus cached dry captures).
   Browser work is broken into small groups to remain responsive.
7. Export sid-filter-calibration-4d2a-PAL-lp.json (and BP/HP)
   under schema retroapplejs.sid.filter-calibration.v1.
   Historical 4D.0/4D.1 broadband JSONs remain unchanged.

The frequency probe improves frequency and phase selectivity,
but harmonic leakage, quantized oscillator frequency, aliasing,
and nonlinear effects still limit exactness. It does not replace a
laboratory swept sine captured from a physical SID.

**Important:** 22,050 Hz output has Nyquist at 11,025 Hz. Published
analog cutoff models reaching or exceeding this frequency cannot
be fitted literally at the current PCM sample rate. Future tuning
must disclose above-Nyquist differences. Do not unconditionally add
2x/4x oversampling to production on an older Mac.

### Published evidence — not measured response points in this PR

1. **Dag Lem's reSID filter implementation**
   https://github.com/libsidplayfp/resid/blob/master/filter.cc

   - Its **8580 emulator model** maps the 11-bit cutoff across
     approximately 0–12.5 kHz. The circuit-model damping relation
     is written as 1/Q = 2^((4 - resonance)/8).
   - For **6581**, the source discusses a resonance resistor ladder,
     nonlinear/nonideal op-amps, and uses voltage-transfer data
     measured from a specific MOS 6581R4AR specimen. Such data
     are not a direct frequency response curve for our TPT.
   - These are credible *model and silicon evidence*, **not a
     physical-chip calibration dataset ready to insert as coefficients**.

2. **reSIDfp Filter6581 documentation**
   https://sidplay-residfp.sourceforge.io/docs/classreSIDfp_1_1Filter6581.html

   It describes the SID two-integrator-loop biquadratic topology,
   and remaining discrepancies at high resonance and high sustain
   levels from nonideal op-amp behavior. TPT captures broad digital
   topology, not the underlying physical nonlinear circuitry.

3. **libsidplayfp model-family options**
   https://sourceforge.net/p/sidplay-residfp/mailman/message/27941691/

   Adjustable 6581 light/dark and 8580 frequency parameters show
   why a single 6581 curve cannot represent every physical specimen.

Do not label model coefficients, derived Q formulae or simulator
defaults as physically measured frequency-response points.
**No physical-chip trace has been supplied during 4D.2a.**

### Frozen Phase 4D.1 acceptance baseline

- Production res/EMU_DEVICE_SID_audio.js is unchanged.
- Native PSID, digital oscillator/noise, combined waveforms and
  Phase 4C ADSR are unchanged.
- Audio scheduling, FIFO, normal synthesis performance unchanged.
- Original filter laboratory and all previous benchmark fixtures
  remain comparable.
- On the older Mac, 4D.1 achieved approximately **16.30 ms**
  for 2 seconds of PCM on the 20 original PAL fixture/model medians,
  versus the earlier Phase 4C 17.10 ms baseline. Re-run these
  fixtures if 4D.2b modifies production DSP.

## Proposed 4D.2b — Reference-guided tuning (NOT yet implemented)

After comparing the three frequency-response exports:

1. Define versioned **reference profiles** with chip specimen,
   provenance, measurement conditions and sampling limits.
   Separate reSID/reSIDfp *models* from actual physical-chip data.
2. Compare the 8580 cutoff response and resonance with the
   documented circuit-model values over measurable frequencies.
   Explicitly mark the part above the 22.05 kHz PCM Nyquist.
3. Decide whether a bounded 6581 light/dark adjustment is
   justified. A default profile must not pretend to represent
   every 6581 chip revision.
4. Implement any changes in a **separate 4D.2b calibration PR**
   with objective transfer, resonance, state-stability, digital
   oscillator and ADSR tests.
5. Re-run the original ten PAL fixtures on the older Mac,
   investigate consistent +5% regressions, and capture both
   10 FPS and VBLANK live audio telemetry and listening tests.

4D.2a is the measurement foundation, **not full hardware calibration**.
