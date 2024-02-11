*=$6000

M.PRBYTE  = $FDDA   ; print hex byte
M.CRDO    = $DAFB   ; line feed
M.OUTSP   = $DB57   ; space
M.COUT    = $FDED   ; print char
M.KPRESS  = $FD35   ; key press
M.HGR     = $F3E2   ; set hires mode + clear screen
M.HGRCOL  = $F3F6   ; clear screen colour
M.TEXT    = $F399   ; set text mode
M.SELHGR  = $F3E4   ; set hires mode only

DIVIDE   = $FB  ;LO-BYTE
DIVISO   = $58  ;LO-BYTE
REMAIN   = $FD  ;LO-BYTE
RESULT   = $FB  ;LO-BYTE
S0.TA        = $18     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TX        = $19     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TY        = $1A     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TZ        = $1B     ; ONLY USE IN FUNCTIONS with no SUBS

       LDA #$00
       STA V.VER
START  INC V.VER
       JSR AL_PAT     ; MAIN FUNCTION CALL
       LDA V.VER
       CMP #$28
       BNE START
       RTS

; -----------------------------------------------------

AL_PAT  LDA V.VER     ; MAIN FUNCTION
        CMP #$02
        BMI PAT.04

PAT.01  ASL A         ; VERSION / 4
        ASL A
        CLC
        ADC #$0A
        STA V.MAX

        SEC
        SBC #$06
        STA V.DIS

        LDX #$1C
        JSR DIV8      ; DIS / 28d (1C)
        JSR DVCEIL
        STA V.NUM

        LDA V.DIS      ; V.DIS / V.NUM = V.INT
        LDX V.NUM
        JSR DIV8
        JSR DVROUN
        STA V.INT


        LDA V.INT
        LSR A
        LDA #$00
        ADC V.INT      ;  + INT%2
        STA V.INT

          JSR DBG.01

        LDA #$06
          JSR DBG.02

        ;LDX V.VER
        ;LDA ALPREF-2,X     ; LOAD FIRST ITEM

        LDA #<ALPRE2
        STA *RESULT
        LDA #>ALPRE2
        STA *RESULT+1
        LDA V.VER
        JSR NIB.02

        STA *S0.TA
          JSR DBG.02

; --- iterate 8 times, write value < V.MAX, otherwise write 0 ??
; TODO CAN WE MAKE A DOUBLE LOOP BASED ??

PAT.02  LDA *S0.TA
        CLC
        ADC V.INT
        CMP V.MAX
        BEQ PAT.03
        BPL PAT.04   ; EXIT LOOP WHEN *RESULT + V.INT > V.MAX
PAT.03  STA *S0.TA
          JSR DBG.02
        JMP PAT.02
PAT.04  RTS



; -----------------------------------------------------

DIV8    STA *DIVIDE     ; A / X
        STX *DIVISO
        LDA #$00
        STA *DIVIDE+1
        STA *DIVISO+1

DIV16 	LDA #$00	        ;PRESET REMAINDER TO 0
        STA *REMAIN
	      STA *REMAIN+1
	      LDX #$10	        ;REPEAT FOR EACH BIT: ...
DIV.01	ASL *DIVIDE	      ;DIVIDEEND LB & HB*2, MSB -> CARRY
	      ROL *DIVIDE+1
	      ROL *REMAIN	      ;REMAINDER LB & HB * 2 + MSB FROM CARRY
	      ROL *REMAIN+1
	      LDA *REMAIN
	      SEC
	      SBC *DIVISO	      ;SUBSTRACT DIVISOOR TO SEE IF IT FITS IN
	      TAY	              ;LB RESULT -> Y, FOR WE MAY NEED IT LATER
        LDA *REMAIN+1
	      SBC *DIVISO+1
        BCC DIV.02	      ;IF CARRY=0 THEN DIVISOOR DIDN'T FIT IN YET
	      STA *REMAIN+1	    ;ELSE SAVE SUBSTRACTION RESULT AS NEW REMAINDER,
	      STY *REMAIN
	      INC *RESULT	      ;AND INCREMENT RESULT CAUSE DIVISOOR FIT IN 1 TIMES
DIV.02	DEX
	      BNE DIV.01
	      RTS

DVCEIL  LDA *REMAIN
        BEQ DIV.04
        BNE DIV.03

DVROUN  LDA *DIVISO
        LSR A
        CMP *REMAIN
        CLC
        BPL DIV.04
DIV.03  INC *RESULT
DIV.04  LDA *RESULT
        RTS

DBG.00  LDA V.VER,X
        JSR M.PRBYTE
        JSR M.OUTSP
        INX
        RTS

;DBG.01 RTS
DBG.01  JSR M.CRDO
        JSR M.KPRESS
        LDX #$00
        JSR DBG.00
;        JSR DBG.00
;        JSR DBG.00
;        JSR DBG.00
;        JSR DBG.00
;        JSR M.OUTSP
        RTS

