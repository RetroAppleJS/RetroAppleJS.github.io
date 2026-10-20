# SID Phase 4D — Filter Design and Calibration

## Current scope: 4D.0 — Characterize before replacing

The Phase 4C ADSR envelope and Phase 4B.1 oscillators are accepted.
**This PR changes no production audio-generation code.**

### Existing filter, characterized without correcting it

| Register | Current behavior | Phase 4D objective |
|---|---|---|
| $D415 / $D416 | 11-bit cutoff; 6581: 40 + 7200 * fc^1.65 Hz; 8580: 30 + 9500 * fc Hz | Model-aware, defensible cutoff |
| $D417 high nibble | Resonance is ignored | All 16 resonance settings |
| $D417 bits 0–2 | Voice 1–3 filter routing | Preserve |
| $D417 bit 3 | External input ignored | Document absent external analog input |
| $D418 bits 4–6 | Low-pass, band-pass-like, high-pass-like summed approximations | Numerically stable multimode filter |
| $D418 bit 7 | Silences Voice 3 before routing (incorrect) | Silence only direct V3; filtered V3 remains audible |
| $D418 low nibble | Master volume | Preserve |
| Per-sample coefficients | Math.pow and Math.exp each frame | Cache/recompute on relevant writes |

The existing implementation clamps PCM to [-1,1], which can conceal
filter-state instability; our future tests must inspect internal
stability, clipping, DC and relative gain.

### How to run the Phase 4D.0 filter lab

Open tools/SID_FILTER_BENCH.html. This is a standalone tool; the
existing 23-fixture SID_AUDIO_BENCH.html and its v3 JSON remain
unchanged and comparable with earlier exports.

1. Choose PAL or NTSC, LP/BP/HP or combined mode, and a 220, 880,
   or 3520 Hz sawtooth stimulus.
2. Click Run filter survey. This measures twelve cutoff positions
   between 0 and 2047, five resonance codes 0/4/8/C/F, and both
   SID models: 120 parameter combinations. Each is a new SID
   instance rendering 0.5 s of 22050 Hz PCM. Measurements exclude
   the initial 100 ms for settlement.
3. Review relative AC RMS gain curves, expressed in dB versus a
   same-frequency unfiltered source. These are EMULATOR transfer
   measurements, NOT matched measurements from physical chips.
4. Review routing diagnostics for filter disable, direct V3 OFF,
   incorrectly filtered V3 OFF and inert resonance.
5. Click Export filter JSON. For default settings the file is
   sid-filter-4d0-PAL-lp.json (schema retroapplejs.sid.filter-lab.v1),
   containing all 120 sweep points, bypass levels and routing
   results with full stimulus metadata.

**Do not use total laboratory runtime as a CPU benchmark.**
All tests are untimed. Continue using the original ten PAL fixtures,
both 6581/8580 and five repetitions in Audio Bench v3 for CPU
comparisons on the old Safari 16.6.1 MacBook Air. The accepted
Phase 4C mean of medians is about **17.10 ms** per two seconds
of 22,050 Hz PCM. Investigate regressions around +5% or above,
allowing for timer quantization and run-to-run noise.

### Historical test boundary

tests/fixtures/sid_phase4d0_baseline.json freezes five representative
pre-4D filter PCM fingerprints, including LP, BP, HP and V3OFF.
tests/sid_phase4d0.test.js verifies those fingerprints and both
currently known deficiencies, plus deterministic sweeps, both clocks,
filter mode combinations and finite output.

The tests describing defects are **pre-4D characterization assertions**.
4D.1 should explicitly replace them with positive functional tests,
while retaining the old hashes as historical reference data.
Changing full PCM hashes will be legitimate when the filter is
fixed. Existing independent oscillator/ADSR invariants must remain.

### Important accuracy limits

The 6581 exhibits pronounced nonlinearities and chip-to-chip
variation. The 8580 is more predictable but still needs calibration
against measured hardware. No matched physical SID sweeps are
available in this phase. Model response curves from this lab
describe only the existing emulator approximation.

Nyquist at 22050 Hz is 11025 Hz. Any future state-variable filter
must stay stable near the upper cutoff and across high resonance,
without unconditionally adding expensive oversampling. We prefer
cached coefficients, bounded input and an event-safe control path.

## Proposed next steps

**4D.1 — Digital filter:** Implement an efficient, stable
state-variable multimode core with real resonance control,
LP/BP/HP combinations and corrected V3OFF semantics. Recalculate
coefficients on relevant register, chip-model or clock changes,
not once per sample. Avoid per-SID-clock iterations.

**4D.2 — Model calibration:** Compare cutoff, resonant peak,
gain, passband and rejection against properly sourced 6581
and 8580 measurements. Clearly separate chosen approximations
from actual calibrated silicon behavior.

**4D.3 — Acceptance:** Compare the same-machine 17.10 ms
performance reference, keep digital oscillator/ADSR tests passing,
exercise all filter register combinations, and verify real tunes
with both 10 FPS and VBLANK audio telemetry.

Phase 4D.0 does not implement or pre-approve 4D.1 through 4D.3.
