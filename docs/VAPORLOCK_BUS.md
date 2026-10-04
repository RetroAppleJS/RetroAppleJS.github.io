# Apple II/II+ scanner and floating bus

This patch prepares the live JavaScript emulator for Vaporlock. `Apple2Hw`
owns bus timing and the motherboard video-mode latches. Video renderers
continue to display memory asynchronously. No renderer or include changes
are required, and the WASM accelerator is outside this patch's scope.

The subsequent [vertical blank render lock](VBL_RENDER_LOCK.md) patch adds
optional beam capture and MUX presentation for transient display effects.

## Clock and raster convention

An NTSC field contains 262 lines of 65 machine cycles: 17,030 cycles.
The scanner epoch starts at horizontal blanking on line zero. For video
clock `V`, the field phase is `floor(V) mod 17030`, the line is
`floor(phase / 65)`, and the horizontal cycle is `phase mod 65`.

| Horizontal cycle | Meaning |
| --- | --- |
| 0–24 | Horizontal blanking; scanner still fetches RAM |
| 25–64 | Visible byte columns 0–39 |

Lines 0–191 are visible; 192–261 are vertical blanking. The H counter
starts in state `$18`, with the blanking origin offset by 40 clocks and
one repeated counter state at its preset. The V counter starts at `$100`
and presets to `$FA` on line 256. The address adder and counter wiring
select memory throughout blanking; addresses are never clamped to the
visible screen. In text/lores mode, II/II+ additionally selects A12 during
horizontal blanking. Mixed hires switches to text using the V4/V2 gate,
including its behavior outside the displayed lines.

At the field origin, text page 1 fetches `$1468` for two adjacent cycles;
visible column zero on line zero is `$0400` at cycle 25. These are different
from a convention that places the first visible column at horizontal
cycle zero. Diagnostic code must use the convention above.

`getCpuTicks()` counts completed live CPU ticks. `getVideoTicks()` is a
separate counter. At normal speed their increments are 1:1. The existing
JavaScript SYSTEM speed selection determines the video/CPU ratio;
fractions are retained between ticks, using a fixed-scale epoch to avoid
repeated-addition rounding drift. Debugger instruction stepping uses
1:1 advancement. Pausing or a pre-fetch CPU trap advances neither clock.
Warm reset preserves scanner phase and CPU elapsed time; power restart
starts a new scanner epoch and clears both hardware counters. The existing
I/O peripheral clock retains its independent lifecycle.

## Bus interface

```js
hw.read(cpuAddress, cycleOffset);          // byte, using current RD mapping
hw.write(cpuAddress, byte, cycleOffset);   // using current WR mapping
```

Offsets are zero-based CPU cycles measured from the opcode tick. The
floating-bus fetch uses `videoTicks + cycleOffset * videoClockScale`.
An absolute `LDA`, `CMP`, `BIT` or `EOR` data read uses offset 3. A normal
`(zp),Y` data read uses offset 4, or 5 when it crosses a page. Indexed dummy
reads are performed through the active map, and NMOS read-modify-write
instructions perform the original-byte write before the modified write.
JSR fetches its high operand on offset 5, after its stack writes.
This is a hybrid timestamped CPU: semantic operations still occur together,
then the scheduler drains the remaining ticks. It does not implement every
6502 pin transition or every internal/dummy cycle.

The existing `RD[]` and `WR[]` callback arrays remain available. Standard
callbacks retain their byte interface, and accept optional extra offsets
without needing to use them. The default `$C000–$CFFF` RD mapping resolves
floating results even when called directly. `safe_read()` and `safe_dump()`
resolve the same current mappings with read-only mode raised.

I/O callbacks can return:

| Read result | Driven bits |
| --- | --- |
| A number from 0 to 255 | All eight bits; `$00` remains a real driven byte |
| `ctx.io.FLOATING_BUS` / `Apple2Hw.FLOATING_BUS` | None; the reserved sentinel is `-1` |
| `{value: byte, mask: byte}` | Only the bits set in `mask` |

