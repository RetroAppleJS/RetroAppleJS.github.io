# Liron / UniDisk 3.5 Controller Foundation Design

## Goal

Add the architectural foundation for an Apple II UniDisk 3.5 Interface Controller (Liron) peripheral to RetroAppleJS. The first milestone must emulate the card identity, ROM mapping, shared C800 expansion ROM ownership, and the 16-address IWM-facing slot I/O surface faithfully enough for Card Cat 1.94 to identify the card as an Apple II UniDisk 3.5 Controller (Liron).

This milestone deliberately stops before implementing 800 KB disk-image access. A later milestone will attach a SmartPort bus and UniDisk 3.5 device model to the IWM boundary without changing the card-facing API.

## Scope

### In scope for the foundation

- New `res/EMU_CARD_LIRON.js` peripheral.
- RetroAppleJS discovery/mount conventions (`PCODE`, `deviceConfig`, `this.action`, reset/restart hooks).
- Authentic 4 KiB Liron firmware image as the runtime firmware target.
- Slot ROM mapping at `$Cn00-$CnFF`.
- Shared expansion ROM mapping at `$C800-$CFFF` using the existing RetroAppleJS HostROM ownership mechanism.
- Slot I/O dispatch for all 16 addresses at `$C0n0-$C0nF`.
- An isolated IWM state object behind those 16 addresses.
- A SmartPort-bus attachment boundary owned by the IWM layer, initially with no attached devices.
- Deterministic reset/restart behavior.
- Configuration entry and script loading needed to mount the Liron in a physical Apple II slot.
- Automated unit-level checks for ROM mapping, slot signature, C800 mapping and IWM dispatch.
- Manual Card Cat validation.

### Explicitly out of scope for this milestone

- 3.5-inch disk-image parsing.
- 512-byte block READ/WRITE/FORMAT operations.
- UniDisk DIB/STATUS responses.
- SmartPort device enumeration.
- UniDisk internal 65C02, RAM, ROM, gate array or second IWM.
- Disk II / 5.25-inch drive behavior through the Liron.
- UI for loading/ejecting 3.5-inch images.

## External validation target

Card Cat 1.94 is the primary manual acceptance test for this milestone.

Card Cat scans `$Cn00-$CnFF` firmware, compares known signatures against its database, and has an explicit database entry for `Apple II UniDisk 3.5 Controller (Liron)`.

Foundation acceptance is therefore split in two stages:

1. **Stage 1 — this milestone:** Card Cat's ordinary slot scan must identify the mounted peripheral as `Apple II UniDisk 3.5 Controller (Liron)`.
2. **Stage 2 — later SmartPort/UniDisk milestone:** Card Cat's `[S]martPort` view must enumerate the attached UniDisk and display coherent device information.

The first milestone is not considered complete merely because the ROM signature bytes are visible in a debugger; Card Cat must recognize the card when run inside RetroAppleJS.

## Architecture

The foundation uses four logical units but keeps them in one source file initially so the new peripheral remains easy to integrate and review.

```text
Apple II CPU / Apple2IO
        |
        +-- $Cn00-$CnFF --------> LironCard ROM mapper
        |
        +-- $C800-$CFFF --------> LironCard expansion-ROM mapper
        |
        +-- $C0n0-$C0nF --------> LironIWM
                                      |
                                      +--> SmartPortBus endpoint
                                               |
                                               +--> no devices yet
```

The important boundary is that `LironCard` does not decode SmartPort commands. The card only owns Apple II slot address decoding, ROM visibility and an IWM instance. SmartPort command/packet semantics belong below the IWM boundary.

This preserves a future path to authentic behavior in which the genuine Liron ROM executes on the emulated Apple II CPU and communicates through the emulated IWM exactly as on hardware.

## Component design

### 1. `AppleLiron`

`AppleLiron` is the RetroAppleJS card constructor.

It follows the same conventions as existing cards such as AppleDisk2, ThunderClock and Serial Pro:

- discovery instance under `oEMU.component.IO`;
- `this.id = {"PCODE":"LIRON", ...}`;
- constructor-owned state;
- `this.action.SlotIO` callbacks;
- `this.action.SlotROM` callback;
- `this.action.HostROM` callback for `$C800-$CFFF`;
- public `read`, `write`, `readROM`, `readHostROM`, `reset` and `restart` methods as required by the existing bus/mount code.

