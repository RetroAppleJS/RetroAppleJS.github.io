# SID Expansion Card — PCODE `SID` (initial implementation)

The SID card models an Apple II expansion PCB hosting a MOS 6581 or MOS 8580. Its **peripheral controller** (`res/EMU_CARD_SID.js`) handles Apple II address decoding, configuration and bus access. Its **attached audio device** (`res/EMU_DEVICE_SID_audio.js`) owns **all SID oscillator/envelope/filter synthesis, sampling, audio buffering and Web Audio output**. There is no audio synthesizer or browser audio context in the card class.

## Installation

Select **MOS 6581 / 8580 SID synthesizer** from the Slot Manager (PCODE `SID`), preferably slot 4. The card is not installed by default; the audio device `SIDAUDIO` is automatically attached when the card is mounted. Use the existing emulator speaker/audio control to activate the output.

The slot toolbox has:

- **SID model:** 6581 or 8580; default 6581.
- **Clock:** NTSC 1022727 Hz (default) or PAL 985248 Hz.
- **Native $D400 writes:** enable/disable passive CPU write listening; enabled by default.
- **Volume:** output volume 0–100%.

The PAL/NTSC selector chooses the **SID sound-chip oscillator frequency**, independently of the Apple II+ motherboard video standard. RetroAppleJS defaults the SID card to NTSC, consistent with its NTSC Apple II+ configuration; PAL remains available for PAL-tuned SID music. Model, clock and volume survive a card soft reset, but page reloads initialize them to the defaults.

## How native SID writes work

The normal Apple II `Apple2Hw.write()` dispatcher completes the original motherboard ROM/Language Card write, **then** publishes writes in `$D400–$D41F` to mounted PCODE `SID` cards. No HostROM mapping or `/INH` emulation is used, so other expansions keep their memory mapping.

```asm
LDA #$41      ; Pulse + GATE
STA $D404     ; SID voice 1 control register (no C64 address patching)
```

**Important:** If an MS16K/Language Card has writable RAM active at `$D400`, the same write also modifies that RAM. This is the expected hardware-visible behavior of a passive listener. The card does not attempt to inhibit or override the memory write. Program execution and SID initialization remain the 6502 software's responsibility.

The card intentionally **does not intercept reads** at `$D419–$D41C`: motherboard ROM or language-card memory retains ownership of these reads. Compatible SID readback is provided through the slot I/O interface.

## Slot I/O registers

In slot `n`, use `$C080 + n*16` through `$C08F + n*16` (for slot 4: `$C0C0–$C0CF`).

| Offset | Read | Write |
|---|---|---|
| 0 | Signature `$53` ('S') | — |
| 1 | Flags: bit 0 enabled, bit 1 snoop, bit 2 8580, bit 3 audio attached | — |
| 2 | Selected SID register (0–31) | Select register (0–31) |
| 3 | Selected SID register read (write-only registers return `$FF`) | Write SID register |
| 4 | Model: 0=6581, 1=8580 | Select model (bit 0) |
| 5 | Clock: 0=PAL, 1=NTSC | Select clock (bit 0) |
| 6 | Card enabled status | Enable/disable (bit 0) |
| 7 | Passive snoop status | Enable/disable snooping (bit 0) |
| 8 | POTX (unconnected: `$FF`) | — |
| 9 | POTY (unconnected: `$FF`) | — |
| A | OSC3 (approximate) | — |
| B | ENV3 (approximate) | — |
| C | Last intercepted register offset | — |
| D | Last write value | — |
| E | Low byte of snooped write count | — |
| F | High byte of snooped write count | — |

Example for slot 4:

```asm
LDA #$00
STA $C0D4    ; Select 6581 (0), or use #$01 for 8580
LDA #$04
STA $C0C2    ; SID control register index $04
LDA #$41
STA $C0C3    ; Write pulse + GATE to voice 1
```

## Sound engine — revision 1

The audio device is a preliminary synthesizer running at 22,050 Hz with three oscillators, frequency/width registers, triangle, sawtooth, pulse and pseudorandom noise, basic ADSR, gate and TEST, basic sync/ring approximations, rudimentary filter routing and master volume. The model selector changes the preliminary filter curve. **The 6581 and 8580 are not yet faithfully modeled.** Resonance, mixed-waveform interactions, noise LFSR details, true envelope quirks, analog filter behavior, 6581 DAC nonlinearity and cycle-exact sample playback remain future work.

The browser AudioContext is created only when the normal emulator audio output is activated. The device retains the CPU-tick-to-sample timeline and owns its PCM queue and playback source scheduling. Disabling output does not require replacing or restarting the peripheral.

## Deliberate first-version limitations

