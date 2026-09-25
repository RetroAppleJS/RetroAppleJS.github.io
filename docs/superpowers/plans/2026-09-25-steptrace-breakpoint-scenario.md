# STEP TRACE Breakpoint Scenario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace STEP TRACE SCENARIO's private CPU-driving test runner with synchronous JavaScript callbacks dispatched by the existing STEP TRACE `BREAK IF` engine, and remove the now-dead `ASM_BUILD -> EMU_ASM_BUILD -> STB` live-load path.

**Architecture:** The live Apple II remains the sole execution owner and `Apple2Debug` remains the sole breakpoint owner. `DBG_steptrace_scenario.js` becomes a breakpoint-action client: editor code is evaluated once when armed, one callback closure is registered, that callback runs synchronously before the matching opcode, and normal execution continues unless the script requests a halt or throws. STEP TRACE's own loaded symbol table becomes the single symbol universe for BREAK IF and scenario JavaScript. The direct LOAD LIVE/build-provenance services are deleted because no runtime consumer remains.

**Tech Stack:** Vanilla JavaScript, RetroAppleJS live 6502/debugger APIs, DOM/Font Awesome UI, Node.js `node:test`, Node `zlib.inflateRawSync`.

**Spec:** `docs/superpowers/specs/2026-09-25-steptrace-breakpoint-scenario-design.md`

## Global Constraints

- Emulator execution and the selected STEP TRACE speed remain authoritative; scenario code must never start, step, pause, resume, or schedule the CPU itself.
- The existing STEP TRACE `BREAK IF` predicate is the only breakpoint expression engine.
- Breakpoint callbacks execute synchronously at the clean instruction boundary before the matching opcode.
- A successful RUN-mode callback keeps `BREAK IF` armed and returns `false` to the CPU execution condition so the matching opcode executes normally.
- `haltAtBreakpoint()`, callback exceptions, and callback re-entry failures route through the ordinary STEP TRACE halt at that same boundary.
- Ordinary HALT-mode BREAK IF behavior must remain unchanged.
- STEP TRACE's currently loaded symbol file is the only symbol source for BREAK IF symbolic constants and scenario helpers.
- No `EMU_ASM_BUILD`, `ASM_BUILD`, `ASM_INPUT`, `DBG_RAM`, or TEST BENCH dependency remains in STEP TRACE SCENARIO.
- Remove the special LOAD LIVE runtime/UI path rather than hiding it.
- Existing Assembler **to emulator** and **to debugger** controls remain unchanged.
- TEST BENCH remains an isolated debugger facility with its existing CPU/RAM semantics.
- Breakpoint callbacks are synchronous only; promises/async callbacks are unsupported in v1.
- Preserve STEP TRACE Play/Pause, Step In/Over/Out, loop skipper, speed control, BREAK IF Arm/Disarm, and current pre-opcode breakpoint semantics.

## Review Focus

- **Callback ordering:** RAM/register observations or writes performed in RUN mode must finish before the matching opcode executes. Task 1 tests the condition return value and pre-opcode PC explicitly.
- **Fail-safe stop:** `haltAtBreakpoint()`, callback exceptions, and nested/re-entrant dispatch must deactivate RUN mode and enter the same persistent breakpoint-stop state as ordinary BREAK IF. Tasks 1 and 3 test all three paths.
- **Persistent runtime state:** closing/reopening STEP TRACE SCENARIO while RUN mode is armed must not lose the callback closure; reopening must render from debugger runtime state. Task 3 tests this.
- **Symbol consistency:** mixed-case labels/EQUs must resolve identically in BREAK IF and scenario JS, with no assembler/live-build fallback. Task 2 tests lookup, condition compilation, replacement, and defensive copies.
- **Repeated loop hits:** an eternal 6502 loop must invoke the same callback closure repeatedly without host-side stepping, recursive callback dispatch, or a second scheduler. Tasks 1, 3, and 5 cover this.

---

## File Map

### Modify

- `res/EMU_apple2debug.js` — breakpoint-action hook, halt/continue routing, case-insensitive loaded-symbol API, symbolic BREAK IF constants.
- `res/DBG_steptrace_scenario.js` — remove private CPU-driving runner and duplicate condition parser; add breakpoint callback runtime and HALT/RUN UI state.
- `res/DBG_testbench.js` — stop loading the obsolete assembler live-build services.
- `asm/_TODO/INFLATE_ASM_CORE.S` — add an explicit looping test driver after the decompressor scratch/guard range.
- `asm/_TODO/INFLATE_ASM_CORE_testbench.js` — convert to one persistent `onBreakpoint()` callback; remove trampoline/`cpu.start()`/scenario-owned `breakIf()`.
- `docs/STEP_TRACE_MANUAL.md` — document breakpoint-driven scenarios and migration from the old runner.
- `tests/cpu_execution_condition.test.js` — breakpoint action, symbol lookup, and symbolic BREAK IF tests.
- `tests/debugger_steptrace_scenario.test.js` — callback lifecycle, assertion semantics, UI state, symbol ownership, popup persistence, no live-build/CPU-driving dependencies.
- `tests/debugger_testbench_loader.test.js` — expected loader list after dead-path removal.
- `tests/inflate_steptrace_harness.test.js` — assembly loop-driver contract, callback harness contract, independent DEFLATE manifest validation.

