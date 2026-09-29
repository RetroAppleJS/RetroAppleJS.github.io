# Apple II System Composer v3 Authoring Model Design

## Purpose

Refocus the standalone Apple II System Composer on visual authoring rather than emulator runtime configuration.

Composer v2 mixed two concerns:

- visual design: semantic elements, image assets, geometry, visibility, shadows
- emulator runtime addressing: `slotN` and generated `A2P.<slotN>.<id>` addresses

The Composer should no longer encode slot assignment. A peripheral can be mounted by the emulator in any eligible slot, and the same peripheral can have different child-device topology depending on runtime configuration. Slot qualification therefore belongs to emulator configuration/runtime code, not to the visual authoring tool.

Composer v3 defines a slot-agnostic visual model, adds named visual simulations, supports unloading image content while preserving design references, and adds undo/redo for editing safety.

## Design goals

1. Remove `slotN` from Composer UI, validation, layer state, and structured exports.
2. Remove the generated Runtime Address concept from the Composer UI and model.
3. Keep stable semantic element IDs independent of filenames and runtime slot assignment.
4. Keep structured metadata centered on `PCODE`, `DCODE`, and `ROLE`.
5. Remove SmartPort `UNIT` from the Composer model. SmartPort unit assignment is runtime topology, not visual identity.
6. Preserve existing semantic IDs from the current dataset, including IDs such as `LIRON.HD20.1.BODY` and `LIRON.UNIDISK.2.BODY`.
7. Represent alternative physical arrangements as named visual configurations that change layer visibility only.
8. Preserve one shared set of layer geometry, z-order, shadows, IDs, labels, and filenames across configurations.
9. Add a command to unload all image content without deleting layer definitions or filename references.
10. Add undo/redo for authoring changes, including drag operations, with standard keyboard shortcuts.
11. Preserve existing JSON, embedded JSON, JavaScript, and PNG export workflows in forms appropriate to the v3 authoring model.

## Separation of concerns

### Composer v3

Composer v3 describes visual elements and example compositions. It does not know where a peripheral will be mounted.

A layer is identified by a semantic ID such as:

```text
SYSTEM.MONITOR
SYSTEM.TAPE
SYSTEM.CHASSIS
DISKII.D1.BODY
DISKII.D1.LED
DISKII.D1.LID
DISKII.D2.BODY
DISKII.D2.LED
DISKII.D2.LID
DISKII.GAP
LIRON.HD20.1.BODY
LIRON.UNIDISK.1.BODY
LIRON.UNIDISK.2.BODY
LIRON.HD20.2.BODY
```

The `.1` / `.2` portions above remain part of the semantic ID. They do not imply a Composer `UNIT` label and do not represent SmartPort unit assignment. They distinguish visual elements/positions in the authored composition.

### Emulator runtime

The emulator remains responsible for deriving mounted-instance addresses such as:

```text
A2P.<slotN>.<semantic-id>
```

The runtime may continue using slot-qualified lookup APIs such as `visibleAt(slotN,id,state)` because identical peripheral/device semantics may exist in multiple mounted slots.

Composer v3 output is therefore not itself a mounted runtime configuration. A later adapter/build step may derive runtime layout data from Composer v3 plus emulator configuration.

## Version 3 document schema

Top-level structure:

```json
{
  "version": 3,
  "canvas": {
    "width": 1144,
    "height": 1144
  },
  "layers": [],
  "configurations": []
}
```

Embedded exports additionally contain:

```json
{
  "assets": {
    "A2P_UNIDISK_left.png": "data:image/png;base64,..."
  }
}
```

### Layer fields

Required:

- `id`: globally unique semantic element identifier within the Composer document
- `labels`: metadata object
- `file`: asset filename/reference
- `x`: integer pixel coordinate
- `y`: integer pixel coordinate
- `visible`: boolean base/default visibility
- `shadow`: shadow object

Removed from Composer v3:

- `slotN`
- runtime address
- `UNIT`

Example matching the intended slot-agnostic dataset:

```json
{
  "id": "LIRON.UNIDISK.1.BODY",
  "labels": {
    "PCODE": "LIRON",
    "DCODE": "UNIDISK",
    "ROLE": "BODY"
  },
  "file": "A2P_UNIDISK_left.png",
  "x": 170,
  "y": 460,
  "visible": true,
  "shadow": {
    "enabled": true,
    "offsetX": 0,
    "offsetY": 15,
    "blur": 12,
    "opacity": 0.75
  }
}
```

## Semantic IDs and labels

### Semantic IDs

`id` remains the stable Composer-level identity. It must:

- be a non-empty string
- contain only letters, digits, `.`, `_`, and `-`
- be globally unique within the Composer document

Composer no longer validates uniqueness by `slotN + id` because there is no slot namespace in authoring.

Existing IDs from the slot-agnostic dataset are preserved. This revision does not rename `LIRON.*.1.*` / `LIRON.*.2.*` IDs.

### First-class labels

Composer provides first-class rows for:

- `PCODE`: owning peripheral, e.g. `DISKII`, `LIRON`
- `DCODE`: child-device type, e.g. `D1`, `D2`, `UNIDISK`, `HD20`
- `ROLE`: visual function, e.g. `BODY`, `LED`, `LID`, `GAP`

Additional custom labels remain allowed, but `UNIT` is explicitly excluded from the v3 Composer model.

Runtime unit numbers remain emulator topology state.

### Suggested IDs

Automatic semantic-ID suggestion continues as a convenience and uses the three first-class labels:

```text
PCODE + DCODE + ROLE
```

Examples:

```text
DISKII + D1 + BODY
=> DISKII.D1.BODY

DISKII + D2 + LED
=> DISKII.D2.LED

ROLE=MONITOR with no PCODE
=> SYSTEM.MONITOR
```

For multiple authored visual elements that share the same `PCODE/DCODE/ROLE`, such as the two UniDisk bodies or two HD20 positions, the user may keep or enter a manually differentiated semantic ID such as:

```text
LIRON.UNIDISK.1.BODY
LIRON.UNIDISK.2.BODY
LIRON.HD20.1.BODY
LIRON.HD20.2.BODY
```

Manual override and `Reset to suggested ID` continue as Composer-local authoring behavior. The auto/custom mode is not serialized.

## Composer UI changes

The selected-layer metadata panel becomes an Element Identity panel containing:

- Semantic ID
- PCODE
- DCODE
- ROLE
- custom labels
- `+ Add label`
- `Reset to suggested ID`

Remove:

- SlotN control
- Runtime Address field
- Runtime Address text from layer rows/status

Layer rows show semantic ID, with filename available as secondary/diagnostic text.

## Named visual configurations

Composer v3 supports named example arrangements for authoring, simulation, and documentation.

A configuration controls visibility only. It does not override:

- x/y
- z-order
- shadow
- semantic ID
- labels
- filename

This keeps one source of truth for geometry and avoids duplicated layer definitions.

### Configuration structure

A configuration stores a stable configuration ID, a human-readable title, and the semantic IDs that are visible in that simulation.

```json
{
  "id": "liron-hd20-two-unidisk",
  "title": "LIRON — HD20 + 2 UniDisk",
  "visible": [
    "SYSTEM.MONITOR",
    "SYSTEM.CHASSIS",
    "LIRON.UNIDISK.1.BODY",
    "LIRON.UNIDISK.2.BODY",
    "LIRON.HD20.2.BODY"
  ]
}
```

Example set:

```json
{
  "configurations": [
    {
      "id": "diskii-two-drive",
      "title": "Disk II — 2 drives",
      "visible": [
        "SYSTEM.MONITOR",
        "SYSTEM.CHASSIS",
        "DISKII.D1.BODY",
        "DISKII.D2.BODY",
        "DISKII.GAP"
      ]
    },
    {
      "id": "liron-hd20-only",
      "title": "LIRON — HD20 only",
      "visible": [
        "SYSTEM.MONITOR",
        "SYSTEM.CHASSIS",
        "LIRON.HD20.1.BODY"
      ]
    },
    {
      "id": "liron-hd20-two-unidisk",
      "title": "LIRON — HD20 + 2 UniDisk",
      "visible": [
        "SYSTEM.MONITOR",
        "SYSTEM.CHASSIS",
        "LIRON.UNIDISK.1.BODY",
        "LIRON.UNIDISK.2.BODY",
        "LIRON.HD20.2.BODY"
      ]
    }
  ]
}
```

