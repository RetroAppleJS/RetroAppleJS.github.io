# Native Mr. Heli PSID on Apple II / Mockingboard — experimental prototype

## Motivation

SREG records changes at 50 frames/sec, with per-frame terminators and two bytes per changed SID register. It grows with **duration**. The 4,841-byte Mr. Heli PSID contains a 4,715-byte executable payload, including repeated musical patterns encoded in the original song driver.

The **native** approach plays the original C64 music sequence code using the Apple II 6502. A 50Hz 6522 VIA timer calls the original C64 player routine, after redirecting its SID I/O writes to RAM. The resident AY translator computes Mockingboard output from that register shadow. This is only an AY approximation to SID.

## Proven by static checks; NOT run-tested

- PSID in this package: 4,841 bytes (0x12E9); payload offset 0x7E after embedded little-endian load address.
- C64 native payload: $0CA0-$1F0A, 4,715 bytes; init $1EF3; play $0E34; subtune 5 (zero-based selector 4).
- The prototype patches 14 exactly identified SID register *store* instructions, replacing only the high absolute-address byte $D4 with $5F.
- Assembled driver: $2000-$252A (1,323 bytes), using standard 6502 syntax. [Size must match built binary; check if modified.]
- Private buffers: $5D00-$5DFF OS zero page, $5E00-$5EFF C64 zero page, $5F00-$5F18 SID register shadow.
- Verified patch sites, original source byte values, and generated branch displacement using a small independent 6502 assembler. These checks do not prove compatibility with ASM_core.js, DOS, IRQ chaining, or a physical Mockingboard.

## Loading in a *throwaway* Apple II emulator snapshot

**WARNING: This changes the IRQ vector and executes copied C64 machine code. It could hang or corrupt memory, and should not be run with unsaved work or real peripherals until tested in RetroAppleJS.**

- Configure Mockingboard in **slot 4**; run Apple II+ in a normal text display mode (never HGR/HGR2 while driver occupies $2000-$5FFF).
- The C64's required memory area $0CA0-$1F0A normally belongs to Applesoft BASIC. Do not keep a BASIC program there. From a clean Applesoft session, consider `NEW` then `HIMEM:3072` to reserve $0C00 and above from BASIC's dynamic allocations (this leaves little BASIC working RAM). In DOS 3.3 or ProDOS, additional reservations/conflicts may apply.
- Place the exact original **PSID file bytes**, not SREG bytes, at `$6000`. The attached monitor text generates those 4,841 bytes. Alternatively use a binary loader configured to store the raw .sid file unchanged at $6000.
- Place `SID2MB_native_MrHeli.bin` at `$2000` or assemble `SID2MB_native_MrHeli.asm` with ASM_core.js and load at $2000.
- At the Applesoft prompt, issue `CALL 8192` to install/start; `CALL 8195` to stop and restore the previous IRQ vector; `CALL 8198` to reset the tune while playing.
- The error byte is `$24B4` (source label `ERRORCD`); 1 = invalid input header, 2 = expected C64 store byte missing.

## Why this cannot play *any* PSID yet

- Many tunes load at different addresses, so native relocation must respect absolute addresses, code/data tables, and self-modifying instructions.
- The player uses the C64 zero page; we save Applesoft's entire zero page every IRQ, load C64's state, execute the song, and restore Applesoft's zero page before leaving.
- Some C64 music code reads VIC-II, CIA, SID oscillator counters, `$01` 6510 memory banking, ROM routines, or illegal 6510 opcodes. These cannot be fixed by simple patching of `$D400` stores.
- This prototype does **not** emulate C64 memory banking, its IRQ handler, SID filters, pulse-width modulation, or exact SID ADSR. It assumes `init` and `play` are callable 50Hz subroutines.
- At 50Hz, the driver has a budget of approximately 20,000 CPU cycles including zero-page swapping, C64 playback, SID-to-AY translation and 6522 register writes. It must be measured under load.
- Files do not contain code signatures or a generic disassembler to patch arbitrary PSID code; patch sites are validated constants for this exact Mr. Heli binary.

## Later enhancements

1. Instrument `jsSID.js` to record actual C64 executed stores into `$D400-$D418`, including stores using `(zp),Y` and self-modified operands.
2. Generate a per-tune patch manifest and reject anything using unsupported opcodes, ROM or C64 peripherals.
3. Provide a new *raw PSID export* option in SIDchipJS.html while retaining SREG export.
4. Test IRQ cycle count and OS compatibility before attempting a reusable generic native player.
