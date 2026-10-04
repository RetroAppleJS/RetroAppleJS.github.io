# Vaporlock bus regression — STEP TRACE SCENARIO

This scenario validates the JavaScript CPU, NTSC Apple II/II+ scanner, floating bus, partially driven I/O, and instruction bus timing introduced by `RetroAppleJS-vaporlock-bus-d9d3d68.patch`.

It uses the existing live STEP TRACE SCENARIO runner. No emulator source or UI changes are required. The script injects a short 6502 program into RAM and registers one synchronous breakpoint callback. The emulator executes every instruction; the callback prepares fixtures and checks the preceding instruction at the next boundary.

WASM remains out of scope. This is a regression scenario for the bus foundations, not a claim that an original Vaporlock demo has been validated.

## Files

| File | Use |
| --- | --- |
| `VAPORLOCK_STEPTRACE_SCENARIO.js` | Paste the complete script into the live SCENARIO editor. |
| `VAPORLOCK_STEPTRACE_SCENARIO.md` | Setup, coverage, results, and cleanup instructions. |
| `validate_scenario.cjs` | Repeat the automated validation against a local patched RetroAppleJS checkout. |
| `VALIDATION.txt` | Output from validating this release of the scenario. |

## Run in the emulator

Use a freshly booted Apple II+ with the standard motherboard/game-port device and the Vaporlock patch applied. Select JavaScript CPU execution and avoid active interrupt-generating peripherals. This is a RAM fixture test: `$6000–$609D` is replaced by the test program, and the display-memory fixture temporarily changes the screen.

1. Enter the Apple II monitor through the normal emulator workflow. From Applesoft, type `CALL -151` and Return. Leave the monitor at its `*` prompt.
2. Move the SYSTEM CPU speed slider to **0%** until the bug icon appears; click the bug icon to open **STEP TRACE**. Click **`</>`** to open **STEP TRACE SCENARIO**.
3. Select a fixed STEP TRACE speed, preferably **1000 IPS**. The scenario expects one video cycle per CPU tick. A fractional phase left over from an earlier SYSTEM speed is supported. If a partial instruction is pending, use **Step In** once to reach a clean boundary before arming.
4. Paste the complete JavaScript file into the SCENARIO editor. Select **RUN script at breakpoint**. This registers the callback and injects the program once; it does not start CPU execution.
5. Enter this expression in **BREAK IF**, then click **Arm**:

   ```text
   PC >= $6000 && PC <= $62FF
   ```

6. Click STEP TRACE's main **Run** control. At the Apple II monitor prompt, type `6000G` and Return. The existing CPU executes the injected program. The closed-loop skipper may be enabled to make the monitor's keyboard-wait loop responsive at fixed IPS.
7. Keep the pointer off the Apple II screen while the test runs. The scenario fixes PB0 and PDL0 test values; normal host input remains connected.
8. Read the SCENARIO console. Success ends with:

   ```text
   PASS scanner: literal boundaries plus 102180 frame/mode positions
   ... individual instruction PASS lines ...
   PASS COMPLETE: 59/59 instructions; fixtures restored
   ```

Execution stops **before** the terminal `JMP` at `$609A`. The callback returns to HALT mode and BREAK IF is disarmed. The JSR subroutine is the `RTS` at `$609D`.

If the monitor is already executing when you prepare the test, pause it before pasting/arming. The scenario never sets PC or starts a second CPU runner. `6000G` supplies the ordinary 6502 control-flow entry.

## What is checked

| Check | Expected evidence |
| --- | --- |
| Horizontal preset | The first two H states repeat; text fetch address `$1468` repeats at frame cycles 0 and 1. |
| Horizontal blanking | HBL is cycles 0–24; cycles 25–64 fetch the 40 visible columns. II/II+ text fetches select A12 during HBL. |
| Vertical blanking and frame wrap | VBL starts at line 192; lines 256–261 use the vertical preset; frame length is 17,030 cycles. |
| Pages and modes | Text/lores and hires on both pages, plus hires mixed mode on both pages. All 17,030 positions are queried for each of six modes. |
| Floating reads | `$C020` returns the physical scanner RAM byte at the data cycle, including when reached through indexed addressing. |
| Mode-switch ordering | `$C050–$C057` reads return the preceding video fetch under the old latch state, then update the appropriate latch. |
| Partial bus drivers | PB0/PDL0 drive D7 while D0–D6 retain the scanner byte. PB0 at `$C069` mirrors `$C061`; PDL0 at `$C06C` mirrors `$C064`. |
| Paddle timing | A one-step paddle expires 11 CPU cycles after the effective trigger cycle. Both read and write triggers are exercised. |
| Absolute reads | LDA, CMP, BIT, and EOR use data offset 3 in their four-cycle instructions. Result registers and relevant flags are checked. |
| Indexed and indirect reads | Non-crossing and crossing reads, wrong-page dummy reads, and LDA/CMP/EOR/SBC through `(ZP),Y` have their expected offsets and results. |
| Address wrapping | `$FF` zero-page pointer wraps to `$00`; `$FFFF,X` with X=1 reads `$0000` after the wrong-page read. |
| Stores | Absolute STA writes at offset 3. Indexed STA performs its wrong-page read at offset 3 and final write at offset 4. |
| Read-modify-write | Absolute INC and indexed ASL/ROL/LSR/ROR/DEC/INC perform the expected reads, original-byte write, final write, and cycle totals. |
| JSR/RTS | JSR reads the low operand, performs its stack read and two pushes, then fetches the high operand at offset 5. RTS returns with the original SP. |
| Observation | Safe reads and scanner queries preserve clocks, mode latches, and the previous diagnostic record. |
| Shared timing | Every tested instruction increments CPU/video clocks by its expected cycles and INS by exactly one. |

