# PAY-00.8F — First executable semantic slice

## Status

**Implemented:** an evidence-gated, source-first *partial* semantic compiler for Bomberland's `player_entry` mechanism. This does **not** claim complete first-PLAY memory/table setup, musical playback, or an approved complete transpilation. All outputs from the provided example are explicitly **experimental, unreviewed fixtures**.

**Not implemented:** source-derived note scheduling, command interpreter, instrument selection, AY audio generation, filter or waveform transformations, local repeats or complete-song looping. No SID or AY register-stream recordings enter the compiler.

## Compatibility with the existing PAY API

Existing `PAY_Semantic_Program_v0.8.1` and `PAY_Semantic_Candidate_v0.8` remain the evidence/review transport. `PAY_Semantic_Executable_Module_v0.8F` is a deliberately narrow, typed **compilable projection**, not a replacement for those interfaces or an implicit promotion of the GPT candidate. The current compiler does **not** accept raw GPT candidate JSON or a complete, unreviewed `PAY_Semantic_Program_v0.8.1`. A future adapter must require resolved dependencies, source proof and independent approval.

The `player_entry` source evidence is from `/examples/PAY/Bomberland_player_entry_enriched_evidence.json` and the original PSID identified by SHA-256:

`65c3874b9f529c9adac45852f6e216eef2307a325051471d8b58290c38f71a68`

The compiler matches the input PSID SHA-256, checks mandatory evidence IDs and semantic capability IDs, checks the typed subtune expression, and rejects missing/unsupported mechanisms. This prototype intentionally supports only **this source identity**, the source-supported formula `3 * A`, and the `player_entry` slice; a new PSID requires a new verified lowering, not a reinterpretation of the same capability.

## Verified source logic and exact scope

Original PSID source:

- INIT `$1000` → `$10F1`: write original A to instruction operand `$10F6`, compute subtune index as `3*A`, and patch PLAY's `LDY` immediate at `$1129`.
- PLAY `$1003` → `$1126`: the first call follows the fall-through branch using the patched `LDY` value. The source subsequently restores `$1129` to `$FF`, causing later PLAY calls to take the regular branch.
- Independent source-emulator tests for A=0,1,2 prove `$10F6`=`0,1,2`; `$1129`=`0,3,6` after INIT and `$FF` after first PLAY, respectively.

Target compilation:

- `PAY_SUBTUNE_A` / `PAY_SETUP_INDEX` store the original subtune and `3*A` in absolute RAM.
- `PAY_FIRST_PENDING` is an explicit one-time latch, replacing the source self-modifying branch operand.
- On the first tick: latch clears, `PAY_FIRST_COUNT` increments, `PAY_LAST_PATH=1`. Later ticks: `PAY_REGULAR` increments, `PAY_LAST_PATH=2`. A frame counter is provided solely for diagnostics.
- The source's unknown *channel-table initialization body* is **not executed**; the emitted code reproduces only its entry/dispatch condition. It must not be interpreted as a complete `PLAYER_TICK` implementation. Output is silent.

## Target ABI and resource policy

The generated `.S` starts at `$6000` and is 430 bytes including the IRQ wrapper and 18 bytes of absolute RAM state, ending at `$61AD`. The exact symbols are in `asm/AUDIO/Bomberland_PAY08F_ENTRY_FIXTURE.symbols.json` from the independent test assembler.

| Label | Address | Applesoft BASIC | Function |
|---|---|---|---|
| `PAY_INIT_A` | `$6000` | `CALL 24576` | INIT using 6502 A as 0-based subtune; BASIC cannot set A predictably |
| `PAY_TICK` | `$6003` | `CALL 24579` | Run one semantic dispatch/tick |
| `PAY_STOP` | `$6006` | `CALL 24582` | Stop and remove the timer IRQ |
| `PAY_IRQ_INSTALL` | `$6009` | `CALL 24585` | Install VIA1 Timer1 interrupt |
| `PAY_IRQ_REMOVE` | `$600C` | `CALL 24588` | Remove VIA1 Timer1 interrupt |
| `PAY_INIT_SUBTUNE1` | `$600F` | `CALL 24591` | INIT subtune 1 (source A=0) |
| `PAY_INIT_SUBTUNE2` | `$6012` | `CALL 24594` | INIT subtune 2 (source A=1) |
| `PAY_INIT_SUBTUNE3` | `$6015` | `CALL 24597` | INIT subtune 3 (source A=2) |

**RAM diagnostics** (generated symbols, not guesses):

