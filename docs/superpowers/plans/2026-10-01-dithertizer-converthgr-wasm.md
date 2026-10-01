# Dithertizer Full-Pipeline ConvertHGR WASM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Dithertizer camera path's placeholder/raw source with a shared, source-controlled, full-pipeline ConvertHGR WebAssembly converter, paced by a 0.10s..1.00s RATE control, while preserving DSCAN/Dithertizer threshold capture as the only writer of Apple II HGR RAM.

**Architecture:** Browser JavaScript remains glue only: camera ownership, `video -> canvas -> RGB24` transport, UI state, scheduling, Web Worker messaging, and publishing one completed 280x192 luma frame. A dedicated Worker instantiates `res/wasm/convert_hgr.wasm`; WASM owns all ConvertHGR preprocessing, scaling/filtering, colour matching, dithering, seven-pixel quantization, palette rendering, and HGR packing. `DithertizerII` reads only the last atomically completed luma frame when DSCAN triggers `$C0n8`; WASM never sees Apple II RAM.

**Tech Stack:** Browser JavaScript, Web Workers, WebAssembly, C11, WASI SDK 34, Node.js `node:test`/`vm`, SHA-256 fixture hashes, existing RetroAppleJS Dithertizer/Apple2IO hardware path.

**Spec:** `docs/superpowers/specs/2026-10-01-dithertizer-converthgr-wasm-design.md`

**Normative ABI:** `docs/superpowers/specs/2026-10-01-converthgr-wasm-abi-v1.md`

## Global Constraints

- No JavaScript ConvertHGR implementation or fallback in the production Dithertizer path.
- JavaScript may only perform browser integration, pixel-format transport, settings serialization, scheduling, worker messaging, the specified palette-RGB-to-luma adaptation, and Dithertizer integration.
- WASM must not import, receive, or write Apple II RAM.
- DSCAN keeps `$C0n0`, `$C0n8`, HGR page selection, threshold semantics, and final HGR writes.
- Camera conversion cadence is 100..1000 ms inclusive, 50 ms steps, default 250 ms.
- Run at most one camera conversion at a time; never queue or replace an in-flight source frame.
- Camera OFF/reset/restart clears the virtual camera frame to black.
- Only a fully completed conversion may replace the currently exposed 280x192 luma frame.
- If WASM load/conversion fails, fail closed: no JS conversion fallback and no partial-frame publication.
- Preserve current ConvertHGR browser-port behavior, including its histogram-stretch approximation and its current ordered-mode/A-F interaction; do not claim stronger desktop ConvertHGR parity.
- ABI v1 fixes Apple pixel aspect to `256/280`; offset `0x68` is reserved and must be positive zero.
- The 48-MiB module may consume/reuse the source buffer as workspace after `hgr_convert()` begins; the caller rewrites source bytes before every call.
- Validation precedence is fixed: zero dimensions, then source limits/capacity, then settings validation, then internal conversion failure.
- RNG behavior is the exact browser-reference Microsoft-style recurrence and candidate ordering defined by ABI v1.
- Dithertizer luma publication uses exactly `trunc(0.299*R + 0.587*G + 0.114*B)` from `paletteRGB`.
- `tools/ConvertHGR.html` remains the frozen reference source during this implementation; migrating that tool to the shared WASM module is a later follow-up, not part of this plan.

## Review Focus

1. **Camera dimensions above the WASM source limit:** reject safely, keep the prior completed frame (or black before first success), and keep the emulator alive. Covered in Task 2 ABI tests and Task 6 camera-pipeline tests.
2. **Camera OFF/reset while a conversion is in flight:** an old worker result must never republish after shutdown. Covered in Task 6 with a camera-generation/epoch regression.
3. **RATE changes while idle or in flight:** reschedule exactly once, do not duplicate capture, cancel conversion, or queue frames. Covered in Task 6 scheduler tests.
4. **DSCAN capture concurrent with frame publication:** `sourceFrame()` must see either the old complete luma frame or the new complete luma frame, never a partially rewritten buffer. Covered in Task 7 integration tests.
5. **WASM ABI drift/workspace/pointer corruption:** reject ABI mismatches, validate the reserved `0x68` field, verify non-overlapping public ranges, and recreate typed-array views from the current `memory.buffer` before every copy. Covered in Tasks 2 and 5.

---

## File Structure

### New WASM source/build files

- `wasm/convert_hgr/convert_hgr.h` — public ABI constants, settings layout, status codes, fixed output sizes.
- `wasm/convert_hgr/convert_hgr.c` — exported buffers, ABI entry points, validation, orchestration.
- `wasm/convert_hgr/hgr_preprocess.h`
- `wasm/convert_hgr/hgr_preprocess.c` — greyscale, framing/scaling, five filters, histogram approximation, gamma.
- `wasm/convert_hgr/hgr_quantize.h`
- `wasm/convert_hgr/hgr_quantize.c` — colour metric, palettes, ordered/error diffusion, seven-pixel quantizer, linear/page packing.
- `tools/build_convert_hgr_wasm.sh` — reproducible WASI SDK 34 build.
- `res/wasm/convert_hgr.wasm` — checked-in browser artifact.

### New browser integration files

