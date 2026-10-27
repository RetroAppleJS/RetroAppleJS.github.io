# MB-06A.2 — Full AY0 R0–R13 E1 event dispatch

**Phase:** 1.5A.6 · **Version:** v0.1.0 executable candidate · **Target:** RetroAppleJS Apple II+/NMOS 6502 with Mockingboard in **physical PR#4** (internal `SlotN=5`).

**Status:** Fully assembled and exercised in an **independent limited 6502/VIA simulator**, with offline register-history verification. **Not yet accepted in RetroAppleJS/Safari or on original Apple II hardware.** MB-05.1 and the MB-06A.1 candidate are unmodified.

## 1. Goal

Extend the validated MB-06A.1 absolute E1 timer, ULEB128 decoder and 16-bit stream pointer to write all **14 musical registers of AY0**. Retain the original R8/R9 timing scores in modes 1–4. Add a fifth, dedicated 1.71-second register-coverage fixture that exercises tone on all three channels, the noise generator, the mixer, amplitude (including hardware-envelope enable), envelope period and repeated envelope-shape retriggers.

This is a *register dispatch / timing benchmark*. It is not yet a production-quality music engine, file-loader, two-chip score, arbitrary-cycle scheduler or validated audio-fidelity implementation. The nominal sound resembles a short three-channel melody, but listening acceptance belongs to the next phase.

## 2. Playback modes and expected local counts

| Mode | Entry point | Score | Foreground | IRQs | Events | Encoded E1 bytes | Timer 2 epochs |
|---|---|---|---|---:|---:|---:|---:|
| 1 — dry decode | `CALL 24579` (`$6003`) | MB-05 original R8/R9 | HGR | 48 | 64 | 232 | 0 |
| 2 — R8/R9 output | `CALL 24582` (`$6006`) | MB-05 original | HGR | 48 | 64 | 232 | 0 |
| 3 — R8/R9 output | `CALL 24585` (`$6009`) | MB-05 original | NOP | 48 | 64 | 232 | 0 |
| 4 — extended clock | `CALL 24591` (`$600F`) | MB-06A.1 long fixture | HGR | 159 | 128 | 465 | 2 |
| 5 — all 14 AY0 registers | `CALL 24594` (`$6012`) | New 179-event fixture | HGR | **1705** | **179** | **658** | **26** |

`CALL 24576` (`$6000`) runs all five modes, and `CALL 24588` (`$600C`) is a best-effort emergency stop. All listed counts are **independent simulator predictions** for the checked-in fixture; use real RetroAppleJS telemetry for final acceptance.

## 3. E1 format and value validation

The wire format is unchanged:

```text
[unsigned LEB128 deltaCycles] [packed AY register ID] [register value]
```

MB-06A.2 supports **AY0 IDs `$00–$0D`**, while rejecting R14, R15 (I/O registers), AY1 IDs and malformed/overflowing deltas. Values are checked against AY sound-register masks **before any AY output**:

| Register | Meaning | Maximum valid value / rule |
|---|---|---|
| R0, R2, R4 | Tone A/B/C fine | `$FF` |
| R1, R3, R5 | Tone A/B/C coarse | `$0F` |
| R6 | Noise period | `$1F` |
| R7 | Mixer | `$3F` (R7 bits 6–7 must remain 0 to avoid changing AY I/O directions) |
| R8, R9, R10 | A/B/C amplitude | `$1F` (bit 4 enables hardware envelope) |
| R11, R12 | Envelope fine/coarse period | `$FF` |
| R13 | Envelope shape/retrigger | `$0F` |

**IMPORTANT:** Identical R13 writes are **not deduplicated**, because they retrigger the hardware envelope. Only the AY *register-selection latch* is cached. The new fixture has **nine** explicit R13 writes with value `$0A`.

Timing is intentionally quantized to **1,024 CPU cycles**, at most **two requested E1 writes per deadline** in the new fixture. The 16-bit score clock represents units of 256 CPU cycles, and Timer 2 high-byte wraps are extended in software. Interrupt servicing must occur frequently enough to observe the counter wraps. E1 deltas are bound-checked to the accepted 16-bit `/256` span. A 4,096-IRQ stop guard applies in mode 5; modes 1–4 retain the earlier 8-bit IRQ guard.

