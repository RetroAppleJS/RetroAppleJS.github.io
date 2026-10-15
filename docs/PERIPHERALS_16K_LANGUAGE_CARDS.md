# 16K Language Cards — Apple II Hardware and Emulator Note

This is a **card-specific reference**, split out of the general [Peripheral User Guide](PERIPHERALS.md) and [Peripheral Developer Reference](PERIPHERALS_DEV.md). It is useful when writing 6502 software that controls language-card banks, or when examining the RetroAppleJS `MS16K` driver.

## What the card adds

A 16K language card replaces the CPU's normal read/write view of part of the system ROM address range with bank-switched RAM. Its familiar variants include:

- [Apple Language Card](http://www.applelogic.org/files/LANGCARDMAN.pdf)
- [Microsoft 16K RAM Card](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/Language%20Cards/Microsoft%2016K%20RAM%20Card/Manuals/Microsoft%20RAMCard%20-%20Manual.pdf)
- [Applied Engineering Pocket Rocket](https://usermanual.wiki/Document/ae16kpocketrocketbrochure.1819483971.pdf)

They are related, but should not be assumed to have identical board layouts or firmware ROM arrangements. Original Apple Language Card variants also relate to historical Apple II ROM expansion/upgrades; this differs from the Apple II+ system ROM already present in the emulator.

For a schematic perspective see the [Apple II+ motherboard diagram](https://archive.org/details/Schematic_Diagram_of_the_Apple_II/page/n1/mode/2up) and [Apple Language Card schematics](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/Language%20Cards/Apple%20Language%20Card/Schematics/Apple%20Language%20Card%20-%20Schematics%20050-0019-01.pdf).

> **SCREENSHOT PLACEHOLDER L01 — 16K RAM card in Slot Manager.** Show MS16K in PR#0 and its details/Peripheral control button. Suggested filename: `docs/assets/PERIPHERALS-L01-16k-slot.png`.

## Memory layout and why SlotIO alone is enough

The card provides **16KB of RAM** under the upper ROM addresses:

- `$D000–$DFFF` — **4KB**, bank A *or* bank B.
- `$E000–$FFFF` — **8KB**, common to both bank selections.

Because two 4KB banks share the same `$D000` CPU window, both can exist within 16KB of physical expansion memory while only 12KB is visible at once.

```text
CPU addresses           Normal view         Language-card RAM view
$FFFF ┌──────────────┐                       ┌──────────────┐
      │  Monitor ROM │                       │  common 8KB  │
$E000 ├──────────────┤                       │  expansion   │
      │  System ROM  │                       ├──────────────┤
$D000 └──────────────┘                       │  bank A / B  │
                                           └──────────────┘
      $C080–$C08F: SlotIO soft switches choose ROM/RAM, bank and write enable
```

The card's **control registers** lie in physical slot 0's `$C080–$C08F` SlotIO window. The **actual expanded memory** is not in the 16-byte SlotIO window, the `$C100–$C7FF` SlotROM pages, or the `$C800–$CFFF` HostROM window. It is a **dynamic mapping** over `$D000–$FFFF`.

This is a generic peripheral design pattern: **SlotIO selects bank state → the hardware memory decoder changes which RAM/ROM responds elsewhere.** Other RAM expansions may use the same pattern with different banks or control addresses.

> **SCREENSHOT PLACEHOLDER L02 — Language-card mapping.** Show the MS16K SlotIO row and dynamic mapping(s) for $D000–$FFFF in the slot-details popup or memory monitor. Suggested filename: `docs/assets/PERIPHERALS-L02-memory-map.png`.

## Soft-switch address reference

The following table retains the classic language-card switch layout. **Accesses can have side effects**: when investigating the card, do not casually read these addresses from a memory viewer as if they were plain RAM.

| CPU address | Read view | Write access | Bank | Conventional behavior |
| --- | --- | --- | --- | --- |
| `$C080` | RAM | protected | B | RAM read, write-protected |
| `$C081` | ROM | enabled after qualifying double access | B | ROM read / RAM write |
| `$C082` | ROM | protected | B | ROM-only |
| `$C083` | RAM | enabled after qualifying double access | B | RAM read/write |
| `$C088` | RAM | protected | A | RAM read, write-protected |
| `$C089` | ROM | enabled after qualifying double access | A | ROM read / RAM write |
| `$C08A` | ROM | protected | A | ROM-only |
| `$C08B` | RAM | enabled after qualifying double access | A | RAM read/write |

**Double-access behavior:** on a classic language card, allowing writes is not merely a one-off store. The soft-switch sequence must satisfy the card's write-enable mechanism (commonly two qualifying accesses). Check the precise implementation and your test's reset state before writing to RAM. The previous documentation marked `$C081` as a cold-boot default; defaults are hardware/boot-dependent and should be verified in the emulator rather than assumed for all card variants.

> **SCREENSHOT PLACEHOLDER L03 — Soft-switch trace.** Capture live STEP TRACE or the debugger showing accesses to $C081/$C083, alongside a language-card bank/status monitor. Suggested filename: `docs/assets/PERIPHERALS-L03-switches.png`.

## RetroAppleJS implementation and testing

The emulator's card driver is [`res/EMU_CARD_ramcard.js`](../res/EMU_CARD_ramcard.js) (PCODE `MS16K`). Its `this.action.SlotIO` callback interprets soft switches; `Apple2IO.MEMORY_MAP` rules then map RAM reads/writes into 4KB-aligned CPU-memory regions or restore the normal system ROM mapping. The configuration master is [`docs/CONFIG.md`](CONFIG.md) (`[PSLOT]`); the general mechanism is documented in the [Developer Reference](PERIPHERALS_DEV.md#25-dynamic-cpu-overlays-and-attached-devices).

When verifying behavior:

1. Mount `MS16K` in physical slot 0; the Slot Manager represents this as `PR#0` (distinct from the motherboard).
2. Establish the original ROM read state and record bytes at `$D000` / `$E000`.
3. Select bank A/B and RAM-read mode via the documented soft switches.
4. Prove the two 4KB banks differ and the upper 8KB remains common.
5. Test the write-protect / double-access sequence, then restore ROM mapping.
6. Confirm a warm reset and reconfiguration do not leave stale CPU read/write callbacks.

For interactive execution analysis use [STEP TRACE](STEP_TRACE_MANUAL.md) and [Debugger](DEBUGGER.md). Historical testing material also exists in the [KansasFest MemUtil collection](http://www.ivanhogan.com/kfest/MemUtil/).

> **SCREENSHOT PLACEHOLDER L04 — Validation sequence.** Capture a memory monitor comparing bank A, bank B and the common 8KB region, with a STEP TRACE stop on a language-card soft switch. Suggested filename: `docs/assets/PERIPHERALS-L04-bank-verification.png`.
