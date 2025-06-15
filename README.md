# Apple II+ emulator, assembler & debugger in JavaScript 

<img src="/res/appleIIplus_bck_650.png?raw=true" width=30% align="left" />

Unlike other emulation engines, **RetroAppleJS** wraps a complete AppleII+ IDE toolchain featuring an emulator, assembler, debugger, and reference manual bundled in one client-side JavaScript web application. Yes indeed, this project **runs as-is, locally on any browser, no server required**.

Back in 1980, a few young chaps like me were passionate about coding on the Apple II+.  Machine coding was the way to get something done gracefully on the 6502, a low-cost & spec CPU originally designed for calculators.  Several [sources](/docs/CREDITS.md) made this project possible, serving as a tribute to the pioneers of home computing.  Even for those unfamiliar with the Apple II, it is still today a great platform to understand the foundations of computer hardware, operating systems, firmware, expansion architecture, and low-level software development.  Enjoy the elegance of 8-bit computing, clever math tricks, and one of the few machine codes instruction sets simple enough to code by hand.

## Install & Run
  
- **install:** Bear in mind this source code = directly executable in your browser.  Hence, __download__ the entire repo (unzipping the .zip file) locally and __run__ index.html on any JavaScript capable browser, or run directly in github.io just here below:
- **w/o install:**  ==> [Run last version directly](https://retroapplejs.github.io)
- **bootable** ==> [Run last version (incl. DOS3.3 bootdisk) directly](https://retroapplejs.github.io/index.html?D1_DIR=Apple%20DOS%203.3.dsk&boot=true)  (booting takes avg. ~90s)

## Getting started

1) Inside the assembler, tap the **'assemble'** button
2) Tap the **'to emulator'** button
3) Inside the emulator, tap the **'paste'** button
4) Type **6000G** to run the code at address 6000h, that's it !

<img src="/res/Start_Step12.png?raw=true" width=100% />

<br>
Other assembler listings can be found here: (https://github.com/RetroAppleJS/RetroAppleJS.github.io/tree/main/asm), feel free to copy any of those in the left pane of the assembler and proceed the same way as described here above.

## Vintage Lab

<img src="/res/VintageLab256.png?raw=true" width=100% />

Explore our [vintage computing laboratory](https://retroapplejs.github.io/tools/TOOLS_CATALOG.html), an exciting hub where all the components of our cutting-edge emulator are thoroughly tested and refined before being transformed into the retro-inspired recipes. Each of these components is a distinct project, meticulously crafted to allow you to delve into the complexities of our vast codebase in a fun and engaging way. Here, you can watch as we use a variety of techniques, including boiling, baking, smoking, and aging, to ensure that every component is primed and ready for use. Whether you're a developer looking to explore new codebases or a tech enthusiast interested in the history of computing, 

## Module overview

### Emulator

The Apple II+ emulator is probably the most intuitive module, at least for those who were familiar using an Apple II.
One can:
1) use the pasteboard to paste any text through the text prompt (APPLESOFT BASIC LISTINGS, DOS COMMANDS, ASSEMBLY... anything)
2) insert any disk found on the internet (.do, .dsk)

### Assembler

The assembler contains handy tools to edit source-code originating from all over the internet, but purposefully avoids the implementation of any exotic macro language as this would perpetuate numerous assembler code compatibility problems.  Once the code is generated, one can send the object code with one click to the debugger or the pasteboard of the emulator.

### Debugger

The debugger is composed of 5 sections
1) Disassembler
2) Memory tracer
3) CPU operations monitor
4) CPU register
5) Memory map
6) Help screen

## User manuals

[EMULATOR.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/EMULATOR.md)  
[ASSEMBLER.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/ASSEMBLER.md)
[DEBUGGER.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/DEBUGGER.md)     
[6502.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/6502.md)  
[ZEROPAGE_APPLE2PLUS.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/ZEROPAGE_APPLE2PLUS.md)  
[PERIPHERALS.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/PERIPHERALS.md)  
[TOOLS.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/TOOLS.md)  

