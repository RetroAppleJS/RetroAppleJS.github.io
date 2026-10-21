# HGR Script Studio — JavaScript API

A **self-contained JavaScript graphics workbench** for the Apple II HGR screen. Every operation edits a real **8192-byte HGR memory page**, not an RGB replacement. Open the JavaScript IDE, type drawing commands, and press **Run** or **Ctrl/Cmd+Enter**.

## Quick start

```js
hgr.clear('black0');
hgr.line(10, 10, 260, 180, 'violet', 2);
hgr.rect(30, 40, 120, 70, 'blue', false, 2);
hgr.circle(180, 100, 30, 'orange', false, 2);
hgr.text(35, 145, 'HELLO APPLE II', 'white0', 2);
print('Done.');
```

The global object is **hgr**, and **print(...values)** appends messages to the console. A Run operation commits its successful drawing edits as **one undo step**; if JavaScript throws an exception, the image is restored to the pre-run bytes. Commands are synchronous.

## Coordinate, byte, and color conventions

| Item | Meaning |
| --- | --- |
| Coordinate system | Top-left `(0,0)`, X = `0..279`, Y = `0..191` |
| HGR page | `8192` bytes, `$2000–$3FFF` or `$4000–$5FFF` |
| Visible bytes | `40` bytes per scanline, `7` pixels per byte |
| Byte phase | High bit (`$80`) selects color group for all seven bits |
| Dimensions | `hgr.WIDTH = 280`, `hgr.HEIGHT = 192`, `hgr.BYTE_SIZE = 8192` |
| Pixel addressing | `hgr.byteOffset(x,y)` uses Apple II non-linear HGR layout |

```js
const offset = ((y & 7) << 10)
             | ((y & 56) << 4)
             | ((y >> 6) * 40)
             | Math.floor(x / 7);
const bit = x % 7;    // Bit 0 is the leftmost of the 7 HGR pixels.
```

| ID | Color name | Bit-7 phase | Bit pattern on X |
| --- | --- | --- | --- |
| 0 | `black0` | 0 | off |
| 1 | `green` | 0 | odd pixels lit |
| 2 | `violet` | 0 | even pixels lit |
| 3 | `white0` | 0 | all lit |
| 4 | `black1` | 1 | off |
| 5 | `orange` | 1 | odd pixels lit |
| 6 | `blue` | 1 | even pixels lit |
| 7 | `white1` | 1 | all lit |

Names are case-insensitive; numeric IDs `0..7` also work. Aliases: `black`, `white`, `purple`. Special colors `phase0` and `phase1` modify only bit 7 without touching the seven pixel bits. **Color caveat:** phase is shared by all seven pixels of a memory byte. Placing blue near green may recolor previously written bits. Adjacent on-bits generally appear white. Color view is an artifact-color approximation, not a cycle-perfect NTSC decoder. `mono` renders individual set bits in white; `bits` ignores half-pixel phase shift.

## Drawing API

### hgr.clear(color = 'black0')

Fill the visible 280×192 screen with an Apple II color. Does **not** change the 512 unused HGR memory bytes; use `hgr.loadBytes(new Uint8Array(8192))` to zero the entire page. For phase-only colors, changes phase on all bytes.

```js
hgr.clear();
hgr.clear('blue');
```

### hgr.pixel(x, y, color)

Draw one logical HGR pixel. Out-of-bounds pixels are ignored. `color` defaults to the selected palette color, and the current pattern controls whether a pixel is written. For artifact colors, use two-pixel-wide strokes for more consistent visibility.

```js
hgr.pixel(140, 96, 'violet');
hgr.pixel(141, 96, 'violet');
```

### hgr.getPixel(x, y)

Get `{x, y, on, phase, color, name, address}`, or `null` for out-of-bounds. The `color` and `name` fields describe the **displayed approximate color** after considering adjacent bits; they are not independent stored RGB values.

```js
print(hgr.getPixel(20, 30));
```

### hgr.line(x0, y0, x1, y1, color, width = 1)

Draw a Bresenham line. `width` controls logical brush thickness, centered approximately on each plotted point. Default is one pixel in the API; the visual toolbar defaults to two.

