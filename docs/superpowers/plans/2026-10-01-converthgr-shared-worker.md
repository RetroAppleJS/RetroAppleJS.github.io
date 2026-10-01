# ConvertHGR Shared Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the emulator's runtime dependency on `tools/ConvertHGR.html` by extracting the existing ConvertHGR worker into one shared bundled source used by both the emulator and the standalone tool.

**Architecture:** Move the current inline `worker-source` implementation into `res/EMU_DITHERTIZER_converthgr_worker.js`, exposed as a self-contained source string for Blob-worker construction. `index.html` and `tools/ConvertHGR.html` load that shared resource with normal script includes; `EMU_DITHERTIZER_converthgr.js` creates the Worker directly from the already-loaded source and performs no runtime fetch/scrape.

**Tech Stack:** Vanilla JavaScript, Web Workers, Blob URLs, embedded WASM payload, Node `node:test` regression tests.

**Spec:** `docs/superpowers/specs/2026-10-01-converthgr-shared-worker-design.md`

## Global Constraints

- `tools/ConvertHGR.html` is a standalone proof-of-concept/reference UI and must not be a runtime dependency of the emulator.
- Direct `file://` execution must remain supported.
- Runtime initialization must not fetch `tools/ConvertHGR.html`, a worker JavaScript file, or a standalone WASM file merely to start the current bundled converter path.
- One shared worker implementation under `res/` is the single source of truth for both consumers.
- No JavaScript ConvertHGR fallback is introduced.
- Dithertizer conversion still requires the WASM backend.
- WASM must not write Apple II RAM.
- DSCAN `$C0n8`, camera pacing, HGR page writes, camera OFF, and stale-frame behavior remain unchanged.

## Review Focus

- Direct `file://` startup with no usable `fetch` must initialize the adapter successfully from bundled source.
- Missing bundled worker source must fail with a clear adapter initialization error and no hidden fallback.
- `tools/ConvertHGR.html` and the emulator must consume exactly the same shared worker source rather than drifting copies.
- Worker message protocol and WASM-only backend enforcement must remain byte-for-byte compatible with the current adapter tests.
- Worker Blob URLs and pending conversions must still be cleaned up correctly on `close()` and camera OFF.

---

### Task 1: Extract the shared worker source

**Files:**
- Create: `res/EMU_DITHERTIZER_converthgr_worker.js`
- Modify: `tools/ConvertHGR.html`
- Test: `tests/dithertizer_converthgr_shared_worker.test.js`

**Interfaces:**
- Produces: global `CONVERTHGR_WORKER_SOURCE` containing executable worker source text.
- Consumes: the current inline `<script id="worker-source" type="text/plain">` implementation from `tools/ConvertHGR.html` as the behavioral source of truth.

- [ ] **Step 1: Write the failing shared-worker packaging test**

Create `tests/dithertizer_converthgr_shared_worker.test.js` asserting:

```js
assert.ok(fs.existsSync(path.join(ROOT,'res','EMU_DITHERTIZER_converthgr_worker.js')));
assert.doesNotMatch(toolHtml,/id=["']worker-source["']/);
assert.match(toolHtml,/\.\.\/res\/EMU_DITHERTIZER_converthgr_worker\.js/);
assert.match(toolHtml,/CONVERTHGR_WORKER_SOURCE/);
```

Also evaluate the shared file in a `vm` sandbox and assert `typeof CONVERTHGR_WORKER_SOURCE === 'string'` and that it contains the worker `onmessage` implementation and embedded WASM constant.

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
node --test tests/dithertizer_converthgr_shared_worker.test.js
```

Expected: FAIL because the shared resource does not yet exist and the tool still owns the inline worker.

- [ ] **Step 3: Extract the current inline worker into the shared resource**

Create `res/EMU_DITHERTIZER_converthgr_worker.js` with one self-contained worker entry function and:

```js
var CONVERTHGR_WORKER_SOURCE =
    "(" + ConvertHGRWorkerMain.toString() + ")();";
