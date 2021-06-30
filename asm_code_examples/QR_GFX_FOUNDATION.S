M.PRBYTE  = $FDDA   ; print hex byte
M.CRDO    = $DAFB   ; line feed
M.OUTSP   = $DB57   ; space
M.COUT    = $FDED   ; print char
M.STROUT  = $DB3A   ; print string from address Y (high) and A (low)
M.KPRESS  = $FD35   ; key press
M.CBOT    = $FB2F   ; move cursor to bottom
M.C1UP    = $FC1A   ; move cursor one up
M.HOME    = $FC58   ; clear text (HOME)

;*** GFX CALLS ***
M.SELHGR  = $F3E4   ; set hires mode only
M.TEXT    = $F399   ; set text mode
M.HGRCOL  = $F3F6   ; clear screen colour
M.HGR     = $F3E2   ; set hires mode + clear screen
M.TXCL    = $C050
M.TXST    = $C051
M.MXCL    = $C052
M.MXST    = $C053
M.TXP1    = $C054
M.TXP2    = $C055
M.HIRES   = $C057
M.HPOSN   = $F411
M.HPLOT0  = $F457
HGR.COLOR = $E4
HGR.BITS  = $1C
;*****************

S2.TX        = $06     ; ONLY USE IN FUNCTIONS with 1 SUB level
S2.TY        = $07     ; ONLY USE IN FUNCTIONS with 1 SUB level

S1.TX        = $08     ; ONLY USE IN FUNCTIONS with 1 SUB level
S1.TY        = $09     ; ONLY USE IN FUNCTIONS with 1 SUB level

S0.TA        = $18     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TX        = $19     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TY        = $1A     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TZ        = $1B     ; ONLY USE IN FUNCTIONS with no SUBS


*=$6000
START     JSR TXTPOS
          LDY #>STR.00
          LDA #<STR.00
          JSR M.STROUT
          LDA #$00
          JSR TOG.00

USRCMD    LDA #>USRCMD      ; PUSH USRCMD RETURN ADDRESS INTO STACK
          PHA
          LDA #<USRCMD-1
          PHA

          JSR M.KPRESS
          CMP #'M'      ; TOGGLE HGR+TEXT > HGR FULL > HGR2 FULL > TEXT
          BEQ TOGFX
          CMP #'H'
          BEQ HELP
          RTS

; *** TOGGLE GFX MODE ***
; (0) HGR+TEXT > (1)HGR FULL > (2)HGR2 FULL > (3)TEXT

TOGFX     LDA #$03  ; CYCLE REGISTER INDEX & MAX
          JSR CYCLR

TOG.00    STA M.HIRES   ; HIRES
          STA M.TXCL    ; GRAPHICS MODE (vs TEXT MODE)
          STA M.TXP1    ; PAGE 1
          STA M.MXCL    ; FULL
          BEQ TOG.0
          CMP #$01
          BEQ TOG.1
          CMP #$02
          BEQ TOG.2

TOG.3     STA M.TXST    ; TEXT    (TEXT FULL)
          RTS
TOG.2     STA M.TXP2    ; PAGE2   (HGR2 FULL)
          RTS
TOG.1     RTS    ; FULL    (HGR FULL)
          ;RTS
TOG.0     STA M.MXST    ; MIXED   (HGR MIXED)
          RTS

; *** CYCLER ***
; A = (LEFT NIB = REGISTER INDEX)  (RIGHT NIB = MAX)
CYCLR     JSR NIBBLE   ; A = LEFT NIB = REGISTER INDEX & MAX
          INC CY_COU,X
          CMP CY_COU,X
          BPL CYC.01
          LDA #$00
          STA CY_COU,X
CYC.01    LDA CY_COU,X
          RTS

NIBBLE    PHA          ; A = INPUT
          LSR A
          LSR A
          LSR A
          LSR A
          TAX          ; X = LEFT NIBBLE
          PLA
          AND #$0F     ; A = RIGHT NIBBLE
          RTS

HELP      LDA #$11  ; CYCLE REGISTER INDEX & MAX
          JSR CYCLR
          BNE HLP.01
          PLA
          PLA
          JMP START
HLP.01    JSR M.HOME
          LDY #>STR.01
          LDA #<STR.01
          JSR M.STROUT
          LDA #$03
          JMP TOG.00

TXTPOS    JSR M.HOME
          JSR M.CBOT
          JSR M.C1UP
          JSR M.C1UP
          JSR M.C1UP
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


;*** MAIN PARAMETERS ***
DEB_LV  HEX 00          ; DEBUG LEVEL 0=NOLOG 1=PATTERNS 2=CALCULATIONS
CH_SET  HEX 01          ; CHARACTESET 0=II+ 1=IIe
PAT_HW  HEX 13          ; PATTERN HIGHT/WIDTH

; CYCLE COUNTERS
CY_COU  HEX 0000          ; GFX MODE,HELP MODE


;**************************

           ;"                                        "
STR.00  ASC "[H]ELP"
        HEX 00
STR.01  ASC "QR GRAPHICS FOUNDATION V1.0"
        HEX 0D0D
        ASC "[G]ENERATE: UNDER CONSTRUCTION"
        HEX 0D
        ASC "[H]ELP: BACK TO NORMAL VIEW"
        HEX 0D
        ASC "[M]ODE:CYCLE ACROSS HGR+TXT>HGR>HGR2>TXT"
        ;HEX 0D
        HEX 00
