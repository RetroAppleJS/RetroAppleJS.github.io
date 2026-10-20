# Phase 4B.1 — Fast path for ordinary SID oscillators

**Goal:** retain the Phase 4B digital oscillator behavior while recovering
CPU time on older Safari machines. The reference target is a late-2014
MacBook Air i7 / Safari 16.6.1; older 2010–2014 iMacs remain important.
This is a narrow performance change, not another fidelity feature.

## Why

The user's *same-machine* PAL benchmarks found that the original
Phase 4A synthesizer took an average **17.65 ms** to render two seconds
of PCM for ten fixtures × two SID models, versus **21.90 ms** after
Phase 4B, a **+24.1%** regression. The previous, more alarming comparison
between machines/browsers must not be used as a CPU regression estimate.

Phase 4B introduced a general hard-sync event loop into **every**
22,050 Hz sample, even when only a normal triangle, sawtooth, pulse,
or noise voice was enabled. That loop repeatedly decoded registers,
filled oscillator tables, checked for synchronization and dispatched
noise-clock computations. Single-wave audio never needed the expensive
event-boundary processing.

## Implementation

The phase 4B.1 oscillator clock separates two modes:

- **Common case, no SYNC bit set on any oscillator:** advance each
  24-bit phase in one arithmetic operation per PCM frame using the
  existing integer SID-cycle count and fractional carry. Fast-skip
  zero-frequency oscillators. Reset TEST-mode oscillators exactly as
  before. Update the 23-bit noise LFSR only when a relevant bit-19
  rising edge actually occurred.
- **SYNC in use:** retain the existing event-boundary loop and the
  source-MSB rising-edge resets. The computationally heavier path is
  used only when its behavior is required.

The LFSR remains **23-bit with an eight-bit tapped output**, not a
4-bit noise generator. The eight bits are expanded to the current
approximate 12-bit DAC input using the existing mapping. Phase 4B.1
does **not** replace this mapping or claim it reproduces a measured
6581/8580 analog output.

Clock transition counts are computed with exact integer bit shifts
instead of two floating-point Math.floor operations. The operand bound
for supported SID clocks (900 kHz–1.1 MHz) and 22.05 kHz samples is
safely under 2^32.

The oscillator noise register must keep advancing even if NOISE is
not yet selected; otherwise subsequent waveform switches would be
incorrect. That fidelity is intentionally **not** sacrificed.

**Unchanged:** 22,050 Hz sample rate, oscillator phase/noise algorithms,
ADSR, filters, DAC tables, SID register ABI, IRQ, native PSID player,
Web Audio scheduler, FIFO, telemetry and Language Card requirements.

## Tests

`tests/sid_phase4b1.test.js` includes the original Phase 4B PAL
PCM hashes for triangle, sawtooth, pulse, noise, ring modulation,
hard sync, triangle+saw and noise+saw. Every hash must remain
byte-identical. It also verifies zero-frequency voices, TEST behavior,
independent noise clocking while muted, and multiple high-frequency
noise ticks per output sample.

The existing Phase 4B and Phase 4A tests run with these in CI.
A failing PCM hash means the optimisation has accidentally changed
synthesis behavior and must not be accepted.

## Measuring the benefit

An *indicative* same-runtime A/B comparison of pre-4B.1 and
post-4B.1 sources in a V8 isolate, rendering the exact same fixture,
showed speed gains of roughly 10–15% for ordinary sawtooth/noise
cases, and little change for hard sync. Those absolute timing values
do **not** represent the older Mac, whose JavaScript engine and
performance characteristics differ. No fixed wall-clock CI
performance threshold is imposed.

Before merging, open the shared `tools/SID_AUDIO_BENCH.html` on the
**late-2014 MacBook Air** and rerun the ten Phase 4A fixtures with
PAL and five repetitions. Compare the 20 medians against the
post-4B **21.90 ms** and original **17.65 ms** averages. Prefer a clear
reduction in the real cost of ordinary waveforms with **identical
PCM hashes**.

Also listen to SID music and inspect the live audio telemetry at
both 10 FPS and VBLANK: an offline performance result cannot
guarantee reliable audio delivery. If Phase 4B.1 yields only
marginal gains on the older Mac or music sounds worse, reevaluate
which SID fidelity features justify their CPU budget.

**Acceptance principle: retain only improvements that provide useful
SID authenticity per CPU cycle.** WASM is a possible later optional
backend, not a justification for expensive JavaScript playback.
