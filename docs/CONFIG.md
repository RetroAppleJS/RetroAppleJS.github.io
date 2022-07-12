# CAUTION

This file was designed to contain elements to be read by an update script ([ConfigFile_updater.html](../tools/ConfigFile_updater.html)), which  
* converts all relevant markdown (.md) files to HTML format  
* converts all the default configuration settings here below into JSON structures  

And outputs all this data into a single JavaScript include file ([COM_CONFIG.js](../res/COM_CONFIG.js))  
Any change in this document affects the **default application configuration**, or ultimately may cause [ConfigFile_updater.html](../tools/ConfigFile_updater.html) dysfunction !


# DOCUMENTATION  
[EMULATOR.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/EMULATOR.md)  
[DEBUGGER.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/DEBUGGER.md)  
[ASSEMBLER.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/ASSEMBLER.md)   
[6502.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/6502.md)  
[ZEROPAGE_APPLE2PLUS.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/ZEROPAGE_APPLE2PLUS.md)  
[PERIPHERALS.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/PERIPHERALS.md)  
[TOOLS.md](https://github.com/RetroAppleJS/RetroAppleJS.github.io/blob/main/docs/TOOLS.md) 

# PERIPHERALS LIST

|[PCODE]| name                                   | IOrange \*          | ROMrange \*     | SLOT_range   | Manuals       |
| :-----: | :----------------------------------- | :------------------ | :-------------- | :------------|:------------- |
| MS16K   | Microsoft 16K Language card          | $C080,$C08F         |                 | 0            |               | 
|DiskII   | Apple Disk II Floppy Disk Subsystem  | $C0(8+n)0,$C0(8+n)F | $C(n)00, $C(n)FF| 1,2,3,4,5,6,7| [user manual](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Peripherals/Disk%20Drives/Apple%20Disk%20II/Manuals/Apple%20Disk%20II%20Floppy%20Disk%20Subsystem%20-%20Installation%20and%20Operating%20Manual.pdf) |


\* n = slot number on which the card is installed

# SLOT CONFIG

|[SLOT#] | PCODE      | description       |
| :----: | :--------- | :---------------- |
|   0    | MS16K      |                   | 
|   1    |            |                   |
|   2    |            |                   |
|   3    |            |                   |
|   4    |            |                   |
|   5    |            |                   |
|   6    | DiskII     |                   |
|   7    |            |                   |

