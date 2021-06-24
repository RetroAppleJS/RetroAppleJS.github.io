;- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ;*************************************
;***                               ***
;***  HEX/DECIMAL/HEX CONVERTER    ***
;***        USING AMPERSAND        ***
;***    COPYRIGHT (C) 1982 BY      ***
;***       JULES H. GILDER         ***
;***     ALL RIGHTS RESERVED       ***
;***                               ***
;*************************************

; BASIC COMMAND LINES (TUTORIAL)

;&24576  :REM DEC>HEX $6000
;&$6000
;I=16384
;&I      :REM VAR>HEX $4000
;&255+1  :REM EXP>HEX $0100


*=$300

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
