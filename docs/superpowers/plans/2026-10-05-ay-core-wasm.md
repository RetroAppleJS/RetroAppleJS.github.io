# Shared AY Core Implementation Plan

> Execute inline using the executing-plans and test-driven-development skills.

**Goal:** Deliver one synchronous block API for two AY/YM chips in JavaScript and WASM, used by FYM playback and real-time Mockingboard synthesis.
**Architecture:** Core owns digital and filter state. Source adapters supply ordered packed events; CPU timing maps to nanosecond audio ticks while AY clocks and browser playback rate remain fixed.
**Tech stack:** Vanilla JavaScript, freestanding C, scalar WASM, Node contract/regression tests.
**Spec:** ../specs/2026-10-05-ay-core-wasm-design.md

## Constraints
- ABI v1, 16-byte events; safe-integer ticks; atomic preflight; Float64 DSP/Float32 PCM.
- Fixed 2 MiB WASM memory, no render allocations, imports, fast-math or contraction.
- Explicit includes in index.html and standalone tools; preserve VIA, bus, history and R14/R15 ownership.
- Auto stays JS until browser performance acceptance is established. Forced WASM is available for validation.

## Review focus
- Boundary and repeated envelope writes retain input order across batches.
- Rejected events/capacity/snapshots do not change state or PCM.
- Speed changes carry mapping phase; clocks and browser rate stay fixed.
- Restart and cancellation cannot resume stale asynchronous initialization.
- No advancement beyond completed CPU intervals; queue overflow is explicit.

## Tasks
1. Shared JS core: write failing contract/reference tests; implement facade, cached FIR views, state snapshots; run tests.
2. CPU source mapper/stream: failing duration, fraction, seal/order/epoch tests; implement exact Q32 projection and bounded transport; run tests.
3. Native core: same contracts plus multi-instance/pointer tests; port local Ayumi scalar operations, build embedded asset, assert PCM parity; run tests.
4. FYM adapter: tests for two independent schedulers and frame-boundary ordering; replace sample loops with merged reusable batches; add backend control and benchmark.
5. Peripheral adapter: tests for real synthesis, fixed-pitch speed changes/readback/reset; use source mapping and packed batches, retain mirrors/VIA/history; set browser rate 1 and bound scheduled lead.
6. Verify full suite, deterministic rebuild and patch application. Document browser benchmark/listening limitations and integration status.

## Execution ledger
- Baseline: 87 tests, 86 pass; existing restart test fails because its console substitute lacks assert(). No product defect found in that baseline failure.
- Ruling: User authorized implementation of the accepted design. Work on an isolated feature branch in this disposable checkout, preserving existing dual-FYM edits; no additional approval needed.
- Completed: shared JS and scalar WASM cores, fixed-memory ABI, source clock and sealed transport, dual-FYM backend selection, live peripheral integration, fixed-rate browser playback, bounded lead and CPU backpressure.
- Review: five important issues corrected with regression coverage: obsolete Start rejection, stale sample-rate backend selection, malformed JS generator snapshot, mute backlog replay, and silent debugger stepping. Reviewer independently confirmed the fixes.
- Additional lifecycle coverage: pending browser resume cannot activate an unmounted device; packed event fields reject truncation.
- Verification: 122/122 tests pass. Rebuilt embedded WASM is byte-for-byte identical (SHA256 `9e0c398361c8eefd862c9c4fbd71d5c91d6e0e05f00739813731046b9102b070`). Clean-baseline patch application is checked before delivery.
- Deferred acceptance: browser listening/performance matrix, AudioWorklet, sub-sample rendering, cross-backend snapshots and complete machine checkpoints. Auto remains JS.
- Patch compatibility: rebased onto the requested commit `7c56b03272d7f0f64005cb2c5f7ab06aac9c2926`, preserving the existing dual-FYM player, seek/Start-resume/shared-loop controls, history fill display, refresh hook and FYM/JSON download controls. The newer FYM/seek tests load the shared sound dependencies.
- Compatibility investigation: reproduced the original two apply errors on `aa4d47e`. The target commit adds shared seeking/looping, which takes precedence over the earlier independent-loop player behavior. Seek restoration remains a cold audio transition.
- Focused seek review: fixed a quantized zero-length loop and a selected seek lost during pending browser resume, with real-core regression coverage. JS/WASM parity includes fractional seeks and shared loops.
- Target verification: 136/136 tests pass; delivery patch is checked and replayed against the exact requested commit.
