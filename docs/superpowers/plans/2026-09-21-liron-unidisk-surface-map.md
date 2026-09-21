# Liron UniDisk Surface Map and Per-Device Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the stale UniDisk download control, make LIRON rows identify the exact SmartPort device and instance, rename the runtime UniDisk DCODE to `UNIDISK`, add per-device capability buttons, and implement a device-specific 800 KiB surface-map popup with two side-by-side 80 × 12 sections and one 512-byte cell per real sector.

**Architecture:** Keep `EMU_deviceMediaRowHTML()` as the shared removable-media row renderer, add optional right-side capability actions, and keep LIRON responsible for exact-unit UI state. Media changes synchronize existing DOM controls in place so successful browser file selection is preserved. `UniDisk35Device` exposes deterministic surface geometry/mapping; its implementation class/file names stay unchanged while runtime DCODE changes atomically from `UNIDISK35` to `UNIDISK`. The LIRON surface map uses its own popup and exact `(slot, unit, attachment instance)` context. Disk II remains unchanged.

**Tech Stack:** Browser JavaScript, RetroAppleJS Apple2IO/LIRON/SmartPort device model, `oCOM.POPUP`, Node.js `node:test` + `vm`, Playwright/Chromium.

**Spec:** `docs/superpowers/specs/2026-09-21-liron-unidisk-surface-map-design.md`

## Global Constraints

- Keep `UniDisk35Device`, `EMU_DEVICE_UNIDISK35.js`, and `Apple UniDisk 3.5`; only runtime DCODE changes to `UNIDISK`.
- Rename all active runtime `UNIDISK35` references atomically; filenames/class names may retain `UNIDISK35`.
- Preserve Disk II's separate Software Catalog / Disk Surface Map toolbox unchanged.
- Preserve the native UniDisk `<input type="file">` and selected filename after successful load; do not rebuild the row to fix stale controls.
- Right-side order is Download first, then device capabilities. Unsupported capabilities are absent.
- Empty UniDisk keeps Download and Surface Map visible but disabled.
- Surface map targets one exact attachment instance; do not silently retarget a replacement at the same unit.
- Geometry is 2 sides × 80 tracks; 16-track zones have 12/11/10/9/8 sectors; one 512-byte cell per real sector; exactly 1600 active cells.
- No filesystem coloring, write-history overlay, head animation, Software Catalog for LIRON, or Disk II refactor.
- Do not hand-edit/commit `dist/RetroAppleJS.html`; the main-branch standalone-build workflow owns it.

## Review Focus

- Root regression: device state changes, but the row intentionally survives; existing Download/Surface controls must update in place.
- Successful load must preserve browser-selected filename; eject may clear it.
- `device.attach.hash` supplies four-digit uppercase instance identity for the eject tooltip.
- Only capable UniDisk rows receive Surface Map; HD20/serial/printer children do not.
- Geometry/block mapping must be exhaustive, unique, and cover 819200 bytes exactly.
- LIRON popup must not collide with Disk II `surfaceMap_popup` state.

### Task 1: Rename the UniDisk runtime DCODE atomically
Update runtime tests/fixtures to expect `UNIDISK`, run RED, implement the production rename while retaining class/file names, audit old tokens, run GREEN, and commit `refactor: rename UniDisk runtime device code`.

### Task 2: Expose exact UniDisk 800K surface geometry
Add RED tests for `getSurfaceMapGeometry()`, `getSurfaceTrackSectorCount(track)`, `surfaceSectorToBlock(side,track,sector)`, and `blockToSurfaceSector(block)`, including exhaustive round-trip coverage of 1600 blocks. Implement cylinder/side ordering across the 12/11/10/9/8 zones, run GREEN, and commit `feat: expose UniDisk surface geometry`.

### Task 3: Generalize the shared media row into an action strip
Add RED renderer tests for optional `spec.capabilityActions`. Render Download first and capability actions afterward without changing file-input behavior. Run GREEN and commit `feat: add per-device media row actions`.

### Task 4: Give LIRON rows exact identity and synchronize media controls in place
Add RED row identity/capability assertions and DOM synchronization regression. Factor exact-unit lookup and instance formatting. Build the UniDisk Surface Map capability and `deviceToolSyncMediaControls(unit)`. Run GREEN and commit `fix: synchronize Liron per-device media controls`.

### Task 5: Implement the exact-instance UniDisk surface-map popup
Create `tests/liron_surface_map.test.js`, add RED popup/model tests including 1600 active and 320 inactive cells, register popup scope `lironSurfaceMap_popup`, create exact-target context, render two side-by-side 80 × 12 sections, wire toggle/retarget/eject-no-media behavior, run GREEN, and commit `feat: add UniDisk device surface map`.

### Task 6: Add browser acceptance for the real regression and popup layout
Create `tests/liron_surface_map_browser_acceptance.js`, exercise the real file-input path, assert preserved filename, enabled controls, 1600/320 cells, viewport fit, and eject behavior. Add workflow coverage and commit `test: cover UniDisk surface map in browser`.

### Task 7: Full regression, standalone-build verification, and final audit
Syntax-check touched JavaScript, run related Node regressions and browser acceptances, audit remaining runtime `UNIDISK35` tokens, verify the standalone build without retaining generated `dist/RetroAppleJS.html`, and confirm `res/EMU_CARD_appledisk2.js` is unchanged.
