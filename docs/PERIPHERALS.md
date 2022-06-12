## PERIPHERAL interfacing Explained

Peripheral emulation is usually easier to achieve compared to building real hardware, as we can ignore the electrical and signal or logic layer including a major part of the electronic circuitry.  Our only real concern is software compatibility, which comes down to minding about the entire memory map dedicated to I/O, which is exactly 4K wide  (between $C000 - $D000). Here is an enlarged map of this memory space :

          <div style=width:800px>
     D000 ┌────────────────────────────────────┐   ▲
          │                                    │   │
          │   Open for large ROM programs      │  2K
          │   Activated by I/O strobe (pin 20) │   │
          │                                    │   │
     C800 ├────────────────────────────────────┤  ─
          │                                    │   ▲
          │  RAM/ROM open for slot#7           │   │  
          │                                    │  1/4K
     C700 ├────────────────────────────────────┤  ─┘
          │                                    │   ▲
          │  RAM/ROM open for slot#6           │   │ 
          │                                    │  1/4K
     C600 ├────────────────────────────────────┤  ─┘
          │                                    │   ▲
          │  RAM/ROM open for slot#5           │   │
          │                                    │  1/4K
     C500 ├────────────────────────────────────┤  ─┘
          │                                    │   ▲
          │  RAM/ROM open for slot#4           │   │
          │                                    │  1/4K
     C400 ├────────────────────────────────────┤  ─┘
          │                                    │   ▲
          │  RAM/ROM open for slot#3           │   │
          │                                    │  1/4K
     C300 ├────────────────────────────────────┤  ─┘
          │                                    │   ▲
          │  RAM/ROM open for slot#2           │   │
          │                                    │  1/4K
     C200 ├────────────────────────────────────┤  ─┘
          │                                    │   ▲
          │  RAM/ROM open for slot#1           │   │
          │                                    │  1/4K
     C100 ├────────────────────────────────────┤  ─┘
          │  I/O Ports (0-7)                   │
     C080 ├────────────────────────────────────┤
          │  Built-in I/O locations            │
     C000 └────────────────────────────────────┘ 
  
          </div>
