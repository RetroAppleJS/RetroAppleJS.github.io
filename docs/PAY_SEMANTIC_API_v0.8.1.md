# PAY-00.8B — Interpreter ↔ Semantic Compiler API (v0.8.1)

**Status: implemented contract validator and Bomberland source-grammar probe.** This is **not** a fully decoded Bomberland grammar or a ready-to-assemble semantic player. The PAY-00.7.3 register-event player remains the audible reference only.

## Design principle

The interpreter identifies *why* a PSID produces output. The compiler implements that purpose using available AY/6502 mechanisms. Neither component should infer a musical note, pattern, instrument or loop solely from repeated SID register states. Source-code, runtime, data-dependency and state-transition evidence must justify each semantic declaration.

The interface separates these responsibilities:

1. **Interpreter** emits `PAY_Semantic_Program_v0.8.1`: source identity, substantiated mechanism graph, typed state, source tables, semantic intents, timing and decision predicates, unresolved gaps and acceptance probes.
2. **Intent registry** is a versioned **open vocabulary**, not a closed PSID-player-specific enumeration. An intent has a stable namespaced `intentId`, category, typed parameters, temporal semantics, and capability requirements. New PSIDs may add intents without changing the interpreter's transport format. Unrecognized intents are never silently ignored.
3. **Capability manifest** `PAY_Compiler_Capabilities_v0.8.1` is supplied by the native compiler; it advertises supported lowering operations, preconditions, timing budget and audible compromises. An interpreter must not claim an AY feature exists just because it would be useful.
4. **Compiler** checks model structure, evidence references, source identity, source tables, type requirements, capability support, human review and explicit gaps. It then lowers **semantic state machines** to inspectable `.S` and a source-to-target map. It does **not** directly compile `frameSnapshots` or raw SID/AY write streams into a score.
5. **Verification** compares inferred source decisions and state transitions with original-trace probes, plus AY audible result; equality of all SID-to-AY register writes is not expected.

## Files

- `schemas/PAY_Semantic_Program_v0.8.1.schema.json`: JSON Schema for the stable envelope and mechanism graph, with extensible namespaced intent IDs.
- `tools/PAY_Semantic_API_v081.js`: deterministic cross-reference/type/capability preflight. Exported `validate(program, capabilities, evidence)` returns `{valid, compilable, errors, warnings, blockers, requiredCapabilities}`.
- `examples/PAY/PAY_Intent_Registry_v081.json`: broad intent catalog, not a claim of implementation or exhaustive taxonomy.
- `examples/PAY/PAY_Compiler_Capabilities_v081.json`: actual capability advertisement. The old hardware timer and register writer exist, but semantic operations are marked `planned`; a register-stream exporter is not proof of an instrument or sequencer capability.
- `examples/PAY/Bomberland_Pointer_Decoder_Candidate_v081.json`: real source-addressed **partial** model. It validates, but cannot be compiled, because token grammar, branch side effects and loop conditions remain unresolved.
- `examples/PAY/Bomberland_pattern_grammar_observations_v081.json`: reproducible evidence from 3,000 PLAY calls, with per-voice indirect reads and pointer base candidates.
- `tools/pay_bomberland_grammar_probe.py`: regenerates the latter from the 60-second complete report.
- `tests/PAY/pay_semantic_api_v081.test.cjs`: negative/positive contract checks.

## Intent coverage and extensibility

Categories: `player`, `schedule`, `sequence`, `control`, `pitch`, `articulation`, `instrument`, `envelope`, `waveform`, `modulation`, `filter`, `volume`, `mix`, `hardware`, `source_state`, `unknown`.

Seventeen core intents already have **typed input signatures and semantic proof requirements**; the remaining catalog entries are explicitly marked as requiring a signature before compilation. This is an open, growing registry, not a claim to exhaustively understand all PSID player designs.

The registry includes examples of:

- Timing: INIT/PLAY, tick dividers, swing, variable clock, channel delays and source IRQ cadence.
- Sequencing/control: stream read, note/rest, pattern call/return, step repeat, conditional branch, per-channel loop, song loop, subtune selection, nested loops and table pointer redirection. **Loop semantics require source-state proof.**
- Pitch: note values, SID frequency-word conversion, portamento, vibrato, arpeggio, glissando, detune, transposition and fine pitch.
- Instruments: instrument choice, waveform switching, pulse-width modulation, noise/noise mixing, ADSR, retrigger, release, gate, sync/ring and oscillator TEST.
- Mixing/effects: per-voice gain, volume automation, SID filter cutoff/resonance/routing/mode, global volume, cross-voice dependencies.
- Implementation: addressable RAM state replacing self-modifying operands, register commit boundary, multi-SID/multi-AY routing, unsupported external hardware.

These are semantic **questions and intents**; a registry entry never asserts that a given PSID uses them. `extensionRegistry` can add new namespaced IDs. Unknown IDs are legal in the transport; the compiler must report a missing capability, not silently compile or omit them. Versioning of the intent vocabulary is separate from envelope schema versioning.

## Required data model

`source`: SHA-256 of full original PSID bytes, selected subtune, original INIT/PLAY/load addresses, optional clock assumptions and source capabilities.

