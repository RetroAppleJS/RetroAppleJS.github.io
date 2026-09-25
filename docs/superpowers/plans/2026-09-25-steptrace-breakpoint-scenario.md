# STEP TRACE Breakpoint Scenario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace STEP TRACE SCENARIO's private CPU-driving test runner with synchronous JavaScript callbacks executed by the existing STEP TRACE `BREAK IF` engine, while removing the now-dead `ASM_BUILD -> EMU_ASM_BUILD -> STB` live-load path.

**Architecture:** The live Apple II remains the sole execution owner and `Apple2Debug` remains the sole breakpoint owner. `DBG_steptrace_scenario.js` becomes a breakpoint-action client: it evaluates editor code once when armed, registers one synchronous callback, proxies STEP TRACE's loaded symbols, and requests either continue-through-breakpoint or normal halt. The obsolete assembler live-build provenance and direct-load services are deleted because the scenario path no longer consumes them.

**Tech Stack:** Vanilla JavaScript, RetroAppleJS live 6502/debugger APIs, DOM/Font Awesome UI, Node.js `node:test`, Node `zlib.inflateRawSync` for fixture validation.

**Spec:** `docs/superpowers/specs/2026-09-25-steptrace-breakpoint-scenario-design.md`

## Global Constraints

- Emulator execution and the selected STEP TRACE speed remain authoritative; scenario code must never start, step, pause, or schedule the CPU itself.
- The existing `BREAK IF` predicate is the only breakpoint expression engine.
- Breakpoint callbacks execute synchronously at the clean instruction boundary before the matching opcode.
- Successful RUN-mode callbacks continue through the matching breakpoint without entering persistent breakpoint-stop state.
- `haltAtBreakpoint()` and callback exceptions fail safe to the ordinary STEP TRACE halt at the same boundary.
- Scenario symbol lookup uses only STEP TRACE's currently loaded symbols.
- No `EMU_ASM_BUILD`, `ASM_BUILD`, `DBG_RAM`, or TEST BENCH dependency remains in STEP TRACE SCENARIO.
- Remove the special LOAD LIVE runtime/UI path rather than merely hiding it.
- Do not change TEST BENCH's isolated debugger semantics.
- No async/promise breakpoint callbacks in v1.
- Preserve existing STEP TRACE Play/Pause, Step In/Over/Out, loop skipper, speed control, BREAK IF syntax, and Arm/Disarm semantics.

## Review Focus

- A RUN-mode callback that mutates RAM/register-facing state must complete before the matching opcode executes; test ordering explicitly.
- A callback exception or `haltAtBreakpoint()` request must not accidentally leave the BREAK IF observer disarmed; the current boundary must halt and normal re-arm behavior must remain available.
- Closing/reopening the STEP TRACE SCENARIO popup while RUN mode is armed must preserve runtime callback state and render the correct icon/state when reopened.
- Symbol files may contain labels and EQU values with mixed case; scenario lookup must be case-insensitive and must never fall back to assembler or live-build symbols.
- Repeated breakpoint hits in an eternal 6502 loop must not recursively re-enter callback dispatch or create a host-side execution scheduler.

---

## File Map

**Modify**
- `res/EMU_apple2debug.js` — breakpoint-action hook, halt/continue dispatch, read-only STEP TRACE symbol API.
- `res/DBG_steptrace_scenario.js` — replace CPU-driving scenario runner with breakpoint callback runtime and two-state UI.
- `res/DBG_testbench.js` — stop loading obsolete assembler live-build services; continue loading TEST BENCH legacy + STEP TRACE scenario/layout.
- `asm/_TODO/INFLATE_ASM_CORE.S` — add explicit looping test driver outside decompressor scratch RAM.
- `asm/_TODO/INFLATE_ASM_CORE_testbench.js` — convert to `onBreakpoint()` harness; remove trampoline/`cpu.start()`/scenario-owned `breakIf()`.
- `docs/STEP_TRACE_MANUAL.md` — document HALT/RUN-at-breakpoint workflow and callback API.
- `tests/cpu_execution_condition.test.js` — breakpoint action and debugger symbol API regression coverage.
- `tests/debugger_steptrace_scenario.test.js` — callback lifecycle, UI state, symbol ownership, no CPU-driving/live-build dependencies.
- `tests/debugger_testbench_loader.test.js` — loader order after dead live-build path removal.
- `tests/inflate_steptrace_harness.test.js` — static harness contract plus independent DEFLATE manifest-length validation.

