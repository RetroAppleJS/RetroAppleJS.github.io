; LAST BUILD 11-MAR-2025

;*** TXT CALLS ***
M.PRBYTE   EQU $FDDA   ; print hex byte
M.LINPRT   EQU $ED24   ; print A,X as decimal integer
M.CRDO     EQU $DAFB   ; line feed
M.OUTSP    EQU $DB57   ; space
M.COUT     EQU $FDED   ; print char
M.COUC     EQU $FDF0   ; print char and advance cursor
M.STROUT   EQU $DB3A   ; print string from address Y (high) and A (low)
M.CBOT     EQU $FB2F   ; move cursor to bottom
M.C1L      EQU $FC10   ; move cursor one left
M.C1R      EQU $FBF4   ; move cursor one right
M.C1UP     EQU $FC1A   ; move cursor one up  
M.HOME     EQU $FC58   ; clear text (HOME)
M.KPRESS   EQU $FD35   ; key press
M.SCRN2    EQU $F879   ; nibble splitter
BT_AD1     EQU $06
BT_AD2     EQU $07

;*** GFX CALLS ***
M.SELHGR   EQU $F3E4   ; set hires mode only
M.TEXT     EQU $F399   ; set text mode
M.HGRCOL   EQU $F3F6   ; clear screen colour
M.HGR      EQU $F3E2   ; set hires mode 1 + clear screen
M.HGR2     EQU $F3D8   ; set hires mode 2 + clear screen
M.TXCL     EQU $C050
M.TXST     EQU $C051
M.MXCL     EQU $C052
M.MXST     EQU $C053
M.TXP1     EQU $C054
M.TXP2     EQU $C055
M.HIRES    EQU $C057
M.HPOSN    EQU $F411
M.HPLOT0   EQU $F457
HGR.COLOR  EQU $E4
HGR.BITS   EQU $1C
;*****************

S2.TX         EQU $06     ; ONLY USE IN FUNCTIONS with 1 SUB level
S2.TY         EQU $07     ; ONLY USE IN FUNCTIONS with 1 SUB level

S1.TX         EQU $08     ; ONLY USE IN FUNCTIONS with 1 SUB level
S1.TY         EQU $09     ; ONLY USE IN FUNCTIONS with 1 SUB level

S0.TA         EQU $18     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TX         EQU $19     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TY         EQU $1A     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TZ         EQU $1B     ; ONLY USE IN FUNCTIONS with no SUBS


ORG $6000
START   JSR TXTPOS
        JSR M_MENU
        JMP USRCMD

J_MAIN  ASC "MODE "
        HEX 0D
        .WORD CYGFX
        ASC "CONFIG"
        .WORD CONFIG
        ASC "GENER "
        .WORD GENERA
        ASC "DEBUG "
        .WORD QR_IMP
        ASC "WIPE  "
        .WORD HGRWIP
        ASC "HELP  "
        .WORD M_MENU
        HEX 00

;M.KPRESS LDA #$CD
;         RTS
;M.C1L
;M.C1R
;M.C1UP
;M.CBOT
;M.STROUT 
;M.CRDO 
;M.OUTSP
;M.COUT
;M.COUC
;M.HOME  RTS

; *** NEW USER COMMAND KEY DISPATCHER
USRCMD  LDA #>USRCMD      ; PUSH USRCMD RETURN ADDRESS INTO STACK
        PHA
        LDA #<USRCMD-1
        PHA
UCM.00  JSR M.KPRESS
        STA *S0.TA
        LDX #$00-8
UCM.01  TXA
        CLC
        ADC #$08
        TAX
        LDA *S0.TA
        ORA #$80          ; uppercase or lowercase doesn't matter
        CMP J_MAIN,X    
        BEQ UCM.02        ; is A = first character of menu item ? 
        LDA J_MAIN+8,X    ; get next character
        BNE UCM.01        ; loop to next menu item
        JMP UCM.00        ; loop end -> back to key input
UCM.02  LDA J_MAIN+8-2,X  ; Load low byte of address
        STA CJMP         ; Store to temporary zero page pointer
        LDA J_MAIN+8-1,X  ; Load high byte of address
        STA CJMP+1       ; Store high byte to pointer
        JMP (CJMP)       ; Jump to pointer

