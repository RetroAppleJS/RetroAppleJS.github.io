## PERIPHERAL interfacing Explained

Peripheral emulation is usually easier to achieve compared to building real hardware, as we can ignore the electrical and signal or logic layer including a major part of the electronic circuitry.  Our only real concern is software compatibility, which comes down to minding about the entire memory map dedicated to I/O, which is exactly 4K wide  (between $C000 - $D000). Here is an enlarged map of this memory space :

          <div style=width:800px>
     D000 ┌────────────────────────────────────┐   ▲                  ▲
          │                                    │   │                  │
          │   Open for large ROM programs      │  2048 bytes          │
          │   Activated by I/O strobe (pin 20) │   │                  │
          │                                    │   │                  │
     C800 ├────────────────────────────────────┤  ─┘                  │
          │                                    │   ▲                  │
          │  RAM/ROM open for slot#7           │   │                  │
          │                                    │  256 bytes           │
     C700 ├────────────────────────────────────┤  ─┘                  │
          │                                    │   ▲                  │
          │  RAM/ROM open for slot#6           │   │                  │
          │                                    │  256 bytes           │
     C600 ├────────────────────────────────────┤  ─┘                 4096 bytes
          │                                    │   ▲                  │
          │  RAM/ROM open for slot#5           │   │                  │
          │                                    │  256 bytes           │
     C500 ├────────────────────────────────────┤  ─┘                  │
          │                                    │   ▲                  │
          │  RAM/ROM open for slot#4           │   │                  │
          │                                    │  256 bytes           │
     C400 ├────────────────────────────────────┤  ─┘                  │
          │                                    │   ▲                  │
          │  RAM/ROM open for slot#3           │   │                  │
          │                                    │  256 bytes           │
     C300 ├────────────────────────────────────┤  ─┘                  │
          │                                    │   ▲                  │
          │  RAM/ROM open for slot#2           │   │                  │
          │                                    │  256 bytes           │
     C200 ├────────────────────────────────────┤  ─┘                  │
          │                                    │   ▲                  │
          │  RAM/ROM open for slot#1           │   │                  │
          │  (No mem mapped for slot#0)        │  256 bytes           │
     C100 └────┬───────────────────────────────┤  ─┘                  │
          C0F0 │ I/O slot #7  ─┐               │   ▲                  │
          C0E0 │ I/O slot #6  ─┘ 16 bytes      │   │                  │
          C0D0 │ I/O slot #5                   │  128 bytes           │
          C0C0 │ I/O slot #4     X 8           │   │                  │
          C0B0 │ I/O slot #3                   │   │                  │
          C0A0 │ I/O slot #2                   │   │                  │
          C090 │ I/O slot #1                   │   │                  │
          C080 │ I/O slot #0                   │   │                  │
     C080 ┌────┴───────────────────────────────┤  ─┘                  │
          │  Built-in I/O locations            │   ▲                  │
          │  (keyboard,speaker,casette,game..  │  128 bytes           │
     C000 └────────────────────────────────────┘  ─┘                  ▼
  

          </div>
         
## The Language card (16K)

[Apple Language Card](http://www.applelogic.org/files/LANGCARDMAN.pdf)
[Microsoft Ramcard](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Interface%20Cards/Memory/Microsoft%20RAMCard/Manuals/)

[Apple II+ motherboard schematics](https://archive.org/details/Schematic_Diagram_of_the_Apple_II/page/n1/mode/2up)
TODO: check which chip has to be removed, and to which address locations this chip corresponds.

Card Memory map

          <div style=width:800px>
     FFFF ┌────────────────┐----->┌───────────────┐
          │                │      │               │
          │  APPLE         │      │  RAMCARD RAM  │
          │  ROM           │      │  4K           │
     E000 │                │----->├───────────────┤
          │                │      │               │               
          │                │      │  BANK 1 or 2  │ 
          │                │      │  (switchable) │    
     D000 ├────────────────┤----->└───────────────┘
          │                │  
          │                │
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
