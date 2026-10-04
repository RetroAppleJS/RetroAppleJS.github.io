# Mockingboard Peripheral Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Mockingboard stub with a production Mockingboard C / Sound II-compatible peripheral containing two 6522 VIAs, two AY PSGs, deterministic CPU-cycle timing, shared IRQ, stereo sample buffering, and host Web Audio playback.

**Architecture:** `res/EMU_CARD_mockingboard.js` owns both VIA models, both AY bus adapters, both Ayumi instances, IRQ aggregation, CPU-time synchronization, and the deterministic stereo ring. `res/EMU_DEVICE_mockingboard_audio.js` owns only browser playback and the exact-timer scheduling hook. Slot-page accesses use `$Cn00-$Cn0F` and `$Cn80-$Cn8F`; all host timing derives from `ctx.cpuTick` / `io.getClockTicks()` and never from Web Audio time.

**Tech Stack:** Browser JavaScript, RetroAppleJS Apple2IO device/peripheral APIs, existing `res/ayumi.js`, Web Audio API, Node.js built-in `node:test` + `assert`, `vm`-based source loading for headless tests.

**Spec:** `docs/superpowers/specs/2026-10-04-mockingboard-peripheral-design.md`

## Global Constraints

- WASM is completely out of scope: no WASM-specific code, switches, timing paths, assumptions, or tests.
- Dependencies are included statically from `index.html`; no dynamic script injection from peripheral/device files.
- Peripheral-specific logic stays out of `index.html`; index only provides static includes.
- Mockingboard hardware time is derived exclusively from emulated CPU ticks.
- Web Audio can consume, underrun, or drop playback data but must never advance VIA, AY, IRQ, CPU, or emulated sample time.
- `$Cn00-$Cn0F` is VIA0; `$Cn80-$Cn8F` is VIA1; the rest of the slot page must not alias those registers.
- Read-only (`ctx.bRO`) observation is side-effect free.
- v1 does not implement speech, Phasor/Echo+/MegaAudio, T1 PB7 output, T2 PB6 pulse counting, full shift-register behavior, or analog AY bus decay unless acceptance testing proves a regular Mockingboard dependency.
- Real-software acceptance includes `mockingboard1.dsk`, `mockingboard2.dsk`, `mock_test.dsk`, and Tom Charlesworth's mb-audit 6522 tests.

## Review Focus

- Timer accuracy at the bus timestamp: mb-audit expects real 6522 T1 `N+2` timing, `$0000` edge behavior, and instruction-addressing-mode-sensitive counter reads.
- Pending interrupt semantics: IFR may become set while IER is disabled; enabling IER later must assert IRQ immediately without losing the pending flag.
- Address isolation: `$Cn10/$Cn90` and other non-decoded slot-page addresses must not alias a VIA; VIA0 and VIA1 must also remain independent under interleaved DDR writes.
- Debug/read-only observation: `peekRegister()` and `ctx.bRO` must not clear timer flags or alter AY/VIA state.
- Host-audio stress: FIFO overflow/underrun must affect only playback quality, never hardware timing or PSG phase.

---

### Task 1: Implement and verify `MockingboardR6522`

**Files:**
- Modify: `res/EMU_CARD_mockingboard.js`
- Create: `tests/mockingboard_r6522.test.js`

**Interfaces:**
- Consumes: no Mockingboard-specific dependencies; only callback functions supplied through constructor options.
- Produces: global constructor `MockingboardR6522(options)` with `REG`, `IFR`, `REG_NAMES`, `reset()`, `readRegister(reg)`, `peekRegister(reg)`, `writeRegister(reg,value)`, `tick(cycles)`, `needsRealtimeTick()`, `setPortAInput(value,mask)`, `setPortBInput(value,mask)`, `setCA1(level)`, `setCA2(level)`, `setCB1(level)`, `setCB2(level)`, and `getState()`.

- [ ] **Step 1: Write the failing reset/port/IER tests**

Create Node tests that load `res/EMU_CARD_mockingboard.js` in a `vm` context with minimal `oEMU`/`Ayumi` stubs and assert:

```js
const via = new ctx.MockingboardR6522({});
assert.equal(via.peekRegister(0x02),0x00); // DDRB
assert.equal(via.peekRegister(0x03),0x00); // DDRA
assert.equal(via.paPins,0xFF);
assert.equal(via.pbPins,0xFF);

via.writeRegister(0x0E,0xC0); // enable T1
assert.equal(via.peekRegister(0x0E),0xC0); // bit7 always reads 1
via.writeRegister(0x0E,0x40); // disable T1
assert.equal(via.peekRegister(0x0E),0x80);
```

