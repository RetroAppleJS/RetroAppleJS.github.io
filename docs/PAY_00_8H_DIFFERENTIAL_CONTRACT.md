# PAY-00.8H deterministic differential and adversarial counterexample contract

The differential engine is a library embedded **inside PAY/PLAY Interpreter**, not a third application. The SID compiler stays deterministic. AI may later review a counterexample but is never invoked from the compiler or baseline comparison.

## Inputs

```text
original PSID bytes or Complete Report with embedded originalSID base64
original SHA-256 from local bytes
PAY_Semantic_Contract_v0.8F2 (with PAY_First_Play_Executable_Extension_v0.8G)
regenerated PSID bytes from deterministic compiler
assembler symbol table recomputed from compiler .S
bounded source PSID CPU interpreter
frames (1–64), subtune A (0–2)
```

The pipeline refuses a source SHA mismatch, a modified contract rejected by the Compiler, or a generated SID byte mismatch. All target addresses come from compiler-reassembled symbols, not free-form GPT text or numeric guesses. Both programs execute independently, not replaying a SID write stream.

## Output: `PAY_Differential_Report_v0.8H`

Each `checks[]` record contains:

```json
{
  "subtune": 2,
  "subtuneA": 1,
  "checkpoint": "FIRST_PLAY",
  "frame": 0,
  "kind": "voiceDefault",
  "observable": "voice[1].field[2]",
  "expected": 5,
  "actual": 6,
  "sourceAddress": "$14DF",
  "targetSymbol": "SR_V1_2",
  "targetAddress": "$114E",
  "evidenceIds": ["static:$114E", "code:$114E"],
  "pass": false
}
```

**Illustration only.** The source/target values above come from a deliberately mutated reference state in the automated negative test, not a discrepancy observed in an unmodified PAY-00.8G compiler output.

The machine-generated `firstDivergence` is the first failing *comparable* checkpoint in stable order: subtunes ascending, INIT then PLAY frames, and observables within each frame. It cannot identify the first divergent 6502 instruction without a separate instruction-by-instruction causal trace. The engine does retain the source address, target symbol/address, and relevant evidence IDs needed for a follow-on forensic trace.

`summary.status` has two values:

- `PASS_PARTIAL_SCOPE`: all implemented observable checks passed. Not proof of source music equality.
- `FIRST_DIVERGENCE`: at least one covered observable differs. `counterexample` is populated.

Invalid input/contract/binary causes an explicit **BLOCKED** error rather than a false mismatch.

`perSubtune` also reports total source SID writes and the number *not compared*; only the verified first-PLAY `$D415` value (plus exactly-one generated event count) is within the SID-register-write scope. No pitch/gate/ADSR or complete SID stream equivalence is claimed.

## Output: `PAY_Differential_Counterexample_v0.8H`

Includes `subtune`, `frame`, `checkpoint`, `observable`, `expectedSourceValue`, `actualCompiledValue`, `sourceAddress`, `targetSymbol`, `targetAddress`, optional `sourcePC`, source SHA-256, selected relevant `evidence` records, a bounded reproduction plan, and an `adversarialPrompt`.

It **does not** include a model's guessed correction or a payload of fabricated SID writes. Its prompt asks for a minimal falsifiable explanation or corrected operation and explicitly warns that the CPU model, source interpretation and compiler can all be wrong.

## Compared 00.8G state mappings

| Original source | Generated reference | Comparison checkpoint |
|---|---|---|
| `$1129` after INIT | `SR_SETUP_INDEX` | `INIT` for subtunes A=0,1,2 |
| `$1129` sign after INIT | `SR_FIRST_PENDING` | `INIT` |
| Flow `$112A->$112C` / `$112A->$1161` | `SR_PATH`, `SR_FIRST_COUNT`, `SR_REGULAR_LO/HI` | Every completed PLAY tick |
| `$1129` restored to `$FF` | `SR_FIRST_PENDING=0` | After every completed PLAY tick |
| `$14AC..$14D5` (42 bytes) | `SR_CLEAR_AREA` | **First PLAY only** |
| `$14D6 + v*7 + {0,2,3,5}` | `SR_V{v}_{ORD,2,3,5}` | **First PLAY only** |
| Source operand state `$11B0`, `$1162` | `SR_DYNAMIC_11B0`, `SR_DYNAMIC_1162` | **First PLAY only** |
| First `$D415` write | Generated `$D415` write | **First PLAY only** |

The C64 original continues running note/effect/music logic after the first-PLAY setup, but the generated 00.8G program does not. State fields are therefore deliberately **not** compared over later frames except for the proven top-level first/steady dispatch. This is necessary to avoid falsely marking unimplemented musical logic as incorrect.

## Future extension

New semantics can extend the source–target observable map with specific source PC/operand/state evidence and timing policy, e.g. source note token → pitch index, source envelope intent → SID voice register writes, duration counters, and local repeat termination. A separate typed capability version must gate any additions. No fallback to sampled per-frame SID recording is permitted.
