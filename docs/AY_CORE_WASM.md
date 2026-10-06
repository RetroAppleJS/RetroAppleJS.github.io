# Shared AY sound core

The first implementation provides one block API for JavaScript and scalar WASM,
with up to two independent three-channel AY/YM chips. Both the standalone FYM
player and the live Mockingboard peripheral use this API. The original `ayumi.js`
remains the numerical reference.

## Try it

Open `tools/MockingboardJS.html`, load one or two `.fym` files, and select JS or
WASM before starting playback. Each file retains its own chip clock, frame rate
and frame schedule. Events merge into one ordered six-channel render stream.
The existing position slider and Start/resume behavior remain available. The
shared song ends at the shorter file and loops both chips at the later loop point.
Seeking rebuilds numerical state from the selected frame and latest envelope
shape; it does not restore the exact earlier oscillator/filter phase.

The emulator's Mockingboard defaults to WASM. Its toolbox offers WASM and JS;
JS is the alternative backend. If WASM cannot initialize, the card uses JS and
shows the reason in the toolbox. The embedded module initializes synchronously
and is cached, so CPU writes can start immediately. Programmatic selection remains
available through `await card.setAYBackend("js")` or `"wasm"`; inspect the active
backend with `card.getAYDiagnostics()`. Backend selection starts a new audio epoch
and rebuilds synthesis from both bus register mirrors, preserving VIA and bus
state. Oscillator and filter phase restart at this transition.

The standalone player and public API retain their existing `Auto` policy, which
selects JS. `tools/AY_Core_Benchmark.html` compares the
complete projection, event packing, rendering and PCM copying path at several
sample rates. Its timing results alone do not establish emulator latency or
audible correctness.

## API and ownership

Load these scripts in order after `res/ayumi.js`:

1. `res/EMU_CHIP_AY.js`
2. `res/EMU_CHIP_AY_JS.js`
3. `res/EMU_CHIP_AY_WASM.js`
4. `res/EMU_AUDIO_AY_STREAM.js`
5. `res/EMU_DEVICE_ay.js` (emulator only)

These emulator includes belong in `index.html`. Each Mockingboard owns two
`AYChipDevice` instances, AY0 and AY1, mounted as `AY8910` devices 1 and 2.
Each has independent three-channel chip state, register readback and mixing.
Both use indexed slices of one two-chip core for batched six-channel rendering;
the cached WASM module serves that core. `MockingboardAudio`, device 3, is the
shared stereo browser sink. Detaching an AY source mutes its output; reattaching
restores the same device and register state. Detaching the sink cancels pending
activation and stops scheduled audio. Ejecting the card releases its core.

The core owns generators, AY/YM DAC behavior, FIR/DC filter state, register
masks, mixing and PCM. The emulator retains VIA timers, bus pins, synchronous
register readback, R14/R15 I/O and CPU scheduling. Browser playback owns only
presentation queues and device lifecycle.

```js
const core = await AYCore.create({
    backend: "wasm", chipCount: 2, sampleRate: 48000,
    timebaseHz: 1000000000, maxFrames: 4096, maxEvents: 4096
});
core.configureChip(0, {model: "AY", clockHz: 1020484});
core.configureChip(1, {model: "AY", clockHz: 1020484});
const data = new Uint8Array(4096 * AYCore.EVENT_STRIDE);
const view = new DataView(data.buffer);
const output = {left: new Float32Array(4096), right: new Float32Array(4096)};
const batch = {data, count: 0};

// Pack every accepted bus write, including repeated R13 writes, in order.
AYCore.packEvent(view, 0, 0, 0, 0, 7, 0x3e);
AYCore.packEvent(view, 1, 0, 0, 0, 0, 100);
AYCore.packEvent(view, 2, 0, 0, 0, 8, 15);
batch.count = 3;
const frames = core.renderUntil(10000000, batch, output);
// Only output.left/right[0..frames) is produced PCM; reuse these buffers.
core.destroy();
```

For live orchestration, map CPU ticks through `AYSourceClock` and seal completed
CPU intervals before rendering them. `AYStream` offers bounded packed event
storage with epoch, sequence and sealed horizon checks. Events at the same tick
keep their input order, even across batches. Nothing may synthesize beyond the
known CPU horizon. The peripheral implements this policy with its own bounded
event storage and FIFO so synchronous bus writes remain visible immediately.

`renderUntil()` is synchronous and preflights the complete batch, time range and
output capacity before mutation. It allocates no per-sample objects. Native
WASM has no imports and uses fixed 2 MiB memory. Snapshots preserve numerical
state within the same backend; restoring the entire Apple II additionally needs
CPU, VIA, bus, source mapper, transport and presentation state. A WASM trap
invalidates the affected instance.

## CPU speed and presentation

AY clocks, output sample rate and browser `playbackRate` stay fixed. CPU speed
changes the spacing of CPU-orchestrated register writes: twice the speed halves
the note intervals, and half the speed doubles them. A fractional Q64.32 source
anchor survives rate changes; target frequencies are canonicalized to millihertz.

VIA interrupt timers still advance on every required CPU cycle. Audio time
projection and core-position queries run at register events and audio block
boundaries instead of every CPU cycle. A cheap CPU deadline triggers synthesis
about every 512 output frames; reads of the audio queue or diagnostics project
the latest committed CPU horizon. CPU speed and output sample-rate changes
reschedule that deadline without changing the exact source mapping.

Pause and debugger single-step continue updating logical chip state silently.
Resuming playback discards obsolete presentation PCM and starts a new bounded
lead. CPU execution yields under audio backpressure; a full FIFO retains pending
PCM/events instead of overwriting old samples. The browser schedules at most
60 ms of lead and uses its actual AudioContext sample rate. A device sample-rate
change starts a cold synthesis transition while preserving bus readback.

Chip reset clears digital generators/registers while retaining filter history.
Transport reset clears synthesis and establishes a new timeline origin. History
JSON retains its existing event tuples and adds optional `sourceTiming` segments
for fixed-pitch speed-aware replay. Timing metadata is bounded; pressure trims
the common capture window rather than silently omitting speed changes.

## Build and verify

The embedded WASM asset is checked in, so normal use needs no compiler. Rebuild
with Clang and wasm-ld available:

```sh
tools/ay_core/build.sh
node --test tests/*.test.js
```

Set `CC` and `WASM_LD` to absolute tool paths when needed. The build disables
fast-math and contraction, fixes memory size, exports ABI v1 and regenerates
`res/EMU_CHIP_AY_WASM.js` with a source fingerprint. `ay_core.wasm` is an ignored
build intermediate. License and port attribution are in `tools/ay_core/`.

Tests cover reference PCM, JS/WASM parity, all envelope shapes, repeated R13,
noise, dual-chip isolation, event ordering, atomic rejection, snapshots,
fixed-pitch tempo changes, sealed intervals, FIFO pressure and lifecycle races.
An authentic checked-in Mockingboard trace is replayed through irregular live
batches and the offline renderer. That older trace assumes nominal CPU speed
and lacks envelope writes; broader authentic IRQ/envelope captures remain useful.

Browser listening and performance validation remain pending. ScriptProcessor
playback still uses 4096-frame blocks; AudioWorklet transport, sub-sample event
rendering, cross-backend snapshots and a complete machine checkpoint are deferred.
The detailed contract is in
`docs/superpowers/specs/2026-10-05-ay-core-wasm-design.md`.