### Delete

- `res/ASM_build_handoff.js` — neutral assembler build snapshot/freshness service whose only runtime consumer is direct live loading.
- `res/EMU_asm_build.js` — direct live RAM loader, provenance state, and LOAD LIVE UI.
- `tests/asm_build_handoff.test.js` — tests the deleted service.
- `tests/emu_asm_build.test.js` — tests the deleted service.
- `docs/ASM_BUILD_LIVE_HANDOFF.md` — user-facing documentation for the removed workflow.

### Keep unchanged unless a regression test proves a required edit

- `res/DBG_testbench_legacy.js` — isolated TEST BENCH implementation.
- `res/DBG_steptrace_scenario_layout.js` — popup placement/tab lifecycle only.
- `res/EMU_cpu6502.js` — existing persistent execution-condition mechanism already stops before opcode fetch.
- Historical `docs/superpowers/specs/*` and `docs/superpowers/plans/*` files — project history, not runtime/user guidance.

---

## Exact API Changes

### `Apple2Debug`

Add:

```js
Apple2Debug.setBreakpointActionHandler(fnOrNull)
// fn receives BreakpointActionContext.
// Returns true when a handler is active, false when cleared.

Apple2Debug.breakpointActionState()
// -> {
//      active:boolean,
//      dispatching:boolean,
//      lastError:string|null
//    }

Apple2Debug.resolveSymbol(name)
// -> number|null

Apple2Debug.symbol(name)
// -> {name:string,value:number,type:string}|null

Apple2Debug.symbols()
// -> defensive array of symbol records
```

Breakpoint callback context:

```js
{
  A, X, Y, SP, P, PC, INS,
  condition,
  hit
}
```

`hit` is the 1-based count of true BREAK IF matches, including matches handled in RUN mode.

Breakpoint action return contract:

```js
undefined          // continue through this breakpoint
{halt:true}        // turn this match into the ordinary persistent STEP TRACE halt
```

Any thrown error or re-entrant action dispatch is treated as `{halt:true}` plus an error recorded in `breakpointActionState().lastError`.

Matched-condition state rules:

```text
HALT / no action handler:
  conditionalBreakpoint.hits  += 1
  conditionalBreakpoint.hit    = true
  conditionalBreakpoint.armed  = false
  CPU execution condition      = true

RUN / callback succeeds:
  conditionalBreakpoint.hits  += 1
  conditionalBreakpoint.hit    = false
  conditionalBreakpoint.armed  = true
  CPU execution condition      = false

RUN / callback asks halt or errors:
  conditionalBreakpoint.hits  += 1 exactly once
  breakpoint action handler    = cleared
  conditionalBreakpoint.hit    = true
  conditionalBreakpoint.armed  = false
  CPU execution condition      = true
```

The implementation must avoid double-counting a matched condition when RUN dispatch falls through to the ordinary stop path.

### STEP TRACE symbol model

Add one case-insensitive name index alongside the existing address-indexed label/EQU structures. A loaded record is exposed as:

```js
{name:'inputPointer', value:0x00F0, type:'equ'}
```

The same name index is used by:

```text
Apple2Debug.resolveSymbol()/symbol()/symbols()
BREAK IF expression compilation
STEP TRACE SCENARIO sym()/symbol()/symbols()
```

A BREAK IF such as:

```text
PC==inflate_test_loop || PC==inflate_test_done
```

must compile by replacing each loaded symbol identifier with its current numeric value. Unknown identifiers still produce the existing explicit condition error.

### `STB` / `DBG_STEPTRACE_SCENARIO`

Keep host observation/manipulation helpers:

```js
STB.hex(value[,width])
STB.address(valueOrSymbol)
STB.bytes(value)
STB.ram.read(address[,length])
STB.ram.read16(address)
STB.ram.write(address,data)
STB.ram.write16(address,value)
STB.ram.fill(address,length,value)
STB.ram.dump(address[,length[,columns]])
STB.cpu.state()
STB.assert(boolean, description)
STB.sym(name[,fallback])
STB.symbol(name)
STB.symbols()
STB.print(...)
```

`STB.assert()` no longer accepts STEP TRACE expression strings because the scenario-private condition compiler is removed. It requires a JavaScript boolean, prints `PASS`/`FAIL`, and returns that boolean; it never controls emulator execution itself.

Add editor-scope helpers:

```js
onBreakpoint(fn)
haltAtBreakpoint()
```

`onBreakpoint(fn)` is valid only while the editor script is being armed. Exactly one callback must be registered per arm operation.

