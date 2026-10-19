# SID Phase 2C.2 — Native interrupt-driven PSID music

Phase 2C.2 integrates the **native Phase 2B.2 PSID interpreter** with the
validated **Phase 2C.1 SID-card timer and IRQ**. All PSID parsing, INIT,
PLAY and interrupt state-switching are **6502 assembly**. Neither the browser
PSID transfer tool nor JavaScript synthesizer implements an alternate player.

## Assembly-first workflow

1. Start a **new disposable Apple II+ session** with the SID peripheral in
   **slot 4** (PCODE SID, SIDAUDIO attached), CPU load 100%, and the sound
   enabled. This first implementation is restricted to slot 4.
2. Open the RetroAppleJS Assembler. Load
   `asm/AUDIO/SID_PHASE2C2_BACKGROUND_PLAYER.S`, select the RetroAppleJS
   dialect, click **Assemble**, then **Tools → to emulator → Paste**.
   The single assembly file contains separate `ORG` segments at **$1000**,
   **$1C00**, and **$9000**. There is **no Node or external binary loading**
   requirement. CI offers equivalent binaries and Monitor-format byte-code.
3. Select the original raw `.sid` in **Peripheral controls → SID → PSID**.
   Transfer the file to a non-overlapping staging address such as **$6000**.
   The host only stores raw bytes plus the file start/length transfer record.
4. At the Applesoft prompt, execute:
   ```basic
   CALL 7168
   ```
   Press Return for the transferred address; select the subtune on the
   Apple II. The native 6502 parses PSID v1/v2, validates checksum and
   memory ranges, executes its original INIT, installs the music IRQ service,
   and **returns to Applesoft while music continues**.
5. Run a short foreground BASIC counter or another **compatible** program.
   Display FPS (10, 30, 60, VBLANK) must not affect the music's CPU-clock
   IRQ intervals.
6. To stop playback, interrupt the foreground BASIC program (Ctrl+C), then
   call the resident service directly:
   ```basic
   CALL 36867
   ```
   This is **$9003**. The original `$1C03` STOP stub may be overwritten by
   the C64 executable, so do not rely on that lower stub. STOP disables
   and acknowledges the timer, restores the previous IRQ vector and
   original I-bit, silences SID, and restores the public $1C00 jump table.

### Restart the same song after STOP

After `CALL 36867`, use **`CALL 7168` again**. The resident code now
remembers the original INIT address and selected subtune, so it **restarts
the same subtune from the beginning**, reinitializes music zero page,
and installs the timer IRQ again. It does not resume at the exact
musical position where STOP occurred (that would require PAUSE/RESUME).
The 12 original music bytes at $1C00–$1C0B are preserved before STOP
restores the public entry stub, then restored before the next INIT.

The temporary parser ($1000+) and `SIDF` transfer record ($9430) are
not used for this same-song replay. They may have been overwritten by
the music. Restart works only if the original executable remains intact
and compatible foreground software has not overwritten its RAM.

To **select a different PSID file or subtune**, stop playback, reload the
native assembly program if the temporary parser was overwritten, transfer
the new raw PSID file, and invoke the forced interactive entry at
`CALL 36870` (resident $9006). The browser remains a raw-file transfer
tool; it never parses the PSID.

`$9400` remains the music zero-page shadow after INIT; it also consumes
the previous native descriptor and host transfer record.

## Memory map

| Region | Purpose |
|---|---|
| $1000–$1BFF | Transient 6502 interactive PSID parser (may be overwritten after INIT) |
| $1C00–$1C0B | Public CALL 7168 jump table |
| $2000–$8FFF | Raw PSID staging window (28 KiB including header) |
| $9000–$93FF | DOS-safe native playback code, IRQ handler, lifecycle and state |
| $9400–$94FF | Persistent **C64 music zero-page shadow** after INIT |
| $9500–$95FF | Temporary **foreground zero-page backup**, refreshed on each IRQ |
| $9600+ | Reserved ProntoDOS area, untouched by native code |

The initial native PSID descriptor and eight-byte transfer record are also
at $9400/$9430 but only live before INIT. Restarting the **same** subtune
uses resident saved metadata instead of re-parsing these records. Loading
a **new** file or subtune requires a fresh upload and a restored parser.

### IRQ sequence

Each maskable IRQ enters via the genuine Apple II Monitor soft vector
($03FE–$03FF), then:

1. Save X/Y, inspect the SID timer pending bit and acknowledge **only the
   SID timer**. Chain unrelated IRQs to the previous vector.
2. Save the original interrupted A value from the Monitor's $45 register
   into resident RAM.
3. Copy all 256 foreground ZP bytes to $9500, restore 256 music ZP bytes
   from $9400 into the real 6502 ZP.
4. `JSR` the original, **unmodified** C64 PLAY routine at its PSID address.
5. Save the updated music ZP into $9400, restore foreground ZP from $9500,
   restore X/Y/A, then `RTI`.

This costs significant CPU time (four 256-byte copies per IRQ); benchmark
late IRQs and foreground throughput before treating Phase 2C.2 as final.
The timer's internal deadlines remain CPU-cycle based; no display,
JavaScript polling, or WebAudio callback initiates PLAY.

## Explicit compatibility and isolation limitations

**This is controlled coexistence, not C64 memory virtualization.** An
original C64 music executable runs at its declared absolute RAM address
and can access other memory and peripheral registers. If those locations
overlap a foreground Apple II program, its variables, stack assumptions or
DOS, there can be corruption. Therefore:

- Use a disposable system and short compatible BASIC programs. Verify
  the tune's executable range and other RAM requirements first. The
  **$0CA0–$1F0A** Mr. Heli executable, for example, can conflict with
  sufficiently large Applesoft program/data allocations.
- Music must keep balanced 6502 stack calls and not deliberately overwrite
  the IRQ/vector/workspace or change SP unpredictably.
- The standard Apple II Monitor IRQ entry **writes to zero page $45 before
  our soft-vector handler gains control**. This is an intrinsic transparency
  limitation: even if our ZP switching is correct, $45 can change in the
  foreground. Do not describe this as safely isolated for arbitrary
  Apple II software, including arbitrary DOS routines.
- This first version requires SID **slot 4**. It uses the Phase 2C.1
  SlotIO timer write protocol at $C0C8–$C0CB and pending status at
  $C0C2/$C0C3, without changing original SID audio register access.
- Programs that keep IRQ masked with `SEI` will delay background music.
- Original PLAY code that uses CIA timers, IRQ vectors, $6510 banking or
  unsupported C64 ROM/hardware remains outside the accepted PSID subset.

## Validation

`tests/sid_phase2c2.test.js` runs the **actual RetroAppleJS 6502**
with the real Apple II ROM IRQ dispatcher, the existing SID-card timer,
Mr. Heli PSID v1/v2 containers and an independent foreground RAM counter.
It verifies native assembly boundaries, selected subtune INIT, IRQ-driven
PLAY, original SID register writes, 50/60 Hz timer configuration,
foreground continuation and STOP cleanup. The separate Phase 2A/2B/2C.1
tests remain in the same dedicated CI suite.

Audible browser acceptance and compatibility checks with particular DOS
programs remain necessary before expanding beyond this experimental phase.
