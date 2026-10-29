# Mockingboard — source-rate WAV capture

The Mockingboard's peripheral control toolbox can record **unsigned 8-bit mono PCM
at 22,050 Hz**. The recording is taken from the emulated sound stream immediately
after the two AY chips and SSI-263 speech are mixed, and **before** the PCM is
queued to Web Audio. It captures the synthesizer's source output, *not* the
browser resampler or the user's speaker-volume adjustment.

The existing FYM/register-history capture is unaffected by WAV recording.
FYM is a register-timeline export and is not the same thing as a waveform file.

## Controls

The **first row** contains AY core selection (WASM/JS), the music-note button
that starts/stops register-history capture, the history buffer size, and the
FYM0/FYM1 export control. The separate backend-status text has been removed:
the dropdown displays the choice, while its tooltip reports a loading state
or backend error.

The **second row** contains volume, live telemetry, and the WAV controls:

- **Record circle**: grey = idle/finished; amber = armed, waiting for audible
  output; red = actively capturing frames.
- **WAV seconds**: duration (1–60, default 5). May only be changed while idle.
- **Download arrow**: disabled until the requested number of PCM frames has been
  captured; clicking it initiates the download and releases the captured bytes.

To capture: select a duration, click the grey record circle, then start
the Apple II music/voice. The recorder waits until a mono sample is large enough
to change a quantized 8-bit output value (magnitude at least 1/255).
Silence before that point is **not** recorded and consumes no sample buffer.
The first audible frame is included. The recording finishes after precisely
`duration × 22,050` source frames, independent of host wall-clock time.

The download is named
`mockingboard-slotN-Ds-22050Hz-mono-u8.wav`. A 44-byte standard PCM RIFF/WAVE
header precedes `D × 22,050` data bytes; digital silence is near unsigned
sample value 128. The left and right source samples are averaged to mono and
clamped to [-1, 1] before unsigned 8-bit quantization.

**Lifecycle and cancellation:** Clicking the record circle while armed or
recording cancels and frees the buffer. A completed capture stays available
until downloaded (clicking the circle cannot discard it). A card reset,
unmount, or successful AY backend replacement cancels an unfinished capture
and releases any retained bytes. Downloads create a browser Blob/object URL;
the recorder releases its own PCM sample buffer immediately after the browser
download action is initiated. The temporary object URL is revoked after a short
delay; final browser storage/OS persistence is outside the emulator's control.

There is no timeout on the armed state. In the absence of non-silent output,
it remains armed until cancelled or the card is reset/unmounted.

## Verification

Automated regression:

```bash
node --test tests/mockingboard_wav_capture.test.cjs
```

Manual Safari acceptance:

1. Install the Mockingboard in physical PR#4; open its peripheral toolbox.
2. Verify only the WASM/JS selector appears (no duplicate label); the register
   capture pictogram is a **music note** instead of a coffee cup.
3. In row two select 1 second and arm recording. While silent, the button is
   amber; the download button remains disabled and
   `card.getWAVCaptureState().allocatedBytes` stays zero.
4. Start a native AY tune (or speech). The record icon becomes red and
   `card.getWAVCaptureState().state` becomes `recording`.
5. At 22,050 captured frames the icon becomes grey, status becomes `ready`,
   and download becomes enabled. Trigger download.
6. Confirm Audacity reports **mono, unsigned 8-bit PCM, 22,050 Hz, exactly one
   second**. Check that the first captured sample is non-silent, and that the
   duration of playback is correct.
7. Confirm `card.getWAVCaptureState().allocatedBytes===0` and `state==='idle'`
   immediately after download. Try cancellation and reset during a second
   recording; no buffer must remain allocated.
8. Verify FYM history capture/export and WASM/JS switching still work.
   Recording should not affect sound playback, audio FIFO counters, or
   source clock measurements.

To access the card in the existing emulator configuration:

```javascript
const card = apple2plus.hwObj().io.SLOT2obj(5);
card.getWAVCaptureState();
```

The WAV recorder is source-rate PCM rather than the browser's output,
which can be resampled to 44.1 or 48 kHz. Its first-sound condition is
sample-amplitude-based; very quiet output below one 8-bit quantization step
will not arm the capture until it becomes louder.
