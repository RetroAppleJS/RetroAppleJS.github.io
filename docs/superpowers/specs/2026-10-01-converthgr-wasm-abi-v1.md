# ConvertHGR Full-Pipeline WASM ABI v1

## Status and scope

This document is the normative ABI v1 contract for the shared standalone ConvertHGR WebAssembly module introduced by the Dithertizer full-pipeline design.

It defines:

- the exported WebAssembly functions;
- linear-memory ownership and lifetime;
- fixed input/output buffer sizes;
- the 120-byte settings structure;
- enum and flag values;
- normative dither-mode semantics;
- validation order and error codes;
- deterministic RNG behavior;
- success/failure output semantics;
- Worker protocol and JavaScript adapter contract; and
- the exact palette-RGB-to-Dithertizer-luma conversion.

It does **not** define Apple II peripheral I/O or HGR RAM writes. The WASM module must never receive an Apple II RAM pointer or hardware object. Dithertizer/DSCAN remains the only path that writes Apple II HGR memory.

`tools/ConvertHGR.html` remains the frozen behavioral reference during this implementation milestone. ABI v1 deliberately preserves the current browser-port behavior, including behavior that may differ from what the UI labels suggest.

## Compatibility rules

```text
HGR_ABI_VERSION = 1
```

A consumer must call `hgr_get_abi_version()` before using any pointer or conversion API and reject any module that does not return `1`.

ABI v1 is little-endian and uses WebAssembly 32-bit linear-memory byte offsets. No exported allocator is part of the ABI.

## Required WebAssembly module properties

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

The module owns this memory for the lifetime of the instance.

## Image constants and fixed buffer sizes

```c
#define HGR_ABI_VERSION             1u

#define HGR_WIDTH                   280u
#define HGR_HEIGHT                  192u
#define HGR_PIXELS                  53760u
#define HGR_RGB_BYTES               161280u
#define HGR_PALETTE_INDEX_BYTES     53760u
#define HGR_LINEAR_BYTES            7680u
#define HGR_PAGE_BYTES              8192u

#define HGR_MAX_SOURCE_WIDTH        3840u
#define HGR_MAX_SOURCE_HEIGHT       2160u
#define HGR_SOURCE_CHANNELS         3u
#define HGR_SOURCE_CAPACITY         24883200u

#define HGR_SETTINGS_V1_BYTES       120u
#define HGR_WASM_MEMORY_BYTES       50331648u
```

### Source format

Input is tightly packed RGB24, row-major, with no padding and no alpha:

```text
R0 G0 B0 R1 G1 B1 ...
```

For `width x height`, the caller writes exactly:

```text
width * height * 3
```

bytes beginning at `hgr_get_source_ptr()`.

The unused remainder of the source region need not be initialized.

### Fixed output formats

`processedRGB`
: 161,280 bytes, tightly packed 280x192 RGB24 after image preparation and before HGR palette quantization.

`paletteIndex`
: 53,760 bytes, one palette index for every 280x192 output pixel. Every successful conversion must produce only values `0..7`.

`paletteRGB`
: 161,280 bytes, derived **exactly** from the final `paletteIndex` array using the fixed ABI-v1 palette below.

`linearHGR`
: 7,680 bytes, 40 bytes per row for 192 rows before Apple II page interleave.

`hgrPage`
: 8,192 bytes, Apple II HGR page layout using the standard row interleave. Bytes in the 8-KB page that are not addressed by the 192x40 raster are zero.

## ABI-v1 palette and `paletteRGB` derivation

The palette is frozen as:

```text
index  RGB
0      0,   0,   0
1      20,  245, 60
2      255, 68,  253
3      255, 255, 255
4      0,   0,   0
5      255, 106, 60
6      20,  207, 253
7      255, 255, 255
```

For every output pixel `p`:

```text
idx = paletteIndex[p]
paletteRGB[p*3+0] = palette[idx].R
paletteRGB[p*3+1] = palette[idx].G
paletteRGB[p*3+2] = palette[idx].B
```

`paletteRGB` is therefore a deterministic expansion of the **final** palette-index image, including any previous-pixel adjustments performed by the HGR artifact quantizer.

The current browser reference exposes `paletteImage`; ABI v1 names that same byte-per-pixel result `paletteIndex` and adds the deterministic RGB expansion above.

## Required exports

In addition to exported `memory`, ABI v1 requires:

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

Getter constants:

```text
hgr_get_abi_version()     == 1
hgr_get_settings_size()   == 120
hgr_get_source_capacity() == 24,883,200
```

