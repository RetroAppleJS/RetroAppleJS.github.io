# Liron UniDisk 3.5 Browser Mount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make UniDisk 3.5 a normal Apple2IO child of Liron, route ordinary browser-loaded 819,200-byte `.po` images to SmartPort unit 1, and prove the browser-mounted `CardCat 1.94.po` can be read through the authentic Liron ROM without direct test-harness media injection.

**Architecture:** Apple2IO remains the owner of declarative child-device construction. `AppleLiron.deviceConfig` declares one `UNIDISK35`; `UniDisk35Device.bindHost()` attaches that exact instance to Liron's `SmartPortBus` as unit 1. Browser local-file/catalog byte sources converge on a production media-routing helper in `EMU_apple2main.js`: 5.25-inch images keep the existing Disk II path while exactly 819,200-byte images resolve the mounted `UNIDISK35` child and call its production `loadImage()` method.

**Tech Stack:** Browser JavaScript, RetroAppleJS Apple2IO/device configuration, Node.js `node:test`/`vm`, authentic Liron ROM, GitHub Actions + headless Chromium/Playwright for end-to-end acceptance.

**Spec:** `docs/superpowers/specs/2026-09-19-liron-unidisk-browser-mount-design.md`

## Global Constraints

- There must be exactly one authoritative `UniDisk35Device` instance owned by Apple2IO under the mounted Liron card.
- `EMU_apple2io.js` must not require behavioral changes; stop and reassess if it does.
- Existing Disk II behavior and 140 KiB image routing must remain unchanged.
- Exactly 819,200-byte images route to UniDisk unit 1; invalid sizes never partially replace media.
- This milestone remains read-only: no WRITE BLOCK, FORMAT, dirty-image persistence, or download support.
- No production special-casing for Card Cat.
- The end-to-end acceptance harness must not call `loadImage()` or `readBlock()` directly.
- The acceptance path must exercise the browser-facing mount function, authentic Liron ROM/IWM/SmartPort transport, and returned Apple II memory data.

## Review Focus

- **No Liron/UniDisk mounted:** an 819,200-byte browser load returns failure and does not throw or mutate unrelated Disk II media; Task 2 tests this explicitly.
- **Duplicate provision/restart:** repeated `bindHost()`/Apple2IO provisioning remains idempotent and SmartPort still contains one unit-1 device; Task 1 tests this explicitly.
- **Multiple Liron controllers:** an 819,200-byte load without an explicit resolvable target must fail rather than choose an arbitrary controller; Task 2 tests this explicitly.
- **Existing 5.25-inch images:** 143,360-byte routing continues through Disk II conversion/loading and never touches UniDisk; Task 2 tests this explicitly.
- **Bad 800 KiB media size/state preservation:** rejected media leaves the previously mounted UniDisk image intact; Task 2 tests this with a known block before/after the rejected load.

---

### Task 1: Move UniDisk ownership into Apple2IO's declarative Liron child-device path

**Files:**
- Modify: `res/EMU_CARD_LIRON.js`
- Modify: `res/EMU_DEVICE_UNIDISK35.js`
- Modify: `tests/liron_smartport_bus.test.js`
- Modify: `tests/liron_browser_integration.test.js`

**Interfaces:**
- Consumes: existing `Apple2IO.provisionPeripheral(owner)` behavior, which iterates `owner.deviceConfig`, constructs each configured `coID`, stores it in `owner.devices`, and calls `device.bindHost(owner)`.
- Produces: `AppleLiron.attachUniDisk(device) -> device`, `AppleLiron.getUniDisk() -> UniDisk35Device|null`, `UniDisk35Device.bindHost(host) -> boolean`, and one declarative `AppleLiron.deviceConfig` entry with `DCODE:"UNIDISK35"`, `hostPCODE:"LIRON"`, `coID:"UniDisk35Device"`, `deviceN:1`.

- [ ] **Step 1: Rewrite the existing constructor-assumption tests to require declarative ownership**

In `tests/liron_smartport_bus.test.js`, replace the current test that expects `new AppleLiron()` to privately create unit 1 with tests equivalent to:

```javascript
test('AppleLiron declares one UniDisk child but does not privately construct it', () => {
    const context = loadLiron();
    const card = new context.AppleLiron();

    assert.equal(card.deviceConfig.length,1);
    assert.equal(card.deviceConfig[0].DCODE,'UNIDISK35');
    assert.equal(card.deviceConfig[0].hostPCODE,'LIRON');
    assert.equal(card.deviceConfig[0].coID,'UniDisk35Device');
    assert.equal(card.deviceConfig[0].deviceN,1);
    assert.equal(card.getUniDisk(),null);
    assert.deepEqual(Array.from(card.getBus().getUnits()),[]);
});

test('bindHost attaches the exact Apple2IO-created UniDisk as unit 1 idempotently', () => {
    const context = loadLiron();
    const card = new context.AppleLiron();
    const disk = new context.UniDisk35Device(card.deviceConfig[0]);

    assert.equal(disk.bindHost(card),true);
    assert.equal(card.getUniDisk(),disk);
    assert.equal(card.getBus().getDevice(1),disk);
    assert.equal(disk.getUnit(),1);

    assert.equal(disk.bindHost(card),true);
    assert.deepEqual(Array.from(card.getBus().getUnits()),[1]);
    assert.equal(card.getBus().getState().deviceCount,1);
});
```

Update `tests/liron_browser_integration.test.js` so browser script-order discovery expects the global discovery card to declare the child rather than privately populate unit 1 before Apple2IO provisioning.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test tests/liron_smartport_bus.test.js tests/liron_browser_integration.test.js
```

Expected: FAIL because `AppleLiron.deviceConfig` is still empty, `getUniDisk()` is privately constructed, and `UniDisk35Device.bindHost()` does not exist.

- [ ] **Step 3: Implement the minimal single-authoritative-device ownership path**

In `AppleLiron`, replace private construction:

```javascript
var unidisk = typeof(UniDisk35Device)==="function" ? new UniDisk35Device() : null;
if(unidisk) smartport.attach(unidisk,1);
```

with:

```javascript
var unidisk = null;

this.deviceConfig = [{
     "DCODE":"UNIDISK35"
    ,"hostPCODE":"LIRON"
    ,"coID":"UniDisk35Device"
    ,"deviceN":1
    ,"icon":"fa fa-hdd"
    ,"description":"Apple UniDisk 3.5"
}];

this.attachUniDisk = function(device)
{
    if(!device || device.id?.DCODE!=="UNIDISK35") return null;
    if(unidisk===device) return device;
    if(unidisk!==null && unidisk!==device)
        throw new Error("Liron already has a UniDisk 3.5 child");

    smartport.attach(device,1);
    unidisk=device;
    return device;
};
```

Keep `getUniDisk()` returning `unidisk`.

In `UniDisk35Device`, add:

```javascript
var host = null;

this.bindHost = function(owner)
{
    if(!owner || owner.id?.PCODE!=="LIRON" || typeof(owner.attachUniDisk)!=="function")
        return false;
    if(host && host!==owner) return false;
    if(owner.attachUniDisk(this)!==this) return false;
    host=owner;
    return true;
};
```

Do not add global emulator lookups.

- [ ] **Step 4: Run focused tests and full Liron unit regressions**

Run:

```bash
node --check res/EMU_CARD_LIRON.js
node --check res/EMU_DEVICE_UNIDISK35.js
node --test \
  tests/liron_card.test.js \
  tests/liron_iwm.test.js \
  tests/liron_smartport_bus.test.js \
  tests/liron_smartport_transport.test.js \
  tests/liron_browser_integration.test.js \
  tests/liron_readblock.test.js \
  tests/unidisk35.test.js
```

Expected: PASS. Any test that instantiated `AppleLiron` directly and assumed an already-populated unit 1 must explicitly create/bind the child, matching Apple2IO's production lifecycle.

- [ ] **Step 5: Commit Task 1**

```bash
git add res/EMU_CARD_LIRON.js res/EMU_DEVICE_UNIDISK35.js \
        tests/liron_smartport_bus.test.js tests/liron_browser_integration.test.js \
        tests/liron_smartport_transport.test.js tests/liron_readblock.test.js
