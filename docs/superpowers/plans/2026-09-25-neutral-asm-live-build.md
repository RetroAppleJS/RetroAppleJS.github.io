# Neutral ASM Live Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove STEP TRACE SCENARIO's dependency on the isolated TEST BENCH by introducing an immutable neutral assembler build, a transactional direct live-RAM loader, and STB-owned live symbols.

**Architecture:** `ASM_BUILD` snapshots successful assembler output independently of any target. `EMU_ASM_BUILD` consumes the snapshot and transactionally installs main-RAM segments into the real Apple II; STEP TRACE imports only the resulting live-build symbols. Existing debugger and legacy emulator-paste paths remain separate consumers and are not used by the live scenario.

**Tech Stack:** Browser JavaScript, Node `node:test`, existing RetroAppleJS assembler/emulator globals.

**Spec:** `docs/ASM_BUILD_LIVE_HANDOFF.md`

## Global Constraints

- TEST BENCH and STEP TRACE execution realms remain completely separate.
- No live scenario path may read program bytes or symbols from `TB`, `DBG_TESTBENCH` or `DBG_RAM`.
- `$C000-$CFFF` must never be touched by the direct live loader.
- V1 direct live loading accepts only `$0000-$BFFF`; mapped upper RAM remains fail-closed for a later provider implementation.
- Direct load is synchronous and transaction-like: verify success or restore the pre-load main-RAM snapshot.
- Numeric STEP TRACE scenarios continue to work with no assembler build.
- Existing **to emulator** paste staging keeps its current semantics.
- Existing **to debugger** remains isolated from live RAM.

## Review Focus

- Multi-ORG and overlapping assembler output must retain emission order and later-byte override semantics.
- Source edits after a successful build must not silently mark an older live build as current.
- A failed live verification must restore the exact pre-load main-RAM bytes and keep previous live provenance.
- `$C000-$FFFF` input must fail before any main-RAM mutation.
- STEP TRACE must initialize and resolve numeric expressions with `window.TB` completely absent.

---

### Task 1: Neutral assembler build service

**Files:**
- Create: `res/ASM_build_handoff.js`
- Create: `tests/asm_build_handoff.test.js`

**Interfaces:**
- Produces: `ASM_INPUT`, `ASM_BUILD`, `ASM_BUILD.extractCurrent()`, `ASM_BUILD.ensureFresh()`, immutable `AssemblerBuild` snapshots.
- Consumes: `window.asmCompileResult`, `window.oASM`, assembler source DOM and `ASM_assembleCurrentSource()` when available.

- [ ] **Step 1: Write failing tests** for compile-result extraction, multi-ORG segmentation, overlap preservation, canonical symbols, immutable snapshots and source revision freshness.
- [ ] **Step 2: Run `node --test tests/asm_build_handoff.test.js` and verify RED** because `res/ASM_build_handoff.js` does not exist.
- [ ] **Step 3: Implement minimal `ASM_INPUT`/`ASM_BUILD` service**. Prefer `asmCompileResult.bytes` records with explicit `pc`; fall back to `oASM.get_code_len()/read_code()/code_pc`. Copy symbols from compiled/oASM symtab and omit `.SCLOCAL_*` names.
- [ ] **Step 4: Add successful-assembly publication integration** by wrapping `ASM_assembleCurrentSource()` on page load without changing the existing assembler implementation.
- [ ] **Step 5: Run the focused test and verify GREEN.**

### Task 2: Transactional direct live loader and UI action

**Files:**
- Create: `res/EMU_asm_build.js`
- Extend: `tests/asm_build_handoff.test.js`

**Interfaces:**
- Consumes: `ASM_BUILD` snapshots and `apple2plus.hwObj().safe_flashdump()/load_ram64k()`.
- Produces: `RetroAppleBuildError`, `EMU_ASM_BUILD.load/current/status/clear`, `retroapple:emu-build-loaded` and `retroapple:emu-build-cleared`, and an Assembler **load live** UI control.

