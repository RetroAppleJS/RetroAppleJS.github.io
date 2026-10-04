# Mockingboard Peripheral Design

## Goal

Implement a production-quality Mockingboard C / Sound II compatible peripheral for RetroAppleJS using two 6522 VIA models, two AY-3-8910-compatible PSG instances rendered through the existing `res/ayumi.js`, deterministic CPU-cycle-based timing, shared IRQ delivery, and a browser audio device that consumes already-rendered samples without influencing emulated hardware time.

Primary acceptance uses real software on:

- `disks/Utility/mockingboard1.dsk`
- `disks/Utility/mockingboard2.dsk`
- `disks/Utility/mock_test.dsk`
- Tom Charlesworth's `mb-audit`, especially `chip-6522.a`

in addition to component-level and card-integration tests.

## Scope

In scope:

- Two 6522 VIA instances.
- Two AY-3-8910 PSG instances, one per VIA.
- Mockingboard slot-page register decoding.
- VIA T1/T2 timer behavior required by real Mockingboard software and mb-audit.
- IFR/IER and shared CPU IRQ behavior.
- AY address latch, write, readback, and active-low reset semantics.
- Deterministic stereo sample generation from emulated CPU time.
- Browser Web Audio playback through a separate attached device.
- Debug-safe, side-effect-free register inspection.
- Extensive validation using all three Mockingboard-related utility disks plus mb-audit.

Explicitly out of scope for v1:

- WASM-specific code, paths, switches, timing, or optimization.
- Speech chips (SSI-263 / SC-01).
- Phasor, Echo+, MegaAudio, or other extended clones.
- Full generic 6522 shift-register engine.
- T2 PB6 pulse-count engine.
- T1 PB7 output.
- Full CA/CB handshake/output modes beyond the subset required for register/IFR consistency.
- AY external I/O hardware attached to R14/R15 beyond their register images.
- Analog bus-retention/decay modeling.

Deferred 6522 features are promoted into v1 only if the utility disks or mb-audit demonstrably require them for a regular Mockingboard C / Sound II. No application-specific workaround is acceptable.

## Existing project integration

The current `res/EMU_CARD_mockingboard.js` is only a stub. The production implementation will replace it.

Dependencies remain statically included from `index.html`; peripheral drivers must not dynamically inject scripts. `res/ayumi.js` will therefore be enabled in `index.html`, and the new audio device script will be included there as well.

The card will use RetroAppleJS's declarative `deviceConfig` attachment mechanism. The attached device receives the card through `bindHost(owner)` and Apple2IO through `bindIO(io)`.

## Address-space contract

The Mockingboard uses the Apple II slot ROM page as hardware register space rather than the normal 16-byte SlotIO range.

For a card in slot `n`:

- `$Cn00-$Cn0F` -> VIA 0 registers 0-15.
- `$Cn80-$Cn8F` -> VIA 1 registers 0-15.
- `$Cn10-$Cn7F` and `$Cn90-$CnFF` -> unmapped / floating bus on reads; writes ignored.

`COM_CONFIG.js` therefore changes the Mockingboard entry from `SlotIO:"X", SlotROM:""` to `SlotIO:"", SlotROM:"X"`. `HostIO` and `HostROM` remain empty.

The card exposes `SlotROM.RD` and `SlotROM.WR` callbacks. Read-only debugger scans (`ctx.bRO`) must use non-destructive VIA inspection and must never acknowledge interrupts or alter hardware state.

mb-audit explicitly probes for unwanted 6522 presence/mirroring at `$Cn10` and `$Cn90`; the strict decoder above is therefore part of acceptance, not merely a cleanup choice.

## Top-level card architecture

`res/EMU_CARD_mockingboard.js` owns all emulated hardware state:

```text
mockingboard
  |- MockingboardR6522 VIA0
  |- MockingboardR6522 VIA1
  |- MockingboardAYBus AYBus0
  |- MockingboardAYBus AYBus1
  |- Ayumi AY0
  |- Ayumi AY1
  |- IRQ aggregation
  |- CPU-clock synchronization
  `- deterministic stereo sample ring
```

The card's public integration surface is:

```js
reset()
restart()
onUnmount()

readSlotROM(addr, ctx)
writeSlotROM(addr, d8, ctx)

advanceTo(cpuTick)
syncClock(cpuTick)
needsRealtimeTick()