**Delete**
- `res/ASM_build_handoff.js` — neutral build snapshot service introduced only for direct live loading.
- `res/EMU_asm_build.js` — direct live RAM loader and LOAD LIVE UI.
- `tests/asm_build_handoff.test.js` — tests deleted service.
- `tests/emu_asm_build.test.js` — tests deleted service.
- `docs/ASM_BUILD_LIVE_HANDOFF.md` — superseded runtime design.

**Keep unchanged unless a failing regression proves otherwise**
- `res/DBG_testbench_legacy.js` — isolated TEST BENCH implementation.
- `res/DBG_steptrace_scenario_layout.js` — popup positioning/tab lifecycle only.
- `res/EMU_cpu6502.js` — existing persistent execution-condition mechanism already provides the required pre-opcode boundary.

## Public/API Changes

### `Apple2Debug`

Add:

```js
Apple2Debug.setBreakpointActionHandler(fnOrNull)
// fn receives BreakpointActionContext and returns normally to continue.
// null removes callback dispatch and restores ordinary HALT behavior.

Apple2Debug.breakpointActionState()
// -> { active:boolean, dispatching:boolean, lastError:string|null }

Apple2Debug.resolveSymbol(name)
// -> number|null

Apple2Debug.symbol(name)
// -> { name:string, value:number, type:string } | null

Apple2Debug.symbols()
// -> symbol records[]; defensive copies
```

Internal callback context:

```js
{
  A, X, Y, SP, P, PC, INS,
  condition,
  hit
}
```

`conditionalBreakpointTrap(state)` / the existing hit path must distinguish:

```text
no handler / handler requests halt / handler throws -> ordinary stop, CPU condition returns true
handler succeeds                              -> keep observer armed, CPU condition returns false
```

### `STB` / `DBG_STEPTRACE_SCENARIO`

Keep:

```js
STB.ram.read/write/read16/write16/fill/dump
STB.cpu.state()
STB.assert(...)
STB.sym(name[, fallback])
STB.symbol(name)
STB.symbols()
STB.print(...)
```

Add editor-scope helpers:

```js
onBreakpoint(fn)
haltAtBreakpoint()
```

Remove from the intended public scenario API and implementation:

```js
scenario()
reset()
cpu.start()
breakIf()
condition.compile/evaluate
syncBuild()
buildInfo()
```

The implementation should not leave the private stepping loop or duplicate expression parser dormant behind compatibility aliases; remove them.

## UI Behavior

The cloned STEP TRACE SCENARIO `Run` button becomes the breakpoint-action mode control.

**HALT state (default)**

```html
<i class="fa fa-pause"></i>
```

- label/title: `HALT at breakpoint`
- no scenario callback registered with `Apple2Debug`
- BREAK IF works exactly as today and persistently stops when matched

**RUN state**

```html
<i class="fa fa-sign-in-alt"></i>
```

- label/title: `RUN script at breakpoint`
- clicking from HALT evaluates the current editor exactly once
- editor must call `onBreakpoint(fn)` exactly once; otherwise arming fails and state stays HALT
- registered closure persists across repeated BREAK IF hits
- clicking RUN state toggles back to HALT and unregisters callback dispatch

**Runtime transitions**
- callback success: remain RUN and continue through the matching opcode
- `haltAtBreakpoint()`: switch UI/runtime to HALT and stop at the current boundary
- callback exception: print message + stack when available, switch to HALT, stop at current boundary
- popup close: does not disarm RUN mode
- popup reopen: icon/title reflect actual runtime mode
- Ctrl/Cmd+Enter while editor focused performs the same HALT->RUN arm action; it does not execute the callback immediately and does not start the CPU

## Migration Notes

