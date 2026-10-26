# MB-05 / Phase 1.5A.4 — 6502 E1 score scheduling under Timer 1 IRQ and HGR load

**Status:** v0.1 executable candidate; **actual RetroAppleJS acceptance pending**. MB-01–03 were merged and MB-04 cycle/timestamp acceptance was completed separately. This package changes neither.

## Objective

MB-05 combines real 6502 instruction execution with score-defined AY events. Unlike MB-03, it **honours E1 delta time**; unlike MB-04, it **does not simply toggle R8 at every periodic timer tick**. A 6522 Timer 1 IRQ acts as the scheduling heartbeat, Timer 2 provides a separate absolute elapsed CPU-cycle clock, and the foreground continues writing to HGR memory.

This first test is a deliberately **narrow, deterministic E1 subset**, not a generic `.aysb`/E1 playback runtime or a finished tune player. It uses volume-register updates (R8 and R9) on AY0, not an arbitrary musical score with tone-frequency commands. It produces only a very short test pattern.

## Core design

- Machine: Apple II/II+ NMOS 6502 with Mockingboard at **physical PR#4**. RetroAppleJS internal `SlotN=5` correctly refers to PR#4 because `SlotN=0` represents the host/motherboard.
- Assembly source of truth: `asm/AY_SCORE_TIMING_MB05.S`, single `*=$6000` origin.
- Machine code: **1,327 bytes** at `$6000–$652E`, checksum **124100**. These numbers must match the generated loader; if source changes, regenerate both.
- Input: **232-byte E1 payload**, embedded as literal `HEX` bytes in the assembly. The E1 format is `ULEB128(deltaCycles), packedAYRegisterID, value` as used by the Phase 1.5A encoding bench. The 64-token reference is derived from the same payload and checked during the build.
- First-version constraints: chip0, registers R8/R9, delta **0, 1024, or 2048 CPU cycles**, at most 64 events. Delta 0 means multiple writes on one deadline, executed sequentially rather than at identical CPU timestamps.
- Timer 1 free-run `ACR.bit6=1`, latch `$03FE`. RetroAppleJS models a 6522 interval as `latch + 2` cycles, so the period is **1024 cycles**. A smaller 256-cycle heartbeat was deliberately rejected after the limited simulator showed that some two-event IRQ bursts could overrun a timer tick.
- Total encoded score time: **49,152 CPU cycles = 48 timer ticks**. Each mode should dispatch 64 events over those 48 timer interrupts.
- Timer 2 starts at `$FFFF` and counts down continuously. The scheduler reads Timer 2 high byte near IRQ entry and complements it to derive elapsed time in 256-cycle units: `NOW_HI = $FF - T2_HI`. This is intentionally **not** derived from the number of IRQs accepted: if an IRQ is masked and 6522 T1 underflows coalesce, the score timeline can still detect events overdue by whole 256-cycle units. A separate independent stress test exercises this case.
- Each IRQ acknowledges T1 **only once**, near entry. This avoids inadvertently clearing a *new* timer interrupt while decoding a burst of zero-delta events.
- If `NOW_HI >= DUE_HI`, the handler dispatches all due events, reads the following E1 token and advances its **absolute** due time. The handler supports selecting R8 or R9 when needed and caches the currently selected AY register across events.
- A bounded foreground polls `DONE` and exits to cleanup. It never returns to Applesoft with the IRQ installed.

### Test modes

| Mode | CALL entry | Decode | AY score writes | Foreground |
|---|---|---|---|---|
| All A+B+C | `CALL 24576` | All modes | A: 0, B/C: 64 each | HGR, HGR, NOP |
| MB-05A | `CALL 24579` | 64 tokens | None in the timed body | HGR |
| MB-05B | `CALL 24582` | 64 tokens | 64 | HGR |
| MB-05C | `CALL 24585` | 64 tokens | 64 | NOP loop |
| Emergency stop | `CALL 24588` | — | — | Best-effort cleanup if BASIC is still usable |

Every mode performs two setup writes (R7=$3F, R8=$00) and two cleanup writes (R8=$00, R9=$00); the full capture should contain **140 AY writes**: A=4, B=68, C=68. Depending on capture start, unrelated initial reset events may also be present and can be ignored before the first mode marker.

## Memory map

