# PAY-00.8D — Bomberland `player_entry` semantic candidate audit

## Verdict

The original GPT candidate cites real instructions and passes the basic workbench shape checks, but it misses an entire semantic mechanism. `$10F6` is **the immediate operand** of `ADC` at `$10F5`, and `$1129` is **the immediate operand** of `LDY` at `$1128`. Two stores at `$10F7` and `$113E` convert INIT A into a one-time PLAY dispatch and then disable the one-time path. The original candidate's `mem_$10F6` state variable and `DISPATCH_STATE` model should be replaced, not patched with more text.

## Exact source instructions (verified against the 4050-byte PSID executable)

```asm
$1000  JMP $10F1        ; PSID INIT
$1003  JMP $1126        ; PSID PLAY
$10F1  STA $10F6        ; rewrite byte $10F6 (immediate operand of ADC)
$10F4  ASL A            ; A*=2, carry for high A values
$10F5  ADC #$00         ; operand at $10F6 has been replaced with original INIT A
$10F7  STA $1129        ; rewrite byte $1129 (immediate operand of LDY)
$10FA  RTS
$1126  LDX #$00
$1128  LDY #$FF         ; first call reads patched 00; thereafter FF
$112A  BMI $1161        ; initialization path on first call; regular path afterwards
$112C  TXA              ; starts one-time initialization (first-call fall-through)
$112D  LDX #$29
$112F  STA $14AC,X      ; clears 42 bytes in the first-tick setup
$1132  DEX
$1133  BPL $112F
...
$113E  STX $1129        ; X=$FF after the clear loop; restore LDY operand
$1141  TAX
$1142  JSR $114C        ; first voice
$1145  LDX #$07         ; next source voice offset
$1147  JSR $114C
$114A  LDX #$0E        ; third voice source offset
$114C  TYA              ; shared initialization routine
```

For A=0..2, and with zero carry on `ASL` (true for these A values), `2*A + A = 3*A`. The selected-subtune initialization index is 0,3,6, respectively. The first trace has only A=0; no claims of dynamic subtune-2/3 coverage are made.

## Actual trace evidence from 300 frames

- Executed `STA $10F6` once on INIT, even though the written 0 equals the original immediate operand 0. An on-change-only patch log does not report it.
- Executed `STA $1129` once during INIT, changing the LDY operand $FF -> $00.
- Executed the first PLAY `LDY` as `[A0 00]` once and BMI fall-through to `$112C` once.
- Executed `$113E: STX $1129` once, changing operand $00 -> $FF.
- Executed `[A0 FF]` 299 times, with BMI to `$1161` on each subsequent PLAY.

## Correction to interpreter/compiler boundary

1. **Source facts:** two operand-writes, `LDY` runtime variants, two BMI edges, one patch restoration.
2. **Semantic reconstruction:** INIT encodes a per-subtune setup index and marks one-time initialization pending; first PLAY executes the setup and clears the latch; later PLAY calls take the steady-state route.
3. **PAY lowering:** own absolute-RAM `selected_subtune_setup_index` and `first_play_pending` variables; no writable code bytes, no zero-page allocations, no AY notes implied by this mechanism.
4. **Source gaps:** A=1/2 execution, chosen initialization tables, exact channel and instrument semantics and clock ownership; these belong in separate source-verified mechanisms.

## Reason GPT missed it

The original `player_entry` bundle listed only `$1000,$1003,$10F1,$1126` as mechanism PCs and lacked the `$10F5`, `$10F7`, `$1128`, `$112A`, `$113E` instruction/patch/edge evidence in its context. The model correctly described what was present but could not infer the full dependency chain confidently from the truncated prompt. This requires **interpreter-side dependency closure**, not merely more GPT tokens.

## Workbench changes

`PAY_Semantic_Workbench_v081.html` asks GPT to investigate stores to instruction operands (including unchanged values). When the evidence bundle supplies `semanticObligations`, it also requires each reference to be cited in a candidate claim. This still checks evidence *coverage*, not the truth of a prose interpretation, so independent semantic review remains mandatory.

## Reproduction

```sh
python tools/pay_player_entry_evidence.py --report /path/to/Bomberland_preview.pay-complete-report.json --evidence /path/to/Bomberland_PAY08_semantic_evidence.json
python tools/make_corrected_candidate.py
node tests/PAY/player_entry_closure.test.cjs
```

Note: The scripts default to local paths from the evaluation container; pass explicit paths when using a normal repository layout. Updating the parameter defaults to repository-local locations is recommended before integrating into CI.