- Existing STEP TRACE SCENARIO scripts built around `scenario()`, `cpu.start()`, and `breakIf()` are intentionally incompatible; convert them to one `onBreakpoint()` registration and let the live 6502 program own control flow.
- Existing assembler **to emulator** and **to debugger** workflows remain unchanged. Only the special direct **LOAD LIVE** control/service is removed.
- Existing STEP TRACE symbol JSON loading becomes the only symbol source for scenarios. Users should load the same symbol file they already use for labels/disassembly/BREAK IF work.
- `ASM_BUILD`, `ASM_INPUT`, `EMU_ASM_BUILD`, `ASM_loadLive`, live-build events, and the `LIVE #n` assembler status are removed with their runtime files.
- TEST BENCH continues to use `DBG_testbench_legacy.js` and its own debugger RAM/CPU exactly as before.
- Historical merged design/plan files may remain under `docs/superpowers/` as project history; the user-facing `docs/ASM_BUILD_LIVE_HANDOFF.md` is deleted because it would describe a workflow that no longer exists.

---

### Task 1: Add debugger-owned breakpoint action dispatch

**Files:**
- Modify: `res/EMU_apple2debug.js`
- Test: `tests/cpu_execution_condition.test.js`

**Interfaces:**
- Consumes: existing `conditionalBreakpointTrap(state)`, `evaluateConditionalBreakpoint(state)`, ordinary `conditionalBreakpointHit(state)`, and CPU `setExecutionCondition()` behavior.
- Produces: `setBreakpointActionHandler(fnOrNull)`, `breakpointActionState()`, synchronous pre-opcode dispatch, and the continue-vs-halt decision consumed by Task 3.

- [ ] **Step 1: Add failing tests for successful callback continuation and pre-opcode ordering**

Add a VM harness test that arms `PC==$0201`, installs a breakpoint action handler, records `state.pc`, and returns normally. Assert the handler sees `$0201`, RAM still contains the pre-opcode state, the callback fires once, the debugger does not set `conditionalBreakpoint.hit`, the execution condition returns `false`, and the next CPU cycle executes the `$0201` opcode.

```js
assert.equal(dbg.setBreakpointActionHandler(ctx => {
    hits++;
    seenPC = ctx.PC;
}), true);
assert.equal(installed.callback({pc:0x0201,a:0,x:0,y:0,sp:0xFF,p:0x20,ic:7}), false);
assert.equal(seenPC, 0x0201);
assert.equal(hits, 1);
assert.equal(dbg.liveState().conditionalBreakpoint.hit, false);
assert.equal(dbg.liveState().conditionalBreakpoint.armed, true);
```

- [ ] **Step 2: Add failing tests for repeated hits, explicit halt request plumbing, exception fail-safe, and re-entry protection**

Use three handlers:

```js
// repeated success
ctx => { hits++; }

// explicit halt signal returned by the wrapper installed by STEP TRACE scenario
ctx => { hits++; return { halt:true }; }

// exception
ctx => { throw new Error('boom'); }
```

Assert successful dispatch stays armed across two callbacks; halt/error return `true` from the CPU execution condition and set normal breakpoint-stop state; recursive dispatch attempts are rejected/fail-safe rather than invoking the handler twice.

- [ ] **Step 3: Run the focused debugger tests and verify RED**

Run:

```bash
node --test tests/cpu_execution_condition.test.js
```

Expected: new assertions fail because the breakpoint action API does not exist and current hit logic always disarms/stops.

- [ ] **Step 4: Implement minimal breakpoint action state and dispatch in `EMU_apple2debug.js`**

Add debugger-owned state:

```js
var breakpointActionHandler = null;
var breakpointActionDispatching = false;
var breakpointActionLastError = null;
```

Expose:

```js
this.setBreakpointActionHandler = function(fn)
{
    if(fn!==null && typeof fn!=="function") throw new TypeError("Breakpoint action handler must be a function or null.");
    breakpointActionHandler = fn;
    breakpointActionLastError = null;
    return !!breakpointActionHandler;
};

this.breakpointActionState = function()
{
    return {
        active:typeof breakpointActionHandler==="function",
        dispatching:breakpointActionDispatching,
        lastError:breakpointActionLastError
    };
};
```

At a matched condition, before ordinary halt handling, build a defensive context from the live state:

```js
var ctx = {
    A:state.a&0xff,
    X:state.x&0xff,
    Y:state.y&0xff,
    SP:state.sp&0xff,
    P:state.p&0xff,
    PC:state.pc&0xffff,
    INS:Number(state.ic)||0,
    condition:conditionalBreakpoint.condition,
    hit:conditionalBreakpoint.hits+1
};
```

Dispatch synchronously. A normal return continues unless the handler returns `{halt:true}`. Do not clear/disarm the execution condition on successful continuation. On `{halt:true}`, throw, or re-entry detection, clear the handler or leave that choice to Task 3 only as specified by the handler result, then execute the existing ordinary stop path.

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
node --test tests/cpu_execution_condition.test.js
```

Expected: all breakpoint regression tests pass, including existing ordinary HALT behavior.

- [ ] **Step 6: Commit Task 1**

```bash
git add res/EMU_apple2debug.js tests/cpu_execution_condition.test.js
git commit -m "feat: dispatch STEP TRACE breakpoint actions"
```

---

### Task 2: Make STEP TRACE's loaded symbol table queryable by scenarios

**Files:**
- Modify: `res/EMU_apple2debug.js`
- Test: `tests/cpu_execution_condition.test.js`

**Interfaces:**
- Consumes: existing `loadSymbolObject()`, `loadSymbolsText()`, `loadedLabels`, `loadedSymbols`, and symbol-state lifecycle.
- Produces: `resolveSymbol(name)`, `symbol(name)`, `symbols()` consumed by Task 3.

- [ ] **Step 1: Write failing mixed-case label/EQU lookup tests**

Load symbol JSON through the real debugger API, including:

```js
{
  symbols:[
    {type:'label', name:'inflate_test_loop', value:'$0D10'},
    {type:'equ', name:'inputPointer', value:'$00F0'}
  ]
}
```

Assert:

```js
assert.equal(dbg.resolveSymbol('INFLATE_TEST_LOOP'),0x0D10);
assert.equal(dbg.resolveSymbol('inputpointer'),0x00F0);
assert.equal(dbg.resolveSymbol('missing'),null);
assert.deepEqual(dbg.symbol('inputPointer'),{name:'inputPointer',value:0x00F0,type:'equ'});
assert.ok(dbg.symbols().some(s => s.name==='inflate_test_loop'));
```

Mutate a returned record/array and assert the debugger's next result is unchanged.

- [ ] **Step 2: Add a failing replacement/clear test**

Load symbol file A, then symbol file B. Assert A's names disappear completely and B's names resolve; no assembler `oASM.symlink` fallback is used by the new API.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
node --test tests/cpu_execution_condition.test.js
```

Expected: failures because the read-only name-indexed API does not exist.

- [ ] **Step 4: Implement a case-insensitive name map updated atomically with loaded symbols**

Add:

```js
var loadedSymbolNames = Object.create(null);
```

Populate it inside the same `loadSymbolObject()` transaction that builds address-indexed arrays. Preserve original spelling/type in each record; canonical key is `name.trim().toUpperCase()`.

Expose defensive read-only methods:

```js
this.resolveSymbol = function(name) { ... };
this.symbol = function(name) { ... };
this.symbols = function() { ... };
```

