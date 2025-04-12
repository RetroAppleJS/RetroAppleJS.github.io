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
        5.4.12. Return (RETURN KEY)...................... 42

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
   6.11. Conditionals.................................... 66
        6.11.1. DO....................................... 66
        6.11.2. ELSE..................................... 67
        6.11.3. FIN...................................... 67
   6.12. Macros.......................................... 67
        6.12.1. MAC...................................... 67
        6.12.2. PMC ( >>> ).............................. 68
   6.13. Variables....................................... 68

7. MACROS................................................ 69
   7.1. Defining a Macro................................. 69
   7.2. Nested Macros.................................... 69
   7.3. Special Variables................................ 71
   7.4. Sample Program................................... 73
   7.5. The Macro Library................................ 74

8. TECHNICAL INFORMATION................................. 75
   8.1. General Information.............................. 75
   8.2. MERLIN Memory Map (Ram Card Version)............. 77
   8.3. MERLIN Memory Map (48k Version).................. 78
   8.4. Symbol Table..................................... 79
   8.5. Using MERLIN With Shift Key Mods................. 79
   8.6. Using MERLIN With 80 Column Boards............... 80 
   8.7. The Configure ASM Program........................ 8l
   8.8. Error Messages................................... 82
        8.8.1. BAD OPCODE................................ 82
        8.8.2. BAD ADDRESS MODE.......................... 82
        8.8.3. BAD BRANCH................................ 82
        8.8.4. BAD OPERAND............................... 82
        8.8.5. DUPLICATE SYMBOL.......................... 83
        8.8.6. MEMORY FULL............................... 83
        8.8.7. UNKNOWN LABEL............................. 83
        8.8.8. NOT MACRO................................. 83
        8.8.9. NESTING ERROR............................. 83
        8.8.10. BAD "PUT"................................ 83
        8.8.11. BAD "SAV" ............................... 84
        8.8.12. BAD INPUT................................ 84
        8.8.13. BREAK.................................... 84
        8.8.14. BAD LABEL................................ 84
    8.9. Special Note = Memory Full Errors............... 84

9. SOURCEROR............................................. 87
   9.1. Introduction..................................... 87
   9.2. Using SOURCEROR.................................. 87
   9.3. Commands Used in Disassembly..................... 89
   9.4. Command DescriptionS............................. 89
        9.4.1. L (List).................................. 89
        9.4.2. S (SWEET) ................................ 90
        9.4.3. N (Normal)................................ 90
        9.4.4. H (HeX)................................... 90
        9.4.5. T (Text).................................. 90
        9.4.6. W (Word) ................................. 91
   9.5. Housekeeping Commands............................ 92
        9.5.1. / (Cancel)................................ 92
        9.5.2. R (Read) ................................. 92
        9.5.3. Q (Quit).................................. 93
   9.6. Final Processing................................. 93
   9.7. Dealing with the Finished Source................. 94
   9.8. The Memory Full Message.......................... 95
   9.9. The LABELER Program.............................. 96
   9.10. Labeler Commands................................ 96
        9.10.1. Q:QUIT................................... 96
        9.10.2. L:LIST................................... 96
        9.10.3. D:DELETE LABEL(S)........................ 96
        9.10.4. A:ADD LABEL.............................. 96
        9.10.5. F:FREE SPACE............................. 96
        9.10.6. U:UNLOCK SRCRR.OBJ....................... 97

10. SWEET 16 — INTRODUCTION.............................. 99
   10.1. Listing #1..................................... 104
   10.2. Listing #2..................................... 105
   10.3. Listing #3..................................... 105

11. SWEET 16: A Pseudo 16 Bit Microprocessor............ 107
   11.1. Descriptionn................................... 107
   11.2. Instruction Descriptions....................... 108
   11.3. Sweet 16 Opcode Summary........................ 109
          11.3.1. Register OPS.......................... 109
          11.3.2. Non-register OPS...................... 110
   11.4. Register Instructions.......................... 110
          11.4.1. SET................................... 110
          11.4.2. LOAD.................................. 111
          11.4.3. STORE. ................................ 111
          11.4.4. LOAD INDIRECT......................... 111
          11.4.5. STORE INDIRECT........................ 112
          11.4.6. LOAD DOUBLE-BYTE INDIRECT............. 112
          11.4.7. STORE DOUBLE-BYTE INDIRECT............ 113
          11.4.8. POP INDIRECT.......................... 113
          11.4.9. STORE POP INDIRECT.................... 114
          11.4.10. ADD.................................. 115
          11.4.11. SUBTRACT............................. 115
          11.4.12. POP DOUBLE-BYTE INDIRECT............. 116
          11.4.13. COMPARE.............................. 116
          11.4.14. INCREMENT............................ 117
          11.4.15. DECREMENT............................ 117

    11.5. Non-Register Instructions..................... 118
          11.5.1. RETURN TO 6502 MODE................... 118
          11.5.2. BRANCH ALWAYS......................... 118
          11.5.3. BRANCH IF NO CARRY.................... 119
          11.5.4. BRANCH IF CARRY SET................... 119
          11.5.5. BRANCH IF PLUS........................ 120
          11.5.6. BRANCH IF MINUS....................... 120
          11.5.7. BRANCH IF ZERO........................ 120
          11.5.8. BRANCH IF NONZERO..................... 121
          11.5.9. BRANCH IF MINUS ONE................... 121
          11.5.10. BRANCH IF NOT MINUS ONE.............. 121
          11.5.11. BREAK................................ 121
          11.5.12. RETURN FROM SWEET 16 SUBROUTINE...... 122
          11.5.13. BRANCH TO SWEET 16 SUBROUTINE........ 122
    11.6. Theory of Operation........................... 123
    11.7. When is an RTS really a JSR?.................. 124
    11.8. OPcode Subroutines............................ 124
    11.9. Memory Allocation............................. 125
    11.10. User Modifications........................... 126

12. APPLESOFT LISTING INFORMATION....................... 127
   12.1. SOURCEROR.FP................................... 127
         12.1.1. Steps to list the Applesoft Disassembly 128

13. GLOSSARY............................................ 131

14. SAMPLE PROGRAMS..................................... 137
    14.1. The Floating Point Routines................... 137
    14.2. The Multiply /Divide Routines................. 137
    14.3. PRDEC......................................... 137
    14.4. MSGOUT........................................ 138
    14.5. UPCON......................................... 138
    14.6. Game Paddle Printer Driver.................... 138

15. UTILITIES........................................... 141
    15.1. Formatter..................................... 141
    15.2. CHRGEN 70..................................... 142
    15.3. XREF, XREF, XL and STRIP...................... 143
          15.3.1. Sample MERLIN Symbol Table Printout... 144
          15.3.2. Sample MERLIN XREF Printout........... 144
          15.3.3. XREF Instructions..................... 145
          15.3.4. CAUTIONS for the use of XREF.......... 146
          15.3.5. XREF.XL Instructions.................. 148
          15.3.6. CAUTIONS for the use of XREF.XL....... 148
    15.4. STRIP......................................... 150
    15.5. PRINTFILER.................................... 150
          15.5.1. Applications.......................... 151
          15.5.2. How To Use PRINTFILER................. 151
          15.5.3. Changing PRINTFILER's Options......... 152
          15.5.4. Benchmarking PRINTFILER............... 153
          15.5.5. Changing PRINTFILER options........... 153
