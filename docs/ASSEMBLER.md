## ASSEMBLER Instructions
This is a simple 2 pass assembler for the 65xx microprocessor. It is thought to accompany the emulator To get your source code compiled:
1. Enter your src in "source code" pane.
2. Click the button "assemble".
3. Watch progress in "listing" pane.
4. Copy the object code "to emulator" or "to debugger"<br>

### Syntax reference

Unlike other 6502 assemblers; this retrocomuting project was characterised to support a multitude of assembler syntaxes, allowing to copy old listings from internet sources and old magazines and bring them back to life. Whereas the notation of 6502 commands remains constant between compilers, pragmas, also called assembler directives can be quite distinct in nature. In this journey we're making an attempt to support the following well-documented macro-assemblers available for the 6502 microprocessor: [ca65](https://cc65.github.io/doc/ca65.html?utm_source=chatgpt.com), [Macroassembler AS (ASL)](https://forum.6502.org/viewtopic.php?f=2&t=8223), [DASM](https://forums.atariage.com/topic/27221-session-9-6502-and-dasm-assembling-the-basics/?utm_source=chatgpt.com), [Merlin](https://mirrors.apple2.org.za/ftp.apple.asimov.net/documentation/applications/misc/Merlin%20-%20A%20Macro%20Assembler%20%28SDS%2C%201983%29%20OCR.pdf) and [MAC/65](https://www.mixinc.net/atari/mac65.htm).


## ASSEMBLER Pragmas

| Argument | Description                                  |
| :------- | :------------------------------------------- |
| adrw     | address bus width                            |
| bpe      | bits per element                       |
| csv      | 0=single (default)<br>1=comma separated      |
| typ      | exp = expression (default), hex = hex number |


| [DIRECTIVE] | Arguments                    | Done               | (Partial) / Full<br>support | Description           | |
| :---------- | :--------------------------- | :----------------- | :-------------------------: | :-------------------- | |
| .BYTE,DFB   | E { __csv__:{__typ__:exp, __bpe__:8}}             | :heavy_check_mark:          | ca65,Merlin           | [link](https://cc65.github.io/doc/ca65.html#ss11.10)  |
| .ORG,ORG,*= | E { __exp__:{__bpe__:adrw}                        | :heavy_check_mark:          | ca65                  | [link](https://cc65.github.io/doc/ca65.html#.ORG) |
| HEX         | E { __ssv__:{__typ__:hex,__bpe__:8}               | :heavy_check_mark:          | Merlin                |  |
 
#### Opcodes and Addressing
Opcodes are always 3 letter mnemonics followed by an (optional) operand/address:

      OPC         ....	implied                 (mode 0)
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
Where HHLL is a 16bit word and LL or BB an 8 bit byte, and A is Accumulator (not mandatory unless ambiguous).
There must not be any white space in any part of an instruction's address.
 
#### Number Formats
  	$[0-9A-Fa-f] ....	hex
 	%[01]        ....	binary
 	0[0-7]       ....	octal
 	[0-9]        ....	decimal
 	<            ....	LO-byte portion
 	>            ....	HI-byte portion
 
#### Labels and Identifiers
Identifiers must begin with a letter [A-Za-z] and contain capital or lowercase letters, digits, and the underscore [A-Za-z0-9_]. Only the first 6 characters are significant.

All identifiers, numbers, opcodes, and pragmas are case insensitive and translated to upper case. Identifiers must not be the same as valid opcodes.

The special identifier "*" refers to the program counter (PC).

##### Examples
      ORG $C000            ....	Set start address (PC) to C000.
      LABEL1 LDA #4        ....	Define LABEL1 with address of instruction LDA.
             BNE LABEL2    ....	Jump to address of label LABEL2.
      STORE  EQU $0810     ....	Define STORE with value $0810.
      HERE   EQU *         ....	Define HERE with current address (PC).
      HERE2                ....	Define HERE2 with current address (PC).
             LDA STORE     ....	Load LO-byte of STORE having value $10.

#### Pragmas
  	Pragmas start with a dot (.) and must be the only expression in a line:
  	.BYTE BB	....	Insert 8 bit byte at current address into code.
  	.WORD HHLL	....	Insert 16 bit word at current address into code.
      .AT /ABC/   ....  Insert Ascii string Terminated
  	.END        ....	End of source, stop assembly. (optional)
 
#### Comments
  	; comment	....	Any sequence of characters after a semicolon util end of the line is ignored.
 
#### White Space
  	The assembler does not rely on any special formatting with following exclusion:
There must be white space between a label and a opcode and the opcode and any operands. Only one instruction per line is permitted.

#### Code Example
 
##### Src:

      ORG $C000
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

      *= $C000
      C000        LDX #$00    A2 00
      C002 Label1 TXA         8A
      C003        STA $0400,X 9D 00 04
      C006        LDA #$01    A9 01
      C008        STA $D800,X 9D 00 D8
      C00B        INX         E8
      C00C        BNE $C002   D0 F4
      C00E        RTS         60
      C00F        .END
      done.

##### Object Code:
      A2 00 8A 9D 00 04 A9 01
      9D 00 D8 E8 D0 F4 60

## FEATURE wish-list

.DFB or .DB  = **D**e**F**ine **B**yte *(borrowed from Merlin-16)*
##### Example:
      .DFB expression,expression,expression,...
      
.DS  = **D**efine **S**torage *(borrowed from Merlin-16)*
##### Example:
      .DS expression1                ; zero out [expression1] bytes of memory
      .DS expression1,expression2    ; put [expression2] in [expression1] bytes of memory
      .DS \                          ; zero out until next page of memory
      .DS \,expression2              ; put [expression2] until next page of memory
