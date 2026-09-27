# Persistent Disk II Layer IDs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Disk II filename/coordinate ID inference with persistent emulator-owned layer IDs that the Composer preserves through import and every export format.

**Architecture:** Keep layout version 1. `layer.id` is an optional semantic runtime identifier owned by the emulator; Composer uses a separate private `uid` for editor state. Active Disk II data is migrated to explicit IDs and `COM_A2P_LAYOUT.js` removes `legacyDiskIILayerId()` entirely.

**Tech Stack:** Vanilla JavaScript, standalone HTML/JavaScript Composer, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-27-persistent-diskii-layer-ids-design.md`

## Global Constraints

- The emulator schema is authoritative; Composer adapts to it.
- Layout schema remains version 1.
- `layer.id` is optional, trimmed, and unique when present.
- Composer private identity is `uid`, not `id`.
- No filename/X-coordinate semantic inference remains.
- Archived layouts under `tools/GUI_DEV/assets/org/` remain unchanged.

## Review Focus

- A D1 LED at an arbitrary X coordinate must still validate as `A2P.DISKII.D1.LED`.
- A layer without `id` remains valid and exports without an `id` property.
- Duplicate semantic IDs are rejected in both runtime and Composer validation.
- JSON, embedded JSON, and JS Composer exports all share the same ID-preserving serializer.
- Editor selection/dragging/z-order continue to work independently of semantic IDs.

---

### Task 1: Add RED regression coverage

**Files:**
- Create: `tests/apple2_composer_layer_ids.test.js`
- Modify: `tests/apple2_html_layout.test.js`

**Interfaces:**
- Consumes: layout version-1 data and current Composer source.
- Produces: regression contract for persistent semantic IDs and removal of legacy inference.

- [ ] **Step 1: Write failing tests**

Assert the active config/source layouts contain all four Disk II IDs, Composer separates `uid` from semantic `id` and serializes IDs, and runtime source has no `legacyDiskIILayerId`/coordinate inference. Add a runtime behavioral test validating D1 at X=700 remains D1.

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test tests/apple2_composer_layer_ids.test.js tests/apple2_html_layout.test.js`
Expected: FAIL because active data lacks IDs, Composer drops them, and runtime still infers them.

### Task 2: Migrate active layout data and runtime compositor

**Files:**
- Modify: `res/COM_LAYOUT_CONFIG.js`
- Modify: `tools/GUI_DEV/assets/apple2-layout.json`
- Modify: `tools/GUI_DEV/assets/apple2-layout-embedded.json`
- Modify: `res/COM_A2P_LAYOUT.js`

**Interfaces:**
- Consumes: semantic IDs defined in the spec.
- Produces: explicit runtime layer identity with no inference helper.

- [ ] **Step 1: Add the four persistent IDs to active layout data**
- [ ] **Step 2: Remove `legacyDiskIILayerId()` and validate only explicit `layer.id`**
- [ ] **Step 3: Run runtime/data regressions**

Run: `node --test tests/apple2_composer_layer_ids.test.js tests/apple2_html_layout.test.js tests/appledisk2_layout_visuals.test.js`
Expected: Composer-specific assertions may still fail; runtime/data assertions pass.

### Task 3: Make Composer preserve emulator semantic IDs

**Files:**
- Modify: `tools/GUI_DEV/apple2-system-composer.html`

**Interfaces:**
- Consumes: optional emulator `layer.id`.
- Produces: private `uid` editor identity and ID-preserving import/export.

- [ ] **Step 1: Rename private editor identity from `id` to `uid`**
- [ ] **Step 2: Validate and preserve optional semantic `id`, rejecting duplicates**
- [ ] **Step 3: Add optional Runtime ID editor field**
- [ ] **Step 4: Make ordinary, embedded, and JS exports preserve semantic IDs**
- [ ] **Step 5: Run focused regressions**

Run: `node --test tests/apple2_composer_layer_ids.test.js tests/apple2_html_layout.test.js tests/appledisk2_layout_visuals.test.js tests/script_include_ownership.test.js tests/preview_distribution.test.js`
Expected: PASS.

### Task 4: Full verification and PR cleanup

**Files:**
- Delete temporary verification workflow if one was used.
- Remove plan/spec files from the final diff if desired; product and regression files remain.

**Interfaces:**
- Produces: reviewable draft PR against `main`.

- [ ] **Step 1: Run full Node suite and compare with repository baseline**
- [ ] **Step 2: Search the final tree for `legacyDiskIILayerId` and coordinate inference**
- [ ] **Step 3: Inspect `main...branch` diff for scope**
- [ ] **Step 4: Open a draft pull request targeting `main`**
