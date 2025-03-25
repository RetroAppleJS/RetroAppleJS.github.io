; LAST BUILD 25-MAR-2025
ORG $6000

;*      FASTER 16X16 MULTIPLY
;*      BY BROOKE W. BOERING
;*      NEARLY AS PUBLISHED IN MICRO--THE 6502 JOURNAL
;*      PAGE 72, DECEMBER, 1980.
;*      https://archive.org/details/Micro_NO._31_1980-12_Micro_Ink_US/page/n71/mode/2up
;*      https://w.txbobsc.com/aal/1981/aal8102.html
;*
;*      go to apple monitor (CALL -151)
;*      type:  0FFF<1000.1230[ctrl-Y]
;*      result:   1000*1230+0FFF=01230FFF
;*---------------------------------

ACL         EQU $50
ACH         EQU ACL+1
XTNDL       EQU $52
XTNDH       EQU XTNDL+1
AUXL        EQU $54
AUXH        EQU AUXL+1
M.PRBYTE    EQU $FDDA   ; print hex byte
M.COUT      EQU $FDED   ; print char

ORG $6000
JMP.Y  LDA #$4C      ; SET CTRL-Y JUMP LOCATION IN $358-35A
       STA $3F8
       LDA #<MAIN
       STA $3F9
       LDA #>MAIN
       STA $3FA
       RTS

;*---------------------------------
;*      MAIN ROUTINE 
;*---------------------------------

MAIN   JSR GET.Y     ; GET ARGUMENTS FROM CTRL-Y
       ;JSR PREFIL   ; PREFILL ARGUMENTS (FOR DIRECT DEBUGGING)
       JSR PRTARG    ; PRINT ARGUMENTS

       JSR RMUL      ; MULTIPLY

       ;JSR $FF4A    ; save registers
       ;JSR $FADA    ; print registers

       JSR PRTRES    ; PRINT RESULT
       RTS

;*---------------------------------

GET.Y  LDA $3C       ;MOVE A1L,A1H TO *ACL,*ACH
       STA *ACL
       LDA $3D
       STA *ACH
       LDA $3E       ;MOVE A2L,A2H TO *AUXL,*AUXH
       STA *AUXL
       LDA $3F
       STA *AUXH
       LDA $42       ;MOVE A4L,A4H TO *XTNDL,*XTNDL
       STA *XTNDL
       LDA $43
       STA *XTNDH
       RTS

PREFIL LDA #$10      ; PREFILL ARGUMENTS
       STA *ACH
       LDA #$04
       STA *ACL
       LDA #$10
       STA *AUXH
       LDA #$00
       STA *AUXL
       LDA #$00
       STA *XTNDH
       STA *XTNDL
       RTS

PRTARG LDA *ACH      ; PRINT ARGUMENTS
       JSR M.PRBYTE
       LDA *ACL
       JSR M.PRBYTE
       LDA #$2A+$80  ; *
       JSR M.COUT
       LDA *AUXH
       JSR M.PRBYTE
       LDA *AUXL
       JSR M.PRBYTE
       LDA #$2B+$80  ; +
       JSR M.COUT
       LDA *XTNDH
       JSR M.PRBYTE
       LDA *XTNDL
       JSR M.PRBYTE
       LDA #$3D+$80  ; =
       JSR M.COUT
       RTS

PRTRES LDA *XTNDH    ; PRINT 32-BIT RESULT
       JSR M.PRBYTE
       LDA *XTNDL
       JSR M.PRBYTE
       LDA *ACH
       JSR M.PRBYTE
       LDA *ACL
       JSR M.PRBYTE
       RTS
;*---------------------------------


ORG $101E
;*---------------------------------
; REVISED "MUL" ROUTINE
;   16X16 MULTIPLY
;
; (A=C X=S, Y=0)
; (S)aved / (C)lobbered
;*---------------------------------

RMUL   LDY #$10      ; 16-BIT MULTIPLIER
MUL.1  LDA *ACL      ; (AC * AUX) + XTND
       LSR A         ; CHECK NEXT BIT OF MULTIPLIER
       BCC MUL.2     ; IF ZERO, DON'T ADD MULTIPLICAND
       LDA *XTNDL
       CLC
       ADC *AUXL     ; MULTIPLICAND TO PARTIAL PRODUCT
       STA *XTNDL
       LDA *XTNDH
       ADC *AUXH
       STA *XTNDH