`haltAtBreakpoint()` is valid only while that callback is executing. It marks the current match for ordinary STEP TRACE halt.

Remove from both intended API and implementation:

```js
scenario()
reset()
cpu.start()
breakIf()
condition.compile()
condition.evaluate()
syncBuild()
buildInfo()
```

Do not retain the old private stepping loop, duplicate expression tokenizer/parser/evaluator, live-build symbol cache, or live-build event listeners as compatibility aliases.

---

## UI Behavior

The existing cloned `DBG_steptraceRunButton` becomes a two-state **breakpoint action mode** control. It does not start/pause the emulator and does not arm/disarm BREAK IF.

### HALT at breakpoint — default

```html
<i class="fa fa-pause"></i> HALT at breakpoint
```

- `aria-pressed="false"`
- title: `HALT at breakpoint — BREAK IF pauses execution`
- no breakpoint action handler is active
- BREAK IF behaves exactly as it does today

### RUN script at breakpoint

```html
<i class="fa fa-sign-in-alt"></i> RUN script at breakpoint
```

- `aria-pressed="true"`
- title: `RUN script at breakpoint — execute scenario callback and continue`
- switching HALT -> RUN evaluates the editor once
- the editor must register exactly one `onBreakpoint(fn)` callback
- the resulting closure persists across repeated BREAK IF matches
- switching RUN -> HALT clears the debugger action handler without pausing/resuming the CPU

### Runtime transitions

- callback success -> remain RUN; matching opcode executes next
- `haltAtBreakpoint()` -> action handler clears; current match becomes normal HALT; button reflects HALT
- callback exception -> print `message` plus stack when present; action handler clears; current match becomes normal HALT
- callback re-entry -> fail safe identically to exception
- popup close -> runtime mode/callback remain active
- popup reopen -> button derives state from `Apple2Debug.breakpointActionState()`, not DOM history
- Ctrl/Cmd+Enter while the editor is focused performs the same HALT -> RUN arm operation; it never executes the callback immediately and never starts the CPU

---

## Migration Notes

- Existing STEP TRACE SCENARIO scripts using `scenario()`, `cpu.start()`, `breakIf()`, or `reset()` must be rewritten around one persistent `onBreakpoint()` callback.
- String-form `STB.assert('A==$42')` is removed with the duplicate parser; use ordinary JavaScript booleans such as `STB.assert(bp.A === 0x42, 'A is $42')`.
- Existing Assembler **to emulator** and **to debugger** workflows are untouched. Only the special direct **LOAD LIVE** control/service is removed.
- Existing STEP TRACE symbol JSON loading becomes the only symbol source for scenarios and symbolic BREAK IF identifiers.
- Runtime globals/events removed with the dead path: `ASM_BUILD`, `ASM_INPUT`, `EMU_ASM_BUILD`, `ASM_loadLive`, `RetroAppleBuildError`, `retroapple:asm-*`, `retroapple:emu-build-*`, and the assembler `LIVE #n` status/control.
- TEST BENCH continues to use `DBG_testbench_legacy.js` and its own debugger RAM/CPU exactly as before.
- `docs/ASM_BUILD_LIVE_HANDOFF.md` is deleted so normal documentation cannot point users toward a removed workflow. Historical superpowers design/plan documents remain for provenance.

---

### Task 1: Add debugger-owned breakpoint action dispatch

**Files:**
- Modify: `res/EMU_apple2debug.js`
- Test: `tests/cpu_execution_condition.test.js`

**Interfaces:**
- Consumes: existing `evaluateConditionalBreakpoint(state)`, `conditionalBreakpointTrap(state)`, ordinary breakpoint-stop logic, CPU `setExecutionCondition()`.
- Produces: `setBreakpointActionHandler(fnOrNull)`, `breakpointActionState()`, synchronous pre-opcode action dispatch used by Task 3.

- [ ] **Step 1: Write failing test for successful RUN dispatch before the opcode**

Extend the debugger VM harness with an armed condition `PC==$0201` and install:

```js
let hits = 0;
let seenPC = null;
assert.equal(dbg.setBreakpointActionHandler(ctx => {
    hits++;
    seenPC = ctx.PC;
}), true);
```

Invoke the installed CPU execution-condition callback at `$0201` and assert:

```js
assert.equal(installed.callback({pc:0x0201,a:0,x:0,y:0,sp:0xFF,p:0x20,ic:7}), false);
assert.equal(seenPC, 0x0201);
assert.equal(hits, 1);
assert.equal(dbg.liveState().conditionalBreakpoint.hit, false);
assert.equal(dbg.liveState().conditionalBreakpoint.armed, true);
assert.equal(dbg.liveState().conditionalBreakpoint.hits, 1);
```

Then let the CPU run and prove the opcode at `$0201` executes only after the callback returned.

- [ ] **Step 2: Write failing tests for repeated hits, explicit halt, exception, and re-entry**