Also assert DDRA/DDRB patterns `$55/$AA/$69/$96` read back exactly and two distinct VIA instances do not alias state.

- [ ] **Step 2: Run the reset/port/IER tests and verify failure**

Run: `node --test tests/mockingboard_r6522.test.js`

Expected: FAIL because `MockingboardR6522` is not yet implemented.

- [ ] **Step 3: Implement the VIA register file and port-resolution core**

Implement the exact API above in `res/EMU_CARD_mockingboard.js`. Port pins resolve as `(ORx & DDRx) | (IRxExternal & ~DDRx)`, external inputs reset high, IER bit 7 always reads one, IFR bit 7 is synthesized, and callbacks fire only on resolved-pin/IRQ level changes.

- [ ] **Step 4: Add failing side-effect versus peek tests**

Cover T1CL/T2CL flag-clearing reads and verify the equivalent `peekRegister()` calls leave IFR and IRQ unchanged. Add SR storage tests and ensure ORA `$0F` uses no-handshake semantics.

- [ ] **Step 5: Implement side-effectful `readRegister()` and side-effect-free `peekRegister()`**

Keep debugger/state inspection independent of destructive register reads. `getState()` must use observational semantics only.

- [ ] **Step 6: Add failing timer/IRQ tests derived from mb-audit behavior**

Tests must pin:

```text
T1 one-shot underflow
T1 continuous/free-running period = latch N + 2 CPU cycles
T1 latch $0000 edge behavior
T2 PHI2 one-shot underflow
inactive timers do not create IFR flags
pending IFR + later IER enable asserts IRQ immediately
multiple continuous T1 periods survive a large tick(cycles) catch-up
T2 does not decrement from CPU ticks when ACR bit5 pulse-count mode is selected
```

Also run two VIA instances with simultaneous timers and confirm IRQ state remains independent until card aggregation is introduced.

- [ ] **Step 7: Implement timer arithmetic and realtime-tick predicate**

Implement batched timer progression rather than a per-period loop. Preserve mb-audit-observable `N+2` T1 timing and IFR/IER semantics. `needsRealtimeTick()` returns true only for running IRQ-enabled T1 or running IRQ-enabled T2 in PHI2 mode.

- [ ] **Step 8: Run the complete VIA suite**

Run: `node --test tests/mockingboard_r6522.test.js`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add res/EMU_CARD_mockingboard.js tests/mockingboard_r6522.test.js
git commit -m "feat: add Mockingboard 6522 core"
```

---

### Task 2: Implement and verify `MockingboardAYBus`

**Files:**
- Modify: `res/EMU_CARD_mockingboard.js`
- Create: `tests/mockingboard_aybus.test.js`

**Interfaces:**
- Consumes: renderer-compatible object implementing Ayumi methods used by register updates (`setTone`, `setNoise`, `setMixer`, `setVolume`, `setEnvelope`, `setEnvelopeShape`).
- Produces: global constructor `MockingboardAYBus(renderer,options)` with `reset(cycle)`, `observeViaPins(portA,portB,cycle)`, `getBusDrive()`, `isDrivingBus()`, `readRegister(index)`, `writeRegister(index,value,cycle)`, `getRegisters()`, and `getState()`.

- [ ] **Step 1: Write failing control-state tests**

Assert exact `$4/$5/$6/$7` decoding, PB2-low reset dominance, and the rule that READ/WRITE/LATCH execute only when entered from INACTIVE. In particular assert `$07 -> $06` does not write until `$04 -> $06` occurs.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/mockingboard_aybus.test.js`

Expected: FAIL because `MockingboardAYBus` is not yet implemented.

- [ ] **Step 3: Implement control-state machine and address validity**

Implement BC2-hardwired-high semantics. LATCH accepts only `$00-$0F`; values with any high-nibble bit set invalidate the address instead of masking it down.

- [ ] **Step 4: Add failing register-image/readback tests**

Pin the 16-register mask from the spec. Assert READ drives the selected value for the full READ state, leaving READ returns `null`/high impedance, and a READ with no valid latched address does not drive the bus.

- [ ] **Step 5: Implement masked register image and bus drive**

R14/R15 remain register images only. `getBusDrive()` exposes selected-register data only in valid READ state.

- [ ] **Step 6: Add failing renderer-application tests**

Use a fake renderer to assert correct tone/noise/mixer/volume/envelope method calls. Write R13 twice with the same value and assert `setEnvelopeShape()` is invoked twice.