```
```
MERLIN Users Manual                             INTRODUCTION

1. INTRODUCTION

1.1. Assembly Language Whys and Wherefores

Some of you may ask "What is Assembly Language?" or "Why do 
I need to use Assembly Language; BASIC suits me fine." 
While we do not have the space here to do a treatise on the 
subject, we will attempt to briefly answer the above 
questions.

Computer languages are often referred to as "high level" or 
"low level" languages. BASIC, COBOL, FORTRAN and PASCAL are 
all high level languages. A high level language is one that 
usually uses English-like words (commands) and may go 
through several stages of interpretation or compilation 
before finally being placed in memory. The time this 
processing takes is the reason BASIC and other high level 
languages run far slower than an equivalent Assembly 
Language program. In addition, it normally consumes a great 
deal more available memory.

From the ground up, your computer understands only two 
things, off and on. All of its calculations are handled as 
addition or subtraction but at tremendously high speeds. 
The only number system it comprehends is Base 2 (the Binary 
System) where a "l" is represented by 00000001 and a "2" 
is represented by Ø0000010.

The 6502 microprocessor has five 8-bit registers and one 
16-bit register in the ALU (Arithmetic Logic Unit). All 
data is ultimately handled through these registers. Even 
this lowest of low-level code requires a program to 
function correctly. This program is hard wired within the 
6502 itself. The microprocessor program functions in three 
cycles. It fetches an instruction from RAM memory in the 
computer, decodes it and executes it.

1
```
```
MERLIN Users Manual                             INTRODUCTION

These instructions exist in RAM memory as one, two or three 
byte groups. A byte contains 8 binary bits of data and is 
usually notated in hexadecimal (base 16) form. Some early 
microcomputers allowed data entry only through 16 front 
panel switches, each of which, when set on or off, would 
combine in hex. This requires an additional program in the 
computer to break the byte down into its respective 8 bits 
so that 6502 may interpret it.

At the next level up (requiring still more programming), 
the user may enter his/her data in the form of a three 
character "mnemonic", a type of code whose characters form 
an association with the microprocessor operation, e.g. 
LDA stands for "LoaD the Accumulator". The standard Apple 
II has a built-in mini-assembler that permits simple 
Assembly Language programming.

But even this is not sufficient to create a long and 
comprehensive program. In addition to the use of a three 
character mnemonic, a full fledged assembler allows the 
programmer to use "labels", which represent an as yet 
undefined area of memory where a particular segment of the 
program will be stored. In addition, an assembler will have 
a provision for line numbers, similar to those in a BASIC 
program, which in turn permits the programmer to insert 
lines into the program and perform other editing 
operations. This is what MERLIN is all about.

Finally, a high level language such as BASIC is itself an 
assembly program which takes a command such as PRINT and 
reduces it by tokenizing to a single hex byte before 
storing it in memory.

Before using this or any other assembler, the user is 
expected to be somewhat familiar with the 6502 
architecture, modes of addressing, etc. This manual is not 
intended to teach Assembly Language programming. Many good 
books on 6502 Assembly programming are available at your 
local dealer; some are referenced later in this section.

2
```
```
MERLIN Users Manual                             INTRODUCTION

1.2. Backgrounds and Features

MERLIN is a "Ted-based" editor-assembler. This means that 
while it is essentially new from the ground up, it adheres 
to and follows almost all of the conventions associated 
with TED II+, in terms of the command mnemonics, 
pseudo-ops, etc.

The original TED ASM was written by Randy Wiggington and 
Gary Shannon. It has been widely distributed "under the 
counter" by user groups and individuals, under many names, 
and in a variety of versions. Seemingly, each person added 
his own enhancements and improvements. MERLIN is no 
exception. Representing a major step forward, with the 
addition of macro capability, MERLIN appears on the scene 
now as one of the most advanced and sophisticated 
editor-assemblers for the Apple II, yet retains all of the 
easy-to-use features of TED that make it desirable to a 
beginner in assembly language programming.

Significant changes incorporated in MERLIN, in addition to 
macros, include the use of the logical operators AND, OR, 
and EOR, and the math operator for division, the ability to 
list with or without line numbers, and substantially faster 
editing. Similarly, the edit module now includes many 
additional commands to facilitate editing, and the "Read" 
command allows any Apple text file to be read into the edit 
buffer, thus permitting the use of source files from other 
assemblers, such as DOS Tool Kit.

MERLIN assumes that your system has at least 48K memory and 
operates under 3.3 DOS. BEWARE of "custom" DOS's. MERLIN 
does an automatic MAXFILES 2 upon entry, then reverts to 
the usual value on exit.

3
```
```
MERLIN Users Manual                             INTRODUCTION

1.3. Suggested Reading

SYSTEM MONITOR - Apple Computer, Inc. Peeking at Call- 
Apple, Vol I.

APPLE II MINI-ASSEMBLER - Apple Computer Inc. Peeking at 
Call-Apple Synertek Programming Manual., Synertek 6500-20.

PROGRAMMING THE 6502 - Rodnay Zaks, Sybex C-202.

THE APPLE MONITORS PEELED - WM. E. Dougherty, Apple 
Computer, Inc.

A HEX ON THEE - Val J. Golding, Peeking at Call-Apple, Vol. 
II.

FLOATING POINT PACKAGE - Apple Computer, Inc., The Wozpak II

FLOATING POINT LINKAGE ROUTINES - Don Williams, Peeking at 
Call-Apple Vol I

APPLE II REFERENCE MANUAL - Apple Computer, Inc.

ASSEMBLY LINES - by Roger Wagner

A continuing series of tutorial articles in SOFTALK 
magazine. An excellent introduction, easy-to-follow for the 
beginning assembly language programmer.

ASSEMBLY LINES: THE BOOK - by Roger Wagner A compilation of 
the first 18 issues of the Assembly Lines series. In 
addition, the text has been extensively edited and a unique 
encyclopedia-like appendix added. This appendix shows not 
only the basic details of each 6502 command, but also a 
brief discussion of its most common uses along with 
concise, illustrative listings.

CONVERTING BRAND X TO BRAND Y - by Randall Hyde Apple 
Orchard, Volume 1, No.1, March/April 80. Useful notes and 
cross references on converting among assemblers.

4
```
```
MERLIN Users Manual                             INTRODUCTION

CONVERTING INTEGER BASIC PROGRAMS TO ASSEMBLY LANGUAGE by 
Randall Hyde Apple Orchard, as above.

HOW TO ENTER CALL - APPLE ASSEMBLY LANGUAGE LISTINGS 
Call-APPLE, Volume IV, No.1, January 81.

MACHINE TOOLS

Call-APPLE in Depth, No. 1