`capture`: number of executed PLAY frames, explicit dropped-record counts and model limitations. Capture only tells us which branches were observed, not what every branch means.

`analysis`: `scope`, `uncoveredRegions` and source-loop confidence. **No source loop proven** is the default; a register-state cycle cannot override it.

`evidenceRefs`: stable IDs back to static bytes, executed instruction variants, effective reads, branches, writes, and trace/call paths. Prior GPT text is cited as background, never the sole proof.

`state`: typed, named persistent variables including initial value evidence, ownership/lifetime, source locations, and whether reconstructed from self-modifying instruction operands. PAY lowering must use absolute RAM and must not patch executable code.

`tables`: source byte addresses/lengths/encoding, proof of their usage, and optionally a decoded interpretation. Preserve the original raw bytes until a verified decoder exists.

`mechanisms`: each has `intent:{category,intentId,version,params}`, `proof:{level,review,evidenceIds}`, `behavior:{clock,transitions}`, `inputs`, `dependencies`, `lowering:{mode,capabilityId,parameters,constraints,knownLosses}`, `acceptance:{probes}`. Expressions are typed AST nodes (`const`, `state`, `input`, `table_lookup`, pure `op`)—not JavaScript source strings or GPT prose. Transition effects can assign state, emit a named intent, invoke named mechanisms, dispatch or read a typed source table. Conditions/ordering must be explicit.

`unknowns`: each has an ID, question, blocked mechanisms and **executable or instrumentable probe**. An unresolved token or pointer condition blocks semantic compilation of its dependent mechanism. Explicitly dropping optional filters is different: an `omit` lowering may be allowed only with a documented audible loss and acceptance criterion, after source semantics are established.

## Precision requirements for compiler

The interpreter must supply enough **operational** semantics to determine:

- **When** a transition executes (source clock, phase, tick divisor, ordering within PLAY, edge-vs-level semantics).
- **On which channel** and **under which predicate**, referring to typed states, source table indices and branch conditions.
- **What data** is read (byte length, signedness, pointer base, bounds, advance/jump/return rules and source table bytes).
- **What changes** (state assignments, note/gate/envelope/effect transitions), and whether source register writes are resulting outputs rather than root causes.
- **How to lower** it (exact AY capability ID, preconditions, parameter conversions, approximation/omission and cycle/RAM constraints).
- **How to prove** equivalence (trace probe for next-state/branch/note attacks, including a counterexample or unresolved alternative).

When any item is unknown, emit a blocker with a targeted trace request; do not guess a deterministic target operation.

## Gate to native assembly

The shape validator rejects bad evidence IDs, missing typed state references, missing tables and unsupported expression operators. For **compilation authorization**, additional non-JSON trust is required: an independently reviewed semantic model with a source-matched evidence bundle, reviewed table ranges and no blocking unknowns, a compatible capabilities manifest, complete reachability for the applicable subtune, and a documented memory/IRQ plan. Never accept GPT's self-declared `human_reviewed` as an actual review; the build pipeline must obtain a separate review approval.

The current validator's `compilable` result is a preflight only, not a cryptographic authorization. Do not run generated code from model output without review.

## Compatibility and evolution

- Versioned envelope changes: bump `PAY_Semantic_Program_vX.Y` for breaking changes, maintain a migration function and fixture tests.
- New intent: add an `intentId` to the registry; declare type, units/clock/edge semantics and capability; add at least one observed mechanism fixture and a negative test where it is unsupported.
- Existing intent revised: version its definition; do not silently redefine e.g. `pitch.slide` from SID frequency-word delta to AY-period delta.
- New compiler strategy: advertise capability with exact `supportedVersion`, `status`, `constraints`, `losses`, cycles and RAM; never change what the source's intent means.
- Unknown/unsupported intent: preserved in IR, explicitly blocked (or explicitly omitted if reviewed as optional with documented loss).
- Test new PSIDs against a corpus containing standard trackers, self-modifying drivers, data-driven players, IRQ/CIA, RSID, multi-SID, multi-subtune, filter-heavy, oscillator-sync and unusual command grammars. Coverage emerges from a cross-driver **conformance suite**, not from assuming the first driver's tokens generalise.

## Bomberland first grammar slice

The 60-second trace confirms indirect `LDA ($FD),Y` data consumption at source PCs `$1205`, `$1385`, `$13A7`, `$13EC`, with X contexts `0`, `7`, `14`. A derived `effectiveAddress - Y` suggests source pointer bases that change over time. This does not by itself prove which byte is a command, note, duration, instrument or loop.

A targeted 3,000-frame source probe **now captures** the last writes to `$FD/$FE` and 22 subsequent instruction steps for 420 selected fetches. It verifies `$11FB/$1200` as pointer writers for `$1205` and `$137B/$1380` as writers for the other three sites, plus the `$1385` `$40` decision threshold. The next task is to distinguish which observed branches produce notes, durations, instruments and loop decisions, and to verify source-state effects on held-out frames. Produce a trace keyed by `(frame, X, PC, pointerBase, Y, byte, nextDispatch, stateDelta)`. Those tuples can support a conditional token grammar and exact sequencer state machine; raw frequency counts cannot.

**Do not produce a semantic Bomberland `.S` until this dependency is resolved.**
