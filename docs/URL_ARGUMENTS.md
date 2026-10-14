# URL arguments

Reference for URL query-string arguments used by RetroAppleJS. This document distinguishes the main emulator (`index.html`) from standalone tools; source code is authoritative if behavior changes.

## Main emulator: `index.html`

| URL key | Argument(s) | Description / effect | Example |
| --- | --- | --- | --- |
| `sys` | System identifier (must correspond to a configured system) | Deactivates the currently configured systems, activates the specified system and changes the default system of the tabs. An unknown identifier is not validated here. | `index.html?sys=<configured-system-id>` |
| `disp` | Display mode identifier (string) | Stores the requested video mode in `EMU_vid_mode`. The implementation marks display-mode selection as TODO; do **not** assume all identifiers are honored by the renderer. | `index.html?disp=canvas` (illustrative; verify renderer support) |
| `addr` | Target memory address (string interpreted later with `Number()`) | Defines the target address used by `paste`. This does **not** by itself write memory. | `index.html?addr=2048&paste=<compressed-base64>` |
| `paste` | Deflate-compressed, Base64-encoded bytes | With `addr`, decompresses bytes and formats a `CALL-151` monitor listing in the emulator board text area. It does **not** directly inject bytes into RAM. `addr` must precede `paste` because arguments are processed in URL order. | `index.html?addr=2048&paste=<compressed-base64>` |
| `mute` | `0` or `false` for false; other supplied values for true | Sets `oEMU.system.mute` and follows the shared mute/boot initialization path. Browser audio-start restrictions still apply. | `index.html?mute=0` |
| `boot` | `0` or `false` for false; other supplied values for true | Sets `oEMU.system.boot` and enters the common boot/mute initialization path. When `D1_DIR` loads asynchronously, the handler checks the **raw argument string** rather than the parsed Boolean, so even `boot=false` can trigger a restart; avoid supplying `boot` unless booting is intended. | `index.html?D1_DIR=Apple%20DOS%203.3.dsk&boot=true` |
| `CAT` | `true` (case-insensitive); anything else becomes false | Controls whether the disk software catalog is displayed on startup, when a Disk II controller is present. Note the key is uppercase. | `index.html?CAT=true` |
| `D1` | Deflate-compressed, Base64-encoded disk image | Decompresses and stages a drive-1 disk image for the configured Disk II slot; triggers the restart-button flash state. This is not a file path. | `index.html?D1=<compressed-base64-disk-image>` |
| `D1_DIR` | Disk image filename / relative path in the repository's `disks/` directory | Fetches the disk image from `https://raw.githubusercontent.com/RetroAppleJS/RetroAppleJS.github.io/main/disks/`, stages it for drive 1, and may restart the emulator if `boot` is present and truthy as a string. Filename must match the repository path. | `index.html?D1_DIR=Apple%20DOS%203.3.dsk` |
| `slots` | Comma-separated `slot:PCODE` assignments, or `slot:NONE`; physical slot numbers `0`–`7` | Pre-mounts the named peripheral in each slot, **overriding that slot's `COM_CONFIG.js` default**. Unmentioned slots keep their defaults, except when a default card is moved to a new slot. Incompatible, unavailable and malformed assignments produce console warnings. | `index.html?slots=2:SPC,4:MOCK,5:LIRON,6:DISKII` |

**Complete, useful combinations**