5
```
```
MERLIN Users Manual                      SYSTEM REQUIREMENTS

2. SYSTEM REQUIREMENTS

    * 48K APPLE ][
    * 16K RAM CARD
    * 80 COLUMN BOARD (optional)
    * LOWER CASE BOARD (optional)

2.1. Hardware Compatibility List

    * VIDEX VIDEOTERM
    * FULL-VIEW 80 - 80 COLUMN BOARD
    * M & R SUP'R'TERMINAL 80 COLUMN BOARD
    * ALS SMARTERM 80 COLUMN BOARD
    * VISTA VISION 80 - 80 COLUMN BOARD
    * OMEGA MICROWARE RAMTEX 16 - 16K RAM BOARD
    *  ANDROMEDA 16K BOARD
    * MICROSOFT 16K RAM BOARD
    * WIZARD 80 - 80 COLUMN BOARD

NOTE: MERLIN has been tested with the cards/boards listed 
above. The author makes no guarantees with respect to the 
operation of MERLIN with any 80 column boards not listed.

7
```
```
MERLIN Users Manual          BEGINNERS GUIDE TO USING MERLIN

3. BEGINNERS GUIDE TO USING MERLIN

By T. Petersen

Notes and demonstrations for the beginning MERLIN programmer.

3.1. Introduction

The purpose of this section is not to provide instruction 
in assembly language programming. It is to introduce MERLIN 
to programmers new to assembly language programming in 
general, and MERLIN in particular.

Many of the MERLIN commands and functions are very similar 
in operation. This section does not attempt to present 
demonstrations of each and every command option. The 
objective is to clarify and present examples of the more 
common operations, sufficient to provide a basis for 
further independent study on the part of the programmer.

A note of clarification:

Throughout the MERLIN manual, various uses are made of the 
terms "mode" and "module".

In this section, "module" refers to a distinct computer 
program component of the MERLIN system. There are four 
MODULES :

1. The EXECUTIVE
2. The EDITOR
3. The ASSEMBLER
4. The SYMBOL TABLE GENERATOR

Each module is grouped under one of the two CONTROL MODES:

1) The EXECUTIVE, abbreviated EXEC and indicated by the 
    '%' prompt.

2) The EDITOR, indicated by the ':' prompt.

9
```
```
MERLIN Users Manual          BEGINNERS GUIDE TO USING MERLIN

EXECUTIVE CONTROL MODE
    Executive Module

EDITOR CONTROL MODE
    Editor Module
    Assembler Module
    Symbol Table
    Generator Module

The term "mode" may be used to indicate either the current 
control mode (as indicated by the prompt) or alternatively, 
while in control mode and subsequent to the issuance of an 
entry command, the system is said to be in '[entry command] 
mode'. For example, while typing in a program after issuing 
the ADD command, the system is said to be 'in ADD mode'.

Terminating [entry command] mode returns the system to con-
trol mode.

3.2. Input

Programmers familiar with some assembly and higher-level 
languages will recall the necessity of formatting the 
input, i.e. labels, opcodes, operands and comments must be 
typed in specific fields or they will not be recognized by 
the assembler program.

In MERLIN, the TABS operator provides a semi-automatic 
formatting feature.

When entering programs, remember that during assembly each 
space in the source code causes a tab to the next tab 
field. As a demonstration, let's enter the following short 
routine.

Steps from the very beginning:

1. BRUN MERLIN

2. When the '%' prompt appears at the bottom of the EXEC 
mode menu, type 'E'. This instantly places the system in 
EDITOR control mode.

10
```
```
MERLIN Users Manual          BEGINNERS GUIDE TO USING MERLIN

3. Since we are entering an entirely new program, at the 
':' prompt type 'A' and press RETURN (A = ADD). A '1' 
appears one line down and to the right, and the cursor is 
automatically tabbed one space to the right of the line 
number. The 'l' and all subsequent line numbers which 
appear after the RETURN key is pressed serve roughly the 
same purpose as line numbers in BASIC except that in 
assembly source code, line numbers are not referenced for 
jumps to subroutines or in GOTO-like statements.

4. On line 1, enter an '*' (asterisk). An asterisk as the 
first character in any line is similar to a REM statement 
in BASIC - it tells the assembler that this is a remark 
line and anything after the asterisk is to be ignored. To 
confirm this, type the title 'DEMO PROGRAM l' and hit the 
RETURN key.

5. After return, the cursor once again drops down one line, 
a '2' appears and the cursor skips a space.

6. Now, hit the space bar once and type 'OBJ', space again, 
type '$300', and hit RETURN. Note in most cases the 'OBJ' 
pseudo-op is neither required nor desirable.

7. On line 3, perform the same sequence: space, type 'ORG', 
space, type '$300', RETURN.

8. On line 4, do not space once after the line number. Type 
'BELL', space, 'EQU' space, '$FBDD', RETURN.

9. Line 5 - Type 'START', space 'JSR', space 'BELL', space, 
';' (semicolon), 'RING THE BELL', RETURN. Semicolons are a 
convention often used within command lines to mark the 
start of comments.

10. Line 6 - 'END', space, 'RTS', RETURN.

11. The program has been completely entered, but the system 
is still in ADD mode. To exit ADD, just press RETURN, or 
type CTRL-X, RETURN. The ':' prompt reappears at the left 
of the screen, indicating that the system has returned to 
control mode.

11
```
```
MERLIN Users Manual          BEGINNERS GUIDE TO USING MERLIN

12. The screen should now appear like this:

    1   *DEMO   PROGRAM 1                                
    2           OBJ $300                                 
    3           ORG         $300                         
    4   BELL    EQU         $FBDD                        
    5   START   JSR         BELL    ;RING THE BELL  
    6   END     RTS                                      

Note that each string of characters has been moved to a 
specific field. There are four such fields, not including 
the line numbers on the left.

FIELD #:

One is reserved for labels. BELL, START and END are 
examples of labels.

Two is reserved for opcodes, such as the MERLIN pseudo-ops 
OBJ, ORG and EQU, and the 6502 opcodes JSR and RTS.

Three is for operands, such as $300, $FBDD and, in this 
case, BELL.

Four will contain any comments.

It should be apparent from this exercise that it is not 
necessary to input extra spaces in the source file for 
formatting purposes.

In summary, after the line numbers:

1) Do not space for a label. Space once after a label (if 
there is no label, once after the line number) for the opcode.

2) Space once after the opcode for the operand. Space once 
after the operand for the comment. If there is no operand, 
type a space and a semicolon.

12
```
```
MERLIN Users Manual          BEGINNERS GUIDE TO USING MERLIN

3.3. System and Entry Commands

MERLIN has a powerful and complex built-in editor. Complex 
in the range of operations possible but, after a little 
practice, remarkably easy to use.

The following paragraphs contain only minor clarifications 
and brief demonstrations on the use of both sets of 
commands. All System and Entry commands are used in EDITOR 
Control Mode immediately after the ':' prompt.

