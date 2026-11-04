# PLAY-00.8I typed pitch lookup operation

Canonical contract root: `PAY_Semantic_Contract_v0.8F2` (retained for backward compatibility), plus extensions:

- `semanticExtension`: `PAY_First_Play_Executable_Extension_v0.8G`.
- `pitchExtension`: `PAY_SID_Pitch_Word_v0.8I`.

The second extension is deterministically constructed from the embedded *original* Bomberland PSID and the independently indexed, executed source addresses `$1228`, `$122A`, `$13CB`, `$130F`, `$1312`, `$1318`, `$131B`, `$131E`, `$1321`. It contains exact source-side low/high frequency data, token bounds, and an explicit `callable_diagnostic_only` scope. Neither the inference model nor the compiler may invent tables.

Semantics: for a source token `t` in `$60..$BC`, `index=t-$60`, `SID_frequency_word=source[$1515+index] | (source[$1575+index] << 8)`. The operation is defined only for these 93 isolated pitch-index lookup inputs. The source's full pitch pipeline can include additional pitch arithmetic, transposition, and effects before the table lookup. The direct token-to-frequency operation is therefore **a test-only composition of verified primitives**, not proof of the source's complete per-note behaviour.

Compilation is synchronous, deterministic, requires no key, does not reserve zero-page and does not self-modify generated machine code. It emits literal original **data tables**, not a frozen SID register-update stream. The compiled test entry point `SID_REF_PITCH_FROM_TOKEN` writes the index and frequency word into the generated program's own RAM. It does not write `$D400..$D418` or run as part of `SID_REF_PLAY`.

The independent comparator invokes the compiled routine on 93 valid tokens and 2 invalid boundary tokens and compares the resulting low/high bytes against the loaded *original source PSID's table memory*. The base 00.8H comparator checks three subtunes of initialisation and the first/steady branch. A combined result of 311/311 does **not** establish musical output equivalence.

If a pitch check disagrees, the counterexample includes the input token, index, source table addresses, expected and actual words, source evidence IDs, and a constrained adversarial review prompt. GPT can investigate the discrepancy, but the Compiler never invokes AI for missing semantics.