The configuration output is descriptive documentation for likely visual combinations. It is not slot configuration and does not encode SmartPort unit numbers.

### Base view

The Composer provides a special non-serialized `Base` tab/view that displays each layer's stored `visible` field.

Named configurations are serialized and store explicit visible semantic IDs.

### Editing a configuration

When `Base` is selected, the Visible checkbox edits `layer.visible`.

When a named configuration is selected, the Visible checkbox edits membership of that layer's semantic ID in the active configuration's `visible` array. It does not mutate the layer's base visibility.

The configuration selector appears above the canvas as named tabs/buttons plus an add control. The editor supports creating, renaming, selecting, and deleting configurations.

Changing configurations is presentation state only and is not an emulator topology action.

### Semantic-ID renames

Because configurations reference layers by semantic ID, renaming a layer's semantic ID must update every configuration that references the old ID in the same authoring transaction.

A rename must still fail if the new semantic ID is already used by another layer.

## Unload Images

Add a toolbar command named `Unload Images`.

Its purpose is to discard loaded image content while preserving the visual design.

When invoked:

1. revoke any object URLs held by cached assets
2. clear the in-memory asset cache
3. set every layer to unresolved
4. clear each layer's decoded image object and dimensions
5. retain all layer metadata, filename references, coordinates, z-order, base visibility, shadows, and configurations
6. refresh the layer list so affected layers display `MISSING`

The operation must not delete layers.

Layout-only JSON remains exportable after unloading because it contains references, not image bytes.

Embedded JSON and JavaScript exports report missing inline image data until the referenced images are loaded again.

PNG export continues to reject unresolved visible layers in the currently displayed view.

`Unload Images` is an asset-cache operation rather than a document-authoring mutation and is therefore not part of undo/redo history. This is intentional: unloading is specifically meant to release image content, so history must not retain hidden copies of the image bytes merely to reverse the operation.

## Undo/redo

Composer v3 adds editor history for document-authoring changes.

### Scope

Undo/redo covers authoring changes including:

- drag/move
- arrow-key movement
- numeric x/y edits
- base visibility changes
- named-configuration visibility changes
- shadow changes
- semantic ID and label changes
- layer add/remove
- z-order changes
- named configuration create/rename/delete

Loading an entirely new layout resets history rather than becoming an undoable operation.

Importing images may add new layers. Those layer additions are undoable as document changes; the imported image may remain in the in-memory asset cache after the layer addition itself is undone.

`Unload Images` is not undoable, as described above.

### History model

Use snapshot-based history of serializable authoring/document state rather than hand-written inverse operations.

Snapshots contain:

- layers and their serializable properties
- configuration definitions
- selection where useful for editor continuity

Snapshots do not contain browser `Image` objects, object URLs, DOM nodes, pointer events, or base64 asset bytes.

When a snapshot is restored, layer resolution is recomputed against the current asset cache by filename.

History has a finite upper bound of 100 committed editor actions.

### Drag transaction

Dragging creates one undo step, not one step per pointer move.

- pointer down captures the pre-drag state
- pointer moves update live coordinates without pushing history
- pointer up commits one history entry if coordinates changed
- pointer cancel must not create repeated entries

### Keyboard shortcuts

Undo:

- macOS: `Cmd-Z`
- Windows/Linux: `Ctrl-Z`

Redo:

- macOS: `Cmd-Shift-Z`
- Windows/Linux: `Ctrl-Shift-Z`
- Windows/Linux compatibility: `Ctrl-Y`

Shortcuts work unless focus is inside an input/editor where native text undo/redo should take precedence.

