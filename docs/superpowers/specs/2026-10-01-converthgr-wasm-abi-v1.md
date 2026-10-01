# ConvertHGR Full-Pipeline WASM ABI v1

## Status and scope

This document is the normative ABI v1 contract for the shared standalone ConvertHGR WebAssembly module introduced by the Dithertizer full-pipeline design.

It defines:

- the exported WebAssembly functions;
- linear-memory ownership and lifetime;
- the fixed input/output buffer sizes;
- the 120-byte settings structure;
- enum and flag values;
- validation and error codes;
- success/failure output semantics;
- the Worker protocol; and
- the public JavaScript adapter contract.

It does **not** define Apple II peripheral I/O or HGR RAM writes. The WASM module must never receive an Apple II RAM pointer or hardware object. Dithertizer/DSCAN remains the only path that writes Apple II HGR memory.

This ABI is consumed first by the Dithertizer integration. `tools/ConvertHGR.html` remains the frozen behavioral reference during this implementation milestone and may migrate to the same ABI later.

## Compatibility rules

ABI v1 is identified by:

```text
HGR_ABI_VERSION = 1
```

A consumer must call `hgr_get_abi_version()` before using any other pointer or conversion API. A consumer that does not receive `1` must reject the module.

The ABI is little-endian. This matches WebAssembly linear-memory scalar representation.

ABI v1 uses WebAssembly 32-bit linear-memory offsets. All exported pointers are `uint32_t` byte offsets into the module's exported `memory`.

The ABI is intentionally allocation-free from the consumer's perspective. No exported `malloc`, `free`, or caller-owned WASM allocation is part of ABI v1.

## Required WebAssembly module properties

The checked-in ABI v1 module must satisfy all of the following:

```text
memory export name:       memory
initial memory size:      50,331,648 bytes (48 MiB)
maximum memory size:      50,331,648 bytes (48 MiB)
memory growth:            not required and must not be relied upon
imports:                  none
entry point:              none
```

`WebAssembly.Module.imports(module)` must return an empty array.

The exported `memory.buffer.byteLength` must be exactly `50,331,648` bytes after instantiation.

The module owns this memory for the lifetime of the WebAssembly instance.

## Image constants and buffer sizes

```c
#define HGR_ABI_VERSION             1u

#define HGR_WIDTH                   280u
#define HGR_HEIGHT                  192u
#define HGR_PIXELS                  53760u
#define HGR_RGB_BYTES               161280u   /* 280 * 192 * 3 */
#define HGR_PALETTE_INDEX_BYTES     53760u    /* one palette index per pixel */
#define HGR_LINEAR_BYTES            7680u     /* 40 bytes * 192 rows */
#define HGR_PAGE_BYTES              8192u

#define HGR_MAX_SOURCE_WIDTH        3840u
#define HGR_MAX_SOURCE_HEIGHT       2160u
#define HGR_SOURCE_CHANNELS         3u
#define HGR_SOURCE_CAPACITY         24883200u /* 3840 * 2160 * 3 */

#define HGR_SETTINGS_V1_BYTES       120u
#define HGR_WASM_MEMORY_BYTES       50331648u /* 48 MiB */
```

### Source format

The input image is tightly packed RGB24 in row-major order:

```text
R0 G0 B0 R1 G1 B1 ...
```

There is no row padding and no alpha channel.

For a conversion of `width x height`, the consumer must write exactly:

```text
width * height * 3
```

bytes starting at `hgr_get_source_ptr()`.

The unused remainder of the source-capacity region does not need to be zeroed.

### Fixed output formats

`processedRGB`
: `HGR_RGB_BYTES` bytes, tightly packed 280x192 RGB24 after image-preparation operations and before HGR palette quantization.

`paletteRGB`
: `HGR_RGB_BYTES` bytes, tightly packed 280x192 RGB24 representing the palette-rendered HGR result. This is the Dithertizer integration's source for luma adaptation.

`paletteIndex`
: `HGR_PALETTE_INDEX_BYTES` bytes, one ConvertHGR palette index per 280x192 output pixel.

