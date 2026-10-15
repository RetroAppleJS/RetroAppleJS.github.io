# Peripheral Developer Reference

This reference is for two different jobs: **writing 6502 software for an Apple II expansion card**, and **implementing or maintaining that card in RetroAppleJS**. The companion [Peripheral User Guide](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/PERIPHERALS.md) covers the Slot Manager and controls; and each peripheral has it's own dedicated hardware note.

**Reading order:** Chapter 1 starts with real Apple II address decoding, access patterns and ROM analysis. Chapter 2 explains emulator source files, `_CFG_PSLOT`, callbacks, mounts, memory overlays, child devices and testing.

> **SCREENSHOT PLACEHOLDER D01 — Tool overview.** Capture the Emulator Slot Manager, live STEP TRACE and Assembler/Debugger interfaces side by side, with labels identifying their roles. Suggested filename: `docs/assets/PERIPHERALS-D01-tool-overview.png`.

## 1. Apple II software developer: using peripherals and analyzing firmware

### 1.1 The CPU sees addresses, not plug-and-play devices

Apple II expansion-card communication is mostly **memory-mapped**. A 6502 program reads or writes addresses; slot decoding and card hardware determine what those accesses do. There is no universal driver discovery protocol. Some software identifies a card's firmware; other software **assumes a conventional slot**, especially for hardware with no discoverable ROM.

| Address | Name used in RetroAppleJS | Typical purpose |
| --- | --- | --- |
| `$C000–$C07F` | **HostIO** | Motherboard keyboard, speaker, soft switches and related I/O |
| `$C080–$C0FF` | **SlotIO** | Eight 16-byte groups, one for each *physical* slot 0–7 |
| `$C100–$C7FF` | **SlotROM** | One 256-byte window per slot 1–7; card-specific contents or registers |
| `$C800–$CFFF` | **HostROM** | Shared 2KB expansion ROM window (ownership/selection is significant) |
| `$D000–$FFFF` | dynamic CPU mapping | Normally system ROM; may be replaced by bank-switched expansion RAM |

For physical slot `n` (0–7), its 16-byte I/O window starts at **`$C080 + $10 × n`**. Slot 6, for example, uses `$C0E0–$C0EF`. For slot `n` (1–7), its slot-page window is **`$C000 + $100 × n`**: slot 6 uses `$C600–$C6FF`.

The emulator uses names like *SlotROM* to identify **CPU address spaces**, not necessarily ROM chips. A card can put read/write registers into the `$Cn00` page and therefore use the `SlotROM` routing window **without containing a boot ROM**. The Mockingboard driver provides a concrete example.

> **SCREENSHOT PLACEHOLDER D02 — Apple II address map.** Capture the CPU memory-map display, highlighting $C080–$C0FF, $C100–$C7FF, $C800–$CFFF and $D000–$FFFF. Suggested filename: `docs/assets/PERIPHERALS-D02-bus-map.png`.

### 1.2 Why different peripheral mapping combinations exist

Here **X** means that the current `[PSLOT]` catalog declares a range for that card. It does **not**, by itself, guarantee a particular ROM binary or callback implementation; inspect the card's `this.action` and any dynamic mapping rules.

| Generic design pattern | HostIO | SlotIO | SlotROM | HostROM | Example / reason |
| --- | :---: | :---: | :---: | :---: | --- |
| Motherboard I/O | X | — | — | — | **A2BO**: keyboard and built-in host signals are not plug-in slot firmware. |
| Register-only expansion | — | X | — | — | **MS16K**, **SATURN**, **LEGEND**: soft switches select banks/memory behavior; the useful memory is *outside* the I/O window. |
| Slot-page-mapped registers only | — | — | X | — | **MOCK**: the `$Cn00` page handles peripheral register accesses; `SlotROM` here does not imply ROM bytes. |
| Registers plus a slot page | — | X | X | — | **DISKII**, **AMOUSE**, **DITHER**, **DITHER2**: a 16-byte register window and a separately routed `$Cn00` page. For **DITHER2**, the current driver implements `SlotIO` callbacks; do not infer that `SlotROM` contains an implemented firmware image. |
| Slot page plus expanded ROM, **without SlotIO** | — | — | X | X | **Generic possible design, not currently a standalone configuration row**: a `$Cn00` entry/stub can lead to additional `$C800` code while no `$C08n` registers are needed. |
| Registers, slot page and expanded ROM | — | X | X | X | **SPC (Serial Pro)**, **VIDEX**, **LIRON**, **RAMFAC**, **TCLKP**: software needs control registers and more firmware than a 256-byte page offers. |
| Registers plus *bank-switched system-memory overlay* | — | X | — | — | **MS16K** is the classic case: reads of `$C080–$C08F` change what RAM/ROM is seen at `$D000–$FFFF`. The overlay is **not HostROM**. |

