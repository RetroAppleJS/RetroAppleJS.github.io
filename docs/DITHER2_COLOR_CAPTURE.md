# DITHER2 color capture

`res/EMU_CARD_dithertizer2.js` is the separate color card. Its existing camera
and ConvertHGR controls are unchanged. The WASM converter supplies an 8192-byte
Apple II HGR page. On `$C0n8`, DITHER2 copies its 7680 visible bytes through the
hardware write mapping into the page selected by `$C054` or `$C055`, preserving
every byte's color phase bit 7. HGR memory holes remain untouched. The latest
complete converted page is published atomically; a converter failure retains
the previous page. An injected `getHGRPage()` source can supply a full page,
while the older `getLumaFrame()` test source remains supported as monochrome.

The original disk's `DSCAN 4.2.OBJ` already contains a synchronized PAGE2
capture entry at `$1D03` (decimal `7427`). Calling that entry selects PAGE2,
waits for video sync, reads `$C0n8` once, and returns. This entry needs no
assembly changes. The disk's usual `CALL 7168` enters `$1C00`, which instead
takes four PAGE1 captures and merges a Bayer dither into PAGE2. Its merge uses
`AND #$7F`, so the usual DITHER command on the disk cannot retain color. A
color capture must call `7427` after loading `DSCAN 4.2.OBJ` (or change the
disk application's call site from `7168` to `7427`). The original driver disk
is left intact for the historical DITHER card.
