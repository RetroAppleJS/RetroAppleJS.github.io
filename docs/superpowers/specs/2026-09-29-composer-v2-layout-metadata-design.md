# Apple II System Composer v2 Layout Metadata Design

## Purpose

Evolve the Apple II System Composer layout format from version 1 to version 2 so the visual composition becomes a first-class runtime control surface for peripherals and child devices. Device code must be able to address visual elements by stable semantic identifiers, independent of image filenames, and must be able to discover related elements through structured metadata.

The v2 contract is shared by:

- `tools/GUI_DEV/apple2-system-composer.html`
- exported JSON and `COM_LAYOUT_CONFIG.js`
- `res/COM_A2P_LAYOUT.js`
- slot peripherals and child-device implementations that control visual elements

## Design goals

1. Every visual image layer has a stable semantic `id`.
2. Every layer has a `slotN` namespace.
3. Runtime addresses are generated uniformly as `A2P.<slotN>.<id>`.
4. `slotN: 0` is reserved for non-slot system elements such as the monitor and Apple II enclosure.
5. Slot-bound elements use the same `slotN` numbering already used by the emulator. For example, a peripheral mounted at `slotN: 7` is represented under the runtime namespace `A2P.7.*`.
6. Image filenames are assets only; runtime control must not depend on filenames.
7. Layers can carry typed key/value metadata such as `PCODE`, `DCODE`, and `ROLE` so related visual elements can be queried as a semantic group.
8. Composer v2 auto-suggests a semantic id from metadata, but the developer may override it manually.
9. `COM_A2P_LAYOUT.js` temporarily accepts v1 and v2 input, normalizing both into a single v2-shaped internal representation.
10. Existing layout behavior such as x/y positioning, visibility, z-order, shadows, embedded assets, JSON export, JS export, and PNG export remains intact.

## Chosen model

Use structured metadata plus a generated runtime address.

A layer stores its semantic identity and namespace separately:

```json
{
  "id": "DISKII.D2.LED",
  "slotN": 7,
  "labels": {
    "PCODE": "DISKII",
    "DCODE": "D2",
    "ROLE": "LED"
  },
  "file": "A2P_DISKII_D2_LED.png",
  "x": 712,
  "y": 554,
  "visible": false,
  "shadow": {
    "enabled": false,
    "offsetX": 0,
    "offsetY": 15,
    "blur": 12,
    "opacity": 0.75
  }
}
```

The runtime address is derived, not redundantly persisted:

```text
A2P.7.DISKII.D2.LED
```

For system-level visuals:

```json
{
  "id": "SYSTEM.MONITOR",
  "slotN": 0,
  "labels": {
    "ROLE": "MONITOR"
  },
  "file": "A2P_MONITOR.png",
  "x": 0,
  "y": 0,
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

which produces:

```text
A2P.0.SYSTEM.MONITOR
```

## Version 2 document schema

Top-level structure:

```json
{
  "version": 2,
  "canvas": {
    "width": 1144,
    "height": 1144
  },
  "assets": {
    "A2P_DISKII_D2_LED.png": "data:image/png;base64,..."
  },
  "layers": []
}
```

### Layer fields

Required in v2:

- `id`: semantic element identifier
- `slotN`: integer namespace, with `0` reserved for non-slot system visuals
- `labels`: object containing zero or more metadata key/value pairs
- `file`: asset filename
- `x`: integer pixel coordinate
- `y`: integer pixel coordinate
- `visible`: boolean
- `shadow`: shadow object

### Semantic id rules

`id` is the stable device-facing semantic identifier. It must:

- be a non-empty string
- contain no whitespace
- use only letters, digits, `.`, `_`, and `-`
- be unique together with `slotN`

The generated runtime address `A2P.<slotN>.<id>` must therefore be globally unique within a layout.

Examples:

```text
DISKII.D1.BODY
DISKII.D1.LED
DISKII.D1.LID
DISKII.D2.BODY
DISKII.D2.LED
DISKII.D2.LID
DISKII.GAP
SYSTEM.MONITOR
SYSTEM.CHASSIS
```

## Metadata labels

`labels` is an open key/value dictionary. Label keys are canonical uppercase identifiers. Values are strings and preserve developer-entered case, although the Composer-generated canonical values for the primary labels are uppercase.

Three labels receive first-class Composer support:

- `PCODE`: owning peripheral/card, for example `DISKII`, `LIRON`
- `DCODE`: child device, for example `D1`, `D2`, `UNIDISK`, `HD20`
- `ROLE`: visual function, for example `BODY`, `LED`, `LID`, `GAP`, `FRONT`, `SHADOW`

Additional custom labels remain allowed, for example:

```json
{
  "PCODE": "DISKII",
  "DCODE": "D2",
  "ROLE": "LED",
  "SIDE": "RIGHT",
  "VARIANT": "ACTIVE"
}
```

For slot-bound hardware layers, `PCODE` is expected. `DCODE` is optional for peripheral-wide elements, and `ROLE` is strongly recommended for independently controllable elements.

Labels provide semantic grouping; they do not affect z-order or rendering order.

## Composer authoring behavior

The selected-layer panel replaces the current single Runtime ID concept with the following v2 controls:

- Semantic ID
- SlotN
- read-only generated runtime address
- metadata table with Type and Value columns
- `+ Add label`
- `Reset to suggested ID`

### ID suggestion behavior

The Composer derives a suggested semantic id from `PCODE`, `DCODE`, and `ROLE` in that order.

Examples:

```text
PCODE=DISKII, DCODE=D2, ROLE=LED
=> DISKII.D2.LED