Do not consult `oASM`, `asm`, `EMU_ASM_BUILD`, or TEST BENCH in these methods.

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
node --test tests/cpu_execution_condition.test.js
```

- [ ] **Step 6: Commit Task 2**

```bash
git add res/EMU_apple2debug.js tests/cpu_execution_condition.test.js
git commit -m "feat: expose STEP TRACE loaded symbols"
```

---

### Task 3: Replace STEP TRACE SCENARIO CPU runner with breakpoint callback runtime

**Files:**
- Modify: `res/DBG_steptrace_scenario.js`
- Test: `tests/debugger_steptrace_scenario.test.js`

**Interfaces:**
- Consumes: Task 1 `Apple2Debug.setBreakpointActionHandler()` / `breakpointActionState()` and Task 2 symbol APIs.
- Produces: `onBreakpoint(fn)`, `haltAtBreakpoint()`, callback-mode state, revised STB RAM/assert/symbol helper surface.

- [ ] **Step 1: Rewrite/add failing tests for editor arming semantics**

Create a debugger stub exposing the Task 1/2 API. Assert clicking/arming the scenario script evaluates editor code once, requires exactly one `onBreakpoint(fn)`, and installs a debugger breakpoint action handler without calling debugger `play()`, CPU `setState()`, `stepLiveInstruction()`, or any scheduler.

Example script:

```js
let count = 0;
onBreakpoint(function(bp){
  count++;
  print('hit '+count+' at '+hex(bp.PC,4));
});
```

Assert two simulated breakpoint dispatches produce hit 1/hit 2 without re-evaluating the editor.

- [ ] **Step 2: Add failing tests for `haltAtBreakpoint()`, exception fail-safe, and popup persistence**

Assert:

```js
onBreakpoint(function(){ haltAtBreakpoint(); });
```

causes the wrapper handed to `Apple2Debug` to return `{halt:true}`, unregisters RUN mode after the hit, and the UI state becomes HALT. Throwing `Error('boom')` has the same halt result and logs `boom`. Close/reopen the popup and verify RUN/HALT icon derives from runtime state, not DOM history.

- [ ] **Step 3: Add failing tests proving scenario symbols proxy STEP TRACE only**

The test context must omit `EMU_ASM_BUILD`, `ASM_BUILD`, `DBG_RAM`, and `TB`. Stub debugger symbol methods and assert:

```js
STB.sym('inputPointer') === 0xF0
STB.symbol('inflate_test_loop').value === 0x0D10
STB.symbols().length === 2
```

Also assert missing symbols throw an explicit STEP TRACE symbol error unless a fallback is provided to `sym()`.

- [ ] **Step 4: Add source-level failing assertions that the duplicate execution engine is gone**

Assert `res/DBG_steptrace_scenario.js` no longer contains implementation references for:

```text
runLiveInstructionBatch
stepLiveInstruction
cpu.start
S.breakIf
condition.compile
condition.evaluate
syncBuild
buildInfo
EMU_ASM_BUILD
clearConditionalBreakpoint inside scenario execution
```

- [ ] **Step 5: Run scenario tests and verify RED**

```bash
node --test tests/debugger_steptrace_scenario.test.js
```

- [ ] **Step 6: Refactor `DBG_steptrace_scenario.js` to a callback-only runtime**

Keep mapped live RAM helpers and `cpu.state()`. Remove the condition tokenizer/parser/evaluator, private execution loop, `scenario()` result runner, reset/start execution controls, live-build symbol cache, and build events.

Use internal state:

```js
var breakpointCallback = null;
var breakpointMode = 'halt';
var callbackRunning = false;
var haltRequested = false;
```

Implement editor helpers:

```js
function onBreakpoint(fn) {
    if(typeof fn!=='function') throw new TypeError('onBreakpoint() requires a function.');
    if(breakpointCallback) throw new Error('Only one onBreakpoint() callback may be registered.');
    breakpointCallback = fn;
    return fn;
}

