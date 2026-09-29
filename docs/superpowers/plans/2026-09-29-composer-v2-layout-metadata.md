# Apple II System Composer v2 Layout Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Apple II System Composer and layout runtime to metadata version 2 with slot-qualified semantic element addresses, typed labels, editable auto-suggested IDs, and a Disk II reference migration.

**Architecture:** Composer v2 writes flat image layers carrying `id`, `slotN`, and `labels`; `COM_A2P_LAYOUT.js` validates v1/v2 input and normalizes both into a v2-shaped internal model whose canonical runtime address is `A2P.<slotN>.<id>`. Device code controls visuals through canonical addresses or slot-aware helpers, while labels provide query/group semantics without introducing nested render trees.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node.js `node:test`, existing browser compositor/runtime APIs.

**Spec:** `docs/superpowers/specs/2026-09-29-composer-v2-layout-metadata-design.md`

## Global Constraints

- Composer structured exports write `version: 2` only.
- Runtime addresses are always `A2P.<slotN>.<semantic-id>`.
- Valid `slotN` values are integers `0..8`; `slotN: 0` is reserved for non-slot system visuals.
- `id` is mandatory in v2, may contain only letters, digits, `.`, `_`, and `-`, and may not contain whitespace.
- `(slotN,id)` must be unique within one layout.
- `labels` is an open key/value object; primary keys are `PCODE`, `DCODE`, and `ROLE`.
- Image filenames are assets only and must not determine v2 runtime identity.
- Existing x/y, visibility, z-order, hit testing, shadows, embedded assets, JSON export, JS export, and PNG export behavior remains intact.
- `COM_A2P_LAYOUT.js` continues to accept version 1 during migration.
- No nested transforms, parent-child coordinates, group dragging, timelines, or device scripting in layout JSON.

## Review Focus

- A v1 layout with no semantic metadata must still render and remain controllable through compatibility aliases where deterministic.
- Two layers with the same semantic id in different slots must remain independently addressable.
- Manual semantic-ID override must survive later PCODE/DCODE/ROLE edits until explicitly reset.
- A v2 asset rename must not change which device visual a runtime address controls.
- A topology/device action in one slot must never affect the identically named semantic element in another slot.

---

### Task 1: Add Composer v2 metadata model and validation

**Files:**
- Modify: `tools/GUI_DEV/apple2-system-composer.html`
- Create: `tests/apple2_system_composer_v2.test.js`

**Interfaces:**
- Consumes: existing Composer layer fields `{file,x,y,visible,shadow}` and embedded-assets export format.
- Produces: v2 layer model `{id,slotN,labels,file,x,y,visible,shadow}` plus helper functions `suggestSemanticId(layer)`, `layoutAddress(slotN,id)`, and v2 validation/serialization behavior.

- [ ] **Step 1: Write failing schema/validation tests**

Create `tests/apple2_system_composer_v2.test.js` that loads/extracts the Composer script and asserts:

- serialized top-level `version === 2`
- every serialized layer contains `id`, `slotN`, and `labels`
- `slotN: 0` validates as the reserved system namespace
- `slotN: 8` validates as the highest emulator slot namespace
- `slotN: 9` is rejected
- duplicate `A2P.<slotN>.<id>` addresses are rejected
- identical `id` values in different slots are accepted
- ids containing whitespace or unsupported characters are rejected
- arbitrary custom labels round-trip unchanged

- [ ] **Step 2: Run the Composer v2 tests and verify RED**

Run:

```bash
node --test tests/apple2_system_composer_v2.test.js
```

Expected: FAIL because the Composer still declares `LAYOUT_VERSION=1` and has no v2 slot/label validation.

- [ ] **Step 3: Implement the v2 in-memory layer model and validators**

In `tools/GUI_DEV/apple2-system-composer.html`:

- set `LAYOUT_VERSION=2`
- add `validateSemanticId(raw,index)`
- add `validateSlotN(raw,index)` accepting integer `0..8`
- add `validateLabels(raw,index)` returning a plain object with canonical uppercase keys
- add `layoutAddress(slotN,id)` returning `A2P.${slotN}.${id}`
- make v2 duplicate detection operate on generated runtime addresses
- extend `layerFromLayout`, `addLayerFromAsset`, and `serializeLayer` to carry `id`, `slotN`, and `labels`
- new imported images default to `slotN:0`, empty labels, and a generated system-safe semantic id until edited