`linearHGR`
: `HGR_LINEAR_BYTES` bytes, 40 bytes per raster row for 192 rows before Apple II 8-KB page interleave.

`hgrPage`
: `HGR_PAGE_BYTES` bytes, complete Apple II HGR page image using Apple II row interleave. This is diagnostic/shared-converter output only in the Dithertizer path and must not be copied directly to Apple II RAM by the WASM adapter.

## Required exports

ABI v1 exports exactly the following public conversion interface in addition to the WebAssembly `memory` export:

```c
uint32_t hgr_get_abi_version(void);
uint32_t hgr_get_settings_size(void);

uint32_t hgr_get_source_ptr(void);
uint32_t hgr_get_source_capacity(void);
uint32_t hgr_get_settings_ptr(void);

uint32_t hgr_get_processed_rgb_ptr(void);
uint32_t hgr_get_palette_rgb_ptr(void);
uint32_t hgr_get_palette_index_ptr(void);
uint32_t hgr_get_linear_ptr(void);
uint32_t hgr_get_page_ptr(void);

int32_t hgr_convert(uint32_t src_width,
                    uint32_t src_height,
                    uint32_t random_seed);
```

Return values for the getters are byte offsets into exported linear memory.

The getter contract is:

```text
hgr_get_abi_version()          == 1
hgr_get_settings_size()        == 120
hgr_get_source_capacity()      == 24,883,200
```

All pointer getters must return nonzero offsets whose declared ranges fit completely inside `memory`.

Pointer values are stable for the lifetime of one module instance. ABI v1 consumers may cache numeric offsets, but JavaScript typed-array views must still be recreated from the current `memory.buffer` before each copy/read operation.

## Pointer ownership and access rules

All ABI pointers refer to **module-owned** memory.

The caller never owns, allocates, frees, resizes, or transfers WebAssembly linear-memory regions.

### Source region

Owner: WASM module.

Caller permissions before `hgr_convert()`:

```text
WRITE: [source_ptr, source_ptr + src_width * src_height * 3)
READ:  allowed but unnecessary
```

Module behavior during `hgr_convert()`:

- treats the active source bytes as input;
- does not require bytes beyond the active source length to have any value;
- may use internal work buffers, but must not require the caller to provide them.

The caller must not modify source memory while `hgr_convert()` is executing.

### Settings region

Owner: WASM module.

Caller permissions before `hgr_convert()`:

```text
WRITE exactly HGR_SETTINGS_V1_BYTES bytes at hgr_get_settings_ptr()
```

The caller must populate every field, including reserved fields. Reserved fields must be zero.

The module treats settings as read-only for one conversion.

The caller must not modify settings memory while `hgr_convert()` is executing.

### Output regions

Owner: WASM module.

Caller permissions:

```text
WRITE: never
READ:  only after hgr_convert() returned HGR_OK
```

On success, all five output regions are valid simultaneously and remain valid until the next call to `hgr_convert()` or destruction of the module instance.

On any nonzero return status, **all output regions are unspecified** and may contain old, partial, or intermediate data. A consumer must not publish, hash, display, or otherwise use them after a failed conversion.

This rule is deliberate: preserving the previous completed Dithertizer frame is the responsibility of the JavaScript camera pipeline, not of WASM output-buffer transactional semantics.

### Pointer overlap rules

The following externally visible regions must not overlap:

- source
- settings
- processed RGB
- palette RGB
- palette index
- linear HGR
- HGR page

Internal/private work areas may not overlap any externally visible region while conversion is running.

### Alignment guarantees

ABI v1 guarantees:

```text
settings pointer:       at least 8-byte aligned
all other ABI buffers:  at least 16-byte aligned
```

Consumers must not assume stronger alignment.

## Settings ABI v1

The settings block is exactly 120 bytes.

The normative C representation is:

