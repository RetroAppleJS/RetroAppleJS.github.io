# STEP TRACE Breakpoint-Driven Scenario Design

**Date:** 2026-09-25

## Intent

STEP TRACE SCENARIO must stop acting as a second CPU execution controller. The live Apple II emulator already owns execution and speed, and STEP TRACE already owns conditional BREAK IF evaluation at clean instruction boundaries. Scenario JavaScript should therefore be an optional synchronous action attached to an existing BREAK IF match.

The user workflow is:

1. Put the assembled program into the emulator through the normal emulator workflow.
2. Load symbols into STEP TRACE through the existing symbol loader.
3. Set and arm one BREAK IF expression, possibly matching multiple program locations.
4. Start the emulator normally at the desired STEP TRACE/emulator speed.
5. Arm STEP TRACE SCENARIO in **RUN at breakpoint** mode.
6. Whenever BREAK IF matches, run the registered JavaScript callback before the matching opcode.
7. If the callback returns normally, continue execution without a persistent halt.
8. If the callback calls `haltAtBreakpoint()` or throws, remain halted at that breakpoint and switch the scenario control back to **HALT at breakpoint**.

For repeated tests, the 6502 test program deliberately contains its own loop. JavaScript injects data and assesses results at selected breakpoint locations; it never calls or steps the routine itself.

## Existing behavior to preserve

The current live CPU execution condition is persistent and evaluates before opcode fetch. Ordinary STEP TRACE BREAK IF behavior remains unchanged when scenario mode is HALT: a matching condition stops the live machine before the opcode and leaves the debugger in its existing breakpoint-stop state.

Existing STEP TRACE execution speed, Play/Pause, Step In/Over/Out, loop skipper, BREAK IF expression syntax, and Arm/Disarm controls remain authoritative.

## Architecture

```text
live Apple II execution
        |
        v
STEP TRACE BREAK IF predicate
        |
        +-- no match --------------------> execute opcode normally
        |
        `-- match
             |
             +-- HALT at breakpoint -----> existing STEP TRACE stop
             |
             `-- RUN at breakpoint
                    |
                    v
              scenario callback
                    |
             +------+------+
             |             |
          continue      halt/error
             |             |
             v             v
       execute opcode   existing STEP TRACE stop
```

The script callback is invoked synchronously from the same clean-boundary conditional-breakpoint path. In RUN mode a successful callback causes the breakpoint trap to return `false` to the CPU condition mechanism, so the matching opcode executes immediately in the same normal execution flow. No pause/resume cycle, private scheduler, trampoline, or host-driven instruction loop is needed.

## Breakpoint action contract

`Apple2Debug` gains one optional breakpoint action handler owned by STEP TRACE SCENARIO.

Conceptual API:

```js
Apple2Debug.setBreakpointActionHandler(fnOrNull)
Apple2Debug.breakpointActionState()
```

The handler receives a stable snapshot at the matching clean boundary:

```js
{
  A, X, Y, SP, P, PC, INS,
  condition,
  hit
}
```

The debugger remains the only component that evaluates BREAK IF.

### HALT mode

When no scenario handler is active, `conditionalBreakpointHit(state)` follows the current code path: mark the breakpoint hit, stop the current live execution owner, refresh the debugger, and return `true` to the CPU condition.

### RUN mode

When a scenario handler is active:

1. Count the BREAK IF match.
2. Invoke the handler synchronously before the opcode.
3. Do not set the debugger's persistent `conditionalBreakpoint.hit` stop state for a successful callback.
4. Keep the BREAK IF observer armed for subsequent loop iterations.
5. Return `false` to the CPU condition so normal execution proceeds through the matching opcode.

If the handler requests a halt or throws, disable RUN mode and execute the ordinary HALT path at the same current boundary.

Callback execution is synchronous. Promises/async callbacks are not supported in v1 because allowing the CPU scheduler to continue while awaiting host work would destroy the clean-boundary guarantee.

## STEP TRACE SCENARIO script lifecycle

The scenario editor is not a standalone CPU-driving program.

The script is evaluated once when the user changes the scenario control from HALT to RUN. It must register one callback:

```js
let vector = 0;

onBreakpoint(function(bp) {
  if (bp.PC === sym("inflate_test_loop")) {
    prepareVector(vector);
    return;
  }

  if (bp.PC === sym("inflate_test_done")) {
    verifyVector(vector);
    vector++;
    if (vector >= VECTORS.length)
      haltAtBreakpoint();
  }
});
```

Because the editor code is evaluated only once per arm operation, closure state such as `vector` persists across breakpoint callbacks.

Changing from RUN back to HALT disables callback dispatch. Changing from HALT to RUN again evaluates the current editor contents anew and replaces the previous callback/closure.

If the editor fails to evaluate or does not register a callback, the UI remains in HALT mode and prints the error.

## Scenario API

The callback-oriented API keeps host observation/manipulation helpers but removes CPU ownership from the intended public workflow.

Required globals inside the editor evaluation scope:

```js
onBreakpoint(fn)
haltAtBreakpoint()
ram
cpu
assert
sym
symbol
symbols
print
```

`cpu` is observational in v1:

```js
cpu.state()
```

The scenario workflow no longer uses:

```js
cpu.start()
breakIf()
reset()
scenario()
```

and the implementation should remove the private scenario condition parser/CPU stepping loop rather than retain a second BREAK IF engine.

`haltAtBreakpoint()` is meaningful only while a callback is running. It requests that the current matching boundary become a normal STEP TRACE halt and switches the scenario UI back to HALT mode.

