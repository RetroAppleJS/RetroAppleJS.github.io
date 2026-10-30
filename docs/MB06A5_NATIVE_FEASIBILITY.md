# MB-06A.5 v0.2 — Native 6502 feasibility screen

**Status:** offline workload analysis and register-history listening experiment. The user reported major improvements in perceived pitch correctness and acceptable waveform quality in the MB-06A.5 listening test. **This is not native 6502 instrument acceptance.** The 1,024-cycle E1 scores exported here have deliberately modified register-write times, and those variants still need their own listening test.

## What changed since v0.1

The laboratory now has a **Native 6502 readiness** table, with selectable Timer 1 heartbeat (1,024 / 512 / 256 cycles), assumed fixed IRQ overhead, and the marginal cost per serialized register write. The default marginal cost is **350 cycles/event**, deliberately more conservative than the earlier illustrative 50-cycle raw bus-write estimate. Previous native MB-06 benchmark history included same-deadline register separations of about 311–323 cycles; those capture intervals are not a universal instruction timing bound, but warn against assuming 50 cycles for an entire E1 decode/select/write/next-token operation.

The analyzer uses the actual AY0 register-event schedules from the MB-06A.5 instrument laboratory. It encodes the original and adapted events as **E1 ULEB delta + AY register ID + value** to count actual payload bytes (not estimated counts), and reports peak events per timer tick, the smallest positive source event spacing, modeled CPU share, and score-memory constraints.

**Event packing:** For the exported tone-based scores, the analyzer rounds each event up to the next Timer 1 heartbeat and serializes excess events onto following ticks. At a 1,024-cycle heartbeat, 120 fixed + 2×350 marginal cycles uses **820 modeled cycles/tick** and provides a 204-cycle modeled reserve. It retains event order and each explicit register write, especially R13 retriggers; it cannot promise preservation of exact note attack, envelope or software-DAC waveform. The original MB-06A.3 binary cannot ingest these `.aysb` files without a new 6502 loader/score runner.

## Default 1,024-cycle results

| Instrument | Register writes | Original E1 bytes | Adapted E1 bytes | Max modeled event/tick | Max quantization shift | Model CPU share | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Native square | 91 | 373 | 348 | 2 | 2,048 cycles | 12.6% | Candidate |
| Plucked square | 133 | 541 | 502 | 2 | 3,200 cycles | 13.0% | Candidate |
| Expressive square | 161 | 683 | 644 | 2 | 2,048 cycles | 13.2% | Candidate |
| Tone + noise | 105 | 429 | 404 | 2 | 2,432 cycles | 12.7% | Candidate |
| Detuned pair | 147 | 583 | 558 | 2 | 3,200 cycles | 13.1% | Candidate |
| Tone × envelope buzzer | 133 | 541 | 502 | 2 | 3,200 cycles | 13.0% | **Exploratory only** (perceived pitch not verified) |
| Software saw 8 steps | 7,965 | 31,849 | 27,918 | 2 | 464,896 cycles | 78.2% | **Not suitable** |
| Software saw 16 steps | 10,243 | 40,965 | 35,853 | 2 | 1,579,153 cycles | 79.2% | **Not suitable** |
| Software triangle 8 steps | 9,093 | 36,361 | 31,828 | 2 | 990,516 cycles | 79.1% | **Not suitable** |
| Software triangle 16 steps | 13,623 | 54,485 | 47,683 | 2 | 3,309,713 cycles | 79.4% | **Not suitable** |

**Interpretation:** The modeled CPU share includes a fixed assumed cost at every timer heartbeat, even on empty ticks. It is **not** an actual 6502 CPU percentage and should not be compared directly with measured MB-06A.3 sampled IRQ-interior percentage. For DAC instruments, the model extends playback dramatically to serialize the impossible original event rate; the resulting high percentage and drift illustrate failure, not an alternative implementation.

The five exported tone-based scores are provisionally within an **8 KB resident score budget** (an assumption, not a discovered safe Apple II memory region) and do not exceed the modeled per-tick service budget. Their event timing shifts by approximately 2–3.2 ms at worst, which must be assessed by listening, especially for fast attacks and R13 envelope start. Most source events also exceed the previous 128-cycle relative timing tolerance after adaptation; this test explicitly relaxes that property and requires separate approval.

The waveform-DAC variants require a fundamentally different timing architecture and, in their current 14-note form, 27–48 KB *even after* deliberately destructive heartbeat scheduling. Before adaptation their E1 payloads occupy **32–54 KB**. Dense intervals can be **11 CPU cycles** apart, far too short for the presently measured native E1 interrupt-decoder sequence. A 256-cycle Timer 1 heartbeat has insufficient budget even for one event under the conservative assumptions and would add substantial fixed IRQ overhead.

## How to use

1. Place the **three** files `MB06A5_INSTRUMENT_SYNTH_LAB.html`, `MB06A5_INSTRUMENT_SYNTH_LAB_core.js`, and `MB06A5_NATIVE_FEASIBILITY_core.js` in `RetroAppleJS/tools/`.
2. Open the HTML through the repository's local HTTP server; optionally generate C4 probes to obtain an AYCore-calibrated volume curve.
3. Inspect the Native 6502 readiness table with **1,024 / 120 / 350** as default timer/fixed/event cycle costs.
4. Choose **Export eligible E1 scores + report**. The ZIP includes five `AYSB` v1 / E1 files, exact adapted event JSON, the full assessment and warnings. If you calibrated in the browser first, that curve informs the scores; otherwise the nominal AY volume curve is used and may not match your earlier listening test.
5. Do **not** try to BLOAD an `.aysb` file with the MB-06A.3 BASIC loader. The header is a 36-byte data interchange structure; the MB-06A.3 program has a fixed embedded score and does not support file ingestion.
6. Native next step: compile and exercise the adapted **pluck** and **expressive square** scores in a new 6502 IRQ/HGR benchmark, measure event history, waveform capture, peak total IRQ service and HGR throughput. Preserve MB-06A.3 as baseline.

## Interpretation and acceptance gates

- **Listening gate:** previous host-timed AYCore candidates accepted by the user. Adapted E1 candidate listening still pending.
- **Score compatibility:** all eligible candidates preserve exact order, AY0 R0–R13 restrictions and repeated R13 events. Automated byte-level round-trip regression passes.
- **Timing gate:** model only; the current v1 native player cannot load or schedule these scores yet.
- **CPU gate:** modeled, parameterized; no native 6502 instruction simulation or real Safari IRQ telemetry for adapted scores.
- **Memory gate:** candidate payloads under assumed 8 KB, actual free RAM/use with HGR, BASIC, DOS or an IRQ player still needs checking.
- **Final acceptance:** hardware/Audacity pitch measurements plus real emulator register history and source WAV capture under simultaneous HGR writing.

Developer tests:

```sh
node --test tests/mb06a5.test.cjs tests/mb06a5_native.test.cjs
node build/build_native_scores.cjs
python tests/browser_smoke.py
```

The browser smoke uses a **mock AYCore**, not actual synthesis playback. No claim of real Safari operation is made for the newly adapted E1 export interface until the user tests it.
