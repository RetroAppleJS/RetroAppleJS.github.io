# GPT16 V6.11A — pre-START DOS fallback fix

## Failure explained

`CALL 16513` enters `$4081 = KAPI_CHAT_DISK_BOOT`.  This intentionally forces
the DOS `GPTCHAT` path; it does not test LC recovery.

V6.11 had a real bug in that forced path: `CHAT_DISK_LOAD` could execute before
CHAT `START`, but `START` was the code that normally called `DOS_INIT`.

After ESC-Q, GPT16 correctly restores the caller's `$F2/$F3`.  Therefore a
later direct `CALL 16513` entered the File Manager with no freshly acquired DOS
parameter-list pointer.

## Fix

V6.11A makes `CHAT_DISK_LOAD` self-contained:

```asm
        JSR     GPT_RAM_ZP_SAVE_NOW
        JSR     DOS_INIT
        LDA     DOS_AVAILABLE
        BEQ     CHAT_DISK_FAIL_RESTORE
        JSR     CHAT_SET_DISK_NAME
```

Thus every disk fallback path reacquires the DOS File Manager parameter list
before OPEN/POSITION/READ.

CHAT itself is unchanged byte-for-byte except for the source filename comment;
its image remains `$6000-$7D19`, length `$1D1A`, signature `G16C 01 01`.

## Correct tests

### A. LC recovery

After one successful V6.11A run, exit with ESC-Q and corrupt only:

`6015:00`

Then run:

`CALL 16384`

That is `$4000 = KERNEL_BOOT`.  It should reject the damaged main CHAT and
recover the cached image from the Language Card.

### B. Forced DOS fallback

First ensure a V6.11/V6.11A overlay file exists:

`BSAVE GPTCHAT,A$6000,L$1D1A`

Then, after ESC-Q:

`CALL 16513`

That is `$4081 = KAPI_CHAT_DISK_BOOT`.  It deliberately bypasses the LC and
loads `GPTCHAT` from DOS.

If `GPTCHAT` has not been BSAVEd, `GPTCHAT LOAD FAILED` remains the correct
result.

## Static checks

- resident kernel end: `$5167`
- CHAT end: `$7D1A`
- LC backend end: `$8FFF`
- program/DOS workspace end: `$9496`
- relative branch reach: PASS
