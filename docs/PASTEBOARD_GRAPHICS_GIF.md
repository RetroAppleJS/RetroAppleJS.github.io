# Pasteboard graphics GIF capture

The Pasteboard Script runner buffers Apple II video-memory snapshots and builds
GIF89a bytes **only when an export is requested**. It uses Apple II display
soft-switches, compact visible-memory scans, the active character ROM, and the
pixel/color decoding used by `res/EMU_DEVICE_video_canvas.js`. It does **not**
screenshot the browser window or monitor chrome.

## Single GIF from the displayed Apple II screen (Program mode)

```javascript
await apple.graphics.clear();
console.log("Displayed video:", await apple.graphics.mode());
const frame = await apple.graphics.capture({mode:"active"});
console.log(frame); // mode, changed, displayed, activeMode, frames
await apple.graphics.exportGIF({filename:"apple2-screen.gif"});
```

The `mode` option defaults to `"active"`. This is **essential** when the
visible screen is in text mode: capturing `mode:"HGR"` instead reads the
physical $2000-$3FFF graphics memory even when it is **not being displayed**.
Those bytes may contain random-looking data, producing a valid but noisy GIF.
An explicitly selected off-screen mode is allowed for debugging; its capture
result contains `displayed:false`, `activeMode`, and a `warning` string.
Pass `requireVisible:true` to make off-screen captures fail instead.

Supported mode selectors: `active`, `TEXT`, `TEXT2`, `GR`, `GR2`,
`GRMIX`, `GR2MIX`, `HGR`, `HGR2`, `HGRMIX`, `HGR2MIX`.
Mixed modes combine 20 graphics rows (or 160 HGR scanlines) with four bottom
text rows. The character ROM comes from the video MUX, so J-Plus glyphs and
annunciator bank selection use the same logic as the canvas renderer.

## Animated GIF (State Machine mode)

Use the normal frame-driven state runner, which calls each state handler at
most once per eligible processing frame. The example below captures only
changed visible states over roughly 10 seconds:

```javascript
const initialState = "record";
const stateTimeoutMs = 30000;
const states = {
  record: async ({apple, data, elapsedMs, console}) => {
    if (!data.started) {
      await apple.graphics.clear();
      data.started = true;
    }
    const result = await apple.graphics.capture({
      mode: "active",
      changedOnly: true
    });
    if (result.captured) {
      data.frames = (data.frames || 0) + 1;
    }
    if (elapsedMs < 10000) return;
    console.log("Distinct frames:", data.frames || 0);
    await apple.graphics.exportAnimatedGIF({
      filename: "apple2-recording.gif",
      lastDelayMs: 250,
      loop: 0
    });
    return {done:true};
  }
};
```

Only changed frames are stored, based on visible video bytes and display mode.
Differences in the invisible HGR screen holes or lower hidden part of an HGR
mixed screen are ignored. Recordings persist across script runs until
`apple.graphics.clear()` is called.

Raw captures are 960 bytes for TEXT/GR, 7680 bytes for full HGR, and 6560 bytes
for mixed HGR. The recorder stores raw frames or XOR deltas with zero-run-length
encoding, whichever is smaller. LZW GIF encoding is performed only at export.

There is a 2,000-frame and 16 MiB stored-data safety limit. The final GIF is
280×192 pixels and uses a fixed 16-color palette. Exported GIFs represent the
Apple II screen pixels, not modern renderer-specific CRT effects, monitor frames,
or Videx overlays. Flashing text is currently sampled without tracking the
canvas renderer's flashing phase; this is a limitation for animations containing
flashing characters.

To capture an animation **without** a state machine, call
`apple.graphics.capture({mode:"active"})` repeatedly while the emulated
screen changes, then call `exportAnimatedGIF`. A single call in Program mode
can only store one image.
