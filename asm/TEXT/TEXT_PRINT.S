*=$6000
M.COUT      = $FDED   ; print char
M.PRBYTE    = $FDDA   ; print hex byte
BT_AD1      = $06
BT_AD2      = $07


MAIN    LDA #<STR.01
        LDY #>STR.01
        JSR PRTSTR	; Print string
        LDA #>PRTSTR
        LDY #<PRTSTR
        JSR PRTADR	; Print address
        JSR PRTLF
        LDA #<STR.02
        LDY #>STR.02
        JSR PRTSTR	; Print string
        LDA #>PRTADR
        LDY #<PRTADR
        JSR PRTADR	; Print address
        JSR PRTLF
        LDA #<STR.03
        LDY #>STR.03
        JSR PRTSTR	; Print string
        LDA #>PRT256
        LDY #<PRT256
        JSR PRTADR	; Print address
        JSR PRTLF
        LDA #>MAIN	; Print 256 byte numbers
        LDY #<MAIN
        JSR PRT256
        RTS

; *** STRING DATA ***
STR.01  ASC "PRTSTR:"
        HEX 00
STR.02  ASC "PRADR:"
        HEX 00
STR.03  ASC "PRT256:"
        HEX 00

; *** PRINT STRING ***
PRTSTR  STA *BT_AD1   ; Print String from A=lowbyte Y=highbyte, ending with 0
        STY *BT_AD2
        LDY #$00
PR.01   LDA (BT_AD1),Y
        BEQ PR.02
        JSR $FDF0     ; Prints ASCII character & advance cursor
        INY
        BNE PR.01
        INC BT_AD2
        BNE PR.01
        LDA *BT_AD1
PR.02   RTS


; *** PRINT ADDRESS ***
PRTADR  JSR M.PRBYTE
        TYA
        JSR M.PRBYTE
        RTS

; *** PRINT LINEFEED ***
PRTLF   LDA #$8D           ; line feed
        JSR M.COUT
        RTS

; *** PRINT 256 BYTES FROM ADDRESS ***
PRT256  STA P256_2+1	; read high byte in X
        STY P256_2+2	; read low byte in Y
        LDX #$00	; reset counter
P256_1  TXA
        AND #$0F	; test if divisible by 16
        BNE P256_2
        JSR PRTLF	; LF
P256_2  LDA $0000,X	; load byte
        JSR M.PRBYTE	; print byte
        INX
        BNE P256_1	; <255 ?
        RTS
