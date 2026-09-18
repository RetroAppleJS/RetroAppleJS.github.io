# Liron SmartPort Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the authentic Liron ROM enumerate the attached UniDisk 3.5 as SmartPort unit 1 and receive valid STATUS/DIB replies through the IWM/SmartPort transport.

**Architecture:** Keep `AppleLiron` unchanged as the card/address mapper. Extend `LironIWM` only to forward phase-line changes while retaining DATA/STATUS register delegation, and turn `SmartPortBus` into a byte-accurate, line-aware REQ/ACK and packet state machine that dispatches INIT/STATUS to the existing `UniDisk35Device`.

**Tech Stack:** Browser JavaScript, Node.js `node:test`, `vm` test harness, existing RetroAppleJS Liron/UniDisk code.

**Spec:** `docs/superpowers/specs/2026-09-18-liron-smartport-transport-design.md`

## Global Constraints

- Do not trap Liron ROM calls or special-case CardCat.
- Keep packet logic below `LironIWM`; `AppleLiron` remains a thin wrapper.
- Preserve unit 1 attachment and the 1600-block logical UniDisk model.
- Do not implement READBLOCK, WRITEBLOCK, FORMAT, or image handling.
- Use byte-accurate SmartPort framing and REQ/ACK state, not cycle-accurate serial bit cells.
- Reset protocol state without detaching devices.

---

### Task 1: Define packet codec and STATUS transport contract

**Files:**
- Create: `tests/liron_smartport_transport.test.js`
- Modify: `res/EMU_CARD_LIRON.js`

**Interfaces:**
- Produces `SmartPortBus.writeData(byte,lines,ctx)` packet RX behavior.
- Produces `SmartPortBus.readData(lines,ctx)` packet TX behavior.
- Produces diagnostic `SmartPortBus.getState()` fields `protocolState`, `ack`, `req`, `rxLength`, `txLength`, `txIndex`.

- [ ] **Step 1: Write failing tests with independent packet helpers**

Test helper must encode raw payload `[0x00,0x01,0x00]` (STATUS, unit 1, status code 0) into a command packet with sync `FF 3F CF F3 FC FF C3`, seven wire-header bytes, payload groups, checksum, and `C8`.

Test flow:

```javascript
const bus = new context.SmartPortBus();
const disk = new context.UniDisk35Device();
bus.attach(disk,1);
bus.setLines(0x0A); // PH1+PH3: SmartPort enabled, REQ low
for(const b of encodeCommand([0x00,0x01,0x00])) bus.writeData(b,0x0A);
assert.equal(bus.getState().protocolState,'RESPONSE_PENDING');
```