- `res/EMU_DITHERTIZER_converthgr.js` — main-thread worker adapter and settings serializer.
- `res/EMU_DITHERTIZER_converthgr_worker.js` — Worker-side WASM loader and converter.
- `res/EMU_DITHERTIZER_camera.js` — camera/video/canvas transport, RATE scheduler, one-in-flight state, completed luma publication.

### Existing files to modify

- `res/EMU_CARD_dithertizer.js` — RATE control, settings mapping, camera pipeline ownership, DSCAN source integration.
- `index.html` — load adapter and camera pipeline before `EMU_CARD_dithertizer.js`.
- `tests/dithertizer_controls_ui.test.js`
- `tests/dithertizer_camera_toggle.test.js`
- `tests/dithertizer_foundation.test.js` only if loader dependencies require its VM sandbox to expose stubs; hardware assertions stay unchanged.

### New tests/fixtures

- `tests/helpers/converthgr_fixture_cases.js`
- `tools/generate_converthgr_golden.js`
- `tests/fixtures/converthgr/golden.json`
- `tests/converthgr_golden_reference.test.js`
- `tests/converthgr_wasm_abi.test.js`
- `tests/converthgr_wasm_preprocess.test.js`
- `tests/converthgr_wasm_parity.test.js`
- `tests/dithertizer_wasm_adapter.test.js`
- `tests/dithertizer_camera_pacing.test.js`
- `tests/dithertizer_wasm_integration.test.js`
- `.github/workflows/dithertizer-converthgr-wasm.yml`

---

### Task 1: Freeze deterministic ConvertHGR golden fixtures from the current browser reference

**Files:**
- Create: `tests/helpers/converthgr_fixture_cases.js`
- Create: `tools/generate_converthgr_golden.js`
- Create: `tests/fixtures/converthgr/golden.json`
- Create: `tests/converthgr_golden_reference.test.js`
- Read only: `tools/ConvertHGR.html`

**Interfaces:**
- Consumes: current `tools/ConvertHGR.html` worker code and its `convertHgrCore(...)` JavaScript reference path.
- Produces: deterministic fixture descriptors plus SHA-256 hashes for `processedRGB`, ABI-v1-derived `paletteRGB`, `paletteIndex`, `linearHGR`, and `hgrPage`.

- [ ] **Step 1: Write the failing reference-fixture test**

Add `tests/converthgr_golden_reference.test.js` that runs:

```text
node tools/generate_converthgr_golden.js --check
```

and expects exit code 0. Before the generator/manifest exist it must fail.

- [ ] **Step 2: Define deterministic source generators and the fixture matrix**

`tests/helpers/converthgr_fixture_cases.js` must generate RGB24 inputs algorithmically; do not add opaque image files.

Use fixed cases covering at minimum:

```text
black-default-280x192
white-default-280x192
color-bars-default-280x192
gradient-box-320x240
gradient-gaussian-320x240
gradient-hamming-320x240
gradient-blackman-320x240
gradient-bilinear-320x240
checker-greyscale-gamma075-319x201
gradient-histogram-gamma130-640x360
colorbars-perceptual-luma150-shift25-640x480
portrait-middle-nudged-240x480
gradient-diffusion-atkinson
gradient-diffusion-floyd
gradient-diffusion-pattern
gradient-diffusion-diag
gradient-diffusion-none
gradient-order1-offset0
gradient-order2-offset8
gradient-order3-offset16
gradient-order4-average-offset4
```

Use `0x12345678` as the default random seed and at least one case with `0xC0FFEE01` to prove seed serialization.

- [ ] **Step 3: Implement the test-only golden generator**

`tools/generate_converthgr_golden.js` must:

1. read `tools/ConvertHGR.html`;
2. extract the `worker-source` script text;
3. evaluate it in a Node `vm` sandbox with test-only worker stubs;
4. call the existing JavaScript `convertHgrCore({sourceRGB,sourceWidth,sourceHeight,settings,randomSeed})` directly;
5. treat the reference `paletteImage` byte array as ABI-v1 `paletteIndex`;
6. derive `paletteRGB` from that final index array through the frozen ABI-v1 eight-entry palette, rather than expecting the current reference to return `paletteRGB` directly;
7. ensure HGR-page holes are zero and SHA-256 the five ABI outputs;
8. support `--write` and `--check` modes.

The generator is test/reference tooling only. It must never be loaded by `index.html` or any production Dithertizer script.

- [ ] **Step 4: Generate and commit the manifest**

Run:

```bash
node tools/generate_converthgr_golden.js --write
node tools/generate_converthgr_golden.js --check
node --test tests/converthgr_golden_reference.test.js
```

