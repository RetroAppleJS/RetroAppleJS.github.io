M.PRBYTE  = $FDDA   ; print hex byte
M.CRDO    = $DAFB   ; line feed
M.OUTSP   = $DB57   ; space
M.COUT    = $FDED   ; print char
M.STROUT  = $DB3A   ; print string from address Y (high) and A (low)
M.KPRESS  = $FD35   ; key press
M.HGR     = $F3E2   ; set hires mode + clear screen
M.HGRCOL  = $F3F6   ; clear screen colour
M.TEXT    = $F399   ; set text mode
M.SELHGR  = $F3E4   ; set hires mode only

;*** GFX CALLS ***
M.HPOSN   = $F411
M.HPLOT0  = $F457
HGR.COLOR = $E4
HGR.BITS  = $1C
;*****************

; TODO - RAPID GFX (CACHE POS ?)

S2.TX        = $06     ; ONLY USE IN FUNCTIONS with 1 SUB level
S2.TY        = $07     ; ONLY USE IN FUNCTIONS with 1 SUB level

S1.TX        = $08     ; ONLY USE IN FUNCTIONS with 1 SUB level
S1.TY        = $09     ; ONLY USE IN FUNCTIONS with 1 SUB level

S0.TA        = $18     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TX        = $19     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TY        = $1A     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TZ        = $1B     ; ONLY USE IN FUNCTIONS with no SUBS


*=$6000
PINTRO  JSR M.TEXT
        JSR DEB.0
        JSR M.KPRESS
        CMP #$D1       ; PRESSED 'Q' ?
        BEQ PM.1
        JSR HGRWIP
        LDX #$00
PI.0    STX PATNUM

PI.1    LDA DEB_LV
        CMP #$01
        BMI PI.2        ;  DEBUG LEVEL <1 ?
        JSR DEB.1
        JSR M.KPRESS
        CMP #$D1        ; PRESSED 'Q' ?
        BEQ PM.1
PI.2    LDA #$00
        STA *S2.TX
        STA *S2.TY
        JSR PMAIN       ; EXEC BUSINESS LOGIC
        LDX PATNUM
        INX
        CPX #$08        ; LOOP THROUGH 8 MASKS
        BNE PI.0
        JSR M.CRDO
        JMP PINTRO      ; GO BACK TO MAIN MENU

PMAIN   JSR PM.2        ; BUSINESS LOGIC
        JSR DEB.2       ; DEBUG
        INC *S2.TX
        LDA *S2.TX
        CMP PAT_HW      ; #$BF
        BNE PMAIN
        LDA #$00        ; RESET VALUE
        STA *S2.TX
        INC *S2.TY
        LDA *S2.TY
        CMP PAT_HW      ; #$BF
        BNE PMAIN
PM.1    RTS

PM.2    LDX *S2.TX
        LDY *S2.TY
        LDA PATNUM      ; PATTERN CASE SWITCH
        JSR PATDIS
        STA *S1.TX      ; STORE FORMULA RESULT
        BEQ PM.3
        LDY #$7F
        JMP PM.4
PM.3    LDY #$00       ; PAINT
        STY *HGR.COLOR

        LDA PAT_HW     ; TRANSFORM X-COORDINATES
        CLC
        ADC #$02       ; PAT_HW + 2
        STA *S0.TX
        LDA PATNUM
        AND #$03       ; MOD 4
        STA *S0.TY
        JSR MUL        ; (PAT_HW + 2) * PATNUM = OFFSET
        LDA *S0.TX     ; X-OFFSET
        SEC            ; + 1
        ADC *S2.TX     ; + X
        ;CLC
        ;ADC #$01      ; + GLOBAL OFFSET
        STA *S0.TX     ; X-OFFSET + X + 1
        ASL A
        CLC
        ADC *S0.TX     ; *3
        STA *S1.TY     ; (OFFSET + X) * 3 = DOT_X

        LDA PAT_HW     ; TRANSFORM Y-COORDINATES
        CLC
        ADC #$02       ; PAT_HW + 2
        STA *S0.TX
        LDA PATNUM     ; PATNUM
        LSR A
        LSR A
        STA *S0.TY     ; PATNUM / 4
        JSR MUL        ; (PAT_HW + 2) * PATNUM
        LDA *S0.TX     ; Y-OFFSET
        SEC            ; + 1
        ADC *S2.TY     ; + Y
        ;CLC
        ;ADC #$01      ; + GLOBAL OFFSET
        STA *S0.TY     ; Y-OFFSET + Y + 1
        ASL A
        CLC
        ADC *S0.TY     ; *3
        STA *S0.TY     ; (Y-OFFSET + Y) * 3 = DOT_Y

        LDA *S1.TY
        STA *S0.TX
        JSR HGRDOT