```c
#include <stdint.h>

typedef struct hgr_settings_v1
{
    uint32_t abi_version;              /* 0x00 */
    uint32_t flags;                    /* 0x04 */
    uint32_t dither_mode;              /* 0x08 */
    uint32_t scaling_filter;           /* 0x0C */
    uint32_t fill_mode;                /* 0x10 */
    int32_t  horizontal_nudge;         /* 0x14 */
    int32_t  vertical_nudge;           /* 0x18 */
    uint32_t ordered_offset;           /* 0x1C */
    uint32_t error_A;                  /* 0x20 */
    uint32_t error_B;                  /* 0x24 */
    uint32_t error_C;                  /* 0x28 */
    uint32_t error_D;                  /* 0x2C */
    uint32_t error_E;                  /* 0x30 */
    uint32_t error_F;                  /* 0x34 */
    double   gamma;                    /* 0x38 */
    double   luma_emphasis;            /* 0x40 */
    double   max_color_shift_percent;  /* 0x48 */
    double   perceptual_R;              /* 0x50 */
    double   perceptual_G;              /* 0x58 */
    double   perceptual_B;              /* 0x60 */
    double   apple_pixel_aspect;        /* 0x68 */
    uint32_t reserved0;                /* 0x70 */
    uint32_t reserved1;                /* 0x74 */
} hgr_settings_v1;
```

The implementation must enforce at compile time:

```c
_Static_assert(sizeof(hgr_settings_v1) == 120, "ABI v1 settings size");
```

and should assert the critical field offsets with `offsetof()`.

### Flags

```c
#define HGR_FLAG_PERCEPTUAL_RGB       (1u << 0)
#define HGR_FLAG_GREYSCALE            (1u << 1)
#define HGR_FLAG_STRETCH_HISTOGRAM    (1u << 2)
#define HGR_FLAG_ACCUMULATE_ERRORS    (1u << 3)
#define HGR_FLAGS_V1_MASK             0x0000000Fu
```

All other flag bits must be zero in ABI v1.

`HGR_FLAG_ACCUMULATE_ERRORS` set means `Incoming error = Accumulate`.

`HGR_FLAG_ACCUMULATE_ERRORS` clear means `Incoming error = Average`.

### Dither mode enum

```c
typedef enum hgr_dither_mode_v1
{
    HGR_DITHER_DIFFUSION = 0,
    HGR_DITHER_ORDER1    = 1,
    HGR_DITHER_ORDER2    = 2,
    HGR_DITHER_ORDER3    = 3,
    HGR_DITHER_ORDER4    = 4
} hgr_dither_mode_v1;
```

The UI preset name is not part of the ABI. Presets are resolved by JavaScript to the six coefficient fields before the settings block is written.

Preset coefficient mappings are:

```text
Atkinson:   A=1 B=2 C=2 D=2 E=1 F=1
Floyd-Stein:A=3 B=5 C=1 D=7 E=0 F=0
Pattern:    A=0 B=8 C=0 D=8 E=0 F=0
Diag:       A=1 B=3 C=2 D=3 E=1 F=1
None:       A=0 B=0 C=0 D=0 E=0 F=0
```

For `order2` and `order4`, the current browser reference's mode behavior may override the coefficient set to:

```text
A=1 B=2 C=2 D=2 E=0 F=0
```

The adapter must apply the same UI/reference rule before serialization so WASM receives the effective coefficients, not a preset label.

### Scaling filter enum

```c
typedef enum hgr_scaling_filter_v1
{
    HGR_FILTER_BOX      = 0,
    HGR_FILTER_GAUSSIAN = 1,
    HGR_FILTER_HAMMING  = 2,
    HGR_FILTER_BLACKMAN = 3,
    HGR_FILTER_BILINEAR = 4
} hgr_scaling_filter_v1;
```

### Fill mode enum

```c
typedef enum hgr_fill_mode_v1
{
    HGR_FILL_DEFAULT      = 0,
    HGR_FILL_TOP_LEFT     = 1,
    HGR_FILL_MIDDLE       = 2,
    HGR_FILL_BOTTOM_RIGHT = 3
} hgr_fill_mode_v1;
```

