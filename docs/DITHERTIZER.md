# Dithertizer II camera capture

`res/EMU_CARD_dithertizer.js` emulates a one-bit luminance comparator. The host
camera is cropped to a 4:3 view and resampled to 280x192. The WASM pictogram
below the camera button selects the camera conversion path and starts ON:

| WASM | Camera signal supplied to the comparator |
| --- | --- |
| ON (default) | An embedded WASM routine converts RGB24 to continuous 8-bit BT.601 luminance. |
| OFF | JavaScript performs the same RGB24-to-luminance conversion, with byte-identical results. |

The WASM code and its Worker source are both contained in the card file. A
Worker performs the conversion so the emulator can continue processing while
WASM works. Only one conversion can be in flight; if it takes longer than a
SYSTEM processing frame, the card skips that camera sample and retains the last
complete image. Neither backend dithers the source: DSCAN controls all four
threshold captures and performs the Bayer merge.

The three image controls adjust luminance before the card compares it with the
threshold programmed by Apple II software:

| Control | Range | Neutral value |
| --- | --- | --- |
| Brightness | -100% to +100% | 0% |
| Contrast | 0% to 200% | 100% |
| Gamma | 0.10 to 5.00 | 1.00 |

Contrast operates around 127.5; brightness adds a fraction of the full 255-level
range. The result is clamped to 0..255, then gamma applies an exponent of
`1/gamma`. Increasing gamma brightens midtones. A 256-entry lookup table makes
adjustments immediate for both camera modes and injected `getLumaFrame()`
sources. The first camera frame is sampled at startup; subsequent frames are
eligible once per emulator processing frame. The SYSTEM FPS slider controls this
cadence through the existing scheduler, with no separate camera timer. CPU tick
rate and DSCAN sync timing are unaffected. The camera button starts/stops the
stream; reset/restart and peripheral ejection release tracks and stop sampling.
Both cards attach the same `DithertizerCameraDevice` type through Apple2IO.
Its `video/x-raw;format=RGB24` port publishes complete frames to the mounted
card; detaching the device stops the host stream. If WASM conversion
fails, the last complete camera frame is retained and the toggle shows `ERR`.

When the camera is OFF, the card decodes the original disk's complete $4000–$5FFF
HGR capture of the “Computer Station” sign into monochrome camera luminance.
DSCAN can reconstruct that picture with its ordinary capture passes. An explicit
`setCameraSource()` remains higher priority than both camera modes and the disk
sample.

## DSCAN performs the dithering

Writing `$C0n0` latches the threshold and stops capture. Reading `$C0n0` returns
sync in bit 7 and stops capture, except for safe debugger reads. Reading `$C0n8`
captures seven comparator bits per HGR byte into the current video page. Bit 7
is clear, and HGR memory holes are untouched. Safe `$C0n8` reads do not capture.

The original DSCAN 4.2 driver makes four acquisitions and merges a different
row/column parity from each. For a 2x2 lattice its threshold ranks are:

| | x even | x odd |
| --- | --- | --- |
| y even | 0 | 2 |
| y odd | 3 | 1 |

With driver parameters `$00=2`, `$01=25`, `$02=115`, the thresholds in acquisition
order are 115, 134, 128, 121. A uniform cell produces zero through four lit
pixels, giving five dot densities. Threshold spacing/base remain under DSCAN's
control; the card does not hard-code these four values or merge output phases.

`tests/dithertizer_dscan_bayer.test.js` extracts the original `DSCAN 4.2.OBJ`
from the repository's driver disk and runs it on the production 6502 CPU with
the card's production I/O and sync timing. It checks completion, all four
thresholds, all five Bayer states across the image, bit 7, and HGR holes.

## DITHER2 color capture

The separate `res/EMU_CARD_dithertizer2.js` copies complete ConvertHGR bytes to
the selected HGR page, including each byte's color-phase bit 7. With the camera
off, it captures the supplied `appleiilogo-2-3.HGR` image embedded as a full
8,192-byte HGR page, preserving bit 7 and the original page holes.
It uses the same attached RGB24 camera device as DITHER. Its WASM pictogram
starts ON and selects between the ConvertHGR worker's WASM and JavaScript
backends. One new frame is eligible per SYSTEM processing frame; a conversion
still in progress prevents a second from starting. The MODE menu offers
`None`, `Error diffusion`, and ordered choices. `ERR` is disabled in `None`;
`OFFSET` sits beside MODE and is enabled only for ordered choices. There is no
separate RATE timer.

The stock disk calls DSCAN at `$1C00` (`CALL 7168`). That entry captures four
PAGE1 frames and merges them into PAGE2 with `AND #$7F`, so its displayed color
alternates between a fresh color capture and a bit-7-cleared result. DSCAN also
contains a synchronized one-pass PAGE2 capture at `$1D03` (`CALL 7427`). When
DITHER2 is mounted and the exact original driver is loaded, it changes the
in-memory `$1C00` entry to `JMP $1D03`. The disk image and the DITHER card are
unchanged. Removing or resetting DITHER2 restores the original RAM entry when
that driver is still present. Other programs are not patched; they can call
`7427` explicitly after loading DSCAN.

## Scope

The separate ConvertHGR adapter and worker remain available to the standalone
tool and to DITHER2 color capture. DITHER embeds only its small luminance WASM
module and Worker source, keeping the original comparator and DSCAN dither.

Verification: `node --test tests/*.test.js`.
