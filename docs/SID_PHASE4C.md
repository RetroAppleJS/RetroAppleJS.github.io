# SID Phase 4C — ADSR Envelope Accuracy

**Scope of this pull request: Phase 4C.0 reference tests and instrumentation only.** The production SID synthesizer is deliberately unchanged.

- Production device: res/EMU_DEVICE_SID_audio.js
- Browser laboratory: tools/SID_AUDIO_BENCH.html
- Fixture and trace core: tools/SID_AUDIO_BENCH_core.js
- Independent slow behavioral reference: tests/helpers/sid_adsr_cycle_reference.js
- Regression tests: tests/sid_phase4c0.test.js

## Goal and CPU guardrail

Our existing ADSR code already implements 16 rate selections, eight-bit envelope levels, stepped exponential tails and an approximate ADSR-delay behavior. Phase 4C will correct externally observable register-level timing where relevant to actual music, without expensive chip-clock-by-chip-clock **production** synthesis.

The same-machine Phase 4B.1 PAL baseline on the late-2014 MacBook Air i7 / Safari 16.6.1 is **17.85 ms to render two seconds of 22,050 Hz PCM**. A +5% measured difference is a review trigger, not an absolute threshold. Timing uses integer milliseconds in Safari 16; repeat runs before interpreting small changes. Live 10 FPS / VBLANK audio telemetry is still required before final acceptance.

Keep the Phase 4B.1 oscillator, noise, ring, sync, combined waveforms, 6581/8580 models, filter, Web Audio FIFO and native Apple II 6502 PSID player intact. No oversampling, WASM requirement or new browser compatibility constraint.

## Phase 4C.0 deliverables

The shared SID Audio Reference & Performance Bench becomes **v3**, containing its original 10 Phase 4A and 5 Phase 4B fixtures, plus eight Phase 4C envelope experiments.

| Fixture | Question |
|---|---|
| adsr-fast | Short attack and release |
| adsr-slow | Longer attack and release |
| adsr-retrigger | Repeated short GATE pulses |
| adsr-sustain-down | Sustain reduced while gate stays on |
| adsr-sustain-up | Sustain increased while gate stays on |
| adsr-rate-change | Long-to-short attack rate transition and potential ADSR delay |
| adsr-zero | Envelope release toward zero and restart |
| adsr-voices | Independent envelopes across all three voices |

Fixture length remains two seconds at 22,050 Hz for fair performance comparison.

### Capturing envelopes

1. Open tools/SID_AUDIO_BENCH.html and choose a Phase 4C fixture, PAL or NTSC.
2. Click **Trace selected experiment**. Two new SIDAudio instances render independently and draw the ENV1, ENV2, ENV3 values (0–255). Vertical markers indicate GATE-related register writes.
3. Click **Export envelope trace JSON** for exact event sequences, samples, SID clock timestamps and measured levels. Every ENV3 snapshot is checked against readback from $D41C.
4. Run the normal PCM benchmark separately if needed. **Traces are never included in timed synthesis measurements**. Existing benchmark results and waveform fixture signals are unchanged.

Trace sampling is normally every 64 output frames, additionally snapping to register event boundaries. Writes apply at the existing PCM grid positions; the trace does **not** claim sub-sample or true single-SID-cycle register-write precision.

New main exports: schema retroapplejs.sid.audio-bench.v3 and sid-audio-bench-v3-results.json.
Trace exports: schema retroapplejs.sid.adsr-trace.v1 and sid-adsr-trace-FIXTURE-CLOCK.json.

Earlier v1/v2 benchmark JSON files remain valid historical baselines. The benchmark schema version is independent of synthesizer phase.

### Independent reference — tests only

tests/helpers/sid_adsr_cycle_reference.js deliberately clocks an independent model **one SID cycle at a time**, never as part of production playback. It is based on the publicly documented 16 rate periods, 15-bit counter and skip/wrap behavior, gating without implicit rate-counter reset, decay/sustain logic, exponential-divider thresholds and zero hold.

CI checks isolated facts (for example, an initial attack tick after nine SID clocks and a delayed tick after shortening an already-passed rate period), exercise the real production device, and verify passive envelope traces and ENV3 readback.

**Important:** the reference is an independently authored behavioral approximation, not a bit-perfect 6581/8580 hardware certification. Gate-write pipelining, extreme retrigger cases, and chip revision behavior remain subjects for Phase 4C.1/4C.2. This pull request intentionally does not claim any production ADSR fix or complete hardware accuracy.

External background:
- [Commodore 64 Programmer's Reference Guide ADSR table](https://www.devili.iki.fi/Computers/Commodore/C64/Programmers_Reference/Chapter_4/page_198.html)
- [libsidplayfp SID internals — Envelope Overview](https://sourceforge.net/p/sidplay-residfp/wiki/SID%20internals%20-%20Envelope%20Overview/)
- [reSID ChangeLog — ADSR rate-counter and envelope details](https://github.com/libsidplayfp/resid/blob/master/ChangeLog)

Do not copy GPL reSID implementation code into the MIT project.

## Next development stages

**4C.1:** Correct rate-counter progression, gate transitions, decay/sustain and exponential period loading against independent tests; use integer elapsed SID cycles and a fast no-event path. Reuse the existing PCM timing budget.

**4C.2:** Zero-hold, fast retriggers and rate-change timing corner cases when known SID music demonstrates compatibility benefits. Reject disproportionate CPU costs.

**4C.3:** Run real tunes and 10 FPS/VBLANK telemetry. On the older Mac, compare with the 17.85 ms benchmark baseline. Where genuine ADSR improvements legitimately change complete PCM hashes, explicitly supersede old frozen hashes with independent oscillator/digital-state invariants and newly justified envelope tests rather than silently refreshing checksums.

**Phase 4C.0 acceptance requires the tool, trace export, independent tests, and CI to work without altering production sound or performance.**