- [ ] **Step 4: Run the Composer v2 tests and verify GREEN**

Run:

```bash
node --test tests/apple2_system_composer_v2.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/GUI_DEV/apple2-system-composer.html tests/apple2_system_composer_v2.test.js
git commit -m "feat: add composer v2 layout metadata model"
```

---

### Task 2: Add Composer metadata editor and semantic-ID suggestion behavior

**Files:**
- Modify: `tools/GUI_DEV/apple2-system-composer.html`
- Modify: `tests/apple2_system_composer_v2.test.js`

**Interfaces:**
- Consumes: Task 1 v2 layer model and `layoutAddress(slotN,id)`.
- Produces: selected-layer UI for Semantic ID, SlotN, Runtime Address, typed labels, auto/custom ID mode, and reset-to-suggestion behavior.

- [ ] **Step 1: Add failing authoring-behavior tests**

Extend `tests/apple2_system_composer_v2.test.js` to assert:

- `PCODE=DISKII`, `DCODE=D2`, `ROLE=LED` suggests `DISKII.D2.LED`
- `PCODE=DISKII`, `ROLE=GAP` suggests `DISKII.GAP`
- `slotN=0`, no PCODE, `ROLE=MONITOR` suggests `SYSTEM.MONITOR`
- manual edit marks the id custom and later label changes do not overwrite it
- reset returns the layer to automatic suggestion mode
- the auto/custom flag is not serialized
- runtime-address display updates when slotN or semantic id changes

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test tests/apple2_system_composer_v2.test.js
```

Expected: FAIL because authoring controls and suggestion state do not yet exist.

- [ ] **Step 3: Implement the selected-layer metadata editor**

Add UI and state in `tools/GUI_DEV/apple2-system-composer.html`:

- editable `Semantic ID`
- integer `SlotN`
- read-only `Runtime address`
- label table with Type/Value inputs
- `+ Add label`
- remove-label action per custom row
- `Reset to suggested ID`

Represent authoring-only suggestion state as an internal property such as `idMode: "auto"|"custom"`; do not include it in `serializeLayer()`.

Implement `suggestSemanticId(layer)` from `PCODE`, `DCODE`, `ROLE` in that order, using `SYSTEM` when `slotN===0` and PCODE is absent. Generated suggestion segments use uppercase canonical values.

- [ ] **Step 4: Make layer-list/status text show qualified identity**

Use `A2P.<slotN>.<id>` where available so visually similar layers are distinguishable without relying on filenames.

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```bash
node --test tests/apple2_system_composer_v2.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/GUI_DEV/apple2-system-composer.html tests/apple2_system_composer_v2.test.js
git commit -m "feat: add composer v2 metadata editor"
```

---

### Task 3: Preserve v2 metadata across all Composer exports and reload

**Files:**
- Modify: `tools/GUI_DEV/apple2-system-composer.html`
- Modify: `tests/apple2_system_composer_v2.test.js`

**Interfaces:**
- Consumes: Task 1/2 v2 layer serialization.
- Produces: layout-only JSON, embedded JSON, and `COM_LAYOUT_CONFIG.js` that carry the same v2 metadata; reload restores metadata and authoring behavior.

- [ ] **Step 1: Add failing export/reload tests**

Assert that:

- layout-only JSON preserves `id`, `slotN`, `labels`
- embedded JSON preserves the same metadata while deduplicating PNG assets by filename
- JS export emits `var composer =` with `version:2` and the metadata intact
- reload of v2 layout restores metadata and derives a sensible `idMode` without serializing it
- asset filename changes do not modify semantic id/address metadata

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test tests/apple2_system_composer_v2.test.js
```

Expected: at least the reload/id-mode assertion fails until export/import handling is completed.

- [ ] **Step 3: Implement export/reload preservation**