CTRL-X, CTRL-C or a RETURN as the first character of a line 
exits the current [entry command] mode and returns the 
system to control mode when ADDing or INSERTing lines. 
CTRL-X or CTRL-C exits edit mode and returns the system to 
control mode after Editing lines.

The other System and Entry Commands are terminated either 
automatically or by pressing RETURN.

Inserting and deleting lines in the source code are both 
simple operations. The following example will INSERT three 
new lines between the existing lines 4 and 5.

1. After the ':' prompt, type 'I' (INSERT), the number '5', 
and press RETURN. All inserted lines will precede the line 
numbers specified in the command.

2. Input an asterisk, and RETURN. Note that INSERT mode has 
not been exited.

3. Repeat step 2.

4. Input one space, type 'TYA', and RETURN.

On the screen is the following:

:I5
   5*
   6*
   7    TYA
   8

13
```
```
MERLIN Users Manual          BEGINNERS GUIDE TO USING MERLIN

5. Hit RETURN and the system reverts to CONTROL mode.

6. LIST the source code.

      :L

            1   *DEMO PROGRAM 1                                  
            2          OBJ   $300                     
            3          ORG   $300                     
            4   BELL   EQU   $FBDD                    
            5   *                                                
            6   *                                                
            7          TYA                            
            8   START  JSR   BELL    ; RING THE BELL 
            9   END    RTS                                          

The three new lines (5,6, and 7) have been inserted, and 
the subsequent original source lines (now lines 8 and 9) 
have been renumbered.

Using DELETE is equally easy.

1. In control mode, input 'D5', and RETURN. Nothing new 
appears on the screen.

2. LIST the source code. The source listing is one line 
shorter, one of the asterisk-only lines has disappeared, 
and the subsequent lines have been renumbered.

It is possible to delete a range of lines in one step.

1. In control mode, input 'D5,6' and RETURN.

2. LIST the source.

Lines 5 and 6 from the previous example, which contained 
the remaining asterisk and the TYA opcode, have been 
deleted, and the subsequent lines renumbered. The listing 
appears the same as in the subsection on INPUT, Step 13.

14
```
```
MERLIN Users Manual          BEGINNERS GUIDE TO USING MERLIN

This automatic renumbering feature makes it IMPORTANT that 
when deleting lines you remember to begin with highest line 
number and work back to the lowest.

The Add, Insert, or Edit commands have several sub-commands 
comprised of CTRL-characters. To demonstrate, using our 
BELL routine:

1. After the ':' prompt, enter 'E' (the EDIT command) and a 
line number ... (use '6' for this demonstration), and hit 
RETURN. One line down and to the right the specified line 
appears in its formatted state:

6 END RTS

and the cursor is over the 'E' in 'END'.

2. Type CTRL-D. The character under the cursor disappears. 
Type CTRL-D again, and a third time, 'END' has been 
deleted, and the cursor is positioned to the left of the 
opcode.

3. Hit RETURN and LIST the program. In line 6 of the source 
code, only the line number and opcode remain.

4. Repeat step 1 (above).

5. This time, type CTRL-I. Don't move the cursor with the 
space bar or arrow keys. Type the word 'END', and RETURN.

6. LIST the program. Line 6 has been restored.

15
```
```
MERLIN Users Manual          BEGINNERS GUIDE TO USING MERLIN

If you are editing a single line, hitting RETURN alone re- 
stores the control mode prompt. In step 1 (above), if you 
had specified a range of lines (ex:'E3,6') after issuing 
the EDIT command, RETURN would have called up the next 
sequential line number within the specified range. As the 
lines appear, you have the options of editing using the 
various subcommands, pressing RETURN which will call up 
the next line, or exiting the EDIT mode using CTRL-C. NOTE: 
hitting RETURN will enter the entire line in memory, 
exactly as it appears on the screen.

The other sub-commands, CTRL-characters used under the EDIT 
command, function similarly. Read the definitions in 
Section 3 and practice a few operations.

3.4. Assembly

The next step in using MERLIN is to assemble the source 
code into object code.

After the ':' prompt, type the edit module system command 
ASM and hit return. On your screen is the following;

UPDATE SOURCE (Y/N) ?

Type N, and you will see :

ASM             1   *DEMO   PROGRAM   1                           
                2           OBJ       $300                        
                3           ORG       $300                        
                4   BELL    EQU       $FBDD                       
Ø300   20 DD FB 5   START   JSR       BELL    ;RING THE BELL  
Ø303   60       6   END     RTS                                   

-- END ASSEMBLY --

ERRORS: Ø 

4 BYTES


16
```
```
MERLIN Users Manual          BEGINNERS GUIDE TO USING MERLIN

SYMBOL TABLE - ALPHABETICAL ORDER

     BELL      =$FBDD     ? END     =$0303    

?    START     =$0300  

SYMBOL TABLE - NUMERICAL ORDER

?    START     =$0300     ? END     =$0303

     BELL      =$FBDD                         

If instead of completing the above listing, the system 
beeps and displays an error message, note the line number 
referenced in the message, and press RETURN until the " ... 
BYTES ... " message appears. Then refer back to the 
subsection on INPUT and compare the listing with step 13. 
Look especially for elements in incorrect fields.

If all went well, to the right of the column of numbers 
down the middle of the screen is the now familiar, 
formatted source code.

To the left of the numbers, beginning on line 5, is a 
series of numeric and alphabetic characters. This is the 
object code - the opcodes and operands assembled to their 
machine language hexadecimal equivalents.

Left to right, the first group of characters is the 
routine's starting address in memory (see the definition of 
OBJ and ORG in the section entitled "Pseudo Opcodes - 
Directives"). After the colon is the number '20'. This is 
the one-byte hexadecimal code for the opcode JSR.

NOTE: that the label 'START' is not assembled into object 
code; neither are comments, remarks, or pseudo-ops such as 
OBJ and ORG. Such elements are only for the convenience and 
utility of the programmer and the use of the assembler pro- 
gram. They are of no use to the computer and therefore, are 
not translated into the machine's language.

17
```
```
MERLIN Users Manual          BEGINNERS GUIDE TO USING MERLIN

The next two bytes (each pair of characters is one byte) on 
line 5 bear a curious resemblance to the last group of 
characters on line 4; have a look. In line 4 of the 
source code we told the assembler that the label 'BELL' 
EQUated with address $FBDD. In line 5, when the assembler 
encountered 'BELL' as the operand, it substituted the 
specified address. The sequence of the high and low-order 
bytes was reversed, a 6502 microprocessor convention.

The rest of the information presented should explain 
itself. The total errors encountered in the source code was 
zero, and four bytes of object code (count the bytes 
following the addresses) was generated.

3.5. Saving and Running Programs

The final step in using MERLIN is running the program. Be- 
fore that, it would be a good idea to save the source code. 
OBJECT CODE SAVE must be preceded by a successful assembly.

1. Return to control mode if necessary, and type 'Q' 
RETURN. The system has quit EDITOR mode and reverted to 
EXECUTIVE (EXEC) mode. If the MERLIN system disk is still 
in the drive, remove it and insert an initialized work disk.

