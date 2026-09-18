# Liron Controller Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a RetroAppleJS Liron / UniDisk 3.5 controller foundation that Card Cat 1.94 recognizes as an Apple II UniDisk 3.5 Controller (Liron), while establishing clean ROM, C800 and IWM/SmartPort boundaries for later UniDisk block I/O.

**Architecture:** `AppleLiron` follows existing RetroAppleJS card conventions and owns a verified 4 KiB Liron ROM plus a `LironIWM` instance. Slot ROM, shared C800 ROM and all 16 slot-I/O addresses are routed through existing Apple2IO mechanisms; SmartPort devices are not implemented yet, but a narrow empty-bus attachment boundary is provided.

**Tech Stack:** Browser JavaScript, RetroAppleJS peripheral framework, Node.js `assert`/`vm` style tests used by the repository.

**Spec:** `docs/superpowers/specs/2026-09-18-liron-foundation-design.md`

## Global Constraints

- Use authentic 4096-byte Liron firmware; do not synthesize Card Cat signature bytes.
- Card Cat 1.94 recognition is the Stage-1 manual acceptance test.
- Keep Disk II support separate from the Liron.
- Do not implement UniDisk block I/O, image parsing or SmartPort enumeration in this milestone.
- Do not introduce a new generic peripheral framework.
- Keep the IWM boundary isolated so it can later be moved to `EMU_DEVICE_IWM.js` without changing `AppleLiron` callers.

---

### Task 1: Add a Liron foundation test harness

**Files:**
- Create: `tests/liron_foundation.test.js`
- Read for pattern: `tests/cpu_nmos_decimal_cardcat.test.js`

**Interfaces:**
- Consumes: global browser-style source file `res/EMU_CARD_LIRON.js` loaded through Node `vm`.
- Produces: executable assertions for `AppleLiron`, `LIRON_ROM`, `LironIWM` and `SmartPortBus`.

- [ ] **Step 1: Write a failing test that expects the Liron globals**

```javascript
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('res/EMU_CARD_LIRON.js', 'utf8');
const sandbox = { console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

assert.equal(typeof sandbox.AppleLiron, 'function');
assert.equal(typeof sandbox.LironIWM, 'function');
assert.equal(typeof sandbox.SmartPortBus, 'function');
assert.equal(sandbox.LIRON_ROM.length, 4096);

const card = new sandbox.AppleLiron();
assert.equal(card.id.PCODE, 'LIRON');
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node tests/liron_foundation.test.js
```

Expected: failure because `res/EMU_CARD_LIRON.js` does not exist yet.

- [ ] **Step 3: Keep the test as the red baseline; do not add production behavior yet**

- [ ] **Step 4: Commit the red test**

```bash
git add tests/liron_foundation.test.js
git commit -m "test: define Liron foundation contract"
```

---

### Task 2: Create the card, empty SmartPort bus and isolated IWM shell

**Files:**
- Create: `res/EMU_CARD_LIRON.js`
- Modify: `tests/liron_foundation.test.js`

**Interfaces:**
- Produces:
  - `function AppleLiron()`
  - `function LironIWM(bus)`
  - `function SmartPortBus()`
  - `AppleLiron.prototype` behavior through instance methods `read`, `write`, `readROM`, `readHostROM`, `reset`, `restart`.

- [ ] **Step 1: Extend the test to verify empty-bus and reset semantics**

Add assertions equivalent to:

```javascript
const bus = new sandbox.SmartPortBus();
assert.equal(bus.hasDevices(), false);

const iwm = new sandbox.LironIWM(bus);
iwm.write(0x0F, 0xA5);
iwm.reset();
assert.equal(iwm.state.q6, 0);
assert.equal(iwm.state.q7, 0);
assert.equal(bus.hasDevices(), false);
```

- [ ] **Step 2: Implement the minimum constructors**

Use the existing discovery convention:

```javascript
if(oEMU===undefined) var oEMU = {"component":{"IO":{"Liron":new AppleLiron()}}};
else oEMU.component.IO.Liron = new AppleLiron();
```

`SmartPortBus` stores an internal device array and exposes `reset`, `attach`, `detach`, `hasDevices`.

`LironIWM` stores `bus` and a public diagnostic `state` object initialized to:

```javascript
{
    phase:0,
    motor:0,
    driveEnable:0,
    q6:0,
    q7:0,
    mode:0,
    data:0,
    status:0,
    handshake:0
}
```

`reset()` restores those exact values and calls `bus.reset()`.

- [ ] **Step 3: Add the RetroAppleJS card identity and bus callbacks**

```javascript
this.id = {"PCODE":"LIRON", "icon":"fa fa-save"};

this.action = {
    "SlotIO": {
        "RD":{"callback":function(addr,ctx){ return liron.read(addr,ctx); }},
        "WR":{"callback":function(addr,d8,ctx){ return liron.write(addr,d8,ctx); }}
    },
    "SlotROM": {
        "RD":{"callback":function(addr,ctx){ return liron.readROM(addr,ctx); }}
    },
    "HostROM": {
        "RD":{"callback":function(addr,ctx){ return liron.readHostROM(addr,ctx); }}
    }
};
```