Update serializer, embedded serializer, JS exporter, and `applyLayout()`/`layerFromLayout()` so all structured outputs use the same v2 metadata and reload correctly reconstructs authoring-only state.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
node --test tests/apple2_system_composer_v2.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/GUI_DEV/apple2-system-composer.html tests/apple2_system_composer_v2.test.js
git commit -m "test: cover composer v2 export round trips"
```

---

### Task 4: Normalize v1/v2 layouts in `COM_A2P_LAYOUT.js`

**Files:**
- Modify: `res/COM_A2P_LAYOUT.js`
- Create: `tests/apple2_layout_v2.test.js`

**Interfaces:**
- Consumes: v1 layouts and Composer v2 layouts.
- Produces: `normalizeLayout(raw)` returning one v2-shaped internal layout; `layoutAddress(slotN,id)` returning the canonical address.

- [ ] **Step 1: Write failing runtime normalization tests**

Create `tests/apple2_layout_v2.test.js` covering:

- valid v2 layer normalizes with `address: "A2P.7.DISKII.D2.LED"`
- `slotN:0` system layer normalizes correctly
- `slotN:8` normalizes correctly and `slotN:9` rejects
- duplicate qualified addresses reject
- same semantic id in slots 6 and 7 is valid
- labels survive normalization
- v2 identity remains unchanged if `file` changes
- a supported v1 layout still validates/normalizes
- known v1 Disk II ids/filenames receive deterministic compatibility mapping
- unmappable v1 visual layers still render with compatibility-only identity rather than crashing

- [ ] **Step 2: Run runtime v2 tests and verify RED**

Run:

```bash
node --test tests/apple2_layout_v2.test.js
```

Expected: FAIL because `COM_A2P_LAYOUT.js` accepts only version 1 and has no slot-qualified model.

- [ ] **Step 3: Implement `layoutAddress(slotN,id)` and v2 validators**

In `res/COM_A2P_LAYOUT.js`, add focused helpers for semantic id, slotN `0..8`, labels, and qualified-address generation.

- [ ] **Step 4: Implement `normalizeLayout(raw)`**

Behavior:

- v2 validates and normalizes directly
- v1 passes through a compatibility normalizer
- known v1 Disk II semantic ids and known fallback filenames map to the current standard Disk II slot namespace (`slotN:7`) plus semantic ids such as `DISKII.D1.BODY`
- original v1 runtime ids remain compatibility aliases where deterministic
- generic unmapped v1 layers receive compatibility-only semantic ids sufficient for rendering, with `slotN:0`

Keep filename mapping strictly inside the v1 compatibility normalizer; v2 code must never call filename-to-id inference.

- [ ] **Step 5: Change `validateLayout(raw)` to return normalized data**

Preserve its public role for callers while accepting versions 1 and 2. Internal rendering code should consume only normalized v2-shaped layers afterward.

- [ ] **Step 6: Run runtime v2 tests and verify GREEN**

Run:

```bash
node --test tests/apple2_layout_v2.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add res/COM_A2P_LAYOUT.js tests/apple2_layout_v2.test.js
git commit -m "feat: normalize composer v1 and v2 layouts"
```

---

### Task 5: Build slot-qualified DOM registry and runtime APIs

**Files:**
- Modify: `res/COM_A2P_LAYOUT.js`
- Modify: `tests/apple2_layout_v2.test.js`

**Interfaces:**
- Consumes: Task 4 normalized layers with `{id,slotN,labels,address,...}`.
- Produces: registry entries keyed by canonical address and APIs `address(slotN,id)`, `getLayer(address)`, `visible(address,state)`, `visibleAt(slotN,id,state)`, and `find(query)`.

- [ ] **Step 1: Add failing registry/API tests**

Assert:

- `buildDOMComposition()` registers `A2P.7.DISKII.D2.LED`
- DOM node exposes semantic id, canonical address, slotN, and filename diagnostics
- `visibleAt(7,"DISKII.D2.LED",true)` changes only slot 7
- an identical semantic id in slot 6 remains unchanged
- `getLayer()` returns the qualified registry entry
- `find({slotN:7,PCODE:"DISKII",DCODE:"D2",ROLE:"LED"})` returns only matching entries
- `find()` with no matches returns `[]`
- pending visibility accepts qualified addresses before install and applies after registration
- deterministic v1 aliases still resolve during migration

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test tests/apple2_layout_v2.test.js
```

Expected: FAIL because registry keys are still flat v1 ids.

- [ ] **Step 3: Make DOM registration canonical-address based**

Store registry entries with exact fields:

```text
{id,address,slotN,labels,model,element}
```

Set diagnostics:

```text
data-layer-id
data-layout-address
data-slot-n
data-file
```

- [ ] **Step 4: Add runtime APIs**

Implement:

```text
LAYOUT.address(slotN,id) -> string
LAYOUT.visibleAt(slotN,id,state) -> boolean
LAYOUT.getLayer(address) -> entry|null
LAYOUT.find(query) -> entry[]
```

