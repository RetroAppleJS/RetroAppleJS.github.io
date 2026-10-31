# PSID → PT3 feasibility smoke test

This experiment evaluates conversion of Commodore 64 PSID music to Vortex Tracker PT3 for prospective playback through the Apple II Mockingboard.

## Test pipeline

```text
PSID -> Sidtool (6502 playback/extraction) -> MIDI
     -> Spectrumizer (AY arrangement) -> PT3
     -> Spectrumizer software AY WAV
     -> Spectrumizer PT3-to-MIDI round-trip
```

The workflow `.github/workflows/psid-to-pt3-smoke.yml` runs three original, synthetic PSID fixtures (single voice, three pitched voices, and noise/percussion) and three existing repository files:

- `tools/music/B-land_Scrapbook.sid`
- `tools/music/Funtempo.sid`
- `tools/music/Irish_Dream.sid`

It logs every stage, records MIDI note counts and PT3 sizes in the GitHub Actions summary, and uploads all outputs as the `psid-pt3-smoke-output` artifact. A failed conversion for an individual tune is logged and does not prevent testing the others. The workflow requires at least one complete software-validated result.

The original synthetic fixtures are CC0. **Other music files and converted derivatives retain their original rights and licensing.** The test does not authorize distribution of converted music in a public product.

## What passing means

Passing means: at least one PSID file executes in Sidtool, produces a nonempty MIDI file, is encoded as a PT3 module, is rendered by Spectrumizer's software AY implementation, and is decoded by Spectrumizer's reverse converter.

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