- [ ] **Step 1: Add failing tests** proving direct main-RAM install, rejection of `$C000-$CFFF` and `$D000-$FFFF`, verification, clean rollback and invalid provenance on failed rollback.
- [ ] **Step 2: Run focused tests and verify RED.**
- [ ] **Step 3: Implement the minimal synchronous loader**: snapshot 48K main RAM, create a candidate image, apply overlapping segments in emission order, import, verify target bytes, rollback/verify on failure, and commit provenance only after verification.
- [ ] **Step 4: Add the dynamic Assembler `load live` button and derived tooltip/status** without a MutationObserver.
- [ ] **Step 5: Run focused tests and verify GREEN.**

### Task 3: Remove TEST BENCH symbol dependency from STEP TRACE

**Files:**
- Modify: `res/DBG_steptrace_scenario.js`
- Modify: `tests/debugger_steptrace_scenario.test.js`

**Interfaces:**
- Consumes: `EMU_ASM_BUILD.current()` and its live-build events.
- Produces: `STB.buildInfo()`, `STB.syncBuild()`, local `STB.sym/symbol/symbols`, and symbol resolution for addresses/conditions independent of TEST BENCH.

- [ ] **Step 1: Change the test harness first** so it has no `TB`/`DBG_TESTBENCH`; provide an `EMU_ASM_BUILD` live build and assert symbolic RAM/address/condition use still works.
- [ ] **Step 2: Run `node --test tests/debugger_steptrace_scenario.test.js` and verify RED** with the current TEST BENCH dependency.
- [ ] **Step 3: Replace the internal `TB()`/`sym()` path** with a local symbol map synchronized from `EMU_ASM_BUILD` at initialization, scenario start and live-build events.
- [ ] **Step 4: Add no-build tests** proving numeric scenarios still work and symbolic lookup fails clearly.
- [ ] **Step 5: Run scenario tests and verify GREEN.**

### Task 4: Load services before STEP TRACE

**Files:**
- Modify: `res/DBG_testbench.js`
- Modify: `tests/debugger_testbench_loader.test.js`

**Interfaces:**
- Produces loader order: `ASM_build_handoff.js` -> `EMU_asm_build.js` -> legacy TEST BENCH -> STEP TRACE scenario -> layout.

- [ ] **Step 1: Update loader-order test first** and verify it fails against current loader.
- [ ] **Step 2: Add the two new service scripts ahead of STEP TRACE.**
- [ ] **Step 3: Run loader tests and verify GREEN.**

### Task 5: Convert INFLATE harness to a pure live scenario

**Files:**
- Modify: `asm/_TODO/INFLATE_ASM_CORE_testbench.js`
- Modify: `tests/inflate_steptrace_harness.test.js`

**Interfaces:**
- Consumes: already-loaded `STB` live build and its symbols.
- Removes: `TB.ram.read()` and any debugger-install step.

- [ ] **Step 1: Update the harness test first** to reject references to `TB`, `DBG_RAM`, `DBG_TESTBENCH` and the `installLiveProgram` copy bridge; require `STB.buildInfo()` preflight instead.
- [ ] **Step 2: Run harness test and verify RED.**
- [ ] **Step 3: Rewrite only the harness preflight/program-install portion** so it requires a live assembler build and required INFLATE symbols, then runs the existing 15 vectors unchanged.
- [ ] **Step 4: Run harness tests and verify GREEN.**

### Task 6: Focused regression suite and documentation check

**Files:**
- Modify if necessary: `docs/STEP_TRACE_MANUAL.md`

**Interfaces:**
- Verifies the complete handoff and documents the new user workflow.

- [ ] **Step 1: Run syntax checks** on all changed/new JavaScript files.
- [ ] **Step 2: Run focused Node suite:** `node --test tests/asm_build_handoff.test.js tests/debugger_steptrace_scenario.test.js tests/debugger_testbench_loader.test.js tests/inflate_steptrace_harness.test.js tests/debugger_steptrace_scenario_ui.test.js tests/debugger_steptrace_scenario_observer.test.js`.
- [ ] **Step 3: Update STEP TRACE documentation if the existing text still tells users to source live code from TEST BENCH.**
- [ ] **Step 4: Search changed live-path files for forbidden dependencies:** `TB.ram`, `DBG_RAM`, `DBG_TESTBENCH` in STEP TRACE/INFLATE live paths.
- [ ] **Step 5: Review branch diff against `docs/ASM_BUILD_LIVE_HANDOFF.md`, then open the pull request.**