CJMP    HEX 00 00



; *** CONFIGURE QR CODE
CONFIG  JSR C_MENU
        JSR C_NAV
        RTS

; *** GENERATE QR CODE
GENERA  LDX #$10        ; 10x10 matrix (4-bit depth)
        LDA #$0         ; NIBLLE to fill
        JSR FIL_MX      ; FILL MATRIX
        JSR M.KPRESS
        RTS

; *** TOGGLE GFX MODE    (0) HGR+TEXT > (1)HGR FULL > (2)HGR2 FULL > (3)TEXT

CYGFX   LDA #$04      ; CYCLE REGISTER INDEX = 0,  MAX = 4
        JSR CYCLER

CYG.00  STA M.HIRES   ; HIRES
        STA M.TXCL    ; GRAPHICS MODE (vs TEXT MODE)
        STA M.TXP1    ; PAGE 1
        STA M.MXCL    ; FULL
        BEQ CYG.0
        CMP #$01
        BEQ CYG.1
        CMP #$02
        BEQ CYG.2
        CMP #03
        BEQ CYG.4

CYG.3   STA M.TXST    ; TEXT    (TEXT FULL)
        RTS
CYG.2   STA M.TXP2    ; PAGE2   (HGR2 FULL)
        STA M.MXST    ; MIXED   (HGR MIXED)
CYG.1   RTS           ; FULL    (HGR FULL)
CYG.0   STA M.MXST    ; MIXED   (HGR MIXED)
        RTS
CYG.4   STA M.TXP2    ; PAGE2   (HGR2 FULL)
        RTS

;*** MAIN MENU
M_MENU  LDY #>STR.01
        LDA #<STR.01
        JSR M.STROUT
        JSR M.CRDO
        LDA #$00        ; SET MODE DEFAULT TO HGR+TEXT
        JSR CYG.00
        RTS

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
;NIBBLE    PHA          ; A = INPUT
;          LSR A
;          LSR A
;          LSR A
;          LSR A
;          TAX          ; X = LEFT NIBBLE
;          PLA
;          AND #$0F     ; A = RIGHT NIBBLE
;          RTS

NIBBLE  PHA
        JSR M.SCRN2
        TAX
        PLA
        ; M.RTMSKZ (f87f)
        AND #$0F
        RTS

C_MENU  JSR M.CRDO
        LDY #>STR.03
        LDA #<STR.03
        JSR M.STROUT    ; PRINT CONFIGURATION MENU
        JSR M.C1UP
        JSR M.C1UP
        LDX #$07
CFG1    JSR M.C1L
        DEX
        BNE CFG1
        RTS

C_NAV   JSR M.KPRESS
        CMP #$88        ; DETECT ARROW LEFT
        BEQ C_NAV1
        CMP #$95        ; DETECT ARROW RIGHT
        BEQ C_NAV2
        CMP #$8D        ; DETECT RETURN
        BEQ C_NAV3
        JMP C_NAV

C_NAV1  LDA #$00        ; ARROW LEFT
        LDX #$01
        JSR M.LINPRT
        JSR M.COUT
        JMP C_NAV
C_NAV2  ;LDA #'B'
        LDA #$C2        ; ARROW RIGHT
        JSR M.COUT
        JMP C_NAV
C_NAV3  JSR M.C1DN      ; RETURN
        JMP C_NAV  

; *** CURSOR ONE DOWN ***
M.C1DN  LDA *$22
        CMP *$25
        BCS M.C1D1
        INC *$25
        LDA *$25
        JSR $FBC1
        ADC *$20
        STA *$28
M.C1D1  RTS

; *** RELATIVELY REPOSITION CURSOR ***
TXTPOS  JSR M.HOME      ; move cursor to top left
        JSR M.CBOT      ; move cursor to bottom
        JSR M.C1UP      ; go one up
        JSR M.C1UP      ; go one up
        JSR M.C1UP      ; go one up
        RTS

; *** PRINT STRING WITH TEMPLATE FILL-INS ***
PRTSTR  STA *BT_AD1   ; Print String from A=lowbyte Y=highbyte, ending with 0
        STY *BT_AD2   ; Save REF
        LDY #$00      ; Once REF saved, reset Y (index) to zero
