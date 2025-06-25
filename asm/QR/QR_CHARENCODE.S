; LAST BUILD 25-JUN-2025

M.PRBYTE  EQU $FDDA   ; print hex byte
M.CRDO    EQU $DAFB   ; line feed
M.OUTSP   EQU $DB57   ; space
M.COUT    EQU $FDED   ; print char
M.KPRESS  EQU $FD35   ; key press
M.HGR     EQU $F3E2   ; set hires mode + clear screen
M.HGRCOL  EQU $F3F6   ; clear screen colour
M.TEXT    EQU $F399   ; set text mode
M.SELHGR  EQU $F3E4   ; set hires mode only

;*** GFX CALLS ***
M.HPOSN   EQU $F411
M.HPLOT0  EQU $F457
HGR.COLOR EQU $E4
HGR.BITS  EQU $1C
;*****************

; TODO - RAPID GFX (CACHE POS ?)
; TODO - PUT INTRO INTO DEBUG ROUTINE

S2.TX        EQU $06     ; ONLY USE IN FUNCTIONS with 1 SUB level
S2.TY        EQU $07     ; ONLY USE IN FUNCTIONS with 1 SUB level

S1.TX        EQU $08     ; ONLY USE IN FUNCTIONS with 1 SUB level
S1.TY        EQU $09     ; ONLY USE IN FUNCTIONS with 1 SUB level

S0.TA        EQU $18     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TX        EQU $19     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TY        EQU $1A     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TZ        EQU $1B     ; ONLY USE IN FUNCTIONS with no SUBS

DEF 

ORG $6000
        LDA #$00        ; PRINT METHOD 0     >> WELCOME MESSAGE
        STA *S0.TA
        LDA #$00
        JSR ISTROUT     ; PRINT STRING 0
        JSR M.KPRESS
        CMP #$CD        ; 'M'
        BEQ CMEN

CINP    LDA #$05        ; CHOICE >>> INPUT
        STA STR_IX
        JSR M.CRDO
        LDA #$00
        STA *S0.TA
        LDX #$00
CIN.0   STA STR.01,X    ; CLEAR INPUT BUFFER
        INX
        BNE CIN.0
CIN.1   JSR M.KPRESS
        CMP #$8D        ; '<enter>'
        BEQ MAIN
        LDX *S0.TA
        STA STR.01,X
        INC *S0.TA
        BEQ MAIN
        JSR M.COUT
        JMP CIN.1
        RTS

CMEN    LDA #$02        ; CHOICE >>> MENU
        STA STR_IX      ; ISTROUT offset = 2
CME.0   JSR M.CRDO
        LDA STR_IX
        CLC
        ADC #"0"-2      ; ISTROUT offset = 2
        JSR M.COUT
        LDA #")"
        JSR M.COUT
        JSR M.OUTSP
        LDA STR_IX
        JSR ISTROUT     ; PRINT STRING 2
        INC STR_IX
        INY
        LDA (S0.TX),Y
        BNE CME.0
CME.1   JSR M.KPRESS
        SEC
        SBC #$AE
        CMP #$0C        ; 0A + ISTROUT offset
        BPL CME.1
        STA STR_IX