getAudioFormat()
setAudioConsumerActive(active)
getAudioFramesAvailable()
drainAudioFrames(maxFrames)
clearAudioQueue()
getAudioStats()

getRegisters(chipIndex)
getViaState(index)
```

The card uses `ctx.cpuTick` for register accesses and falls back to `io.getClockTicks()` when necessary. `ctx.cpuTick` is the effective timestamp of the bus access, including the CPU instruction's `cycleOffset`; this is required for mb-audit's addressing-mode and sub-opcode timing tests. The card never derives device timing from host RTC time.

## `MockingboardR6522` contract

### Public API

```js
function MockingboardR6522(options)

reset()
readRegister(reg)
peekRegister(reg)
writeRegister(reg, value)
tick(cycles)
needsRealtimeTick()
setPortAInput(value, mask)
setPortBInput(value, mask)
setCA1(level)
setCA2(level)
setCB1(level)
setCB2(level)
getState()
```

Static definitions:

```js
MockingboardR6522.REG
MockingboardR6522.IFR
MockingboardR6522.REG_NAMES
```

Callbacks supplied through `options`:

```js
onPortAChange(pins, via)
onPortBChange(pins, via)
onIrqChange(level, via)
logger
```

The VIA model has no knowledge of Apple II slots, AY registers, audio, Web Audio, or RetroAppleJS IRQ source names.

### Register map

| Reg | Read | Write |
| --- | --- | --- |
| `$0` | ORB/IRB pins | ORB latch |
| `$1` | ORA/IRA pins | ORA latch |
| `$2` | DDRB | DDRB |
| `$3` | DDRA | DDRA |
| `$4` | T1 counter low; clears T1 IFR | T1 latch low |
| `$5` | T1 counter high | T1 latch high, load/start T1, clear T1 IFR |
| `$6` | T1 latch low | T1 latch low |
| `$7` | T1 latch high | T1 latch high |
| `$8` | T2 counter low; clears T2 IFR | T2 latch low |
| `$9` | T2 counter high | T2 high+low load/start, clear T2 IFR |
| `$A` | SR | SR storage; clear SR IFR |
| `$B` | ACR | ACR |
| `$C` | PCR | PCR |
| `$D` | IFR plus synthesized IRQ bit | clear selected IFR bits |
| `$E` | IER plus bit 7 | set/clear IER bits |
| `$F` | ORA no-handshake pins | ORA no-handshake latch |

`readRegister()` is a real hardware access and may clear flags. `peekRegister()` returns current externally visible values but has no side effects, callbacks, handshakes, logging side effects, or IRQ changes. `getState()` uses `peekRegister()` semantics only.

IER bit 7 always reads as one for a regular 6522. mb-audit uses this in card detection and address-line testing.

### Port model

Each port has an output latch, DDR, external input and resolved pins:

```text
PA = (ORA & DDRA) | (IRA_external & ~DDRA)
PB = (ORB & DDRB) | (IRB_external & ~DDRB)
```

Callbacks fire only when the resolved pin value changes.

Reset leaves both DDRs at zero and external inputs high, so resolved PA/PB are `$FF`.

VIA0 and VIA1 are independent devices. Writes to one chip's DDRA/DDRB or other registers must not alias into the other. mb-audit interleaves different data patterns across both VIAs specifically to detect aliasing.

### Timer behavior

T1 supports one-shot and ACR bit-6 continuous/free-running mode. Its externally observable period must match a real 6522: mb-audit verifies a T1 period of `N+2` cycles for latch value `N`, including the `$0000` edge case and repeated free-running underflows.

T2 supports PHI2 interval mode. ACR bit 5 (PB6 pulse-count mode) is retained but CPU ticks do not decrement T2 in this mode. No fake pulse-count behavior is implemented.

Timer reads and writes occur at the effective bus timestamp supplied through `ctx.cpuTick`, not merely at instruction boundaries. This is required because mb-audit checks multiple 6502/65C02 addressing modes for counter accesses and checks sub-opcode timing of IFR reads.

A timer may continue counting while its interrupt is disabled. Underflow sets the corresponding IFR flag; enabling the matching IER bit afterward must assert IRQ immediately if that IFR flag remains set.

Inactive/reset timers must not spuriously set timer IFR bits merely because enough emulator time has elapsed.

`tick(cycles)` must use batched arithmetic for large catch-up intervals while preserving the same result as cycle-by-cycle progression, including multiple T1 free-running underflows.

### IRQ behavior

`IFR` stores bits 0-6. Bit 7 is synthesized when `(IFR & IER & 0x7F) != 0`. Every operation that changes IFR or IER updates `irqLevel`; `onIrqChange` fires only when that level changes.

T1/T2 IFR polling and IRQ-enabled operation must both work. Pending IFR plus a later IER enable must cause immediate IRQ assertion.

Both VIAs may run timers simultaneously. An interrupt source from one VIA must not mask or clear a source from the other. Reset must clear pending Mockingboard IRQ state.

`needsRealtimeTick()` is true only when passage of CPU time could independently change the CPU-visible IRQ level before the next normal synchronization point: a running IRQ-enabled T1, or a running IRQ-enabled T2 in PHI2 mode.

T1 PB7 output is deliberately deferred unless the acceptance suites prove a regular Mockingboard dependency.

## `MockingboardAYBus` contract

### Wiring

- VIA PA0-PA7 <-> AY DA0-DA7.
- VIA PB0 -> BC1.
- VIA PB1 -> BDIR.
- VIA PB2 -> `/RESET`.
- BC2 is hardwired high.

With `/RESET` high, the low two PB bits select:

- `$4`: INACTIVE (`BDIR=0, BC1=0`).
- `$5`: READ (`BDIR=0, BC1=1`).
- `$6`: WRITE (`BDIR=1, BC1=0`).
- `$7`: LATCH ADDRESS (`BDIR=1, BC1=1`).

PB2 low overrides all control states and holds the PSG in RESET.

### Public API

```js
function MockingboardAYBus(renderer, options)

