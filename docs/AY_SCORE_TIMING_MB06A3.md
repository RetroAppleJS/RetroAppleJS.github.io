# MB-06A.3 · Musical E1 playback alongside Apple II HGR

**Phase 1.5A.7 · v0.1.0 · NMOS 6502 · RetroAppleJS Apple II+ · Mockingboard in physical slot PR#4 (internal SlotN=5)**

**Acceptance state:** The native 6502 source, E1 compiler, BASIC loader, instruction/VIA model, negative decoder regressions, and offline register-history verifier are complete. **Actual Safari playback/history acceptance is pending.** No changes have been made to the accepted MB-05.1 or MB-06A.1/A.2 benchmarks. The WAV guide is *not* an AY-rendered golden waveform.

## Goal and user-facing demonstration

This phase crosses from a register-coverage test to a recognizable musical phrase. Mode **5** runs a 14-note opening of **Frère Jacques**, with bass, sustained harmony and short noise-drum accents, **while the Apple II foreground repeatedly writes HGR page 1**. Mode **6** replays *the exact same compiled E1 bytes* with an otherwise idle (NOP) foreground. Modes 5 and 6 are internal result IDs retained to make comparison with the older MB-06A.2 family unambiguous; this executable contains **only these two modes**. The five original MB-06A.2 modes are distributed separately, unchanged.

The 14-note motif is `C4 D4 E4 C4 | C4 D4 E4 C4 | E4 F4 G4(2×) | E4 F4 G4(2×)`; one short note occupies **224 Timer 1 heartbeats** = ~224.5 ms. It includes **150 explicit register writes** (643 E1 bytes), five R13 writes (including the initial shape programming), all 14 sound registers R0–R13, and ends at **3,738,624 CPU cycles (~3.659 seconds)**. The separate WAV and MIDI files provide a pitch/rhythm **listening guide**, not a numerical reproduction of the Mockingboard's AY core.

### Quick Safari test

1. Start a *disposable* Apple II+/Mockingboard session. Configure Mockingboard in **physical PR#4** and ensure the Mockingboard audio device is enabled and volume is audible. A Safari user gesture may be required to activate Web Audio.
2. In Applesoft, type `NEW`. Paste **`build/AY_SCORE_TIMING_MB06A3_LOADER.bas`** in its entirety. The DATA alphabet uses only Apple II+-safe uppercase and punctuation, and the entire program fits *below* HGR page 1 (`$2000`).
3. Begin **Mockingboard register-history capture**, then type `RUN`. The display first shows `LOADED 2206 BYTES. CHECKSUM OK`, followed by `E1 AY0 MUSIC TWO MODES`.
4. Hear approximately **3.66 seconds of melody twice** (HGR load, then NOP). At completion both mode records must report `IRQ3651`, `E1 EVENTS150`, `ERR0`, `LATE EVENTS0`, `E1 BYTES643`, `TIMER2 EPOCH57`. The Mode 5 HGR count should exceed **65,535**, while Mode 6 has zero HGR writes. Snapshot retry counts need not match the model.
5. Stop capture, export its JSON via the Mockingboard controls, or in Safari's **Develop → Show JavaScript Console**:

   ```javascript
   apple2plus.hwObj().io.SLOT2obj(5).downloadHistory();
   ```

6. Open `tools/AY_SCORE_MB06A3_VERIFY_standalone.html` (offline, self-contained), select the exported `mockingboard-slot5-history-*.json`, and copy the validation report JSON if needed. The verifier should return `PASS`. Supply the Applesoft output and exported JSON to complete empirical acceptance. Record whether the phrase is recognizable and whether the tone/noise/envelope balance is satisfactory.

Entry points: `CALL 24576` / `$6000` plays both modes; `CALL 24579` / `$6003` runs only music/HGR (mode 5); `CALL 24582` / `$6006` runs only music/NOP (mode 6); `CALL 24585` / `$6009` attempts emergency IRQ hook removal. **Avoid executing another music IRQ owner simultaneously.**