Scanner address expectations come from a separate reference function and fixed address literals. Floating-byte expectations come from a known address-dependent RAM pattern, never from `peekFloatingBus()` or `getScannerAddress()`. The oracle necessarily expresses the same hardware wiring; the literals provide an additional check independent of that calculation.

The full-frame scan is **observational projection** through the scanner API. The 59 instruction checks execute on the live CPU at the phase reached by the monitor. Automated validation additionally starts those live runs at six boundary-sensitive phases and one fractional phase. The browser scenario does not reset or artificially advance the clock to force a particular raster origin.

Bus offsets, addresses, values, masks, scanner states, integer CPU ticks, and instruction counts are compared exactly. Fractional video timestamps permit only floating-point rounding of four machine epsilons relative to their magnitude; scanner positions and addresses remain exact.

## Failure and inspection

The first failure prints `FAIL`, records its evidence, restores the declared fixtures, removes the temporary bus observers, and requests a halt at the current clean boundary. Later cases are not run. A failure in a preceding instruction is detected before the next instruction executes.

The script temporarily observes the existing `hw.read()` / `hw.write()` calls and copies each diagnostic record. It delegates to the original functions and never changes the bus maps. Debugger safe reads are excluded from the access list. The expected list covers accesses implemented by the patched instruction executor; it is not a transistor-level assertion of every internal/dummy cycle on an NMOS 6502.

Optional inspection through browser developer tools:

```js
window.VAPORLOCK_STEPTRACE.status
window.VAPORLOCK_STEPTRACE.error
window.VAPORLOCK_STEPTRACE.results
window.VAPORLOCK_STEPTRACE.listing
JSON.stringify(window.VAPORLOCK_STEPTRACE.results, null, 2)
```

Each successful instruction record includes its PC, cycle total, starting clocks/INS, and ordered bus accesses. A failed record also includes actual boundary registers, expected registers, expected accesses, and the error. Results remain available after cleanup.

Use fixed IPS rather than **Max (SYSTEM)** for this version. A CPU/video scale mismatch is a failure, not a skipped timing assertion. Empty output normally means one of callback RUN, BREAK IF Arm, or CPU Run is missing, or that the machine never reached `$6000`.

## RAM, side effects, cleanup, and repetition

| Range or state | Behavior |
| --- | --- |
| `$6000–$609D` | Program injected on arming and left resident after the run. |
| `$0400–$5FFF` | Scanner fixture saved at first entry, filled, then restored on PASS/FAIL/cleanup. |
| `$0000`, `$0042–$0043`, `$00FF` | Pointer scratch bytes saved and restored. |
| `$0100–$01FF` | Stack RAM saved and restored; JSR/RTS independently verifies SP balance. |
| `$6300–$6301`, `$BF20` | Store/RMW and dummy-read fixtures saved and restored. |
| Video mode latches | Saved at entry and restored. |
| PB0 and PDL0 host values | Saved at entry and restored. Paddle timer deadlines are changed by actual trigger accesses and are not restored. |
| Bus monitoring | Enabled during the run and disabled by cleanup. The prior monitoring setting is not recoverable through the patch's API. |
| CPU registers, flags, INS, clocks | Advanced by the real test program; they are not restored. The program executes SEI and CLD. |

This is not a machine-state rollback. Use a fresh/reset machine for ordinary work afterward. Resume at the final PC only if you intend to execute the terminal loop.

For a normal repeat, return to the monitor/reset, re-register the editor in RUN mode, re-arm BREAK IF, and enter `6000G` again. Re-registering creates fresh closure state and results. The script also cleans up an earlier session before preparing another one.

If you interrupt a run manually, **pause CPU execution first**, switch SCENARIO to **HALT**, and then use browser developer tools to run:

```js
window.VAPORLOCK_STEPTRACE.cleanup()
```

Closing the scenario popup merely hides it. Switching to HALT removes the callback but cannot notify this script to restore its fixtures; manual cleanup is therefore needed after cancellation. Cleanup is idempotent. Do not reset/remount peripherals while a scenario is active.

## Automated validation

With Node.js and a checkout containing the Vaporlock patch:

```sh
node validate_scenario.cjs /absolute/path/to/RetroAppleJS
```

The validator loads the real JavaScript CPU, hardware, motherboard, game port, STEP TRACE debugger, breakpoint condition engine, and scenario runner. Only browser drawing/DOM/timers are stubbed. It does not manually call the scenario callback. Normal live instruction stepping triggers the real debugger condition and callback dispatch.

Validation passes all 59 checks at initial video ticks 0, 22, 62, 12,475, 16,660, and 17,027, after a fractional video phase, and with hires/page2/mixed initially enabled. It independently injects four faults and confirms a failed halt: wrong floating-read offset, wrong scanner address, missing indexed RMW original-byte write, and premature JSR high-byte fetch. Successful/failed runs must also remove the observers, restore every byte of all declared fixture ranges and the saved mode, halt at a clean boundary, and consume zero CPU ticks for the final breakpoint. Manual cancellation and repeated cleanup are separately validated.

This validation was run against the patched source based on commit `d9d3d68d8adebd5cbe29dbafe7b65842b31b82ad`. A browser UI session and an original Vaporlock demonstration are separate follow-up checks.