All `$C0n0-$C0nF` accesses must normalize to `addr & 0x0F` and call the IWM object.

- [ ] **Step 4: Run the test**

```bash
node tests/liron_foundation.test.js
```

Expected: constructors, identity and reset tests pass; ROM assertions remain pending/failing until Task 3.

- [ ] **Step 5: Commit**

```bash
git add res/EMU_CARD_LIRON.js tests/liron_foundation.test.js
git commit -m "feat: add Liron card and IWM foundation"
```

---

### Task 3: Add and verify the authentic 4 KiB Liron ROM

**Files:**
- Modify: `res/EMU_CARD_LIRON.js`
- Modify: `tests/liron_foundation.test.js`

**Interfaces:**
- Produces: `const LIRON_ROM = new Uint8Array([...4096 verified bytes...])` or an equivalent existing RetroAppleJS-compatible immutable ROM resource exposed to the test harness.

- [ ] **Step 1: Obtain a verified Liron ROM dump**

Use a ROM image whose provenance can be cross-checked against at least one independent emulator/reference dump and verify its size is exactly 4096 bytes. Record its checksum in a source comment.

- [ ] **Step 2: Add test assertions for immutable identity data**

```javascript
assert.equal(sandbox.LIRON_ROM.length, 0x1000);
assert.equal(sandbox.LIRON_ROM[0x501], 0x20);
assert.equal(sandbox.LIRON_ROM[0x503], 0x00);
assert.equal(sandbox.LIRON_ROM[0x505], 0x03);
assert.equal(sandbox.LIRON_ROM[0x507], 0x00);
```

If the verified ROM dump proves a different physical address-to-ROM offset relationship, adjust these exact offsets to match the schematic-derived mapping and document the reason in the test.

- [ ] **Step 3: Add the ROM bytes and a hard size guard**

Production initialization must throw or disable the card if `LIRON_ROM.length !== 0x1000`.

- [ ] **Step 4: Run the test**

```bash
node tests/liron_foundation.test.js
```

Expected: ROM-size and known SmartPort signature assertions pass.

- [ ] **Step 5: Commit**

```bash
git add res/EMU_CARD_LIRON.js tests/liron_foundation.test.js
git commit -m "feat: add verified Liron firmware"
```

---

### Task 4: Implement slot-ROM and C800 expansion-ROM mapping

**Files:**
- Modify: `res/EMU_CARD_LIRON.js`
- Modify: `tests/liron_foundation.test.js`
- Read for reference: `res/EMU_CARD_thunderclock.js`, `res/EMU_CARD_serialpro.js`, `res/EMU_apple2io.js`

**Interfaces:**
- Consumes: `this.mount.slotN` assigned by Apple2IO.
- Produces:
  - `readROM(addr, ctx) -> byte`
  - `readHostROM(addr, ctx) -> byte`
  - correct existing HostROM claim behavior when slot firmware is accessed.

- [ ] **Step 1: Add tests for slot 5 mapping**

Set a synthetic mount context with physical slot 5 and assert:

```javascript
card.mount = {slotN:5};
assert.equal(card.readROM(0xC501), sandbox.LIRON_ROM[0x501]);
assert.equal(card.readROM(0xC503), sandbox.LIRON_ROM[0x503]);
assert.equal(card.readROM(0xC505), sandbox.LIRON_ROM[0x505]);
assert.equal(card.readROM(0xC507), sandbox.LIRON_ROM[0x507]);
assert.equal(card.readHostROM(0xC800), sandbox.LIRON_ROM[0x800]);
assert.equal(card.readHostROM(0xCFFF), sandbox.LIRON_ROM[0xFFF]);
```

Also remount in another slot and prove only the `$Cn00` page selection changes while C800 mapping remains offsets `$800-$FFF`.

- [ ] **Step 2: Implement slot-page translation**

The slot number selects firmware page `slotN << 8`; the low byte comes from the Apple II address.

```javascript
var romOffset = ((liron.mount.slotN & 0x0F) << 8) | (addr & 0xFF);
return LIRON_ROM[romOffset];
```

- [ ] **Step 3: Implement C800 translation**

```javascript
return LIRON_ROM[0x800 | (addr & 0x07FF)];
```

- [ ] **Step 4: Reuse the current C8-owner mechanism**

Copy the minimum ownership/claim pattern used by current HostROM cards. Do not invent a Liron-only global C800 selector.

- [ ] **Step 5: Run the Liron test and existing relevant peripheral tests**

```bash
node tests/liron_foundation.test.js
node tests/cpu_nmos_decimal_cardcat.test.js
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add res/EMU_CARD_LIRON.js tests/liron_foundation.test.js
git commit -m "feat: map Liron slot and expansion ROM"
```

---

### Task 5: Verify all sixteen IWM slot-I/O addresses route through one boundary

**Files:**
- Modify: `res/EMU_CARD_LIRON.js`
- Modify: `tests/liron_foundation.test.js`

