# PAY-00.6 — Deterministic PAY-Light Compiler

## Status and scope

PAY-00.6 converts **bounded PSID execution evidence** (complete-report JSON exported by PAY Interpreter v0.5.1) into a **native 6502** program driving **AY0 on the Mockingboard** via VIA0. There is no GPT dependency in this compilation step. The output is a finite adaptation of observed **frame-end register states**, not a reconstruction of the original pattern-token grammar or complete, automatically looping composition.

Two entry points alone do not imply IRQ ownership: **the host program must call `PAY_TICK` once at the same cadence used to collect the PSID frames**. A future resident IRQ wrapper may call this entry point but is not provided here.

Files:

- `tools/PAY_Compiler.html`: fully standalone browser GUI with embedded compiler (open as local file).
- `tools/PAY_Compiler_core.js`: equivalent dependency-free library for Node and browser scripts.
- `tests/PAY/pay_compiler_v06.test.cjs`: manifest-driven tests that re-execute existing `.sid` fixtures through the v0.5.1 interpreter, compile, execute generated native code, and validate Mockingboard bus writes.
- `tests/PAY/fixtures/{selfmod_gate,pitched,indirect_read}.sid`: existing source tests, unchanged.
- `tests/PAY/expected/PAY_Compiler_Regression_Manifest.json`: existing v0.6 baseline, unchanged.

## Browser workflow

1. In `tools/PAY_Interpreter.html`, import a `.sid` file, trace frames (normally 300), optionally obtain GPT interpretation, and export **Download Complete Report JSON**.
2. Open `tools/PAY_Compiler.html`, load that JSON, set the physical Mockingboard slot and RAM base.
3. Choose **Source-volume-respecting** or **Audible diagnostic** mode.
4. Click **Compile native PAY-Light**, then export symbolic `.S`, raw `.bin`, or byte-exact DB-only `.txt`.

There are no network calls and no API keys.

## Native entry points and calling convention

For binary loaded at `$6000` (the default):

| Address | Routine | Operation |
|---|---|---|
| `$6000` | `PAY_INIT` | Set VIA0 DDRA/DDRB, reset absolute RAM counters, mute AY0 and initialise bus |
| `$6003` | `PAY_TICK` | Apply this frame's AY register deltas; increment 16-bit frame counter |
| `$6006` | `PAY_STOP` | Silence AY0, mark the driver stopped |

For initial BASIC smoke tests, `BLOAD` the raw binary with the desired load address through an appropriate loader, `CALL 24576` to initialise, then repeated `CALL 24579` to drive frames (manual BASIC calls are **not** a suitable timing source). `CALL 24582` mutes. The byte-exact `.txt` is useful for `ASM_core.js` when binary loading is impractical; the `.S` is the symbolic 6502 source. **The binary is raw memory bytes, not a DOS B-file header.**

- Preserves registers A, X, Y on return; processor flags may change.
- Uses **zero PAY-owned zero-page bytes**; uses only the normal 6502 stack at `$0100` and writable state in its own generated RAM footprint.
- Generated program instructions are never modified at runtime; the dedicated 5-byte `PAY_STATE` region is writable data.
- No IRQ handler, IRQ vector, timer or C64/SID virtual register bank is installed.
- VIA0 register select/write is based on the existing `AY_SCORE_TIMING_MB04.S`: ORA=`$Cs01`, ORB=`$Cs00`, control cycle 7→4 for latch and 6→4 for data, DDR A=`$FF`, DDR B=`$07`. Physical slot 4 defaults to `$C400`/`$C401`. The program owns AY0 while active, so coordinate with any other Mockingboard audio driver.

### Finite trace policy

`PAY_TICK` accepts the observed 300 frames (or whatever bounded sample was recorded) and **mutes on the first tick beyond that interval**. It does not infer an infinite loop from a repeating sound-state signature. To preserve the full source song, recover more than a finite frame trace and explicitly establish its musical sequencing / repeat grammar.

## Translation policy

The compiler derives *AY register snapshots* for the three SID1 voices mapped to AY0 A/B/C. It compares adjacent frames and emits only changed AY registers, removing redundant SID writes. Period values come from the interpreter's calculated AY periods. Frame 0 maps to the first `PAY_TICK`, not `PAY_INIT`.

**Source-volume-respecting mode (default):** SID master volume (`D418 & 15`) zero => output remains muted. A zero-frequency voice, missing pitched waveform, TEST bit or a zero pulse width for a pulse waveform is not promoted to a pitched AY note. Even with nonzero master volume, SID analog behaviour (ADSR, filters, PWM, ring/sync, combined waveforms) cannot be reproduced exactly: this is not guaranteed audible fidelity.

**Audible diagnostic mode:** deliberately overrides SID master-volume mute and PWM-zero limitations for a *pitch-bearing GATE+waveform* with a configured AY amplitude (1–15, default 10). A source with GATE and zero frequency remains unpitched and silent. Diagnostic mode is **not an acoustically faithful rendition of the original SID**.

Initial profile uses AY square tone; SID NOISE-only may enable AY noise (noise-frequency correspondence is not established). Mixer register R7 controls tone/noise. Not all register writes captured in a frame are retained individually: repeated intra-frame GATE pulses, transient envelope events and control changes can be invisible in the **frame-end snapshots**. Preserve `runtimeTrace.sidEvents` and `musicalIR.rawGateEdges` for later compiler stages.

## Deterministic action scheduling

The generated program has a 16-bit frame counter and a small action index in absolute RAM. It uses indexed absolute action tables, one action group per changed-AY frame, and a small `RTS`-stack dispatcher into native 6502 event handlers. These handlers call a minimal VIA0 register writer. No self-modifying dispatch, zero-page pointer, dynamic SID interpretation, or 6502 copy of the original SID player is needed.

PAY-00.6 supports **at most 255 changed-AY frames**. This is deliberately checked; it rejects, rather than truncating, larger scores. A more general compiled event stream, compressed pattern grammar, and source loop analysis belong to PAY-00.7.

Input requirements: complete PSID trace (frames requested = frames completed, no trace errors or dropped records), v0.5.1 musical IR, single SID base `$D400` only; extra SID chips require an explicit assignment strategy. Compatible user-configured output start lies in Apple II RAM ($1000–$B000). The binary must remain entirely below `$C000`.

## Regression tests

From the repo root:

```sh
node tests/PAY/pay_compiler_v06.test.cjs
```

This suite uses no npm packages and makes no GPT requests. It recomputes the actual original three source traces using the current `tools/PAY_Interpreter.html`, verifies the fixture SHA-256 hashes and manifest evidence, compiles **both output modes**, and executes generated machine code in a test 6502 interpreter. The test mock observes VIA0 latch/write cycles and compares AY register values, including source-volume mute, periods **133 and 132**, zero-page ownership and unchanged executable bytes. It also tests a synthetic six-transition example at frames 255/256 and rejects exceeding the 255-action capacity.

The existing manifest's historical **34/34** source observations are used as a reference; the new tests add native program checks. Neither outcome proves real Apple II audio quality or complete-song conversion. The next native acceptance test should run these generated binaries in RetroAppleJS with actual Mockingboard capture.

## Upcoming PAY-00.7

Extend to a general compressed event stream and decoded musical flow with verified looping. Add a resident Timer1 IRQ wrapper that schedules `PAY_TICK` while preserving the Apple II state, add actual Mockingboard telemetry comparisons and audible multi-note fixtures. Avoid assuming that frame-state periodicity proves song-level loops.
