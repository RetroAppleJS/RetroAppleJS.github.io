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
M.HGR     = $F3E2   ; set hires mode 1 + clear screen
M.HGR2    = $F3D8   ; set hires mode 2 + clear screen
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
START     JSR HOME

; *** USER COMMAND KEY DISPATCHER
USRCMD    LDA #>USRCMD      ; PUSH USRCMD RETURN ADDRESS INTO STACK
          PHA
          LDA #<USRCMD-1
          PHA
UCM.00    JSR M.KPRESS
          CMP #'M'      ; TOGGLE HGR+TEXT > HGR FULL > HGR2 FULL > TEXT
          BEQ CYGFX
          CMP #'H'
          BEQ HELP
          CMP #'W'
          BEQ HGRWIP
          CMP #'I'
          BNE UCM.00
          JMP QR_IMP

; *** TOGGLE GFX MODE    (0) HGR+TEXT > (1)HGR FULL > (2)HGR2 FULL > (3)TEXT

CYGFX     LDA #$03      ; CYCLE REGISTER INDEX = 0,  MAX = 3
          JSR CYCLER

CYG.00    STA M.HIRES   ; HIRES
          STA M.TXCL    ; GRAPHICS MODE (vs TEXT MODE)
          STA M.TXP1    ; PAGE 1
          STA M.MXCL    ; FULL
          BEQ CYG.0
          CMP #$01
          BEQ CYG.1
          CMP #$02
          BEQ CYG.2

CYG.3     STA M.TXST    ; TEXT    (TEXT FULL)
          RTS
CYG.2     STA M.TXP2    ; PAGE2   (HGR2 FULL)
CYG.1     RTS           ; FULL    (HGR FULL)
CYG.0     STA M.MXST    ; MIXED   (HGR MIXED)
          RTS

;*** HELP
HELP      LDA #$11  ; CYCLE REGISTER INDEX & MAX
          JSR CYCLER
          BEQ HOME
          JSR M.HOME
          LDY #>STR.01
          LDA #<STR.01
          JSR M.STROUT
          LDA #$03
          JMP HOM.00

; *** HGR WIPE USING COLOUR ***
HGRWIP  LDA #$FF          ; HCOLOR = WHITE
        STA HGR.BITS
        LDA #$40
        JSR M.HGRCOL+2    ; WIPE HGR2
        LDA #$20
        JSR M.HGRCOL+2    ; WIPE HGR
        LDA #$00
        JMP CYG.00

; *** CYCLER
CYCLER    JSR NIBBLE    ;  LEFT NIBBLE = CYCLE REGISTER, RIGHT NIBBLE = MAX
          INC CY_COU,X  ; INCREMENT CYCLE REGISTER
          CMP CY_COU,X
          BPL CYC.01    ; MAX > A ?
          LDA #$00
          STA CY_COU,X  ; CYCLE REGISTER = 0
CYC.01    LDA CY_COU,X  ; A = RESULT
          RTS

; *** NIBBLE SPLITTER
NIBBLE    PHA          ; A = INPUT
          LSR A
          LSR A
          LSR A
          LSR A
          TAX          ; X = LEFT NIBBLE
          PLA
          AND #$0F     ; A = RIGHT NIBBLE
          RTS

HOME      JSR TXTPOS      ; DISPLAY HOME SCREEN
          LDY #>STR.00
          LDA #<STR.00
          JSR M.STROUT
          LDA #$00
HOM.00    JSR CYG.00
          RTS

TXTPOS    JSR M.HOME
          JSR M.CBOT
          JSR M.C1UP
          JSR M.C1UP
          JSR M.C1UP
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
        ASC "[I]MPORT: IMPORT EXTERNAL QR DATA"
        HEX 0D
        ASC "[M]ODE:CYCLE ACROSS HGR+TXT>HGR>HGR2>TXT"
        ;HEX 0D
        ASC "[W]IPE:CLEAR ALL GFX"
        HEX 00


;USING
; *S1.TX
; *S1.TY

;*** QR IMPORT PROCEDURE ***
QR_IMP  LDA #<QR_BUF  ; LO-BYTE
        STA *S1.TX
        LDA #>QR_BUF  ; HI-BYTE
        STA *S1.TY
        LDA MO_CNT    ; MAX VERT
        STA MO_CNT+1  ; VERT COUNTDOWN
        LSR A
        LSR A
        LSR A
        ADC #$00
        STA MO_CNT+2    ; MAX HORIZ

L0      JSR M.CRDO
        LDY #$00

;*INNER LOOP
L1      LDA (S1.TX),Y
        STY MO_CNT+3

          JSR M.PRBYTE

        LDY MO_CNT+3
        INY
        CPY MO_CNT+2
        BNE L1
;*INNER LOOP

        TYA
        CLC
        ADC *S1.TX
        STA *S1.TX
        BCC L2
        INC *S1.TY
L2      DEC MO_CNT+1
        BNE L0
        RTS


MO_CNT  HEX 15000000
QR_BUF  HEX FE2BF8
        HEX 820A08
        HEX BAA2E8
        HEX BA0AE8
        HEX BA4AE8
        HEX 827208
        HEX FEABF8
        HEX 00A000
        HEX EFAE20
        HEX C17B10
        HEX DBAFF8
        HEX 917890
        HEX 27EB60
        HEX 008150
        HEX FE9F98
        HEX 82C098
        HEX BA8EB0
        HEX BA4510
        HEX BABDE8
        HEX 82D550
        HEX FEA898