function haltAtBreakpoint() {
    if(!callbackRunning) throw new Error('haltAtBreakpoint() is only valid inside onBreakpoint().');
    haltRequested = true;
}
```

The wrapper installed into `Apple2Debug` must set `callbackRunning`, call the persistent closure, then return `{halt:true}` when requested or on exception; otherwise return normally.

- [ ] **Step 7: Implement the HALT/RUN button state without starting the emulator**

Replace the old run handler with `armBreakpointScript()` / `disarmBreakpointScript()` / `toggleBreakpointScript()`.

HALT render:

```html
<i class="fa fa-pause"></i>
```

RUN render:

```html
<i class="fa fa-sign-in-alt"></i>
```

Update button title and `aria-pressed`. Ctrl/Cmd+Enter calls the same toggle/arm routine rather than immediate `eval()` execution.

- [ ] **Step 8: Run scenario tests and verify GREEN**

```bash
node --test tests/debugger_steptrace_scenario.test.js
```

- [ ] **Step 9: Commit Task 3**

```bash
git add res/DBG_steptrace_scenario.js tests/debugger_steptrace_scenario.test.js
git commit -m "feat: run STEP TRACE scenarios at breakpoints"
```

---

### Task 4: Remove the obsolete assembler live-load path

**Files:**
- Modify: `res/DBG_testbench.js`
- Delete: `res/ASM_build_handoff.js`
- Delete: `res/EMU_asm_build.js`
- Delete: `tests/asm_build_handoff.test.js`
- Delete: `tests/emu_asm_build.test.js`
- Delete: `docs/ASM_BUILD_LIVE_HANDOFF.md`
- Modify: `tests/debugger_testbench_loader.test.js`
- Search/update: any standard-page/runtime references to `ASM_BUILD`, `EMU_ASM_BUILD`, `ASM_loadLive`, `ASM_loadLiveHeaderButton`, `ASM_liveBuildState`, `retroapple:emu-build-loaded`, `retroapple:emu-build-cleared`

**Interfaces:**
- Consumes: Task 3 no longer needs any live-build service.
- Produces: normal runtime with TEST BENCH legacy + STEP TRACE scenario only; no LOAD LIVE user control or live-build globals.

- [ ] **Step 1: Change the loader test to the desired script list and verify RED**

Expected ordered runtime scripts in `DBG_testbench.js`:

```js
[
  'res/DBG_testbench_legacy.js',
  'res/DBG_steptrace_scenario.js',
  'res/DBG_steptrace_scenario_layout.js'
]
```

Assert no `ASM_build_handoff.js` or `EMU_asm_build.js` references remain.

- [ ] **Step 2: Add repository-source assertions for dead-path removal**

In `tests/debugger_testbench_loader.test.js` or a focused companion test, read `index.html`, `res/DBG_testbench.js`, and `res/DBG_steptrace_scenario.js` and assert absence of runtime/UI identifiers:

```text
ASM_loadLive
ASM_loadLiveHeaderButton
ASM_liveBuildState
EMU_ASM_BUILD
retroapple:emu-build-loaded
retroapple:emu-build-cleared
```

Do not assert against historical `docs/superpowers/specs` or `docs/superpowers/plans` files.

- [ ] **Step 3: Run loader/dead-path tests and verify RED**

```bash
node --test tests/debugger_testbench_loader.test.js tests/debugger_steptrace_scenario.test.js
```

- [ ] **Step 4: Remove the services and references**

Edit `res/DBG_testbench.js` script array to the three retained files. Delete the two runtime service files, their dedicated tests, and `docs/ASM_BUILD_LIVE_HANDOFF.md`. Remove any integration glue that wraps assembler operations solely to publish `ASM_BUILD`/input revisions.

Do not alter existing Assembler **to emulator** or **to debugger** controls.

- [ ] **Step 5: Search the runtime tree for orphan references**

Run:

```bash
grep -R "EMU_ASM_BUILD\|ASM_loadLive\|ASM_loadLiveHeaderButton\|ASM_liveBuildState\|retroapple:emu-build-" res index.html asm tests docs/STEP_TRACE_MANUAL.md docs/ASM_BUILD_LIVE_HANDOFF.md 2>/dev/null || true
```

Expected: no runtime/test/manual matches; `docs/ASM_BUILD_LIVE_HANDOFF.md` no longer exists. Historical superpowers docs are intentionally excluded.

- [ ] **Step 6: Run affected tests and verify GREEN**

```bash
node --test tests/debugger_testbench_loader.test.js tests/debugger_steptrace_scenario.test.js tests/cpu_execution_condition.test.js
```

- [ ] **Step 7: Commit Task 4**

```bash
git add -A res/DBG_testbench.js res/ASM_build_handoff.js res/EMU_asm_build.js tests/asm_build_handoff.test.js tests/emu_asm_build.test.js tests/debugger_testbench_loader.test.js docs/ASM_BUILD_LIVE_HANDOFF.md
git commit -m "refactor: remove STEP TRACE live-build handoff"
```

---

### Task 5: Convert INFLATE validation to breakpoint-driven control flow

**Files:**
- Modify: `asm/_TODO/INFLATE_ASM_CORE.S`
- Modify: `asm/_TODO/INFLATE_ASM_CORE_testbench.js`
- Modify: `tests/inflate_steptrace_harness.test.js`

**Interfaces:**
- Consumes: Task 3 `onBreakpoint(fn)`, `haltAtBreakpoint()`, `STB.ram`, `STB.cpu.state()`, `STB.assert`, STEP TRACE symbols.
- Produces: explicit 6502 eternal test loop and 15-vector host harness with no trampoline/host-driven CPU execution.

- [ ] **Step 1: Write failing source-structure tests for the assembly test driver**

Assert `INFLATE_ASM_CORE.S` contains labels at an address outside the `$0A00` scratch/guard region:

```asm
        ORG     $0D10
