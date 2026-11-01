# PAY-00.7 — Extended native PAY-Light compiler and resident Mockingboard playback

## Deliverables and compatibility

PAY-00.7 compiles a PAY Interpreter v0.5.1 *complete-report JSON* into a standalone, executable Apple II 6502 image that drives Mockingboard AY0. The emitted code contains a compact **finite evidence schedule** of observed AY register changes, not a copy of the C64 SID player. A separate **opt-in** VIA1 Timer1/Apple Monitor soft IRQ driver can call `PAY_TICK` in the background.

- `tools/PAY_Compiler.html` — standalone GUI (embedded v0.7 compiler; offline, no GPT key).
- `tools/PAY_Compiler_v07_core.js` — Node/browser UMD compiler library.
- `tests/PAY/pay_compiler_v07.test.cjs` — Node native 6502 and Mockingboard VIA bus regression tests using the existing v0.5.1 interpreter, SID fixtures and v0.6 manifest.
- `tests/PAY/fixtures/pay07_melody.sid` — **original synthetic** four-pitch melody with source master volume nonzero, demonstrating faithful *register-state* conversion.
- `examples/PAY07_MELODY.*` — complete-report JSON, symbolic `.S`, DB-only `.txt`, `.bin` and compiler metadata for immediate testing.

**Compatibility:** `tools/PAY_Compiler_core.js` is deliberately left at v0.6 so `tests/PAY/pay_compiler_v06.test.cjs` continues to run. The v0.7 UI embeds its own core and the new test imports `PAY_Compiler_v07_core.js`. The existing `tests/PAY/expected/PAY_Compiler_Regression_Manifest.json`, three original `.sid` files and PAY Interpreter are **not** replaced.

## Native API and memory map

The first five entry vectors are 3-byte `JMP` instructions. With the usual load base `$6000`:

| Entry | Address | Usage |
|---|---|---|
| `PAY_INIT` | `$6000` / `CALL 24576` | Initialise VIA0/AY0, mute channels, reset playback state; preserves A/X/Y |
| `PAY_TICK` | `$6003` / `CALL 24579` | One deterministic music tick (may be polled or called by the IRQ) |
| `PAY_STOP` | `$6006` / `CALL 24582` | Disable owned Timer1 IRQ, conditionally restore vector, mute, mark done |
| `PAY_IRQ_INSTALL` | `$6009` / `CALL 24585` | **Opt in** to resident VIA1 Timer1 interrupts; preserves A/X/Y and processor flags |
| `PAY_IRQ_REMOVE` | `$600C` / `CALL 24588` | Disable this timer hook and restore the previous soft vector **only if still owned** |

Generated state is at the end of the binary in **14 dedicated absolute-RAM bytes**: `FRAME_LO`, `FRAME_HI`, `NEXT_LO`, `NEXT_HI`, `NEXT_FRAME_LO`, `NEXT_FRAME_HI`, `PAY_DONE`, `PAY_TMP`, `IRQ_ACTIVE`, `OLD_IRQ_LO`, `OLD_IRQ_HI`, `OLD_ACR`, `IRQ_COUNT_LO`, `IRQ_COUNT_HI`. The entire image must remain in RAM and **below `$C000`**. Source upload is a raw `.bin` (no DOS B-file header); load it at the selected ORG address, or use the byte-exact `.txt` in `ASM_core.js`.

No PAY-owned zero-page variables and **no writes into generated executable instructions**. Ordinary 6502 hardware stack use is required; an Apple Monitor IRQ handler may use **system-owned `$45`** to save interrupted A, just as in existing Mockingboard tests. Foreground calls preserve A/X/Y, but `PAY_TICK` may change processor condition flags; the IRQ returns through `RTI` restoring the interrupted flags.

### Event engine and capacity

`PAY_TICK` increments a 16-bit frame index, compares with a 16-bit next-event frame, and dispatches through a normal **`JMP (NEXT_LO)`**, where `NEXT_LO/NEXT_HI` live in absolute RAM. Each linked event routine writes only changed AY registers and sets the next event address and frame. Repeated *identical AY update blocks* are emitted once and called by multiple finite events. The indirect pointer is placed so it cannot hit the NMOS `JMP ($xxFF)` wraparound bug.

This removes v0.6's **255 changed-action-frame cap**, while retaining finite stop semantics. Trace length may be up to **65,534 frames** by counter representation, but compilation can hit Apple II RAM limits long before that; the compiler rejects images crossing `$C000`. PAY Interpreter v0.5.1 itself limits captures to a smaller window (1200 frames in its current UI). No action record is silently discarded.

### Pattern detection is not proof of the source grammar

Output metadata contains:

- `observedMotifs`: exact repetition of AY register-delta blocks at observed frame indexes; duplicated native write routines can be shared.
- `observedPatterns`: repeated finite sequences of 2–16 changed-AY events with the *same relative frame spacing*. They are observations, **not** verified original SID pattern tokens or loop counters.
- `source.observedRepetition`: the interpreter's bounded frame-end sound-state repetition (which might conceal different internal 6502 state).

The default `endPolicy="stop"` mutes after all captured frames. `endPolicy="repeat-observed"` explicitly replays the **captured window** in a demonstration, resetting the AY mute state between passes. This is **not** a recovered source-song loop or evidence of a musically correct repeat point. Full original pattern-token decoding, conditional/nested loops and correctness beyond the captured trace remain future reverse-engineering tasks.

## Mockingboard connection and resident IRQ

The physical slot is configurable (default **slot 4**, VIA0 `$C400`, VIA1 `$C480`). AY0 register select/write through VIA0 follows the benchmark sequence: ORA/ORB strobes `7→4` select and `6→4` write, with DDRA=`$FF` and DDRB=`$07`.

