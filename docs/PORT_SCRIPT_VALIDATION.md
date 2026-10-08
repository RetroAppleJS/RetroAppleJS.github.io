# Port Script verification record

Base commit: `01aa9a934723ec0e2f76f859409435d2a7e3229f`.

- New facade/UART/runtime tests: 16 passed, 0 failed. Includes real worker-thread termination, pathological RegExp timeout, default timeout RPC, console channels, inactive device detach and callback cleanup.
- Archived upstream suite before changes: 767 tests; 739 passed, 28 failed.
- Archived upstream suite after changes plus new tests: 783 tests; 755 passed, the same 28 failed. No new failures.
- DOM integration harness using actual card, terminal and console code plus real worker threads: 11 scenarios passed (split DOM, UART/console RPC, runaway Stop, pending wait cancellation, syntax/runtime/timeout errors, callback errors, generated help, close/reopen, slot switching/persistence, device detach, card unmount). This checks DOM behavior, not browser rendering.
- Native browser visual test remains unverified: Chromium crashes with SIGSEGV before startup in the execution environment, including for --version. The Playwright test is included for an environment with working Chromium.

## Existing upstream failures

These were present in the original archived `tests.zip` suite and remain unchanged:

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
