# AY Score Encoding Bench v0.1 — Phase 1.5A

Standalone experimental music score encoding, decoding, memory and timing bench for the RetroAppleJS SID-to-AY translator research.

## Run in a browser

**Simplest:** open `tools/AY_SCORE_ENCODING_BENCH_standalone.html` (single HTML file; no external scripts or network required).

**Modular:** open `tools/AY_SCORE_ENCODING_BENCH.html` (requires companion `tools/AY_SCORE_ENCODING_BENCH_core.js` in the same folder).

The five encoders are E0 raw absolute, E1 delta varint, E2 bounded event-pattern LZ, E3 procedural instrument VM, and E4 hybrid VM+direct / event fallback. Six synthetic scenarios and v1.4 Waveform Bench JSON event imports are supported. The UI exports binary `.aysb`, aggregate JSON, CSV and canonical event JSON.

## Test

```bash
node --test tests/ay_score_encoding_bench.test.js
```

No dependencies are needed for the Node tests. See `docs/AY_SCORE_ENCODING_BENCH.md` for full API, binary layout, limits, instrument semantics, memory accounting, timing model and known limitations.

**Evidence levels:** Byte counts and event-sequence round trips are computed facts for the generated binary. Estimates of 6502 decode/player size, required RAM, scheduler overhead and graphics coexistence are *models*, not instrumented hardware measurements. This tool does not convert or play PSID files, generate sound, or modify RetroAppleJS emulator/peripheral code.