Then raise REQ and drain `readData()` until packet end; independently decode the reply and assert packet type `$81`, status `$00`, payload `[0xF8,0x40,0x06,0x00]`.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
node --test tests/liron_smartport_transport.test.js
```

Expected: fail because `SmartPortBus.setLines()` and packet state do not exist.

- [ ] **Step 3: Implement sync detection, header collection, payload length and packet validation**

Use states:

```javascript
WAIT_SYNC
RECEIVE_COMMAND
RESPONSE_PENDING
SEND_RESPONSE
RESPONSE_DONE
```

Header bytes are stored as `wireByte & 0x7F`. Expected packet length after `$C3` is:

```javascript
7 + (oddCount ? 1 + oddCount : 0) + groupCount * 8 + 3
```

- [ ] **Step 4: Implement 7-bit payload decode and response encode**

Decode odd bytes and groups of seven by restoring MSBs from each group-MSB byte. Encode response payload symmetrically. Checksum XORs raw payload bytes and the seven wire header bytes.

- [ ] **Step 5: Implement STATUS dispatch**

For decoded command `$00`:

```javascript
const unit = payload[1] || 0;
const statusCode = payload[2] || 0;
```

Unit 1 calls `device.status(statusCode)`. Build an `$81` response whose status field is `reply.error` and payload is `reply.data`.

- [ ] **Step 6: Run focused test GREEN and commit**

```bash
node --check res/EMU_CARD_LIRON.js
node --test tests/liron_smartport_transport.test.js
```

Expected: pass.

Commit: `feat: add SmartPort packet STATUS transport`

---

### Task 2: Add SmartPort line / ACK handshake through LironIWM

**Files:**
- Modify: `tests/liron_smartport_transport.test.js`
- Modify: `tests/liron_iwm.test.js`
- Modify: `res/EMU_CARD_LIRON.js`

**Interfaces:**
- `SmartPortBus.setLines(lines,ctx)` consumes IWM line mask.
- `SmartPortBus.readSense(lines,ctx)` exposes ACK/SENSE.
- `LironIWM.touchState()` calls `bus.setLines()` for PHASE0..PHASE3 changes.

- [ ] **Step 1: Write failing line tests**

Use an IWM with a spy bus and prove that touching registers `$0/$1 .. $6/$7` forwards line changes. With the real bus, assert:

```javascript
bus.setLines(0x0A); // enabled, REQ low
bus.setLines(0x0B); // enabled, REQ high
assert.equal(bus.getState().req,true);
```

After a valid command is accepted, assert ACK/SENSE becomes active; after response completion and REQ returning low, assert it releases.

- [ ] **Step 2: Add bus reset test**

Put the bus into non-idle state, then assert PH0+PH2 causes protocol reset while `getUnits()` remains `[1]`.

- [ ] **Step 3: Implement `setLines()` and IWM forwarding**

Track only the low four phase bits. Detect reset before normal enable/REQ handling. On phase-bit changes, `LironIWM` forwards the complete eight-bit latch mask to the bus.

- [ ] **Step 4: Map ACK to `readSense()`**

Keep SENSE behavior isolated in `SmartPortBus`; do not add SmartPort-specific status logic to IWM.

- [ ] **Step 5: Run IWM and transport tests GREEN and commit**

```bash
node --test tests/liron_iwm.test.js tests/liron_smartport_transport.test.js
```

Commit: `feat: wire SmartPort REQ ACK through IWM phases`

---

### Task 3: Implement enumeration / INIT and DIB status

**Files:**
- Modify: `tests/liron_smartport_transport.test.js`
- Modify: `res/EMU_CARD_LIRON.js`

**Interfaces:**
- Command `$05` INIT updates `unitOffset` and returns encoded `$81` response.
- STATUS unit 0 code 0 reports one resident.
- STATUS unit 1 code 3 delegates to UniDisk DIB.

- [ ] **Step 1: Add failing INIT/enumeration tests**

Send INIT and STATUS packets using the same codec helper. Require the single-device chain to expose the first resident and terminate enumeration cleanly. Require STATUS unit 0 to report exactly one resident.

- [ ] **Step 2: Add failing DIB transport test**

Send STATUS unit 1 / code `$03`; decode reply and assert 25-byte payload, `DISK 3.5`, device type `$01`, subtype `$00`, and block count bytes `40 06 00`.

- [ ] **Step 3: Implement INIT and unit-zero status dispatch**

Preserve the JavaScript unit table. Use `unitOffset` only for SmartPort-visible addressing. Unsupported commands produce bad-command/error response rather than block I/O.

- [ ] **Step 4: Run focused transport tests GREEN and commit**

```bash
node --test tests/liron_smartport_transport.test.js
```

Commit: `feat: enumerate UniDisk over SmartPort`

---

### Task 4: Regression and browser integration verification

**Files:**
- No production file expected unless regression fixes are required.
- Tests: all Liron/UniDisk suites.

**Interfaces:**
- Existing ROM/CardCat card identity remains unchanged.
- Existing browser load-order constructs unit 1.

- [ ] **Step 1: Run syntax checks**

```bash
node --check res/EMU_CARD_LIRON.js
node --check res/EMU_DEVICE_UNIDISK35.js
```

- [ ] **Step 2: Run the full focused suite**

```bash
node --test \
  tests/unidisk35.test.js \
  tests/liron_iwm.test.js \
  tests/liron_card.test.js \
  tests/liron_smartport_bus.test.js \
  tests/liron_browser_integration.test.js \
  tests/liron_smartport_transport.test.js
```

Expected: all pass, zero failures.

- [ ] **Step 3: Verify no block-I/O API was introduced**

Existing UniDisk test must still prove `readBlock` and `writeBlock` are undefined.

- [ ] **Step 4: Manual CardCat acceptance**

Run CardCat with Liron slot 5. Expected progression is from `SP:0, no units` to one SmartPort device / resident. If CardCat still reports zero units, inspect transport debug state and Liron phase/REQ/ACK sequencing; do not add a CardCat-specific shortcut.
