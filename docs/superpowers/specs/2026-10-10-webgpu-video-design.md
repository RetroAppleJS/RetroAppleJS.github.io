# Additional Apple II+ WebGPU video device

Status: proposed design, ready for review. No renderer implementation or performance claim is included.

## Purpose and baseline

Add `res/EMU_DEVICE_video_WebGPU.js` as an additional selectable motherboard video device managed by `EMU_DEVICE_video_MUX.js`. Keep the existing GPU.js, wave, three.js and canvas devices.

This design is grounded in RetroAppleJS commit [46787f88ca2c0ea387aa7a28a26748b4a679b735](https://github.com/RetroAppleJS/RetroAppleJS.github.io/tree/46787f88ca2c0ea387aa7a28a26748b4a679b735), inspected on 10 October 2026. A later implementation must recheck its target revision before producing a patch.

Success means correct native II+ output, compatibility with existing device selection and controls, preservation of captured raster effects, and a measurable comparison with GPU.js. Faster rendering is a hypothesis to test.

## Approach

Use raw WebGPU with one full-screen triangle and a WGSL fragment shader. JavaScript uploads compact video data; the shader performs address calculation, character decoding, lores decoding and HGR artifact-color lookup, and renders directly into the device's canvas.

| Approach | Trade-off |
| --- | --- |
| Raw WebGPU render pipeline — recommended | Direct control of uploads and presentation; appropriate for a small 2D display |
| Compute shader plus output texture | Adds an intermediate output and a second presentation stage without a demonstrated need |
| three.js WebGPU | Adds a dependency and scene infrastructure already served by a separate MUX device |

Embed WGSL as a string inside the new device file. Include that file explicitly in `index.html`, before MUX. Do not dynamically insert script elements.

## Device identity and integration

Use a directly named constructor `Apple2VideoWebGPU(canvas)`; do not overwrite the shared `Apple2Video` constructor or instantiate a GPU owner at script-load time.

| Property | Proposed value |
| --- | --- |
| DCODE | `A2WGPU` |
| coID | `Apple2Video` |
| hostPCODE | `A2BO` |
| deviceIdx | `4` |
| description | `Apple II WebGPU video` |
| mode name | `webgpu` |

Append `{name:"webgpu", ctor:Apple2VideoWebGPU, context:"canvas"}` to MUX's renderModes. Appending preserves existing numeric indices and the current default. Reuse MUX's context-clean canvas clone; obtain its `webgpu` context inside the device.

Expose the existing contract: `reset`, `cycle`, `redraw`, `presentRasterFrame`, `write`, `addrVisible`, all four mode setters, `setMonitor`, `setCharRom`, palette getters, `setCol`, `hgr_PixelColor`, and `ctrl_dlg`. Maintain `vidram`, `hw`, `frameTiming` and character-ROM identity as MUX expects.

Add optional `activate()` and `deactivate()` hooks to MUX. Existing renderers require no new methods. Registration constructs metadata only; reset initializes logical state; activation alone requests GPU resources. Opening device controls must not allocate a GPU device.

The controls show initialization status, a maximum submitted-frame rate and measured submitted fps, following GPU.js's existing control pattern. Keep measured fps labeled as submissions, not GPU completion or monitor refresh. No synthetic speaker feedback is required.

## Native mode coverage

| Mode | Active display |
| --- | --- |
| Text | 40 columns × 24 rows, 7 × 8 glyph cells |
| Lores | 40 × 48 blocks, 16 palette colors |
| Mixed lores | 40 × 40 graphics blocks plus four text rows |
| Hires | 280 × 192 logical pixels with artifact colors |
| Mixed hires | 280 × 160 graphics pixels plus four text rows |

Support page 1 and page 2 in every relevant mode; normal, inverse and flashing text; MUX-selected character ROM; color, black-and-white, green and amber monitor settings.

Use the existing 560 × 384 canvas backing size, duplicating each logical pixel 2 × 2. Derive top-origin coordinates from fragment position; WebGPU must not inherit GPU.js's bottom-origin y inversion.

For logical coordinates `x,y`, let `col=floor(x/7)`, `row=floor(y/8)`. Text/lores addressing is `base + ((row & 7)<<7) + floor(row/8)*40 + col`, with base $0400 or $0800. HGR addressing is `base + ((y & 7)<<10) + ((y & $38)<<4) + floor(y/64)*40 + col`, with base $2000 or $4000. Mixed mode becomes text at y=160.

Text uses the existing ROM lookup `(((d & 63)^32)*8)+(y & 7)` and attribute rules. Lores selects the low nibble for the top half of each text cell and the high nibble for its bottom half.

HGR uses the existing three-bit neighborhood, global horizontal parity and bit-7 color-phase selection. Neighbor reads cross byte boundaries but stop at scanline edges; in captured frames they also stop at a neighbor whose captured mode is not HGR. Port Apple2RasterKernel's decision logic as the common reference. Do not carry forward GPU.js's reads into screen holes at row edges.

The first version matches the current discrete artifact-color model. A physically shifted half-dot/composite NTSC simulation would be a separate design. Monitor colors use GPU.js's existing numeric INTCols table and normalization consistently across both paths; palette edits update both exposed color tables and GPU data.

## Data and shader layout

| GPU input | Representation | Update policy |
| --- | --- | --- |
| Timer-mode video RAM | Packed bytes in a 24 KiB read-only storage buffer | Full snapshot on a dirty submitted frame |
| Captured raster | Two 7,680-byte packed planes: bytes and modes | Latest completed frame |
| Character ROM | Packed, four-byte-padded storage buffer | First draw and ROM change |
| Palette | 64 RGB vectors, converted once from the numeric palette | First draw and palette edit |
| Parameters | Aligned uniform block | Source kind, mode flags, chrome and flash |

Use WGSL `array<u32>` buffers for packed byte data. Byte lookup extracts `(word >> ((index & 3)*8)) & 255`. Explicitly define little-endian packing; use a reusable staging buffer where necessary. Upload offsets and lengths must satisfy WebGPU's four-byte requirements. Avoid expanding each byte into a separate u32.

Both source paths share text, lores and HGR color functions. Timer mode computes addresses from mode flags. Raster mode reads `i=y*40+col` and the captured mode value: 0=text, 1=lores, 2=HGR. Page selection is already embodied in captured bytes.

Keep buffers, bind groups and pipeline for the device lifetime. Acquire the canvas's current texture for each submission. Render opaque output. No normal-frame GPU readback, CPU RGB framebuffer or intermediate compute pass is needed.

Initially upload the full small RAM snapshot rather than introduce dirty-range bookkeeping. At 60 submissions/sec, this is about 1.4 MiB/sec before ROM/palette updates. GPU transfer bandwidth is only one part of total cost; browser scheduling and capture CPU work still matter.

## Timing and dirty state

In timer mode, `cycle(ticks)` advances the existing emulated flash clock and frame eligibility. A single pending requestAnimationFrame coalesces redraw requests. At submission, read a current RAM snapshot and matching current mode/ROM/monitor state synchronously. A configured maximum submission cadence caps dirty frames.

`write(addr,d8)` is notified before hardware commits the RAM write. Compare the old byte, mark relevant visible output dirty, and leave RAM mutation to hardware. Hidden-page writes need not redraw until the page is selected; selection invalidates the full output. Upload the snapshot after the writes have completed.

In vertical-blank mode, MUX remains the scheduler. `presentRasterFrame(frame,state)` uses frame.bytes, frame.modes and frame.flash exclusively for the captured picture. Never replace those bytes with a fresh RAM dump or the captured modes with current global flags. Monitor and ROM selection come from MUX.

Do not start an additional timer or RAF loop for raster mode. While initializing or waiting for a submission slot, retain only the newest complete frame. Use a bounded in-flight submission policy, initially two slots; completion callbacks free slots and request at most one presentation of the latest pending frame. Do not await GPU completion in the CPU runner.

Reset, deactivation or timing changes invalidate pending work through a generation token and cancel owned RAF callbacks. Flash continues from emulated ticks rather than wall-clock GPU readiness.

## Initialization, switching and failure

Lifecycle states: idle, initializing, ready, unavailable, lost and disposed.

Activation requests an adapter/device and creates the context, buffers and asynchronous render pipeline. Handle absent navigator.gpu, a null adapter, rejected requests, compilation/validation errors and device.lost.

MUX keeps its synchronous public selection API. When selecting a WebGPU renderer that is not ready, it records the selected target but keeps the previous canvas visible until readiness; the retained picture may be briefly frozen. No previous renderer continues submitting frames. Once ready, attach WebGPU's canvas and present the latest valid input only if the selection and generation still match.

A failure affecting the currently selected WebGPU device selects the existing canvas device through MUX's normal device-selection method, preserving state, radio selection, canvas attachment and observer notifications. The UI reports the reason briefly. A late failure or readiness callback from an inactive selection must not change the active device.

Keep a failed WebGPU device visible in the device list with its status, but skip it during automatic next-device cycling. Explicit selection can retry initialization. Retry requests a fresh adapter and device and performs a full upload; never run an unbounded recovery loop.

Machine reset resets logical state without rebuilding a healthy GPU pipeline. Deactivation stops submissions while retaining reusable resources. Disposal releases buffers, context and the owned GPU device.

## Files affected

| File | Planned change |
| --- | --- |
| res/EMU_DEVICE_video_WebGPU.js | New device, WGSL, controls and lifecycle |
| res/EMU_DEVICE_video_MUX.js | Append renderer; optional activation/deactivation/readiness handling; fallback and cycling behavior |
| index.html | Explicit script inclusion before MUX |
| docs/WEBGPU_VIDEO.md | Usage, compatibility and validation notes |

The existing beam-capture and CPU/hardware timing interfaces are sufficient. No CPU runner changes are proposed. Device metadata is discovered through MUX's existing registration; no new peripheral-specific logic belongs in index.html.

## Acceptance and validation

1. Compare deterministic frames against Apple2RasterKernel's CPU reference for every listed mode, both pages, four monitor settings, and both flash phases. Include all text attributes and selectable ROMs.
2. Exercise HGR patterns at byte boundaries, both bit-7 states, scanline edges, solid white and alternating color patterns. Confirm mixed-mode transition at y=160 and correct orientation/scaling.
3. Render captured frames containing mode changes, page switches and writes during the scan. Run the existing Vaporlock scenario with vertical-blank lock.
4. Switch repeatedly between all MUX devices during initialization and rendering. Verify no late callback steals the canvas, no inactive submissions occur, and exactly one overlapping device remains selected.
5. Test missing WebGPU, null adapter, shader failure, device loss, explicit retry, reset, ROM change and timing change. Confirm fallback preserves current output state.
6. Use real WebGPU browsers to compile WGSL and inspect validation errors. Compare pixels via test-only readback; allow only documented palette quantization tolerance.
7. Benchmark idle text, flashing text, changing lores/HGR and raster capture against GPU.js at identical timing, size and palette settings. Record JS time, submissions, dropped/coalesced frames and upload bytes. Use optional GPU timestamps only when supported.

Design review can now settle naming and any desired visual differences before a patch is prepared.

## References

- [Current MUX](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/46787f88ca2c0ea387aa7a28a26748b4a679b735/res/EMU_DEVICE_video_MUX.js)
- [Current GPU.js device](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/46787f88ca2c0ea387aa7a28a26748b4a679b735/res/EMU_DEVICE_video_GPU.js)
- [Raster capture and common kernel](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/46787f88ca2c0ea387aa7a28a26748b4a679b735/res/EMU_VIDEO_raster.js)
- [WebGPU specification](https://www.w3.org/TR/webgpu/)
- [WGSL specification](https://www.w3.org/TR/WGSL/)