Pointer values are byte offsets into exported memory and are stable for the lifetime of one instance. All declared public regions must fit inside memory and must not overlap one another.

JavaScript must recreate typed-array/DataView views from the current `memory.buffer` before each write/read operation even though ABI v1 does not rely on memory growth.

## Pointer ownership and workspace rules

All public buffers are module-owned. The caller never allocates or frees WASM memory.

### Source region

Before `hgr_convert()` begins, the caller owns the contents of the active source range and may write:

```text
[source_ptr, source_ptr + width*height*3)
```

Once `hgr_convert()` begins, the active source bytes become **consumable scratch**. The module may overwrite any or all of the source-capacity region while converting.

Consequences:

- the caller must rewrite source RGB for every conversion;
- source bytes are unspecified after `hgr_convert()` returns, regardless of success or failure;
- the module may reuse the source region for internal preprocessing/resampling workspace;
- the caller must not read or modify source memory while conversion is running.

This source-reuse rule is normative and exists so the complete maximum accepted input can be processed inside fixed 48-MiB memory without a second full-size source copy.

### Settings region

The caller writes all 120 bytes before conversion. The module treats settings as read-only during the call.

The settings region may not be used as workspace.

### Output regions

The caller never writes output buffers.

After `HGR_OK`, all five output regions are simultaneously valid and remain stable until the next `hgr_convert()` call.

After any nonzero status, every output region is unspecified and must be ignored.

### Private workspace

Private conversion workspace may overlap the module-owned source region after conversion begins.

Private workspace must **not** overlap:

- settings;
- processed RGB;
- palette RGB;
- palette index;
- linear HGR; or
- HGR page.

The implementation must fit every valid ABI-v1 conversion inside fixed 48-MiB memory. It must not reject an otherwise valid input merely because a naive implementation would require a huge temporary image.

In particular, scaling/framing must be implemented in a bounded/crop-aware manner. The conceptual intermediate dimensions produced by reference `scaleAndFrame()` must not require allocating a full `finalW * finalH * 3` image when only the 280x192 crop/output is needed.

### Alignment guarantees

```text
settings pointer:       at least 8-byte aligned
all byte buffers:       at least 16-byte aligned
```

No stronger alignment is guaranteed.

## Settings ABI v1

The settings block is exactly 120 bytes:

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
    double   perceptual_R;             /* 0x50 */
    double   perceptual_G;             /* 0x58 */
    double   perceptual_B;             /* 0x60 */
    double   reserved_f64_0;           /* 0x68, must be +0.0 */
    uint32_t reserved0;                /* 0x70, must be 0 */
    uint32_t reserved1;                /* 0x74, must be 0 */
} hgr_settings_v1;
```

The C implementation must enforce:

```c
_Static_assert(sizeof(hgr_settings_v1) == 120, "ABI v1 settings size");
```

and must assert every published field offset with `offsetof()`.

### Fixed Apple pixel aspect

ABI v1 does **not** expose a configurable Apple pixel aspect.

The image-framing algorithm always uses the browser-reference constant:

```text
HGR_APPLE_PIXEL_ASPECT = 256.0 / 280.0
```

The previous candidate field at offset `0x68` is therefore reserved as `reserved_f64_0` and must contain the positive-zero IEEE-754 bit pattern (`0x0000000000000000`).

WASM must not read it as an aspect setting. A nonzero bit pattern returns `HGR_ERR_SETTINGS`.

Changing the pixel-aspect behavior requires a future ABI version or an explicitly assigned reserved field.

### Flags

```c
#define HGR_FLAG_PERCEPTUAL_RGB       (1u << 0)
#define HGR_FLAG_GREYSCALE            (1u << 1)
#define HGR_FLAG_STRETCH_HISTOGRAM    (1u << 2)
#define HGR_FLAG_ACCUMULATE_ERRORS    (1u << 3)
#define HGR_FLAGS_V1_MASK             0x0000000Fu
```

Unknown bits are invalid.

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

### Normative dither-mode behavior

ABI v1 preserves the current browser-reference behavior exactly, including the fact that the `Order1`/`Order3` UI labels say “threshold” but the quantizer still applies whatever A-F coefficients are serialized.

WASM derives ordered-threshold behavior from `dither_mode` as follows:

```text
mode       ordered threshold enabled   matrix size
DIFFUSION  no                          2 (unused)
ORDER1     yes                         2
ORDER2     yes                         2
ORDER3     yes                         4
ORDER4     yes                         4
```

The ordered matrices are:

```text
ORDER2 =
  0/4  2/4
  3/4  1/4

