# PSID → PT3 feasibility smoke test

This experiment evaluates conversion of Commodore 64 PSID music to Vortex Tracker PT3 for prospective playback through the Apple II Mockingboard.

## Native RetroAppleJS extraction (PR #271)

The replacement removes Sidtool and the Ruby/MOS6510 dependency:

\`\`\`text
PSID -> RetroAppleJS res/jsSID.js (headless 6510 execution)
     -> 25 SID-register snapshots per 20 ms at 50 Hz
     -> tools/SID_Register_To_MIDI.cjs (MIDI type 1, three voices + noise drums)
     -> Spectrumizer -> PT3 -> software AY WAV and PT3->MIDI cross-check
\`\`\`

The capture runs in a separate headless VM with **the repository's own**
\`jsSID.captureSIDFrames()\`. MIDI note pitches are derived from the PAL SID
register frequency and CPU clock, not guessed by FFT. SID voices stay on MIDI
channels 1–3; pure SID noise is emitted on percussion channel 10. Repeated
frequency changes only retrigger when the rounded pitch changes substantially;
small vibrato is ignored. Noise mapping (kick/snare/hat) and velocity are
heuristic.

Requirements: Node 22+, Python 3.10+ for Spectrumizer. No Ruby required.

\`\`\`sh
python3 -m pip install spectrumizer
node --test tests/psid_to_midi.test.cjs
node tools/SID_PSID_TO_MIDI.cjs tools/music/B-land_Scrapbook.sid \
  --seconds 16 --out /tmp/B-land.mid
spectrumizer /tmp/B-land.mid --style faithful -o /tmp/B-land.pt3
spectrumizer-play /tmp/B-land.pt3 --no-play -o /tmp/B-land.wav
\`\`\`

The converter creates a machine-readable \`.mid.json\` report containing
per-voice note and modulation counts, and warnings such as active filters or
a muted master volume. A silent master volume is **not** used to discard gate
events, so musical information can be recovered from intentionally muted or
incomplete test files.

This version deliberately rejects RSID, CIA-clocked subtunes and explicit
NTSC-only PSID; the current capture is a PAL 50 Hz snapshot path, not a
cycle-exact bus-write recorder. Transient gates between snapshots, PWM,
SID filtering, ring modulation, hard sync, detailed ADSR and waveform
transitions cannot be faithfully reproduced in the resulting MIDI.
The workflow does not yet independently validate Vincent Weaver's Apple II
PT3 assembly decoder or hardware pitch. **Passing software PT3 playback is not
the same as native Mockingboard verification.**

---

### Native experiment — 31 October 2026

[GitHub Actions run 41183305734](https://github.com/RetroAppleJS/RetroAppleJS.github.io/actions/runs/41183305734) executed the native register-capture pipeline. **6/6** inputs converted to PT3, rendered to a 15-second WAV preview, and passed Spectrumizer's reverse PT3 parsing. All six Node regression tests passed.

| Input | Native MIDI note-ons | PT3 reverse-export note-ons | PT3 bytes |
|---|---:|---:|---:|
| Original saw scale | 50 | 50 | 898 |
| Original 3-voice | 150 | 150 | 1,288 |
| Original noise/percussion | 150 | 150 | 1,331 |
| B-land Scrapbook | 536 | 286 | 1,159 |
| Funtempo | 531 | 256 | 1,289 |
| Irish Dream | 565 | 277 | 1,079 |

The **original fixtures** preserve the per-channel note-on pitch distribution and total count after PT3 conversion and reverse export. Their PSID master-volume register is zero, meaning they test **event recovery**, not audible equivalence to the source SID (which is muted). The generated AY WAVs are non-silent. The three repository songs are not close to lossless: Spectrumizer's 3-voice arrangement/quantization reduces note-on counts markedly, and SID instrument/filter fidelity has not been established by listening. Those reductions are not solely attributable to extraction.

The native extractor succeeds on **Funtempo** and **Irish Dream**, where the prior Sidtool-based extraction failed with \`pokeDigi\` errors. Noise-to-drums mapping is heuristic; some fast pitch motion creates frequent MIDI note changes. This is a proof of feasibility, **not** a claim of faithful SID-to-AY transcoding or native Apple II 6502 playback.

## Historical Sidtool baseline (PR #270)

The section below documents the earlier Sidtool experiment and is retained
only to compare extraction quality; the active CI pipeline no longer uses
Sidtool.

## Test pipeline (historical)

```text
PSID -> Sidtool (6502 playback/extraction) -> MIDI
     -> Spectrumizer (AY arrangement) -> PT3
     -> Spectrumizer software AY WAV
     -> Spectrumizer PT3-to-MIDI round-trip