| Address | Contents |
|---|---|
| `$6000–$652E` | Compiled assembly and embedded E1 tokens |
| `$2000–$3FFF` | HGR page 1 foreground RAM writes (A/B modes only) |
| `$03FE/$03FF` | Apple II Monitor ROM software IRQ vector, saved/restored |
| `$0045` | Apple II Monitor's interrupted-A scratch, saved/restored on returning to BASIC |
| `$6800/$6880/$6900` | Timer 2 **entry low-byte** samples for A/B/C, respectively |
| `$6A00/$6A80/$6B00` | Timer 2 **exit low-byte** samples |
| `$6C00/$6C80/$6D00` | Timer 2 **entry high-byte** samples |
| `$6D80/$6E00/$6E80` | Timer 2 **exit high-byte** samples |
| `$7000/$7040/$7080` | Decode-span samples, 63 bytes each; excludes the first predecoded token |
| `$6F00–$6F1B` | Working state |
| `$6F40/$6F50/$6F60` | 16-byte result records for A/B/C |

The Timer 2 entry/exit samples are captured at slightly different instruction offsets; their differences include sample-instrumentation overhead and potential 16-bit low/high counter-read incoherence around byte rollover. They characterize the **sampled handler interior**, not the full 7-cycle CPU IRQ entry, Apple Monitor ROM dispatch, RTI or the entire CPU cost of an interrupt.

The per-token decoder sample is the difference between two Timer 2 low-byte reads surrounding `JSR NEXT_TOKEN`. It includes the measuring instructions and the call/return, not solely the decoder's arithmetic. The 63 measured calls exclude the initial predecode performed before enabling Timer 1.

## Browser-only acceptance workflow

1. Use a **disposable Apple II/II+ emulator session** with Mockingboard in physical PR#4; no other IRQ music/timer owner. The MB-05 code deliberately changes the VIA's timers, ports and AY registers.
2. At Applesoft enter `NEW` and paste `build/AY_SCORE_TIMING_MB05_LOADER.bas`. The loader uses **hexadecimal DATA strings** rather than long decimal DATA lists, keeping the BASIC program comfortably below the HGR page 1 address `$2000`. It converts hex to bytes with standard Applesoft functions (`READ`, `MID$`, `ASC`, `LEN`), and verifies its checksum.
3. Start Mockingboard **history capture** from Peripheral Controls, after the BASIC program has been pasted. A 64 KiB history buffer is ample.
4. Type `RUN`. Expected beginning:

   ```text
   LOADING MB-05 AT $6000...
   LOADED 1327 BYTES. CHECKSUM OK
   E1 SCORE, THREE IRQ MODES...
   ```

   The program calls `$6000` in HGR mode, returns to `TEXT`, and reports mode-specific IRQ counts, E1 events, HGR writes, Timer 2 cycles, late event counts, sampled handler interiors and decoder spans.
5. Stop history capture before resetting or starting other sound. In Chrome Developer Tools console, export the history as JSON:

   ```javascript
   apple2plus.hwObj().io.SLOT2obj(5).downloadHistory();
   ```

   The filename may use `slot5` because the card's internal index is 5 for physical slot PR#4. This is expected and is **not** an off-by-one mapping fault.
6. Open `tools/AY_SCORE_MB05_VERIFY_standalone.html` in your browser (offline is fine) and import the history. The verifier checks 4/68/68 register writes, 64 event values per active mode, the 40 score deadline groups, their timing deviations, and same-deadline event bursts. It accepts optional initial reset events, but rejects wrapped/missing/corrupt traces. It labels synthetic samples explicitly.
7. Export the validation JSON. Provide the **BASIC output and exported Mockingboard history** for acceptance and the comparison with predictions.

### Expected BASIC result record

Result records are at `$6F40` (=28480), `$6F50` (=28496), `$6F60` (=28512), with fields:

| Offset | Meaning |
|---:|---|
| 0 | Magic `$A5` (decimal 165) |
| 1 | Mode 1, 2, 3 |
| 2 | Number of Timer 1 IRQ service entries |
| 3 | Number of dispatched E1 events (64 expected) |
| 4–5 | HGR RAM writes, little-endian unsigned 16 bit |
| 6–7 | Timer 2 elapsed cycles, little-endian unsigned 16 bit |
| 8 | E1 events whose due time was already passed by >=256 cycles at IRQ service |
| 9 | Maximum overdue amount in **256-cycle units**, not 1024-cycle timer ticks |
| 10 | E1 score payload bytes consumed (232 expected) |
| 11 | Error: 0=OK, 2=IRQ count limit, 3=invalid E1 token, 4=existing active VIA Timer1/2 interrupt source |

