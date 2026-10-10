# ScreenGPU: raw GPU.js performance test

Open `tools/ScreenGPU_BENCH.html` through the project website or a local HTTP server. This tool benchmarks the current `EMU_DEVICE_video_GPU.js` implementation directly, using the bundled GPU.js library. It does not run the emulator hardware loop, call `cycle()`/`redraw()`, use the FPS slider, or pace submissions through requestAnimationFrame. WebGPU is outside this benchmark's scope.

## Workload

Choose text, lores, mixed lores, hires or mixed hires, page 1/2, character ROM and monitor palette. Output stays at the native 560 × 384 backing size. The two input paths are:

- **RAM:** call the device's actual `kProcess_v6` GPU.js kernel with 24 KiB video RAM, ROM and serialized configuration.
- **Beam capture:** call the actual `Apple2RasterKernel` through GPU.js, with 7680 bytes and 7680 per-fetch mode values, ROM, palette, monitor and flash inputs. Capture preparation is outside the timed interval.

A deterministic 32-frame pool is prepared before timing. Both drivers restart at the same pool position. By default, the harness reuses these buffers. **Include RAM snapshot allocation/copy** enables a fresh 24 KiB `slice()` before each RAM kernel call, matching the normal device's snapshot operation. This includes allocation and copy in CPU and completed-throughput measurements. It has no effect on beam-capture input.

Kernel compilation and three warm-up batches per measurement are excluded. GPU.js/WebGL validation, packing, uploading and drawing remain part of the measured kernel call. After timing ends, one untimed render/readback preserves the preview before the GPU context is released. The production renderer, MUX and WASM CPU accelerator are unchanged.

## Dispatch drivers

JavaScript and WASM perform the same loop and call the same JavaScript callback once per frame. WASM changes only dispatch; it does not port GPU.js to WASM, eliminate allocations within GPU.js, or isolate OS/browser background activity. Compare the drivers rather than assuming WASM is faster.

The embedded WASM bytes in `ScreenGPU_benchmark.js` encode this complete module; no compiler or extra runtime download is required:

```wat
(module
  (import "env" "frame" (func $frame (param i32)))
  (func (export "run") (param $count i32) (local $i i32)
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
        (call $frame (local.get $i))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))))
```

## Completion and demand

Only one bounded batch is outstanding at a time. Every point counts frames after batch completion, never after submission alone. WebGL2 uses a fence, flush and nonblocking polling through MessageChannel tasks. WebGL1 lacks those fences and uses explicitly labelled blocking `gl.finish`, followed by a task yield. These completion strategies should not be compared as if they were identical.

For paced points, the harness waits until the next batch deadline. A batch of eight at 240 requested FPS has a 33.33 ms interval. If work overruns, demand is missed; the harness does not enqueue unlimited catch-up work. **MAX** submits the next batch as soon as the previous batch completes. MessageChannel yields and completion observation overhead remain in wall time.

The requested FPS sweep increases demand. Repetitions alternate JavaScript/WASM order. When a passing and failing requested rate bracket exists, two additional midpoint rates refine it. The reported sustainable tested rate requires every completed repetition to achieve both:

- At least 95% of requested throughput.
- p95 batch completion latency within `batch size × 1000 / requested FPS` milliseconds.

The sustainable boundary is conservative: the first failing tested rate stops the contiguous passing range. If the initial rate fails, it reports no established sustainable rate. If all rates pass, the tipping point has not been reached. Maximum completed FPS is the best measured point, not a universal hardware limit. Increase/repeat the sweep and vary batch size, especially 1, 8 and 32, to distinguish per-batch completion overhead from kernel saturation.

## Measurements

| Field | Interpretation |
| --- | --- |
| Completed FPS | Finished kernel renders divided by total measurement wall time, including waits and final completion |
| CPU ms/render | Time around the complete dispatch batch, divided by its frame count; includes GPU.js preparation/submission and optional snapshot copy |
| Batch p50/p95 latency | First call to observed completion of the whole batch; includes driver/browser notification delay, not exact per-frame or display latency |
| Missed budget | Positive difference between requested frames for elapsed wall time and completed frames; no actual submitted renders are silently discarded |
| Upload call ms | Median of three separate diagnostic renders, timing `texImage2D`/`texSubImage2D` calls on the CPU |
| Upload KiB/render | Typed-array payload bytes handed to those calls; includes library packing/padding and ROM/config uploads, not physical bus traffic |
| GPU draw ms | Median valid GPU timer samples around the single `drawArrays` command in separate diagnostic renders; excludes texture-upload calls |

GPU profiling runs after each throughput measurement and uses `EXT_disjoint_timer_query_webgl2` or `EXT_disjoint_timer_query` when available. Unsupported, disjoint or ambiguous samples show **N/A**. The tool never interprets CPU upload-call duration or GPU draw time as physical DMA duration. It does not subtract those values from completion latency to invent a transfer time. The diagnostic GPU draw runs on a drained queue and is not a timestamp sample taken during the throughput run.

Graphs aggregate repetitions by their median; the table and exports retain individual repetitions. In the throughput graph, requested FPS uses a logarithmic horizontal axis. MAX occupies a separate final position, not an invented request rate.

JSON export includes exact options, user agent, WebGL backend, completion strategy and timer support. CSV contains numerical measurements; retain JSON alongside it for reproducibility. Keep the tab visible: hiding it stops the run and retains partial results. Stop drains the current batch before releasing the renderer. Context loss or completion timeout fails the run visibly.

## Verification

```sh
node --test tests/*.test.js
npm install --prefix /tmp/screengpu-tests playwright@1.62.1
node /tmp/screengpu-tests/node_modules/playwright/cli.js install --with-deps chromium
NODE_PATH=/tmp/screengpu-tests/node_modules node tests/run_screengpu_browser.cjs
```

The browser smoke test exercises both real GPU.js kernels in all five native modes, both dispatch drivers, snapshot copying, completion fences, profiling, cancellation and JSON/CSV downloads. It checks valid completed measurements, not a hardware-specific performance threshold. `WEBGPU_CHROMIUM_PATH` can select a Chromium binary and `SCREENGPU_SCREENSHOT` can select the screenshot path. Software WebGL in CI establishes functionality, not performance on a physical GPU.
