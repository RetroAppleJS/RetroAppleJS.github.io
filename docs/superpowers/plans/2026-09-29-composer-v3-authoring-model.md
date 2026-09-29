# Composer v3 Authoring Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the standalone Apple II System Composer into the slot-agnostic v3 authoring model with named visibility configurations, unload-images support, and undo/redo, while leaving the emulator runtime v2 contract unchanged.

**Architecture:** Keep the Composer as one standalone HTML/JavaScript tool, but separate serializable document state from transient browser asset state and editor UI state. Composer v3 serializes semantic layers plus named visibility configurations; runtime `slotN` qualification remains exclusively in emulator code. Snapshot history records serializable authoring state only, while image cache objects remain transient and are re-associated by filename after history restore.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node `node:test`, existing GitHub Actions preview workflow.

**Spec:** `docs/superpowers/specs/2026-09-29-composer-v3-authoring-model-design.md`

## Global Constraints

- Composer v3 output uses top-level `version: 3`.
- Composer v3 layer records contain no `slotN` and no runtime address.
- Composer v3 labels must not serialize `UNIT`.
- Existing semantic IDs such as `LIRON.UNIDISK.1.BODY` and `LIRON.HD20.2.BODY` are preserved exactly unless the user edits them.
- `PCODE`, `DCODE`, and `ROLE` remain the first-class metadata rows.
- Named configurations override visibility only; geometry, z-order, shadows, IDs, labels, and filenames remain shared.
- `Unload Images` preserves all document references/design state and is not undoable.
- Undo/redo history is limited to 100 committed authoring actions.
- Dragging creates one history action, not one action per pointer move.
- Do not change `res/COM_A2P_LAYOUT.js` runtime addressing or mounted-slot behavior as part of this plan.

## Review Focus

- **Duplicate semantic IDs after v2 migration or manual rename:** reject the mutation and leave configurations/document unchanged; covered in Task 1 and Task 2 tests.
- **Configuration references after a semantic-ID rename:** every configuration using the old ID must be updated atomically; covered in Task 2 tests.
- **Undo after assets have been unloaded:** restored document snapshots must stay unresolved until images are re-imported; covered in Task 4 tests.
- **Keyboard shortcuts while editing text:** native input undo/redo must not be intercepted by the Composer history handler; covered in Task 4 tests.
- **Named configuration references to missing/deleted layers:** validation/load must reject unknown IDs rather than silently producing an inconsistent simulation; covered in Task 2 tests.

---

### Task 1: Introduce Composer v3 schema and v2-to-v3 import normalization

**Files:**
- Modify: `tools/GUI_DEV/apple2-system-composer.html`
- Replace: `tests/apple2_system_composer_v2.test.js` with `tests/apple2_system_composer_v3.test.js`
- Modify: `.github/workflows/build-branch-preview.yml`

**Interfaces:**
- Consumes: current v2 layout parser, semantic-ID validation, labels, layer serialization.
- Produces: `normalizeComposerDocument(raw)`, v3 `validateLayout(raw)`, v3 `serializeLayer(layer)`, and v3 `serializeLayout()` semantics used by later tasks.

- [ ] **Step 1: Write failing v3 schema/migration tests**

Add tests asserting:

```js
assert.equal(serialized.version, 3);
assert.equal('slotN' in serialized.layers[0], false);
assert.equal(serialized.layers[0].labels.UNIT, undefined);
assert.equal(serialized.layers[0].id, 'LIRON.UNIDISK.1.BODY');
assert.deepEqual(serialized.configurations, []);
```

Also cover:

- current v2 input with `slotN` imports successfully
- `UNIT` is dropped if present
- `PCODE`/`DCODE`/`ROLE`, file, x/y, visibility, shadow, and embedded assets survive normalization
- v3 rejects duplicate semantic IDs globally
- a malformed/unsupported version still rejects with an actionable error

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```bash
node --test tests/apple2_system_composer_v3.test.js
```

Expected: failures because the Composer still expects version 2, requires `slotN`, and serializes runtime addressing.

- [ ] **Step 3: Implement the minimal v3 document model**

In `tools/GUI_DEV/apple2-system-composer.html`:

- set `LAYOUT_VERSION=3`
- add `normalizeComposerDocument(raw)` that accepts v2 and v3
- v2 normalization drops `slotN` and label key `UNIT`
- v3 validation requires globally unique `id`
- remove `validateSlotN()`, `layoutAddress()`, `runtimeAddressForLayer()`, `addressInUse()`, and slot-based uniqueness checks from Composer code
- remove `slotN` from `layerFromLayout`, `addLayerFromAsset`, and serialization
- initialize `configurations: []` when importing v2
- preserve existing semantic IDs exactly

- [ ] **Step 4: Remove runtime-only UI concepts**

In the selected-layer panel and layer/status rendering:

- remove SlotN input
- remove Runtime Address input
- remove all event handlers for SlotN
- display semantic ID as the primary layer identity
- keep filename as secondary/diagnostic text
- keep `PCODE`, `DCODE`, `ROLE`, custom labels, and reset-to-suggested behavior

