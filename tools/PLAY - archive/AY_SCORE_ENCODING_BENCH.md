# AY Score Encoding Bench — Phase 1.5A

**Version:** 0.1 experimental prototype  
**Project:** RetroAppleJS · SID-to-AY preprocessing translator research  
**Tool:** `tools/AY_SCORE_ENCODING_BENCH.html`  
**Offline source:** `tools/AY_SCORE_ENCODING_BENCH_core.js`  
**Standalone HTML:** `tools/AY_SCORE_ENCODING_BENCH_standalone.html`

## 1. Research question

How should an offline SID-to-AY compiler represent its output so that the Apple II can replay it with acceptable sound synthesis overhead while sharing **CPU cycles**, **main RAM**, **AY channels / shared envelope generators**, and **storage bandwidth** with graphics/game logic?

This phase **does not** translate PSID files or implement a 6502 decoder. It compares five explicitly specified *experimental* binary representations of the **same canonical register-event timeline**. It provides accurate encoded-byte counts and exact decoding checks, plus clearly modeled (not measured) CPU/RAM costs.

### Quick start

1. Open `AY_SCORE_ENCODING_BENCH_standalone.html` in a modern browser **or** open `AY_SCORE_ENCODING_BENCH.html` alongside its sibling `AY_SCORE_ENCODING_BENCH_core.js`.
2. Choose one of six deterministic scenarios, duration, BPM, and random seed.
3. Configure assumed 6502 cycles per AY write, maximum music CPU share, baseline graphics utilization, reserve, timing tolerance, memory budget, and E2 event block size.
4. Press **Generate and benchmark**. Compare five codec rows; select any successful row to view its CPU timeline, memory and binary hex preview.
5. Use **Save selected binary** (`.aysb`), **Export benchmark JSON**, **Export CSV**, or **Export canonical events JSON**.
6. To benchmark measured waveform-synthesis register data, upload a Phase 1.4 `ay-waveform-survey`, `ay-triangle-budget` or `ay-buzzer-phase-lock` JSON. Choose the fixture in **Imported survey fixture**. `E3` is deliberately unavailable for event-only imports without note semantics. `E0/E1/E2/E4` still work.

## 2. The canonical score

All encodings ultimately reproduce an ordered sequence of register writes in Apple II CPU-clock cycles:

```js
{ cycle: 123456, chip: 0, reg: 8, value: 12 }
```

- `cycle`: integer CPU cycles from song start, `uint32`.
- `chip`: `0` or `1` (two AY chips).
- `reg`: `0..15` AY register index.
- `value`: `0..255` written byte.
- **Order matters** for events at the same cycle, particularly R13 retrigger and subsequent volume changes.
- Round-trip fidelity checks `(cycle,chip,reg,value)` for every event in order, including same-cycle events.
- The synthetic score is also represented by higher-level actions, such as `{cycle,type:'on',voice,midi,instrument,volume}`; the built-in synthesis reference deterministically expands them to canonical writes.

No implicit waveform-similarity judgment appears in Phase 1.5A. The encoders target an identical event stream, not an ideal sound or original SID capture. This comparison is about **representation** rather than sound synthesis selection.

### Time conversion when importing AY Waveform Bench

The v1.4 Waveform Bench exports `event.tick` as nanoseconds. Phase 1.5A maps each timestamp to integer 6502 cycles using:

`cycle = Math.round(tick * cpuHz / 1_000_000_000)`

Events that round to the same cycle retain their original order. **This conversion can lose sub-cycle timestamp distinctions;** exact round-trip then refers to the converted CPU timeline, not the original nanosecond timeline. It does not prove that multiple writes at the same requested cycle can execute simultaneously on a 6502.

## 3. Five encoding strategies

All files contain a 36-byte `AYSB` header. Sizes below include that header.