- **No native PSID loader, 50/60 Hz interrupt player or C64 memory environment** yet. The card works when Apple II software itself writes SID registers.
- Only **one SID chip** is supported. Multi-SID PSIDs require a later architecture extension.
- Native `$D400` **write** interception only; reads must use slot I/O.
- Live sid-bus snooping is routed via `Apple2Hw.write()` in the JavaScript CPU. The separate flat-memory **WASM CPU accelerator** bypasses live bus callbacks and therefore does not support native SID output in this revision.
- Audio filter is a coarse approximation of the two chips. Neither model claims cycle-accurate 6581 or 8580 output.

## Files

- `res/EMU_CARD_SID.js`: card identity, PCODE, SlotIO, passive write interception and toolbox.
- `res/EMU_DEVICE_SID_audio.js`: chip and audio-sink implementation.
- `res/EMU_apple2hw.js`: single passive global SID-write notification point.
- `res/EMU_apple2io.js`: dispatch to mounted SID cards.
- `docs/CONFIG.md` and `res/COM_CONFIG.js`: PSLOT registration.
- `tests/sid_card.test.js`: bus, slot controls, model selection and synthesis smoke tests.


## Phase 1 native diagnostic and minimal PSID fixture

See [SID Phase 1](SID_PHASE1.md) for the native Apple II assembly diagnostic,
the same 6502 music routines packaged as a PSID v2 file for jsSID,
a reproducible Base64 fixture and integration tests covering waveforms,
oscillator TEST, ring modulation, hard sync, filter routing and GATE.
This is a diagnostic music driver, not a general C64 PSID loader.

## Audio scheduler continuity at low display frame rates

The device-owned Web Audio scheduler drains as many queued SID PCM blocks as
needed per processing cycle, up to a bounded 150 ms scheduling horizon. Each
block is at most 2,048 samples (92.88 ms at 22,050 Hz), but a 10 FPS emulator
cycle can generate approximately 2,205 samples (100 ms). Scheduling only one
block per cycle previously starved playback at 10 FPS.

`SIDAUDIO.getAudioStats()` exposes `underruns`, `lateSeconds`,
`blocksScheduled`, `maxQueueDepth`, `queuedMs` and `scheduledLeadMs`
alongside the existing `queued`, `dropped`, `produced` and `scheduled`
counters. An underrun indicates the next scheduled block was already in the
past when new data arrived. Audio-off still cancels and flushes all buffered
audio. The test in `tests/sid_card.test.js` verifies gap-free buffers during
20 consecutive simulated 10 FPS cycles.


## Phase 2A — Unmodified native Mr. Heli music

See [SID Phase 2A](SID_PHASE2A.md) for the first foreground player executing
the original 4,715-byte Mr. Heli C64 music program directly on the Apple II
6502. It calls the original INIT and PLAY routines, writes native $D400 SID
registers and restores Apple II zero page on keypress. No SID-to-AY conversion,
C64 emulation or changes to EMU_CARD_SID / EMU_DEVICE_SID_audio are required.


## SID ADSR articulation improvement

The native Mr. Heli Phase 2A test revealed notes lingering into later notes even
though the original 6502 player correctly toggles the SID voice GATE bits.
The original `SIDAUDIO` used one floating-point, **linear envelope ramp** per
voice; decay and release remained too prominent until the very end.

`EMU_DEVICE_SID_audio.js` now uses a **0–255 envelope counter**, 15-bit SID
rate timing and the standard six stepped exponential decay/release dividers
from the reSID envelope model. Clocking uses the selected PAL/NTSC *SID chip*
frequency and occurs at the audio sample times; no changes are made to
Apple II CPU timing, the native SID register bus, or the foreground PSID
player. GATE transitions switch stages, TEST resets the oscillator without
clearing the envelope, and note-on can retrigger attack from a partial release.
The 15-bit counter is preserved across rate changes to approximate the
documented SID ADSR delay behavior.

For example, on a fully raised envelope with a release nibble of `$9`, the
new renderer drops to approximately **155/255 after 100 ms**, **38/255 after
300 ms**, and **0 by approximately 800 ms**, instead of a linear fade which
would remain much louder. The sound should stop masking subsequent notes much
earlier, although the underlying release still has the proper quiet tail.

For diagnostics, `getEnvelopeLevels()` returns a snapshot of the three raw
ADSR counters (0–255). `tests/sid_card.test.js` includes the release curve,
GATE retrigger, oscillator TEST, and sustain-change regressions.

This is an **ADSR-focused** correction, not a complete reSID port. The SID
analog filter, combined waveforms, some oscillator/noise details and possible
subsample GATE transition effects remain approximations.


## SID live audio telemetry

The **Telemetry** button in the SID peripheral toolbox opens a live popup
following the Mockingboard audio-control conventions: automatic refresh
(nominally 500 ms), pause/resume, non-destructive statistics Reset, and JSON
export of the latest 120 snapshots (approximately 60 seconds).