PR.01   LDA (BT_AD1),Y
        BEQ PR.02
        JSR PR.03     ; Detect template functions & print consecutive ASCII characters
        INY
        BNE PR.01
        INC BT_AD2
        BNE PR.01
        LDA *BT_AD1
PR.02   RTS

PR.03   CMP #$DB        ;'['=$5B??       ; Detect template start
        BNE PR.06

        STY *BT_AD2
        LDY #$01
        LDA (BT_AD1),Y  ; Get reference type
        CMP #$C4        ;'D'=$44?
        BNE PR.05

        INY             ; IT'S A DECIMAL
        LDA (BT_AD1),Y  ; Get reference address (LO)
        STA PR.04+1
        INY
        LDA (BT_AD1),Y  ; Get reference address (HI)
        STA PR.04+2
        INY
        STY *BT_AD2     ; PUT READ POINTER BEYOND "]"
        LDA #$00
PR.04   LDX $0000       ; GET NUMBER FROM REFERENCE
        JSR M.LINPRT    ; PRINT DECIMAL NUMBER
        RTS

PR.05   CMP #$A4        ;'$'=$24??
        BNE PR.07       ; UNKNOWN TYPE ?
        STY *BT_AD2
        LDY #$00
        INY             ; LO
        INY             ; HI
        INY             ; LO
        INY             ; HI
        INY             ; BEYOND "]"
        STY *BT_AD2

        ; TODO PRINT STRING FROM ARRAY
        RTS

PR.06   JSR M.COUC
PR.07   RTS


; *** HGR PLOT 2*2 PIXEL DOT ***
HGRDOT  JSR HGRPIX
        INC *S0.TY
        JSR HGRPIX
        INC *S0.TX
        JSR HGRPIX
        DEC *S0.TY
        JSR HGRPIX
        RTS

; *** HGR MATRIX 2*2 PIXEL DOT ***
MXDOT   LDA *S0.TA
        AND #$01
        TAY
        JSR MXPIX

        ;INC *S0.TY      ; go down
        ;LDA *S0.TA
        ;AND #$02
        ;TAY
        ;JSR MXPIX
        ;INC *S0.TX      ; go right
        ;LDA *S0.TA
        ;AND #$04
        ;TAY
        ;JSR MXPIX
        ;DEC *S0.TY      ; go up
        ;LDA *S0.TA
        ;AND #$08
        ;TAY
        ;JSR MXPIX
        ;INC *S0.TX      ; go back left
        RTS

; *** HGR PLOT ONE DOT ***
MXPIX   LDX *S0.TX
        LDA *S0.TY
        JSR M.HPLOT0      ; PLOT A,X (HGR.COLOR)
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

STR.00  ASC "[H]ELP"
        HEX 00
STR.01  ASC "QR GENERATOR V1.0"
        HEX 0D
        ASC "[M]ODE: HGR+TXT>HGR>HGR2+TXT>HGR2>TXT"
        HEX 0D
        ASC "[C]ONFIG "
        ASC "[G]EN "
        ASC "[D]EBUG "
        ASC "[W]IPE "
        ASC "[H]ELP"
        HEX 00

STR.02  HEX 2020202020202020
        HEX 2020202020202020
        HEX 2020202020202020
        HEX 2000

; CONFIGURATION SUB-MENU DATA
STR.03  ASC "TYPENUMBER: <- [D"         ; DECIMAL TYPE
        .BYTE <QR_VAR                   ; NUMBER REFERENCE
        .BYTE >QR_VAR
        ASC "] ->"
        HEX 0D
        ASC "ERROR CORR: <- [$"         ; STRING TYPE
        .BYTE <QR_VAR+1                 ; SELECTOR REFERENCE
        .BYTE >QR_VAR+1
        .BYTE <STR.04                   ; STRING REFERENCE
        .BYTE >STR.04
        ASC "]"
        HEX A5                          ;% SIGN
        ASC ") ->"
        HEX 0D
        ASC "ENCODING:"
        HEX A0A0                        ; SPACE
        ASC " <-  [$"                   ; STRING TYPE
        .BYTE <QR_VAR+2                 ; SELECTOR REFERENCE
        .BYTE >QR_VAR+2                 ; STRING REFERENCE
        .BYTE <STR.05
        .BYTE >STR.05
        ASC "] ->"
        HEX 00

