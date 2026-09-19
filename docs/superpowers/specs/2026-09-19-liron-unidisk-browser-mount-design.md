# Liron UniDisk 3.5 Browser Mount Design

## Goal

Make the Apple UniDisk 3.5 a normal RetroAppleJS child device of the Liron controller so that an 819,200-byte `.po` image can be mounted through the browser's ordinary disk-loading/configuration path and then accessed by software running through the authentic Liron ROM/IWM/SmartPort stack.

The acceptance target is Card Cat 1.94 booted from the repository's 5.25-inch disk image while `disks/Utility/CardCat 1.94.po` is mounted through the browser-facing loader into SmartPort unit 1. Card Cat must enumerate `SP:1` and successfully read directory/volume data from that mounted image. The acceptance harness must not call `UniDisk35Device.loadImage()` or `AppleLiron.getUniDisk().loadImage()` directly.

## Current State

The Liron card already provides:

- authentic 4 KiB Liron firmware;
- IWM soft-switch behavior sufficient for the firmware;
- byte-accurate external SmartPort framing and REQ/ACK/SENSE handshaking;
- SmartPort INIT/STATUS/DIB handling;
- a logical `UniDisk35Device` at unit 1;
- read-only 1600 × 512-byte media and READ BLOCK support;
- successful authentic-ROM READ BLOCK tests against `CardCat 1.94.po` when the test harness injects media by calling `loadImage()` directly.

The missing integration is browser ownership and routing. `AppleLiron` currently constructs its UniDisk internally and declares `deviceConfig = []`. RetroAppleJS's normal browser/device framework therefore does not own the UniDisk. The general browser disk-loading code recognizes 819,200-byte files only to warn that a Liron/UniDisk is needed; it does not route them to unit 1.

## Chosen Architecture

### 1. UniDisk becomes a declarative Liron child device

`AppleLiron.deviceConfig` will declare exactly one `UNIDISK35` child device. Apple2IO already owns the generic `deviceConfig` lifecycle: when it mounts Liron, it constructs the child device through the configured constructor, records it in `owner.devices`, and calls `bindHost(owner)` when the device provides that hook.

The Liron card will no longer create a separate private `new UniDisk35Device()` instance. Instead, it will expose a host binding method for the child device and attach the Apple2IO-created object to `SmartPortBus` as unit 1.

Conceptually:

```text
Apple2IO.mount(LIRON)
        |
        +-- AppleLiron.deviceConfig[UNIDISK35]
                |
                +-- new UniDisk35Device(metadata)
                +-- device.bindHost(liron)
                        |
                        +-- liron.attachUniDisk(device)
                                |
                                +-- smartport.attach(device, 1)
```

There must be only one authoritative UniDisk object. `AppleLiron.getUniDisk()` will return that child-device instance for diagnostics/backward compatibility.

### 2. UniDisk host binding is ownership-only

`UniDisk35Device.bindHost(host)` will validate that the host is a Liron-compatible owner and request attachment through a narrow host method such as `host.attachUniDisk(this)`. The device must not reach through global emulator state or know physical slot numbers.

This keeps responsibilities separated:

- Apple2IO owns construction/configuration;
- AppleLiron owns the SmartPort bus and unit assignment;
- UniDisk35Device owns media/status/block behavior.

Repeated binding or restart must not create duplicate unit assignments.

### 3. Browser disk loading routes by image size and mounted device capability

The existing browser loader already distinguishes disk-image sizes. That logic will be extended so exactly 819,200-byte images are routed to the mounted `UNIDISK35` child device associated with the Liron controller instead of being rejected.

The browser-facing path will resolve the mounted device through Apple2IO/device ownership rather than through a test-only global or a freshly constructed object. A small helper may be introduced in `EMU_apple2main.js`, for example:

```text
EMU_unidisk35Device()
    -> locate mounted LIRON
    -> locate its attached child with DCODE UNIDISK35 / deviceN 1
```

The actual media call remains `device.loadImage(bytes)` because that is the device's production media interface. The prohibition is specifically against the acceptance harness bypassing browser configuration and calling `loadImage()` itself.

The loader will continue to route existing 5.25-inch formats to Disk II unchanged. No generic removable-media abstraction is introduced in this milestone.

### 4. Local-file and repository/catalog paths converge

Both normal browser sources ultimately produce bytes and enter the same routing decision:

```text
selected file / catalog image
        |
        +-- 140 KiB / Disk II formats --> existing Disk II loader
        |
        +-- 819200 bytes -------------> mounted UNIDISK35 unit 1
```

The 800 KiB route will preserve the selected filename in device state where practical so the UI/debugger can report the mounted image name. This is metadata only; filesystem naming remains whatever exists inside the image.

### 5. Read-only semantics remain explicit

This milestone remains read-only. Loading an 800 KiB `.po` image enables STATUS and READ BLOCK against that media. WRITE BLOCK and FORMAT are still unsupported.

