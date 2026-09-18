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
- INIT / device-ID enumeration sufficient to expose the attached UniDisk as the first SmartPort unit.
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
- PH0 + PH2 asserted is a bus-reset condition and resets protocol state without detaching devices.
- ACK is device-owned state. `SmartPortBus.readSense()` returns the hardware sense level expected by IWM STATUS reads.

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

Command packet type is `$80`; status reply packet type is `$81`.

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

`writeData(byte, lines, ctx)` feeds command bytes only while the SmartPort bus is enabled. `WAIT_SYNC` recognizes the sync sequence and `$C3`; after `$C3`, seven header bytes determine the encoded payload length. Once the full packet arrives, the bus decodes and validates it, dispatches the command, and prepares a reply.

A new `$FF ... $C3` sync sequence is allowed to restart command reception after a timeout/retry.

## Command dispatch

### INIT `$05`

The attached local device remains JavaScript bus unit 1. INIT establishes the SmartPort-visible resident ID sequence. With one device attached, the response identifies the first device and then marks the chain complete on the subsequent enumeration step. The implementation keeps an `unitOffset` field so the transport can later coexist with preceding built-in devices without changing the UniDisk model.

### STATUS `$00`

Decoded command payload is interpreted as:

```text
byte 0 command ($00)
byte 1 unit
byte 2 status code
```

For unit 0 / status 0, the bus returns one resident device. For unit 1, the command is dispatched to `getDevice(1).status(statusCode)`.

The returned `error` becomes the SmartPort status/error field and returned `data` becomes the response payload.

STATUS `$00` for the UniDisk therefore carries:

```text
F8 40 06 00
```

and STATUS `$03` carries its 25-byte DIB.

Other commands return a SmartPort bad-command/error response; they do not invent block I/O.

## Transmit / ACK behavior

When a valid command has been accepted, the bus asserts ACK and enters `RESPONSE_PENDING`. After the host completes the request handshake and requests response transfer, DATA reads return the encoded response bytes in order. At the end of `$C8`, the bus moves to `RESPONSE_DONE`, releases ACK when the handshake returns to idle, and becomes ready for another packet.

The state machine deliberately avoids cycle delays in this milestone. It preserves ordering and line transitions, which are the parts required by the Liron firmware.

## IWM integration

`LironIWM.touchState()` calls `bus.setLines(state.lines, ctx)` whenever one of PH0..PH3 changes. MOTOR, DRIVE, Q6, and Q7 remain IWM-local latch bits.

- `DATA` writes continue to call `bus.writeData()`.
- `DATA` reads continue to call `bus.readData()`.
- `STATUS` SENSE continues to call `bus.readSense()`.

This means no SmartPort packet logic leaks into `AppleLiron` or the IWM register selector.

## Reset behavior

`SmartPortBus.reset()` clears protocol buffers, packet indices, ACK/REQ state, enumeration offset, and protocol state, but preserves the attached device table and unit assignments. This matches the existing bus-unit contract.

## Testing

Add `tests/liron_smartport_transport.test.js` with protocol-level helpers that independently encode/decode packets. Tests must prove:

1. Phase-line changes from `LironIWM` reach the bus.
2. PH0+PH2 resets transport state without detaching unit 1.
3. Sync/header/payload packet decoding accepts a valid STATUS command and rejects corrupt checksum/end markers.
4. STATUS unit 1 code `$00` returns an encoded `$81` status packet whose decoded payload is `F8 40 06 00`.
5. STATUS unit 1 code `$03` returns the 25-byte `DISK 3.5` DIB.
6. Unit 0 enumeration reports one resident device.
7. ACK/SENSE changes around command acceptance and response completion.
8. Existing IWM, card, unit-management, browser-load-order, and UniDisk tests remain green.

Manual acceptance remains CardCat: slot 5 should progress from `SP:0, no units` to one SmartPort resident / UniDisk-visible device once the authentic Liron ROM exercises this transport.

## References

- Apple IIGS Firmware Reference / SmartPort and Protocol Converter behavior.
- FujiNet IWM SmartPort low-level definitions and REQ/ACK four-phase handshake documentation.
- `alivesay/rust-iic` SmartPort/IWM implementation as a low-level interoperability reference, especially sync framing, 7-bit packet coding, command routing, and response framing.
- Existing RetroAppleJS `LironIWM`, `SmartPortBus`, and `UniDisk35Device` tests and interfaces.
