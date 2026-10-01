# Dithertizer Full-Pipeline ConvertHGR WASM Design

## Purpose

Integrate the existing ConvertHGR image-conversion behavior into the RetroAppleJS Dithertizer II peripheral as a shared standalone WebAssembly module, while preserving the Dithertizer hardware/software contract already implemented for DSCAN 4.2.

The browser host camera becomes a virtual video source. Each sampled camera frame is passed through the complete ConvertHGR image-processing pipeline in WASM. The processed 280x192 result is then exposed to the Dithertizer as its camera signal. The Dithertizer threshold comparator, page selection, `$C0n0` / `$C0n8` semantics, and Apple II HGR writes remain owned by the Dithertizer peripheral and DSCAN flow.

The WASM module must not write Apple II RAM directly.

## Design goals

1. Move the complete ConvertHGR algorithm used by the Dithertizer path into a maintainable standalone WASM module.
2. Use no JavaScript implementation or fallback for ConvertHGR image processing.
3. Keep JavaScript limited to browser integration, UI plumbing, WASM loading/copying, scheduling, and Dithertizer integration.
4. Preserve the existing Dithertizer II emulation contract and DSCAN behavior.
5. Wire the current Dithertizer DTH/COL/IMG controls into WASM settings.
6. Add a camera conversion interval control from 0.10 s through 1.00 s.
7. Run at most one conversion at a time, with no latest-frame cache and no queued frame backlog.
8. Keep the full 8 KB ConvertHGR HGR result available for parity tests and diagnostics, but do not use it to write Apple II RAM in the Dithertizer path.
9. Fail closed when WASM cannot load or execute rather than silently using JavaScript conversion code.
10. Preserve deterministic testability with fixed source fixtures and random seeds.

## Existing state and motivation

`tools/ConvertHGR.html` currently contains two distinct layers:

- JavaScript preprocessing: greyscale, scaling/resampling, framing, histogram stretch, gamma and browser-source preparation.
- an embedded WASM quantizer/packer that accepts an already prepared 280x192 RGB buffer and produces palette/linear/HGR outputs.

The current WASM interface therefore does not represent the full conversion pipeline. The Dithertizer integration must not reuse that split if the new requirement is WASM-only conversion.

The repository does not currently expose a maintainable source file for the embedded ConvertHGR WASM blob. The new design therefore introduces source-controlled WASM source plus a reproducible build step.

## Separation of responsibilities

### Browser JavaScript

JavaScript remains responsible for browser-only operations that WASM cannot own directly:

- `navigator.mediaDevices.getUserMedia({video:true,audio:false})`
- host-camera start/stop and track cleanup
- hidden `<video>` element ownership
- drawing the current camera frame to a canvas
- reading browser `ImageData`
- copying source pixels into WASM memory
- copying WASM outputs into typed arrays
- scheduling the paced conversion loop
- translating UI control values into the WASM settings structure
- reporting WASM load/conversion failure in the peripheral UI
- exposing the current processed 280x192 luma frame to `DithertizerII`

JavaScript must not contain a second implementation of ConvertHGR preprocessing, dithering, colour matching, scaling, or HGR quantization for this path.

### ConvertHGR WASM

The standalone WASM module owns the complete image algorithm:

- source RGB input at arbitrary camera dimensions within configured limits
- greyscale conversion
- image framing/aspect handling
- scaling and the selected scaling filter
- histogram stretch
- gamma adjustment
- perceptual/non-perceptual colour matching
- luma emphasis
- maximum colour shift
- ordered modes
- error diffusion and incoming-error mode
- ConvertHGR seven-pixel quantization
- Apple II palette rendering
- linear 280x192 HGR bytes
- Apple II 8 KB HGR interleave/packing
- processed/palette-rendered 280x192 RGB output

The 280x192 RGB output is the image passed onward to the virtual Dithertizer camera signal.

### Dithertizer II peripheral

`DithertizerII` remains responsible for:

- `$C0n0` threshold latch and capture-disable behavior
- `$C0n0.D7` sync behavior
- `$C0n8` capture trigger
- current HGR page selection through Apple II video state
- threshold comparison against the current virtual camera luma frame
- HGR page memory writes through the normal emulator hardware path
- camera control UI ownership

It does not consume the WASM-produced 8 KB HGR page as its final capture output.

## Data flow

```text
Host camera
    |
    | getUserMedia + browser video frame
    v
Browser canvas/ImageData
    |
    | RGB/RGBA source copied into WASM memory
    v
Full ConvertHGR WASM pipeline
    |
    +--> processed 280x192 RGB
    |
    +--> palette-rendered 280x192 RGB
    |
    +--> linear HGR bytes
    |
    +--> packed 8 KB HGR page
    v
palette-rendered RGB -> luma adapter
    |
    v
Dithertizer virtual camera frame
    |
    | threshold comparator controlled by DSCAN
    v
Apple II PAGE1/PAGE2 HGR memory
```