- [ ] **Step 7: Implement renderer mapping and reset behavior**

Reset all AY registers/state, invalidate selected address, release the data bus, and apply valid writes to the renderer even when the stored value is unchanged.

- [ ] **Step 8: Run the AY bus suite**

Run: `node --test tests/mockingboard_aybus.test.js`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add res/EMU_CARD_mockingboard.js tests/mockingboard_aybus.test.js
git commit -m "feat: add Mockingboard AY bus"
```

---

### Task 3: Assemble the production Mockingboard card

**Files:**
- Modify: `res/EMU_CARD_mockingboard.js`
- Create: `tests/mockingboard_card.test.js`

**Interfaces:**
- Consumes: `MockingboardR6522`, `MockingboardAYBus`, global `Ayumi`, `ctx.cpuTick`, Apple2IO `getClockTicks()`, hardware `setIRQSource(source,active)`, and mount metadata.
- Produces: `mockingboard()` card with `reset()`, `restart()`, `onUnmount()`, `readSlotROM(addr,ctx)`, `writeSlotROM(addr,d8,ctx)`, `advanceTo(cpuTick)`, `syncClock(cpuTick)`, `needsRealtimeTick()`, audio FIFO APIs, `getRegisters(chipIndex)`, and `getViaState(index)`.

- [ ] **Step 1: Write failing strict-decode and read-only tests**

Instantiate a card in a small VM harness and assert:

```text
$00-$0F -> VIA0
$80-$8F -> VIA1
$10-$7F and $90-$FF -> floating read / ignored write
$10 and $90 specifically do not alias VIA registers (mb-audit T6522_12)
ctx.bRO reads use peek semantics and do not clear IFR
```

- [ ] **Step 2: Run card tests and verify failure**

Run: `node --test tests/mockingboard_card.test.js`

Expected: FAIL because the production wrapper is not assembled.

- [ ] **Step 3: Implement card construction and slot-page handlers**

Create two independent Ayumi instances, two AY buses, and two VIAs. VIA port-change callbacks update the matching AY bus and feed AY readback into VIA Port A external input. Use the card `action.SlotROM.RD/WR` callbacks and the strict decoder from the spec.

- [ ] **Step 4: Add failing AY-through-VIA integration tests**

Drive DDRA/DDRB and ORA/ORB through card register writes to execute a full `$07 -> $04 -> $06 -> $04` AY write sequence, then configure DDRA input and perform `$05` READ. Assert data returns through the VIA's resolved Port A pins.

- [ ] **Step 5: Implement AY/VIA coupling and diagnostic accessors**

Ensure high impedance maps to external `$FF`, valid READ drives AY data, and `getRegisters()` / `getViaState()` are side-effect free.

- [ ] **Step 6: Add failing timing and IRQ aggregation tests**

Assert `advanceTo()` is idempotent for the same absolute tick, both VIA timers catch up to `ctx.cpuTick`, pending timer IRQ from either VIA asserts a mount-specific `MOCK:<hash>` source, clearing only one VIA leaves IRQ asserted if the other remains pending, and reset/unmount deasserts the source.

- [ ] **Step 7: Implement absolute-clock synchronization and shared IRQ**

Use `ctx.cpuTick` for bus accesses and `io.getClockTicks()` as fallback. Derive the AY/CPU clock from the project's runtime CPU clock (`_o.CPU_ClocksTicks_s`) rather than a new wall-clock source or hard-coded browser cadence.

- [ ] **Step 8: Add failing deterministic-audio-ring tests**

Pin exact frame counts for known CPU-cycle advances using `floor(totalCycles * 44100 / cpuClock)` behavior, verify muting stops FIFO capture but not PSG advancement, verify 0.25-second typed-array capacity, and verify overflow drops the oldest frame while incrementing overrun/drop statistics.

- [ ] **Step 9: Implement deterministic stereo rendering and ring buffer**

Configure both Ayumi instances with `configure(false,cpuClock,44100)`, pan AY0's three voices left and AY1's three voices right, use the rational phase accumulator, and expose `getAudioFormat()`, `setAudioConsumerActive()`, `getAudioFramesAvailable()`, `drainAudioFrames()`, `clearAudioQueue()`, and `getAudioStats()`.

- [ ] **Step 10: Run all component/card tests**

Run:

```bash
node --test tests/mockingboard_r6522.test.js tests/mockingboard_aybus.test.js tests/mockingboard_card.test.js
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add res/EMU_CARD_mockingboard.js tests/mockingboard_card.test.js
git commit -m "feat: assemble Mockingboard peripheral"
```

---

### Task 4: Implement the browser audio/timing device

**Files:**
- Create: `res/EMU_DEVICE_mockingboard_audio.js`
- Create: `tests/mockingboard_audio_device.test.js`

**Interfaces:**
- Consumes: card APIs `needsRealtimeTick()`, `advanceTo(tick)`, `getAudioFormat()`, `setAudioConsumerActive(active)`, `getAudioFramesAvailable()`, `drainAudioFrames(maxFrames)`, `clearAudioQueue()`; Apple2IO `getClockTicks()`; attachment-injected `_ioRefreshHooks`.
- Produces: `MockingboardAudio` with `id.DCODE="MOCKAUDIO"`, `bindHost(owner)`, `bindIO(io)`, `restart()`, `reset()`, `onUnmount()`, `init(action)`, `isTickActive()`, `isCycleActive()`, `tick(n)`, `cycle()`, and `getStats()`.

- [ ] **Step 1: Write failing lifecycle/hook tests with a fake AudioContext**

Assert `bindHost()` accepts only a Mockingboard owner, `isTickActive()` mirrors `owner.needsRealtimeTick()`, `tick()` calls only `owner.advanceTo(io.getClockTicks())`, and audio on/off calls `_ioRefreshHooks` and toggles the card's audio-consumer state.

- [ ] **Step 2: Run device tests and verify failure**

Run: `node --test tests/mockingboard_audio_device.test.js`

Expected: FAIL because the device file does not exist.

- [ ] **Step 3: Implement lifecycle and exact-timer hook**

Keep the device free of VIA/AY state. `tick()` is only an emulated-clock synchronization hook.

- [ ] **Step 4: Add failing Web Audio drain tests**

Use a fake `AudioContext`/`AudioBuffer`/`AudioBufferSourceNode` and assert `cycle()` first synchronizes owner to the current emulated tick, drains already-produced stereo frames, schedules them from `nextStartTime`, and never invokes any card API that creates time from `AudioContext.currentTime`.

- [ ] **Step 5: Implement Web Audio buffer scheduling**

Use stereo `AudioBufferSourceNode` scheduling with an initial queue lead of 30 ms. Do not use ScriptProcessorNode or AudioWorklet. On host underrun, increment host stats and restart scheduling from `currentTime + queueLead` without fabricating samples.

- [ ] **Step 6: Add reset/unmount tests**

Assert reset/unmount stop/disconnect scheduled sources, clear transport timing/stat state as specified, retain the AudioContext across machine reset, and clear the card playback queue without changing card hardware timing.

- [ ] **Step 7: Run device and card tests**

Run:

```bash
node --test tests/mockingboard_audio_device.test.js tests/mockingboard_card.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add res/EMU_DEVICE_mockingboard_audio.js tests/mockingboard_audio_device.test.js
git commit -m "feat: add Mockingboard audio device"
```

---

### Task 5: Wire configuration and static includes

**Files:**
- Modify if needed: `res/COM_CONFIG.js`
- Modify: `index.html`
- Create: `tests/mockingboard_integration_config.test.js`

**Interfaces:**
- Consumes: global constructors `Ayumi`, `MockingboardAudio`, `mockingboard` and the existing `_CFG_PSLOT` / script include system.
- Produces: load order and peripheral configuration that let Apple2IO discover/provision the complete card without dynamic dependencies.

- [ ] **Step 1: Write failing static-configuration tests**

Read `index.html` and `res/COM_CONFIG.js` as text and assert:

```text
res/ayumi.js is enabled, not commented out
res/EMU_DEVICE_mockingboard_audio.js is included before res/EMU_CARD_mockingboard.js
MOCK has SlotIO:"" and SlotROM:"X"
MOCK HostIO and HostROM remain empty
MOCK slot range remains 1-7
```

If the current branch already contains the SlotIO/SlotROM correction, the test should pass that portion before any edit; do not churn the config unnecessarily.

- [ ] **Step 2: Run configuration test and verify only missing wiring fails**

Run: `node --test tests/mockingboard_integration_config.test.js`

Expected: FAIL for the currently absent/disabled script wiring; existing-correct config assertions may already pass.

- [ ] **Step 3: Enable/add the static includes and normalize Mockingboard config only where needed**

Keep all peripheral behavior in the card/device files. Replace the erroneous Videx manual reference with a Mockingboard-specific reference only if a stable reference URL is already available in the repository/spec context; otherwise leave manual-link cleanup out of the code change rather than guessing.

- [ ] **Step 4: Run configuration and all Mockingboard tests**

Run:

```bash
node --test tests/mockingboard_*.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html res/COM_CONFIG.js tests/mockingboard_integration_config.test.js
git commit -m "feat: wire Mockingboard runtime dependencies"
```

---

### Task 6: mb-audit compatibility hardening

**Files:**
- Modify as required by failures: `res/EMU_CARD_mockingboard.js`
- Modify/add tests: `tests/mockingboard_r6522.test.js`, `tests/mockingboard_card.test.js`
- Reference only: `https://github.com/tomcw/mb-audit/blob/main/chip-6522.a`

