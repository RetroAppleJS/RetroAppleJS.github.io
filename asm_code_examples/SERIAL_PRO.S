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

        LDY SLOTNR
        

        ;JSR M.PRBYTE    ; PRINT Y
        JSR M.OUTSP

      
        RTS

; *** PRINT STRING from Y = INDEX ***
STR.00  ASC "S  M  H  D WD MO YR"
        HEX 00

; ***************************

SLOTNR   HEX 01    ; Slot number

