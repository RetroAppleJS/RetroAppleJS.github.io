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
filter-state instability. Phase 4D.0 CI discovered significant
**pre-existing band-pass saturation**: for example, 8580 / 880 Hz /
cutoff 1536 / resonance F clips **2,112 of the 8,820 analyzed PCM
samples** (about 24%). This is a confirmed baseline defect of the
existing filter approximation, not a new regression in Phase 4D.0.
Clipped sweeps cannot be interpreted as unclipped filter gain.
Future implementation must test internal numerical stability,
clipping, DC and relative gain.

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


## Phase 4D.1 — TPT state-variable filter implementation

Scope: the production SID audio device, the filter correctness
tests, and the existing standalone filter laboratory UI.
The 4D.0 measurements and historical baseline JSON remain unchanged.

### Production algorithm

A two-integrator topology-preserving transform (TPT) state-variable
filter replaces the old one-pole/derivative mixer. It computes LP,
BP and HP from a single pair of integrator memories at 22,050 output
samples per second, with no per-SID-cycle filter loop, new Web Audio
resources, or mandatory oversampling.

The input contains only the voices selected by $D417 bits 0–2.
The filter still updates its integrators when no output filter
mode is selected. $D418 bits 4, 5, 6 select computed LP, BP and
HP output; simultaneous modes sum them. $D418 bit 7 (V3OFF)
suppresses only the *direct* Voice 3 mixer path, not filtered V3.
The master-volume nibble is unchanged, and the external analog
input bit remains unsupported.

The 6581 and 8580 cutoff mappings initially follow the earlier
approximate curves. The TPT frequency coefficient uses
tan(pi * Hz / 22050), with cutoff clamped below 45% of the
sample rate. The full resonance nibble maps to bounded
inverse damping. These are provisional Q and frequency curves,
NOT silicon calibration. Hardware-based calibration is 4D.2.

### CPU budget and diagnostics

Expensive cutoff functions execute only when the 11-bit cutoff,
four-bit resonance, or SID model changes. The audio-sample path
uses only arithmetic on cached coefficients; routing-only writes
and mode/volume writes do not recalculate them.

Passive getFilterState() returns integrator memories,
cutoff/resonance, approximate Hz/damping and cumulative
coefficient-update count without advancing simulation.

### Regression tests

The new 4D.1 test suite verifies all 16 resonance codes, correct
filtered Voice 3 OFF behavior, unchanged dry-path PCM, LP/BP/HP
and combinations, PAL/NTSC, extremes of cutoff, rapid register
changes, filter state bounds, coefficient caching and reset.

The 4D.0 test file now treats old filter checksum and clipping
data as immutable historical reference; it no longer insists
the corrected filter reproduce documented defects. PCM hashes
for active filtered signals should differ from 4D.0, while the
unfiltered digital path and 4B/4C invariants remain unchanged.

The lab now exports sid-filter-4d1-PAL-lp.json, etc, preserving
the filter-lab.v1 survey format and adding a Phase 4D.1 marker.

### Performance acceptance

Rerun the ten original PAL Phase 4A Audio Bench v3 fixtures on the
late-2014 MacBook Air i7 with Safari 16.6.1: both SID models,
five repetitions. Compare the mean of twenty fixture medians
against the **17.10 ms** accepted Phase 4C baseline for two seconds
of 22,050 Hz PCM. Safari timer quantization requires caution;
investigate consistent regressions around +5%.

Phase 4D.3 listening tests and both 10 FPS and VBLANK telemetry
must still be completed before final filter acceptance.

A stable digital SVF is not the nonlinear 6581 transistor
circuit. Hardware-calibrated cutoff, resonance and analog
coloration are deferred to Phase 4D.2.
