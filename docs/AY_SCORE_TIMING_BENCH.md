# Phase 1.5A.2 — AY Score Timing Bench v0.1

## Goal

Execute *real 6502 machine instructions* that drive RetroAppleJS's Mockingboard
slot-4 VIA and compare two AY register-write procedures and one deliberately
narrow E1 score-token interpreter. The source file is
[`asm/AY_SCORE_TIMING_BENCH.S`](../asm/AY_SCORE_TIMING_BENCH.S).

This first build is **not** an interrupt-driven music player, graphics
coexistence experiment, or complete E1 decoder. Its timing measurements require
running the binary in RetroAppleJS; the supplied Python test model is a local
regression test and must **not** be represented as emulator or hardware telemetry.

## Required environment

- Apple II/II+ with 64 KB typical configuration, 6502 CPU, Applesoft BASIC.
- RetroAppleJS Mockingboard installed in **slot 4**, with its AY audio enabled.
- Main RAM `$6000–$6223` available for 548 bytes of code/data.
- Main RAM `$6F00–$6F09` available for ten bytes of results.
- No running sound or IRQ handler using the Mockingboard VIA1 Timer 1.

The test initializes VIA1 DDRA/DDRB, ORA/ORB, ACR, and disables VIA1's Timer 1
interrupt enable. It **does not restore a previous program's VIA configuration**.
Run on an otherwise idle emulator with no background music. It momentarily
writes volumes to AY1 R8, and mutes it at completion. Other AY registers/chips
are not intentionally modified beyond AY1 R7=0x3F (disable tone and noise).

Slot 4 register mapping follows RetroAppleJS's canonical symbols:
`asm/ROMS/PERIPHERALS/MOCKINGBOARD_SLOT4.symbols.json`.
The device uses:

| Address | 6522 VIA register | Use |
| --- | --- | --- |
| `$C400` | ORB | AY BC1/BDIR and /RESET control |
| `$C401` | ORA | AY register address or value |
| `$C402` | DDRB | PB0–PB2 output |
| `$C403` | DDRA | PA0–PA7 output |
| `$C404` | Timer 1 low counter/latch | 16-bit timing |
| `$C405` | Timer 1 high counter | Starts Timer 1 |
| `$C40B` | ACR | Timer 1 one-shot mode |
| `$C40E` | IER | Disable Timer 1 IRQ during test |

AY control (PB2 held high, /RESET not asserted): `$07` latch register address;
`$06` write data; `$04` inactive.

## Browser-only acceptance: easiest method

You do **not** need Node or Python to run these tests. Use the included
`build/AY_SCORE_TIMING_BENCH_LOADER.bas`:

1. Open RetroAppleJS and mount **Mockingboard in slot 4** through the peripheral
   Slot Manager. Make sure the CPU can run normally and sound is enabled.
2. At the Applesoft prompt enter `NEW` to free BASIC's program storage.
3. Paste the full contents of `AY_SCORE_TIMING_BENCH_LOADER.bas` into the
   emulator's BASIC input/paste mechanism. It is an ordinary BASIC program with
   `DATA` statements containing the exact assembled 548-byte binary.
4. Enter `RUN`. The program loads the binary to `$6000`, checks the byte-sum,
   calls all three assembly entry points, and prints results.
5. For a direct inspection of the **last** test's results, run:

   ```basic
   PRINT PEEK(28416),PEEK(28417),PEEK(28418)
   PRINT PEEK(28423)+256*PEEK(28424)
   ```

   The first line should show `165  3  32` (complete, MB-03, 32 writes).
   The second line displays MB-03's baseline-subtracted total CPU-cycle count.
6. Optionally execute individual cases with `CALL 24576`, `CALL 24579`,
   `CALL 24582` and inspect `$6F00–$6F09` after each.
7. Export the Mockingboard AY register-write history or a STEP TRACE if available,
   and confirm 64 volume writes for MB-01/MB-02 and 32 for MB-03. **History
   includes initialization and final muting**: expect two extra R8 writes per
   invocation and one R7 write. Disable background AY writes before comparing.

If the BASIC loader cannot paste directly into your emulator, use the raw binary
`build/AY_SCORE_TIMING_BENCH.bin` at load address `$6000`, or paste monitor
hex lines from `build/AY_SCORE_TIMING_BENCH.monitor.txt` (without the
Applesoft `CALL -151` line if already in the monitor). Do **not** DOS `BLOAD` the
raw host `.bin` unless it has first been stored as a DOS binary file with the
correct DOS file type and load metadata.

## Tests and timing expectations