Toolbar Undo and Redo buttons mirror the same history stack and are disabled when unavailable.

## Import and migration

Composer v3 loads v3 documents natively.

For transition convenience, the standalone Composer also imports current v2 documents by converting them into v3 authoring state:

- drop `slotN`
- drop `UNIT` label if present
- preserve semantic IDs exactly
- preserve `PCODE`, `DCODE`, `ROLE`, and other non-`UNIT` labels
- preserve file, x/y, visibility, z-order, and shadows
- preserve embedded assets
- start with no named configurations unless configurations are already present in a v3 document

Composer v3 writes only v3.

The user's supplied slot-agnostic example is the intended migrated layer shape; only the top-level `version` changes from `2` to `3`, and v3 adds the optional/empty `configurations` array.

This compatibility import belongs to the Composer only. It does not redefine the emulator's runtime v2 format.

## Export behavior

### Layout-only JSON

Exports Composer v3 document state without `assets`.

### Embedded JSON

Exports the same v3 document plus one deduplicated top-level base64 asset entry for each referenced loaded file.

### JavaScript export

Produces:

```js
var composer =
{
  "version": 3,
  ...
};
```

using the embedded v3 shape.

### PNG export

Exports the currently displayed Base or named configuration.

The active configuration selection itself is editor UI state and is not separately persisted.

## Runtime integration boundary

`COM_A2P_LAYOUT.js` and emulator device code must not start treating Composer v3 as slot-qualified runtime data directly.

The emulator's mounted-instance addressing remains a runtime concern:

```text
slotN + semantic ID => mounted element address
```

A future adapter may combine:

- Composer v3 visual definitions
- emulator peripheral mounting configuration
- runtime child-device topology

into the slot-qualified representation expected by `COM_A2P_LAYOUT.js`.

Until that adapter is intentionally implemented, Composer v3 work must avoid silently changing the current runtime contract.

## Testing strategy

### Schema and migration

Cover:

- v3 serialization contains no `slotN`
- Composer UI contains no Runtime Address concept
- v3 labels exclude `UNIT`
- semantic IDs are globally unique
- current semantic IDs such as `LIRON.UNIDISK.1.BODY` survive migration unchanged
- v2 import drops `slotN` and `UNIT` while preserving geometry/assets/other labels
- v3 round-trip preserves configurations

### Configurations

Cover:

- Base view uses layer `visible`
- named configuration uses its explicit visible-ID set
- switching configurations does not mutate base layer visibility
- configuration create/rename/delete behavior
- editing visibility while a configuration is active changes only that configuration
- semantic-ID rename updates configuration references
- PNG export uses the active view

### Unload Images

Cover:

- layers remain present
- filename references remain unchanged
- coordinates/metadata/configurations remain unchanged
- layer resolution and asset cache are cleared
- embedded/JS export reports missing data until reload
- layout-only JSON remains exportable
- unloading does not create an undo history entry

### Undo/redo

Cover:

- drag is one undo step
- keyboard move undo/redo
- x/y edit undo/redo
- base/configuration visibility undo/redo
- shadow undo/redo
- metadata edit undo/redo
- add/remove/reorder undo/redo
- configuration mutation undo/redo
- redo stack clears after a new edit following undo
- history limit is enforced
- text-input native undo is not hijacked

## Scope boundaries

Composer v3 does not introduce:

- slot mounting logic
- runtime SmartPort unit mapping
- runtime device attachment/detachment
- nested transforms
- per-configuration geometry overrides
- per-configuration z-order overrides
- animation timelines
- event scripting

The Composer remains a visual authoring/simulation tool. Emulator configuration remains responsible for turning semantic visual elements into mounted runtime instances.

## Migration outcome

After this revision, the conceptual contract is:

```text
Composer v3:
semantic visual element + visual metadata + shared geometry + named presentation configurations

Emulator runtime:
mounted slot + semantic visual element + device topology => runtime control address/state
```

This removes emulator-specific slot configuration from the authoring tool while retaining stable semantic IDs that the runtime can qualify later.