Repeated success:

```js
dbg.setBreakpointActionHandler(() => { hits++; });
assert.equal(installed.callback(stateAt0201), false);
assert.equal(installed.callback(stateAt0201Again), false);
assert.equal(hits, 2);
assert.equal(dbg.liveState().conditionalBreakpoint.hits, 2);
assert.equal(dbg.liveState().conditionalBreakpoint.armed, true);
```

Explicit halt:

```js
dbg.setBreakpointActionHandler(() => ({halt:true}));
assert.equal(installed.callback(stateAt0201), true);
assert.equal(dbg.breakpointActionState().active, false);
assert.equal(dbg.liveState().conditionalBreakpoint.hit, true);
assert.equal(dbg.liveState().conditionalBreakpoint.armed, false);
```

Exception:

```js
dbg.setBreakpointActionHandler(() => { throw new Error('boom'); });
assert.equal(installed.callback(stateAt0201), true);
assert.equal(dbg.breakpointActionState().active, false);
assert.match(dbg.breakpointActionState().lastError,/boom/);
```

Re-entry: arrange for a handler to trigger the action-dispatch function again in the VM harness; assert the nested call never invokes the user handler a second time and the outer match halts fail-safe.

- [ ] **Step 3: Run focused debugger tests and verify RED**

```bash
node --test tests/cpu_execution_condition.test.js
```

Expected: failures because the breakpoint action API does not exist and current matches always enter the ordinary stop path.

- [ ] **Step 4: Implement action state and a single matched-condition router**

Add:

```js
var breakpointActionHandler = null;
var breakpointActionDispatching = false;
var breakpointActionLastError = null;
```

Expose:

```js
this.setBreakpointActionHandler = function(fn)
{
    if(fn!==null && typeof fn!=="function")
        throw new TypeError("Breakpoint action handler must be a function or null.");
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

Refactor the true-predicate path so it increments `conditionalBreakpoint.hits` exactly once, then either dispatches the action or performs the existing halt. Build the callback context from the live state:

```js
var context = {
    A:state.a&0xff,
    X:state.x&0xff,
    Y:state.y&0xff,
    SP:state.sp&0xff,
    P:state.p&0xff,
    PC:state.pc&0xffff,
    INS:Number(state.ic)||0,
    condition:conditionalBreakpoint.condition,
    hit:conditionalBreakpoint.hits
};
```

Successful handler return keeps `armed=true`, `hit=false`, and returns `false`. `{halt:true}`, thrown errors, or re-entry clear `breakpointActionHandler` and route to a stop helper that performs today's pause/refresh/icon behavior without incrementing `hits` again.

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
node --test tests/cpu_execution_condition.test.js
```

Expected: all new tests plus existing ordinary HALT/step/speed regressions pass.

- [ ] **Step 6: Commit Task 1**

```bash
git add res/EMU_apple2debug.js tests/cpu_execution_condition.test.js
git commit -m "feat: dispatch STEP TRACE breakpoint actions"
```

---

### Task 2: Unify loaded symbols across STEP TRACE, BREAK IF, and scenarios

**Files:**
- Modify: `res/EMU_apple2debug.js`
- Test: `tests/cpu_execution_condition.test.js`

**Interfaces:**
- Consumes: existing `loadSymbolObject()`, `commitLoadedSymbols()`, condition compiler, address-indexed label/EQU arrays.
- Produces: `resolveSymbol(name)`, `symbol(name)`, `symbols()`, plus symbolic identifiers in BREAK IF; consumed by Task 3 and Task 5.

- [ ] **Step 1: Write failing mixed-case label/EQU API tests**

Load:

```js
{
  symbols:[
    {type:'label',name:'inflate_test_loop',value:'$0D10'},
    {type:'label',name:'inflate_test_done',value:'$0D13'},
    {type:'equ',name:'inputPointer',value:'$00F0'}
  ]
}
```

Assert:

```js
assert.equal(dbg.resolveSymbol('INFLATE_TEST_LOOP'),0x0D10);
assert.equal(dbg.resolveSymbol('inputpointer'),0x00F0);
assert.equal(dbg.resolveSymbol('missing'),null);
assert.deepEqual(dbg.symbol('inputPointer'),{name:'inputPointer',value:0x00F0,type:'equ'});
assert.ok(dbg.symbols().some(s => s.name==='inflate_test_done'));
```

Mutate returned records/arrays and assert subsequent reads are unchanged.

- [ ] **Step 2: Write failing symbolic BREAK IF test**

With those symbols loaded:

```js
dbg.setBreakpointCondition('PC==inflate_test_loop || PC==inflate_test_done');
assert.equal(dbg.toggleConditionalBreakpointFromInput(),
             'PC==inflate_test_loop || PC==inflate_test_done');
```

Assert the compiled predicate returns true at `$0D10` and `$0D13` and false elsewhere.