## Score architecture

MB-06A.3 inherits the accepted architecture: a free-running 6522 Timer 1 heartbeat every **1,024 6502 cycles**, an independent Timer 2 continuously decrementing from `$FFFF`, a software epoch extended into a **16-bit absolute score clock measured in units of 256 CPU cycles**, an expanded 16-bit E1 byte pointer and a bounded varuint decoder. The program uses the familiar AY register-selection cache but **never coalesces explicit writes**, including repeated R13 envelope retriggers.

Each E1 event is `ULEB128(deltaCycles), packedAYRegisterID, value` (AY0 only). The compiler restricts all event deadlines to the 1,024-cycle grid and allows **only one score write per heartbeat** in this musical demonstration. This bounds the IRQ burst cost; dense same-tick chords and arbitrary event scheduling remain to be investigated in MB-06A.4/MB-07. The literal E1 payload is emitted in the authoritative assembly source and cross-checked against canonical JSON at build time; no disk streaming or untrusted `.aysb` input is implemented here.

### AY music programming

| Voice | AY resources | Musical use |
|---|---|---|
| Melody A | R0/R1, R8 | Distinct pitched lead voice, temporary mute during period update, decay steps |
| Bass B | R2/R3, R9 | Slow changing bass notes on phrase boundaries |
| Harmony / drum C | R4/R5, R10 | Quiet sustained chord tone; temporary switch to noise with hardware envelope |
| Noise | R6, R7 bit 5 | Short channel C percussion bursts, with tone C temporarily disabled |
| Hardware envelope | R11/R12, R13 | One-shot falling drum envelope and **five explicit R13 shape writes** |
| Mixer | R7 | Normal `$38`: three tone voices, no noise; accents `$1C`: tones A/B and noise C |

For register R0/R1 etc., the tone frequency reference is `f = AY_clockHz / (16 × period)`. The deterministic fixture uses a nominal AY reference clock of **1,021,800 Hz**, matching the CPU nominal clock in the telemetry used to date. It computes each 12-bit period by rounding to the nearest integer. The compiled note data contains expected frequencies and detuning in cents; the verifier cross-references them with the actual captured register history. The exact pitch realized by a hardware chip depends on its actual clock setting and synthesizer model.

| Note | MIDI number | AY tone period | Nominal realized pitch |
|---|---:|---:|---:|
| C4 | 60 | 244 | 261.73 Hz |
| D4 | 62 | 217 | 294.30 Hz |
| E4 | 64 | 194 | 329.19 Hz |
| F4 | 65 | 183 | 348.98 Hz |
| G4 | 67 | 163 | 391.79 Hz |

There are **no sampled PCM instruments** in E1: the sound is determined entirely by register writes. The included `MB06A3_MELODY_GUIDE.mid` encodes the note melody and rhythm; `MB06A3_APPROXIMATE_AUDIO_GUIDE.wav` contains a deliberately simplified square-wave/noise rendition. Neither is a spectral/acoustic golden master. Actual listening and waveform verification require RetroAppleJS AY0 synthesis output (or a separately rendered reference from the shared AY core).

## Memory and instrumentation

