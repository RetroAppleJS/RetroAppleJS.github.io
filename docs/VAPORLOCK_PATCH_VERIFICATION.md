# Vaporlock patch verification

Base: `d9d3d68d8adebd5cbe29dbafe7b65842b31b82ad` (main, 4 October 2026).

The patch covers six existing JavaScript files, this verification note,
`VAPORLOCK_BUS.md`, and `tests/apple2_vaporlock_bus.test.js`.
WASM, renderer files, index.html and STEP TRACE SCENARIO files are unchanged.

- Focused bus/CPU regressions: 15 passed, zero failed.
- Existing tests.zip suite before changes: 412 tests, 384 passed, 28 failed.
- Suite with this patch: 427 tests, 399 passed, the same 28 failures.
- No additional failure names; none of the baseline failures were hidden or changed.
- All six modified JavaScript files pass `node --check`.
- `git diff --check` passes.
- The delivered patch passes `git apply --check` and applies to a pristine copy
  of its base files. The focused suite also runs against that applied copy.

Commands:

```sh
node --test tests/apple2_vaporlock_bus.test.js
node --test --test-concurrency=1 tests/*.test.js
```

The full-suite command exits nonzero because of the pre-existing failures
listed below. No browser/Vaporshow compatibility claim is made; the
STEP TRACE SCENARIO and end-to-end test are the next step.

A fresh review identified fractional video-clock accumulation and JSR high
operand ordering. Both received failing regressions, then fixes verified
by the focused and full-suite runs. A further indexed/zero-page wrap check
covers the review's remaining test gap. JSR's activity log still records
its pre-instruction stack pointer and full instruction bytes.

## Pre-existing failing tests

- Composer import and export round-trip emulator semantic IDs independently of editor identity
- Composer validation rejects duplicate semantic IDs and exposes an optional Runtime ID editor
- DITHER2 redirects the stock DSCAN $1C00 entry to one PAGE2 color capture
- Disk II body and gap images receive stable runtime layer ids
- Disk II declares D1 and D2 as singleton layout-controlled devices
- Disk II drive visuals delegate to the Apple II layout API
- Disk II gap shadow uses an owner-level allAttached layout rule
- DiskJS uses only the canonical AppleDisk2 component ID
- LAYOUT constructor installs as oCOM.LAYOUT and applies pending Disk II facade state
- Liron advertises HD20 as optional and attaches mixed SmartPort devices to distinct units
- UniDisk Surface Map capability button toggles the popup open and closed
- a transient canvas failure keeps the last complete frame until the next processing frame
- active emulator and Composer layouts carry all four persistent Disk II semantic IDs
- camera OFF captures the exact Apple II logo HGR page, including phase bit 7
- camera RGB samples retain continuous luminance and adjustments affect the next capture immediately
- default Apple II Plus boot mounts AppleMouse in physical slot 4
- duplicate semantic layer ids are rejected
- each processing frame replaces the camera frame and reset prevents further sampling
- fixed scenario companion is mounted in viewport coordinate space
- generic visibility API updates runtime layer model and DOM element atomically
- layout companion prefers the right side, falls back left, and uses a narrower preferred width
- layout visibility uses opacity and visibility instead of display toggling
- near-neutral camera changes retain phase, while a real hue change can update bit 7
- raw host camera frame is exposed synchronously to DSCAN and captured into HGR
- reset stops processing-frame camera sampling and clears the host frame
- runtime compositor never infers Disk II semantic identity from artwork or geometry
- stock DSCAN 4.2 runs four comparator captures and builds all five Bayer densities in PAGE2
- the original DSCAN $1D03 sync entry captures color PAGE2 without its bit-7-clearing merge
