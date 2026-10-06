# Fixed-rate Mockingboard validation

Patch base: `7c88dc2e384e77540a4c3c76108119a0fb273c67`.

## Delivered behavior

The peripheral uses fixed 22,050 Hz stereo PCM and the 2x economy profile in
both numerical backends. Web Audio resamples these buffers to the host output
rate. The native AY clock stays fixed; CPU speed changes note duration.
The existing browser pacing/interruption fix is preserved. The reference 8x
renderer remains the shared API default for the standalone FYM player.
PCM filtering intentionally differs between the two profiles.

The 250 ms stereo PCM ring drops from 11,025 to 5,513 frames (88,200 to 44,104
bytes). Per-chip state and the WASM module's fixed 2 MiB memory budget remain.
The retained sample-rate setter accepts only 22050; incompatible requests fail
before changing core phase, queued output or backend activation.

## Verification

New tests failed against the original implementation for missing profiles and
fixed-rate PCM behavior. A further red/green check verified the constant-rate
setter guard. Final validation included:

- 90 focused tests passed: core/ABI, all envelope shapes, tone/noise/envelope
  clocks, snapshots, block splits, reset, FIFO pressure, VIA IRQ timing,
  backend selection, audio lifecycle and cadence.
- A clean archive of the base accepted the patch with `git apply --check`,
  applied it, and passed all 77 tests shipped with the patch/base.
- Two seconds of controlled SYSTEM execution at 10/60/100 fps generated 44,100
  PCM frames and executed every requested nominal CPU tick, for JS and WASM.
- Mock AudioContexts at 44,100 and 48,000 Hz both received 22,050 Hz buffers.
- Real card/sink orchestration at 2x/1x/0.5x CPU produced 0.1/0.2/0.4-second notes,
  identical initial PCM and unchanged 638.625 Hz tone pitch.
- JS/WASM economy PCM agreed within 1e-7 across all 16 envelope shapes,
  mixed AY/YM chips, noise, repeated R13 writes, register events and chip reset.
- Independent review compared nonzero reference PCM and old snapshot
  continuation against the actual base implementation: bit-identical for
  both JS and WASM.
- The embedded WASM was rebuilt using Zig 0.14.1's Clang driver targeting
  freestanding wasm32 with strict floating-point flags. Its source fingerprint
  matches the checked-in C/header/adapter/build inputs.

The browser presentation boundary is represented by an AudioContext test double.
These checks do not establish subjective audio quality or whole-emulator browser
performance. The tests exercise the real SYSTEM loop, IO, card, cores and sink,
with CPU instructions/video replaced only to isolate admission behavior.

## Numerical rendering benchmark

Run `node tools/ay_core/benchmark_render.cjs`. This benchmark renders two active
AY chips with tone, noise and envelope output, in reusable 512-frame blocks.
It warms up 500 blocks and takes the median of five 1,000-block runs, including
PCM copying through the shared API. Values below are milliseconds of wall time
per synthesized audio second, measured separately from test execution under
Node v24.19.0. They are local numerical-render timings, not browser
CPU percentages or expected whole-emulator speedups.

| Backend | Previous 44.1 kHz / 8x | 22.05 kHz / 8x | New 22.05 kHz / 2x | Render speedup vs previous |
| --- | ---: | ---: | ---: | ---: |
| JS | 29.637 | 18.267 | 6.143 | 4.82x |
| WASM | 27.066 | 15.725 | 3.762 | 7.19x |

## Broader archived suite

Restoring `tests.zip` without overwriting tracked tests yielded 586 tests,
558 passes and 28 failures before changes. After adding 30 new regressions and
updating rate-dependent expectations, the same command
`node --test tests/*.test.js` yielded 616 tests, 588 passes and the identical
28 failing test names. The full archived suite is not green. The three updated
Mockingboard source/hot-path/card test files are included in the patch; unrelated
archived tests are not.

Existing failures:

- active emulator and Composer layouts carry all four persistent Disk II semantic IDs
- runtime compositor never infers Disk II semantic identity from artwork or geometry
- Composer import and export round-trip emulator semantic IDs independently of editor identity
- Composer validation rejects duplicate semantic IDs and exposes an optional Runtime ID editor
- duplicate semantic layer ids are rejected
- LAYOUT constructor installs as oCOM.LAYOUT and applies pending Disk II facade state
- generic visibility API updates runtime layer model and DOM element atomically
- Disk II drive visuals delegate to the Apple II layout API
- default Apple II Plus boot mounts AppleMouse in physical slot 4
- fixed scenario companion is mounted in viewport coordinate space
- layout companion prefers the right side, falls back left, and uses a narrower preferred width
- Disk II declares D1 and D2 as singleton layout-controlled devices
- Disk II body and gap images receive stable runtime layer ids
- Disk II gap shadow uses an owner-level allAttached layout rule
- layout visibility uses opacity and visibility instead of display toggling
- DiskJS uses only the canonical AppleDisk2 component ID
- the original DSCAN $1D03 sync entry captures color PAGE2 without its bit-7-clearing merge
- DITHER2 redirects the stock DSCAN $1C00 entry to one PAGE2 color capture
- camera OFF captures the exact Apple II logo HGR page, including phase bit 7
- near-neutral camera changes retain phase, while a real hue change can update bit 7
- stock DSCAN 4.2 runs four comparator captures and builds all five Bayer densities in PAGE2
- raw host camera frame is exposed synchronously to DSCAN and captured into HGR
- a transient canvas failure keeps the last complete frame until the next processing frame
- camera RGB samples retain continuous luminance and adjustments affect the next capture immediately
- each processing frame replaces the camera frame and reset prevents further sampling
- reset stops processing-frame camera sampling and clears the host frame
- Liron advertises HD20 as optional and attaches mixed SmartPort devices to distinct units
- UniDisk Surface Map capability button toggles the popup open and closed

## Applying and rebuilding

```sh
git apply --check RetroAppleJS-mockingboard-22050Hz.patch
git apply RetroAppleJS-mockingboard-22050Hz.patch
node --test tests/*.test.js
```

The rebuilt embedded WASM is included; ordinary playback needs no compiler.
The patch updates source files. `dist/RetroAppleJS.html` is regenerated by the
repository's existing standalone build workflow when source changes are pushed.
Reload updated scripts when testing the source `index.html` locally.
