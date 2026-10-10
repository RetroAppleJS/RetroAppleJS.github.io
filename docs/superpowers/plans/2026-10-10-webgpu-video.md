# Apple II+ WebGPU Video Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Add the approved native II+ WebGPU renderer and open a project pull request.

**Architecture:** A named device owns a reusable render pipeline and compact input buffers. MUX retains scheduling and adds optional asynchronous activation hooks, selection guards and Canvas fallback.

**Tech Stack:** Vanilla JavaScript, WGSL, WebGPU, node:test, browser pixel comparisons.

**Spec:** ../specs/2026-10-10-webgpu-video-design.md

## Global Constraints

- Additional webgpu / A2WGPU device; append index 4 and preserve existing devices/default.
- Explicit index.html include; no runtime script injection or new production dependencies.
- All native II+ modes, both pages, selectable ROMs and four monitor palettes.
- Immutable captured byte/mode planes in vertical-blank mode.
- Two in-flight submissions maximum, latest-frame coalescing and no CPU-runner waits.

## Review Focus

- Initialization resolving after deselection must not attach the wrong canvas.
- Device loss while inactive must not select a fallback.
- Timing changes/reset must discard pending pictures and retain healthy resources.
- ROM and palette edits must reach GPU data and exposed tables.
- Visible RAM notifications precede actual writes; snapshot only at submission.

## Task 1: Device and rendering

**Files:** res/EMU_DEVICE_video_WebGPU.js; tests/video_webgpu.test.js; tests/video_webgpu_browser.html.

**Interfaces:** Produce Apple2VideoWebGPU(canvas), activate():Promise<boolean>, deactivate(), isReady(), getStatus(), isAvailable(), dispose(), the existing renderer contract, and optional onStatusChange callback.

- [x] Write lifecycle/input tests and browser reference comparisons; run the Node tests and confirm missing-device failures.
- [x] Implement packed storage, shared WGSL decoder, persistent pipeline, status/control methods and bounded submissions.
- [x] Verify RAM snapshot timing, captured modes/flash, ROM/palette updates, initialization/reset/loss races and cadence.
- [x] Run the complete Node suite; commit device and tests.

## Task 2: MUX integration

**Files:** res/EMU_DEVICE_video_MUX.js; index.html; tests/video_webgpu_mux.test.js.

**Interfaces:** Consume Task 1 lifecycle methods. Keep existing synchronous MUX selection and notification APIs.

- [x] Write tests for appended device, lazy registration, delayed canvas attach, failure fallback, late resolution/loss and timing changes; confirm failures.
- [x] Add guarded optional lifecycle handling, fallback via setModeByDCODE, unavailable-device cycling and explicit include.
- [x] Run the complete Node suite and standalone builder; commit integration.

## Task 3: Browser verification, docs and PR

**Files:** docs/WEBGPU_VIDEO.md; tests/run_video_webgpu_browser.cjs; .github/workflows/webgpu-video.yml.

**Interfaces:** Browser harness compares actual shader pixels to Apple2RasterKernel and exercises timer/captured pictures. Runner fails on unavailable WebGPU or any mismatch.

- [x] Run real browser shader comparisons if locally available; otherwise run them in a dedicated pull-request CI job with software WebGPU and state the local limitation.
- [x] Document selection, timing, fallback, approximation and benchmark procedure without unmeasured speed claims.
- [x] Run syntax checks, full Node suite and diff checks; obtain independent whole-branch review and address material findings.
- [ ] Push the feature branch and open a pull request; report its link and actual validation.

## Execution record

User approved the written specification and explicitly requested a pull request; execute inline through publication of the PR. No merge is authorized. The repository has no develop branch; use current main (46787f88). Baseline: node --test tests/*.test.js, 18 passed.

Implementation and independent review completed. The final local Node suite passes 40 tests. Chromium with software WebGPU passes 242 reference cases (13,009,920 logical pixel comparisons), including both available ROMs, with no shader or page errors. The full emulator boots with WebGPU, captures a vertical-blank frame, and switches Canvas → WebGPU without page errors. The standalone builder and syntax/diff checks pass.

Review fixes preserve MUX consumers that omit the optional WebGPU include and stop/resume legacy GPU.js and Three.js rendering with selection. Follow-up review reports no new material issues. A one-time duplicate retained raster submission during activation is deferred as a minor optimization and documented. Hardware performance and an actual Vaporlock step-trace remain manual checks; no speedup is claimed.