- [ ] **Step 3: Write failing replacement test**

Load symbol file A, then B. Assert names from A disappear completely, B resolves, and symbolic BREAK IF compilation after replacement uses B. Set `oASM.symlink` to a conflicting value in the VM context and prove `resolveSymbol()` and the condition compiler ignore it.

- [ ] **Step 4: Run focused tests and verify RED**

```bash
node --test tests/cpu_execution_condition.test.js
```

- [ ] **Step 5: Implement atomic case-insensitive name map**

Add:

```js
var loadedSymbolNames = Object.create(null);
```

While `loadSymbolObject()` builds `nextLabels`/`nextSymbols`, also build `nextSymbolNames` keyed by `String(name).trim().toUpperCase()` with records:

```js
{name:String(name), value:value&0xffff, type:type}
```

Extend `commitLoadedSymbols(...)` so the name map swaps atomically with the existing arrays. Add defensive public readers:

```js
this.resolveSymbol = function(name) { ... };
this.symbol = function(name) { ... };
this.symbols = function() { ... };
```

- [ ] **Step 6: Extend the existing BREAK IF primary-expression parser**

After checking booleans/registers/flags/memory, resolve an identifier through `loadedSymbolNames`. Compile it as a numeric AST node; otherwise preserve the current `Unknown condition name ...` error. Do not add a second parser and do not consult assembler globals.

- [ ] **Step 7: Run focused tests and verify GREEN**

```bash
node --test tests/cpu_execution_condition.test.js
```

- [ ] **Step 8: Commit Task 2**

```bash
git add res/EMU_apple2debug.js tests/cpu_execution_condition.test.js
git commit -m "feat: share STEP TRACE symbols with breakpoint scripts"
```

---

### Task 3: Replace STEP TRACE SCENARIO's CPU runner with callback runtime

**Files:**
- Modify: `res/DBG_steptrace_scenario.js`
- Test: `tests/debugger_steptrace_scenario.test.js`

**Interfaces:**
- Consumes: Task 1 `setBreakpointActionHandler()` / `breakpointActionState()`, Task 2 symbol APIs.
- Produces: `onBreakpoint(fn)`, `haltAtBreakpoint()`, callback-mode UI state, and simplified STB helpers used by Task 5.

- [ ] **Step 1: Write failing arm/evaluate-once tests**

Use a debugger stub implementing Tasks 1/2. Editor source:

```js
let count = 0;
onBreakpoint(function(bp){
  count++;
  print('hit '+count+' at '+STB.hex(bp.PC,4));
});
```

Assert HALT -> RUN evaluates source once, registers exactly one debugger action handler, and two simulated breakpoint matches print hit 1/hit 2 without re-evaluating source.

Also instrument the fake debugger/machine and assert arming never calls `play()`, `clearConditionalBreakpoint()`, CPU `setState()`, `stepLiveInstruction()`, `runLiveInstructionBatch()`, or timers to drive execution.

- [ ] **Step 2: Write failing registration-validation tests**

Assert HALT -> RUN remains HALT and logs an error for:

```js
print('no callback');                   // zero callbacks
onBreakpoint(function(){});
onBreakpoint(function(){});             // two callbacks
onBreakpoint('not a function');         // invalid callback
```

- [ ] **Step 3: Write failing `haltAtBreakpoint()` and exception tests**

For:

```js
onBreakpoint(function(){ haltAtBreakpoint(); });
```

assert the wrapper returns `{halt:true}` and, after debugger deactivation, scenario render state is HALT.

For:

```js
onBreakpoint(function(){ throw new Error('boom'); });
```

assert the wrapper prints `boom`, rethrows to Task 1, and after Task 1 clears the handler the scenario UI reflects HALT.

Call `haltAtBreakpoint()` outside a callback and assert it throws an explicit usage error without altering CPU state.

- [ ] **Step 4: Write failing popup-persistence test**

Arm RUN, close the popup, simulate breakpoint hits, reopen, and assert the button still displays RUN while the debugger action handler remains active. Then simulate a halt/error, reopen, and assert HALT.

- [ ] **Step 5: Write failing STEP TRACE-only symbol tests**

Omit `EMU_ASM_BUILD`, `ASM_BUILD`, `DBG_RAM`, and `TB` from the VM context. Stub debugger symbol methods and assert:

```js
assert.equal(STB.sym('inputPointer'),0xF0);
assert.equal(STB.sym('missing',0x1234),0x1234);
assert.equal(STB.symbol('inflate_test_loop').value,0x0D10);
assert.equal(STB.symbols().length,3);
```

Unknown `STB.sym('missing')` must throw an explicit STEP TRACE unknown-symbol error.

- [ ] **Step 6: Write failing assertion-semantic tests**

Assert:

```js
assert.equal(STB.assert(true,'ok'),true);
assert.equal(STB.assert(false,'bad'),false);
assert.throws(() => STB.assert('A==$42','legacy expression'),/boolean/i);
```