```

Move the existing worker code and embedded WASM payload without changing its conversion protocol or algorithm behavior.

- [ ] **Step 4: Migrate `tools/ConvertHGR.html` to the shared source**

Add:

```html
<script src="../res/EMU_DITHERTIZER_converthgr_worker.js"></script>
```

Remove the private `worker-source` block and replace its worker construction with Blob creation from `CONVERTHGR_WORKER_SOURCE`.

- [ ] **Step 5: Run the shared-worker test and verify GREEN**

Run:

```bash
node --test tests/dithertizer_converthgr_shared_worker.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add res/EMU_DITHERTIZER_converthgr_worker.js tools/ConvertHGR.html tests/dithertizer_converthgr_shared_worker.test.js
git commit -m "refactor: share ConvertHGR worker source"
```

### Task 2: Make the emulator adapter consume bundled worker source

**Files:**
- Modify: `res/EMU_DITHERTIZER_converthgr.js`
- Modify: `index.html`
- Modify: `tests/dithertizer_converthgr_adapter.test.js`

**Interfaces:**
- Consumes: global `CONVERTHGR_WORKER_SOURCE` from Task 1.
- Produces: unchanged `DithertizerConvertHGRAdapter` API: `init()`, `configure(settings)`, `convert(rgb,width,height,seed)`, `close()`.

- [ ] **Step 1: Add failing adapter tests for no-fetch initialization**

Update `tests/dithertizer_converthgr_adapter.test.js` so adapter initialization is tested with no `fetch` in the sandbox, while `CONVERTHGR_WORKER_SOURCE` is supplied. Assert Worker creation succeeds and no fetch function is called.

Add a second test asserting missing/empty `CONVERTHGR_WORKER_SOURCE` rejects with a clear bundled-worker-source initialization error.

- [ ] **Step 2: Run focused adapter tests and verify RED**

Run:

```bash
node --test tests/dithertizer_converthgr_adapter.test.js
```

Expected: FAIL because current `init()` still calls `fetch("tools/ConvertHGR.html")`.

- [ ] **Step 3: Replace fetch/scrape initialization with bundled source**

In `DithertizerConvertHGRAdapter.init()`:

- remove `workerSourceUrl`/`fetch` loading for runtime worker source;
- read `CONVERTHGR_WORKER_SOURCE` from the loaded global;
- reject when it is absent or empty;
- create `Blob([CONVERTHGR_WORKER_SOURCE], {type:'text/javascript'})`;
- create Worker from the Blob URL;
- preserve the existing `onmessage`, `onerror`, pending request, and cleanup behavior.

Do not change `convert()` request shape or WASM-backend validation.

- [ ] **Step 4: Include the shared worker resource before the adapter in `index.html`**

Add the project-standard script include for:

```text
res/EMU_DITHERTIZER_converthgr_worker.js
```

before `res/EMU_DITHERTIZER_converthgr.js` is first required/loaded.

- [ ] **Step 5: Run adapter tests and verify GREEN**

Run:

```bash
node --test tests/dithertizer_converthgr_adapter.test.js
```

Expected: PASS, including WASM-only backend rejection coverage.

- [ ] **Step 6: Commit**

```bash
git add res/EMU_DITHERTIZER_converthgr.js index.html tests/dithertizer_converthgr_adapter.test.js
git commit -m "fix: initialize ConvertHGR worker from bundled source"
```

### Task 3: Lock runtime dependency direction and camera regressions

**Files:**
- Modify: `tests/dithertizer_converthgr_shared_worker.test.js`
- Test: existing `tests/dithertizer_camera_toggle.test.js`
- Test: existing Dithertizer integration tests.

**Interfaces:**
- Consumes: shared-worker packaging from Tasks 1-2.
- Produces: regression coverage preventing future `res/ -> tools/ConvertHGR.html` runtime coupling.

- [ ] **Step 1: Add dependency-direction assertions**

Extend the shared-worker test to assert no production file under the Dithertizer adapter path contains:

```text
tools/ConvertHGR.html
worker-source
fetch(
```

for worker-source acquisition, and assert both `index.html` and `tools/ConvertHGR.html` include `res/EMU_DITHERTIZER_converthgr_worker.js` through their correct relative paths.

- [ ] **Step 2: Run the shared-worker and camera/integration suites**

Run the focused suites already present in the repository for:

```text
dithertizer_converthgr_adapter
dithertizer_converthgr_shared_worker
dithertizer_camera_toggle
Dithertizer DSCAN/HGR integration
```

Expected: all PASS.

- [ ] **Step 3: Syntax-check changed JavaScript**

Run:

```bash
node --check res/EMU_DITHERTIZER_converthgr_worker.js
node --check res/EMU_DITHERTIZER_converthgr.js
node --check res/EMU_CARD_dithertizer.js
```

Expected: no syntax errors.

- [ ] **Step 4: Verify no runtime tool dependency remains**

Run repository search for `tools/ConvertHGR.html` under `res/` and ensure there are no runtime references.

- [ ] **Step 5: Commit**

```bash
git add tests/dithertizer_converthgr_shared_worker.test.js
git commit -m "test: prevent ConvertHGR tool runtime coupling"
```

## Completion Gate

Before opening the implementation PR:

- the adapter initializes without `fetch`;
- `tools/ConvertHGR.html` and the emulator share one worker source;
- no private inline worker remains in the tool;
- direct `file://`-compatible initialization is covered by tests;
- WASM-only backend validation remains enforced;
- existing camera OFF, stale-frame, DSCAN `$C0n8`, and HGR capture regressions remain green;
- no production `res/` runtime dependency on `tools/ConvertHGR.html` remains.
