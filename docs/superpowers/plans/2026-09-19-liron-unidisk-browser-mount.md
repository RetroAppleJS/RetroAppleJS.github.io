# Liron UniDisk 3.5 Browser Mount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make UniDisk 3.5 a normal Apple2IO child of Liron, route ordinary browser-loaded 819,200-byte `.po` images to SmartPort unit 1, and prove that Card Cat can discover and then actually boot/read its browser-mounted 800 KiB volume without test-harness media injection.

**Architecture:** Apple2IO remains the owner of declarative child-device construction. `AppleLiron.deviceConfig` declares one `UNIDISK35`; `UniDisk35Device.bindHost()` attaches that exact instance to Liron's `SmartPortBus` as unit 1. Browser local-file/catalog byte sources converge on one production router in `EMU_apple2main.js`: 5.25-inch images keep the existing Disk II path while exactly 819,200-byte images resolve the mounted `UNIDISK35` child and call its production `loadImage()` method.

**Tech Stack:** Browser JavaScript, RetroAppleJS Apple2IO/device configuration, Node.js `node:test`/`vm`, authentic Liron ROM, GitHub Actions, Playwright/Chromium.

**Spec:** `docs/superpowers/specs/2026-09-19-liron-unidisk-browser-mount-design.md`

## Global Constraints

- Exactly one authoritative `UniDisk35Device` is owned by Apple2IO under a mounted Liron card.
- `res/EMU_apple2io.js` receives no behavioral changes; stop and reassess if that becomes necessary.
- Existing Disk II behavior and 143,360-byte routing remain unchanged.
- Exactly 819,200-byte images route to UniDisk unit 1; invalid UniDisk-targeted sizes never replace current media.
- Read-only milestone: no WRITE BLOCK, FORMAT, dirty persistence, or download support.
- No Card Cat special case in production code.
- End-to-end acceptance must not call `loadImage()` or `readBlock()` directly.
- Acceptance must use the browser-facing media router and the authentic Liron ROM/IWM/SmartPort path.

## Review Focus

- **No Liron/UniDisk mounted:** an 819,200-byte browser load returns `false` without touching Disk II media — Task 2.
- **Duplicate provision/restart:** repeated `bindHost()` is idempotent and leaves exactly one unit-1 resident — Task 1.
- **Multiple Liron controllers:** an 800 KiB load without an explicit resolvable target fails instead of choosing arbitrarily — Task 2.
- **Existing 5.25-inch images:** 143,360-byte media still uses Disk II conversion/loading and never touches UniDisk — Task 2.
- **Bad UniDisk-targeted size:** rejection leaves the previously loaded 800 KiB media intact — Task 2.

---

### Task 1: Make UniDisk a declarative Liron child device

**Files:**
- Modify: `res/EMU_CARD_LIRON.js`
- Modify: `res/EMU_DEVICE_UNIDISK35.js`
- Modify: `tests/liron_smartport_bus.test.js`
- Modify: `tests/liron_browser_integration.test.js`
- Modify: `tests/liron_smartport_transport.test.js`
- Modify: `tests/liron_readblock.test.js`

**Interfaces:**
- Consumes: `Apple2IO.provisionPeripheral(owner)` / `Apple2IO.attach(owner,deviceConfig)`.
- Produces: `AppleLiron.attachUniDisk(device)`, `AppleLiron.getUniDisk()`, `UniDisk35Device.bindHost(host)`, one `deviceConfig` entry with `DCODE:"UNIDISK35"`, `hostPCODE:"LIRON"`, `coID:"UniDisk35Device"`, `deviceN:1`.

- [ ] **Step 1: Write RED ownership tests**

Replace the old private-construction expectation with:

```javascript
test('AppleLiron declares one UniDisk child without privately constructing it', () => {
    const context=loadLiron();
    const card=new context.AppleLiron();

    assert.equal(card.deviceConfig.length,1);
    assert.deepEqual(
        {
            DCODE:card.deviceConfig[0].DCODE,
            hostPCODE:card.deviceConfig[0].hostPCODE,
            coID:card.deviceConfig[0].coID,
            deviceN:card.deviceConfig[0].deviceN
        },
        {DCODE:'UNIDISK35',hostPCODE:'LIRON',coID:'UniDisk35Device',deviceN:1}
    );
    assert.equal(card.getUniDisk(),null);
    assert.deepEqual(Array.from(card.getBus().getUnits()),[]);
});

test('bindHost attaches the exact Apple2IO-created child as unit 1 idempotently', () => {
    const context=loadLiron();
    const card=new context.AppleLiron();
    const disk=new context.UniDisk35Device(card.deviceConfig[0]);

    assert.equal(disk.bindHost(card),true);
    assert.equal(card.getUniDisk(),disk);
    assert.equal(card.getBus().getDevice(1),disk);
    assert.equal(disk.getUnit(),1);

    assert.equal(disk.bindHost(card),true);
    assert.deepEqual(Array.from(card.getBus().getUnits()),[1]);
    assert.equal(card.getBus().getState().deviceCount,1);
});
```