After the '%' prompt, type 'S' (the EXEC mode SAVE SOURCE 
FILE command). The system will ask for a filename. Type 
'DEMO1', RETURN. After the program has been saved, the 
prompt returns.

2. Type 'C' (CATALOG) and look at the disk catalog. The 
source code has been saved as a binary file titled 
"DEMO1.S". The suffix ".S" is a file-labelling convention 
which indicates the subject file is source code. This 
suffix is automatically appended to the name by the 'S' 
(SAVE SOURCE FILE) command.

18
```
```
MERLIN Users Manual          BEGINNERS GUIDE TO USING MERLIN

3. Hit RETURN to return to EXEC mode and input '@', for 
OBJECT CODE SAVE. The object file is saved under the same 
name as was earlier specified for the source file. There is 
no danger of overwriting the source file because no suffix 
is appended to object code file names.

While writing either file to disk, MERLIN also displays the 
address parameter, and calculates and displays the length 
parameter. It's a good practice to take note of these. 
Viewing the catalog will show that although the optional A$ 
and L$ parameters were displayed on the EXEC mode menu, 
they were not saved as part of the file names. If you'd 
prefer to have this information in the disk catalog, use 
the DOS RENAME command. Make sure no commas are included in 
the new file name .

Return to EDITOR mode, type 'MON', RETURN and the monitor 
prompt '*' appears. Enter '30ØG', RETURN. A beep is heard. 
The demonstration program was responsible for it. It works!

Now you can return to the EXEC by typing CTRL-Y and hitting 
RETURN.

3.6. Making Back-up Copies of MERLIN

To make back-up copies of the MERLIN diskette, you should 
use the copy program provided on the original diskette. To 
run this, simply boot on the diskette, and as the drive 
light comes on, press the 'C' key on the keyboard. The 
program will verify your intention to produce a copy, and 
then ask the slot and drive values for the SINGLE DRIVE on 
which the copy is to be made. A single drive is used to 
assure maximum reliability in the copy.

Be careful during the copy process to appropriately 
alternate the original and copy diskettes. If at any time, 
you make an error, STOP IMMEDIATELY and re-boot to start 
over.

19
```
```
MERLIN Users Manual          BEGINNERS GUIDE TO USING MERLIN

When completed, it is highly recommended that you use ONLY 
the BACK-UP copy of MERLIN in your daily work, and keep the 
original in a safe place. The copy program will provide a 
total of 3 back-up copies, giving you a total of 4 working 
copies of the MERLIN assembler. In addition, files may be 
transferred from one diskette to another. This means that 
damaged files on a given diskette may be replaced with a 
known "good" file from another diskette. Use the FID file 
transfer utility on your Apple System Master diskette to 
move the file from the original master diskette to the one 
on which the file was damaged. All library files, and also 
the side containing SOURCEROR.FP can be moved to any DOS 
3.3 diskette using the FID utility program.

20
```
```
MERLIN Users Manual                           EXECUTIVE MODE

4. EXECUTIVE MODE

The EXECUTIVE mode is the program level provided for file 
maintenance operations such as loading or saving code or 
cataloging the disk. The following sections summarize each 
command available in this mode.

4.1. C: CATALOG

After showing the catalog, this command accepts any disk 
command you wish to give, using standard DOS syntax. Unlike 
the LOAD, APPEND and SAVE commands, you must type the ".S" 
suffix when referencing a source file. This facility is 
provided primarily for locking and unlocking files. Do not 
use it to load or save files. If you do not want to give a 
disk command, just hit RETURN. To cancel a partially typed 
command use CTRL-X, make sure the command is in the wrong 
syntax (type some commas) or just backspace to the 
beginning. If you type CTRL-C RETURN after "COMMAND:", you 
will be presented with the EXEC mode prompt "%". You can 
then issue any EXEC command such as "L" for LOAD. This 
permits you to give an EXEC mode command while the catalog 
is still on the screen. In addition, if CTRL-C is typed at 
the "CATALOG pause" point, printing of the remainder of the 
catalog is aborted.

4.2. L: LOAD when entering filerare, proceed by space.

This is used to load a source file from disk. You will be 
asked for the name of the file. You should not append ".S" 
since MERLIN does this automatically. If you have hit "L" 
by mistake, just hit RETURN twice and the command will be 
cancelled without affecting any file that may be in
memory.

21
```
```
MERLIN Users Manual                           EXECUTIVE MODE

After a load (or append) command, you are automatically 
placed in the editor mode, just as if you had hit "E". The 
source will automatically be loaded to the correct address. 
Subsequent LOAD or SAVE commands will display the last used 
filename, followed by a flashing "?". If you hit the "Y" 
key, the current file name will be used for the command. If 
you hit any other key (e.g. RETURN) the cursor will be 
placed on the first character of the filename, and you may 
type in the desired name. RETURN alone at this time will 
cancel the command.

4.3. S: SAVE

Use this to save a source file to disk. As in the load 
command, you do not specify the suffix ".S" and you can hit 
RETURN to cancel the command. NOTE: that the address and 
length of the source file are shown on the MENU, and are 
for information only. You should not use these for saving; 
the assembler remembers them better than you can and sends 
them to DOS automatically. As in the LOAD command above, 
the filename will be displayed and you may type "Y" to SAVE 
the same filename, or any key for a new file name.

4.4. A: APPEND

This loads in a specified source file and places it at the 
end of the file currently in memory. It operates in the 
same way as the load command, and does not affect the 
default file name. It does not save the appended file; you 
are free to do that if you wish.

22
```
```
MERLIN Users Manual                           EXECUTIVE MODE

4.5. D: DRIVE

When you hit "D", the drive used for saving and loading, 
will change from one to two or two to one. The currently 
selected drive is shown on the menu. When MERLIN is first 
BRUN, the selected drive will be the one used by the BRUN. 
There is no command to specify slot number, but this can be 
accomplished by typing "C" for CATALOG which will display 
the current disks directory. Then give the disk command 
"CATALOG, Sn", where n is the slot number. This action will 
catalog the newly specified drive.

4.6. E :EDITOR

This command places you in the EDITOR/ASSEMBLER mode. It 
automatically sets the default tabs for the editor to those 
. appropriate for source files.

4.7. 0: SAVE OBJECT CODE

You are permitted to use this command only after the 
successful assembly of a source file. In this case you 
will see the address and length of the object code on the 
menu. As with the source address, this is given for 
information only.

NOTE: that the object address shown is that of the 
program's ORG (or $8000 by default) and not that of the 
actual current location of the assembled code (which is 
$8000 or whatever OBJ you have used). When using this 
command, you are asked for a name for the object file. 
Unlike the source file case, no suffix will be appended to 
this name.

23
```
```
MERLIN Users Manual                           EXECUTIVE MODE

Thus you can safely use the same name as that of the source 
file (without the ".S" of course). When this object code is 
saved to the disk its address will be the correct one, the 
one shown on the menu. When later, you BLOAD or BRUN it, it 
will go to that address, which can be anything ($300, $800, 
etc.). There is usually no need to use an OBJ in the source 
code, unless the object code will be too long for the space 
available at $8000 and above.

