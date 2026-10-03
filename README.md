# Apple II+ emulator, assembler & debugger in JavaScript 

<a href="https://retroapplejs.github.io"><img src="/res/appleIIplus_bck_650_v3.png?raw=true" width=30% align="left" href="https://retroapplejs.github.io" /></a>

Unlike other emulation engines, **RetroAppleJS** wraps a complete AppleII+ IDE toolchain featuring an emulator, assembler and debugger bundled in one client-side JavaScript web application. Yes indeed, this project **runs as-is, locally on any browser, no server required**.

Back in 1980, a few young curious minds like me were passionate about coding on the Apple II+.  Machine coding was likey the only way to get something done gracefully on its CPU called **6502**, a low-cost ($25) & low-spec chip originally designed for calculators.  Several [sources](/docs/CREDITS.md) made this project possible, serving as a tribute to the pioneers of home computing.  Even for those unfamiliar with the Apple II, it is still today a great platform to understand the foundations of computer hardware, operating systems, firmware, expansion architecture, and low-level software development.  Enjoy the elegance of 8-bit computing, clever math tricks, and one of the few machine code instruction sets simple enough to code by hand.

## Install & Run
  
- **install:** No install required.  Just __download__ the entire repo (unzipping the .zip file) locally and __run__ index.html on any JavaScript capable browser, or run directly in github.io just here below:
- **w/o install:**  ==> [Run last version directly](https://retroapplejs.github.io)
- **portable:**  ==> [Run as one file](https://retroapplejs.github.io/dist/RetroAppleJS.html)
- **bootable** ==> [Run last version (incl. DOS3.3 bootdisk) directly](https://retroapplejs.github.io/index.html?D1_DIR=Apple%20DOS%203.3.dsk&boot=true)  (booting takes avg. ~90s)

## Getting started

1) Inside the assembler, tap the **'Assemble'** button
2) Tap the **'send byte code to emulator'** button
3) Inside the emulator (boot a disk or hit the reset button), tap the **'paste'** button
4) Type **6000G** to run the code at address 6000h, that's it !

<a href=https://retroapplejs.github.io/index.html#tab2><img src="/res/Start_Step12.png?raw=true" width=100% /></a>

