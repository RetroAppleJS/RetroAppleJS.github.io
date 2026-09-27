# Persistent Disk II Layer IDs Design

## Goal

Make the emulator's layout schema authoritative for runtime-controllable artwork. Disk II LED and lid layers carry persistent semantic `id` values in layout data; the Composer preserves those IDs rather than forcing the emulator to infer them from filenames and coordinates.

## Schema

A layout layer remains version 1 and gains an optional semantic field:

```js
{
    id: "A2P.DISKII.D1.LED", // optional runtime identity
    file: "A2P_FULL_DISKII_LED.png",
    x: 154,
    y: 684,
    visible: true,
    shadow: { ... }
}
```

`id` is owned by the emulator schema. Static artwork may omit it. Non-empty IDs must be unique.

The four Disk II runtime IDs are:

- `A2P.DISKII.D1.LED`
- `A2P.DISKII.D2.LED`
- `A2P.DISKII.D1.LID`
- `A2P.DISKII.D2.LID`

## Runtime compositor

`COM_A2P_LAYOUT.js` validates `layer.id` directly. It must not synthesize semantic IDs from filename or X position. `legacyDiskIILayerId()` is removed. Moving a layer never changes its identity.

## Composer

The Composer is an editing shell around the emulator schema. Its private editor bookkeeping uses `uid`; `id` remains the imported/exported semantic runtime field.

Composer behavior:

- import preserves optional `layer.id`;
- duplicate non-empty semantic IDs are rejected;
- newly imported PNG layers start with no semantic ID;
- the selected-layer panel exposes an optional Runtime ID field;
- JSON, embedded JSON, and JS exports preserve `id` when present and omit it when absent;
- internal selection, dragging, z-order, and removal use `uid`, never semantic `id`.

## Data migration

Add the four persistent Disk II IDs to:

- `res/COM_LAYOUT_CONFIG.js`;
- `tools/GUI_DEV/assets/apple2-layout.json`;
- `tools/GUI_DEV/assets/apple2-layout-embedded.json`.

Do not migrate archived layouts under `tools/GUI_DEV/assets/org/`; they are historical snapshots, not active schema sources.

## Regression requirements

Tests must prove:

1. all four active Disk II layers have the expected persistent IDs;
2. Composer source distinguishes private `uid` from semantic `id` and preserves IDs through serialization paths;
3. duplicate semantic IDs are rejected;
4. explicit D1 identity remains D1 regardless of X coordinate;
5. runtime source contains neither `legacyDiskIILayerId()` nor filename/coordinate inference.