The result is `(value & mask) | (videoByte & ~mask)`. The video byte is
read directly from physical motherboard RAM, never through CPU mappings.
The video fetch is sampled before dispatching the CPU I/O access, so a
mode-changing read returns the preceding fetch and affects subsequent
fetches. Empty I/O and absent slot ROMs float. Ordinary existing card
callbacks continue to drive the byte they return; they are not silently
reclassified on the basis of returning zero or `undefined`.

Attached-device read descriptors can declare `driveMask`, for example:

```js
"0x60": {"handler":"read", "readOnly":true, "driveMask":0x80}
```

The game port drives D7 and leaves D0–D6 floating. A3 is ignored, so
`$C068–$C06F` mirrors `$C060–$C067`. Paddle deadlines are sampled at the
CPU access timestamp. The unconnected cassette input currently drives a
low D7; this patch does not implement a cassette device. Keyboard data
remains a full byte; keyboard strobe, speaker, paddle-trigger, display,
and annunciator strobes float while retaining their normal side effects.
`$C019` is not an Apple II/II+ VBL status register and remains floating.

Peripherals receive `ctx.hw`, `ctx.cycleOffset`, and `ctx.cpuTick` (the
effective CPU timestamp). A time-sensitive peripheral may adopt those
fields without changing the dispatcher. Existing peripheral timers are
not rewritten in this patch.

## Observation for the later STEP TRACE SCENARIO

```js
var hw = apple2plus.hwObj();
hw.getVideoPosition();     // phase, line, hcycle, blanking flags, column/x/y
hw.getScannerState();      // position plus six-bit H and nine-bit V state
hw.getScannerAddress();    // physical video RAM address
hw.peekFloatingBus();      // current video RAM byte, no I/O access
hw.getVideoMode();         // copy of hardware video-mode latches

hw.setBusMonitoring(true); // off by default; starts a new capture
hw.getLastBusAccess();     // copy of the last timestamped access, or null
hw.setBusMonitoring(false);
```

The position/scanner/floating-bus methods accept an optional CPU-cycle
offset. They do not move the clocks or trigger I/O. `getLastBusAccess()`
reports CPU start/effective ticks, effective video tick, offset, CPU address,
R/W, line, horizontal cycle, field phase, H/V states, scanner address,
video byte, driven mask, whether any bits are driven, and the resolved
result. Read-only peeks/dumps do not change this record. Records are
allocated only while monitoring is enabled. At an instruction's semantic
tick, an access record can have an effective timestamp ahead of the
completed-tick counter; the following delay ticks catch up normally.

This patch supplies the observation API and Node regression checks only.
The STEP TRACE SCENARIO and an end-to-end Vaporshow pass/fail run belong to
the next step. Do not infer complete Vaporlock compatibility from these
foundation checks alone. PAL timing, //e auxiliary-memory behavior, and
cycle-specific DMA/IRQ scheduling are not implemented here.

## Verification

Run the focused checks with:

```sh
node --test tests/apple2_vaporlock_bus.test.js
```

They use the real CPU, hardware bus, I/O dispatcher, motherboard, keyboard,
speaker, and game-port code with the host drawing boundary omitted. Fixtures
cover horizontal/vertical presets, blanking, pages, hires/mixed, physical
RAM, driven and masked reads, observation, effective absolute/indirect/
indexed/RMW accesses, and shared live/SYSTEM clock behavior.

The existing repository test suite is supplied in `tests.zip`. It was
extracted for verification and compared against an unmodified checkout;
pre-existing failures are recorded in `VAPORLOCK_PATCH_VERIFICATION.md`.
The archive itself is not changed.

Hardware-reference cross-checks:
[AppleWin scanner implementation](https://github.com/AppleWin/AppleWin/blob/master/source/Video.cpp),
which identifies the counter and address-adder equations in *Understanding
the Apple IIe*, and the test author's
[Vaporshow explanation](https://www.applefritter.com/content/one-liner-vaporshow).
The scanner code here expresses those hardware equations independently;
no AppleWin code is incorporated.