PCODE=DISKII, ROLE=GAP
=> DISKII.GAP
```

For `slotN: 0`, when no `PCODE` is supplied, system elements use the `SYSTEM` prefix:

```text
ROLE=MONITOR
=> SYSTEM.MONITOR
```

The suggestion is automatically maintained until the developer manually edits the semantic id. Manual editing changes the layer into custom-id mode; subsequent metadata changes no longer overwrite the id. `Reset to suggested ID` returns the layer to automatic mode.

The auto/custom authoring flag is Composer-local state and is not serialized into v2 output.

### Validation in the Composer

The Composer prevents export when:

- a layer has no semantic id
- a layer has an invalid `slotN`
- two layers generate the same runtime address
- an id contains whitespace or unsupported characters
- a metadata key is empty or duplicated within one layer

The layer list should show enough identity to distinguish similar elements, preferably the generated runtime address or `slotN + id`.

## Runtime addressing in `COM_A2P_LAYOUT.js`

`COM_A2P_LAYOUT.js` builds a canonical address for every normalized layer:

```js
address = "A2P." + layer.slotN + "." + layer.id;
```

The runtime registry is keyed by this address:

```js
layersById["A2P.7.DISKII.D2.LED"] = {
  id: "DISKII.D2.LED",
  address: "A2P.7.DISKII.D2.LED",
  slotN: 7,
  labels: {
    PCODE: "DISKII",
    DCODE: "D2",
    ROLE: "LED"
  },
  model: layer,
  element: img
};
```

The DOM image element should expose corresponding metadata through `dataset` fields where useful for diagnostics, at minimum:

```text
data-layer-id="DISKII.D2.LED"
data-layout-address="A2P.7.DISKII.D2.LED"
data-slot-n="7"
data-file="A2P_DISKII_D2_LED.png"
```

Labels may additionally be exposed as a serialized diagnostic dataset value, but runtime behavior must use the normalized model rather than parse DOM strings.

## Runtime API

Existing `visible(id,state)` remains available, but in v2 its canonical input is the fully qualified address:

```js
oLAYOUT.visible("A2P.7.DISKII.D2.LED", true);
```

Add convenience APIs:

```js
oLAYOUT.address(7, "DISKII.D2.LED");
// "A2P.7.DISKII.D2.LED"

oLAYOUT.visibleAt(7, "DISKII.D2.LED", true);