A JavaScript exception is fail-safe: print the exception, switch to HALT mode, and remain stopped at the current boundary.

## Symbol ownership

STEP TRACE SCENARIO must use the same symbols already loaded into STEP TRACE. It must not import symbols from `EMU_ASM_BUILD`, `DBG_RAM`, TEST BENCH, or the current assembler as a separate symbol universe.

`Apple2Debug` therefore exposes read-only symbol lookup over its loaded symbol set, conceptually:

```js
Apple2Debug.resolveSymbol(name)   // number|null
Apple2Debug.symbol(name)          // record|null
Apple2Debug.symbols()             // records[]
```

The symbol loader maintains a case-insensitive name-to-value map alongside its existing address-indexed label/EQU structures. `STB.sym`, `STB.symbol`, and `STB.symbols` proxy these debugger-owned services.

Numeric RAM/register testing continues to work with no symbols loaded. A symbolic lookup without a matching STEP TRACE symbol reports an explicit unknown-symbol error.

## UI

The current STEP TRACE SCENARIO Run button becomes a two-state breakpoint-action control.

### HALT at breakpoint

```html
<i class="fa fa-pause"></i>
```

- default state
- title/tooltip: `HALT at breakpoint`
- BREAK IF behaves exactly as it does today

### RUN at breakpoint

```html
<i class="fa fa-sign-in-alt"></i>
```

- title/tooltip: `RUN script at breakpoint`
- the editor script has been evaluated successfully and a callback is registered
- each BREAK IF match invokes the callback and normally continues execution

The scenario action control does not arm/disarm BREAK IF and does not start/pause the emulator. Those remain separate STEP TRACE controls.

The scenario popup may be closed while RUN mode is active; callback state is runtime state, not DOM state. Reopening the popup reflects the current mode.

## Remove the special live-load workflow

STEP TRACE SCENARIO no longer requires an authoritative assembler build in live RAM. The user may have loaded code via monitor paste, disk software, ProDOS, another program, or any other normal emulator path.

The Assembler's special **LOAD LIVE** button is removed from the normal UI and STEP TRACE SCENARIO has no `EMU_ASM_BUILD` dependency.

`DBG_testbench.js` must no longer initialize the live-load service merely to support STEP TRACE SCENARIO. The neutral/live-build files introduced for that path may be removed if they have no remaining runtime consumer; at minimum they must not be loaded by the standard page and no user documentation may claim they are required for STEP TRACE.

TEST BENCH remains an isolated debugger facility and remains unrelated to STEP TRACE SCENARIO.

## INFLATE validation flow

`INFLATE_ASM_CORE.S` receives a small explicit 6502 test driver outside its decompressor/scratch range. The current scratch block begins at `$0A00`; the test driver must be placed beyond the scratch and guard region. A suitable location is `$0D10`:

```asm
        ORG     $0D10
inflate_test_loop
        JSR     inflate
inflate_test_done
        JMP     inflate_test_loop
```

The user starts the live program at `inflate_test_loop` and arms:

```text
PC==inflate_test_loop || PC==inflate_test_done
```

The JavaScript harness registers one persistent callback:

- at `inflate_test_loop`: prepare the current compressed vector, output area, guards, and input/output pointers;
- at `inflate_test_done`: compare output against Pako, check pointers/guards/stack, record the result, advance to the next vector;
- after the final vector: print the summary and call `haltAtBreakpoint()`.

The harness no longer writes a `$0200` trampoline, calls `cpu.start()`, or contains its own `STB.breakIf()` stepping loop.

The corrected `fixed_all_distance_ranges` manifest remains `expectedBytes: 33426`.

## Failure behavior

- BREAK IF script evaluation error while arming: remain HALT, do not alter emulator execution.
- Callback exception: log error, switch to HALT, stop at current matching boundary.
- `haltAtBreakpoint()`: switch to HALT and stop at current matching boundary.
- Assertion failure: assertion helper records/prints failure; the harness decides whether to request halt. The INFLATE harness should halt on a failed vector rather than continue with potentially corrupted state.
- Missing symbol: explicit script error; callback exception behavior then halts safely.

## Tests

Regression coverage must prove:

1. Existing HALT-mode BREAK IF semantics are unchanged.
2. RUN-mode handler executes before the matching opcode and a successful handler does not stop CPU execution.
3. RUN mode remains active across repeated matches in a 6502 loop.
4. `haltAtBreakpoint()` converts the current match into a normal stop.
5. Handler exceptions fail safe to a normal stop.
6. Scenario mode does not change STEP TRACE execution speed or start/stop execution itself.
7. Scenario symbols come exclusively from STEP TRACE's loaded symbol table.
8. Scenario works with no `EMU_ASM_BUILD`, TEST BENCH, or `DBG_RAM` object.
9. The special LOAD LIVE control is absent from the standard UI path.
10. INFLATE harness contains no trampoline, `cpu.start()`, or scenario-owned `breakIf()`.
11. INFLATE's loop driver and BREAK IF locations permit all 15 vectors to be driven by repeated live breakpoint callbacks.
12. All compressed-vector manifest lengths are independently checked with Node's raw DEFLATE decoder so fixture metadata cannot silently drift again.

## Non-goals

- Scenario JavaScript does not become an async task system.
- It does not introduce a second breakpoint expression language.
- It does not provide a second CPU scheduler.
- It does not auto-load assembled bytes into emulator memory.
- It does not auto-arm BREAK IF.
- It does not change TEST BENCH's isolated debugger semantics.