Expected: all commands succeed and a second `--write` produces no diff.

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/converthgr_fixture_cases.js tools/generate_converthgr_golden.js tests/fixtures/converthgr/golden.json tests/converthgr_golden_reference.test.js
git commit -m "test: freeze ConvertHGR golden fixtures"
```

---

### Task 2: Establish the standalone WASM ABI and reproducible build

**Files:**
- Create: `wasm/convert_hgr/convert_hgr.h`
- Create: `wasm/convert_hgr/convert_hgr.c`
- Create: `tools/build_convert_hgr_wasm.sh`
- Create: `res/wasm/convert_hgr.wasm`
- Create: `tests/converthgr_wasm_abi.test.js`

**Interfaces:**
- Consumes: fixture dimensions/constants from Task 1 only for tests.
- Produces: stable ABI v1 and a checked-in `.wasm` artifact with no imports.

#### ABI v1

The normative source is `docs/superpowers/specs/2026-10-01-converthgr-wasm-abi-v1.md`. This copied excerpt must remain synchronized with that document.

Input format is packed RGB24.

```text
HGR_ABI_VERSION          = 1
HGR_WIDTH                = 280
HGR_HEIGHT               = 192
HGR_RGB_BYTES            = 161280
HGR_PALETTE_INDEX_BYTES  = 53760
HGR_LINEAR_BYTES         = 7680
HGR_PAGE_BYTES           = 8192
HGR_MAX_SOURCE_WIDTH     = 3840
HGR_MAX_SOURCE_HEIGHT    = 2160
HGR_SOURCE_CAPACITY      = 24883200 bytes
HGR_SETTINGS_V1_BYTES    = 120
HGR_WASM_MEMORY_BYTES    = 50331648 bytes (48 MiB)
HGR_APPLE_PIXEL_ASPECT   = 256.0 / 280.0 (fixed algorithm constant; not a settings field)
```

Required exports:

```c
uint32_t hgr_get_abi_version(void);          // 1
uint32_t hgr_get_settings_size(void);        // 120
uint32_t hgr_get_source_ptr(void);
uint32_t hgr_get_source_capacity(void);      // 24883200
uint32_t hgr_get_settings_ptr(void);
uint32_t hgr_get_processed_rgb_ptr(void);    // 161280 bytes
uint32_t hgr_get_palette_rgb_ptr(void);      // 161280 bytes
uint32_t hgr_get_palette_index_ptr(void);    // 53760 bytes
uint32_t hgr_get_linear_ptr(void);           // 7680 bytes
uint32_t hgr_get_page_ptr(void);             // 8192 bytes
int32_t  hgr_convert(uint32_t width, uint32_t height, uint32_t seed);
```

Status values:

```text
0 HGR_OK
1 HGR_ERR_DIMENSIONS
2 HGR_ERR_SOURCE_TOO_LARGE
3 HGR_ERR_SETTINGS
4 HGR_ERR_INTERNAL
```

The 120-byte settings block is fixed little-endian ABI v1:

```text
0x00 u32 abi_version (=1)
0x04 u32 flags: bit0 perceptual, bit1 greyscale, bit2 histogram, bit3 accumulate-errors
0x08 u32 dither_mode: 0 diffusion, 1 order1, 2 order2, 3 order3, 4 order4
0x0C u32 scaling_filter: 0 box, 1 gaussian, 2 hamming, 3 blackman, 4 bilinear
0x10 u32 fill_mode: 0 default, 1 top-left, 2 middle, 3 bottom-right
0x14 i32 horizontal_nudge
0x18 i32 vertical_nudge
0x1C u32 ordered_offset (0..16)
0x20 u32 error_A (0..16)
0x24 u32 error_B
0x28 u32 error_C
0x2C u32 error_D
0x30 u32 error_E
0x34 u32 error_F
0x38 f64 gamma
0x40 f64 luma_emphasis
0x48 f64 max_color_shift_percent
0x50 f64 perceptual_R
0x58 f64 perceptual_G
0x60 f64 perceptual_B
0x68 f64 reserved_f64_0 (= positive-zero IEEE-754 bit pattern; never read as pixel aspect)
0x70 u32 reserved0 (=0)
0x74 u32 reserved1 (=0)
```

The seven resolved ABI-v1 rules are normative:

1. **Fixed Apple pixel aspect.** Scaling/framing always uses `256.0/280.0`. The `0x68` field is reserved positive zero; a nonzero bit pattern is `HGR_ERR_SETTINGS`.
2. **Dither-mode parity.** `DIFFUSION` disables the ordered threshold. `ORDER1/ORDER2` use the 2x2 ordered matrix; `ORDER3/ORDER4` use the 4x4 matrix. WASM never alters serialized A-F based on mode. UI/card state applies the current reference rule: selecting ORDER2/ORDER4 sets `A=1 B=2 C=2 D=2 E=0 F=0`; ORDER1/ORDER3/DIFFUSION retain the currently effective A-F values.
3. **Palette output.** `paletteIndex` is the final byte-per-pixel reference `paletteImage` with values `0..7`. `paletteRGB` is derived exactly from that final array through the ABI-v1 palette `[black, green, magenta, white, black, orange, blue, white]` using the exact RGB values in the normative spec.
4. **48-MiB workspace/source ownership.** After `hgr_convert()` begins, the source-capacity region is consumable scratch and may be overwritten. The caller rewrites source RGB before every call. Private workspace may overlap source but not settings or output regions. Scaling must be bounded/crop-aware and may not require allocating a potentially huge conceptual `finalW*finalH*3` intermediate.
5. **Validation precedence.** Return the first applicable error in this order: zero dimension -> `HGR_ERR_DIMENSIONS`; source dimensions/capacity -> `HGR_ERR_SOURCE_TOO_LARGE`; settings -> `HGR_ERR_SETTINGS`; otherwise unclassified runtime failure -> `HGR_ERR_INTERNAL`.
6. **Deterministic RNG.** `state = seed`; each group advances once with `state = state*214013u + 2531011u` modulo `2^32`, returns `(state >> 16) & 0x7fff`, chooses `first_pattern = next() % 256`, then evaluates all 256 candidates sequentially modulo 256.
7. **Dithertizer luma.** After successful conversion, JavaScript derives luma from `paletteRGB` using exactly `trunc(0.299*R + 0.587*G + 0.114*B)`, yielding palette LUT `[0,156,145,255,0,145,156,255]`; this luma rule is integration state, not a WASM settings field.

- [ ] **Step 1: Write failing ABI tests**

`tests/converthgr_wasm_abi.test.js` must assert:

- artifact exists and instantiates;
- `WebAssembly.Module.imports(module)` is empty;
- required exports exist;
- ABI version is 1 and settings size is 120;
- memory is exactly 48 MiB and does not need growth for declared public buffers/workspace strategy;
- public pointer ranges fit memory and do not overlap;
- source capacity is exactly 24,883,200 bytes;
- source bytes may be overwritten by a successful or failed call and are never relied upon after `hgr_convert()` starts;
- `reserved_f64_0` accepts only the positive-zero bit pattern;
- `hgr_convert(0,192,seed)` and `hgr_convert(280,0,seed)` return `HGR_ERR_DIMENSIONS` even when settings are also invalid;
- oversized dimensions/capacity return `HGR_ERR_SOURCE_TOO_LARGE` before settings validation;
- wrong settings ABI version and all other settings validation failures return `HGR_ERR_SETTINGS` only after dimension/capacity checks;
- dither modes use the normative ordered-matrix semantics without mutating A-F;
- the exact RNG sequence/candidate starting order matches the browser reference;
- `paletteIndex` is `0..7`, `paletteRGB` expands it exactly, and HGR-page holes are zero.

- [ ] **Step 2: Implement the ABI skeleton and static buffers**

`convert_hgr.c` may initially fill all fixed outputs with black/zero for a valid call. Do not port image algorithms yet.

Use static/BSS public buffers so the 24.9 MB source region does not inflate the `.wasm` file. Layout the fixed public regions inside 48 MiB with source available as consumable scratch after call entry. Do not allocate a second maximum-size source image.

- [ ] **Step 3: Add the WASI SDK 34 build script**

`tools/build_convert_hgr_wasm.sh [output]` must require `WASI_SDK_PATH` and compile C11 using the pinned SDK toolchain, `-O3`, `-lm`, no entry point, exported memory, the explicit ABI exports above, and fixed 48 MiB initial/max memory. Do not enable unsafe floating-point reassociation/`-ffast-math` because golden parity depends on browser-reference rounding points.

Default output: `res/wasm/convert_hgr.wasm`.

- [ ] **Step 4: Build and run ABI tests**

```bash
WASI_SDK_PATH=/path/to/wasi-sdk-34.0 tools/build_convert_hgr_wasm.sh
node --test tests/converthgr_wasm_abi.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add wasm/convert_hgr tools/build_convert_hgr_wasm.sh res/wasm/convert_hgr.wasm tests/converthgr_wasm_abi.test.js
git commit -m "feat: establish ConvertHGR WASM ABI"
```

---

### Task 3: Port the complete preprocessing pipeline into WASM

**Files:**
- Create: `wasm/convert_hgr/hgr_preprocess.h`
- Create: `wasm/convert_hgr/hgr_preprocess.c`
- Modify: `wasm/convert_hgr/convert_hgr.c`
- Create: `tests/converthgr_wasm_preprocess.test.js`
- Regenerate: `res/wasm/convert_hgr.wasm`

**Interfaces:**
- Consumes: ABI v1 from Task 2; golden `processedRGB` hashes from Task 1.
- Produces: byte-compatible `processedRGB` for the frozen browser reference fixtures.

- [ ] **Step 1: Write failing preprocessing parity tests**

Compare `processedRGB` SHA-256 against Task 1 goldens for all fixture cases that exercise:

- greyscale on/off;
- every scaling filter;
- default/middle fill and nudges;
- histogram stretch on/off;
- gamma 0.75, 1.00, 1.30 and at least one >1.30 value;
- non-280x192 dimensions;
- at least one extreme-aspect valid source proving bounded/crop-aware scaling fits the fixed 48-MiB workspace.

- [ ] **Step 2: Port preprocessing in the same operation order as `prepareSourceRGB()`**

Port behavior from `tools/ConvertHGR.html` in this order:

```text
1. greyscale source in-place when enabled
2. scaleAndFrame to 280x192 using the fixed 256/280 pixel-aspect constant
3. applyHistogramApprox when enabled
4. applyGamma
5. applyMaxColorShift
```

The ABI settings field at `0x68` is reserved positive zero and must never control scaling. Implement scaling/framing in a bounded/crop-aware way that is behaviorally equivalent to the conceptual reference intermediate but does not allocate the entire conceptual `finalW*finalH` RGB image.

Preserve reference numeric behavior: JavaScript `Number`/double where used, the reference `Math.fround()` points in resampling, and the same clamp/round/truncation boundaries. Implement all five filters: box, gaussian, hamming, blackman, bilinear.

Do not move histogram/gamma/max-color-shift before scaling merely for convenience; fixture parity owns the order.

- [ ] **Step 3: Rebuild and run preprocessing parity**

```bash
WASI_SDK_PATH=/path/to/wasi-sdk-34.0 tools/build_convert_hgr_wasm.sh
node --test tests/converthgr_wasm_abi.test.js tests/converthgr_wasm_preprocess.test.js
```

Expected: all `processedRGB` hashes match.

- [ ] **Step 4: Commit**

```bash
git add wasm/convert_hgr/hgr_preprocess.* wasm/convert_hgr/convert_hgr.c res/wasm/convert_hgr.wasm tests/converthgr_wasm_preprocess.test.js
git commit -m "feat: port ConvertHGR preprocessing to WASM"
```

---

### Task 4: Port colour matching, dithering, quantization, palette rendering, and HGR packing

**Files:**
- Create: `wasm/convert_hgr/hgr_quantize.h`
- Create: `wasm/convert_hgr/hgr_quantize.c`
- Modify: `wasm/convert_hgr/convert_hgr.c`
- Create: `tests/converthgr_wasm_parity.test.js`
- Regenerate: `res/wasm/convert_hgr.wasm`

**Interfaces:**
- Consumes: Task 3 `processedRGB`, ABI settings, full Task 1 golden hashes.
- Produces: final `paletteIndex`, its exact `paletteRGB` expansion, `linearHGR`, and zero-filled/interleaved `hgrPage` parity outputs.

- [ ] **Step 1: Write the failing full-output parity test**

For every Task 1 case, hash and compare all five outputs. Also assert same input/settings/seed twice yields byte-identical output, `paletteIndex` contains only `0..7`, `paletteRGB` is an exact expansion of final `paletteIndex`, and unused HGR page bytes are zero.

- [ ] **Step 2: Port the colour metric and palette-phase logic**

Preserve current browser-port semantics for:

- perceptual vs non-perceptual RGB;
- luma emphasis;
- max colour shift;
- default perceptual weights `0.30 / 0.52 / 0.18`;
- exact ABI-v1 palette values and Apple II phase/candidate behavior.

- [ ] **Step 3: Port dithering and seven-pixel quantization**

Preset coefficients exposed by the Dithertizer UI map exactly to:

```text
Atkinson    A1 B2 C2 D2 E1 F1
Floyd-Stein A3 B5 C1 D7 E0 F0
Pattern     A0 B8 C0 D8 E0 F0
Diag        A1 B3 C2 D3 E1 F1
None        A0 B0 C0 D0 E0 F0
```

Preserve ABI-v1 mode semantics exactly:

```text
DIFFUSION  ordered threshold disabled
ORDER1     ordered enabled, 2x2 matrix
ORDER2     ordered enabled, 2x2 matrix
ORDER3     ordered enabled, 4x4 matrix
ORDER4     ordered enabled, 4x4 matrix
```

WASM must never zero or replace `error_A..error_F` based on mode. The Dithertizer UI/card layer owns the browser-reference mode-driven coefficient state change: selecting ORDER2/ORDER4 sets `{1,2,2,2,0,0}`; ORDER1/ORDER3/DIFFUSION retain the currently effective coefficients.

Port ordered offset `0..16`, accumulate vs average incoming error, and the exact ABI-v1 RNG/tie-breaking behavior:

```text
state = seed
state = state*214013 + 2531011 (uint32 wrap)
next = (state >> 16) & 0x7fff
first_pattern = next % 256
then evaluate first_pattern..first_pattern+255 modulo 256
one RNG advance per 7-pixel group
```

- [ ] **Step 4: Produce palette and HGR outputs exactly**

Treat the final reference `paletteImage` result as ABI-v1 `paletteIndex`. Expand every final index through the frozen ABI-v1 palette into `paletteRGB`; do not render from a pre-adjustment/transient palette state.

Produce exactly:

- 7680-byte linear HGR stream;
- 8192-byte Apple II HGR page with the existing interleave mapping and every unused/interleave-hole byte zero.

- [ ] **Step 5: Rebuild and run full parity**

```bash
WASI_SDK_PATH=/path/to/wasi-sdk-34.0 tools/build_convert_hgr_wasm.sh
node --test tests/converthgr_wasm_abi.test.js tests/converthgr_wasm_preprocess.test.js tests/converthgr_wasm_parity.test.js
```

Expected: every frozen SHA-256 matches.

- [ ] **Step 6: Commit**

```bash
git add wasm/convert_hgr/hgr_quantize.* wasm/convert_hgr/convert_hgr.c res/wasm/convert_hgr.wasm tests/converthgr_wasm_parity.test.js
git commit -m "feat: port ConvertHGR quantizer to WASM"
```

---

### Task 5: Add the Worker-backed JavaScript WASM adapter with no fallback

**Files:**
- Create: `res/EMU_DITHERTIZER_converthgr.js`
- Create: `res/EMU_DITHERTIZER_converthgr_worker.js`
- Create: `tests/dithertizer_wasm_adapter.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: ABI v1 from Tasks 2-4.
- Produces:

```js
const adapter = new DithertizerConvertHGRAdapter(options);
await adapter.init();
adapter.configure(settings);
const result = await adapter.convert(rgb,width,height,seed);
adapter.close();
```

`result` contains copied `Uint8Array` values:

```text
processedRGB 161280
paletteRGB   161280
paletteIndex  53760
linearHGR      7680
hgrPage         8192
```

- [ ] **Step 1: Write failing adapter tests using an injected fake Worker**

Cover:

- concurrent/repeated `init()` uses one worker/one initialization promise;
- settings serialization uses ABI v1 offsets/types exactly, including `reserved_f64_0 = +0.0` at `0x68`;
- RGB source bytes are transported unchanged before conversion and the caller never expects WASM source memory to survive a call;
- result lengths are exact;
- conversion status != 0 rejects with a diagnostic error and no output is published;
- worker/WASM init failure rejects and never calls a JS converter;
- adapter recreates memory views from the current `memory.buffer` before copies;
- `close()` rejects pending conversions and terminates the worker;
- exactly one conversion may be in flight and there is no queue.

- [ ] **Step 2: Implement `DithertizerConvertHGRAdapter` main-thread adapter**

Use an injectable Worker constructor/factory for tests and the real `Worker` by default. Resolve worker/WASM URLs from the page/base URL before sending them to the worker.