ORDER4 =
   0/16   8/16   2/16  10/16
  12/16   4/16  14/16   6/16
   3/16  11/16   1/16   9/16
  15/16   7/16  13/16   5/16
```

For ordered modes, each matrix entry is adjusted as:

```text
threshold = matrix_value - ordered_offset / 16.0
```

and is applied with the same reference arithmetic before incoming error is added.

`dither_mode` does **not** itself zero or replace `error_A..error_F`.

Therefore:

- ORDER1 and ORDER2 have identical ordered-matrix mechanics when given identical effective coefficients;
- ORDER3 and ORDER4 have identical ordered-matrix mechanics when given identical effective coefficients;
- their practical distinction in the current UI comes from UI state changes to A-F, not from hidden WASM behavior.

Current UI behavior to preserve before serialization:

```text
select ORDER2 or ORDER4:
  A=1 B=2 C=2 D=2 E=0 F=0

select ORDER1 or ORDER3:
  retain the currently effective A-F values

select DIFFUSION:
  retain the currently effective A-F values
```

Preset labels are not part of the ABI. The UI/card layer resolves presets into effective A-F fields before calling the adapter.

Preset values are:

```text
Atkinson:    A=1 B=2 C=2 D=2 E=1 F=1
Floyd-Stein: A=3 B=5 C=1 D=7 E=0 F=0
Pattern:     A=0 B=8 C=0 D=8 E=0 F=0
Diag:        A=1 B=3 C=2 D=3 E=1 F=1
None:        A=0 B=0 C=0 D=0 E=0 F=0
```

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

### Scalar domains

`abi_version`
: exactly `1`.

`flags`
: only `HGR_FLAGS_V1_MASK` bits.

`ordered_offset`
: `0..16` inclusive.

`error_A..error_F`
: each `0..16` inclusive.

`gamma`
: finite `0.0..5.0`. Reference semantics define `gamma == 0.0` and `gamma == 1.0` as identity/no gamma correction.

`luma_emphasis`
: finite `0.0..5.0`.

`max_color_shift_percent`
: finite `0.0..100.0`; `1.0` means one percent.

`perceptual_R/G/B`
: finite nonnegative doubles with positive sum. Current Dithertizer defaults are `0.30/0.52/0.18`.

`reserved_f64_0`
: must be positive zero by bit pattern.

`reserved0/reserved1`
: must be zero.

Any invalid settings value returns `HGR_ERR_SETTINGS` after dimension/capacity validation described below.

## Deterministic RNG contract

ABI v1 uses the exact Microsoft-style `rand()` sequence implemented by the browser reference.

State is unsigned 32-bit and initialized to `random_seed`:

```c
state = random_seed;
```

Each `next()` operation is:

```c
state = state * 214013u + 2531011u; /* modulo 2^32 */
value = (state >> 16) & 0x7fffu;
```

At the start of each 7-pixel quantizer group:

```text
first_pattern = next() % 256
```

The converter then evaluates exactly 256 pattern candidates in this order:

```text
first_pattern,
(first_pattern + 1) & 0xFF,
...
(first_pattern + 255) & 0xFF
```

The RNG advances exactly once per 7-pixel group and not once per candidate.

Given identical source bytes, settings, ABI-v1 implementation, and seed, all outputs must be byte-identical.

## Status and error codes

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

Codes `0..4` are frozen for ABI v1.

### Validation precedence

`hgr_convert()` must validate in this exact order and return the first applicable error:

```text
1. zero dimensions
2. source limits/capacity
3. settings block
4. conversion/internal failure
```

Normative cases:

```text
if src_width == 0 || src_height == 0
    return HGR_ERR_DIMENSIONS

else if src_width > 3840 || src_height > 2160 ||
        uint64(src_width) * uint64(src_height) * 3 > 24883200
    return HGR_ERR_SOURCE_TOO_LARGE

else if any settings validation fails
    return HGR_ERR_SETTINGS

else perform conversion; an otherwise unclassified runtime failure
    return HGR_ERR_INTERNAL