PM.4    RTS            ; SKIP PAINTING

PATDIS  BEQ PAT.0      ; PATTERN FORUMULA DISPATCH
        CMP #$01
        BEQ PAT.1
        CMP #$02
        BEQ PAT.2
        CMP #$03
        BEQ PAT.3
        CMP #$04
        BEQ PAT.4
        CMP #$05
        BEQ PAT.5
        CMP #$06
        BEQ PAT.6
        CMP #$07
        BEQ PAT.7
        RTS

PAT.0   STY *S0.TY  ; (Y + X) % 2 == 0
        TXA
        CLC
        ADC *S0.TY  ; high-byte doesn't influence mod 2
        AND #$01
        RTS

PAT.1   TYA         ; Y % 2 == 0
        AND #$01
        RTS

PAT.2   TXA         ; X % 3 == 0
        JSR MOD3
        RTS

PAT.3   STY *S0.TY  ; (Y + X) % 3 == 0
        TXA
        CLC
        ADC *S0.TY
        ADC #00     ; add carry (high-byte shift for mod 3)
        JSR MOD3
        RTS

PAT.4   TYA         ; ((Y / 2) + (X / 3) ) % 2 == 0
        LSR A       ; /2
        STA *S1.TY
        TXA
        JSR DIV3    ; /3
        CLC
        ADC *S1.TY
        AND #$01    ; %2
        RTS

PAT.5   STY *S0.TY  ; (Y * X) % 2 + (Y * X) % 3 == 0
        STX *S0.TX
        JSR MUL
        LDA *S0.TX  ; use only low-by of product
        AND #$01    ; % 2
        STA *S1.TX  ; subtotal   (X * Y) % 2
        LDY *S0.TY  ; recall Y*X
        LDX *S0.TX
        JSR MOD3_16 ; % 3
        CLC
        ADC *S1.TX
        RTS

PAT.6   JSR PAT.5   ; ((Y * X) % 2 + (Y * X) % 3) % 2 == 0
        AND #$01
        RTS

PAT.7   STY *S0.TY  ; ((X * Y) % 3 + (X + Y) % 2) % 2 == 0;
        STX *S0.TX
        LDA *S0.TY
        CLC
        ADC *S0.TX
        AND #$01    ; %2
        STA *S1.TX  ; subtotal (Y + X) % 2
        JSR MUL
        LDY *S0.TY
        LDX *S0.TX
        JSR MOD3_16 ; subtotal   (Y * X) % 3
        CLC
        ADC *S1.TX  ; subtotal   (Y * X) % 3 + (Y + X) % 2
        AND #$01    ; % 2
        RTS

; *** HGR WIPE USING COLOR ***
HGRWIP  JSR M.HGR
        LDA #$FF
        STA HGR.BITS
        JSR M.HGRCOL
        LDA #$00
        RTS

; *** HGR PLOT 2*2 PIXEL DOT ***
HGRDOT  JSR HGRPIX
        INC *S0.TY
        JSR HGRPIX
        INC *S0.TX
        JSR HGRPIX
        DEC *S0.TY
        JSR HGRPIX
        RTS

; *** HGR PLOT ONE PIXEL ***
HGRPIX  LDX *S0.TX
        LDA *S0.TY
        LDY #$00
        JSR M.HPLOT0      ; PLOT A,X (HGR.COLOR)
        RTS

