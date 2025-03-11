CALL-151
0300: A2 4C A9 10 A0 03 8E F5
0308: 03 8D F6 03 8C F7 03 60
0310: C9 24 F0 17 20 67 DD 20
0318: 52 E7 A9 A4 20 ED FD A5
0320: 51 F0 03 20 DA FD A5 50
0328: 4C DA FD A0 00 20 B1 00
0330: F0 08 49 80 99 00 02 C8
0338: D0 F3 99 00 02 A8 20 A7
0340: FF A6 3E A5 3F C0 06 90
0348: 03 4C 99 E1 C0 03 B0 02
0350: A9 00 4C 24 ED
300G
E003G

&24576  :REM DEC>HEX $6000
         REM $ ADMINTS MAX 4 NUM
&$6000
I=16384
&I      :REM VAR>HEX $4000
&255+1  :REM EXP>HEX $0100

;- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -



;*************************************
;***                               ***
;***  HEX/DECIMAL/HEX CONVERTER    ***
;***        USING AMPERSAND        ***
;***    COPYRIGHT (C) 1982 BY      ***
;***       JULES H. GILDER         ***
;***     ALL RIGHTS RESERVED       ***
;***                               ***
;*************************************

ORG $300

A2L     = $3E
LINNUM  = $50
CHRGET  = $B1
IN      = $200
AMPERSD = $3F5
FRMNUM  = $DD67
IQERR   = $E199
GETADR  = $E752
LINPRT  = $ED24
PRBYTE  = $FDDA
COUT    = $FDED
GETNUM  = $FFA7
;
; This is where the ampersand (&) vector
; jump is set up.
;
         LDX #$4C        ;Get JMP op code and
         LDA #<START     ;the low and high bytes
         LDY #>START     ;of START'S address and
         STX AMPERSD     ;store them in locations
         STA AMPERSD+1   ;$3F5, $3F6 and $3F7.
         STY AMPERSD+2
         RTS
;
; This part of the program checks to
; see if the character immediately following
; the ampersand (&) was a dollar sign.
; If it was, control is passed to the
; routine that converts from hexadecimal
; to decimal.  Otherwise the number is
; decimal and converted to hexadecimal.
;
START    CMP #'$'        ;Is it a dollar sign ($)?
         BEQ HEXIN       ;Yes, convert hex to decimal.
         JSR FRMNUM      ;No, evaluate number or formula.
         JSR GETADR      ;Convert to integer form.
         LDA #$A4        ;Output a dollar sign ($).
         JSR COUT
         LDA *LINNUM+1   ;Get high byte.
         BEQ PRINTLO     ;If zero, get low byte.
         JSR PRBYTE      ;Otherwise print high byte.
PRINTLO  LDA *LINNUM     ;Get low byte.
         JMP PRBYTE      ;Print it.
;
; This routine handles the hexadecimal
; to decimal conversion.
;
HEXIN    LDY #$0         ;Zero offset index.
HEXIN2   JSR CHRGET      ;Get the next character.
         BEQ PUTBUF      ;Store in buffer and convert.
         EOR #$80        ;Set high bit.
         STA IN,Y        ;Store in input buffer.
         INY             ;Increment offset index.
         BNE HEXIN2      ;Get next character.
PUTBUF   STA IN,Y        ;Store zero in buffer.
         TAY             ;Zero offset index.
         JSR GETNUM      ;Convert number expression to hex.
         LDX *A2L        ;Store low byte in X-register.
         LDA *A2L+1      ;Store high byte in Y-register.
         CPY #$6         ;Check if number too large.
         BCC INRANGE     ;No, it's okay.
         JMP IQERR       ;Yes, print error message.
INRANGE  CPY #$3         ;Converting only 1 byte?
         BCS PRINTIT     ;No, do both.
         LDA #$0         ;Yes, do just one.
PRINTIT  JMP LINPRT      ;Convert and print number.
