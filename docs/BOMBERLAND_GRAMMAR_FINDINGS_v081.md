# Bomberland command-grammar investigation — first source-level results

**Scope:** Original 2012 PSID, subtune 1, 3,000 PLAY invocations (60 seconds at assumed 50Hz). The original SID source is *not* a 19KB register score. This document reports machine-code facts, not an invented original tracker format.

## Verified pointer provenance

The source-control probe (`tools/pay_source_control_probe.cjs`) records real execution of `PAYCPU`, last writes to the source zero-page `$FD/$FE`, exact original memory read bytes and the subsequent 22 executed instructions. These are **original C64 driver** zero-page cells; generated Apple II PAY code must remain zero-page-independent.

| Indirect fetch PC | Observed `$FD` writer PC | `$FE` writer PC | Captured fetch records | Pointer+Y == read address |
|---|---|---|---:|---|
| `$1205` | `$11FB` | `$1200` | 23 | 23/23 |
| `$1385` | `$137B` | `$1380` | 168 | 168/168 |
| `$13A7` | `$137B` | `$1380` | 56 | 56/56 |
| `$13EC` | `$137B` | `$1380` | 173 | 173/173 |
| **Total** | | | **420** | **420/420** |

The probe had a capacity of 420 records and dropped **497 additional novel sampled contexts**; these 420 are informative but not exhaustive. The 60-second base interpreter trace itself retained all raw effective reads. Full raw read counts at the four sites are 63, 1,525, 331 and 1,485 respectively.

## Verified decision threshold at `$1385`

The sampled instruction path is:

```asm
; Source C64 driver, $1385. NOT target Apple II code.
$1385  LDA ($FD),Y    ; fetch source byte
$1387  CMP #$40
$1389  BCC $13A3      ; read value < $40
       ; next PC $138B when value >= $40
```

The 168 sampled records entering `$1385` separated as follows: **33** observed bytes below `$40` all branched to `$13A3`; **135** bytes at least `$40` all continued to `$138B`. This identifies an actual decoder discriminator, **not yet** the musical meaning of either branch.

The `$13A7` path includes additional comparison/branch structure around `$13A9–$13AF`; operand sizes and state transitions require further analysis before assigning names such as `NOTE`, `INSTRUMENT` or `LOOP`.

## Tentative grammar model — deliberately incomplete

```text
Source voice context X = 0, 7 or 14
  Pointer preparation at $137B/$1380 -> ($FD,$FE)
  Fetch byte at $1385
  if byte < $40:
      execute branch starting $13A3
      (unknown semantic class; additional read at $13A7 often follows)
  else:
      execute branch starting $138B
      (unknown semantic class)
  More source decoding and final SID commit occur later
```

`$1205` also has a separate pointer source `$11FB/$1200`, consistent with a distinct stream/table level; the relationship between those streams remains to be demonstrated. **Do not invent a pattern nesting model from this alone.**

## Required next experiment

1. For both `$1385` branch families, capture *exact* source state before the fetch and after its command path returns. Focus `$14AC–$1506`, `$11AB/$1162/$1166`, patched dispatch at `$1280/$1289/$1305`, and the original stream pointer/index.
2. Capture every subsequent indirect read and command dispatch **in time order** until the next voice tick, not just a fixed 22-instruction window. Infer exact operand byte counts and persistent state updates.
3. Build a **token-value → dispatch → source-state delta** truth table with observed negatives and collisions. A token class requires consistent action over multiple executions, not one example.
4. Check the hypothesized grammar against frames **not used for induction** and other subtunes. If exceptions occur, refine it and preserve evidence IDs.
5. Only after grammar verification, emit typed intents (`sequence.note`, `sequence.token_fetch`, `control.pattern_loop`, `instrument.select`, `pitch.slide`) with exact state transitions and required compiler capabilities. Then generate inspectable `.S` without converting AY register history into song data.

The PAY-00.8B seed intentionally has `behavior.transitions=[]`, one unresolved grammar blocker and a missing semantic compiler capability. Its validation result is `valid: true`, `compilable: false`.