| Label | Address / decimal | Meaning |
|---|---|---|
| `PAY_SUBTUNE_A` | `$619D` / 24989 | 0-based subtune |
| `PAY_SETUP_INDEX` | `$619E` / 24990 | `3*A` |
| `PAY_FIRST_PENDING` | `$619F` / 24991 | Initial 1 → 0 on first tick |
| `PAY_ERROR` | `$61A1` / 24993 | Nonzero for rejected INIT input |
| `PAY_FRAME_LO/HI` | `$61A2/$61A3` / 24994–24995 | Count of executed ticks |
| `PAY_FIRST_COUNT` | `$61A4` / 24996 | One per initialization |
| `PAY_REGULAR_LO/HI` | `$61A5/$61A6` / 24997–24998 | Normal tick count |
| `PAY_LAST_PATH` | `$61A7` / 24999 | 1 first, 2 regular |
| `PAY_IRQ_ACTIVE` | `$61A8` / 25000 | IRQ active flag |
| `PAY_IRQ_COUNT_LO` | `$61AC` / 25004 | Hardware timer interrupt count (low byte) |

Mockingboard: physical slot 4, VIA1 T1 at `$C480`; soft IRQ vector `$03FE/03FF` and the Apple II Monitor's accumulator scratch `$45`. This mode assumes exclusive ownership of VIA1 Timer1. It generates no AY writes. The Timer1 rate is a 50 Hz **target assumption**, not a reconstructed source CIA/VIC timing property. No PAY-owned zero-page bytes or self-modifying code are used.

## RetroAppleJS manual acceptance

If an earlier PAY resident player is active, stop it **before assembling/loading this source** using its `CALL 24582` STOP entry. Assemble `asm/AUDIO/Bomberland_PAY08F_ENTRY_FIXTURE.S` with RetroAppleJS `ASM_core.js` and load it at `$6000`. No music should be heard.

### Manual-tick acceptance

```basic
CALL 24591
PRINT PEEK(24989),PEEK(24990),PEEK(24991)
```

Expected `0  0  1` for subtune 1. Then:

```basic
CALL 24579
PRINT PEEK(24991),PEEK(24996),PEEK(24999)
```

Expected `0  1  1`. Ten more ticks:

```basic
FOR I=1 TO 10: CALL 24579: NEXT I
PRINT PEEK(24994),PEEK(24995),PEEK(24997),PEEK(24999)
```

Expected `11  0  10  2`. Repeat with `CALL 24594` (expect `1  3  1` at 24989–24991) or `CALL 24597` (expect `2  6  1`).

### Resident IRQ acceptance

```basic
CALL 24591
CALL 24585
PRINT PEEK(25000),PEEK(25004)
PRINT PEEK(24994),PEEK(24995)
```

First PEEK should show active flag `1`; IRQ counter and frame counter should advance with elapsed time. To stop safely:

```basic
CALL 24582
```

If no progress occurs, use the manual tick test first; only then investigate IRQ vector ownership and VIA1 IRQ delivery. Never infer AY volume from Mockingboard's register-buffer-consumption percentage.

## Builds and review gates

Research fixture build:

```sh
node tools/PAY_Semantic_Compiler_008F.cjs \
  --module examples/PAY/Bomberland_player_entry_Semantic_Module_v08F.json \
  --evidence examples/PAY/Bomberland_player_entry_enriched_evidence.json \
  --capabilities examples/PAY/PAY_Compiler_Capabilities_v08F.json \
  --out asm/AUDIO/Bomberland_PAY08F_ENTRY_FIXTURE --fixture
```

Production compilation defaults to **blocked** until a separate, source-matched, module-SHA256-bound `PAY_External_Review_v0.8F` approval is provided via `--approval`. This experimental approval format is not a cryptographic signature and should not be confused with proof of semantic correctness. It ensures that GPT's self-asserted review flag alone cannot authorise compilation.

Browser: open `tools/PAY_Semantic_Compiler_00_8F.html`, inspect the preloaded evidence, and click **Compile research fixture**. This uses precisely the same compiler preflight and source generator as the CLI's fixture mode. The browser intentionally supports only fixture compilation; production requires CLI review approval.

## Regression tests

```sh
node tests/PAY/pay08f_contract.test.cjs
node tests/PAY/pay08f_source_oracle.test.cjs
node tests/PAY/pay08f_native.test.cjs
node tests/PAY/pay08f_browser.test.cjs
```

The native test assembles using an *independent assembler based on the PAY Interpreter's NMOS opcode table* and then executes with the Interpreter's 6502 CPU. This is **not** a direct call to RetroAppleJS `ASM_core.js`. On-device source syntax and live VIA1 IRQ behaviour must be confirmed by the user's RetroAppleJS test.

## Next steps

PAY-00.8G: verify one real source note's complete path (token → pitch table → duration → instrument/gate), formalise its parameters in the semantic API, implement the corresponding AY capability, and generate the **first actually audible semantic code**. Do not use the v0.7.3 AY register-event score as compiler input. The existing 60-second AY capture remains an audio reference only.