Exports use the format **RetroAppleJS.SIDAudioTelemetry**, version 1, in a file
named **SID_slot4_audio_telemetry.json** for a SID installed in physical slot 4.

| Field | What it measures |
|---|---|
| CPU WALL PACE (%) | Emulated CPU ticks per wall-clock second relative to nominal 1.0218 MHz; a slowdown can indicate browser/emulator stalls |
| CPU PC / INS | Most recently sampled 6502 instruction; does not reliably catch short PLAY calls |
| NATIVE SID WRITES / RATE | Accepted $D400–$D41F writes and their wall-clock rate |
| WRITE BURSTS / RATE | Clusters of SID writes separated by more than 3,500 emulated CPU ticks (~3.4 ms); NOT proof of a specific PLAY call |
| BURST INTERVAL LAST / MIN / MAX | Emulated-CPU-time spacing between bursts; about 20 ms is typical for an active 50 Hz Mr. Heli music frame |
| BURST INTERVAL SHORT / LONG | Number of gaps below 70% or above 140% of the nominal 20,436-tick frame; **heuristic only** |
| VOICE GATE / ENVELOPE | GATE state and current 0–255 envelope level for each of the three voices |
| PCM PRODUCED / SCHEDULED / DROPPED | Sample generation, Web Audio scheduling and overflow counts |
| PCM FIFO / CAPACITY | Samples waiting for Web Audio |
| BROWSER LEAD NOW / MIN / MAX | Milliseconds of sound already scheduled ahead of the browser clock |
| UNDERRUNS / LAST / WORST | Count and severity of browser playback deadlines missed |
| ACTIVE BROWSER SOURCES | Queued browser AudioBufferSource objects not yet finished |

### Investigating rare tempo glitches

Run Mr. Heli subtune 5 (CALL 8192), open **SID → Telemetry**, and export the
JSON **after hearing a glitch**, preferably without resetting statistics.

- If underruns increase, dropped samples rise, or browser lead collapses,
  investigate the audio queue and scheduling path.
- If CPU wall pace falls below its normal value while the intervals between
  SID write bursts remain regular in *emulated* time, the host/emulator likely
  stalled temporarily.
- If SID write bursts show unusual gaps without any underrun, investigate CPU
  scheduling and the original music calls. A legitimately silent music frame
  or tempo change can produce the same burst pattern.
- If timing is stable but sound still lingers, inspect voice GATE/envelope
  levels and the remaining SID waveform/filter approximation.

Telemetry refresh is passive: it must never render additional SID samples,
clear the PCM queue, or alter 6581/8580 phase or envelope state. **Reset**
resets only statistics, not playback.


### Comparing against standalone SIDchipJS

The reference page `tools/SIDchipJS.html` provides two playback selectors:

- **PAL (50 Hz, 985,248 Hz SID clock)** or **NTSC (60 Hz, 1,022,727 Hz SID clock)**. This changes both the C64 CPU/SID clock and the VBI-driven PSID PLAY cadence. CIA-timed tunes instead use their timer period divided by the selected C64 clock.
- **44.1 kHz (44,100 samples/s)** or **22.05 kHz (22,050 samples/s)**. The tool requests this sample rate from the Web Audio context before initializing the jsSID synthesis loop. It uses the browser's *actual* context rate for synthesis if the requested rate is unavailable.

Changing either selection closes the old Web Audio context and reloads **the currently selected subtune**, preserving the active/paused playback state, volume, and explicitly selected SID model. It restarts song playback and resets tool telemetry history (rather than silently combining statistics from different timing/rate configurations).

The standalone telemetry JSON retains the `RetroAppleJS.SIDAudioTelemetry` version 1 envelope and additionally stores `source: "SIDchipJS"`, `videoStandard`, `requestedSampleRate`, effective `audio.sampleRate`, `sid.frameRate`, and `sid.playCallHz`. Its CPU/burst times use the selected **C64 clock**, unlike the emulator's Apple II CPU ticks. Compare timings in milliseconds or hertz, not raw CPU ticks. The tool uses `ScriptProcessor`, so emulator FIFO/lead/AudioBufferSource underrun fields remain `null`; do not interpret them as zero.


### SID 10 FPS audio flow control and 50 Hz native clock

The SID output path services **Web Audio independently of screen refresh**
using a lightweight audio-only callback approximately every **10 ms of
wall time** (10,218 emulated CPU ticks at 100%, proportionally scaled for
other CPU speeds). At 10 FPS, the normal 100 ms processing slice therefore
provides approximately **10 opportunities** to drain pending PCM before the
next screen refresh; VBLANK continues its regular per-frame service. Audio-only
callbacks never update peripheral UIs, disk state or screen rendering, and
preserve the original SID register-write ordering.

