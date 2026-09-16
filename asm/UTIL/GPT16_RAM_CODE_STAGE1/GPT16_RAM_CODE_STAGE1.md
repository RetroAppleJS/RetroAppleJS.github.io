# GPT16 RAM expansion code - first implementation

This package is the first executable layer of the card-neutral RAM architecture.

## Important address correction

The earlier draft put `RAM_API_BASE` at `$8C30`.  V6.10 already uses
`$8C30-$8C87` for GPT16/G16 persistent state, so that address was unsafe.

The implementation now reserves:

- `$8D00-$8DFF`: card-neutral RAM API core
- `$8E00-$8EFF`: selected backend slot
- `$8F00-$8FFF`: RAM-driver state/internal descriptors

This fits entirely in the unused tail after the validated V6.10 state at `$8C87`.

## Why a TEST backend first

`GPT16_RAM_BACKEND_TEST.S` deliberately maps ordinary main RAM `$2000-$5FFF`
as one fake 16 KiB expansion bank.  It lets us validate the API and overlay
copy logic independently of any particular Language Card/Saturn/RamWorks
switching rules.

It is not intended for the final GPT16 build.

## Test

Assemble `GPT16_RAM_API_TEST_COMBINED.S` and run:

`CALL 4096`

Expected output:

```
RAM API TEST
PASS: INIT BANK R/W RANGE OVERLAY EXEC
```

The test proves:

1. `RAM_INIT`
2. `RAM_PRESENT`
3. bank 0 select
4. invalid-bank rejection
5. `RAM_WRITE_BLOCK`
6. `RAM_READ_BLOCK`
7. bank-boundary range rejection
8. `RAM_LOAD_OVERLAY`
9. execution of the copied overlay at `$6000`

The copied six-byte overlay performs:

```
LDA #$A5
STA $8FF0
RTS
```

and the harness verifies the marker.

## Backend-slot contract

Every real hardware backend will be assembled for `$8E00` and start with:

- `$8E00` probe/init
- `$8E03` select logical bank
- `$8E06` read block
- `$8E09` write block
- `$8E0C` load overlay

This means the boot-time card detector can eventually copy only the selected
backend into `$8E00-$8EFF`, after which `$4000-$5FFF` can be released back to
HGR page 2.

## Deliberately deferred

CRC verification is reserved by `RAM_OVL_F_VERIFY_CRC`, but this first backend
returns `RAM_E_UNSUPPORTED` if any overlay flag is set.  CRC can be added after
the basic API has passed unchanged.


## Static layout check

The corrected combined source was checked for layout and 6502 relative branches:

- API core is confined to the `$8Dxx` page.
- TEST backend ends at `$8F83`.
- RAM state begins at `$8F90`, so the backend does not overlap it.
- all resolved relative branches are within `-128..+127`.
- fixed public `EQU` names do not collide with code-entry labels.

This is a static source/layout validation, not yet a claim that ASM_core.js has
assembled or executed the test.
