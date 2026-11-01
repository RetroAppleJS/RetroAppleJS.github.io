# PAY Interpreter v0.4 — runtime-assisted PSID semantic analysis

Standalone application: `tools/PAY_Interpreter.html` (open in a modern browser).
Documentation: `docs/SID_INTERPRETER.md` (included in the HTML as a fallback; external URL may be refreshed).

## Quick start

1. Open the HTML in a modern browser and import a `.sid` file.
2. Review the static disassembly, warnings, and source metadata.
3. Select a subtune and a bounded number of PLAY frames (default 300; maximum 1200). Click **Run 6502 trace**.
4. Examine the **Runtime findings** panel: modified executable bytes, instruction variants, runtime-only code paths, SID register writes, and provisional frame-boundary musical events.
5. Export **runtime trace .json**, **trace summary .txt**, or the merged **annotated .asm** listing.
6. Optionally click **Analyze with GPT**, enter an API key in the masked prompt, and review the semantic interpretation. The submitted context includes the actual guide text, enriched listing, self-modification evidence, and bounded runtime evidence. The API key is never included in analysis export.

## Runtime model

- Lightweight in-page interpreter for the **151 official NMOS 6502 instructions**.
- Memory is initialized from the PSID's load address. INIT is invoked with the selected subtune index; PLAY is invoked once per requested frame. Data RAM and self-modified instructions persist across frames.
- Writes to executable memory are logged with the instruction PC, target byte, first frame, before/after values, and count. Code modified before it is first executed is also observed; executed variants and previously undiscovered PCs are surfaced.
- SID register writes are captured using **effective addresses**, including indexed and indirect modes. Per-frame SID register snapshots (three voices per SID) include frequency word, control, gate, ADSR, pulse width, derived frequency in Hz, and an approximate AY tone period.
- A provisional musical-event sequence detects frame-boundary gate-on/off, frequency and waveform/control changes. It is **not** an authoritatively decoded score.
- Execution is bounded by per-call instruction limits, a 1200-frame limit, an event cap, and variant/memory-write caps. Partial results and explicit error messages are retained if execution stops early.

## Known limitations

This is **not** a complete C64 emulator: VIC, CIA timers, KERNAL/ROM, SID analog oscillator/envelope/filter behavior, SID readbacks, undocumented opcodes, and real interrupt dispatch are not faithfully modelled. PLAY-frame timing and event order are meaningful under this model; reported `cycleApprox` is an **approximate instruction-cost counter**, not cycle-exact SID timing. More hardware-dependent PSIDs/RSIDs may fail, produce different flow, or have incomplete musical results. `PLAY=0` is only partially supported through a heuristic `$0314/$0315` vector. Trace coverage is path- and subtune-dependent. Do not treat a single trace as proof of complete loops or interactive branches.

The tool produces analysis, **not a runnable PAY executable**. AY pitch periods are an initial frequency mapping only and do not automatically emulate SID modulation, waveforms, ADSR, or filters. PAY-Light code generation remains a future phase.

## Synthetic self-modifying test

`tests/fixtures/PAY_00_4_test.sid` is an original 6502/PSID fixture, not a copyrighted tune. Set PLAY frames to 5. Expected results:

- 5 completed frames and 5 SID writes.
- A patch from `$1015` to operand byte `$1021`, alternating between `$30` and `$40`.
- An originally unvisited routine at `$1040` discovered dynamically.
- Two executed variants for `JSR` at `$1020`: `20 40 10` and `20 30 10`.

v0.4 was additionally exercised against all 2,997 bytes of a Partyland PSID payload reconstructed from the user-provided v0.3 disassembly. 120 frames ran without an execution error, identifying 330 executed PC addresses, 6 runtime-only entry points, 295 writes to code, and 1,833 effective SID register writes. That reconstruction is a test input, not an independent source of truth about the original file.

## API and privacy

The static disassembler and runtime tracer are entirely local. The only intentional network operations are the documentation fetch and the OpenAI Responses API requests initiated by the user. API use can incur costs. On a shared machine or published website, sending a key directly from browser JavaScript is unsuitable; use a backend proxy in production. The key is prompted at use time and not stored in localStorage/cookies/exported reports.