The status byte should not advertise writable media unless the existing SmartPort status semantics require capability rather than current implementation. If current tests encode writable capability, that question will be resolved conservatively during implementation without expanding scope to writes.

## Browser/API Surface

Expected production interfaces after the change:

### `AppleLiron`

```javascript
this.deviceConfig = [{
    DCODE: "UNIDISK35",
    hostPCODE: "LIRON",
    coID: "UniDisk35Device",
    deviceN: 1,
    description: "Apple UniDisk 3.5"
}];

this.attachUniDisk = function(device) { ... };
this.getUniDisk = function() { ... };
```

Exact metadata keys will follow existing Apple2IO conventions.

### `UniDisk35Device`

```javascript
this.bindHost = function(host) { ... };
this.loadImage = function(bytes, metadata) { ... };
```

`loadImage` continues to require exactly 819,200 bytes and copies the media into device-owned storage.

### Browser loader

A browser-facing helper will resolve and mount the normal child device, e.g.:

```javascript
loadDisk_fromBuffer(buffer, slotN, deviceID)
```

or a sibling generalized helper. Existing callers should not need to know Liron internals.

## Error Handling

- 819,200-byte image with no mounted Liron/UniDisk: fail clearly and leave existing media unchanged.
- Wrong image size for UniDisk: reject without partial load.
- Multiple Liron controllers: prefer the configured/default Liron associated with unit 1; if ambiguity exists, resolution should use the explicit slot/device selection when available rather than silently picking an arbitrary card.
- Duplicate child binding: idempotent; do not attach another SmartPort unit.
- Browser catalog fetch failure: unchanged existing behavior.

## Testing Strategy

Implementation follows TDD.

### Unit/configuration tests

Add/adjust tests proving:

1. `AppleLiron.deviceConfig` declares one `UNIDISK35` child.
2. Apple2IO-style `bindHost()` causes that exact child object to become SmartPort unit 1.
3. There is no second private UniDisk instance.
4. `getUniDisk()` resolves to the child device.
5. 819,200-byte browser routing loads that device; 140 KiB Disk II routing remains unchanged.
6. Invalid 800 KiB routing leaves media/state unchanged.

### Browser configuration acceptance

Run `index.html` in headless Chromium using the real emulator configuration. The test will:

1. Boot `disks/Utility/Card Cat 1.94.dsk` through the normal Disk II browser path.
2. Mount `disks/Utility/CardCat 1.94.po` using the same browser-facing image loader/configuration function available to normal UI/catalog loading.
3. Assert the Liron-owned child device reports media loaded and 819,200 bytes.
4. Run the emulator until Card Cat completes SmartPort discovery.
5. Require on-screen evidence of `SP:1`.
6. Exercise Card Cat's real SmartPort disk/volume operation and require evidence that data from the mounted Pascal directory is accessible. Acceptance evidence may be Card Cat's displayed directory/volume information or, if Card Cat does not expose a directory UI suitable for deterministic automation, an authentic Card Cat-triggered READ BLOCK whose returned directory data is observed in emulator memory.

The acceptance harness must not call `loadImage()` directly. It may call only the production browser-facing mount function, exactly as normal UI/catalog code does.

### Regression suite

Retain all existing Liron/UniDisk tests for:

- ROM mapping;
- IWM soft switches and write-drain semantics;
- SmartPort INIT/STATUS/DIB;
- enumeration;
- READ BLOCK;
- browser script ordering.

## Files Expected to Change

- `res/EMU_CARD_LIRON.js`
- `res/EMU_DEVICE_UNIDISK35.js`
- `res/EMU_apple2main.js`
- focused Liron/UniDisk tests
- new browser-mount/Card Cat acceptance test

`res/EMU_apple2io.js` should not require behavioral changes unless implementation discovers a missing generic child-device capability. If such a change becomes necessary, stop and reassess the design because that would broaden the architecture beyond this spec.

## Non-Goals

- WRITE BLOCK
- FORMAT
- dirty-image persistence/download
- multiple UniDisk drives on one Liron
- generic removable-media framework across all disk controllers
- cycle-accurate UniDisk internal 65C02 emulation
- special-casing Card Cat in production code

## Success Criteria

The milestone is complete only when all of the following are freshly verified:

1. Liron owns exactly one normal Apple2IO child device `UNIDISK35` at SmartPort unit 1.
2. `CardCat 1.94.po` is mounted through the normal browser-facing disk/configuration path, not by direct harness injection.
3. Card Cat 1.94, booted from its normal 5.25-inch disk, reports the Liron as `SP:1`.
4. A real Card Cat disk/volume operation causes data from the browser-mounted 800 KiB image to be read successfully through the authentic Liron ROM/IWM/SmartPort path.
5. Directory/volume evidence from `CardCat 1.94.po` is observed, including known entries such as `SYSTEM.APPLE`, `SYSTEM.PASCAL`, or `SYSTEM.STARTUP`.
6. The focused and regression test suites pass with zero failures.