git commit -m "refactor: provision UniDisk as Liron child device"
```

---

### Task 2: Route normal browser disk-image loading to UniDisk unit 1

**Files:**
- Modify: `res/EMU_apple2main.js`
- Modify: `res/EMU_DEVICE_UNIDISK35.js`
- Create: `tests/liron_browser_mount.test.js`

**Interfaces:**
- Consumes: Apple2IO's existing `DCODE2obj("UNIDISK35","LIRON")` child lookup and Task 1's authoritative child ownership.
- Produces: `EMU_unidisk35Device(slotN) -> UniDisk35Device|null` and `EMU_mountDiskImage(bytes,slotN,deviceID,filepath) -> boolean`. Existing `loadDisk_fromBuffer(...)` and local `FileReader.onload` code delegate to `EMU_mountDiskImage()`.

- [ ] **Step 1: Add a VM-level browser-routing regression test**

Create `tests/liron_browser_mount.test.js` that evaluates `res/EMU_apple2main.js` with minimal stubs and injects a fake `apple2plus.hwObj().io` implementing:

```javascript
DCODE2obj(DCODE,hostPCODE) {
    return DCODE==='UNIDISK35' && hostPCODE==='LIRON' ? [disk] : [];
}
```

and a Disk II stub for the old path. Test:

```javascript
test('819200-byte browser media routes to the mounted UniDisk child', () => {
    const image = new Uint8Array(819200);
    assert.equal(context.EMU_mountDiskImage(image,null,'UNIDISK35','CardCat 1.94.po'),true);
    assert.equal(disk.loads.length,1);
    assert.equal(disk.loads[0].bytes.length,819200);
    assert.equal(disk.loads[0].meta.filename,'CardCat 1.94.po');
    assert.equal(disk2.loads.length,0);
});
```

Also add tests proving:

```javascript
// no UniDisk
assert.equal(EMU_mountDiskImage(new Uint8Array(819200),null,'UNIDISK35','x.po'),false);

// ambiguous two-UniDisk configuration without explicit target
assert.equal(EMU_mountDiskImage(new Uint8Array(819200),null,'UNIDISK35','x.po'),false);

// legacy 143360-byte route stays Disk II
assert.equal(EMU_mountDiskImage(new Uint8Array(143360),diskIISlot,'D1','boot.dsk'),true);
assert.equal(disk2.loads.length,1);
assert.equal(disk.loads.length,0);
```

For state preservation, use a real `UniDisk35Device`: first mount a valid 819,200-byte image, attempt a non-819,200 UniDisk-targeted image, then assert the known block still matches the first image.

- [ ] **Step 2: Run the new browser-routing test and verify RED**

Run:

```bash
node --test tests/liron_browser_mount.test.js
```

Expected: FAIL because `EMU_mountDiskImage` and `EMU_unidisk35Device` do not exist and the current 819,200-byte local-file branch only warns.

- [ ] **Step 3: Implement mounted-child resolution**

Add to `EMU_apple2main.js` near the existing disk helpers:

```javascript
function EMU_unidisk35Device(slotN)
{
    if(typeof(apple2plus)!="object" || !apple2plus) return null;
    var io=apple2plus.hwObj().io;
    if(!io) return null;

    var disks=typeof(io.DCODE2obj)==="function"
        ? io.DCODE2obj("UNIDISK35","LIRON")
        : [];

    if(Number.isInteger(Number(slotN)))
    {
        var owner=io.SLOT2obj(Number(slotN));
        if(owner && owner.id?.PCODE==="LIRON" && Array.isArray(owner.devices))
            for(var i=0;i<owner.devices.length;i++)
                if(owner.devices[i]?.id?.DCODE==="UNIDISK35") return owner.devices[i];
    }

    return disks.length===1 ? disks[0] : null;
}
```

This deliberately fails ambiguous multi-Liron resolution instead of selecting `disks[0]`.

- [ ] **Step 4: Implement one production media router and converge existing callers**

Add:

```javascript
function EMU_mountDiskImage(arr_buffer,slotN,deviceID,filepath)
{
    var bytes=arr_buffer instanceof Uint8Array
        ? arr_buffer
        : new Uint8Array(arr_buffer || []);

    if(bytes.length===819200)
    {
        var unidisk=EMU_unidisk35Device(slotN);
        if(!unidisk || typeof(unidisk.loadImage)!=="function") return false;
        unidisk.loadImage(bytes,{"filename":filepath || ""});
        return true;
    }

    var disk2=EMU_slotPeripheral(slotN,"DISKII");
    if(!disk2 || disk2.getState().active==false) return false;

    var diskBytes=Array.from(bytes);
    if(diskBytes.length===143360) diskBytes=disk2.convertDsk2Nib(diskBytes);
    return apple2plus.loadDisk(diskBytes,deviceID,slotN)!==false;
}
```

Refactor `loadDisk_fromBuffer()` to call `EMU_mountDiskImage()` and preserve its existing Disk II input highlighting. Refactor the local file `FileReader.onload` branch so it calls the same helper instead of directly calling `disk2.setDiskData(...)` or warning for 819,200 bytes.

Update `UniDisk35Device.loadImage(data,metadata)` to store optional browser metadata without changing the media-copy invariant:

```javascript
state.mediaFilename = metadata && metadata.filename
    ? String(metadata.filename).split(/[\\/]/).pop()
    : "";