Note that the markdown files here above must be compiled by a tool called [Docs_updater.html](https://retroapplejs.github.io/tools/ConfigFile_updater.html), into a JavaScript file included in the main application, called _COM_CONFIG.js_ located [here](/res/COM_CONFIG.js). In short, do not manually update this JavaScript file.

## Feature wish-list

- [ ] EMULATOR: Step debugger (decommission or extend the current debugger ?)
- [ ] EMULATOR: pasteboard macro scripting supporting keyboard/paddle/mouse recording, playback events and conditional stops
- [ ] EMULATOR: popup tool with DEC-HEX-BIN-BASE64 converter, binary file converter and byte stream generator for Apple II pasteboard
- [ ] EMULATOR: slot configurator & activity monitor + tool to operate soft-switches e.g. SPKR and hard-switches e.g. USER1 jumper manually
- [ ] EMULATOR .NIB to .DSK converter [DiskJS](https://retroapplejs.github.io/tools/DiskJS.html)
- [ ] EMULATOR: paddle/mouse capture
- [ ] ASSEMBLER: Step Assembler completion (currently in alpha release)
- [ ] ASSEMBLER: Disassembler to standard assembly listings
- [ ] ASSEMBLER: Transpiler from 6502 assembler to JavaScript (followed by a JavaScript->6502 assembler transpiler)
- [ ] ASSEMBLER: Extend pragma's (pick a few useful ideas from Merlin assembler)
- [ ] ASSEMBLER: complete memory-map (incl. zero-page) documentation -> share memorymap data with assembler/disassembler to generate extra context
- [ ] ASSEMBLER: better compatibility with listings from different Apple II assemblers (except virtual mnemonics)
- [ ] RETRO LAB: realtime dithering in CameraJS
- [ ] RETRO LAB: GPT completion
- [ ] RETRO LAB: real-time camera capture tool - lo-res through software color-approximation (QuickCam emulation ? http://schmenk.is-a-geek.com/wordpress/?p=17)
- [ ] RETRO LAB: lo-res and hi-res graphics conversion tool (including dithering and color optimization algorithms)
- [ ] OTHER: better document assembler code located in asm_code_examples
      
## Contribute

This project is build with HTML/JavaScript, CSS, Markdown documentation and 6502 assembler source code.  Contributions in any of these fields are welcome, but the latest feature developments (here below) are currently the most valuable on my priority list.

### Latest developments

#### interactive Apple II+ virtual keyboard

<img src="/res/appleIIplus_vir.png?raw=true" width=40% align="right" />
It took a while to find a good generic framework to support keyboard emulation. But one popular online tool was hiding in plain sight: www.keyboard-layout-editor.com. This framework can be used to generate virtually any virtual keyboard in HTML format.

So, here's the new Apple II+ keyboard HTML basis:
https://www.keyboard-layout-editor.com/#/gists/ba23f9cdc666b5d2a61cf5408f062a96

The new version of EMU_A2Pkeys.js, besides HTML, covers the action logic and mapping logic for 3 use-cases:

- virtual keyboard: for mouse/trackpad/screen tapping
- real keyboard: type as you go (after click/tapping the screen canvas)
- pasteboard: click the tool icon in the main menu -> copy-paste your text/source code right into the Apple II+ prompt

Before calling it a version, this needs to be tested on a few laptop keyboards, and touch devices.
If everything goes well, documentation will follow soon!

*Note: Only two files are impacted:*
- *index.html*
- *res/EMU_AP2keys.js*

#### apple II peripherals emulation
<img src="/res/appleIIplus_motherboard_p1_650.png?raw=true" width=40% align="right" />
Apple II wizards out there, anyone familiar with emulating any of these popular cards ? 
Recollecting ROM images from Apple II peripherals looks like a major challenge. Can anyone help ?

- [ ] Dynamic slot/peripheral configuration
- [ ] [Videx VideoTerm or UltraTerm](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/80%20Column%20Cards/) 80-Column card
- [ ] [Thunderware Thunderclock Plus](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/Clock/Thunderware%20Thunderclock/) Clock with [BSR X-10 AC Remote Control System](https://www.atarimagazines.com/compute/issue17/209_1_INTERFACING_A_BSR_X-10_AC_REMOTE_CONTROL_SYSTEM_TO_YOUR_PET.php), for Home automation !
- [ ] [No-Slot Clock](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Chips/SMT%20No-Slot%20Clock/Manuals/No-Slot%20Clock%20-%20User%27s%20Manual.pdf) Simple Real-Time Clock
- [ ] [Serial Pro](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/Serial/AE%20Serial%20Pro/Manuals/AE%20Serial%20Pro%20-%20Manual.pdf) = Serial card + real time clock (Applied Engineering) 
- [ ] [6820 Peripheral Interface Adapter](https://en.wikipedia.org/wiki/Peripheral_Interface_Adapter), often abreviated as PIA
- [ ] [AE RamFactor](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/Memory/AE%20RamFactor/) more serious RAM expansion (256K - 1Mb)
- [ ] [Apple Mouse Card 670-0030-C](http://www.applelogic.org/PeripheralCards.html)
- [ ] [The Mocking Board](https://en.wikipedia.org/wiki/Mockingboard) sound card supported by different games and the 'Music Construction Set'
- [ ] [VersaCard](https://forum.vcfed.org/index.php?threads/do-you-own-a-prometheus-versacard-for-the-apple-ii-i-need-a-copy-of-the-rom.70770/) - [Brochure](https://cvxmelody.net/VERSAcard%20original%20brochure%20&%20manual%20cover.pdf) 4 on 1 card: serial, parallel,real-time clock, BSR Home automation
- [ ] [Mouse card](https://www.applefritter.com/content/a2usb-apple-ii-usb-mouse-interface-card-emulation)

