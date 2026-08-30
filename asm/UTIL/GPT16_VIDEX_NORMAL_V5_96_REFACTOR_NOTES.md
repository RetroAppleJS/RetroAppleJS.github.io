# GPT16 VIDEX NORMAL V5.96 refactor notes

V5.96 is based on `GPT16_VIDEX_NORMAL_V5_95.S` and keeps the V5.95 feature set while applying size-first, classic 6502 refactoring. Runtime speed was deliberately treated as secondary to resident/binary footprint.

## Main changes

- Removed the runtime `PATCH_VIDEX_SLOT` self-modifier. VideoTerm 2.4 is already accepted only in slot 3, so its `$C300`, `$C0B0/$C0B1`, and slot-3 firmware workspace operands are compile-time constants.
- Added a shared `INPUT_NEXT_CHAR` iterator and reused it for serial submission, history writing, and input redraw.
- Removed dead `LOAD_SENT_GPT` and `LOAD_SURROGATE` state/paths.
- Overlaid transient CMD/GPT parser buffers onto the 512-byte `INPUT_BUF` arena:
  - `AUX_LINE_BUF`
  - `A2_BUF`
  - `GPT_CTRL_NAME`
  - `GPT_FILE_NAME`
  - `PENDING_NAME`
- Packed the complete 2048-cell VideoTerm PAGE snapshot from 8 bits/cell to 7 bits/cell: 2048 bytes -> 1792 bytes.
- Reused the packed PAGE arena outside PAGE mode for:
  - AUX File Manager work area
  - AUX T/S list
  - AUX data buffer
  - menu row backup
  - filename-entry buffer
- During PAGE mode, AUX history reads borrow the closed SAVE File Manager work/T/S/data buffers via `PAGE_MODE_ACTIVE`.
- Replaced `DOS_ERROR_SAVE`, `GLYPH_TEMP`, `CRTC_REG_TEMP`, and `CRTC_DATA_TEMP` with stack/register preservation where safe.
- Replaced the 16-byte `BMP_GLYPH` lookup table with arithmetic (`index 0 -> $07`, `1..15 -> $10|index`).
- Reduced the GPT startup briefing from 1541 bytes including NUL to 597 bytes including NUL while retaining the V5.95 file-control protocol requirements.

## Footprint

Exact bytes emitted by `HEX`/`ASC` source directives:

- V5.95: 6405 bytes
- V5.96: 4109 bytes
- Reduction: **2296 bytes**

Breakdown of the 2296-byte data reduction:

- compact GPT briefing: 944 bytes
- prompt-buffer overlays: 408 bytes
- PAGE scratch overlays: 667 bytes
- 7-bit PAGE packing: 256 bytes
- dead/temp/table removal, net of the new PAGE flag: 21 bytes

A standard NMOS-6502 layout pass estimates:

- V5.95: 14907 bytes total (8502 code + 6405 data)
- V5.96: 12449 bytes total (8340 code + 4109 data)
- Estimated total reduction: **2458 bytes (~16.5%)**

The code estimate is a static independent layout calculation; the exact final binary size should be confirmed by assembling V5.96 with the RetroAppleJS assembler used for deployment.

## Arena layout from the static layout pass

- `INPUT_BUF` `$8538-$8737` (512 bytes)
  - `A2_BUF` `$8538`
  - `GPT_CTRL_NAME` `$8578`
  - `GPT_FILE_NAME` `$8596`
  - `PENDING_NAME` `$85B4`
- `PAGE_SCREEN_SAVE` `$8738-$8E37` (1792 bytes)
  - AUX work `$8738`
  - AUX T/S `$8765`
  - AUX data `$8865`
  - menu row `$8965`
  - filename input `$89B5-$89D2`
- Persistent storage begins after the packed PAGE arena:
  - `SAVE_NAME` `$8E38`
  - `AUX_NAME` `$8E56`
  - `SAVE_WORK` `$8E74`
  - `SAVE_TS` `$8EA1`
  - `SAVE_DATA` `$8FA1`

## Validation performed

- 0 duplicate label definitions.
- 0 unresolved control-flow targets.
- 0 undefined symbol references in the static parser.
- 0 source/layout parse errors in the static parser.
- All 498 relative branches are within the NMOS 6502 -128..+127 range.
- 7-bit PAGE pack/unpack was round-trip tested with 2048-cell random data; it consumes exactly 1792 bytes.
- VideoTerm writes in this program were checked: screen clear uses `$20`, Unicode mapping returns `$00-$7F`, and the compressed logo explicitly strips bit 7. This is the basis for the 7-bit PAGE snapshot.

## Deliberately retained for V5.96

- The legacy raw U+001B GPT file-control protocol remains for backward compatibility.
- SAVE and AUX DOS filenames remain physically separate because PAGE mode needs the AUX filename while the packed screen snapshot is live.
- Tiny supplementary-glyph and card-CRC tables remain tables; generating them would not give a useful net size reduction.
- The File Manager API was not rewritten into a fully descriptor-driven abstraction in this version; the lifetime union already removes the duplicated AUX data buffers with lower regression risk.
