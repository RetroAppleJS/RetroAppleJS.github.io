*=$300
A1L      =     $3C        ;MOVE source start
A1H      =     $3D
PTR      =     $3C        ;Ptr for fixing links
A2L      =     $3E        ;MOVE source end
A2H      =     $3F
DIFF     =     $40        ;Offset for move (at A3L,A3H)
A4L      =     $42        ;MOVE dest start
A4H      =     $43
LINNUM   =     $50        ;GETADR puts address here
TXTTAB   =     $67        ;Ptr to prog start
VARTAB   =     $69        ;Ptr to vars start
HIGHDS   =     $94        ;BLTUC dest end
HIGHTR   =     $96        ;BLTUC source end
LOWTR    =     $9B        ;BLTUC source start
PRGEND   =     $AF        ;Ptr to prog end

STRNG1 = $AB
STRNG2 = $AD

CHRGET   =     $B1        ;Get a character in A & increment ptr
CHRGOT   =     $B7        ;Get a character in A & increment ptr
TXTPTR   =     $B8        ;Ptr to token being interpreted
BLTUC    =     $D39A      ;Block move up
CLEARC   =     $D66C      ;CLEAR statement
NEWSTT   =     $D7D2      ;Execute next statement
OUTDO    =     $DB5C      ;Print character in A
FRMNUM   =     $DD67      ;Eval numeric expr
CHKCOM   =     $DEBE      ;Parse comma
CHKSTR   =     $DD6C
GETSTR   =     $E6DC
GETADR   =     $E752      ;Convert FAC to address
MOVE     =     $FE2C      ;Block move down
ZERO_FAC =     $E84E
         JSR   CHKCOM     ;Check for comma
         JSR   GETSTR       ;GET POINTER TO STRING IN INDEX
         BNE   P1           ;LENGTH NON-ZERO
         JMP   ZERO_FAC     ;RETURN 0 IF LENGTH=0
P1       LDX TXTPTR       ;SAVE CURRENT TXTPTR
         LDY TXTPTR+1
         STX STRNG2
         STY STRNG2+1
         LDA STRNG2+1
         JSR   $FDDA
         LDA STRNG2
         JSR   $FDDA

         ;JSR   CHRGOT    ;Check first char
         ;JSR   OUTDO     ;PRINT ASCII char from A

         ;JSR   FRMNUM     ;Parse number
         ;JSR   GETADR     ;Convert to addr in LINNUM
         ;LDA   *LINNUM+1
         ;JSR   $FDDA
         ;LDA   *LINNUM
         ;JSR   $FDDA
         RTS