reset(cycle)
observeViaPins(portA, portB, cycle)
getBusDrive()
isDrivingBus()
readRegister(index)
writeRegister(index, value, cycle)
getRegisters()
getState()
```

### Transaction rule

READ, WRITE and LATCH execute only when entered from INACTIVE. The production implementation has no generic `edgeTriggered` option.

Valid write sequence:

```text
PA=register -> PB=$07 LATCH -> PB=$04 INACTIVE
PA=data     -> PB=$06 WRITE -> PB=$04 INACTIVE
```

Direct active-to-active changes such as `$07 -> $06` do not execute the second command.

### Address latch

A LATCH accepts only values `$00-$0F`. Values with an upper nibble set invalidate the selected address rather than aliasing to the low nibble. Reset also invalidates the selected register.

### Readback

During READ with a valid latched address, the AY drives DA0-DA7 for the entire duration of the READ state. `getBusDrive()` returns the selected register value while READ is active and `null` otherwise. On leaving READ, the bus immediately becomes high impedance.

The card maps high impedance to VIA external input `$FF`; the VIA resolves DDRA itself, so output-configured PA bits still reflect ORA while input-configured bits see AY data.

### Register image

The register mask is:

```js
[
  0xFF,0x0F, 0xFF,0x0F, 0xFF,0x0F,
  0x1F,0xFF,
  0x1F,0x1F,0x1F,
  0xFF,0xFF,0x0F,
  0xFF,0xFF
]
```

R14/R15 retain byte images only; external AY I/O hardware is not modeled in v1.

Every valid AY write is applied to the renderer even if the stored value is unchanged. In particular, repeated R13 envelope-shape writes must retrigger the envelope.

## Ayumi configuration and stereo

The card owns two `Ayumi` instances. They are configured as AY, not YM:

```js
chip.configure(false, clockRate, 44100)
```

AY0 represents the left three-voice side and AY1 the right three-voice side. Each channel of AY0 is panned fully left and each channel of AY1 fully right. The chips are not averaged into one shared stereo image.

## Deterministic timing

The card maintains `lastCpuTick` and a single `advanceTo(cpuTick)` entry point.

Before every meaningful VIA read or write:

1. `advanceTo(ctx.cpuTick)`.
2. Tick both VIAs by the elapsed CPU cycles.
3. Advance the PSG sample phase for the same elapsed interval.
4. Perform the requested register operation.
5. Process resulting port/AY/IRQ changes.

`syncClock(clockTicks)` delegates to `advanceTo` and is called by Apple2IO once per processing slice. An attached device can additionally call `advanceTo(io.getClockTicks())` from a CPU tick hook when `needsRealtimeTick()` is true. Repeating `advanceTo` with the same absolute tick is a no-op.

The CPU bus layer already supplies timestamped accesses through `ctx.cpuTick` and `ctx.cycleOffset`; the Mockingboard consumes that contract rather than inventing instruction-specific timing tables inside the card.

No host wall clock, FPS scheduler, or Web Audio callback determines emulated hardware time.

## Audio sample production

Sample generation belongs to the card, not the browser audio device.

The card keeps a persistent rational phase accumulator:

```text
audioPhase += cpuCycles * 44100
while audioPhase >= cpuClock:
    audioPhase -= cpuClock
    render one stereo AY frame