Do not embed any ConvertHGR preprocessing/quantization functions in this file. The adapter accepts normalized effective A-F values; preset-name and mode-driven A-F resolution belong to the Dithertizer UI/card layer.

- [ ] **Step 3: Implement the Worker-side WASM loader**

Message protocol follows the normative ABI spec:

```text
{type:'init', wasmURL, abiVersion:1}
{type:'convert', requestId, width, height, seed, settings, rgbBuffer}

-> {type:'ready', abiVersion:1, settingsSize:120, sourceCapacity:24883200}
-> {type:'result', requestId, width:280, height:192,
    processedRGBBuffer, paletteRGBBuffer, paletteIndexBuffer, linearHGRBuffer, hgrPageBuffer}
-> {type:'error', phase, requestId?, status?, code?, message}
```

Worker rules:

- instantiate with an empty import object;
- validate ABI version/settings size/memory size/public pointer ranges before accepting conversions;
- write settings with `DataView` little-endian and write positive-zero at reserved offset `0x68`;
- copy RGB24 directly into `hgr_get_source_ptr()` for every conversion;
- call `hgr_convert()` and never depend on source contents afterwards;
- copy completed outputs into fresh transferable ArrayBuffers only after `HGR_OK`;
- never receive any Apple II RAM object/buffer/pointer.

