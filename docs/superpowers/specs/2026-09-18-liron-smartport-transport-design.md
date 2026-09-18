# Liron SmartPort Transport Design

## Goal

Extend the existing Liron/IWM/UniDisk foundation so the authentic 4 KiB Liron ROM can discover SmartPort unit 1 and obtain its STATUS responses through emulated IWM/SmartPort hardware behavior. The transport must not trap SmartPort firmware entry points or synthesize CardCat output.

## Scope

In scope:

- SmartPort bus line state derived from IWM PH0..PH3.
- Bus reset and enable/REQ handling.
- Device-side ACK exposed through IWM SENSE.
- Byte-oriented host-to-device and device-to-host transfer through the existing IWM DATA register path.
- SmartPort packet sync, header, 7-bit-safe payload decode/encode, checksum, and packet end handling.
- INIT / device-ID enumeration sufficient to expose the attached UniDisk as the first SmartPort resident.
- STATUS command dispatch to `UniDisk35Device.status()` for status codes `$00` and `$03`.
- Encoded STATUS replies back to the Liron ROM.
- Diagnostic state sufficient for tests.

Out of scope:

- READBLOCK, WRITEBLOCK, FORMAT, image files, or 512-byte data packets.
- Cycle-accurate 2 MHz serial bit-cell timing.
- UniDisk internal 65C02/RAM/ROM emulation.
- Firmware call trapping or CardCat-specific shortcuts.

## Architecture

```text
Liron ROM on Apple II CPU
        |
        | $C0n0-$C0nF
        v
LironIWM
  - eight state bits
  - DATA / STATUS / HANDSHAKE
  - forwards phase-line transitions
        |
        v
SmartPortBus
  - PH0..PH3 line decoder
  - REQ/ACK state
  - packet RX/TX state machine
  - packet codec
  - command dispatch
        |
        v
Unit 1: UniDisk35Device
  - STATUS $00
  - STATUS $03 / DIB
  - 1600 blocks advertised
```

The IWM remains the only Apple-II-visible hardware endpoint. `AppleLiron` continues to delegate slot I/O to `LironIWM` unchanged.

## SmartPort line model

The transport is byte-accurate but line-aware. It does not model individual serial bits or nanosecond timing.

The four IWM phase bits are forwarded to `SmartPortBus.setLines(lines)` after every phase-bit change.

For SmartPort operation:

- PH1 + PH3 asserted selects/enables the SmartPort bus.
- PH0 is treated as host REQ while the bus is enabled.
- PH0 + PH2 asserted is the SmartPort bus-reset vector and resets protocol state without detaching devices.
- ACK is active low and device-owned. `SmartPortBus.readSense()` returns the physical line level expected by IWM STATUS reads: SENSE high while ACK is deasserted/high-Z, SENSE low while ACK is asserted.

The bus tracks REQ edges so the four-phase handshake remains observable even though packet bytes are transferred atomically through IWM DATA accesses.

## Packet format

The wire representation follows the SmartPort packet form used by Apple-compatible implementations:

1. sync: `$FF $3F $CF $F3 $FC $FF`
2. packet begin: `$C3`
3. seven header bytes, all with bit 7 set on the wire:
   - DEST
   - SRC
   - TYPE
   - AUX
   - STATUS
   - odd-byte count
   - group-of-seven count
4. encoded payload
5. two checksum bytes
6. packet end `$C8`

Command packet type is `$80` on the wire (lower-seven-bit TYPE value `$00`); status reply type is `$81` (lower-seven-bit TYPE value `$01`).

Payload encoding groups raw bytes so every wire payload byte has bit 7 set. For each complete group of seven raw bytes, one MSB byte carries their original high bits followed by seven low-7-bit bytes. A leading odd group uses the same principle for `payload.length % 7` bytes.

Checksum is the XOR of raw payload bytes and the seven wire header bytes. It is encoded as:

```text
checksum_even = checksum | $AA
checksum_odd  = (checksum >> 1) | $AA
```

Incoming packets must have `$C8` at the expected end. Checksum validation is required before dispatch.

## Receive state machine

`SmartPortBus` gains protocol states:

```text
WAIT_SYNC
RECEIVE_COMMAND
RESPONSE_PENDING
SEND_RESPONSE
RESPONSE_DONE
```

`writeData(byte, lines, ctx)` feeds command bytes only while the SmartPort bus is enabled and REQ is asserted. `WAIT_SYNC` recognizes the sync sequence and `$C3`; after `$C3`, seven header bytes determine the encoded payload length. Once the full packet arrives, the bus decodes and validates it, dispatches the command, and prepares a reply.

