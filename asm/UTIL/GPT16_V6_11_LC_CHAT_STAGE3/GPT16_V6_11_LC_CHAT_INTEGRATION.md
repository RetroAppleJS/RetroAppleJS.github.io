# GPT16 V6.11 — LC16K CHAT backing-store integration

Baseline: validated `GPT16_V6_10_SPLIT_LAYOUT.S`.

## Runtime policy

`KAPI_BOOT` at `$4000` now enters a resident `KERNEL_BOOT` routine.

1. If CHAT at `$6000` has the V6.11 signature, it is written to the Language
   Card and immediately loaded back once.
2. The CHAT image occupies logical LC `$2000-$3D19`, corresponding to physical
   common LC RAM `$E000-$FD19`.
3. If no valid main-RAM CHAT image exists, boot tries the LC copy.
4. If LC is absent, stale, or fails, the resident kernel reads DOS binary
   `GPTCHAT` into `$6000`.
5. `KAPI_CHAT_RELOAD` is the future XFER->CHAT path: LC first, disk fallback.
6. `KAPI_CHAT_DISK_BOOT` forces the disk path for testing.

## Fixed new KAPI entries

- `$407B` `KAPI_CHAT_CACHE_STORE`
- `$407E` `KAPI_CHAT_RELOAD`
- `$4081` `KAPI_CHAT_DISK_BOOT`

## CHAT image compatibility

The overlay signature is in already-reserved ABI padding:

- `$6015-$601A`: `47 31 36 43 01 01` = `"G16C"`, ABI 1.1

The overlay implementation still begins at `$6040`, so the CHAT image remains
exactly `$1D1A` bytes and ends at `$7D1A`.

## DOS fallback file

Create `GPTCHAT` as a DOS 3.3 Binary file containing the V6.11 CHAT image:

`BSAVE GPTCHAT,A$6000,L$1D1A`

The fallback loader validates:

- file type = Binary (`$04`);
- stored load address = `$6000`;
- stored length = `$1D1A`;
- V6.11 overlay signature after loading.

It reads the DOS binary header itself and then copies exactly `$1D1A` raw image
bytes to `$6000`.

## Zero-page preservation

The LC API/backend uses `$E8-$EF`.  GPT16 now saves/restores those eight bytes
around every integrated RAM operation using `$8CF8-$8CFF`.

A pre-START disk fallback can also use `$F2-$F3` for the DOS File Manager.
`KERNEL_BOOT` therefore preserves/restores the original `$F0-$F3` before CHAT
`START` gets control.

## First test

Use `GPT16_V6_11_LC_CHAT_COMBINED.S`.

Load/start exactly as the validated V6.10 build:

`CALL 16384`

Expected visible/network behavior is unchanged from V6.10.  Before CHAT starts,
the kernel silently:

`$6000 CHAT -> LC $2000 -> $6000 CHAT`

and validates the overlay signature.

Re-run the existing GPT and `HELLO.CMD` regression tests.

## Prove LC recovery

After one successful V6.11 run has cached CHAT in LC, return to BASIC/Monitor
and corrupt only the main-RAM signature byte:

`6015:00`

Then:

`CALL 16384`

The resident kernel should detect invalid main-RAM CHAT, restore it from LC,
validate it, and start normally.

## Prove DOS fallback

First create the disk overlay while a valid V6.11 CHAT image is at `$6000`:

`BSAVE GPTCHAT,A$6000,L$1D1A`

Then force the disk bootstrap path:

`CALL 16513`

`16513 = $4081 = KAPI_CHAT_DISK_BOOT`.

It should load `GPTCHAT` from disk, refresh LC if available, and enter normal
CHAT startup.

## Static validation performed

- kernel code end: `$515F` (< `$6000`)
- CHAT end: `$7D1A` (exactly `$7D1A`)
- original shared state end: `$8C88`
- LC loader prefix end: `$8CF8`
- RAM API core end: `$8D7F`
- LC helper end: `$8DFE`
- LC backend end: `$8FFF`
- DOS/program end: `$9496`
- all resolved 6502 relative branches are inside `-128..+127`
- no duplicate labels/EQUs were found

This is static source validation.  Runtime validation is the next stage gate.