- [ ] **Step 4: Load scripts in dependency order**

In `index.html`, immediately before `EMU_CARD_dithertizer.js`:

```text
res/EMU_DITHERTIZER_converthgr.js
res/EMU_DITHERTIZER_camera.js   (added in Task 6; until then include only the adapter)
res/EMU_CARD_dithertizer.js
```

Do not load the Worker file as a page script.

- [ ] **Step 5: Verify**

```bash
node --check res/EMU_DITHERTIZER_converthgr.js
node --check res/EMU_DITHERTIZER_converthgr_worker.js
node --test tests/dithertizer_wasm_adapter.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add res/EMU_DITHERTIZER_converthgr.js res/EMU_DITHERTIZER_converthgr_worker.js index.html tests/dithertizer_wasm_adapter.test.js
git commit -m "feat: add Dithertizer ConvertHGR WASM adapter"
```

---

### Task 6: Add the paced host-camera pipeline and one-in-flight scheduler

**Files:**
- Create: `res/EMU_DITHERTIZER_camera.js`
- Create: `tests/dithertizer_camera_pacing.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `DithertizerConvertHGRAdapter` from Task 5.
- Produces:

```js
const camera = new DithertizerCameraPipeline(options);
await camera.start();
camera.stop();
camera.setRateMs(ms);             // 100..1000
camera.setSettings(settings);
camera.getLumaFrame(280,192);     // stable completed Uint8Array
camera.isActive();
camera.getLastError();
```

- [ ] **Step 1: Write deterministic scheduler/camera tests with injected dependencies**

Inject `mediaDevices`, `document`, `setTimeout`, `clearTimeout`, `now`, `seedSource`, and adapter.

Cover:

- default 250 ms;
- clamp 100..1000 ms;
- first frame starts immediately once video is ready;
- next frame start period is approximately `max(rateMs, previous conversion duration)`;
- while one conversion is unresolved, no second canvas read/capture occurs;
- no source frame is queued/replaced while busy;
- RATE change while waiting reschedules once;
- RATE change while converting affects the next schedule without cancelling the conversion;
- conversion failure preserves the previous completed frame;
- oversized source failure preserves the previous completed frame;
- before first success, `getLumaFrame()` returns black;
- camera OFF clears frame to black and cancels future timers;
- camera OFF/reset epoch prevents an already in-flight worker result from republishing afterward;
- palette-index/RGB luma fixtures produce the ABI-v1 luma LUT `[0,156,145,255,0,145,156,255]`.

- [ ] **Step 2: Implement browser camera transport**

On `start()`:

- call `getUserMedia({video:true,audio:false})`;
- create/own an off-DOM `<video autoplay playsinline muted>` and `<canvas>`;
- wait until video dimensions are valid;
- initialize adapter;
- begin scheduling.

Frame capture may only perform:

```text
video -> canvas.drawImage -> ImageData RGBA -> packed RGB24
```

No resizing, gamma, histogram, greyscale, colour matching, dithering, or quantization in JavaScript.

- [ ] **Step 3: Implement atomic ABI-v1 luma publication**

After a successful worker result, convert `paletteRGB` to a newly allocated 280x192 luma buffer using exactly:

```text
Y = trunc(0.299 * R + 0.587 * G + 0.114 * B)
```

Use JavaScript/IEEE-754 double arithmetic with truncation toward zero. For the frozen ABI-v1 palette this must produce exactly:

```text
index: 0   1   2   3   4   5   6   7
luma:  0 156 145 255   0 145 156 255
```

A lookup table is permitted only if it produces those exact bytes. Do not use the previous integer approximation `(77R+150G+29B+128)>>8`.

Replace the public luma-buffer reference only after the whole new buffer is complete and only if the camera epoch still matches. This luma adapter is Dithertizer integration code, not a ConvertHGR fallback.

- [ ] **Step 4: Add the camera pipeline page script**

Load `res/EMU_DITHERTIZER_camera.js` after `EMU_DITHERTIZER_converthgr.js` and before `EMU_CARD_dithertizer.js`.

- [ ] **Step 5: Verify**

```bash
node --check res/EMU_DITHERTIZER_camera.js
node --test tests/dithertizer_camera_pacing.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add res/EMU_DITHERTIZER_camera.js index.html tests/dithertizer_camera_pacing.test.js
git commit -m "feat: add paced Dithertizer camera pipeline"
```

---

### Task 7: Wire RATE/settings/camera pipeline into `DithertizerII` without changing DSCAN semantics

**Files:**
- Modify: `res/EMU_CARD_dithertizer.js`
- Modify: `tests/dithertizer_controls_ui.test.js`
- Modify: `tests/dithertizer_camera_toggle.test.js`
- Create: `tests/dithertizer_wasm_integration.test.js`
- Re-run unchanged: `tests/dithertizer_foundation.test.js`, `tests/dithertizer_detector.test.js`

**Interfaces:**
- Consumes: `DithertizerCameraPipeline` from Task 6.
- Produces: UI-driven settings and live processed source visible to existing `startCapture()`/DSCAN flow.

- [ ] **Step 1: Write failing RATE UI regressions**

Third row must contain:

```text
RATE [range 100..1000 step 50 value 250] 0.25s [camera] OFF
```

`deviceToolSetting(controlID,'rate',value)` must clamp/store milliseconds and update the readout as `0.10s`..`1.00s`.

Changing RATE must not mutate `card.state.threshold`, `captureEnabled`, or `page2`.

- [ ] **Step 2: Define one settings mapping from the existing UI state**

Add a single internal `buildConvertHGRSettings()` used for every scheduled frame.

Map:

```text
mode -> diffusion/order1/order2/order3/order4
preset -> effective A/B/C/D/E/F table
mode transition ORDER2/ORDER4 -> force effective A/B/C/D/E/F to 1/2/2/2/0/0
mode transition ORDER1/ORDER3/DIFFUSION -> retain current effective A/B/C/D/E/F
error accumulate/average -> accumulateErrors boolean / ABI flag bit3
ordered offset -> 0..16
perceptual -> ABI flag bit0
luma % -> value/100
max colour shift % -> same percent semantics as frozen ConvertHGR settings
greyscale -> ABI flag bit1
histogram -> ABI flag bit2
gamma % -> value/100
filter -> box/gaussian/hamming/blackman/bilinear
fillMode -> default
horizontalNudge -> 0
verticalNudge -> 0
perceptual weights -> 0.30,0.52,0.18
```

Do **not** serialize Apple pixel aspect. ABI v1 fixes it internally to `256/280`; the worker serializer writes `reserved_f64_0 = +0.0` at offset `0x68` plus zero `reserved0/reserved1`.

Changing controls while live updates the camera pipeline settings for the next conversion only.

- [ ] **Step 3: Replace the current stream-only camera toggle with lazy pipeline ownership**

`deviceToolCameraToggle()` must delegate host camera start/stop to one `DithertizerCameraPipeline` instance.

Keep the existing ON/OFF indicator semantics based on host-camera activity, not conversion success.

On reset/restart, stop/dispose camera scheduling/stream and clear the processed frame to black.

- [ ] **Step 4: Preserve explicit `setCameraSource()` compatibility**

Do not remove the existing test/external camera source abstraction.

`sourceFrame()` priority:

```text
1. explicit source supplied through setCameraSource(source)
2. active host-camera pipeline completed luma frame
3. black frame
```

This keeps foundation tests and future synthetic sources independent from browser camera state.

- [ ] **Step 5: Write the end-to-end DSCAN integration test**

Use a deterministic real WASM conversion fixture and fake hardware.

Assert the path:

```text
source RGB
-> worker/WASM conversion
-> final paletteIndex
-> exact ABI-v1 paletteRGB expansion
-> exact ABI-v1 completed luma
-> Dithertizer threshold
-> $C0n8 startCapture()
-> selected PAGE1/PAGE2 HGR writes
```

Also assert:

- no WASM API receives the fake Apple II RAM/hardware object;
- a PAGE1 capture still writes the same HGR address pattern as existing foundation tests;
- PAGE2 still selects `$4000` base through current video state;
- `$C0n0` write/read still disables capture as before;
- D7 sync/detector behavior is unchanged;
- a frame publication between two DSCAN captures changes only the next capture, never the capture already in progress;
- the luma bytes for palette indices `0..7` equal `[0,156,145,255,0,145,156,255]`.

- [ ] **Step 6: Run all Dithertizer regressions**

```bash
node --check res/EMU_CARD_dithertizer.js
node --test \
  tests/dithertizer_foundation.test.js \
  tests/dithertizer_detector.test.js \
  tests/dithertizer_controls_ui.test.js \
  tests/dithertizer_camera_toggle.test.js \
  tests/dithertizer_camera_pacing.test.js \
  tests/dithertizer_wasm_adapter.test.js \
  tests/dithertizer_wasm_integration.test.js