```

An input with both zero dimensions and invalid settings therefore returns `HGR_ERR_DIMENSIONS`. An oversized input with invalid settings returns `HGR_ERR_SOURCE_TOO_LARGE`.

The byte-count expression must use a wide enough intermediate to avoid integer overflow.

After any nonzero status, no output may be consumed.

## `hgr_convert()` call contract

Before calling, the worker/consumer must:

1. verify ABI version and settings size;
2. verify fixed memory size and public pointer ranges;
3. write exactly `width*height*3` RGB24 source bytes;
4. write all 120 settings bytes;
5. ensure no conversion is already running on that instance.

The WASM call is synchronous:

```c
status = hgr_convert(width, height, seed);
```

After the call, source memory is unspecified because it may have been reused as workspace.

After `HGR_OK`, output buffers are valid until the next call. After any error, all output buffers are unspecified.

## JavaScript normalized settings contract

The adapter accepts normalized algorithm settings:

```js
{
  dither: {
    mode: "diffusion",
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
    filter: "bilinear",
    fillMode: "default",
    horizontalNudge: 0,
    verticalNudge: 0
  }
}
```

Apple pixel aspect is intentionally absent: ABI v1 fixes it to `256/280`.

UI percentages normalize as:

```text
Gamma 130%       -> gamma = 1.30
Luma 80%         -> lumaEmphasis = 0.80
Max shift 1%     -> maxColorShiftPercent = 1.0
```

RATE and camera ON/OFF are JavaScript scheduling/lifecycle state and never enter WASM settings.

The adapter receives effective A-F values. It does not serialize preset names.

## Worker protocol

The dedicated worker owns one WASM instance.

### Main -> worker: init

```js
{
  type: "init",
  wasmURL,
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

Initialization fails if ABI version/settings size/memory size are wrong, required exports are missing, the module imports anything, or any public pointer range is invalid/overlapping.

### Main -> worker: convert

```js
{
  type: "convert",
  requestId,
  width,
  height,
  seed,
  settings,
  rgbBuffer
}
```

`rgbBuffer.byteLength` must equal `width*height*3` exactly. It is transferred to the worker and treated as consumed by the caller once accepted.

Only one conversion may be in flight.

### Worker -> main: success

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

Lengths:

```text
processedRGBBuffer   161280
paletteRGBBuffer     161280
paletteIndexBuffer    53760
linearHGRBuffer        7680
hgrPageBuffer           8192
```

Each is copied to a fresh JavaScript-owned `ArrayBuffer`; no view into `WebAssembly.Memory` crosses the worker boundary.

### Worker -> main: failure

Initialization:

```js
{
  type: "error",
  phase: "init",
  code: "ABI" | "LOAD" | "INSTANTIATE",
  message
}
```

Conversion:

```js
{
  type: "error",
  phase: "convert",
  requestId,
  status,
  message
}
```

No worker failure may trigger a JavaScript ConvertHGR fallback.

## Public JavaScript adapter contract

File:

```text
res/EMU_DITHERTIZER_converthgr.js
```

Constructor:

```js
new DithertizerConvertHGRAdapter(options?)
```

Options:

```js
{
  workerURL: "res/EMU_DITHERTIZER_converthgr_worker.js",
  wasmURL: "res/wasm/convert_hgr.wasm",
  WorkerCtor: Worker
}
```

States:

```text
new -> initializing -> ready <-> busy
                     \-> failed
any non-closed state -> closed
```

### `init()`

```js
await adapter.init();
```

Creates the worker, sends `init`, validates ABI v1, and resolves only when ready. Repeated calls after readiness do not create a second worker. Calls after `close()` reject.

### `configure(settings)`

```js
adapter.configure(settings);
```

Validates/normalizes the public settings object and stores an immutable snapshot for the next conversion. It may be called while busy and affects only the next accepted conversion.

The UI/card layer, not the adapter, resolves preset labels and mode-driven coefficient changes. The adapter receives effective A-F values.

### `convert(rgb, width, height, seed)`

```js
const result = await adapter.convert(rgb, width, height, seed);
```

Arguments:

```text
rgb     Uint8Array containing exactly width*height*3 bytes
width   positive integer <= 3840
height  positive integer <= 2160
seed    uint32
```

Only one conversion may be in flight. A busy call rejects with `ConvertHGRBusyError`; there is no queue or implicit replacement.

The adapter may transfer/detach `rgb.buffer`. If `rgb` is only a view into a larger buffer, it first creates an exact owned copy so unrelated caller bytes are not detached.

Result:

```js
{
  width: 280,
  height: 192,
  processedRGB: Uint8Array,
  paletteRGB: Uint8Array,
  paletteIndex: Uint8Array,
  linearHGR: Uint8Array,
  hgrPage: Uint8Array
}
```

All result arrays are JavaScript-owned copies.

### `close()`

Terminates the worker, rejects unresolved adapter promises, transitions to `closed`, and releases adapter references. It does not stop the browser camera stream.

### Adapter errors

```text
ConvertHGRAbiError
ConvertHGRLoadError
ConvertHGRSettingsError
ConvertHGRBusyError
ConvertHGRClosedError
ConvertHGRStatusError
```

`ConvertHGRStatusError.status` preserves the numeric nonzero WASM status.

## Serialization from current Dithertizer UI

```text
DTH Mode
  Error diffusion -> DIFFUSION
  Order1          -> ORDER1
  Order2          -> ORDER2
  Order3          -> ORDER3
  Order4          -> ORDER4

DTH preset
  -> UI/card resolves to effective A-F

Incoming error
  Accumulate -> ACCUMULATE_ERRORS flag set
  Average    -> flag clear

Ordered offset
  -> 0..16

Perceptual RGB
  -> PERCEPTUAL_RGB flag

Luma N%
  -> luma_emphasis = N/100

Max color shift N%
  -> max_color_shift_percent = N

Greyscale
  -> GREYSCALE flag

Stretch histo
  -> STRETCH_HISTOGRAM flag

Gamma N%
  -> gamma = N/100

Scaling filter
  -> filter enum

RATE
  -> JavaScript scheduler only

Camera ON/OFF
  -> JavaScript camera lifecycle only
```

Defaults not exposed by the Dithertizer UI:

```text
fill_mode           = HGR_FILL_DEFAULT
horizontal_nudge    = 0
vertical_nudge      = 0
perceptual_R        = 0.30
perceptual_G        = 0.52
perceptual_B        = 0.18
reserved_f64_0      = +0.0
reserved0           = 0
reserved1           = 0
```

## Dithertizer RGB-to-luma integration contract

The adapter result is not itself an Apple II capture.

After a successful conversion and camera-session epoch check, the Dithertizer camera pipeline converts each `paletteRGB` pixel to one unsigned luma byte using exactly:

```text
Y = trunc(0.299 * R + 0.587 * G + 0.114 * B)
```

where arithmetic is JavaScript/IEEE-754 double precision and `trunc` discards the fractional part toward zero. Since RGB values are nonnegative, this is equivalent to floor. The result is in `0..255` and requires no further scaling.

For the frozen ABI-v1 palette, the resulting luma values are:

```text
palette index:  0    1    2    3    4    5    6    7
luma:           0  156  145  255    0  145  156  255
```

An implementation may use this exact lookup table as an optimization, provided it produces the same luma bytes.

The completed 53,760-byte luma frame is atomically published only after conversion succeeds and the camera epoch is still current. DSCAN then consumes that stable frame through the existing synchronous `getLumaFrame(280,192)` source contract.

Neither `hgrPage` nor `linearHGR` is copied to Apple II RAM by the adapter or camera pipeline.

## Required ABI conformance tests

ABI v1 is not implemented until tests prove at least:

1. module has no imports;
2. exported memory is exactly 48 MiB;
3. ABI version is 1 and settings size is 120;
4. required exports exist;
5. source capacity is exactly 24,883,200 bytes;
6. public ranges fit memory and do not overlap;
7. source may be overwritten by conversion and must be rewritten per call;
8. fixed 0x68 reserved field rejects nonzero bit patterns;
9. zero width/height wins validation precedence with `HGR_ERR_DIMENSIONS`;
10. oversized source wins over invalid settings with `HGR_ERR_SOURCE_TOO_LARGE`;
11. invalid settings return `HGR_ERR_SETTINGS` after dimension/capacity checks;
12. DIFFUSION/ORDER1..ORDER4 use the normative ordered matrix/map semantics above;
13. WASM never silently changes serialized A-F coefficients based on mode;
14. `paletteIndex` contains only 0..7 and `paletteRGB` exactly expands it through the frozen palette;
15. HGR page unused/interleave holes are zero;
16. exact RNG sequence and candidate starting order match the browser reference;
17. same source/settings/seed yields byte-identical outputs;
18. failed conversion output is never published by the adapter;
19. adapter permits one in-flight conversion and no queue;
20. result byte lengths match this document;
21. Dithertizer RGB-to-luma conversion matches `[0,156,145,255,0,145,156,255]` for palette indices 0..7;
22. no production JavaScript ConvertHGR fallback exists.

## Versioning rules

ABI v1's exported function names, enum values, flag bits, status codes, settings offsets, settings size, fixed output sizes, palette table, dither-mode semantics, RNG sequence, validation precedence, and luma-conversion contract are frozen once implementation lands.

An incompatible settings layout or semantic change requires ABI v2. Reserved fields/bits must remain zero in ABI v1 and must not be reinterpreted by an ABI-v1 consumer.