The Dithertizer UI does not currently expose fill mode or nudges. The adapter therefore serializes:

```text
fill_mode         = HGR_FILL_DEFAULT
horizontal_nudge  = 0
vertical_nudge    = 0
```

until such controls are explicitly introduced.

### Scalar domains

`abi_version`
: must equal `1`.

`flags`
: may contain only `HGR_FLAGS_V1_MASK` bits.

`ordered_offset`
: integer `0..16` inclusive.

`error_A` through `error_F`
: integer `0..16` inclusive.

`gamma`
: finite `double`, `0.0..5.0` inclusive. Dithertizer UI `0..500` percent serializes as `value / 100.0`.

`luma_emphasis`
: finite `double`, `0.0..5.0` inclusive. Dithertizer UI `0..500` percent serializes as `value / 100.0`.

`max_color_shift_percent`
: finite `double`, `0.0..100.0` inclusive. Dithertizer UI percentage is written directly as a percent value; `1` means `1%`.

`perceptual_R`, `perceptual_G`, `perceptual_B`
: finite nonnegative doubles. For the current Dithertizer UI they are always the ConvertHGR defaults:

```text
R = 0.30
G = 0.52
B = 0.18
```

Their sum must be greater than zero. ABI v1 does not require the sum to equal exactly 1.0.

`apple_pixel_aspect`
: finite positive double. Current default:

```text
256 / 280 = 0.9142857142857143...
```

`reserved0`, `reserved1`
: must be zero.

Any invalid settings value returns `HGR_ERR_SETTINGS`.

## Status and error codes

The `hgr_convert()` return value is an `int32_t` status code.

```c
typedef enum hgr_status_v1
{
    HGR_OK                   = 0,
    HGR_ERR_DIMENSIONS       = 1,
    HGR_ERR_SOURCE_TOO_LARGE = 2,
    HGR_ERR_SETTINGS         = 3,
    HGR_ERR_INTERNAL         = 4
} hgr_status_v1;
```

### HGR_OK = 0

The conversion completed successfully and every ABI output buffer is valid.

### HGR_ERR_DIMENSIONS = 1

Returned when either dimension is zero:

```text
src_width == 0
or
src_height == 0
```

No output may be consumed.

### HGR_ERR_SOURCE_TOO_LARGE = 2

Returned when any of the following is true:

```text
src_width  > HGR_MAX_SOURCE_WIDTH
src_height > HGR_MAX_SOURCE_HEIGHT
src_width * src_height * 3 > HGR_SOURCE_CAPACITY
```

The implementation must perform the byte-count calculation without integer overflow, e.g. using a wider intermediate type.

No output may be consumed.

### HGR_ERR_SETTINGS = 3

Returned for any ABI-v1 settings validation failure, including:

- settings `abi_version != 1`;
- unknown flag bits;
- unknown enum value;
- ordered offset outside `0..16`;
- any diffusion coefficient outside `0..16`;
- non-finite or out-of-range scalar;
- non-positive perceptual-weight sum;
- non-positive Apple pixel aspect;
- nonzero reserved field.

No output may be consumed.

### HGR_ERR_INTERNAL = 4

Reserved for a conversion failure not attributable to caller input and not representable by the other ABI-v1 statuses.

This is not a JavaScript exception channel. The worker converts this status to a structured JavaScript error.

No output may be consumed.

### Error-code stability

Codes `0..4` are frozen for ABI v1 and must not be renumbered.

Future ABI versions may add new positive codes. ABI-v1 JavaScript must preserve unknown nonzero codes in diagnostics and treat them as conversion failure.

## `hgr_convert()` call contract

Before calling:

1. validate `hgr_get_abi_version() == 1`;
2. validate `hgr_get_settings_size() == 120`;
3. validate memory size and all buffer ranges;
4. write exactly `width * height * 3` RGB24 source bytes;
5. serialize all 120 settings bytes;
6. ensure no other conversion is running against the same module instance.

Call:

```c
status = hgr_convert(width, height, seed);
```

