## PERIPHERAL interfacing Explained

Peripheral emulation is usually easier to achieve compared to building real hardware, as we can ignore the electrical and signal or logic layer including a major part of the electronic circuitry.  Our only real concern is software compatibility, which comes down to minding about the entire memory map dedicated to I/O, which is exactly 4K wide  (between $C000 - $D000). Here is an enlarged map of this memory space :