MAIN    JSR M.CRDO
        JSR M.CRDO

        LDA #$00        ; PRINT METHOD 0     >> TITLE MESSAGE
        STA *S0.TA
        LDA #$01
        JSR ISTROUT     ; PRINT STRING 1
        JSR M.CRDO

        LDA #$01        ; PRINT METHOD 1     >> STRING (with SPACE)
        STA *S0.TA
        LDA STR_IX
        JSR ISTROUT     ; PRINT STRING IX
        JSR M.CRDO

        LDA #$02        ; PRINT METHOD 2     >> HEX
        STA *S0.TA
        LDA STR_IX
        JSR ISTROUT     ; PRINT STRING IX
        JSR M.CRDO

        LDA #$03        ; PRINT METHOD 3     >> NUM
        STA *S0.TA
        LDA STR_IX
        JSR ISTROUT     ; PRINT STRING IX
        JSR M.CRDO

        LDA #$04        ; PRINT METHOD 4    >> ALNUM
        STA *S0.TA
        LDA STR_IX
        JSR ISTROUT     ; PRINT STRING IX
        JSR M.CRDO

        LDA #$05        ; PRINT METHOD 5    >> BYTE
        STA *S0.TA
        LDA STR_IX
        JSR ISTROUT     ; PRINT STRING IX
        JSR M.CRDO

        LDA #$00        ; RESET CHARACTER COMPATIBILITY INDICATOR
        STA CH_RNG

        LDA #$06        ; PRINT METHOD 6    >> ROLLING INDICATOR
        STA *S0.TA
        LDA STR_IX
        JSR ISTROUT     ; PRINT STRING IX
        JSR M.CRDO

        LDA CH_RNG
        JSR M.PRBYTE    ; CATCH RESULT 0=NUMERIC 1=ALPHA 2=BYTE
        JSR M.CRDO

        LDA #$07        ; PRINT METHOD 7    >> ROLLING INDICATOR
        STA *S0.TA
        LDA STR_IX
        JSR ISTROUT     ; PRINT STRING IX
        JSR M.CRDO

        RTS

; *** PRINT STRING from A = INDEX ***
IST_D   HEX 00
ISTROUT LDY #<STR.00    ; init pointer
        STY *S0.TX
        LDY #>STR.00    ; init pointer
        STY *S0.TY
IST.0   LDY #$00
        ;TAX
        STA IST_D
        CMP #$00
        BEQ IST.2
        DEY
IST.1   INY
        LDA (S0.TX),Y
        BNE IST.1
        ;DEX
        DEC IST_D
        BNE IST.1
        INY             ; Y = found starting index
IST.2   LDA (S0.TX),Y   ; Print string until next zero
        BEQ IST.3

        JSR PRMETH
        INY
        BNE IST.2
IST.3   RTS
CHAR    HEX 00
COUT    STA CHAR
        LDA CH_SET
        CMP #$01
        BEQ COU.1     ; SKIP IF APPPLE IIe

        LDA CHAR
        CMP #$E1      ; *** DETECT LOWERCASE RANGE ***
        BCC COU.1
        CMP #$FB
        BCS COU.1
        SEC
        SBC #$20
        STA CHAR

COU.1   LDA CHAR
        JSR M.COUT
        RTS


PRMETH  LDX *S0.TA      ; PRINT METHOD
        CPX #$00        ;>> PRINT NORMAL ASCII
        BNE PRM.0
        CLC
        ADC CH_IDX
        JMP COUT

PRM.0   CPX #$01        ;>> PRINT NORMAL ASCII with SPACE
        BNE PRM.1
        JSR COUT
        JMP M.OUTSP

PRM.1   CPX #$02        ;>> PRINT HEX
        BNE PRM.2
        JMP M.PRBYTE

PRM.2   CPX #$03        ;>> PRINT NUM COMPLIANCE
        BNE PRM.3
        JSR DENUM
        BCC PRM.21
        LDA #" "
        JMP PRM.6
PRM.21  LDA #"N"
        JMP PRM.6

PRM.3   CPX #$04       ;>> PRINT ALNUM COMPLIANCE
        BNE PRM.4
        JSR DESYM
        BCC PRM.31
        LDA #" "
        JMP PRM.6
PRM.31  LDA #"A"
        JMP PRM.6

PRM.4   CPX #$05       ;>> PRINT BYTE COMPLIANCE
        BNE PRM.5
        JSR DEBYT
        BCC PRM.41
        LDA #" "
        JMP PRM.6
PRM.41  LDA #"B"
        JMP PRM.6

PRM_D1   HEX 00
PRM_S   ASC "NA B"
PRM.5   CPX #$06       ;>> PRINT ROLLING INDICATOR
        BNE PRM.7
        ;>>>>>>>>>>>>>>>>>>>>>>>
        STA PRM_D1       ; STORE ASCII CHARACTER TO BE ANALYSED

        LDA #$01        ; INITIALISE FISRT COMPATIBILITY TYPE (1=NUMBERIC)
        STA *S0.TZ
        LDA PRM_D1
        JSR DENUM

        LDA #$02        ; INITIALISE FISRT COMPATIBILITY TYPE (2=ALPHANUM)
        STA *S0.TZ
        LDA PRM_D1
        JSR DESYM

        ;>>>>>>>>>>>>>>>>>>>>>>>
        LDX CH_RNG      ; LOAD RESULT IN A
        LDA PRM_S,X
        JMP PRM.6