`random_seed` is an unsigned 32-bit value. The same source, settings, ABI-compatible module, and seed must produce byte-identical outputs.

The call is synchronous at the WASM level. It runs inside a dedicated Web Worker in browser production use.

After `HGR_OK`:

- copy/read all required outputs before starting the next conversion;
- outputs remain stable until the next `hgr_convert()` call.

After any nonzero status:

- ignore all output memory;
- surface the status through the adapter;
- do not publish a new Dithertizer frame.

## JavaScript settings contract

The main-thread adapter accepts a normalized object with this v1 shape:

```js
{
  dither: {
    mode: "diffusion",          // diffusion|order1|order2|order3|order4
    accumulateErrors: true,
    orderedOffset: 0,
    error: {A:1,B:2,C:2,D:2,E:1,F:1}
  },
  matching: {
    perceptual: false,
    lumaEmphasis: 0.80,
    maxColorShiftPercent: 1.0,
    perceptualR: 0.30,
    perceptualG: 0.52,
    perceptualB: 0.18
  },
  image: {
    greyscale: false,
    stretchHistogram: false,
    gamma: 1.30
  },
  scaling: {
    filter: "bilinear",        // box|gaussian|hamming|blackman|bilinear
    fillMode: "default",       // default|top-left|middle|bottom-right
    horizontalNudge: 0,
    verticalNudge: 0,
    applePixelAspect: 256/280
  }
}
```

UI-level percentage controls are normalized before this object reaches the worker:

```text
Gamma UI 130          -> image.gamma = 1.30
Luma UI 80            -> matching.lumaEmphasis = 0.80
Max shift UI 1        -> matching.maxColorShiftPercent = 1.0
```

The camera RATE value is not part of the WASM settings ABI. RATE controls JavaScript scheduling only.

The host-camera ON/OFF state is not part of the WASM settings ABI.

## Worker protocol

The dedicated worker owns exactly one WebAssembly instance and serializes access to it.

### Main -> worker: initialization

```js
{
  type: "init",
  wasmURL: "res/wasm/convert_hgr.wasm",
  abiVersion: 1
}
```

### Worker -> main: ready

```js
{
  type: "ready",
  abiVersion: 1,
  settingsSize: 120,
  sourceCapacity: 24883200
}
```

The worker must reject initialization if:

- module ABI version is not 1;
- settings size is not 120;
- memory size is not exactly 48 MiB;
- required exports are missing;
- the module imports anything;
- any ABI pointer range is invalid or overlaps another public region.

### Main -> worker: conversion

```js
{
  type: "convert",
  requestId,          // monotonically increasing integer owned by adapter
  width,
  height,
  seed,               // uint32
  settings,           // normalized JS settings object
  rgbBuffer           // ArrayBuffer containing exact RGB24 payload
}
```

`rgbBuffer.byteLength` must equal:

```text
width * height * 3
```

The main thread transfers `rgbBuffer` to the worker. Once `convert()` accepts the request, the caller must treat that input buffer as consumed/detached.

Only one conversion request may be in flight per adapter instance.

### Worker -> main: conversion success

```js
{
  type: "result",
  requestId,
  width: 280,
  height: 192,
  processedRGBBuffer,
  paletteRGBBuffer,
  paletteIndexBuffer,
  linearHGRBuffer,
  hgrPageBuffer
}
```

The worker copies each successful WASM output into a fresh JavaScript-owned `ArrayBuffer` and transfers those buffers to the main thread.

Expected byte lengths:

```text
processedRGBBuffer   161280
paletteRGBBuffer     161280
paletteIndexBuffer    53760
linearHGRBuffer        7680
hgrPageBuffer           8192
```

No view into `WebAssembly.Memory` crosses the worker boundary.

### Worker -> main: failure

Initialization failure:

```js
{
  type: "error",
  phase: "init",
  code: "ABI" | "LOAD" | "INSTANTIATE",
  message
}
```

Conversion failure:

```js
{
  type: "error",
  phase: "convert",
  requestId,
  status,             // numeric WASM status where available
  message
}
```

