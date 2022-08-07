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

# EMULATOR

## SYSTEMS LIST

|[SCODE]| Model              | CPU        | Speeds    |
| :---: | :----------------- | :--------- | :-------- |
| A1    | Apple I            | 6502       | 1.023     |
| A2    | Apple II           | 6502       | 1.023     |
| A2P   | Apple II Plus      | 6502       | 1.023     |
| A2E   | Apple IIc EuroPlus | 6502       | 1.023     |
| A2J   | Apple IIc J-Plus   | 6502       | 1.023     |
| A2B   | Bell & Howell      | 6502       | 1.023     |
| A3    | Apple III          | 6502B      | 1.8       |
| A3R   | Apple III Revised  | 6502B      | 1.8       |
| A2e   | Apple IIe          | 6502       | 1.023     |
| A2c   | Apple IIc          | 65C02      | 1.023     |
| A3P   | Apple III Plus     | 6502B      | 1.8       |
| A2N   | Apple IIe Enhanced | 65C02      | 1.023     |
| A2G   | Apple IIGS         | 65C816     | 2.8       |
| A2c   | Apple IIc MemoryExp| 65C02      | 1.023     |
| A2G3  | Apple IIGS ROM3    | 65C816     | 2.8       |
| A2eP  | Apple IIe Platinum | 65C02      | 1.023     |
| A2eC  | Apple IIe Card     | 65C02      | 1.023,1.9 |


## PERIPHERALS LIST

|[PCODE]| NAME                                   | ROMrange\*      | SLOTrange    | SYSrange    | Manuals       |
| :-----: | :----------------------------------- | :-------------- | :------------|:----------- |:------------- |
| MS16K   | Microsoft 16K Language card          |                 | 0            | A2,A2P,A2E  |               | 
| DISKII  | Apple Disk II Floppy Disk Subsystem  |     $Cn00, $CnFF| 1,2,3,4,5,6,7| A2,A2P,A2E  | [user_manual](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Peripherals/Disk%20Drives/Apple%20Disk%20II/Manuals/Apple%20Disk%20II%20Floppy%20Disk%20Subsystem%20-%20Installation%20and%20Operating%20Manual.pdf),[technical_manual](https://www.bigmessowires.com/2021/11/12/the-amazing-disk-ii-controller-card/) |


\* n = slot number on which the card is installed

## SLOT CONFIG

|[SLOT#] | PCODE      | DESCRIPTION       |
| :----: | :--------- | :---------------- |
|   0    | MS16K      |                   | 
|   1    |            |                   |
|   2    |            |                   |
|   3    |            |                   |
|   4    |            |                   |
|   5    |            |                   |
|   6    | DISKII     |                   |
|   7    |            |                   |

# ASSEMBLER

## TRANSPILER

|[TFUNCTION]    | COMPILER  | REGXEP_INPUT                    | REGEXP_OUTPUT                       |
| :-----------: | :-------- | :------------------------------ | :---------------------------------- |
|    .eq        | SourceGen | \\x20\\.eq\\x20                 | 'EQU'                               | 
|    .var       | SourceGen | \\x20\\.var\\x20                | 'EQU'                               | 
|    .org       | SourceGen | \\x20\\.org\\x20                | 'ORG'                               |
|   .str        | SourceGen | \\x20\\.str\\x20                | 'ASC'                               |
| remove'{...}' | SourceGen | \\{[^{}]*\\}                    | ''                                  |
| upper(_3_)    | SourceGen |( [abcdeijlnoprst][abcdehijlmnoprstvxy][acdeiklpqrstvxy] )|x.toUpperCase()|
| upper(_3)     | SourceGen |( [abcdeijlnoprst][abcdehijlmnoprstvxy][acdeiklpqrstvxy])$|x.toUpperCase()|
| upper(3_)     | SourceGen |^([abcdeijlnoprst][abcdehijlmnoprstvxy][acdeiklpqrstvxy] )|x.toUpperCase()|
| upper(3)      | SourceGen |^([abcdeijlnoprst][abcdehijlmnoprstvxy][acdeiklpqrstvxy])$|x.toUpperCase()|
| hex array     | SourceGen | \\$([0-9A-Fa-f][0-9A-Fa-f][, ]) |x.substring(1,3).toUpperCase()+' '   |
|    .bulk      | SourceGen | \\x20\\.bulk\\x20               | 'HEX'                               |
|    +          | SourceGen | \\x20\\+\\x20\\x20\\x20         | 'HEX'                               |
|    *          | SourceGen | ^\\*                            | ';*'                                |
|  ALL upper    | SourceGen | ^((?!;).)*$                     |                                     |