PRM.6   JSR COUT
        LDA #"."
        JMP COUT

PRM_D2  HEX 000000
PRM_D3  HEX 00         ; CYCLE COUNTER
PRM_D4  HEX 00         ; ROLLING RESULT

PRM.7   CPX #$07       ;>> PRINT ROLLING INDICATOR
        BNE PRM.8
        STA PRM_D2

        CPY #$00      ; IF Y=0 RESET CYCLE COUNTER & ROLLING RESULT
        BNE PRM.70
        LDA #$00
        STA PRM_D3
        STA PRM_D4

PRM.70  LDA CH_RNG
        BNE PRM.71     ; CH_RNG=0 : NUMERIC
; TODO  NUMERIC ENCODING

;E707

PRM.71  CMP #$01     ; CH_RNG=1 : ALPHANUMERIC
        BNE PRM.72
; TODO  ALPHANUMERIC ENCODING

PRM.72  CMP #$03     ; CH_RNG=1 : BYTE
        BNE PRM.8

; TODO  BYTE ENCODING
PRM.8   RTS


DEBYT   JMP DE.2      ; *** DETECT BYTES (ALWAYS IN RANGE, ADAPTED FOR KANJI) ***
DES_D   ASC " $%*+-./:"
DESYM   LDX #$FF      ; *** DETECT SYMBOL RANGE ***
DE.1    INX
        CMP DES_D,X
        BEQ DE.2
        CPX #$08
        BNE DE.1

DEALP   CMP #"A"      ; *** DETECT ALPHA RANGE ***
        BCC DENUM
        CMP #"Z"+1
        BCS DENUM
        JMP DE.2

DENUM   CMP #"0"      ; *** DETECT NUMERIC RANGE ***
        BCC DE.3
        CMP #"9"+1
        BCS DE.3

DE.2    ;CLC          ; *** IN RANGE ***
        RTS

DE.3    LDA CH_RNG    ; *** OUT OF RANGE ***
        ORA *S0.TZ
        STA CH_RNG
        SEC
        RTS
R
;*** MAIN PARAMETERS ***
DEB_LV  HEX 00          ; DEBUG LEVEL 0=NOLOG 1=ANALYSE
CH_SET  HEX 01          ; CHARACTESET 0=II+ 1=IIe
CH_RNG  HEX 00          ; CHARACTER RANGE
STR_IX  HEX 00          ; STRING INDEX
;**************************
CH_IDX  HEX 00

; *** STRING DATA ***
STR.00   ASC "[QR-CHARSET] (M)ENU (I)NPUT"
         HEX 00
         ASC "[QR-CHARSET] (N)UMERIC (A)LNUM (B)YTE"
         HEX 00
         ASC "123 HELLO world"
         HEX 00
         ASC "PROJECT NAYUKI"
         HEX 00
         ASC "3141592653589793238"
         HEX 00
;        ASC "00000.UFF7THUFF7000001F8F7THUFF7UF00000000UFF7UFF7F7UFF7UF00000000UFF7UEUFF7T*000005F7UFF7UEUFF7UFF500000001F7T*00000.UFF7UF7QF7SK000.QOM:UPUFF7UFEA0000001+F7UFF7THUFF7UFEA0000001+F7UEUFF7UE0000003ZUFF7UF7QF7UFF7SK000000F7UF"             ;3
;        HEX 00
;        ASC "963780963783060422602361783060204414120483523180722843312481903540481542120481909180722841190481903542103542120483523180722843312481903540481542120481909180722783060240828240963809421660240963819481903536436843301180647542120487542481903542210843301178993542120481888481903536436843301180647542120487542481903542210843301"     ;4
;        HEX 00
STR.01   HEX 00