For the Dithertizer input, the palette-rendered RGB result is converted to 280x192 luma bytes after each successful WASM conversion. This deliberately preserves the previously selected behavior in which emulator-side ConvertHGR dithering/preparation precedes the historical Dithertizer threshold capture.

## WASM source and build artifacts

Add a maintainable source tree:

```text
wasm/convert_hgr/
    convert_hgr.c
    convert_hgr.h

tools/build_convert_hgr_wasm.sh

res/wasm/convert_hgr.wasm
```

A small JavaScript adapter owns instantiation and buffer access:

```text
res/EMU_DITHERTIZER_converthgr.js
```

The built `.wasm` file is checked into the repository so normal browser use does not require a compiler toolchain.

The build script must reproduce that artifact from the source-controlled C implementation. Generated output should be deterministic enough that CI can rebuild and compare or at minimum execute the same fixture suite against a freshly rebuilt module.

The implementation plan may adjust filenames if the repository's existing WASM conventions suggest a better naming scheme, but the architectural split must remain.

## WASM API

The exact ABI may be refined during implementation, but the module should expose a compact pointer-based API equivalent to:

```c
uint32_t hgr_get_source_ptr(void);
uint32_t hgr_get_settings_ptr(void);
uint32_t hgr_get_processed_rgb_ptr(void);
uint32_t hgr_get_palette_rgb_ptr(void);
uint32_t hgr_get_palette_index_ptr(void);
uint32_t hgr_get_linear_ptr(void);
uint32_t hgr_get_page_ptr(void);
uint32_t hgr_get_source_capacity(void);
int32_t  hgr_convert(uint32_t src_width,
                     uint32_t src_height,
                     uint32_t random_seed);
```

`hgr_convert()` returns zero on success and a stable non-zero status for invalid dimensions, insufficient source capacity, invalid settings, or internal conversion failure.

The module must not import or receive any pointer/reference to Apple II RAM.

## Settings structure

The WASM settings structure must include all Dithertizer UI values currently exposed.

### Dithering

- mode: `diffusion`, `order1`, `order2`, `order3`, `order4`
- preset-derived A/B/C/D/E/F diffusion coefficients
- incoming error: accumulate / average
- ordered offset: 0..16

The presets must preserve the same coefficient semantics as the existing ConvertHGR implementation:

- Atkinson
- Floyd-Stein
- Pattern
- Diag
- None

### Colour matching

- perceptual RGB: boolean
- luma emphasis: UI percent converted to normalized WASM value
- maximum colour shift: UI percent converted to algorithm value
- default RGB perceptual weights remain the current ConvertHGR defaults unless/until they receive dedicated Dithertizer controls

### Image preparation

- greyscale: boolean
- stretch histogram: boolean
- gamma: UI percent converted to normalized gamma value
- scaling filter: box / gaussian / hamming / blackman / bilinear

The Dithertizer UI currently does not expose ConvertHGR fill mode, nudges, or editable RGB weights. Their WASM settings use the current ConvertHGR defaults for this integration.

## Camera interval control

Add one compact slider to the third `IMG` row beside the existing camera controls.

Recommended UI form:

```text
IMG ... FILTER [Bilinear] RATE [----o----] 0.25s [camera] ON
```

Canonical state is milliseconds:

```text
min:     100 ms
max:    1000 ms
step:     50 ms
default: 250 ms
```

The rendered readout is seconds with sensible compact formatting, for example:

```text
0.10s
0.25s
0.50s
1.00s
```

The slider controls only camera-frame sampling/conversion cadence. It does not alter Apple II video timing, Dithertizer D7 synchronization, CPU speed, or DSCAN timing.

## Paced conversion loop

There is no latest-frame cache and no frame queue.

The camera loop uses a one-in-flight model:

1. camera must be ON
2. wait until the selected interval permits another sample
3. if a conversion is already in progress, do not capture or queue a replacement frame
4. when idle, sample the camera at that moment
5. run exactly one WASM conversion
6. on success, atomically replace the currently exposed 280x192 processed/luma frame
7. schedule the next eligible sample according to the interval

If WASM conversion itself takes longer than the selected interval, effective frame rate becomes conversion-limited. No backlog accumulates.

The intended effective period is therefore approximately:

```text
max(selected interval, actual conversion duration)
```

Changing the interval affects the next scheduling decision and must not cancel or duplicate an in-flight conversion.

## Frame ownership and atomicity

The Dithertizer must never read a partially converted frame.

Maintain two conceptual states:

- WASM working/output memory for the conversion in progress
- a completed 280x192 luma buffer exposed to the Dithertizer

Only after `hgr_convert()` returns success is the completed luma buffer replaced.

This is not a latest-frame cache. It is the single currently valid virtual-camera image required for the Dithertizer to return stable pixels between host-camera sampling events.

Before the first successful conversion, the Dithertizer may continue using an all-black source frame, matching current no-source behavior.

## Camera start/stop behavior

Camera ON:

1. request `getUserMedia({video:true,audio:false})`
2. attach stream to the hidden browser video element
3. initialize/load the WASM adapter if needed
4. begin paced sampling after the video is ready
5. update ON/OFF status independently of conversion success

Camera OFF:

1. stop scheduling new samples
2. let no new conversion begin
3. stop every media stream track
4. clear the video source
5. preserve or clear the last completed processed frame according to one explicit rule

For predictability, this design chooses to clear the virtual camera frame to black when the camera is turned OFF or the card is reset/restarted. This avoids presenting a stale frozen camera image as though a live camera were still connected.

## Control changes while live

Changing DTH/COL/IMG algorithm controls updates the settings used by the next conversion.

It does not interrupt a conversion already running. A conversion that began with settings revision N completes with revision N. The following scheduled frame uses the newest settings revision.

No intermediate camera frame or settings revision is queued.

## Failure behavior

### WASM load failure

If `WebAssembly.instantiate` or module loading fails:

- keep camera stream ownership independent
- do not run a JavaScript ConvertHGR fallback
- mark conversion state as unavailable/error
- do not replace the last completed luma frame with partial output
- keep the peripheral and Apple II emulator running

The UI should expose a concise conversion-error indication through title/status behavior without expanding the three-row panel substantially.

### Conversion failure

If `hgr_convert()` returns a non-zero status:

- keep the previous completed luma frame unchanged
- do not queue retries faster than the selected camera interval
- report the failure for diagnostics

### Camera failure

The existing camera behavior remains:

- unavailable `getUserMedia` -> OFF
- denied/rejected permission -> OFF
- stop all acquired tracks on cleanup

## JavaScript adapter contract

`EMU_DITHERTIZER_converthgr.js` should expose an interface conceptually similar to:

```js
await adapter.init();
adapter.configure(settings);
const result = adapter.convert(rgb, width, height, seed);
```

where `result` exposes typed-array views or copies for:

```text
processedRGB
paletteRGB
paletteIndex
linearHGR
hgrPage
```

The Dithertizer integration uses `paletteRGB` to generate its virtual-camera luma frame.

The adapter must not expose a JavaScript fallback converter.

## Source capture

The browser source bridge may continue using a hidden canvas because the browser camera/video APIs deliver pixels through DOM/browser surfaces rather than directly through WASM.

The bridge may perform format transfer only:

```text
video -> canvas -> ImageData RGBA -> packed RGB buffer
```

This RGB packing loop is transport/glue, not image processing. It must not apply scaling, gamma, greyscale, histogram, dithering, colour matching, or filtering.

## ConvertHGR parity and migration

The new full-pipeline WASM implementation should be derived behaviorally from the existing `tools/ConvertHGR.html` algorithms and defaults.

The implementation must preserve, as far as the current browser port defines them:

- five scaling filters
- greyscale behavior
- histogram approximation currently used by the browser port
- gamma semantics
- perceptual/non-perceptual colour metrics
- luma emphasis
- maximum colour shift
- ordered matrices/modes
- diffusion coefficient semantics
- incoming-error accumulation/average behavior
- seven-pixel candidate quantizer
- palette phase behavior
- linear HGR packing
- 8 KB Apple II page interleave

This phase does not claim stronger parity with the original desktop ConvertHGR than the current browser port can support. Existing browser-port approximations, especially histogram behavior, remain approximations unless separately calibrated.

## Shared-module requirement

The WASM implementation is shared infrastructure, not card-private opaque data.

`tools/ConvertHGR.html` should eventually be able to consume the same module instead of its embedded quantizer-only base64 WASM and JS preprocessing pipeline.

The first implementation milestone may wire the shared module into the Dithertizer before migrating the standalone tool, but the module API and build artifact must be designed for both consumers from the outset.

No Dithertizer-specific Apple II RAM contract may leak into the WASM ABI.

## Testing strategy

### WASM unit/parity fixtures

Use deterministic source images and fixed seeds for:

- solid black/white and primary colours
- grayscale ramps
- RGB gradients
- checkerboards and alternating single-pixel patterns
- colour bars
- non-280x192 source dimensions

Exercise:

- all five scaling filters
- greyscale on/off
- histogram stretch on/off
- representative gamma values
- perceptual RGB on/off
- luma emphasis values
- maximum colour-shift values
- every dithering mode
- every preset
- accumulate vs average incoming error
- ordered offset boundaries

