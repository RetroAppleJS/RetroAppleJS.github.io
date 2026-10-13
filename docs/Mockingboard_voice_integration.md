# Mockingboard SSI-263 voice integration

Base commit: **c6498215487684bd20bee5e733085550eb550fe5** (RetroAppleJS main, Create SSI263JS.html).

Apply from the repository root:

```sh
git apply --check RetroAppleJS_mockingboard_voice.patch
git apply RetroAppleJS_mockingboard_voice.patch
node --test tests/*.test.js
```

The ZIP contains the changed files at their repository paths. The patch is the preferred installation route; the standalone voice TXT is identical to the device JavaScript and can be renamed to `EMU_DEVICE_mockingboard_voice.js` before placing it under `res/`.

## Result

- `EMU_DEVICE_mockingboard_voice.js` contains the unchanged MIT-licensed SSI263.js engine and the new `MockingboardVoice` adapter.
- The card declares two attached devices: `MockingboardAudio` and `MockingboardVoice`. Both AY chip objects stay internal to the card. Voice uses the existing stereo sink, with centered mono mixing, so there is one browser AudioContext.
- The primary speech chip accepts slot-ROM writes selected by address bit 6: `$Cn40–$Cn7F` and `$CnC0–$CnFF`. Low address bits select its registers; register addresses 4–7 alias the filter. Speech request uses VIA1 CA1 at `$Cn80`. The existing strict VIA decoder is preserved.
- Slot speech reads remain floating bus; this follows AppleWin's documented Mockingboard wiring. The voice device's `readStatus()` exposes the logical request in bit 7 for inspection. This implementation fits one primary SSI-263, not a secondary speech socket or Phasor native mode.
- CPU timing advances a logical chip independently of the browser. A bounded queue of register/completion events feeds a separate synthesis instance so delayed audio cannot lose a phoneme merely because the CPU has already received its request.
- The voice PCM rate can be 22,050, 44,100 or 48,000 Hz, defaulting to 44,100 Hz without oversampling. Deterministic interpolation converts it to the card's existing 22,050 Hz stereo stream; AY synthesis and WebAudio output rates stay under their existing controls.
- The peripheral toolbox has one appbox row for AY core choice, controls, capture, buffer size/fill and FYM export.
- The sliders button opens a two-column popup: audio telemetry on the left, SSI-263 controls on the right. All eight screenshot controls are included. Program writes update the register controls; manual edits perform actual register writes while retaining CTL.

For a manual speech test, enable sound, open the popup, click **Defaults**, select a phoneme and click **Play**. **Stop** powers down speech. Startup/reset remains quiet and powered down, so merely fitting the device does not introduce unsolicited audio or IRQs.

The `singleton: true` device descriptor is now supported by Apple2IO attachment/picker handling. It permits removal and reattachment of the host-owned voice and prevents duplicate physical voice/output instances. Descriptors without that flag retain their existing multiple-instance behavior.

## Validation

- **95/95 repository Node tests passed**, no failures or skips.
- The device script's first 31,384 bytes match the validated SSI263.js port exactly: SHA-256 `b7cfefb9de7c6c40020ff9c0b699fc17abefb53d804271d552ec2605eb778448`.
- Fresh C++ comparison using the embedded device engine: 286,650 samples at 22,050 Hz, 573,300 at 44,100 Hz and 624,000 at 48,000 Hz, all with zero observed maximum/RMS deviation. These vectors cover all 64 phonemes and one mixed register-change case.
- New tests cover CPU-side VIA1 speech IRQ, select/alias decoding, debugger safety, delayed audible finite PCM, chunk-size determinism, each voice sample rate, mute/speed/backend/reset/unmount behavior, zero idle DSP work, same-tick queue draining, failed audio resume and pending audition cancellation.
- Real Apple2IO topology tests cover audio removal before CA1 enable, generic reset at a nonzero timestamp, immediate detach and picker-style reattachment without duplicate devices.
- Independent review found three topology/lifecycle defects; each was reproduced in a failing test and fixed. An additional CA1 rising-edge teardown test verifies an unmounted card cannot reassert IRQ.
- JavaScript syntax and diff-whitespace checks passed. Patch applicability is checked against exact upstream base-file bytes.

Actual browser UI layout and audible browser playback have not been exercised here: no local Chromium executable is installed, and the available cloud browser rejects local-file URLs. Node tests exercise the real card, AY cores and Apple2IO with browser API stubs where needed.

The speech model retains Casso's synthesis approximations. PCM agreement with C++ is not a measurement of agreement with a physical SSI-263.

Source references: https://github.com/relmer/Casso and https://github.com/AppleWin/AppleWin/blob/master/source/Mockingboard.cpp