4.8. Q: QUIT

This exits to BASIC. You may re-enter MERLIN by issuing the 
"ASSEM" command. This re-entry will be a warm start, which 
means it will not destroy the source file currently in 
memory. This exit can be used to give disk commands, if it 
is more convenient than the one provided by "C".

4.9. R : READ

This reads text files into MERLIN. They are always appended 
to the current buffer. To clear the buffer and start fresh, 
the name given will become the default filename. Appended 
reads will not do this.

When the read is complete, you are placed in the editor. If 
the file contains lines longer than 255 characters, these 
will be divided into two or more lines by the READ routine. 
The file will be read only until it reaches HIMEM, will 
produce a memory error if it goes beyond, and only the data 
read to that point will remain.

The READ and WRITE command will append a "T." to the begin- 
ning of the filename you specify UNLESS you precede the 
filename with a space or any other character in the ASCII 
range of $20 to $40. This character will be ignored and not 
used by DOS in the actual filename.

24
```
```
MERLIN Users Manual                           EXECUTIVE MODE

4.10. W:WRITE

This writes a MERLIN file into a text file instead of a 
binary file. The speed of the READ and WRITE routines is 
approximately that of a BLOAD or BSAVE. The WRITE routine 
does a VERIFY after the write.

25
```
```
MERLIN Users Manual                               THE EDITOR

5 . THE EDITOR

Basically there are three modes in the editor: the COMMAND 
mode, the ADD or INSERT mode, and the EDIT mode. The main 
one is the COMMAND mode, which has a "colon" (:) as prompt.

5.1. Command Mode

For many of the COMMAND mode commands, only the first 
letter of the command is required, the rest being optional. 
We show the required command characters in upper case and 
the optional ones in lower case. In some commands, you 
must specify a line number, a range or a range list. A line 
number is just a number. A range is a pair of line numbers 
separated by a comma. A range list consists of several 
ranges separated by "slashes" (/).

Several commands allow specification of a string. The 
string must be "delimited" by a non-numeric character other 
than the slash. Such a delimited string is called a 
d-string. The usual delimiter is single or double "quote 
marks" (' or ").

Line numbers in the editor are provided automatically. You 
never type them when entering text; only when giving com- 
mands. If a line number in a range exceeds the number of 
the last line, it is automatically adjusted to the last 
line number. The commands are:

5.1.1. HImem

(a number, decimal or hex, between the end of source and 
38995 decimal, $9853). This command is rarely needed. It 
sets the upper limit for the source file and beginning 
address for the OBJ file (default OBJ address). HIMEM 
defaults to $8000, and does not have to be set unless you 
use a non-default object address.

27
```
```
MERLIN Users Manual                               THE EDITOR

5.1.2. NEW

Deletes present source file, resets HIMEM to $8000 and 
starts fresh.

5.1.3. PR#(0-7)

Same function as in BASIC. Mainly used for sending an 
editor or assembly listing to a printer. DO NOT use this to 
select an 80-column card.

5.1.4. USER