## 4. Why the diagnostic layout changed

The larger source no longer fits before the original MB-06A.1 sample buffers at `$6800`. MB-06A.2 relocates its **diagnostic-only** buffers into `$8000–$92FF`, giving the machine code a contiguous region `$6000–$6EFF` (actual binary is smaller). The IRQ handler's five per-mode diagnostic sample addresses are configured **once before enabling interrupts**. The fast path then uses self-modified `STA absolute,X` operands instead of costly five-way branches on each IRQ.

| RAM | Use |
|---|---|
| `$6000–$6ABF` | Compiled MB-06A.2 native player and embedded three E1 fixtures |
| `$6F00–$6F2B` | Scheduler, decode and coherent Timer 2 scratch |
| `$6F40`, `$6F58`, `$6F70`, `$6F88`, `$6FA0` | 24-byte result records for modes 1–5 |
| `$8000/$8080/$8100/$8200/$8300` | Timer 2 entry low for modes 1–5 |
| `$8400/$8480/$8500/$8600/$8700` | Timer 2 entry high |
| `$8800/$8880/$8900/$8A00/$8B00` | Timer 2 exit low |
| `$8C00/$8C80/$8D00/$8E00/$8F00` | Timer 2 exit high |
| `$9000/$9040/$9080/$9100/$9200` | One-byte per-decoded-token spans |
| `$2000–$3FFF` | Foreground HGR page 1 writes |
| `$03FE/$03FF` | Temporarily installed Monitor IRQ soft vector |

Modes 4/5 store their **last up to 256 IRQ snapshots** using an 8-bit index. The independent simulator records **all** IRQ interiors and its whole-run extrema; a single RAM dump of mode 5's sample buffers does *not* show its full 1705-IRQ history.

The code uses the same coherent high–low–high Timer 2 snapshots and rollover retry counter as MB-05.1. It restores the soft IRQ vector and portions of the VIA configuration at the end, but **cannot safely restore the complete previous VIA/AY port state**. Use a disposable emulator session with no other timer owner.

## 5. Mode 5 E1 fixture

`build/generate_fixture.py` deterministically produces the fixture, which is embedded in the source and independently decoded to `tests/E1_REG_EXPECTED_EVENTS_MB06A2.json`. It targets approximately **1.7087 seconds** at the nominal 1,021,800 Hz clock and encodes the notes C4–D4–E4–C4 twice, with G3/A3/E3 harmony and C3/G2 bass patterns.

The fixture schedules all 14 AY0 registers; each harmonic note configures tone fine/coarse pairs, R8–R10 amplitudes, R11/R12 envelope timing, an explicit R13 retrigger, occasional R6/R7 noise accents and a short note-off interval. It separates the final pair of writes before a long delay across adjacent timer ticks to avoid decoding an expensive ULEB continuation at the end of a two-write IRQ burst.

The AY tone periods use the nominal `1,021,800 / (16 × frequencyHz)` relationship. Exact audible frequency depends on the Mockingboard's configured chip clock and rendering implementation. Register-history fidelity and audible musical quality are different acceptance questions.

**Expected AY writes for a complete five-mode history:** modes 1–4 contain 4 + 68 + 68 + 132 writes; mode 5 contains 3 setup + 179 score + 3 cleanup = **185**. Total: **457 AY0 writes**, zero AY1 writes, zero AY reset records during modes. Mode markers are R7=`$3F`; the mode-5 score avoids `R7=$3F` so markers remain unambiguous.

## 6. Build, diagnostic model and Safari acceptance

From the project root of this package:

```sh
python3 build/generate_fixture.py
python3 build/build_mb06a2.py
python3 tests/simulate_mb06a2.py
python3 -m unittest discover -s tests -p test_mb06a2.py -v
node --test tests/test_history_verifier.cjs
python3 build/build_verifier.py
```

