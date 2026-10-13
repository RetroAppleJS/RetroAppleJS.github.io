# Mockingboard voice calibration and master volume

User scope: bring SSI-263 voice loudness into balance with AY music, add one card-wide volume button, and place it with the live telemetry button on the peripheral toolbox's second line. Base: main 6302649b7a3d79230757d9e772301d6a3fc15074.

Measured through the actual device adapter with 1.023 MHz XCK, SSI amplitude 12, inflection 2304, and filter 211/233, the mean level of ten representative voiced sounds is approximately 0.0334/0.0360 RMS at the old 0.5 mix gain. A steady single AY channel at register volume 12 measures approximately 0.1276 RMS. Set the adapter's voice mix gain to 2.0 (4× old level, +12.04 dB). The new voice/AY RMS ratios are 1.047 and 1.129 respectively. Retain all chip amplitude registers and phoneme level variation. This is a representative digital calibration, not a comparison with physical hardware recordings or a promise of equal loudness for every program.

Remove the premature +/-1 clamp in the voice/music pre-mix. The common sink retains its calibrated 0.25 maximum gain; Float32 PCM may carry intermediate values above unity while the final output retains headroom. Test voiced balance and representative simultaneous maximum-level AY/voice output. Keep the exact SSI synthesis algorithm, timing, XCK and PCM rates unchanged.

The card owns a 0–100 master volume percentage, default 100, so existing AY playback level is preserved. The audio sink scales its existing 0.25 gain by that percentage, applying changes smoothly to active/queued buffers without clearing PCM, changing timing or resetting chips. The setting survives reset, backend switches, sound off/on and audio-device reattachment.

Match Disk II's existing compact volume-button behavior: clicks cycle 0, 25, 75, 100 percent; icon, tooltip, aria label and data-volume attribute reflect the level. A direct validated setter is available. Zero is output mute only; the logical chips and capture keep advancing.

The toolbox keeps one appbox with two explicit rows. Row 1 retains AY core and history controls; row 2 contains one master volume button and the existing live telemetry button. No separate voice/music user volume buttons.

Verification: gain ratio through actual renderers, no pre-mix clipping, sink gain and live change behavior, lifecycle persistence, topology reattachment, second-row placement, and the full current repository Node suite. Current baseline voice tests contain fixed 160,000-cycle deadlines from the earlier faster XCK; update those tests to derive deadlines from the chip formula. This updates test expectations, not speech behavior.