oLAYOUT.getLayer("A2P.7.DISKII.D2.LED");
```

Add a metadata query API:

```js
oLAYOUT.find({
  slotN: 7,
  PCODE: "DISKII",
  DCODE: "D2",
  ROLE: "LED"
});
```

`find()` returns matching registry entries in layout order. Query matching is exact. `slotN` addresses the normalized layer field; all other keys match `labels`.

A peripheral-oriented convenience API may be added if it can use the existing mount contract without ambiguity:

```js
oLAYOUT.visibleFor(owner, "D2.LED", true);
```

This helper should derive `slotN` from `owner.mount.slotN` and `PCODE` from `owner.id.PCODE`, producing the same canonical address rather than creating a second addressing mechanism.

## Device integration

Device code should control visual elements by semantic address, never by image filename.

Disk II example:

```js
var slotN = owner.mount.slotN;
oLAYOUT.visibleAt(slotN,"DISKII.D1.BODY",true);
oLAYOUT.visibleAt(slotN,"DISKII.D1.LED",false);
oLAYOUT.visibleAt(slotN,"DISKII.D1.LID",false);
```

This supports multiple instances of the same peripheral type in different slots because the slot namespace disambiguates otherwise identical semantic ids.

## Version 1 compatibility and normalization

Composer v2 writes only version 2.

`COM_A2P_LAYOUT.js` temporarily accepts both version 1 and version 2 layouts. Validation is followed by normalization into one internal v2-shaped representation so the rendering and runtime-control code do not maintain two parallel code paths.

### v2 normalization

Version 2 layers pass through after validation, with `address` derived from `slotN` and `id`.

### v1 normalization

Version 1 remains readable for migration. Existing v1 `id` values and the current known filename fallback mappings may be translated into equivalent v2 semantic ids and slot namespaces where deterministically possible.

The compatibility path is explicitly transitional:

- it must not become a new source of filename-based device behavior
- v2 output never relies on `runtimeLayerIdForFile()`
- v2 runtime registration never derives identity from filenames
- `visibleByFile()` may remain as a compatibility/debugging API but is not a supported device-control pattern

Where a v1 layer cannot be mapped deterministically to a semantic slot-qualified id, it may receive a generated compatibility-only semantic id so the composition can still render, but such ids are not considered stable device API.

## Removal of filename-derived identity

The current `runtimeLayerIdForFile(filename)` mechanism is not part of the v2 contract.

For a validated v2 layout:

```text
filename -> image bytes only
id + slotN -> runtime identity
labels -> hierarchy/grouping metadata
```

This separation is essential so assets can be renamed or replaced without changing device behavior.

## Rendering and hierarchy

The hierarchy is semantic rather than a nested render tree. Every image remains an independent flat layer so the existing Composer operations remain simple:

- drag
- x/y coordinates
- z-order
- visibility
- shadow
- rectangular hit testing
- PNG export

Grouping is expressed by metadata queries. For example:

```js
oLAYOUT.find({slotN:7,PCODE:"DISKII"});
oLAYOUT.find({slotN:7,PCODE:"DISKII",DCODE:"D2"});
```

This avoids introducing parent transforms or nested z-order semantics that the current editor does not need.

## Export behavior

All three structured exports use v2 metadata:

- layout-only JSON
- embedded-assets JSON
- `COM_LAYOUT_CONFIG.js`

Embedded assets remain deduplicated by filename in the top-level `assets` object; layers continue to reference assets by filename.

PNG export is visual only and is unchanged.

## Error handling

Composer import should reject malformed v2 metadata with an actionable message identifying the affected layer.

`COM_A2P_LAYOUT.js` should reject:

- unsupported document versions
- duplicate generated runtime addresses
- invalid ids
- invalid slot numbers
- malformed labels

Runtime lookup for a missing address retains the current pending-visibility behavior where appropriate, allowing device state to be expressed before the DOM composition has completed installation.

`find()` on no matches returns an empty array and is not an error.

## Testing strategy

### Composer tests

Cover:

- v2 serialization and reload round-trip
- semantic id validation
- slotN validation including reserved slot 0
- duplicate runtime-address rejection
- PCODE/DCODE/ROLE id suggestion
- system id suggestion for slot 0
- manual id override stops automatic updates
- reset restores automatic suggestion behavior
- arbitrary custom labels survive export/import
- embedded-assets and JS exports preserve v2 metadata

### `COM_A2P_LAYOUT.js` tests

Cover:

- accepts and normalizes version 2
- continues to load version 1 during migration
- canonical address generation
- duplicate qualified-address rejection
- identical semantic ids are allowed in different slots
- DOM registry uses the qualified address
- `visible()`, `visibleAt()`, and `getLayer()` target the correct slot-qualified layer
- `find()` filters by slot and labels
- pending visibility works with qualified addresses
- v2 identity does not depend on filenames

### Device integration tests

Use Disk II as the first reference implementation:

- D1/D2 BODY, LED, LID and GAP map to Composer-defined v2 elements
- two identical semantic ids in different slot namespaces do not interfere
- device attach/detach updates only elements in the mounted peripheral's slot
- LED/lid activity changes the intended qualified element

## Scope boundaries

This v2 change does not introduce:

- nested transforms
- parent-child coordinate inheritance
- group dragging
- animation timelines
- event scripting inside the Composer metadata
- device logic embedded in layout JSON

Device behavior remains in emulator/peripheral code. Composer v2 provides a stable, discoverable visual address space that device code can control.

## Migration outcome

After v2 migration, a device implementation should be able to control layout elements without knowing their PNG filename or their position in the layer array. The stable contract is:

```text
A2P.<slotN>.<semantic-id>
```

with typed metadata available for discovery and grouping.