`LATE_N` and `MAX_LATE` measure **whole-256-cycle overdue events**; subtick jitter must be measured from Mockingboard history. A regular test should produce 0; a deliberately masked IRQ can produce positive counts and fewer than 48 serviced IRQs because underflows may coalesce.

### Acceptance criteria

- Loader checksum matches its 1,327-byte binary and finishes (no AppleSoft syntax error).
- Three records contain `$A5`, `ERR=0`, `E1 EVENTS=64`, `E1 BYTES=232`, and the expected test mode.
- A quiet run produces approximately **48 IRQs per mode** and no late events. The exact IRQ count is a test metric and should not be hard-coded as a guarantee under heavy external interference.
- Raw Mockingboard history matches **140 AY register writes** and the full E1 register/value sequence. Scores in MB-05B and MB-05C produce 40 timing groups with first-write timing deviations significantly below the 1024-cycle tick. The provisional browser-check tolerance is 128 cycles relative to the first deadline group (can be revised after inspecting real data).
- HGR throughput differs between dry E1 decoding and E1+AY writes in the direction suggested by the model, without skipped score events.
- IRQ software vector and VIA1 Timer 1 interrupt enable are restored/masked at completion; no resident IRQ remains.

## Independent model predictions (NOT measured RetroAppleJS)

The included `tests/simulate_mb05.py` is a deliberately limited independent 6502/VIA instruction simulator. It is **not** the RetroAppleJS emulator or an original 6522 physical device.

| Metric | A — Dry E1 / HGR | B — E1 AY / HGR | C — E1 AY / NOP |
|---|---:|---:|---:|
| IRQ services | 48 | 48 | 48 |
| Dispatched E1 events | 64 | 64 | 64 |
| HGR writes | 842 | 759 | 0 |
| Timer 2 elapsed cycles | 49,651 | 49,734 | 49,736 |
| Late events | 0 | 0 | 0 |
| Sampled handler interior, average cycles | 320.29 | 375.88 | 382.50 |
| Decoder span, average cycles | 85.79 | 85.79 | 85.79 |

The model predicts **~9.9% fewer HGR writes** in B than in A at similar elapsed time. The exact figures may differ in RetroAppleJS. Both A and B spend time parsing E1 tokens; B additionally drives the AY. The comparison isolates incremental decoder-to-AY bus processing better than directly comparing different timer periods in MB-04.

An additional **fault-injection stress test** masks timer IRQ acceptance for about 2,400 CPU cycles in one model run: it detects 5 overdue events, maximum lateness 6 × 256 cycles, and 47 serviced IRQs, while dispatching all 64 score events and completing. This demonstrates that the Timer 2 absolute timeline can detect coalesced IRQs; it is not a claim about RetroAppleJS under equivalent load.

## Explicit limitations and next extensions

- Fixed tick resolution is **1024 cycles**. This version does not reproduce an arbitrary E1 event's exact cycle-level deadline.
- Only 64 events and the two-volume-register E1 subset are supported; packed AY IDs for other chips/registers are rejected by the assembly. The original Phase 1.5A E1 codec supports arbitrary AY register values and wider varuints, which MB-05 v0.1 does not yet implement.
- Requires a disposable emulator session; saves/restores IRQ soft vector, original `$45`, VIA1 ACR and DDRA/DDRB, and masks T1 IRQ. It **does not** preserve running T1/T2 counters, port output latches, mixer content, prior playing music or the whole VIA state.
- An Apple II Monitor IRQ necessarily writes zero-page `$45` during execution. This bounded diagnostic does not promise transparent cohabitation with arbitrary BASIC/foreground software.
- Timer 2 samples are a measurement path, not an external hardware validation. A real Apple II and 6522 might behave differently; this test is intended to validate RetroAppleJS first.
- Next improvements should include arbitrary-resolution timer scheduling, full E1 decoding (both AY chips, all registers and extended varuints), true note/tone scores, bounded-buffer streaming, and user-selectable interrupt load/graphics workloads. Only then consider using E1 scores in a production player.

## Rebuilding / regression tests (developer only)

```bash
python build/build_mb05.py
python tests/simulate_mb05.py
python build/build_verifier.py
node tests/test_mb05_verifier.cjs
```

Developer-side Python/Node tooling is **not required** for the browser acceptance procedure. The generated machine-code loader and standalone verifier are fully self-contained.
