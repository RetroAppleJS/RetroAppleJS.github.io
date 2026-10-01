# ConvertHGR Shared Worker Packaging Design Addendum

## Purpose

Correct the runtime packaging introduced during the Dithertizer/ConvertHGR integration so the emulator and `tools/ConvertHGR.html` share one worker implementation without either consumer depending on the other at runtime.

`tools/ConvertHGR.html` remains a standalone proof-of-concept/reference UI. It must not be fetched or scraped by `index.html`, `EMU_DITHERTIZER_converthgr.js`, or the Dithertizer card at runtime.

This addendum refines the existing `2026-10-01-dithertizer-converthgr-wasm-design.md`. The earlier full-pipeline WASM, DSCAN, camera pacing, no-JS-fallback, and no-direct-Apple-II-RAM-write requirements remain unchanged.

## Problem being corrected

The current adapter initializes by fetching `tools/ConvertHGR.html`, extracting its inline `<script id="worker-source">`, creating a Blob from that text, and starting a Worker from the Blob.

That arrangement is architecturally wrong for two reasons:

1. it makes the emulator depend on a development/proof-of-concept HTML tool;
2. `fetch("tools/ConvertHGR.html")` fails when RetroAppleJS is opened directly through `file://`, which is a supported project execution mode.

The failure occurs after `getUserMedia()` succeeds, so the host camera may turn on briefly and then be torn down when adapter initialization rejects.

## Selected architecture

Move the worker implementation into a normal shared emulator resource under `res/` and make both consumers load that resource as a regular script.

Recommended files:

```text
res/EMU_DITHERTIZER_converthgr_worker.js
res/EMU_DITHERTIZER_converthgr.js
index.html
tools/ConvertHGR.html
```

The shared worker resource owns the single source of truth for:

- ConvertHGR worker entry code;
- embedded WASM payload / WASM bootstrap required by that worker;
- worker message handling;
- conversion request/result protocol;
- any worker-local constants required by both consumers.

The worker resource exposes source text suitable for Blob-worker construction, conceptually:

```js
function ConvertHGRWorkerMain()
{
    // self-contained worker implementation
}

var CONVERTHGR_WORKER_SOURCE =
    "(" + ConvertHGRWorkerMain.toString() + ")();";
```

The exact global identifier may follow repository naming conventions, but it must be explicit, stable for both consumers, and defined by the shared resource rather than by either HTML page.

## Runtime loading

### Emulator

`index.html` includes the shared worker resource using the project-standard script include mechanism.

`EMU_DITHERTIZER_converthgr.js` must not call `fetch()` to obtain worker code. It creates the worker directly from the already-loaded source:

```js
var blob = new Blob(
    [CONVERTHGR_WORKER_SOURCE],
    {type:"text/javascript"}
);
workerBlobURL = URL.createObjectURL(blob);
worker = new Worker(workerBlobURL);
```

The adapter remains responsible for worker lifetime, request sequencing, result validation, and Blob URL cleanup.

### Standalone tool

`tools/ConvertHGR.html` loads the same shared worker resource with a normal `<script src="../res/EMU_DITHERTIZER_converthgr_worker.js">` include (or equivalent correct relative path).

It must remove its private inline `worker-source` implementation and construct its Worker from the same shared source variable used by the emulator.

The tool remains independently usable as a visual/reference harness; sharing worker code does not make it a runtime dependency of the emulator.

## Local-file compatibility

The design must work when the repository is opened directly from disk with `file://`.

Therefore runtime worker construction must not require:

- `fetch()` of `tools/ConvertHGR.html`;
- `fetch()` of a worker JavaScript file;
- `fetch()` of a standalone `.wasm` file solely to start the current bundled converter path;
- HTTP-server-only origin behavior.

The normal script include may load the shared resource, after which worker source is passed to a Blob and the Worker is created from the Blob URL.

This preserves the repository's serverless/local execution model.

## Dependency direction

The dependency graph is strictly:

```text
res/EMU_DITHERTIZER_converthgr_worker.js
        |                         |
        v                         v
index.html / emulator       tools/ConvertHGR.html
        |
        v
EMU_DITHERTIZER_converthgr.js
        |
        v
EMU_CARD_dithertizer.js
```

Forbidden runtime dependency directions include:

```text
emulator -> tools/ConvertHGR.html
worker resource -> tools/ConvertHGR.html
shared worker -> Apple II RAM
```

`tools/ConvertHGR.html` may remain a source for development fixtures or parity comparisons in build/test tooling, but not in production runtime initialization.

## WASM boundary

This packaging change does not alter the approved algorithmic boundary:

- no JavaScript ConvertHGR fallback is introduced;
- the Dithertizer path still requires the WASM backend;
- WASM does not write Apple II RAM;
- DSCAN `$C0n8` remains the synchronous capture boundary;
- the processed 280x192 palette output is converted to the stable luma source consumed by DSCAN.

If the current shared worker still contains transitional JavaScript preprocessing from the proof-of-concept, extracting the worker does not redefine that transitional code as the final full-pipeline architecture. The existing full-pipeline WASM specification remains the target architecture.

## Initialization and failure behavior

`DithertizerConvertHGRAdapter.init()` must:

1. verify the shared worker source global exists and is non-empty;
2. verify `Worker`, `Blob`, and `URL.createObjectURL` support exists;
3. create the Blob worker without network/file fetch;
4. attach message/error handlers;
5. resolve with the initialized adapter.

If the bundled worker source is absent or invalid, initialization rejects with a diagnostic error. The camera-start path continues to fail closed and clean up the MediaStream exactly as before.

The temporary startup `console.error` diagnostic may remain while this integration is stabilized; it does not change camera state behavior.

## Tests

The implementation must add or update tests that prove:

- adapter initialization does not call `fetch()`;
- adapter initialization succeeds when no `fetch` function is available;
- adapter creates its Worker from the bundled source via Blob URL;
- absence of the bundled source produces a clear initialization rejection;
- the worker protocol remains unchanged for `convert` requests and `conversionResult` responses;
- WASM-only backend validation remains enforced;
- `tools/ConvertHGR.html` contains no private duplicate `worker-source` implementation after migration;
- both emulator and tool refer to the same shared worker resource;
- no production `res/` file contains a runtime reference to `tools/ConvertHGR.html`;
- local-file-compatible initialization is covered without relying on HTTP fetch.

Existing Dithertizer camera/DSCAN integration tests must remain green.

## Files expected to change

```text
res/EMU_DITHERTIZER_converthgr_worker.js   # new shared worker source
res/EMU_DITHERTIZER_converthgr.js          # consume bundled source, remove fetch/scrape
index.html                                 # include shared worker resource
tools/ConvertHGR.html                      # consume shared worker, remove inline duplicate
tests/dithertizer_converthgr_adapter.test.js
```

Additional focused tests for shared-worker packaging may be added if that keeps the existing adapter test readable.

## Scope boundaries

This change does not:

- change DSCAN slot-I/O semantics;
- change HGR page-write behavior;
- change camera RATE semantics;
- add a JavaScript conversion fallback;
- make `tools/ConvertHGR.html` part of emulator runtime;
- introduce HTTP/server requirements;
- let WASM write Apple II RAM;
- redesign the ABI v1 settings or output contract.

## Acceptance criteria

The packaging correction is complete when:

1. `EMU_DITHERTIZER_converthgr.js` contains no runtime `fetch("tools/ConvertHGR.html")` or HTML worker-source extraction;
2. one shared worker source under `res/` is consumed by both the emulator and `tools/ConvertHGR.html`;
3. emulator camera startup works without a `fetch` API and is compatible with direct `file://` execution;
4. both consumers use the same worker message protocol and WASM backend;
5. no duplicate inline worker implementation remains in `tools/ConvertHGR.html`;
6. existing camera OFF, stale-frame, DSCAN `$C0n8`, and HGR capture behavior remains unchanged;
7. tests explicitly prevent reintroducing a runtime dependency from `res/` to `tools/ConvertHGR.html`.
