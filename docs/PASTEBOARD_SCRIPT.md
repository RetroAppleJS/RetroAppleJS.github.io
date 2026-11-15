# Pasteboard Script — Phase 1

The **Script** button replaces the old **Clear** button in the Emulator > Tools
pasteboard. It opens a JavaScript macro editor and console in a companion window
matching the STEP TRACE SCENARIO shell and width (460 px). The popup is scoped
to the Emulator Tools tab, retaining its previous open/closed state while
navigating tabs. Closing the editor **does not stop a running script**.

Scripts execute directly in the page as asynchronous JavaScript functions.
The pasteboard API uses the existing Apple II device model without a Web Worker,
secondary CPU scheduler, synthetic keyboard events, or external worker fetch.

The editor is a **document-absolutely positioned companion**, not a fixed
window or an overlay tied to the Apple II screen. Macros can temporarily hide
it to let users watch the screen and show it again without interrupting
execution.

## Getting started

1. Select **Emulator > Tools > Script**.
2. Edit the example JavaScript. Use **RUN** or **Ctrl/Cmd+Enter**.
3. Watch the console for output, errors, and completion.
4. Use **STOP** to cancel pending waits and subsequent awaited device actions.
   Like other main-thread JavaScript, a tight synchronous loop blocks the UI
   and cannot be interrupted by STOP. Closing the popup does not stop a macro.
5. Use `await apple.script.hide()` and `await apple.script.show()` to control
   the popup during a running demonstration. The same **Script** toolbar
   button can always reopen it while the macro runs. Hiding does not cancel
   the macro or pause the Apple II.
6. **Example** restores the starter script; **Clear** clears only the script
   console, not the pasteboard's main textarea.

The current script text is retained when the popup is hidden and reopened,
but is **not yet saved across page reloads**. Import/export and the example
library are planned for a later phase.

## API

Every operation that reaches the emulator is asynchronous. Use `await`.

| API | Description |
| --- | --- |
| `await apple.wait(ms)` | Wall-clock delay, 0–60000 ms per call; does not halt CPU |
| `await apple.text.type(text)` | Route text through `PASTEBO` to the active text input device |
| `await apple.text.capture()` | Capture active semantic text, including VIDEX if selected |
| `await apple.text.waitFor(text, options)` | Poll the active text source until string or RegExp matches |
| `await apple.memory.read(address)` | Read one byte without I/O side effects |
| `await apple.memory.capture(start, length)` | Return a `Uint8Array` snapshot of mapped memory |
| `await apple.memory.dump(start, length)` | Produce a hexadecimal/ASCII dump string |
| `await apple.reset()` | Apple II warm reset |
| `await apple.reboot()` | Apple II restart/cold boot |
| `await apple.pause()` | Pause emulator execution through the existing Pause control |
| `await apple.resume()` | Resume emulator execution through the existing Pause control |
| `apple.assert(boolean, message)` | Log PASS or throw on FAIL |
| `apple.script.running()` | Whether the current macro is active |
| `await apple.script.hide()` | Hide the Script IDE/console without stopping the macro or guest CPU |
| `await apple.script.show()` | Redisplay the Script IDE/console at its absolute companion position |
| `apple.script.stop()` | Cooperatively cancel the active macro |
| `console.log/info/warn/error(...)` | Write to the script console |
| `print(...)` | Alias of console logging |

Memory addresses are integers in the inclusive range `0x0000`–`0xFFFF`,
or strings like `"$0400"`. Ranges may not wrap around the end of memory.
A length of 0 returns an empty capture. `memory.dump()` defaults to 128 bytes.

`text.waitFor(pattern, {timeout:10000, interval:100})` accepts a string or
regular expression. Timeouts use milliseconds and are capped at 120000; the
polling interval must be between 50 and 60000 ms. The default text route uses
`0:PASTEBO:text -> 0:A2KBD:text`, switching to the active
`n:VIDEXTXT:text` when that device owns text input. The same `PASTEBO`
device determines the active text capture source.

**Important:** `text.type()` returning confirms the port accepted the
transfer; it does *not* guarantee that the guest program has already consumed
every character. Synchronize a demonstration by waiting for a visible prompt
or other observable state.

### Example: type and inspect

```javascript
await apple.reset();
await apple.wait(1000);

// The device router handles Apple II keyboard encoding/strobe.
await apple.text.type("HOME\r");
await apple.text.type('PRINT "HELLO"\r');

// Wait for visible output, rather than assuming the CPU was fast enough.
const screen = await apple.text.waitFor("HELLO", {timeout:10000});
console.log(screen);

const bytes = await apple.memory.capture(0x0400, 64);
console.log(bytes);
console.log(await apple.memory.dump(0x0400, 64));
apple.assert(bytes.length === 64, "text-page memory capture");
```

### Example: hide the IDE while showing the Apple II screen

