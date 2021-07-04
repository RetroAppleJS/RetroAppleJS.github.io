*=$6000
M.PRHEX   = $FDE3   ; print right nibble (A)
M.PRBYTE  = $FDDA   ; print hex byte (A)
M.PRNTX   = $F944   ; print hex byte (X)
M.PRNTYX  = $F940   ; print hex word (Y=hi X=lo)
M.PRNTAX  = $F941   ; print hex word (A=hi X=lo)
M.PRDEC   = $ED24   ; print dec word (A=hi X=lo)
M.CRDO    = $DAFB   ; print line feed
M.OUTSP   = $DB57   ; space
M.COUT    = $FDED   ; print char
M.STROUT  = $DB3A   ; print string from address (Y=hi A=lo)


        LDA #$02
        JSR ISTROUT       ; PRINT INDEX-BASED STRING (A=INDEX)
        LDA #$02
        JSR M.PRBYTE      ; PRINT BYTE (A)
        JSR M.CRDO        ; PRINT LINEFEED

        LDY #>STR.00
        LDA #<STR.00
        JSR M.STROUT      ; PRINT POINTER-BASED STRING (Y=HI A=LO)

        LDA #$01
        JSR ISTROUT
        LDA #>ISTROUT
        LDX #<ISTROUT
        JSR M.PRNTAX      ; PRINT HEX WORD (A=HI X=LO)

        LDA #'>'
        JSR M.COUT        ; PRINT CHARACTER (A)

        LDA #>ISTROUT
        LDX #<ISTROUT
        JSR M.PRDEC       ; PRINT DEC WORD (A=HI X=LO)

        LDA #'>'
        JSR M.COUT
        LDA #'%'
        JSR M.COUT

        LDA #>ISTROUT
        JSR PRBITS
        LDX #<ISTROUT
        JSR PRBITS

        RTS

; *** PRINT 8 BITS ***
; *** A = BYTE     ***

PRBITS  LDX #$08
        STA PRD
PRB.0   ROL PRD
        LDA #'0'
        ADC #$00
PRB.1   JSR M.COUT
        DEX
        BNE PRB.0
        RTS
PRD     HEX 00


; *** PRINT INDEX-BASED  STRING ***
; *** A = INDEX     (41 Bytes)  ***

ISTROUT TAX           ; INDEX-BASED STRING OUT A=INDEX
        LDY #>STR.00
        LDA #<STR.00
IST.00  STA *$AB
        DEY
        STY *$AC
        LDY #$FF
        CPX #$00
        BEQ IST.02
IST.01  JSR IST.03
        BNE IST.01     ; encounter zero value ?
        DEX
        BNE IST.01     ; encounter zero counter ?
IST.02  JSR IST.03
        BEQ IST.06     ; encounter zero value ?
        JSR M.COUT
        BCC IST.02     ; usually carry is clear
IST.03  INY
        BNE IST.05
        INC *$AC
IST.05  LDA ($AB),Y
IST.06  RTS


; - - - - - - - - - - - - - - - - - - -


; STRING DATA

STR.00  HEX 8D
        ASC "POINTER-BASED PRINTING"
        HEX 8D
        ASC "& MULTILINE"
        HEX 8D8D00
STR.01  ASC "M.STROUT:$"
        HEX 00
STR.02  ASC "INDEX-BASED PRINTING A="
        HEX 00

;60B4