```

Expose `mediaFilename` from `getState()`.

- [ ] **Step 5: Run browser-routing tests and focused regressions GREEN**

Run:

```bash
node --check res/EMU_apple2main.js
node --check res/EMU_DEVICE_UNIDISK35.js
node --test \
  tests/liron_browser_mount.test.js \
  tests/liron_browser_integration.test.js \
  tests/liron_smartport_bus.test.js \
  tests/unidisk35.test.js
```

Expected: PASS, including unchanged 5.25-inch routing.

- [ ] **Step 6: Commit Task 2**

```bash
git add res/EMU_apple2main.js res/EMU_DEVICE_UNIDISK35.js tests/liron_browser_mount.test.js
git commit -m "feat: route 800K browser media to UniDisk"
```

---

### Task 3: Add a permanent end-to-end Card Cat browser acceptance

**Files:**
- Create: `tests/cardcat_unidisk_browser_acceptance.js`
- Create: `.github/workflows/liron-cardcat-browser-acceptance.yml`
- Test data already present: `disks/Utility/Card Cat 1.94.dsk`, `disks/Utility/CardCat 1.94.po`

**Interfaces:**
- Consumes: Task 2's `EMU_mountDiskImage(...)`, the normal browser `index.html`, Apple2Plus live CPU execution, real Disk II boot path, authentic Liron ROM/IWM/SmartPort READ BLOCK path.
- Produces: repeatable CI evidence that browser configuration mounts the `.po`, Card Cat sees `SP:1`, and block 2 of that browser-mounted image reaches Apple II RAM through the authentic Liron firmware.

Card Cat 1.94's published SmartPort menu reports attached device information but does not provide a filesystem-directory browser. Therefore the acceptance uses Card Cat itself for the real browser boot and SmartPort discovery, then performs the directory read as Apple II-side SmartPort firmware traffic in the same running browser. This still forbids JS-side `loadImage()` and `readBlock()` calls: media enters only through the browser production router and directory data exits only through the authentic Liron ROM into emulated RAM.

- [ ] **Step 1: Write the browser acceptance script**

`tests/cardcat_unidisk_browser_acceptance.js` uses Playwright's Chromium API. It must:

1. Navigate to the locally served repository `index.html`.
2. Read both repository disk files through browser `fetch()` URLs.
3. Boot `Card Cat 1.94.dsk` using the existing normal Disk II browser function.
4. Mount `CardCat 1.94.po` by calling **only**:

```javascript
EMU_mountDiskImage(poBytes,null,'UNIDISK35','CardCat 1.94.po')
```

5. Assert from the mounted normal child object that `mediaLoaded===true`, `mediaBytes===819200`, `mediaFilename==='CardCat 1.94.po'`, and `getUnit()===1`.
6. Run live CPU ticks until Videx VRAM contains Card Cat's slot table and require:

```text
Apple II Liron Drive Controller (SP:1)
```

7. In Apple II RAM, install a tiny 6502 trampoline/SmartPort parameter list that calls the authentic slot-5 SmartPort entry for READ BLOCK unit 1, block 2, into `$3000`; resume the real CPU until it returns.
8. Read only Apple II RAM `$3000-$31FF` from the emulator and assert the 512 bytes match bytes 1024-1535 fetched from `CardCat 1.94.po` and contain `SYSTEM.APPLE`, `SYSTEM.PASCAL`, and `SYSTEM.STARTUP`.
9. Assert the test source itself contains no `.loadImage(` and no `.readBlock(` calls.

The RAM trampoline is allowed because it exercises the exact guest-visible SmartPort firmware API; it must not reach into `SmartPortBus` or `UniDisk35Device` directly.

- [ ] **Step 2: Add the permanent GitHub Actions browser workflow**

Create `.github/workflows/liron-cardcat-browser-acceptance.yml`:

```yaml
name: Liron Card Cat browser acceptance

permissions:
  contents: read

on:
  push:
    paths:
      - 'res/EMU_CARD_LIRON.js'
      - 'res/EMU_DEVICE_UNIDISK35.js'
      - 'res/EMU_apple2main.js'
      - 'res/EMU_apple2io.js'
      - 'index.html'
      - 'tests/cardcat_unidisk_browser_acceptance.js'
      - 'disks/Utility/Card Cat 1.94.dsk'
      - 'disks/Utility/CardCat 1.94.po'
  pull_request:
    paths:
      - 'res/EMU_CARD_LIRON.js'
      - 'res/EMU_DEVICE_UNIDISK35.js'
      - 'res/EMU_apple2main.js'
      - 'res/EMU_apple2io.js'
      - 'index.html'
      - 'tests/cardcat_unidisk_browser_acceptance.js'

jobs:
  acceptance:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm install --no-save playwright@1.55.0
      - run: npx playwright install --with-deps chromium
      - run: python3 -m http.server 8000 >/tmp/retroapple-http.log 2>&1 &
      - run: node tests/cardcat_unidisk_browser_acceptance.js
```

- [ ] **Step 3: Run acceptance RED before production routing is present**

On the Task-1-only revision, run the workflow/script and require failure at the browser-mount step because `EMU_mountDiskImage` is unavailable or the 819,200-byte route is rejected. Record that failure in the task notes/CI log; do not accept a failure caused by Chromium setup or missing disk files.

- [ ] **Step 4: Run acceptance GREEN against Tasks 1-2**

Expected acceptance evidence printed by the script:

```text
CARD_CAT_BROWSER_ACCEPTANCE {
  mounted: true,
  mediaBytes: 819200,
  unit: 1,
  sp1: true,
  readReturned: true,
  block: 2,
  blockMatch: true,
  directoryEntries: true
}
```

Any missing field or false value exits non-zero.

- [ ] **Step 5: Commit Task 3**

```bash
git add tests/cardcat_unidisk_browser_acceptance.js .github/workflows/liron-cardcat-browser-acceptance.yml
git commit -m "test: verify browser-mounted UniDisk with Card Cat"
```

---

### Task 4: Full regression and architecture guardrails

**Files:**
- No production files expected beyond Tasks 1-3.
- Verify: `res/EMU_apple2io.js` remains behaviorally unchanged.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: final branch evidence and a clean implementation containing no temporary CI helpers.

- [ ] **Step 1: Run the complete focused JavaScript suite**

```bash
node --check res/EMU_CARD_LIRON.js
node --check res/EMU_DEVICE_UNIDISK35.js
node --check res/EMU_apple2main.js
node --test \
  tests/liron_card.test.js \
  tests/liron_iwm.test.js \
  tests/liron_smartport_bus.test.js \
  tests/liron_smartport_transport.test.js \
  tests/liron_browser_integration.test.js \
  tests/liron_browser_mount.test.js \
  tests/liron_readblock.test.js \
  tests/unidisk35.test.js
```

Expected: zero failures.

- [ ] **Step 2: Run the permanent Card Cat browser acceptance freshly**

```bash
python3 -m http.server 8000 >/tmp/retroapple-http.log 2>&1 &
node tests/cardcat_unidisk_browser_acceptance.js
```

Expected: `CARD_CAT_BROWSER_ACCEPTANCE` reports all required booleans true and exits 0.

- [ ] **Step 3: Verify architecture constraints from the diff**

```bash
git diff <branch-base>...HEAD -- res/EMU_apple2io.js
```

Expected: no behavioral changes. Also inspect `EMU_CARD_LIRON.js` to confirm no private `new UniDisk35Device()` remains, and inspect the acceptance source to confirm no `.loadImage(` or `.readBlock(` occurs.

- [ ] **Step 4: Verify the branch contains no temporary workflows/debuggers**

```bash
find .github/workflows -maxdepth 1 -type f -name '*temp*' -print
```

Expected: no new temporary browser/Liron workflow files from this implementation.

- [ ] **Step 5: Commit only if verification required a test/document correction**

If no correction is needed, do not create an empty commit. If a permanent test-only correction was required, commit it with a focused `test:` message and rerun Steps 1-4.