```

Expected: PASS with no hardware-contract regression.

- [ ] **Step 7: Commit**

```bash
git add res/EMU_CARD_dithertizer.js tests/dithertizer_controls_ui.test.js tests/dithertizer_camera_toggle.test.js tests/dithertizer_wasm_integration.test.js
git commit -m "feat: wire ConvertHGR WASM into Dithertizer capture"
```

---

### Task 8: Pin WASI build reproducibility in CI and run the whole parity suite

**Files:**
- Create: `.github/workflows/dithertizer-converthgr-wasm.yml`
- Modify if needed: `tools/build_convert_hgr_wasm.sh`
- Modify if needed: `README`/developer docs only to document WASI SDK requirement; do not migrate `tools/ConvertHGR.html`.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: CI evidence that source rebuilds the committed artifact and every fixture/integration regression passes.

- [ ] **Step 1: Add a pinned WASI SDK 34 CI job**

Use `wasi-sdk-34.0-x86_64-linux.tar.gz` and verify SHA-256:

```text
b761e3a0721dbae9c09a0059e5fdb2bf917d1b4a8a7b430fb3b5aafb0984b2c4
```

The workflow must rebuild `res/wasm/convert_hgr.wasm` from source and fail if `git diff --exit-code -- res/wasm/convert_hgr.wasm` reports a change.

- [ ] **Step 2: Run the complete converter + Dithertizer test set in CI**

```bash
node --test \
  tests/converthgr_golden_reference.test.js \
  tests/converthgr_wasm_abi.test.js \
  tests/converthgr_wasm_preprocess.test.js \
  tests/converthgr_wasm_parity.test.js \
  tests/dithertizer_wasm_adapter.test.js \
  tests/dithertizer_camera_pacing.test.js \
  tests/dithertizer_wasm_integration.test.js \
  tests/dithertizer_foundation.test.js \
  tests/dithertizer_detector.test.js \
  tests/dithertizer_controls_ui.test.js \
  tests/dithertizer_camera_toggle.test.js