and verify PASS/FAIL output is emitted without requiring an active `scenario()` object.

- [ ] **Step 7: Add source-level failing tests proving the duplicate engine is gone**

Assert `res/DBG_steptrace_scenario.js` does not contain runtime implementations/references for:

```text
runLiveInstructionBatch
stepLiveInstruction
S.breakIf
S.scenario
S.reset
cpu.start
condition.compile
condition.evaluate
syncBuild
buildInfo
EMU_ASM_BUILD
retroapple:emu-build-
```

- [ ] **Step 8: Run scenario tests and verify RED**

```bash
node --test tests/debugger_steptrace_scenario.test.js
```

- [ ] **Step 9: Implement the callback-only runtime**

Keep live mapped-memory helpers, `cpu.state()`, hex/address/byte helpers, terminal/console output, and popup placement hooks. Remove the scenario result accumulator, CPU reset/start methods, `breakIf()`, condition tokenizer/parser/evaluator, live-build cache, and live-build listeners.

Use state:

```js
var registeredBreakpointCallback = null;
var registrationOpen = false;
var callbackRunning = false;
var haltRequested = false;
```

Registration:

```js
function onBreakpoint(fn)
{
    if(!registrationOpen) throw new Error('onBreakpoint() is only valid while arming the scenario script.');
    if(typeof fn!=="function") throw new TypeError('onBreakpoint() requires a function.');
    if(registeredBreakpointCallback) throw new Error('Only one onBreakpoint() callback may be registered.');
    registeredBreakpointCallback = fn;
    return fn;
}
```

Halt request:

```js
function haltAtBreakpoint()
{
    if(!callbackRunning) throw new Error('haltAtBreakpoint() is only valid inside the breakpoint callback.');
    haltRequested = true;
}
```

Action wrapper:

```js
function breakpointAction(context)
{
    callbackRunning = true;
    haltRequested = false;
    try {
        registeredBreakpointCallback(context);
        return haltRequested ? {halt:true} : undefined;
    } catch(err) {
        out('[ERROR] '+(err && err.message ? err.message : String(err)),'error');
        if(err && err.stack) out(String(err.stack),'error');
        throw err;
    } finally {
        callbackRunning = false;
    }
}
```

`STB.assert()` accepts only booleans, prints PASS/FAIL, returns the same boolean, and never alters breakpoint mode.

- [ ] **Step 10: Implement HALT/RUN control using the existing `DBG_steptraceRunButton`**

HALT -> RUN:

1. clear previous registration
2. set `registrationOpen=true`
3. evaluate editor source once in the scope exposing `onBreakpoint`, `haltAtBreakpoint`, `STB` helpers
4. set `registrationOpen=false`
5. require exactly one callback
6. call `DBG().setBreakpointActionHandler(breakpointAction)`
7. render RUN

RUN -> HALT:

```js
DBG().setBreakpointActionHandler(null);
registeredBreakpointCallback = null;
renderBreakpointMode();
```

Render from `DBG().breakpointActionState().active`, not a DOM-owned boolean. Update icon, visible text, title, and `aria-pressed`. Bind Ctrl/Cmd+Enter to arm/toggle, not immediate callback execution.

- [ ] **Step 11: Run scenario tests and verify GREEN**

```bash
node --test tests/debugger_steptrace_scenario.test.js
```

- [ ] **Step 12: Commit Task 3**

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

**Interfaces:**
- Consumes: Task 3 has removed the last STEP TRACE runtime dependency on live-build provenance.
- Produces: standard runtime loads TEST BENCH legacy + STEP TRACE scenario/layout only; no LOAD LIVE control/globals/events.

- [ ] **Step 1: Change loader expectations first and verify RED**

Expected `res/DBG_testbench.js` script order:

```js
[
  'res/DBG_testbench_legacy.js',
  'res/DBG_steptrace_scenario.js',
  'res/DBG_steptrace_scenario_layout.js'
]
```

Assert `ASM_build_handoff.js` and `EMU_asm_build.js` are absent.

- [ ] **Step 2: Add runtime-source absence assertions**

Read `res/DBG_testbench.js` and `res/DBG_steptrace_scenario.js`; assert no runtime references to:

```text
ASM_BUILD
ASM_INPUT
EMU_ASM_BUILD
ASM_loadLive
ASM_loadLiveHeaderButton
ASM_liveBuildState
retroapple:asm-build-
retroapple:emu-build-
```

Do not scan historical `docs/superpowers/` files.

- [ ] **Step 3: Run loader/scenario tests and verify RED**

```bash
node --test tests/debugger_testbench_loader.test.js tests/debugger_steptrace_scenario.test.js
```

- [ ] **Step 4: Delete the dead services and simplify the compatibility loader**

Remove the two service files, their two dedicated tests, and `docs/ASM_BUILD_LIVE_HANDOFF.md`. Edit `res/DBG_testbench.js` to load only the three retained scripts in Step 1.