The last row is intentionally a **dynamic mapping overlay**, not another fixed `[PSLOT]` column. Cards can combine these patterns and switch views over time. ROM banking, extended firmware and language-card paging exist to fit more behavior into the Apple II's limited fixed address windows.

**In particular:**
- **SlotIO + SlotROM:** I/O registers and a 256-byte page coexist, as on a Disk II controller.
- **SlotROM + HostROM but no SlotIO:** an architectural pattern for a ROM-oriented card, not proof that any current catalog entry implements precisely that combination.
- **SlotIO + onboard ROM:** controllers such as Serial Pro route control registers through SlotIO and firmware through their slot/expansion ROM windows.
- **SlotIO + dynamic mapped RAM/ROM:** a language card switches which physical memory responds at system ROM addresses; its 16-byte soft-switch interface is not itself the switched RAM.

> **SCREENSHOT PLACEHOLDER D03 — Compare mapping patterns.** Capture slot-details mappings for DISKII, MOCK, SPC and MS16K, preferably annotated with the active space/handler differences. Suggested filename: `docs/assets/PERIPHERALS-D03-patterns.png`.

### 1.3 Writing position-independent slot-aware 6502 code

When software has a known slot, derive its I/O addresses rather than assuming slot 6 or 7. The 6502 often uses a slot-derived offset to reach `$C0n0` or `$Cn00`; the exact register layout and protocol are **card-specific**.

```text
Physical slot 4: SlotIO = $C0C0–$C0CF ; SlotROM = $C400–$C4FF
Physical slot 6: SlotIO = $C0E0–$C0EF ; SlotROM = $C600–$C6FF
Physical slot 7: SlotIO = $C0F0–$C0FF ; SlotROM = $C700–$C7FF
```

**Caution:** I/O reads can *change state*. Reading an address just to “see what is there” is not always safe. In particular `$C000–$C0FF` holds soft switches and slot registers. Before probing a card, consult its programming manual or existing firmware source.

When software relies on a fixed slot (e.g. the usual position of a sound or specialty video card), prefer that slot even though other placements may be permitted in `[PSLOT]`. In the **Add Peripheral** picker the `$` suffix in `SLOTrange` marks the *preferred* slot visually, while `*` marks a *pre-installed* slot. Neither symbol changes 6502 address decoding.

### 1.4 ROM code: find existing sources before disassembling bytes

First check **[`asm/ROMS/PERIPHERALS/`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/tree/main/asm/ROMS/PERIPHERALS/)**. The repository already contains annotated or reconstructed 6502 sources and symbol tables. Useful entry points include:

| Card / topic | Source or symbols |
| --- | --- |
| Disk II boot PROM | [`DISKII_PROM.S`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/asm/ROMS/PERIPHERALS/DISKII_PROM.S), [annotated symbols](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/asm/ROMS/PERIPHERALS/DISKII_PROM_ANNOTATED.symbols.json), [slot 6 symbols](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/asm/ROMS/PERIPHERALS/DISKII_SLOT6.symbols.json) |
| Disk II GCR | [`DISKII_GCR.S`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/asm/ROMS/PERIPHERALS/DISKII_GCR.S) |
| Thunderclock / clock | [`CLOCK_II.S`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/asm/ROMS/PERIPHERALS/CLOCK_II.S) |
| Super Serial | [`SSC_LO.S`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/asm/ROMS/PERIPHERALS/SSC_LO.S), [`SSC_HI.S`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/asm/ROMS/PERIPHERALS/SSC_HI.S) |
| VideoTerm | [`VIDEX_VIDEOTERM_Firmware.S`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/asm/ROMS/PERIPHERALS/VIDEX_VIDEOTERM_Firmware.S) |
| Dithertizer | [`DITHERIZER_TEST.S`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/asm/ROMS/PERIPHERALS/DITHERIZER_TEST.S), [slot 7 symbols](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/asm/ROMS/PERIPHERALS/DITHER_SLOT7.symbols.json) |
| Mockingboard | [slot 4 symbols](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/asm/ROMS/PERIPHERALS/MOCKINGBOARD_SLOT4.symbols.json) (a symbol map, **not necessarily firmware**). |
| Applied Engineering Serial Pro | [`Serial Pro/` source directory](https://github.com/RetroAppleJS/RetroAppleJS.github.io/tree/main/asm/ROMS/PERIPHERALS/Serial%20Pro/) with structured SlotROM and banked EPROM reconstructions (some files are `.S.txt`). |

**Check the exact firmware revision and slot before trusting labels.** A `.symbols.json` file describes addresses; it does not install a ROM or guarantee the running binary matches. Sources with `_STRUCTURED_EXACT` and `.S.txt` may need dialect/format review before assembling them directly.

> **SCREENSHOT PLACEHOLDER D04 — ROM source tree.** Capture the repository browser at `asm/ROMS/PERIPHERALS/` with Disk II, Serial Pro and symbol files visible. Suggested filename: `docs/assets/PERIPHERALS-D04-rom-tree.png`.

### 1.5 When you only have ROM bytes: a reproducible investigation

1. **Identify the card, physical slot and firmware revision.** Decide which bytes are visible at `$Cn00`, which at `$C800–$CFFF`, and whether banks or an ownership latch change the visible bytes.
2. **Compare with existing assembly** in the directory above. If an exact match exists, start from it rather than inventing labels.
3. **Inspect the mapped ROM in a running emulator** with live [STEP TRACE](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/STEP_TRACE_MANUAL.md#17-peripheral-rom-tracing). It reads the current CPU bus, including `$C100–$CFFF`. Set the SYSTEM CPU slider to 0% and open STEP TRACE using the bug icon as described in its [manual](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/STEP_TRACE_MANUAL.md#opening-step-trace-and-step-trace-scenario).
4. **Load a suitable `.symbols.json`** into STEP TRACE's **SYMBOLS → load**, if available. You can also use the separate [Debugger](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/DEBUGGER.md#11-working-with-symbol-files) and its symbol/session workflows.
5. **Disassemble a captured dump or instruction log** using [`tools/DAssemblerJS.html`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/tools/DAssemblerJS.html): paste a hex memory dump (e.g. `C600: A9 00 ...`) or an enhanced/legacy boot log, click **Disassemble**, and use **Download .asm** to keep an editable listing.
6. **Annotate and verify:** record instruction start addresses, branch targets, literal data versus executable code, entry points, state-changing reads, bank-selection writes and which slot/ROM bank was selected. Re-run with the same ROM version to verify.

Live tracing shows **what executed**; a raw dump disassembles **what is stored**. These are complementary: disassembling all bytes linearly can misinterpret embedded tables, and a trace may miss unexecuted routines. **STEP TRACE deliberately masks `$C000–$C0FF`** from normal debugger reads because those locations are side-effecting I/O. Do not treat such bytes as ROM.

> **SCREENSHOT PLACEHOLDER D05 — ROM analysis workflow.** Capture STEP TRACE stopped in `$C600` (symbols loaded), plus `tools/DAssemblerJS.html` showing an imported dump and downloaded assembly. Suggested filename: `docs/assets/PERIPHERALS-D05-rom-disassembly.png`.

## 2. RetroAppleJS developer: implementing and maintaining card drivers

### 2.1 Source-of-truth and dispatch architecture

| Component | Responsibility |
| --- | --- |
| [`docs/CONFIG.md`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/CONFIG.md) → [`tools/ConfigFile_updater.html`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/tools/ConfigFile_updater.html) → [`res/COM_CONFIG.js`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/res/COM_CONFIG.js) | Canonical `[PSLOT]` catalog, supported systems/slots, range-enable flags, default and preferred-slot markers. Generate the JavaScript; **do not manually maintain duplicate PCODE/SLOT tables**. |
| [`res/EMU_apple2hw.js`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/res/EMU_apple2hw.js) | CPU-memory decoding; forwards peripheral address windows into the I/O subsystem, and supports dynamic 4KB-aligned mapping overlays. |
| [`res/EMU_apple2io.js`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/res/EMU_apple2io.js) | Discovers card containers, builds slot plans, mounts/unmounts, binds `ACTION_MAP.RD/WR`, selects shared HostROM owner, provisions devices and renders the UI. |
| `res/EMU_CARD_*.js` | **Card** object: `id.PCODE`, `this.action` callbacks, registers/firmware, optional UI and attached-device declarations. |
| `res/EMU_DEVICE_*.js` | **Device** implementations hosted by cards (not independent slot occupants). |

The normal path is **6502 address → Apple2Hw routing → Apple2IO per-address callback → card register/ROM method → optional child device**. The card's `this.action` is authoritative for actual RD/WR handling; `[PSLOT]` describes which windows are eligible to be mapped. `IO_map(model)` handles the motherboard's own soft switches, which is a different layer ([IO map notes](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/IO_MAP_DEV.md)).

> **SCREENSHOT PLACEHOLDER D06 — Architecture.** Annotate the debugger memory map and slot-details callback table alongside a small call-flow diagram. Suggested filename: `docs/assets/PERIPHERALS-D06-architecture.png`.

### 2.2 Configuring a card in `[PSLOT]`

A row provides `NAME`, `HostIO`, `SlotIO`, `SlotROM`, `HostROM`, `SLOTrange`, `SYScode` and `Manuals`. The X flags enable the corresponding CPU windows; they are **not** replacements for the driver callbacks. The catalog doubles as a whitelist for compatibility.

```text
DITHER2  ...  SlotIO=X  SlotROM=X  SLOTrange=1,2,3,4,5,6,7$  SYScode=A2,A2P,A2e
DISKII   ...  SlotIO=X  SlotROM=X  SLOTrange=1,2,3,4,5,6*,7
MS16K    ...  SlotIO=X             SLOTrange=0*
```

`SLOTrange` markers have **independent** meanings:

| Suffix | Meaning in the slot plan | Runtime effect |
| --- | --- | --- |
| (none) | Compatible location | User can mount here; no automatic install |
| `*` | Pre-assigned | Adds that card to the initial mount plan |
| `$` | Preferred / conventional | Inverse-colors its whole label in ADD PERIPHERAL **for that slot only** |
| `*$` or `$*` | Both | Pre-installs and highlights the slot |

A leading `H` denotes the motherboard; numeric positions are physical slots 0–7. Internal `Apple2IO.slots` indices are offset: **0 = board**, **1 = physical slot 0**, … **8 = physical slot 7**. Do not confuse slot 0 with the motherboard.

The current `slotR` plan contains separate `slotFit`, `slotMap` and `slotPreferred` arrays. The `$` hint must **never** change `slotFit` validation or `slotMap` auto-installation. The URL `slots=...` overrides compatible pre-filled assignments, not the compatibility rules; see [URL Arguments](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/URL_ARGUMENTS.md#pre-mounted-peripherals-slots).

After editing `docs/CONFIG.md`, run `tools/ConfigFile_updater.html` and ensure the generated `res/COM_CONFIG.js` **parses completely** and preserves its bundled documentation. The legacy `[PCODE]` and `[SLOT#]` tables were removed and must not be reintroduced.

> **SCREENSHOT PLACEHOLDER D07 — Configuration and picker.** Capture the `[PSLOT]` row for DITHER2, the generated JavaScript line and the PR#7 picker with its inverse label. Suggested filename: `docs/assets/PERIPHERALS-D07-config-markers.png`.

### 2.3 Register a card and define its I/O callbacks

A card implementation exposes an identity such as `this.id = { PCODE: "MOCK", icon: "..." }`. It must be registered as an eligible I/O container so `Apple2IO.scanPeripheralContainers()` can find its constructor; `id.PCODE` must match a row in `_CFG_PSLOT`. **A catalog entry alone cannot create a peripheral.**

A simplified callback pattern is:

```javascript
// Schematic example: only declare windows the card actually services.
this.action = {
    SlotROM: {
        RD: { callback: (addr, ctx) => card.readSlotROM(addr, ctx) },
        WR: { callback: (addr, value, ctx) =>
              card.writeSlotROM(addr, value, ctx) }
    }
};
```

At `mount()`, Apple2IO checks **system compatibility (SYScode)** and **physical slot eligibility (SLOTrange)** *before* instantiating/binding the card. A rejected mount does not install its callbacks. Boot-time failures are collected in one **acknowledgeable compatibility-warning popup**; warn rather than silently creating an invalid mapping.

The mount process uses `_CFG_IORANGES` to compute each window's CPU offsets, binds the declared RD/WR callbacks into `CIO.ACTION_MAP`, records the card's mount metadata and handles dynamic mappings and attached devices. A driver's `this.action.SlotROM` can represent registers rather than firmware, as with [Mockingboard](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/res/EMU_CARD_mockingboard.js).

### 2.4 Shared expansion ROM, ownership and bank switching

The `$C800–$CFFF` range is a **shared 2KB window**. Do not treat it like seven independent copies. A card's slot-page access can select which peripheral owns the expansion ROM window; accesses such as `$CFFF` can release that ownership. A banked card may additionally select *which physical onboard ROM bank* is visible at the same CPU addresses.

Read the actual examples in [Serial Pro](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/res/EMU_CARD_serialpro.js), [VideoTerm](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/res/EMU_CARD_videx.js) and [LIRON](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/res/EMU_CARD_LIRON.js). Apple2IO manages the shared HostROM dispatch/ownership and routes `HostROM.WR` through the current owner; individual card code must keep its own bank state and read semantics consistent.

**Do not confuse** a banked `$C800` firmware window with a language-card **`$D000–$FFFF` system-memory overlay**. They use different routing paths and address decoders.

> **SCREENSHOT PLACEHOLDER D08 — Expansion ROM ownership.** Show a STEP TRACE listing in $C800–$CFFF and the corresponding card slot-details HostROM mapping. Suggested filename: `docs/assets/PERIPHERALS-D08-hostrom.png`.

### 2.5 Dynamic CPU overlays and attached devices

Cards such as `MS16K` need to change RAM/ROM visible at `$D000–$FFFF` in response to soft-switch accesses. Their SlotIO callback changes internal bank state; their [`Apple2IO.MEMORY_MAP`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/res/EMU_apple2io.js) rules then install or restore mappings in the hardware's **4KB-aligned CPU-memory dispatch**. See [`EMU_CARD_ramcard.js`](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/res/EMU_CARD_ramcard.js) for a concrete implementation. The complete bank/switch details are in [16K Language Cards](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/PERIPHERALS_16K_LANGUAGE_CARDS.md).

A **card** can also declare `deviceConfig` entries and host one or more attached `EMU_DEVICE_*.js` instances. Apple2IO's `attach()`, `detach()` and `provisionPeripheral()` keep the actual device topology separate from the card's slot identity. The slot-details view offers **Attach device**, instance configuration and diagnostic JSON export when supported. See [Disk II](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/res/EMU_CARD_appledisk2.js) and [Mockingboard](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/res/EMU_CARD_mockingboard.js) as contrasting card/device designs.

> **SCREENSHOT PLACEHOLDER D09 — Overlays and device topology.** Capture an MS16K dynamic mapping row and a controller's child-device list. Suggested filename: `docs/assets/PERIPHERALS-D09-overlay-devices.png`.

### 2.6 Validation checklist before a peripheral PR

1. Confirm the card's `id.PCODE` exactly matches `[PSLOT]` and its container is discoverable.
2. Verify the current machine is included in `SYScode` and the chosen slot in `SLOTrange`.
3. Compare `[PSLOT]` range-enable flags with *actual* `this.action` handlers. Distinguish firmware bytes from register-mapped SlotROM accesses.
4. Test RD **and** WR callbacks; observe that software-visible side effects occur at the correct addresses, including slot changes.
5. Test HostROM ownership, `$CFFF` release and bank switching when applicable.
6. Test peripheral **mount / unmount / move / warm restart**, including no dangling callbacks and consistent attached-device instances.
7. Test `*` pre-install, `$` preferred-label-only and `*$` combined behavior without changing compatibility.
8. For overlays, verify CPU read/write mappings and restored defaults across relevant `$D000–$FFFF` banks.
9. Regenerate `COM_CONFIG.js` from `CONFIG.md`, parse the entire JS and run relevant `tests/` regressions.
10. Capture evidence: screenshots of slot mappings, STEP TRACE at a firmware entry, and a reproducible ROM revision/symbol file.

Useful related manuals: [User Guide](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/PERIPHERALS.md), [STEP TRACE](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/STEP_TRACE_MANUAL.md), [Debugger](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/DEBUGGER.md), [Assembler](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/ASSEMBLER.md), [I/O map architecture](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/IO_MAP_DEV.md) and [URL Arguments](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/URL_ARGUMENTS.md).

> **SCREENSHOT PLACEHOLDER D10 — Developer verification.** Capture a loaded symbol table in STEP TRACE and the slot-details address map next to the corresponding card source. Suggested filename: `docs/assets/PERIPHERALS-D10-verification.png`.