`AppleLiron` owns exactly one IWM instance and, initially, no user-visible child drive devices.

### 2. Firmware representation

The card uses an authentic 4096-byte Liron firmware image.

The implementation must reject or fail closed on firmware with a length other than 4096 bytes. A synthetic SmartPort ROM must not silently replace missing firmware, because Card Cat validation is intended to prove that RetroAppleJS is presenting the real Liron identity.

The source should keep firmware bytes separate from card logic (for example as a `const LIRON_ROM = new Uint8Array([...])` or an existing RetroAppleJS-compatible ROM resource), so the firmware can later be replaced by another verified dump without changing the mapper.

### 3. Slot ROM mapping

For a card mounted in physical slot `n`, `$Cn00-$CnFF` must expose the slot-specific 256-byte page selected from the 4 KiB Liron firmware exactly as the hardware does.

The implementation must not generate SmartPort signature bytes independently of the ROM. In particular, the well-known SmartPort slot signature must be a consequence of the real firmware mapping:

- `$Cn01 = $20`
- `$Cn03 = $00`
- `$Cn05 = $03`
- `$Cn07 = $00`

This is important because Card Cat fingerprints more than these four bytes.

### 4. `$C800-$CFFF` expansion ROM

The Liron needs the Apple II shared expansion window.

The implementation must use RetroAppleJS's existing HostROM ownership mechanism rather than hard-wire `$C800-$CFFF` globally. Access to the Liron slot ROM must claim the shared expansion window in the same way current expansion-ROM cards do. When another card subsequently claims C8 space, RetroAppleJS's current owner-selection rules remain authoritative.

The Liron expansion window maps the firmware's `$0800-$0FFF` region to Apple II `$C800-$CFFF`.

The mapper must be independent of the physical slot number; changing the card from slot 5 to another valid slot changes the `$Cn00` page but does not change the expansion-ROM byte range.

### 5. `LironIWM`

The IWM is an isolated stateful object, initially defined inside `EMU_CARD_LIRON.js`.

Its public interface is intentionally small:

```javascript
function LironIWM(bus)

LironIWM.prototype.read = function(reg, ctx) -> byte
LironIWM.prototype.write = function(reg, value, ctx) -> byte|undefined
LironIWM.prototype.reset = function() -> void
LironIWM.prototype.restart = function() -> void
```

`reg` is always `addr & 0x0F`.

The foundation must route every read/write at `$C0n0-$C0nF` through these methods. `AppleLiron` must not contain a parallel switch statement that interprets IWM registers itself.

The initial state model may implement only behavior necessary for deterministic idle/reset operation, but it must preserve the sixteen distinct address accesses and the state needed to extend them later to full IWM semantics.

Suggested internal state fields are:

```javascript
{
    phase: 0,
    motor: 0,
    driveEnable: 0,
    q6: 0,
    q7: 0,
    mode: 0,
    data: 0,
    status: 0,
    handshake: 0
}
```

Names may change during implementation if the verified IWM specification calls for a more accurate representation, but the card/IWM interface must remain independent of those internals.

### 6. `SmartPortBus`

The foundation defines a bus endpoint object consumed by `LironIWM`.

The first version represents an empty SmartPort chain and must be deterministic. It does not need to implement packet parsing yet.

The interface should be narrow enough to support a later UniDisk implementation without touching the Apple II card mapper. A suitable initial shape is:

```javascript
function SmartPortBus()

SmartPortBus.prototype.reset = function() -> void
SmartPortBus.prototype.attach = function(device) -> void
SmartPortBus.prototype.detach = function(device) -> void
SmartPortBus.prototype.hasDevices = function() -> boolean
```

Low-level line/packet methods will be added only when the IWM/SmartPort protocol implementation is designed from the Apple SmartPort Bus documentation.

### 7. Reset semantics

Card reset must restore the IWM and SmartPort bus to a deterministic idle state but must not alter the immutable firmware image.

`restart()` should follow the existing RetroAppleJS distinction between warm/cold restart. At this foundation stage both may reset IWM/bus state identically unless existing card APIs require a different convention.

No asynchronous timers are needed in this milestone.

## Configuration and integration

Add a `LIRON` peripheral definition to the same configuration mechanism that already describes `DISKII`, `TCLKP`, `SPC`, `VIDEX`, etc.