**Interfaces:**
- Consumes: completed Mockingboard card and VIA model.
- Produces: compatibility behavior sufficient for the regular two-6522 Mockingboard paths exercised by mb-audit without implementing clone-specific features.

- [ ] **Step 1: Translate mb-audit's regular-Mockingboard checks into targeted regression assertions**

Cover at minimum:

```text
Detect6522 timer-motion detection
DDRA/DDRB data-line patterns on both VIAs
A0-A3 register/address-line distinctions
IER bit7 readback
T1 IRQ path
T1/T2 polling with IER disabled
pending IFR followed by later IER enable
T1 period N+2 including N=$0000
both VIAs running timers concurrently
$Cn10/$Cn90 do not decode as the VIA
reset clears pending IRQ
```

Do not add Phasor/Echo+/MegaAudio expectations to regular Mockingboard v1.

- [ ] **Step 2: Run the regression suite before changing code**

Run:

```bash
node --test tests/mockingboard_r6522.test.js tests/mockingboard_card.test.js
```

Expected: any remaining compatibility mismatches fail with named mb-audit-derived tests.

- [ ] **Step 3: Fix only demonstrated regular-Mockingboard mismatches**

Preserve the approved scope. Promote a deferred 6522 behavior only when a regular Mockingboard mb-audit path or the supplied test disks prove it necessary.