```

This guarantees that generated sample count depends only on elapsed emulated CPU cycles and the configured CPU clock.

At an AY register write occurring at tick `T`, `advanceTo(T)` renders all samples belonging to the pre-write interval first. The register change applies to subsequent sample intervals.

The AY generators continue advancing even when browser playback is muted. Muting disables capture into the playback queue, not the internal PSG state progression.

## Audio FIFO

The card owns a bounded stereo ring buffer backed by typed arrays. The target initial capacity is 0.25 seconds at 44.1 kHz. The ring tracks produced, drained, dropped, overrun and high-water statistics.

If the ring is full, the oldest playback frame is dropped before inserting the newest one. Playback congestion must never block or slow emulated CPU/VIA/AY time. This policy is generic and contains no WASM-specific behavior.

## `EMU_DEVICE_mockingboard_audio.js` contract

The attached `MockingboardAudio` device owns only browser transport and the optional exact-timer scheduling hook.

Public lifecycle:

```js
bindHost(owner)
bindIO(io)
restart()
reset()
onUnmount()
init(action)
isTickActive()
isCycleActive()
tick(n)
cycle()
getStats()
```

It owns:

- `AudioContext`.
- `GainNode`.
- `AudioBufferSourceNode` queue.
- queue lead / `nextStartTime`.
- host underrun and scheduled-frame statistics.

It never owns or mutates VIA state, AY register state, oscillator phase, timer state, IRQ state, or emulated sample phase.

### Tick hook

`isTickActive()` follows `owner.needsRealtimeTick()`. `tick()` only calls `owner.advanceTo(io.getClockTicks())`. It does not generate samples from host demand; any samples generated are the consequence of CPU time advancing.

When a VIA timer/IER change alters realtime-tick need, the device refreshes Apple2IO's precomputed hook list through the attachment-provided `_ioRefreshHooks` callback.

### Cycle hook and draining

`isCycleActive()` is true while playback is enabled. `cycle()` first synchronizes the card to `io.getClockTicks()`, then drains already-rendered frames and schedules them as stereo `AudioBufferSourceNode`s.

The device uses `AudioContext.currentTime` only to schedule playback of existing samples. It never feeds that time back to the emulation.

If host playback underruns, the device records an underrun and restarts its queue at `currentTime + queueLead`. It does not synthesize missing AY time, repeat the last emulated block, or advance the card.

If emulation produces playback frames faster than the host can consume them, the card's bounded FIFO drops oldest frames. Hardware state remains exact even if host playback becomes discontinuous.

No `ScriptProcessorNode` or AudioWorklet is required for v1.

## IRQ aggregation and lifecycle

The card ORs both VIA IRQ levels and publishes one shared RetroAppleJS IRQ source using a mount-specific identity such as `MOCK:<mount hash>`. Reset and unmount explicitly deassert that source.

Reset clears both VIAs, both AY buses/PSGs, IRQ state, audio phase and queued deterministic samples. The audio device stops scheduled host sources and resets transport state but retains its `AudioContext` object.

Unmount deasserts IRQ, disables capture, clears queues and disconnects/stops any scheduled browser audio sources.

## Diagnostics

The card exposes emulation-side counters such as:

```text
producedFrames
queuedFrames
drainedFrames
droppedFrames
overruns
highWaterFrames
```

The audio device separately exposes host-transport counters such as:

```text
buffersScheduled
framesScheduled
underruns
queuedLead_ms
minLead_ms
```

The two domains must remain separate so utility-disk failures can be classified as hardware-emulation versus browser-playback problems.

## Configuration changes

`res/COM_CONFIG.js`:

```diff
- "SlotIO":"X", "SlotROM":""
+ "SlotIO":"",  "SlotROM":"X"
```

The Mockingboard remains eligible for physical slots 1-7. The existing incorrect Videx manual link should be replaced with a Mockingboard reference when the implementation is landed.

`index.html` will statically include:

```html
<script type="text/javascript" src="res/ayumi.js"></script>
<script type="text/javascript" src="res/EMU_DEVICE_mockingboard_audio.js"></script>
<script type="text/javascript" src="res/EMU_CARD_mockingboard.js"></script>
```

The dependency order must place `ayumi.js` and the audio-device constructor before the Mockingboard card can be provisioned.

## Testing and acceptance

### Component tests

`MockingboardR6522` tests must cover:

- reset state and pull-high resolved ports;
- DDR/output/input resolution;
- side-effectful reads versus `peekRegister()`;
- IER set/clear semantics and IER bit 7 readback;
- IFR clearing and synthesized IRQ bit;
- IRQ callback assertion/deassertion;
- T1 one-shot and continuous timing;
- real 6522 T1 `N+2` period, including latch `$0000`;
- T2 PHI2 interval timing;
- timer IFR polling with IER disabled, followed by immediate IRQ when IER is enabled;
- inactive timers not generating spurious IFR;
- simultaneous timers across both VIAs;
- large-cycle catch-up without per-period iteration;
- no CPU-tick decrement in T2 pulse-count mode;
- reset clearing pending IRQ state.

`MockingboardAYBus` tests must cover:

- `$4/$5/$6/$7` decoding;
- reset dominance;
- commands accepted only from INACTIVE;
- invalid high-nibble address latch;
- write masking;
- repeated R13 retrigger;
- READ bus drive for full READ duration;
- release to high impedance on leaving READ.

### Card integration tests

Tests must cover:

- exact `$Cn00-$Cn0F` and `$Cn80-$Cn8F` decoding;
- no register aliasing in the rest of the slot page, including `$Cn10` and `$Cn90`;
- floating-bus reads outside mapped ranges;
- `ctx.bRO` reads with no hardware side effects;
- effective `ctx.cpuTick` timing across different 6502/65C02 addressing-mode cycle offsets;
- AY write and readback through actual VIA port direction state;
- two independent VIA and PSG sides;
- shared IRQ aggregation without cross-source masking;
- mount-specific IRQ cleanup;
- deterministic sample counts for known CPU-cycle intervals;
- bounded audio FIFO and oldest-frame overflow policy.

### mb-audit compatibility suite

Use Tom Charlesworth's `mb-audit` source, especially `chip-6522.a`, as a formal behavioral oracle for the regular Mockingboard 6522 pair.

At minimum the implementation must satisfy the regular-Mockingboard paths for:

- 6522 detection from live T1/T2 counter movement;
- IER bit 7 readback;
- all-eight-bit DDRA/DDRB data-line tests, including exhaustive patterns;
- address-line distinction between DDRB, DDRA, T1 latch and IER;
- independent VIA A/B state;
- T1 IRQ generation and IFR visibility;
- polling timer IFR while disabled, then immediate IRQ on later IER enable;
- 6502/65C02 addressing-mode timing of T1/T2 counter accesses;
- sub-opcode timing of IFR reads;
- T1 one-shot/free-running behavior and `N+2` period;
- simultaneous T1/T2 operation across both VIAs;
- repeated timer interrupts over longer intervals;
- high-frequency non-IRQ timers not masking a lower-frequency IRQ source;
- pending IRQ cleanup on reset;
- absence of unintended 6522 mirrors at `$Cn10` and `$Cn90`.

Clone-specific mb-audit branches for MegaAudio, MB4C, Echo+, SD Music, Phasor or speech hardware are not acceptance requirements for this v1.

### Real-software acceptance

Run the utilities/demos on:

- `disks/Utility/mockingboard1.dsk`.
- `disks/Utility/mockingboard2.dsk`.
- `disks/Utility/mock_test.dsk`.

Also run the regular-Mockingboard mb-audit suite.

Failures should be diagnosed with a trace containing, where relevant:

```text
CPU tick
cycle offset / effective access timestamp
slot address and RD/WR value
VIA/register
PA/PB resolved pins
AY control state
AY selected register and data
T1/T2 load/underflow
IFR/IER
IRQ assertion/deassertion
```

The implementation is accepted when the real utilities and regular-Mockingboard mb-audit tests that target the supported Mockingboard C / Sound II feature set detect and exercise the card correctly, both VIAs remain independent, stereo audio is produced through both PSG sides, timer/IRQ behavior is cycle-consistent with the supplied CPU bus timestamps, and no unsupported feature is silently emulated incorrectly.