| Codec | Payload | Lossless AY event round-trip | Special considerations |
|---|---|---|---|
| E0 — raw absolute | 4-byte little-endian cycle + 1-byte packed AY id + 1-byte value | Yes | Six bytes per event; trivial reference. |
| E1 — delta | Unsigned LEB128 time difference + AY id + value | Yes | Variable-length decode; consecutive same-cycle writes use a delta of zero. |
| E2 — LZ pattern | Independently decodable event-token blocks, literals and bounded LZ backreferences | Yes | Token compression of recurring AY sequences; max backdistance 128 tokens. |
| E3 — instrument VM | Delta-cycle note-on and note-off commands referring to fixed instruments | Yes, for supported synthetic note scores | Rejects raw imports and arbitrary writes; player must generate waveform updates. |
| E4 — hybrid auto | Instrument VM with direct-write escapes, *or* E2 if smaller | Yes | Chooses a whole-score variant; not yet a fully per-passage adaptive representation. |

**Important distinction:** E4 v0.1 selects the smaller **whole-score** VM/escape or E2 fallback representation. It does *not* yet interleave multiple codec strategies at arbitrary phrase or block boundaries. Fine-grained adaptation is future work.

### E2 specifics

- Convert each event to token `(deltaCycles, packedAYRegister, value)`.
- Partition tokens into blocks of 64–2048 events (UI default: 512).
- Each block independently encodes tokens using a literal command `0` or LZ backreference command `1`.
- LZ history covers up to 128 earlier event tokens **inside the current block**; overlapping copies are supported.
- Backreferences preserve each token's delta timing and register order exactly.
- Block metadata is embedded in the payload (token count and encoded byte count).
- Compression currently uses a bounded greedy three-token hash match with a maximum copy length of 255 tokens, not a globally optimal parser.

### Instrument VM specifics

The v0.1 instrument library defines six procedures:

- `square` — AY tone period and fixed volume;
- `saw` — AY repeating envelope shape `$8`;
- `triangle` — AY envelope shape `$A`;
- `buzzer` — equal envelope/tone frequency by choosing tone period as 16 × envelope period;
- `dac8` — triangular software-volume approximations with 8 time steps per cycle;
- `dac32s` — 32 nominal volume steps, skipping unchanged register values.

These procedural instruments are **illustrative timing workloads**. Their software volume-level curve uses a deterministic square-root step mapping; it is **not** the measured AYCore calibration from Waveform Bench Phase 1.4. They are useful for evaluating event-stream compressibility and scheduling complexity, **not waveform fidelity or optimal R8 tables**.

A fixed six-voice map is part of the experimental VM specification:

`voice 0 = chip 0/A`, `voice 1 = chip 0/B`, `voice 2 = chip 1/A`, `voice 3 = chip 1/B`, `voice 4 = chip 0/C`, `voice 5 = chip 1/C`.

The synthetic scenarios avoid concurrent use of multiple hardware envelope procedures on the same AY chip. Real multi-voice allocation and envelope arbitration are explicitly deferred to Phase 1.5B. A physical player will need initialization and appropriate VIA addressing sequences; those are not included in the decoded canonical events.

## 4. Binary file specification: AYSB v1

All integers are little-endian unless noted; offset is measured in bytes.

| Offset | Size | Contents |
|---|---:|---|
| 0 | 4 | ASCII `AYSB` |
| 4 | 1 | Format version `1` |
| 5 | 1 | Codec id: `0..4` |
| 6 | 1 | Reserved flags = 0 |
| 7 | 1 | Reserved = 0 |
| 8 | 4 | 6502 CPU clock frequency in Hz |
| 12 | 4 | AY chip clock frequency in Hz |
| 16 | 4 | Total score duration in CPU cycles |
| 20 | 4 | Expected number of expanded AY register events |
| 24 | 4 | Number of original actions (0 for imports) |
| 28 | 4 | Payload byte length |
| 32 | 4 | FNV-1a 32-bit checksum of payload, for accidental corruption detection |
| 36 | n | Codec-specific payload |