The SID sound source now follows the CPU-speed setting: at 200% / 400% CPU,
Web Audio plays the synthesized SID samples at 2x / 4x their nominal rate,
accelerating music tempo and pitch with the emulated CPU. The CPU audio-budget
guard remains active to prevent unbounded buffering, but it computes **both
queued and scheduled audio in wall-time duration at the selected playback
rate** (maximum 500 ms), rather than mistaking expected turbo audio production
for an overload. Larger Web Audio buffers at high speed reduce source-node
creation overhead. Host CPU limitations can still prevent extreme turbo
speeds, but merely mounting the SID must not force normal-speed playback.
The actual multiplier is reported as `cpuPlaybackRate` in audio stats.

**FIFO overflow telemetry:** a new `fifo_overflow` event records the first
lost sample of each continuous overflow with CPU tick, Web Audio timestamp,
FIFO occupancy, scheduled lead and sample counters. A matching
`fifo_overflow_end` event records the number of samples lost in that burst.
The SID popup also displays overflow incidents and audio-service / CPU-budget
counters. Download JSON after a suspected glitch to inspect `audioEvents`.

**Phase 2A exact music clock:** A RetroAppleJS-specific **read-only 16-bit
CPU tick snapshot** is exposed using the SID card's indexed SlotIO data
register. Select index `$1E` through `$C0n2` then read `$C0n3` to
latch/read the low byte; select `$1F` and read the same data register to
retrieve the high byte of that snapshot (n = physical slot + 8 in hex, e.g.
slot 4 uses `$C0C2/$C0C3`). This is **not** an original 6581/8580 feature
and is **not** guaranteed by physical SID cards. The native driver
auto-discovers the slot and advances its absolute playback deadline by
**20,436 Apple II CPU cycles** each frame for 50.000 Hz music timing.
Original `$D400–$D41F` code and SID audio synthesis are unchanged.

Rebuild with `node tools/SID_Phase2A_build.js` and reload the new raw
driver binary at `$2000`; the original staged Mr. Heli PSID at `$6000`
remains unchanged. See [SID Phase 2A](SID_PHASE2A.md) for the updated memory
map and entrypoints. Existing older 500-byte players still use the previous
fixed-delay timing until replaced.

## Phase 2B.1 — Generic PSID v1/v2 staging and native playback

Phase 2A (original Mr. Heli) is complete. **Phase 2B.1** introduces a
generic, host-validated PSID loader while retaining native 6502 INIT/PLAY
execution and unchanged `$D400–$D41F` writes.

- Stage any compatible complete PSID file anywhere inside **`$2000–$8FFF`**
  (28 KiB total **including the header**, not 28 KiB of executable plus
  a header). A selected file's original execution address remains authoritative.
- Start at **`CALL 7168`** (public jump table `$1C00`); a protected player
  runtime at `$9000` avoids collision with original Mr. Heli bytes near
  `$1C00`. The runtime is separate from the staging window.
- `tools/SID_Phase2B1_build.js` validates PSID v1/v2, selects a subtune,
  checks memory layout and 50/60 Hz VBI timing, and emits a descriptor
  plus ready-to-enter Apple II monitor images.
- The 6502 checks a **payload checksum in staged RAM before copying**,
  copies overlapping ranges in the correct direction, starts the original
  INIT/PLAY and restores zero page and the `$1C00` jump table on exit.
- PSIDs needing CIA timers, multiple SID chips, RSID/C64 ROM, PlaySID
  samples, BASIC startup or IRQ-defined PLAY routines are not supported
  in this milestone; header validation cannot detect every C64 dependency.

See **[Phase 2B.1 user/developer guide](SID_PHASE2B1.md)** for memory
layout, file preparation, error codes, first-play commands and limitations.

## Phase 2B.2 — Native PSID v1/v2 player with raw file transfer

**The Apple II assembly is the sole PSID parser and player.** The browser
PSID window transfers a complete raw `.sid` file into available contiguous
Apple II RAM and records only the file start address and exact byte count.
It does not parse the file, choose subtunes or control playback.

Load the assembled Phase 2B.2 player binaries at `$1C00` and `$9000`,
transfer a PSID through **Tools → Peripheral controls → SID → PSID**,
then type `CALL 7168` at the Applesoft prompt. The **Apple II itself**
requests or confirms the file's start address, reads PSID v1/v2 metadata,
displays the number of subtunes, requests the desired subtune, validates
the executable payload, and runs its original INIT/PLAY code. Any key
stops playback. No Node installation is needed: native player binary
images and monitor listings are produced as GitHub CI artifacts from
`asm/AUDIO/SID_PHASE2B2_NATIVE_PLAYER.S`.

See **[Phase 2B.2 native player guide](SID_PHASE2B2.md)** for the memory
map, eight-byte transfer record, supported formats and limitations.
