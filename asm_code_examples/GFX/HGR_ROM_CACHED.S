;*      (Y,X) = HORIZONTAL COORDINATE  (0-279)
;*      (A)   = VERTICAL COORDINATE    (0-191)
;*--------------------------------



*=$6000
HPOSN     = $F411
HPLOT0    = $F457
CO_X      = $2D
CO_Y      = $2E
HGR.COLOR = $FF
TEMP      = $2F

START   LDX #$00
        LDY #$00

L2      STY *CO_Y
L1      STX *CO_X

        LDX #$FF
        LDA *CO_X
        ADC *CO_Y
        LSR A
        BCC L3
        LDX #00
L3      TXA
        STA *HGR.COLOR

        LDA *CO_Y
        LDX *CO_X
        LDY #$00
        JSR HPLOT0
        LDX *CO_X
        INX
        CPX #$BF
        BNE L1
        LDX #$00
        STX *CO_X
        LDY *CO_Y
        INY
        CPY #$BF
        BNE L2
        RTS


MOD.2   LSR A
        LDA #00
        ASL A
        RTS

MOD.3   STA TEMP
        LSR A
        ADC #$21
        LSR A
        ADC TEMP
        ROR A
        LSR A
        ADC TEMP
        ROR A
        LSR A
        ADC TEMP
        ROR A
        LSR A
        RTS
