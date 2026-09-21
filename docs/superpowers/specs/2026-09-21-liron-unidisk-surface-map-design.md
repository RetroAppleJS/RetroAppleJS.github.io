# Liron UniDisk Surface Map and Per-Device Controls Design

Date: 2026-09-21

## Goal

Improve the LIRON peripheral controls so each attached SmartPort device clearly identifies itself and exposes only the actions that make sense for that specific device. The first device-specific capability is a UniDisk surface map.

The change also fixes the current UniDisk download-button regression without rebuilding the native browser file input after a successful mount.

## Scope

This design covers:

1. Fixing the stale UniDisk download pictogram state after loading/ejecting media.
2. Renaming the runtime UniDisk device code from `UNIDISK35` to `UNIDISK` and showing the device name in the row label.
3. Adding instance identity to the eject tooltip.
4. Extending the shared removable-media row with optional right-side per-device capability buttons.
5. Adding a UniDisk-only `Surface Map` capability.
6. Rendering one device-specific 800 KB surface map at a time using one cell per physical 512-byte sector.

Disk II keeps its existing controller-level Software Catalog / Disk Surface Map toolbox unchanged.

## Device Row

For an attached UniDisk, the visible row label becomes:

`UNIDISK Unit1`

The runtime device code is renamed atomically from `UNIDISK35` to `UNIDISK` wherever that code is used as an attachment/routing identifier. The JavaScript class/file names may remain `UniDisk35Device` / `EMU_DEVICE_UNIDISK35.js`, because those describe the hardware implementation rather than the compact runtime device ID.

The eject button tooltip uses the attachment instance hash already assigned by Apple2IO, formatted as a hexadecimal word:

`Instance #9B05: eject disk`

The row's right edge becomes a compact action strip. Download remains the first action; optional capability buttons appear immediately to its right.

Example:

`[UNIDISK Unit1] [Choose File  ProDOS Packer 6.0.po] [Download] [Surface Map]`

A device that does not support a capability does not render its icon at all. This avoids a LIRON-wide toolbox containing actions that are meaningless for serial, printer, or other non-disk SmartPort devices.

## Shared Media-Row API

`EMU_deviceMediaRowHTML(spec)` remains the shared Disk II / SmartPort removable-media renderer.

It gains an optional capability-action collection, conceptually containing entries such as:

- icon class
- tooltip/title
- click handler
- enabled/disabled state
- optional element ID

The renderer owns only compact presentation. The peripheral/device decides which actions exist and supplies their behavior.

The existing Disk II rows remain source-compatible and need not supply capability actions.

## Download-State Regression

The current LIRON row renderer correctly determines whether UniDisk media is downloadable from the device state, but after a successful browser file load the media row is deliberately not rebuilt, so the native `<input type="file">` retains the browser-owned filename presentation. This leaves the already-rendered download control stale.

The fix is therefore an in-place row-state synchronization step after media load/eject rather than a toolbox rebuild.

For the target unit it updates:

- download enabled/disabled state
- download click handler
- download tooltip/filename
- Surface Map enabled/disabled state if media availability affects it
- eject tooltip if needed

The native file input and its selected filename remain untouched after a successful mount.

## Surface Map Geometry

The UniDisk map represents the actual 800 KB Apple 3.5-inch geometry:

- 80 tracks per side
- 2 sides
- 512 bytes per sector
- 5 zones of 16 tracks
- sectors per track by zone: 12, 11, 10, 9, 8

Per side:

`16 × (12 + 11 + 10 + 9 + 8) = 800 sectors`

Both sides:

`1600 × 512 bytes = 819200 bytes`

Every active map cell therefore represents exactly one 512-byte physical sector. No 1 KB or 2 KB aggregation is used.

## Surface Map Layout

The popup shows exactly one UniDisk instance.

The map uses **two side-by-side 12-row sections**:

- left section: Side 0
- right section: Side 1
- each section: 80 columns × 12 possible sector rows
- columns correspond to tracks 0–79
- rows correspond to sector numbers 0–11

Cells that do not exist in lower-density zones are rendered as inactive/empty positions rather than being compressed away. This keeps the five 16-track density zones visually obvious and preserves a stable coordinate system.

Conceptually:

```text
          SIDE 0                                      SIDE 1
      track 0 ................................ 79   track 0 ................................ 79
s11   ■■■■■■■■■■■■■■■■                              ■■■■■■■■■■■■■■■■
s10   ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■              ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
s09   ...                                         ...
...
s00   ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■  ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
```

Vertical separators or slightly stronger spacing mark the zone boundaries after tracks 15, 31, 47, and 63. The map should avoid heavy per-cell borders; compact cells and subtle spacing are sufficient.

The implementation should size the cells so both 80-column sections fit comfortably in the existing floating-popup style without horizontal scrolling at ordinary desktop widths.

## Surface Map Popup

The popup title identifies the exact device, for example:

`Disk Surface Map — UNIDISK Unit1`

A compact metadata line follows:

`Instance #9B05 · 800 KB · 1600 × 512-byte sectors`

There is no unit selector and no drive-cycling control in this popup. Clicking the Surface Map icon on a different row opens/re-targets the popup to that exact device instance.

The popup may reuse the existing floating popup mechanism, but its context is `(slotN, unit/instance)` rather than a controller-global Disk II selection.

## Cell Identity and Interaction

Each active cell maps deterministically to one physical sector coordinate:

- side
- track
- sector
- byte offset / 512-byte sector index

A hover/title should expose at least:

`Side 1 · Track 27 · Sector 8 · 512 bytes`

If a logical block/sector index is shown, it must be derived from the same geometry mapping rather than guessed from the visual position.

The first implementation does not need file-system semantics, catalog coloring, write-history overlays, or live head-position animation. Those are separate capabilities and are intentionally out of scope.

## Capability Ownership

The Surface Map icon is present only for UniDisk devices that expose the required geometry/media interface. Future SmartPort devices can independently expose different capability actions.

Examples:

- UniDisk: Download + Surface Map
- HD20: its own applicable actions
- serial device: no disk Surface Map
- printer: no disk Surface Map

This keeps LIRON heterogeneous-device-safe.

## Error and Empty-Media Behavior

If no UniDisk media is loaded:

- Download is disabled.
- Surface Map is disabled (or omitted if the row capability policy prefers absence for unavailable runtime state; the implementation should choose one consistent behavior and test it).
- Clicking stale controls must not throw.

After load/eject, row action states are synchronized in place.

If the popup is already open when the target media is ejected, it should render an empty/no-media state rather than reading stale image data.

## Testing

Add/adjust tests covering:

1. Runtime device code rename `UNIDISK35` → `UNIDISK` across LIRON routing/attachment code.
2. Row label is `UNIDISK Unit1`.
3. Eject tooltip includes the exact formatted instance hash.
4. Loaded UniDisk enables Download without rebuilding/clearing the native file input.
5. Eject disables Download in place.
6. UniDisk rows expose Surface Map while non-disk LIRON devices do not.
7. Surface Map targets the exact selected `(slot, unit/instance)`.
8. Geometry has 80 columns × 12 possible rows per side, with two side-by-side sections.
9. Active-cell count is exactly 1600.
10. Sector counts by track zones are exactly 12/11/10/9/8 for tracks 0–15/16–31/32–47/48–63/64–79 on both sides.
11. Every active cell maps to a unique 512-byte sector and all 819200 bytes are covered exactly once.
12. No-media/open-popup behavior is safe.
13. Existing Disk II shared-row and Disk II toolbox tests continue to pass unchanged except for any deliberate shared-renderer API assertions.

## Non-Goals

This change does not:

- move Disk II's existing Software Catalog / Surface Map toolbox into per-drive rows;
- add Software Catalog to LIRON yet;
- aggregate UniDisk sectors into 1 KB or 2 KB cells;
- add ProDOS filesystem coloring/interpretation;
- redesign all peripheral-control toolboxes;
- rename the UniDisk implementation class/file solely for cosmetic consistency.

## Success Criteria

The feature is complete when a user can load an 800 KB `.po` image into a UniDisk, immediately see an enabled Download icon, identify the row as `UNIDISK Unit1`, see the device instance in the eject tooltip, and open a device-specific Surface Map showing two side-by-side 80×12 sections with exactly one 512-byte cell for each of the disk's 1600 physical sectors.