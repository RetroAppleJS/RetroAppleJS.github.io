## PERIPHERAL developers instructions

Apple II machines all rely on the principle of **memory-mapped I/O**.  An address decoder wired to the address bus is designed to activate RAM and ROM **chip-select** pins, this is how the CPU prepares its usual access to memory.  While several address ranges are mapped for reading text and video data, our focus here goes to decoder logic that senses any address on the bus (on most Apple IIs ranging between C000-$CFFF), 12 bits or 4K worth of this address space is reserved for **selecting I/O pins** on the motherboard.  This is where our code journey starts: **EMU_apple2hw.js** emulates the motherboard function, including this address decoder logic.  So, lets take a step back before going hands-on with peripherals.

## EMU_apple2hw.js = motherboard hardware controller



A simple binary (mask and filter) operation can help us detect addresses within I/O range.  (adr & 0xF000 ^ 0xC000 == 0).  In order to make address decoding configurable but still comutationally efficient for an emulator, we will need to be a bit more creative (worth a code review).  The methods inside the hardware component **EMU_apple2hw.js** demonstrates a few simple functions: read(addr) and write(addr) the databus at a specific address, reset() and restart() respectively acting upon warm and cold boot (randomizing RAM registers).



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

