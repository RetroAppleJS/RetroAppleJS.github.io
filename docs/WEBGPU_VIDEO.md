# Apple II+ WebGPU video

The **Apple II WebGPU video** device is an additional motherboard display backend. Its mode name is `webgpu` and its device code is `A2WGPU`. The existing GPU.js, wave, three.js and Canvas devices remain available; the default display is unchanged.

Select it through the motherboard video device selector or by cycling the display renderer. The existing URL renderer setting also accepts `webgpu`. The backend requires a browser offering WebGPU in a secure context, normally HTTPS or localhost. Availability depends on the browser, platform and GPU; the presence of `navigator.gpu` alone does not guarantee successful initialization.

## Supported output

| Native II+ mode | Display |
| --- | --- |
| Text | 40 × 24 character cells, normal/inverse/flashing |
| Lores | 40 × 48 blocks, 16 colors |
| Mixed lores | 40 × 40 graphics blocks plus four text rows |
| Hires | 280 × 192 logical pixels with artifact colors |
| Mixed hires | 280 × 160 graphics pixels plus four text rows |

Both pages, the selectable character ROMs and color/B&W/green/amber monitor settings are supported. Output uses the existing 560 × 384 canvas, with 2 × 2 duplication of logical pixels. The renderer follows the existing raster kernel's discrete artifact-color rules, including HGR bit-7 color selection and byte-boundary neighborhoods. It does not simulate an analog NTSC waveform or add IIe 80-column/double-hires modes.

## Timing and controls

In normal timing, visible RAM writes and mode changes mark the picture dirty. The device snapshots compact video RAM when submitting a dirty frame. Its control panel offers a maximum frame rate from 10 to 60 fps, initially 50 fps, and measured **submitted** fps. Browser refresh, GPU speed and dirty-frame frequency also affect this number; it does not measure completed GPU frames.

With the SYSTEM fps indicator locked to **vertical blank**, MUX supplies completed beam-capture frames. WebGPU uses the bytes, per-fetch modes and flash state captured during that scan. Page or mode changes during a scan are retained. The device's normal frame-rate slider does not throttle this capture path: MUX coalesces complete captures to browser presentation opportunities, and the backend bounds outstanding GPU submissions to two. If busy, only the newest pending completed picture is retained.

Changing monitor or character ROM reapplies the selection to the next picture. Switching devices preserves MUX state. Pending pictures are discarded on reset, deactivation and timing changes; a healthy GPU pipeline is retained for reuse.

## Initialization and fallback

GPU resources are created on activation. Merely registering devices or opening controls does not request a GPU adapter. During initialization, the previous canvas remains visible, briefly retaining its last picture.

MUX registers WebGPU only when its explicit script include is present, so existing standalone tools using the four legacy devices still work. Selection also stops queued GPU.js draws and the Three.js animation loop while those devices are inactive, resuming them when selected again.

If WebGPU is unsupported, initialization fails or the device is lost, MUX selects its existing Canvas backend and preserves the current mode, page, monitor, ROM and timing state. The WebGPU control panel exposes status. Failed devices are skipped by automatic cycling; selecting WebGPU explicitly retries with a fresh adapter/device. There is no automatic retry loop.

The implementation uses one full-screen triangle and a WGSL fragment shader, compact packed-byte input buffers, and persistent pipeline/bind-group resources. Normal rendering has no CPU RGB framebuffer or GPU readback. Character ROM buffers grow when a larger selected ROM requires it.

## Validation

Run the complete Node regression suite:

```sh
node --test tests/*.test.js
```

The browser test renders real WebGPU output and compares pixels to `Apple2RasterKernel` through test-only texture readback. It covers native modes, pages, monitor palettes, flash phases, all current ROM selections, HGR row/byte boundaries, per-fetch mode transitions, timer mode and palette edits. One byte of color quantization tolerance is permitted; alpha must be fully opaque. Missing WebGPU or shader validation errors fail the test.

Open `tests/video_webgpu_browser.html` through a local HTTP server to run it interactively. For automated software-GPU validation, install Playwright as a test dependency and run:

```sh
npm install --prefix /tmp/retroapple-webgpu-tests playwright@1.62.1
node /tmp/retroapple-webgpu-tests/node_modules/playwright/cli.js install --with-deps chromium
NODE_PATH=/tmp/retroapple-webgpu-tests/node_modules node tests/run_video_webgpu_browser.cjs
```

`WEBGPU_CHROMIUM_PATH` can select an existing Chromium binary. The runner enables software WebGPU for testing only and uses the browser's bundled SwiftShader Vulkan ICD when present. Those browser flags are not required by the production device.

The `WebGPU video regression` pull-request workflow runs both Node and browser checks. Browser reference comparisons establish shader parity; a Vaporlock/step-trace scenario on actual hardware remains a useful manual timing acceptance check.

An activation in vertical-blank mode can submit the retained capture twice as readiness and MUX presentation meet. The queue remains bounded and pixels are identical; removing this one-time extra submission is a follow-up optimization.

## Comparing performance

Compare GPU.js and WebGPU on the same machine, browser, 560 × 384 backing size, monitor palette and timing setting. Exercise idle text, flashing text, animated lores/HGR, page switching and vertical-blank capture. Record JavaScript time, submitted frames, coalesced pictures and upload traffic using browser developer tools. Separately account for the CPU cost of beam capture.

WebGPU uploads at most 24 KiB of RAM per normal submitted frame, about 1.4 MiB/s at 60 fps before occasional ROM/palette updates. It uploads 15 KiB for a captured picture. The small transfer volume and explicit pipeline make overhead predictable; they do not establish a speedup. No measured hardware performance claim is made here.
