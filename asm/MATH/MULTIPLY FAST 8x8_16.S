; LAST BUILD 25-MAR-2025

;
; mul
; Wicked fast LUT-based multiplication
; input: a = factor a; x = factor b
; output: S0.TA = factor a; S0.TX = x = factor x
;         S0.TY = low byte of product a*b
;         S0.TZ = high byte of product a*b
; preserved: x, y
;

ORG $6000

M.PRBYTE  EQU $FDDA   ; print hex byte
M.CRDO    EQU $DAFB   ; line feed
M.OUTSP   EQU $DB57   ; Space
M.COUT    EQU $FDED   ; print char
M.KPRESS  EQU $FD35
M.RDKEY   EQU $FD2F   ; $FD0C
M.STROUT  EQU $DB3A   ; print string from address Y (high) and A (low)

S2.TX        EQU $06     ; ONLY USE IN FUNCTIONS with 1 SUB level
S2.TY        EQU $07     ; ONLY USE IN FUNCTIONS with 1 SUB level

S1.TX        EQU $08     ; ONLY USE IN FUNCTIONS with 1 SUB level
S1.TY        EQU $09     ; ONLY USE IN FUNCTIONS with 1 SUB level

S0.TA        EQU $18       ; mul_factor_a
S0.TX        EQU $19       ; mul_factor_x
S0.TY        EQU $1A       ; mul_product_lo
S0.TZ        EQU $1B       ; mul_product_hi

START   LDY #>STR.00
        LDA #<STR.00
        JSR M.STROUT
        JSR M.CRDO

        LDX #$00
        LDY #$00

L2      STY *S2.TY      ; Y-coordinate
L1      STX *S2.TX      ; X-coordinate

        LDA #$D8
        JSR M.COUT
        LDA *S2.TX
        JSR M.PRBYTE    ; PRINT X
        JSR M.OUTSP

        LDA #$2A+$80    ; PRINT *
        JSR M.COUT
        JSR M.OUTSP

        LDA #$D9
        JSR M.COUT
        LDA *S2.TY
        JSR M.PRBYTE    ; PRINT Y
        JSR M.OUTSP

        LDA *S2.TX
        STA *S0.TX
        LDA *S2.TY
        STA *S0.TY
        JSR MUL

        LDA #$BD
        JSR M.COUT      ; PRINT =
        LDA *S0.TX
        JSR M.PRBYTE    ; PRINT RESULT
        LDA *S0.TY
        JSR M.PRBYTE    ; PRINT RESULT

        JSR M.CRDO
        JSR M.KPRESS
        CMP #$8D
        BNE L3
        RTS

L3      LDX *S2.TX
        INX
        ;CPX #$BF
        CPX #$10
        BNE L1
        LDX #$00      ; RESET VALUE
        STX *S2.TX
        LDY *S2.TY
        INY
        ;CPY #$BF
        CPY #$00
        BNE L2
        RTS



; *** PRINT STRING from Y = INDEX ***
STR.00  ASC "(RETURN=EXIT)"    ;0
        HEX 0D00


; mul 8x8 16 bit result for when you can't afford big tables
; by djmips
;
; inputs are S0.TY and S0.TX and should be zero page.
; A should be zero entering but if you want it will factor in as 1/2 A added to the result.
;
; output is 16 bit in S0.TY & S0.TX   (S0.TX is high byte)
;
; length = 65 bytes
; total cycles worst case = 113
; total cycles best case = 97
; avg = 105
; inner loop credits supercat

MUL  LDA *S0.TX
     BEQ M.B9
     LDA #$00
     DEC *S0.TX
     ROR *S0.TY
     BCC M.B1
     ADC *S0.TX
M.B1 ROR A
     ROR *S0.TY
     BCC M.B2
     ADC *S0.TX
M.B2 ROR A
     ROR *S0.TY
     BCC M.B3
     ADC *S0.TX
M.B3 ROR A
     ROR *S0.TY
     BCC M.B4
     ADC *S0.TX
M.B4 ROR A
     ROR *S0.TY
     BCC M.B5
     ADC *S0.TX
M.B5 ROR A
     ROR *S0.TY
     BCC M.B6
     ADC *S0.TX
M.B6 ROR A
     ROR *S0.TY
     BCC M.B7
     ADC *S0.TX
M.B7 ROR A
     ROR *S0.TY
     BCC M.B8
     ADC *S0.TX
M.B8 ROR A
     ROR *S0.TY
     INC *S0.TX
     STA *S0.TX
     RTS
M.B9 LDA #$00
     STA *S0.TY
     RTS