`PAY_IRQ_INSTALL` temporarily owns the Apple II Monitor **soft IRQ vector `$03FE/$03FF`** and **VIA1 Timer1** at `$Cs84/$Cs85`. It disables its Timer1 IRQ, acknowledges any previous Timer1 flag, saves the prior vector and VIA1 ACR, enables free-running T1 with a CPU-clock-derived 50/60-Hz latch, then enables Timer1 IRQ. In the handler, **only** a T1 interrupt is acknowledged and passed to `PAY_TICK`; unrelated interrupts chain to the saved handler. The interrupt count is available in absolute `IRQ_COUNT_LO/HI`. Removal disables T1, restores ACR, and restores the old vector only if it has not been changed by someone else. Install/remove are idempotent in the regression environment.

**Hardware prerequisites and limitations:**

1. Apple II/II+ compatible Monitor ROM IRQ convention: interrupted A is saved at system `$45` by the Monitor soft-vector entry and can be restored before `RTI`/foreign-handler chaining. The wrapper is not universal for other ROMs, custom low-level IRQ handlers or machines with different vector conventions.
2. **Exclusive ownership of VIA1 Timer1**, and cooperation with any other Mockingboard audio player. Installing over a competing IRQ or using the same VIA while another driver is active is unsupported. The previous vector is saved, but a timer that was already owned by another program is not safely multiplexed.
3. Timer latch is `round(cpuClockHz / irqHz) - 2`. Defaults: estimated 1,023,000 Hz, IRQ 50 Hz (or user-selectable 60 Hz). This is an approximation, **not** calibrated against the actual emulator CPU/IRQ timing. A trace's `PLAY` frames do not automatically establish its authentic PAL/NTSC/CIA cadence.
4. `PAY_INIT` should be called before `PAY_IRQ_INSTALL`. Use `PAY_STOP` before loading another music program or changing slot configuration. Avoid replacing/unloading the memory containing the resident handler while it is installed.
5. `PAY_INIT`/`PAY_STOP` protect critical changes with `SEI` and restore the caller's flags. Ordinary `PAY_TICK` does not install an interrupt handler. The ROM Monitor itself is allowed to write its own `$45`; this does **not** mean the PAY program has zero *system* zero-page activity.

### Applesoft / RetroAppleJS smoke test

Load the raw image at `$6000`, configure physical Mockingboard slot 4, then in Applesoft:

```basic
CALL 24576: REM PAY_INIT
CALL 24585: REM PAY_IRQ_INSTALL (OPTIONAL, 50 HZ DEFAULT)
REM BASIC FOREGROUND MAY CONTINUE WHILE IRQ PLAYS
CALL 24582: REM PAY_STOP (MUTES AND UNHOOKS)
```

`PAY_IRQ_REMOVE` (`CALL 24588`) is also available if you want to stop timer-driven playback but retain the current AY sound until `PAY_STOP`. If you're testing manually, leave IRQ uninstalled and drive `CALL 24579` once per tick using a proper scheduler (repeated BASIC calls are not tempo-accurate).

Do not rely on BASIC to establish an IRQ-safe memory map for arbitrary programs. Check the complete output image address range displayed in the UI and reserve it against other code/HGR/data. Confirm the physical slot mapping: it may differ from an emulator's internal slot index.

## Musical mapping and fidelity boundaries

Inputs must have complete bounded runtime frames, no dropped records, PSID with one SID at `$D400`, and matching source/IR titles. The compiler consumes **observed frame-end SID state**, never unverified GPT conclusions. Source-volume-respecting mode leaves zero SID master volume muted; audible diagnostic mode explicitly overrides this for pitched states. Source `TEST`-disabled oscillators and GATE with zero frequency do not become invented notes. A positive AY amplitude is an approximation, not proof that the original SID analog envelope would have produced an equally audible note.

No SID analog filter/PWM/ADSR, ring modulation, sync or combination-waveform faithful rendering is claimed. Intra-frame transient writes are not retained in frame-end actions (the interpreter's bus trace remains available for future work). AY tone period values derive from the interpreter's frequency conversion. Three SID voices map to AY0 A/B/C; any extra SID chip requires explicit allocation.

## Validation

From repository root (Node 22+ recommended):

```bash
node --test tests/PAY/pay_compiler_v07.test.cjs
node tests/PAY/pay_compiler_v06.test.cjs
```

The v0.7 suite reuses the existing original three SID fixtures and manifest **without embedding large historical JSON reports**: it re-executes them through the local v0.5.1 Interpreter, compiles each native binary, executes it in an independent limited 6502 test CPU, and records actual AY0 VIA register writes. It also tests the new original `pay07_melody.sid` changing-pitch fixture, 300 distinct actions (past the old 255 cap), 1200-frame score, 50-Hz Timer1 install/300 interrupt invocations/foreign chaining/removal, state protection, and explicitly requested finite-window repeat mode. The tests simulate Monitor-owned `$45` and do not treat that system write as PAY-owned zero-page access.

**Boundaries:** These are CPU/VIA transaction simulations, **not** real RetroAppleJS/Mockingboard analog/audio captures or a measured IRQ timing acceptance test. Browser UI smoke-tested using Chromium with file upload and actual downloads. Verify the exported binary and generated assembler in your emulator before claiming native audio readiness or coexistence with Applesoft in your local configuration.

## Next research phase

For *Partyland* and other real scores, supply a much longer **unedited original** `.sid` trace and recover the original pattern-token grammar with proof from dynamic `(zp),Y` read sequences and note-state/control dependencies. Build a source-state checkpoint or exact instruction-path validation to establish a true full-song loop. Compare long-duration AY captures against the original SID/PAY evidence; calibrate IRQ timing and audible waveform compromises in RetroAppleJS. None of these can be deduced solely from the three deliberately minimal fixtures.
