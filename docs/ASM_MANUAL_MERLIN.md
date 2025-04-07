Replace \n((.){0,60}(?<= ))
By \n$1\n

```
MERLIN Users Manual                        TABLE OF CONTENTS

              T A B L E   O F   C O N T E N T S
              ---------------------------------

1. INTRODUCTION........................................... 1
   1.1. Assembly Language Whys and Wherefores............. 1
   1.2. Backgrounds and Features.......................... 3
   1.3. Suggested Reading................................. 4
2. SYSTEM REQUIREMENTS.................................... 7
   2.1. Hardware Compatibility List....................... 7
3. BEGINNERS GUIDE TO USING MERLIN........................ 9
   3.1. Introduction...................................... 9
   3.2. Input............................................ 10
   3.3. System and Entry Commands........................ 13
   3.4. Assembly......................................... 10
   3.5. Saving and Running Programs...................... 18
   3.6. Making Back-up Copies of MERLIN.................. 19
4. EXECUTIVE MODE........................................ 21
   4.1. C:CATALOG........................................ 21
   4.2. L:LOAD........................................... 21
   4.3. S:SAVE........................................... 22
   4.4. A:APPEND......................................... 22
   4.5. D:DRIVE.......................................... 23
   4.6. E:EDITOR. ....................................... 23
   4.7. O:SAVE OBJECT CODE............................... 23
   4.8. Q:QUIT........................................... 24
   4.9. R:READ........................................... 24
   4.10. W:WRITE......................................... 25
5. THE EDITOR............................................ 27
   5.1. Command Mode..................................... 27
        5.1.1. HImem..................................... 27
        5.1.2. NEW....................................... 28
        5.1.3. PR#(O-7).................................. 28
        5.1.4. USER...................................... 28
        5.1.5. TABS...................................... 28
        5.1.6. LENgth.................................... 29
        5.1.7. Where..................................... 29
        5.1.8. MONitor................................... 29
```
```
        5.1.9. TRuncON................................... 30
        5.1.10. TRuncOFf................................. 30
        5.1.11. Quit..................................... 30
        5.1.12. ASM...................................... 30
        5.1.13. Control-D................................ 31
        5.1.12. Delete................................... 31
        5.1.15. Replace.................................. 31
        5.1.16. List..................................... 32
        5.1.17. . (period)............................... 32
        5.1.18. / (line number).......................... 32
        5.1.19. Print.................................... 32
        5.1.20. PRinTeR (command)........................ 33
        5.1.21. Find..................................... 33
        5.1.22. Change................................... 34
        5.1.23. COPY..................................... 34
        5.1.24. MOVE..................................... 34
        5.1.25. Edit..................................... 33
        5.1.26. Hex-Dec Conversion....................... 35
        5.1.27. TEXT..................................... 39
        5.1.28. FIX...................................... 30
        5.1.29. SYM...................................... 30
        5.1.30. VIDEO.................................... 36
        5.1.31. FW (Find Word)........................... 37
        5.1.32. CW (Change Word)......................... 37
        5.1.33. EW (Edit Word)........................... 38
        5.1.34. VAL...................................... 38
        5.2. Add/Insert Mode............................. 38
        5.2.10 Add....................................... 39
        5.2.2. Insert.................................... 39
        5.2.3. Control-L................................. 39
        5.3. Edit Mode................................... 40
        5.4. Edit Mode Commands.......................... 40
        5.4.1. Control=1 (insert)........................ 40
        5.4.2. Control-D (delete)........................ 40
        5.4.3. Control-F (find).......................... 40
        5.4.4. Control-O (insert special)................ 41
        5.4.5. Control-P (do ***)........................ 41
        5.4.6. Control-C (do border)..................... 41
        5.4.7. Control-C or Control-X (cancel)........... 42
        5.4.8. Control-B (go to line begin).............. 42
        5.4.9. Control-N (go to line end)................ 42
        5.4.10. Control-R (restore line)................. 42
        5.4.11. Control-Q (delete line right)............ 42
```
```
        5.4.12. Return (RETURN KeY)...................... 42

6. THE ASSEMBLER......................................... 43
   6.1. Number Format.................................... 45
   6.2. Source Code Format............................... 46
   6.3. Expressions...................................... 47
   6.4. Immediate Data................................... 48
   6.5. Addressing Modes (6502 Opcodes).................. 49
   6.6. Sweet 16 Opcodes................................. 50
   6.7  Pseudo Opcodes — Directives...................... 51
        6.7.1. EQU (=)................................... 51
        6.7.2. ORG....................................... 51
        6.7.3. OBJ....................................... 52
        6.7.4. PUT....................................... 52
        6.7.5. VAR. ..................................... 53
        6.7.6. SAV....................................... 53
        6.7.7. DSK....................................... 54
        6.7.8. END....................................... 54
   6.8. Formatting....................................... 55
        6.8.1. LST ON/OFF................................ 55
        6.8.2. EXP ON/OFF................................ 55
        6.8.3. PAU....................................... 56
        6.8.4. PAG....................................... 56
        6.8.5. AST....................................... 56
        6.8.6. SKP....................................... 56
        6.8.7. TR........................................ 57
   6.9. Strings.......................................... 57
        6.9.1. ASC....................................... 57
        6.9.2. DCI....................................... 57
        6.9.3. INV....................................... 58
        6.9.4. FLS....................................... 58
        6.9.5. REV....................................... 58
   6.10. Data and Allocation............................. 58
        6.10.1. DA....................................... 58
        6.10.2. DDB...................................... 59
        6.10.3. DFB...................................... 59
        6.10.4. HEX...................................... 60
        6.10.5. DS....................................... 60
        6.10.6. KBD...................................... 60
        6.10.7. LUP...................................... 61
        6.10.8. CHK...................................... 62
        6.10.9. ERR...................................... 62
        6.10.10. USR..................................... 63

```
```
MERLIN Users Manual                            THE ASSEMBLER

6. THE ASSEMBLER
----------------


This section of the documentation will not attempt to teach
you assembly language. It will only explain the syntax you
are expected to use in your source files, and document the
features that are available to you in the assembler.


6.1. Number Format

The assembler accepts decimal, hexadecimal, and binary
numerical data. Hex numbers must be preceded by "$" and
binary numbers by "%", thus the following four instructions
are all equivalent:

 LDA #100     LDA #$64    LDA #%1100100    LDA #%01100100

As indicated, leading zeros are ignored. The "#" here stands
for "number" or "data", and the effect of these instructions
is to load the accumulator with the number (decimal) 100.

A number not preceded by "#" is interpreted as an address.
Therefore:

    <LDA 1000     LDA $3E8      LDA %1111101000>
                                                            
are equivalent ways of loading the accumulator with the byte
that resides in memory location $3E8.

                                                          45
```
```
MERLIN Users Manual                            THE ASSEMBLER

Use the number format that is appropriate for clarity. For
example, the data table:

DA $1
DA $A
DA $64
DA $3E8
DA $2710

is a good deal more mysterious that its decimal equivalent :

DA 1
DA 10
DA 100
DA 1000
DA 10000

6.2. Source Code Format

A line of source code typically looks like:

     LABEL OPCODE OPERAND ;COMMENT

A line containing only a comment must begin with "*". Com-
ment lines starting with ";" are accepted and tabbed to the
comment field. The assembler will accept an empty line in
the source code and will treat it just as a SKP 1
instruction (see the section on pseudo opcodes), except the
line number will be printed.  The number of spaces
separating the fields is not important, except for the
editor's listing, which expects just one space.  The
maximum allowable LABEL length is 13 characters, but more
than 8 will produce messy assembly listings. A label must
begin with a character at least as large, in ASCII value, as
the colon, and may not contain any characters less, in ASCII
value, than the number zero.

                                                          46
```
```
MERLIN Users Manual                            THE ASSEMBLER

The assembler examines only the first 3 characters of the
OPCODE (with certain exceptions such as the Sweet 16 opcode
POPD). For example, you can use PAGE instead of PAG (because
of the exception, the fourth letter should not be a D,
however). The assembler listing will truncate the opcode to
seven letters and will not look well with one longer than
four unless there is no operand. The maximum allowable
combined OPERAND+COMMENT length is 64 characters. You will
get an error if you use more than this. A comment line by
itself is also limited to 64 characters.

6.3. Expressions

To make clear the syntax accepted and/or required by the
assembler, we must define what is meant by an "expression".
Expressions are built up from "primitive expressions" by
use of arithmetic and logical operations. The primitive
expressions are:

1. A label.
2. A decimal number.
3. A hexadecimal number (preceded by "$").
4. A binary number (preceded by "%").
5. Any ASCII character preceded, or enclosed by quotes or
   single quotes.
6. The character * (standing for the present address).

All number formats accept 16-bit data and leading zeros are
never required. In case 5, the "value" of the primitive
expression is just the ASCII value of the character.
The high-bit will be on if a quote (") is used, and off if
a single quote (') is used. The assembler supports the four
arithmetic operations: +, -, /, and *. It also supports the
three logical operations: ! = Exclusive OR, . = OR, and 
& = AND.
                                                          47
```                                                      
```
MERLIN Users Manual                            THE ASSEMBLER

Some examples of legal expressions are:
LABEL1-LABEL2
2*LABEL+$231
1234+%10111 
"K"-"A"+1
"Ø"!LABEL
LABEL&$7F
*- 2
LABEL. %10000000

Parentheses have another meaning and are not allowed in
expressions. All arithmetic and logical operations are done
from left to right (2+3*5 would assemble as 25 and not 17).

6.4. Immediate Data

For those opcodes such as LDA, CMP, etc., which accept im-
mediate data (numbers as opposed to addresses) the immediate
mode is signalled by preceding the expression with "#". An
example is LDX #3. In addition:

#<expression	produces the	low byte of the expression	
#>expression	produces the high byte of the expression		
#expression	    also gives the low byte (the 6502 does not
accept 2-byte DATA)
#/expression	is optional syntax for the high byte of the
expression

The ability of the assembler to evaluate expressions such
as LAB1-LA2-1 is very useful for the following type of code:

COMPARE	LDX	#FOUND-DATA-1
LOOP	CMP	DATA, X
        BEQ	FOUND
        DEX	
        BPL	LOOP
        JMP	REJECT ;not found
DATA	HEX	E3BC3498
FOUND	RTS	
                                                          48
```
```
MERLIN Users Manual                            THE ASSEMBLER

With this type of code, if you add or delete some of the
"Data", then the appropriate X-index for the comparison loop
is automatically adjusted.

6.5. Addressing Modes (6502 Opcodes)

The assembler accepts, all the 6502 opcodes with standard
mnemonics. It also accepts BLT (branch if less than) as an
equivalent to BCC, and BGE (branch if greater or equal) as
an equivalent to BCS.

There are 12 addressing modes on the 6502. The appropriate
MERLIN syntax for these are:

                    Example
                    -------

Syntax                                                               
Implied             OPCODE          CLC                      
Accumulator         OPCODE          ROR                      
Immediate (data)    OPCODE #expr    ADC   #$F8               
                                    CMP   #"M"               
                                    LDX   #>LABEL1-LABEL2-1
Zero page (address) OPCODE expr     ROL   6                  
Indexed X           OPCODE expr,X   LDA   $EØ,X              
Indexed Y           OPCODE expr,Y   STX   LAB, Y             
Absolute (address)  OPCODE expr     BIT   $300               
Indexed X           OPCODE expr,X   STA   $4000,X            
Indexed Y           OPCODE expr,Y   SBC   LABEL-1,Y          
Indirect            JMP    (expr)   JMP   ($3F2)             
Preindexed X        OPCODE (expr,X) LDA   (6,X)              
Postindexed Y       OPCODE (expr),Y STA   ($FE), Y           

NOTE: There is no difference in syntax for zero page and 
absolute modes. The assembler automatically uses zero page
mode when appropriate. In the indexed, indirect modes, only
a zero page expression is allowed, and the assembler will
give an error message if the "expr" does not evaluate to a
zero page address.

                                                          49
```
```
MERLIN Users Manual                            THE ASSEMBLER

NOTE: The "accumulator mode" does not require (or accept) an
operand. Some assemblers perversely require you to put an "A"
in the operand for this mode.

The assembler will decide the legality of the addressing
mode for any given opcode.

Additionally, MERLIN provides the ability to FORCE non-zero
page addressing. The way to do this is to add anything
(except "D") to the end of the opcode. Example:

    LDA $10 assembles as zero page (2 bytes) while, 
    LDA: $10 assembles as non-zero page (3 bytes).

6.6. Sweet 16 Opcodes

The assembler accepts all Sweet 16 opcodes with the standard
mnemonics. The usual Sweet 16 registers RØ to R15 do not
have to be "equated" and the "R" is optional. TED II+ users
will be glad to know that the SET opcode works as it should,
with numbers or labels. For the SET opcode, either a space
or a comma may be used between the register and the data
part of the operands; that is, SET R3, LABEL is equivalent
to SET R3 LABEL. It should be noted that the NUL opcode is
assembled as a one-byte opcode (the same as HEX ØD) and not
a two byte skip as this would be interpreted by ROM Sweet
16. This is intentional, and is done for internal reasons.

                                                          50
```
```
MERLIN Users Manual                            THE ASSEMBLER

6.7. Pseudo Opcodes - Directives

6.7.1. EQU (=)

EQU expression (EQUals) = expression (optional 
syntax)

Used to define the value of a LABEL, usually an exterior 
address or an often used constant for which a meaningful 
name is desired. It is recommended that these all be 
located at the beginning of the program. The assembler will 
not permit an "equate" to a zero page number after the 
label equated has been used, since bad code could result 
from such a situation (also see "Variables").

6.7.2. ORG

ORG expression (ORiGin)

Establishes the address at which the program is designed to 
run. It defaults to the present value of HIMEM ($8000 by 
default). Ordinarily there will be only one ORG and it will 
be at the start of the program. If more than one ORG is 
used, the first one establishes the BLOAD address. This can 
be used to create an object file that would load to one 
address though it may be designed to run at another address.

You cannot use ORG *- 1, etc. to back up the object 
pointers as is done in some assemblers. This must be done 
instead by DS-1.

                                                          51

```
```
MERLIN Users Manual                            THE ASSEMBLER

6.7.3. OBJ

OBJ expression (OBJect)

Establishes the address at which the object code will be 
placed during assembly. It defaults to HIMEM. There is 
rarely any need to use this pseudo-op and inexperienced 
programmers are urged not to use it. An OBJ above BASIC 
HIMEM (or the SYM address, if any) will defeat generation 
of object code. This may be used when sending a long 
listing to a printer or when using direct assembly to disk 
(opcode DSK).

6.7.4. PUT

PUT filename

PUT FILENAME, (drive and slot parameters accepted in 
standard DOS syntax) will read the named file (with the 
"T." prefix appended unless the filename starts with a 
character less than "@") and "inserts" it at the location 
of the opcode.

NOTE: "Insert" refers to the effect on assembly of the 
location of the source. The file itself is actually placed 
just following the main source. Text files are required by 
this facility in order to insure memory protection. A 
memory error will occur if a PUT file goes beyond HIMEM. 
These files are in memory only one a time, so a very large 
program can be assembled using the PUT 
facility.

There are two restrictions on a PUT file. First, there 
cannot be macro DEFINITIONS inside a PUT file, they must be 
in the main source. Second, a PUT file may not call another 
PUT file with the PUT opcode. Of course, linking can be 
simulated by having the "main program" just contain the 
macro definitions and call, in turn, all the others by the 
PUT opcode.

                                                          52

```
```
MERLIN Users Manual                            THE ASSEMBLER

Any variables (e.g. ]LABEL) may be used as "local" 
variables. The usual local variables ]1 through ]8 may be 
set up for this purpose using the VAR opcode.

The PUT facility provides a simple way to incorporate much 
used subroutines, such as MSGOUT or PRDEC, in a program.

6.7.5. VAR

VAR expr; expr; expr ...

This is just a convenient way to equate the variables ]1 - 
]8. "VAR 3; $42; LABEL" will set ]1 = 3, ]2 = $42, and ]3 = 
LABEL. This is designed for use just prior to a PUT. If a 
PUT file uses ]1 - 18, except in >>> lines for calling 
macros, there MUST be a previous declaration of these.

6.7.6. SAV

SAV filename

SAVE FILENAME, (drive and slot parameters accepted) will 
save the current object code under the specified name. This 
acts exactly as does the EXEC mode object saving command, 
but it can be done several times during assembly.

This pseudo-opcode provides a means of saving portions of a 
program having more than one ORG. It also enables the 
assembly of extremely large files. After a save, the object 
HIMEM by default.

                                                          53

```
```
MERLIN Users Manual                            THE ASSEMBLER

The SAVE command sets the address of the saved file to its 
correct value. For example, if your program contains 
three SAV commands, then it will be saved in three pieces. 
When BLOADed later, they will go to the correct locations, 
the third following the second and that following the
first.

Together, the PUT and SAV opcodes make it possible to 
assemble extremely large files.

6.7.7. DSK

DSK filename

DSK FILENAME will direct the assembler to assemble the 
following code directly to disk. If DSK is in effect, the 
old file will be closed and the new one begun. This is 
useful primarily for extremely large files. For moderately 
sized programs, SAV is preferred since it is 30% faster and 
theoretically more reliable. Because of the way it works, 
the CHK opcode is incompatible with DSK and will be 
disabled if DSK is in effect. ☑

6.7.8. END

This rarely used or needed pseudo opcode instructs the 
assembler to ignore the rest of the source. Labels 
occurring after END will not be recognized.

                                                          54

```
```
MERLIN Users Manual                            THE ASSEMBLER

6.8. Formatting

6.8.1. LST ON/OFF

LST ON or OFF (LiST)

This controls whether the assembly listing is to be sent to 
the Apple screen and/or other output device. You may, for 
example, use this to send only a portion of the assembly 
listing to your printer. Any number of LST instructions may 
be in the source. If the LST condition is OFF at the end of 
assembly, then the symbol table will not be printed. The 
assembler actually only checks the third character of the 
operand to see whether or not it is a space.

Therefore, LST ERINE will have the same effect as LST OFF. 
The LST directive will have no effect on the actual 
generation of object code. If the LST condition is OFF, the 
object code will be generated much faster, but this is 
recommended only for debugged programs.

NOTE: CONTROL-D from the keyboard toggles this flag during 
the second pass.

6.8.2. EXP ON/OFF

EXP ON or OFF (EXPand)

EXP ON will print an entire macro during the assembly. The 
OFF condition will print only the PMC pseudo-op. EXP 
defaults to ON. This has no effect on the object coded
generated.

                                                          55
```
```
MERLIN Users Manual                            THE ASSEMBLER

6.8.3. PAU

PAU (PAUse)

On the second pass this causes assembly to pause until a 
key is hit. This can also be done from the keyboard by 
hitting the space bar.

6.8.4. PAG

PAG (PAGe)

This sends a formfeed ($8C) to the printer. It has no 
effect on the screen listing even when using an 80- column
card.

6.8.5. AST

AST expression (ASTerisks)

This sends Asterisks to the listing, the same number as the 
value of the operand. The number format is the usual one, 
so that AST 10 will send (decimal) 10 asterisks, for 
example. The number is treated modulo 256 with Ø being 256 
asterisks! This differs from TED II+, which recognizes the 
operand as a hex expression, and will need to be 
converted.

6.8.6. SKP

SKP expression (SKiP)

This sends OPERAND number of carriage returns to the 
listing. The number format is the same as in AST.

                                                          56

```
```
MERLIN Users Manual                            THE ASSEMBLER

6.8.7. TR

TR opcode

This has the same effect in the assembler as does the 
EDITOR TR command. TR or TR ON limits object code printout 
to three bytes per line, and TR OFF resets it to print all 
object bytes.

6.9. Strings

6.9.1. ASC

ASC dstring (ASCii)

This puts a delimited ASCII string into the object code. 
The only restriction on the delimiter is that it does not 
occur in the string itself. Different delimiters have 
different effects. Any delimiter less than (in ASCII code) 
the single quote (') will produce a string with the 
high-bits on, otherwise the high-bits will be off. For 
example, the delimiters !"#$%& will produce a string in 
"negative" ASCII, and the delimiters '()+? will produce one 
in "positive" ASCII. Usually the quote (") and single quote 
(') are the delimiters of choice, but other delimiters 
provide the means of inserting a string containing the 
quote or single quote as part of the string.

6.9.2. DCI

DCI d-string (Dextral Character Inverted)

This is the same as ASC except that the string is put into 
memory with the last character having the opposite high bit 
to the others.

                                                          57

```
```
MERLIN Users Manual                            THE ASSEMBLER

6.9.3. INV

INV d-string (INVerse)

This puts a delimited string in memory in inverse for- mat. 
All choices of delimiter have the same effect.

6.9.4. FLS

FLS d-string (FLaSh)

This puts a delimited string in memory in flashing for- 
mat. All choices of delimiter have the same effect.

6.9.5. REV

REV d-string (REVerse)

Example: REV "DISK VOLUME" gives; EMULOV KSID (delimiter 
choice as in ASC)

6.10. Data and Allocation

6.10.1. DA

DA expression (Define Address)

This stores the (two-byte) value of the operand, usually an 
address, in the object code, low-byte first. DA $FDFØ will 
generate FØ FD. Also accepts multiple data (e.g. DA 1,10,100)

                                                          58

```
```
MERLIN Users Manual                            THE ASSEMBLER

6.10.2. DDB

DDB expression (Define Double-Byte)

As above, but places high-byte first. Also accepts multiple 
data (e.g. DDB 1,10,100).

6.10.3. DFB

DBF expression (DeFine Bytes)

This puts the bytes specified by the operand into the 
object code. It accepts several bytes of data, which must 
be separated by commas and contain no spaces. The standard 
number format is used and arithmetic is done as usual. The 
"#" symbol is acceptable but ignored, as is "<". The ">" 
symbol may be used to specify the high-byte of the label, 
otherwise the low-byte is always taken. The ">" symbol 
should appear only as the first character of an expression 
or immediately after #. That is, the instruction DFB 
>LAB1-LAB2 will produce the high-byte of the value of
LAB1-LAB2.

For example:

DFB $34,100, LAB1-LAB2,%1011,>LAB1-LAB2

is a properly formatted DFB statement which will generate 
the object code (hex) 34 64 DE ØB09, assuming that 
LABI=$81A2 and LAB2=$77C4.

                                                          59

```
```
MERLIN Users Manual                            THE ASSEMBLER

6.10.4. HEX

HEX hex data

This is an alternative to DFB which allows convenient 
insertion of hex data. Unlike all other cases, the "$" is 
not required or accepted here. The operand should consist 
of hex numbers having two hex digits (e.g. ØF, not F). They 
may be separated by commas or may be adjacent. An error 
message will be generated if the operand contains an odd 
number of digits or ends in a comma, or, as in all cases, 
contains more than 64 characters.

6.10.5. DS

DS expression (Define Storage)

This reserves space for string storage data. It does not 
generate code. DS 10, for example, will set aside 10 bytes 
for storage. Because DS adjusts the object code pointer, 
and instruction like DS-1 can be used to back up the object 
and address pointers one byte.

6.10.6. KBD

KBD (KeyBoarD)

This allows a label to be equated from the keyboard during 
assembly. Its syntax is: LABEL KBD.

                                                          60

```
```
MERLIN Users Manual                            THE ASSEMBLER

6.10.7. LUP

LUP expression (Loop)

-- ^ (end of LUP)

An example of the syntax for this is:

LUP 4 ASL

This will assemble as:

ASL ASL

ASL

ASL

and will show that way in the assembly listing, with 
repeated line numbers.

Perhaps the major use of this is for table building. As an 
example:

JA = Ø LUP $FF

JA = ]A+1 DFB JA

will assemble the table 1, 2, 3, .. , $FF. The maximum LUP 
value is $8000 and the LUP opcode will simply be ignored if 
you try to use more than this.

                                                          61

```
```
MERLIN Users Manual                            THE ASSEMBLER

6.10.8. CHK

CHK expression (CHecKsum)

This places a checksum byte into object code at the 
location of the CHK opcode (usually at the end of the 
program). It cannot be used when DSK is in effect.

6.10.9. ERR

ERR expression (ERRor)

ERR expression will cause a forced error if the expres- 
sion has a non-zero value and the message "Break in line ? 
?? " is printed.

This may be used to ensure your program does not exceed, 
for example, $95FF by adding the final line:

ERR *- 1/$9600

NOTE: This would only alert you that the program is too 
long, and will not prevent writing above $9600 during 
assembly, but there can be no harm in this. The error 
occurs only on the second pass of the assembly and does not 
abort the assembly.

Another available syntax is:

ERR ($300)-$4C

which will produce an error on the first pass, and abort 
assembly, if location $300 does not contain the value $4C.

                                                          62

```
```
THE ASSEMBLER

MERLIN Users Manual

6.10.10. USR

USR (opcode)

This is a user definable pseudo opcode. It does a JSR 
$B6DA. This location will contain an RTS after a boot, a 
BRUN MERLIN or BRUN BOOT ASM. To set up your routine you 
should BRUN it from the EXEC command after CATALOG. This 
should just set up a JMP at $B6DA to the main routine and 
then RTS. The following flags and entry points may be used 
by your routine:


USRADS    = $B6DA   ;must have a JMP to your routine                        
PUTBYTE   = $E5F6   ; see below                    
EVAL      = $E5F9   ; see below                    
PASSNUM   = $2      ; contains assembly pass number                         
ERRCNT    = $1D     ;error count                   
VALUE     = $55     ;value returned by EVAL        
OPNDLEN   = $BB     ; contains combined length of  
                    ;operand and comment           
NOTFOUN   = $FD     ; see discussion of EVAL       
WORKSP    = $280    ;contains the operand and      
                    ;comment in positive ASCII     

Your routine will be called by the USR opcode with A=0, Y=Ø 
and carry set. To direct the assembler to put a byte in the 
object code, you should JSR PUTBYTE with the byte in A.

PUTBYTE will preserve Y but will scramble A and X. It 
returns with the zero flag clear (so that BNE always 
branches). On the first pass, PUTBYTE adjusts the object 
and address pointers, so that the contents of the registers 
are not important. You MUST call PUTBYTE the SAME NUMBER OF 
TIMES on each pass or the pointers will not be kept 
correctly and the assembly of other parts of the program 
will be incorrect!

                                                          63
```
```
MERLIN Users Manual                            THE ASSEMBLER

If your routine needs to evaluate the operand, or part of 
it, you can do this by a JSR EVAL. The X register must 
point to the first character of the portion of the operand 
you wish to evaluate (put X=Ø to evaluate the expression at 
the start of the operand). On return from EVAL, X will 
point to the character following the evaluated 
expression. The Y register will be Ø, 1, or 2 accordingly 
as this character is a right parenthesis, a space or a
comma.

Any other character not allowed in an expression will cause 
assembly to abort with a BAD OPERAND error. If some label 
in the expression is not recognized then location NOTFOUND 
will be non-zero. On the second pass, however, you will get 
an UNKNOWN LABEL error and the rest of your routine will be 
ignored. On return from EVAL, the computed value of the 
expression will be in location VALUE, VALUE+1, lowbyte 
first. On the first pass this value will be insignificant 
if NOTFOUND is non-zero.

Appropriate locations for your routine are $300-$3CF and 
$8A0-$8FF. You must not write to $900. For a longer 
routine, you may use high memory, just below $9853. If you 
are sure that the symbol table will not exceed $1000 bytes, 
you could use the SYM EDITOR command to protect your 
routine from overwrite by the object code. SYM would have 
to be set at least one byte below your code. You may use 
zero page locations $60-$6F, but should not alter other 
locations. Also, you must not change anything from $226 
to $27F, or anything from $2C4 to $2FF. Upon return from 
your routine (RTS), the USR line will be printed (on the 
second pass).

                                                          64
```
```
MERLIN Users Manual                            THE ASSEMBLER

To gain further understanding of the use of USR, read the 
source file SCRAMBLE.S or, for a more sophisticated 
example, the file FLOAT.S. The first of these uses the USR 
opcode to put an ASCII string into the object code in a 
scrambled format. The second is a somewhat complicated 
routine that uses Applesoft to compute the packed 
(five-byte) form of a specified floating point number, and 
put it in the object code. Here, the latter can be used for 
assembly only on an Apple ] [ Plus.

When you use the USR opcode in a source file, it is wise to 
include some sort of check (in source) that the required 
routine is in memory. If, for example, your routine 
contains the byte $31 at location $310 then:

ERR ($310)-$3

will test that byte and abort assembly if it is not there. 
Similarly, if you know that the required routine should 
assemble exactly two bytes of data, then you can (roughly) 
check for it by the following code:

LABEL USR OPERAND ERR *- LABEL-2

This will force an error on the second pass if USR does not 
produce exactly two object bytes.

It is possible to use USR for several different routines in 
the same source. For example, your routine could check the 
first operand expression for an index to the desired 
routine and act accordingly. Thus "USR 1, whatever" would 
branch to the first routine, "USR 2, stuff" to the second, 
etc.

                                                          65
```
```
MERLIN Users Manual                            THE ASSEMBLER

6.11. Conditionals

6.11.1. DO

DO expression

This, together with ELSE and FIN are the conditional 
assembly PSEUDO-OPS. If the operand evaluates to ZERO, then 
the assembler will stop generating object code (until it 
sees another conditional). Except for macro names, it will 
not recognize any labels in such an area of code. If the 
operand evaluates to a non-zero number, then assembly will 
proceed as usual. This is very useful for MACROS. It is 
also useful for sources designed to generate slightly 
different code for different situations. For example, if 
you are designing a program to go to on a ROM chip, you 
would want one version for the ROM, and another, with small 
differences to create a RAM version for debugging purposes.

Similarly, in a program with text, you may wish to have one 
version for Apples with lower case adapters and one for 
those without. By using conditional assembly, modification 
of such programs becomes much simpler, since you do not 
have to make the modification in two separate versions of 
the source code. Every DO should be terminated somewhere 
later by a FIN and each FIN should be preceded by a DO. An 
ELSE should occur only inside such a DO, FIN structure. DO, 
FIN structures may be nested up to eight deep (possibly 
with some ELSE's between). If DO condition is off (value 
Ø), then assembly will not resume until its corresponding 
FIN is encountered, or an ELSE at this level occurs. Nested 
DO, FIN structures are valuable for putting conditionals in 
MACROS.

                                                          66
```
```
MERLIN Users Manual                            THE ASSEMBLER

6.11.2. ELSE

This inverts the assembly condition (ON -- >OFF OR OFF -- > 
ON) for the last DO.

6.11.3. FIN

This cancels the last DO.

6.12. Macros

6.12.1. MAC

MAC (MACro)

This signals the start of a MACRO definition. It must be 
labeled with the macro name. The name you use is then 
reserved and cannot be referenced by things other than the 
PMC PSEUDOOP (things like DA NAME will not be accepted if 
NAME is the label on MAC). However, the same thing can be 
simulated by preceding the MACRO with LABEL EQU *, or LABEL 
DS Ø, etc. There is rarely any need to do this. See the 
section on MACROS for details of the usage of macros.

EOM ( <<< ) EOM (End Of Macro) <<< (alternative syntax)

This signals the end of the definition of a macro. It may 
be labeled and used for branches to the end of a macro, or 
one of its copies.

                                                          67
```
```
MERLIN Users Manual THE ASSEMBLER

6.12.2. PMC ( >>> )

PMC macro name (Put MaCro) >>> macro name (alternative 
syntax)

This instructs the assembler to assemble a copy of the 
named macro at the present location. See the section on 
MACROS. It may be labeled.

6.13. Variables

Labels beginning with "]" are regarded as VARIABLES. These 
may be defined only by EQU and cannot be used to label 
something else. They can be redefined as often as you 
wish. The designed purpose of variables is for use in 
MACROS, but they are not confined to that use.

Forward reference to a variable is impossible (with correct 
results) but the assembler will assign some value to it. 
That is, a variable should be defined before it is used.

                                                          68
```
```
MERLIN Users Manual                                   MACROS

7. MACROS

7.1. Defining a Macro

A macro definition begins with

NAME MAC (no operand)

and NAME in the label field. Its definition is terminated 
by the pseudo-op EOM or <<<. The label NAME cannot be 
referenced by anything other than PMC NAME (or >>> NAME).

You can define the macro the first time you wish to use it 
in the program. However, it is preferable (and required if 
the macro uses variables) to first define all macros at the 
start of the program with the assembly condition OFF and 
then refer to them when needed.

Forward reference to a macro definition is not possible, 
and would result in a NOT MACRO error message. That is, the 
macro must be defined before it is called by PMC.

The conditionals DO, ELSE and FIN may be used inside a macro.

Labels inside macros, such as LOOP and OUT in the example 
on page 5-5, are updated each time PMC is encountered.

Error messages generated by errors in macros usually abort 
assembly, because of possibly harmful effects. Such 
messages will usually indicate the line number of a PMC 
rather than the line inside the macro where the error
occurs.

7.2. Nested Macros

Macros may be nested to a depth of 15. For nesting, macros 
must be defined with DO condition off.

                                                          69
```
```
MERLIN Users Manual                                   MACROS

Here is an example of a nested macro in which the 
definition itself is nested. (This can only be done when 
both definitions end at the same place.)

TRDB MAC
     >>> TR.]1+1;]2+1
TR   MAC
     LDA ]1
     STA 12
     ‹‹‹

In this example >>> TR.LOC; DEST will assemble as:

     LDA LOC
     STA DEST

and >>> TRDB.LOC;DEST will assemble as: 
     LDA LOC+1
     STA DEST+1
     LDA LOC
     STA DEST

A more common form of nesting is illustrated by these two 
macro definitions (where CH = $24) :

POKE MAC
     LDA #]2 
     STA ]1 
     <<< 
     
HTAB MAC
     >>> POKE.CH;]1
     <<<

                                                          70
```
```
MERLIN Users Manual                                   MACROS

7.3. Special Variables

Eight variables, named ]1 through ]8, are predefined and 
are designed for convenience in MACROS. These are used in a 
PMC statement. The instruction:

NAME expr1; expr2; expr3 ...

will assign the value of exprl to the variable ]1, that of 
expr2 to ]2, and so on. An example of this usage is:
 
TEMP    EQU     $10                   
        DO      0                     
SWAP    MAC                           
        LDA     ]1                    
        STA     ]3                    
        LDA     ]2                    
        STA     ]1                    
        LDA     13                    
        STA     12                    
        <<<                           
        FIN                           
        >>>     SWAP $6; $7;TEMP      
        >>>     SWAP $1000; $6; TEMP  

This program segment swaps the contents of location $6 with 
that of $7, using TEMP as a scratch depository, then swaps 
the contents of $6 with that of $1000.

If, as above, some of the special variables are used in the 
MACRO definition, then values for them must be specified in 
the PMC (or >>>> statement. In the assembly listing, the 
special variables will be replaced by their corresponding 
expressions.

The number of values must match the number of variables in 
the macro definition. A BAD OPERAND error will be generated 
if the number of values is less than the number of 
variables. No error message will be generated, however, if 
there are more values than variables.

                                                          71
```
```
MERLIN Users Manual                                   MACROS

The assembler will accept some other characters in place of 
the space between the macro name and the expressions in a 
PMC statement. For example, you may use any of these 
characters:

The semicolons are required, however, and no extra spaces 
are allowed.

Macros will accept literal data. Thus the assembler will 
accept the following type of macro call:

DO  0
MUV MAC
    LDA ]1 
    STA ]2 
    <<< 
    FIN 
    >>> MUV. (PNTR),Y;DEST
    MUV.#3;FLAG,X

It will also accept :

DO      0
PRINT   MAC
        JSR SENDMSG
        ASC ]1 
        BRK 
        <<< 
        FIN 
        >>> PRINT. ! "quote"! 
        >>> PRINT. 'This is an example' 
        >>> PRINT. "So's this, understand?"

LIMITATION: If such strings contain spaces or semicolons, 
they MUST be delimited by quotes (single or double). Also, 
literals such as >>> WHAT."A" must have the final 
delimiter. (This is only true in macro calls or VAR 
statements, but it is good practice in all cases.)

                                                          72
```
```
MERLIN Users Manual                                   MACROS

A previous version of this assembler, that did not have 
this capability, used commas rather than semicolons in >>> 
statements. For people who have that version, a program 
"CONVERT" has been provided which changes these commas to 
semicolons in a matter of a second or two. With the source 
file in memory, it should be BRUN from the EXEC mode's 
Command after Catalog.

7.4. Sample Program

Here is a sample program intended to illustrate the usage 
of macros with non-standard variable. It would, however, be 
simpler and more pleasing if it used ]1 instead of ]MSG (in 
which case the variable equates should be eliminated and 
the values for ]1 must be specified in the >>> lines.)

HOME      EQU     $FC58
COUT      EQU     $FDED                                     
KEY       EQU     $C000                                     
STROBE    EQU     $C010                                     
DOS       EQU     $3D3

        DO      0         ; Assembly off                  
SENDMSG MAC               ; Start of definition of the
                          ; macro "SENDMSG"                 
        LDY     #0                                        
LOOP    LDA     ]MSG, Y   ; Get a character               
        BEQ     OUT       ; End of message                
        JSR     COUT      ; Send it                       
        INY                                               
        BNE     LOOP      ; Back for more                 
OUT     <<<               ; End of macro definition and   
                          ; exit from routine             
        FIN               ; Turn assembly ON              
        JSR     HOME      ; Clear screen                  
]MSG    EQU     HITMSG                                    
        >>>     SENDMSG                                   
INVRS   CMP     #"I"                                      
        BNE     NORM                                      
]MSG    EQU     IMSG                                      
        >>>     SENDMSG                                   

                                                          73

```
```
MERLIN Users Manual                                   MACROS

NORM    CMP     #"N"                            
        BNE     STP                             
]MSG    EQU     NMSG                            
        >>>     SENDMSG                         
STP     CMP     #"S" ; Does he want to stop?    
        BNE     GETKEY ; No, get the next       
                input                           
        JMP     DOS ; All done, exit            
                gracefully                      
HITMSG  ASC     !HIT ; A KEY "F", "I","N", OR   
                "S"!                            
        HEX     8D8D00                          
FMSG    FLS     "THIS IS A FLASHING MESSAGE"    
        HEX     8D8D00                          
IMSG    INV     "THIS IS A MESSAGE IN INVERSE"  
        HEX     D8D00                           
NMSG    ASC     "THIS IS A NORMAL MESSAGE"      
        HEX     8D8D00                          

7.5. The Macro Library
 
A macro library with three example macro programs is  
included in source file form on this diskette. The purpose  
of the library is to provide some guidance to the newcomer  
to macros and how they can be used within an assembly 
program.
 
NOTE: All macros are defined at the beginning of the source  
file, then each example program places the macros where  
they are needed. Conditionals are used to determine which  
example program is to be assembled. The KBD opcode allows  
the user to make this selection from the keyboard during 
assembly.

                                                          74
```