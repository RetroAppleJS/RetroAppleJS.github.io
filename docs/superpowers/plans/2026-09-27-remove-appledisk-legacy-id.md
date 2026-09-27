# Remove AppleDisk Legacy ID Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `AppleDisk2` the only Disk II discovery ID and remove the obsolete `AppleDisk` compatibility alias from `tools/DiskJS.html`.

**Architecture:** Keep `EMU_CARD_appledisk2.js` unchanged because it already registers the canonical `AppleDisk2` component. Update only the standalone DiskJS lookup/bootstrap path and add a source-level regression test that rejects the legacy alias while preserving `AppleDisk2` initialization.

**Tech Stack:** Vanilla JavaScript, Node.js built-in test runner.

**Spec:** User request in this conversation.

## Global Constraints

- `AppleDisk2` remains the only canonical discovery ID.
- Do not reintroduce `oEMU.component.IO["AppleDisk"]`.
- Preserve standalone DiskJS creation of `new AppleDisk2()` when the discovery instance is absent.

## Review Focus

- Existing `AppleDisk2` discovery instance is reused.
- Missing discovery instance still creates `AppleDisk2`.
- Standalone DiskJS still assigns the default Disk II slot context.
- No `AppleDisk` fallback remains.
- No `AppleDisk` alias assignment remains.

---

### Task 1: Remove the legacy Disk II discovery ID

**Files:**
- Modify: `tools/DiskJS.html`
- Create: `tests/diskjs_component_id.test.js`

**Interfaces:**
- Consumes: `oEMU.component.IO["AppleDisk2"]`, global `AppleDisk2` constructor.
- Produces: `disk_appledisk()` using only the canonical `AppleDisk2` discovery ID.

- [ ] **Step 1: Write the failing regression test**

Assert that `tools/DiskJS.html` contains the `AppleDisk2` lookup/assignment and contains neither the `AppleDisk` fallback nor alias assignment.

- [ ] **Step 2: Run the test to verify RED**

Run: `node --test tests/diskjs_component_id.test.js`
Expected: FAIL because `tools/DiskJS.html` still contains `oEMU.component.IO["AppleDisk"]`.

- [ ] **Step 3: Implement the minimal cleanup**

Change the lookup to `var disk2 = oEMU.component.IO["AppleDisk2"];` and remove the legacy alias assignment/comment. Preserve the constructor and default-slot bootstrap logic.

- [ ] **Step 4: Run the test to verify GREEN**

Run: `node --test tests/diskjs_component_id.test.js`
Expected: PASS.

- [ ] **Step 5: Run relevant regression tests**

Run the Disk II/DiskJS-related Node tests plus the full Node suite; confirm no new failures beyond the repository baseline.

- [ ] **Step 6: Commit and open a pull request**

Use a focused refactor commit and target `main`.
