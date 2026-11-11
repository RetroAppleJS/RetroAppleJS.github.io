# PLAY-00.8J semantic contract extension

This is an **additive** extension to the existing `PAY_Semantic_Contract_v0.8F2` handoff. The compiler still requires the 00.8I verified `compilerModule`, `semanticExtension` and `pitchExtension` and deterministic validation of the exact original PSID identity.

## `musicExtension`

```json
{
  "format": "PLAY_First_Audible_v0.8J",
  "sourceSHA256": "65c3874b9f529c9adac45852f6e216eef2307a325051471d8b58290c38f71a68",
  "semanticStatus": "experimental_approximation_not_equivalent",
  "subtuneIndex": 0,
  "streamDefinition": "source_bytes_not_sid_writes",
  "streams": [
    { "voice": 0, "sourceStart": 6527, "sourceEndExclusive": 6587, "bytes": [4,73,3,117] },
    { "voice": 1, "sourceStart": 6587, "sourceEndExclusive": 6624, "bytes": [11,79,4,129] },
    { "voice": 2, "sourceStart": 6624, "sourceEndExclusive": 6718, "bytes": [5,79,137,120] }
  ],
  "tokenGrammar": { "instrument": [0,63], "effect": [64,95], "note": [96,188], "hold": 189, "specialMask": 190, "repeat": [192,255] },
  "synthesisPolicy": { "kind": "SID_AUDIBLE_DIAGNOSTIC_V1", "tickPeriodFrames": 5, "firstReadFrame": 5, "voices": 3, "sidWaveformGate": 65, "attackDecay": 0, "sustainRelease": 248, "pulseWidth": 2048, "volume": 15, "releaseAtSourceBoundary": true, "originalInstrumentSemanticsProven": false }
}
```

**Illustration only:** `streams[].bytes` above shows each stream's first four entries, not the complete arrays. The full contract is `examples/PAY/Bomberland_00_8J_Interpreter_Contract.json`. The source ranges are byte addresses in the original decompressed/loadable C64 executable, not observed SID outputs.

## Trust and compilation rules

1. Interpreter extracts source streams from the user-supplied original PSID or its embedded Complete Report bytes. It binds the SHA-256 and checks the exact original bytes.
2. Compiler validates the source SHA, all stream boundaries and bytes, the token grammar, pitch-table extension, and the exact experimental synthesis policy. It refuses mismatches. GPT does not supply arbitrary assembly or output register streams.
3. Compiler generates a 6502 token-reader/dispatcher using absolute state, original source pitch tables and a finite prefix of source score bytes. `PLAY` is invoked by the PSID player each frame. Subtune indices other than zero are deliberately not interpreted as though these streams belonged to them.
4. A complete source semantic reconstruction requires instrument/effect table interpretation, per-voice `$14D8/$14D9` timing, longer pattern pointers and true SID gate envelope rules; these remain unresolved.
5. The full source program's `$BD`, `$BE`, selector and local repeat effects may contribute to time/pitch/mask interactions. The new diagnostic is only an **audible hypothesis** for source token pitches and initial transaction structure.
6. A deterministic source-token oracle proves the first note group and exposes the earliest timer divergence. It does **not** prove audio equivalence or source loop coverage. The 00.8H differential implementation remains the source of truth for narrower accepted control semantics.

## Source evidence and initial tests

The source grammar comes from the prior 3,000-frame `$1385`→`$13F4` source command-decoder investigation: `PAY_008C/docs/BOMBERLAND_COMMAND_GRAMMAR_v082.md`. The 00.8J program references the original note-index translation `$1222–$122A`, pitch tables `$1515/$1575` and three source score stream starts verified in the complete report. It has no AY backend in this increment.

| Source note token | Index | Frequency word | Generated SID voice |
|---|---:|---:|---:|
| `$75` | 21 | `$03A9` | 1 |
| `$81` | 33 | `$0752` | 2 |
| `$78` | 24 | `$045A` | 3 |

At frame 5 the original command decoder observes these three note values and the regenerated program emits corresponding pitch/gate writes. At frame 10, the source does not write a new voice-3 note token but the generated fixed-period schedule does. Treat this as a counterexample; it is **not** resolved by changing sound envelopes or adjusting volume.

## Safe next-step experiment

Reconstruct the original source per-voice timer and selector logic around `$11C5`, `$11E4`, `$1222`, `$136A` and `$1375`. Compare source note-token writes and target state transitions for source frames 0–100. After timing is reliable, extend instrument/control tables at `$16A1`, `$16B2`, `$164C`, `$163B`, plus the pitch and ADSR update chain. Retain the rule that SID output streams are for validation only, never the semantic compilation input.