```

Expected: zero failures.

- [ ] **Step 3: Browser smoke test**

In the emulator:

1. mount DITHER in slot 7;
2. open peripheral controls;
3. confirm RATE defaults to `0.25s`;
4. click camera and grant permission;
5. confirm status `ON`;
6. confirm conversion activity follows RATE and UI remains responsive;
7. change each DTH/COL/IMG control and confirm the next processed frame changes without reloading;
8. run DSCAN 4.2 DITHER and CONTOUR against the live source;
9. verify PAGE1/PAGE2 output updates only through DSCAN captures;
10. turn camera OFF and confirm the next DSCAN capture sees black;
11. deny camera permission once and confirm no JS conversion fallback appears.

- [ ] **Step 4: Final verification**

Run the build script and the full Node command above from a clean checkout. Inspect `git diff --stat` to confirm no accidental `tools/ConvertHGR.html` migration or direct Apple II RAM dependency entered the WASM adapter.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/dithertizer-converthgr-wasm.yml tools/build_convert_hgr_wasm.sh
git commit -m "ci: verify Dithertizer ConvertHGR WASM"
```

---

## Execution Order and Review Gates

Implement strictly in this order:

```text
1 goldens
2 ABI/build
3 preprocessing
4 quantizer/packing
5 Worker adapter
6 camera scheduler
7 DSCAN/UI integration
8 CI/browser verification
```

Recommended review gates:

- **After Task 1:** verify goldens really come from the current JavaScript reference, with `paletteRGB` derived from final `paletteIndex`, and are deterministic.
- **After Task 2:** verify ABI conformance includes the fixed aspect/reserved field, source-workspace rule, validation precedence, and no public-region overlap.
- **After Task 4:** require 100% frozen fixture parity, exact dither/RNG semantics, palette expansion, and HGR zero-hole behavior before any browser/Dithertizer wiring begins.
- **After Task 6:** review one-in-flight/no-queue semantics, exact ABI-v1 luma conversion, and OFF/in-flight epoch handling independently from DSCAN.
- **After Task 7:** review the Dithertizer hardware contract separately from image-quality concerns.
- **After Task 8:** whole-branch review and browser smoke test before merge.

## Explicit Non-Goals for This Plan

- Do not migrate `tools/ConvertHGR.html` to the shared WASM module yet; keep it as the frozen reference/golden source for this milestone.
- Do not make WASM write Apple II RAM or expose hardware objects to the Worker.
- Do not change DSCAN 4.2 software, `$C0n0/$C0n8` meanings, D7 sync, HGR address mapping, or page selection.
- Do not add a JavaScript image-processing fallback.
- Do not queue camera frames or keep a pending/latest raw camera frame while WASM is busy.
- Do not reintroduce configurable Apple pixel aspect into ABI v1.
- Do not add controls beyond the approved DTH/COL/IMG controls plus RATE.