**Build:** 2,752 bytes, entry at `$6000`, checksum of decimal byte values **208694**. The Applesoft loader uses a *keyboard-safe 6-bit encoding* (printable Apple II+ ASCII `$23–$5F`, with a special `?A`–`?D` escape): no lower-case characters or embedded double quotes inside DATA. All input is checked against the embedded checksum. Text plus conservative five-byte-per-line overhead remains below HGR page 1, and line lengths are under Apple's line-input limit.

In Safari / RetroAppleJS:

1. Open a **fresh disposable Apple II+/Mockingboard physical PR#4** session. Use nominal speed and no competing IRQ owner.
2. Enter `NEW`; paste `build/AY_SCORE_TIMING_MB06A2_LOADER.bas`. Do not substitute the MB-06A.1 loader. Start Mockingboard history capture before `RUN`.
3. Execute `RUN`. The loader should begin:

   ```text
   LOADING MB-06A.2 AT $6000...
   LOADED 2752 BYTES. CHECKSUM OK
   E1 AY0 R0-R13 FIVE MODES
   ```

4. Confirm modes 1–5 each report `ERR0`, `LATE EVENTS0`, and the expected IRQ, event, E1 byte and epoch counts in §2. Mode 5 should report `IRQ1705 E1 EVENTS179`, `E1 BYTES658`, `TIMER2 EPOCH26`.
5. Stop capture, then in **Safari → Develop → Show JavaScript Console** export:

   ```js
   apple2plus.hwObj().io.SLOT2obj(5).downloadHistory();
   ```

6. Load the exported `mockingboard-slot5-history.json` into `tools/AY_SCORE_MB06A2_VERIFY_standalone.html`. It checks the **complete ordered register/value history**, R0–R13 coverage, R13 repeats, each score deadline group and relative timing (default 128-cycle provisional limit), unanticipated AY1 events and extra/missing writes.
7. Share the Applesoft output and the history JSON to establish **real RetroAppleJS** acceptance. The *independent model* cannot substitute for this final measurement.

For modes 1–4, compare expected score sequences, not absolute HGR throughput or IRQ instrumentation figures to MB-06A.1: relocating diagnostic buffers and optimizing sampling changes the CPU workload. Test data are differentiated from real Safari measurements throughout this package.

## 7. Result record format

One 24-byte record per mode at `$6F40 + 24 × (mode−1)`:

| Byte offset | Field |
|---|---|
| 0 | `$A5` completed-result marker |
| 1 | Mode ID 1–5 |
| 2,17 | IRQ count low/high |
| 3,16 | E1 event count low/high |
| 4,5 | HGR writes low/high |
| 6,7 | Elapsed CPU cycles modulo 65,536 |
| 8 | Late event count (whole 256-cycle units) |
| 9 | Maximum event lateness in whole 256-cycle units |
| 10,13 | Consumed E1 bytes low/high |
| 11 | Error: `0` OK; `2` max IRQ guard; `3` E1 malformed / mask / size mismatch; `4` VIA timer already owned |
| 12 | Coherent Timer 2 snapshot retries, low eight bits |
| 14,15 | Last observed elapsed `/256` low/high (high is timer epoch) |

Real event lateness below 256 cycles and serialization of writes sharing one logical score deadline must be measured from register-history timestamps, *not* the coarse BASIC late count.

## 8. Acceptance limitations and next steps

**Exit criteria:** complete five-mode run with exact binary checksum, `ERR0`, zero late events, no unexpected IRQ-count loss, exact 457 AY writes, full 14-register coverage, nine R13 retriggers, and provisional 128-cycle relative event-group deviation bound. Actual score sound quality is a separate listening check.

**Follow-on MB-06A.3:** a more complete musical phrase, pitch/instrument verification against a reference AY renderer, and optimization of the worst dense-event bursts. **MB-06B** will consider AY1 and multiple physical buses; **MB-07** will target finer scheduling resolution. Do not merge this executable candidate as emulator-accepted until Safari data have been compared with the embedded reference.
