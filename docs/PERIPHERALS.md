## PERIPHERAL interfacing Explained

As we can ignore the electrical and signal layer of the peripheral interface, our only real concern is software compatibility.
We only need to mind about the memory map dedicated to I/O, called memory-mapped I/O, which is exactly 4K wide  (between $C000 - $D000). Here is an enlarged map of this memory space :

          <div style=width:800px>
     D000 ┌────────────────────────────────────┐   ▲                  ▲
          │                                    │   │                  │
          │   Open for large ROM programs      │  2048 Bytes HOST ROM │
          │   Activated by I/O strobe (pin 20) │   │                  │
          │                                    │   │                  │
     C800 ├────────────────────────────────────┤  ─┘                  │
          │                                    │   ▲                  │
          │  RAM/ROM open for slot#7           │   │                  │
          │                                    │  256 Bytes SLOT ROM  │
     C700 ├────────────────────────────────────┤  ─┘                  │
          │                                    │   ▲                  │
          │  RAM/ROM open for slot#6           │   │                  │
          │                                    │  256 Bytes SLOT ROM  │
     C600 ├────────────────────────────────────┤  ─┘                 4096 bytes
          │                                    │   ▲                  │
          │  RAM/ROM open for slot#5           │   │                  │
          │                                    │  256 Bytes SLOT ROM  │
     C500 ├────────────────────────────────────┤  ─┘                  │
          │                                    │   ▲                  │
          │  RAM/ROM open for slot#4           │   │                  │
          │                                    │  256 Bytes SLOT ROM  │
     C400 ├────────────────────────────────────┤  ─┘                  │
          │                                    │   ▲                  │
          │  RAM/ROM open for slot#3           │   │                  │
          │                                    │  256 Bytes SLOT ROM  │
     C300 ├────────────────────────────────────┤  ─┘                  │
          │                                    │   ▲                  │
          │  RAM/ROM open for slot#2           │   │                  │
          │                                    │  256 Bytes SLOT ROM  │
     C200 ├────────────────────────────────────┤  ─┘                  │
          │                                    │   ▲                  │
          │  RAM/ROM open for slot#1           │   │                  │
          │  (No mem mapped for slot#0)        │  256 Bytes SLOT ROM  │
     C100 └────┬───────────────────────────────┤  ─┘                  │
          C0F0 │ I/O slot #7  ─┐               │   ▲                  │
          C0E0 │ I/O slot #6  ─┘ 16 Bytes      │   │                  │
          C0D0 │ I/O slot #5                   │  128 Bytes SLOT I/O  │
          C0C0 │ I/O slot #4     X 8           │   │                  │
          C0B0 │ I/O slot #3                   │   │                  │
          C0A0 │ I/O slot #2                   │   │                  │
          C090 │ I/O slot #1                   │   │                  │
          C080 │ I/O slot #0                   │   │                  │
     C080 ┌────┴───────────────────────────────┤  ─┘                  │
          │  Built-in I/O locations            │   ▲                  │
          │  (keyboard,speaker,casette,game..  │  128 Bytes HOST I/O  │
     C000 └────────────────────────────────────┘  ─┘                  ▼
  

          </div>
         
## The 16K Language cards

We will discuss two similar cards, with the same functions and same soft switches.
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