**Interfaces:**
- `AppleLiron.read(addr,ctx)` calls `iwm.read(addr & 0x0F,ctx)`.
- `AppleLiron.write(addr,d8,ctx)` calls `iwm.write(addr & 0x0F,d8,ctx)`.

- [ ] **Step 1: Add a spy-based routing test**

Expose a diagnostic accessor such as `card.getIWM()` and replace/spy its `read` and `write` methods. For each register 0 through 15, call the card with an address whose low nibble is that register and assert the same register reaches the IWM.

- [ ] **Step 2: Implement `getIWM()` as a read-only diagnostic hook**

```javascript
this.getIWM = function(){ return iwm; };
this.getSmartPortBus = function(){ return smartPortBus; };
```

- [ ] **Step 3: Keep IWM behavior minimal but deterministic**

For this milestone, reads/writes may update phase/motor/Q6/Q7 and return idle/status values, but no SmartPort packet interpretation belongs in `AppleLiron`.

- [ ] **Step 4: Run the test**

```bash
node tests/liron_foundation.test.js
```

Expected: all 16 register-routing assertions pass.

- [ ] **Step 5: Commit**

```bash
git add res/EMU_CARD_LIRON.js tests/liron_foundation.test.js
git commit -m "test: verify Liron IWM register routing"
```

---

### Task 6: Register LIRON in RetroAppleJS configuration and browser load order

**Files:**
- Modify: `res/COM_CONFIG.js`
- Modify: `index.html`
- Modify: `tests/liron_foundation.test.js` or add a focused configuration assertion script if parsing `COM_CONFIG.js` in the existing harness is cleaner.

**Interfaces:**
- Produces: `LIRON` as a selectable/mountable peripheral PCODE using SlotIO + SlotROM + HostROM capabilities.

- [ ] **Step 1: Add the peripheral metadata entry**

Use the same field structure as current card entries. Required identity:

```javascript
"LIRON": {
    "NAME":"Apple UniDisk 3.5 Interface Controller (Liron)",
    "HostIO":"",
    "SlotIO":"X",
    "SlotROM":"X",
    "HostROM":"X"
}
```

Preserve whatever additional metadata keys surrounding entries require.

- [ ] **Step 2: Add the script tag before `EMU_apple2io.js`**

```html
<script type="text/javascript" src="res/EMU_CARD_LIRON.js"></script>
```

Place it with the other card scripts in the existing load-order block.

- [ ] **Step 3: Do not replace the default Disk II slot-6 configuration**

If adding a default demonstration profile, prefer Liron in slot 5 and existing Disk II in slot 6. Otherwise leave defaults unchanged and make LIRON selectable.

- [ ] **Step 4: Run tests**

```bash
node tests/liron_foundation.test.js
node tests/cpu_nmos_decimal_cardcat.test.js
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add res/COM_CONFIG.js index.html tests/liron_foundation.test.js
git commit -m "feat: register Liron peripheral"
```

---

### Task 7: Card Cat Stage-1 validation

**Files:**
- Modify only if required by observed Card Cat failure: `res/EMU_CARD_LIRON.js`, `res/COM_CONFIG.js`, `index.html`, `tests/liron_foundation.test.js`

**Interfaces:**
- External acceptance: Card Cat 1.94 slot scan.

- [ ] **Step 1: Mount the Liron in slot 5 and retain Disk II in slot 6**

Expected configuration:

```text
S5 = LIRON
S6 = DISKII
```

- [ ] **Step 2: Boot Card Cat 1.94 and inspect its normal slot inventory**

Expected identification:

```text
5   Apple II UniDisk 3.5 Controller (Liron)
```

Wording/spacing may differ, but it must use Card Cat's known Liron database entry rather than an unknown-card fallback.

- [ ] **Step 3: If recognition fails, use Card Cat `[V]iew` for slot 5**

Compare all displayed `$C500-$C5FF` bytes against `LIRON_ROM[0x500..0x5FF]`. If they differ, fix mapping/ownership rather than adding Card Cat-specific signature hacks.

- [ ] **Step 4: Re-run automated tests after any fix**

```bash
node tests/liron_foundation.test.js
node tests/cpu_nmos_decimal_cardcat.test.js
```

- [ ] **Step 5: Commit the validated foundation**

```bash
git add res/EMU_CARD_LIRON.js res/COM_CONFIG.js index.html tests/liron_foundation.test.js
git commit -m "feat: validate Liron controller with Card Cat"
```

---

## Completion criteria

The foundation is complete when all of the following are true:

- `node tests/liron_foundation.test.js` passes.
- Existing Card Cat CPU regression test still passes.
- LIRON mounts through normal RetroAppleJS peripheral configuration.
- Slot ROM is sourced from the verified 4 KiB firmware.
- C800 expansion ROM ownership uses existing RetroAppleJS semantics.
- All 16 slot-I/O addresses route to `LironIWM`.
- Empty SmartPort bus state is deterministic.
- Card Cat 1.94 identifies the card as Apple II UniDisk 3.5 Controller (Liron).
- Card Cat SmartPort enumeration is explicitly allowed to remain empty/not functional until the next milestone.
