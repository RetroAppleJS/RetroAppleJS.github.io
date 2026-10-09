# Port Script Console

Open the Serial Pro terminal pictogram in the peripheral toolbox. The upper pane
is a JavaScript editor; the lower pane is the existing terminal. Drag the divider
to resize the panes, or focus it and use Up/Down. Source and divider position are
remembered per slot. The window itself can also be resized.

Each mounted Serial Pro has its own window, identified by the slot number in
both headers. Two cards keep independent editor and terminal instances.
Source, divider position, terminal history and transcript, receive buffers,
display mode, theme, GPT session/key dialog and physical serial link belong to
that card. Opening, stopping, clearing or closing one slot does not affect another.
Unmounting removes only that slot's window and cancels its pending operations.
Reopening a mounted card keeps its editor and terminal instances; replacing a
card restores the source and history saved for that slot with fresh endpoints.

The window follows its slot's Peripheral controls panel. Selecting another
peripheral, closing Tools or leaving the Emulator tab hides it and stops its
running script. Returning restores that slot's window if it was left open,
with its source and terminal contents intact. A manually closed window stays closed.

Use the **play** button or Ctrl/Cmd-Enter to execute. The same button becomes
**stop** while running and returns to play after stopping, completion or an error.
Use the information
pictogram to read the attached port and console contracts. The PORT SCRIPT
trashcan clears the editor's source code and saves the empty source for that
slot. It leaves the current run and terminal transcript alone. The terminal
trashcan clears the transcript, leaving source code and serial buffers intact.
Closing the window stops execution and preserves its contents.

The window sits 5 pixels to the right of the peripheral controls. Its width is
limited to the blue Emulator panel's right edge with a 5-pixel inset, including
after a browser resize. Script messages and errors appear in the terminal below;
there is no separate script output area.

## GPT8 and GPT16 presets

The GPT8/GPT16 buttons in the PORT SCRIPT header **load source into the editor**.
They do not start, stop or switch a GPT session. Edit the source, then press Run.
Loading a preset replaces the saved editor source for that slot.

The preset calls `await port.startGPT("ascii")` for GPT8, or
`await port.startGPT("utf16le")` for GPT16. These APIs use the existing attached
SPGPT service, preserving its API-key validation dialog, encoding, echo guard,
G16 negotiation and Kermit handling. Credentials stay in the driver's memory
and are never copied into the editor or worker. `await port.gptInfo()` returns
session status; `await port.stopGPT()` ends the script's session.

The example stays running until Stop. Completion, Stop, closing, switching slots
or removing the device cancels its GPT session and pending API requests, clears
the API key, and cancels an unfinished key prompt. The preset flushes only its
own observation buffer so a long session does not accumulate unused bytes.

## Physical USB serial preset

The plug pictogram in the PORT SCRIPT header loads an editable physical serial
bridge script. Loading does not open the browser chooser or change a connection.
Press Run or Ctrl/Cmd-Enter to select an adapter. The script calls
`await port.connectPhysical()` first, while browser user activation is available,
and keeps the existing USB RX/TX bridge and modem monitoring running.

The adapter uses the current ACIA baud rate, data bits, parity and stop bits.
Existing DTR/RTS/BREAK synchronization and configuration-change checks remain in
the driver. `await port.physicalInfo()` reads connection status and
`await port.disconnectPhysical()` closes the script's connection, releasing the
reader and writer locks. Stop, completion, closing or disposal also disconnects.
If Stop occurs during the native chooser or opening, a late selection is ignored
or the late-opened port is closed. The native chooser itself belongs to the
browser and cannot be dismissed by the script.

Keep the connection call before delays or other awaited operations: Web Serial
requires recent user activation for its chooser. If an edited script loses that
activation, rerun it immediately or move connection to the beginning.

## Serial direction and bytes

The script acts as the remote endpoint of SPSERIAL. `port.write()` queues data
**into the Apple II UART**, just like terminal input. `port.read()`, `waitFor()`
and `onReceive()` observe bytes **sent by the Apple II**. They have their own
buffer and do not consume the terminal, GPT or Web Serial streams. UART timing,
configuration and CPU execution still determine when characters are handled.

