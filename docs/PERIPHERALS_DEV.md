## PERIPHERAL developers instructions

Apple II machines all rely on the principle of **memory-mapped I/O**, and this mapping job is done by line decoders.  An address line decoder wired to the address bus is designed to target RAM and ROM **chip-select** pins, this is how the CPU prepares its usual access to memory.  While several address ranges are mapped for reading text and video data, our focus goes to decoder logic on the modherboard that senses specific bit combinations on the databus (on most Apple IIs ranging between C000-$CFFF) reserved for **selecting I/O pins, and switch to one of the tri-state options** (OUTPUT 1 = switching pin to power vcc, OUTPUT 0 = switching pin to ground, INPUT HiZ = switching pin to High Impedance, turning I/O pin electrically into a sensor) .  This is where our code journey starts. 


## EMU_apple2hw.js - emulating the motherboard

### Address line decoder

While we could design a piece of code with numerous "if-then" or "switch-case" statements, no emulator can afford wasting much processing power or memory space dispatching configurable address ranges to RAM, ROM, VIDEO, TEXT and I/O operations.  To save computing power and memory emulating any such complex decision-making matrix, a **granular lookup table** could do quite a great job.   Routing ROM, RAM, VIDEO, and I/O address ranges to the right emulator component are coarse-grain decisions, while function calls behind I/O pins are typically fine-grain. 
FYI, without granularity, a bit-level mapping on a 16-bit address bus would take (2 ^ 16) = 65536  addressable bytes * 8 bits per Byte = 524288 bits, while the identifier for each element itself 19 bits (2^19 = 524288), rounded-up to 32 bits or 4 Bytes, a single fine-grain lookup table would cost 524288 elements * 4 bytes = 2MB; clearly not justifiable.
Let's extrapolate given Apple II ranges by example into **fitting granularities**:

| RangeID | Range name    | Range       | Routed by       | Via     | Granularity in Bytes | 
| ------- | ------------- | :---------: | :-------------- | :------ | :---------: | 
|       0 | RAM           | $0000>$03FF | EMU_apple2hw.js | local   | $100        |
|       1 | TEXT          | $0400>$0BFF | EMU_apple2hw.js | **1a**  | $100        |
|       2 | RAM           | $0C00>$1FFF | EMU_apple2hw.js | local   | $100        |
|       3 | VIDEO         | $2000>$5FFF | EMU_apple2hw.js | **1b**  | $1000       |
|       4 | RAM           | $6000>$BFFF | EMU_apple2hw.js | local   | $1000       |
|       5 | HOST&nbsp;I/O | $C000>$C07F | EMU_apple2hw.js | **2**   | $100        |
|       6 | SLOT&nbsp;I/O | $C080>$CFFF | EMU_apple2hw.js | **3**   | $100        |
|       7 | ROM           | $D000>$FFFF | EMU_apple2hw.js | **4**   | $1000       |

A lookup table for **EMU_apple2hw.js** would need $100 = 256 Bytes to cover the finest grain.  A 16-bit line decoder with 65536 addressable Bytes at a granularity of 256 Bytes requires 65536 / 256 = 256 elements, and 8 RangeIDs.
We can design the lookup logic as follows: 

**lookup\[ address & $FF00 >> 8 \] = RangeID**

The lookup array would look like \[ 0,0,0, 1,1,1,1,1,1,1,1,1, 2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2 ,3,3,3,3,3,3,3,3... \]
A small test: let's assume the address bus is at $2000.

**index = $2000 & $FF00 >> 8 = $20 = 32**

**lookup\[ index \] = 3**



| Route          | Range       | Routed by         | To                                             | Granularity in Bytes |
| -------------- | :---------: | :---------------- | :--------------------------------------------- | :---------: |
| 1a             | $0400>$0BFF |                   | EMU_apple2GPU.js / EMU_apple2video.js          | $100        |        
| 1b             | $2000>$5FFF |                   | EMU_apple2GPU.js / EMU_apple2video.js          | $100        |
| 2              | $C000>$C07F | EMU_apple2io.js   | EMU_apple2spk.js / EMU_A2Pkeys.js              | $1          |
| 3              | $C080>$CFFF | EMU_apple2io.js   | any peripheral driver (e.g. EMU_appledisk2.js) | $1          |
| 4              | $D000>$FFFF | EMU_apple2roms.js | Optionally routed to EMU_ramcard.js / EMU_saturnRAM.js | $1000       |