For each fixture compare relevant output hashes and/or byte arrays for:

```text
processed RGB
palette RGB/index
linear HGR
8 KB HGR page
```

Golden fixtures should initially be generated from the current browser ConvertHGR implementation with fixed settings/seed, documenting that source of truth.

### ABI tests

Cover:

- required exports exist
- memory pointers are in range and non-overlapping where required
- capacity rejects oversized source frames safely
- invalid dimensions return stable error status
- settings encoding/decoding is deterministic
- repeated conversion with same source/settings/seed is byte-identical

### JavaScript adapter tests

Cover:

- WASM is the only conversion backend
- no JS fallback is present/reachable
- source pixels are copied without algorithmic processing
- settings map correctly from Dithertizer UI state
- outputs are copied/viewed at correct sizes
- WASM errors propagate as adapter errors without corrupting prior output

### Camera pacing tests

Use a deterministic fake scheduler/camera source to verify:

- minimum interval 100 ms
- maximum interval 1000 ms
- configured step/readout behavior
- at most one conversion in flight
- no frame queue
- no latest-frame replacement cache
- frames sampled only when a conversion is allowed to start
- slow conversion naturally reduces effective frame rate
- interval changes affect the next eligible capture
- camera OFF cancels future scheduling

### Dithertizer integration tests

Verify the complete path:

```text
source RGB
-> full WASM conversion
-> palette RGB
-> luma adapter
-> Dithertizer threshold
-> selected HGR page writes
```

Also verify:

- WASM never receives Apple II RAM
- DSCAN/page-selection behavior remains unchanged
- `$C0n0` / `$C0n8` semantics remain unchanged
- UI changes do not directly write Apple II RAM
- camera OFF/reset clears the virtual camera frame
- failed conversion leaves the prior completed frame intact while the camera remains ON

### Browser smoke tests

Where CI/browser tooling permits:

- instantiate the checked-in `.wasm`
- exercise camera-control UI with a mocked media stream
- verify RATE readout and scheduling state
- verify the existing three-line Dithertizer panel remains within its intended layout

## Files expected to change

New files are expected to include:

```text
wasm/convert_hgr/convert_hgr.c
wasm/convert_hgr/convert_hgr.h
tools/build_convert_hgr_wasm.sh
res/wasm/convert_hgr.wasm
res/EMU_DITHERTIZER_converthgr.js
```

Existing files likely include:

```text
res/EMU_CARD_dithertizer.js
index.html
tools/ConvertHGR.html            # shared-module migration may be same or later milestone
tests/dithertizer_*.test.js
```

Additional dedicated WASM fixture tests/build verification files are expected.

## Implementation staging

To reduce risk, implementation should proceed in testable milestones:

1. establish maintainable full-pipeline WASM source and deterministic fixtures
2. add standalone JS WASM adapter with no fallback
3. wire existing Dithertizer UI settings into adapter settings
4. add RATE slider and paced one-in-flight camera sampling loop
5. expose completed palette RGB as Dithertizer luma source
6. validate DSCAN threshold/page capture end to end
7. migrate `tools/ConvertHGR.html` to the shared full-pipeline module if included in the same implementation scope, otherwise immediately follow with a dedicated migration PR

At no stage should WASM write Apple II RAM directly.

## Scope boundaries

This design does not introduce:

- direct HGR RAM writes from WASM
- JavaScript ConvertHGR fallback
- WebGPU/WebGL conversion
- audio capture
- multiple simultaneous cameras
- frame queueing
- latest-frame cache semantics
- adaptive frame-rate control
- automatic camera-resolution negotiation beyond accepting the browser-provided video dimensions
- changes to DSCAN software
- changes to Dithertizer slot-I/O register semantics
- stronger desktop-ConvertHGR parity claims than supported by deterministic fixtures

## Acceptance criteria

The milestone is complete when:

1. the complete browser ConvertHGR algorithm used by the Dithertizer path executes in the shared WASM module
2. no JavaScript conversion fallback exists for that path
3. all existing DTH/COL/IMG controls affect the next WASM-converted camera frame
4. the new RATE slider controls camera conversion intervals from 0.10 s to 1.00 s
5. at most one conversion runs at a time and no camera-frame backlog/cache is maintained
6. the WASM output is converted to a stable 280x192 luma virtual-camera frame
7. Dithertizer/DSCAN threshold capture still performs the actual Apple II HGR writes
8. the WASM module has no Apple II RAM-writing interface
9. camera OFF/reset releases media tracks and clears the virtual camera frame
10. deterministic fixture and integration tests cover the full pipeline and hardware boundary