| Goal | URL example | Notes |
| --- | --- | --- |
| Load DOS 3.3 into drive 1 without explicitly asking for auto-boot | [`index.html?D1_DIR=Apple%20DOS%203.3.dsk`](https://retroapplejs.github.io/index.html?D1_DIR=Apple%20DOS%203.3.dsk) | Existing example in `docs/BOOT.md` uses `mute=0` too. |
| Load DOS 3.3 and request boot | [`index.html?D1_DIR=Apple%20DOS%203.3.dsk&boot=true`](https://retroapplejs.github.io/index.html?D1_DIR=Apple%20DOS%203.3.dsk&boot=true) | Also linked from the project README. |
| Load DOS 3.3 and set mute off | [`index.html?D1_DIR=Apple%20DOS%203.3.dsk&mute=0`](https://retroapplejs.github.io/index.html?D1_DIR=Apple%20DOS%203.3.dsk&mute=0) | Audio might still require interaction due to browser restrictions. |
| Show the disk catalog | [`index.html?CAT=true`](https://retroapplejs.github.io/index.html?CAT=true) | Only useful if the expected Disk II peripheral is configured. |
| Pre-mount serial card in slot 2 and Mockingboard in slot 4 | [`index.html?slots=2:SPC,4:MOCK`](https://retroapplejs.github.io/index.html?slots=2:SPC,4:MOCK) | `SPC` is the Serial Pro PCODE; slot 6 keeps the default Disk II card. |
| Replace default Disk II in slot 6 with Mockingboard | [`index.html?slots=6:MOCK`](https://retroapplejs.github.io/index.html?slots=6:MOCK) | **URL takes precedence** over the `DISKII` default defined in `COM_CONFIG.js`. |
| Move the default Disk II controller from slot 6 to slot 5 | [`index.html?slots=5:DISKII`](https://retroapplejs.github.io/index.html?slots=5:DISKII) | The default slot 6 installation is removed, rather than duplicated. |
| Replace the default 16K language card with Saturn RAM | [`index.html?slots=0:SATURN`](https://retroapplejs.github.io/index.html?slots=0:SATURN) | Apple II physical slot 0 replaces the `MS16K` default; the motherboard remains mounted. |
| Leave slot 6 empty | [`index.html?slots=6:NONE`](https://retroapplejs.github.io/index.html?slots=6:NONE) | Removes the default Disk II card without mounting another card there. |
| Configure slots and boot DOS 3.3 | [`index.html?slots=2:SPC,4:MOCK,6:DISKII&D1_DIR=Apple%20DOS%203.3.dsk&boot=true`](https://retroapplejs.github.io/index.html?slots=2:SPC,4:MOCK,6:DISKII&D1_DIR=Apple%20DOS%203.3.dsk&boot=true) | URL slot placement is resolved before the first boot, so drive 1 uses the configured controller. |

## Pre-mounted peripherals: `slots`

The URL **overrides pre-filled slots from `res/COM_CONFIG.js`**, including the default `MS16K` language card in slot 0 and `DISKII` controller in slot 6. The default layout stays unchanged when `slots` is absent.

Use the **PCODE** (not the card's display name). PCODEs and slot compatibility are defined by `_CFG_PSLOT` in `res/COM_CONFIG.js`; only cards actually registered by the current build can be selected.

| PCODE | Peripheral |
| --- | --- |
| `MS16K` | Microsoft 16K language card |
| `SATURN` | Saturn RAM |
| `LEGEND` | Legend RAM |
| `RAMFAC` | Ramfactor RAM card |
| `TCLKP` | Thunderclock Plus |
| `AMOUSE` | AppleMouse II interface |
| `LIRON` | Apple 3.5-inch disk controller |
| `DISKII` | Apple Disk II controller |
| `VIDEX` | Videx VideoTerm (configured for physical slot 3) |
| `MOCK` | Mockingboard |
| `SSC` | Super Serial Card, if available in the build |
| `SPC` | Serial Pro card |
| `DITHER`, `DITHER2` | Dithertizer cards |
| `NONE` | Special keyword: explicitly leave the slot empty (not a PCODE) |

Rules:

- Syntax: `slots=<slot>:<PCODE>[,<slot>:<PCODE>...]`. Example: `slots=2:SPC,4:MOCK`. The key is **lowercase**; card codes and `NONE` are **case-insensitive**.
- Slot numbers refer to **physical slots** 0–7; the internal `Apple2IO.slots[]` indices are one higher. Slot 0 can host a RAM expansion card, but the motherboard is not replaceable via this argument.
- A valid assignment replaces anything pre-filled in that slot from `COM_CONFIG.js`. An unmentioned slot retains its normal default unless its original default card is explicitly assigned elsewhere. For example, `slots=5:DISKII` moves the Disk II default from slot 6 to slot 5.
- Multiple assignments allow simultaneous peripherals; the same PCODE may be requested in more than one compatible slot. If a slot is repeated, the first **valid** assignment wins, with a console warning for later duplicates.
- `NONE` removes a pre-filled default; it does not require a peripheral to be installed.
- Invalid syntax, unknown PCODEs, unregistered card types, locked cards, slots unavailable on the selected system, disallowed slot placements, and cards whose `_CFG_PSLOT.SYScode` excludes the selected system are rejected **before any configured default is displaced**. The initial boot collects the warnings in one popup with an **Acknowledge** button; each warning is also logged to the browser console.
- URL-selected cards use the normal peripheral discovery, `mount()`, address mapping and device setup, and persist through ordinary emulator restarts. The URL must be reloaded to change its initial slot plan.
- For a disk-image URL such as `D1_DIR`, keep a `DISKII` card mounted in a compatible slot so there is a drive-1 target.

## Standalone tools

These keys are handled by individual tools, not by the main emulator's URL switch.

| Page / URL key | Argument(s) | Description / effect | Example |
| --- | --- | --- | --- |
| Assembler integration / `asm` | Deflate-compressed Base64 UTF-8 assembler source | `ASM_init()` decompresses the source and populates the assembler source editor. | `index.html?asm=<compressed-base64-source>` (where the assembler GUI is initialized) |
| `tools/SIDchipJS.html` / `sid` | Encoded SID content | Loads SID data in the standalone SID tool. | `tools/SIDchipJS.html?sid=<encoded-sid>` |
| `tools/SIDchipJS_v2.html` / `sid` | Encoded SID content | Same URL-key convention as the earlier SID tool. | `tools/SIDchipJS_v2.html?sid=<encoded-sid>` |
| `tools/MockingboardJS.html` / `fym`, `fym2` | Encoded sound streams | Loads one or two streams in the standalone Mockingboard experiment. | `tools/MockingboardJS.html?fym=<stream1>&fym2=<stream2>` |
| `tools/MockingboardJS_v0.html` / `fym` | Encoded stream | Loads a stream in the older Mockingboard experiment. | `tools/MockingboardJS_v0.html?fym=<stream>` |
| `tools/MochaJS_test.html` / `grep` | Mocha test-name filter | Presence of `grep` automatically starts the tests, in addition to its usual Mocha query-string filtering. | `tools/MochaJS_test.html?grep=CPU` |

The placeholders between angle brackets above represent data that must be generated; they are **not** working example payloads.

## Syntax, precedence and limitations

- Multiple arguments use `?` for the first argument and `&` for subsequent arguments. Parameter names are **case-sensitive** (`CAT`, `D1`, and `D1_DIR` are uppercase; `boot` and `mute` are lowercase).
- The main parser (`oCOM.URL.parse` in `res/COM_MAIN.js`) performs simple splits at `?`, `&`, and `=`. It does **not** call `decodeURIComponent` or `URLSearchParams`. A value such as `Apple%20DOS%203.3.dsk` therefore remains percent-encoded when passed to the disk URL builder; HTTP handling may interpret that encoding downstream. Keep reserved separators out of values.
- The parser retains only the first substring following `=` and overwrites duplicate keys with the last occurrence. Avoid literal `=` padding in payloads unless the encoding and consumer behavior have been verified.
- The implementation enumerates parsed arguments in the order inserted; in particular, put `addr` **before** `paste`.
- `D1` and `D1_DIR` both populate the same staged drive-1 buffer. Do not combine them: the result depends on processing and asynchronous completion order.
- `boot` and `mute` have a shared initialization branch that also attempts to stage a built-in DOS image. Avoid combining multiple disk-source options until startup precedence is explicitly defined.
- `disp` is an incomplete implementation, not a guarantee that the requested backend will become active.
- `slots` applies once while constructing the initial slot plan, before the first emulator boot. It takes precedence over pre-mounted `COM_CONFIG.js` assignments; it does not modify `COM_CONFIG.js` on disk.
- Avoid putting large data payloads or sensitive information in URLs: URLs can be recorded in browser history and server logs and may exceed browser/proxy length limits.

## Implementation locations

- `res/COM_MAIN.js` — `oCOM.URL.parse` parser, `getURI`, `addURI`.
- `res/EMU_apple2main.js` — `EMU_init()` URL dispatch, disk loading, startup and restart behavior.
- `res/EMU_apple2io.js` — `EMU_applyURLSlotOverrides()` and initial `Apple2IO` slot planning and mounts.
- `res/ASM_6502_gui.js` — `ASM_init()` loading the `asm` argument.
- `tools/SIDchipJS.html`, `tools/SIDchipJS_v2.html`, `tools/MockingboardJS.html`, `tools/MockingboardJS_v0.html`, `tools/MochaJS_test.html` — tool-specific keys.
- `README.md` and `docs/BOOT.md` — existing boot-link examples.

Update this reference when an argument is added or its behavior changes. Prefer the exact code paths over assumptions about what a key name implies.