```js
hgr.line(0, 0, 279, 191, 'white0', 2);
```

### hgr.rect(x, y, width, height, color, filled = true, lineWidth = 1)

Draw a rectangle with `(x, y)` as the top-left corner. Width and height are **sizes**, not the opposite corner. Set `filled` to `false` for the outline.

```js
hgr.rect(12, 22, 60, 35, 'green');
hgr.rect(12, 22, 60, 35, 'white0', false, 2);
```

### hgr.ellipse(x, y, width, height, color, filled = false, lineWidth = 1)

Draw an outlined or filled ellipse bounded by a rectangle.

```js
hgr.ellipse(80, 40, 90, 55, 'orange', true);
```

### hgr.circle(cx, cy, radius, color, filled = false, lineWidth = 1)

Draw a circle centered at `(cx, cy)` with integer radius.

```js
hgr.circle(140, 96, 32, 'violet', false, 2);
```

### hgr.fill(x, y, color)

Flood-fill the connected region at `(x, y)` and return the number of examined logical pixels. Uses four-connected neighbors and the initial snapshot's approximate display-color class. Black phase 0/1 and white phase 0/1 count as equivalent. Dithered/striped regions can leak because the empty artifact pixels read as black.

```js
const n = hgr.fill(100, 80, 'green');
print('Pixels visited', n);
```

### hgr.text(x, y, message, color, scale = 1)

Draw built-in 5×7 bitmap glyphs, with one empty column per character. Supports A–Z, 0–9, common punctuation, and newline. Lowercase input is displayed uppercase. `scale` is an integer from 1 through 8. This is a compact built-in font, **not** the original Apple II character ROM.

```js
hgr.text(20, 30, 'RETRO APPLE II', 'white0', 2);
```

### hgr.blit(bitmap, x, y, color = 'white0', transparent = true)

Stamp an array of strings/arrays as a monochrome sprite. `1`, `#`, or `true` plot the chosen color; `0` pixels remain transparent by default. When `transparent=false`, empty bits are drawn with `black0`. Sprite pixels obey the current pattern.

```js
const alien = ['01110', '11011', '11111', '10101'];
hgr.blit(alien, 50, 100, 'green');
```

### hgr.shift(dx, dy, wrap = false, fillColor = 'black0')

Shift all logical HGR bits; if `wrap=true`, pixels falling off one edge reappear at the opposite edge. The source pixel's high-bit phase is copied to each destination byte; moves not aligned to seven pixels can change neighboring artifact colors.

```js
hgr.shift(7, 0);      // shifts exactly one HGR byte to the right
```

## Patterns and phase

### hgr.setPattern(name)

Set the global drawing pattern. Options: `solid`, `checker`, `scanline`, `columns`, `dots`. Pattern holes leave existing pixels untouched. The API and mouse tools share the current pattern.

```js
hgr.setPattern('checker');
hgr.rect(20, 30, 120, 70, 'blue');
hgr.setPattern('solid');
```

### hgr.setPhase(x, y, phase)

Set or clear bit `$80` of the byte containing `(x, y)`. Changing phase of **one** coordinate changes the entire group of seven HGR pixels.

```js
hgr.setPhase(50, 60, 1);
hgr.pixel(50, 60, 'phase0'); // phase-only drawing also works
```

## Selection, sprites, and compositing

### hgr.copy(x, y, width, height)

Return an in-memory clipping `{width, height, bits, phases}`, where `bits` and `phases` are `Uint8Array`s of length `width * height`. This operation does not modify the screen.

### hgr.paste(clip, x, y, mode = 'copy')

Paste a clipping at destination `(x, y)`. Modes: `copy` overwrites bits (including zero bits), `or` sets only lit source bits, and `xor` toggles lit destination bits. Moved clips are logically pixel-aligned, but shared phase bits may make mixed-color content look different when not aligned on a seven-pixel byte boundary.

```js
const clip = hgr.copy(5, 5, 40, 30);
hgr.paste(clip, 90, 60, 'or');
```

## Direct Apple II memory access