- [ ] **Step 5: Update the preview workflow test filename**

Replace the old v2 Composer test filename with `tests/apple2_system_composer_v3.test.js` while leaving the remaining runtime regression files unchanged.

- [ ] **Step 6: Run focused and current full Node regression suite**

Run the exact test set used by `.github/workflows/build-branch-preview.yml`.

Expected: all Composer v3 tests and pre-existing runtime tests pass; emulator runtime tests continue to use runtime v2 semantics.

- [ ] **Step 7: Commit**

```bash
git add tools/GUI_DEV/apple2-system-composer.html tests/apple2_system_composer_v3.test.js tests/apple2_system_composer_v2.test.js .github/workflows/build-branch-preview.yml
git commit -m "feat: add slot-agnostic Composer v3 schema"
```

---

### Task 2: Add named visibility-only visual configurations

**Files:**
- Modify: `tools/GUI_DEV/apple2-system-composer.html`
- Test: `tests/apple2_system_composer_v3.test.js`

**Interfaces:**
- Consumes: v3 document model from Task 1.
- Produces: `state.configurations`, `state.activeConfigurationId`, `isLayerVisibleInActiveView(layer)`, configuration CRUD helpers, and atomic semantic-ID reference updates.

- [ ] **Step 1: Write failing configuration tests**

Cover:

- Base view uses `layer.visible`
- named configuration uses only its explicit `visible` semantic-ID set
- switching configurations does not mutate base visibility
- create, rename, select, and delete configuration
- configuration IDs are unique and titles are non-empty
- unknown semantic IDs in `configuration.visible` reject during validation
- semantic-ID rename updates every configuration reference atomically
- rename to an already-used semantic ID rejects without changing the document
- v3 serialize/reload preserves configurations

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
node --test tests/apple2_system_composer_v3.test.js
```

Expected: failures because no configuration model or active-view rendering exists.

- [ ] **Step 3: Implement configuration model and validation**

Add helpers with these responsibilities:

```text
validateConfigurations(raw, layerIds)
getActiveConfiguration()
isLayerVisibleInActiveView(layer)
setLayerVisibleInActiveView(layer, visible)
createConfiguration(title)
renameConfiguration(id, title)
deleteConfiguration(id)
selectConfiguration(id|null)
```

`null` active configuration means Base view.

- [ ] **Step 4: Add configuration selector UI**

Add a strip above the canvas containing:

- `Base`
- one button/tab per configuration title
- `+` add control
- rename/delete affordances for the active named configuration

Use the active view for canvas rendering, hit testing, layer-list visibility checkboxes, PNG export, and visible-asset blocker detection.

- [ ] **Step 5: Make semantic-ID rename update configurations**

When an ID changes from `oldId` to `newId`, replace every occurrence in each configuration's `visible` array in the same authoring transaction.

- [ ] **Step 6: Run Composer and full regression suite**

Expected: configuration tests pass and no runtime layout regressions change.

- [ ] **Step 7: Commit**

```bash
git add tools/GUI_DEV/apple2-system-composer.html tests/apple2_system_composer_v3.test.js
git commit -m "feat: add Composer visual configurations"
```

---

### Task 3: Add Unload Images without deleting design references

**Files:**
- Modify: `tools/GUI_DEV/apple2-system-composer.html`
- Test: `tests/apple2_system_composer_v3.test.js`

**Interfaces:**
- Consumes: transient `state.assets` and layer resolution fields.
- Produces: `unloadImages()` and toolbar button behavior.

- [ ] **Step 1: Write failing unload-images tests**

Assert that `unloadImages()`:

- keeps layer count/order/IDs/labels/files/x/y/shadows/base visibility/configurations unchanged
- revokes object URLs where present
- clears `state.assets`
- clears each layer's `image`, `width`, and `height`
- sets each layer `resolved=false`
- does not push an undo-history action
- leaves layout-only JSON exportable
- causes embedded JSON/JS export blockers until images are loaded again
- causes PNG export blockers only for unresolved layers visible in the active view

- [ ] **Step 2: Run focused tests and confirm RED**

Expected: missing `unloadImages()` and toolbar control.

- [ ] **Step 3: Implement `unloadImages()`**

Add one toolbar button labeled `Unload Images` and the helper that releases cached image content exactly as specified while preserving all serialized document state.

- [ ] **Step 4: Run Composer and full regression suite**

Expected: unload tests and existing v3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/GUI_DEV/apple2-system-composer.html tests/apple2_system_composer_v3.test.js
git commit -m "feat: add Composer unload images command"
```

---

### Task 4: Add bounded snapshot-based undo/redo

**Files:**
- Modify: `tools/GUI_DEV/apple2-system-composer.html`
- Test: `tests/apple2_system_composer_v3.test.js`

**Interfaces:**
- Consumes: serializable v3 document/configuration state from Tasks 1–2 and current asset cache.
- Produces: `captureHistorySnapshot()`, `commitHistory(snapshot)`, `undo()`, `redo()`, `resetHistory()`, and drag transaction integration.

