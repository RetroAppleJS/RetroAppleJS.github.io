# GPT16 RAM Stage 2 — 16 KiB Language Card backend

## Purpose

`GPT16_RAM_BACKEND_LC16K.S` implements the already-fixed card-neutral backend
entry ABI at `$8E00` for a classic Apple II 16 KiB Language Card.

The six public application entry points remain unchanged at `$8D00`; only the
backend changes.

## Language Card logical mapping

GPT16 exposes one 16 KiB logical bank:

| Logical offset | Physical LC area |
|---|---|
| `$0000-$0FFF` | bank 2 at `$D000-$DFFF` |
| `$1000-$1FFF` | bank 1 at `$D000-$DFFF` |
| `$2000-$3FFF` | common `$E000-$FFFF` RAM |

The backend uses the classic soft switches:

- `$C080`: RAM read, Dx bank 2, LC write protected
- `$C081`: ROM read, Dx bank 2; two successive reads write-enable LC RAM
- `$C082`: ROM read, Dx bank 2, LC write protected
- `$C088`: RAM read, Dx bank 1, LC write protected
- `$C089`: ROM read, Dx bank 1; two successive reads write-enable LC RAM

Writes deliberately keep ROM visible.  Reads temporarily map LC RAM over
`$D000-$FFFF`, so the backend disables interrupts during mapped reads and
restores the caller's interrupt-enable state before return.

## Canonical mapping postcondition

A classic Apple II/II+ Language Card does not provide a portable way to query
and reconstruct an arbitrary pre-call LC mapping.  Therefore V1.2 defines a
canonical postcondition for mapping backends:

**Every API/backend call returns with system ROM visible, LC RAM write-protected,
and Dx bank 2 selected.**

This is exactly the state GPT16 and DOS want between RAM-card operations.

## ROM-restore checks

`RAM_INIT` records three ROM signature bytes from `$D000`, `$E000`, and `$FDED`.
Every mapped read/write operation:

1. restores `$C082`;
2. checks those three ROM bytes;
3. returns `RAM_E_BACKEND` if ROM visibility was not restored.

The standalone test independently records the same ROM signature before
`RAM_INIT` and checks it after API operations without touching a soft switch.
A ROM-restore failure is therefore detected from outside the backend as well.

## Non-destructive probe

The probe saves one byte from each physical LC region, writes three distinct
test values (`$55`, `$AA`, `$A5`), checks that the two Dx banks are independent,
restores all original bytes, verifies the restored RAM contents, switches ROM
back in, and verifies the saved ROM signature.

This distinguishes a real 16 KiB LC from absent RAM or aliased Dx banks while
leaving the tested LC bytes unchanged.

## Resident layout

The V6.10 GPT16 state was recalculated directly from the validated split source:
`STATE_END=$8C80`.

Stage 2 uses:

```
$8C80-$8C87  guard / untouched
$8C88-$8C9F  RAM API + LC private state
$8CA0-$8CF7  LC overlay-loader prefix
$8CF8-$8CFF  spare

$8D00-$8D7E  card-neutral RAM API core
$8D7F        spare
$8D80-$8DFD  LC helpers / loader tail
$8DFE-$8DFF  spare

$8E00-$8E0E  fixed backend ABI JMP table
$8E0F-$8E1F  spare
$8E20-$8FFE  LC backend implementation
$8FFF        spare

$9000+       existing DOS workspace / DOS 3.3
```

Thus the real LC backend still fits below `$9000` and does not consume
`$4000-$5FFF`.  That is important for the later step where HGR page 2 is
released after boot.

## Standalone test

Assemble:

`GPT16_RAM_LC16K_TEST_COMBINED.S`

and run:

`CALL 4096`

On a working 16 KiB Language Card, expected output is:

```
LC16K RAM API TEST
PASS: LC16K BANKS R/W ROM RESTORE OVERLAY EXEC
```

If no compatible 16 KiB LC is present:

```
LC16K RAM API TEST
NO 16K LANGUAGE CARD DETECTED
```

The test verifies:

- `RAM_INIT` / `RAM_PRESENT`
- logical bank 0 and rejection of bank 1
- ROM visibility after API calls
- a 32-byte transfer across logical `$0FFF->$1000`
  (Dx bank 2 -> Dx bank 1)
- a 32-byte transfer across logical `$1FFF->$2000`
  (Dx bank 1 -> common high RAM)
- rejection of a transfer crossing logical `$4000`
- `RAM_LOAD_OVERLAY` from LC common high RAM to `$6000`
- execution of the copied six-byte overlay
- restoration of every LC byte modified by the test

## Deliberately deferred

`RAM_OVL_F_VERIFY_CRC` remains reserved.  A non-zero overlay flag currently
returns `RAM_E_UNSUPPORTED`.  CRC should be added only after this hardware path
passes unchanged.
