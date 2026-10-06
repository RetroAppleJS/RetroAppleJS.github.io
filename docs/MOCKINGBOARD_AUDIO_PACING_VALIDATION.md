# Mockingboard audio pacing validation

Base: `62fd5687d4cb92bb16f195adc778d64cee42b12c`.

## Scope and results

The scheduler regression loads the real Apple2Plus processing loop, Apple2IO,
Mockingboard card, JS/WASM numerical cores and browser audio sink. CPU instruction
execution, video and AudioContext are controlled doubles. Tests isolate CPU
admission and PCM lifecycle; they are not measurements of host CPU utilization
or a complete DOS boot in a browser.

Before the fix, 10 of the 14 new regressions failed: 10 fps CPU admission,
non-running contexts and interruption cleanup. After the fix all 14 pass.
Both backends execute 2043600 requested CPU ticks in two seconds at 10, 60 and
100 fps, scheduling 88200 stereo PCM frames. Suspended/interrupted/closed
contexts execute every requested tick while logical AY advances and presentation
PCM stays empty. Interruption stops queued sources and resume presents fresh PCM.

`node --test tests/mockingboard_audio_cadence.test.js
 tests/mockingboard_audio_device.test.js tests/audio_lifecycle.test.js`
completed with 26 passes, zero failures. Code review additionally ran the
cadence, device and hot-path suites: 28 passes, zero failures.

The repository has one tracked test and a broader archived suite in `tests.zip`.
Restoring that archive into `tests/` without replacing the tracked test gave:

| Run | Tests | Pass | Fail |
| --- | ---: | ---: | ---: |
| Base before runtime changes | 572 | 544 | 28 |
| Fix plus 14 new regressions | 586 | 558 | 28 |

The full command was `node --test tests/*.test.js`. The set of failing test names
is identical before and after the fix. Unrelated archived tests are not included
in this patch. The full suite is not green.

## Existing archived-suite failures

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
