# The Apple II IDE

<img src="/res/appleIIplus_bck_650.png?raw=true" width=40% align="left" />

This is a complete AppleII+ IDE toolchain with an assembler, debugger, emulator and CPU reference manual bundled in one client-side JavaScript web application.  All you need is to run _index.html_ in any browser.

The idea behind this project is simple: Retrocomputing enthusiasts want to recreate their own nostalgic childhood computer experience, with some nice twits.  Back in 1980, a few chaps like me were passionate about coding on the Apple II+, and machine coding was the only way to get something done without throwing the already faint computing power of a CPU that was originally designed for pocket calculators.  This project is all about recreating some of the fun experiences, pimped-up with some contemporary features (like copy-paste).

Enjoy the beauty of 8-bit computing on a 6502 CPU, it's math tricks and deceivingly simple instruction set.  Alongside the development of this IDE, it is crucial to have a 6502 assembler codebase handy that can be edited, compiled, ran and debugged seamlessly.  Each of these functions have been conveniently knitted together in modules, represented in a tabbed view and formatted for reduced resolution screens, briefly described below.

## Getting started

1) Copy (locally, on your desktop) the entire repository or unzip the .zip package on your desktop
2) Open AppleII_IDE.html on any JavaScript capable browser
3) Inside the assembler, tap the **'generate'** button
4) Tap the **'to emulator'** button
5) Inside the emulator, tap the **'paste'** button
6) Type **G6000** to run the code at address 6000h, that's it !

<img src="/res/Start_Step1.png?raw=true" width=46% /><img src="/res/Start_Step2.png?raw=true" width=50% />

<br>
Other assembler listings can be found in this folder https://github.com/flyingzebra/AppleII-IDE/tree/main/asm_code_examples, feel free to copy any of those in the left pane of the assembler and procedd as described above.

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

[EMULATOR.md](https://github.com/RetroAppleJS/AppleII-IDE/blob/main/docs/EMULATOR.md)  
[DEBUGGER.md](https://github.com/RetroAppleJS/AppleII-IDE/blob/main/docs/DEBUGGER.md)  
[ASSEMBLER.md](https://github.com/RetroAppleJS/AppleII-IDE/blob/main/docs/ASSEMBLER.md)   
[6502.md](https://github.com/RetroAppleJS/AppleII-IDE/blob/main/docs/6502.md)  
[ZEROPAGE_APPLE2PLUS.md](https://github.com/RetroAppleJS/AppleII-IDE/blob/main/docs/ZEROPAGE_APPLE2PLUS.md)  
[TOOLS.md](https://github.com/RetroAppleJS/AppleII-IDE/blob/main/docs/TOOLS.md)  

Note that the markdown files here above must be compiled by a tool called [Docs_updater.html](https://github.com/RetroAppleJS/AppleII-IDE/blob/main/tools/Docs_updater.html), into a JavaScript file included in the main application, called _\_GENERATED_DOCS.js_ located [here](https://github.com/flyingzebra/AppleII-IDE/tree/main/docs). In short, do not manually update this JavaScript file.

## Feature wish-list

- [ ] better top-menu tabbing function (using _URI fragment identifiers_, enabling module stickiness or direct URL to module)
- [ ] better document assembler code located in asm_code_examples
- [ ] better compatibility with listings from different Apple II assemblers (except virtual mnemonics)
- [ ] pasteboard scripting supporting keyboard/paddle/mouse recording, playback events and conditional stops
- [ ] interactive Apple II+ pop-up keyboard
- [ ] save disk image, and perhaps tweak the diskdrive into booting non-bootable disks (on a second drive)
- [x] develop documentation tool to generate HTML from Markdown-formatted files
- [ ] apple sound, including diskdrive noise
- [ ] paddle/mouse capture
- [ ] lo-res and hi-res graphics conversion tool (including dithering and color optimization algorithms)
- [ ] real-time camera capture tool (QuickCam emulation ? http://schmenk.is-a-geek.com/wordpress/?p=17)
- [ ] macro script runner (emulating keyboard & paddle control)
- [ ] complete zero-page documentation (ZEROPAGE_APPLE2PLUS.md)

## Contribute

This project is build with HTML/JavaScript, CSS, Markdown documentation and 6502 assembler source code.  Contributions in any of these fields are welcome.
