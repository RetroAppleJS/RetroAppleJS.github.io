; ****** CODE FOR EOR SHAPE ******

*=$6000
TEMP        = $1B
TEMPL       = $1D
TEMPH       = $1E

MON.PRBYTE  = $FDDA   ; print hex byte
MON.CRDO    = $DAFB   ; line feed
MON.COUT    = $FDED   ; print char
MON.OUTSP   = $DB57   ; Space
M.KPRESS    = $FD35   ; key press

        LDA #$8C
        STA *TEMP
        INC *TEMP

START   DEC *TEMP
        LDA *TEMP
        JSR MON.PRBYTE
        JSR MON.OUTSP
        LDA *TEMP
        JSR DIV3.5
        LDA *TEMPL
        JSR MON.PRBYTE
        JSR MON.OUTSP
        LDA *TEMP
        JSR MOD7
        ASL A
        ASL A
        JSR MON.PRBYTE
        JSR MON.CRDO
        ;JSR M.KPRESS
        LDA *TEMP
        BNE START
        RTS

DIV3.5  TAX
        STA *TEMPL
        LSR A
        LSR A
        LSR A
        ADC *TEMPL
        ROR A
        LSR A
        LSR A
        ADC *TEMPL
        ROR A
        LSR A
        STA *TEMPL  ; DIV 3.5
        RTS

MOD7    LSR A
        STA *TEMPH
        ASL A
        ASL A
        ASL A
        SEC
        SBC *TEMPH
        STA *TEMPH
        TXA
        SEC
        SBC *TEMPH  ; CYCLE 0-6
        STA *TEMPH
        RTS


; *** PRINT ADDRESS by Y,A ***
PRTADR  JSR MON.PRBYTE
        TYA
        JSR MON.PRBYTE
        RTS

; *** PRINT STRING from Y = INDEX ***
ISTROUT LDY #<STR.00    ; init pointer
        STY *TEMPL
        LDY #>STR.00    ; init pointer
        STY *TEMPH
        LDY #$00
        TAX             ; X = array index
        BEQ IST.2
        DEY
IST.1   INY
        LDA (TEMPL),Y
        BNE IST.1
        DEX
        BNE IST.1
        INY             ; Y = found starting index
IST.2   LDA (TEMPL),Y   ; Print string until next zero
        BEQ IST.3
        JSR MON.COUT
        INY
        BNE IST.2
IST.3   RTS

; *** STRING DATA ***
STR.00  ASC "DTEST:"    ;0
        HEX 00

; ****** END CODE FOR XOR SHAPE ******
