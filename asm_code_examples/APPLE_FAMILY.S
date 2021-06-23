*=$2000

;*********************************************
;*                                           *
;*  Mini Apple II Family Identification      *
;*********************************************

I0        = $FBB3
I1        = $FB1E
I2        = $FBC0
I3        = $FBDD
I4        = $FBBE
I5        = $FBBF
M.COUT    = $FDED   ; print char
M.PRBYTE  = $FDDA   ; print hex byte
M.CRDO    = $DAFB   ; line feed
M.OUTSP   = $DB57   ; space
M.KPRESS  = $FD35   ; key press

S0.TX        = $19     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TY        = $1A     ; ONLY USE IN FUNCTIONS with no SUBS
S0.TZ        = $1B     ; ONLY USE IN FUNCTIONS with no SUBS


APID    JSR DBG.2
        JSR DBG.3

        LDA #$00
        STA *S0.TY

        LDA #$FF
        STA AF_OUT

        LDA #$B3
        STA *S0.TZ

        JSR APMAIN    ; Narrow down (38)
        JSR APMAIN    ; Narrow down (EA)
        JSR APMAIN    ; Narrow down (06)

        LDA #$1E
        STA *S0.TZ

        JSR APMAIN    ; Narrow down (AD)
        JSR APMAIN    ; Narrow down (8A)

        LDA #$C0
        STA *S0.TZ

        JSR APMAIN    ; Narrow down (EA)
        JSR APMAIN    ; Narrow down (E0)
        JSR APMAIN    ; Narrow down (00)

;        LDA #$DD
;        STA *S0.TZ
;        JSR APMAIN    ; Narrow down (02)

        LDA #$BE
        STA *S0.TZ

        JSR APMAIN    ; Narrow down (00)

        JSR DBG.4
        LDA AF_OUT
        JSR PBIN       ; OUTPUT VALUE (BIT)
        RTS


APMAIN  LDX *S0.TZ
AP.0    LDA $FB00,X   ; LOAD SOURCE ADDRESS
        STA *S0.TX    ; SOURCE VALUE

        LDA AF_OUT
        LDY *S0.TY
        LDX PAT_M,Y
        CPX *S0.TX    ; Detect pattern
        BNE AP.1
        AND CMP_M,Y   ; Narrow down
        BEQ AP.99     ; >> exit if A=0
AP.1    STA AF_OUT
        JSR DBG
        INC *S0.TY
        RTS

AP.99   PLA             ; FLUSH SUBROUTINE AND RETURN END RESULT
        PLA
        JSR DBG
        RTS

PBIN   PHA
       SEC            ;PRINT BINARY NUMBER
       ROL A          ;shift the msb out into carry while shifting in an extra index bit
PB.0   PHA            ;save the value on stack
       LDA #$58       ;character value of '0'+128 divided by 2
       ROL A
       JSR M.COUT     ;print character on screen
       PLA            ;restore value
       ASL A          ;shift msb out into carry
       BNE PB.0      ;if msb was the extra index bit, a is now zero, otherwise continue loop
       PLA
       RTS            ;by this way all 8 bits of a are processed even if a=0

;*********************************************************

AF_OUT  HEX 00  ; OUTPUT

; IDENTITY MAP HAS 7 bits (ruling out)
PAT_M   HEX 38EA06AD8A0A000000        ; PATTERN MAP
CMP_M   HEX 8186F8FBFDB7A7C4A0        ; COMPATIBILITY MAP

STR.00  ASC "[APPLE-FAMILY CHECKUP] BITMAP SPECS:"
        .BYTE $0A
        .BYTE $0A
        ASC "_7_ _6_ _5__ _4__ _3_ _2_ _1_ _0_"
        .BYTE $0A
        ASC "2GS IIC IIEO IIEE IIE /// ][+ ]["
        .BYTE $0A
        .BYTE $00
STR.01  HEX 0A
        ASC "ID VECTOR_ TST ___MASK____ _OUTPUT_"
        .BYTE $0A
        .BYTE $00
STR.02  HEX A0A0A0A0A0A0A0A0
        HEX A0A0A0A0A0A0A0A0
        HEX A0A0A0A0A0A0A0A0
        HEX A0A0A0
        ASC "--------"
        .BYTE $0A
        ASC "OUTPUT BITMAP [76543210] ="
        HEX 00
;*********************************************************

DBG     TYA
        JSR M.PRBYTE    ; STEP
        JSR M.OUTSP

        LDA AP.0+2
        JSR M.PRBYTE    ; SOURCE ADDRESS (H)
        LDA *S0.TZ
        JSR M.PRBYTE    ; SOURCE ADDRESS (L)
        LDA #':'
        JSR M.COUT
        LDA *S0.TX
        JSR M.PRBYTE    ; SOURCE VALUE
        JSR M.OUTSP

        LDY *S0.TY
        LDA PAT_M,Y
        JSR M.PRBYTE    ; PATTERN
        LDA #'?'
        JSR M.COUT
        JSR M.OUTSP

        LDY *S0.TY
        LDA CMP_M,Y
        JSR M.PRBYTE    ; FILTER VALUE (HEX)
        JSR M.OUTSP
        LDY *S0.TY
        LDA CMP_M,Y
        JSR PBIN       ; FILTER VALUE (BIT)

        LDY *S0.TY
        LDX PAT_M,Y
        LDA #' '
        CPX *S0.TX
        BNE DEB.0
        LDA #'>'
DEB.0   JSR M.COUT      ; PATTERN DETECTED ?

        LDA AF_OUT
        JSR PBIN       ; OUTPUT VALUE (BIT)

        ;LDA AF_OUT
        ;JSR IS1BIT
        ;BCC DBG.1
        ;LDA #'>'
        ;JSR M.COUT

DBG.1   JSR M.CRDO
        JSR M.KPRESS
        RTS

DBG.2   LDY #<STR.00    ; init pointer
        STY *S0.TX
        LDY #>STR.00    ; init pointer
        JMP DBG.X

DBG.3   LDY #<STR.01    ; init pointer
        STY *S0.TX
        LDY #>STR.01    ; init pointer
        JMP DBG.X

DBG.4   LDY #<STR.02    ; init pointer
        STY *S0.TX
        LDY #>STR.02    ; init pointer

DBG.X   STY *S0.TY
        JSR STROUT
        RTS

STROUT LDY #$00
STR.0  LDA (S0.TX),Y   ; Print string until next zero
       BEQ STR.2
       CMP #$0A
       BEQ STR.3
       JSR M.COUT
STR.1  INY
       BNE STR.0
STR.2  RTS
STR.3  JSR M.CRDO
       JMP STR.1


;ISO_D  HEX 00
;IS1BIT STA ISO_D           ; IS THERE ONLY ONE BIT ?
;ISO.0  LSR A
;       BCC ISO.0
;       BEQ ISO.2
;       INY
;       JMP ISO.0
;ISO.2  LDA ISO_D
;       CPY #01
;       RTS

;FDED: 60
;FDDA: 60
;DAFB: 60
;DB57: 60
;FBB3: 38