; *** A DIV 3 = A ***
DIV3    STA *S0.TX
        BEQ DIV3.1
        DEC *S0.TX
        LDA *S0.TX
        LSR A
        ADC #$21
        LSR A
        ADC *S0.TX
        ROR A
        LSR A
        ADC *S0.TX
        ROR A
        LSR A
        ADC *S0.TX
        ROR A
        LSR A
DIV3.1  RTS

; *** A MOD 3 = A ***
MOD3    SEC
        SBC #$21      ;mod 33
        BCS MOD3
        BEQ MOD3.2
        CLC
        ADC #$21
MOD3.0  SEC
        SBC #$0C      ;mod 12
        BCS MOD3.0
        BEQ MOD3.2
        ADC #$0C
MOD3.1  SEC
        SBC #$03      ;mod 3
        BCS MOD3.1
        BEQ MOD3.2
        ADC #$03
MOD3.2  RTS

; *** XY MOD 3 = A ***
MOD3_16 TXA
        JSR MOD3
        STA *S0.TZ
        TYA
        JSR MOD3
        CLC
        ADC *S0.TZ
        JSR MOD3
        RTS

; MULTIPLY 8x8 16 bit result for when you can't afford big tables
; inputs are S0.TY and S0.TX and should be zero page
; outputs are same zero page S0.TY (hi-byte) and S0.TX (low-byte)
MUL     LDA *S0.TY
        BEQ MUL.9
        LDA #$00
        DEC *S0.TY
        ROR *S0.TX
        BCC MUL.1
        ADC *S0.TY
MUL.1   ROR A
        ROR *S0.TX
        BCC MUL.2
        ADC *S0.TY
MUL.2   ROR A
        ROR *S0.TX
        BCC MUL.3
        ADC *S0.TY
MUL.3   ROR A
        ROR *S0.TX
        BCC MUL.4
        ADC *S0.TY
MUL.4   ROR A
        ROR *S0.TX
        BCC MUL.5
        ADC *S0.TY
MUL.5   ROR A
        ROR *S0.TX
        BCC MUL.6
        ADC *S0.TY
MUL.6   ROR A
        ROR *S0.TX
        BCC MUL.7
        ADC *S0.TY
MUL.7   ROR A
        ROR *S0.TX
        BCC MUL.8
        ADC *S0.TY
MUL.8   ROR A
        ROR *S0.TX
        INC *S0.TY
        STA *S0.TY
        RTS
MUL.9   LDA #$00
        STA *S0.TX
        RTS

; *** PRINT INDEX-BASED  STRING ***
ISTROUT TAX           ; INDEX-BASED STRING OUT A=INDEX
        LDY #>STR.00
        LDA #<STR.00
IST.00  STA *$AB
        DEY
        STY *$AC
        LDY #$FF
        CPX #$00
        BEQ IS2.02

IS2.01  JSR IS2.03
        BNE IS2.01     ; encounter zero value ?
        DEX
        BNE IS2.01     ; encounter zero counter ?

IS2.02  JSR IS2.03
        BEQ IS2.06     ; encounter zero value ?
        JSR M.COUT
        JMP IS2.02

IS2.03  INY
        BNE IS2.05
        INC *$AC
IS2.05  LDA ($AB),Y
IS2.06  RTS

