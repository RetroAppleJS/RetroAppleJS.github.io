;*-------------------------------
;* DecPrint - 6502 print 16 bits
;*
;* by Mike B (barrym95838) 7/7/2017
;*
;* Disassembly, comments, and
;* optimization by John Brooks 7/8/2017
;*-------------------------------

*=$6000
M.COUT     = $FDED   ; print char
M.IOSAV    = $FF4A   ; IOSAVE
M.PRBYTE   = $FDDA   ; print hex byte
DECWORD    = $45
ROMPLA     = $FDE2 ;PLA then PrHexZ

START     JMP RUN_ME
HEXNUM    HEX 1234        ; INPUT HEX NUMBER

RUN_ME    LDA HEXNUM      ; Hi-Byte
          JSR M.PRBYTE
          LDA HEXNUM+1    ; Lo-Byte
          JSR M.PRBYTE
          LDA #$BD      ; '='
          JSR M.COUT

          LDX HEXNUM       ; Hi-Byte
          LDA HEXNUM+1     ; Lo-Byte
          JSR DECP16
          RTS

;*-------------------------------
;* PRINT U16 AS DECIMAL VIA COUT
;* IN: A=HI, X=LO
;* OUT: A=$00, X=$00, Y=$FF
;*-------------------------------

DECP16      JSR M.IOSAV
DP16.0      LDA #$00      ;FLAG END-OF-DIGITS
            CLV
            LDX #16       ;16-bit divide
DP16.1      CMP #5        ;CALC DECWORD/10
            BCC DP16.2
            SBC #$85      ;REMOVE HIGH-ORDER DIGIT & SHIFT 1 INTO DECWORD
            SEC           ;DIVDONE=FALSE
DP16.2      ROL DECWORD   ;SHIFT /10 RESULT INTO DECWORD
            ROL DECWORD+1
            ROL A         ;SHIFT BITS OF INPUT INTO ACC (INPUT MOD 10)
            DEX
            BNE DP16.1      ;CONTINUE 16-BIT DIVIDE
DP16.3      PHA
            LDA #>ROMPLA-1  ; TRICK: PUSH RETURN ADDRESS INTO STACK
            PHA             ; SO AFTER RTS, ONE MORE BYTE IS PRINTED
            LDA #<ROMPLA-1
            PHA
            BVS DP16.0
            RTS
