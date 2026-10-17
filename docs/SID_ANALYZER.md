# PSID bus and feature analyzer (SIDchipJS)

This feature appears between the **Base64 SID input** and the existing **Export to Apple II** controls in `tools/SIDchipJS.html`. The result box has a maximum height of **200 px** and scrolls when more content is available.

## Usage

1. Load a PSID via the existing Base64 or file-loading controls. **Analyze on load** is enabled by default.
2. Alternatively, use **Analyze PSID** to analyze the currently selected Base64 file.
3. Every subtune has its own expandable report. The first subtune opens automatically.
4. Expand the report to see separate counts of **CPU reads** and **CPU writes** for each of the 32 SID offsets (`$D400–$D41F`), plus feature event counts.
5. If the PSID declares a second or third SID, the report contains an additional register table for its configured address.

The original SID audio playback and Apple II export functionality remain untouched. The analyzer uses an opt-in *headless* `jsSID` instance: no WebAudio output is created.

## What is being counted

- **Register counts:** effective memory reads and writes issued by the executed 6502 instructions, including initialization and the first traversal of the player loop. Repeated JS source reads to the *same address within one CPU instruction* are counted as one, separately per direction.
- **Waveform feature events:** count when a waveform control bit is enabled, or when a rising GATE starts it anew. Pulse near 50% is additionally classified as square. Simultaneous waveform bits are classified as a combined waveform; combined output behavior varies between 6581 and 8580.
- **Gate, hard sync, ring modulation and TEST:** count their 0→1 events; GATE off counts 1→0.
- **Frequency, pulse width, ADSR, cutoff and master volume:** counts of writes to the corresponding registers. Volume changes are separately counted if the low four bits change. Pulse-width updates while pulse is selected are counted as *possible PWM activity*, not as proof of an audible PWM sweep.
- **Filter usage:** counts filter-mode enabling events, combined modes, newly routed filtered inputs, and changed resonance values. Routing EXT IN is reported separately.
- **Potential PCM:** eight or more volume changes within one playback callback are flagged as rapid volume-change activity, not a definitive classification of sample playback.
- **Readbacks:** POTX, POTY, OSC3 and ENV3 reads are separately counted.

The SID *programming interface* is essentially shared between the 6581 and 8580; counts for the shared features are not duplicated into artificial 6581/8580 columns. The report shows the SID model indicated by the PSID header. It does not predict the distinctly analog sound of either revision.

## Excluding loops

The profiler runs the original 6502 init/play routines and fingerprints the entire 64 KB emulated memory plus key CPU registers at playback boundaries. It stops **before** executing a frame whose state has already been observed. This prevents recounting any subsequent iterations of the detected deterministic software loop. Both the first unique frame of the loop and any nonrepeating introduction are retained in the totals.

The fingerprint is a pair of incrementally maintained 32-bit hashes; it is *extremely unlikely* but not mathematically impossible for unrelated states to collide.

**Limitations:** Not all songs expose a repeated entire-RAM state (for example, monotonically increasing counters). If no loop is found by the user-defined cutoff, the result explicitly says **partial**; it must not be interpreted as a whole-song unique count. The default cutoff is 180 seconds, adjustable to 600. Loop identification depends on CPU/RAM state and does not reproduce oscillator analog state.

## Fidelity and limitations

- Only `PSID` files are supported, not `RSID`, which requires more C64 hardware.
- The headless profiler advances the original PSID initialization routine and its play routine using the existing jsSID 6502 emulator. It does not render individual audio samples, and it uses the jsSID PAL/CIA timing model rather than exact machine cycles or arbitrary raster interrupts.
- Hardware-dependent branches based on SID POTX/POTY or OSC3/ENV3 reads may produce different behavior, so an explicit warning appears when those reads occur.
- The existing jsSID CPU implementation has limited support for some undocumented instructions, interrupts and peripheral side effects.
- An event count is **not** a duration, percentage of audio frames, or objective timbre score. A feature can remain active for many frames after one enabling write.
- The current `jsSID` primary audio player is not paused, reset or reinitialized by the analysis process.

## Testing performed

- Static syntax parsing of the new analyzer scripts and HTML inline JavaScript.
- One ordinary PSID, one five-subtune PSID, and a two-SID PSID.
- Synthetic 6502 tune with a four-state player loop (detected length 4, no second loop execution).
- Synthetic 6502 tune that reads `$D419` (POTX read counted, hardware-readback warning displayed).

Browser-level interactive audio/playback and true SID 6581/8580 chip behavior require further validation.
