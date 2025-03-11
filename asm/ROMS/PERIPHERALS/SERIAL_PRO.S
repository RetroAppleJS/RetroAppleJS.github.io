; LAST BUILD 11-MAR-2025
;
; SERIAL PRO CARD
; READ ALL CLOCK REGISTERS
;

M.PRBYTE  = $FDDA   ; print hex byte
M.CRD0    = $DAFB   ; line feed
M.OUTSP   = $DB57   ; Space
M.COUT    = $FDED   ; print char
M.KPRESS  = $FD35
M.RDKEY   = $FD2F   ; $FD0C
M.STROUT  = $DB3A   ; print string from address Y (high) and A (low)
M.C1UP    = $FC1A   ; move cursor one up
M.BS      = $FC10   ; move cursor left

S2.TX        = $06     ; ONLY USE IN FUNCTIONS with 1 SUB level
S2.TY        = $07     ; ONLY USE IN FUNCTIONS with 1 SUB level

S1.TX        = $08     ; ONLY USE IN FUNCTIONS with 1 SUB level
S1.TY        = $09     ; ONLY USE IN FUNCTIONS with 1 SUB level

S0.TA        = $18       ; mul_factor_a
S0.TX        = $19       ; mul_factor_x
S0.TY        = $1A       ; mul_product_lo
S0.TZ        = $1B       ; mul_product_hi


ORG $6000
START   LDA #01        ; SLOT NUMBER
        ASL A
        ASL A
        ASL A
        ASL A
        STA SLOTNR

        LDA #'#'
        JSR M.COUT     ; print char
        LDA SLOTNR
        JSR M.PRBYTE
        JSR M.CRD0

        LDY #>STR.00
        LDA #<STR.00
        JSR M.STROUT   ; Pointer-based printing
        JSR M.CRD0


        JSR M.KPRESS

LOOP    LDA SLOTNR
        LDA #00     ; Seconds
        JSR PRCLK
        LDA #02     ; Minutes
        JSR PRCLK
        LDA #04     ; Hours
        JSR PRCLK
        LDA #07     ; Day of Month
        JSR PRCLK
        LDA #08     ; Month
        JSR PRCLK
        LDA #09     ; Year
        JSR PRCLK

        JSR M.KPRESS

BSLOOP  JSR M.BS        ; move cursor left
        DEC BSCNT
        BNE BSLOOP
        
        JSR M.KPRESS
        JMP LOOP


        ; A = CLOCK ADDRESS
PRCLK   LDY SLOTNR          ; Load slot of card ($n0)
        STA (CLKADR),Y      ; Indexed reference to clock address
        LDA (CLKADR+1),Y    ; Read clock data
        JSR M.PRBYTE        ; PRINT A
        JSR M.OUTSP
        JSR M.OUTSP
        JSR M.OUTSP
        INC BSCNT
        INC BSCNT
        INC BSCNT
        INC BSCNT
        INC BSCNT
        RTS

; *** PRINT STRING from Y = INDEX ***
STR.00  ASC "SEC"
        HEX 2020
        ASC "MIN"
        HEX 2020
        ASC "H"
        HEX 20202020
        ASC "DAY"
        HEX 2020
        ASC "MO"
        HEX 202020
        ASC "YEAR"
        HEX 00
STR.01  ASC "SLOT#"
        HEX 00

; ***************************

SLOTNR   HEX 00    ; Slot number * 16
BSCNT    HEX 00    ; Count required backspaces


ORG $C080
        HEX 00010203
CLKADR  HEX 0405060708090A0B0C0D0E0F
        HEX 00010203
        HEX 0405060708090A0B0C0D0E0F

