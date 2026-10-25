# Phase 1.5A.2 — Mockingboard register-history acceptance

## Purpose and provenance

This acceptance step compares **actual** Mockingboard AY register history emitted by RetroAppleJS against the original `AY_SCORE_TIMING_BENCH.S` v0.1 program. The reference register sequence was derived by executing its 548-byte assembled image in a 6502 instruction-level model. The reference is a prediction until the emulator's JSON event history is collected.

This project does **not** change the Mockingboard implementation, assembly binary, or BASIC loader. It is a **read-only, browser-only JSON validator**, so it doesn't require Node or Python to use.

## Open the verifier

Unzip the archive and double-click:

`tools/AY_SCORE_HISTORY_VERIFY_standalone.html`

It contains all JavaScript and reference data inline and runs offline. The adjacent non-standalone HTML and core JS files are supplied for source review. Run **10 browser self-checks** first. Those tests use simulated histories and do not establish acceptance of the emulator.

## Capture a combined history (preferred)

1. Ensure Mockingboard in **slot 4**, no other Mockingboard music program active.
2. Load the original `build/AY_SCORE_TIMING_BENCH_LOADER.bas`, then stop before typing `RUN`.
3. Open Mockingboard **peripheral controls**. Ensure **64 KB** of history capacity (sufficient for 169 events and timing metadata).
4. Click the **coffee-cup capture** button so it indicates capture is active.
5. Type `RUN`. It loads the 548-byte program to `$6000`, checks the byte checksum, and runs MB-01, MB-02 and MB-03.
6. After BASIC has completed and printed the three timing rows, click the **same coffee-cup button** to stop capture. **Do not reset** the emulator/card before exporting.
7. The history JSON export function is available in the card driver, although its normal UI download button is currently commented out. In the RetroAppleJS browser's JavaScript console, run this snippet after opening the Mockingboard controls:

```javascript
const b = [...document.querySelectorAll('button[title="Start/stop Mockingboard history capture"]')]
  .find(x => x.getClientRects().length);
if (!b) throw Error('Open the Mockingboard controls first');
const match = b.getAttribute('onclick').match(/HASH2obj\((\d+)\)/);
if (!match) throw Error('Mockingboard card was not found');
apple2plus.hwObj().io.HASH2obj(Number(match[1])).downloadHistory();
```

This calls the **existing** `downloadHistory()` method, not a custom emulator API. A file named `mockingboard-slot4-history.json` should download. Keep the unmodified export for reproducibility.

If you prefer isolated experiments, capture one `CALL 24576` (MB-01), then download and save as `MB01-history.json`. Repeat with fresh capture sessions for `CALL 24579` and `CALL 24582`. Capture **before** the corresponding call so setup writes are included. Do not rely on the final `$6F00` record for differentiating runs: it holds only the *last* test's results.

## Verify

1. Open `tools/AY_SCORE_HISTORY_VERIFY_standalone.html` locally in Chrome or Safari.
2. Drag the combined JSON file (or all three individual files) into the upload area.
3. Check `PASS` for each detected test. Default tolerance is **±2 CPU cycles** relative to the first AY0 R7=$3F event of each run.
4. If there are discrepancies, inspect the expandable diagnostics for the first wrong register/value or timestamp. Do not loosen tolerance to hide a systematic error; investigate it first.
5. Optionally save `AY_SCORE_TIMING_HISTORY_VALIDATION.json` and upload it together with the raw Mockingboard history for analysis.

### Predicted event counts

The numeric `WRITES 64/64/32` printed by BASIC means measured *body* R8 updates. The history recorder includes initialization and cleanup events; it does not store register-address selection or VIA control toggles as AY register writes.

| Case | One R7=$3F | Initial R8=$00 | Body R8 updates | Final R8=$00 | Total observed AY writes |
| --- | ---: | ---: | ---: | ---: | ---: |
| MB-01 | 1 | 1 | 64 | 1 | **67** |
| MB-02 | 1 | 1 | 64 | 1 | **67** |
| MB-03 | 1 | 1 | 32 | 1 | **35** |
| **Combined** | **3** | **3** | **160** | **3** | **169** |

All these writes target **AY0** (first sound chip in the Mockingboard card). MB-01/02/03 each start with R7=$3F and R8=$00; body values alternate `$0F,$00,$0F,$00,...`; the final mute is R8=$00. **No AY reset** should occur within a benchmark group.

A reset or other incidental activity *before* the first test marker may appear if the VIA started with its reset line asserted; the verifier separately warns about preamble records. Other activity **inside** a benchmark group is treated as a mismatch. A `wrapped:true` export is rejected.

### Predicted relative timestamps

The verifier compares **cycle differences**, not global timestamps, since absolute CPU ticks depend on when you started capturing and BASIC overhead between calls.

| Case | Body interval, from one R8 update to next | First body R8 minus R7 setup | Last body R8 to final mute |
| --- | --- | ---: | ---: |
| MB-01 | 47 cycles for all 63 intervals | 228 cycles | 142 cycles |
| MB-02 | 29 cycles for all 63 intervals | 240 cycles | 142 cycles |
| MB-03 | 53 cycles for first 22 intervals, 57 cycles for last 9 | 263 cycles | 136 cycles |

The 57-cycle intervals in MB-03 arise from absolute,Y indexed reads crossing a memory page within the included fixture. The E1 varuint delta **is parsed without waiting**: it is incorrect to expect 200-cycle spacing between MB-03 R8 writes.

The instruction-level model records the beginning of the `STA` that activates the AY WRITE bus. The emulator can timestamp at a different point inside an instruction; therefore comparison uses relative spacing with a small default tolerance. If a consistent discrepancy remains, capture the raw JSON and examine the card's cycle-stamping policy before changing the predictions.

## Scope and acceptance

- **Already observed in RetroAppleJS:** Corrected Timer 1 cycles 3011/1859/1728 and `ERR0` for MB-01/02/03, according to the previous BASIC console output.
- **Still to verify:** That the **card's history telemetry** records the expected AY register write counts, order, values, and relative cycle spacing.
- **Not part of this test:** Disk streaming, graphics coexistence, actual audio perception, a full E1 player, Timer 1 interrupt playback, or physical Mockingboard measurements.

A PASS from the verifier means the captured **emulator** register history aligns with the instruction model at the selected tolerance. It does not independently certify real physical Mockingboard hardware.

## Source mapping

The history format and export method come from `res/EMU_CARD_mockingboard.js` in RetroAppleJS. Its JSON has:

```json
{
  "format": "RetroAppleJS.MockingboardHistory",
  "version": 1,
  "baseTick": 123456,
  "events": [[100, 0, 7, 63], [48, 0, 8, 0]],
  "wrapped": false
}
```

Each event is `[deltaCycles, ayIndex, register, value]`. AY index 0 is the first chip; register `-1` denotes a reset. Absolute ticks are recovered as `baseTick + cumulative deltaCycles`. The concrete numbers above are illustrative, not from your captured session.

## v0.1.1: interpreting legacy slot metadata

This verifier now recognizes `slot:5` from the older Mockingboard history
export as physical slot 4. In `EMU_apple2io.js`, `SLOT2obj(slotN)`
uses an internal index `slotN = physical slot + 1`, whereas
`EMU_CARD_mockingboard.js` returned that index directly as the exported
slot. See the non-applied patch in `patches/`. The report preserves both
`source.slot` (original tagged value) and `source.physicalSlot` (interpreted).
A pass for slot 5 emits a warning documenting that conversion.

The original capture of 169 writes passed with zero timestamp errors when
interpreted as physical slot 4. The history file itself is unchanged.
