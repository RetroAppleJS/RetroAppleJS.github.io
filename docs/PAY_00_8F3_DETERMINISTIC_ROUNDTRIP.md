# PAY-00.8F3 — Executable semantics and SID-reference control fixture

## Architecture: exactly two tools

1. **PAY Interpreter** (existing PAY_Interpreter_Semantic_00_8F2.html) traces original PSID, extracts source dependencies, generates GPT/manual briefings, validates semantic candidates, and exports a single `PAY_Semantic_Contract_v0.8F2` JSON.
2. **PAY Compiler** (new PAY_Compiler_Semantic_00_8F3.html) consumes that *same* JSON. It deterministically generates readable Apple II / Mockingboard control assembly (existing backend) and independent C64 / SID control-reference assembly (new backend).

No new user-facing Workbench and **no API call from the Compiler**. The evidence-to-intent transformation remains on the Interpreter side.

## Precise current capability

Only `player_entry` from the exact Bomberland PSID SHA-256 `65c3874b9f529c9adac45852f6e216eef2307a325051471d8b58290c38f71a68` is supported. The verified source-level mechanism is INIT-selected subtune indices 0/3/6; one initial PLAY setup dispatch; subsequent normal PLAY dispatch; with source instruction-operand modifications replaced by absolute RAM state. C64 and Apple II targets use distinct 6502 implementations.

**This is a silent control fixture.** It does not compile any musical pattern, SID writes, AY writes, instrument behavior, source player tempo, loop structure, or the full first-PLAY voice-table setup. It is explicitly not a PSID reconstruction, and SID write similarity cannot be scored for this slice.

The reference source is assembled at `ORG $1000` and implements `INIT=$1000`, `PLAY=$1003`, and optional `STOP=$1006`. The generated code is 166 bytes including state. The AY backend continues to produce an approximately 430-byte source-first control fixture at `$6000`.

## Executable semantic interface, v0.8F3 (derived from an existing contract)

`PAY_Executable_Semantics_v0.8F3` is a strict deterministic projection with:

- Source SHA and entry addresses, scoped to `player_entry`.
- Input `subtuneA:u8` restricted to values 0/1/2, with setup-index `u8` arithmetic and stride 3.
- Absolute state variables `subtuneA`, `setupIndex`, `firstPending`, `firstCount`, `regularCount`, `tickCount`.
- Supported semantic operations: `init_with_subtune_stride`, `first_tick_dispatch`, `tick_observation`.
- Required original source evidence IDs, confidence checks, source-byte fingerprints, state and target constraints.
- Declared `completeness: control_slice_only`, `clock: external_50hz_assumption` and unresolved downstream semantics.

The compiler does not interpret free-text GPT claims as executable code. It checks a typed compiler projection already contained in the contract. A claim without required source evidence, an altered stride, incorrect PSID identity, unknown operation, or register-event fallback is rejected.

The projection has a deliberately *small* opcode vocabulary. Future semantic commands will be added as typed, tested compiler capabilities; unsupported commands never receive a guessed implementation.

## Deterministic round-trip and adversarial loop

For each subtune 0,1,2:

1. Execute original PSID INIT under the bounded NMOS 6502 harness.
2. Execute generated SID-reference INIT using identical caller A.
3. Compare original operand `$1129` to generated `SR_SETUP_INDEX` (expected 0/3/6).
4. Execute original and reference PLAY calls for three ticks, confirming original `$1129` goes to `$FF` and reference first-pending latch becomes false after one tick. Compare first/normal dispatch marker and tick counts.
5. Verify regenerated source code never modifies itself.

The unit tests pass all three subtunes. Six negative tests refuse tampered or unsupported semantic models. A browser test confirms the single-contract import, original AY backend, new SID backend, and rejection of a changed formula.

**Limit:** these checks only validate *specified control-state semantics*. The original PSID continues into its complete music engine, while the generated reference does not. SID register output, audio equivalence, timing precision, other song structures and long-run musical loops are not yet tested. No AI judge was called. Future differential oracles must use bounded, named observables rather than invented equivalence scores.

## Use

1. Open `PAY_Interpreter_Semantic_00_8F2.html`, load the original full trace or SID, run the `player_entry` semantic analysis, and export its single semantic contract.
2. Open `PAY_Compiler_Semantic_00_8F3.html` and import that contract into **Interpreter → Compiler**.
3. Compile the Apple II partial fixture and/or press **Compile SID reference .S**. Inspect and download the readable assembly (and executable semantic IR).

A known example contract is included in `examples/PAY/Bomberland_player_entry_contract_v0.8F3_Fixture.json` for repeatable local testing. It is an **unapproved research fixture**, not a substitute for analysis of a new PSID.

## Next stage

- **00.8G:** Complete source `player_entry` semantics including first-tick voice setup and establish a true SID-side reference `.sid` packaging workflow.
- **00.8H:** Add a differential comparator that reports first causally meaningful divergence and evidence-trace counterexamples for AI analysis. The Interpreter, not the Compiler, will own the adversarial feedback/AI explanation.
- **00.8I onward:** Compile verified note, duration, instrument, gating, local repeats and modulation into SID output first; subsequently use those same typed intents for AY lowering.

Keep generated artifacts in `.S` form and source-first; no opaque binary as the only deliverable.
