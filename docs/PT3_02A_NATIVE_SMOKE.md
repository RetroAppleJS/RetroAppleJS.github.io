# PT3-02A — Native 6502 Mockingboard IRQ smoke test

**Implementation:** [PR #273](https://github.com/RetroAppleJS/RetroAppleJS.github.io/pull/273)  
**Parent design:** [PT3-02](PT3_02_NATIVE_MOCKINGBOARD_VALIDATION.md)  
**Verified run:** [GitHub Actions 41185447549](https://github.com/RetroAppleJS/RetroAppleJS.github.io/actions/runs/41185447549)

## Implementation

The test assembles Vince Weaver's native ca65 PT3 library (revision cb0546ede762646196169f1517735cedca72ddfe, 0BSD/GPL-2.0-only) with a new small Apple II+/IIe wrapper. Source is fetched and verified at build time, without copying the decoder into RetroAppleJS.

The test synthesizes an **original three-voice MIDI fixture**, uses Spectrumizer to encode a standard PT3, and executes the actual 6502 binary through the existing RetroAppleJS **Cpu6502**, **MockingboardR6522**, and **MockingboardAYBus** code. The bus is supplied by a deterministic, standalone CPU harness (not a full Apple II browser boot); **no JavaScript PT3 interpreter or direct AY-register injection** is used. VIA0 Timer1 drives interrupts and the native code writes AY registers through VIA ports while foreground code writes to HGR $2000.

The test runner includes a minimal Apple II+/IIe Monitor IRQ dispatcher at $FF00 that stores the interrupted A in $45 and jumps through $03FE. It does not model the full Monitor ROM, actual video rasterization, Web Audio, DOS or the complete peripheral slot manager. Those are subsequent integration checks.

## Reproduce

Install Node 22+, Python 3.10+, ca65/ld65, git, and Spectrumizer. In the repository root:

~~~sh
python3 -m pip install spectrumizer
bash tools/PT3_02A_build.sh
node tools/PT3_02A_native_run.cjs
~~~

The build writes a 6502 binary, PT3 song, original MIDI, assembler listing, linker map, binary checksums, and a Monitor paste listing. The runner writes the test report as JSON and fails on any violated assertion.

## Binary layout

| Address | Usage |
| --- | --- |
| $0060-$007F | PT3 library zero-page data |
| $03FE-$03FF | Saved/restored Monitor IRQ vector |
| $2000 | HGR page 1 foreground work |
| $6000 | Start native PT3 and enter foreground loop |
| $6003 | Stop music and restore IRQ vector; then halt loop |
| $6006 | Foreground counter/HGR loop |
| $7000 | Foreground progress counter |
| $7004-$7005 | Previous soft IRQ vector |
| $7006 | Stop marker = $A5 |
| $8000 | PT3 module, page-aligned |
| $C400-$C40F | Physical slot 4, VIA0 / Timer1 |
| $C480-$C48F | Physical slot 4, VIA1 |

The native player is constrained to $6000-$6FFF and test songs to $8000-$8FFF. Both regions are checked by the build.

## Native test result — PASS

The CI run [41185447549](https://github.com/RetroAppleJS/RetroAppleJS.github.io/actions/runs/41185447549) executed 3,065,400 emulated cycles at 1,021,800 cycles/second, including player initialization.

| Test | Observed |
| --- | ---: |
| Resident 6502 program | 3,200 bytes |
| Generated PT3 file | 729 bytes |
| 6522 Timer1 latch | $4FE7 (20,455) |
| Measured timer reload interval | 20,457 cycles |
| Timer IRQ activations | 148 |
| AY0 writes | 1,938 |
| AY1 writes | 1,938 |
| Mirrored AY data | Exact match |
| Nonzero AY amplitude writes | 432 |
| AY mixer tone-enable writes | 149 |
| Foreground counter and HGR changes | Both observed |
| IRQ restoration and post-stop silence | PASS |

The count is 148 rather than 150 because 6502 initialization precedes the start of periodic IRQs.

## Manual emulator use

The CI artifact includes **PT3_02A_MONITOR.txt**, a Monitor paste listing that loads the resident player at $6000 and song at $8000, then executes $6000. For manual use, boot an Apple II+/IIe in RetroAppleJS with a Mockingboard installed in physical **slot 4**, and paste the listing using the emulator's monitor paste feature. Use a clean machine with no competing resident IRQ.

The player deliberately enters an infinite foreground loop while music plays. To stop, pause the emulator and redirect the CPU PC to $6003 using a debugger. A hardware reset is not a validated stop procedure.

**Caveat:** this manual complete-emulator test is provided but has not been separately executed or listened to in the browser. The PASS above is the deterministic core harness, not browser AudioContext or physical hardware playback.

## Next phase boundary

PT3-02B must verify actual notes and AY periods, source-clock frequency conversion, R13 retriggers and compatibility of PT3 files converted from PSID. PT3-02C will measure IRQ service cycles and HGR throughput, including 10fps versus VBLANK scheduler modes. PT3-02D will cover a larger conversion corpus and player lifetime management.