Do not edit the Assembler's existing **to emulator** or **to debugger** implementation: repository search confirms `ASM_BUILD.ensureFresh()` is consumed by `EMU_asm_build.js`, not those existing transfer functions.

- [ ] **Step 5: Search for orphan runtime references**

```bash
grep -R "EMU_ASM_BUILD\|ASM_loadLive\|ASM_loadLiveHeaderButton\|ASM_liveBuildState\|retroapple:emu-build-" res index.html asm tests docs/STEP_TRACE_MANUAL.md 2>/dev/null || true
grep -R "ASM_BUILD\|ASM_INPUT\|retroapple:asm-build-" res index.html asm tests docs/STEP_TRACE_MANUAL.md 2>/dev/null || true
```

Expected: no matches for the removed uppercase globals/events. Names such as `ASM_buildSymbolExportObject` are unrelated and must remain.

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
- Consumes: Task 3 `onBreakpoint()`, `haltAtBreakpoint()`, STB RAM/assert/symbol helpers; Task 2 symbolic BREAK IF locations.
- Produces: explicit 6502 eternal test loop and 15-vector host validation with no trampoline or host-owned execution.

- [ ] **Step 1: Write failing assembly-driver structure test**

Require this exact driver after the existing decompressor/scratch definitions:

```asm
        ORG     $0D10
inflate_test_loop
        JSR     inflate
inflate_test_done
        JMP     inflate_test_loop
```

Also assert `inflate=$0800` and `inflate_data=$0A00` remain unchanged. `$0D10` is deliberately beyond the harness scratch region `$0A00..$0CFC` plus the 8-byte guard `$0CFD..$0D04`.

- [ ] **Step 2: Rewrite harness source-contract tests**

Require:

```js
onBreakpoint(function(bp) {
```

and references to `inflate_test_loop` and `inflate_test_done`. Forbid:

```text
installTrampoline
CFG.trampoline
STB.cpu.start
STB.breakIf
STB.scenario
PC==$0203
```

- [ ] **Step 3: Add independent manifest-length validation for every vector**

Use Node's raw DEFLATE decoder:

```js
const zlib = require('node:zlib');
for(const vector of vectors) {
    const bytes = Buffer.from(vector.hex,'hex');
    const actual = zlib.inflateRawSync(bytes);
    assert.equal(actual.length,vector.expectedBytes,vector.name);
}
```

Pin `fixed_all_distance_ranges` to `expectedBytes: 33426`.

- [ ] **Step 4: Run INFLATE tests and verify RED**

```bash
node --test tests/inflate_steptrace_harness.test.js
```

- [ ] **Step 5: Add the explicit 6502 loop driver at `$0D10`**

Append the driver exactly as Step 1. It is ordinary assembled code and should be loaded by the same normal emulator workflow as the rest of the source. It replaces the JavaScript-injected `$0200` trampoline.

- [ ] **Step 6: Refactor the harness into one persistent callback state machine**

Precompute selected vectors and their Pako reference outputs when the editor script is armed. Maintain:

```js
let index = 0;
let prepared = null;
let assertions = 0;
let failedAssertions = 0;
const results = [];
```

Register exactly one callback:

```js
onBreakpoint(function(bp) {
    if(bp.PC === STB.sym('inflate_test_loop')) {
        if(index >= selected.length) {
            haltAtBreakpoint();
            return;
        }
        prepared = prepareCase(selected[index]);
        prepared.startSP = bp.SP;
        return;
    }

    if(bp.PC === STB.sym('inflate_test_done')) {
        if(!prepared)
            throw new Error('Reached inflate_test_done without a prepared vector.');

        const ok = verifyCase(selected[index],prepared,bp.SP);
        results.push({name:selected[index].name,pass:ok});
        prepared = null;

        if(!ok) {
            printSummary(results,selected.length);
            haltAtBreakpoint();
            return;
        }

        index++;
        if(index >= selected.length) {
            printSummary(results,selected.length);
            haltAtBreakpoint();
        }
    }
});
```

`verifyCase()` must perform the existing nine checks with JavaScript booleans passed to `STB.assert()`:

```text
input consumed
output pointer
exact output
output guard before
output guard after
input guard before
input guard after
scratch guard after
stack restored
```

It returns false if any assertion fails so the harness halts immediately instead of continuing with possibly corrupted state.

The callback never writes PC, calls `cpu.start()`, calls `breakIf()`, or pauses/resumes the emulator.

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

### Task 6: Update STEP TRACE documentation and migration guidance

**Files:**
- Modify: `docs/STEP_TRACE_MANUAL.md`
- Test: `tests/debugger_steptrace_scenario.test.js`

**Interfaces:**
- Consumes: final APIs/UI from Tasks 1-5.
- Produces: user workflow matching shipped behavior.

- [ ] **Step 1: Add failing manual-source assertions**

