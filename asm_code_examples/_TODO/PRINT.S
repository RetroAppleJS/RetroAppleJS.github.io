*=$6000
BT_AD1      = $06
BT_AD2      = $07

        LDA #<STR.01
        LDY #>STR.01
        JSR PRTSTR      ; Print string
        LDA #>PRTSTR
        LDY #<PRTSTR
        JSR PRTADR      ; Print address
        JSR PRTLF
        LDA #<STR.02
        LDY #>STR.02
        JSR PRTSTR      ; Print string
        LDA #>PRTADR
        LDY #<PRTADR
        JSR PRTADR      ; Print address
        RTS

; *** STRING DATA ***
STR.01  ASC "PRTSTR:"
        HEX 00
STR.02  ASC "PRADR:"
        HEX 00

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
PRTADR  JSR $FDDA
        TYA
        JSR $FDDA
        RTS

; *** PRINT LINEFEED ***
PRTLF   LDA #$8D           ; line feed
        JSR $FDED
        RTS