MUL.2  ROR *XTNDH    ; SHIFT PARTIAL PRODUCT
       ROR *XTNDL
       ROR *ACH
       ROR *ACL
       DEY           ; NEXT BIT
       BNE MUL.1     ; UNTIL ALL 16
       RTS





;------------------------------------------------------


;     1000  *---------------------------------
;     1010  *      FASTER 16X16 MULTIPLY
;     1020  *      BY BROOKE W. BOERING
;     1030  *      NEARLY AS PUBLISHED IN MICRO--THE 6502 JOURNAL
;     1040  *      PAGE 72, DECEMBER, 1980.
;     1050  *---------------------------------
;     1060  ACL    .EQ $50
;     1070  ACH    .EQ $51
;     1080  XTNDL  .EQ $52
;     1090  XTNDH  .EQ $53
;     1100  AUXL   .EQ $54
;     1110  AUXH   .EQ $55
;     1120  *---------------------------------
;     1130  RMUL   LDY #16      16-BIT MULTIPLIER
;     1140  .1     LDA ACL      (AC * AUX) + XTND
;     1150         LSR          CHECK NEXT BIT OF MULTIPLIER
;     1160         BCC .2       IF ZERO, DON'T ADD MULTIPLICAND
;     1170         CLC          ADD MULTIPLICAND TO PARTIAL PRODUCT
;     1180         LDA XTNDL
;     1190         ADC AUXL
;     1200         STA XTNDL
;     1210         LDA XTNDH
;     1220         ADC AUXH
;     1230         STA XTNDH
;     1240  .2     ROR XTNDH    SHIFT PARTIAL PRODUCT
;     1250         ROR XTNDL
;     1260         ROR ACH
;     1270         ROR ACL
;     1280         DEY          NEXT BIT
;     1290         BNE .1       UNTIL ALL 16
;     1300         RTS
;     1310  *---------------------------------
;     1320  *      TEST ROUTINE FOR MULTIPLY
;     1330  *---------------------------------
;     1340  SETUP.Y
;     1350         LDA #$4C     PUT "JMP TESTMPY" IN $358-35A
;     1360         STA $3F8
;     1370         LDA #TESTMPY
;     1380         STA $3F9
;     1390         LDA /TESTMPY
;     1400         STA $3FA
;     1410         RTS
;     1420  *---------------------------------
;     1430  TESTMPY
;     1440         LDA $3C      MOVE A1L,A1H TO ACL,ACH
;     1450         STA ACL
;     1460         LDA $3D
;     1470         STA ACH
;     1480         LDA $3E      MOVE A2L,A2H TO AUXL,AUXH
;     1490         STA AUXL
;     1500         LDA $3F
;     1510         STA AUXH
;     1520         LDA $42      MOVE A4L,A4H TO XTNDL,XTNDH
;     1530         STA XTNDL
;     1540         LDA $43
;     1550         STA XTNDH
;     1560         JSR RMUL     MULTIPLY
;     1570         LDA XTNDH    PRINT 32-BIT RESULT
;     1580         JSR $FDDA
;     1590         LDA XTNDL
;     1600         JSR $FDDA
;     1610         LDA ACH
;     1620         JSR $FDDA
;     1630         LDA ACL
;     1640         JMP $FDDA


; I wrote a test routine for the multiply, so that I could check it out. After
; assembling the whole program, I typed "MGO SETUP.Y" to link the control-Y
; Monitor Command to my test routine. Control-Y will parse three 16-bit
; hexadecimal values this way: val1<val2.val3cY stores val1 in $42,$43; val2 in
; $3C,$3D; and val3 in $3E,$3F. ("cY" stands for control-Y.)

; I define val1 to be the initial value for XTNDL,XTNDH; this should normally be
; zero. The two values to be multiplied are val2 and val3. After TESTMPY receives
; control from the control-Y processor, it moves the three values into the right
; locations for the multiply subroutine. Then JSR RMUL calls the multiply routine.
; The following lines (1570-1640) print the 32-bit result by calling a routine in
; the monitor ROM which prints a byte in hex from the A-register.