| Address | Purpose |
|---|---|
| `$6000–$689D` | 2,206-byte machine program, including 643-byte music E1 data |
| `$0801` to below `$2000` | BASIC loader (checked not to overlap HGR page) |
| `$2000–$3FFF` | HGR page 1 foreground writes in mode 5 |
| `$6F00–$6F2B` | Scheduler scratch; `$6F1F` contains 24-bit HGR counter's top byte |
| `$6FA0 / $6FB8` | 24-byte result record for modes 5 / 6 |
| `$8300 / $8700 / $8B00 / $8F00` | Mode 5 Timer 2 entry low/high, exit low/high (256-sample diagnostic ring) |
| `$9400 / $9800 / $9C00 / $A000` | Mode 6 Timer 2 entry low/high, exit low/high (256-sample diagnostic ring) |
| `$9200 / $A400` | Mode 5 / 6 decoder-span rings |
| `$03FE / $03FF` | Apple Monitor soft IRQ vector; saved/restored |
| `$0045` | Apple Monitor interrupted-A scratch; restored on completion |
| `$C400–$C40E` | Mockingboard first 6522 VIA (physical PR#4) |

The 24-byte result records retain the MB-06A.2 structure. The new 24-bit HGR write count is `result[4] + 256*result[5] + 65536*result[18]`. Without byte 18, a multi-second HGR measurement would silently wrap at 65,536 writes. The 24-bit counter has been verified to exceed that boundary during the simulated melody/HGR run. Elapsed Timer 2 cycles are derived from the two low bytes plus `65536 × result[15]` (software epoch).

The Timer 2 high–low–high snapshot retry from MB-05.1 is retained. The sampled IRQ interior excludes the full Apple Monitor dispatch/return overhead. The 256-entry diagnostic rings hold **only the most recent 256 interrupt samples**, while the independent simulator instruments **all 3,651 IRQs** per mode. The ring itself must not be treated as a full-run maximum.

## Simulated results (not Safari acceptance)

The executable is run with an independent, deliberately limited NMOS 6502/VIA instruction model. It does *not* synthesize sound or substitute for actual RetroAppleJS validation.

| Metric | Mode 5 — melody/HGR | Mode 6 — melody/NOP |
|---|---:|---:|
| Timer 1 IRQs | 3,651 | 3,651 |
| Decoded E1 writes | 150 | 150 |
| Total AY writes including setup/cleanup | 156 | 156 |
| E1 bytes | 643 | 643 |
| Timer 2 epoch | 57 | 57 |
| Total elapsed cycles | 3,739,119 | 3,739,115 |
| HGR writes (24-bit) | 81,662 | 0 |
| Whole-256-cycle late events | 0 | 0 |
| Lost Timer 1 IRQ signals | 0 | 0 |
| Maximum measured IRQ interior (all IRQs) | 610 cycles | 610 cycles |
| Register-history verifier | PASS | PASS |

The worst sampled interior is **610 cycles**, leaving nominal headroom relative to the 1,024-cycle heartbeat, *before accounting for parts of IRQ entry and exit outside the sampled region*. The simulator records zero lost Timer 1 interrupts. There is no claim that 610 cycles is the entire physical IRQ service time.

### Acceptance criteria

The pending Safari capture must confirm exact per-mode register sequence, including all 150 score writes, 14 note periods, five R13 writes, correct R7 noise-to-tone transitions, and no chip 1 writes or in-score resets. Both BASIC modes must finish without errors, lates, or lost epochs. Relative write-timestamp deviations from the first score event must remain within **128 CPU cycles**; this measures **relative drift**, *not absolute IRQ service latency*. HGR throughput should be measured with the 24-bit counter. Finally, a listener should compare the recognizable phrase with the guide MIDI/WAV and comment on relative melody/bass/percussion loudness, note attacks, glitches and any audio scheduler underruns.

## Rebuild and local regressions

```sh
cd ay-score-timing-mb06a3
sh tests/run_all.sh
```

Build steps are deterministic and require only Python 3 and Node.js. Outputs include machine code and source listing, Applesoft loader, a terminal monitor hex dump, canonical E1 JSON, MIDI/WAV listening guides, simulated register history, and self-contained Safari verification HTML. The original accepted MB-06A.2 benchmark remains in its own package and repository files; this phase does **not** replace it.

**Limitations:** only AY0, 1,024-cycle grid timing, embedded score, test-owned Timer 1/Timer 2 and VIA output ports, no DOS streaming or true music player API. Running on actual 6522 hardware may differ from the RetroAppleJS-specific live Timer 2 read semantics. This is an executable research benchmark, not a production driver.