### hgr.byteOffset(x, y)

Return offset `0..8191` into the HGR page, or `-1` for an invalid coordinate.

### hgr.byteAddress(x, y)

Return absolute Apple II address, using the selected base (`0x2000` or `0x4000`), or `-1` for invalid coordinates.

### hgr.peek(offset)

Return the raw byte at a zero-based **page offset** `0..8191`; invalid offsets throw an error.

### hgr.poke(offset, value)

Write one raw HGR byte at offset `0..8191`. Low eight bits of `value` are used. This also permits editing the unused 512 page bytes.

### hgr.getBytes()

Return a fresh `Uint8Array(8192)` copy of the complete memory page. Editing the returned copy does not affect the screen until `loadBytes()`.

### hgr.loadBytes(bytes)

Replace all 8192 bytes (including unused locations) from an array-like object of **exactly 8192 bytes**. The visualizer and binary exporter use this exact layout. For file imports, the toolbar also recognizes the 4-byte DOS BLOAD binary header.

```js
print(hgr.byteAddress(0, 0).toString(16)); // "2000" on page 1
const screen = hgr.getBytes();
screen[hgr.byteOffset(0, 0)] = 0x7f;
hgr.loadBytes(screen);
```

### hgr.getPage() and hgr.setPage(baseAddress)

Read or change the export/load base address: `0x2000` for HGR1 or `0x4000` for HGR2. This does **not** shift or alter the underlying 8192 data bytes.

```js
hgr.setPage(0x4000);
```

## Undo, redo, and atomic batches

### hgr.batch(fn)

Run a synchronous drawing callback as one undoable transaction. If the callback throws, the drawing bytes are rolled back. IDE **Run** already wraps every script in its own transaction, so `batch()` is most useful from the browser's developer console or externally supplied code.

### hgr.undo() and hgr.redo()

Undo or redo the most recent committed transaction; return a boolean indicating whether anything changed. Do **not** call these inside a drawing script: they operate on historical committed screens, not the unfinished current transaction.

```js
hgr.batch(() => {
  hgr.clear();
  hgr.line(0, 0, 279, 191, 'white0');
});
hgr.undo();
hgr.redo();
```

## File formats and interoperability

| Toolbar action | Format |
| --- | --- |
| Open HGR | Exactly 8192-byte raw HGR or 8196-byte DOS binary |
| Export HGR: Raw | 8192 bytes, directly suitable for `$2000` / `$4000` image memory |
| Export HGR: DOS BLOAD | 4-byte little-endian load address/length header followed by 8192 bytes |
| PNG | Raster preview of the active color/mono view; **not** reversible HGR bytes |
| Open / Save .js | Plain JavaScript editor source |
| API.md | This standalone Markdown documentation |

The imported screen preserves the 512 non-visible padding bytes. Tool-based screen clearing changes visible bytes only; **New** explicitly zeroes the whole page. For RetroAppleJS, load raw bytes at `$2000` (HGR) or `$4000` (HGR2), then select the corresponding graphics page in the emulator.

## Editor shortcuts and limitations

| Shortcut | Effect |
| --- | --- |
| Ctrl/Cmd + Enter | Run the JavaScript program |
| Ctrl/Cmd + S | Save .js when code has focus; otherwise export HGR |
| Ctrl/Cmd + Z / Shift+Z | Undo / redo when outside the code editor |
| Ctrl/Cmd + C, X, V | Copy, cut, paste HGR selection when outside code editor |
| Tab inside IDE | Insert two spaces |
| Mouse wheel on image | Adjust zoom |
| Escape | Cancel selection |

**Security:** The JavaScript editor uses `new Function` in this page's browser context. It is intended for **code you wrote or trust**; it is not a sandbox. Arbitrary imported JavaScript can access browser APIs. Avoid infinite loops, which may freeze the tab. No external libraries, CDNs, accounts, or network requests are required by the workbench itself.

**Display accuracy:** This is a practical Apple II artifact preview, not a composite NTSC simulation. It models the byte phase and half-pixel shift approximately. Color conflicts and text/font appearance should be verified in the final target emulator or real Apple II.