The checksum is **not cryptographic**. The browser decoder validates the header, length, checksum, event counts and key opcode bounds. File formats may change in later prototypes; `.aysb` v1 should not yet be treated as a stable public interchange standard.

### E0 payload

For each of `eventCount` events: `cycle` (`uint32`), `packedId` (`uint8`), `value` (`uint8`). `packedId = chip*16 + register`.

### E1 payload

For each event: `deltaCycle` (`unsigned LEB128`), `packedId` (`uint8`), `value` (`uint8`). The accumulator begins at `cycle=0`.

### E2 payload

`blockCount` (`ULEB128`), followed by blocks:

- `decodedTokenCount` (`ULEB128`)
- `encodedByteLength` (`ULEB128`)
- Repeated commands until block byte length is exhausted:
  - `0x00` **literal:** `numberOfTokens` (`ULEB128`), followed by that many E1 event tokens;
  - `0x01` **backreference:** `backDistance` (`ULEB128`, 1–128), `tokenCount` (`ULEB128`, 4–255).

No backward reference may cross an E2 block boundary. The event **cycle** accumulator does span blocks.

### E3 payload

A list of `actionCount` commands, each prefixed by `deltaCycle` (`ULEB128`) and a one-byte command:

- `0x01` NOTE_ON: `voice`, `MIDI note`, `instrument id`, `volume` (four bytes);
- `0x02` NOTE_OFF: `voice` (one byte).

Each command expands to AY register writes using the built-in procedure library. An actual 6502 implementation must have equivalent fixed procedure semantics to reproduce the same event stream.

### E4 payload

One variant marker followed by its payload:

- `0x00`: E2 payload, as described above.
- `0x01`: extended E3 payload, additionally accepting `0x03` DIRECT_WRITE followed by `packedId,value`.

For the reference encoder, E4 selects whichever complete payload is smaller. It chooses the E2 fallback for event-only imports.

## 5. CPU and graphics scheduling model

`simulateSchedule` uses a **fluid-share approximation**, not instruction-level 6502 timing:

1. A write event becomes due at its `cycle` timestamp.
2. Each write requires the configurable VIA/AY cost (default **50 cycles per logical AY write**) plus an assumed decoding/scheduling cost.
3. Instrument-VM commands additionally require modeled execution at their command timestamps; NOTE_ON defaults to 95 cycles, NOTE_OFF to 55, direct write escape to 40.
4. CPU availability is capped at `min(musicBudget, 100% - graphicsLoad - reserveLoad)` per 20 ms frame. The action and burst profiles vary graphics load periodically.
5. Work can run only when due; queued work is processed in order. The scheduler measures elapsed cycles before completing each write and counts a deadline miss if completion exceeds `event.cycle + tolerance`.
6. The tool reports average consumed cycles, average CPU %, **peak 20 ms demanded CPU %**, frames over their budget, completion lateness and missed deadlines.

**Interpret cautiously:** Fluid-share service produces useful upper-level stress tests but cannot model exact ISR ordering, 6502 instruction latency, graphics blanking intervals, co-processor behaviour, disk stalls, VIA handshake sequences or bus conflicts. The E2 per-event decoding cost is an **amortized model**; E3/E4 note command costs are individually placed at command timestamps. The tool does not guarantee real-time playback, even when it reports no misses.

## 6. Memory model

The comparison reports:

- `scoreBytes`: actual bytes in the encoded `AYSB` file;
- `playerCodeBytes`: estimated fixed decoder/player footprint by codec;
- `instrumentBytes`: estimated resident instrument tables and procedures used by VM variant;
- `workingRamBytes`: estimated state, voice objects and bounded E2 history;
- `streamBuffersBytes`: two times the independent configured *stream buffer size in bytes* (default 512 bytes per half);
- `fullyResidentBytes = scoreBytes + playerCodeBytes + instrumentBytes + workingRamBytes`;
- `streamingResidentBytes = playerCodeBytes + instrumentBytes + workingRamBytes + streamBuffersBytes`.