Update `tests/liron_browser_integration.test.js` so the discovery instance is expected to declare the child; unit 1 exists only after an Apple2IO-style child is constructed and bound. Update `tests/liron_smartport_transport.test.js` and `tests/liron_readblock.test.js` helpers so direct `AppleLiron` construction is immediately followed by construction/binding of `card.deviceConfig[0]` before any device command is exercised.

- [ ] **Step 2: Run RED**

```bash
node --test tests/liron_smartport_bus.test.js tests/liron_browser_integration.test.js
```

Expected: failure because `deviceConfig` is empty and `bindHost()` does not exist.

- [ ] **Step 3: Implement minimal ownership change**

In `AppleLiron`:

```javascript
var unidisk=null;

this.deviceConfig=[{
     "DCODE":"UNIDISK35"
    ,"hostPCODE":"LIRON"
    ,"coID":"UniDisk35Device"
    ,"deviceN":1
    ,"icon":"fa fa-hdd"
    ,"description":"Apple UniDisk 3.5"
}];

this.attachUniDisk=function(device)
{
    if(!device || device.id?.DCODE!=="UNIDISK35") return null;
    if(unidisk===device) return device;
    if(unidisk!==null) throw new Error("Liron already has a UniDisk 3.5 child");
    smartport.attach(device,1);
    unidisk=device;
    return device;
};
```

Remove the private `new UniDisk35Device()` construction. Keep `getUniDisk()` returning `unidisk`.

In `UniDisk35Device`:

```javascript
var host=null;

this.bindHost=function(owner)
{
    if(!owner || owner.id?.PCODE!=="LIRON" || typeof(owner.attachUniDisk)!=="function")
        return false;
    if(host && host!==owner) return false;
    if(owner.attachUniDisk(this)!==this) return false;
    host=owner;
    return true;
};
```

- [ ] **Step 4: Run GREEN and regressions**

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

- [ ] **Step 5: Commit**

```bash
git add res/EMU_CARD_LIRON.js res/EMU_DEVICE_UNIDISK35.js \
        tests/liron_smartport_bus.test.js tests/liron_browser_integration.test.js \
        tests/liron_smartport_transport.test.js tests/liron_readblock.test.js
git commit -m "refactor: provision UniDisk as Liron child device"
```

---

### Task 2: Route normal browser media loading to unit 1

**Files:**
- Modify: `res/EMU_apple2main.js`
- Modify: `res/EMU_DEVICE_UNIDISK35.js`
- Create: `tests/liron_browser_mount.test.js`

**Interfaces:**
- Consumes: `io.DCODE2obj("UNIDISK35","LIRON")`, Task 1 child ownership, existing Disk II browser helpers.
- Produces: `EMU_unidisk35Device(slotN) -> object|null`, `EMU_mountDiskImage(bytes,slotN,deviceID,filepath) -> boolean`; both `loadDisk_fromBuffer()` and local `FileReader.onload` delegate to this router.

- [ ] **Step 1: Write RED browser-routing tests**

Create a VM test for `EMU_apple2main.js` with stubbed `apple2plus`. Required cases:

```javascript
test('819200 bytes route to the mounted UniDisk child', () => {
    const image=new Uint8Array(819200);
    assert.equal(context.EMU_mountDiskImage(image,null,'UNIDISK35','CardCat 1.94.po'),true);
    assert.equal(unidiskLoads.length,1);
    assert.equal(unidiskLoads[0].bytes.length,819200);
    assert.equal(unidiskLoads[0].metadata.filename,'CardCat 1.94.po');
    assert.equal(diskIILoads.length,0);
});
```

Also test:

```javascript
assert.equal(EMU_mountDiskImage(new Uint8Array(819200),null,'D1','x.po'),false); // no UniDisk
assert.equal(EMU_mountDiskImage(new Uint8Array(819200),null,'D1','x.po'),false); // two UniDisks fixture
assert.equal(EMU_mountDiskImage(new Uint8Array(819199),null,'UNIDISK35','bad.po'),false);
assert.equal(EMU_mountDiskImage(new Uint8Array(143360),diskIISlot,'D1','boot.dsk'),true);
```

For state preservation, use a real `UniDisk35Device`: load a valid image through `EMU_mountDiskImage`, record a known block, reject an 819199-byte `UNIDISK35` image, then verify the same block is unchanged.

- [ ] **Step 2: Run RED**

```bash
node --test tests/liron_browser_mount.test.js
```

Expected: `EMU_mountDiskImage` / `EMU_unidisk35Device` missing.

- [ ] **Step 3: Implement mounted-child resolution**

```javascript
function EMU_unidisk35Device(slotN)
{
    if(typeof(apple2plus)!="object" || !apple2plus) return null;
    var io=apple2plus.hwObj().io;
    if(!io) return null;

    if(Number.isInteger(Number(slotN)))
    {
        var owner=io.SLOT2obj(Number(slotN));
        if(owner && owner.id?.PCODE==="LIRON" && Array.isArray(owner.devices))
            for(var i=0;i<owner.devices.length;i++)
                if(owner.devices[i]?.id?.DCODE==="UNIDISK35") return owner.devices[i];
    }

    var disks=typeof(io.DCODE2obj)==="function"
        ? io.DCODE2obj("UNIDISK35","LIRON")
        : [];
    return disks.length===1 ? disks[0] : null;
}
```

- [ ] **Step 4: Implement one production media router and converge both browser callers**

```javascript
function EMU_mountDiskImage(arr_buffer,slotN,deviceID,filepath)
{
    var bytes=arr_buffer instanceof Uint8Array
        ? arr_buffer
        : new Uint8Array(arr_buffer || []);
    var unidiskTarget=String(deviceID||"").toUpperCase()==="UNIDISK35";

    if(bytes.length===819200 || unidiskTarget)
    {
        if(bytes.length!==819200) return false;
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

Refactor `loadDisk_fromBuffer()` and the local-file `FileReader.onload` path to call `EMU_mountDiskImage()`. Remove the old 819,200-byte warning branch.

Update `UniDisk35Device.loadImage(data,metadata)` to preserve optional filename metadata:

```javascript
state.mediaFilename = metadata && metadata.filename
    ? String(metadata.filename).split(/[\\/]/).pop()
    : "";
```

Expose `mediaFilename` in `getState()`.

- [ ] **Step 5: Run GREEN and focused regressions**

```bash
node --check res/EMU_apple2main.js
node --check res/EMU_DEVICE_UNIDISK35.js
node --test \
  tests/liron_browser_mount.test.js \
  tests/liron_browser_integration.test.js \
  tests/liron_smartport_bus.test.js \
  tests/unidisk35.test.js