Assert `docs/STEP_TRACE_MANUAL.md` contains:

```text
HALT at breakpoint
RUN script at breakpoint
onBreakpoint
haltAtBreakpoint
```

and its STEP TRACE SCENARIO section does not instruct users to use `LOAD LIVE`, `EMU_ASM_BUILD`, `cpu.start()`, or scenario-owned `breakIf()`.

- [ ] **Step 2: Run documentation-associated test and verify RED**

```bash
node --test tests/debugger_steptrace_scenario.test.js
```

- [ ] **Step 3: Rewrite the scenario section around the actual user journey**

Document:

```text
1. Put/run the program in the emulator through the ordinary workflow.
2. Load its symbol JSON into STEP TRACE when symbolic names are desired.
3. Set and Arm BREAK IF, e.g. PC==inflate_test_loop || PC==inflate_test_done.
4. Start the emulator normally at the desired speed.
5. Open STEP TRACE SCENARIO and enter code that calls onBreakpoint(fn).
6. Switch the scenario control to RUN script at breakpoint.
7. Each match invokes the callback before the opcode; normal return continues.
8. haltAtBreakpoint() or an exception restores ordinary HALT behavior.
```

Explain that editor code is evaluated once per arm, its closure persists across hits, the popup can be closed without disarming RUN, `STB.assert()` accepts JavaScript booleans, and scenario JS never owns CPU execution.

Document the two icon states:

```html
<i class="fa fa-pause"></i>
<i class="fa fa-sign-in-alt"></i>
```

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
- Test/verification only. Modify production code only for a regression directly attributable to Tasks 1-6, with a corresponding failing test first.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: merge-ready evidence.

- [ ] **Step 1: Run the full Node test suite**

```bash
node --test tests/*.test.js
```

Expected: PASS; deleted live-build tests are absent and all remaining tests are green.

- [ ] **Step 2: Verify removed runtime identifiers are gone**

```bash
grep -R "EMU_ASM_BUILD\|ASM_loadLive\|ASM_loadLiveHeaderButton\|ASM_liveBuildState\|retroapple:emu-build-" res index.html asm tests docs/STEP_TRACE_MANUAL.md 2>/dev/null && exit 1 || true
grep -R "ASM_BUILD\|ASM_INPUT\|retroapple:asm-build-" res index.html asm tests docs/STEP_TRACE_MANUAL.md 2>/dev/null && exit 1 || true
grep -n "STB\.breakIf\|STB\.cpu\.start\|installTrampoline\|PC==\$0203" asm/_TODO/INFLATE_ASM_CORE_testbench.js && exit 1 || true
```

Expected: no matches. Historical `docs/superpowers/` files are intentionally outside these searches.

- [ ] **Step 3: Browser-smoke ordinary HALT behavior**

```text
- Open STEP TRACE.
- Set BREAK IF to a reachable PC and Arm it.
- Leave scenario mode at HALT.
- Run the live CPU.
- Verify it stops before the matching opcode with the existing breakpoint-stop indicator.
```

- [ ] **Step 4: Browser-smoke repeated RUN callbacks without CPU ownership**

Run a tiny live 6502 loop that repeatedly visits two known PCs. Arm BREAK IF for both and arm a scenario callback that increments/prints a closure counter. Verify:

```text
- callback count advances across hits
- emulator keeps running at the selected STEP TRACE/emulator speed
- scenario code never calls a CPU stepping/start API
- popup may be closed/reopened without losing RUN state
```

- [ ] **Step 5: Browser-smoke explicit halt and exception fail-safe**

First call `haltAtBreakpoint()` on the third callback and verify the live CPU remains stopped at that exact boundary and the scenario control renders HALT. Re-arm with a callback that throws `Error('boom')`; verify the same safe halt plus readable console message/stack.

- [ ] **Step 6: Browser-run the full INFLATE workflow**

```text
- Assemble/load INFLATE_ASM_CORE.S by the ordinary emulator workflow.
- Load its symbol JSON in STEP TRACE.
- Set BREAK IF to PC==inflate_test_loop || PC==inflate_test_done.
- Start execution at inflate_test_loop ($0D10) through the normal emulator/monitor flow.
- Arm INFLATE_ASM_CORE_testbench.js with RUN script at breakpoint.
```

Expected final scenario console:

```text
PASS 15/15
```

The run must contain no injected `$0200` trampoline, no LOAD LIVE operation, and no host-driven `BREAK ... ins/cyc` runner output.

- [ ] **Step 7: Verify branch scope and whitespace**

```bash
git status --short
git diff --stat main...HEAD
git diff --check main...HEAD
```

Expected: clean working tree; only planned files changed/deleted; no whitespace errors.

- [ ] **Step 8: Commit any final regression correction only if Step 1-7 exposed one**

Write a failing regression test first, make the smallest correction, rerun the relevant focused test plus the full suite, then commit with a narrow message. Do not create an empty cleanup commit.
