## ASSEMBLER Instructions
This is a simple 2 pass assembler for the 65xx microprocessor. It is thought to accompany the emulator To get your source code compiled:
1. Enter your src in "source code" pane.
2. Click the button "generate".
3. Watch progress in "listing" pane.
4. Copy code from "object code" pane.<br>

### Syntax
The assembler supports the following syntax:

#### Opcodes and Addressing
Opcodes are always 3 letter mnemonics followed by an (optional) operand/address:

      OPC         ....	implied
      OPC A       ....	Accumulator             (mode 1)
      OPC #BB     ....	immediate               (mode 2)
      OPC HHLL    ....	absolute                (mode 3)
      OPC HHLL,X  ....	absolute, X-indexed     (mode 4)
      OPC HHLL,Y  ....	absolute, Y-indexed     (mode 5)
      OPC *LL     ....	zeropage                (mode 6)
      OPC *LL,X   ....	zeropage, X-indexed     (mode 7)
      OPC *LL,Y   ....	zeropage, Y-indexed     (mode 8)
      OPC (BB,X)  ....	X-indexed, indirect     (mode 9)
      OPC (LL),Y  ....	indirect, Y-indexed     (mode 10)
      OPC (HHLL)  ....	indirect                (mode 11)
      OPC BB      ....	relative                (mode 12)
Where HHLL is a 16bit word and LL or BB an 8 bit byte, and A is literal "A".
There must not be any white space in any part of an instruction's address.
 
#### Number Formats
  	$[0-9A-Fa-f] ....	hex
 	%[01]        ....	binary
 	0[0-7]       ....	octal
 	[0-9]        ....	decimal
 	<            ....	LO-byte portion
 	>            ....	HI-byte portion
 
#### Labels and Identifiers
Identifiers must begin with a letter [A-Z] and contain letters, digits, and the underscore [A-Z0-9_]. Only the first 6 characters are significant.

All identifiers, numbers, opcodes, and pragmas are case insensitive and translated to upper case. Identifiers must not be the same as valid opcodes.

The special identifier "*" refers to the program counter (PC).

##### Exampels:
 	* = $C000       ....	Set start address (PC) to C000.
    org $C000     ....	(idem)
    LABEL1 LDA #4 ....	Define LABEL1 with address of instruction LDA.
    BNE LABEL2    ....	Jump to address of label LABEL2.
    STORE = $0800 ....	Define STORE with value 0800.
    HERE = *      ....	Define HERE with current address (PC).
    HERE2         ....	Define HERE2 with current address (PC).
    LDA #         ....	Load LO-byte of VAL1.
 
#### Pragmas
  	Pragmas start with a dot (.) and must be the only expression in a line:
  	.BYTE BB	....	Insert 8 bit byte at current address into code.
  	.WORD HHLL	....	Insert 16 bit word at current address into code.
  	.END	....	End of source, stop assembly. (optional)
 
#### Comments
  	; comment	....	Any sequence of characters after a semicolon util end of the line is ignored.
 
#### White Space
  	The assembler does not rely on any special formatting with following exclusion:
There must be white space between a label and a opcode and the opcode and any operands. Only one instruction per line is permitted.

#### Code Example
 
##### Src:
    *=$c000
  	       LDX #0
  	Label1 TXA
  	       STA $0400,X
           LDA #1
           STA $D800,X
           INX
           BNE Label1
           RTS
    .END
    
##### Listing:
     *=$C000
     C000        LDX #$00        A2 00
     C002 LABEL1 TXA             8A
     C003        STA $0400,X     9D 00 04
     C006        LDA #$01        A9 01
     C008        STA $D800,X     9D 00 D8
     C00B        INX             E8
     C00C        BNE LABEL1      D0 F4
     C00E        RTS             60
      C00F .END

##### Object Code:
      A2 00 8A 9D 00 04 A9 01
      9D 00 D8 E8 D0 F4 60
