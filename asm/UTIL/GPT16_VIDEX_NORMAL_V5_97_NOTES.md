# GPT16 VIDEX NORMAL V5.97 notes

V5.97 is based directly on `GPT16_VIDEX_NORMAL_V5_96.S`.

## Changes

- The GPT startup briefing is no longer a separate resident data block.
- `GPT_BRIEFING` now begins at `PAGE_SCREEN_SAVE`.
- The briefing remains ordinary `ASC` data; `ASC6` is deliberately not used.
- `PAGE_SCREEN_SIZE EQU $0700` fixes the shared PAGE arena at 1792 bytes.
- `GPT_BRIEFING_END` marks the end of the briefing.
- A compile-time guard prevents future briefing edits from overrunning the arena:

```asm
        .ASSERT GPT_BRIEFING_END <= PAGE_SCREEN_SAVE+PAGE_SCREEN_SIZE, error, "GPT briefing exceeds PAGE_SCREEN_SAVE arena"
```

- The remainder of the arena is allocated with:

```asm
        .RES    PAGE_SCREEN_SAVE+PAGE_SCREEN_SIZE-*
```

- Added persistent `GPT_BRIEFED`, initialized to zero by binary load but deliberately omitted from the `START` state-clear block.
- On first `CALL`, the application sends the hidden briefing, waits for the GPT response, then sets `GPT_BRIEFED` to 1.
- On subsequent `CALL` re-entry without reloading the binary, the startup briefing is skipped.
- Reloading the binary restores `GPT_BRIEFED` to zero and therefore causes a fresh briefing.

## Arena

- Raw briefing including terminating NUL: **895 bytes**
- `PAGE_SCREEN_SAVE`: **1792 bytes**
- Remaining arena after briefing: **897 bytes**
- The arena still occupies exactly `$0700` bytes; `SAVE_NAME` begins immediately after it.

Static V5.97 layout:

- `PAGE_SCREEN_SAVE`: `$84EE`
- `GPT_BRIEFING`: `$84EE`
- `GPT_BRIEFING_END`: `$8743`
- `SAVE_NAME`: `$8BEE`
- Arena span `SAVE_NAME-PAGE_SCREEN_SAVE`: `$0700` / 1792 bytes

## Static validation

The same independent NMOS-6502 layout logic that reproduces V5.96's previously measured size of 12,449 bytes gives:

- V5.96: 12,449 bytes = 8,340 code + 4,109 data
- V5.97: 11,863 bytes = 8,350 code + 3,513 data
- Net V5.96 -> V5.97 reduction: **586 bytes**
- Estimated V5.97 image: `$6000-$8E56`

Checks:

- Symbols: 884
- Duplicate definitions: 0
- Undefined symbol references: 0
- Relative branches: 499
- Out-of-range branches: 0
- Layout parse errors: 0
- `.ASSERT` expression evaluates true
- `PAGE_SCREEN_SAVE` remains exactly 1792 bytes

The 10-byte code increase is the one-time briefing gate/flag logic. Data falls by 596 bytes because the former separate 597-byte briefing is overlaid into the already-required PAGE arena and only the new one-byte `GPT_BRIEFED` state remains resident.

## Runtime checks recommended

1. Reload V5.97 and `CALL 24576`: hidden briefing should be sent once.
2. Quit and `CALL 24576` again without reloading: briefing should be skipped.
3. Reload the binary and `CALL 24576`: briefing should be sent again.
4. Enter PAGE mode after the first handshake and verify exact screen save/restore.
5. Exercise CMD/READ/filename menu paths, which reuse the PAGE arena outside PAGE mode.
6. Temporarily enlarge the briefing beyond 1792 bytes and confirm `.ASSERT` reports the configured overflow error.