| ID | BASIC entry | Events | Test body | Expected analytical net cycles (NMOS 6502) |
| --- | --- | ---: | --- | ---: |
| MB-01 | `CALL 24576` | 64 R8 writes | reselect `$08` before every write | ~3011 |
| MB-02 | `CALL 24579` | 64 R8 writes | latch `$08` once; update data only | ~1859 |
| MB-03 | `CALL 24582` | 32 R8 writes | parse a 1- or 2-byte E1 delta varuint, validate `$08` ID, write data | ~1728 |

**These are instruction-model predictions, not measured RetroAppleJS results.**
The processor always executes at full speed. No graphics workload or CPU-share
fraction is applied. The 6522 timer itself supplies a sample of elapsed cycles.

- **MB-01 full AY write bus sequence** uses 36 instruction cycles to load
  register address, latch, go idle, load data, commit and go idle. Each loop
  iteration also toggles the volume (6 cycles) and branches (5, except last
  4), with two setup instructions (4 cycles): `64 × (36+6+5)-1+4 = 3011`.
- **MB-02 retained-address write** uses 18 cycles for TYA+STA, LDA+STA,
  LDA+STA. Same volume-toggle and loop overhead: `64 × (18+6+5)-1+4=1859`.
- MB-03 consumes E1's unsigned 7-bit varuint for delta cycles, then packed
  chip/register and value. Its fixture has 32 R8 volume writes with one first
  zero delta and 31 subsequent delta=200 (`C8 01`) pairs. It **does not wait**
  for the decoded delta; it does not handle arbitrary chip/register IDs. It
  measures decoder work plus bus writes, not a playable score.

Page boundaries matter: the FULL_LOOP was deliberately aligned to `$6100`
with three bytes of NOP padding, removing a 1-cycle branch penalty that a
cross-page backward BNE would otherwise impose for each taken iteration.

The Timer 1 baseline reading includes the same `JSR empty_body; JSR snapshot`
structure and is subtracted from each real run. TIMER_ARM uses the one-shot
`$FFFF` countdown; body durations must stay below 65536 cycles. Elapsed count
is approximately `65535 - remaining` and may have a small systematic
variance due to VIA timer decrement/read latching semantics. Record both raw
and corrected numbers.

## Result record

| Address | Meaning |
| --- | --- |
| `$6F00` | $A5 completion marker |
| `$6F01` | mode ID 1/2/3 |
| `$6F02` | number of measured R8 writes |
| `$6F03–$6F04` | total Timer 1 sample low/high |
| `$6F05–$6F06` | calibrated empty-path Timer 1 sample low/high |
| `$6F07–$6F08` | corrected cycles = total - baseline (16 bit) |
| `$6F09` | error code: 0=OK; 1=unrecognized E1 packed id |

`NET / WRITES` gives the observed average cycles per R8 write **including
loop/decode overhead**. It is not the bare AY bus-write cost; the bare
36/18-cycle estimates come from instruction counting. CPU-clock frequency
converts cycles to time (e.g. 1023000 Hz ≈ 0.978 microseconds per cycle).

## Files

- `asm/AY_SCORE_TIMING_BENCH.S` — authoritative, annotated 6502 source
- `build/AY_SCORE_TIMING_BENCH.bin` — raw 548-byte RAM image, load `$6000`
- `build/AY_SCORE_TIMING_BENCH_LOADER.bas` — browser-friendly Applesoft loader
- `build/AY_SCORE_TIMING_BENCH.monitor.txt` — Apple II monitor hex lines
- `build/AY_SCORE_TIMING_BENCH.lst` — assembler listing
- `build/AY_SCORE_TIMING_BENCH.symbols.json` — offsets, addresses, labels
- `build/build_6502.py` — dependency-free *build-time* assembler, optional
- `build/make_basic_loader.py` — regenerates BASIC DATA loader, optional
- `tests/verify_6502.py` — independent instruction-level 6502 simulation
- `tests/SIMULATED_TEST_RESULTS.json` — predictions, **not** hardware data

## Acceptance criteria

1. BASIC loader reports CHECKSUM OK and all three test outputs.
2. All three modes return to Applesoft and set `$6F00` to `$A5`.
3. `$6F09` is zero; measured count is 64, 64, 32.
4. Corrected MB-02 per-write cycles are below MB-01's.
5. The exported AY register history shows correct R8 value sequence
   `0F 00 0F 00 ...` for each mode, including no accidental AY reset.
6. 6522-measured cycles are close to the 6502 instruction predictions;
   preserve raw telemetry if not, rather than changing the analytical results.

## Deliberately deferred

A full E1 binary score player would additionally need a 36-byte `.aysb`
header reader, payload-length and FNV checksum validation, varuint accumulation
into an absolute 32-bit cycle timestamp, multi-chip dispatch, explicit scheduling
or Timer 1 IRQ service, and protections against overlong and malformed input.
That work starts **after** these primitive costs are calibrated.
