; LAST BUILD 11-MAR-2025

ORG $6000

;*      FASTER 16X16 MULTIPLY
;*      BY BROOKE W. BOERING
;*      NEARLY AS PUBLISHED IN MICRO--THE 6502 JOURNAL
;*      PAGE 72, DECEMBER, 1980.
;*---------------------------------

ACL         EQU $05
ACH         EQU $51
XTNDL       EQU $52
XTNDH       EQU $53
AUXL        EQU $54
AUXH        EQU $55
BT_AD1      EQU $06
BT_AD2      EQU $07
MON.PRBYTE  EQU $FDDA   ; print hex byte

;*---------------------------------
RMUL     LDY #16    ;16-BIT MULTIPLIER
MUL.1    LDA ACL    ;(AC * AUX) + XTND
         LSR A      ;CHECK NEXT BIT OF MULTIPLIER
         BCC MUL.2  ;IF ZERO, DON'T ADD MULTIPLICAND
         CLC
         ADC AUXL   ;MULTIPLICAND TO PARTIAL PRODUCT
         LDA XTNDL
         ADC AUXL
         STA XTNDL
         LDA XTNDH
         ADC AUXH
         STA XTNDH
MUL.2    ROR XTNDH  ;SHIFT PARTIAL PRODUCT
         ROR XTNDL
         ROR ACH
         ROR ACL
         DEY        ;NEXT BIT
         BNE MUL.1  ;UNTIL ALL 16
         RTS
;  *---------------------------------
;  *      TEST ROUTINE FOR MULTIPLY
;  *---------------------------------
SETUP.Y
         LDA #$4C  ;PUT "JMP TESTMPY" IN $358-35A
         STA $3F8
         LDA #>TESTMPY
         STA $3F9
         LDA #<TESTMPY
         STA $3FA
         RTS
;  *---------------------------------
TESTMPY
         LDA $3C    ;MOVE A1L,A1H TO ACL,ACH
         STA ACL
         LDA $3D
         STA ACH
         LDA $3E    ;MOVE A2L,A2H TO AUXL,AUXH
         STA AUXL
         LDA $3F
         STA AUXH
         LDA $42    ;MOVE A4L,A4H TO XTNDL,XTNDH
         STA XTNDL
         LDA $43
         STA XTNDH
         JSR RMUL   ;MULTIPLY
         LDA XTNDH  ;PRINT 32-BIT RESULT
         JSR MON.PRBYTE
         LDA XTNDL
         JSR MON.PRBYTE
         LDA ACH
         JSR MON.PRBYTE
         LDA ACL
         JMP MON.PRBYTE

; *** PRINT STRING ***
PRTSTR  STA *BT_AD1   ; Print String from A=lowbyte Y=highbyte, ending with 0
       STY *BT_AD2
       LDY #$00
PR.01   LDA (BT_AD1),Y
       BEQ PR.02
       JSR $FDF0
       INY
       BNE PR.01
       INC BT_AD2
       BNE PR.01
       LDA *BT_AD1
PR.02   RTS

; *** PRINT ADDRESS ***
PRTADR  JSR MON.PRBYTE
       TYA
       JSR MON.PRBYTE
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