The methods inside the hardware component **EMU_apple2hw.js** demonstrates a few simple functions: read(addr) and write(addr) the databus at a specific address, reset() and restart() respectively acting upon warm and cold boot (randomizing RAM registers).



[EMU_apple2hw.js](/res/EMU_apple2hw.js)
```javascript
this.read = function(type)
{
      
}
```

```javascript
this.write = function(type) {
      
}
```

         
## The 16K Language card(s)

We will discuss two slightly different cards, both having the same functions and soft switches.
* [Apple Language Card](http://www.applelogic.org/files/LANGCARDMAN.pdf)  
* [Microsoft Ramcard](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/Language%20Cards/Microsoft%2016K%20RAM%20Card/Manuals/Microsoft%20RAMCard%20-%20Manual.pdf)  
* [Applied Engineering - Pocket Rocket RamCard](https://usermanual.wiki/Document/ae16kpocketrocketbrochure.1819483971.pdf)

The only difference between Apple vs Microsoft and others, is that the Apple card overrides KICKSTART ROM addresses F800-FFFF permanently, which only served as a ROM upgrade for old Apple II's. As we emulate the Apple II+, the Kickstart ROM on Apple Language card is bit-by-bit equal with the Kickstart ROM shipped with the Apple II+.  All other functions are identical.

[Apple II+ motherboard schematics](https://archive.org/details/Schematic_Diagram_of_the_Apple_II/page/n1/mode/2up)
TODO: check which chip has to be removed, and to which address locations this chip corresponds.

Language Card Memory map

          <div style=width:800px>
     FFFF ┌────────────────┐ - - >┌───────────────┐ - -▲    ▲
          │  KICKSTART ROM │      │               │    │    │
     F800 ├────────────────┤      │  RAMCARD RAM  │    8K   │
          │  APPLE ROM     │      │               │    │    │
     E000 │                │ - - >├───────────────┤    ▼    │ 16K    
          │                │      │  BANK A or B  │    ▲    │
          │                │      │  (switchable) │  2 X 4K │
     D000 ├────────────────┤ - - >└───────────────┘ - -▼    ▼ 
          │ large ROM prog │                           ▲ 
          │  (unused)      │                           ▼ 2K
     C800 ├────────────────┤- - - - - - - - - - - - - -          
          │  SLOT ROM/RAM  │                
          │  (unused)      │              
          │                │             
     C100 └──┬─────────────┤                
        C0F0 │ I/O slot #7 │
        C0E0 │ I/O slot #6 │
        C0D0 │ I/O slot #5 │
        C0C0 │ I/O slot #4 │
        C0B0 │ I/O slot #3 │
        C0A0 │ I/O slot #2 │
        C090 │ I/O slot #1 │     ┌─────────────────┐   
        C080 │ I/O slot #0 ├─────┤ 8 soft switches │
             └─────────────┘     └─────────────────┘  

          </div>
          
[video](https://www.youtube.com/watch?v=1KPIAoO1dTU)  
[schematics]( https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/Language%20Cards/Apple%20Language%20Card/Schematics/Apple%20Language%20Card%20-%20Schematics%20050-0019-01.pdf) 

|  Language card soft switches   |
| --------------------------------- |

| Address | ROM | RAMCARD | BANKA | BANKB | Description       |
| :-----: | --- |  ------ | ----- | ----- | ----------------- |
|  C080   |     |  R      |       |  R    | write-protect     | 
| *C081   |  R  |  W      |       |  W    | write (access 2x) |
|  C082   |  R  |         |       |       | ROM-only          | 
|  C083   |     |  R/W    |       |  R/W  | write (access 2x) |
|  C088   |     |  R      |  R    |       | write-protect     |
|  C089   |  R  |  W      |  W    |       | write (access 2x) |
|  C08A   |  R  |         |       |       | ROM-only          |
|  C08B   |     |  R/W    |  R/W  |       | write (access 2x) |

\* default setting after cold boot

### Testing

http://www.ivanhogan.com/kfest/MemUtil/

