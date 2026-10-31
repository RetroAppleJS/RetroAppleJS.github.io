# PT3-02A – ASM_core.js version

`PT3_02A_ASM_CORE.S` contains the **complete, flattened, readable 6502 source**. There are no external `.include` dependencies and no embedded opaque machine-code dump.

## Assemble and run

1. In RetroAppleJS AssemblerJS, select `raJS` syntax (or the multi-dialect default) and load `PT3_02A_ASM_CORE.S`.
2. Assemble starting at `ORG $6000`, producing the $6000-origin native player image (3341 bytes). Do **not** use the old 3200-byte version.
3. Separately load `PT3_02A_ASM_CORE_TEST.pt3` (862 bytes) into emulated memory at **$8000**. The PT3 is musical data, not 6502 instructions.
4. With a Mockingboard in **physical slot 4**, start execution at **$6000**. The 6502 foreground enters HGR1 and animates a marker while VIA Timer 1 IRQs play music.
5. Stop entry `$6003` is intended for a debugger PC redirect after pausing the CPU (not a callable subroutine). 

The extra `.bin` is only for independent byte-for-byte verification. GitHub Actions run 41189319600 assembled the `.S` using the repository's **actual** `ASM_core.js` and verified **identical output** with the pinned ca65 build, then passed a six-second native 6502/VIA/AY and foreground concurrency test. Full browser-emulator listening still needs independent confirmation.

Source credits: RetroAppleJS wrapper; Vince Weaver pt3_lib licensed 0BSD or GPL-2.0-only, pinned to commit cb0546ede762646196169f1517735cedca72ddfe.