Keep `visible(address,state)` as the underlying canonical visibility operation and retain deterministic compatibility aliases for v1 callers.

- [ ] **Step 5: Keep `visibleByFile()` compatibility-only**

Do not remove it in this PR, but ensure no v2 lookup/registration path depends on it.

- [ ] **Step 6: Run tests and verify GREEN**

Run:

```bash
node --test tests/apple2_layout_v2.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add res/COM_A2P_LAYOUT.js tests/apple2_layout_v2.test.js
git commit -m "feat: add slot-qualified layout runtime API"
```

---

### Task 6: Migrate Disk II visual control to slot-qualified v2 addresses

**Files:**
- Modify: `res/COM_A2P_LAYOUT.js`
- Modify: `res/EMU_CARD_appledisk2.js` only where direct visual calls require slot awareness
- Create or modify: `tests/appledisk2_layout_v2.test.js`

**Interfaces:**
- Consumes: `oLAYOUT.visibleAt(slotN,id,state)` and Disk II `owner.mount.slotN`.
- Produces: Disk II BODY/LED/LID/GAP behavior that targets only the mounted controller's slot namespace.

- [ ] **Step 1: Write failing Disk II slot-isolation tests**

Cover:

- D1 BODY/LED/LID targets resolve under `A2P.<mount.slotN>.DISKII.D1.*`
- D2 BODY/LED/LID targets resolve under the same mounted slot only
- GAP rule resolves as `DISKII.GAP` in the mounted slot
- LED/lid activity in slot 7 does not affect identical semantic elements registered in slot 6
- attach/detach layout synchronization uses slot-qualified targets

- [ ] **Step 2: Run Disk II v2 tests and verify RED**

Run:

```bash
node --test tests/appledisk2_layout_v2.test.js
```

Expected: FAIL because current Disk II layout targets are unqualified `A2P.DISKII.*` ids.

- [ ] **Step 3: Make Disk II attachment target generation slot-aware**

In `patchDiskIIDeviceConfig(owner)`, derive the slot from `owner.mount.slotN` and address BODY/LED/LID/GAP through `oLAYOUT.address()` / `visibleAt()` rather than hard-coded unqualified ids.

- [ ] **Step 4: Make runtime LED/lid helpers slot-aware**

Where Disk II visual facade calls still use flat `A2P.DISKII.*`, route them through the mounted card's `slotN` and semantic ids. Preserve transitional v1 behavior through the compatibility alias layer rather than filename inference.

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```bash
node --test tests/appledisk2_layout_v2.test.js tests/apple2_layout_v2.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add res/COM_A2P_LAYOUT.js res/EMU_CARD_appledisk2.js tests/appledisk2_layout_v2.test.js
git commit -m "feat: migrate Disk II visuals to layout v2 addresses"
```

---

### Task 7: Full regression and branch-preview verification

**Files:**
- Modify only if regressions reveal necessary compatibility fixes.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified Composer v2 + v1 compatibility + Disk II integration.

- [ ] **Step 1: Run the new focused suites**

```bash
node --test tests/apple2_system_composer_v2.test.js tests/apple2_layout_v2.test.js tests/appledisk2_layout_v2.test.js
```

Expected: all tests PASS.

- [ ] **Step 2: Run existing layout/device regression suites available in the checkout**

At minimum run the repository's existing compositor, Disk II visual, device-attachment, and preview-distribution tests. If filenames differ in the current branch, use the workflow's authoritative test list rather than silently skipping them.

Expected: all tests PASS.

- [ ] **Step 3: Build the branch preview using the repository workflow/builder**

Verify that the preview HTML contains Composer/runtime script ownership expected by the existing distribution builder and that `COM_LAYOUT_CONFIG.js` v1 data continues to boot through normalization.

- [ ] **Step 4: Smoke-test a v2 embedded layout**

Use a small v2 layout containing at least:

```text
A2P.0.SYSTEM.MONITOR
A2P.7.DISKII.D1.BODY
A2P.7.DISKII.D1.LED
A2P.7.DISKII.D2.BODY
A2P.7.DISKII.D2.LED
```

Verify address lookup, visibility toggling, and slot isolation.

- [ ] **Step 5: Commit any compatibility fixes discovered by regression testing**

Use one focused commit per independently reviewable fix.

- [ ] **Step 6: Update the pull request description with verified commands/results**

Do not mark the PR ready for review until the focused suites and branch-preview verification are green.