- [ ] **Step 4: Run all automated tests**

Run:

```bash
node --test tests/*.test.js
```

Expected: PASS, including pre-existing Vaporlock/VBL tests.

- [ ] **Step 5: Commit**

```bash
git add res/EMU_CARD_mockingboard.js tests/mockingboard_r6522.test.js tests/mockingboard_card.test.js
git commit -m "test: harden Mockingboard against mb-audit"
```

---

### Task 7: Real-disk acceptance and trace validation

**Files:**
- No product file is changed unless a reproducible compatibility failure is found.
- Modify regression tests together with any required fix before committing that fix.

**Interfaces:**
- Consumes: final emulator build with Mockingboard mounted in a conventional slot, plus `disks/Utility/mockingboard1.dsk`, `disks/Utility/mockingboard2.dsk`, and `disks/Utility/mock_test.dsk`.
- Produces: verified real-software compatibility and a classified defect if any tool fails.

- [ ] **Step 1: Run `mock_test.dsk`**

Verify both 6522s are detected as independent devices, timer/IRQ tests complete for the supported regular-Mockingboard paths, and AY tests identify/play both PSG sides where applicable.

- [ ] **Step 2: Run `mockingboard1.dsk`**

Exercise every relevant diagnostic/demo and verify card detection, six-voice output, left/right separation, timer-driven playback, and clean reset behavior.

- [ ] **Step 3: Run `mockingboard2.dsk`**

Repeat relevant diagnostics/demos and verify no regression in detection, timing, IRQ or stereo output.

- [ ] **Step 4: Run mb-audit against the emulated card**

Use its regular Mockingboard/6522 path. Treat clone-specific failures as out of scope unless they also expose behavior required by a regular two-VIA Mockingboard.

- [ ] **Step 5: For any failure, capture the causal trace before changing code**

Trace at least:

```text
CPU tick
slot address and RD/WR value
VIA/register
PA/PB resolved pins
AY state/register/data
T1/T2 counter/load/underflow
IFR/IER
card IRQ level/source
```

Classify the failure as VIA timing/register semantics, AY bus semantics, slot decode, IRQ aggregation, deterministic sample generation, or host playback. Add a minimal automated regression test before fixing it.

- [ ] **Step 6: Run the final full automated suite**

Run: `node --test tests/*.test.js`

Expected: PASS.

- [ ] **Step 7: Commit any acceptance-driven fixes**

Use one focused commit per demonstrated defect, including its regression test.
