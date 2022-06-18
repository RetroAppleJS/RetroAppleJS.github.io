;
; SERIAL PRO CARD
; READ ALL CLOCK REGISTERS
;
*=$6000
M.PRBYTE  = $FDDA   ; print hex byte
M.CRDO    = $DAFB   ; line feed
M.OUTSP   = $DB57   ; Space
M.COUT    = $FDED   ; print char
M.KPRESS  = $FD35
M.RDKEY   = $FD2F   ; $FD0C
M.STROUT  = $DB3A   ; print string from address Y (high) and A (low)

S2.TX        = $06     ; ONLY USE IN FUNCTIONS with 1 SUB level
S2.TY        = $07     ; ONLY USE IN FUNCTIONS with 1 SUB level

S1.TX        = $08     ; ONLY USE IN FUNCTIONS with 1 SUB level
S1.TY        = $09     ; ONLY USE IN FUNCTIONS with 1 SUB level

S0.TA        = $18       ; mul_factor_a
S0.TX        = $19       ; mul_factor_x
S0.TY        = $1A       ; mul_product_lo
S0.TZ        = $1B       ; mul_product_hi

*=$6000

START   LDY #>STR.00
        LDA #<STR.00
        JSR M.STROUT   ; Pointer-based printing
        JSR M.CRDO

        LDX #$00
        LDY #$00

L1      STY *S2.TY      ; Y-coordinate
L2      STX *S2.TX      ; X-coordinate

        LDA #$D8
        JSR M.COUT
        LDA *S2.TX
        JSR M.PRBYTE    ; PRINT X
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
        BNE L2
        LDX #$00      ; RESET VALUE
        STX *S2.TX
        LDY *S2.TY
        INY
        ;CPY #$BF
        CPY #$00
        BNE L1
        RTS

; *** PRINT STRING from Y = INDEX ***
STR.00  ASC "S  M  H  D WD MO YR"
        HEX 00

; ***************************
; *** MULTIPLY 8x8 16 bit ***
; *** for when one can't  ***
; *** afford big tables   ***
; ***************************

MUL_D   HEX 0000      ; result of multiplication

MUL     LDA #$00     ;Initialize RESULT to 0
        LDX #$08     ;There are 8 bits in NUM2
MUL.1   LSR *S0.TY   ;Get low bit of NUM2
        BCC MUL.2    ;0 or 1?
        CLC          ;If 1, add NUM1
        ADC *S0.TX
MUL.2   ROR A        ;"Stairstep" shift (catching carry from add)
        ROR MUL_D
        DEX
        BNE MUL.1
        ;STA MUL_D+1
        STA *S0.TX
        LDA MUL_D
        STA *S0.TY
        RTS
