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
4. Keep structured metadata centered on `PCODE`, `DCODE`, `ROLE`, and optional visual-description labels such as `POSITION`.
5. Remove SmartPort `UNIT` from the Composer model. SmartPort unit assignment is runtime topology, not visual identity.
6. Represent alternative physical arrangements as named visual configurations that change layer visibility only.
7. Preserve one shared set of layer geometry, z-order, shadows, IDs, labels, and filenames across configurations.
8. Add a command to unload all image content without deleting layer definitions or filename references.
9. Add undo/redo for all authoring changes, including drag operations, with standard keyboard shortcuts.
10. Preserve existing JSON, embedded JSON, JavaScript, and PNG export workflows in forms appropriate to the v3 authoring model.

## Separation of concerns

### Composer v3

Composer v3 describes visual elements and example compositions. It does not know where a peripheral will be mounted.

A layer is identified by a semantic ID such as:

```text
DISKII.D1.BODY
DISKII.D1.LED
DISKII.D2.BODY
LIRON.UNIDISK.LEFT.BODY
LIRON.UNIDISK.RIGHT.BODY
LIRON.HD20.TOP.BODY
LIRON.HD20.BOTTOM.BODY
SYSTEM.MONITOR
SYSTEM.APPLE2
```

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
  "assets": {
    "A2P_UNIDISK_left.png": "data:image/png;base64,..."
  },
  "layers": [],
  "configurations": []
}
```

`assets` is present only in embedded exports, as today.

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

Example:

```json
{
  "id": "LIRON.UNIDISK.LEFT.BODY",
  "labels": {
    "PCODE": "LIRON",
    "DCODE": "UNIDISK",
    "ROLE": "BODY",
    "POSITION": "LEFT"
  },
  "file": "A2P_UNIDISK_left.png",
  "x": 170,
  "y": 460,
  "visible": false,
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

### First-class labels

Composer provides first-class rows for:

- `PCODE`: owning peripheral, e.g. `DISKII`, `LIRON`
- `DCODE`: child-device type, e.g. `D1`, `D2`, `UNIDISK`, `HD20`
- `ROLE`: visual function, e.g. `BODY`, `LED`, `LID`, `GAP`

Additional custom labels remain allowed. `POSITION` is recommended when a layer denotes a physical visual position rather than a runtime device number:

```json
{
  "PCODE": "LIRON",
  "DCODE": "HD20",
  "ROLE": "BODY",
  "POSITION": "BOTTOM"
}
```

`UNIT` is not a Composer v3 label. Runtime unit numbers remain emulator topology state.

### Suggested IDs

Automatic semantic-ID suggestion continues, using authoring metadata rather than slot state.

Recommended composition:

```text
PCODE + DCODE + POSITION + ROLE
```

Examples:

```text
DISKII + D1 + BODY
=> DISKII.D1.BODY

LIRON + UNIDISK + LEFT + BODY
=> LIRON.UNIDISK.LEFT.BODY

LIRON + HD20 + BOTTOM + BODY
=> LIRON.HD20.BOTTOM.BODY

ROLE=MONITOR with no PCODE
=> SYSTEM.MONITOR
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

Composer v3 supports named example arrangements for authoring and documentation.

A configuration controls visibility only. It does not override:

- x/y
- z-order
- shadow
- semantic ID
- labels
- filename

This keeps one source of truth for geometry and avoids duplicated layer definitions.

### Configuration structure

```json
{
  "id": "liron-hd20-two-unidisk",
  "title": "LIRON — HD20 + 2 UniDisk",
  "visible": [
    "SYSTEM.MONITOR",
    "SYSTEM.APPLE2",
    "LIRON.UNIDISK.LEFT.BODY",
    "LIRON.UNIDISK.RIGHT.BODY",
    "LIRON.HD20.BOTTOM.BODY"
  ]
}
```

Top-level example:

```json
{
  "configurations": [
    {
      "id": "diskii-two-drive",
      "title": "Disk II — 2 drives",
      "visible": ["SYSTEM.MONITOR","SYSTEM.APPLE2","DISKII.D1.BODY","DISKII.D2.BODY","DISKII.GAP"]
    },
    {
      "id": "liron-hd20-only",
      "title": "LIRON — HD20 only",
      "visible": ["SYSTEM.MONITOR","SYSTEM.APPLE2","LIRON.HD20.TOP.BODY"]
    }
  ]
}
```

### Base view

The Composer provides a special non-serialized `Base` tab/view that displays each layer's stored `visible` field.

Named configurations are serialized and store explicit visible semantic IDs.

### Editing a configuration

When `Base` is selected, the Visible checkbox edits `layer.visible`.

When a named configuration is selected, the Visible checkbox edits membership of that layer's semantic ID in the active configuration's `visible` array. It does not mutate the layer's base visibility.

The configuration selector appears above the canvas as named tabs/buttons plus an add control. The editor must support creating, renaming, selecting, and deleting configurations.

Changing configurations is presentation state only and is not itself an emulator topology action.

## Unload Images

Add a toolbar command named `Unload Images`.

Its purpose is to discard loaded image content while preserving the visual design.

When invoked:

1. revoke any object URLs held by cached assets
2. clear the in-memory asset cache
3. set every layer to unresolved
4. clear each layer's decoded image object and dimensions
5. retain all layer metadata, filename references, coordinates, z-order, visibility, shadows, and configurations
6. refresh the layer list so affected layers display `MISSING`

The operation must not delete layers.

Layout-only JSON remains exportable after unloading because it contains references, not image bytes.

Embedded JSON and JavaScript exports must report missing inline image data until the referenced images are loaded again.

PNG export must continue to reject unresolved visible layers.

## Undo/redo

Composer v3 adds editor history.

### Scope

Undo/redo covers authoring changes including:

- drag/move
- arrow-key movement
- numeric x/y edits
- visibility changes
- shadow changes
- semantic ID and label changes
- layer add/remove
- z-order changes
- named configuration create/rename/delete
- named configuration visibility edits
- image import that creates/resolves layers
- unload-images operation

Loading an entirely new layout resets history rather than becoming an undoable operation.

### History model

Use snapshot-based history of the editable document/state rather than hand-written inverse operations.

Snapshots contain serializable authoring state only. Browser objects such as `Image`, object URLs, DOM nodes, and pointer events are not deep-cloned into history records. Asset-cache changes are represented separately enough to restore whether layers are resolved/unresolved when undoing an unload/import operation.

History must have a finite upper bound to avoid unbounded memory growth; 100 committed editor actions is sufficient.

### Drag transaction

Dragging must create one undo step, not one step per pointer move.

- pointer down captures the pre-drag state
- pointer moves update the live layer coordinates without pushing history
- pointer up commits one history entry if the coordinates changed
- pointer cancel restores or finalizes consistently without producing repeated entries

### Keyboard shortcuts

Undo:

- macOS: `Cmd-Z`
- Windows/Linux: `Ctrl-Z`

Redo:

- macOS: `Cmd-Shift-Z`
- Windows/Linux: `Ctrl-Shift-Z`
- Windows/Linux compatibility: `Ctrl-Y`

Shortcuts must work unless the current focus is an input/editor where the browser's native text undo should take precedence.

Toolbar Undo and Redo buttons mirror the same history stack and are disabled when unavailable.

## Import and migration

Composer v3 should load v3 documents natively.

For transition convenience, the standalone Composer may also import current v2 documents by converting them into v3 authoring state:

- drop `slotN`
- drop `UNIT` label if present
- preserve semantic IDs unless they encode misleading visual-unit semantics that the user chooses to rename manually
- preserve labels other than `UNIT`
- preserve file, x/y, visibility, z-order, and shadows
- preserve embedded assets
- start with no named configurations unless they are created by the user

Composer v3 writes only v3.

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

The active configuration selection itself is editor UI state and does not need a separate persisted field.

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

Until that adapter is intentionally implemented, Composer v3 work should avoid silently changing the current runtime contract.

## Testing strategy

### Schema and migration

Cover:

- v3 serialization contains no `slotN`
- v3 serialization contains no runtime address
- v3 labels exclude `UNIT`
- semantic IDs are globally unique
- v2 import drops `slotN` and `UNIT` while preserving geometry/assets/other labels
- v3 round-trip preserves configurations

### Configurations

Cover:

- Base view uses layer `visible`
- named configuration uses its explicit `visible` ID set
- switching configurations does not mutate base layer visibility
- configuration create/rename/delete behavior
- editing visibility while a configuration is active changes only that configuration
- PNG export uses the active view

### Unload Images

Cover:

- layers remain present
- filename references remain unchanged
- coordinates/metadata/configurations remain unchanged
- layer resolution is cleared
- embedded/JS export reports missing data until reload
- layout-only JSON remains exportable

### Undo/redo

Cover:

- drag is one undo step
- keyboard move undo/redo
- x/y edit undo/redo
- visibility and shadow undo/redo
- metadata edit undo/redo
- add/remove/reorder undo/redo
- configuration mutation undo/redo
- unload-images undo/redo
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