**Block versus buffer distinction:** The UI's `chunkSize` configures **E2 event tokens per compressed block**. The independent `streamBufferBytes` configures the **byte capacity of each of two hypothetical I/O buffers**. E2 history is bounded to 128 decoded tokens inside each pattern block; the decoder itself consumes an encoded stream incrementally. The displayed streaming footprint is still only a planning estimate. There is no implemented disk loader or asynchronous prefetch and no measurement of worst-case bytes demanded per frame. A streaming-capable production player will need careful buffer refill and decoder-state management.

The RAM budget input marks which models would fit a specified allowance. It is not an automatically discovered Apple II free-memory map. One or both HGR pages, language cards, DOS, game logic, sprites and other allocations must be budgeted externally.

## 7. Synthetic workloads

Six deterministic workloads, with a configurable seed, tempo, duration and clocks:

| Scenario | Main stressor |
|---|---|
| Chord | Long DAC note overlapping a hardware square and triangle envelope; sustained high-rate writes. |
| Arpeggio | Short, rapidly retriggered notes; many instruction commands. |
| Bass | Repeated sparse-32-step bassline; compression patterns. |
| Mixed | Overlap of DAC, square and phase-locked buzzer; mixed resources. |
| Ambient | Long gaps and sparse notes; efficient delta timing. |
| Action | DAC/square/buzzer with extra direct AY writes; tests E3 rejection and E4 escapes. |

The pseudorandom generator uses a fixed linear congruential recurrence with a supplied unsigned seed. The browser and Node reference implementations return identical event order and encoded binary for the same parameters.

## 8. Acceptance tests

Run:

```bash
node --test tests/ay_score_encoding_bench.test.js
```

Tests include E0–E4 exact byte-stream decoding, deterministic workloads, same-cycle order, two-chip id preservation, E2 block boundaries, LZ repetitions, VM eligibility, deliberate corruption, timing-model monotonicity, resource accounting, and import of real exported Phase 1.4 waveform-event data (when the files are present). A browser smoke test covers generation, rerunning model parameters, editing options, JSON survey import and selecting individual survey cases.

The `examples` folder includes deterministic generated benchmark reports, CSV, and a small E3 example binary. These are **illustrative simulation outputs**, not measured 6502 execution statistics.

## 9. Known limitations and recommended next research work

- **The binary spec is a prototype**, with JS encoders and decoders only. A cycle-counted 6502 decoder/score executor is not implemented.
- **No native PSID parser, SID emulator or audio renderer.** Phase 1.5A accepts synthetic note actions and Waveform Bench AY register exports.
- **No perceptual score or spectral fidelity claims.** Phases 1.1–1.4 covered AY waveform approximation separately.
- **No real filesystem streaming.** Streaming RAM and throughput are planning metrics; seek latency and I/O contention remain unmeasured.
- **No fully adaptive hybrid:** E4 makes a whole-score encoding choice. Phrase/block selection is suitable for Phase 1.5B.
- **CPU costs and code sizes must be measured** with real assembly, VIA access, interrupt dispatch and graphics workload telemetry before production recommendations.
- **Event deadlines are theoretical:** multiple scheduled writes at identical timestamps cannot be literally simultaneous on the 6502; the model reports late completion.
- **Instruments are illustrative:** fixed channel assignment, simplified DAC amplitudes, and limited envelope arbitration.
- **Runtime memory footprint estimates** must be reconciled with executable code bytes, scratch RAM, stack/zero-page usage and real double-buffer requirements.

### Phase 1.5B hand-off

The next optimizer can use Phase 1.5A's Pareto comparisons to choose among codec + instrument combinations, considering RAM limits, music CPU cap, peak timing, shared AY resources and application-specific graphics demands. The next prerequisite for dependable figures is a small 6502 decoder microbenchmark exercising realistic Mockingboard VIA register writes.