The card should be valid in normal physical Apple II slots. Slot 5 is the recommended default for a configuration that also uses Disk II in slot 6, but the card logic must not depend on slot 5.

The main HTML build/script list must load `res/EMU_CARD_LIRON.js` before `EMU_apple2io.js` if that is required by the current discovery pattern.

No new generic peripheral framework is introduced.

## Error handling

- Invalid firmware size: card must not present a partially valid Liron identity.
- Invalid IWM register number: normalize with `& 0x0F` at the card boundary.
- No SmartPort devices attached: return deterministic idle IWM/bus behavior; do not fabricate a UniDisk.
- Missing optional UI: must not prevent card mounting or Card Cat detection.

## Testing strategy

### Automated foundation tests

Tests should prove at least:

1. A Liron instance exposes `PCODE === "LIRON"`.
2. Firmware length is exactly 4096 bytes.
3. For a representative slot (slot 5), `$C500-$C5FF` maps to the correct slot firmware page.
4. SmartPort signature bytes appear at `$C501/$C503/$C505/$C507` from the firmware itself.
5. Accessing the slot ROM claims the shared C8 window using the existing RetroAppleJS mechanism.
6. `$C800-$CFFF` reads map to firmware offsets `$0800-$0FFF` while Liron owns the C8 window.
7. Moving the card to another slot changes the slot-ROM page selection but leaves the C8 mapping unchanged.
8. Each of the 16 `$C0n0-$C0nF` addresses reaches the IWM with the expected low-nibble register index.
9. Read/write paths do not bypass the IWM object.
10. Reset returns IWM/bus state to the documented idle values.
11. No attached SmartPort devices are fabricated.

### Manual Card Cat test

Recommended configuration:

```text
Slot 5: Liron / UniDisk 3.5 Controller
Slot 6: Disk II
```

Boot Card Cat 1.94 from another supported device/slot arrangement as needed and inspect the slot list.

Expected foundation result:

```text
5   Apple II UniDisk 3.5 Controller (Liron)
```

The exact presentation may vary with Card Cat formatting, but it must use Card Cat's known Liron identity rather than an unknown-card fallback.

Use Card Cat's `[V]iew` function for slot 5 if recognition fails. The 256 displayed bytes must match the corresponding verified firmware page; this makes a recognition failure diagnosable as either ROM content/mapping or Card Cat probing behavior.

Card Cat's `[S]martPort` device enumeration is a later acceptance criterion and is not required to pass with this empty-bus foundation.

## Compatibility position

The Liron peripheral does not expose Disk II / 5.25-inch semantics. RetroAppleJS should continue to mount its existing `DISKII` controller separately, normally in slot 6.

The future SmartPort bus model may represent the historical possibility of a terminal 5.25-inch mechanism on a SmartPort daisy chain, but that does not make the Liron firmware a Disk II controller and is outside this foundation.

## Future milestones

The foundation intentionally creates stable boundaries for the next work:

1. Implement verified IWM register semantics needed by Liron firmware.
2. Implement SmartPort bus reset, addressing, REQ/ACK handshaking and packet transport.
3. Add an `EMU_DEVICE_UNIDISK35` logical device with STATUS/DIB support.
4. Add 1600 × 512-byte block storage and `.po`/`.2mg` image handling.
5. Add READBLOCK, WRITEBLOCK, FORMAT, CONTROL/EJECT and INIT.
6. Validate with Card Cat `[S]martPort`, ProDOS boot/read/write and UniDisk-specific diagnostic software.
7. Optionally emulate the UniDisk's internal 65C02/RAM/ROM/gate-array/IWM for DOWNLOAD/EXECUTE and low-level fidelity.

## Reference material

Primary/implementation references:

- Apple II/IIe UniDisk 3.5 Interface Card (Liron) reconstructed schematic.
- Apple IIGS Firmware Reference, SmartPort/Protocol Converter and SmartPort Bus material.
- Apple UniDisk 3.5 Technical Notes.
- Apple IWM specification.
- RetroAppleJS `docs/PERIPHERALS_DEV.md` and existing card implementations.

External validation/reference implementations:

- Card Cat 1.94 by Henry Lowe (June 5, 2026), including its published list of recognized cards.
- EWM Liron/UniDisk 3.5 implementation.
- POM2 Liron implementation using a real 4 KiB `liron.rom` and IWM/SmartPort model.