```

- [ ] **Step 6: Commit**

```bash
git add res/EMU_apple2main.js res/EMU_DEVICE_UNIDISK35.js tests/liron_browser_mount.test.js
git commit -m "feat: route 800K browser media to UniDisk"
```

---

### Task 3: Add permanent end-to-end Card Cat browser acceptance

**Files:**
- Create: `tests/cardcat_unidisk_browser_acceptance.js`
- Create: `.github/workflows/liron-cardcat-browser-acceptance.yml`
- Existing media: `disks/Utility/Card Cat 1.94.dsk`, `disks/Utility/CardCat 1.94.po`

**Interfaces:**
- Consumes: Task 2 `EMU_mountDiskImage`, normal Disk II boot, Apple2IO `unmount`, `apple2plus.reset`, authentic Liron ROM/IWM/SmartPort READ BLOCK.
- Produces: repeatable CI evidence for both Card Cat discovery and a real Card Cat/Pascal boot from the browser-mounted UniDisk volume.

The acceptance uses two phases in one browser session. Phase A boots the normal 5.25-inch Card Cat disk while the `.po` is mounted through the browser router and requires `SP:1`. Phase B passively observes production block requests, removes Disk II from the live slot map, performs `apple2plus.reset()` (not `restart()`, so default cards are not remounted), and lets Apple II Autostart select slot 5. Card Cat must boot again from the already mounted `CardCat 1.94.po`. The UCSD Pascal boot must request SmartPort block 2, which is the volume directory containing `SYSTEM.APPLE`, `SYSTEM.PASCAL`, and `SYSTEM.STARTUP`.

- [ ] **Step 1: Write the Playwright acceptance script**

The script must:

1. Navigate to locally served `index.html`.
2. Fetch both media files from that local server.
3. Load `Card Cat 1.94.dsk` through the existing normal Disk II browser function.
4. Load `CardCat 1.94.po` only through:

```javascript
EMU_mountDiskImage(poBytes,null,'UNIDISK35','CardCat 1.94.po')
```

5. Assert the normal child state: `unit===1`, `mediaLoaded===true`, `mediaBytes===819200`, `mediaFilename==='CardCat 1.94.po'`.
6. Run live CPU ticks until Videx text contains `Apple II Liron Drive Controller (SP:1)`.
7. Install a passive observer around the already-mounted child's `readBlock`. It records block numbers and delegates using `Reflect.apply`; it does not originate a read:

```javascript
const disk=liron.getUniDisk();
const original=disk.readBlock;
const observed=[];
disk.readBlock=function(blockNo)
{
    observed.push(Number(blockNo));
    return Reflect.apply(original,disk,[blockNo]);
};
```

8. Resolve the live Disk II controller, call `io.unmount(disk2.mount.slotN)`, then call `apple2plus.reset()`.
9. Run live CPU ticks until Videx text again contains both `Card Cat 1.94` and `Apple II+`, proving Card Cat/Pascal booted with Disk II absent.
10. Require `observed.includes(2)===true`.
11. Statistically guard the source against direct calls with regexes `\.loadImage\s*\(` and `\.readBlock\s*\(`; neither may match.

- [ ] **Step 2: Establish acceptance RED against the Task-1 revision**

Before Task 2's router commit is applied, run the acceptance script once. The expected failure is specifically that the 819,200-byte browser route is unavailable/rejected. A Chromium/setup/media-file failure does not count as RED.

- [ ] **Step 3: Add the permanent workflow**

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
      - 'index.html'
      - 'tests/cardcat_unidisk_browser_acceptance.js'
      - 'disks/Utility/Card Cat 1.94.dsk'
      - 'disks/Utility/CardCat 1.94.po'
  pull_request:
    paths:
      - 'res/EMU_CARD_LIRON.js'
      - 'res/EMU_DEVICE_UNIDISK35.js'
      - 'res/EMU_apple2main.js'
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

- [ ] **Step 4: Run acceptance GREEN after Task 2**

Required diagnostic:

```text
CARD_CAT_BROWSER_ACCEPTANCE {
  mounted: true,
  mediaBytes: 819200,
  unit: 1,
  sp1: true,
  bootedFromUniDisk: true,
  directoryBlock2Read: true
}
```

All fields must pass or the process exits non-zero.

- [ ] **Step 5: Commit**

```bash
git add tests/cardcat_unidisk_browser_acceptance.js .github/workflows/liron-cardcat-browser-acceptance.yml
git commit -m "test: verify browser-mounted UniDisk with Card Cat"
```

---

### Task 4: Full regression and architecture guardrails

**Files:** no further production changes expected.

**Interfaces:** consumes all previous tasks and produces final branch evidence.

- [ ] **Step 1: Run complete focused suite**

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

- [ ] **Step 2: Run permanent browser acceptance freshly**

```bash
python3 -m http.server 8000 >/tmp/retroapple-http.log 2>&1 &
node tests/cardcat_unidisk_browser_acceptance.js
```

Expected: all `CARD_CAT_BROWSER_ACCEPTANCE` fields pass.

- [ ] **Step 3: Verify architectural constraints**

```bash
BASE="$(git merge-base feature/liron-unidisk-bus HEAD)"
git diff "$BASE"...HEAD -- res/EMU_apple2io.js
grep -n "new UniDisk35Device" res/EMU_CARD_LIRON.js || true
grep -nE '\.(loadImage|readBlock)[[:space:]]*\(' tests/cardcat_unidisk_browser_acceptance.js || true
```

Expected: no Apple2IO behavioral diff, no private UniDisk construction in Liron, and no direct media/block calls in the acceptance harness.

- [ ] **Step 4: Verify no temporary CI/debug files remain**

```bash
find .github/workflows -maxdepth 1 -type f -name '*temp*' -print
```

Expected: no new temporary Liron/browser workflow files.

- [ ] **Step 5: Commit only if verification required a permanent correction**

Do not create an empty completion commit. Any correction must be followed by Steps 1-4 again.