<br>
Other assembler listings can be found here: (https://github.com/RetroAppleJS/RetroAppleJS.github.io/tree/main/asm), feel free to copy any of those in the left pane of the assembler and proceed the same way as described here above.

## Vintage Lab

<a href=https://retroapplejs.github.io/tools/TOOLS_CATALOG.html><img src="/res/VintageLab256.png?raw=true" width=100% /></a>

Explore our [vintage computing laboratory](https://retroapplejs.github.io/tools/TOOLS_CATALOG.html), an exciting hub where all the components of our cutting-edge emulator are thoroughly tested and refined before being transformed into the retro-inspired recipes. Each of these components is a distinct project, meticulously crafted to allow you to delve into the complexities of our vast codebase in a fun and engaging way. Here, you can watch as we use a variety of techniques, including boiling, baking, smoking, and aging, to ensure that every component is primed and ready for use. Whether you're a developer looking to explore new codebases or a tech enthusiast interested in the history of computing, 

## Module overview

### Emulator

Run Apple II+ software, boot disk images, paste BASIC or assembly listings, and configure expansion cards and attached devices. The emulator includes JavaScript and WebAssembly CPU options, several video renderers, and a live system step debugger.

### Assembler

Edit and assemble 6502 source code, inspect the listing and symbols, and send the result directly to the emulator or debugger. Source conversion tools and supported directives help reuse vintage listings.

### Debugger

Step through 6502 code and inspect the disassembly, CPU trace, registers, flags, and memory. Import assembler symbols or emulator memory captures, and save or reload a debugging session as a `.DEB` file.

## User manuals

[EMULATOR.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/EMULATOR.md)  
[ASSEMBLER.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/ASSEMBLER.md)
[DEBUGGER.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/DEBUGGER.md)     
[6502.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/6502.md)
[PERIPHERALS.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/PERIPHERALS.md)  
[TOOLS.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/TOOLS.md)  

Note that the markdown files here above must be compiled by a tool called [Docs_updater.html](https://retroapplejs.github.io/tools/ConfigFile_updater.html), into a JavaScript file included in the main application, called _COM_CONFIG.js_ located [here](/res/COM_CONFIG.js). In short, do not manually update this JavaScript file.

## Feature wish-list

Completed items remain checked; unchecked items are planned or still need further development.

- [x] EMULATOR: Live system step debugger and memory capture
- [x] EMULATOR: Paddle/mouse input capture and AppleMouse II interface emulation
- [x] EMULATOR: Dynamic slot configuration with attached devices and ports
- [x] EMULATOR: Disk II, 16K Language Card, Videx VideoTerm, Serial Pro, and ThunderClock Plus implementations
- [x] EMULATOR: LIRON/SmartPort storage with UniDisk 3.5 and an emulated HD20 block device
- [x] EMULATOR: Dithertizer II camera capture using the original DSCAN driver
- [x] EMULATOR: Experimental DITHER2 color HGR capture
- [ ] EMULATOR: Pasteboard macro scripting with keyboard/paddle/mouse recording, playback, and conditional stops
- [ ] EMULATOR: Vapor-lock timing compatibility
- [ ] EMULATOR: Switch between US and Japanese Apple II keyboard layouts
- [ ] EMULATOR: Complete Mockingboard sound emulation and integrate Saturn RAM expansion
- [ ] EMULATOR: Add further peripherals, including UltraTerm, No-Slot Clock, AE RamFactor, Super Serial Card, and VersaCard
- [x] ASSEMBLER: Step Assembler and additional assembler directives
- [x] ASSEMBLER / DEBUGGER: Symbol transfer and debugger session import/export
- [x] RETRO LAB: Real-time camera processing and a configurable [ConvertHGR tool](tools/ConvertHGR.html)
- [ ] RETRO LAB: Further improve lo-res/hi-res conversion, dithering, and color optimization
- [ ] DOCUMENTATION: Expand the documentation and examples in [asm](asm/)
- [ ] TOOLS: Integrate number-base conversion, binary-file conversion, and pasteboard byte-stream generation into a common popup tool

## Contribute

This project is built with HTML/JavaScript, CSS, Markdown documentation, and 6502 assembly source code. Contributions in any of these fields are welcome. Read the [contribution guide](CONTRIBUTING.md) and [coding style guide](docs/CODING_STYLE.md), and use the wish-list and latest developments to find areas where you can help.

### Latest developments

#### Apple II peripherals emulation

<img src="/res/appleIIplus_motherboard_p1_650.png?raw=true" width=40% align="right" />

Expansion cards can be mounted or ejected through the slot configuration interface. Cards own their memory-mapped I/O and ROM behaviour; attached devices provide functions such as video output, serial terminals, disk storage, and camera input through named ports.

The current implementations include:

| Peripheral | Current scope |
| --- | --- |
| Disk II | Floppy controller emulation, disk image loading/saving, and configurable drive arrangements, including DuoDisk |
| 16K Language Card | Microsoft-compatible bank-switched RAM expansion in slot 0 |
| Videx VideoTerm | 80-column display, resident firmware, character ROMs, and a separate video output device |
| ThunderClock Plus | Real-time clock, interrupt generation, and emulated BSR/X-10 output |
| Applied Engineering Serial Pro | Serial interface and real-time clock, with an attached browser terminal and an optional GPT serial peer |
| AppleMouse II Interface | Original slot ROM with PIA command/handshake emulation and host mouse input |
| LIRON / Apple 3.5 Disk Interface | SmartPort transport with attached UniDisk 3.5 and HD20 block-storage devices |
| Dithertizer II (`DITHER`) | Monochrome camera capture compatible with the original DSCAN 4.2 driver |
| Color capture extension (`DITHER2`) | Experimental ConvertHGR-based capture that preserves HGR color-phase bits |

The Videx implementation targets **VideoTerm**; UltraTerm is not currently implemented. The HD20 device is presented through the emulated SmartPort bus. Mockingboard currently has a placeholder implementation, while Saturn RAM and Super Serial Card are not enabled in the main application.

Recent work has expanded the distinction between cards, attached devices, and their ports. Disk II and SmartPort devices now have topology-aware controls and media displays. Videx video output and Serial Pro terminal connections use the same device framework.

Camera capture also follows this model: ejecting either Dithertizer card detaches its camera device and releases the host camera stream. For the historical `DITHER` card, JavaScript and WASM supply the same luminance signal; **DSCAN performs the four threshold captures and Bayer dithering**. The separate `DITHER2` extension converts camera frames to color HGR through selectable JavaScript/WASM backends and captures an embedded HGR sample when the camera is off.

Contributions remain welcome for missing peripherals, ROM references, hardware behaviour, and compatibility testing with original Apple II software. See the [peripheral architecture](docs/PERIPHERALS_DEV.md), [Dithertizer guide](docs/DITHERTIZER.md), and [color capture notes](docs/DITHER2_COLOR_CAPTURE.md).

#### Assembler and debugger integration

Assembler output now carries symbols into the debugger, making listings and traces easier to follow. Debugger sessions can be saved and reloaded, and emulator memory captures can be inspected with matching symbol tables. See the [debugger manual](docs/DEBUGGER.md) and [system step-trace manual](docs/STEP_TRACE_MANUAL.md).