;*** MAIN MENU ***
DEB.0   LDA #$0E        ;  PRINT [QR-MASK] <ANYKEY>NEXT <Q>QUIT
        JSR ISTROUT

        LDA #>DEB_LV
        JSR M.PRBYTE
        LDA #<DEB_LV
        JSR M.PRBYTE
        LDA #$0B        ;  PRINT :DEBUG
        JSR ISTROUT

        LDA #>PATNUM
        JSR M.PRBYTE
        LDA #<PATNUM
        JSR M.PRBYTE
        LDA #$0C        ;  PRINT MASK:
        JSR ISTROUT

        LDA #>PAT_HW
        JSR M.PRBYTE
        LDA #<PAT_HW
        JSR M.PRBYTE
        LDA #$0D        ;  PRINT SIZE:
        JSR ISTROUT

        LDA #$0A        ;  PRINT UNIT:
        JSR ISTROUT
        LDA #>PI.1
        JSR M.PRBYTE
        LDA #<PI.1
        JSR M.PRBYTE

        LDA #$0F        ;  PRINT WIPE:
        JSR ISTROUT
        LDA #>HGRWIP
        JSR M.PRBYTE
        LDA #<HGRWIP
        JSR M.PRBYTE
        RTS

;*** DEBUG TRACE 1 ***
DEB.1   JSR M.CRDO
        LDA #$08        ;  PRINT PATTERN:
        JSR ISTROUT
        LDA PATNUM
        JSR M.PRBYTE
        JSR M.OUTSP
        LDA PATNUM      ; PRINT 'FORMULA'
        JSR ISTROUT

;*** DEBUG TRACE 2 ***
DEB.2   LDA DEB_LV
        CMP #$02
        BNE DEB.6

        JSR M.CRDO
        LDA #$D8
        JSR M.COUT
        LDA *S2.TX
        JSR M.PRBYTE     ; PRINT X
        JSR M.OUTSP

        LDA #$D9
        JSR M.COUT
        LDA *S2.TY
        JSR M.PRBYTE     ; PRINT Y
        JSR M.OUTSP

        LDA #$09
        JSR ISTROUT      ; PRINT X*Y=

        LDA *S2.TX
        STA *S0.TX
        LDA *S2.TY
        STA *S0.TY
        JSR MUL          ; CALCULATE X*Y
        LDA *S0.TY
        JSR M.PRBYTE
        LDA *S0.TX
        JSR M.PRBYTE     ; PRINT RESULT
        JSR M.OUTSP
        LDA PATNUM       ; PRINT FORUMULA
        JSR ISTROUT

        LDA #$BD
        JSR M.COUT       ; PRINT =
        LDA *S1.TX
        JSR M.PRBYTE     ; PRINT RESULT

        JSR M.KPRESS
        CMP #$D1
        BNE DEB.5
        PLA
        PLA
DEB.5   LDA #$00
        LDY #$00
        LDX #$00
DEB.6   RTS

;*** MAIN PARAMETERS ***
DEB_LV  HEX 01          ; DEBUG LEVEL 0=NOLOG 1=PATTERNS 2=CALCULATIONS
CH_SET  HEX 01          ; CHARACTESET 0=II+ 1=IIe
PAT_HW  HEX 13          ; PATTERN HIGHT/WIDTH
PATNUM  HEX 00          ; CALCULATION MODE
;**************************
CH_IDX  HEX 00

; *** STRING DATA ***
STR.00  ASC "(X+Y)%2"               ;0
        HEX 00
        ASC "X%2"                   ;1
        HEX 00
        ASC "Y%3"                   ;2
        HEX 00
        ASC "(X+Y)%3"               ;3
        HEX 00
        ASC "(X/2 + Y/3) % 2"       ;4
        HEX 00
        ASC "(X*Y)%2 + (X*Y)%3"     ;5
        HEX 00
        ASC "((X*Y)%2+(X*Y)%3)%2"   ;6
        HEX 00
        ASC "((X*Y)%3+(X+Y)%2)%2"   ;7
        HEX 00
        ASC "PATTERN:"              ;8
        HEX 00
        ASC "X*Y="                  ;9
        HEX 00
        ASC " UNIT:"                ;A
        HEX 00
        ASC ":DEBUG(0-2) "          ;B
        HEX 00
        ASC ":MASK(0-7) "           ;C
        HEX 00
        ASC ":SIZE(1-13-34) CALLS>" ;D
        HEX 00
        ASC "[QR-MASK] <N>EXT <Q>UIT VARS> "   ;E
        HEX 00
        ASC " WIPE:"                ;F
        HEX 00