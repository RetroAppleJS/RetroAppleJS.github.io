# Apple II+ emulator, assebler & debugger in JavaScript 

<img src="/res/appleIIplus_bck_650.png?raw=true" width=40% align="left" />

Unlike other emulation engines, **RetroAppleJS** wraps a complete AppleII+ IDE toolchain featuring an emulator, assembler, debugger, and reference manual bundled in one client-side JavaScript web application. This project **runs as-is, locally on any browser, no server required**.
Back in 1980, a few chaps like me were passionate about coding on the Apple II+, and machine coding was the way to get something done gracefully on a low-spec CPU originally designed for calculators.
Before starting, this project was made possible by several [authors](/docs/CREDITS.md), but first and foremost, we like to pay tribute to the creators of the Apple II for giving us the time of our lives. Even for those unfamiliar with the Apple II, it's a great platform to learn about computer hardware, operating systems, firmware, expansion architecture, and low-level software development. So, enjoy the beauty of 8-bit computing on a 6502 CPU, its math tricks, and **deceivingly simple** instruction set.

## Getting started

Since this web app does not require any back-end web server, just download the entire repo on (unzipping the .zip file) locally and run index.html on a JavaScript capable browser.  
Run w/o install: [github.io](https://retroapplejs.github.io)

1) Inside the assembler, tap the **'generate'** button
2) Tap the **'to emulator'** button
3) Inside the emulator, tap the **'paste'** button
4) Type **G6000** to run the code at address 6000h, that's it !

<img src="/res/Start_Step1.png?raw=true" width=46% /><img src="/res/Start_Step2.png?raw=true" width=50% />

<br>
Other assembler listings can be found in this [folder](/asm_code_examples), feel free to copy any of those in the left pane of the assembler and proceed the same way as described here above.

## Module overview

### Emulator

The Apple II+ emulator is probably the most intuitive module, at least for those who were familiar using an Apple II.
One can:
1) use the pasteboard to paste any text through the text prompt (APPLESOFT BASIC LISTINGS, DOS COMMANDS, ASSEMBLY... anything)   Just mind that a 1 MHz computer does not ingest many characters per second, so be patient.
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
[DEBUGGER.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/DEBUGGER.md)  
[ASSEMBLER.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/ASSEMBLER.md)   
[6502.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/6502.md)  
[ZEROPAGE_APPLE2PLUS.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/ZEROPAGE_APPLE2PLUS.md)  
[PERIPHERALS.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/PERIPHERALS.md)  
[TOOLS.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/TOOLS.md)  