A worker-side error must never be converted into a JavaScript ConvertHGR fallback.

## Public JavaScript adapter contract

File:

```text
res/EMU_DITHERTIZER_converthgr.js
```

Public constructor:

```js
new DithertizerConvertHGRAdapter(options?)
```

Supported options:

```js
{
  workerURL: "res/EMU_DITHERTIZER_converthgr_worker.js",
  wasmURL: "res/wasm/convert_hgr.wasm",
  WorkerCtor: Worker       // injectable for tests
}
```

### Adapter states

The adapter has these logical states:

```text
new
initializing
ready
busy
failed
closed
```

A conversion is accepted only in `ready`.

### `init()`

```js
await adapter.init();
```

Returns `Promise<void>`.

Behavior:

- creates the worker;
- sends `init`;
- validates the worker's ready response;
- resolves only when ABI v1 is ready;
- rejects on load/ABI/worker failure;
- repeated calls after successful initialization resolve without creating a second worker;
- calls after `close()` reject.

### `configure(settings)`

```js
adapter.configure(settings);
```

Returns `void`.

Behavior:

- validates and normalizes the public settings object;
- stores an immutable snapshot for the next conversion;
- does not send work to WASM by itself;
- may be called while a conversion is busy; it affects only the next accepted conversion;
- does not cancel or mutate the settings of the in-flight request.

The adapter must resolve UI preset names to effective A/B/C/D/E/F coefficients before the settings snapshot reaches the worker. Preset labels are never serialized into WASM memory.

### `convert(rgb, width, height, seed)`

```js
const result = await adapter.convert(rgb, width, height, seed);
```

Arguments:

```text
rgb     Uint8Array containing exactly width * height * 3 RGB24 bytes
width   positive integer <= 3840
height  positive integer <= 2160
seed    uint32
```

Returns `Promise<DithertizerConvertHGRResult>`.

Input ownership:

- the adapter is allowed to transfer/detach `rgb.buffer`;
- the caller must not use `rgb` after the request has been accepted;
- if the supplied `Uint8Array` is not a full-buffer view (`byteOffset != 0` or `byteLength != buffer.byteLength`), the adapter first creates an exact owned copy and transfers that copy rather than detaching unrelated caller data.

Concurrency:

- exactly one request may be in flight;
- calling `convert()` while state is `busy` rejects with a JavaScript `ConvertHGRBusyError`;
- there is no queue and no implicit replacement of the busy request.

Settings:

- `convert()` snapshots the adapter's most recently configured settings at request acceptance time;
- later calls to `configure()` do not change the in-flight request.

Result shape:

```js
{
  width: 280,
  height: 192,
  processedRGB: Uint8Array,   // 161280
  paletteRGB: Uint8Array,     // 161280
  paletteIndex: Uint8Array,   // 53760
  linearHGR: Uint8Array,      // 7680
  hgrPage: Uint8Array         // 8192
}
```

All result arrays are JavaScript-owned and independent of WebAssembly memory.

### `close()`

```js
adapter.close();
```

Returns `void`.

Behavior:

- terminates the worker;
- rejects any unresolved adapter promise;
- transitions to `closed`;
- releases all adapter references to transferred outputs/settings;
- subsequent `init()` or `convert()` calls reject.

`close()` does not own or stop the browser camera stream; camera ownership belongs to the Dithertizer camera pipeline.

## JavaScript adapter errors

The public adapter exposes errors by class/name rather than by inventing additional WASM numeric statuses.

```text
ConvertHGRAbiError
ConvertHGRLoadError
ConvertHGRSettingsError
ConvertHGRBusyError
ConvertHGRClosedError
ConvertHGRStatusError
```

`ConvertHGRStatusError` must expose:

```js
error.status   // original nonzero hgr_status_v1 value
error.phase    // "convert"
```

Unknown future nonzero WASM statuses are preserved in `error.status`.

## Serialization from current Dithertizer UI

Current Dithertizer controls map to ABI v1 as follows:

```text
UI: DTH Mode
  Error diffusion -> HGR_DITHER_DIFFUSION
  Order1          -> HGR_DITHER_ORDER1
  Order2          -> HGR_DITHER_ORDER2
  Order3          -> HGR_DITHER_ORDER3
  Order4          -> HGR_DITHER_ORDER4

UI: DTH preset
  -> resolved to error_A..error_F; preset string not serialized

UI: Incoming error
  Accumulate -> HGR_FLAG_ACCUMULATE_ERRORS set
  Average    -> HGR_FLAG_ACCUMULATE_ERRORS clear

UI: Ordered offset
  -> ordered_offset 0..16

UI: Perceptual RGB
  -> HGR_FLAG_PERCEPTUAL_RGB

UI: Luma emphasis N%
  -> luma_emphasis = N / 100

UI: Max color shift N%
  -> max_color_shift_percent = N

UI: Greyscale
  -> HGR_FLAG_GREYSCALE

UI: Stretch histo
  -> HGR_FLAG_STRETCH_HISTOGRAM

UI: Gamma N%
  -> gamma = N / 100

UI: Scaling filter
  -> hgr_scaling_filter_v1

UI: RATE
  -> JavaScript scheduler only; never enters hgr_settings_v1

UI: Camera ON/OFF
  -> JavaScript camera lifecycle only; never enters hgr_settings_v1
```

Defaults not exposed by the Dithertizer UI:

```text
fill_mode           = HGR_FILL_DEFAULT
horizontal_nudge    = 0
vertical_nudge      = 0
perceptual_R        = 0.30
perceptual_G        = 0.52
perceptual_B        = 0.18
apple_pixel_aspect  = 256.0 / 280.0
reserved0           = 0
reserved1           = 0
```

## Dithertizer integration boundary

The adapter result is not itself an Apple II capture.

The Dithertizer camera pipeline uses only `result.paletteRGB` to construct the next completed 280x192 luma frame.

The luma adaptation is JavaScript integration code and must operate on the completed palette-rendered output only. It is not a ConvertHGR fallback and it must not modify the WASM result.

The camera pipeline atomically swaps the completed luma buffer only after `adapter.convert()` resolves successfully and after its camera-generation/epoch check confirms that the camera session is still current.

DSCAN then sees that completed luma frame through the existing synchronous Dithertizer `getLumaFrame(280,192)` source contract.

Neither `hgrPage` nor `linearHGR` is copied to Apple II memory by the adapter or camera pipeline.

## Required ABI conformance tests

ABI v1 is not considered implemented until automated tests prove all of the following:

1. module has no imports;
2. exported memory is exactly 48 MiB;
3. ABI version is 1;
4. settings size is 120;
5. every required export exists;
6. source capacity is exactly 24,883,200 bytes;
7. every public pointer range is inside memory;
8. public regions do not overlap;
9. settings pointer is 8-byte aligned and byte-buffer pointers are 16-byte aligned;
10. zero width/height returns `HGR_ERR_DIMENSIONS`;
11. oversized dimensions return `HGR_ERR_SOURCE_TOO_LARGE` without overflow;
12. every invalid enum/range/reserved/NaN/Infinity case returns `HGR_ERR_SETTINGS`;
13. same source/settings/seed is byte-identical across repeated successful conversions;
14. failed conversion output is never published by the JavaScript adapter;
15. adapter rejects ABI mismatch before first conversion;
16. adapter permits only one in-flight conversion and maintains no queue;
17. result buffer byte lengths exactly match this document;
18. no production JavaScript fallback conversion path exists.

## Versioning rules

ABI v1's exported function names, numeric enum values, flag bits, status codes, settings offsets, settings size, and fixed output sizes are frozen once implementation lands.

A future incompatible settings layout or function signature requires `HGR_ABI_VERSION = 2` and new consumer support. Do not reinterpret an ABI-v1 field in place.

Reserved fields/bits exist for backward-compatible extension. ABI v1 requires them to be zero so future use can be detected unambiguously.