```

The original workflow `.github/workflows/psid-to-pt3-smoke.yml` runs three original, synthetic PSID fixtures (single voice, three pitched voices, and noise/percussion) and three existing repository files:

- `tools/music/B-land_Scrapbook.sid`
- `tools/music/Funtempo.sid`
- `tools/music/Irish_Dream.sid`

It logs every stage, records MIDI note counts and PT3 sizes in the GitHub Actions summary, and uploads all outputs as the `psid-pt3-smoke-output` artifact. A failed conversion for an individual tune is logged and does not prevent testing the others. The workflow requires at least one complete software-validated result.

The original synthetic fixtures are CC0. **Other music files and converted derivatives retain their original rights and licensing.** The test does not authorize distribution of converted music in a public product.

## What passing means

For the historical baseline, passing meant: at least one PSID file executed in Sidtool, produces a nonempty MIDI file, is encoded as a PT3 module, is rendered by Spectrumizer's software AY implementation, and is decoded by Spectrumizer's reverse converter.

**It does not establish** native compatibility with Vincent Weaver's 6502 [pt3_lib](https://github.com/deater/dos33fsprogs/tree/master/music/pt3_lib), accurate pitch on the 1 MHz Mockingboard, matching timbres, CPU use, or IRQ/HGR coexistence.

## Next validation after a working conversion

1. Load a generated PT3 module using the unmodified Apple II `pt3_lib` player.
2. Record 50 Hz VIA timer-1 interrupts, the AY register writes, and IRQ execution cost in RetroAppleJS.
3. Compare audible pitch against the reference; verify the source AY clock conversion.
4. Re-run while HGR is active and report frame rate, IRQ jitter and register-write timing.
5. Evaluate an instrument mapping beyond MIDI: SID ADSR, pulse-width, noise and filter behavior.

## Local command equivalents

```sh
gem install sidtool
python3 -m pip install spectrumizer

sidtool --frames 800 --format midi --out /tmp/song.mid tools/music/Irish_Dream.sid
spectrumizer /tmp/song.mid --style faithful -o /tmp/song.pt3
spectrumizer-play /tmp/song.pt3 --no-play -o /tmp/song.wav
spectrumizer-export /tmp/song.pt3 -o /tmp/song.roundtrip.mid
```

These are feasibility tests, not a quality guarantee. Sidtool is a restricted PSID interpreter: it assumes PAL VBI timing, and does not support RSID/CIA-timed playback.

## Initial experiment results (2026-10-30, workflow 41137481209)

The PR workflow **completed the conversion step successfully**. It processed 800 PAL frames (16 seconds) per song. The counts below are MIDI note-on events **before and after** conversion to PT3 and export back to MIDI. A reduced count is not a direct measure of subjective musical fidelity: pitch-bend-derived notes and channel reassignment may also be involved.

| Input | Sidtool MIDI note-ons | PT3-to-MIDI note-ons | PT3 size | Result |
|---|---:|---:|---:|---|
| 01_saw_scale (original) | 50 | 50 | 895 B | Software render succeeds; note pitches preserved |
| 02_three_voices (original) | 150 | 150 | 1,279 B | Software render succeeds; note pitches preserved |
| 03_noise_percussion (original) | 150 | 150 | 1,279 B | Software render succeeds; note pitches preserved; **noise timbre not validated** |
| B-land_Scrapbook (repository) | 685 | 299 | 1,126 B | Software render succeeds; note-event count reduced 56.4% |
| Funtempo (repository) | — | — | — | Sidtool crashes: missing `Sidtool::Sid#pokeDigi` method |
| Irish_Dream (repository) | — | — | — | Same missing `pokeDigi` method |

The **three original fixtures preserve all note pitches** in Spectrumizer's MIDI round-trip; both MIDI and WAV files are available in the workflow artifact. However, a round-trip via Spectrumizer's own encoder/decoder is not an independent PT3 compatibility proof.

The B-land extraction additionally logs many `Unknown waveform: 9` warnings from Sidtool. This demonstrates that successful file creation does not establish accurate SID instrument reconstruction. The two failures occur in the Sidtool/MOS6510 pipeline before Spectrumizer is invoked.

**Interim decision:** keep PT3 as a promising playback format, but do not choose Sidtool as a general-purpose PSID extractor. The next experiment should use RetroAppleJS's existing SID execution/register tracing as the source of musical events, and independently check the generated PT3 with Vincent Weaver's 6502 player and Mockingboard clock conversion.

Artifacts: [GitHub Actions run 41137481209](https://github.com/RetroAppleJS/RetroAppleJS.github.io/actions/runs/41137481209).