STR.04  ASC "L(7"                       ; STRING ARRAY
        HEX 00
        ASC "M(15"
        HEX 00
        ASC "Q(25"
        HEX 00
        ASC "Q(30"        
        HEX 00

STR.05  ASC "NUM"                       ; STRING ARRAY
        HEX 00
        ASC "ALNUM"
        HEX 00
        ASC "BYTE"
        HEX 00
        ASC "KANJI"
        HEX 00

       ; L(7)\M(15)\Q(25)\H(30)
       ; AUTO\1\2\3\4\5\6\7\8\9\10\11\12\13\14\15\16\17\18\19\20\21\22\23\24\25\26\27\28\29\30\31\32\33\34\35\36\37\38\39\40\
       ; L(07)\M(15)\Q(25)\H(30)\
       ;NUM  \ALNUM\BYTE \KANJI\

;USING
; *S2.TX
; *S2.TY

;*** QR IMPORT PROCEDURE ***
QR_IMP  JSR TXP.03

        LDA #<QR_BUF  ; LO-BYTE
        STA *S2.TX
        LDA #>QR_BUF  ; HI-BYTE
        STA *S2.TY
        LDA MO_CNT    ; MAX VERT
        STA MO_VAR    ; VERT COUNTDOWN
        LSR A
        LSR A
        LSR A
        ADC #$00
        STA MO_VAR+1    ; MAX HORIZ

QMP.0   JSR TXP.01
        LDY #$00

;*INNER LOOP
QMP.1   LDA (S2.TX),Y

        JSR PLOT8

        INY
        CPY MO_VAR+1
        BNE QMP.1
;*INNER LOOP

        TYA
        CLC
        ADC *S2.TX
        STA *S2.TX
        BCC QMP.2
        INC *S2.TY
QMP.2   JSR M.CRDO
        DEC MO_VAR
        BNE QMP.0
        JSR TXP.03
        RTS

PLOT8   STA MO_VAR+3    ; BYTE
        STY MO_VAR+2    ; HORIZ
        LDX #$08
        STX MO_VAR+4    ; BIT NUMBER
PLT.00  ROL MO_VAR+3
        JSR TXTPLT
        DEC MO_VAR+4
        BNE PLT.00
        LDY MO_VAR+2
        RTS

TXTPLT  LDA #' '
        BCS TXP.02
TXP.01  LDA #$20
TXP.02  JSR M.COUT
        RTS
TXP.03  LDA MO_CNT
        LSR A
        LSR A
        LSR A
        ADC #$00
        ASL A
        ASL A
        ASL A
        TAX
        INX
TXP.04  JSR TXP.01
        DEX
        BNE TXP.04
        JSR M.CRDO
        RTS

; TODO
; *** FILL MATRIX *** (X = matrix size, A = fill pattern 0-F)

FIL_D   HEX 00000000   ;MATRIX SIZE / FILL PATTERN / X / Y

FIL_MX  STX FIL_D
        STA FIL_D+1
        LDA #$00
        STA FIL_D+2
        STA FIL_D+3

        ;JSR CYG.00      ; HGR

FIL_M1  LDA FIL_D+1     
        STA *S0.TA      ; PATTERN
        LDA FIL_D+2
        STA *S0.TX      ; X
        LDA FIL_D+3      
        STA *S0.TY      ; Y
        ;JSR MXDOT

                LDA *S0.TX
                JSR M.PRBYTE
                JSR M.OUTSP
                LDA *S0.TY
                JSR M.PRBYTE
                JSR M.CRDO

        INC FIL_D+2
        LDA FIL_D+2
        CMP FIL_D
        BNE FIL_M1

        INC FIL_D+3
        LDA FIL_D+3
        CMP FIL_D
        BNE FIL_M1

        RTS


MO_VAR  HEX 0000000000  ;VERT COUNTDOWN / HORIZ MAX / HORIZ COUNTUP / CURRENT BYTE / BYTE COUNTDOWN
MO_CNT  HEX 15

QR_VAR  HEX 000000 ; QR TYPE NUMBER (0-40) / QR ERROR CORRECTION (0-3) / ENCODING (0-3)  

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