Strings represent exact 8-bit characters; wider Unicode characters are rejected.
`write()` also accepts a byte, byte array, typed-array bytes or ArrayBuffer. No CR
is added automatically. `read()` returns Uint8Array. Terminal ASCII mode strips
bit 7 for display only; script reads and matches preserve it. For Apple high-bit
text, convert bytes explicitly when displaying or interpreting them.

## Reporting through the console API

`terminal` exposes the lower SPTERM console. `console` is an alias for the same
facade. `terminal.write(text, channel)` appends exact text with channel `tx`, `rx`
or `meta` (default). It adds no newline and sends no serial data. `terminal.clear()`
clears the displayed transcript without flushing the UART or script buffer.
`log(...)` formats its arguments and writes a newline to this terminal's `meta`
channel. Syntax errors, runtime errors, callback errors and timeouts also appear
there. These messages never inject UART bytes.

```javascript
await terminal.write("Starting serial exchange\n", "meta");

const off = port.onReceive(async function(bytes)
{
    const copy = Array.from(bytes, byte => hex(byte)).join(" ");
    await terminal.write("RX: " + copy + "\n", "rx");
});

const outgoing = "HELLO\r";
await terminal.write("TX: HELLO + CR\n", "tx");
await port.write(outgoing);

// Keep the receiver active while the Apple II program responds.
await sleep(10000);
off();
await terminal.write("Exchange finished\n", "meta");
```

The terminal already displays the serial data path. These console calls let the
script add its own labeled copies, protocol interpretation and progress messages.
They never inject those messages back into the peripheral.

## Waiting for a response

```javascript
await port.flush();
await port.write("HELLO\r");
const reply = await port.waitFor(/READY|ERROR/, 5000);
await console.write("Response: " + reply + "\n", "rx");
```

`waitFor()` matches a nonempty string or RegExp in raw byte text, including bytes
already buffered. It resolves with all text through the first match, consumes
those bytes, and leaves trailing bytes for the next read. Default timeout is
3000 ms. Timeout raises `TimeoutError`; Stop/flush/disposal raises `AbortError`.
Only one wait may be pending per facade. A read during that wait is rejected.
`flush()` discards this facade's bytes and cancels its pending wait.

The receive buffer holds 65536 bytes. Overflow clears it and raises `RangeError`
through the pending wait or the next operation. Read regularly or flush before a
new exchange. `onReceive()` observes independent byte copies without consuming
the buffer. Call its returned function to unsubscribe. Completion and Stop also
remove subscriptions; use `await sleep(...)` or a pending wait to keep a receiver
script running.

## Runtime and reuse

Port and console calls cross a worker boundary and return Promises; use `await`
for sequencing, return values and errors. `onReceive()` registration returns its
unsubscribe function immediately. Helpers are `sleep(ms)`, `log(...)` and
`hex(value, width=2)`. `hex(255)` returns `$FF`.

Scripts run in a Web Worker, and regular-expression matching runs in a separate
worker, so Stop can terminate loops and pathological matches. Browser globals
such as `document` and emulator internals are not supplied. This is a local tool
for your scripts, not a security sandbox for untrusted programs.

Other devices can reuse `EMU_PORT_SCRIPT` by supplying a facade and API metadata:

```javascript
new EMU_PORT_SCRIPT({
    container: document.getElementById("myScriptHost"),
    lowerPane: myConsoleElement, // optional
    port: myDevice.getScriptAPI(),
    api: myDevice.API,
    console: myConsole.getScriptAPI(), // optional
    consoleAPI: myConsole.API,
    storageKey: "MyDeviceScript"
});
```

Contracts describe `NAME`, `DESCRIPTION`, `METHODS` and optional `EVENTS`, with a
`signature` and `description` per item. Help renders these as literal text. The
port facade can use `EMU_SCRIPT_PORT({write, subscribe, maxBuffer})` for the same
buffer/wait semantics. Dispose a component when its owning device is replaced or
removed. All JavaScript/CSS includes remain declared in `index.html`.

## Verification

```bash
node --test tests/port_script.test.js tests/port_script_runtime.test.js
```

For browser interactions and visual inspection, with Playwright and Chromium:

```bash
node --test tests/port_script_browser.js
```

Set `PORT_SCRIPT_CHROME` to use an existing Chromium executable. The browser test
captures a preview outside the repository. See `PORT_SCRIPT_VALIDATION.md` for the
implementation's verification record and existing upstream test failures.
