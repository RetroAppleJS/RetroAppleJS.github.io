# MB-06A.1 — Extend the native E1 score clock and decoder

**Status:** v0.1.0 executable candidate; 6502/VIA local regressions **PASS**; actual RetroAppleJS/Safari acceptance **pending**.

**Project:** RetroAppleJS · Apple II/II+ NMOS 6502 · Mockingboard at **physical PR#4** (internal `SLOT2obj(5)`).  
**Base:** Accepted MB-05.1 (`asm/AUDIO/AY_SCORE_TIMING_MB05.S`). MB-05.1 source and the Mockingboard card implementation are **not changed**.

## Purpose

MB-06A.1 isolates two structural changes required before supporting full AY0 music events:

1. Extend MB-05.1's 8-bit `(elapsedCycles/256)` score clock to **16 bits**, using an epoch for every observed 65,536-cycle Timer 2 wrap.
2. Extend the E1 byte-offset pointer to **16 bits**, using a self-modifying `LDA E1_BYTES,Y` base and incrementing its high address when `Y` wraps. Decode a bounded unsigned LEB128 delta that can occupy up to four bytes, while keeping the current **1,024-cycle event grid** and **AY0 R8/R9 register restriction**.

The first 64 events (232 bytes) are **byte-for-byte identical** to the accepted MB-05 fixture. This allows a direct regression. A fourth mode plays an extended 128-event score containing the same original 64 events twice; the second run starts after a ULEB128-encoded **65,536-cycle** gap (`80 80 04`). This forces two Timer 2 counter wraps and advances the E1 decoder beyond byte 255.

This stage **does not** support all AY sound registers, tone periods, two AY chips, arbitrary sub-1,024-cycle event times, external streamed `.aysb`, or an arbitrary duration audio engine. Those remain in MB-06A.2 onward.

## Test entrypoints

| Applesoft call | Mode | E1 events | Timer 1 IRQs expected | AY score events emitted | Foreground |
|---|---|---:|---:|---:|---|
| `CALL 24576` | A+B+C+D | 64/64/64/128 | 48/48/48/159 | 0/64/64/128 | HGR/HGR/NOP/HGR |
| `CALL 24579` | A: dry, short | 64 | 48 | 0 | HGR |
| `CALL 24582` | B: AY, short | 64 | 48 | 64 | HGR |
| `CALL 24585` | C: AY, short | 64 | 48 | 64 | NOP |
| `CALL 24588` | Emergency stop | — | — | — | Best-effort IRQ-vector cleanup |
| `CALL 24591` | D: AY, long-wrap | 128 | 159 | 128 | HGR |