```javascript
// Show the emulator screen unobstructed while the demonstration runs.
await apple.script.hide();

try {
  await apple.text.type("HOME\r");
  await apple.text.type('PRINT "HELLO"\r');
  await apple.text.waitFor("HELLO", {timeout:10000});
  await apple.wait(2000);
} finally {
  // This runs on normal completion or script errors. With cooperative STOP,
  // the macro is cancelled at its next awaited operation. The Script button
  // is always available to restore the window manually.
  await apple.script.show();
}
```

`hide()` and `show()` affect only the Script popup; they do not change
the main pasteboard textarea, emulator run state, or script execution. The
popup remains document-absolutely positioned using the STEP TRACE SCENARIO
companion layout, and restoring it does not focus the editor or inject keys.

## CPU speed: 0–400%

The Script API can set the same **CPU speed percentage** controlled by the
Emulator's CPU throttle slider. This is the requested CPU clock rate, not a
guaranteed measured throughput (host CPU load can reduce the achieved pace).

| Method | Behavior |
| --- | --- |
| \`await apple.cpu.getSpeed()\` | Read the currently selected target percentage |
| \`await apple.cpu.setSpeed(400)\` | Target 400% (4× normal CPU speed) |
| \`await apple.cpu.setSpeed(100)\` | Restore the normal 100% target |
| \`await apple.cpu.setSpeed(0)\` | Select the existing 0%/step-trace CPU speed |

Only integer percentages from 0 through 400 are accepted. The API uses
\`oEMUI.cpuSpd()\` through its new percentage adapter, so it updates the
actual CPU scheduler, Disk II speed notifications, CPU speed readout, and
slider together. It does not manipulate CPU tick counters directly.

For a demonstration that temporarily accelerates boot:

\`\`\`javascript
await apple.cpu.setSpeed(400);
try {
  await apple.disk.loadOffline({
    slot: 6, drive: 1, path: "disks/ProDOS 8.dsk"
  });
  await apple.reboot();
  await apple.text.waitForReady({timeout:60000});
} finally {
  await apple.cpu.setSpeed(100);
}
\`\`\`

The built-in **ProDOS Demo** sets 400% at the beginning of its \`try\`
block and restores **100%** in \`finally\` (before reopening the Script
window). If STOP cancels a pending wait so the \`finally\` block cannot
call the script API, the runner additionally restores the CPU speed that
was selected before the macro changed it.

## Compressed \`?pscript=\` URLs

Script source can be loaded via a compressed URI parameter, matching the
existing assembler source URL encoding: **zlib/Deflate + UTF-8 +
URL-safe Base64**, without padding.

For example, an encoded URL has the form:

\`\`\`text
index.html?pscript=eN...
\`\`\`

The parameter contains the *JavaScript source*, not a filename or
external script URL. Spaces, Unicode, and newline characters are preserved.

To create a link, open PASTEBOARD SCRIPT, edit the source, and click
**Copy URI**. The URL is copied to the clipboard, preserving unrelated
query parameters and the current fragment. The exported script is
compressed with the already-installed \`pako\` library.

Opening an \`index.html?pscript=...\` link:

- Decodes and validates the compressed source on page load.
- Opens the Script popup and fills the editor with the decoded JavaScript.
- **Does not execute anything automatically**; RUN is always explicit.
- Reports malformed Base64, Deflate errors, or oversized sources in the
  Script console without executing the payload.

The uncompressed script limit is **64 KiB**, and the compressed Base64URL
parameter is limited to 32,768 characters. The decoder uses bounded,
chunked expansion to avoid unbounded decompression.

Programmatic helpers are available for integration/testing:
\`EMU_PASTEBOARD_SCRIPT.uri.encode(source)\`,
\`EMU_PASTEBOARD_SCRIPT.uri.decode(payload)\`, and
\`EMU_PASTEBOARD_SCRIPT.uri.current()\`.

## Safety, timing, and cancellation

- Scripts run directly in the browser page and are **trusted user-authored
  JavaScript**, not isolated from other page objects. Do not paste unknown or
  untrusted scripts.
- A tight synchronous loop blocks the page, including the Apple II emulator.
  The RUN/STOP controls are **cooperative**: STOP cancels pending waits and
  prevents subsequent awaited API operations, but cannot preempt CPU-bound
  synchronous code.
- Completed operations (such as a reset or keyboard transfer) cannot be
  rolled back by STOP. Cancelled script continuations cannot issue further
  awaited API operations on their old run handle.
- The runner uses wall-clock `setTimeout` for waits and does not manipulate
  emulator CPU tick scheduling or STEP TRACE breakpoint ownership.
- Text and memory use the existing host device and safe mapped-memory
  interfaces, rather than directly inspecting an emulated device's internals.


## Guest keyboard readiness (A2KBD)

The emulator's pasteboard accepts a whole text payload, then A2KBD releases
one key at a time as the **guest CPU reads $C000**. The guest clears the keyboard
latch by accessing $C010. Therefore a successful \`apple.text.type()\` call means
only *queued for input*, not necessarily *processed by the guest*.

The Script API now offers:

| Method | Meaning |
| --- | --- |
| \`await apple.text.status()\` | Snapshot of actual keyboard polling and queue state |
| \`await apple.text.waitForReady(options)\` | Wait for fresh, sustained guest $C000 polling with an empty keyboard latch and input queue |
| \`await apple.text.waitForDrain(options)\` | Wait until queued characters and the latched key are consumed (strobe cleared) |

\`status()\` returns \`target\`, \`active\`, \`pollCount\`,
\`strobeCount\`, \`lastPollMs\`, \`queued\`, \`latched\`, and an
instantaneous \`available\` flag. The counters are observational: reading
these fields **does not itself read $C000 or generate any keystrokes**. Safe
debugger reads never increment them.

\`waitForReady({timeout:30000, interval:75, stableMs:250, minPolls:4})\`
requires fresh polls across a window of at least \`stableMs\` milliseconds.
It accommodates the emulator's batched CPU scheduler by allowing unchanged
counter samples. This proves the guest is polling the keyboard; it does **not
by itself prove that an operating system has fully booted**. Combine it with
\`text.waitFor()\` when the guest has a recognizable menu or command prompt.

\`waitForDrain({timeout:20000, interval:50})\` is useful after sending
a sequence such as \`await apple.text.type("\x15\x15\r")\`. The two
\`0x15\` bytes correspond to **two Apple II right-arrow keystrokes** and
\`0x0D\` is RETURN.

## Embedded offline Disk II images

\`EMU_CARD_appledisk2.js\` contains compressed, embedded disk images and
their catalog. Scripts can use those exact bytes, without sending an HTTPS
request or depending on GitHub availability.

| Method | Description |
| --- | --- |
| \`await apple.disk.listOffline(6)\` | List embedded images from the Disk II controller in physical slot 6 |
| \`await apple.disk.loadOffline({slot:6, drive:1, path:"disks/ProDOS 8.dsk"})\` | Decode the embedded disk and mount it in Disk II S6,D1 |

The public \`slot\` is the **physical slot number**, so S6 maps to
Apple2IO's internal slot index 7. The public \`drive\` accepts \`1\`, \`2\`,
\`"D1"\`, or \`"D2"\`. Only catalogued embedded images are accepted; the
API deliberately does not fall back to a remote URL. Loading uses the normal
\`EMU_mountDiskImage()\` path, preserving disk format handling and filename
display.

## ProDOS 8 BASIC.SYSTEM demonstration

Open PASTEBOARD SCRIPT, click **ProDOS Demo**, then **RUN**. The exact
same macro is available as [`docs/examples/PASTEBOARD_ProDOS8_Offline_Boot.js`](examples/PASTEBOARD_ProDOS8_Offline_Boot.js)
for inspection and copying into the editor. The example:

1. Hides the Script companion so the Apple II display is unobstructed.
2. Mounts embedded \`disks/ProDOS 8.dsk\` in S6,D1 and cold-boots.
3. Sets the CPU throttle to **400%** while booting, then waits for keyboard
   polling to stabilize during the ProDOS boot menu.
4. Sends two right-arrow keys and RETURN (the selected menu option should
   launch BASIC.SYSTEM for this particular disk image).
5. Waits for an Applesoft \`]\` prompt and fresh keyboard polling.
6. Enters \`PRINT "HELLO WORLD"\` followed by RETURN, waits for the
   keyboard queue and latch to clear, restores the CPU to **100%**,
   and stops after reopening the editor.

The macro is included directly in the editor's built-in example selector.
A physical S6 Disk II controller and the expected menu layout are required.
The selected image and exact guest boot behavior should be validated in a
browser session, since the automated tests verify device routing and command
order, not a complete real-time Apple II boot.

### Troubleshooting

If boot stalls at \`waitForReady()\`, print \`await apple.text.status()\`
to inspect \`pollCount\`, \`queued\` and \`latched\`. If the operating system
presents a different boot menu, inspect \`await apple.text.capture()\` and
adjust the menu navigation before the BASIC.SYSTEM prompt check.

## Planned API extensions

Disk II embedded offline mounting and keyboard-poll readiness are now available.
Future work includes paddle/mouse capture, LIRON disk loading, remote disk
URLs, and compatible peripheral provisioning/deprovisioning. Phase 3 will add script
import/export, persistence, reusable example macros and more elaborate
automation/regression helpers.

## Validation

```sh
node --check res/EMU_pasteboard_script.js
node --test tests/pasteboard_script.test.cjs tests/pasteboard_prodos_automation.test.cjs tests/pasteboard_speed_uri.test.cjs
```

The accompanying GitHub workflow runs these checks when scripting files change.