;DBG.02 RTS
DBG.02  JSR M.PRBYTE
        JSR M.OUTSP
        RTS

V.VER   HEX 00    ; VERSION
V.MAX   HEX 00    ; LAST ITEM
V.DIS   HEX 00    ; DISTANCE BETWEEN FIRST & LAST
V.NUM   HEX 00    ; NUMBER OF ITERATIONS
V.INT   HEX 00    ; INTERVAL
V.TMP   HEX 00

NIBTST  LDA #<ALPRE2
        STA *RESULT
        LDA #>ALPRE2
        STA *RESULT+1
        LDA #$00
        STA *S0.TA

NT.01   NOP
        LDA *S0.TA    ; VERSION COUNTER
        JSR M.PRBYTE
        LDA #'-'
        JSR M.COUT
        LDA *S0.TA
        JSR NIB.02
        JSR M.PRBYTE
        JSR M.OUTSP
        INC *S0.TA
        LDA *S0.TA
        CMP #$29
        BNE NT.01
        RTS

; A = INDEX   [RESULT(+1)] = BASE ADDRESS
NIBBLE  LSR A
        TAY
        LDA (RESULT),Y
        BCS NIB.01
        LSR A
        LSR A
        LSR A
        LSR A
NIB.01  AND #$0F
        RTS

NIB.02  JSR NIBBLE
        ASL A
        CLC
        ADC #$12
        RTS

; 40 Bytes
ALPREF  HEX 12161A1E2216181A
        HEX 1C1E20221A1A1A
        HEX 1E1E1E221C1A1E1C
        HEX 201E221A1E1A1E22
        HEX 1E221E181C201A1E

ALPRE2  HEX 0002468234567844
        HEX 4666854657684646
        HEX 8686357460


; 02:[06,12],
; 03:[06,16],
; 04:[06,1A],
; 05:[06,1E],
; 06:[06,22],
; 07:[06,16,26],
; 08:[06,18,2A],
; 09:[06,1A,2E],
; 0A:[06,1C,32],
; 0B:[06,1E,36],
; 0C:[06,20,3A],
; 0D:[06,22,3E],
; 0E:[06,1A,2E,42],
; 0F:[06,1A,30,46],
; 10:[06,1A,32,4A],
; 11:[06,1E,36,4E],
; 12:[06,1E,38,52],
; 13:[06,1E,3A,56],
; 14:[06,22,3E,5A],
; 15:[06,1C,32,48,5E],
; 16:[06,1A,32,4A,62],
; 17:[06,1E,36,4E,66],
; 18:[06,1C,36,50,6A],
; 19:[06,20,3A,54,6E],
; 1A:[06,1E,3A,56,72],
; 1B:[06,22,3E,5A,76],
; 1C:[06,1A,32,4A,62,7A],
; 1D:[06,1E,36,4E,66,7E],
; 1E:[06,1A,34,4E,68,82],
; 1F:[06,1E,38,52,6C,86],
; 20:[06,22,3C,56,70,8A],
; 21:[06,1E,3A,56,72,8E],
; 22:[06,22,3E,5A,76,92],
; 23:[06,1E,36,4E,66,7E,96],
; 24:[06,18,32,4C,66,80,9A],
; 25:[06,1C,36,50,6A,84,9E],
; 26:[06,20,3A,54,6E,88,A2],
; 27:[06,1A,36,52,6E,8A,A6],
; 28:[06,1E,3A,56,72,8E,AA],

; TEMP VALUES
;02 12 0C 01 0C 0C
;03 16 10 01 10 10
;04 1A 14 01 14 14
;05 1E 18 01 18 18
;06 22 1C 01 1C 1C
;07 26 20 02 10 10
;08 2A 24 02 12 12
;09 2E 28 02 14 14
;0A 32 2C 02 16 16
;0B 36 30 02 18 18
;0C 3A 34 02 1A 1A
;0D 3E 38 02 1C 1C
;0E 42 3C 03 14 14
;0F 46 40 03 15 16
;10 4A 44 03 17 18
;11 4E 48 03 18 18
;12 52 4C 03 19 1A
;13 56 50 03 1B 1C
;14 5A 54 03 1C 1C
;15 5E 58 04 16 16
;16 62 5C 04 17 18
;17 66 60 04 18 18
;18 6A 64 04 19 1A
;19 6E 68 04 1A 1A
;1A 72 6C 04 1B 1C
;1B 76 70 04 1C 1C
;1C 7A 74 05 17 18
;1D 7E 78 05 18 18
;1E 82 7C 05 19 1A
;1F 86 80 05 1A 1A
;20 8A 84 05 1A 1A
;21 8E 88 05 1B 1C
;22 92 8C 05 1C 1C
;23 96 90 06 18 18
;24 9A 94 06 19 1A
;25 9E 98 06 19 1A
;26 A2 9C 06 1A 1A
;27 A6 A0 06 1B 1C
;28 AA A4 06 1B 1C