inflate_test_loop
        JSR     inflate
inflate_test_done
        JMP     inflate_test_loop
```

Also assert the decompressor's existing `inflate=$0800` / `inflate_data=$0A00` declarations remain unchanged.

- [ ] **Step 2: Rewrite harness contract tests to require `onBreakpoint()` and forbid host execution control**

Assert the JS harness contains:

```js
onBreakpoint(function(bp) { ... })
```

and references both `inflate_test_loop` and `inflate_test_done`. Assert it does **not** contain:

```text
installTrampoline
CFG.trampoline
STB.cpu.start
STB.breakIf
STB.scenario
PC==$0203
```

- [ ] **Step 3: Add independent manifest-length regression for every vector**

In `tests/inflate_steptrace_harness.test.js`, parse each `{hex, expectedBytes}` vector and validate with Node:

```js
const zlib = require('node:zlib');
const actual = zlib.inflateRawSync(Buffer.from(hex,'hex'));
assert.equal(actual.length, expectedBytes, name);
```

This must pin `fixed_all_distance_ranges` at `33426` and catch any future fixture drift.

- [ ] **Step 4: Run INFLATE tests and verify RED**

```bash
node --test tests/inflate_steptrace_harness.test.js
```

Expected: failures for missing loop driver and old trampoline/CPU-driving harness.

- [ ] **Step 5: Add the explicit 6502 test driver**

Append the `$0D10` loop exactly as specified. Keep it out of the decompressor and `$0A00` scratch allocation. Ensure assembler symbols export both breakpoint locations.

- [ ] **Step 6: Refactor the JS harness into a persistent callback state machine**

Use state such as:

```js
let index = 0;
let prepared = false;
let startSP = null;
const results = [];

