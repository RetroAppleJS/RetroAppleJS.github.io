# Pasteboard Script — Phase 1

The **Script** button replaces the old **Clear** button in the Emulator > Tools
pasteboard. It opens a JavaScript macro editor and console in a companion window
matching the STEP TRACE SCENARIO shell and width (460 px). The popup is scoped
to the Emulator Tools tab, retaining its previous open/closed state while
navigating tabs. Closing the editor **does not stop a running script**.

Scripts execute in a dedicated Web Worker; the Worker talks to the existing
Apple II runtime through a small, named command bridge. There is no second
6502 CPU scheduler, no synthetic host-keyboard events, and no duplicate disk
or peripheral model.

The editor is a **document-absolutely positioned companion**, not a fixed
window or an overlay tied to the Apple II screen. Macros can temporarily hide
it to let users watch the screen and show it again without interrupting
execution.

## Getting started

1. Select **Emulator > Tools > Script**.
2. Edit the example JavaScript. Use **RUN** or **Ctrl/Cmd+Enter**.
3. Watch the console for output, errors, and completion.
4. Use **STOP** to terminate a running script, even if its JavaScript loop
   does not yield. Closing the popup does not terminate it.
5. Use `await apple.script.hide()` and `await apple.script.show()` to control
   the popup during a running demonstration. The same **Script** toolbar
   button can always reopen it while the macro runs. Hiding does not cancel
   the Worker or pause the Apple II.
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
| `apple.script.running()` | Whether this Worker script is active |
| `await apple.script.hide()` | Hide the Script IDE/console without stopping the macro or guest CPU |
| `await apple.script.show()` | Redisplay the Script IDE/console at its absolute companion position |
| `apple.script.stop()` | Request self-termination of the Worker script |
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
  // This runs on normal completion or script errors, but not after STOP
  // forcibly terminates the Worker. The Script toolbar button is always
  // available to restore the window manually.
  await apple.script.show();
}
```

`hide()` and `show()` affect only the Script popup; they do not change
the main pasteboard textarea, emulator run state, or script execution. The
popup remains document-absolutely positioned using the STEP TRACE SCENARIO
companion layout, and restoring it does not focus the editor or inject keys.

## Safety, timing, and cancellation

- A Worker runs **trusted user-authored JavaScript**; it is an isolation
  mechanism for UI responsiveness, **not a security sandbox**. Do not paste
  unknown or untrusted scripts.
- Worker CPU-bound loops do not block the main-thread emulator UI; STOP
  terminates the Worker. Operations that were already applied to the emulator
  (such as a reset or text sent to a device) are **not rolled back**.
- After STOP, old Worker messages and deferred calls cannot be applied to a
  subsequent run; each run has a generation token.
- The macro runner uses wall-clock `setTimeout` and does not manipulate
  emulator CPU tick scheduling or STEP TRACE breakpoint ownership.
- Text and memory use the existing host device and safe mapped-memory
  interfaces, rather than directly inspecting an emulated device's internals.

## Planned API extensions

Phase 2 will add paddle/mouse capture, DISKII and LIRON disk loading, and
compatible peripheral provisioning/deprovisioning. Phase 3 will add script
import/export, persistence, reusable example macros and more elaborate
automation/regression helpers.

## Validation

```sh
node --check res/EMU_pasteboard_script.js
node --check res/EMU_pasteboard_script_worker.js
node --test tests/pasteboard_script.test.cjs
```

The accompanying GitHub workflow runs these checks when scripting files change.