Note that the markdown files here above must be compiled by a tool called [Docs_updater.html](https://retroapplejs.github.io/tools/ConfigFile_updater.html), into a JavaScript file included in the main application, called _COM_CONFIG.js_ located [here](/res/COM_CONFIG.js). In short, do not manually update this JavaScript file.

## Feature wish-list

- [ ] better document assembler code located in asm_code_examples
- [ ] better compatibility with listings from different Apple II assemblers (except virtual mnemonics)
- [ ] pasteboard scripting supporting keyboard/paddle/mouse recording, playback events and conditional stops
- [ ] interactive Apple II+ pop-up keyboard
- [ ] save disk image in .dsk format (convert internal .nib format to .dsk), and perhaps tweak the diskdrive into booting non-bootable disks (on a second drive)
- [ ] apple sound, including diskdrive noise
- [ ] paddle/mouse capture
- [ ] lo-res and hi-res graphics conversion tool (including dithering and color optimization algorithms)
- [ ] real-time camera capture tool - lo-res through software color-approximation (QuickCam emulation ? http://schmenk.is-a-geek.com/wordpress/?p=17)
- [ ] real-time camera capture tool - hi-res through firmware color-approximation and dithering
- [ ] macro script runner (emulating keyboard & paddle control)
- [ ] complete zero-page documentation (ZEROPAGE_APPLE2PLUS.md)
- [ ] complete memory-map documentation -> share memorymap data with assembler/disassembler to generate extra context
- [ ] popup tool with DEC-HEX-BIN-BASE64 converter, binary file converter and byte stream generator for Apple II pasteboard
- [ ] slot activity monitor, CPU load monitor (displaying and logging operator efficiency)
- [ ] add a tool to operate soft-switches e.g. SPKR and hard-switches e.g. USER1 jumper manually

## Contribute

This project is build with HTML/JavaScript, CSS, Markdown documentation and 6502 assembler source code.  Contributions in any of these fields are welcome, but the latest feature developments (here below) are currently the most valuable on my priority list.

### Latest developments

#### interactive Apple II+ virtual keyboard

Currently developing the **interactive Apple II+ pop-up keyboard** from feature whish-list.
feature details & status:
- [x] AppleII+ keyboard pop-up image (onmouseover)
- [x] alphanumeric keys + ESC key + arrow keys + space bar + RETURN key
- [x] POWER key
- [x] RESET key
- [ ] REPT key
- [ ] SHIFT keys
- [ ] CTRL key

Also to be considered: detect if host device is mouse-driven or touch-driven.  When touch-driven, hovering the keyboard is not possible without actioning a key.

*Note: Only two files are impacted:*
- *index.html*
- *res/EMU_AP2keys.js*

#### real-time audio

The simple ability from the Apple II to produce a 'click' sound by activating a circuit to transition the speaker voltage from 0V to 1V and the other way around seems deceivingly simple to emulate.  The main reasons are the [coarse-precision JavaScript timer](/docs/EMULATOR.md) and the way [JavaScript sound production is 'scheduled'](https://www.html5rocks.com/en/tutorials/audio/scheduling/), just like the SID chip did on a Commodore 64.  As a matter of fact, I seriously consider adding a virtual [AY-3-8910 and YM2149 sound chip](https://retroapplejs.github.io/tools/ayumi-js-master/) used on the mockingboard or [SID chip](https://retroapplejs.github.io/tools/SID_emulator.html) peripheral to the Apple II emulator.

#### apple II peripherals emulation
<img src="/res/appleIIplus_motherboard_p1_650.png?raw=true" width=40% align="right" />
Apple II wizards out there, anyone familiar with emulating any of these popular cards ? 
Recollecting ROM images from Apple II peripherals looks like a major challenge. Can anyone help ?

- [x] [Apple 16K Language Card](http://www.applelogic.org/PeripheralCards.html) e.g. enabling ProDOS
- [ ] [Videx VideoTerm or UltraTerm](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/80%20Column%20Cards/) 80-Column card
- [ ] [Thunderware Thunderclock Plus](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/Clock/Thunderware%20Thunderclock/) Clock with [BSR X-10 AC Remote Control System](https://www.atarimagazines.com/compute/issue17/209_1_INTERFACING_A_BSR_X-10_AC_REMOTE_CONTROL_SYSTEM_TO_YOUR_PET.php), for Home automation !
- [ ] [No-Slot Clock](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Chips/SMT%20No-Slot%20Clock/Manuals/No-Slot%20Clock%20-%20User%27s%20Manual.pdf) Simple Real-Time Clock
- [ ] [Serial Pro](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/Serial/AE%20Serial%20Pro/Manuals/AE%20Serial%20Pro%20-%20Manual.pdf) = Serial card + real time clock (Applied Engineering) 
- [ ] [6820 Peripheral Interface Adapter](https://en.wikipedia.org/wiki/Peripheral_Interface_Adapter), often abreviated as PIA
- [ ] [AE RamFactor](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/Memory/AE%20RamFactor/) more serious RAM expansion (256K - 1Mb)
- [ ] [Apple Mouse Card 670-0030-C](http://www.applelogic.org/PeripheralCards.html)
- [ ] [The Mocking Board](https://en.wikipedia.org/wiki/Mockingboard) sound card supported by different games and the 'Music Construction Set'
- [ ] [VersaCard](https://forum.vcfed.org/index.php?threads/do-you-own-a-prometheus-versacard-for-the-apple-ii-i-need-a-copy-of-the-rom.70770/) - [Brochure](https://cvxmelody.net/VERSAcard%20original%20brochure%20&%20manual%20cover.pdf) 4 on 1 card: serial, parallel,real-time clock, BSR Home automation
- [ ] Just a random thought, it would be nice to design virtual hardware that is replacing the hard work of addressing single pixels on both HGR screens (replacing the ROM routines plus extra settings to read zero-page locations in stead of registers) 