**Register history:** Each mode performs two setup writes (AY0 R7 and R8) and two cleanup writes (R8 and R9). The four-mode history should contain **4 + 68 + 68 + 132 = 272 AY register writes**, plus optional unrelated initial reset records if history capture began earlier. The per-mode score timeline contains 40/40/40/80 distinct event deadlines (A's deadlines are not written to AY).

**Format:** E1 payload is `ULEB128(deltaCpuCycles), packedAyRegisterId, value`. Only AY0 IDs `$08`/`$09`, values `$00..$0F`, nonnegative deltas divisible by 1,024 cycles, and non-overflowing absolute deadlines are accepted. Fast branches decode the existing `$00`, `$80 $08` (1,024) and `$80 $10` (2,048) deltas; the general path handles up to four LEB bytes, including `$80 $80 $04` (65,536). A 4-byte delta of 2,097,152 cycles and an upper in-range 4-byte delta of 16,776,192 cycles are separately tested by executing the native decoder. The format's *canonical* `.aysb` 36-byte header is not parsed in this phase: the trusted benchmark score is embedded in the machine-code image.

### Score-clock guarantee and limitation

Timer 2 is initialized to `$FFFF` and continues decrementing modulo 65,536 in RetroAppleJS's present VIA model. At each serviced Timer 1 IRQ, the **coherent** Timer 2 high-byte snapshot is complemented to get the low eight bits of elapsed 256-cycle units. A software high byte is incremented when that low byte decreases relative to the previous observation. Thus the score clock spans `65536 × 256 = 16,777,216` CPU cycles, approximately **16.42 seconds at 1,021,800 Hz**.

**Bounded-gap precondition:** Each successful observation must occur in less than 65,536 CPU cycles, so at most one Timer 2 epoch may be crossed between samples. If interrupts are masked that long, multiple missed wraps cannot be detected and the clock is not valid. This is an intentionally bounded test technique, **not a general long-running clock**. Also, this depends on RetroAppleJS's Timer 2 behavior and is **not yet validated on physical 6522 chips**.

The score clock advances from independent Timer 2 values, **not IRQ count**. The deadline comparator now uses the whole 16-bit extended time. The E1 read pointer advances across page boundaries without using Monitor/Applesoft zero-page pointers, and the E1 test image is strictly checked against the original 232-byte fixture at build time. At runtime, a final score-length check rejects mismatched byte consumption. It **does not** perform defensive input-length checks on every individual byte fetch; this benchmark must only execute its bundled build-time-validated E1 data and is *not* an external-file decoder yet.

### Memory map

| CPU address | Contents |
|---|---|
| `$6000–$67E5` | 2,022-byte machine-code image **including both E1 runs** |
| `$660F–$66F6` | Original 232-byte MB-05 short score, unchanged |
| `$66F7–$67E5` | 233-byte second E1 score pass, starts with 65,536-cycle delta |
| `$2000–$3FFF` | Foreground HGR page 1, overwritten in modes A/B/D |
| `$6800,$6880,$6900` | Modes A/B/C IRQ entry low-byte sample arrays |
| `$6A00,$6A80,$6B00` | Modes A/B/C IRQ exit low-byte sample arrays |
| `$6C00,$6C80,$6D00` | Modes A/B/C IRQ entry high-byte sample arrays |
| `$6D80,$6E00,$6E80` | Modes A/B/C IRQ exit high-byte sample arrays |
| `$7000,$7040,$7080` | Modes A/B/C decoder-span samples |
| `$7200,$7300,$7400,$7500` | Mode D IRQ entry low/high and exit low/high arrays, 159 samples each |
| `$7600` | Mode D decoder-span samples, 127 entries |
| `$6F00–$6F2B` | Shared working state: extended time, pointers, Timer 2 scratch, IRQ state |
| `$6F40,$6F58,$6F70,$6F88` | 24-byte result records for A/B/C/D |
| `$03FE/$03FF` | Monitor IRQ soft-vector; saved and restored |
| `$0045` | Monitor interrupted-A scratch; saved and restored at exit |

Results are 24-byte records. Byte offsets: `0=$A5`, `1=mode`, `2=IRQ count low`, `3=event count low`, `4–5=HGR write count`, `6–7=Timer 2 elapsed cycles modulo 65,536`, `8=whole-256-cycle late event count`, `9=max late /256 units`, `10=stream offset low`, `11=error code`, `12=coherent snapshot retry count`, `13=stream offset high`, `14=extended score time low`, `15=Timer 2 epoch/high score time`, `16=event count high`, `17=IRQ count high`. Remaining record bytes are reserved. For the long mode, printed `EXT T2 CYCLES` is the 16-bit elapsed counter plus `65,536 × epoch` and therefore includes the extra elapsed time after the last IRQ.

**Important:** The assembly image ends below `$6800`. The compact BASIC loader uses hexadecimal `DATA` strings and is statically checked so it remains below HGR RAM even with conservative program-size overhead. Do not paste the old MB-05/MB-05.1 loader or reuse its `N` and checksum.

## Test using Safari and RetroAppleJS

1. Start a **disposable** Apple II/II+ session with the Mockingboard in physical slot 4 (PR#4). Do not run DOS IRQ drivers or other music players concurrently. This test reprograms VIA1 timers and AY ports and does not restore all timer/port latch states.
2. In Applesoft enter `NEW` and paste `build/AY_SCORE_TIMING_MB06A1_LOADER.bas` in full.
3. Start Mockingboard **history capture** from its peripheral toolbox, then enter `RUN`.
4. Expect:

   ```text
   LOADING MB-06A.1 AT $6000...
   LOADED 2022 BYTES. CHECKSUM OK
   E1 CLOCK/POINTER EXTENSION: FOUR MODES
   ```

5. Verify modes A/B/C each report `IRQ48 E1 EVENTS64 ERR0` and `E1 BYTES232`, with Timer 2 epoch `0`. Mode D must report **`IRQ159 E1 EVENTS128 ERR0`**, **`E1 BYTES465`**, **`TIMER2 EPOCH2`**. Every mode should report `LATE EVENTS0` (conditional on normal emulator operation). Record HGR throughput, Timer 2 snapshot retry counts and elapsed CPU cycles. A/B/D should show nonzero HGR writes; C zero.
6. Stop capture, then in Safari's **Develop → Show JavaScript Console**:

   ```js
   apple2plus.hwObj().io.SLOT2obj(5).downloadHistory();
   ```

   The history filename may say `slot5`: this denotes **internal SlotN=5**, the physical PR#4 expansion slot.
7. Open `tools/AY_SCORE_MB06A1_VERIFY_standalone.html` directly in Safari and import the exported history. The expected outcome is **PASS**, **272 AY writes**, four mode markers, and 40/40/80 output deadline groups (B/C/D). Save the report, and share the Applesoft output, history JSON and report for acceptance.

**Acceptance is pending a real RetroAppleJS run.** The JSON under `tests/SIMULATED_*` was generated by a limited, independent Python 6502/VIA model, not by Safari or the actual RetroAppleJS emulator.

## Local reproducible build / developer regression

```sh
python3 build/build_mb06a1.py
python3 tests/simulate_mb06a1.py
python3 -m unittest discover -s tests -p 'test_mb06a1.py' -v
node --test tests/test_history_verifier.cjs
python3 build/build_verifier.py
```

The tests include exact original-fixture preservation, 16-bit score pointer, two monotonic Timer 2 epoch crossings, long score end-time and bytes, zero late events, 272 register writes, no lost Timer 1 underflows, IRQ soft-vector restoration, corrupted packed AY ID rejection, non-grid delta rejection, precise end-of-score length check, four-byte ULEB decoding and range errors, 6502 loader integrity, and synthetic JSON timing/error injection. No external assembler is required.

## Follow-up

After this MB-06A.1 is accepted in Safari, move to **MB-06A.2 — R0–R13 sound-register playback**. This experiment deliberately retains the original two-register event pattern and intentionally spends more CPU time on generalized decoding and coherent Timer 2 sampling; do not assume it is the performance baseline for a production player. CPU optimization and finer-grained timing belong in MB-07.