This does a JSR $3F5. (That is the Applesoft ampersand 
vector location, which normally points to an RTS.) The 
designed purpose of this command is for the connection of 
user defined printer drivers. (You must be careful that 
your printer driver does not use zero page addresses, 
except the I/O pointers and $60 - $6F, because this is 
likely to interfere with MERLIN's heavy zero page usage).

5.1.5. TABS

TABS number, number, ... <tab character>

This sets the tabs for the editor, and has no effect on the 
assembler listing. Up to nine tabs are possible. The 
default tab character is a space, but any may be specified. 
The assembler regards the space as the only acceptable tab 
character for the separation of labels, opcodes, and 
operands. If you don't specify the tab character, then the 
last one used remains. Entering TABS and a carriage return 
will set all tabs to zero.

28
```
```
MERLIN Users Manual                               THE EDITOR

5.1.6. LENgth

This gives the length in bytes of the source file, and the 
number of bytes remaining before HIMEM (usually $8000 - not 
BASIC HIMEM).

5.1.7. Where

Where (line number)

This prints in hex, the location in memory of the start of 
the specified line. Where "Ø" (or "WØ") will give the 
location of the end of source.

5.1.8. MONitor

This exits to the monitor. You may re-enter by either 
CTRL-C, CTRL-B or CTRL-Y. These re-establish the im- 
portant zero page pointers from a save area inside MERLIN 
itself. Thus CTRL-Y will give a correct entry, even if you 
have messed up the zero page pointers while in the monitor. 
DOS is not connected when using this entry to the monitor. 
This facility is designed for experienced Apple 
programmers, and is not recommended to beginners. You may 
re-enter the editor directly with an ØG.

This re-entry, unlike the others, will use the zero page 
pointers at $ØA - $ØF instead of the ones saved upon exit. 
Therefore, you must be sure that they have not been altered.

29
```
```
MERLIN Users Manual                               THE EDITOR

5.1.9. TRuncON

This sets a flag which, during LIST or PRINT, will 
terminate printing of a line upon finding a space fol- 
lowed by a semicolon. It makes reading of source files 
easier on the Apple 40 column screen. In the assembler, it 
limits printing of the object code to three bytes per line 
and has no effect on comments.

5.1.10. TRuncOFf

This returns to the default condition of the truncation 
flag (which also happens automatically upon entry to the 
editor from the EXEC mode or from the assembler). In the 
assembler, this directs that all object bytes be printed.

5.1.11. Quit

Exits to EXEC mode.

5.1.12. ASM

This passes control to the assembler, which attempts to 
assemble the source file. First, however, you are asked if 
you wish to "update the source". This is to remind you to 
change the date or identification number in your source 
file. If you answer "N" then the assembly will proceed. If 
you answer "Y", you will be presented with the first line 
in the source containing a "/" and are placed in EDIT mode. 
When you finish editing this line and hit RETURN, assembly 
will begin. If you use the CTRL-C edit abort command, 
however, you will return to the EDITOR command mode, and 
any I/O hooks you have established, by PR# etc., will have 
been disconnected. This will also happen if there is no 
line with a "/".

30
```
```
MERLIN Users Manual                               THE EDITOR

NOTE: By establishing a comment line with "*/" at the 
beginning, you have a nearly automatic method of keeping 
track of multiple versions of a program.

5.1.13. Control-D

During the second pass of assembly, typing a CTRL-D will 
toggle the list flag, so that listing will either stop or 
resume. This will be defeated if a LST opcode occurs in the 
source, but another CTRL-D will reinstate it.

5.1.14. Delete

Delete (line number) <range> <range list> Delete (range) 
Delete (range list)

This deletes the specified lines. Since, unlike BASIC, the 
line numbers are fictitious they change with any insertion 
or deletion. Therefore, you MUST specify the 'higher' range 
first!

5.1.15. Replace

Replace (line number)

Replace (range)

This deletes the line number or range, then places you into 
INSERT mode at that location.

31
```
```
MERLIN Users Manual                               THE EDITOR

5.1.16. List

List (line number) List (range) List (range list)

Lists the source file with added line numbers. Control 
characters in source are shown in inverse, unless the 
listing is being sent to a printer or other nonstandard 
outport. The listing can be aborted by CTRL-C or with "/" 
key. You may stop the listing by hitting the space bar and 
then advance a line at a time by hitting the space bar 
again. Any other key will restart it. This space bar pause 
also works during assembly and the symbol table print out.

5.1.17. . (period)

Lists starting from the beginning of the last specified 
range. For example, if you type L10,100 then lines 1Ø to 
100 will be listed. If you then use ".", listing will start 
again at 10 and continue until stopped (the end of the 
range is not remembered).

5.1.18. / (line number)

This continues listing from the last line number listed, 
or, when a line number is specified, from that line. This 
listing continues to the end of the file or until it is 
stopped as in LIST.

32
```
```
MERLIN Users Manual                               THE EDITOR

5.1.19. Print

Print (line number) Print (range) Print (range list)

This is the same as LIST except that line numbers are not 
added.

5.1.20. PRinTeR (command)

This command is for sending a listing to a printer with 
page headers and provision for page boundary skips. The 
default parameters may be set up using the configuration 
program. The syntax of this is:

PRTR slot# <string> <page header>

If the slot number used is more than seven, a JSR $3F5 
(ampersand vector) is done and it is expected that the 
routine there will connect a printer driver by putting its 
address $36-$37.

If the page header is omitted, the header will consist of 
page numbers only.

THE INITIALIZATION STRING MAY NOT BE OMITTED. If no special 
string is required by the printer, use an unrecognized 
control character or a null string (in which case a 
carriage return will be used). Examples of initialization 
strings are CTRL-Q for IDS printers, or CTRL-I8ØN for most 
Apple cards.

PRTR Ø (no strings required here) will allow you to see 
where the page breaks occur. If an 80 column card is in use 
in slot 3, then use PRTR 3 for this. No output is sent to 
the printer until a LIST, PRINT, or ASM command is issued.

33
```
```
MERLIN Users Manual                               THE EDITOR

5.1.21. Find

Find (range) Find (range list) Find (d-string)

This lists those lines containing the specified string. It 
may be aborted with CTRL-C or "/" key. Since the CTRL-L 
case toggle works in command mode, you can use it to find 
or change strings with lower case characters.

5.1.22. Change

Change (range)

Change (range list) Change (d-string d-string)

This changes occurrences of the first d-string to the 
second d-string. The d-string must have the same de- 
limiter with the adjoining ones coalescing. For example, 
to change occurrences of "speling to "spelling" throughout 
the range 20, 100, you would type "C20, 100 speling 
spelling". If no range is specified, the entire source file 
is used.

Before the change operation begins, you are asked whether 
you want to change "all" or "some". If you select "some" by 
hitting the "S" key, the editor stops whenever the first 
string is found and displays the line as it would appear 
with the change. If you then hit ESCAPE or any control 
character, the change displayed will not be made. Any other 
key, such as the space bar, will accept the change. CTRL-C 
or "/" key will abort the change process.

5.1.23. COPY

COPY (line number or range) TO (line number)

This copies the range to just 'above' the specified number. 
It does not delete anything.

34
```
```
MERLIN Users Manual                               THE EDITOR

5.1.24. MOVE

MOVE (line number or range) TO (line number)

This is the same as COPY but after copying, automatically 
deletes the original range. You always end up with the same 
lines as before, but in a different order.

5.1.25. Edit

Edit (line number)

Edit (range)

Edit (range list) Edit (d-string) Edit (line number) 
(d-string)

Edit (range) (d-string)

Edit (range list) (d-string)

This presents the range, etc., line by line to be edited 
and puts you into the EDIT mode. If a d-string is appended, 
only those lines containing the d-string are presented.

5.1.26. Hex-Dec Conversion

If, in the command mode, you type a decimal number 
(positive or negative) the hex equivalent is returned. If 
you type a hex number, prefixed by "$", the decimal 
equivalent is returned. All commands accept hex numbers, 
which are mainly convenient for the HIMEM and SYM commands.

35
```
```
MERLIN Users Manual                               THE EDITOR

5.1.27. TEXT

This converts ALL spaces in a source file to inverse 
spaces. The purpose is for use on "text" files so that it 
is not necessary to remember to zero the tabs before 
printing such a file. This conversion has no effect on 
anything except the editor's tabulation.

5.1.28. FIX

This undoes the effect of TEXT. It also does a number of 
technical housekeeping chores. It is recommended that the 
command FIX be used on all files from external sources, 
after which the file should be saved. NOTE: that the TEXT 
and FIX routines are written in SWEET 16 and are somewhat 
slow. Several minutes may be needed for their execution on 
large files. FIX or an EDIT will truncate any lines longer 
than 255 characters.

5.1.29. SYM

MERLIN places the symbol table on the language card (in 
bank 1 of $DØØØ-$DFFF). This space is quite adequate for 
all but gigantic programs. In case this space is used up, 
the SYM command gives you a means to direct the assembler 
to continue the symbol table in another area. If you type 
SYM $9000, for example, and assemble the program, when and 
if the symbol table uses up its normal space, it will be 
continued at $9000 until it reaches BASIC HIMEM. It must be 
noted that the SYM command will be cancelled by a HIMEM 
command or by exit to EXEC mode and re-entry (set HIMEM 
before setting up a SYM address.) The SYM address must be 
above HIMEM and below BASIC HIMEM. If the symbol table 
grows beyond the allotted space, you will get a memory 
error during the first pass of assembly.

36
```
```
MERLIN Users Manual                               THE EDITOR

5.1.30. VIDeo

This command is designed to select or deselect an 8Ø column 
board. The default condition can be selected using the 
configuration program. This is similar to the use of PR# in 
BASIC. DO NOT USE PR# to select an 80 column board! PR# is 
designed for selection of a printer ONLY. An 80 column 
board in slot 3 for example, can be selected by typing, 
from the editor: VIDEO 3.

It is deselected by VIDEO Ø or VIDEO $10 possibly fol- 
lowed by RESET. The latter two forms both select the 
standard Apple screen, but VIDEO Ø will cause all lower 
case output to the screen to be converted to upper case 
except lower case in the source file will be converted to 
flashing upper case (output to a printer is never 
converted). If you have a lower case adapter, you will want 
to use VIDEO $10 (or VIDEO 16) instead of VIDEO Ø when 
selectng the Apple screen. If your 80 column card has a 
software screen switch via an escape sequence, this may be 
used to return to 40 column mode. This will be equivalent 
to "VID $10" and would have to be followed by a VID Ø if 
you don't have a lower case adapter. For example, use ESC 
CTRL-Q RETURN on the Smarterm or ESC-Q- CTRL-X on the 
Sup"R"term.

5.1.31. FW (Find Word)

FW "word"

This is an alternative to the (F)IND command. It will find 
the specified word only if it is surrounded, in source, by 
non-alphanumeric characters. Therefore, FW"CAT" will find:

CAT CAT-1 (CAT, X)

but will not find CATALOG or SCAT.

37
```
```
MERLIN Users Manual                               THE EDITOR

5.1.32. CW (Change word)

CW "word" new stuff"

This works as described under FW.

5.1.33. EW (Edit word)

EW "word"

This is to EDIT as FW is to FIND.

5.1.34. VAL

VAL "expression"

This will return the value of the expression as the 
assembler would compute it.

Examples :

VAL "LABEL" gives the address (or value) of LABEL for the 
last assembly done or "unknown label"

|                 | if not   | found.   |
|:----------------|:---------|:---------|
| VAL "$1000/2"   | returns  | $0800    |
| VAL "%1000"     | returns  | $0008    |
| VAL !"A" - "Ø"! | returns  | $0011    |

NOTE: For the commands involving a string, the character 
""" acts as a "WILD CARD". Therefore, F"Jon's" will find 
both "Jones" and "Jonas".

38
```
```
MERLIN Users Manual                               THE EDITOR

5.2. Add/Insert Mode

The ADD and INSERT modes in the editor act as if you are in 
the mode, except that CTRL-R will do nothing, and the exit 
from ADD mode acts as described. Hitting RETURN, for 
example, will accept the entire line as shown on the screen.

5.2.1. Add

This places you in the ADD mode, and acts much like 
entering BASIC lines with auto line numbering. However, you 
may enter lower case text (useful for comments if you have 
a lower case adapter) by typing CTRL-L. This acts as a case 
toggle, so another CTRL-L returns you to UPPERCASE mode. To 
exit from ADD mode, hit RETURN as the FIRST character of a 
line. You may enter an EMPTY line by typing a space and 
then RETURN. This will not enter the space into text, it 
only bypasses the exit. The editor automatically removes 
extra spaces at the end of lines. You may also exit the ADD 
mode by CTRL-X or CTRL-C which also cancels the current
line.

5.2.2. Insert

Insert (line number)

This allows you to enter text just 'above' the specified 
line. Otherwise, it functions the same as ADD mode.

5.2.3. Control-L

Toggles the current case. If you are in upper case, CTRL-L 
will place you in lower, and vice versa. Upper case is 
defaulted to when entering each new line.

To change the case of a word, type CTRL-L, then copy over 
the word using the right arrow.

39
```
```
MERLIN Users Manual                               THE EDITOR

5.3. Edit Mode

After typing E in the editor, you are placed in EDIT mode. 
The first line of the range you have specified is placed on 
the screen with the cursor on its first character. The line 
is tabbed as it is in listing, and the cursor will jump 
across the tabs as you move it with the arrow keys. When 
you are through editing, hit RETURN.

The line will be accepted as it appears on the screen, no 
matter where the cursor is when you hit RETURN. The EDIT 
commands and functions are very similar, but not identical 
to those in Neil Konzen's Program Line Editor and 
Southwestern Data System's A.C.E. All commands except 
CTRL-R are available in ADD and INSERT modes.

5.4. Edit Mode Commands

5.4.1. Control-I (insert)

Begins insertion of characters. This is terminated by any 
control character except the CTRL-L case toggle, such as 
the arrows or RETURN.

5.4.2. Control-D (delete)

Deletes the character under the cursor.

5.4.3. Control-F (find)

Finds the next occurrence of the character typed after the 
CTRL-F. This is recursive.

40
```
```
MERLIN Users Manual                               THE EDITOR

5.4.4. Control-0 (insert special)

Functions as CTRL-I, except it inserts any control char- 
acter (including the command characters such as CTRL-Q).

Besides enabling the insertion of control characters, 
CTRL-O also allows the user to type characters not 
normally available on the Apple keyboard.

               Control-O followed by:
                
        <   gives   Control _                    
        >   "       Control \                    
        K   "      [                            
        L   "      \                            
        M   "      ]                            
        N   "      ^                            
        O   "      _                            
        k   "      {                            
        1   "      |                             
        m   "      }                            
        n   "      ~                            
        o   "      (whatever $FF gives on your  
                    machine)                     

NOTE: If you are using a shift key modification, de- 
pending on which one you have, shift-M may give uppercase 
M and you will have to use CTRL-O to get the right bracket.

5.4.5. Control-P (do ***)

If entered as first character of a line gives 32 *'s.

5.4.6. Control-@ (do border)

If entered as first character of a line gives 30 spaces 
bordered by *'s.

41
```
```
MERLIN Users Manual                               THE EDITOR

5.4.7. Control-C or Control-X (cancel)

Aborts EDIT mode and returns to the editor's warm start. 
The current line being edited will retain its original form.

5.4.8. Control-B (go to line begin)

Places the cursor at the beginning of the line.

5.4.9. Control-N (go to line end)

Places the cursor one space to the right of the end of the 
line.

5.4.10. Control-R (restore line)

Returns the line to its original form. (Not available in 
ADD and INSERT modes.)

5.4.11. Control-Q (delete line right)

Deletes the part of the line following the cursor.

5.4.12. Return (RETURN key)

    Accepts the line as it appears on the screen and fetches 
    the next line to be edited, or goes to the warm start if
    the specified range has been completed.

The editor automatically replaces spaces in comments and 
ASCII strings with inverse spaces. When listing, it 
converts them back, so you never notice this. Its purpose 
is to avoid inappropriate tabbing of comments and ASCII 
strings.

42
```
```
MERLIN Users Manual                               THE EDITOR

In the case of ASCII strings, this is only done when the 
delimiter is a quote (") or a single quote ('). You can, 
however, accomplish the same thing by editing the line, 
replacing the first delimiter with a quote, hitting RETURN, 
then editing again and changing the delimiter back to the 
desired one.

43
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

<div name=EQU></div><div name=ORG></div>

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

<div name=OBJ></div><div name=PUT></div>

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

<div name=VAR></div><div name=SAV></div>

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

<div name=DSK></div><div name=END></div>

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

<div name=LST></div><div name=EXP></div>

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

<div name=PAU></div><div name=PAG></div><div name=AST></div><div name=SKP></div>

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
effect on the screen listing even when using an 80-column
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

<div name=TR></div><div name=ASC></div><div name=DCI></div>

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

<div name=INV></div><div name=FLS></div><div name=REV></div><div name=DA></div>

```
MERLIN Users Manual                            THE ASSEMBLER

6.9.3. INV

INV d-string (INVerse)

This puts a delimited string in memory in inverse format. 
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

<div name=DDB></div><div name=DFB></div>

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

<div name=HEX></div><div name=DS></div><div name=KBD></div>

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

<div name=LUP></div>

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

<div name=CHK></div><div name=ERR></div>

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

<div name=USR></div>

```
MERLIN Users Manual                            THE ASSEMBLER

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

<div name=DO></div>

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

<div name=ELSE></div><div name=FIN></div><div name=MAC></div><div name=EOM></div>

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

<div name=PMC></div>

```
MERLIN Users Manual                            THE ASSEMBLER

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

<div name="NAME MAC"></div>

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

<div name="TRDB MAC"></div>

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
