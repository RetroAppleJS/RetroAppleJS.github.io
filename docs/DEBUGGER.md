# DEBUGGER Instructions
 
## The Display
The display shows all (yes its all there is) registers of a 6502/6510 CPU:

  	PC	....	Program Counter
  	A	....	Accumulator
  	X	....	X Register
  	Y	....	Y Register
  	SR	....	Status Register
  	SP	....	Stack Pointer
   
The status register (SR) holds the following flags (from bit 7 to 0):

  	N	....	Negative
  	V	....	Overflow
  	–	....	ignored
  	B	....	Break
  	D	....	Decimal
  	I	....	Interrupt (IRQ disable)
  	Z	....	Zero
  	C	....	Carry
The line disassembler shows the current value of PC, the content of the according memory address (the next instruction followed by the operands, if any), and a disassembly of this instruction.

The cycle time display shows the ticks of exceeded CPU time (including extra cycles for branches page transitions).

## Setting the Registers
Click a registers label to set its value.
Click on a SR flag to flip its value.

## Memory
The emulator implements 64 k of memory for the full 16 bit address range.
The 6502's stack of 1 k range is located at 0100 to 01FF (hard wired).

## Accessing the Memory
The button "look up mem #" offers a quick inspection of a 16 byte range around any address.
You may enter any amount of hex code into the memory inspector's pane and load it to the specified start address.
Further the memory inspector lets you inspect the memory in steps of 128 (0x80) bytes (half page). You may alter the display's content and load it back the emulator's memory. (Any figures prefixed by a colon ":" are ignored as line numbers.)
The "show ASCII" option shows the according ASCII characters at the left of each line (if applicable). Uncheck this when transfering memory to the disassembler.
Last there's an option to load the ROMs of the Commodore 64 (® CBM) to the according addresses (A000-BFFF, D000-FFFF) – for all those who can't help nostalgia. (Note: The emulator does not implement the C64's bank switching feature.)

 
## About the Debugger
The emulator is written in JavaScript and emulates a 65xx-family micro processor unit that was the heart of so popular micro computers as the Apple II (6502) or the Commedore 64 (6510). The most common types, the 6502 and 6510 processors, are basicly the same and share the same instruction tables. (The 6510 varies from 6502 only in the implementation of 6 I/O ports at addresses 0000 and 0001.)
The emulator implements all legal instructions. Undefined opcodes are ignored (treated as NOP, No OPeration, with cycle time 0) – no pseudo-opcodes are implemented.