onBreakpoint(function(bp) {
    if(bp.PC === STB.sym('inflate_test_loop')) {
        if(index >= selected.length) return haltAtBreakpoint();
        prepareCase(selected[index], ...);
        startSP = bp.SP;
        prepared = true;
        return;
    }

    if(bp.PC === STB.sym('inflate_test_done')) {
        if(!prepared) throw new Error('Reached inflate_test_done without a prepared vector.');
        verifyCase(selected[index], startSP);
        prepared = false;
        index++;
        if(index >= selected.length) {
            printSummary(results);
            haltAtBreakpoint();
        }
    }
});
```

At the start breakpoint prepare input/output/scratch/guards and pointer values. At the done breakpoint read results, compare with Pako, validate input/output pointers, guards, and stack, then advance. Do not modify PC or start/pause execution.

- [ ] **Step 7: Run INFLATE tests and verify GREEN**

```bash
node --test tests/inflate_steptrace_harness.test.js
```

- [ ] **Step 8: Commit Task 5**

```bash
git add asm/_TODO/INFLATE_ASM_CORE.S asm/_TODO/INFLATE_ASM_CORE_testbench.js tests/inflate_steptrace_harness.test.js
git commit -m "test: drive INFLATE validation from STEP TRACE breakpoints"
```

---

### Task 6: Update the STEP TRACE manual and migration guidance

**Files:**
- Modify: `docs/STEP_TRACE_MANUAL.md`
- Test: `tests/debugger_steptrace_scenario.test.js` or a small documentation-source assertion in the existing test file

**Interfaces:**
- Consumes: final APIs/UI from Tasks 1-5.
- Produces: user-facing instructions matching actual behavior.

- [ ] **Step 1: Add failing documentation assertions for the new terminology and removal of LOAD LIVE guidance**

Assert the manual contains:

```text
HALT at breakpoint
RUN script at breakpoint
onBreakpoint
haltAtBreakpoint
```

and does not instruct the user to use `LOAD LIVE`, `EMU_ASM_BUILD`, `cpu.start()`, or scenario-owned `breakIf()`.

- [ ] **Step 2: Run documentation-associated test and verify RED**

```bash
node --test tests/debugger_steptrace_scenario.test.js
```

- [ ] **Step 3: Rewrite the STEP TRACE SCENARIO manual section**

Document this journey:

```text
1. Load/run program through ordinary emulator workflow.
2. Load symbol JSON into STEP TRACE if symbolic names are desired.
3. Set BREAK IF, e.g. PC==inflate_test_loop || PC==inflate_test_done.
4. Start emulator at desired speed.
5. Open STEP TRACE SCENARIO and enter a script registering onBreakpoint(fn).
6. Toggle to RUN script at breakpoint.
7. Successful callbacks continue automatically; haltAtBreakpoint() returns to ordinary halt behavior.
```

Explain that the script is evaluated once when armed and closure state persists across hits. Include the two Font Awesome states and a short two-location example. Explicitly state that scenario JS does not run the emulator.

- [ ] **Step 4: Run documentation-associated test and verify GREEN**

```bash
node --test tests/debugger_steptrace_scenario.test.js
```

- [ ] **Step 5: Commit Task 6**

```bash
git add docs/STEP_TRACE_MANUAL.md tests/debugger_steptrace_scenario.test.js
git commit -m "docs: explain breakpoint-driven STEP TRACE scenarios"
```

---

### Task 7: Full regression, browser smoke, and PR readiness

**Files:**
- Test only; modify production only if a discovered regression is directly within this spec.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: evidence that the branch is safe to review/merge.

- [ ] **Step 1: Run the full Node test suite**

```bash
node --test tests/*.test.js
```

Expected: PASS; deleted live-build tests are absent, all remaining tests green.

- [ ] **Step 2: Run source searches for forbidden runtime dependencies**

```bash
grep -R "EMU_ASM_BUILD\|ASM_loadLive\|ASM_loadLiveHeaderButton\|ASM_liveBuildState" res index.html asm tests docs/STEP_TRACE_MANUAL.md 2>/dev/null && exit 1 || true
grep -n "STB\.breakIf\|STB\.cpu\.start\|installTrampoline\|PC==\$0203" asm/_TODO/INFLATE_ASM_CORE_testbench.js && exit 1 || true
```

Expected: no matches.

- [ ] **Step 3: Browser smoke the ordinary HALT path**

In the real emulator:

```text
- Open STEP TRACE.
- Set BREAK IF to a reachable PC and Arm.
- Leave scenario control at HALT.
- Run CPU.
- Verify it stops before the matching opcode with the existing breakpoint-stop indicator.
```

- [ ] **Step 4: Browser smoke RUN-at-breakpoint with a tiny eternal loop**

Use a live program that repeatedly reaches two known PCs. Arm a script that increments/prints a counter. Verify the emulator keeps running at the selected STEP TRACE speed and the callback fires repeatedly without the scenario code driving execution.

- [ ] **Step 5: Browser smoke explicit halt and exception behavior**

First call `haltAtBreakpoint()` on the third hit and verify the CPU remains stopped at that boundary and the control returns to HALT. Then re-arm with a callback that throws and verify the same fail-safe stop plus readable console error.

- [ ] **Step 6: Browser-run the full INFLATE workflow**

```text
- Assemble/load `INFLATE_ASM_CORE.S` through the ordinary emulator workflow.
- Load symbols into STEP TRACE.
- Set BREAK IF to `PC==inflate_test_loop || PC==inflate_test_done`.
- Start at `inflate_test_loop`.
- Arm `INFLATE_ASM_CORE_testbench.js` as RUN-at-breakpoint.
```

Expected final console result:

```text
PASS 15/15
```

No trampoline address `$0200`, LOAD LIVE operation, or host-driven `BREAK` lines should be part of the flow.

- [ ] **Step 7: Verify branch diff is scoped**

```bash
git status --short
git diff --stat main...HEAD
git diff --check main...HEAD
```

Expected: clean working tree, only planned files changed/deleted, no whitespace errors.

- [ ] **Step 8: Commit any final test-only adjustments, if required by the verified behavior**

If no adjustment is required, do not create an empty commit. Otherwise commit only the verified regression fix with a narrow message.
