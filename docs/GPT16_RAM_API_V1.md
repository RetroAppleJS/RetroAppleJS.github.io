# GPT16 card-neutral RAM expansion API v1

The API exposes expansion memory as 16 KiB logical banks. Hardware-specific
mapping remains inside the backend driver.

## Calling convention

- A, X, Y are caller-clobbered.
- C=0 means success.
- C=1 means failure and A contains RAM_E_*.
- RAM_INIT and RAM_PRESENT return the backend ID in A on success.
- Stack depth is unchanged on return.
- Calls are not re-entrant.
- A backend may mask interrupts internally but must restore the caller's
  interrupt state and memory/ROM mapping before returning.

## Logical address model

- BANK: 16-bit logical bank number.
- OFF: $0000-$3FFF.
- One logical bank is always 16 KiB.
- Block requests may not cross a logical-bank boundary in v1.

This flattens very different hardware into one model. A 16 KiB Language Card
reports one logical bank; a 128 KiB Saturn card reports eight; 1 MiB reports 64;
8 MiB reports 512.

## API

### RAM_INIT

Input: none.

Probe supported RAM backends, choose one, initialize geometry and RAM_INFO_*.

Success: C=0, A=RAM_BACKEND_*.
Failure: C=1, A=RAM_E_NO_DEVICE or backend error.

### RAM_PRESENT

Input: none.

Query cached initialized state without a destructive reprobe.

Present: C=0, A=backend ID.
Absent/uninitialized: C=1, A=RAM_E_NO_DEVICE or RAM_E_NOT_INIT.

### RAM_SELECT_BANK

Input:
- A = logical bank low byte
- X = logical bank high byte

Success: C=0.
Failure: C=1, usually A=RAM_E_BAD_BANK.

The selected bank is stored in RAM_INFO_SEL_LO/HI.

### RAM_READ_BLOCK

Input: A/X = low/high pointer to an 8-byte transfer descriptor.

Direction:
selected expansion BANK:OFF -> main RAM.

Descriptor:
+0 OFF low
+1 OFF high
+2 main pointer low
+3 main pointer high
+4 length low
+5 length high
+6 flags
+7 reserved

LEN=0 is a successful no-op.
OFF+LEN must not exceed $4000.

### RAM_WRITE_BLOCK

Same descriptor and calling convention as RAM_READ_BLOCK.

Direction:
main RAM -> selected expansion BANK:OFF.

### RAM_LOAD_OVERLAY

Input: A/X = low/high pointer to a 12-byte overlay descriptor.

Descriptor:
+0 source bank low
+1 source bank high
+2 source offset low
+3 source offset high
+4 destination low
+5 destination high
+6 length low
+7 length high
+8 expected CRC low
+9 expected CRC high
+10 flags
+11 reserved

For GPT16 v1, destination must fit wholly in $6000-$83FF.

If RAM_OVL_F_VERIFY_CRC is set, verify the copied image with
CRC-16/CCITT-FALSE.

RAM_LOAD_OVERLAY never executes the overlay. The caller jumps into the overlay
only after the load returned successfully.

If a load fails after copying starts, the destination must be treated as
invalid/partially overwritten.

## Example

Select logical bank 2:

```asm
        LDA     #$02
        LDX     #$00
        JSR     RAM_SELECT_BANK
        BCS     RAM_ERROR
```

Read 256 bytes from expansion offset $1000 into $8400:

```asm
RAM_RD_DESC
        HEX     00 10
        HEX     00 84
        HEX     00 01
        HEX     00 00

        LDA     #<RAM_RD_DESC
        LDX     #>RAM_RD_DESC
        JSR     RAM_READ_BLOCK
        BCS     RAM_ERROR
```

Load CHAT from logical bank 0 into $6000:

```asm
CHAT_OVL_DESC
        HEX     00 00
        HEX     00 00
        HEX     00 60
        HEX     1B 1D
        HEX     00 00
        HEX     00 00

        LDA     #<CHAT_OVL_DESC
        LDX     #>CHAT_OVL_DESC
        JSR     RAM_LOAD_OVERLAY
        BCS     RAM_ERROR
        JMP     $6000
```

## Recommended initial bank use

- Bank 0: CHAT overlay image
- Bank 1: XFER/Kermit overlay image
- Bank 2: immutable tables/strings
- Bank 3+: chat history/cache

The v1 runtime should always copy executable overlays to normal main RAM, even
when a backend advertises RAM_CAP_DIRECT_EXEC. This keeps behavior identical
across Language Card, Saturn, auxiliary-memory and slot-memory backends.

No RAM backend may call DOS, GPT16, VideoTerm or Serial Pro code. The RAM layer
only discovers/maps expansion memory and moves bytes.