- [ ] **Step 1: Write failing history tests**

Cover:

- one drag from pointer-down to pointer-up creates one undo action
- arrow move undo/redo
- x/y edit undo/redo
- base visibility undo/redo
- named-configuration visibility undo/redo
- shadow edit undo/redo
- semantic ID/label edit undo/redo, including restored configuration references
- add/remove/reorder layer undo/redo
- configuration create/rename/delete undo/redo
- new edit after undo clears redo stack
- 101 commits retain only the latest 100 undoable actions
- restoring a snapshot resolves layers only from currently loaded assets
- after `Unload Images`, undoing an older document edit does not resurrect image bytes
- `Cmd-Z`, `Ctrl-Z`, `Cmd/Ctrl-Shift-Z`, and `Ctrl-Y` dispatch correctly outside text inputs
- shortcuts are ignored by Composer history while focus is inside text inputs/textareas/select/contenteditable

- [ ] **Step 2: Run focused tests and confirm RED**

Expected: history API/toolbar/shortcut tests fail.

- [ ] **Step 3: Implement serializable history snapshots**

Snapshots include:

- serializable layer properties
- configurations
- selected layer ID/UID mapping sufficient to restore editor continuity
- active configuration ID

Snapshots exclude image bytes, `Image` objects, object URLs, DOM nodes, and pointer events. On restore, resolve layer assets again from the current filename cache.

- [ ] **Step 4: Wrap committed authoring mutations**

Add one history transaction around each authoring operation:

- movement and numeric coordinates
- visibility
- shadows
- metadata/semantic IDs
- add/remove/reorder layers
- configuration mutations

Loading a layout calls `resetHistory()`.

- [ ] **Step 5: Make drag one transaction**

Capture the pre-drag snapshot on pointer-down, mutate live position during pointer-move without committing history, and commit once on pointer-up only when the coordinates changed.

- [ ] **Step 6: Add Undo/Redo toolbar and keyboard shortcuts**

Buttons mirror stack availability. Preserve native text-field undo/redo by returning early for input/editable targets.

- [ ] **Step 7: Run Composer and full regression suite**

Expected: all history and existing tests pass.

- [ ] **Step 8: Commit**

```bash
git add tools/GUI_DEV/apple2-system-composer.html tests/apple2_system_composer_v3.test.js
git commit -m "feat: add Composer undo and redo"
```

---

### Task 5: Verify v3 exports, migration fixture, and runtime isolation

**Files:**
- Modify: `tests/apple2_system_composer_v3.test.js`
- Modify only if required by test discovery: `.github/workflows/build-branch-preview.yml`
- Do not modify: `res/COM_A2P_LAYOUT.js`

**Interfaces:**
- Consumes: completed Composer v3 implementation.
- Produces: final regression proof and stable export contract.

- [ ] **Step 1: Add final export/migration regression cases**

Use a fixture equivalent to the user's supplied slot-agnostic dataset and assert:

- output version is 3
- all 14 semantic IDs survive unchanged
- no layer contains `slotN`
- no label contains `UNIT`
- `PCODE`/`DCODE`/`ROLE`, file, x/y, base visibility, and shadow values survive unchanged
- `configurations` serializes even when empty
- embedded assets remain deduplicated by filename
- JavaScript export emits `var composer =` with the v3 structure
- active named configuration controls PNG composition only, not serialized base layer visibility

- [ ] **Step 2: Add runtime-isolation guard**

Assert the Composer implementation no longer contains runtime-address authoring helpers/controls, while existing runtime tests continue to verify `COM_A2P_LAYOUT.js` slot-qualified behavior independently.

- [ ] **Step 3: Run the exact full Node regression command from the preview workflow**

Expected: zero failures.

- [ ] **Step 4: Build and verify the standalone branch preview**

Run the same preview build used by `.github/workflows/build-branch-preview.yml` and verify the generated HTML exists.

- [ ] **Step 5: Manual browser smoke test**

Verify:

- load current v2 Composer dataset
- switch Base/configuration tabs
- drag an element and undo/redo once
- unload images and confirm layer references remain with `MISSING`
- re-import PNGs and confirm unresolved layers resolve by filename
- export layout-only JSON and inspect that it is v3 with no `slotN`/`UNIT`

- [ ] **Step 6: Commit any final test-only adjustments**

```bash
git add tests/apple2_system_composer_v3.test.js .github/workflows/build-branch-preview.yml
git commit -m "test: verify Composer v3 authoring workflow"
```

---

## Completion criteria

The implementation is complete when:

- the standalone Composer reads v2 and v3 but writes only v3
- its UI/model/export contains no SlotN or Runtime Address concept
- `UNIT` is absent from v3 metadata
- named visual configurations simulate visibility combinations without changing geometry
- unload-images releases image content without removing design references
- undo/redo safely covers document authoring actions and drag is one transaction
- all repository Node regressions and preview verification pass
- `res/COM_A2P_LAYOUT.js` runtime slot-qualified behavior is unchanged by this work
