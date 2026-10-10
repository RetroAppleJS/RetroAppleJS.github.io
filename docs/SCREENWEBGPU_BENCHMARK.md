# ScreenWEBGPU: raw WebGPU performance test

Open `tools/ScreenWEBGPU_BENCH.html` through the project website or a local HTTP server. The tool benchmarks the WGSL shader exported by `EMU_DEVICE_video_WebGPU.js` without using the emulator hardware loop, renderer FPS control, requestAnimationFrame or the production renderer's two-frame queue. The production renderer and MUX are unchanged.

## Workload

The controls match the GPU.js benchmark: text, lores, mixed lores, hires and mixed hires; page 1/2; character ROM; monitor palette; requested-FPS sweep; bounded batches; repetitions; uncapped demand; and optional JavaScript/WASM dispatch. Output remains 560 × 384.

The shader supports two input layouts:

- **RAM decoding:** upload 24 KiB of Apple II video RAM and let the WGSL shader calculate addresses and modes.
- **Beam capture decoding:** upload 7680 fetched bytes followed by 7680 per-fetch mode values. Capture construction occurs before timing.

A deterministic 32-frame pool is prepared before measurement, and each driver restarts at the same pool position. **Include RAM snapshot allocation/copy** performs a new 24 KiB `slice()` for each RAM submission and includes that CPU work in throughput and submission timing. It has no effect on beam-capture input.

Device creation, WGSL compilation, render-pipeline creation and three warm-up batches per point are excluded. Dynamic input and parameter uploads, command encoding, submission, execution and observed completion remain inside each throughput measurement.

## Raw submission path

The benchmark uses `Apple2VideoWebGPU.SHADER` and `Apple2VideoWebGPU.PALETTE`, with the same storage/uniform buffer layout as the production renderer. It owns a separate WebGPU device, canvas context, pipeline and buffers so it can submit arbitrary bounded batches. It does not call the device's private scheduling path and therefore does not measure the production two-frame queue, FPS cap or MUX timing.

JavaScript and WASM drivers call the same synchronous submission callback once per render. WASM only owns the loop; `queue.writeBuffer()`, command encoding and WebGPU submission still cross into browser JavaScript for every render. It does not move WebGPU work into WASM or suppress browser/OS activity.

## Completion and demand

Only one batch is outstanding. After submitting every render in that batch, the harness awaits `queue.onSubmittedWorkDone()`, which observes all work submitted to that queue before the call. Frames are counted after this completion point, never at submission.

Paced points wait for the next batch deadline. Missed deadlines do not create an unlimited catch-up queue. **MAX** begins a new batch immediately after the previous batch completes. Stop and tab hiding interrupt pacing, while an already-submitted batch is drained before resources are released.

The reported sustainable tested rate requires every repetition to deliver at least 95% of requested throughput and keep p95 batch completion latency within `batch size × 1000 / requested FPS`. When a passing and failing rate bracket exists, two midpoint rates refine it. Maximum completed FPS is a measured point, not a universal hardware limit.

## Measurements

| Field | Interpretation |
| --- | --- |
| Completed FPS | Finished shader renders divided by complete measurement wall time |
| CPU ms/render | Time around input preparation, `writeBuffer()`, command encoding and `queue.submit()`, divided by frames |
| Batch p50/p95 latency | First submission call through observed completion of the entire batch |
| Missed budget | Requested frames for elapsed time minus completed frames, clamped at zero |
| Upload call ms | CPU duration of the two dynamic `queue.writeBuffer()` calls in a separate diagnostic sample |
| Upload KiB/render | Input plus 32-byte parameter payload passed to `writeBuffer()` |
| Upload complete ms | From completion of the two upload calls until the queue reports that those writes have completed |
| GPU draw ms | Timestamp-query interval around one isolated WebGPU render pass |

Upload profiling and GPU timestamps use separate diagnostic submissions after each throughput point. Upload-complete time includes queue state, promise delivery and browser overhead; it is **not physical DMA time**. It is intentionally not subtracted from batch latency. GPU draw time requires the optional `timestamp-query` adapter feature. Unsupported or invalid timestamp results appear as **N/A**.

The configured WebGPU canvas includes `COPY_SRC` usage solely so the final untimed render can be copied to a mapped buffer and retained as a 2D preview after the benchmark device is destroyed.

Graphs use the median across repetitions; exports retain every individual result. JSON also records exact options, user agent, adapter description, canvas format, completion strategy and timestamp-query availability. Retain JSON with CSV when comparing systems.

## Comparison with GPU.js

Use the same mode, input path, page, character ROM, monitor, rates, batch size, duration, repetitions, dispatch driver and snapshot setting in `ScreenGPU_BENCH.html`. Compare completed FPS and batch latency first. CPU submission and upload payloads describe different APIs and should not be assumed equivalent. GPU.js WebGL timer queries and WebGPU timestamp queries also have different availability and implementation constraints.

For a stable hardware tipping point, use at least 5 seconds per point, three repetitions, and repeat with batch sizes 1, 8 and 32. Keep the browser tab visible and close other GPU-intensive applications.

## Verification

```sh
node --test tests/*.test.js
npm install --prefix /tmp/screenwebgpu-tests playwright@1.62.1
node /tmp/screenwebgpu-tests/node_modules/playwright/cli.js install --with-deps chromium
NODE_PATH=/tmp/screenwebgpu-tests/node_modules node tests/run_screenwebgpu_browser.cjs
```

The Chromium smoke test exercises both input layouts in all five video modes, both dispatch drivers, queue completion, optional timestamps, preview readback, the real form and JSON/CSV downloads. Software WebGPU in CI establishes functionality, not performance on a physical GPU.
