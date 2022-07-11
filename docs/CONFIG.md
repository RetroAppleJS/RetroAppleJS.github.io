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

| CODE    | NAME                                 | I/O range   | ROM range | Slot range | User manual URL   | Description       |
| :-----: | ------------------------------------ | ----------  | --------- | -----------|------------------ | ----------------- |
| MS16K   | Microsoft 16K Language card          | $C8n00, 16B |           | #0         |                   |                   |
|Disk \]\[| Apple Disk II Floppy Disk Subsystem  | $C8n00, 16B |           | #0-#7      |                   |                   |


# SLOT CONFIG

| SLOT  | PERIPHERAL | Description       |
| :---: | ---------- | ----------------- |
|  #0   | MS16K      |                   | 
|  #1   |            |                   |
|  #2   |            |                   |
|  #3   |            |                   |
|  #4   |            |                   |
|  #5   |            |                   |
|  #6   | Disk \]\[  |                   |
|  #7   |            |                   |