A new `$FF ... $C3` sync sequence is allowed to restart command reception after a timeout/retry.

## Command dispatch

### INIT `$05`

The attached local device remains JavaScript bus unit 1, but SmartPort resident IDs are a separate protocol concern. After bus reset all resident-ID assignments are cleared while the logical attachment remains intact.

For external SmartPort, INIT assigns the next unaddressed daisy-chain device the resident ID carried in the command packet **DEST** field. With one attached UniDisk, an INIT addressed to resident ID 1 assigns that ID to logical unit 1. Its status reply uses source ID 1 and reports end-of-chain (`$7F` in the seven-bit STATUS field), so the host stops enumeration.

This mirrors the external SmartPort behavior used by FujiNet/SmartPortSD rather than the Apple IIc-specific unit-offset shortcut.

### STATUS `$00`

The standard decoded command frame starts as:

```text
byte 0  command ($00 for STATUS)
byte 1  parameter count
byte 2  SmartPort device/unit parameter
byte 3  reserved / command-frame field
byte 4  status/control code
```

The packet **DEST** field is the primary resident-address route after INIT. The device/unit parameter is retained as a fallback for compatible callers and unit-zero queries.

For resident ID 1, STATUS code `$00` is dispatched to `UniDisk35Device.status($00)`. STATUS code `$03` is dispatched to `UniDisk35Device.status($03)`. A unit-zero STATUS query reports one attached resident.

The returned `error` becomes the SmartPort response STATUS/error field and returned `data` becomes the response payload.

STATUS `$00` for the UniDisk therefore carries:

```text
F8 40 06 00
```

and STATUS `$03` carries its 25-byte DIB.

Other commands return a SmartPort bad-command/error response; they do not invent block I/O.

## Transmit / ACK behavior

When a valid command has been accepted, the bus asserts active-low ACK and enters `RESPONSE_PENDING`. When the host deasserts REQ, ACK is released. A subsequent REQ assertion starts `SEND_RESPONSE`; DATA reads return the encoded response bytes in order. At the end of `$C8`, the device asserts ACK and enters `RESPONSE_DONE`. When REQ returns low, ACK is released and the state returns to `WAIT_SYNC`.

The state machine deliberately avoids cycle delays in this milestone. It preserves packet ordering and hardware-visible line transitions, which are the parts required by the Liron firmware.

## IWM integration

`LironIWM.touchState()` calls `bus.setLines(state.lines, ctx)` whenever one of PH0..PH3 changes. MOTOR, DRIVE, Q6, and Q7 remain IWM-local latch bits.

- `DATA` writes continue to call `bus.writeData()`.
- `DATA` reads continue to call `bus.readData()`.
- `STATUS` SENSE continues to call `bus.readSense()`.

This means no SmartPort packet logic leaks into `AppleLiron` or the IWM register selector.

## Reset behavior

`SmartPortBus.reset()` clears protocol buffers, packet indices, ACK/REQ state, resident-ID assignments, and protocol state, but preserves the attached device table and logical unit assignments. This matches the existing bus-unit contract while reproducing SmartPort bus initialization semantics.

## Testing

`tests/liron_smartport_transport.test.js` uses independent protocol helpers and proves:

1. Phase-line changes from `LironIWM` reach the bus.
2. PH0+PH2 resets transport state without detaching unit 1.
3. Sync/header/payload packet decoding accepts a valid STATUS command and rejects corrupt checksums.
4. STATUS resident 1 code `$00` returns an encoded `$81` status packet whose decoded payload is `F8 40 06 00`.
5. STATUS resident 1 code `$03` returns the 25-byte `DISK 3.5` DIB.
6. Unit-zero STATUS reports one resident device.
7. INIT assigns resident ID 1 and reports end-of-chain.
8. ACK/SENSE changes around command acceptance and response completion.
9. Existing IWM, card, unit-management, browser-load-order, and UniDisk tests remain green.

Manual acceptance remains CardCat: slot 5 should progress from `SP:0, no units` to one SmartPort resident / UniDisk-visible device once the authentic Liron ROM exercises this transport.

## References

- Apple IIGS Firmware Reference / SmartPort and Protocol Converter behavior.
- FujiNet IWM SmartPort implementation, including exact enable/reset phase vectors, active-low ACK, DEST-based INIT address assignment, packet framing, and command-frame decoding.
- SmartPortSD lineage referenced by FujiNet for the external SmartPort protocol.
- `alivesay/rust-iic` SmartPort/IWM implementation as an interoperability cross-check for sync framing, 7-bit packet coding, response framing, and retry behavior.
- Existing RetroAppleJS `LironIWM`, `SmartPortBus`, and `UniDisk35Device` tests and interfaces.
